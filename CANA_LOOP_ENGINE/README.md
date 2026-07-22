# CANA Loop Engine

This subsystem is an independent, restart-safe outer runtime for Blade 0
(bounded installed-Codex jobs) and five bounded OpenCode/OpenRouter lanes. It
keeps mission authority, durable state, retries, worktree isolation,
independent review, deterministic verification, integration, and rollback
outside model conversations.

The engine uses Python's standard library, PowerShell, Git, the installed
OpenCode CLI, SQLite, and five OpenRouter provider aliases. The runtime does not
depend on an IDE, TUI, desktop window, or the bootstrap session remaining open.

## Runtime components

- `supervisor.py` owns the sovereign loop and ending conditions.
- `state_store.py` is the SQLite source of truth.
- `mission_queue.py` owns ranking, leases, transitions, repairs, and recovery.
- `objective_engine.py` maintains release, leadership, and invention horizons.
- `opencode_adapter.py` attaches machine-readable jobs to `opencode serve`.
- `codex_adapter.py` is the sole installed-Codex invocation boundary.
- `codex_lane.py`, `codex_health.py`, and `codex_mission_runner.py` own Blade 0
  queueing, usage/auth state, bounded jobs, continuation, and recovery.
- `openrouter_health.py` owns health, cooldown, retry, breaker, fallback, and usage state.
- `lane_manager.py` schedules the five independently configured lanes.
- `worktree_manager.py` isolates modifying work.
- `critic_gate.py`, `verification_gate.py`, and `release_judge.py` enforce independent checks.
- `integration_gate.py` rejects overlap and performs reversible local merges.
- `rollback_manager.py` reverts failed post-integration changes.
- `heartbeat.py`, `watchdog.py`, and PowerShell lifecycle scripts provide Windows durability.
- `no_progress_detector.py`, `research_ledger.py`, and `reporter.py` preserve useful evidence.

Every durable mission carries an evolution contract: explicit assumptions, one
specific SOTA gap, one weakest brittle point, success metrics, feedback
signals, and a strategy revision. Repeated approaches are compared by stable
strategy fingerprints rather than session IDs or output noise. At the
no-progress threshold, the stalled mission closes and a decomposed,
changed-strategy child is queued.

`daily_job_ceiling: 0` means the engine does not invent a smaller local Codex
quota. Actual usage-limit responses still trigger a durable cooldown. A bounded
pending-builder cap and a malformed-selection threshold prevent activity-only
loops from consuming capacity without producing executable mission contracts.

New high-impact selections use the compounding frontier contract in
`prompts/zenith-compounding.md`: current benchmark evidence, one strictly
improving numeric outcome, one non-regressing numeric guardrail, falsification,
promotion, and the next harder target. The reported frontier epoch advances
only for integrated measured gains, never for activity or model confidence.

## Canonical commands

```powershell
.\CANA_LOOP_ENGINE\Install-CanaLoopWatchdog.ps1
.\CANA_LOOP_ENGINE\Start-CanaLoop.ps1 -PreflightOnly -EnableCodex
.\CANA_LOOP_ENGINE\Start-CanaLoop.ps1 -Hours 96 -MaxParallelLanes 5 -EnableCodex -MaxParallelCodex 1
.\CANA_LOOP_ENGINE\Start-CanaLoop.ps1 -UntilReleaseReady -MaxParallelLanes 5 -EnableCodex -MaxParallelCodex 1
.\CANA_LOOP_ENGINE\Get-CanaLoopStatus.ps1
.\CANA_LOOP_ENGINE\Extend-CanaLoop.ps1 -Hours 96
.\CANA_LOOP_ENGINE\Stop-CanaLoop.ps1
.\CANA_LOOP_ENGINE\Resume-CanaLoop.ps1
.\CANA_LOOP_ENGINE\Test-CanaLoopRecovery.ps1
```

The start command binds OpenCode to `127.0.0.1:4096`, generates a fresh
process-only authentication password, launches the server and supervisor
without visible windows, and writes only PIDs and sanitized evidence to
`.cana-loop`.

The runtime automatically remains in deterministic local-continuity mode when
accepted provider references are unavailable. It never labels those checks as
external model work. When all five references pass the existing deny-list
preflight, blocked external missions return to the queue automatically.
Blade 0 remains independently schedulable when OpenRouter is unavailable.
Codex candidates remain held until Truth, adversarial, deterministic, Release
Judge, and model-family-diversity requirements pass on the exact candidate.

See [OPERATIONS_WINDOWS.md](OPERATIONS_WINDOWS.md) for operations,
[MISSION_PROTOCOL.md](MISSION_PROTOCOL.md) for state and gate rules, and
[EVOLUTION_PROTOCOL.md](EVOLUTION_PROTOCOL.md) for the measurable improvement
loop.
