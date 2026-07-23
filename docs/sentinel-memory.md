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
