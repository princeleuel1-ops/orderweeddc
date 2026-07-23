# DC Cannabis Merchant Universe
**Generated:** 2026-07-23  
**Data vintage:** October 2025 (ABCA via DC Open Data / DC GIS ArcGIS REST API)  
**Sources:** DC GIS MapServer layer 31 (Licensed Medical Cannabis Retailer) + layer 33 (Non-Retailer Facilities)

---

## 1. Universe Summary

### Full Licensed Universe (95 total active entities)

| License Type | Count |
|---|---|
| **Retailer** | **74** |
| Cultivation Center (all tiers) | 9 |
| Manufacturer (Type 1 + 2) | 10 |
| Testing Laboratory | 1 |
| Courier | 1 |
| **Total** | **95** |

### Retailers by Ward

| Ward | Count | Key Neighborhoods |
|---|---|---|
| 1 | 15 | Columbia Heights, U St Corridor, Adams Morgan |
| 2 | 21 | Dupont, Logan Circle, Georgetown, Shaw, Downtown |
| 3 | 5 | Palisades, Cleveland Park, Chevy Chase |
| 4 | 11 | Petworth, Brightwood, Takoma, Georgia Ave NW |
| 5 | 6 | NoMa, Brookland, Eckington |
| 6 | 11 | H Street, Capitol Hill, Navy Yard |
| 7 | 1 | Deanwood |
| 8 | 4 | Anacostia, Congress Heights |
| **Total** | **74** | |

### Retailer Endorsements (non-exclusive)
- Delivery: 66 of 74 (89%)
- Education Tasting: 23 of 74
- Safe-Use: 10 of 74
- Summer Garden: 4 of 74

---

## 2. Platform Dependency Sample (n=20)

Sample selected from highest-profile and most prominent retailers first, with geographic spread.

| # | Retailer | Ward | Website | HTTP | Menu Tech | JSON-LD | Meta Desc | Viewport | Web Score | Weedmaps | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Takoma Wellness Center | 4 | takomawellness.com | 200 | **Dutchie** | Y | Y | Y | 3 | Y | DC's oldest; 68k mo. visits; Leafly also linked |
| 2 | District Cannabis | 5 | districtcannabis.com | 200 | **Dutchie** | Y | Y | Y | 3 | Y | Clean Dutchie embed |
| 3 | Firehouse DC | 1 | firehousedc.com | 200 | **Dutchie** | Y | Y | Y | 3 | Y | WP/Elementor + Dutchie |
| 4 | Doobie District | 2 | doobiedistrict.com | 200 | **Dutchie** | Y | Y | Y | 3 | ? | Heavy Dutchie |
| 5 | Anacostia Organics | 8 | anacostiaorganics.com | 200 | **Dutchie** | Y | Y | Y | 3 | ? | Ward 8 anchor |
| 6 | Medz | 6 | medzdc.com | 200 | **Dutchie** | Y | Y | Y | 3 | ? | Dutchie 5x |
| 7 | District Cure Dispensary | 1 | districtcuredispensary.com | 200 | **Dutchie** | Y | Y | Y | 3 | ? | Dutchie 22x — heavy embed |
| 8 | Embers DC | 2 | embersdc.com | 200 | **Custom/WooComm.** | Y | Y | Y | 3 | ? | Culture hub (gallery, records, glass) |
| 9 | Wishing Wellness DC | 2 | wishingwellnessdc.com | 200 | **Leafly** | Y | Y | Y | 3 | Y | 8k mo. visits, custom site + Leafly menu |
| 10 | Mr. Nice Guys DC | 2 | mrniceguysdc.com | 200 | **Custom** | Y | Y | Y | 3 | ? | Own online store; 2.5k mo. visits |
| 11 | Higher Ground DC | 5 | highergrounddc.com | 200 | **Custom (AI-built)** | Y | Y | Y | 3 | ? | Full JSON-LD, emergent-agent-style build |
| 12 | Green Theory | 3 | greentheorydc.com | 200 | **Custom** | Y | Y | Y | 3 | ? | 11k mo. visits, Palisades |
| 13 | Georgetown Wellness Dispensary | 2 | georgetownwellness.com | 200 | unknown | N | N | N | 1 | ? | URL mismatch suspected; 0 SEO signals |
| 14 | Miel Wellness | 6 | mielwellness.com | 200 | none detected | N | Y | Y | 2 | ? | Basic site, no ordering platform |
| 15 | WVC Wellness | 2 | wvcwellness.com | 200 | **Weedmaps** | N | N | Y | 1 | Y | Weak site; dependent on Weedmaps |
| 16 | National Holistic Healing Center | 2 | nhhcdc.org | 502 | — | — | — | — | 0 | ? | Site down; established operator |
| 17 | H3 | 2 | none found | — | — | — | — | — | 0 | ? | No working URL after 3 attempts |
| 18 | Bloom @ North | 4 | none found | — | — | — | — | — | 0 | ? | bloomnorthdc.com 502 |
| 19 | New Leaf Smoke Shop | 6 | none found | — | — | — | — | — | 0 | ? | All URL attempts failed |
| 20 | Luxury Soil | 6 | luxurysoil.com | 200 | none detected | Y | Y | Y | 2 | ? | Good SEO base; no menu platform |

**Key:** Score 0 = no site or broken; 1 = minimal; 2 = partial; 3 = full (JSON-LD + meta desc + viewport + menu)

### Menu Tech Breakdown (sampled 20)
| Platform | Count | % |
|---|---|---|
| Dutchie | 7 | 35% |
| Custom/own | 3 | 15% |
| Custom (AI-built) | 1 | 5% |
| Woocommerce | 1 | 5% |
| Leafly | 1 | 5% |
| Weedmaps | 1 | 5% |
| None detected / no site | 6 | 30% |

