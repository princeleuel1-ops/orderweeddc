# Weedmaps + Where's Weed field recon — 2026-07-23 (screenshots in thread)

Companion to leafly-field-recon-2026-07-23.md. All claims screenshot/fetch-backed.

## DOSSIER CORRECTIONS (honesty rule)
1. **Weedmaps DC delisting (Apr 2026) DID NOT happen.** 30 I-71 storefronts live
   on page 1 of /dispensaries/in/united-states/district-of-columbia/washington;
   28 DC slugs in dispensary.xml.gz (fresh 2026-07-23). What DID happen:
   legacy short-form DC URLs now 404, and ZERO DC deal URLs are indexed —
   partial demotion, not delisting. Page title literally says "Self-Certify at
   Legal Medical Dispensaries."
2. **Where's Weed has partial structured data.** The Vite SPA shell embeds one
   JSON-LD block per city (FAQPage + BreadcrumbList + top-10 ItemList of
   LocalBusiness with coords/aggregateRating). ssrPageLoaded:false confirmed;
   individual business pages remain crawler-invisible. 26,787 business URLs
   sitemapped; 70 unique DC pages (50 delivery / 18 dispensary).

## Weedmaps facts
- Bot wall: HTTP 406 on ALL /dispensaries|/deliveries|/deals paths for curl
  with ANY user-agent → core data invisible to AI/search fetchers.
- NOVEL: robots.txt carries non-standard `LLMTXT: https://weedmaps.com/llm.txt`
  (10.3KB, exists, covers Learn content + region links, no I-71 mention).
  They pioneered an llm.txt-style surface while 406-walling the actual data —
  self-defeating.
- robots.txt: single User-agent:* block, NO named AI-crawler rules.
- DC surface: 30 cards, ZERO sponsored/ad labels; 12/30 have 0 reviews,
  median ~3; deals on 3/30 cards, no expiry dates.
- Products: WM Listings/Ads/Store/Deals/Orders/Dispatch; "up to 10X more
  engagements with Premium"; 16M+ consumers claimed; no public pricing.
- 13 DC neighborhood region URLs sitemapped (vs our 12 built pages).

## Where's Weed facts
- DC-native and DOMINANT in delivery social proof: Weed Love 4.9 (4,372
  reviews), Jamaican House (3,384), Munchies (3,326), Exotic Fusion (2,725) —
  years of accumulated reviews on I-71 gifting delivery services.
- "109 DC dispensaries" count is DMV-diluted (Trulieve Halethorpe 31mi etc.);
  ~10-15 true DC addresses in top results.
- **/add-business is a hard 404** — broken merchant self-serve; manager portal
  on legacy.wheresweed.com. Advertising = media-kit contact form, no pricing,
  no tiers, no reach claims.
- DC deals aggregate URL 404s; top merchants show "0 deals claimed."
- NO license numbers anywhere; no verification language; explicit gifting
  copy ("I-71 compliant cannabis delivery... gifts to your door").
- NO security headers at all (no CSP/HSTS/XFO/XCTO); Express behind
  Cloudflare; no llms.txt; age gate only on detail pages.

## Cross-platform strategic picture (with Leafly)
| Dimension | Leafly | Weedmaps | Where's Weed | orderweeddc |
|---|---|---|---|---|
| AI-agent readability of core data | GPTBot blocked (26 affiliate pages allowed) | 406 wall kills ALL fetchers despite llm.txt | SPA: top-10 JSON-LD only | FULL (SSR + JSON-LD + llms.txt) |
| License verification | Displays ABCA # (self-attested) | "Self-Certify" | Nothing | Registry-verified process + provenance schema |
| Merchant pricing | Hidden (demo) | Hidden (sales) | Hidden (media kit) | PUBLISHED |
| Merchant self-serve | None | Partial | 404 | Same-day claim flow |
| DC deals surface | No expiry, MD bleed | 0 indexed deal pages | 404 + empty tabs | Freshness-labeled (uncontested) |
| Sponsored disclosure | Section header only | None visible | None | Labeled, never reorders organic |
| DC review moat | Thin (1-22) | Thin (median 3) | DEEP on delivery (1.5k-4.4k) | None yet (honest) |

## The one real threat
Where's Weed's delivery review moat (thousands of reviews per merchant) is the
only asset in the market we cannot replicate quickly and must not fake (truth
law). Counter-position: their moat sits on unverified gifting delivery; ours is
the licensed-retailer evidence layer. Different game, defensible.

## Ranked actions
1. Merchant outreach ammo finalized: all three hide pricing; two have broken/
   gated onboarding; one literally says "Self-Certify" — quote it.
2. SEO: target "washington dc dispensaries" intent orphaned by Weedmaps'
   404'd legacy URLs + build the DC deals index none of them have.
3. AI answer engines: we are already the only readable DC directory — ship
   content velocity (EARN) to give engines more to cite.
4. Watch: Weedmaps' LLMTXT directive (novel industry move) — re-check each
   SENSE cycle whether they fix their 406 self-sabotage.
5. Consider (post-revenue): review system design that starts from verified-
   purchase-or-visit evidence, never volume-first.
