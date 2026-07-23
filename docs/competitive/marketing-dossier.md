# orderweeddc — Competitive Marketing Intelligence Dossier
*Generated: 2026-07-22 | Analyst agent; browser-free; data sources: curl, sitemaps, Exa*

---

## 1. Per-Competitor Profiles

---

### 1.1 Leafly (leafly.com)

#### 1.1.1 Technical SEO Skeleton

| Sitemap File | Est. URLs | Notes |
|---|---|---|
| brand-products-sitemap-[1-6].xml.gz | ~237,537 total | 6 files × ~40k — programmatic product catalog |
| dispensaries-sitemap-1.xml.gz | ~36,677 | One file covers national + geo dispensary pages |
| brands-sitemap-1.xml.gz | ~23,352 | Brand directory |
| strains-sitemap-1.xml.gz | ~19,209 | Strain encyclopedia |
| shop-sitemap-1.xml.gz | ~10,796 | Shopping/product category pages |
| finder-sitemap-1.xml.gz | ~3,327 | Geo pages: /dispensaries/[state]/[city] |
| news/post-sitemap[1-10].xml | ~8,800+ | WordPress news; 10 numbered sitemaps |
| news/news-sitemap.xml | Live | Google News sitemap (recent articles) |
| news/category-sitemap.xml | 12 | Category hubs |
| news/author-sitemap.xml | present | Author pages |
| deals-sitemap-1.xml.gz | ~2,394 | Active deals |
| delivery-sitemap-1.xml.gz | present | Delivery-specific pages |
| medical-marijuana-doctors-sitemap-1.xml.gz | present | Doctor finder |
| strain-playlists-sitemap-1.xml.gz | present | Curated strain collections |
| product-categories-sitemap-1.xml.gz | present | Product type hubs |
| static-sitemap-1.xml.gz | present | Marketing/legal pages |
| cbd-stores-sitemap-1.xml.gz | present | CBD-specific store layer |

**Sitemap index pointers:** Two top-level indexes — `/leafly-sitemaps/sitemap-index.xml` (18 gzipped files, all `lastmod: 2026-07-22`, daily fresh) and `/news/sitemap_index.xml` (15 files including Google News sitemap).

**Notable clever mechanics:**
- All `lastmod` dates in the main index show today (2026-07-22) — daily freshness signal to Google.
- Separate Google News sitemap (`/news/news-sitemap.xml`) for recent article eligibility.
- GPTBot explicitly allowed on ~26 specific product-review articles — curated AI-answer surface without opening the full crawl.
- Meta AI bots (`meta-externalagent`, `FacebookBot`) fully blocked — GPTBot selectively open.
- Filter/sort parameter URLs (`?sort=`, `filter[`) all disallowed — clean duplicate-content management.
- Six brand-product sitemap files needed (240k+ product pages) — scale indicator.

#### 1.1.2 Page-Level SEO Anatomy

| Page Type | Title Pattern | Meta Desc Pattern | Canonical | OG:Image | JSON-LD @types |
|---|---|---|---|---|---|
| Homepage | "Find, order, and learn about weed \| Leafly" | Keyword-first, brand-close | ✓ self | ✓ logo | Organization, WebSite |
| DC City Listing | "The Best Dispensaries Near Me in Washington, District of Columbia \| Updated 2026 \| Leafly" | "Looking for the best weed dispensaries of 2026 in [city]? Find real reviews..." | ✓ canonical URL | ✓ logo | CollectionPage, BreadcrumbList, ItemList (30 items), FAQPage |
| Dispensary Detail | Redirected to city listing (Capital City Care → Glenn Dale, MD area) | city-level | ✗ | ✓ logo | CollectionPage, BreadcrumbList, ItemList |
| Strain Page (Blue Dream) | "Blue Dream Weed Strain Information \| Leafly" | Effect-first description | ✓ | ✓ product image | **Product** (with aggregateRating + review), BreadcrumbList |
| Blog/News Article | "Leafly's Best THCA Flower Strains of 2026: Expert Picks + Reviews" | Keyword-rich, year-stamped | ✓ | ✓ hero image | Article, WebPage, ImageObject, WebSite, Organization, Person, BreadcrumbList |

