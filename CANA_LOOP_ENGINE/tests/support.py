from __future__ import annotations

import contextlib
import subprocess
import tempfile
from pathlib import Path
from typing import Iterator


def git(repo: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=repo,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=check,
    )


@contextlib.contextmanager
def temporary_git_repository() -> Iterator[Path]:
    with tempfile.TemporaryDirectory(prefix="cana-repo-") as raw:
        repo = Path(raw)
        git(repo, "init", "-b", "main")
        git(repo, "config", "user.email", "cana-tests@example.invalid")
        git(repo, "config", "user.name", "CANA Tests")
        (repo / "README.md").write_text("# Fixture\n", encoding="utf-8")
        (repo / "shared.txt").write_text("base\n", encoding="utf-8")
        git(repo, "add", "--all")
        git(repo, "commit", "-m", "fixture base")
        yield repo
