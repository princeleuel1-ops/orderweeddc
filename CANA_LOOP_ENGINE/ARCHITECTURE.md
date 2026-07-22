# Architecture

## Authority boundaries

The supervisor is authoritative for state, permissions, leases, retry ceilings,
cooldowns, verification, integration, and rollback. OpenCode is a headless
execution substrate. Model lanes cannot mutate mission state directly and no
lane can approve its own work.

```text
Windows scheduled tasks
        |
        v
watchdog.py --> Resume-CanaLoop.ps1
        |
        v
supervisor.py ---------> heartbeat + reporter
   |       |                       |
   |       +--> SQLite state       +--> CANA_CONTROL_TOWER
   |
   +--> objective + mission queue
   +--> Blade 0 lease --> codex_adapter.py --> bounded Codex child
   |                         |
   |                         +--> isolated worktree + candidate hold
   +--> isolated Git worktree
   +--> OpenCode localhost server
           |
           +--> Lane 1 strategy
           +--> Lane 2 truth critic
           +--> Lane 3 implementation
           +--> Lane 4 adversarial verification
           +--> Lane 5 release judgment
   |
   +--> critic gate --> deterministic gate --> release gate
   +--> local integration --> post-integration gate --> rollback
```

## Durability

SQLite uses WAL mode, foreign keys, a busy timeout, stable operation IDs, and
explicit mission transitions. Each mission lease has an owner and expiration.
Startup marks orphaned operations and lane runs interrupted, then requeues
recoverable missions. Atomic JSON writes publish heartbeat and preflight state.

## OpenCode contract

PowerShell launches `opencode serve` in pure, headless mode on localhost with
environment-based basic authentication and public sharing disabled. Lane jobs
use `opencode run --attach`, explicit provider/model, explicit agent, JSON
events, a project/worktree directory, attached prompt files, and durable session
IDs. Prompts and credentials never share process arguments.

## Concurrency

Five lanes are independently addressable and schedulable. The canonical
five-stage mission is intentionally ordered because later lanes consume earlier
evidence. `MaxParallelLanes` is bounded at five and is available to independent
future missions; modifying missions never share a primary working tree.
Blade 0 is separately schedulable at a hard maximum of one child. A pending
high-impact Codex candidate prevents another modifying Codex mission but not a
non-modifying selection, diagnosis, or deterministic workstream.

## Integration safety

Every modifying mission receives a branch and worktree beneath the runtime's
approved worktree root. The integration gate requires critic, deterministic,
and release approval. It blocks a dirty primary tree, rejects overlapping
files, aborts merge conflicts, creates reconciliation missions, and records a
revert reference for every merged change.
