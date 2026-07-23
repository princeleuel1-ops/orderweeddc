# Source Notes

The source talk argues that agent architectures decay because teams couple together components that change at very different rates.

Its central mental model is:

- **Execution**: flow, durable state, retries, scheduling, orchestration, coordination, and full-session observability.
- **Context**: models, prompts, tools, and memory; this changes fastest.
- **Compute**: sandboxes, browsers, runtimes, and machines; these are the agent's replaceable hands.

The talk emphasizes resumability, external durable state, flexible invocation patterns, whole-session traces, asynchronous/background agents, continuous loops, sub-agent delegation, and reviewers that evaluate execution history and real outcomes.

This skill expands those concepts into a provider-neutral engineering method, contracts, reliability drills, and a safe recursive-improvement loop. It intentionally does not make one vendor or framework the permanent architecture.
