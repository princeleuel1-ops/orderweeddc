"""Conflict-aware, idempotent, reversible local integration."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from mission_queue import MissionQueue, MissionSpec
from runtime_utils import run_process, sha256_text, utc_now
from state_store import StateStore
from worktree_manager import WorktreeManager, WorktreeReceipt


@dataclass(frozen=True)
class IntegrationResult:
    integrated: bool
    state: str
    integration_reference: str | None
    rollback_reference: str | None
    reconciliation_mission_id: str | None = None
    reason: str | None = None


class IntegrationGate:
    def __init__(
        self,
        workspace: Path,
        store: StateStore,
        queue: MissionQueue,
        worktrees: WorktreeManager,
    ):
        self.workspace = workspace.resolve()
        self.store = store
        self.queue = queue
        self.worktrees = worktrees

    def _git(self, args: list[str], timeout: int = 300) -> tuple[int, str]:
        completed = run_process(["git", *args], cwd=self.workspace, timeout=timeout)
        return completed.returncode, (completed.stdout + completed.stderr).strip()

    def _reconciliation(
        self,
        mission: dict[str, Any],
        reason: str,
        overlap: list[str],
    ) -> str:
        reconciliation_id = f"{mission['mission_id']}-RECONCILE"
        self.queue.enqueue(
            MissionSpec(
                mission_id=reconciliation_id,
                parent_mission_id=mission["mission_id"],
                objective=f"Reconcile integration conflict for {mission['mission_id']}",
                rationale=f"{reason}; overlapping files: {', '.join(overlap) if overlap else 'merge conflict'}",
                lane="implementation",
                primary_model=mission["primary_model"],
                fallback_models=json.loads(mission["fallback_models_json"]),
                secret_reference=mission["secret_reference"],
                priority=float(mission["priority"]) + 5,
                acceptance_criteria=[
                    "both diffs are preserved",
                    "conflicts are explicitly resolved",
                    "all original verification gates pass",
                ],
                prohibited_changes=json.loads(mission["prohibited_changes_json"]),
                modifying=True,
                maximum_attempts=int(mission["maximum_attempts"]),
                assumptions=json.loads(mission["assumptions_json"]),
                sota_gap=mission["sota_gap"],
                brittle_point=(
                    "Concurrent changes overlap, so an apparently valid merge may silently "
                    "discard one accepted behavior."
                ),
                success_metrics=json.loads(mission["success_metrics_json"]),
                feedback_signals=[
                    *json.loads(mission["feedback_signals_json"]),
                    "explicit overlap inventory",
                    "post-reconciliation verification",
                ],
                strategy_revision=int(mission["strategy_revision"]) + 1,
            )
        )
        self.store.event(
            "reconciliation_created",
            {"reconciliation_mission_id": reconciliation_id, "reason": reason, "overlap": overlap},
            mission["mission_id"],
        )
        return reconciliation_id

    def reject_overlap(
        self,
        mission: dict[str, Any],
        current_changed_files: list[str],
        candidate_changed_files: list[str],
    ) -> IntegrationResult | None:
        overlap = WorktreeManager.overlapping_files(current_changed_files, candidate_changed_files)
        if not overlap:
            return None
        reconciliation_id = self._reconciliation(mission, "overlapping modifying missions", overlap)
        return IntegrationResult(
            False,
            "conflict",
            None,
            None,
            reconciliation_id,
            "overlap requires reconciliation",
        )

    def integrate(
        self,
        *,
        mission: dict[str, Any],
        receipt: WorktreeReceipt,
        critic_passed: bool,
        verification_passed: bool,
        release_accepted: bool,
        mission_table: str = "missions",
    ) -> IntegrationResult:
        if mission_table not in {"missions", "codex_missions"}:
            raise ValueError("unsupported integration mission table")
        if not (critic_passed and verification_passed and release_accepted):
            result = IntegrationResult(False, "blocked_by_gate", None, None, reason="all independent gates must pass")
            self.store.event("integration_blocked", {"reason": result.reason}, mission["mission_id"])
            return result
        if not self.worktrees.primary_is_clean():
            result = IntegrationResult(False, "blocked_dirty_primary", None, None, reason="primary worktree has preserved uncommitted changes")
            self.store.event("integration_blocked", {"reason": result.reason}, mission["mission_id"])
            return result
        branch_head = self.worktrees.head(receipt.path)
        current_head = self.worktrees.head()
        operation_id = f"integration:{mission['mission_id']}:{branch_head}:{current_head}"
        should_run, prior = self.store.begin_operation(
            operation_id,
            "integration",
            sha256_text(f"{receipt.branch_name}|{branch_head}|{current_head}"),
            mission["mission_id"],
        )
        if not should_run and prior:
            return IntegrationResult(**prior)
        integration_id = f"INT-{sha256_text(operation_id)[:16]}"
        now = utc_now()
        self.store.execute(
            """
            INSERT OR REPLACE INTO integrations(
              integration_id,mission_id,base_reference,branch_name,state,created_at,updated_at
            ) VALUES(?,?,?,?,?,?,?)
            """,
            (integration_id, mission["mission_id"], current_head, receipt.branch_name, "integrating", now, now),
        )
        code, output = self._git(["merge", "--no-ff", "--no-edit", receipt.branch_name])
        if code != 0:
            self._git(["merge", "--abort"])
            reconciliation_id = (
                self._reconciliation(mission, "Git merge conflict", [])
                if mission_table == "missions"
                else None
            )
            result = IntegrationResult(False, "conflict", None, None, reconciliation_id, "merge conflict")
            self.store.finish_operation(operation_id, "conflict", result.__dict__)
            self.store.execute(
                "UPDATE integrations SET state='conflict',updated_at=? WHERE integration_id=?",
                (utc_now(), integration_id),
            )
            return result
        integration_reference = self.worktrees.head()
        rollback_reference = f"git-revert:{integration_reference}"
        result = IntegrationResult(True, "integrated", integration_reference, rollback_reference)
        self.store.finish_operation(operation_id, "completed", result.__dict__)
        self.store.execute(
            """
            UPDATE integrations SET integration_reference=?,rollback_reference=?,
              state='integrated',updated_at=? WHERE integration_id=?
            """,
            (integration_reference, rollback_reference, utc_now(), integration_id),
        )
        if mission_table == "missions":
            self.store.execute(
                """
                UPDATE missions SET integration_reference=?,rollback_reference=?,
                  operation_id=?,updated_at=? WHERE mission_id=?
                """,
                (
                    integration_reference,
                    rollback_reference,
                    operation_id,
                    utc_now(),
                    mission["mission_id"],
                ),
            )
        else:
            self.store.execute(
                """
                UPDATE codex_missions SET integration_result_json=?,
                  rollback_reference=?,updated_at=? WHERE mission_id=?
                """,
                (
                    json.dumps(result.__dict__, sort_keys=True),
                    rollback_reference,
                    utc_now(),
                    mission["mission_id"],
                ),
            )
        self.store.event(
            "integration_completed",
            {
                "integration_reference": integration_reference,
                "rollback_reference": rollback_reference,
            },
            mission["mission_id"],
        )
        return result
