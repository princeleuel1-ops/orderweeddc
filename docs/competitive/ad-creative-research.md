# Ad-creative model research (observed 2026-07-23; re-verify each SENSE cycle)

Question: which image-AI backend should power personalized merchant ad
creatives, and how must the engine be shaped so ANY model plugs in safely?

## Findings (2026-04 head-to-head evaluations, multiple independent sources)

| Dimension | GPT Image 2 (`gpt-image-2`) | Gemini / Nano Banana 2 (`gemini-3.1-flash-image`) |
| --- | --- | --- |
| Core strength | In-image typography, reasoning, prompt adherence | Product/brand consistency across scenes, conversational editing, aspect-ratio coverage |
| Blind creative tournament | Wins aggregate (61–67% vs field) | **Wins product photography category** |
| Cost per variant | ~$0.20–0.50 usable | **$0.039/image, $0.0195 batched** |
| Failure mode | Distorts | Hallucinates |
| Typography sentiment | Negative (-6) | Negative (-5) |

Key facts that shaped the engine:

1. **Every frontier model nets NEGATIVE typography sentiment** (GPT -6,
   Gemini -5, Seedream -7, FLUX -9). Conclusion: compliance-critical text
   (21+ marker, license number, "Sponsored") must NEVER be generated
   in-image. It is composed as a deterministic overlay — pixel-exact,
   auditable, model-independent.
2. **Failure modes diverge per model** ("model choice is also a QA
   choice"). Conclusion: post-generation inspection of the actual output
   is mandatory regardless of provider — the vision model re-analyzes
   every generated image before verification.
3. **Gemini wins exactly what merchant ads need**: the same product
   staying recognizable across N scene variants (each ad features a
   different verified product), cheap iteration at volume, and ecosystem
   alignment with the search surfaces we compete on. Default provider.
4. **Hybrid is the production norm** for teams shipping 100+ variants/mo.
   Conclusion: provider contract (`provider-contract.mjs`) so GPT Image 2
   or any future model plugs in without a rewrite; creative strategy, not
   model loyalty, decides the split.

## Engine laws (packages/ad-creative)

- Brand analysis BEFORE generation: comprehensive logo audit (palette,
  typography, iconography, tone, do-not-alter, minors-appeal risk).
- Ads only for licensed, identified businesses; only VERIFIED_CURRENT
  products may appear — the truth chain reaches the ad layer.
- Verification AFTER generation, BEFORE posting: 8-check gate + image
  re-inspection + sha256 receipt.
- Two-key posting: machine PASS + named human approval. The pipeline has
  no posting capability. No self-certification, ever.
- Ads never enter organic directory ordering (sponsorship-neutrality is
  a verification check, not a promise).
- GEMINI_API_KEY via environment injection only. Tests are offline.

## Cannabis-specific constraints baked in

- No health/medical claims (forbidden-claims scan of every text field).
- No minors-appeal elements (checked at logo stage AND generated-image stage).
- 21+ marker and license line mandatory on every creative.
- Major ad networks ban cannabis ads → channels are: labeled Featured
  placement on orderweeddc, merchant website/email/in-store. Never
  claimed otherwise.
