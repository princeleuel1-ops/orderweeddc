"""Durable mission creation, ranking, leasing, transition, and recovery."""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from typing import Any

from runtime_utils import add_seconds, canonical_json, utc_now
from state_store import ACTIVE_STATES, MISSION_STATES, StateStore


@dataclass(frozen=True)
class MissionSpec:
    mission_id: str
    objective: str
    rationale: str
    lane: str
    primary_model: str
    secret_reference: str
    priority: float
    acceptance_criteria: list[Any]
    prohibited_changes: list[str]
    fallback_models: list[str] = field(default_factory=list)
    dependencies: list[str] = field(default_factory=list)
    parent_mission_id: str | None = None
    modifying: bool = False
    maximum_attempts: int = 3
    next_action: str = "lease and execute"
    assumptions: list[str] = field(default_factory=list)
    sota_gap: str = ""
    brittle_point: str = ""
    success_metrics: list[Any] = field(default_factory=list)
    feedback_signals: list[str] = field(default_factory=list)
    benchmark_evidence: list[dict[str, Any]] = field(default_factory=list)
    measurement_contract: list[dict[str, Any]] = field(default_factory=list)
    falsification_test: str = ""
    promotion_rule: str = ""
    next_frontier: str = ""
    frontier_epoch: int = 1
    strategy_revision: int = 1


class InvalidTransition(RuntimeError):
    pass


ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "queued": {"leased", "blocked_external", "blocked_human", "superseded"},
    "leased": {
        "planning",
        "researching",
        "implementing",
        "queued",
        "blocked_external",
        "blocked_human",
        "failed_retryable",
    },
    "planning": {"researching", "implementing", "awaiting_criticism", "failed_retryable"},
    "researching": {"awaiting_criticism", "failed_retryable", "blocked_external"},
    "implementing": {"awaiting_criticism", "failed_retryable", "blocked_external"},
    "awaiting_criticism": {"rejected", "awaiting_verification", "failed_retryable"},
    "rejected": {"repairing", "failed_terminal", "superseded"},
    "repairing": {"awaiting_criticism", "failed_retryable", "failed_terminal"},
    "awaiting_verification": {"awaiting_release_judgment", "rejected", "failed_retryable"},
    "awaiting_release_judgment": {"accepted", "rejected", "blocked_human"},
    "accepted": {"integrating", "post_integration_verification", "completed"},
    "integrating": {"integrated", "rejected", "failed_retryable"},
    "integrated": {"post_integration_verification", "failed_retryable"},
    "post_integration_verification": {"completed", "repairing", "failed_terminal"},
    "retry_wait": {"queued", "failed_terminal"},
    "blocked_external": {"queued", "superseded"},
    "blocked_human": {"queued", "superseded"},
    "failed_retryable": {"retry_wait", "queued", "failed_terminal"},
    "failed_terminal": set(),
    "superseded": set(),
    "completed": set(),
}


