"""Automatic local rollback for post-integration regression failure."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from runtime_utils import run_process, sha256_text, utc_now
from state_store import StateStore


@dataclass(frozen=True)
class RollbackResult:
    rolled_back: bool
    rollback_reference: str | None
    reason: str


class RollbackManager:
    def __init__(self, workspace: Path, store: StateStore):
        self.workspace = workspace.resolve()
        self.store = store

    def revert(
        self,
        mission_id: str,
        integration_reference: str,
        reason: str,
        *,
        mission_table: str = "missions",
    ) -> RollbackResult:
        if mission_table not in {"missions", "codex_missions"}:
            raise ValueError("unsupported rollback mission table")
        operation_id = f"rollback:{mission_id}:{integration_reference}"
        should_run, prior = self.store.begin_operation(
            operation_id,
            "rollback",
            sha256_text(f"{integration_reference}|{reason}"),
            mission_id,
        )
        if not should_run and prior:
            return RollbackResult(**prior)
        parents = run_process(
            ["git", "rev-list", "--parents", "-n", "1", integration_reference],
            cwd=self.workspace,
            timeout=60,
        ).stdout.strip().split()
        command = ["git", "revert", "--no-edit"]
        if len(parents) > 2:
            command.extend(["-m", "1"])
        command.append(integration_reference)
        completed = run_process(command, cwd=self.workspace, timeout=300)
        if completed.returncode != 0:
            result = RollbackResult(False, None, "automatic revert failed; manual review required")
            self.store.finish_operation(operation_id, "failed", result.__dict__)
            self.store.event("rollback_failed", {"reason": reason}, mission_id)
            return result
        head = run_process(["git", "rev-parse", "HEAD"], cwd=self.workspace).stdout.strip()
        rollback_reference = f"git:{head}"
        result = RollbackResult(True, rollback_reference, reason)
        self.store.finish_operation(operation_id, "completed", result.__dict__)
        self.store.execute(
            f"""
            UPDATE {mission_table} SET rollback_reference=?,updated_at=?
            WHERE mission_id=?
            """,
            (rollback_reference, utc_now(), mission_id),
        )
        self.store.execute(
            """
            UPDATE integrations SET rollback_reference=?,state='rolled_back',updated_at=?
            WHERE mission_id=? AND integration_reference=?
            """,
            (rollback_reference, utc_now(), mission_id, integration_reference),
        )
        self.store.event(
            "integration_rolled_back",
            {
                "integration_reference": integration_reference,
                "rollback_reference": rollback_reference,
                "reason": reason,
            },
            mission_id,
        )
        return result
