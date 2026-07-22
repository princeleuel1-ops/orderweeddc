"""Headless OpenCode adapter using a persistent authenticated localhost server."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import time
import uuid
import urllib.request
import urllib.parse
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from openrouter_health import OpenRouterHealth
from runtime_utils import atomic_write_text, run_process, sha256_text, utc_now
from security import sanitize, secret_values
from state_store import StateStore


@dataclass
class LaneExecution:
    lane_run_id: str
    lane_id: int
    lane_name: str
    model: str
    ok: bool
    output: str
    artifact_path: Path
    session_id: str | None = None
    exit_code: int | None = None
    error_class: str | None = None
    retry_after: str | None = None


class LaneCrashed(RuntimeError):
    pass


class OpenCodeAdapter:
    def __init__(
        self,
        *,
        workspace: Path,
        runtime_dir: Path,
        store: StateStore,
        health: OpenRouterHealth,
        config: dict[str, Any],
        secret_references: list[str],
        server_url: str,
        mock: bool = False,
        mock_profile: dict[str, Any] | None = None,
    ):
        self.workspace = workspace.resolve()
        self.runtime_dir = runtime_dir.resolve()
        self.store = store
        self.health = health
        self.config = config
        self.secret_references = secret_references
        self.server_url = server_url
        self.mock = mock
        self.mock_profile = mock_profile or {}
        self.artifacts = self.runtime_dir / "artifacts"
        self.artifacts.mkdir(parents=True, exist_ok=True)

    def _executable_prefix(self) -> list[str]:
        executable = shutil.which(self.config.get("executable", "opencode"))
        if not executable:
            raise FileNotFoundError("OpenCode executable is unavailable")
        path = Path(executable)
        if os.name == "nt":
            if path.suffix.lower() == ".cmd" and path.with_suffix(".ps1").is_file():
                path = path.with_suffix(".ps1")
            if path.suffix.lower() == ".ps1":
                return [
                    "powershell.exe",
                    "-NoLogo",
                    "-NoProfile",
                    "-NonInteractive",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-File",
                    str(path),
                ]
        return [str(path)]

    def server_health(self, timeout: float = 2.0) -> bool:
        request = urllib.request.Request(f"{self.server_url.rstrip('/')}/global/health")
        username = os.environ.get("OPENCODE_SERVER_USERNAME", "opencode")
        password = os.environ.get("OPENCODE_SERVER_PASSWORD", "")
        if password:
            import base64

            token = base64.b64encode(f"{username}:{password}".encode()).decode()
            request.add_header("Authorization", f"Basic {token}")
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.status < 500
        except Exception:
            return False

    def restart_server(self, timeout: int = 30) -> int:
        """Restart the authenticated localhost server with the current process environment."""
        parsed = urllib.parse.urlparse(self.server_url)
        if parsed.hostname not in {"127.0.0.1", "localhost"}:
            raise RuntimeError("OpenCode recovery is restricted to localhost")
        port = int(parsed.port or 4096)
        prior_pid = self.store.get_runtime("opencode_pid")
        if prior_pid and os.name == "nt":
            subprocess.run(
                ["taskkill.exe", "/PID", str(int(prior_pid)), "/T", "/F"],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
        environment = os.environ.copy()
        environment["OPENCODE_CONFIG"] = str(Path(__file__).parent / "config" / "opencode.json")
        environment["OPENCODE_CONFIG_DIR"] = str(self.workspace / ".opencode")
        environment["OPENCODE_DISABLE_AUTOUPDATE"] = "true"
        environment["OPENCODE_AUTO_SHARE"] = "false"
        command = [
            *self._executable_prefix(),
            "serve",
            "--hostname",
            "127.0.0.1",
            "--port",
            str(port),
            "--pure",
            "--log-level",
            "WARN",
        ]
        log_dir = self.runtime_dir / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        output_handle = (log_dir / "opencode.recovery.stdout.log").open("ab")
        error_handle = (log_dir / "opencode.recovery.stderr.log").open("ab")
        creation_flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        if os.name == "nt":
            creation_flags |= getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        try:
            launcher = subprocess.Popen(
                command,
                cwd=self.workspace,
                env=environment,
                stdin=subprocess.DEVNULL,
                stdout=output_handle,
                stderr=error_handle,
                close_fds=True,
                creationflags=creation_flags,
            )
        finally:
            output_handle.close()
            error_handle.close()
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if self.server_health():
                break
            if launcher.poll() is not None:
                raise RuntimeError("OpenCode recovery launcher exited before health was restored")
            time.sleep(0.25)
        else:
            raise TimeoutError("OpenCode server recovery timed out")
        server_pid = launcher.pid
        if os.name == "nt":
            completed = run_process(
                [
                    "powershell.exe",
                    "-NoLogo",
                    "-NoProfile",
                    "-NonInteractive",
                    "-Command",
                    (
                        f"(Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort {port} "
                        "-State Listen | Select-Object -First 1 -ExpandProperty OwningProcess)"
                    ),
                ],
                cwd=self.workspace,
                timeout=15,
            )
            if completed.returncode == 0 and completed.stdout.strip().isdigit():
                server_pid = int(completed.stdout.strip())
        self.store.set_runtime("opencode_pid", server_pid)
        self.store.set_runtime("active_child_processes", [{"kind": "opencode", "pid": server_pid}])
        atomic_write_text(self.runtime_dir / "opencode.pid", f"{server_pid}\n")
        self.store.event("opencode_server_recovered", {"pid": server_pid, "server_url": self.server_url})
        return server_pid

    @staticmethod
    def _session_id(output: str) -> str | None:
        for line in output.splitlines():
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not isinstance(event, dict):
                continue
            for key in ("sessionID", "sessionId", "session_id"):
                if event.get(key):
                    return str(event[key])
            properties = event.get("properties")
            if isinstance(properties, dict):
                for key in ("sessionID", "sessionId", "session_id"):
                    if properties.get(key):
                        return str(properties[key])
        return None

    def _mock_output(self, lane: dict[str, Any], mission: dict[str, Any], model: str) -> str:
        lane_id = int(lane["id"])
        if int(self.mock_profile.get("crash_lane", 0)) == lane_id:
            raise LaneCrashed(f"simulated lane {lane_id} process termination")
        fail_models = set(self.mock_profile.get("fail_models", []))
        if model in fail_models:
            raise RuntimeError(f"simulated primary model failure for {model}")
        overrides = self.mock_profile.get("lane_outputs", {})
        if str(lane_id) in overrides:
            return str(overrides[str(lane_id)])
        outputs = {
            1: {
                "contract": mission["objective"],
                "acceptance": json.loads(mission["acceptance_criteria_json"]),
                "CANA_STRATEGY": "BOUNDED",
            },
            2: {"findings": [], "CANA_CRITIC": "PASS"},
            3: {"changed_files": [], "targeted_check": "PASS", "CANA_AUTHOR_CHECK": "PASS"},
            4: {"adversarial_findings": [], "CANA_CRITIC": "PASS", "CANA_VERIFICATION": "PASS"},
            5: {"decision": "ACCEPT", "CANA_RELEASE": "ACCEPT"},
        }
        return json.dumps(outputs[lane_id], sort_keys=True)

    def _invoke(
        self,
        *,
        lane: dict[str, Any],
        model: str,
        prompt_path: Path,
        working_directory: Path,
        session_id: str | None,
    ) -> tuple[int, str, str | None]:
        command = [
            *self._executable_prefix(),
            "run",
            "--attach",
            self.server_url,
            "--model",
            model,
            "--agent",
            lane["agent"],
            "--format",
            "json",
            "--title",
            f"CANA {prompt_path.parent.name} L{lane['id']}",
            "--dir",
            str(working_directory),
            "--file",
            str(prompt_path),
        ]
        if session_id:
            command.extend(["--session", session_id])
        if lane.get("variant"):
            command.extend(["--variant", str(lane["variant"])])
        command.extend(
            [
                "--auto",
                "Read the attached bounded CANA mission envelope and return the required machine-readable lane receipt.",
            ]
        )
        environment = os.environ.copy()
        environment["OPENCODE_CONFIG"] = str(Path(__file__).parent / "config" / "opencode.json")
        environment["OPENCODE_CONFIG_DIR"] = str(self.workspace / ".opencode")
        environment["OPENCODE_DISABLE_AUTOUPDATE"] = "true"
        environment["OPENCODE_AUTO_SHARE"] = "false"
        completed = run_process(
            command,
            cwd=working_directory,
            timeout=int(self.config.get("lane_timeout_seconds", 1800)),
            environment=environment,
        )
        combined = completed.stdout
        if completed.stderr:
            combined += "\n[stderr]\n" + completed.stderr
        clean = sanitize(combined, secret_values(self.secret_references))
        return completed.returncode, clean, self._session_id(clean)

    def run_lane(
        self,
        *,
        cycle_id: str,
        mission: dict[str, Any],
        lane: dict[str, Any],
        prompt: str,
        working_directory: Path,
        session_id: str | None = None,
    ) -> LaneExecution:
        lane_id = int(lane["id"])
        lane_run_id = f"LR-{uuid.uuid4().hex}"
        lane_dir = self.artifacts / mission["mission_id"] / cycle_id
        lane_dir.mkdir(parents=True, exist_ok=True)
        prompt_path = lane_dir / f"lane-{lane_id}-prompt.md"
        output_path = lane_dir / f"lane-{lane_id}-output.jsonl"
        prompt_hash = sha256_text(prompt)
        atomic_write_text(prompt_path, sanitize(prompt, secret_values(self.secret_references)))
        models = [lane["primary_model"], *lane.get("fallback_models", [])]
        attempt = 0
        last_error = "model_unavailable"
        last_model = lane["primary_model"]
        started_at = utc_now()
        self.store.execute(
            """
            INSERT INTO lane_runs(
              lane_run_id,mission_id,cycle_id,lane_id,lane_name,model,secret_reference,
              state,attempt,started_at,prompt_hash
            ) VALUES(?,?,?,?,?,?,?,'running',0,?,?)
            """,
            (
                lane_run_id,
                mission["mission_id"],
                cycle_id,
                lane_id,
                lane["name"],
                last_model,
                lane["secret_reference"],
                started_at,
                prompt_hash,
            ),
        )
        for model in models:
            attempt += 1
            last_model = model
            if self.health.cooling_down("model", model):
                last_error = "model_cooldown"
                continue
            if not self.health.under_daily_cap(lane["secret_reference"]):
                last_error = "daily_cap"
                break
            try:
                if self.mock:
                    output = self._mock_output(lane, mission, model)
                    exit_code = 0
                    assigned_session = session_id or f"mock-session-lane-{lane_id}"
                else:
                    self.health.record_request(lane["secret_reference"], model)
                    exit_code, output, assigned_session = self._invoke(
                        lane=lane,
                        model=model,
                        prompt_path=prompt_path,
                        working_directory=working_directory,
                        session_id=session_id,
                    )
                if exit_code == 0 and output.strip():
                    clean = sanitize(output, secret_values(self.secret_references))
                    atomic_write_text(output_path, clean)
                    self.store.execute(
                        """
                        UPDATE lane_runs SET state='completed',attempt=?,model=?,finished_at=?,
                          exit_code=0,output_hash=?,artifact_path=?,session_id=?
                        WHERE lane_run_id=?
                        """,
                        (
                            attempt,
                            model,
                            utc_now(),
                            hashlib.sha256(clean.encode()).hexdigest(),
                            str(output_path),
                            assigned_session,
                            lane_run_id,
                        ),
                    )
                    return LaneExecution(
                        lane_run_id,
                        lane_id,
                        lane["name"],
                        model,
                        True,
                        clean,
                        output_path,
                        assigned_session,
                        0,
                    )
                last_error = self.health.classify(None, output)
            except LaneCrashed:
                self.store.execute(
                    """
                    UPDATE lane_runs SET state='crashed',attempt=?,model=?,finished_at=?,
                      error_class='worker_exit' WHERE lane_run_id=?
                    """,
                    (attempt, model, utc_now(), lane_run_id),
                )
                raise
            except (OSError, subprocess.SubprocessError, RuntimeError) as exc:
                last_error = self.health.classify(None, str(exc))
                output = sanitize(f"{type(exc).__name__}: {exc}")
            decision = self.health.register_failure(
                lane_id=lane_id,
                secret_reference=lane["secret_reference"],
                model=model,
                error_class=last_error,
                attempt=attempt,
            )
            if not decision.retryable and model == models[-1]:
                break
        failure = f"lane execution failed after {attempt} model attempt(s): {last_error}"
        atomic_write_text(output_path, failure)
        self.store.execute(
            """
            UPDATE lane_runs SET state='failed',attempt=?,model=?,finished_at=?,
              error_class=?,artifact_path=?,output_hash=?
            WHERE lane_run_id=?
            """,
            (
                attempt,
                last_model,
                utc_now(),
                last_error,
                str(output_path),
                sha256_text(failure),
                lane_run_id,
            ),
        )
        return LaneExecution(
            lane_run_id,
            lane_id,
            lane["name"],
            last_model,
            False,
            failure,
            output_path,
            session_id,
            None,
            last_error,
        )