class MissionQueue:
    def __init__(self, store: StateStore):
        self.store = store

    def enqueue(self, spec: MissionSpec) -> bool:
        now = utc_now()
        cursor = self.store.execute(
            """
            INSERT OR IGNORE INTO missions(
              mission_id,parent_mission_id,objective,rationale,lane,primary_model,
              fallback_models_json,secret_reference,priority,dependencies_json,
              acceptance_criteria_json,prohibited_changes_json,modifying,
              assumptions_json,sota_gap,brittle_point,success_metrics_json,
              feedback_signals_json,benchmark_evidence_json,
              measurement_contract_json,falsification_test,promotion_rule,
              next_frontier,frontier_epoch,strategy_revision,state,
              attempt_number,maximum_attempts,next_action,created_at,updated_at
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'queued',0,?,?,?,?)
            """,
            (
                spec.mission_id,
                spec.parent_mission_id,
                spec.objective,
                spec.rationale,
                spec.lane,
                spec.primary_model,
                canonical_json(spec.fallback_models),
                spec.secret_reference,
                float(spec.priority),
                canonical_json(spec.dependencies),
                canonical_json(spec.acceptance_criteria),
                canonical_json(spec.prohibited_changes),
                1 if spec.modifying else 0,
                canonical_json(
                    spec.assumptions
                    or ["Repository evidence is current enough to select this bounded mission."]
                ),
                spec.sota_gap.strip() or spec.objective,
                spec.brittle_point.strip()
                or "The mission's weakest assumption must be tested before integration.",
                canonical_json(spec.success_metrics or spec.acceptance_criteria),
                canonical_json(
                    spec.feedback_signals or ["deterministic verification evidence"]
                ),
                canonical_json(spec.benchmark_evidence),
                canonical_json(spec.measurement_contract),
                spec.falsification_test.strip(),
                spec.promotion_rule.strip(),
                spec.next_frontier.strip(),
                max(1, int(spec.frontier_epoch)),
                max(1, int(spec.strategy_revision)),
                max(1, int(spec.maximum_attempts)),
                spec.next_action,
                now,
                now,
            ),
        )
        created = cursor.rowcount == 1
        if created:
            self.store.event("mission_queued", {"priority": spec.priority, "lane": spec.lane}, spec.mission_id)
        return created

    def get(self, mission_id: str) -> dict[str, Any] | None:
        return self.store.row("SELECT * FROM missions WHERE mission_id=?", (mission_id,))

    def list(self, states: set[str] | None = None) -> list[dict[str, Any]]:
        if not states:
            return self.store.rows("SELECT * FROM missions ORDER BY priority DESC,created_at")
        unknown = states - MISSION_STATES
        if unknown:
            raise ValueError(f"unknown mission states: {sorted(unknown)}")
        placeholders = ",".join("?" for _ in states)
        return self.store.rows(
            f"SELECT * FROM missions WHERE state IN ({placeholders}) ORDER BY priority DESC,created_at",
            tuple(sorted(states)),
        )

    def _dependencies_satisfied(self, mission: dict[str, Any]) -> bool:
        dependencies = json.loads(mission["dependencies_json"])
        for mission_id in dependencies:
            row = self.store.row("SELECT state FROM missions WHERE mission_id=?", (mission_id,))
            if not row or row["state"] != "completed":
                return False
        return True

    def lease_next(self, owner: str, lease_seconds: int = 900) -> dict[str, Any] | None:
        with self.store.transaction() as db:
            candidates = [
                dict(row)
                for row in db.execute(
                    """
                    SELECT * FROM missions
                    WHERE state='queued'
                    ORDER BY priority DESC,created_at
                    """
                ).fetchall()
            ]
            selected = next((item for item in candidates if self._dependencies_satisfied(item)), None)
            if not selected:
                return None
            now = utc_now()
            expires = add_seconds(now, lease_seconds)
            operation_id = f"lease:{selected['mission_id']}:{uuid.uuid4().hex}"
            cursor = db.execute(
                """
                UPDATE missions SET state='leased',lease_owner=?,lease_started_at=?,
                  lease_expires_at=?,attempt_number=attempt_number+1,operation_id=?,
                  next_action='plan bounded execution',updated_at=?
                WHERE mission_id=? AND state='queued'
                """,
                (owner, now, expires, operation_id, now, selected["mission_id"]),
            )
            if cursor.rowcount != 1:
                return None
        leased = self.get(selected["mission_id"])
        self.store.event(
            "mission_leased",
            {"owner": owner, "expires_at": leased["lease_expires_at"] if leased else expires},
            selected["mission_id"],
        )
        return leased

    def transition(
        self,
        mission_id: str,
        target: str,
        *,
        next_action: str,
        updates: dict[str, Any] | None = None,
        allow_same: bool = False,
    ) -> dict[str, Any]:
        if target not in MISSION_STATES:
            raise InvalidTransition(f"unknown target state: {target}")
        current = self.get(mission_id)
        if not current:
            raise KeyError(mission_id)
        source = current["state"]
        if target == source and allow_same:
            return current
        if target not in ALLOWED_TRANSITIONS.get(source, set()):
            raise InvalidTransition(f"{source} -> {target} is not allowed")
        columns: dict[str, Any] = {
            "state": target,
            "next_action": next_action,
            "updated_at": utc_now(),
            **(updates or {}),
        }
        if target == "completed":
            columns["completed_at"] = utc_now()
        if target in {"completed", "failed_terminal", "superseded"}:
            columns["lease_owner"] = None
            columns["lease_started_at"] = None
            columns["lease_expires_at"] = None
        assignment = ",".join(f"{name}=?" for name in columns)
        values = tuple(columns.values()) + (mission_id, source)
        cursor = self.store.execute(
            f"UPDATE missions SET {assignment} WHERE mission_id=? AND state=?",
            values,
        )
        if cursor.rowcount != 1:
            raise InvalidTransition(f"concurrent transition prevented for {mission_id}")
        self.store.event("mission_transition", {"source": source, "target": target}, mission_id)
        updated = self.get(mission_id)
        assert updated is not None
        return updated

    def recover_expired_leases(self) -> int:
        now = utc_now()
        rows = self.store.rows(
            """
            SELECT mission_id,state,attempt_number,maximum_attempts
            FROM missions
            WHERE lease_expires_at IS NOT NULL AND lease_expires_at<?
              AND state NOT IN ('completed','failed_terminal','superseded','queued',
                                'blocked_external','blocked_human','retry_wait')
            """,
            (now,),
        )
        for row in rows:
            target = "failed_terminal" if row["attempt_number"] >= row["maximum_attempts"] else "queued"
            self.store.execute(
                """
                UPDATE missions SET state=?,lease_owner=NULL,lease_started_at=NULL,
                  lease_expires_at=NULL,blocker_classification='orphaned_lease',
                  next_action=?,updated_at=?
                WHERE mission_id=?
                """,
                (
                    target,
                    "human review required" if target == "failed_terminal" else "retry from durable checkpoint",
                    now,
                    row["mission_id"],
                ),
            )
            self.store.event("stale_lease_recovered", {"prior_state": row["state"], "target": target}, row["mission_id"])
        return len(rows)

    def recover_orphaned_active_missions(self, live_owner: str | None = None) -> int:
        rows = self.list(set(ACTIVE_STATES))
        recovered = 0
        for row in rows:
            if live_owner and row["lease_owner"] == live_owner:
                continue
            target = "failed_terminal" if row["attempt_number"] >= row["maximum_attempts"] else "queued"
            self.store.execute(
                """
                UPDATE missions SET state=?,lease_owner=NULL,lease_started_at=NULL,
                  lease_expires_at=NULL,blocker_classification='orphaned_supervisor',
                  next_action=?,updated_at=? WHERE mission_id=?
                """,
                (
                    target,
                    "review terminal evidence" if target == "failed_terminal" else "resume from durable evidence",
                    utc_now(),
                    row["mission_id"],
                ),
            )
            self.store.event("orphaned_mission_recovered", {"prior_state": row["state"], "target": target}, row["mission_id"])
            recovered += 1
        return recovered

    def create_repair(self, rejected: dict[str, Any], reason: str) -> str:
        repair_id = f"{rejected['mission_id']}-R{int(rejected['attempt_number']) + 1}"
        history = json.loads(rejected["repair_history_json"])
        history.append({"created_at": utc_now(), "reason": reason, "repair_mission_id": repair_id})
        self.store.execute(
            "UPDATE missions SET repair_history_json=?,updated_at=? WHERE mission_id=?",
            (canonical_json(history), utc_now(), rejected["mission_id"]),
        )
        self.enqueue(
            MissionSpec(
                mission_id=repair_id,
                parent_mission_id=rejected["mission_id"],
                objective=f"Repair rejected mission: {rejected['objective']}",
                rationale=reason,
                lane=rejected["lane"],
                primary_model=rejected["primary_model"],
                fallback_models=json.loads(rejected["fallback_models_json"]),
                secret_reference=rejected["secret_reference"],
                priority=float(rejected["priority"]) + 1,
                dependencies=[],
                acceptance_criteria=json.loads(rejected["acceptance_criteria_json"]),
                prohibited_changes=json.loads(rejected["prohibited_changes_json"]),
                modifying=bool(rejected["modifying"]),
                maximum_attempts=int(rejected["maximum_attempts"]),
                assumptions=json.loads(rejected["assumptions_json"]),
                sota_gap=rejected["sota_gap"],
                brittle_point=(
                    f"Rejected approach: {reason}. The repair must falsify this failure "
                    "before reusing the prior strategy."
                ),
                success_metrics=json.loads(rejected["success_metrics_json"]),
                feedback_signals=[
                    *json.loads(rejected["feedback_signals_json"]),
                    "independent rejection evidence",
                ],
                strategy_revision=int(rejected["strategy_revision"]) + 1,
            )
        )
        return repair_id

    def create_strategy_pivot(self, stalled: dict[str, Any], reason: str) -> str:
        """Decompose a repeated approach into a new, explicitly different strategy."""
        revision = int(stalled.get("strategy_revision") or 1) + 1
        pivot_id = f"{stalled['mission_id']}-P{revision}"
        fallbacks = json.loads(stalled["fallback_models_json"])
        primary = fallbacks[0] if fallbacks else stalled["primary_model"]
        remaining = [
            model for model in [stalled["primary_model"], *fallbacks] if model != primary
        ]
        assumptions = json.loads(stalled["assumptions_json"])
        assumptions.append(
            "The stalled strategy is not the only viable route to the measured outcome."
        )
        self.enqueue(
            MissionSpec(
                mission_id=pivot_id,
                parent_mission_id=stalled["mission_id"],
                objective=(
                    f"Strategy revision {revision}: decompose and overcome the SOTA gap "
                    f"without repeating the failed approach for {stalled['objective']}"
                ),
                rationale=f"No-progress fingerprint repeated: {reason}",
                lane=stalled["lane"],
                primary_model=primary,
                fallback_models=remaining,
                secret_reference=stalled["secret_reference"],
                priority=float(stalled["priority"]) + 2,
                dependencies=[],
                acceptance_criteria=json.loads(stalled["acceptance_criteria_json"]),
                prohibited_changes=json.loads(stalled["prohibited_changes_json"]),
                modifying=bool(stalled["modifying"]),
                maximum_attempts=int(stalled["maximum_attempts"]),
                assumptions=assumptions,
                sota_gap=stalled["sota_gap"],
                brittle_point=(
                    f"The prior strategy revision {revision - 1} repeated without "
                    "measurable criteria or score movement."
                ),
                success_metrics=json.loads(stalled["success_metrics_json"]),
                feedback_signals=[
                    *json.loads(stalled["feedback_signals_json"]),
                    "new strategy fingerprint differs from the stalled approach",
                ],
                strategy_revision=revision,
                next_action="lease a decomposed strategy with changed evidence or routing",
            )
        )
        self.store.event(
            "strategy_pivot_queued",
            {
                "pivot_mission_id": pivot_id,
                "strategy_revision": revision,
                "reason": reason,
            },
            stalled["mission_id"],
        )
        return pivot_id

    def unblock_provider_ready(self, accepted_references: set[str]) -> int:
        rows = self.store.rows("SELECT mission_id,secret_reference FROM missions WHERE state='blocked_external'")
        count = 0
        for row in rows:
            if row["secret_reference"] in accepted_references:
                self.store.execute(
                    """
                    UPDATE missions SET state='queued',blocker_classification=NULL,
                      next_action='provider accepted; lease mission',updated_at=?
                    WHERE mission_id=?
                    """,
                    (utc_now(), row["mission_id"]),
                )
                self.store.event("mission_unblocked", {"reason": "provider_ready"}, row["mission_id"])
                count += 1
        return count

    def requeue_clean_base_blocked(self) -> list[str]:
        """Administratively requeue only missions blocked by a dirty primary tree."""
        classifications = (
            "blocked_dirty_primary",
            "dirty_primary",
            "dirty_working_tree",
            "primary_worktree_dirty",
            "clean_base",
        )
        placeholders = ",".join("?" for _ in classifications)
        rows = self.store.rows(
            f"""
            SELECT mission_id,state FROM missions
            WHERE blocker_classification IN ({placeholders})
              AND state NOT IN ('completed','failed_terminal','superseded')
            ORDER BY created_at
            """,
            classifications,
        )
        now = utc_now()
        for row in rows:
            self.store.execute(
                """
                UPDATE missions SET state='queued',blocker_classification=NULL,
                  lease_owner=NULL,lease_started_at=NULL,lease_expires_at=NULL,
                  next_action='clean protected base available; lease mission',
                  updated_at=? WHERE mission_id=?
                """,
                (now, row["mission_id"]),
            )
            self.store.event(
                "mission_unblocked",
                {"reason": "clean_protected_base", "prior_state": row["state"]},
                row["mission_id"],
            )
        return [row["mission_id"] for row in rows]

    def enqueue_codex_candidate_review(
        self,
        *,
        codex_mission: dict[str, Any],
        candidate_revision: str,
        worktree: str,
        lane: dict[str, Any],
    ) -> str:
        """Queue independent review bound to one exact, unchanged Codex candidate."""
        mission_id = f"REVIEW-{codex_mission['mission_id']}-{candidate_revision[:12]}"
        self.enqueue(
            MissionSpec(
                mission_id=mission_id,
                parent_mission_id=codex_mission["mission_id"],
                objective=(
                    "Independently review the exact Codex-authored candidate "
                    f"{candidate_revision} for truth, adversarial behavior, deterministic "
                    "correctness, and release judgment. Do not modify the candidate."
                ),
                rationale=(
                    f"Candidate revision {candidate_revision}; isolated worktree {worktree}. "
                    "Approvals apply only to this unchanged revision."
                ),
                lane="codex_candidate_review",
                primary_model=lane["primary_model"],
                fallback_models=lane.get("fallback_models", []),
                secret_reference=lane["secret_reference"],
                priority=float(codex_mission["priority"]) + 1,
                acceptance_criteria=[
                    "Truth lane decision is recorded for the exact candidate",
                    "Adversarial Verification decision is recorded for the exact candidate",
                    "deterministic gates pass against the exact candidate",
                    "Release Judge decision is recorded for the exact candidate",
                    "high-impact approval includes two non-Codex model families",
                ],
                prohibited_changes=[
                    "candidate modification",
                    "Codex self-approval",
                    "public deployment",
                    "force push",
                    "credential access",
                ],
                modifying=False,
                maximum_attempts=3,
                next_action="run independent lanes when accepted providers are available",
                assumptions=[
                    "The candidate revision is immutable throughout review.",
                    "Independent reviewers can inspect the candidate without modifying it.",
                ],
                sota_gap="Prove a Codex-authored candidate is safe and valuable without self-approval.",
                brittle_point="External review is unavailable or is not independent of the author.",
                success_metrics=[
                    "exact candidate hash remains unchanged",
                    "all required independent roles record evidence-backed decisions",
                    "deterministic verification passes",
                ],
                feedback_signals=[
                    "candidate hash",
                    "independent review receipts",
                    "deterministic gate receipts",
                ],
            )
        )
        self.store.execute(
            """
            UPDATE missions SET input_state_hash=?,worktree=?,next_action=?,updated_at=?
            WHERE mission_id=?
            """,
            (
                candidate_revision,
                worktree,
                "await accepted providers; review exact immutable candidate",
                utc_now(),
                mission_id,
            ),
        )
        return mission_id
