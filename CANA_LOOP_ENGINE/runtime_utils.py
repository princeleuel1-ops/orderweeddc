"""Shared, dependency-free runtime utilities."""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import shutil
import socket
import subprocess
import uuid
from pathlib import Path
from typing import Any, Iterable


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def parse_time(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.timezone.utc)


def add_seconds(value: str, seconds: float) -> str:
    parsed = parse_time(value)
    if parsed is None:
        raise ValueError("a timestamp is required")
    return (parsed + dt.timedelta(seconds=seconds)).isoformat(timespec="seconds")


def atomic_write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    temporary.write_text(text, encoding="utf-8")
    os.replace(temporary, path)


def atomic_write_json(path: Path, value: Any) -> None:
    atomic_write_text(path, json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", errors="replace")).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def run_process(
    command: list[str],
    *,
    cwd: Path,
    timeout: int = 300,
    environment: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    creation_flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if os.name == "nt" else 0
    resolved = shutil.which(
        command[0],
        path=(environment or os.environ).get("PATH"),
    )
    resolved_command = [resolved or command[0], *command[1:]]
    return subprocess.run(
        resolved_command,
        cwd=cwd,
        env=environment,
        stdin=subprocess.DEVNULL,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        shell=False,
        creationflags=creation_flags,
    )


def process_is_alive(pid: int | None) -> bool:
    if not pid or pid <= 0:
        return False
    if os.name == "nt":
        completed = subprocess.run(
            [
                "powershell.exe",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                f"if (Get-Process -Id {int(pid)} -ErrorAction SilentlyContinue) {{ exit 0 }} else {{ exit 1 }}",
            ],
            capture_output=True,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        return completed.returncode == 0
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def process_command_line(pid: int | None) -> str | None:
    """Return a process command line without persisting or logging it."""
    if not pid or pid <= 0:
        return None
    if os.name == "nt":
        script = (
            f"$p=Get-CimInstance Win32_Process -Filter \"ProcessId = {int(pid)}\" "
            "-ErrorAction SilentlyContinue;"
            "if(-not $p){exit 1};"
            "[Console]::Out.Write([string]$p.CommandLine)"
        )
        completed = subprocess.run(
            [
                "powershell.exe",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                script,
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        value = completed.stdout.strip()
        return value if completed.returncode == 0 and value else None
    proc_path = Path(f"/proc/{int(pid)}/cmdline")
    if proc_path.is_file():
        try:
            value = proc_path.read_bytes().replace(b"\0", b" ").decode(
                "utf-8", errors="replace"
            )
            return value.strip() or None
        except OSError:
            return None
    completed = subprocess.run(
        ["ps", "-p", str(int(pid)), "-o", "command="],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    value = completed.stdout.strip()
    return value if completed.returncode == 0 and value else None


def process_matches(pid: int | None, required_tokens: Iterable[str]) -> bool:
    """Reject stale PID reuse unless the live command has every expected token."""
    command_line = process_command_line(pid)
    if not command_line:
        return False
    normalized = command_line.casefold()
    tokens = [str(token).strip().casefold() for token in required_tokens if str(token).strip()]
    return bool(tokens) and all(token in normalized for token in tokens)


def localhost_port_open(port: int, timeout: float = 0.4) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", int(port)), timeout=timeout):
            return True
    except OSError:
        return False


def redact_mapping(value: Any, secret_values: Iterable[str] = ()) -> Any:
    from security import sanitize

    return json.loads(sanitize(json.dumps(value, ensure_ascii=False), secret_values))
