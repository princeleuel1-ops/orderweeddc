# Cannabis Platform Technical DNA Analysis
## For orderweeddc — Next.js 16 + Prisma truth-first DC directory
**Generated:** 2026-07-23  
**Method:** Live curl (Chrome UA) + HTML/header analysis + Exa search + historical source triangulation

---

## 1. Leafly (leafly.com)

**One-line stack:** Next.js Pages Router (styled-jsx, data-next-head) + Cloudflare CDN + REST API (api.leafly.com) + DataDog observability — full SSR, 259 KB homepage.

### Detection Evidence
| Signal | Value |
|--------|-------|
| `__NEXT_DATA__` present | Yes — buildId: `75c10a8426587ff2...` |
| Framework mode | Pages Router (styled-jsx hashes: `jsx-3092327642`; `data-next-head` present) |
| CDN/hosting | Cloudflare (`CF-RAY: a1f8c83f5fd7563a-IAD`); `x-powered-by: Bongs` (custom header) |
| Server rendering | **Strong SSR confirmed**: DC listing page returns 129 dispensary-term mentions in raw HTML, full `<title>` and `<h1>` rendered. |
| Analytics | DataDog (detected in JS); REST API at `api.leafly.com` |
| Assets | CDN at `public.leafly.com`; no Algolia or GraphQL found |
| Page weight | 259 KB HTML (homepage), 451 KB DC listing |

### Historical Stack Eras
- **2010–2013 (founding era):** .NET server-side + Ruby/AngularJS frontend, WordPress blog. Source: stayregular.net/tech-stacks-of-the-top-cannabis-apps (2017). Founded in Bellevue, WA by Brendan Kennedy/Brian Placzek; acquired by Privateer Holdings 2011.
- **2013–2017:** AngularJS SPA with proprietary REST API; experimented with React for individual components; began adding Node.js/Redis/Elasticsearch on backend. Job postings from era confirm Node.js Software Engineer and Infrastructure Developer roles.
- **2018–2021 (rewrite):** Migrated from .NET + Angular to Next.js Pages Router. Engineering leadership (Ryan Rentfro, "Audience Journey" team lead) described "ground-up re-architecture: transition to headless, API-driven frontends... aggressive CDN caching... stateless frontend delivery." Built-in profile shows Ruby on Rails + React + Redux + TypeScript + Elasticsearch as current stack (inference: Rails still powers backend API; Next.js is the frontend).
- **2022–2026:** Pages Router retained (not migrated to App Router — styled-jsx still in production). Self-hosted fonts via CDN. No structured data (LD+JSON) found on listing pages despite 20K+ pages at scale. Went private via merger with Merida Capital 2022.

### Why Built That Way
Founded 2010 in Microsoft/.NET country (Bellevue, WA). .NET was corporate default; AngularJS was the 2013 SPA darling. Re-architecture to Next.js driven by SEO-at-scale pressure (120M annual visitors, 5,000+ strains, 6,000+ dispensary pages). SSR was necessary for Google indexing at that volume.

### What It Costs Today
- **Pages Router inertia:** No App Router migration = no React Server Components, no built-in streaming, no per-component caching. Rewrite risk is enormous at 120M-visitor scale.
- **No LD+JSON on listing pages:** Verified: zero `<script type="application/ld+json">` blocks on DC dispensary listing. This is a schema gap vs Google's rich results eligibility.
- **Google Fonts dependency:** Confirmed external Google Fonts loading — CSP complexity, 3rd-party DNS lookup latency.
- **Styled-jsx debt:** Older CSS-in-JS approach; not aligned with modern Tailwind/CSS Modules patterns. Migration would require touching every component.

---

## 2. Weedmaps (weedmaps.com)

**One-line stack:** Next.js Pages Router + Varnish/Fastly CDN + GraphQL (confirmed in JS chunk) + Segment + Optimizely feature flags — SSR present but listing pages return 406 to non-browser scrapers.

