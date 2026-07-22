# orderweeddc Frontier Benchmark

Observed: 2026-07-17

This is a capability benchmark, not a claim that orderweeddc has already
matched or beaten the named products. Vendor performance figures are
vendor-reported and are benchmark hypotheses until independently reproduced.

| Capability frontier | Current official evidence | orderweeddc advantage to preserve | Measurable gap |
| --- | --- | --- | --- |
| Broad discovery and education | Leafly exposes product, strain, retailer, effect, price, deal, location, rating, pickup, and delivery discovery plus a large education corpus. Source: https://www.leafly.com/ and https://www.leafly.com/shop | Evidence status, provenance, freshness, non-sponsored default ordering, and explicit uncertainty | Measure discovery task completion and result usefulness without weakening truth labels |
| Personalized commerce | Dutchie describes real-time recommendations, buy-again, social sign-on, cart recovery, live POS/menu sync, merchandising, analytics, and integrated checkout. Source: https://dutchie.com/business/ecommerce | Do not infer medical suitability or hide why an item appears | Establish consented explainable ranking and task-success baselines before personalization |
| Standardized catalog and search | Jane describes a standardized catalog, intelligent search, personalization, multi-store navigation, SEO, and an open integration ecosystem. Source: https://www.iheartjane.com/business/ecommerce | Public evidence boundaries and tenant isolation | Measure catalog coverage, entity resolution, search relevance, and stale-data rejection |
| Delivery operations | Weedmaps describes pickup/delivery fulfillment, driver tooling, routing, inventory ledger, order history, notifications, and analytics. Dutchie describes synchronized inventory, orders, drivers, routes, ETAs, manifests, and audit logs. Sources: https://weedmaps.com/business/orders/ and https://dutchie.com/business/delivery | Avoid presenting unverified delivery availability or location precision | Build only after legal authority, operator responsibility, privacy, and authoritative inventory inputs are explicit |
| Deals and retention | Weedmaps exposes online/in-store deals; Dutchie and Jane describe promotion, loyalty, recommendation, and recovery systems. Sources: https://weedmaps.com/deals, https://dutchie.com/business/ecommerce, and https://www.iheartjane.com/business/ecommerce | Demonstration and stale deals remain visibly distinct from verified current offers | Measure truthful deal coverage, freshness, redemption handoff, and merchant update latency |

## Current SOTA gap

The product has unusually strong truth and provenance foundations, but the
control loop lacks a stable numerical product benchmark. That allows
implementation activity to be mistaken for compounded user value.

## Compounding rule

Every future high-impact selection must bind:

1. current comparison evidence;
2. one baseline and strictly better target outcome;
3. at least one non-regressing guardrail;
4. a falsification test;
5. a promotion rule;
6. the next harder frontier.

No model opinion, elapsed time, token count, file count, or candidate count is
a verified gain.

## Frozen product-discovery task benchmark

The first executable baseline is
`apps/web/benchmarks/discovery-tasks.json`: exactly 12 human-readable task
scenarios over synthetic, benchmark-only organizations, tenants, retailers,
products, and menu entries. The tasks cover text, category, strain type,
service type, verified-current, demonstration-only, reported stock, price
band, price ordering, recently updated ordering, stale-data rejection, and
tenant isolation.

Run it from the repository root:

```powershell
npm run benchmark:discovery -w apps/web
```

The runner copies the Prisma schema into an operating-system temporary
directory, gives its generated Prisma client an output path inside that
directory, creates the SQLite database and receipt there, invokes the
application's `productDiscoveryWhere` and `productDiscoveryOrderBy` functions
in a real Prisma query, emits one JSON receipt to standard output, and removes
all temporary state. This prevents the generated client from discovering the
application's local `.env` file. The sanitized worker and cleanup watchdog
receive an allowlisted environment with zero credential-named variables. The
application benchmark process blocks and counts non-loopback requests; its
local Git and Prisma setup children receive the same credential-free
environment with telemetry disabled. The receipt binds the exact Git revision
and normalized-text SHA-256 corpus hash to scenario-level expected and observed
record identifiers, truth-boundary outcomes, timing, measured safety counters,
and aggregate status. Normalizing CRLF to LF makes the semantic hash stable
across Windows checkout settings.

The falsification modes are:

```powershell
node apps/web/scripts/benchmark-product-discovery.mjs --mutation=sponsored-first
node apps/web/scripts/benchmark-product-discovery.mjs --mutation=stale-evidence
node apps/web/scripts/benchmark-product-discovery.mjs --mutation=cross-tenant
```

Each controlled mutation must exit nonzero. Two clean runs at one revision and
corpus hash must have identical semantic receipts after removing only timing
fields. To roll back this benchmark, revert only its allowed fixture, runner,
test, package-script, and documentation changes; it has no production schema,
route, ranking, authentication, authorization, or persistent-data effect.

These synthetic task outcomes are local regression evidence. They are not
measurements of real-user conversion, revenue, medical suitability, legal
approval, accessibility certification, public deployment, or competitor
superiority. The corpus’s single brittle point is that maintainer-authored
tasks may not represent user intent; an independently authored held-out corpus
is the next prerequisite before any broader product-performance claim.
