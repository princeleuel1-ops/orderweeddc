# Security Model

## Credential boundary

JSON contains only five environment-reference names. Existing DPAPI-encrypted
values are decrypted by the launcher into its process memory, inherited by
OpenCode and the supervisor, then cleared from the launcher. Credentials are
never command arguments, configuration literals, Markdown, screenshots,
fixtures, process titles, or status fields.

The supervisor preserves the existing one-way credential deny list. A missing
or denied reference cannot reach provider health checks or model execution.
Only a reference that passes preflight may be used. Logs, artifacts, errors, and
crash traces pass through direct-value and pattern redaction before persistence.

## Server boundary

OpenCode binds only to `127.0.0.1`, uses a fresh random authentication password
held only in process environments, disables public sharing and auto-update, and
denies external-directory and share permissions. Jobs are scoped to the
repository, approved worktrees, and runtime artifact paths.

If the supervisor dies while the server remains alive, restart creates a fresh
server/authentication pair rather than persisting the password.

## File and Git boundary

- Modifying missions never use the primary working tree.
- Worktrees are validated beneath `.cana-loop/worktrees`.
- Dirty primary state blocks integration.
- No force push, history rewrite, automatic public deployment, purchase,
  third-party contact, test weakening, or security-control disabling exists.
- Merge overlap produces reconciliation work instead of silent overwrite.
- Rollback uses a local revert commit and retains both integration and rollback references.

## Prompt and model boundary

Repository and model text are untrusted input. Models cannot write SQLite,
change ending conditions, modify watchdog settings, approve their own work, or
bypass gates. Lane 2 and Lane 4 independently criticize; Lane 5 independently
judges release. Deterministic commands are selected from local configuration,
not accepted from model output.

## Codex boundary

Only `CANA_LOOP_ENGINE/codex_adapter.py` may invoke the installed Codex CLI.
Prompts use stdin and never process arguments. Modifying jobs use
`workspace-write` only inside a supervisor-created worktree; non-modifying jobs
use `read-only`; approval is noninteractive `never`. The adapter enforces
timeout, output ceilings, sanitized JSONL capture, and child-tree termination.
It classifies login status without reading or modifying credentials.

Codex-authored code, OpenCode output, prompts, scripts, and worktrees may not
invoke Codex recursively. The automated source scan enforces that boundary.
Codex never approves or merges its own candidate. High-impact candidates
require Truth, adversarial verification, deterministic checks, Release Judge,
and two different non-Codex model families on the exact unchanged revision.

## Audit

Use:

```powershell
py -3 -m unittest discover -s .\CANA_LOOP_ENGINE\tests -v
rg -n -i "(api[_-]?key|authorization:|sk-)" .\.cana-loop .\CANA_CONTROL_TOWER
py -3 -c "import sys; from pathlib import Path; sys.path.insert(0, 'CANA_LOOP_ENGINE'); from security import unauthorized_codex_invocations; assert not unauthorized_codex_invocations(Path('CANA_LOOP_ENGINE'))"
```

Any scan hit requires inspection; status files may contain reference names but
must never contain reference values.
