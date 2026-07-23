# Search-Ranking Footprint: leafly.com / weedmaps.com / dutchie.com / iheartjane.com
### Prepared for a Washington D.C. cannabis directory startup
Date compiled: 2026-07-22
Method: Wayback Machine CDX API (curl, Chrome UA) + direct live curl verification. See "Methodology & limitations" for what could NOT be obtained (DuckDuckGo, Exa) and why.

---

## 0. Methodology & limitations (read this first)

- **Lane A (historical)** used the Internet Archive CDX API (`web.archive.org/cdx/search/cdx`) with `collapse=urlkey`, `filter=statuscode:200`, and capped `limit` values. The Internet Archive's crawl coverage is **not** a direct proxy for Google's index or ranking positions — it reflects what IA's crawlers (and user-submitted "Save Page Now" requests) captured. Treat all "unique URL" counts as **floors**, not true totals, especially where a query hit the request cap (noted inline as "capped").
- Many counts hit a `limit=20000` request cap on 2019+ eras for all four domains — the real inventories are almost certainly larger. Where marked "(capped)" the true number is ≥ the figure shown.
- **Lane B (current visibility) could not be completed as specified.** Both required live-engine methods failed in this environment:
  - **DuckDuckGo HTML/lite endpoints** (`html.duckduckgo.com/html/`, `lite.duckduckgo.com/lite/`, GET and POST, multiple header/cookie combinations) consistently returned a JS "anomaly detection" bot-challenge page with zero result markup, across ~5 distinct attempts. Confirmed not a general connectivity issue (archive.org and google.com both returned normal 200s in the same session).
  - **Exa (`mcp__t__ExaSearch` / `ExaContents` / `ExaAnswer`)** was not available in this session — all three tool calls returned "No such tool available." This is a tool-provisioning gap, not a data-quality decision; it should be raised with whoever configures this agent's MCP toolset if live Exa-based SERP visibility is needed.
  - Bing HTML scraping was attempted as a fallback and also returned no extractable organic-result markup (JS-rendered shell only).
  - Per task instructions, Google scraping was intentionally not used.
- **What Lane B contains instead:** a defensible, honestly-labeled substitute built from (a) direct `curl` liveness/content checks on the competitor pages and known DC-local sites that would plausibly rank, (b) Wayback-archived-depth as a *content-investment* proxy (NOT a ranking-position proxy — clearly labeled), and (c) documented structural facts about each domain's DC-specific URL inventory. This is **weaker evidence than actual SERP scraping** and should be treated as directional, not authoritative. I recommend the orchestrator re-run Lane B with working Exa access before finalizing any DC go-to-market SEO strategy.

---

## 1. Per-domain historical footprint

### leafly.com
- **First archived:** 2001-10-13 (`www.leafly.com`) — but this is almost certainly a **squatted/parked domain**, since the Leafly cannabis company was founded in 2010 and launched publicly in 2011. First *cannabis-relevant* content appears by 2011-2012 (7,288 unique URLs archived that year already — a fast start).
- **Growth curve (unique URLs archived, `collapse=urlkey`, `statuscode:200`):**
  - 2011-2012: **7,288**
  - 2015-2016: **≥20,001 (capped)**
  - 2019-2020: **≥20,001 (capped)**
  - 2023-2024: **≥20,001 (capped)**
  - 2025-2026: **≥20,001 (capped)**
  - One line: *Leafly hit massive scale by 2015-16 and has stayed capped-large ever since — by far the deepest and oldest content moat of the four, dominated by its strains database (20,000+ archived strain-related URLs alone in 2024-26) and a 900+ page-deep news/blog archive (`/news/all/page/2` through at least `/news/all/page/931` observed).*