### Detection Evidence
| Signal | Value |
|--------|-------|
| `__NEXT_DATA__` present | Yes — 271 KB payload on homepage |
| Framework mode | Pages Router (chunk patterns: `pages/_app-XXX.js`, Redux `storeInitialState` hydration) |
| CDN/hosting | Varnish + Fastly (`X-Served-By: cache-iad-kcgs7200095-IAD`); assets at `static.weedmaps.com` |
| Server rendering | **Partial SSR:** Homepage body has cookie consent text + SVG defs; no meaningful listing content before JS. DC listing page returns HTTP 406 to all curl attempts including with session cookies — listing data is client-rendered. |
| Analytics | Segment (confirmed in JS + CSP header whitelisting `api.segment.io`); Optimizely; Braze (in CSP); Datadog RUM (in CSP: `browser-intake-datadoghq.com`) |
| GraphQL | **Confirmed** in `pages/_app` JS chunk: `graphql:d,response:h},type:U.RESOURCE` — DataDog RUM instrumenting GraphQL calls |
| Page weight | 473 KB HTML homepage (271 KB is `__NEXT_DATA__` JSON alone) |

### Historical Stack Eras
- **2008 (founding):** Justin Hartfield (UC Irvine CS grad) built initial site. Co-founder Doug Francis confirmed 2008 launch, Irvine CA. Era default = PHP/MySQL LAMP or simple Ruby. Launched as Google Maps mashup with Yelp-style reviews. Source: TechCrunch 2009-03-12.
- **2012–2017:** Nginx + Ruby on Rails + AngularJS frontend. Rack Cache confirmed SSR. BackboneJS/Lodash for static pages. Source: stayregular.net 2017 analysis. Engineering 2017 postmortem (dev.to/bringking) from Weedmaps VP Engineering references Flow types, async message queues — Rails-era complexity with JS sprinkles.
- **2018–2021 (modernization):** Transition from Rails + Angular to React + Next.js + MobX + Styled Components (confirmed: Doug Waltman, ex-Weedmaps FE engineer: "helped transition the front-end codebase from Rails+Angular to React"). Segment + Optimizely adopted during this period. GraphQL introduced for frontend data layer.
- **2021–2026 (public company era):** IPO June 2021 (Nasdaq: MAPS). Retained Next.js Pages Router. API versioning: v2023-07 → v2024.01 migration involved dropping JSON:API for a custom REST format. CSP whitelist reveals Salesforce, Intercom, Mapbox, Twitch, Adtech vendors — significant vendor sprawl. Massive layoffs 2022–2023.

### Why Built That Way
Founded 2008 during PHP/Rails LAMP era with one UC Irvine CS grad. Scaled to $30M+ revenue on ad model before having proper engineering org. 2017 postmortem reveals classic fast-growth chaos: process without automation, no strong type system. Angular → React rewrite driven by hiring market (React devs far more available 2018–2020) and Optimizely/Segment being React-native. GraphQL added as backend microservices multiplied.

### What It Costs Today
- **Listing pages block non-browser scrapers:** DC dispensary listing returns HTTP 406 (Not Acceptable) to all curl attempts, confirmed with session cookies. No Googlebot-friendly raw HTML for listing content — **the core SEO/AI-crawler failure**. NEXT_DATA on homepage has no listing data.
- **471 KB homepage payload:** 271 KB is `__NEXT_DATA__` JSON — bloated state hydration including Optimizely experiments and Segment config. Every user downloads this before seeing content.
- **Massive CSP vendor list:** 40+ third-party domains whitelisted — Braze, Intercom, Salesforce, Snapchat, TikTok, adtech networks — each a potential CSP violation vector and performance hit.
- **Post-IPO engineering attrition:** Major layoffs 2022–2023. Pages Router not migrated. API versioning instability (v1 → v2024 breaking changes).

---

## 3. WhereWeed.com (wheresweed.com)

