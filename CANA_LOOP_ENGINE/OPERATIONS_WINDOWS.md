# Windows Operations

Run commands from the repository root in PowerShell.

## Install and preflight

```powershell
.\CANA_LOOP_ENGINE\Install-CanaLoopWatchdog.ps1
.\CANA_LOOP_ENGINE\Start-CanaLoop.ps1 -PreflightOnly -EnableCodex
```

The two scheduled tasks are:

- `CANA-Loop-Supervisor`: checks at user logon.
- `CANA-Loop-Watchdog`: checks every five minutes.

Both use `IgnoreNew` and the supervisor also owns a single-instance lock.

## Start

Four-day bounded execution:

```powershell
.\CANA_LOOP_ENGINE\Start-CanaLoop.ps1 -Hours 96 -MaxParallelLanes 5 -EnableCodex -MaxParallelCodex 1
```

Goal-driven execution:

```powershell
.\CANA_LOOP_ENGINE\Start-CanaLoop.ps1 -UntilReleaseReady -MaxParallelLanes 5 -EnableCodex -MaxParallelCodex 1
```

The launcher can be closed after it reports the PIDs. The hidden supervisor and
OpenCode processes remain independent of that PowerShell window.

## Observe

```powershell
.\CANA_LOOP_ENGINE\Get-CanaLoopStatus.ps1
Get-ScheduledTask -TaskName CANA-Loop-Supervisor,CANA-Loop-Watchdog
Get-Content .\.cana-loop\logs\watchdog.log -Tail 20
```

Status includes ending condition, heartbeat, supervisor, OpenCode, and Codex
PIDs, five lane/model/reference assignments, Blade 0 capabilities and durable
missions, active runs, cooldowns, usage, last progress, and next actions.
Process status is identity-verified; a live unrelated process with a reused PID
is reported as not alive for that runtime role.

## Stop, resume, and extend

```powershell
.\CANA_LOOP_ENGINE\Stop-CanaLoop.ps1
.\CANA_LOOP_ENGINE\Resume-CanaLoop.ps1
.\CANA_LOOP_ENGINE\Extend-CanaLoop.ps1 -Hours 96
```

Stop writes a durable manual-stop marker. The supervisor checkpoints and exits
after its current atomic operation; the watchdog will not restart it. Resume
removes that marker and reuses the recorded ending condition. Extend changes
the persisted deadline without restarting the process.

## Uninstall watchdog

```powershell
.\CANA_LOOP_ENGINE\Uninstall-CanaLoopWatchdog.ps1
```

Uninstalling tasks preserves SQLite state, logs, artifacts, worktrees, and
control-tower evidence.

## Operational files

- `.cana-loop/state.sqlite3`: authoritative durable state.
- `.cana-loop/heartbeat.json`: atomic live heartbeat.
- `.cana-loop/preflight.json`: sanitized structural/provider status.
- `.cana-loop/launch.json`: ending condition and non-secret launch settings.
- `.cana-loop/artifacts/codex/`: sanitized bounded-job evidence.
- `.cana-loop/logs/`: supervisor, OpenCode, and watchdog output.
- `CANA_CONTROL_TOWER/EXTERNAL_LOOP_STATUS.json`: sanitized operator status.

Do not edit SQLite directly while the supervisor is active.
The supervisor is the only Codex worker authority. The watchdog waits for a
tracked Codex child to finish and restarts only the supervisor.