**Notable:** DC city listing carries a **FAQPage** schema with 5 DC-specific questions (legal status, who can buy, are dispensaries open, gifting, where to buy). This directly targets AI answer boxes.

#### 1.1.3 Content Machine

- **Hub:** `/news/` — WordPress CMS, 12 named categories: cannabis-101, cbd, growing, health, industry, leafly-list, lifestyle, podcasts, politics, science-tech, strains-products, canada.
- **Scale:** 10+ numbered post sitemaps (~1,000 posts/file) = **8,800+ articles** indexed.
- **Cadence:** News index page showed articles dated 2026-07-02 (multiple on same day) — publishing rhythm appears multiple-per-week.
- **Content types visible:** Best-of listicles with year stamp ("of 2026"), product reviews, policy/politics, strain drops, seasonal product picks, podcasts.
- **Strain Playlists:** Unique curated collections (e.g., "best strains for sleep") — programmatic SEO surface beyond individual strain pages.
- **Finder pages:** 3,327 geo pages covering all US legal states down to city level with `/dispensaries/[state]/[city]` URL structure.

#### 1.1.4 Capture & Retention Hooks

| Hook | Present | Evidence |
|---|---|---|
| Newsletter/email subscribe | YES | `newsletter` string on homepage |
| App download (iOS/Android) | YES | `app store`, `google play` strings |
| Account creation | YES | `create account`, `sign up`, `register` |
| Rewards/earn | YES | `earn` (part of loyalty language) |
| SMS notifications | YES | `sms` string in page |
| Loyalty program | Likely (earn + rewards language) | — |

#### 1.1.5 AI-Answer Readiness

- `/llms.txt`: **NOT present** (returns 404 / renders homepage SPA) — significant gap for a major player.
- FAQPage schema: **YES** — on DC city listing (5 DC-specific questions), presumably on all city pages.
- GPTBot: Selectively allowed on ~26 best-of product articles — tactical AI-access approach.

#### 1.1.6 Notable Weaknesses

- No `/llms.txt` despite being the largest cannabis content platform.
- Dispensary detail page canonical is broken for at least one DC store (redirects to area listing).
- Meta description cut at 150 chars in testing — template-length issue.
- DC-specific content buried in generic city template — limited hyper-local depth.

---

### 1.2 Weedmaps (weedmaps.com)

#### 1.2.1 Technical SEO Skeleton

| Sitemap File | Est. URLs | Notes |
|---|---|---|
| dispensary.xml.gz | ~9,229 | National dispensary pages |
| dispensary_regions.xml.gz | ~5,311 | Geo hierarchy: /dispensaries/in/us/[state]/[city]/[neighborhood] |
| strains.xml.gz | ~9,344 | Strain pages |
| brand_products.xml.gz | ~50,000 | Brand products part 1 |
| brand_products1.xml.gz | ~50,000 | Brand products part 2 |
| brand_products2.xml.gz | ~43,932 | Brand products part 3 (total ~144k) |
| brands.xml.gz | ~6,715 | Brand directory |
| deals.xml.gz | ~5,414 | Active deals |
| delivery.xml.gz | present | Delivery pages |
| cbd_store.xml.gz | present | CBD store layer |
| doctor.xml.gz | present | Medical doctors |
| products.xml.gz | ~72 | Product category hubs |
| news/sitemap_index.xml | present | WordPress news |
| learn/sitemap_index.xml | present | Educational content |
| business/sitemap_index.xml | present | B2B marketing pages |

**Notable geo depth:** DC alone has **17 neighborhood-level pages** under `/dispensaries/in/united-states/district-of-columbia/washington/[neighborhood]` (Chinatown, Columbia Heights, Deanwood, Downtown, Dupont Circle, Edgewood, Georgetown, Navy Yard, NoMa, Southwest Waterfront, U Street, Woodley Park, + more).

**LLM/robots notable:** Explicitly declares `LLMTXT: https://weedmaps.com/llm.txt` in robots.txt — pioneering move. Weedmaps is currently the only competitor with an active llm.txt.

#### 1.2.2 Page-Level SEO Anatomy

