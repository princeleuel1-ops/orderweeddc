"""Restart-safe Windows watchdog that delegates credential loading to Resume-CanaLoop.ps1."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
from pathlib import Path

from runtime_utils import parse_time, process_is_alive, process_matches, utc_now
from state_store import StateStore


class Watchdog:
    def __init__(self, workspace: Path, runtime_dir: Path):
        self.workspace = workspace.resolve()
        self.runtime_dir = runtime_dir.resolve()
        self.store = StateStore(self.runtime_dir / "state.sqlite3")
        self.log_path = self.runtime_dir / "logs" / "watchdog.log"
        self.log_path.parent.mkdir(parents=True, exist_ok=True)

    def close(self) -> None:
        self.store.close()

    def _log(self, event: str, details: dict[str, object]) -> None:
        record = json.dumps({"timestamp": utc_now(), "event": event, **details}, sort_keys=True)
        with self.log_path.open("a", encoding="utf-8") as handle:
            handle.write(record + "\n")
        self.store.event(f"watchdog_{event}", details)

    def _expired_codex_child(self) -> int | None:
        """Return only an identity-verified Codex child whose durable lease expired."""
        child_processes = self.store.get_runtime("active_child_processes", [])
        now = parse_time(utc_now())
        for item in child_processes:
            if not isinstance(item, dict) or item.get("kind") != "codex":
                continue
            pid = int(item.get("pid", 0))
            if not process_matches(pid, ("codex", "exec")):
                continue
            mission = self.store.row(
                """
                SELECT lease_expires_at FROM codex_missions
                WHERE process_id=? AND state IN (
                  'CODEX_STARTING','CODEX_WORKING','CODEX_TESTING','CODEX_REPAIRING'
                )
                ORDER BY updated_at DESC LIMIT 1
                """,
                (pid,),
            )
            expires_at = parse_time(
                str(mission["lease_expires_at"])
                if mission and mission.get("lease_expires_at")
                else None
            )
            if expires_at and now and now >= expires_at:
                return pid
        return None

    @staticmethod
    def _terminate_expired_codex(pid: int) -> bool:
        """Terminate one verified orphan tree; never target a reused unrelated PID."""
        if not process_matches(pid, ("codex", "exec")):
            return True
        try:
            if os.name == "nt":
                subprocess.run(
                    ["taskkill.exe", "/PID", str(pid), "/T", "/F"],
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=30,
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                )
            else:
                os.kill(pid, 15)
        except (OSError, subprocess.TimeoutExpired):
            return False
        return not process_matches(pid, ("codex", "exec"))

    def should_restart(self) -> tuple[bool, str]:
        if (self.runtime_dir / "control" / "MANUAL_STOP").exists():
            return False, "manual_stop"
        if self.store.get_runtime("completed", False):
            return False, "runtime_completed"
        ending = self.store.get_runtime("ending_condition", {})
        ends_at = parse_time(ending.get("ends_at")) if isinstance(ending, dict) else None
        now = parse_time(utc_now())
        if ends_at and now and now >= ends_at:
            return False, "ending_condition_reached"
        pid = self.store.get_runtime("supervisor_pid")
        if process_matches(pid, ("supervisor.py", "--workspace")) and not self.store.stale_heartbeat(90):
            return False, "healthy"
        if self._expired_codex_child():
            return True, "codex_child_lease_expired"
        child_processes = self.store.get_runtime("active_child_processes", [])
        long_running_children = [
            item
            for item in child_processes
            if isinstance(item, dict) and item.get("kind") not in {"opencode", "opencode_server"}
        ]
        if any(process_is_alive(int(item.get("pid", 0))) for item in long_running_children):
            if any(
                item.get("kind") == "codex"
                and process_matches(int(item.get("pid", 0)), ("codex", "exec"))
                for item in long_running_children
            ):
                return False, "codex_child_active"
            if any(
                item.get("kind") != "codex"
                and process_is_alive(int(item.get("pid", 0)))
                for item in long_running_children
            ):
                return False, "long_running_child"
        return True, "supervisor_missing_or_stale"

    def run(self, *, simulate: bool = False) -> dict[str, object]:
        restart, reason = self.should_restart()
        result: dict[str, object] = {"restart": restart, "reason": reason, "simulated": simulate}
        if not restart or simulate:
            self._log("inspection", result)
            return result
        if reason == "codex_child_lease_expired":
            expired_pid = self._expired_codex_child()
            terminated = bool(expired_pid) and self._terminate_expired_codex(
                int(expired_pid)
            )
            result["orphan_codex_terminated"] = terminated
            if not terminated:
                result["restart"] = False
                result["reason"] = "codex_child_termination_failed"
                self._log("launch_failed", result)
                return result
        script = Path(__file__).resolve().parent / "Resume-CanaLoop.ps1"
        command = [
            "powershell.exe",
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(script),
        ]
        stdout_path = self.runtime_dir / "logs" / "watchdog.restart.stdout.log"
        stderr_path = self.runtime_dir / "logs" / "watchdog.restart.stderr.log"
        try:
            with stdout_path.open("ab") as stdout_handle, stderr_path.open("ab") as stderr_handle:
                completed = subprocess.run(
                    command,
                    cwd=self.workspace,
                    stdin=subprocess.DEVNULL,
                    stdout=stdout_handle,
                    stderr=stderr_handle,
                    timeout=180,
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0) if os.name == "nt" else 0,
                )
            result["launcher_exit_code"] = completed.returncode
            if completed.returncode == 0:
                self._log("restart_completed", result)
            else:
                self._log("launch_failed", result)
        except (OSError, subprocess.TimeoutExpired) as exc:
            result["error"] = type(exc).__name__
            self._log("launch_failed", result)
        return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--runtime-dir", type=Path)
    parser.add_argument("--simulate", action="store_true")
    args = parser.parse_args()
    runtime_dir = (args.runtime_dir or (args.workspace / ".cana-loop")).resolve()
    watchdog = Watchdog(args.workspace, runtime_dir)
    try:
        print(json.dumps(watchdog.run(simulate=args.simulate), indent=2))
        return 0
    finally:
        watchdog.close()


if __name__ == "__main__":
    raise SystemExit(main())
