# @orderweeddc/ad-creative

Provider-pluggable ad-creative engine for merchant marketing.

## Pipeline (order is law)

1. **Analyze** — the provider's vision model audits the business logo
   (palette, typography, iconography, tone, do-not-alter elements,
   minors-appeal risk). Generation before brand analysis is forbidden.
2. **Brief** — one deterministic brief per VERIFIED_CURRENT product:
   every advertisement features a different verified product. Compliance
   text (21+ marker, license line, "Sponsored" label) lives in a
   deterministic overlay, never in-image.
3. **Generate** — via the pluggable provider. Default: Gemini
   (`gemini-3.1-flash-image`) — best product/brand consistency across
   variants and ~$0.039/image (2026-04 research; see
   `docs/competitive/ad-creative-research.md`). Any model that satisfies
   `provider-contract.mjs` plugs in without a rewrite.
4. **Inspect** — the vision model re-analyzes the ACTUAL generated image
   (minors appeal, health-claim imagery, rendered text, brand match).
5. **Verify** — eight-check gate. Machine PASS is necessary but never
   sufficient: `assertPostable` additionally requires a named human
   approval. The pipeline has no posting capability at all.

## Credentials

`GEMINI_API_KEY` via environment (skill credential injection). Never in
source, never in chat, never logged. Tests use a mock provider and an
injected fetch — no test touches the network.

## Run tests

```
npm test -w packages/ad-creative
```
