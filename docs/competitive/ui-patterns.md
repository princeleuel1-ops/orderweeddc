# Competitor UI Design Patterns — Washington D.C. Cannabis Directory
**Reconnaissance Date:** July 22, 2026
**Viewport:** 1440 x 900 (desktop)
**Targets Captured:** Leafly (4 pages), Weedmaps (4 pages), Dutchie (2 pages), Jane/iHeartJane (1 page)

---

## 1. LEAFLY
**Status:** Fully captured — homepage, DC listing (+ scroll), dispensary detail (Apple Dream Shop), strain page (Blue Dream)

### Overall Register
- **Light/white dominant.** Background is white (#ffffff), heavy use of open whitespace.
- **Accent color:** Leafly Green — a distinctive medium-bright green used on CTAs, ratings stars, nav links, and hover states. Estimated ~#4CB978 / #5CB85C range.
- **Typography:** Sans-serif, generous sizing. Headings are bold and hierarchical. Body text is readable at ~15–16px equivalent. Very editorial feel.
- **Overall vibe:** Clean, approachable, trust-forward. Feels like a "wellness + retail" brand, not a head-shop. This is intentional positioning.

### Navigation
- **Top-level nav items:** Shop, Learn, News | Dispensaries, Strains, Products, Brands, Deals — split into two semantic groups
- **Sticky behavior:** Header appears to sticky at top
- **Search:** Prominent search bar in header — searches across dispensaries, strains, products, and brands in a single unified field
- **Location:** Location selector present in header for geo-filtering
- **Account:** Sign up / Login in upper right

### Homepage Hero
- **Headline:** "Find your feel" — aspirational and benefit-oriented, not product-first
- **Hero layout:** Large image carousel (advertising carousel) dominates the above-fold space
- **Primary CTAs:** "Find dispensaries", "Find strains", "Sign up"
- **Imagery:** Photography — lifestyle, product, and store imagery. Human subjects appear in some carousel positions.
- **Search bar** is prominent and multi-purpose

### DC Dispensary Listing Page
- **Two-column layout:** List on the left (~65% width), sticky map on the right (~35%)
- **Map:** Interactive with pins, loads alongside the list, stays sticky while scrolling
- **Filter bar:** Horizontal pills — "Open now", "Pickup", "Delivery", "Deals" etc. Filters are pill/chip style above the list
- **Sort:** Sort dropdown (by rating, distance, etc.)
- **Card anatomy (very detailed):**
  - Cover photo (banner image of dispensary, large)
  - Dispensary logo (small inset)
  - Name (bold, prominent)
  - Star rating + review count (e.g., "4.8 (321)")
  - Business type badge: "MED" or "MED & REC" pill
  - Open/Closed status with color coding
  - Distance from user
  - Service options: Delivery, Pickup, Curbside — shown as small icon+text badges
  - Deal count ("3 deals" link)
  - Featured customer review snippet
- **Density:** Approximately 3–4 cards visible per viewport; cards are generous in height
- **Sponsored results:** Listed first with subtle "Sponsored" label
- **SEO content block:** Below the listings, there is a long-form text block about DC cannabis laws, followed by an FAQ accordion — clearly for SEO

### Dispensary Detail Page (Apple Dream Shop)
- **Page structure:** Header → Hero banner → Dispensary name, rating, address → Tab nav → Content sections → Footer
- **Tab navigation:** Main | Menu | Deals | Reviews — clean horizontal tabs
- **Menu categories shown:** Flower, Concentrate, Edible, Cartridge, Pre-roll, Accessory — as horizontal category pills/chips
- **Business info panel:** Address, phone, hours (all days listed) — cleanly formatted
- **Deals:** Prominently shown with deal text (e.g., "Buy 2 get 1 free on edibles")
- **Reviews:** Star rating summary + review text + "Write a review" CTA
- **CTAs:** "Favorite" (heart icon), delivery address confirmation, "shop all products"
- **Trust signals:** Review count, rating stars, hours verification, license type badge

### Strain Page (Blue Dream) — SEO Monster
- **Page structure:** Full-width hero → Key metrics → Effects section → Terpenes → Flavors → User reviews → Where to buy
- **Metrics displayed above fold:** THC %, CBD %, strain type (Hybrid), calming/energizing spectrum
- **Effects:** Visual pill tags (Creative, Euphoric, Happy) with user-reported percentages
- **Flavors:** Similar pill tags (Berry, Blueberry, Sweet)
- **Terpenes:** Named with icons (Myrcene, Pinene, Caryophyllene)
- **Review count:** 14,909 — the volume itself is a trust signal
- **Photos gallery:** User-submitted strain photos (24,000+ referenced)
- **"Where to buy" section:** Links to nearby dispensaries stocking this strain — a conversion bridge from content to commerce
- **"Ready to try this strain?" CTA** — conversion nudge embedded in the educational content

### Leafly: What It Does Best
1. **Unified search** across all entity types from one box
2. **Strain pages as SEO flywheel** — rich data, huge review volumes, links to commerce
3. **Card anatomy completeness** — cards show everything a user needs to decide: distance, open/closed, deal count, service type, photo
4. **Side-by-side map + list** with smooth scroll-linking
5. **Structured data depth** on strains (terpenes, flavors, effects, energizing scale)

### Leafly: Visible Weaknesses
- **Ad-first listing:** Sponsored listings first can feel pushy; trust erosion possible
- **Age gate** on dispensary detail pages — friction in the conversion funnel
- **Very long pages** with lots of SEO-filler content below the main results
- **Dense information overload** on dispensary cards can feel cluttered on smaller screens
- **Page weight** seems heavy — likely slow on mobile

---

## 2. WEEDMAPS
**Status:** Fully captured — homepage, DC listing (+ scroll), dispensary detail (FireTuned), deals page

### Overall Register
- **Dark-mode adjacent.** Weedmaps uses a distinctive dark green (#00A878 / emerald range) + black/very dark navy palette for their primary UI
- **Logo/Brand:** Green "WM" wordmark; distinctly brand-forward
- **Typography:** Clean sans-serif, slightly more compact than Leafly. Headings are bold.
- **Overall vibe:** More transactional, feature-dense. Less "wellness lifestyle," more "cannabis marketplace." Heavier use of promotional elements.

### Navigation
- **Primary nav:** Dispensaries, Deliveries, Brands, Products, Deals, Learn, Strains — similar categories to Leafly but "Deliveries" is explicitly separate from "Dispensaries" (showing the service-type differentiation they invest in)
- **Secondary utility nav:** Notifications, Favorites, Shopping bag — more e-commerce signaling
- **Search:** Top-center, "Search Weedmaps" field — universal search
- **Location:** Prominent location selector in header
- **Sign up / Log in** in top right

### Homepage Hero
- **Carousel/slider** as hero — 4 slides navigable
- **Hero text:** "Learn, Find, and Order Weed" — direct, utilitarian
- **Below-fold sections:** Browse by category, Delivery services, Dispensary storefronts, Deals nearby, Doctors
- **Imagery:** Mixed product shots and lifestyle imagery

### DC Dispensary Listing Page
- **Two-column layout:** List (left ~60%) + Map (right ~40%, Mapbox-powered)
- **Filter row:** "Open now", "Storefronts", "Delivery", "Order online", "Deals", "Medical", "Recreational", "Curbside pickup", "Products", "Brand", "Amenities" — notably more filter options than Leafly, including license-type filters (Medical vs Recreational)
- **Sort dropdown:** Present; "Sort by" control
- **Card anatomy:**
  - Dispensary name (bold)
  - Star rating + review count
  - License type badge (Dispensary / Medical patients only)
  - Open/Closed with closing-time warning (e.g., "Closing in 45 min")
  - Service availability (Order online, Curbside pickup)
  - Deal callout (e.g., "20% OFF 1st Online Order!") — deal highlight in card
  - Distance
- **Notable:** Weedmaps separates "Storefronts" from "Delivery" — two distinct listing modes
- **Pagination:** Standard pagination (1, 2, 3... next) rather than infinite scroll
- **SEO content:** Long-form DC cannabis info + FAQ below listings (mirrors Leafly approach)

### Dispensary Detail Page (FireTuned)
- **Quick-action buttons:** Back to results, Call, Directions, Review, Share, Favorite, View menu — more action-oriented than Leafly
- **Info panel:** Business type, hours, status (Closed), amenities (Age minimum, ATM, Medical, Accepts debit, Cashless payment) — amenities list is more detailed than Leafly
- **Deals section:** First-Time Patients deal, Delivery promotion — prominent
- **Reviews:** 5.0 average, 8 reviews with distribution bar chart by star rating — similar to Leafly
- **Map:** Embedded map with zoom controls showing the dispensary location
- **"View menu" CTA** — links out to their online ordering menu

### Deals Page (weedmaps.com/deals)
- **Toggle:** "Delivery" vs "Pickup" — first filter choice
- **Deal card anatomy:** Retailer name, deal title (e.g., "25% OFF | Weedmaps Exclusive Discount"), star rating, service type, distance, occasionally product specifics (THC%)
- **Featured sections:** "Spotlight deals" (premium placements), "Trending now in Washington", "Online promo codes"
- **Promo codes section:** Carousel format with info tooltips explaining how to apply codes
- **Deals by Territory:** Geographic browsing for deals by region
- **FAQ section:** How in-store vs online deals work

### Weedmaps: What It Does Best
1. **Delivery-vs-storefront distinction** — explicitly separates two consumer intents
2. **Amenities filter** — Cashless payment, ATM, Medical, debit — practical info users actually want
3. **Deals as a first-class section** with dedicated URL and sophisticated deal card anatomy
4. **Medical vs Recreational license-type filters** — directly relevant for DC's complex gifting market
5. **Closing-time warnings** on cards ("Closing in 45 min") — urgency signal that helps users

### Weedmaps: Visible Weaknesses
- **More ad-heavy / promotional feel** — heavier sponsored placement density
- **Dense information** on the listing page feels busy
- **Pagination vs infinite scroll** — clicking through pages feels dated vs. Leafly
- **Cookie consent banner** required on every visit — friction
- **Dark-tone brand aesthetic** can feel less inviting for new/hesitant cannabis consumers

---

## 3. DUTCHIE
**Status:** Fully captured — marketing homepage + Mr. Green DC dispensary menu (dutchie.com/dispensary/mrgreen-llc/products)

### Overall Register
- **Light / conversion-optimized.** White background, clean layout, clear typographic hierarchy.
- **Brand color:** Dutchie Green — brighter/more yellow-green than Leafly; approximately #6EC04E or similar
- **Typography:** Clean, modern sans-serif. Very conversion-optimized — very CTA-focused.
- **Overall vibe:** B2B-first (platform for dispensaries) but consumer-facing (ordering UX). Slightly clinical but very functional.

### Marketing Homepage
- **Nav:** For business | See it in action | Log in | Sign up — explicitly B2B-oriented navigation
- **Hero headline:** "Find your local dispensary." — consumer-facing despite being a B2B platform
- **Hero subtext:** "Browse real-time menus, order ahead for pickup, or get delivery—directly from dispensaries near you."
- **Hero CTA:** Address entry field + "Start shopping" button — location-first UX
- **Value prop sections:** "Ordering made easy" (Find → Order → Pick up) — 3-step consumer journey
- **Category grid:** Flower, Edibles, Pre-Rolls, Concentrates, Vapes, Topicals — product category navigation
- **Social proof:** Customer reviews section
- **Dual path:** Consumer and business owner paths explicitly offered

### Dutchie Dispensary Menu Page (Mr. Green DC)
- **Header:** Dispensary name, search field, address input, cart icon with item count
- **Left sidebar filters:**
  - Categories (all product types)
  - Brands (searchable filter)
  - Types (Hybrid, Indica, Sativa, etc.)
  - Effects (Calm, Happy, etc.)
  - Terpenes (searchable filter)
- **Product grid:** Center area, toggle between List and Grid view
- **Product card anatomy:**
  - Product image (prominent)
  - Brand name
  - Product name
  - Strain type (Indica/Sativa/Hybrid)
  - THC % 
  - Terpene content (some products)
  - "Staff pick" badge (merchandising tool)
  - Price
  - Add to cart button / quantity selector
- **Tab navigation:** Home | Categories | Brands | Specials | Info
- **Sort:** Sort dropdown at top of product area
- **Real-time inventory:** Implied by their value prop

### Dutchie: What It Does Best
1. **Left-sidebar filter system** — most powerful filtering of any platform (brand, effects, terpenes, strain type)
2. **"Staff pick" badge** — human curation signal in a product feed
3. **Effects-based filtering** — lets users shop by desired experience, not just product category
4. **Terpene filtering** — advanced user feature that signals expertise/depth
5. **Real-time inventory** — live menu data is their core value prop for both operators and consumers

### Dutchie: Visible Weaknesses
- **Less editorial than Leafly** — very transactional; no strain education or content layer
- **Discovery UX lacks** — no "what's trending" or curated sections on the dispensary menu itself
- **Not a consumer discovery platform** — you only reach Dutchie if you know the dispensary already; no city-level browse/search
- **Design is functional but not distinctive** — won't stand out in consumer memory

---

## 4. JANE (iHeartJane)
**Status:** Marketing homepage captured + stores listing (attempted DC filter)

### Overall Register
- **Light, minimal, modern.** White background, clean spacing.
- **Brand color:** Jane uses a warm coral/rose accent alongside clean typography — distinctly different brand position from green-dominant competitors
- **Typography:** Modern, slightly editorial sans-serif
- **Overall vibe:** Most "consumer lifestyle" feeling of all platforms. Leans into discovery and brand as much as transactional utility.

### Marketing Homepage
- **Nav:** Shop now | For businesses | Community | Sign in | Cart — "Community" is unique among competitors
- **Hero:** "Shop and discover cannabis" — emphasis on BOTH shopping AND discovery
- **Location CTA:** "Enter Your Location" is the primary conversion action; location-gated UX
- **Suggested searches:** Flower, Cartridges, Edibles, Aeriz, Sleep, Rosin — notable that "Sleep" (an effect/use-case) appears alongside product categories
- **Category carousel:** Flower, Vape, Edible, Pre-roll, Extract, Tincture, Topical, All products
- **Featured brands carousel:** Cresco, WYLD, Cookies, Wana, Verano, Houseplant, etc. — strong brand partnerships
- **Nearby dispensaries section:** "Please set your location to shop stores near you" — location-first

### Store Listing
- **Two-column layout:** List (left) + Map (right, Mapbox)
- **Store card elements:** Name, distance, address, rating, review count, open/closed status
- **Sidebar filters:** Deals, Ownership, Services
- **Age verification modal** integrated into the flow

### Jane: What It Does Best
1. **Brand-first merchandising** — featured brands section is more prominent than competitors; leverages brand equity
2. **"Community" nav item** — positions platform as more than transactional; social/editorial dimension
3. **Use-case search terms** (e.g., "Sleep") mixed into suggested searches — helps users who don't know cannabis terminology
4. **AI personalization** (from their B2B marketing) — increasing cart value through smart recommendations
5. **Headless/embedded architecture** — maximum integration flexibility for dispensary partners

### Jane: Visible Weaknesses
- **Consumer discovery is location-blocked** — hard to browse without setting location first
- **Brand is less well-known** than Leafly or Weedmaps — lower consumer awareness hurts organic traffic
- **Thinner review volume** — can't compete with Leafly's 14,000+ reviews per strain
- **B2B platform complexity** visible in the UX — feels slightly enterprise-y

---

## SYNTHESIS

### The 10 Strongest Steal-Worthy Patterns Across All Sites

**1. Split list + sticky map layout (both Leafly and Weedmaps)**
A two-column layout with an interactive sticky map is now the industry standard for dispensary listing pages. The map serves as both a utility (spatial context) and a trust signal (showing real locations). Any Washington D.C. directory that omits this will feel behind the curve. The ~60/40 split (list to map) seems optimal.

**2. Dispensary card "at-a-glance completeness" (Leafly leads)**
The best cards show: name, photo, rating + count, open/closed with time, distance, service types (delivery/pickup/curbside), deal count, and license type — all without requiring a click. Decision-enabling information density that reduces friction. We should match or exceed this.

**3. Real-time status indicators — open/closed with countdown (Weedmaps)**
Weedmaps' "Closing in 45 min" warning is a high-value urgency signal. Simple to implement, high in perceived usefulness. Users decide whether to rush or pick elsewhere.

**4. Strains as SEO flywheel + commerce bridge (Leafly)**
Leafly's strain pages attract millions of search visitors through rich structured data (terpenes, effects, flavors, THC/CBD metrics, 14,000+ reviews). Each strain page then surfaces "where to buy near you" — converting editorial traffic directly into dispensary visits/orders. This is the most powerful SEO architecture in the category.

**5. Use-case / effect-based search and filtering (Jane + Dutchie)**
"Sleep", "Calm", "Happy", "Creative" — filtering by desired experience rather than product type alone addresses the large segment of users who don't know cannabis jargon. This pattern should be standard in any search or filter UI.

**6. Deals as a first-class surface (Weedmaps)**
A dedicated deals page with deal-card anatomy (deal name, dispensary, deal type, distance) drives repeat visits and high-intent traffic. DC consumers specifically seek value signals. Making deals discoverable at the city level (not just per-dispensary) is a meaningful competitive edge.

**7. Terpene and effects structured data on products (Dutchie)**
Terpene-level filtering (Myrcene, Pinene, Caryophyllene) signals deep expertise and serves the educated segment. It's also an SEO differentiator — very few local directories have terpene data indexed and browsable.

**8. Staff picks / human curation badges (Dutchie)**
Even in a data-driven product feed, a "Staff pick" badge adds warmth, trust, and editorial authority. It signals that real humans vetted these products — valuable in a market where consumers are still learning.

**9. Brand carousels as discovery and trust signals (Jane)**
Featuring well-known brands (Cookies, WYLD, Cresco, Wana) helps consumers orient their mental model — they may not know strains, but they know brands. Brand presence also attracts brand advertising revenue.

**10. FAQ + local law content blocks (both Leafly and Weedmaps)**
Both major platforms include city-specific FAQ content below listing pages (DC cannabis laws, gifting model explanation, medical vs recreational status). This is both an SEO play and a genuine user need — especially important in DC where the "gifting" model creates consumer confusion. A D.C. directory that clearly explains the legal landscape will reduce bounce rate from confused out-of-towners and local newcomers.

---

### The 5 Biggest Shared Weaknesses — Opportunities to Exploit

**Weakness 1: Age gate friction at the dispensary level**
Both Leafly and Dutchie force age verification pop-ups on dispensary detail pages (even after already being verified on the listing page). This is multi-step friction that interrupts the conversion funnel. A D.C. directory should do one clean top-level verification and cookie it — never ask twice.

**Weakness 2: Ad-first listings erode trust**
Sponsored results at the top of every listing page (Leafly, Weedmaps) train users to assume the top results aren't organic merit. A D.C. directory that leads with quality-ranked (editorial or community-rated) results — clearly distinguishing any paid placements as additive, not substitutive — can build stronger user trust.

**Weakness 3: No DC-specific context / gifting model explanation**
Despite having FAQ sections, neither Leafly nor Weedmaps clearly explains the DC "gifting" model in a prominent position on the listing page. New users — especially tourists — bounce when they can't understand why "purchases" look different in DC. A DC-native directory that leads with clear gifting-law explainers will dramatically improve engagement.

**Weakness 4: Poor mobile and performance feel**
Both Leafly and Weedmaps appear to load heavy (many scripts, large images, complex layouts). A leaner, faster DC directory — especially optimized for mobile where cannabis searches actually happen — can deliver a meaningfully better experience.

**Weakness 5: No DC-specific neighborhood context**
Current platforms use city-level or zip-level geography but don't leverage DC's strong neighborhood identity (Capitol Hill, Adams Morgan, Columbia Heights, H Street, etc.). A DC-native directory that lets users browse by neighborhood — and highlights which neighborhoods are most dispensary-dense — exploits deep local knowledge that Leafly and Weedmaps national teams haven't invested in.

---

*End of Competitor UI Patterns Report*

---

## LOCKED DIRECTION v2 — "DC Fresh, Evidence Forward" (synthesized from both lanes)

Register: LIGHT-first (both leaders are white-canvas; dark was our outlier). Canvas #f6faf7, white surface cards,
ink text #0d1f18, deep emerald primary #0e9f5a (AA on white), soft sage tints, gold #b9840c for labeled sponsorship.
Typography stays Space Grotesk display + Inter body (distinctive vs their system fonts). IBM Plex Mono for evidence.

Adopt (table stakes): split list+sticky map, Leafly-complete card anatomy (art banner, avatar tile, name, chips,
open/hours, deals, CTA), pill filter row, category tile rail, DC-law content block on listing page.

Beat (their shared weaknesses): organic-first ordering with labeled-only sponsorship (vs their SPONSORED-first),
gifting-law clarity above the fold, neighborhood-native browse (they have zero neighborhood identity),
lean/fast pages (no ad scripts), one clean age gate (no mid-funnel repeats),
and the card face nobody else has: DataStatusBadge + source + license provenance.

Marketing moves shipping with this pass: expanded llms.txt authority doc; GPTBot-strategic robots;
verification additionalProperty in Store JSON-LD (nobody emits provenance); honest Product schema on strain pages
(no fabricated ratings — our truth laws forbid what Leafly does with aggregateRating unless reviews are real);
Offer schema on verified deals; neighborhoods 5 → 12 with per-page FAQPage; /legal FAQ expanded to 12+ questions;
SiteMind competitor-parity contract (deterministic checks vs this dossier).
