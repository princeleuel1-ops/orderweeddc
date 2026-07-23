# Sentinel Memory — living operating log

Append-only context for the OWD Competitive Sentinel: findings, schema
changes, merchant status changes, improvements (baseline → target → outcome),
tier calibrations, and mode switches. Newest entries at top.

## 2026-07-23 — Genesis entry
- System state at handoff: feature/world-class-upgrade branch, PR #1 open.
  SiteMind 57/D on demo data (correct); parity checks passing (12
  neighborhoods, 4 strain guides, 13 legal FAQs). All release gates green
  (184/185 unit incl. paid-governance 12/12; benchmark 12/12; 7/7 HTTP
  checks; lab suite verified).
- Baselines: docs/competitive/* (observed 2026-07-22/23), docs/research/*,
  docs/recovery-2026-07-23/*.
- Launch blockers held by founder: hosting/DB/domain provisioning; merge of
  PR #1. Real-data pipeline ready: apps/web/scripts/seed-abca-retailers.mjs.
- Standing targets: 74 licensed retailers (Segment A ≈22 no/weak sites);
  first Featured pilot per docs/recovery-2026-07-23/featured-tier-pilot-spec.md.

## 2026-07-23 — Production incident: Turbopack hashed externals (RULES OWD-D1..D8)

Production reached HEALTHY (200, brandCount 1, totalRetailers 74) only after
four failed attempts. Root cause: Turbopack standalone externalized
`@prisma/client-<hex>` unresolvable in the artifact; a repo-contaminated smoke
test masked it. Full postmortem: docs/postmortems/2026-07-23-namecheap-next16-prisma-artifact-incident.md.

Durable rules (cited by ID in future cycles):
- **OWD-D1** Never use the owner's production server as the first place to
  discover package incompleteness — the isolated artifact test runs first.
- **OWD-D2** Never call a source-tree smoke test an artifact test. The release
  candidate is the exact final archive bytes; approval binds to its SHA-256.
- **OWD-D3** Never treat a hypothesis as proof. Label PROVEN/LIKELY/HYPOTHESIS;
  record disproven changes as disproven.
- **OWD-D4** Never modify a healthy production database to solve an application
  error. Read-only db-inspect exonerates or convicts the DB first; bootstrap/
  seed are first-deploy-only; DB hash is compared across every code swap.
- **OWD-D5** Never report PR/branch state without querying GitHub live. A
  merged PR is never "updated" — later fixes get a new branch and new PR.
- **OWD-D6** Never publish owner commands not executed against the exact
  artifact layout (command-path consistency test enforces).
- **OWD-D7** High-impact deployment changes require adversarial review and
  exact-candidate approval; any post-approval edit voids approvals.
- **OWD-D8** The owner receives one precise action at a time, only after
  automation exhausted safe diagnostics. Diagnose in layer order:
  command → DNS → TLS/edge → vhost/Passenger → startup → artifact → engine → DB.

Verified production state to preserve: app root ~/apps/orderweeddc/current;
DB ~/orderweeddc-data/prod.db (outside releases, hash-guarded); artifact
orderweeddc-c1e8ac7.tar.gz sha 0764fa6f…; bundler webpack; verifiedRetailers 0
is EXPECTED (awaiting verification is honest labeling, not a defect).
