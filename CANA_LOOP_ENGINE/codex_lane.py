"""Durable Blade 0 queue, leasing, transitions, and duplicate-worker control."""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from typing import Any

from runtime_utils import add_seconds, canonical_json, sha256_text, utc_now
from state_store import CODEX_MISSION_STATES, CODEX_TERMINAL_STATES, StateStore


@dataclass(frozen=True)
class CodexMissionSpec:
    mission_id: str
    objective: str
    priority_reason: str
    baseline_revision: str
    priority: float
    acceptance_criteria: list[str]
    prohibited_actions: list[str]
    completion_contract_ids: list[str] = field(default_factory=list)
    parent_mission_id: str | None = None
    codex_mode: str = "builder"
    maximum_attempts: int = 3
    high_impact: bool = True
    next_action: str = "lease one bounded Codex job"
    assumptions: list[str] = field(default_factory=list)
    sota_gap: str = ""
    brittle_point: str = ""
    success_metrics: list[str] = field(default_factory=list)
    feedback_signals: list[str] = field(default_factory=list)
    benchmark_evidence: list[dict[str, Any]] = field(default_factory=list)
    measurement_contract: list[dict[str, Any]] = field(default_factory=list)
    falsification_test: str = ""
    promotion_rule: str = ""
    next_frontier: str = ""
    frontier_epoch: int = 1
    strategy_revision: int = 1


class CodexTransitionError(RuntimeError):
    pass


CODEX_TRANSITIONS: dict[str, set[str]] = {
    "CODEX_QUEUED": {
        "CODEX_STARTING",
        "CODEX_COOLDOWN",
        "CODEX_USAGE_LIMIT",
        "CODEX_AUTH_REQUIRED",
        "CODEX_TERMINAL_FAILURE",
    },
    "CODEX_STARTING": {
        "CODEX_WORKING",
        "CODEX_RETRYABLE_FAILURE",
        "CODEX_USAGE_LIMIT",
        "CODEX_AUTH_REQUIRED",
        "CODEX_REJECTED",
    },
    "CODEX_WORKING": {
        "CODEX_TESTING",
        "CODEX_COMPLETED",
        "CODEX_COOLDOWN",
        "CODEX_RETRYABLE_FAILURE",
        "CODEX_USAGE_LIMIT",
        "CODEX_AUTH_REQUIRED",
        "CODEX_REJECTED",
    },
    "CODEX_TESTING": {
        "CODEX_AWAITING_EXTERNAL_REVIEW",
        "CODEX_COMPLETED",
        "CODEX_REPAIRING",
        "CODEX_REJECTED",
        "CODEX_RETRYABLE_FAILURE",
    },
    "CODEX_AWAITING_EXTERNAL_REVIEW": {
        "CODEX_REPAIRING",
        "CODEX_REJECTED",
        "CODEX_INTEGRATED",
    },
    "CODEX_REPAIRING": {
        "CODEX_QUEUED",
        "CODEX_TESTING",
        "CODEX_RETRYABLE_FAILURE",
        "CODEX_TERMINAL_FAILURE",
    },
    "CODEX_COOLDOWN": {"CODEX_QUEUED", "CODEX_TERMINAL_FAILURE"},
    "CODEX_USAGE_LIMIT": {"CODEX_QUEUED", "CODEX_TERMINAL_FAILURE"},
    "CODEX_AUTH_REQUIRED": {"CODEX_QUEUED", "CODEX_TERMINAL_FAILURE"},
    "CODEX_RETRYABLE_FAILURE": {
        "CODEX_QUEUED",
        "CODEX_REPAIRING",
        "CODEX_TERMINAL_FAILURE",
    },
    "CODEX_REJECTED": {"CODEX_REPAIRING"},
    "CODEX_INTEGRATED": {"CODEX_REVERTED", "CODEX_COMPLETED"},
    "CODEX_TERMINAL_FAILURE": set(),
    "CODEX_COMPLETED": set(),
    "CODEX_REVERTED": set(),
}


