"""Credential preflight and output redaction.

Only reference names and one-way fingerprints may enter durable state.
"""

from __future__ import annotations

import hashlib
import os
import re
from collections.abc import Iterable
from pathlib import Path


SECRET_PATTERNS = (
    re.compile(r"sk-[A-Za-z0-9_-]{12,}"),
    re.compile(r"AIza[A-Za-z0-9_-]{20,}"),
    re.compile(r"(?i)((?:api|access|secret)[_-]?key\s*[=:]\s*)[^\s,;]+"),
    re.compile(r"(?i)(authorization:\s*(?:bearer|basic)\s+)[^\s]+"),
)

# One-way deny-list fingerprints from the repository's existing approved
# credential preflight. The underlying values never appear in source or state.
REJECTED_SECRET_SHA256 = frozenset(
    {
        "1bfbf09e49290ee657375afb4c4f659faaaeb0445b0b624533365ecd9c48ef63",
        "09ded78b20ec52d9ae259972cdcb7befe81ecccb64002261951cd87f5405a742",
        "25aa9bda58f2f760115e7d41ba0b2ac71e65f0a2b5307fb397fe045ef2114cb1",
        "0a4691b0b28c9ce2df139b0e5b9b2a6ebff6484bc9f04970dbd534f3fb37fbaf",
        "0bc2f717ac27af16ff4de89a387457c5da2724ebb7ef3a9286a50311303e2f2f",
        "894352aee6feffb99ec996c411e56e3a40003f428074f1be4dba78ab0161d640",
    }
)


def secret_digest(value: str) -> str:
    return hashlib.sha256(value.strip().encode("utf-8")).hexdigest()


def accepted_secret_reference(reference: str) -> bool:
    value = os.environ.get(reference, "")
    return bool(value) and secret_digest(value) not in REJECTED_SECRET_SHA256


def secret_reference_status(references: Iterable[str]) -> dict[str, bool]:
    return {reference: accepted_secret_reference(reference) for reference in references}


def secret_values(references: Iterable[str]) -> list[str]:
    return [os.environ.get(reference, "") for reference in references if os.environ.get(reference)]


def sanitize(text: str, values: Iterable[str] = ()) -> str:
    result = str(text)
    for value in values:
        if value:
            result = result.replace(value, "[REDACTED_SECRET]")
    for pattern in SECRET_PATTERNS:
        if pattern.groups:
            result = pattern.sub(r"\1[REDACTED_SECRET]", result)
        else:
            result = pattern.sub("[REDACTED_SECRET]", result)
    return result


def unauthorized_codex_invocations(root: Path) -> list[str]:
    """Return source locations that directly invoke Codex outside the adapter.

    Tests may exercise the approved adapter. Production Python, PowerShell, and
    command files may not contain another direct Codex launch boundary.
    """
    root = root.resolve()
    engine_root = root if root.name == "CANA_LOOP_ENGINE" else root / "CANA_LOOP_ENGINE"
    allowed = {
        (engine_root / "codex_adapter.py").resolve(),
        (engine_root / "tests" / "test_codex_adapter.py").resolve(),
        (engine_root / "tests" / "test_codex_recovery.py").resolve(),
        (engine_root / "tests" / "test_security_contract.py").resolve(),
    }
    patterns = (
        re.compile(
            r"(?i)\b(?:subprocess\.(?:run|popen)|start-process|processstartinfo)"
            r"[^\n]{0,500}(?:[\"']codex(?:\.cmd|\.ps1|\.exe)?[\"']|\bcodex\s+exec\b)"
        ),
        re.compile(
            r"(?i)(?:[\"']codex(?:\.cmd|\.ps1|\.exe)?[\"']|\bcodex\s+exec\b)"
            r"[^\n]{0,500}\b(?:subprocess\.(?:run|popen)|start-process|processstartinfo)"
        ),
        re.compile(r"(?im)^\s*(?:&|call|start)\s+(?:[\"']?codex)(?:\.cmd|\.ps1|\.exe)?\b"),
        re.compile(
            r"(?i)\b(?:child_process\.(?:exec|execfile|spawn)|"
            r"(?:exec|execfile|spawn)(?:sync)?|deno\.command|bun\.spawn)"
            r"[^\n]{0,500}(?:[\"']codex(?:\.cmd|\.ps1|\.exe)?[\"']|\bcodex\s+exec\b)"
        ),
    )
    violations: list[str] = []
    skipped = {
        ".git",
        ".next",
        "node_modules",
        "dist",
        "build",
        "__pycache__",
        ".governor",
    }
    extensions = {".py", ".ps1", ".cmd", ".bat", ".js", ".mjs", ".cjs", ".ts", ".tsx"}
    paths = [
        path
        for path in root.rglob("*")
        if path.is_file()
        and path.suffix.lower() in extensions
        and not any(part in skipped or part.startswith(".cana-loop") for part in path.parts)
    ]
    for path in paths:
        if path.resolve() in allowed:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for pattern in patterns:
            match = pattern.search(text)
            if match:
                line = text.count("\n", 0, match.start()) + 1
                violations.append(f"{path.name}:{line}")
                break
    return violations
