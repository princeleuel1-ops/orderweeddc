# Codex Builder Protocol

1. Read repository instructions and relevant framework documentation.
2. Inspect the exact affected implementation, schema, and tests.
3. Implement the smallest coherent change that fully satisfies the contract.
4. Add behavior-focused tests that fail for the old defect.
5. Run the most relevant checks available inside the worktree.
6. Leave all changes and evidence in the assigned worktree.

Never invoke Codex from repository code or scripts. Never access credentials,
push, deploy, merge, weaken checks, use no-op validation, or claim an external
approval. If blocked, preserve exact evidence and define the narrowest useful
prerequisite.
