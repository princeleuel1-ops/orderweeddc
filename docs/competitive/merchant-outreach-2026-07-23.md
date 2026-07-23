# DC merchant outreach — the takeover sequence (2026-07-23)

Audience: the 74 ABCA-licensed DC retailers (docs/competitive/dc-merchant-universe.json).
Every claim below is grounded in the 2026-07-23 field recon of Leafly,
Weedmaps, and Where's Weed. Truth law: we never fabricate a competitor quote —
each italic quote is a verbatim observed string with its source page.

## The one-sentence wedge
Every platform DC merchants use today hides its price, fails to verify licenses,
and can't show a live deal to an AI assistant. orderweeddc publishes the price,
verifies against the ABCA registry, and is the only DC directory an AI can read.

## The three proof points (all observed, all screenshot-backed)

1. **Hidden pricing everywhere.** Leafly: *"Pricing varies by geography,
   product selection, and level of service. Please contact us to learn more."*
   Weedmaps and Where's Weed: no price anywhere, sales/media-kit gate only.
   -> orderweeddc: public rate card (Free / Featured $249 / SiteMind $499),
   same-day self-serve. No sales call to learn what you'd pay.

2. **Nobody verifies your license — one platform admits it in its title.**
   Weedmaps' DC page title literally reads *"Self-Certify at Legal Medical
   Dispensaries."* Leafly displays a license number you typed yourself (never
   checked, never in its structured data). Where's Weed shows nothing.
   -> orderweeddc verifies against the DC ABCA registry and publishes the
   verification date + source on your listing AND in machine-readable schema.

3. **Your deals are invisible to AI search.** Weedmaps returns HTTP 406 to
   every AI crawler; Where's Weed hides listings in a JavaScript app; Leafly
   blocks GPTBot from all dispensary data. When a customer asks ChatGPT "where's
   a deal on flower in DC tonight," none of them can answer with your store.
   -> orderweeddc is the only DC directory whose deals (with expiry dates) are
   readable by ChatGPT, Perplexity, and Google's AI.

## Segment-specific hooks
- **I-71 gifting delivery (Where's Weed's stronghold):** "Where's Weed can't
  even take your signup — their Add-a-Business page is a dead link. List with us
  in minutes, keep your reviews there, own your evidence here."
- **Licensed storefronts:** lead with ABCA verification — the trust badge none
  of them offer, and the one that matters as DC enforcement tightens.
- **Deal-driven shops:** lead with the deals index — expiry-dated, AI-readable,
  never reordered by who pays.

## Channels (compliance-safe)
Major ad networks ban cannabis ads, so outreach is: direct email/DM to the
licensee, in-person at the storefront, and the Featured-placement offer on
orderweeddc itself. Never claim paid placement changes organic ranking.

## Cold email template (adapt per segment; founder sends, not automated)
Subject: Your DC license, verified — free listing on orderweeddc

Hi {name}, I built orderweeddc, a Washington-DC-only cannabis directory.
Unlike Weedmaps (whose DC page literally says "Self-Certify") or Where's Weed
(whose signup page is currently broken), we verify your listing against the DC
ABCA registry and publish the proof. A basic listing is free and goes live the
same day — no sales call, no hidden pricing. If you run deals, ours are the only
ones in DC that AI assistants like ChatGPT can actually read and cite.
Want me to set up your verified listing this week? — {founder}

## Honesty guardrails (never violate, even in sales)
- Never claim a competitor did something we didn't observe. Where's Weed's
  review depth is real and large — do not disparage it; counter-position on
  verification instead.
- Never promise verification we haven't performed; a listing is
  AWAITING_VERIFICATION until the registry check is done and dated.
- Never imply paid Featured placement changes organic order.