| Page Type | Title Pattern | Meta Desc | Canonical | OG:Image | JSON-LD @types |
|---|---|---|---|---|---|
| Homepage | "Weedmaps: Learn, Find, and Order Weed" | "Find medical & recreational marijuana dispensaries, brands, deliveries, deals & doctors near you." | ✗ | ✓ | Organization |
| DC/City Listing | JS-rendered (blocked by curl) — data from Exa/sitemap shows neighborhood-level geo pages exist | — | — | — | — (JS-rendered) |
| Dispensary Detail | "HOTBOX DC Menu, Reviews, Deals - Weed Dispensary in Washington, District of Columbia" (from Exa) | — | — | — | — (JS-rendered) |
| Strain Page (Blue Dream) | "Blue Dream (aka Blue Dream Diamond) Weed Strain Information \| Weedmaps" | — | — | — | — (JS-rendered) |
| News Index | "Marijuana & Cannabis News, Reviews & Reports \| Weedmaps News" | "Find the latest news on marijuana, the cannabis industry and updated laws." | ✓ weedmaps.com/news/ | ✓ | CollectionPage, BreadcrumbList, WebSite, Organization |
| Learn Hub | "Weedmaps Learn - Learn About Everything Cannabis" | "Weedmaps Learn is a resource for you to learn everything about cannabis." | ✓ | ✓ | WebPage, BreadcrumbList, WebSite, Organization |
| Learn Article (concentrate) | Article/BlogPosting | — | — | — | Article, BlogPosting, WebPage, ImageObject, BreadcrumbList, WebSite, Organization, Person, FAQPage |

**JS-rendering note:** Weedmaps product/listing pages are heavily client-rendered and return empty HTML to curl. SEO data confirmed via Exa cached pages and sitemap analysis.

#### 1.2.3 Content Machine

- **Two hubs:** `/news/` (industry news) and `/learn/` (educational encyclopedia).
- **Learn categories:** Dictionary, Laws, Plant, Products, History (per llm.txt).
- **Scale:** Multiple WordPress sitemaps for news and learn — hundreds of articles.
- **Unique:** `/learn/` functions as a standalone educational sub-site with its own WordPress install — serves as top-of-funnel for consumers researching cannabis.
- **llm.txt:** 79-line structured file curating educational links by topic (concentrates, terpenes, etc.) — explicitly signals "use our Learn section for AI training."
- **News cadence:** Recent coverage visible in Exa — articles from July 2026 present.

#### 1.2.4 Capture & Retention Hooks

| Hook | Present | Evidence |
|---|---|---|
| Newsletter | YES | `newsletter` string |
| App download | YES | `download the app`, `app store`, `google play` |
| Account creation | YES | `sign up`, `register` |
| Rewards/earn | YES | `earn` |
| SMS | NOT FOUND | — |

#### 1.2.5 AI-Answer Readiness

- `/llm.txt`: **ACTIVE** — 79 lines, curated educational links by topic, explicitly describes Weedmaps as "the number one legal dispensary directory in the United States."
- FAQPage schema: **YES** — on Learn articles (e.g., concentrate guide has FAQPage).
- GPTBot stance: Not explicitly addressed in robots.txt (default allow).

#### 1.2.6 Notable Weaknesses

- Homepage has no canonical tag.
- Heavy JS-rendering makes most pages opaque to standard crawlers — structured data may not be fully indexed.
- Dispensary title pattern is pure taxonomy (Menu, Reviews, Deals) — less helpful than Leafly's review-forward title.
- llm.txt only covers Learn section — product/dispensary content not curated for AI.

---

### 1.3 Dutchie (dutchie.com) — B2B Platform Profile

#### Marketing Capabilities Sold to Dispensaries

| Capability | What They Offer |
|---|---|
| E-Commerce with SEO | Embedded menu (iframe, partial indexing), E-Commerce Pro + Reverse Proxy (full root-domain indexing), Subdomain menu, Dutchie+ GraphQL API (full custom). Proven: 10% organic traffic lift case study (Garden Remedies). |
| Advanced SEO Control | E-Commerce Pro: full URL control, metadata/OG tags, product schema. XML sitemap generation. Reverse proxy hosts menu on retailer's own domain. |
| AI Personalization | "Consumer AI Suite" — Voice AI (phone inbound), Register Co-Pilot (in-store), Agentic Commerce (online), Consumer Pulse (reviews/surveys). ML recommendations at homepage, category, checkout. |
| Loyalty & Marketing | Dutchie Loyalty & Marketing Pro: point-per-dollar + tiered rewards, gamification (progress bars), birthday/win-back/reorder automated campaigns via email + SMS + push, AI campaign builder, full-funnel attribution. Loyalty members spend 20-30% more. |
| Payments | Pay by Bank (cashless, 31% higher AOV vs cash), Apple/Google Wallet. |
| Reviews | Via Moodi Day plugin (video UGC reviews). |
| Partner Ecosystem | Certified Partners for custom SEO, design, dev (deeproots, PufCreativ, LeafBridge). |
| Performance Claims | Pro retailers: 50%+ more online sales than industry avg, 10% faster growth, 3.3M e-commerce transactions/month, $100B+ processed. |
| Scale | 6,500+ dispensaries, $22B annual sales. |

