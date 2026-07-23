---
name: durable-agent-architecture
description: Design, audit, refactor, and operate long-running AI-agent systems whose execution survives model, prompt, framework, tool, memory, browser, and sandbox changes. Use for autonomous loops, background agents, scheduled agents, delegated sub-agents, durable workflows, agent factories, and brittle agent architectures that repeatedly need rewrites.
---

# Durable Agent Architecture

## Mission

Build agent systems that can evolve without being rebuilt every time the model, framework, prompt, tool standard, memory system, browser, or sandbox changes.

The architecture has three deliberately separated layers:

1. **Execution — the stable brain**
   - Workflow state, sequencing, scheduling, events, retries, timeouts, resumability, cancellation, concurrency, sub-agent coordination, trace IDs, approvals, and outcome recording.
2. **Context — replaceable knowledge**
   - Models, prompts, policies, tool definitions, retrieval, memory, schemas, examples, and model-specific formatting.
3. **Compute — replaceable hands**
   - Sandboxes, containers, browsers, code runners, file systems, machines, GPUs, and external runtimes.

The execution layer must not depend on one model, one prompt format, one framework, or one sandbox provider.

## Core operating law

Treat rapid change as a permanent design constraint. Put durable state and control flow in the execution layer. Put volatile intelligence choices behind adapters. Treat sandboxes as ephemeral workers, not as the source of truth.

## Non-negotiable requirements

Every architecture produced or repaired with this skill must include:

- Durable external run state.
- Step-level checkpoints and resumability.
- Idempotent steps or explicit deduplication keys.
- Typed, versioned contracts between layers.
- Model, tool, memory, browser, and sandbox adapters.
- Failure classification with bounded retry policies.
- Explicit time, step, token, cost, and recursion limits.
- Full-session traces from trigger to terminal outcome.
- Human inspect, pause, resume, cancel, approve, and override controls.
- Outcome-based scoring tied to real downstream events where possible.
- Versioned changes, canary tests, rollback plans, and evidence receipts.
- Clear separation of **verified reality**, **planned work**, **assumptions**, and **unknowns**.

Do not claim a component is built, tested, deployed, or reliable without evidence.

## When invoked

Choose the matching mode automatically:

### Audit mode
Use when an agent system already exists.

Produce:

- Current-state evidence inventory.
- Three-layer architecture map.
- Coupling and half-life audit.
- Failure and recovery map.
- Ranked refactor plan.
- Verification plan and acceptance tests.

### Build mode
Use when creating a new agent system.

Produce:

- Architecture decision record.
- Contracts and state machine.
- Durable execution scaffold.
- Context and compute adapters.
- Observability and evaluation plan.
- Runnable tests, failure drills, and operating runbook.

### Rescue mode
Use when a run is stuck, repeatedly restarts, loses work, or cannot be debugged.

First preserve evidence. Then locate the latest valid checkpoint, classify the failure, repair the smallest responsible boundary, resume safely, and verify the recovered outcome.

### Evolution mode
Use when models, frameworks, prompts, tools, or sandboxes are being replaced.

Change one volatile adapter at a time. Keep the execution contract stable. Run compatibility tests and a canary before broad rollout.

## Required workflow

### Phase 0 — Inspect before designing

Collect grounded evidence from the repository, files, configs, runtime logs, traces, schemas, deployment manifests, and current interfaces.

Create a ledger with four labels:

- `VERIFIED`
- `PLANNED`
- `ASSUMED`
- `UNKNOWN`

Never erase already verified progress. Warn when a proposed change would remove a working capability.

### Phase 1 — Run the half-life audit

Inventory every important component and classify it:

| Component | Layer | Expected change rate | Current owner | Coupling risk | Replacement cost |
|---|---|---:|---|---:|---:|
| Workflow state | Execution | Slow | Execution core | Low target | Low target |
| Prompt | Context | Fast | Prompt registry | High if embedded | Low target |
| Model | Context | Fast | Model adapter | High if embedded | Low target |
| Tool schema | Context | Medium/Fast | Tool registry | Medium | Low target |
| Sandbox | Compute | Medium | Compute adapter | High if stateful | Low target |