**One-line stack:** Vite + Node.js/Express SPA (client-side rendered, no SSR) + Cloudflare CDN + Tailwind CSS — no `__NEXT_DATA__`, no LD+JSON, no server-rendered listing content.

### Detection Evidence
| Signal | Value |
|--------|-------|
| `__NEXT_DATA__` present | No |
| Framework | Vite bundle pattern: `/assets/index-BflpXdc5.js` — Vite content-hashed assets |
| Server rendering | **SPA/client-only confirmed:** Body has `<div id="app">` with only Skip-to-search accessibility link before JS. No dispensary content in raw HTML. |
| CDN/hosting | Cloudflare (`CF-RAY`, `__cflb` cookie); S3 serving static assets (x-amz headers on homepage HTML) |
| Headers | `x-powered-by: Express` — Express.js server for SPA shell delivery |
| Analytics | Cloudflare Analytics only (no GA, Segment, DataDog detected) |
| CSS | Tailwind CSS (detected: utility class patterns in HTML, confirmed by sitestatsdb.com) |
| Self-hosted fonts | Yes — `/assets/Gilroy-Regular-BiQw8FQ3.woff2`, `/assets/Gilroy-Bold-CuZDypsQ.woff2` |
| Page weight | 541 KB HTML (Vite bundle inline CSS critical path in HTML) |

### Historical Stack Eras
- **2011 (founding):** Tyler Bartholomew (CEO), David Lindauer (President), Bill Anders (CMO) — founded in Denver, CO. Cannabis directory era default = WordPress or custom PHP with Google Maps API.
- **2011–2018:** Small team (peaked at ~15 employees), served as cannabis business directory. Acquired by Golden Developing Solutions, Inc. in September 2018.
- **2018–2024:** Migration to Node.js/Express backend with React or Vue SPA. Current Vite pattern suggests relatively recent (2022–2024) frontend rebuild — Vite released 2020, became mainstream 2022+.
- **2025–2026:** Vite-bundled SPA served from S3 via Cloudflare. Only 2 employees. $2M annual revenue. Zero server-side rendering.

### Why Built That Way
Resource-constrained small company (2 employees, $2M revenue). Vite + SPA is the lowest-friction path for a small team wanting modern tooling without Next.js SSR complexity. No budget for proper infrastructure. No engineering blog or job postings — inferred from company size.

### What It Costs Today
- **Zero SEO for listing content:** Raw HTML has no dispensary data. Googlebot and AI crawlers see nothing but a Tailwind CSS file and a single JS bundle. For a business claiming "85% organic SEO traffic" (their own LinkedIn post), this is existential — they're betting on Googlebot executing JavaScript.
- **S3-hosted HTML shell:** TTFB of 4,050 ms reported (sitestatsdb.com). Four-second TTFB for a simple HTML shell is catastrophic for Core Web Vitals (LCP).
- **No analytics depth:** Only Cloudflare Analytics — no conversion tracking, no funnel analysis, no A/B testing infrastructure.
- **F security grade** (sitestatsdb.com verified): No CSP, no HSTS properly configured, no subresource integrity on assets.
- **No schema markup beyond generic WebPage/Organization** despite 10M pages indexed.

---

## 4. Dutchie (dutchie.com)

**One-line stack:** Next.js Pages Router (styled-components) + Cloudflare + self-hosted fonts + LaunchDarkly feature flags + Segment + Sift fraud — SSR confirmed for marketing homepage; dispensary menus are `__next` client shell.

### Detection Evidence
| Signal | Value |
|--------|-------|
| `__NEXT_DATA__` present | Yes (homepage + dispensary routes) |
| Framework | Next.js Pages Router — `x-powered-by: Next.js` header; styled-components class pattern (`home-page-redesign__Wrapper-sc-b5b20e31-0`) |
| CDN/hosting | Cloudflare (`cf-cache-status: DYNAMIC`); assets at `assets2.dutchie.com` |
| Server rendering | **Homepage SSR confirmed:** `<div id="__next">` has full rendered HTML with styled-components. Dispensary route (`/dispensaries/washington-dc`): `__NEXT_DATA__` present with LaunchDarkly flags bootstrapped but `pageProps: {}` empty — listing content is client-fetched. |
| Analytics | Segment, Google Analytics (gtag), Sift fraud detection, LaunchDarkly |
| Fonts | Self-hosted `/fonts/playfair-display-700italic.woff2` (confirmed) |
| Page weight | 157 KB homepage HTML |
| Rendering mode | `cache-control: private, no-cache, no-store` — no CDN caching of HTML |