class CodexLane:
    """The supervisor-owned authority for at most one active Codex child."""

    def __init__(self, store: StateStore):
        self.store = store

    def enqueue(self, spec: CodexMissionSpec) -> bool:
        objective_hash = sha256_text(" ".join(spec.objective.lower().split()))
        active = self.store.rows(
            """
            SELECT mission_id,objective FROM codex_missions
            WHERE state NOT IN (
              'CODEX_TERMINAL_FAILURE','CODEX_COMPLETED','CODEX_REJECTED',
              'CODEX_INTEGRATED','CODEX_REVERTED'
            )
            """
        )
        if any(
            sha256_text(" ".join(str(row["objective"]).lower().split())) == objective_hash
            for row in active
        ):
            return False
        now = utc_now()
        cursor = self.store.execute(
            """
            INSERT OR IGNORE INTO codex_missions(
              mission_id,parent_mission_id,objective,priority_reason,
              completion_contract_ids_json,acceptance_criteria_json,
              prohibited_actions_json,priority,baseline_revision,codex_mode,
              maximum_attempts,next_action,assumptions_json,sota_gap,
              brittle_point,success_metrics_json,feedback_signals_json,
              benchmark_evidence_json,measurement_contract_json,
              falsification_test,promotion_rule,next_frontier,frontier_epoch,
              strategy_revision,state,high_impact,created_at,updated_at
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,
                     'CODEX_QUEUED',?,?,?)
            """,
            (
                spec.mission_id,
                spec.parent_mission_id,
                spec.objective,
                spec.priority_reason,
                canonical_json(spec.completion_contract_ids),
                canonical_json(spec.acceptance_criteria),
                canonical_json(spec.prohibited_actions),
                float(spec.priority),
                spec.baseline_revision,
                spec.codex_mode,
                max(1, int(spec.maximum_attempts)),
                spec.next_action,
                canonical_json(
                    spec.assumptions
                    or ["Repository evidence is current enough for this bounded job."]
                ),
                spec.sota_gap.strip() or spec.objective,
                spec.brittle_point.strip()
                or "The weakest assumption must be tested before candidate acceptance.",
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
                1 if spec.high_impact else 0,
                now,
                now,
            ),
        )
        if cursor.rowcount == 1:
            self.store.event(
                "codex_mission_queued",
                {"priority": spec.priority, "mode": spec.codex_mode},
                spec.mission_id,
            )
            return True
        return False

    def get(self, mission_id: str) -> dict[str, Any] | None:
        return self.store.row(
            "SELECT * FROM codex_missions WHERE mission_id=?", (mission_id,)
        )

    def list(self, states: set[str] | None = None) -> list[dict[str, Any]]:
        if states is None:
            return self.store.rows(
                "SELECT * FROM codex_missions ORDER BY priority DESC,created_at"
            )
        unknown = states - CODEX_MISSION_STATES
        if unknown:
            raise ValueError(f"unknown Codex mission states: {sorted(unknown)}")
        placeholders = ",".join("?" for _ in states)
        return self.store.rows(
            f"""
            SELECT * FROM codex_missions WHERE state IN ({placeholders})
            ORDER BY priority DESC,created_at
            """,
            tuple(sorted(states)),
        )

    def active(self) -> list[dict[str, Any]]:
        return self.store.rows(
            """
            SELECT * FROM codex_missions
            WHERE state IN (
              'CODEX_STARTING','CODEX_WORKING','CODEX_TESTING','CODEX_REPAIRING'
            )
            ORDER BY priority DESC,created_at
            """
        )

    def modifying_candidate_active(self) -> bool:
        return bool(
            self.store.row(
                """
                SELECT 1 FROM codex_missions
                WHERE high_impact=1 AND (
                  state IN ('CODEX_STARTING','CODEX_WORKING','CODEX_TESTING','CODEX_REPAIRING')
                  OR (
                    state='CODEX_AWAITING_EXTERNAL_REVIEW'
                    AND candidate_revision IS NOT NULL
                  )
                ) LIMIT 1
                """
            )
        )

    def lease_next(
        self,
        owner: str,
        lease_seconds: int = 1800,
        maximum_pending_review_candidates: int = 1,
    ) -> dict[str, Any] | None:
        with self.store.transaction() as db:
            active = db.execute(
                """
                SELECT mission_id FROM codex_missions
                WHERE state IN (
                  'CODEX_STARTING','CODEX_WORKING','CODEX_TESTING','CODEX_REPAIRING'
                ) LIMIT 1
                """
            ).fetchone()
            if active:
                return None
            pending_review_candidates = int(
                db.execute(
                    """
                    SELECT COUNT(*) FROM codex_missions
                    WHERE high_impact=1
                      AND state='CODEX_AWAITING_EXTERNAL_REVIEW'
                      AND candidate_revision IS NOT NULL
                    """
                ).fetchone()[0]
            )
            review_backlog_cap = max(
                1, int(maximum_pending_review_candidates)
            )
            candidates = [
                dict(row)
                for row in db.execute(
                    """
                    SELECT * FROM codex_missions WHERE state='CODEX_QUEUED'
                    ORDER BY priority DESC,created_at
                    """
                ).fetchall()
            ]
            selected = next(
                (
                    row
                    for row in candidates
                    if not (
                        bool(row["high_impact"])
                        and pending_review_candidates >= review_backlog_cap
                    )
                ),
                None,
            )
            if not selected:
                return None
            now = utc_now()
            expires = add_seconds(now, lease_seconds)
            cursor = db.execute(
                """
                UPDATE codex_missions
                SET state='CODEX_STARTING',lease_owner=?,lease_started_at=?,
                  lease_expires_at=?,attempt_count=attempt_count+1,
                  next_action='create or resume isolated bounded job',updated_at=?
                WHERE mission_id=? AND state='CODEX_QUEUED'
                """,
                (owner, now, expires, now, selected["mission_id"]),
            )
            if cursor.rowcount != 1:
                return None
        leased = self.get(selected["mission_id"])
        self.store.event(
            "codex_mission_leased",
            {"owner": owner, "lease_expires_at": expires},
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
        if target not in CODEX_MISSION_STATES:
            raise CodexTransitionError(f"unknown target state: {target}")
        current = self.get(mission_id)
        if not current:
            raise KeyError(mission_id)
        source = str(current["state"])
        if target == source and allow_same:
            return current
        if target not in CODEX_TRANSITIONS.get(source, set()):
            raise CodexTransitionError(f"{source} -> {target} is not allowed")
        columns: dict[str, Any] = {
            "state": target,
            "next_action": next_action,
            "updated_at": utc_now(),
            **(updates or {}),
        }
        if target in CODEX_TERMINAL_STATES:
            columns.update(
                {
                    "terminal_state": target,
                    "completed_at": utc_now(),
                    "lease_owner": None,
                    "lease_started_at": None,
                    "lease_expires_at": None,
                    "process_id": None,
                }
            )
        assignment = ",".join(f"{column}=?" for column in columns)
        cursor = self.store.execute(
            f"""
            UPDATE codex_missions SET {assignment}
            WHERE mission_id=? AND state=?
            """,
            tuple(columns.values()) + (mission_id, source),
        )
        if cursor.rowcount != 1:
            raise CodexTransitionError(
                f"concurrent Codex transition prevented for {mission_id}"
            )
        self.store.event(
            "codex_mission_transition",
            {"source": source, "target": target},
            mission_id,
        )
        result = self.get(mission_id)
        assert result is not None
        return result

    def recover(self, live_pid: int | None = None) -> int:
        rows = self.active()
        recovered = 0
        for row in rows:
            if live_pid and int(row.get("process_id") or 0) == live_pid:
                continue
            terminal = int(row["attempt_count"]) >= int(row["maximum_attempts"])
            target = (
                "CODEX_TERMINAL_FAILURE"
                if terminal
                else "CODEX_RETRYABLE_FAILURE"
            )
            self.store.execute(
                """
                UPDATE codex_missions
                SET state=?,process_id=NULL,lease_owner=NULL,lease_started_at=NULL,
                  lease_expires_at=NULL,blocker_classification='orphaned_codex_process',
                  next_action=?,terminal_state=?,completed_at=?,updated_at=?
                WHERE mission_id=?
                """,
                (
                    target,
                    "review durable evidence"
                    if terminal
                    else "resume session or start a fresh bounded attempt",
                    target if terminal else None,
                    utc_now() if terminal else None,
                    utc_now(),
                    row["mission_id"],
                ),
            )
            if not terminal:
                self.transition(
                    row["mission_id"],
                    "CODEX_QUEUED",
                    next_action="retry from preserved worktree and session",
                    updates={"blocker_classification": "worker_exit"},
                )
            self.store.event(
                "codex_lease_recovered",
                {"prior_state": row["state"], "target": target},
                row["mission_id"],
            )
            recovered += 1
        return recovered

    def recover_verified_nonmodifying(self) -> int:
        rows = self.store.rows(
            """
            SELECT * FROM codex_missions
            WHERE high_impact=0
              AND state IN (
                'CODEX_TESTING','CODEX_QUEUED','CODEX_RETRYABLE_FAILURE'
              )
            """
        )
        recovered = 0
        for mission in rows:
            run = self.store.row(
                """
                SELECT run_id,started_at,exit_code,output_hash
                FROM codex_runs
                WHERE mission_id=? AND state='completed' AND exit_code=0
                ORDER BY started_at DESC LIMIT 1
                """,
                (mission["mission_id"],),
            )
            if not run:
                continue
            event = self.store.row(
                """
                SELECT details_json FROM events
                WHERE mission_id=? AND event_type='verification_passed'
                  AND created_at>=?
                ORDER BY event_id DESC LIMIT 1
                """,
                (mission["mission_id"], run["started_at"]),
            )
            if not event:
                continue
            verification = json.loads(event["details_json"])
            commands = verification.get("commands", [])
            if (
                verification.get("stage") != "codex-readonly"
                or verification.get("passed") is not True
                or not commands
                or any(item.get("exit_code") != 0 for item in commands)
            ):
                continue
            now = utc_now()
            evidence = json.loads(mission["result_evidence_json"])
            evidence.extend(
                item for item in commands if item not in evidence
            )
            self.store.execute(
                """
                UPDATE codex_missions
                SET state='CODEX_COMPLETED',terminal_state='CODEX_COMPLETED',
                  completed_at=?,process_id=NULL,lease_owner=NULL,
                  lease_started_at=NULL,lease_expires_at=NULL,
                  tests_executed_json=?,result_evidence_json=?,
                  rollback_reference='not_applicable:non_modifying',
                  blocker_classification=NULL,
                  next_action='lease the next highest-value safe mission',
                  updated_at=?
                WHERE mission_id=?
                """,
                (
                    now,
                    canonical_json([item["argv"] for item in commands]),
                    canonical_json(evidence),
                    now,
                    mission["mission_id"],
                ),
            )
            self.store.event(
                "codex_verified_post_execution_recovered",
                {
                    "run_id": run["run_id"],
                    "output_hash": run["output_hash"],
                    "verification_stage": verification["stage"],
                    "commands": [item["argv"] for item in commands],
                },
                mission["mission_id"],
            )
            recovered += 1
        return recovered

    def release_process(self, mission_id: str) -> None:
        self.store.execute(
            "UPDATE codex_missions SET process_id=NULL,updated_at=? WHERE mission_id=?",
            (utc_now(), mission_id),
        )

    def repair_cli_compatibility(self, mission_id: str) -> list[str]:
        mission = self.get(mission_id)
        if not mission:
            raise KeyError(mission_id)
        if mission["state"] not in {
            "CODEX_TERMINAL_FAILURE",
            "CODEX_REJECTED",
            "CODEX_COOLDOWN",
        }:
            raise CodexTransitionError(
                "compatibility recovery requires a stopped, rejected, or terminal mission"
            )
        now = utc_now()
        doctors = self.store.rows(
            """
            SELECT mission_id FROM codex_missions
            WHERE codex_mode='loop-doctor'
              AND state NOT IN (
                'CODEX_COMPLETED','CODEX_TERMINAL_FAILURE','CODEX_REJECTED',
                'CODEX_INTEGRATED','CODEX_REVERTED'
              )
            """
        )
        for doctor in doctors:
            self.store.execute(
                """
                UPDATE codex_missions
                SET state='CODEX_REJECTED',terminal_state='CODEX_REJECTED',
                  completed_at=?,process_id=NULL,lease_owner=NULL,
                  lease_started_at=NULL,lease_expires_at=NULL,
                  blocker_classification='superseded_compatibility_diagnosis',
                  next_action='preserve diagnosis; original mission requeued after CLI repair',
                  updated_at=? WHERE mission_id=?
                """,
                (now, now, doctor["mission_id"]),
            )
        self.store.execute(
            """
            UPDATE codex_missions
            SET state='CODEX_QUEUED',terminal_state=NULL,completed_at=NULL,
              process_id=NULL,lease_owner=NULL,lease_started_at=NULL,
              lease_expires_at=NULL,attempt_count=0,session_id=NULL,
              blocker_classification=NULL,
              next_action='CLI compatibility repaired; start fresh bounded session',
              updated_at=? WHERE mission_id=?
            """,
            (now, mission_id),
        )
        self.store.execute(
            "DELETE FROM no_progress WHERE last_mission_id=?",
            (mission_id,),
        )
        self.store.event(
            "codex_cli_compatibility_repaired",
            {
                "requeued_mission": mission_id,
                "superseded_doctors": [
                    item["mission_id"] for item in doctors
                ],
            },
            mission_id,
        )
        return [item["mission_id"] for item in doctors]

    def repair_false_usage_limit(self, mission_id: str) -> str:
        mission = self.get(mission_id)
        if not mission:
            raise KeyError(mission_id)
        if mission["state"] != "CODEX_USAGE_LIMIT":
            raise CodexTransitionError(
                "false usage-limit recovery requires a usage-limited mission"
            )
        run = self.store.row(
            """
            SELECT run_id,exit_code,error_class,output_hash
            FROM codex_runs
            WHERE mission_id=?
            ORDER BY started_at DESC LIMIT 1
            """,
            (mission_id,),
        )
        if not run or run["exit_code"] != 0 or run["error_class"] != "usage_limit":
            raise CodexTransitionError(
                "no successful run misclassified as a usage limit exists"
            )
        now = utc_now()
        self.store.execute(
            """
            UPDATE codex_runs
            SET state='completed',error_class=NULL
            WHERE run_id=?
            """,
            (run["run_id"],),
        )
        self.store.execute(
            """
            UPDATE codex_missions
            SET state='CODEX_QUEUED',process_id=NULL,lease_owner=NULL,
              lease_started_at=NULL,lease_expires_at=NULL,
              blocker_classification=NULL,
              next_action='successful run classification repaired; resume preserved session',
              updated_at=?
            WHERE mission_id=?
            """,
            (now, mission_id),
        )
        self.store.event(
            "codex_false_usage_limit_repaired",
            {
                "run_id": run["run_id"],
                "output_hash": run["output_hash"],
                "exit_code": run["exit_code"],
                "preserved_session": mission["session_id"],
                "preserved_worktree": mission["worktree"],
            },
            mission_id,
        )
        return str(run["run_id"])

    def repair_verification_environment(self, mission_id: str) -> list[str]:
        mission = self.get(mission_id)
        if not mission:
            raise KeyError(mission_id)
        if mission["state"] not in {
            "CODEX_TERMINAL_FAILURE",
            "CODEX_REJECTED",
            "CODEX_RETRYABLE_FAILURE",
        }:
            raise CodexTransitionError(
                "verification-environment recovery requires a stopped failed mission"
            )
        event = self.store.row(
            """
            SELECT details_json FROM events
            WHERE mission_id=? AND event_type='verification_failed'
            ORDER BY event_id DESC LIMIT 1
            """,
            (mission_id,),
        )
        if not event:
            raise CodexTransitionError(
                "no preserved deterministic verification failure exists"
            )
        details = json.loads(event["details_json"])
        commands = details.get("commands", [])
        if not any(
            item.get("exit_code") is None
            and item.get("artifact_path")
            for item in commands
            if isinstance(item, dict)
        ):
            raise CodexTransitionError(
                "verification failure was a code result, not an execution environment failure"
            )
        now = utc_now()
        doctors = self.store.rows(
            """
            SELECT mission_id FROM codex_missions
            WHERE parent_mission_id=? AND codex_mode='loop-doctor'
              AND state NOT IN (
                'CODEX_COMPLETED','CODEX_TERMINAL_FAILURE','CODEX_REJECTED',
                'CODEX_INTEGRATED','CODEX_REVERTED'
              )
            """,
            (mission_id,),
        )
        for doctor in doctors:
            self.store.execute(
                """
                UPDATE codex_missions
                SET state='CODEX_REJECTED',terminal_state='CODEX_REJECTED',
                  completed_at=?,process_id=NULL,lease_owner=NULL,
                  lease_started_at=NULL,lease_expires_at=NULL,
                  blocker_classification='superseded_verification_environment_diagnosis',
                  next_action='preserve diagnosis; parent requeued after runner repair',
                  updated_at=? WHERE mission_id=?
                """,
                (now, now, doctor["mission_id"]),
            )
        self.store.execute(
            """
            UPDATE codex_missions
            SET state='CODEX_QUEUED',terminal_state=NULL,completed_at=NULL,
              process_id=NULL,lease_owner=NULL,lease_started_at=NULL,
              lease_expires_at=NULL,attempt_count=0,
              blocker_classification=NULL,
              next_action='verification runner repaired; resume preserved session and worktree',
              updated_at=? WHERE mission_id=?
            """,
            (now, mission_id),
        )
        self.store.event(
            "codex_verification_environment_repaired",
            {
                "preserved_session": mission["session_id"],
                "preserved_worktree": mission["worktree"],
                "superseded_doctors": [
                    item["mission_id"] for item in doctors
                ],
            },
            mission_id,
        )
        return [item["mission_id"] for item in doctors]

    def resume_available(
        self,
        *,
        authenticated: bool,
        cooldown_active: bool,
        usage_ceiling_reached: bool,
    ) -> list[str]:
        states: list[str] = []
        if not cooldown_active and not usage_ceiling_reached:
            states.extend(["CODEX_USAGE_LIMIT", "CODEX_COOLDOWN"])
        if authenticated and not cooldown_active and not usage_ceiling_reached:
            states.append("CODEX_AUTH_REQUIRED")
        if not states:
            return []
        placeholders = ",".join("?" for _ in states)
        rows = self.store.rows(
            f"""
            SELECT mission_id,state FROM codex_missions
            WHERE state IN ({placeholders})
            """,
            tuple(states),
        )
        for row in rows:
            self.store.execute(
                """
                UPDATE codex_missions
                SET state='CODEX_QUEUED',blocker_classification=NULL,
                  next_action='availability restored; lease bounded Codex job',
                  updated_at=? WHERE mission_id=?
                """,
                (utc_now(), row["mission_id"]),
            )
            self.store.event(
                "codex_mission_availability_restored",
                {"prior_state": row["state"]},
                row["mission_id"],
            )
        return [row["mission_id"] for row in rows]

    def review_decisions(
        self, mission_id: str, candidate_revision: str
    ) -> list[dict[str, Any]]:
        return self.store.rows(
            """
            SELECT * FROM codex_reviews
            WHERE codex_mission_id=? AND candidate_revision=?
            ORDER BY created_at
            """,
            (mission_id, candidate_revision),
        )

    def record_review(
        self,
        *,
        mission_id: str,
        candidate_revision: str,
        reviewer_lane: str,
        reviewer_model: str,
        model_family: str,
        decision: str,
        evidence: list[Any],
    ) -> bool:
        review_id = f"CXREV-{uuid.uuid4().hex}"
        cursor = self.store.execute(
            """
            INSERT OR IGNORE INTO codex_reviews(
              review_id,codex_mission_id,candidate_revision,reviewer_lane,
              reviewer_model,model_family,decision,evidence_json,created_at
            ) VALUES(?,?,?,?,?,?,?,?,?)
            """,
            (
                review_id,
                mission_id,
                candidate_revision,
                reviewer_lane,
                reviewer_model,
                model_family,
                decision,
                canonical_json(evidence),
                utc_now(),
            ),
        )
        return cursor.rowcount == 1

    @staticmethod
    def valid_external_approval(
        decisions: list[dict[str, Any]], *, high_impact: bool
    ) -> bool:
        by_lane = {
            str(item["reviewer_lane"]): item
            for item in decisions
            if str(item["decision"]).upper() == "APPROVE"
        }
        if not {"truth", "adversarial_verification", "release_judge"} <= set(by_lane):
            return False
        families = {
            str(item.get("model_family") or "")
            for item in by_lane.values()
            if str(item.get("model_family") or "").lower() != "codex"
        }
        return not high_impact or len(families) >= 2