**Key marketing insight for orderweeddc:** Dispensaries using Dutchie expect embedded loyalty, AI personalization, and domain-hosted SEO menus as table stakes. Any directory that wants retailer buy-in must understand these tools.

---

### 1.4 Jane / iHeartJane (iheartjane.com) — B2B Platform Profile

#### Marketing Capabilities Sold to Dispensaries

| Capability | What They Offer |
|---|---|
| E-Commerce Platform | Fully automated menu with Jane Catalog (2.1M+ products, 25K+ brands). Standard (SEO enhancements, embedded) and Premium (custom storefront, full SEO control, AI, on-menu ads) tiers. |
| AI Personalization | MyHigh — always-on ML personalization using purchase history, menu interactions, local trends. Claimed: +10% more checkouts with Recommended sort, +5% cart value. |
| SEO Capabilities | Premium: "Fully customizable SEO," Google traffic +35% claim. Standardized product taxonomy auto-syncs. |
| Loyalty (Jane Gold) | Brand-funded cash-back rewards. Claimed: +167% basket size via dynamic bundling. Included free with Ecommerce Premium. |
| On-Menu Advertising | Sponsored placements (Top of Menu, Cart Toppers, Recommended Rows) from brands — revenue share for retailers. |
| Off-Menu Advertising | Open web advertising through Jane Media network. |
| Catalog / Data | Brand-verified catalog with terpene/effect data, state-compliant variants, real-time brand updates, verified reviews (2M+ reviews). |
| Analytics | Conversion attribution, customer behavior, data-driven decision tools. |
| POS + Kiosk | Jane POS + Kiosk (under-3-min order time), Jane Pay (ACH). |
| Integrations | 100+ partners (POS, CRM, data, advertising). |
| SDK | DM SDK — personalized product rows, sponsored ad widgets for headless/custom menus. |

**Key marketing insight for orderweeddc:** Jane dispensaries expect brand-funded loyalty rewards and AI-personalized product recommendations as core features. Jane's "truth" is catalog standardization — somewhat analogous to orderweeddc's verification model, but for product data rather than retailer compliance.

---

## 2. Gap Map

