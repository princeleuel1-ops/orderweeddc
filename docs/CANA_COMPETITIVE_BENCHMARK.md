# CANA Competitive Benchmark

As of 2026-07-17, CANA is measured against three established product
categories rather than against an undefined claim of universal superiority.
This document records observable competitor capabilities, CANA's defensible
advantages, known gaps, and acceptance evidence.

## Current reference products

- [Weedmaps consumer ordering](https://weedmaps.com/learn/products-and-how-to-consume/how-to-order-weedmaps)
  documents discovery, live menus, deals, pickup and delivery ordering,
  checkout, and order tracking.
- [Weedmaps retailer products](https://weedmaps.com/business/retailers/)
  documents listings, advertising, deals, orders, live menus, POS
  integrations, and dispatch.
- [Leafly](https://www.leafly.com/) documents location, strain, price, deal,
  brand, rating, and effect-oriented discovery; ordering; editorial content;
  and a large community review corpus.
- [Dutchie E-Commerce](https://dutchie.com/business/ecommerce) documents
  ordering, personalization, live POS inventory, promotions, loyalty,
  abandoned-cart recovery, back-in-stock alerts, analytics, and terpene
  search.

These are vendor claims and product descriptions, not independent performance
proof. CANA does not copy their scale or claim that an unconnected local
prototype has matched their transactions, inventory integrations, or audience.

## Live experience inspection

The public desktop experiences were inspected on 2026-07-17 without accepting
an age gate, creating an account, placing an order, or copying proprietary
assets. The inspection covered visible rendering, accessible page structure,
navigation, retailer-detail information architecture, and public failure or
friction states.

| Product | Observable interaction model | Observable trust model | CANA response |
| --- | --- | --- | --- |
| Weedmaps | Location-led search, dispensary and delivery cards, deals, category browsing, reviews, and prominent sponsored media | Sponsored placement is visible; the public experience emphasizes conversion, distance, reviews, and offer discovery | Make sponsorship machine-readable and visually explicit while keeping it out of truth-first ordering |
| Leafly | Global product search, broad category navigation, sponsored nearby retailers, retailer tabs, menu categories, deals, reviews, and editorial discovery | Retailer pages expose menu-update recency, but conversion and community signals dominate the first screen | Put source, verification, expiry, confidence, and handoff eligibility in the primary comparison surface |
| Dutchie | Address-first local discovery followed by real-time menus, pickup or delivery, payments, rewards, and personalized shopping | Inventory and checkout continuity are the primary consumer promise | Do not claim real-time stock or checkout until an authorized retailer integration supplies current evidence |
| Jane | Search-led products, brands, dispensaries, category chips, nearby retailers, cart, and personalized recommendations | Personalization and transaction convenience are central; public access begins behind an age gate | Offer useful non-personalized discovery with no behavioral profile, while preserving an explicit 21+ and medical-use boundary |

Shared incumbent strengths are catalog breadth, retail integrations, local
inventory, merchandising, and transaction completion. Shared visible friction
includes age gates, advertising or sponsored placement, cookie or privacy
notices, and personalization prompts. CANA's benchmark does not treat those
differences as automatically better or worse; each response needs a measurable
user, truth, privacy, or safety outcome.

## Measurable comparison

| Dimension | Reference-market baseline | CANA release criterion |
| --- | --- | --- |
| Discovery | Location, type, product, category, deal, brand, rating, and effect filters | Bounded tenant-scoped retailer and product search with explicit evidence-state filters and non-personalized sorting |
| Record truth | Vendor-managed listings and consumer-facing labels | Demonstration isolation; approved-evidence publication; freshness expiry; disputes; cited sources |
| Comparison | Product and listing browsing | Side-by-side source, freshness, sponsorship, evidence eligibility, and handoff state without behavioral tracking |
| Commerce | Live menus, carts, orders, payments, fulfillment | No commerce claim until a licensed retailer and authorized integration are proven |
| Merchant operations | Menu, promotion, order, POS, loyalty, and analytics tools | Tenant-bound menu, inventory, deals, evidence, claims, corrections, and handoff attribution |
| Privacy and abuse resistance | Product-specific privacy and account controls | Pseudonymous durable throttles, same-origin writes, bounded bodies, generic auth failures, and atomic rollback |
| Search integrity | Large public indexes and editorial libraries | Only current non-demonstration evidence is index-eligible; dynamic canonical sitemap |
| Failure safety | Vendor-specific operational controls | Transactional mutations, deterministic gates, no external model runtime, clean crash-independent local release |

## Evidence rule

CANA may be described as better only on a named dimension with a reproducible
test. It may not claim:

- universal or "100x" superiority without a defined denominator and measured
  result;
- live inventory, licensing, ordering, revenue, conversion, or search
  visibility without accepted external evidence;
- that a synthetic demonstration record describes a real business;
- that sponsored placement is evidence of quality or trust.

## Current differentiation

The first competitive build closes a transparency gap: the CANA Trust Lens
allows a user to compare up to three public retailer records by source,
verification time, freshness expiry, confidence, sponsorship, license claim,
evidence-eligible menu and offers, and public-handoff eligibility. The query is
bounded, tenant-scoped, noindex, and creates no user profile or tracking record.

Acceptance is defined by deterministic unit tests, cross-tenant HTTP tests,
production rendering, responsive browser inspection, accessibility semantics,
and database-residue checks.

The next measured gap is product discovery. Acceptance requires tenant-scoped
catalog search; bounded category, strain-type, evidence-state, stock-claim, and
price ordering inputs; evidence eligibility on the retailer, menu entry, and
product simultaneously; explicit sample labels for demonstrations; no
sponsorship, popularity, inferred effect, or behavioral profile in the default
ordering; and production HTTP plus browser proof.

That gap is now closed locally by the CANA Evidence Explorer. It exposes
product-or-retailer search, seven category controls, four strain-type controls,
service type, full-chain evidence state, reported-stock, four price bands, and
four transparent sort modes. The default sort prioritizes a
non-demonstration retailer-menu-product chain and never reads sponsorship,
reviews, engagement, inferred preference, or a user profile. A verified-only
filter requires current evidence on all three records. The route has fixed
query, page, result, and projection bounds; a canonical URL; evidence-dependent
index eligibility; and no event write.

The flagship route is also part of the warmed production-server performance
laboratory and must complete under the existing 2,000 ms local ceiling. This is
a regression threshold, not a claim about public internet latency.

The legacy sponsored-first directory order has also been removed. Retailer
discovery now defaults to a deterministic truth-first order, offers only
truth-first, recently-updated, and alphabetical choices, labels sponsorship on
the record, and rejects a client attempt to select a sponsored sort.
