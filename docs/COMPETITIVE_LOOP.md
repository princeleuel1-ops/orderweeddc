# The Competitive Loop — UI + Marketing Together

One repeatable loop that studies every competitor and forces this product to
beat them on both lanes at once. First executed 2026-07-22 against Leafly,
Weedmaps, Dutchie, and Jane (captures + dossier archived in the project
workspace; refresh them each cycle).

## Cadence

Run the full loop monthly, or after any major release. Each cycle produces
receipts, so improvement claims stay falsifiable (Compounding Rule in
`docs/FRONTIER_BENCHMARK.md` applies).

## Lane 1 — UI

1. **Capture competitors** (browser, manual or agent-driven): Leafly and
   Weedmaps home / DC listing / dispensary detail / strain page; one
   Dutchie-powered menu; one Jane surface. Save PNGs side by side.
2. **Capture ourselves**: `node apps/web/scripts/competitive-loop.mjs`
   (server running). Produces `loop-shots/` + a capture receipt.
3. **Score both sets** against the rubric below, per page, 1–5 per axis.
4. **Fix the two weakest axes**, rebuild, re-capture, re-score. Repeat until
   every page scores ≥ 4 on every axis or three rounds complete.

### UI rubric (score each axis 1–5)

| Axis | 5 looks like |
| --- | --- |
| Hierarchy | One obvious primary action per screen; headline → search → results reads in order |
| Imagery | Every card and hero carries purposeful imagery; zero dead gray boxes |
| Card completeness | Name, type, status, hours, deals, trust label all visible without clicking |
| Density | ≥2.5 result cards per desktop viewport without feeling cramped |
| Trust surface | Evidence labels, sources, and sponsorship labeling visible and legible |
| Speed feel | LCP under ~2s local; no layout shift; assets < 500KB per page |
| Mobile | Nav, search, and cards fully usable at 390px; tap targets ≥ 40px |

### Standing advantages to preserve (from cycle 1)

- Organic-first ordering; sponsorship labeled, never re-ranked (Leafly and
  Weedmaps both lead with sponsored results — do not copy).
- One age gate only; never repeat mid-funnel.
- DC-law clarity near the top of the listing page.
- Neighborhood-native browsing (no national competitor has it).
- Lean pages: no ad scripts, self-hosted fonts, illustrative art system.

## Lane 2 — Marketing

1. **Recon competitors** (curl/Exa, no browser needed): robots.txt, sitemap
   scale by URL pattern, page-level JSON-LD types, content cadence, capture
   hooks, llms.txt. Method + first-cycle findings:
   `competitors/marketing-dossier.md` (workspace archive).
2. **Score ourselves**: `node apps/web/scripts/sitemind-audit.mjs
   --min-score=60`. The receipt includes competitor-parity checks pinned to
   `COMPETITOR_PARITY_CONTRACT` in `apps/web/src/lib/sitemind.mjs` (frozen
   observed facts, dated).
3. **Close the highest-severity gaps** from the gap map, then re-run.
4. **Refresh the contract** each cycle: re-observe competitor facts, update
   the frozen contract with a new `observedAt`, and note deltas (are they
   gaining or losing surfaces?).

### First-cycle facts worth remembering (observed 2026-07-22)

- Leafly: ~19,209 strain pages (Product + aggregateRating schema), 36,677
  dispensary pages, 8,800+ articles — but **no llms.txt** and no
  neighborhood-level DC pages.
- Weedmaps: 17 DC neighborhood pages, active llm.txt (79 lines), 5,414 deal
  pages.
- Nobody emits verification provenance in structured data. We do
  (`additionalProperty`: verificationSource / verifiedDate / licenseNumber).
- Their shared weaknesses: sponsored-first listings, repeated age gates,
  buried DC-law guidance, heavy pages, zero neighborhood identity.

## Honesty rules for the loop

- Never fabricate ratings, reviews, or amenities to match competitors —
  `tests/data-status.test.mjs` enforces forbidden claims and will fail the
  build.
- JSON-LD parity never overrides the evidence boundary: unverified records
  stay out of machine-readable feeds even if competitors publish everything.
- Every loop cycle ends with the full release gates: `npm test`,
  `npm run benchmark:discovery -w apps/web`, `npm run test:http -w apps/web`,
  lint, typecheck, build.
