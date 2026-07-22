# Release Standard

A bounded mission may integrate locally only when:

- the contract is measurable and evidence-backed;
- the author targeted check passes;
- both independent critic receipts pass;
- configured deterministic checks pass;
- Lane 5 explicitly accepts;
- the primary tree is clean;
- changed-file overlap is absent or reconciled;
- a rollback reference is recorded.
- the bound numeric outcome beats its baseline;
- every bound guardrail is non-regressing;
- the falsification test, promotion rule, and next frontier are recorded.

After integration, regression verification must pass against the actual
integrated branch. Failure triggers a local revert or a reopened repair mission.

The product is release-ready only when the quality constitution is supported by
reproducible evidence:

- no unresolved critical security or high authorization defects;
- no demonstration data presented as verified;
- no unsupported public claim;
- all required tests, lint, TypeScript, build, HTTP, browser, database, auth,
  truth, governor, recovery, and secret scans pass;
- merchant and administrator mutations are protected, validated, transactional,
  and duplicate-safe;
- provenance, freshness, accessibility, performance, metadata, indexing,
  deployment, rollback, and operations are complete;
- qualified human legal/business reviews are explicitly recorded where required.

Mission acceptance is never public-deployment authorization. Public deployment,
payment, legal determinations, force push, irreversible deletion, and material
business-model decisions remain human-only.