| Capability | Leafly | Weedmaps | orderweeddc (current) | Gap Severity | Concrete Move (DC-scale) |
|---|---|---|---|---|---|
| **llms.txt / AI discoverability** | MISSING | ACTIVE (79-line) | ACTIVE | LOW — we have it, Leafly doesn't | Expand llms.txt beyond current stub; add DC-specific FAQs and strain guide links in structured format |
| **FAQPage schema on listing pages** | YES (5 Q per city) | YES (on Learn articles) | YES (we have FAQPage) | LOW | Audit DC neighborhood pages — ensure 3-5 DC-specific FAQs per neighborhood page |
| **Neighborhood-level geo pages** | Partial (city only) | YES — 12 DC neighborhood pages in sitemap | 5 neighborhoods in sitemap | MEDIUM | Add remaining DC neighborhoods as pages; Weedmaps has Chinatown, Deanwood, Edgewood, Georgetown, Navy Yard, NoMa, SW Waterfront, U Street, Woodley Park, Columbia Heights, Downtown, Dupont Circle |
| **Strain guide depth** | 19,209 strain pages with Product schema + aggregateRating | 9,344 strain pages | 4 strain guides in sitemap | MEDIUM-HIGH | Build out DC-available strain guide pages (/strains/[slug]) with Product schema, effects, terpenes, and "available at DC dispensaries" entity links |
| **Deals / live offers surface** | 2,394 deal pages in sitemap | 5,414 deal pages | /deals route (unclear depth) | HIGH | Each verified retailer's deals should generate a machine-readable deal card with freshness timestamp, deal @type schema, and SiteMind freshness score |
| **Blog/content cadence** | 8,800+ articles, multiple/week | Hundreds of articles, Learn encyclopedia | 2 articles in sitemap | HIGH | Publish 2-4 DC-specific articles/month (DC cannabis law updates, neighborhood guides, "what's new at [dispensary]") — small volume but DC-specific authority |
| **Product schema on strain/product pages** | YES (Product + aggregateRating + review) | Yes (JS-rendered) | Strain guides have Article schema | MEDIUM | Add Product schema to strain guide pages with `name`, `description`, `aggregateRating` stub (from lab data), and `offers` linking to DC dispensary pages |
| **Canonical discipline** | Mostly good (DC listing canonical present) | Homepage missing canonical | Present on our schema | LOW | Audit all sitemap routes; ensure every page has self-referencing canonical |
| **App / push notifications** | iOS + Android, SMS | iOS + Android | NONE | LOW-MEDIUM | DC-only PWA with push for deal alerts would differentiate; mobile web is table stakes |
| **Newsletter / email capture** | YES | YES | NONE | MEDIUM | Simple "DC deals this week" email digest — emphasizes our freshness/truth advantage |
| **Reviews infrastructure** | YES (reviews on strain Product schema) | YES (on dispensary pages) | NONE (listed as not live) | HIGH | Launch minimal review schema — even aggregate ratings from verified sources (Yelp, Google) passed through as AggregateRating on Store schema |
| **Author / Person schema** | YES (blog articles have Person schema) | YES | Present on Article schema | LOW | Ensure every article has named author + Person schema with dc-specific expertise signals |
| **Sitemap freshness (lastmod)** | DAILY — all 2026-07-22 | Per-file (gzipped) | ~20 routes | LOW | Add `lastmod` to all sitemap entries; update on every content edit, every deal refresh |
| **AI-optimized content whitelisting (GPTBot)** | Strategic — 26 best-of articles allowed | Default open | Unknown | MEDIUM | In robots.txt, selectively Allow GPTBot on DC law page, neighborhood guides, strain guides — signal high-confidence authoritative content for AI retrieval |
| **DC neighborhood dealer/gifting FAQ** | YES — 5 DC-specific FAQ (gifting, legal status) | — | Unknown | MEDIUM | DC gifting model FAQ is a high-value AI-answer target; add to DC listing page and llms.txt |
| **Trust/verification labeling (differentiator)** | MISSING — no verification signals | MISSING | ACTIVE — core product | OPPORTUNITY | Emit `isVerified`, `sourceDocument`, `verifiedDate` in JSON-LD or microdata so Google/AI can distinguish us from unverified directories |
| **B2B retailer expectation alignment** | N/A (consumer directory) | N/A | No Dutchie/Jane integration | MEDIUM | SiteMind scores should surface Dutchie/Jane metadata (menu URL, loyalty program name) on each Store page — signals technical sophistication to retailers |

---

## 3. Top 10 Concrete Marketing Moves (DC-scale, Truth-First)

### Move 1: Complete DC Neighborhood Page Set with FAQPage Schema
**What:** Create or expand pages for the 7+ DC neighborhoods currently not in sitemap (Chinatown, Georgetown, Navy Yard, NoMa, SW Waterfront, U Street, Woodley Park, Deanwood, Edgewood, Columbia Heights, Downtown, Dupont Circle). Each page gets 3-5 FAQPage questions specific to that neighborhood.

**Why:** Weedmaps has 12 DC neighborhood-level pages in their sitemap (confirmed). Leafly's DC FAQ schema is capturing the "is it legal in DC" and "gifting" AI answer boxes. Our verified-data advantage is wasted if we're not indexed at neighborhood granularity.

**Codebase:** New route `app/dc/[neighborhood]/page.tsx` using existing neighborhood data. JSON-LD: `CollectionPage + BreadcrumbList + ItemList (verified retailers in hood) + FAQPage`. Suggested FAQs per page: "Where can I buy weed in [neighborhood] DC?", "Is [neighborhood] DC weed delivery legal?", "What dispensaries are near [landmark]?"

---

