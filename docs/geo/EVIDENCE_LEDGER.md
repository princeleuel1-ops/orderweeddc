# CANA Geo Kernel — Evidence Ledger

Slice 1a: PostgreSQL + PostGIS canonical datastore migration.
Date: 2026-08-08. Base commit: `487ece6`.

States: **VERIFIED** (observed directly) · **PARTIAL** · **INFERRED** ·
**PLANNED** (designed, not implemented) · **BLOCKED** (needs human action) ·
**UNKNOWN**.

No claim below is marked VERIFIED unless it was executed and its output
observed in this session.

---

## Current state assessment (before any change)

| # | Claim | Status | Evidence | Limitations |
|---|---|---|---|---|
| 1 | `orderweeddc` is the CANA monorepo; npm workspaces `apps/web` + 3 packages | VERIFIED | Cloned repo, read root `package.json` | — |
| 2 | Database was SQLite | VERIFIED | `schema.prisma` `provider = "sqlite"` | — |
| 3 | Map was Leaflet 1.9 + react-leaflet 5 + CARTO raster tiles | VERIFIED | `src/components/retailer-map.tsx`, `package.json` | Unchanged by this slice |
| 4 | Geography was two bare `Float` columns; no geometry/cells/service areas | VERIFIED | `Retailer` model, grep across `src` | — |
| 5 | No PostGIS, H3, routing, geocoding, or provider abstraction existed | VERIFIED | grep across `apps/web/src`, `packages` | — |
| 6 | 22 Prisma models; 37 `node:test` suites; real gate culture exists | VERIFIED | schema enumeration, `apps/web/tests` listing | — |
| 7 | Deploy target is Namecheap cPanel shared hosting | VERIFIED | `NAMECHEAP_CPANEL_DEPLOYMENT.md`, Prisma `binaryTargets` | — |
| 8 | Only 2 raw SQL call sites exist, both SQLite-specific, both in scripts | VERIFIED | grep for `$queryRaw`/`$executeRaw` | — |
| 9 | 17 `contains` filters existed with zero `mode: 'insensitive'` | VERIFIED | grep across `src`, `scripts` | Silent-breakage risk on PostgreSQL |

## PostGIS capability

| # | Claim | Status | Evidence | Limitations |
|---|---|---|---|---|
| 10 | PostgreSQL 17.8 provisioned and running | VERIFIED | `SELECT version()` | **Sandbox instance, not production** |
| 11 | PostGIS 3.5.6 enabled (GEOS 3.14.1, PROJ 9.8.1) | VERIFIED | `PostGIS_Full_Version()` | Same |
| 12 | `ST_Contains` polygon containment is correct | VERIFIED | DC quadrilateral test excluded Silver Spring, MD | — |
| 13 | `ST_Distance` geography is geodesically correct | VERIFIED | Dupont Circle → White House = 1460 m | Matches real-world ~1.4–1.5 km |
| 14 | `ST_DWithin` radius filtering is correct | VERIFIED | 3 km returned exactly Dupont + Georgetown | — |
| 15 | GiST spatial index is genuinely used, not bypassed | VERIFIED | `EXPLAIN` shows `Index Scan using geo_smoke_geom_gist` | Forced via `enable_seqscan=off` (4-row table) |
| 16 | `geo_kernel_postgis.sql` applies cleanly and is idempotent | VERIFIED | Applied twice, second run clean | — |
| 17 | Geo smoke test passes 14/14 assertions | VERIFIED | `geo_smoke_test.sql` output | — |
| 18 | The smoke test is not vacuous — it fails when PostGIS is absent | VERIFIED | Negative control on a clean DB: exit 3, `GEO SMOKE FAIL` | Strongest single piece of evidence here |
| 19 | lat/lng → geom trigger prevents silent divergence | VERIFIED | Assertions 4–5 of the smoke test | — |
| 20 | Coordinate constraints reject lat 91 and Null Island (0,0) | VERIFIED | Assertion 8 | — |
| 21 | Duplicate provider alias is rejected (entity resolution intact) | VERIFIED | Assertion 10 | — |
| 22 | New claims default to UNKNOWN and not decision-eligible | VERIFIED | Assertion 9 | Enforces "no fabricated certainty" at storage layer |

## Code changes

| # | Claim | Status | Evidence | Limitations |
|---|---|---|---|---|
| 23 | Prisma datasource switched to `postgresql` with `directUrl` + postgis extension | VERIFIED | `schema.prisma` diff | Not yet run through `prisma validate` (npm blocked) |
| 24 | Three geo models added (GeoEntity, GeoEntityAlias, GeoClaim) | VERIFIED | `schema.prisma` diff | Table DDL hand-verified; **`prisma migrate` not yet run** |
| 25 | Equivalent DDL creates successfully on real PostGIS | VERIFIED | Tables created and exercised in `cana_dev` | Hand-written mirror of expected Prisma output, not Prisma-generated |
| 26 | 12 user-facing `contains` filters given `mode: 'insensitive'` | VERIFIED | Diffs in 5 files | **Behaviour not yet test-executed** (npm blocked) |
| 27 | ID-matching `contains` deliberately left case-sensitive | VERIFIED | Reviewed each of the 5 remaining sites | Intentional |
| 28 | `db-inspect.mjs` and `test-public-submission.mjs` made engine-portable | VERIFIED | Diffs; `pg_tables` / `pg_indexes` branches | **Not yet executed** |
| 29 | Migration script refuses non-empty destination, verifies counts + invariants | PARTIAL | Code written and reviewed | **Never executed** — requires npm + a source .db |
| 30 | Geo backfill preserves provenance and marks legacy coords UNKNOWN | PARTIAL | Code written and reviewed | **Never executed** |

## Blocked

| # | Claim | Status | Evidence | Unblock |
|---|---|---|---|---|
| 31 | Managed PostgreSQL provisioned for production | BLOCKED | — | Human: create DB, supply `DATABASE_URL` + `DIRECT_URL` (see runbook §8) |
| 32 | 37 existing test suites pass on PostgreSQL | BLOCKED | — | Sandbox firewall denies `registry.npmjs.org`; `npm install` cannot run |
| 33 | `tsc --noEmit`, `lint`, `next build` pass | BLOCKED | — | Same |
| 34 | `prisma migrate` baseline generated | BLOCKED | — | Same |
| 35 | Provider cannabis-AUP written confirmation obtained | BLOCKED | ADR-0002 records the policy research | Human/legal action |

## Not built — designed only

| # | Item | Status | Note |
|---|---|---|---|
| 36 | MapLibre replacing Leaflet | PLANNED | Slice 2. Leaflet remains in place and working. |
| 37 | H3 aggregation | PLANNED | `GeoEntity.h3R9` column exists; **no H3 library, no indexing logic** |
| 38 | Routing, isochrones, Valhalla | PLANNED | Slice 3. No interface written yet. |
| 39 | GeoProvider registry/router, benchmark harness, promotion court | PLANNED | Slices 3 and 8. Not started. |
| 40 | GeoCell state, feature store, opportunity engine, simulation | PLANNED | Slices 5–7. Tables deliberately not invented ahead of use. |
| 41 | Living Company Graph geo edges | PLANNED | Slice 4. |

## Explicit non-claims

To keep the ledger honest, the following are **not** claimed:

- The application has **not** been booted against PostgreSQL.
- No existing test has been executed against PostgreSQL.
- No production data has been migrated.
- `h3R9` is a column, not a working H3 implementation.
- The map is still Leaflet; nothing user-facing changed in this slice.
- Provider claims in ADR-0002 are third-party documentation research, not
  independently reproduced benchmarks. No benchmark numbers were invented.
