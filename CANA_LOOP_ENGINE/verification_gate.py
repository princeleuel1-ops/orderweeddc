"""Deterministic targeted, regression, and post-integration verification."""

from __future__ import annotations

import hashlib
import json
import os
import time
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from runtime_utils import atomic_write_json, run_process, utc_now
from security import sanitize
from state_store import StateStore


@dataclass
class CommandEvidence:
    command_id: str
    argv: list[str]
    cwd: str
    started_at: str
    finished_at: str
    duration_seconds: float
    exit_code: int | None
    timed_out: bool
    output_hash: str
    artifact_path: str


@dataclass
class VerificationResult:
    passed: bool
    stage: str
    commands: list[CommandEvidence]
    failure: str | None = None


class VerificationGate:
    def __init__(self, store: StateStore, runtime_dir: Path, approved_roots: list[Path]):
        self.store = store
        self.runtime_dir = runtime_dir.resolve()
        self.approved_roots = [path.resolve() for path in approved_roots]

    def _approved(self, path: Path) -> bool:
        resolved = path.resolve()
        return any(resolved == root or root in resolved.parents for root in self.approved_roots)

    def run(
        self,
        *,
        mission_id: str,
        stage: str,
        commands: list[list[str]],
        working_directory: Path,
        timeout_seconds: int = 900,
    ) -> VerificationResult:
        if not self._approved(working_directory):
            raise ValueError("verification working directory is outside approved roots")
        if not commands:
            return VerificationResult(False, stage, [], "no deterministic verification command configured")
        evidence: list[CommandEvidence] = []
        artifact_dir = self.runtime_dir / "artifacts" / mission_id / "verification" / stage
        artifact_dir.mkdir(parents=True, exist_ok=True)
        for index, argv in enumerate(commands, start=1):
            command_id = f"VC-{uuid.uuid4().hex}"
            started_at = utc_now()
            started = time.monotonic()
            timed_out = False
            exit_code: int | None
            try:
                completed = run_process(argv, cwd=working_directory, timeout=timeout_seconds)
                exit_code = completed.returncode
                output = completed.stdout
                if completed.stderr:
                    output += "\n[stderr]\n" + completed.stderr
            except TimeoutError:
                timed_out = True
                exit_code = None
                output = "verification command timed out"
            except Exception as exc:
                timed_out = type(exc).__name__ == "TimeoutExpired"
                exit_code = None
                output = f"{type(exc).__name__}: {exc}"
            output = sanitize(output)
            artifact = artifact_dir / f"{index:02d}-{command_id}.txt"
            artifact.write_text(output, encoding="utf-8")
            item = CommandEvidence(
                command_id=command_id,
                argv=argv,
                cwd=str(working_directory.resolve()),
                started_at=started_at,
                finished_at=utc_now(),
                duration_seconds=round(time.monotonic() - started, 3),
                exit_code=exit_code,
                timed_out=timed_out,
                output_hash=hashlib.sha256(output.encode()).hexdigest(),
                artifact_path=str(artifact),
            )
            evidence.append(item)
            if exit_code != 0:
                result = VerificationResult(False, stage, evidence, f"command {index} exited {exit_code}")
                atomic_write_json(artifact_dir / "receipt.json", self._json(result))
                self.store.event("verification_failed", self._json(result), mission_id)
                return result
        result = VerificationResult(True, stage, evidence)
        atomic_write_json(artifact_dir / "receipt.json", self._json(result))
        self.store.event("verification_passed", self._json(result), mission_id)
        return result

    @staticmethod
    def _json(result: VerificationResult) -> dict[str, Any]:
        return {
            "passed": result.passed,
            "stage": result.stage,
            "failure": result.failure,
            "commands": [asdict(command) for command in result.commands],
        }