- **Pattern-era analysis:**
  - **2014-2016 era:** Dominant patterns were `/news/tags/*` (topic tag pages, 78 of 200 sampled), `/news/headlines/*`, `/news/medical/*`, `/news/products/*`, `/knowledge-center/*`, `/company/*`, and a `/dispensary-info/*` prefix that in that era held actual dispensary detail pages. Also present: `/api/strains` and `/api2/search` (early API surface), `/doctors`, `/finder`, `/explore`.
  - **2024-2026 era:** `/dispensaries/{state}/{city}` (directory/city listing — confirmed live, `washington-dc` variant returns HTTP 200 today), `/strains/{slug}`, `/strains/{slug}/photos`, `/strains/{slug}/reviews`, `/strains/{slug}/reviews/write-review` (deep strain sub-page architecture), `/news/all/page/{n}` (blog pagination), `/news/author/{slug}` (author archive pages — dozens observed).
  - **"Used to rank, now gone/repurposed" finding:** `/dispensary-info/*` — a real content-page prefix in 2012-2016 — is **now purely an image-CDN path** (every 2023-2026 URL under `/dispensary-info/` is a `.jpg`/photo asset with `imgix` compression params, no HTML pages). Leafly retired this as a content URL and consolidated dispensary detail pages under `/dispensaries/{state}/{city}/{slug}` instead. `/dispensary-reviews/*` (mentioned as a hypothesis in the brief) never existed as a real content prefix on leafly.com in the archive — that specific pattern-guess was not correct for this domain, but the `/dispensary-info/` finding serves the same purpose.
  - Site is a Next.js app; much of the 2024-26 Wayback sample for leafly.com is dominated by client-side API calls (`/api/split`, `/api/badge`, `/_next/data/*.json`) rather than rendered HTML, indicating heavy client-side rendering — a potential crawlability consideration.