Find where a fast-changing component controls or stores a slow-changing concern. Those are the primary rewrite hazards.

### Phase 2 — Draw the layer boundaries

For each layer, state:

- Responsibilities.
- Inputs and outputs.
- State it owns.
- State it must never own.
- Adapter interfaces.
- Failure modes.
- Observability.

Reject designs where:

- A prompt contains the real workflow state machine.
- A sandbox disk is the authoritative state store.
- Retry logic is hidden inside prompt text.
- Framework-specific objects leak into domain contracts.
- A model response directly mutates production without a gate.
- A reviewer can silently rewrite its own evaluator or acceptance criteria.

### Phase 3 — Define durable contracts

At minimum define versioned schemas for:

- `Run`
- `Step`
- `Event`
- `Checkpoint`
- `Artifact`
- `ToolCall`
- `Approval`
- `Outcome`
- `TraceSpan`

Every step must have:

- Stable `run_id` and `step_id`.
- Versioned input and output schema.
- Idempotency key.
- Timeout.
- Retry class and maximum attempts.
- Checkpoint rule.
- Compensation or rollback behavior when relevant.
- Evidence references.

### Phase 4 — Implement the execution kernel

The execution kernel controls:

1. Trigger intake: API, event, schedule, webhook, queue, or human action.
2. Run creation and deduplication.
3. State transitions.
4. Step dispatch.
5. Durable checkpoint writes.
6. Retry, delay, backoff, and dead-letter behavior.
7. Sub-agent fan-out and fan-in.
8. Concurrency limits and leases.
9. Heartbeats for long-running work.
10. Pause, approval, resume, cancellation, and termination.
11. Artifact registration.
12. Full trace and outcome finalization.

Recommended state machine:

`RECEIVED -> PLANNING -> READY -> RUNNING -> WAITING | PAUSED | RETRYING -> VERIFYING -> SUCCEEDED | FAILED | CANCELLED | EXHAUSTED`

A crashed worker must be replaceable without losing authoritative progress.

### Phase 5 — Isolate context

All volatile intelligence must sit behind adapters or registries:

- Model router.
- Prompt registry with versions.
- Tool registry with schemas and permissions.
- Retrieval and memory provider.
- Policy bundle.
- Structured-output parser and repair policy.

The execution layer calls a stable interface such as:

```text
invoke_model(request: ModelRequest) -> ModelResult
invoke_tool(request: ToolRequest) -> ToolResult
retrieve_context(request: ContextRequest) -> ContextResult
```

Do not let provider-specific response objects cross the boundary.

### Phase 6 — Isolate compute

Treat compute as leased, replaceable, and disposable.

A compute adapter should support:

- Provision.
- Execute.
- Stream logs.
- Upload/download artifacts.
- Heartbeat.
- Terminate.

Persist outputs and checkpoints outside the sandbox before declaring a step complete. Never rely on a snapshot as the sole source of truth.

### Phase 7 — Make the whole run observable

Trace the entire path, not only model calls:

- Trigger.
- Queue and scheduling delay.
- State transitions.
- Model calls.
- Tool calls.
- Code execution.
- Browser actions.
- Database operations.
- Permission failures.
- Sub-agent delegation.
- Checkpoints.
- Human approvals.
- Final downstream outcome.

Capture latency, attempts, token usage, cost, failure class, artifact lineage, evaluator score, and terminal reason.

### Phase 8 — Add the recursive reviewer safely

The reviewer inspects traces, choices, artifacts, and real outcomes. It asks:

- Did the run reach the stated goal?
- Which step caused delay, cost, failure, or poor quality?
- Did the agent underreact or overreact?
- Was needed context missing?
- Did a tool or model adapter fail?
- Did a downstream user or system act on the result?

