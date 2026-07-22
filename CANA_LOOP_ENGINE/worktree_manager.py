"""Isolated Git worktrees for every modifying mission."""

from __future__ import annotations

import hashlib
import json
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from runtime_utils import (
    canonical_json,
    run_process,
    sha256_file,
    sha256_text,
    utc_now,
)
from state_store import StateStore


class WorktreeError(RuntimeError):
    pass


@dataclass(frozen=True)
class WorktreeReceipt:
    mission_id: str
    path: Path
    branch_name: str
    base_reference: str
    operation_id: str
    mission_table: str = "missions"


def _safe_branch_component(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip(".-")
    return cleaned[:80] or "mission"


class WorktreeManager:
    def __init__(self, workspace: Path, runtime_dir: Path, store: StateStore):
        self.workspace = workspace.resolve()
        self.runtime_dir = runtime_dir.resolve()
        self.root = (self.runtime_dir / "worktrees").resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.store = store

    def _git(self, args: list[str], *, cwd: Path | None = None, timeout: int = 180) -> str:
        completed = run_process(["git", *args], cwd=(cwd or self.workspace), timeout=timeout)
        if completed.returncode != 0:
            raise WorktreeError((completed.stderr or completed.stdout).strip())
        return completed.stdout.rstrip()

    def is_repository(self) -> bool:
        try:
            return self._git(["rev-parse", "--is-inside-work-tree"]) == "true"
        except WorktreeError:
            return False

    def primary_is_clean(self) -> bool:
        return not self._git(["status", "--porcelain=v1"])

    def head(self, cwd: Path | None = None) -> str:
        return self._git(["rev-parse", "HEAD"], cwd=cwd)

    def resolve_commit(self, reference: str) -> str:
        if not reference or not isinstance(reference, str):
            raise WorktreeError("a non-empty Git reference is required")
        return self._git(["rev-parse", "--verify", f"{reference}^{{commit}}"])

    def protected_base(self) -> str:
        reference = self.store.get_runtime("protected_integration_base", "HEAD")
        if not isinstance(reference, str):
            raise WorktreeError("protected integration base is malformed")
        return self.resolve_commit(reference)

    @staticmethod
    def _mission_table(value: str) -> str:
        if value not in {"missions", "codex_missions"}:
            raise WorktreeError("unsupported mission table")
        return value

    def create(
        self,
        mission_id: str,
        *,
        base_reference: str | None = None,
        mission_table: str = "missions",
        branch_namespace: str = "cana",
    ) -> WorktreeReceipt:
        mission_table = self._mission_table(mission_table)
        suffix = sha256_text(mission_id)[:8]
        namespace = _safe_branch_component(branch_namespace)
        branch = f"{namespace}/{_safe_branch_component(mission_id)}-{suffix}"
        path = (self.root / f"{_safe_branch_component(mission_id)}-{suffix}").resolve()
        if self.root not in path.parents:
            raise WorktreeError("worktree path escaped the approved runtime root")
        base_commit = self.resolve_commit(base_reference) if base_reference else self.protected_base()
        operation_id = f"worktree:create:{mission_id}:{base_commit}"
        should_run, prior = self.store.begin_operation(
            operation_id,
            "worktree_create",
            sha256_text(f"{path}|{branch}|{base_commit}"),
            mission_id,
        )
        if not should_run:
            if prior and Path(prior["path"]).is_dir():
                return WorktreeReceipt(
                    mission_id,
                    Path(prior["path"]),
                    prior["branch_name"],
                    prior["base_reference"],
                    operation_id,
                    mission_table,
                )
            raise WorktreeError("prior worktree operation exists without a valid worktree")
        try:
            if path.exists():
                raise WorktreeError(f"unmanaged worktree path already exists: {path}")
            self._git(["worktree", "add", "-b", branch, str(path), base_commit], timeout=300)
            receipt = {
                "path": str(path),
                "branch_name": branch,
                "base_reference": base_commit,
            }
            self.store.finish_operation(operation_id, "completed", receipt)
            operation_column = ",operation_id=?" if mission_table == "missions" else ""
            values: tuple[Any, ...]
            if mission_table == "missions":
                values = (
                    str(path),
                    branch,
                    base_commit,
                    operation_id,
                    utc_now(),
                    mission_id,
                )
            else:
                values = (str(path), branch, base_commit, utc_now(), mission_id)
            self.store.execute(
                f"""
                UPDATE {mission_table} SET worktree=?,branch_name=?,input_state_hash=?
                  {operation_column},updated_at=? WHERE mission_id=?
                """,
                values,
            )
            self.store.event("worktree_created", receipt, mission_id)
            return WorktreeReceipt(
                mission_id,
                path,
                branch,
                base_commit,
                operation_id,
                mission_table,
            )
        except Exception as exc:
            self.store.finish_operation(operation_id, "failed", {"error": type(exc).__name__})
            raise

    def changes(self, receipt: WorktreeReceipt) -> dict[str, Any]:
        changed = [
            line.strip()
            for line in self._git(["diff", "--name-only", f"{receipt.base_reference}...HEAD"], cwd=receipt.path).splitlines()
            if line.strip()
        ]
        diff = self._git(["diff", "--binary", f"{receipt.base_reference}...HEAD"], cwd=receipt.path)
        if not diff:
            diff = self._git(["diff", "--binary"], cwd=receipt.path)
            unstaged = self._git(["diff", "--name-only"], cwd=receipt.path).splitlines()
            changed = sorted(set(changed) | {line.strip() for line in unstaged if line.strip()})
        status_lines = self._git(
            ["status", "--porcelain=v1"], cwd=receipt.path
        ).splitlines()
        untracked: list[str] = []
        for line in status_lines:
            if len(line) < 4:
                continue
            path_value = line[3:].strip()
            if " -> " in path_value:
                path_value = path_value.split(" -> ", 1)[1]
            changed.append(path_value)
            if line[:2] == "??":
                untracked.append(path_value)
        untracked_receipts: list[str] = []
        for relative in sorted(set(untracked)):
            path = (receipt.path / relative).resolve()
            if path.is_file() and (
                path == receipt.path or receipt.path in path.parents
            ):
                untracked_receipts.append(f"{relative}:{sha256_file(path)}")
        diff_material = diff + "\n".join(untracked_receipts)
        value = {
            "changed_files": sorted(set(changed)),
            "diff_hash": hashlib.sha256(
                diff_material.encode("utf-8", errors="replace")
            ).hexdigest(),
            "head": self.head(receipt.path),
        }
        if receipt.mission_table == "missions":
            self.store.execute(
                """
                UPDATE missions SET changed_files_json=?,diff_hash=?,updated_at=?
                WHERE mission_id=?
                """,
                (
                    canonical_json(value["changed_files"]),
                    value["diff_hash"],
                    utc_now(),
                    receipt.mission_id,
                ),
            )
        else:
            self.store.execute(
                """
                UPDATE codex_missions SET changed_files_json=?,updated_at=?
                WHERE mission_id=?
                """,
                (
                    canonical_json(value["changed_files"]),
                    utc_now(),
                    receipt.mission_id,
                ),
            )
        return value

    def commit_changes(self, receipt: WorktreeReceipt, message: str) -> str | None:
        status = self._git(["status", "--porcelain=v1"], cwd=receipt.path)
        if not status:
            return None
        operation_id = f"worktree:commit:{receipt.mission_id}:{sha256_text(status)}"
        should_run, prior = self.store.begin_operation(
            operation_id,
            "worktree_commit",
            sha256_text(f"{receipt.branch_name}|{status}|{message}"),
            receipt.mission_id,
        )
        if not should_run:
            return str(prior["commit"]) if prior and prior.get("commit") else None
        self._git(["add", "--all"], cwd=receipt.path)
        self._git(["commit", "-m", message], cwd=receipt.path, timeout=300)
        commit = self.head(receipt.path)
        self.store.finish_operation(operation_id, "completed", {"commit": commit})
        self.store.event("worktree_changes_committed", {"commit": commit}, receipt.mission_id)
        return commit

    @staticmethod
    def overlapping_files(first: list[str], second: list[str]) -> list[str]:
        return sorted(set(first) & set(second))

    def remove(self, receipt: WorktreeReceipt) -> None:
        path = receipt.path.resolve()
        if self.root not in path.parents:
            raise WorktreeError("refusing to remove a path outside the approved worktree root")
        if not path.exists():
            return
        if self._git(["status", "--porcelain=v1"], cwd=path):
            raise WorktreeError("refusing to remove a worktree with uncommitted evidence")
        self._git(["worktree", "remove", str(path)])
        self.store.event("worktree_removed", {"path": str(path)}, receipt.mission_id)