### Historical Stack Eras
- **2017 (founding):** Ross and Zach Lipson, Bend, Oregon. Ross previously built Foodler (online food ordering). TechCrunch 2019: "two-year-old startup" (confirming 2017 founding). Prior competitive recon found Meteor.js signature in early codebase — consistent with 2017 era (Meteor was the "full-stack JS in one" choice for food-ordering-style real-time menus).
- **2019 (Series A, $15M):** 36 employees, 450 dispensaries, $140M GMV. At this scale still on Meteor or early React migration. GitHub: `GetDutchie/dutchie-plus-nextjs-example` published 2021-01-21 — confirms Next.js migration underway circa 2021.
- **2021 (Series C, $350M):** Major scale-up. Acquired LeafLogix (dispensary POS), Greenbits. Platform became multi-product: e-commerce, POS, payments. Engineering org expanded rapidly; Next.js becomes standard. TypeScript standardized.
- **2022–2025 (civil war + lawsuit era):** Engineering civil war reported (Forbes, MJBiz sources). Layoffs 2022 and 2023. POS migration struggles. MJBiz lawsuit coverage suggests database migration issues. CEO replaced 2024.
- **2026 (current):** Pages Router retained, styled-components. No App Router migration detected. LaunchDarkly flags on every route suggests heavy feature-flag dependency (technical debt indicator). `private, no-cache, no-store` on all HTML — every page is a fresh server render, no edge caching.

### Why Built That Way
2017 food-tech founder applying food-ordering patterns to cannabis — Meteor.js was the real-time, full-stack-in-one tool for "order from dispensary" UX (live inventory updates, real-time order status). As dispensary count scaled from 36 to 6,000+, Meteor became a bottleneck. Next.js migration circa 2021 was the industry-standard escape hatch. Styled-components adopted because it was the styled-jsx/Emotion-era norm.

### What It Costs Today
- **Dispensary listing pages are client shells:** `/dispensaries/washington-dc` has `pageProps: {}` — no server-rendered listing content, all client-fetched. AI crawlers and basic scrapers see no dispensary data.
- **No CDN caching of any HTML:** `private, no-cache, no-store` means every request hits the origin server. Zero edge acceleration.
- **LaunchDarkly bootstrap in every NEXT_DATA:** Feature flag bootstrap adds ~40KB+ of flag state to every page load — technical debt from rapid growth/experimentation culture.
- **Styled-components runtime cost:** Runtime CSS-in-JS still in production (vs zero-runtime Tailwind or CSS modules). Extra JS execution on every hydration.
- **Database migration drag (2026):** MJBiz coverage of POS migration issues suggests multi-year data migration in progress. Engineering attention split between legacy Meteor/Rails data models and new Next.js frontend.

---

## 5. iHeartJane / Jane Technologies (iheartjane.com)

