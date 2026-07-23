# Example: Durable Autonomous Website Governor

## Mission

Operate a website or multi-domain network continuously without losing work, repeating side effects, or coupling the system to one model or coding sandbox.

## Execution layer

Owns:

- Schedules and incoming events.
- Durable objectives and run state.
- Candidate-improvement queue.
- Step checkpoints.
- Approval gates.
- Deployment locks.
- Rollback records.
- Full traces and outcome events.

Does not own:

- Specific model prompts.
- One vendor's browser API.
- Sandbox filesystem state.
- One analytics provider's raw response format.

## Context layer

Replaceable adapters for:

- SEO/AEO analysis.
- CRO and UX critique.
- Code-generation models.
- Brand/policy rules.
- Site knowledge and prior decisions.
- Analytics interpretation.
- Compliance checks.

## Compute layer

Replaceable adapters for:

- Repository worktree or sandbox.
- Browser testing.
- Screenshot generation.
- Build/test runtime.
- Deployment preview.

## Improvement state machine

```text
DISCOVERED
 -> EVIDENCE_GATHERING
 -> PROPOSED
 -> SIMULATED
 -> APPROVAL_REQUIRED | READY
 -> IMPLEMENTING
 -> TESTING
 -> PREVIEWED
 -> DEPLOYED_CANARY
 -> OBSERVING
 -> ACCEPTED | ROLLED_BACK | FAILED
```

## One improvement record must contain

- Weakness and evidence.
- Proposed intervention.
- Expected impact and uncertainty.
- Files/components touched.
- Generated copy/code/assets.
- SEO/AEO/CRO/compliance analysis.
- Tests and gate results.
- Deployment and rollback IDs.
- Post-change outcome window.
- Reviewer conclusion.

## Safety and truthfulness

Do not invent traffic, rankings, customer data, revenue, reviews, licensing, availability, deployment status, or compliance approval. A model may propose a change, but the execution layer must gate, trace, test, and record the real outcome.
