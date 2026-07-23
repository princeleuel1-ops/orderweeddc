# Failure Drills and Acceptance Tests

Record commands, timestamps, trace IDs, results, and evidence for every drill.

| Drill | Expected behavior | Pass evidence |
|---|---|---|
| Kill worker mid-step | Lease expires; replacement resumes latest valid checkpoint | No repeated completed side effects |
| Duplicate trigger | Same idempotency key maps to one logical run | One committed outcome |
| Model timeout | Bounded retry or routed fallback | Run state remains consistent |
| Malformed model JSON | Validate, bounded repair, then safe failure/fallback | No unvalidated commit |
| Tool timeout after side effect | Reconcile before retry | No duplicate side effect |
| State-store interruption | Run pauses or retries safely | No corrupted checkpoint |
| Sandbox loss | New sandbox receives external checkpoint and artifacts | Work resumes |
| Browser crash | Browser session recreated behind adapter | Execution state preserved |
| Sub-agent branch fails | Failed branch retries or degrades explicitly | Fan-in remains inspectable |
| Human approval delay | Run remains durable in PAUSED/WAITING | Resume succeeds later |
| Budget exceeded | Terminal state EXHAUSTED | Precise budget reason logged |
| Model provider swap | Same workflow contract and acceptance tests pass | Minimal adapter-only changes |
| Compute provider swap | Same state and artifact contracts pass | No authoritative state migration |
| Historical replay | Dry-run reproduces decisions from saved inputs/version | Traceable differences explained |