### weedmaps.com
- **First archived:** 2008-08-17 (matches the company's real founding year, 2008 — clean signal, no squatted-domain issue).
- **Growth curve:**
  - 2011-2012: **22**
  - 2015-2016: **10,497**
  - 2019-2020: **≥20,001 (capped)**
  - 2023-2024: **≥20,001 (capped)**
  - 2025-2026: **≥20,001 (capped)**
  - One line: *Weedmaps started slow (22 URLs in 2011-12 — mostly a map tool, not content-heavy yet), scaled hard 2015-2020 as it built out state/city/dispensary/doctor listing pages, and its current 2024-26 footprint is dominated by an aggressive brand-page program (`/brands/{brand-slug}` — hundreds of distinct brand pages observed, more than any other single pattern in the sample).*
- **Pattern-era analysis:**
  - DC URL pattern migrated at least **3 times**: `dispensaries/district-of-columbia/washington-dc/{slug}` (2014, deep nested) → `dispensaries/in/united-states/district-of-columbia/washington-dc` (2015) → `dispensaries/in/united-states/washington-dc` (2018-2021) → `dispensaries/in/washington-dc` (2018, 2020 — shorter canonical). A June 2024 snapshot shows `weedmaps.com/dispensaries/in/united-states/washington-dc` now returning a **301 redirect**, confirming further consolidation toward a shorter canonical path.
  - `/doctors/in/...` (medical-marijuana doctor locator, DC-relevant given DC's evolving medical program) peaked in 2018-2020 (**4,493** archived) then **declined** to 2,863 (2022-24) and just **1,008** in 2025-26 — a shrinking page-type, likely as most legal states moved past doctor-recommendation gating. This is a **declining incumbent page-type**, and DC still has med-card nuance, so a fresh/well-maintained "DC medical card" resource is a plausible gap (see Section 3).
  - `/brands/{slug}` barely existed in 2014-2016 (1 URL) but exploded to 3,132 (2018-2020) and 5,001+ (2022-2024, capped) — brand pages are now Weedmaps' single largest current content category.
  - Also observed a full parallel `/deliveries/in/...`, `/listings/in/...` set of DC path variants — Weedmaps runs several distinct verticals (dispensaries, deliveries, doctors, generic listings) at the same city-slug level.
  - **Live-verification caveat:** weedmaps.com returns HTTP 406 to this environment's `curl` on every page tested (bot/WAF blocking at the edge), so current-day freshness had to be inferred from Wayback's most recent crawl timestamps rather than direct fetch.

### dutchie.com
- **First archived:** 1999-10-12 — but this is confirmed to be a **completely unrelated legacy personal/community website** ("dutchienet" chat pages, "dutchieHomePage.jpg", "clubhouse.jpg" from ~1999-2004). The cannabis-ordering company Dutchie was **not** on this domain until much later.
- **Cannabis-platform launch (confirmed via CDX signature):** the domain shows no cannabis-relevant content through 2015 (only 1-3 URLs archived in 2011-12 and 2015-16 combined). By 2016-2018, snapshots show Meteor.js build artifacts (`app.js?hash=...`, `main.scss.css?hash=...`, "meteor_js_resource=true") — this is when Dutchie relaunched as the current cannabis ordering/menu platform.
- **Growth curve:**
  - 2011-2012: **1**
  - 2015-2016: **3**
  - 2019-2020: **4,054**
  - 2023-2024: **≥20,001 (capped)**
  - 2025-2026: **≥20,001 (capped)**
  - One line: *Dutchie has essentially zero footprint before 2016 (confirming it as the youngest of the four as a real cannabis platform), then scales from ~4K (2019-20) to capped-large by 2023 — the fastest relative growth rate of the four, though starting from the smallest base.*
- **Pattern-era analysis:**
  - **2020-2021 pattern:** `/dispensaries/{retailer-slug}/menu` — flat, single-level retailer-menu pages (1,000s observed).
  - **2023-2026 pattern:** migrated to `/stores/{retailer-slug}` and, notably, `/stores/{retailer-slug}/brands/{brand-slug}` and `/stores/{retailer-slug}/products/{category}` and `/stores/{retailer-slug}/info` — a much deeper per-retailer architecture (menu + brands + product-category + info as separate crawlable pages per store).
  - **"Used to rank, now dead" finding:** `dutchie.com/city/{city-slug}` (e.g., `/city/washington-dc`) was a real, populous pattern — **1,070** archived URLs in 2019-2021, **1,279** in 2022-2023 — then collapsed to **1** in 2024-2026. A live fetch of `dutchie.com/city/washington-dc` today returns **HTTP 308** (permanent redirect), confirming Dutchie killed its city-directory page type entirely and consolidated on `/stores/*` + `/embedded-menu/*` (their white-label menu widget, embedded on individual retailer websites — a distinctive Dutchie SEO/traffic model that doesn't rely on Dutchie.com itself ranking, but on retailer sites embedding Dutchie's widget).
  - Dutchie.com is largely an **app-shell SPA**: even in its "real content" eras, most Wayback-captured rows are JS/CSS bundle assets rather than HTML; a 3,000-row 2024-2026 sample yielded only 10 non-asset, non-`_next` HTML rows. Dutchie's actual DC-consumer-facing SEO surface is thin; most of its keyword-relevant content is on the separate `business.dutchie.com` subdomain (B2B blog/state-law pages, e.g., `business.dutchie.com/state-laws/washington-dc`), which targets dispensary *owners*, not DC consumers.

### iheartjane.com
- **First archived:** 2011-04-09 — an early parked/placeholder registration. The company Jane Technologies, Inc. was founded in 2017; real platform content doesn't appear until 2018-2019.
- **Growth curve:**
  - 2011-2012: **2**
  - 2015-2016: **3**
  - 2019-2020: **16,405**
  - 2023-2024: **≥20,001 (capped)**
  - 2025-2026: **≥20,001 (capped)**
  - One line: *iheartjane.com shows the same "dormant-domain-until-launch" pattern as Dutchie — near-zero before 2017, then an extremely fast ramp to 16,405 archived URLs by 2019-2020 (faster initial ramp than Dutchie), reaching capped-large by 2023.*
- **Pattern-era analysis:**
  - **2017-2019 sample:** almost entirely `/api/v1/*` calls (store data, specials, whoami) plus a handful of real pages (`/about`) — confirms Jane also launched as an app-shell SPA from day one, not a content-first SEO play.
  - **2024-2026 pattern:** `/dispensaries/united-states/{state}/{city}` is the live current directory pattern (confirmed via direct examples for Washington-state cities like Bellingham and Kirkland), plus `/stores/{id}` and `/embed/stores/{id}/menu` (an embeddable widget model similar to Dutchie's). `/stores` prefix inventory grew from 35 (2017-19) → 776 (2020-22) → 4,321 (2023-26), a steady, real content-page ramp.
  - **DC-specific gap finding:** searching specifically for `iheartjane.com/dispensaries/united-states/washington-dc*` or `.../dc*` in the Wayback archive returned **zero results** — meaning Jane's DC city-directory page, if it exists, has **never been crawled/archived by the Internet Archive**, unlike its Washington-*state* city pages which are well represented. A live guess-URL fetch (`/dispensaries/united-states/washington-dc/washington`) does return HTTP 200, so the page likely exists, but its complete absence from IA's crawl history suggests it gets little external linking/crawl priority — a plausible weak point relative to Leafly and Weedmaps, both of which have IA-visible DC dispensary/listing pages going back to at least 2014-2018.
  - Also uses bot-trap-like honeypot paths (base64-hash URL segments observed in the 2024-26 sample) and heavy `/api/v1` traffic capture — the domain's real HTML-content footprint is smaller than its raw URL count suggests once API noise is filtered out.

---

## 2. Current DC visibility table

**IMPORTANT CAVEAT:** Neither of the two engines specified in the task (DuckDuckGo HTML scraping, Exa neural search) could be executed successfully in this session — see Section 0. The table below is therefore built from **direct page-existence/liveness checks and Wayback-archived-depth as a content-investment proxy**, not from actual search-engine result positions. Do not use these numbers as literal SERP rankings; use them only as "does this domain plausibly compete for this query, and how deep is their DC-specific content" signal.

| Query | leafly | weedmaps | dutchie | jane | Other likely players (not rank-verified) |
|---|---|---|---|---|---|
| dispensary washington dc | DC directory page exists, live (200), IA-archived since 2023 | DC directory exists, multiple historical URL patterns, IA-archived since 2014; live curl blocked (406, WAF) | `/city/washington-dc` **dead** (308 redirect); no current consumer-facing DC directory page found | DC-specific directory page never IA-archived; live guess-URL returns 200 but likely thin/unlinked | Weedmaps/Leafly likely strongest given multi-year DC-specific page history; gentlemantoker.com, washingtoncitypaper.com carry DC dispensary coverage editorially |
| weed delivery washington dc | `/dispensaries/washington-dc` page can filter by delivery (same URL family) | Separate `/deliveries/in/washington-dc` vertical exists, IA-archived 2015-2021 | No dedicated delivery vertical found | No dedicated delivery vertical found | DC's unique "gifting" model (pre-2022) and delivery-only shops post-2022 make this a **locally nuanced query** generic platforms may under-serve; dcmj.org/gentlemantoker.com type sites may cover the gifting-era nuance better |
| dc dispensaries open now | Directory pages support open-now filtering via `_next/data` API params (`filter=open_now` observed in Wayback for WA state, same platform pattern likely applies to DC) | Filter-based, not a separate URL pattern found | No open-now filter surface found | No open-now filter surface found | Real-time "open now" is inherently hard for static/cached content — likely a **gap for all four** in DC; Google Business Profile / Maps probably wins this query type, not directory sites |
| initiative 71 dc | General news/knowledge-center content likely exists (Leafly's news archive is 900+ pages deep and DC-legalization-adjacent topics are a natural fit) but no dedicated "Initiative 71" page found in samples | No dedicated Initiative 71 page found | No dedicated Initiative 71 page found (though `business.dutchie.com` DC state-law content touches legal nuance for B2B audience) | No dedicated Initiative 71 page found | **dcmj.org is a strong likely winner** — homepage explicitly built around "Initiative 71" messaging (10 on-page mentions confirmed); this is DC's single most locally-specific legal/cultural search term and none of the big four appear to have a dedicated evergreen page for it |
| weed deals dc | No DC-specific deals page found; Leafly has a general `/deals` feature at the platform level | Weedmaps has a long-running general "deals" feature across markets | No dedicated deals content found for DC | No dedicated deals content found for DC | Likely uncontested/thin at the DC-specific level across all four |
| is weed legal in dc | Likely covered generically in news/knowledge-center evergreen content, not DC-dedicated | Not identified | Not identified (again, `business.dutchie.com` state-law page is B2B-oriented, not consumer search-friendly) | Not identified | Government sites (dc.gov, ABCA - DC's Alcoholic Beverage and Cannabis Administration) and DCMJ/NORML-DC are the natural authoritative answers here; national legal-status aggregator sites (e.g., NORML.org, Wikipedia) plausibly outrank all four commercial platforms for this exact phrasing |
| blue dream strain | Leafly's `/strains/{slug}` architecture is the deepest strain-content system of the four (20,000+ archived strain URLs, with photos/reviews sub-pages) — very likely the strongest player here, though this is a **generic, not DC-local**, query | No dedicated strain-detail page architecture found comparable to Leafly's | No dedicated strain-detail page architecture found | No dedicated strain-detail page architecture found | This query has no DC-local intent at all — a nationally-dominant Leafly page is the expected incumbent; not a DC opportunity |
| best dispensary dc | No single "best-of" editorial page found on any of the four (these are directory/listing platforms, not "best-of" curators) | Same | Same | Same | **This is a clear "best-of" editorial-intent query that directory/menu platforms structurally don't serve well** — local media (Washington City Paper, DCist) or a purpose-built local guide is the natural winner; strong opportunity (see Section 3) |
| dc medical card | Weedmaps' `/doctors/*` vertical (declining: 4,493 → 2,863 → 1,008 archived pages across eras) is the closest match among the four, but is a *shrinking* page-type | Same as above | No medical-card content found | No medical-card content found | DC's medical program has specific local rules distinct from generic "medical card" content; likely served by DC government (dc.gov ABCA) or dcmj.org rather than any of the four |
| cannabis dc tourists | No tourist-specific content found on any of the four in the samples | Same | Same | Same | This is squarely local-editorial territory — travel sites, Reddit r/washingtondc, and local blogs (gentlemantoker.com covers DC specifically) are the plausible incumbents; the big four's generic city-directory pages don't address tourist-specific concerns (I-71 gifting model confusion, what's legal to carry, where visitors can consume) |

**Notable non-big-four DC players identified (via direct liveness checks, not ranking-verified):**
- **dcmj.org** — live, homepage built explicitly around Initiative 71 (10 mentions) — likely strong for legal/advocacy queries.
- **gentlemantoker.com** — live, has dispensary/DC content on homepage — plausible generalist DC cannabis blog competitor.
- **washingtoncitypaper.com** — live, has an indexed/searchable section returning results for "dispensary" queries — local alt-weekly with real editorial authority, a likely strong domain-authority competitor for "best of" and news-style queries.
- **dcist.com** — live, DC-focused news outlet, plausible source for policy/news-angle queries (e.g., Initiative 71, legal status).
- DC government (dc.gov / ABCA — the DC Alcoholic Beverage and Cannabis Administration) — not checked directly but the obvious authoritative source for "is weed legal in dc" and "dc medical card" style queries; commercial platforms rarely outrank .gov sources for legal-status questions.
- leafmapp.com was checked and found to be an inactive GoDaddy placeholder page, not a real competitor — excluded from the above.

---

## 3. Ranking gaps we can take — 8-12 concrete opportunities

1. **"Initiative 71" / gifting-model explainer content.** None of the four national platforms has a dedicated, evergreen page targeting this exact, extremely DC-specific legal term — it's DC's single most distinctive cannabis-search phrase and currently appears to be the territory of advocacy sites (dcmj.org) rather than commercial directories. A well-built "How DC's Initiative 71 gifting model works + what changed since 2022 licensing" page is a strong, low-competition anchor page.
2. **"Best dispensary in DC" editorial content.** All four incumbents are directory/menu platforms, not "best-of" curators — this query shape is structurally outside their content model. A genuinely locally-reported "best dispensaries in DC" guide (updated regularly, with real visits/reviews) fills a gap no incumbent's architecture addresses.
3. **DC medical-card guidance, refreshed.** Weedmaps' `/doctors/*` vertical is objectively shrinking (4,493 → 2,863 → 1,008 archived pages across the three most recent eras) — a declining incumbent asset. DC's medical program still has quirks (self-certification vs. recommendation, reciprocity) that a fresh, DC-specific medical-card resource can own while Weedmaps' equivalent content ages and is deprioritized.
4. **"Is weed legal in DC" / DC-specific legal-status explainer.** None of the four platforms appear to have a DC-dedicated legal-status page in the samples gathered; this query is likely won by government or advocacy sites today, leaving room for a startup with strong local authority signals (address, local citations, DC-specific detail on possession limits, public-consumption rules, home-grow allowances) to compete.
5. **"Weed delivery DC" as its own vertical, addressing the gifting-to-delivery transition.** Weedmaps has a `/deliveries/in/washington-dc` URL pattern but it's been through several path migrations (2015-2021) and its current live status wasn't verifiable (bot-blocked); Dutchie and Jane show no dedicated delivery vertical for any market in the samples. A DC-specific delivery directory addressing the "gifting era vs. licensed retail" confusion is a distinct, addressable gap.
6. **"Cannabis DC tourists" / visitor guide.** Zero tourist-specific content found across all four platforms' sampled inventories. DC has unique tourist-relevant nuances (can't legally sell recreational cannabis at retail the way other states do; consumption rules; what's safe to carry near federal property) that generic directory platforms don't address and that a DC-only startup is naturally positioned to own.
7. **"DC dispensaries open now" / real-time freshness.** All four platforms rely on filter parameters within larger directory pages rather than dedicated, freshness-optimized "open now" content — and Weedmaps' historical DC directory pages show multiple URL-pattern churns (redirect chains observed as recently as June 2024), which typically causes ranking volatility during migrations. A DC-only site with tight NAP (name/address/phone) consistency and live hours data could compete well here, especially against domains mid-migration.
8. **Post-Wayback-migration "orphaned" DC pages.** Dutchie's `/city/washington-dc` page (1,070+ archived URLs at peak, 2019-2023) is now dead (308 redirect) with no replacement consumer-facing DC directory found on dutchie.com — any inbound links or residual authority pointing at that dead URL are currently going nowhere. Similarly, Weedmaps' `dispensaries/in/united-states/washington-dc` 301-redirects as of mid-2024. These migrations often cause temporary ranking dips or lost long-tail equity that a well-optimized new DC page can capture during the transition window.
9. **iheartjane.com's DC directory page has never been crawled by the Internet Archive**, unlike its well-represented Washington-*state* city pages — suggesting very low external link equity/crawl priority for DC specifically on that platform, despite the page technically existing (HTTP 200 on direct fetch). This is one of the cleanest "incumbent is present but structurally weak" signals found in this research.
10. **Brand-page-style content, DC-localized.** Weedmaps' single largest current content category is `/brands/{slug}` pages (thousands, growing fast) — but these are generic/national brand pages, not DC-localized ("where to find [brand] in DC" style content). A DC directory that pairs local dispensary inventory with brand availability specifically in DC stores nobody else is doing at the local level.
11. **Strain content is a false gap — do not compete head-on.** Leafly's strain-page architecture (20,000+ archived URLs, deep photos/reviews sub-pages, dating back to 2011-2012) is an extremely deep, nationally-dominant moat with zero DC-local relevance anyway ("blue dream strain" has no DC intent). Recommend explicitly avoiding generic strain-content competition and redirecting that effort toward DC-local intent queries instead.
12. **Cross-check recommendation:** because Lane B's actual SERP-position data could not be gathered in this session (DDG blocked, Exa tool unavailable), before finalizing a content/SEO roadmap based on these gaps, re-run the Lane B visibility check with working Exa access (or a proxied/residential-IP search approach) to confirm actual current ranking positions for the 10 target queries and validate these structurally-derived gap hypotheses against real SERP data.

---

## Raw data files
Saved under `/agent/workspace/competitors/raw/` for reference:
- `{domain}_2014_2016.json`, `{domain}_2024_2026.json` / `_big.json` — sampled CDX URL lists used for pattern-era analysis
- `dutchiecom_2018_2019.json`, `iheartjanecom_2017_2019.json` — founding-era samples for the two younger platforms
- `weedmaps_dc_urls.json` — DC-specific URL pattern history for weedmaps.com
- `analyze_patterns.py` — reusable path-pattern-frequency script used for the pattern-era analysis