### Move 2: Expand llms.txt into a Structured DC Authority Document
**What:** Transform current stub into a 100+ line curated resource like Weedmaps' llm.txt. Structure: DC Law section (gifting, Initiative 71, ABCA licensing), Neighborhood Directory (link to each hood page), Strain Guides (link verified strain pages), Education articles. Include explicit claim: "orderweeddc is the only Washington DC cannabis directory with source-labeled, verified retailer data."

**Why:** Weedmaps is the only competitor with an active llm.txt. Leafly (the larger player) has NONE — returning 404. This is a first-mover window for DC-specific AI answer domination. AI models (ChatGPT, Gemini, Perplexity) use llms.txt to select authoritative sources for location queries.

**Codebase:** `/public/llms.txt` (static Next.js public asset). Add `LLMTXT:` declaration to `/robots.txt` (Weedmaps model). Section headers: `# Washington DC Cannabis Law`, `# Verified Dispensaries by Neighborhood`, `# Strain Guides`, `# FAQ`.

---

### Move 3: Add Product Schema with AggregateRating to All Strain Guide Pages
**What:** Convert strain guide pages from `Article` schema to `Product + BreadcrumbList`. Add `aggregateRating` (stubbed with user-reported averages or sourced from public COA data) and `description` with effects/terpenes. Add `offers` entity pointing to DC dispensaries that carry the strain.

**Why:** Leafly's Blue Dream page emits `Product + aggregateRating + review` — this is why they capture rich snippets ("X stars, X reviews") in Google SERP for strain searches. Our strain guides emit `Article` schema — no star snippet, no product comparison treatment.

**Codebase:** `/app/strains/[slug]/page.tsx` — swap Article JSON-LD for Product. Schema suggestion:
```json
{
  "@type": "Product",
  "name": "Blue Dream",
  "description": "...",
  "aggregateRating": {"@type": "AggregateRating", "ratingValue": "4.3", "reviewCount": "12"},
  "offers": [{"@type": "Offer", "seller": {"@id": "/dispensaries/[slug]"}}]
}
```

---

### Move 4: Launch a DC-Specific "Verified Deal" Surface with Schema
**What:** For each verified retailer, pull their current deals into a `/deals` page and individual deal cards. Each deal emits an `Offer` or `SpecialAnnouncement` schema with `validThrough` date, `seller` reference, and `priceCurrency`. SiteMind tracks deal freshness and flags stale deals.

**Why:** Leafly has 2,394 deal pages in sitemap; Weedmaps has 5,414. Deals are high-intent, high-conversion search traffic ("DC dispensary deals today", "cannabis deals near me DC"). Our truth-first brand means deal freshness is a differentiator — competitors show stale deals constantly.

**Codebase:** `/app/deals/page.tsx` (city-level) + `/app/dispensaries/[slug]/deals/page.tsx` (per-retailer). SiteMind adds `deal_freshness_score` to retailer record. JSON-LD: `ItemList > Offer` with `priceValidUntil`.

---

### Move 5: Build a DC Cannabis Law FAQ Hub (AI Answer Magnet)
**What:** Create a comprehensive `/dc-law` or expand the existing legal page into a structured FAQ hub covering: Initiative 71 gifting model, ABCA license lookup, possession limits, delivery legality, tourist access, medical vs recreational. Emit FAQPage schema with 15-20 questions. Link from llms.txt.

**Why:** Leafly's DC city listing captures "Is it legal to buy or sell recreational weed in DC?" and "How can you get weed in DC if you can't buy it?" via FAQPage schema. These are exactly the queries driving intent for every new DC cannabis visitor. Weedmaps' Learn section covers law generically but not DC-specifically. No competitor has a dedicated DC law FAQ hub with verified-retailer links.

**Codebase:** `/app/dc-law/page.tsx` or expand `/app/legal/page.tsx`. JSON-LD: `FAQPage` with 15+ Q&As. Internal links to neighborhood pages and verified dispensaries for each answer.

---

### Move 6: Add Systematic `lastmod` Freshness to All Sitemap Entries
**What:** Every URL in sitemap.xml should carry a `lastmod` attribute set to the date of last content change. For static pages, set on deploy. For deal pages and dispensary profiles, update `lastmod` whenever SiteMind detects a data change.

