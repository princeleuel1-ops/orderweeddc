# Durable Mission Protocol

## Contract

Every SQLite mission stores identity and parentage, objective and rationale,
explicit assumptions, the specific SOTA gap, exactly one weakest brittle
point, success metrics, feedback signals, strategy revision and measured delta,
current benchmark evidence, numeric outcome and guardrail measurements,
falsification test, promotion rule, next frontier, and frontier epoch,
lane/model/fallback/reference routing, priority and dependencies, acceptance
criteria and prohibited changes, worktree and lease fields, attempts and
session, prompt/input/diff hashes, changed files and commands, deterministic
evidence, critic and repair history, release decision, integration and rollback
references, blocker and next action, and timestamps.

## States

`queued`, `leased`, `planning`, `researching`, `implementing`,
`awaiting_criticism`, `rejected`, `repairing`, `awaiting_verification`,
`awaiting_release_judgment`, `accepted`, `integrating`, `integrated`,
`post_integration_verification`, `retry_wait`, `blocked_external`,
`blocked_human`, `failed_retryable`, `failed_terminal`, `superseded`, and
`completed`.

Transitions are compare-and-set updates. Invalid transitions fail closed.
Leases expire and are recovered. Mutating operations use stable operation IDs,
so repeating a completed worktree, commit, integration, or rollback operation
does not duplicate its side effect.

Blade 0 has a separate `codex_missions` ledger with `CODEX_QUEUED`,
`CODEX_STARTING`, `CODEX_WORKING`, `CODEX_TESTING`,
`CODEX_AWAITING_EXTERNAL_REVIEW`, `CODEX_REPAIRING`, `CODEX_COOLDOWN`,
`CODEX_USAGE_LIMIT`, `CODEX_AUTH_REQUIRED`, `CODEX_RETRYABLE_FAILURE`,
`CODEX_TERMINAL_FAILURE`, `CODEX_COMPLETED`, `CODEX_REJECTED`,
`CODEX_INTEGRATED`, and `CODEX_REVERTED`. It persists CLI structure, session,
child PID, lease, worktree, candidate, tests, reviews, integration, rollback,
terminal state, and exact next action. One supervisor owns at most one Codex
child and one modifying Codex candidate.

## Five checks

1. Lane 3 produces an author check and targeted evidence.
2. Lane 2 and Lane 4 produce independent criticism.
3. The supervisor runs fixed deterministic verification.
4. Lane 5 issues an independent `ACCEPT`, `REJECT`, or `HOLD`.
5. The supervisor runs post-integration verification against the integrated tree.

Any failure preserves evidence, rejects the mission, creates repair or
reconciliation work, and repeats independent review. No model can transition
the mission or approve its own output.

For a Codex candidate the same checks are bound to its immutable revision.
High-impact work additionally needs two non-Codex model families. Editing the
candidate invalidates approvals. While a candidate waits, Blade 0 may run an
independent non-modifying selection or Loop Doctor mission.

## No progress

A durable fingerprint combines stable strategy identity, failure class,
changed files, test failure, criteria movement, score movement, and reversion.
Session IDs, attempt-specific prompt text, and output noise cannot hide a
repeated approach. At the threshold the loop
stops that approach and must decompose, change lane/model, request stronger
evidence, reconcile, or classify a real blocker while continuing an independent
workstream. The engine queues the decomposed strategy as a child with an
incremented strategy revision.

## Continuous execution

One completed mission queues the next evidence-backed objective. The loop ends
only at its persisted deadline, verified release-ready condition, or explicit
manual stop. Provider blockage redirects to deterministic local continuity and
does not fabricate external-lane evidence. An unchanged state produces
`idle:no-evidence-delta`; idle time is never counted as progress.

For a compounding mission, completion is not improvement. The frontier advances
only when the measured outcome beats its baseline, every guardrail remains
equal or better, deterministic verification passes, independent review accepts
the exact revision, integration is reversible, and post-integration evidence
confirms the gain.
