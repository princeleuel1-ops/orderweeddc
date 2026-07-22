# Recovery

## Recovery sequence

On every supervisor start:

1. Acquire the single-instance lock.
2. Mark incomplete durable operations interrupted.
3. Mark running lane processes interrupted with `worker_exit`.
4. Recover expired leases.
5. Requeue non-terminal orphaned missions within their retry ceilings.
6. Refresh provider acceptance without invoking denied references.
7. Resume the strongest unblocked mission from preserved artifacts.
8. Mark orphaned Codex runs interrupted, recover their lease, and resume the
   supported session or start a fresh bounded session in the preserved
   worktree.

Lane failure, malformed output, test failure, provider overload, and model
unavailability are mission outcomes, not supervisor termination conditions.

## Failure classes

- `rate_limit`: honor `Retry-After`, then exponential backoff and jitter.
- `overloaded` / provider `5xx`: bounded exponential retry.
- `timeout` / `malformed`: retry within the lane ceiling.
- `auth` / `payment`: block externally without repeated attempts.
- `model_unavailable`: advance to a configured fallback.
- `worker_exit`: recover the lane and requeue the mission.
- Codex `usage_limit`: persist `CODEX_USAGE_LIMIT` and a cooldown while other
  lanes and deterministic checks continue.
- Codex `auth_required`: persist `CODEX_AUTH_REQUIRED` without inspecting
  credentials; resume when login-status preflight becomes ready.
- deterministic or critic failure: reject and create a repair mission.
- integration conflict: abort merge and create reconciliation.
- post-integration regression: revert and create repair work.

Cooldowns are persisted per lane, model, and secret reference. Circuit-breaker
state and daily usage survive process restarts.

## Watchdog behavior

The watchdog restarts only when:

- no manual-stop marker exists;
- the ending condition is not complete;
- the runtime is not marked completed;
- the supervisor is missing or the heartbeat is stale;
- no approved long-running child process is still alive.

A tracked Codex child causes the watchdog to wait. The watchdog never launches
Codex itself. PID existence is insufficient: supervisor, OpenCode, and Codex
PIDs must match their expected command identity. This prevents a stale reused
PID from killing or waiting on an unrelated Windows process.

If an orphaned Codex child outlives its durable mission lease, the watchdog
terminates only that identity-verified Codex process tree. Startup recovery
then requeues the mission from its preserved worktree instead of waiting
forever or launching a duplicate worker.

It records inspection, launch, and failure events. It delegates restart to
`Resume-CanaLoop.ps1`, so the watchdog never reads or stores credentials.

## Tests

```powershell
.\CANA_LOOP_ENGINE\Test-CanaLoopRecovery.ps1
```

The suite injects stale leases, orphaned operations and lane runs, Lane 5
termination, Codex crash/lease recovery, Codex usage exhaustion, duplicate
Codex-worker prevention, safe stop, 429, 503, primary-model failure, failed validation, critic and
release rejection, worktree conflict, rollback, restart persistence, and
watchdog restart simulation.

For a manual supervisor crash test, note the supervisor PID, terminate only that
PID, then run `Watch-CanaLoop.ps1`. The next status must show a new PID and a
new heartbeat without duplicated active leases.
