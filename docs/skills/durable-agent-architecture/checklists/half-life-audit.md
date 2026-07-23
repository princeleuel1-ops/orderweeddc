# Half-Life and Coupling Audit

Use this checklist against the real code and runtime evidence.

## Evidence

- [ ] Repository and deployed version identified.
- [ ] Runtime logs/traces inspected.
- [ ] State stores and queues identified.
- [ ] Current models, prompts, tools, memory, browser, and sandbox providers identified.
- [ ] Verified, planned, assumed, and unknown items separated.

## Execution layer

- [ ] Authoritative state is durable and external.
- [ ] Runs and steps have stable IDs.
- [ ] Checkpoints are step-level or finer.
- [ ] Completed work is not repeated after a crash.
- [ ] Duplicate triggers are deduplicated.
- [ ] Side effects are idempotent or reconciled.
- [ ] Retry logic is bounded and classified.
- [ ] Scheduling, delay, queueing, and backoff are explicit.
- [ ] Sub-agent fan-out/fan-in is traceable.
- [ ] Human pause/resume/cancel/approval exists.
- [ ] Budgets and stop reasons are explicit.

## Context layer

- [ ] Models are accessed through adapters.
- [ ] Provider response objects do not leak into execution code.
- [ ] Prompts are versioned and not the hidden state machine.
- [ ] Tools have versioned schemas and permissions.
- [ ] Memory/retrieval is replaceable.
- [ ] Structured output has validation and bounded repair.

## Compute layer

- [ ] Sandboxes are treated as ephemeral.
- [ ] Sandbox disk is not authoritative state.
- [ ] Artifacts are persisted before step completion.
- [ ] Compute has leases and heartbeats.
- [ ] Compute provider can be replaced behind an adapter.

## Observability and learning

- [ ] One trace spans trigger through final outcome.
- [ ] Database, permission, queue, code, browser, tool, and model failures are visible.
- [ ] Cost, latency, tokens, attempts, and artifacts are recorded.
- [ ] Outcomes are linked to real downstream events when possible.
- [ ] Reviewer changes are versioned, canaried, and reversible.

## Rewrite hazards

- [ ] No framework-specific domain contracts.
- [ ] No whole-run retry for one failed step.
- [ ] No unbounded loops.
- [ ] No success claim based only on model self-report.
- [ ] No production self-modification without gates.
