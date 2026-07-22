"""Evidence-backed objective ranking across release, leadership, and invention."""

from __future__ import annotations

import datetime as dt
from pathlib import Path
from typing import Any

from mission_queue import MissionQueue, MissionSpec
from runtime_utils import canonical_json, run_process, sha256_text
from state_store import StateStore


class ObjectiveEngine:
    def __init__(self, workspace: Path, store: StateStore, queue: MissionQueue, lanes: list[dict[str, Any]]):
        self.workspace = workspace.resolve()
        self.control_tower = self.workspace / "CANA_CONTROL_TOWER"
        self.store = store
        self.queue = queue
        self.lanes = lanes

    def current_evidence(self) -> dict[str, str]:
        evidence: dict[str, str] = {}
        for name in (
            "COMPLETION_CONTRACT.md",
            "PRODUCT_SURFACE_INVENTORY.md",
            "CURRENT_STATE.md",
            "QUALITY_SCORECARD.md",
            "PROMISE_TO_PROOF_LEDGER.md",
            "BLOCKERS.md",
            "AMBITION_ROADMAP.md",
            "NEXT_ACTION.md",
        ):
            path = self.control_tower / name
            evidence[name] = path.read_text(encoding="utf-8", errors="replace") if path.is_file() else "MISSING"
        return evidence

    def initial_external_mission(self) -> MissionSpec:
        lane = self.lanes[0]
        stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d")
        return MissionSpec(
            mission_id=f"M-SWARM-AUDIT-{stamp}",
            objective=(
                "Independently audit the highest-value release-integrity weakness from current "
                "repository evidence and produce a bounded, measurable mission contract."
            ),
            rationale="The current scorecard identifies remaining release blockers; the first real cycle is non-modifying.",
            lane="five_lane_cycle",
            primary_model=lane["primary_model"],
            fallback_models=lane.get("fallback_models", []),
            secret_reference=lane["secret_reference"],
            priority=100,
            acceptance_criteria=[
                "all five independent lane receipts exist",
                "critic findings are explicit",
                "deterministic evidence is attached",
                "release judge issues an evidence-backed decision",
            ],
            prohibited_changes=[
                "public deployment",
                "credential changes",
                "force push",
                "unsupported public claims",
            ],
            modifying=False,
            maximum_attempts=3,
            assumptions=[
                "The control-tower evidence is current enough to rank release-integrity gaps.",
                "All five configured reviewers are independent enough for the required decision roles.",
            ],
            sota_gap="Identify the highest-value release-integrity bottleneck with independent evidence.",
            brittle_point="Provider unavailability can prevent criticism and judgment from being genuinely independent.",
            success_metrics=[
                "all five attributed lane receipts exist",
                "one measurable gap and baseline are explicit",
                "critic and release decisions cite evidence",
            ],
            feedback_signals=[
                "control-tower evidence hashes",
                "lane receipts",
                "deterministic verification receipts",
            ],
        )

    def initial_mock_mission(self) -> MissionSpec:
        lane = self.lanes[0]
        return MissionSpec(
            mission_id="M-MOCK-FIVE-LANE-001",
            objective="Prove the bounded five-lane protocol, evidence gates, and durable state without external inference.",
            rationale="A deterministic end-to-end acceptance mission validates orchestration independently of provider access.",
            lane="five_lane_cycle",
            primary_model=lane["primary_model"],
            fallback_models=lane.get("fallback_models", []),
            secret_reference=lane["secret_reference"],
            priority=1000,
            acceptance_criteria=[
                "five independently attributed lane runs",
                "critic pass",
                "deterministic verification pass",
                "release-judge acceptance",
                "post-cycle verification pass",
            ],
            prohibited_changes=["external network calls", "primary working-tree modification", "credential access"],
            modifying=False,
            maximum_attempts=3,
            assumptions=["Mock outputs exercise orchestration only, not model quality."],
            sota_gap="Prove the orchestration protocol deterministically before external execution.",
            brittle_point="A mocked pass can be mistaken for real independent model evidence.",
            success_metrics=[
                "five independently attributed mock receipts",
                "all rejection and verification gates remain fail-closed",
            ],
            feedback_signals=["mock lane receipts", "state transitions", "verification receipts"],
        )

    def feedback_fingerprint(self) -> str:
        head = run_process(
            ["git", "rev-parse", "HEAD"], cwd=self.workspace, timeout=30
        )
        status = run_process(
            ["git", "status", "--porcelain=v1", "--untracked-files=all"],
            cwd=self.workspace,
            timeout=30,
        )
        evidence = {
            name: sha256_text(text)
            for name, text in self.current_evidence().items()
        }
        return sha256_text(
            canonical_json(
                {
                    "head": head.stdout.strip() if head.returncode == 0 else "unavailable",
                    "status": status.stdout if status.returncode == 0 else "unavailable",
                    "control_tower": evidence,
                }
            )
        )

    def local_continuity_mission(self) -> MissionSpec:
        lane = self.lanes[3]
        fingerprint = self.feedback_fingerprint()
        return MissionSpec(
            mission_id=f"M-LOCAL-CONTINUITY-{fingerprint[:12]}",
            objective="Refresh deterministic repository health evidence while external inference is unavailable.",
            rationale=(
                "Repository or control-tower evidence changed. Refresh deterministic "
                f"feedback for state fingerprint {fingerprint[:12]} without relabeling it."
            ),
            lane="local_verification",
            primary_model="deterministic/local",
            fallback_models=[],
            secret_reference=lane["secret_reference"],
            priority=90,
            acceptance_criteria=["configured deterministic commands have reproducible receipts"],
            prohibited_changes=["model calls", "repository edits", "public deployment"],
            modifying=False,
            maximum_attempts=2,
            assumptions=[
                "A changed repository/control-tower fingerprint warrants a fresh deterministic check."
            ],
            sota_gap="Keep verification evidence synchronized with the exact repository state.",
            brittle_point="Repeating unchanged checks creates activity but no information gain.",
            success_metrics=[
                "verification receipts bind to the current state fingerprint",
                "no external-model claim is made",
            ],
            feedback_signals=[
                "repository HEAD",
                "working-tree state",
                "control-tower evidence hashes",
                "deterministic command receipts",
            ],
        )

    def ensure_seeded(self, *, mock: bool) -> list[str]:
        created: list[str] = []
        specs = [self.initial_mock_mission()] if mock else [
            self.initial_external_mission(),
            self.local_continuity_mission(),
        ]
        for spec in specs:
            if self.queue.enqueue(spec):
                created.append(spec.mission_id)
        return created

    def rank_candidates(self, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
        def score(item: dict[str, Any]) -> float:
            weights = {
                "user_value": 3.0,
                "commercial_value": 2.0,
                "trust_improvement": 4.0,
                "risk_reduction": 4.0,
                "evidence_quality": 3.0,
                "reversibility": 2.0,
                "implementation_cost": -1.5,
            }
            return sum(float(item.get(key, 0)) * weight for key, weight in weights.items())

        unique: dict[str, dict[str, Any]] = {}
        for candidate in candidates:
            objective = " ".join(str(candidate.get("objective", "")).lower().split())
            if not objective:
                continue
            candidate = {**candidate, "computed_priority": score(candidate)}
            prior = unique.get(objective)
            if prior is None or candidate["computed_priority"] > prior["computed_priority"]:
                unique[objective] = candidate
        return sorted(unique.values(), key=lambda value: value["computed_priority"], reverse=True)
