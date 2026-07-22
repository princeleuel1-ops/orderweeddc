# CANA Gemini Creative API Playbook

**Research date:** 2026-07-17

**Primary official references:**

- [Gemini image generation](https://ai.google.dev/gemini-api/docs/image-generation)
- [Gemini models](https://ai.google.dev/gemini-api/docs/models)
- [Interactions API](https://ai.google.dev/gemini-api/docs/interactions-overview)
- [Image understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Tools](https://ai.google.dev/gemini-api/docs/tools)
- [Video generation](https://ai.google.dev/gemini-api/docs/video)
- [Document understanding](https://ai.google.dev/gemini-api/docs/document-processing)
- [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Pricing](https://ai.google.dev/gemini-api/docs/pricing)

This playbook defines how CANA should use Gemini for creative production,
visual analysis, and supporting multimodal work. It does not authorize
Gemini-generated content to invent retailer facts, product availability,
medical claims, licensing claims, evidence, or commercial outcomes.

## Current platform decision

Use the **Interactions API** for new Gemini integrations. Google describes it
as generally available as of June 2026 and recommends it for current models,
multi-turn state, observable execution steps, background work, tools, and
structured output.

Do not start a new image pipeline on Imagen. Google has deprecated Imagen and
announced shutdown for 2026-08-17. CANA should use Gemini's native Nano Banana
models.

All generated images contain Google's SynthID watermark.

The live API preflight on 2026-07-17 confirmed that the Interactions image
response currently accepts `image/jpeg`. For Gemini 3.1 Flash Image, request
the smallest output with `image_size: "512"`; the accepted larger values are
`"1K"`, `"2K"`, and `"4K"`. Convert an accepted source image into PNG, WebP,
or AVIF as a separate deterministic asset-processing step when the application
needs another web format.

## Model router

| CANA workload | Default model | Reason |
| --- | --- | --- |
| Fast thumbnails, placeholders, and high-volume drafts | `gemini-3.1-flash-lite-image` | Lowest-latency, cost-efficient image generation and editing; 1K output |
| General production images and iterative editing | `gemini-3.1-flash-image` | Best general balance of quality, reasoning, speed, reference fidelity, grounding, and resolution |
| Hero art, complex layouts, exact text, brand-defining assets | `gemini-3-pro-image` | Professional production, advanced reasoning, precise text, layout control, style references, and up to 4K |
| Analyze screenshots, visual QA, classify, caption, detect objects | `gemini-3.5-flash` | Current multimodal general model for image understanding |
| Conversational short-form video and video editing | Gemini Omni Flash | Google's default video model for fast, multi-input, multi-turn generation and editing |
| Frame-controlled or extended cinematic video | `veo-3.1-generate-preview` or appropriate Veo 3.1 variant | First/last-frame control, reference images, extension, and native audio |
| Predictable briefs, asset manifests, alt text records, and QA reports | Gemini model with Structured Outputs | Schema-constrained JSON for application use |

Model identifiers and availability must be checked at runtime because Google
can change previews, aliases, regions, pricing, and quotas.

## Native image capabilities to exploit

Gemini's current native image models support:

- text-to-image generation;
- conversational image editing;
- semantic inpainting without a manually drawn mask;
- adding, removing, or replacing an element while preserving the rest;
- style transfer;
- combining multiple reference images;
- product and logo placement;
- sketch-to-finished-art transformation;
- character and object consistency across iterations;
- text rendering for diagrams, menus, infographics, and marketing assets;
- 1K, 2K, and 4K output on supported models;
- 512px draft output on Gemini 3.1 Flash Image;
- common square, portrait, landscape, and ultrawide aspect ratios;
- Google Search grounding for time-sensitive visualizations;
- Google Image Search grounding on Gemini 3.1 Flash Image;
- video-to-image poster, thumbnail, and summary generation on Gemini 3.1 Flash
  Image;
- batch generation with higher asynchronous limits.

Reference limits differ by model:

- Gemini 3.1 Flash Lite Image: up to 14 high-fidelity object references, but
  it is not intended for complex multi-reference or long multi-turn work.
- Gemini 3.1 Flash Image: up to 10 high-fidelity object references and up to
  four character references.
- Gemini 3 Pro Image: up to six high-fidelity object references, up to five
  character references, up to three style references, and up to 14 total
  images.

These are ceilings, not targets. Use the smallest reference set that clearly
defines the job.

## CANA asset pipeline

Every production asset should move through these stages:

1. **Truth brief**
   - Identify whether the asset is decorative, explanatory, editorial,
     promotional, or evidence-bearing.
   - Prohibit generated imagery from masquerading as a real retailer, real
     product, verified inventory, medical outcome, or legal status.
   - Identify any required “concept,” “illustration,” or “sample” label.

2. **Creative brief**
   - Define route, component, purpose, audience, dimensions, focal point,
     intended text overlay, responsive crop, and accessibility requirement.
   - Select the CANA visual mode rather than asking for “an Apple image.”

3. **Reference pack**
   - Include only authorized logos, product photographs, palette references,
     composition sketches, and style references.
   - Assign an explicit role to every image: `OBJECT`, `COMPOSITION`,
     `CHARACTER`, `STYLE`, or `PRESERVE`.

4. **Draft generation**
   - Use Flash Lite for cheap composition exploration.
   - Request one deliberate output per call when exact variant counts matter;
     Google documents that the model may not follow a requested image count.

5. **Production generation**
   - Promote the accepted brief to Flash Image or Pro Image.
   - Request the real aspect ratio and resolution in `response_format`, not
     only in prose.

6. **Visual criticism**
   - Send the generated asset, route screenshot, creative brief, and acceptance
     schema to a separate image-understanding pass.
   - Score composition, crop safety, hierarchy, brand fit, text accuracy,
     factual risk, accessibility, duplication, and artifacting.

7. **Deterministic validation**
   - Verify MIME type, pixel dimensions, file size, alpha behavior, and
     allowed output path.
   - Run OCR when the image contains words and compare against exact approved
     copy.
   - Check contrast when text will be overlaid.
   - Reject embedded fake controls, distorted logos, accidental packaging
     claims, unreadable text, or unsafe cannabis imagery.

8. **Human review**
   - Require approval for a brand-defining logo, public campaign claim,
     product depiction, real-person likeness, evidence illustration, medical
     content, or legal/safety communication.

9. **Optimization and provenance**
   - Preserve the original generated file.
   - Produce deterministic web variants separately.
   - Record model, prompt version, reference IDs, aspect ratio, output size,
     generation time, review result, and final source hash.
   - Never record the API key.

## Prompt architecture

Use labeled sections for production prompts:

```text
PURPOSE
[Where this asset appears, who it helps, and the single job it must do.]

SUBJECT
[The exact primary subject, physical properties, action, and state.]

COMPOSITION
[Focal point, subject placement, foreground, middle ground, background,
negative space, crop-safe areas, and visual hierarchy.]

CAMERA OR VIEW
[Shot type, angle, focal length or projection, depth of field, and perspective.]

LIGHTING
[Direction, softness, time of day, highlights, shadow behavior, atmosphere.]

MATERIAL AND DETAIL
[Surface, texture, botanical detail, environment, realism level.]

CANA VISUAL LANGUAGE
[Approved palette, contrast, mood, icon or illustration treatment.]

TEXT
[Exact approved words in quotes, hierarchy, placement, and descriptive font
characteristics. Omit this section when text belongs in HTML.]

PRESERVE
[Elements from reference images that must remain unchanged.]

CHANGE
[The smallest explicit edit requested in this turn.]

TRUTH AND SAFETY
[Concept/sample label requirements and prohibited implications.]

OUTPUT
[Aspect ratio, accepted source size and MIME type, transparent/opaque visual
treatment, and required downstream crop variants.]
```

Do not fill every section with ornamental language. Specificity should reduce
ambiguity.

## Prompting rules

### Describe the desired frame positively

Google recommends semantic negative prompting. Prefer:

> A quiet, uncluttered studio surface with the subject isolated and no visible
> packaging or people.

over a long sequence of disconnected negatives.

Negative constraints are still appropriate for consequential boundaries:

- no real retailer identity;
- no product or license claim;
- no consumption by a person;
- no medical promise;
- no Apple logo, device, interface, or trade dress;
- no text unless exact approved copy is supplied.

### State context and intent

“Create a background” is weak. “Create a wide responsive hero background for
CANA's evidence-aware product discovery page, leaving the left 42% quiet for
live HTML copy” gives the model a design problem it can solve.

### Control composition explicitly

Include:

- subject position;
- negative-space location and percentage;
- desktop and mobile crop focal point;
- camera angle;
- lens or projection;
- foreground and background relationship;
- lighting direction;
- intended aspect ratio.

### Separate copy generation from copy rendering

Google notes that image text works best when the text is generated first and
then supplied for rendering.

For CANA:

1. Generate and approve copy as structured text.
2. Freeze the exact string.
3. Supply the string in quotes to the image model.
4. OCR the output and compare it with the frozen string.
5. Prefer live HTML text whenever possible for accessibility and responsive
   control.

### Edit conversationally in small deltas

Use a strong first brief, then make one controlled change per turn:

> Keep the composition, lighting, palette, leaf structure, subject scale, and
> negative space unchanged. Change only the background from warm gray to CANA
> parchment.

For continued editing, use `previous_interaction_id` only when the retention
choice is appropriate and re-send interaction-scoped tools, system
instructions, and generation settings on every turn.

### Name every reference

Example:

```text
IMAGE 1 — PRESERVE: approved CANA mark; geometry and lettering must not change.
IMAGE 2 — OBJECT: authorized product photograph; preserve label accuracy.
IMAGE 3 — COMPOSITION: use only the placement and negative-space balance.
IMAGE 4 — STYLE: use the tactile paper-and-glass material language; do not copy
objects or text.
```

### Use explicit preservation language for edits

For semantic inpainting:

```text
Change only [specific element] to [replacement].
Keep everything else exactly the same, including composition, crop, camera
perspective, subject identity, typography, lighting, shadows, color balance,
and background.
```

### Break complex scenes into ordered construction

For a complex infographic or campaign scene:

1. establish the background and grid;
2. place the primary subject;
3. place secondary evidence objects;
4. reserve copy space;
5. apply lighting and material treatment;
6. render only the frozen text;
7. verify the visual reading order.

### Use camera language when realism matters

Useful controls include:

- extreme wide, wide, medium, close-up, macro;
- eye-level, overhead, low-angle, isometric;
- orthographic when perspective distortion is unwanted;
- 24mm environmental, 50mm natural, or 85mm portrait language;
- shallow or deep depth of field;
- softbox, rim light, bounced daylight, or diffused window light.

## CANA prompt templates

### Website hero with negative space

```text
PURPOSE
Wide responsive hero for CANA's evidence-aware discovery page. The image must
make verified cannabis information feel calm, precise, modern, and trustworthy.

SUBJECT
A single botanically accurate cannabis leaf specimen suspended above a
precision glass surface, presented as a scientific object rather than a
lifestyle prop.

COMPOSITION
Subject occupies the right 38% of a 16:9 frame. Preserve the left 45% as quiet
dark negative space for live HTML headline and actions. Keep the visual focal
point inside the center-right mobile crop.

CAMERA OR VIEW
Slightly elevated 50mm studio view, controlled perspective, crisp primary
subject, softly receding background.

LIGHTING
Soft museum-grade top light with a restrained emerald rim and subtle reflected
warmth. No harsh neon glow.

CANA VISUAL LANGUAGE
Near-black ink, deep botanical green, parchment highlights, precise glass and
paper textures, premium editorial restraint, no Apple branding or product
imagery.

TRUTH AND SAFETY
Decorative concept image. No people, consumption, smoke, packaging, medical
symbols, retailer identity, prices, potency values, or claims.

OUTPUT
JPEG, 16:9, 2K. No text embedded in the image. Produce optimized WebP and AVIF
variants in the deterministic asset pipeline after generation.
```

### Controlled edit

```text
Using the provided approved CANA hero, change only the leaf rim light from
emerald to muted amber. Keep the leaf anatomy, camera, crop, subject position,
glass surface, negative space, background, shadows, and all other colors
exactly unchanged. Return a 16:9 2K JPEG.
```

### Trust Lens explanatory graphic

```text
Create a clean editorial diagram explaining a three-record evidence chain:
Retailer → Menu Entry → Product. Use three distinct but visually related
objects connected by a single precise line. Show the third connection as
expired using a clearly different line treatment and an adjacent status label.
Reserve a clean footer band for live HTML explanation.

Exact image text:
"Retailer"
"Menu entry"
"Product"
"Current"
"Expired"

Use a high-contrast accessible palette, descriptive modern sans-serif
lettering, generous spacing, and no decorative cannabis clichés. This is an
educational concept diagram, not proof about a real retailer. 16:9, 2K JPEG.
```

The generated diagram must pass OCR and should be rebuilt in HTML or SVG when
interactive or localization requirements make raster text inappropriate.

## Gemini uses beyond image generation

### Visual QA

Use image understanding to compare:

- generated asset versus creative brief;
- desktop screenshot versus mobile screenshot;
- implementation versus approved design;
- focal-point crop versus safe-area requirements;
- real text versus OCR output;
- visual evidence label presence;
- contrast and affordance risks.

The model's report should conform to a structured schema and be treated as a
review signal, not deterministic proof.

### Structured creative briefs

Use JSON Schema to produce:

- asset ID;
- route and component;
- visual mode;
- prompt sections;
- reference roles;
- output formats;
- exact text;
- prohibited implications;
- accessibility requirements;
- reviewer state.

Validate schema-compliant values in application code. Correct JSON does not
guarantee a correct or safe decision.

### Documents

Gemini can analyze PDFs up to 50MB or 1000 pages, including text, diagrams,
charts, and tables. This is useful for:

- authorized brand standards;
- retailer-provided product sheets;
- policy or regulatory material;
- research reports;
- creative presentations.

Extracted information must retain page citations and must not automatically
become public CANA evidence.

### Grounding and URL context

Use Google Search or URL Context for current visual research only when the
task requires fresh external information. Grounded image-search responses have
attribution and search-suggestion display requirements. The UI must preserve
those requirements.

Grounding cannot turn an external image into an authorized CANA asset. Rights,
license, provenance, and truth review remain separate.

### Video

Use Gemini Omni Flash for quick, conversational visual motion work. Use Veo
3.1 when CANA needs native audio, first/last-frame control, reference-image
direction, or extension of a Veo-generated clip.

Motion assets must:

- have a static equivalent;
- respect reduced-motion preferences;
- avoid fabricated retailer or product claims;
- use captions when speech carries meaning;
- not block discovery or evidence access;
- be reviewed before public use.

## API-key and runtime boundary

- Never place the Gemini API key in source, prompts, generated metadata, logs,
  screenshots, client-side bundles, or committed environment files.
- Load it only in the server process through the project's approved local
  secret mechanism.
- Do not expose a generic public image-generation proxy.
- Authenticate and authorize every generation request.
- Bound prompt length, reference count, input bytes, output size, and job rate.
- Enforce per-user and per-tenant quotas.
- Treat rate limits as project-level, not key-level. Handle `429` with bounded
  exponential backoff and jitter.
- Use asynchronous jobs for long-running media generation.
- Record cost and usage metadata without storing credentials.
- Use `store=false` for stateless or sensitive work. If server-side
  conversation state is deliberately enabled, document retention and provide
  deletion because stored Interactions are retained for a limited period by
  Google.
- Never send unapproved private retailer documents or user images to a model.

## Acceptance gates

The Gemini creative integration is ready only when:

- the key never reaches the browser or repository;
- the model router is configurable and rejects unknown model IDs;
- a sanitized preflight confirms model access without printing credentials;
- timeouts, cancellation, `429`, `5xx`, and malformed responses are handled;
- generated outputs are stored outside source control;
- generation metadata and provenance are durable;
- every job has an authenticated owner and bounded inputs;
- image files pass deterministic validation;
- text-bearing assets pass OCR comparison;
- a separate visual-QA pass runs against the original brief;
- consequential assets require human approval;
- generated/sample status remains visible where truth could be misunderstood;
- mobile and desktop crops are verified in the real UI;
- a static and reduced-motion alternative exists for generated motion;
- unit, integration, authorization, secret-scanning, and browser tests pass.
