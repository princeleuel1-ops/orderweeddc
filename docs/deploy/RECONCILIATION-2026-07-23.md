# State reconciliation — 2026-07-23

## Snapshot
- Local branch at start: feature/world-class-upgrade @ 900eb1c (clean tree)
- origin/main: dc0e419 (PR #1 merge; launch-sprint tip 323eb76 confirmed on main)
- Backups: backup/pre-deploy-2026-07-23 branch; git bundles
  orderweeddc-backup-2026-07-23.bundle and orderweeddc-deploy-2026-07-23.bundle (all refs)
- Deploy branch: deploy/namecheap-production @ f6ccdde (from origin/main + ad-creative cherry-pick 0bc6dfd)

## Evidence table
| Item | Local | origin/main | Class |
|---|---|---|---|
| packages/ad-creative/* (provider-contract, gemini, brand-profile, creative-brief, verification, pipeline, tests, README, package.json) | Y | N | Local-only -> RECOVERED on deploy branch |
| docs/competitive/ad-creative-research.md | Y | N | Local-only -> RECOVERED |
| durable-agent-architecture (docs/skills/) | Y | Y | Present both |
| paid-governance (packages/) | Y | Y | Present both |
| SiteMind (lib/sitemind.mjs, scripts/sitemind-audit.mjs) | Y | Y | Present both |
| sentinel-memory.md, competitive intel (marketing-dossier, dc-merchant-universe, sentinel-agent-spec) | Y | Y | Present both |
| brand assets (brand-assets.b64.json + restore-brand-assets.mjs) | Y | Y | Present both; binaries intentionally untracked, restored from b64 (18/18 byte-verified) |
| seed-abca-retailers.mjs, pricing page, recovery-2026-07-23 | Y | Y | Present both |
| agent/governor specs | Y (agent config drafts) | n/a | Config lives in agent platform, not repo |

Claimed-but-not-found: none. Everything reported in prior sessions was located
either on main or in the local workspace; the only gap was ad-creative (branch
deleted post-merge), now recovered with tests.

## Push status
GitHub MCP tool detached mid-session (transient; reconnects next session).
Pre-staged: /tmp/create-branch.json, /tmp/push-deploy.json (28 files).
Next session: create_branch then push_files, then open PR #2.