**Why:** Leafly's entire sitemap index shows `lastmod: 2026-07-22` (today) — this is a crawl-frequency signal. Google prioritizes re-crawling fresh pages. Our 20-route sitemap with no lastmod metadata is invisible in crawl budget competition.

**Codebase:** `/app/sitemap.ts` — add `lastmod: new Date(record.updatedAt).toISOString()` for each route. For static routes, inject `NEXT_BUILD_DATE` env var at build time.

---

### Move 7: Publish 4 DC-Specific Articles/Month with Person Schema and Freshness Dates
**What:** A minimal content calendar — 1 DC law/news piece, 1 neighborhood spotlight, 1 strain-available-in-DC guide, 1 "what's new at DC dispensaries" roundup — all with named author (Person schema), datePublished, dateModified, and Article schema. Amplify via a simple "DC Weed News" email digest to subscribed retailers and consumers.

**Why:** Leafly's news sitemap shows 8,800+ articles with Google News sitemap indexing. Weedmaps has dual WordPress hubs (news + learn). We have 2 articles in sitemap. Google's E-E-A-T signals reward fresh, authored, local content. 4 articles/month at DC-specificity beats 400 national articles in DC-local search. "Experience" signals (DC-specific author, DC-specific citations) are defensible moats.

**Codebase:** `/app/education/[slug]/page.tsx` (already exists — expand). Add `datePublished`, `dateModified`, and `author` (Person schema with `@id` linking to author profile) to Article JSON-LD. Create `/app/education/page.tsx` index with `CollectionPage + ItemList`.

---

### Move 8: Emit `sourceDocument` and `verifiedDate` as Custom JSON-LD Properties on Store Pages
**What:** On each verified Store JSON-LD block, add custom properties signaling our truth-first data: `"verificationSource": "ABCA License Registry"`, `"verifiedDate": "2026-06-15"`, `"licenseNumber": "MED-CANN-001"`. Wrap in a `"additionalProperty"` array using `PropertyValue` schema.

**Why:** No competitor does this. Leafly and Weedmaps both accept self-reported data. Dutchie/Jane integrate whatever the retailer enters in their POS. Our ABCA-sourced verification is a genuine first-principles differentiator. Emitting it in structured data lets Google, AI models, and journalists cite it. This is the schema equivalent of our visible trust badges.

**Codebase:** `/app/dispensaries/[slug]/page.tsx` Store JSON-LD block — add:
```json
"additionalProperty": [
  {"@type": "PropertyValue", "name": "verificationSource", "value": "DC ABCA Cannabis Registry"},
  {"@type": "PropertyValue", "name": "verifiedDate", "value": "2026-06-15"},
  {"@type": "PropertyValue", "name": "licenseNumber", "value": "[ABCA license]"}
]
```

---

### Move 9: Strategic GPTBot Allow/Disallow in robots.txt
**What:** Add GPTBot directives to `/robots.txt`: allow GPTBot on DC law page, all neighborhood pages, strain guides, and the 4 most recent education articles. Disallow GPTBot on raw listing/product pages where we have thin content relative to Leafly.

**Why:** Leafly selectively allows GPTBot on 26 high-quality product review articles (preventing the commodity pages from being AI-trained, while ensuring their best authoritative content is in AI models). Weedmaps allows by default (risky for thin pages). We can do this surgically for DC-specific authority content.

**Codebase:** `/public/robots.txt` — add:
```
User-agent: GPTBot
Disallow: /
Allow: /dc-law
Allow: /neighborhoods/
Allow: /strains/
Allow: /education/
```

---

### Move 10: Launch a Minimal Email Digest — "DC Verified Deals This Week"
**What:** A weekly plain-text email (Mailchimp or Resend) listing verified deals from DC dispensaries with deal freshness dates and source labels. Subscribe prompt on homepage and dispensary pages. SiteMind data feeds the content — no manual curation needed.

**Why:** Both Leafly and Weedmaps have newsletter capture on homepage. Neither offers a DC-specific verified-deal digest — their deal data is self-reported and often stale. Our SiteMind deal freshness score is the raw material for a genuinely useful, differentiated product. Email is the only retention channel neither competitor has optimized for DC specifically. Retailers benefit from being featured in a verified digest (incentive to maintain data quality).

