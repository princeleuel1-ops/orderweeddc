# The Shadow Loop — watch every move, ship it better (10–100×)

> They pay to A/B-test features and ads on their own traffic. The moment a
> change ships, it has already been validated by their money. We detect it,
> personalize it to DC + our evidence model, and implement a materially better
> version. We never copy; we out-build.

## Cadence
- **Weekly (EARN cycle):** run `node apps/web/scripts/competitor-shadow.mjs`.
  It fingerprints 15 public surfaces across Leafly, Weedmaps, Where's Weed,
  writes `docs/competitive/shadow/YYYY-MM-DD.json`, and prints the delta vs the
  prior snapshot. Snapshots are committed so history is auditable.
- **Monthly (SENSE cycle):** deep re-crawl (the two-agent field recon) to catch
  changes the fingerprints can't see (visual UX, card anatomy, ad creative),
  and refresh `COMPETITOR_PARITY_CONTRACT`.

## What is fingerprinted (public, robots-permitted only)
robots.txt · llm(s).txt · sitemap indexes (child count + hash) · business/
advertise page titles · DC listing page titles/status · Where's Weed
add-business + advertising status. Fingerprints are hashes/counts/titles — we
do not archive competitor content, and every adopted idea is re-implemented
from scratch.

## Triage every delta (the four verdicts)
For each delta the engine marks `TRIAGE_REQUIRED`. Classify it:

1. **ADOPT-BETTER** — a UX/content/SEO pattern that helps users. Re-implement
   under our truth laws with a NAMED better-than delta (see below). Example:
   Leafly's "Updated 2 min ago" → our evidence-only relative freshness label.
2. **COUNTER** — a competitive/monetization move to answer, not copy. Example:
   a rival finally publishes pricing → sharpen our published-pricing messaging.
3. **IGNORE** — noise or an anti-pattern that violates our laws (fake reviews,
   unlabeled sponsorship, medical claims, dark patterns). Log why, move on.
4. **ESCALATE** — a genuine threat to the founder. Triggers: a rival adopts
   license VERIFICATION (our core moat), opens DC neighborhood pages at scale,
   fixes their AI-crawler openness, or emits verification/provenance schema.

## The 10–100× rule (an ADOPT-BETTER is not done until it is BETTER)
Copying parity is failure. Each adopted change must ship with at least one
measurable superiority, drawn from our structural advantages:
- **Truth**: their claim is unverified; ours carries dataStatus + verifiedAt +
  source + provenance JSON-LD.
- **Machine-readability**: their surface is 406-walled / SPA-hidden / GPTBot-
  blocked; ours is SSR + structured-data + llms.txt (AI-answer-engine visible).
- **DC-specificity**: their content is national/DMV-diluted; ours is DC-only,
  ABCA-grounded, neighborhood-deep.
- **Honesty UX**: their pattern hides expiry/sponsorship; ours labels expiry,
  freshness, sponsorship, and never reorders organic by payment.
Log the named delta in the cycle report and in docs/sentinel-memory.md.

## Hard rails (never cross, even to move faster)
- Public surfaces only; one GET per surface; respect robots. No auth, no
  personal data, no scraping behind walls, no reproducing their content.
- Never adopt an anti-pattern to match a competitor. Truth laws, authority
  tiers, and hard stops outrank any parity goal.
- Auto-implement only within the gated auto-merge allowlist and all release
  gates; anything outside is a Tier-2 draft for the founder.

## Worked examples already shipped from field recon
- Freshness label (ADOPT-BETTER of Leafly menu timestamps) — evidence-gated.
- Marketing-convention axis (ADOPT-BETTER of Leafly effect wheel) — no medical
  claim.
- Crawlable DC deals ItemList (COUNTER to all three: none publish one).
- Published pricing (COUNTER to universal price-hiding).
