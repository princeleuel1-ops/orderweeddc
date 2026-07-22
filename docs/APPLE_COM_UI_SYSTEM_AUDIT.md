# Apple.com UI System Audit

**Observation date:** 2026-07-17

**Reference:** [Apple U.S. website](https://www.apple.com/)

**Purpose:** Extract the reusable visual, interaction, content, and responsive
principles that can inform CANA's next design phase without copying Apple's
brand, source code, product assets, or proprietary identity.

## Scope and method

Apple's current U.S. sitemap contains 359 linked destinations across 60
labeled groups. A claim to have manually inspected every regional, legal,
support, accessory, product-configuration, and campaign URL would not be
credible. This audit instead mapped the complete sitemap and inspected 28 live
pages covering every major public page archetype:

| Page archetype | Live references inspected |
| --- | --- |
| Campaign homepage | [Apple](https://www.apple.com/) |
| Commerce homepage | [Store](https://www.apple.com/store) |
| Product-family overview | [Mac](https://www.apple.com/mac/), [iPad](https://www.apple.com/ipad/), [iPhone](https://www.apple.com/iphone/), [Watch](https://www.apple.com/watch/), [AirPods](https://www.apple.com/airpods/), [TV & Home](https://www.apple.com/tv-home/) |
| Flagship product story | [iPhone 17 Pro](https://www.apple.com/iphone-17-pro/), [MacBook Pro](https://www.apple.com/macbook-pro/), [Apple Vision Pro](https://www.apple.com/apple-vision-pro/) |
| Comparison | [Compare iPhone](https://www.apple.com/iphone/compare/) |
| Technical specification | [MacBook Pro Tech Specs](https://www.apple.com/macbook-pro/specs/) |
| Product selector / buying guide | [Shop iPhone](https://www.apple.com/shop/buy-iphone) |
| Service portfolio | [Entertainment](https://www.apple.com/services/) |
| Support hub and support article | [Apple Support](https://support.apple.com/), [support article](https://support.apple.com/en-us/120933) |
| Editorial hub and article | [Newsroom](https://www.apple.com/newsroom/), [Newsroom article](https://www.apple.com/newsroom/2026/07/major-league-soccer-returns-to-apple-tv-tomorrow/) |
| Values and corporate storytelling | [Privacy](https://www.apple.com/privacy/), [Accessibility](https://www.apple.com/accessibility/), [Environment](https://www.apple.com/environment/), [Business](https://www.apple.com/business/), [Education](https://www.apple.com/education/) |
| Physical-retail and events | [Find a Store](https://www.apple.com/retail/), [Today at Apple](https://www.apple.com/today/) |
| Reference and utility | [Legal](https://www.apple.com/legal/), [Site Map](https://www.apple.com/sitemap/) |

The pages were inspected at a 1280 by 720 desktop viewport. The homepage,
iPhone family, iPhone flagship, navigation, and commerce selector were also
inspected at a 390 by 844 narrow viewport. The audit used rendered screenshots,
accessible DOM structure, computed typography and layout values, scroll
behavior, and interactive states such as global search and the mobile menu.

## Executive design model

Apple.com is not one visual template. It is a shared shell supporting several
deliberately different experience modes:

1. **Campaign mode** uses a sequence of nearly full-viewport product scenes.
2. **Family mode** organizes a catalog into lineups, benefits, explainers, and
   ecosystem relationships.
3. **Flagship mode** uses cinematic, long-scroll storytelling with sticky
   chapters and media.
4. **Commerce mode** replaces spectacle with product rails, pricing,
   configuration, trade-in, and specialist help.
5. **Utility mode** emphasizes search, task completion, reference material,
   and restrained content density.
6. **Editorial mode** uses card-led news discovery followed by conventional
   long-form article typography.

The consistency comes from typography, spacing, navigation, CTA behavior,
surface colors, and content discipline. The page archetype—not a universal
card component—determines the composition.

## Core visual grammar

### 1. Quiet chrome, expressive content

The global navigation is approximately 44px high on desktop, fixed or
persistent, and visually recessive. It uses a translucent white or black
surface depending on page context. The content below it is allowed to own the
color, imagery, and emotional tone.

The global shell contains only:

- brand/home;
- primary product families;
- entertainment and support;
- search;
- bag or commerce state.

Product pages add a second local navigation layer containing the product name,
overview/specification links, comparison, and a compact primary CTA. This
keeps the global information architecture stable while making deep pages
self-contained.

### 2. Typography is the primary hierarchy

Apple relies on scale, weight, line length, and whitespace more than borders or
decorative containers.

Observed desktop values include:

| Role | Typical observed value |
| --- | --- |
| Small navigation and metadata | 12-14px |
| Body and primary CTA | 17px, roughly 25px line height |
| Feature label | 21-24px |
| Product tile title | 40px |
| Standard section title | 48-56px |
| Compare/reference hero | 64px |
| Family or Store hero | 80px |
| Entertainment/corporate hero | 96px |

Observed narrow-width values include:

| Role | Typical observed value |
| --- | --- |
| Body and CTA | 17px |
| Section title | 28px with a 32px line height |
| Homepage campaign title | 32px with a 36px line height |
| Product-family hero | 48px with an approximately 52px line height |
| Full-screen menu item | 28px, semibold |

The 17px body style used a slight negative letter spacing in the rendered
desktop pages. Large display headings are semibold rather than excessively
heavy. Headlines usually occupy one to three lines and avoid long explanatory
copy.

Apple uses SF Pro on its own site. CANA must not redistribute or depend on
Apple's proprietary font files. A licensed system-first or open alternative
should reproduce the hierarchy, not the exact letterforms.

### 3. A restrained neutral palette

Recurring rendered colors:

| Token role | Observed color |
| --- | --- |
| Primary ink | `rgb(29, 29, 31)` / approximately `#1d1d1f` |
| Primary light canvas | `#ffffff` |
| Secondary light canvas | `rgb(245, 245, 247)` / approximately `#f5f5f7` |
| Alternate light canvas | `rgb(250, 250, 252)` / approximately `#fafafc` |
| Primary blue action | `rgb(0, 113, 227)` / approximately `#0071e3` |
| Link on dark canvas | `rgb(41, 151, 255)` / approximately `#2997ff` |
| Dark scene canvas | `#000000` or `#1d1d1f` |
| Primary text on dark canvas | approximately `#f5f5f7` |

Accent colors belong to the story being told. The iPhone flagship page uses
orange as a chapter accent; service and values pages use their own imagery and
gradients. Accent color never competes with the global action color.

### 4. Whitespace is structural

At a 1280px viewport, recurring content widths were approximately 830px,
980px, and 1107px. Narrow reading columns sit inside wider image or scene
containers. Large sections use generous vertical separation, often giving a
single claim or product visual most of a viewport.

This creates three useful density levels:

- **cinematic:** one claim plus one dominant visual;
- **editorial:** title, short explanation, and a small number of cards;
- **operational:** compact rows or columns for comparison and specifications.

Apple changes density intentionally instead of applying one spacing scale to
every route.

### 5. Shape is subordinate to content

Primary buttons use a fully rounded pill treatment. On the homepage, the
observed 17px CTA used about 11px vertical and 21px horizontal padding.
Smaller 14px CTAs used about 8px by 15px. The computed border radius was an
effectively infinite `980px`.

Large commerce and editorial cards use softly rounded corners and minimal
shadows. Dark cards often define themselves through background contrast rather
than a border. Apple rarely wraps ordinary text in a card merely to make a
layout look populated.

## Reusable component patterns

### Global navigation

- One 44px desktop row.
- Translucent canvas and backdrop separation rather than a heavy border.
- Search and commerce controls are icons with accessible names.
- Desktop exposes the top-level categories directly.
- Narrow layouts replace the category row with three controls: search, bag,
  and menu.

### Mobile full-screen menu

- Locks body scrolling while open.
- Uses a full-height light surface.
- Presents navigation as large 28px semibold text rather than small desktop
  links.
- Uses roughly 53px rows and a 48px close control.
- Preserves a simple, single-column reading order.

### Search overlay

- Expands from the global shell into a large light panel.
- Blurs the underlying page instead of navigating immediately.
- Gives the search field a prominent 24px type size.
- Shows a short set of quick links before the user types.
- Uses a live result-status region in the accessible structure.

### Local product navigation

- Becomes sticky after entering the product story.
- Keeps product name, chapter links, compare/spec links, and Buy visible.
- Switches foreground and surface treatment to remain legible over dark and
  light scenes.
- Separates global orientation from local task progression.

### Campaign hero

- A short, memorable title.
- One supporting sentence.
- One primary and at most one secondary CTA.
- A dominant product or editorial visual.
- Almost no decorative chrome.
- The full scene, not an isolated card, acts as the composition unit.

### Product-family lineup

- Family name and icon/product rail establish orientation.
- “Explore the lineup” presents the actual choices.
- “Take a closer look” supplies richer media.
- “Why buy here” answers commerce objections.
- “Get to know” turns product attributes into benefit cards.
- “Essentials” and ecosystem sections create cross-navigation.

This sequence repeatedly answers: **Where am I? What can I choose? Why does it
matter? Why should I trust this place? What works with it?**

### Horizontal rail

- Allows the next item to peek into view.
- Uses large cards with one dominant idea.
- Provides previous/next controls where needed.
- On flagship pages, uses mandatory horizontal scroll snapping.
- Maintains a labeled list or gallery structure for assistive technology.

### Compare surface

- Begins with an unusually direct 64px title.
- Uses aligned product columns.
- Repeats feature rows vertically so differences can be scanned.
- Keeps product selectors and commerce links near the top.
- Reserves prose for explaining a metric rather than selling the product.

### Technical specification surface

- Uses a stable product-local navigation.
- Turns a very large data set into predictable labeled groups.
- Uses size/model switching near the beginning.
- Keeps imagery subordinate to exact values.
- Avoids cinematic motion where precision is the task.

### Commerce selector

- Opens with category orientation and specialist/store help.
- Uses an in-page category index.
- Shows product, available colors, full price, installment price, and Buy
  action in the same card.
- Follows product choice with decision help, savings, accessories, setup, and
  support.
- Uses human assistance as an explicit product feature rather than a footer
  escape hatch.

### Support hub

- Starts with a plain-language problem statement: help begins here.
- Presents product families as recognizable visual shortcuts.
- Elevates the most common account and billing tasks.
- Places a prominent search field before deeper educational content.
- Separates repair, coverage, learning, warnings, and service programs.

### Newsroom

- Uses a restrained editorial sub-navigation.
- Gives the newest story the largest visual footprint.
- Labels article type and recency.
- Uses a grid for the feed, then switches to a conventional readable article
  column on detail pages.
- Keeps press contacts and media resources separate from the narrative.

### Footer and sitemap

- Footer density is intentionally high because it acts as a directory, not a
  marketing section.
- Footnotes come before navigation when claims need qualification.
- Links are grouped by user intent and product family.
- The sitemap mirrors the global information architecture and exposes support,
  accessories, applications, institutional use, and services under each
  family.

## Motion and scroll behavior

Flagship pages use motion to preserve focus while progressively revealing
detail:

- full-viewport sticky containers hold a visual in place while copy advances;
- scenes transition between black, near-black, white, and light gray canvases;
- product media is muted and controlled by page logic rather than relying on
  native video controls;
- galleries use labeled previous/next controls;
- horizontal galleries use mandatory scroll snapping;
- play, pause, replay, and close actions are exposed with accessible labels;
- local navigation remains available during very long stories.

The inspected iPhone flagship page contained 16 video elements, multiple
sticky containers, and ten mandatory horizontal snap regions. The videos did
not declare unconditional HTML autoplay. This suggests media lifecycle is
coordinated by visibility, scroll position, and explicit controls.

The principle to reuse is **motion as explanation**. CANA should not reproduce
Apple's animation volume. Motion should reveal evidence, state change, or
workflow progression and should have a reduced-motion equivalent.

## Responsive behavior

At 390 by 844:

- global product links collapse into a full-screen menu;
- homepage campaign headings reduce from 56px to 32px;
- the iPhone family hero reduces from 80px to 48px;
- family section headings reduce to 28px;
- primary navigation controls use approximately 48px touch targets;
- CTA groups wrap or stack;
- product families and card collections become horizontal rails;
- the edge of the next card is deliberately visible;
- cinematic product imagery crops aggressively around the focal object;
- the iPhone family and flagship pages had no document-level horizontal
  overflow in the narrow test.

The Store selector exposed an approximately 980px minimum layout while tested
with a desktop browser identity at 390px, producing horizontal overflow. This
may be a desktop-versus-mobile delivery difference and must not be copied or
treated as a verified mobile pattern without a real mobile user-agent test.

## Accessibility and trust observations

Strong reusable behaviors:

- global, local, footer, and breadcrumb navigation have semantic labels;
- page and section heading hierarchy is broadly exposed;
- product images use detailed, descriptive alternative text;
- carousels expose tablists, tabpanels, groups, or labeled lists;
- previous/next, play/pause, search, menu, and close actions have accessible
  names;
- the mobile menu behaves as a dialog and locks the background;
- search exposes a named textbox and result-count status;
- important price and offer qualifiers remain as text and footnotes;
- color is not the only carrier of product name, price, or navigation state.

Patterns CANA should improve instead of copying blindly:

- cinematic pages can become extremely long;
- large horizontal galleries can burden keyboard and low-mobility users;
- visually hidden primary headings on some flagship pages weaken visible page
  orientation;
- footnote-heavy commerce language can separate a claim from its qualification;
- dark scenes and animated media need explicit reduced-motion and contrast
  verification;
- mobile commerce must be independently tested rather than inferred from a
  narrow desktop session.

## Content system

Apple's content style is highly constrained:

- headings are usually two to seven words;
- sentence case is the default;
- one section makes one claim;
- a supporting sentence explains the claim without repeating it;
- product names appear before feature language;
- CTA vocabulary is intentionally small: Learn more, Buy, Shop, Compare,
  Watch, Explore, Get started;
- price and eligibility claims carry visible qualifiers;
- technical pages replace slogans with exact labels and values;
- utility pages lead with the user's task, not the company's story.

The result feels confident because the copy is edited, not because every
sentence makes a superlative claim.

## CANA translation rules for the personalization phase

These rules preserve the strongest Apple principles while producing a
distinct CANA identity.

### Preserve

1. A quiet universal shell.
2. Large editorial hierarchy with short claims.
3. One clear purpose per section.
4. Separate cinematic, discovery, commerce, and operational page modes.
5. Sticky local navigation on long detail pages.
6. Consistent primary and secondary CTA grammar.
7. Product or evidence imagery as the visual anchor.
8. Horizontal rails only when they improve comparison or discovery.
9. Human-readable qualification beside consequential claims.
10. Task-first support and admin experiences.

### Translate for CANA

| Apple pattern | CANA expression |
| --- | --- |
| Product-family overview | Retailer, product, brand, education, and trust-evidence families |
| Flagship hardware story | Verified retailer or product dossier with provenance and freshness |
| “Explore the lineup” | Evidence-aware discovery with truth-first ordering |
| Product compare | Trust Lens comparison across source, freshness, confidence, sponsorship, and handoff eligibility |
| Tech specs | Evidence ledger, claim history, verification timeline, and source detail |
| Store buying guide | Decision support and authorized retailer handoff without unsupported stock or transaction claims |
| Specialist help | Clearly scoped support, retailer contact, and human review |
| Product-local navigation | Overview, Evidence, Menu, Offers, Corrections, Compare |
| Environmental/value story | CANA truth, privacy, safety, and community commitments backed by accepted evidence |
| Editorial newsroom | Cannabis education, policy explainers, and verified local guides with citation dates |

### Keep distinct from Apple

- CANA needs its own palette, iconography, logo, imagery, and motion language.
- Truth state, source, verification time, confidence, sponsorship, and sample
  status must be visible—not hidden in an imitation of luxury minimalism.
- Operational and admin pages should prioritize density and auditability over
  cinematic presentation.
- Cannabis safety, age boundaries, medical disclaimers, and jurisdictional
  limits require clearer disclosure than a consumer-electronics site.
- CANA must not use Apple's product photography, logos, slogans, CSS, scripts,
  page source, or proprietary font files.

## Recommended CANA page modes

### 1. CANA campaign homepage

Use a small number of full-width scenes:

1. a truthful local-discovery promise;
2. the Trust Lens;
3. evidence-aware product discovery;
4. retailer correction and verification;
5. educational or safety content.

Each scene should have one claim, one proof-oriented supporting sentence, one
primary action, and one optional secondary action.

### 2. Discovery family pages

Use Apple's family-page sequence, adapted to:

- explore verified retailers or products;
- compare evidence state;
- understand CANA's truth protections;
- learn how handoff works;
- continue into related education and safety material.

### 3. Retailer and product dossiers

Use the flagship-story pacing selectively:

- identity and current evidence state;
- source and verification timeline;
- menu or product data that is currently eligible;
- reported versus externally proven claims;
- corrections and disputes;
- clear handoff boundary.

Motion may reveal the evidence chain, but it must never delay access to the
underlying facts.

### 4. Trust Lens and comparison

Use the compare-page alignment model:

- fixed column headers;
- consistent feature rows;
- visible missing/expired states;
- readable source citations;
- deterministic truth-first ordering;
- no sponsored default ordering.

### 5. Admin and Control Tower

Use the utility/specification model rather than a marketing page:

- dense but calm information hierarchy;
- stable navigation;
- state tables and timelines;
- explicit failure, stale, unknown, and blocked states;
- no decorative motion around operational alerts.

## Personalization acceptance criteria

The next design phase is complete only when:

- CANA is recognizable without Apple branding or assets;
- every route is assigned to a defined page mode;
- typography and spacing tokens are documented;
- desktop and mobile navigation are keyboard and screen-reader operable;
- reduced-motion behavior is implemented;
- no important claim depends on animation, imagery, or color alone;
- evidence and sample labels remain prominent at every responsive size;
- discovery, comparison, retailer detail, support, admin, and error states are
  represented;
- visual regression screenshots cover desktop and narrow layouts;
- horizontal overflow is absent unless a deliberately labeled data table
  requires it;
- performance budgets prevent cinematic media from blocking useful content.

## Bottom line

Apple.com's strongest transferable idea is not “make everything look like
Apple.” It is to give each page one clear job, remove anything that competes
with that job, and use a small, consistent system of type, spacing, actions,
and navigation to make radically different page types feel related.

For CANA, the equivalent center of gravity is not hardware beauty. It is
**truth made legible**: verified identity, current evidence, uncertainty,
freshness, provenance, corrections, and safe handoff presented with the same
clarity and confidence.
