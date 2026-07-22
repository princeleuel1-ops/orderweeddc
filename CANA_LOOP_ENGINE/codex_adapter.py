"""The sole authorized installed-Codex CLI invocation boundary.

Prompts are written to stdin, never process arguments. The adapter applies a
bounded sandbox, noninteractive approval policy, output ceiling, timeout, and
Windows child-tree termination without reading Codex credential storage.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import time
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Callable

from runtime_utils import atomic_write_text, sha256_text, utc_now
from security import sanitize


@dataclass(frozen=True)
class CodexCapabilities:
    installed: bool
    version: str | None
    authenticated: bool
    noninteractive_exec: bool
    session_resume: bool
    workspace_scoping: bool
    sandbox_modes: list[str]
    approval_never: bool
    jsonl_output: bool
    output_schema: bool
    model_control: bool
    reasoning_control: bool
    native_timeout: bool
    adapter_timeout: bool
    configuration_override: str
    checked_at: str
    blocker: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class CodexExecution:
    run_id: str
    ok: bool
    exit_code: int | None
    process_id: int | None
    session_id: str | None
    started_at: str
    finished_at: str
    prompt_hash: str
    output_hash: str
    artifact_path: str
    error_class: str | None
    timed_out: bool
    stopped: bool
    resumed: bool
    command_structure: list[str]
    output_excerpt: str


class CodexAdapter:
    """Launch one bounded Codex child and capture sanitized durable evidence."""

    def __init__(
        self,
        *,
        workspace: Path,
        runtime_dir: Path,
        config: dict[str, Any],
        mock: bool = False,
        mock_profile: dict[str, Any] | None = None,
    ):
        self.workspace = workspace.resolve()
        self.runtime_dir = runtime_dir.resolve()
        self.config = config
        self.mock = mock
        self.mock_profile = mock_profile or {}
        self.artifacts = self.runtime_dir / "artifacts" / "codex"
        self.artifacts.mkdir(parents=True, exist_ok=True)

    def _executable_prefix(self) -> list[str]:
        executable = shutil.which(str(self.config.get("executable", "codex")))
        if not executable:
            raise FileNotFoundError("installed Codex CLI is unavailable")
        path = Path(executable)
        if os.name == "nt":
            npm_root = path.parent
            codex_entry = (
                npm_root / "node_modules" / "@openai" / "codex" / "bin" / "codex.js"
            )
            bundled_node = npm_root / "node.exe"
            node = bundled_node if bundled_node.is_file() else Path(
                shutil.which("node") or ""
            )
            if codex_entry.is_file() and node.is_file():
                # Launch the actual installed CLI worker directly so the PID in
                # durable state is the real bounded process, not a shell wrapper.
                return [str(node.resolve()), str(codex_entry.resolve())]
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

    def _reasoning_override(self) -> str:
        effort = str(self.config.get("reasoning_effort", "high")).lower()
        if effort not in {"minimal", "low", "medium", "high"}:
            effort = "high"
        return f'model_reasoning_effort="{effort}"'

    def _control_command(self, arguments: list[str]) -> list[str]:
        return [*self._executable_prefix(), "-c", self._reasoning_override(), *arguments]

    def _run_control(self, arguments: list[str], timeout: int = 30) -> tuple[int, str]:
        """Run capability/auth discovery without inspecting credential storage."""
        completed = subprocess.run(
            self._control_command(arguments),
            cwd=self.workspace,
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            shell=False,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0) if os.name == "nt" else 0,
        )
        output = completed.stdout
        if completed.stderr:
            output += "\n" + completed.stderr
        return completed.returncode, sanitize(output)

    def discover(self) -> CodexCapabilities:
        if self.mock:
            blocker = self.mock_profile.get("preflight_blocker")
            return CodexCapabilities(
                installed=blocker != "unavailable",
                version="codex-cli mock",
                authenticated=blocker not in {"auth_required", "unavailable"},
                noninteractive_exec=True,
                session_resume=True,
                workspace_scoping=True,
                sandbox_modes=["read-only", "workspace-write"],
                approval_never=True,
                jsonl_output=True,
                output_schema=True,
                model_control=True,
                reasoning_control=True,
                native_timeout=False,
                adapter_timeout=True,
                configuration_override=self._reasoning_override(),
                checked_at=utc_now(),
                blocker=str(blocker) if blocker else None,
            )
        try:
            version_code, version_output = self._run_control(["--version"])
            main_help_code, main_help = self._run_control(["--help"])
            exec_code, exec_help = self._run_control(["exec", "--help"])
            resume_code, resume_help = self._run_control(["exec", "resume", "--help"])
            login_code, login_output = self._run_control(["login", "status"])
        except (OSError, subprocess.TimeoutExpired, FileNotFoundError) as exc:
            return CodexCapabilities(
                installed=False,
                version=None,
                authenticated=False,
                noninteractive_exec=False,
                session_resume=False,
                workspace_scoping=False,
                sandbox_modes=[],
                approval_never=False,
                jsonl_output=False,
                output_schema=False,
                model_control=False,
                reasoning_control=True,
                native_timeout=False,
                adapter_timeout=True,
                configuration_override=self._reasoning_override(),
                checked_at=utc_now(),
                blocker=type(exc).__name__,
            )
        version = next(
            (line.strip() for line in version_output.splitlines() if "codex" in line.lower()),
            None,
        )
        main_text = main_help.lower()
        exec_text = exec_help.lower()
        resume_text = resume_help.lower()
        login_text = login_output.lower()
        authenticated = login_code == 0 and "logged in" in login_text
        blocker = None
        if version_code != 0 or main_help_code != 0 or exec_code != 0:
            blocker = "cli_unavailable"
        elif not authenticated:
            blocker = "auth_required"
        return CodexCapabilities(
            installed=version_code == 0,
            version=version,
            authenticated=authenticated,
            noninteractive_exec=exec_code == 0 and "run codex non-interactively" in exec_text,
            session_resume=resume_code == 0 and "session_id" in resume_text,
            workspace_scoping="--cd <dir>" in exec_text,
            sandbox_modes=[
                mode for mode in ("read-only", "workspace-write")
                if mode in exec_text
            ],
            approval_never=(
                "approval_policy" in main_text and "- never:" in main_text
            ),
            jsonl_output="--json" in exec_text,
            output_schema="--output-schema" in exec_text,
            model_control="--model" in exec_text,
            reasoning_control=True,
            native_timeout="--timeout" in exec_text,
            adapter_timeout=True,
            configuration_override=self._reasoning_override(),
            checked_at=utc_now(),
            blocker=blocker,
        )

    def build_command(
        self,
        *,
        working_directory: Path,
        modifying: bool,
        session_id: str | None = None,
    ) -> list[str]:
        sandbox = (
            str(self.config.get("modifying_sandbox", "workspace-write"))
            if modifying
            else str(self.config.get("readonly_sandbox", "read-only"))
        )
        if sandbox not in {"read-only", "workspace-write"}:
            raise ValueError("Codex sandbox must remain read-only or workspace-write")
        if str(self.config.get("approval_policy", "never")) != "never":
            raise ValueError("durable Codex jobs require fail-closed noninteractive approvals")
        base = [
            *self._executable_prefix(),
            "-c",
            self._reasoning_override(),
            "-a",
            "never",
        ]
        model = self.config.get("model")
        if model:
            base.extend(["-m", str(model)])
        if session_id:
            return [
                *base,
                "-s",
                sandbox,
                "-C",
                str(working_directory.resolve()),
                "exec",
                "resume",
                session_id,
                "-",
            ]
        return [
            *base,
            "exec",
            "-s",
            sandbox,
            "-C",
            str(working_directory.resolve()),
            "--json",
            "--color",
            "never",
            "-",
        ]

    @staticmethod
    def command_structure(command: list[str], working_directory: Path) -> list[str]:
        result: list[str] = []
        resolved = str(working_directory.resolve())
        for value in command:
            if value == resolved:
                result.append("<ISOLATED_WORKTREE>")
            elif re.fullmatch(r"[0-9a-fA-F-]{36}", value):
                result.append("<SESSION_ID>")
            else:
                result.append(value)
        return result

    @staticmethod
    def session_id(output: str) -> str | None:
        for line in output.splitlines():
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not isinstance(event, dict):
                continue
            for key in ("thread_id", "session_id", "sessionId", "conversation_id"):
                if event.get(key):
                    return str(event[key])
            payload = event.get("thread") or event.get("properties")
            if isinstance(payload, dict):
                for key in ("id", "thread_id", "session_id", "sessionId"):
                    value = payload.get(key)
                    if value and re.fullmatch(r"[0-9a-fA-F-]{20,}", str(value)):
                        return str(value)
        return None

    @staticmethod
    def classify(exit_code: int | None, output: str, *, timed_out: bool, stopped: bool) -> str | None:
        text = output.lower()
        if stopped:
            return "manual_stop"
        if timed_out:
            return "timeout"
        if exit_code in {0, None}:
            return None
        if any(marker in text for marker in ("usage limit", "rate limit", "quota", "too many requests")):
            return "usage_limit"
        if any(marker in text for marker in ("not logged in", "login required", "authentication required", "unauthorized")):
            return "auth_required"
        if any(
            marker in text
            for marker in (
                "unknown variant",
                "error loading configuration",
                "requires a newer version of codex",
                "unsupported model",
                "model is not supported",
            )
        ):
            return "configuration"
        return "worker_exit"

    @staticmethod
    def _terminate_process_tree(process: subprocess.Popen[Any]) -> None:
        if process.poll() is not None:
            return
        if os.name == "nt":
            subprocess.run(
                ["taskkill.exe", "/PID", str(process.pid), "/T", "/F"],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
        else:
            process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()

    def run(
        self,
        *,
        mission_id: str,
        prompt: str,
        working_directory: Path,
        modifying: bool,
        session_id: str | None = None,
        on_start: Callable[[str, int, list[str]], None] | None = None,
        should_stop: Callable[[], bool] | None = None,
    ) -> CodexExecution:
        run_id = f"CR-{uuid.uuid4().hex}"
        started_at = utc_now()
        prompt_hash = sha256_text(prompt)
        run_dir = self.artifacts / mission_id / run_id
        run_dir.mkdir(parents=True, exist_ok=True)
        prompt_path = run_dir / "prompt.md"
        output_path = run_dir / "output.jsonl"
        error_path = run_dir / "stderr.log"
        atomic_write_text(prompt_path, sanitize(prompt))
        if self.mock:
            pid = int(self.mock_profile.get("pid", 424242))
            structure = ["<MOCK_CODEX>", "exec", "<STDIN>"]
            if on_start:
                on_start(run_id, pid, structure)
            fixture = self.mock_profile.get("write_fixture")
            if isinstance(fixture, dict):
                relative = Path(str(fixture.get("path", "codex-fixture.txt")))
                target = (working_directory / relative).resolve()
                root = working_directory.resolve()
                if target != root and root not in target.parents:
                    raise ValueError("mock fixture escaped the assigned worktree")
                atomic_write_text(
                    target,
                    str(fixture.get("content", "bounded Codex fixture\n")),
                )
            profile_error = self.mock_profile.get("error_class")
            output = str(
                self.mock_profile.get(
                    "output",
                    '{"type":"thread.started","thread_id":"00000000-0000-4000-8000-000000000001"}\n'
                    '{"type":"item.completed","item":{"type":"agent_message","text":"bounded mock completed"}}',
                )
            )
            if profile_error == "crash":
                exit_code, output = 9, "simulated Codex process crash"
            elif profile_error == "usage_limit":
                exit_code, output = 1, "Codex usage limit reached"
            elif profile_error == "auth_required":
                exit_code, output = 1, "Codex login required"
            else:
                exit_code = 0
            stopped = bool(should_stop and should_stop())
            if stopped:
                exit_code, output = 130, "Codex job stopped by supervisor checkpoint"
            clean = sanitize(output)
            atomic_write_text(output_path, clean)
            error_class = self.classify(
                exit_code,
                clean,
                timed_out=False,
                stopped=stopped,
            )
            return CodexExecution(
                run_id=run_id,
                ok=exit_code == 0 and not error_class,
                exit_code=exit_code,
                process_id=pid,
                session_id=self.session_id(clean),
                started_at=started_at,
                finished_at=utc_now(),
                prompt_hash=prompt_hash,
                output_hash=sha256_text(clean),
                artifact_path=str(output_path),
                error_class=error_class,
                timed_out=False,
                stopped=stopped,
                resumed=bool(session_id),
                command_structure=structure,
                output_excerpt=clean[-8000:],
            )

        command = self.build_command(
            working_directory=working_directory,
            modifying=modifying,
            session_id=session_id,
        )
        structure = self.command_structure(command, working_directory)
        environment = os.environ.copy()
        environment["NO_COLOR"] = "1"
        timeout_seconds = max(30, int(self.config.get("job_timeout_seconds", 1800)))
        maximum_output = max(65536, int(self.config.get("max_output_bytes", 2097152)))
        timed_out = False
        stopped = False
        creation_flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if os.name == "nt" else 0
        if os.name == "nt":
            creation_flags |= getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        with output_path.open("wb") as stdout_handle, error_path.open("wb") as stderr_handle:
            process = subprocess.Popen(
                command,
                cwd=working_directory,
                env=environment,
                stdin=subprocess.PIPE,
                stdout=stdout_handle,
                stderr=stderr_handle,
                shell=False,
                creationflags=creation_flags,
            )
            if on_start:
                on_start(run_id, process.pid, structure)
            assert process.stdin is not None
            process.stdin.write(prompt.encode("utf-8"))
            process.stdin.close()
            deadline = time.monotonic() + timeout_seconds
            while process.poll() is None:
                if should_stop and should_stop():
                    stopped = True
                    self._terminate_process_tree(process)
                    break
                if time.monotonic() >= deadline:
                    timed_out = True
                    self._terminate_process_tree(process)
                    break
                time.sleep(0.5)
            exit_code = process.poll()
        stdout_bytes = output_path.read_bytes()[:maximum_output]
        stderr_bytes = error_path.read_bytes()[:maximum_output]
        combined = stdout_bytes.decode("utf-8", errors="replace")
        if stderr_bytes:
            combined += "\n[stderr]\n" + stderr_bytes.decode("utf-8", errors="replace")
        if output_path.stat().st_size > maximum_output or error_path.stat().st_size > maximum_output:
            combined += "\n[OUTPUT_TRUNCATED_BY_CANA]\n"
        clean = sanitize(combined)
        atomic_write_text(output_path, clean)
        error_class = self.classify(exit_code, clean, timed_out=timed_out, stopped=stopped)
        assigned_session = session_id or self.session_id(clean)
        return CodexExecution(
            run_id=run_id,
            ok=exit_code == 0 and not error_class and bool(clean.strip()),
            exit_code=exit_code,
            process_id=process.pid,
            session_id=assigned_session,
            started_at=started_at,
            finished_at=utc_now(),
            prompt_hash=prompt_hash,
            output_hash=sha256_text(clean),
            artifact_path=str(output_path),
            error_class=error_class,
            timed_out=timed_out,
            stopped=stopped,
            resumed=bool(session_id),
            command_structure=structure,
            output_excerpt=clean[-8000:],
        )