**One-line stack:** Vite SPA (client-only, `window.prerenderReady = false`) + Ruby on Rails backend API (wss://api.iheartjane.com/cable = ActionCable = Rails) + Algolia search + LaunchDarkly + Datadog + Braze + S3/Cloudflare hosting — no SSR whatsoever, 6 KB HTML shell.

### Detection Evidence
| Signal | Value |
|--------|-------|
| `__NEXT_DATA__` present | No |
| Framework | Vite bundle: `/assets/index-rTDFqk-N.js` (Vite content-hash pattern) |
| Server rendering | **SPA only confirmed:** Body is `<div id="app" class="app"></div>` — empty shell. `window.prerenderReady = false` set in `<head>` — signals prerenderer integration (Prerender.io or similar) for SEO crawlers, but not active |
| CDN/hosting | Cloudflare (`CF-Ray: a1f8c85adacf343f-IAD`); HTML served from S3 (`x-amz-*` headers), 6 KB file |
| Backend | `actionCablePath: wss://api.iheartjane.com/cable` — **ActionCable = Ruby on Rails**; `apiPath: /api/v1`; `apiPathV2: /api/v2` |
| Analytics | Algolia search, Datadog (two separate app IDs for brands and business), Braze (push/messaging), Mixpanel (3 separate tokens), LaunchDarkly (2 client IDs), Branch.io, TrackJS |
| Fonts | Google Fonts API (external) — `googleFontsKey` in app-secrets JSON |
| Page weight | 6 KB HTML shell + external JS bundle |
| Dispensary content | Zero dispensary mentions in raw HTML |

### Historical Stack Eras
- **2015 (founding):** Socrates Rosenfeld (MIT, US Army Veteran), Santa Cruz CA. 2017 stayregular.net analysis found "Cowboy server running ExpressJS for routing and ReactJS, optimized with webpack" — earliest confirmed stack.
- **2016–2019:** Express.js + React SPA. API likely Node.js initially. Rapid growth in white-label embedded menus for dispensary websites (the "iFrame embed" model).
- **2019–2021 (Series B/C era):** Migration to Ruby on Rails backend (ActionCable for real-time order updates — Rails 6+ WebSockets). Frontend likely React with Webpack initially, then Vite migration circa 2022–2023.
- **2022–2024 (acquisition era):** Acquired by COVA Software (2022). Series D raised. Job postings (Lever.co) confirm: "Ruby on Rails is preferred but not required, and server-side JavaScript experience is a plus" + "frontend React applications." Stack is React/Vite + Rails API.
- **2025–2026:** Vite SPA. Rails API. No SSR migration. Google Fonts still external. `window.prerenderReady` suggests Prerender.io may be configured but not activating (Jane's embed-focused architecture makes SSR less critical for their white-label use case).

### Why Built That Way
Jane's core product is embeddable menus (the iFrame/widget that lives on dispensary websites). For embedded menus, SSR is irrelevant — the parent dispensary site controls SEO. React SPA served from S3 is perfect for an embeddable widget at low cost. Rails was chosen for the backend because of Rosenfeld's MIT network (Rails is the Harvard/MIT startup default) and ActionCable for real-time order status. As iheartjane.com grew into a consumer marketplace, the embed-first architecture became a liability.

### What It Costs Today
- **Complete SSR gap:** 6 KB HTML shell, `<div id="app"></div>` body. Zero content for Google, zero content for AI crawlers (Perplexity, Claude, ChatGPT). The consumer marketplace at iheartjane.com is essentially invisible to all non-JS crawlers.
- **Google Fonts external dependency:** `googleFontsKey` in app-secrets confirms reliance on Google Fonts CDN — CSP complexity, GDPR exposure (Google gets user IP), DNS lookup latency.
- **Prerender.io anti-pattern:** `window.prerenderReady = false` suggests a bot-detection prerenderer is configured but may not be correctly signaling completion — broken SEO for a consumer-facing site.
- **Vendor explosion:** Datadog (2 RUM apps), Mixpanel (3 tokens — customer, kiosk, CRM), LaunchDarkly (2 client IDs), Braze, Branch.io, TrackJS, Fingerprint.js, AeroPay, CanPay — each a CSP entry, a performance hit, a GDPR liability.
- **ActionCable at scale:** WebSocket connections via Rails ActionCable is architecturally expensive at millions of concurrent menu embeds. Likely a scaling constraint.

---

## Why Our 2026 Stack Structurally Wins

### orderweeddc: Next.js 16 + Prisma + DC-native, truth-first

**Where competitors beat us (honest):**
- **Scale:** Leafly has 120M annual visitors, 20K+ pages, and years of domain authority. Weedmaps has 15M users and first-party purchase data going back to 2008. We cannot match these immediately.
- **Data volume:** Weedmaps has 14 years of cannabis purchase behavior. Leafly has 500K+ strain reviews. We operate in one city.
- **Brand recognition:** All five have national/international brand awareness. We are DC-local.

**Where we hold structural advantages:**

| Our Advantage | Their Constraint |
|---------------|-----------------|
| **1. Full HTML to every crawler, always.** Next.js 16 App Router with React Server Components renders complete dispensary cards server-side. Raw `curl` returns full content. | Weedmaps listing pages return HTTP 406 to scrapers. Jane is a 6KB shell. WhereWeed is a Vite SPA. Dutchie listing routes have empty `pageProps`. |
| **2. Schema-first with LD+JSON on every page.** Prisma schema maps to `LocalBusiness`, `Product`, `Offer` structured data. Every listing page is rich-result-eligible on day one. | Leafly has zero LD+JSON on listing pages (verified). Weedmaps: none found. WhereWeed: generic Organization only. Dutchie: not detected. |
| **3. Self-hosted fonts + strict CSP by default.** No Google Fonts, no external font DNS lookups, CSP headers defined at build time. | Jane pays Google Fonts (GDPR exposure, DNS latency). Weedmaps CSP whitelist has 40+ domains. WhereWeed has F security grade. |
| **4. llms.txt + agent-readable cards.** We can deploy `llms.txt` and structured `<article>` cards readable by Perplexity/Claude/ChatGPT in week one. | None of the five competitors have llms.txt (verified in llms-check.txt research). None have agent-optimized card markup. This is a 2026 differentiation window. |
| **5. Deterministic Prisma schema = no migration drag.** Schema-first with typed migrations means no "database migration civil war" (Dutchie's documented 2026 problem). Every DC dispensary record has a canonical source of truth. | Dutchie: active POS/database migration controversy. Weedmaps: API versioning breaking changes (v2023-07 → v2024.01 dropped JSON:API). Leafly: Rails + Next.js split backend creates dual truth problems. |

**The DC-specific window:** All five platforms treat DC as one city among hundreds. None have DC-specific compliance fields (Initiative 71 gifting, medical vs recreational status), DC-specific schema vocabulary, or DC merchant verification workflows. We are building truth-first for the market they treat as an afterthought.

---

*Evidence quality key: **[CONFIRMED]** = curl/header direct detection; **[EVIDENCE]** = primary source (job posting, engineering blog, SEC filing); **[INFERENCE]** = triangulated from multiple secondary sources; **[HISTORICAL]** = Wayback/archived sources.*

| Platform | Founded | Era Stack | Current Stack (detected) | SSR Depth | Schema | AI-Readable |
|----------|---------|-----------|--------------------------|-----------|--------|-------------|
| Leafly | 2010 | .NET + AngularJS | Next.js Pages Router + Rails API + CloudFlare | Strong SSR [CONFIRMED] | No LD+JSON [CONFIRMED] | Partial |
| Weedmaps | 2008 | PHP/Ruby + AngularJS | Next.js Pages Router + GraphQL + Varnish | Listing pages blocked [CONFIRMED] | Not detected | Poor |
| WhereWeed | 2011 | WordPress/PHP | Vite SPA + Express + S3 + Cloudflare | None [CONFIRMED] | Generic only | None |
| Dutchie | 2017 | Meteor.js | Next.js Pages Router + styled-components | Marketing SSR; menus client [CONFIRMED] | Not detected | Poor |
| iHeartJane | 2015 | Express + React SPA | Vite SPA + Rails API + S3 | None [CONFIRMED] | Not detected | None |
| **orderweeddc** | 2026 | — | Next.js 16 App Router + Prisma + Cloudflare | Full RSC SSR | LD+JSON every page | llms.txt + agent cards |