The reviewer may create a versioned improvement proposal. It must not directly change production control logic without:

1. Evidence.
2. Test case.
3. Canary scope.
4. Acceptance threshold.
5. Rollback plan.
6. Approval policy.

Do not score only with thumbs up/down when a real behavioral outcome exists. Prefer evidence such as a saved report, accepted recommendation, opened pull request, fixed incident, completed transaction, or verified metric change.

### Phase 9 — Run failure drills

The system is not complete until these tests pass:

- Kill a worker in the middle of a long run; resume from the latest valid checkpoint.
- Make a model return malformed output; repair or fail safely.
- Rate-limit the primary model; route or retry without restarting the run.
- Make a tool time out after performing a side effect; avoid duplicate effects.
- Deliver the same trigger twice; deduplicate correctly.
- Replace the model provider; keep the workflow unchanged.
- Replace the sandbox provider; keep authoritative state unchanged.
- Pause for human approval, wait, then resume.
- Fan out sub-agents and recover one failed branch.
- Exceed a budget; stop with a precise terminal reason.
- Replay a historical run in dry-run mode.
- Verify that every result has trace and artifact lineage.

### Phase 10 — Deliver the engineering package

For serious work, output:

1. Current-state evidence ledger.
2. Three-layer architecture diagram in text or Mermaid.
3. Half-life and coupling audit.
4. Versioned contracts.
5. State machine.
6. Implementation or patch set.
7. Failure-policy table.
8. Observability plan.
9. Reviewer/evaluation design.
10. Verification results.
11. Migration and rollback plan.
12. Remaining unknowns and blocked items.

## Canonical execution loop

Use this loop for autonomous or background agents:

```text
OBSERVE current durable state and new events
  -> PLAN the smallest safe next actions
  -> DISPATCH bounded work to context/compute adapters
  -> CHECKPOINT externally
  -> VERIFY against fixed criteria
  -> COMMIT, COMPENSATE, RETRY, PAUSE, or STOP
  -> RECORD trace, artifacts, cost, and outcome
  -> CONTINUE only while goals and budgets allow
```

The check, not the agent's confidence, decides whether the result improved.

## Retry policy

Classify before retrying:

| Failure class | Default action |
|---|---|
| Transient network or rate limit | Exponential backoff with jitter |
| Worker crash | Lease expiry, replace worker, resume checkpoint |
| Malformed model output | Bounded repair attempt, then alternate model or fail |
| Permanent permission error | Stop and request authorized intervention |
| Invalid input or schema | Fail fast with precise evidence |
| Side effect uncertain | Reconcile by idempotency key before retry |
| Budget exhausted | Stop as `EXHAUSTED`; do not silently continue |
| Evaluator disagreement | Escalate or run an independent adjudicator |

Never retry an entire multi-hour run when only one bounded step failed.

## Architectural anti-patterns

Flag these immediately:

- State stored only in memory, a prompt, or a sandbox.
- One giant agent call that plans, acts, evaluates, and commits.
- Orchestration embedded in model prose.
- Unbounded autonomous loops.
- Whole-run retries.
- No idempotency for external side effects.
- Provider-specific objects everywhere.
- Observability limited to prompt/response logs.
- No trace across sub-agents.
- “Success” based only on the agent saying it succeeded.
- Self-modification without canaries and rollback.
- Snapshots mistaken for durable workflow state.

## Technology selection rule

Do not lock the architecture to one vendor. Technologies such as Inngest, Temporal, durable queues, workflow engines, serverless orchestrators, databases, container platforms, and browser providers are implementation options. Select them only after the contracts, failure semantics, scale, latency, hosting, compliance, and operational constraints are known.

## Completion standard

The system is complete only when a new model, prompt, tool, or sandbox can be swapped with minimal changes outside its adapter; a failed long-running run resumes without repeating completed work; the full trace is inspectable; outcomes are evidence-backed; and the system stops safely when its goals or budgets are exhausted.
