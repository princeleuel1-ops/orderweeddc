# Leafly field recon — 2026-07-23 (two-agent crawl, 15 screenshots in thread)

Method: two observe-only browser agents (consumer surfaces; business/tech
surfaces) + curl for robots/sitemaps/JSON-LD. All claims screenshot- or
fetch-backed. Supersedes stale rows in marketing-dossier.md where noted.

## Corrections to our prior baseline (honesty rule)
- Leafly DOES display DC ABCA license numbers on dispensary detail pages
  (observed: ABCA-129436 on Holistic District). Display-only: self-attested at
  onboarding ("Do you have an active business license?" dropdown), no
  verification process claimed anywhere, and NOT in JSON-LD (LocalBusiness has
  no license/credential/provenance properties). Our edge is verification-as-
  process + structured provenance, not mere display.
- Leafly robots.txt now curates AI crawlers (updated 2026-03-11): GPTBot
  Disallow / EXCEPT 26 re-allowed /news/strains-products/best-* affiliate
  articles — they are feeding ChatGPT only their commission content. Meta AI
  crawlers fully blocked. PerplexityBot/OAI-SearchBot/Google-Extended/CCBot:
  unlisted (default-allowed). Still no llms.txt (URL serves the app shell).

## Business model (fresh)
- Tiers: Starter / Pro / Leafly Ads(Boosts). Pro adds PRIORITY RANKING +
  better placements; Ads sells top-5 directory position, homepage features,
  geotargeted hero deals. ZERO public pricing ("varies by geography...
  contact us"). Demo-gated HubSpot form; no self-serve.
- Claimed reach: 100M+ visitors/yr, 4M+ orders/yr, 4,600+ retailers, 7,800+
  brands. Their own testimonial quotes a merchant praising Leafly vs rivals'
  "bait and switch" — merchants are primed to distrust hidden pricing.

## DC surface facts
- 48 DC listings (homepage claims 39 — 23% stale undercount).
- First 5 results = SPONSORED block; disclosure is one small section header,
  no per-card badge; sponsored cards embed testimonial quotes.
- 5.0★ ratings from 1–22 reviews displayed at full visual weight under the
  header "authentic reviews".
- Deals: no expiry dates, no verification, Maryland stores bleeding into the
  DC deals feed.
- Menus show "Updated 2 minutes ago" freshness (their best trust signal).
- Brand verification checkmarks exist on menu items (District Cannabis ✓) —
  brand-level, not license-level.
- /strains (direct URL) redirects consumers to the B2B advertise pitch.
- Strain category titles stale ("Best Hybrid Strains of 2025" in July 2026).
- Editorial strain copy carries unlabeled medical claims ("patients often use
  Blue Dream to treat...") with only a site-footer FDA disclaimer.

## JSON-LD (fresh)
- Strain page: Product + aggregateRating + reviews; price only as prose in
  description; no Offer/priceSpecification. Dispensary page: LocalBusiness
  with amenityFeature, priceRange "$$" only; NO license, NO hasCredential,
  NO provenance. Listing pages: CollectionPage/ItemList/FAQPage.
- Sitemaps: 18 gz sub-sitemaps, daily lastmod; dispensary URL pattern
  /dispensary-info/{slug}.

## Exploitable gaps (ranked, mapped to our roadmap)
1. Published pricing vs demo-gate (SHIPPED: /pricing) — weaponize in merchant
   outreach with their own bait-and-switch testimonial.
2. Verification-as-process vs display-only license text (SHIPPED: dataStatus
   chain + JSON-LD provenance) — market "verified, with receipts".
3. Sponsorship-neutral organic order + per-card sponsor labels (SHIPPED,
   guard-tested) vs their sponsored-first block.
4. AI-answer-engine openness (SHIPPED: llms.txt + OAI-SearchBot/PerplexityBot
   allowed) vs their GPTBot-blocked core data; consider curated agent surfaces.
5. Deal honesty: expiry timestamps + freshness labels (PARTIAL: freshness
   system exists; surface expiry prominently on deals page).
6. DC-only geographic integrity (SHIPPED: DC-only universe) vs MD bleed.
7. Review integrity: minimum-sample thresholds/confidence display (ROADMAP —
   we currently show no unverifiable ratings at all, which is stronger).
8. I-71/ABCA regulatory content authority (EARN rotation already targets
   this; accelerate).
9. Structured Offer/priceSpecification per SKU (ROADMAP: emit once verified
   menu pricing exists — they have nothing machine-readable).
10. Menu freshness UX ("Updated X min ago") — ADOPT their pattern; ours is
    verifiedAt-based and honest, make it as loud as theirs.