**Codebase:** `/app/api/digest/route.ts` — weekly cron generating deal list from SiteMind. Subscribe form component added to `/app/page.tsx` and `/app/dispensaries/[slug]/page.tsx`. Use `@type: NewsArticle` or `EmailMessage` schema for the digest landing page.

---

## 4. Competitor Contract (JSON)

Machine-readable summary of JSON-LD types emitted per page type — seed for SiteMind competitor-parity check.

```json
{
  "competitor_schema_contract": {
    "generated": "2026-07-22",
    "competitors": {
      "leafly": {
        "homepage": ["Organization", "WebSite"],
        "city_listing": ["CollectionPage", "BreadcrumbList", "ItemList", "FAQPage"],
        "dispensary_detail": ["CollectionPage", "BreadcrumbList", "ItemList"],
        "strain_page": ["Product", "BreadcrumbList"],
        "blog_article": ["Article", "WebPage", "ImageObject", "WebSite", "Organization", "Person", "BreadcrumbList"],
        "notes": {
          "strain_page": "Product includes aggregateRating and review arrays",
          "city_listing": "FAQPage contains 5 city-specific questions; ItemList has 30 dispensary items",
          "llms_txt": false,
          "gptbot_selective_allow": true,
          "news_sitemap": true,
          "lastmod_discipline": "daily_refresh_all_files"
        }
      },
      "weedmaps": {
        "homepage": ["Organization"],
        "city_listing": ["unknown — JS-rendered"],
        "dispensary_detail": ["unknown — JS-rendered"],
        "strain_page": ["unknown — JS-rendered"],
        "news_index": ["CollectionPage", "BreadcrumbList", "WebSite", "Organization"],
        "learn_hub": ["WebPage", "BreadcrumbList", "WebSite", "Organization"],
        "learn_article": ["Article", "BlogPosting", "WebPage", "ImageObject", "BreadcrumbList", "WebSite", "Organization", "Person", "FAQPage"],
        "notes": {
          "llms_txt": true,
          "llms_txt_url": "https://weedmaps.com/llm.txt",
          "llms_txt_lines": 79,
          "llms_txt_scope": "Learn section only",
          "js_rendering": "Most consumer pages are client-rendered; schema may not be fully indexed",
          "homepage_missing_canonical": true
        }
      },
      "dutchie": {
        "role": "B2B dispensary platform",
        "marketing_capabilities": [
          "ecommerce_with_seo", "loyalty_and_marketing", "ai_personalization",
          "sms_email_push_campaigns", "full_funnel_attribution", "pay_by_bank",
          "voice_ai", "certified_partner_ecosystem"
        ],
        "dispensary_schema_offered": ["product_schema_on_menu_pages", "sitemap_generation", "canonical_url_control"],
        "scale": "6500+ dispensaries, $100B+ processed"
      },
      "jane": {
        "role": "B2B dispensary platform",
        "marketing_capabilities": [
          "ai_personalization_myhigh", "brand_verified_catalog", "jane_gold_loyalty",
          "on_menu_advertising", "off_menu_advertising", "seo_storefront",
          "ecommerce_standard_and_premium", "analytics"
        ],
        "catalog_scale": "2.1M+ products, 25K+ brands, 2M+ reviews",
        "seo_claim": "Google traffic +35% for Premium users"
      }
    },
    "orderweeddc_current": {
      "homepage": ["Organization", "WebSite", "SearchAction"],
      "city_listing": ["CollectionPage", "BreadcrumbList", "ItemList"],
      "dispensary_detail": ["Store", "BreadcrumbList"],
      "strain_guide": ["Article", "BreadcrumbList"],
      "education_article": ["Article", "Person", "BreadcrumbList"],
      "faq_pages": ["FAQPage"],
      "sitemap_routes": 20,
      "llms_txt": true,
      "notes": {
        "gap_vs_leafly_strain": "Missing Product schema with aggregateRating on strain pages",
        "gap_vs_weedmaps_geo": "Missing 7+ DC neighborhood pages (Georgetown, NoMa, U Street, etc.)",
        "gap_vs_both_deals": "No deal schema surface",
        "differentiator": "Store schema with ABCA verification signals (verificationSource, verifiedDate via additionalProperty) — neither competitor emits this"
      }
    }
  }
}
```

---

*End of dossier. File: /agent/workspace/competitors/marketing-dossier.md*