---

## 3. Web-Presence Quality Distribution (sampled 20)

| Score | Count | Description |
|---|---|---|
| 3 — Solid | 12 | JSON-LD + meta desc + viewport + live; all have a menu platform |
| 2 — Partial | 2 | Site live; missing JSON-LD or structured data |
| 1 — Minimal | 2 | Viewport only or URL mismatch; no structured data |
| 0 — None/Broken | 4 | No working website found |

**Projected across 74 retailers** (extrapolating sample ratio ~60% score 3, ~10% score 2, ~10% score 1, ~20% score 0):
- ~44 retailers with solid sites (most on Dutchie)
- ~15 retailers with partial/minimal sites
- ~15 retailers with no detectable web presence

---

## 4. Conversion Segments

### Segment A — No Site / Weak Site + Delivery Endorsement (~22 estimated retailers)
**Definition:** Web score 0-2 OR no site found, but licensed to deliver.  
**Confirmed examples:** H3 (Ward 2), Bloom @ North (Ward 4), New Leaf Smoke Shop (Ward 6), National Holistic Healing Center (Ward 2), WVC Wellness (Ward 2), Georgetown Wellness Dispensary (Ward 2), Miel Wellness (Ward 6)  
**Pitch angle:** "You're delivering cannabis across DC with no findable website — every customer who Googles you goes to Weedmaps or Leafly instead of your checkout. orderweeddc gives you a branded storefront, SEO-ready listings, and a menu in 48 hours."  
**Priority:** HIGHEST. These retailers are paying aggregator fees with nothing to show for it.

### Segment B — Strong Site + Dutchie / Leafly (~12 retailers confirmed + ~30 projected)
**Definition:** Web score 3, identified menu platform (Dutchie dominant at 35% of sample).  
**Confirmed examples:** Takoma Wellness, District Cannabis, Firehouse DC, Doobie District, Anacostia Organics, Medz, District Cure, Wishing Wellness  
**Pitch angle:** "You already have Dutchie for your menu — orderweeddc plugs into your Dutchie feed via our sync API so your orderweeddc storefront stays live without double data entry. You get a second discovery channel and DC-specific SEO without touching your existing setup."  
**Priority:** HIGH (revenue volume + menu-sync upsell is the wedge).

### Segment B-Self — Strong Custom Site, No Third-Party Menu (~4 confirmed + ~10 projected)
**Definition:** Web score 3, own online ordering (WooCommerce, custom), not on major aggregators.  
**Confirmed examples:** Embers DC, Mr. Nice Guys DC, Higher Ground DC, Green Theory  
**Pitch angle:** "Your site is solid — add orderweeddc as a branded DC discovery layer that drives SEO traffic you're not currently capturing. Menu sync keeps your inventory live automatically."  
**Priority:** MEDIUM-HIGH. Already tech-forward; receptive to SiteMind audit data as opener.

### Segment C — Unaudited + Delivery Endorsement (~46 retailers)
**Definition:** Not in sample; license shows Delivery endorsement.  
**Pitch angle:** "You're DC-licensed to deliver but invisible online. orderweeddc puts you in front of DC patients searching for delivery — no dev work required."  
**Priority:** MEDIUM. Large pool; lower-touch outbound (email/direct mail blast).

### Segment D — No Delivery Endorsement (~6 retailers)
**Definition:** No delivery endorsement; storefront-only or specialty.  
**Pitch angle:** "Build your retail presence online — orderweeddc SEO + menu for in-store discovery."  
**Priority:** LOWER.

---

## 5. Top 5 Highest-Need Named Targets

| Priority | Retailer | Ward | Why They're High-Need | Pitch Hook |
|---|---|---|---|---|
| 1 | **National Holistic Healing Center** | 2 | 502 error — established operator with dead website. Connecticut Ave NW = high-value real estate | "Your site is down. Today." |
| 2 | **H3 DC** | 2 | Zero web presence; 17th St NW address is prime Dupont foot traffic with nothing online | "Dupont Circle walk-bys have nowhere to go" |
| 3 | **Bloom @ North** | 4 | Two locations, neither with working site — Georgia Ave corridor underserved online | "Two stores, zero Google clicks" |
| 4 | **New Leaf Smoke Shop** (H St NE) | 6 | H Street NE is DC's fastest-gentrifying retail strip; no site means Yelp/Weedmaps owns their brand | "H Street customers can't find you" |
| 5 | **WVC Wellness** | 2 | Site up but score 1 (no JSON-LD, no meta desc); fully dependent on Weedmaps for discovery | "Weedmaps owns your customer relationship" |

---

## 6. Data Notes

- **Retailer count:** 74 active licensed retailers per DC GIS (Oct 2025). Expected range in task brief was 70-80 — actual is 74. Confirmed.
- **Non-retailer ABCA CSV (`real_abca_feed.csv`):** Contains 21 non-retailer records (cultivators, manufacturers, labs, courier) — cross-checks cleanly with GIS layer 33.
- **No dispensary/internet-retailer split in GIS data:** All 74 are labeled "Retailer" with endorsements (Delivery, Education Tasting, Safe-Use). DC's adult-use framework consolidates prior "medical dispensary" and "internet retailer" into a single "Retailer" license class.
- **Weedmaps DC page:** Returned HTML but retailer names were JS-rendered (not in static HTML). Weedmaps presence inferred from homepage signals or confirmed via endorsements for major operators.
- **Where's Weed DC page:** Loaded but retailer names not in static HTML (also JS-rendered). No names confirmed.
- **Sample website audit:** 20 of 74 audited (27%). URL guessing used; some retailers may have sites not found. Treat web_score=0 as "not confirmed found" rather than "definitely no site."
