# Research Synthesis for orderweeddc
_Generated 2026-07-23 — four source documents digested below_

---

## Document 1: agent-platforms.txt
### "Agent Platforms and Orchestration Systems for RSI SiteMind Recovery and Continuation"

**Core thesis**
The optimal agent stack for governance-heavy systems is not a single platform but a deliberate hybrid: Temporal for durable, restart-resistant orchestration; LangGraph for explicit stateful graph control; PydanticAI for typed capability contracts and behavior-level eval gates; and MCP as the portable connector surface. Enterprise managed alternatives (Azure Foundry, Google ADK, AWS AgentCore) are viable if a cloud ecosystem is already chosen, but the open hybrid stack scores highest on security, auditability, and integration ease for a Python-first team. The five reusable DNA patterns — durable HITL, tools-as-contracts, execute-not-just-output evaluation, identity-scoped access, and policy-bound memory — should become architectural laws, not optional features.

**The 5–8 most actionable specifics**
1. **Anti-restart semantic**: Temporal's exact-resume semantics guarantee that any externally impactful step is pausable, serializable, resumable, and receipt-generating. Score: 92/100 on SiteMind fit rubric (security 20 pts, auditability 20 pts weighted).
2. **Tools as versioned contracts**: MCP formalizes tools, resources, and prompts as discoverable, schema-defined, permission-scoped objects. Every tool the sentinel uses should carry a `skill-manifest.schema.json` entry with `allowed_tools`, `required_receipts`, `tests`, and `rollback`.
3. **Behavior-level eval gates, not just output**: Release gates must fail on unauthorized tool calls, missing evidence, skipped approvals, and unbound diffs — not only on wrong answers. PydanticAI span-based evals operationalize this.
4. **Capability ledger as authority ceiling**: `capability-ledger.schema.json` fields: `authority_level` ∈ {read_only, draft_only, human_approval_required}; `evidence_requirements`; `approval_requirements`. "Knowledge may expand. Authority may not silently expand."
5. **Draft-only PR as the safe default**: Every proposed site or code change must emit a draft-only PR plus a proof packet (authorization receipt + evidence receipts + diff bundle + rollback bundle) before any human approval is sought.
6. **Release-gate checklist threshold**: Every release dimension must score at least 9/10 or the candidate remains blocked. Checklist enforces: authority, evidence, change binding, verification, and honesty sections.
7. **Hard law to add verbatim**: "If you can write a function to handle the task, do that instead of using an AI agent." This phrase should appear in the sentinel's system prompt as a non-negotiable law.
8. **Memory writes as governed artifacts**: Memory may support retrieval and continuity but must not alter authority scope. Any memory write requires an explicit policy record; self-modification without ledger update is forbidden.

**Direct applications to orderweeddc**

| Actionable item | Where it lands |
|---|---|
| Anti-restart / resumable HITL | Sentinel agent prompt: add rule "All externally impactful steps must be pausable and receipt-generating before execution." Hyperagent live-mode already satisfies the scheduling layer; add explicit approval-pause step before any GitHub PR open. |
| Tools-as-contracts (MCP / skill-manifest) | Sentinel agent's skill definitions: formalize each sentinel capability (crawl, audit-check, PR-draft, schema-validate) as a named skill with explicit `allowed_tools` and `authority_level`. The existing GitHub integration already acts as an MCP surface; document its scope. |
| Behavior-level eval gates | SiteMind audit checks: add a "sentinel self-check" audit item — did the last sentinel run emit proper receipts? Did it skip any approval step? Add to monthly competitive loop checklist. |
| Capability ledger | Sentinel system prompt / agent config: define three authority tiers for the sentinel: `read_only` (crawl, read GSC data), `draft_only` (open GitHub draft PR, write llms.txt draft), `human_approval_required` (merge PR, update live JSON-LD, push to Vercel production). |
| Draft-only PR as default | Site change: all sentinel-proposed changes go to a GitHub draft branch first; never auto-merge. Add SiteMind check: "Was last sentinel PR a draft before merging?" |
| Release-gate checklist | SiteMind monthly audit: adopt the 5-section checklist (authority, evidence, change binding, verification, honesty) as the template for the monthly competitive loop report. |
| "Function over agent" law | Sentinel prompt: add as Rule 0. Specific application: canonical URL checks, robots.txt diffs, JSON-LD validation — write deterministic scripts, not open-ended agent reasoning. |
| Policy-bound memory | Sentinel prompt: "Memory writes (updates to merchant profile, competitor data, audit history) must be explicit, dated, and scoped. The sentinel may not expand its own authority scope by updating memory." |

**What to ignore**
- Temporal, LangGraph, PydanticAI as literal infrastructure installs — orderweeddc's sentinel is Hyperagent-hosted; we adopt the *governance patterns*, not the software stack.
- Azure Foundry, Google ADK, AWS AgentCore — cloud lock-in with 4–6 engineer-week integration cost, irrelevant for a single-tenant directory.
- Letta / MemGPT self-modifying memory — too high governance risk for a truth-first system.
- CrewAI AMP enterprise tier — multi-agent team coordination we don't need at this scale.
- Microsoft Agent Framework RC — too immature.

---

## Document 2: search-ai-discovery.txt
### "Winning in Google Search and AI Discovery Without Crossing Into Search Spam"

**Core thesis**
Google's AI Overviews and AI Mode are not a separate optimization target — they run on the same core ranking and quality systems as web search, and no special files, schemas, or llms.txt hacks are required or effective. The winning strategy is to become the most eligible, most sourceable, most click-worthy page for high-value queries across Google Search, Bing/Copilot, ChatGPT Search, and Perplexity, while strictly avoiding scaled content abuse, site reputation abuse, and misleading UX — all of which Google's spam policies now explicitly apply to generative AI responses (clarified May 2026). The line between aggressive SEO and spam is operationally defined by Google's own spam-policy criteria, not by third-party folklore.

**The 5–8 most actionable specifics**
1. **Snippet controls govern AI eligibility**: `nosnippet` prevents content from being used as direct input for AI Overviews and AI Mode. `max-snippet` limits how much content may be used. Never apply these reflexively — over-restricting previews is self-sabotage on AI surfaces. Default: `max-snippet` set generously (≥ 160 chars) on all high-value pages.
2. **Google-Extended ≠ Google Search**: Disallowing `Google-Extended` in robots.txt (to limit training) does NOT affect Google Search or AI Overview visibility. Keep Googlebot and OAI-SearchBot allowed; disallow GPTBot and Google-Extended only if desired. PerplexityBot should be allowed for search-surfacing.
3. **Spam thresholds that kill AI visibility**: Scaled content abuse (thin pages at volume), site reputation abuse (parasite SEO / piggybacking), and misleading UX ("back-button hijacking") are documented spam vectors that now explicitly suppress AI-surface visibility, not just classic rankings. Any content engine generating dispensary pages must pass a human-usefulness test per page.
4. **Google Search Console AI reports as primary KPI** (launched June 2026): Track "generative AI feature impressions" and "AI Mode cited pages" weekly. Bing Webmaster Tools AI Performance adds grounding queries and cited pages. Microsoft Clarity adds citation share and share-of-authority. ChatGPT referrals tracked via `utm_source=chatgpt.com`. These four form the complete AI-visibility measurement surface.
5. **FAQ rich results deprecated May 7, 2026**: FAQ schema no longer earns a SERP feature. Keep FAQ-style Q&A content for page structure and AI citability, but stop counting it as a rich-result lever. Remove FAQ from SiteMind audit "expected rich result" checks.
6. **Preferred Sources signal (expanded April–May 2026)**: Publishers with loyal audiences can influence repeat visibility in Top Stories and AI features through user preference. For orderweeddc this means building a return-reader habit (newsletter, bookmarks) to accumulate Preferred Sources weight — not just one-time visits.
7. **E-E-A-T over tricks**: Google's official position is that long-term AI-search presence is more influenced by "unique, compelling, useful, non-commodity content" than any optimization trick. For a DC cannabis directory this means: first-hand dispensary observations, verified hours, real product menus, accurate license data, and original editorial perspective — not AI-generated category fluff.
8. **Robots.txt pattern**: Allow Googlebot, OAI-SearchBot, PerplexityBot; disallow GPTBot and Google-Extended (training opt-out without search impact). Document this pattern in the site repo as a file, not a runtime decision.

**Direct applications to orderweeddc**

| Actionable item | Where it lands |
|---|---|
| Snippet control audit | SiteMind check: "Are any high-value pages carrying `nosnippet` or `max-snippet < 160`?" Run monthly. Flag any page where these are set without an explicit editorial reason. |
| robots.txt pattern | Site change: implement the four-bot split (Googlebot allow, Google-Extended disallow, OAI-SearchBot allow, GPTBot disallow, PerplexityBot allow). Add to sentinel's monthly diff check against live robots.txt. |
| Spam guardrail for content engine | Merchant playbook + sentinel check: every merchant page must have ≥ 1 verifiable data point (license number, verified hours, real menu item) that distinguishes it from commodity content. Sentinel checks for pages with <200 words of original content. |
| AI KPI dashboard | SiteMind monthly loop: add four AI-visibility metrics — Google AI feature impressions (GSC), Bing grounding queries (BWT), Clarity citation share, ChatGPT referral count (analytics). Replace any "AI rank" fantasy metric with these four separates. |
| FAQ schema deprecation | Site change: remove FAQ from `<script type="application/ld+json">` rich-result targeting on dispensary pages. Keep Q&A structure in HTML for citability but stop expecting a Google rich result. SiteMind check: flag any remaining FAQ schema as low-priority. |
| Preferred Sources strategy | Merchant playbook: encourage dispensary partners to prompt customers to "follow" or bookmark orderweeddc. Add to sentinel's quarterly content review: "Are we building return-reader signals?" |
| E-E-A-T content rules | Site change / editorial policy: every dispensary page must include at minimum: license number (verifiable), last-verified date, address confirmed against DC ABRA registry, one original observation or editorial note. Add as SiteMind content quality check. |
| Official-source change detection | Sentinel duty: add weekly crawl of Google Search Central docs RSS, Google Search Status Dashboard, and official Bing/OpenAI/Perplexity crawler docs. Alert on hash change (sample monitoring script already in doc). |

**What to ignore**
- llms.txt as a Google ranking signal — Google explicitly says it does not use llms.txt for Search or AI Overviews. Keep llms.txt for non-Google AI systems (Perplexity, ChatGPT) as a courtesy file, but do not treat it as an SEO lever.
- "AEO" and "GEO" as separate disciplines — Google says these are not distinct from standard SEO fundamentals. No separate optimization track needed.
- Social/video platform properties (Instagram, TikTok, X, YouTube Search Console) — orderweeddc is DC-local, not creator-led. Not applicable now.
- Third-party SEO tool recommendations not grounded in official docs — sentinel's source-of-truth is official feeds, not SEO blog commentary.

---

## Document 3: visual-attributes.txt
### "How do Visual Attributes Influence Web Agents?" (VAF academic paper, arXiv:2601.21961v2)

**Core thesis**
A controlled experiment across 48 visual variants, 5 real-world e-commerce/travel/news sites, and 4 VLM-based web agents (UI-TARS 7B, Qwen3-VL-8B, GLM-4.1v-9B, OpenAI CUA) shows that background color contrast, item size (card scale), item position, and card-level clarity are the dominant visual attributes driving AI agent click and mention behavior — while font styling, text color, and image-only clarity have minor or inconsistent effects. AI agents share humans' bottom-up attentional biases (color, size, position) but are far more brittle: unlike humans, agents cannot recover from card-level text blur through semantic inference, making clear textual content on product/listing cards a hard dependency. These findings directly inform how to design pages that are maximally navigable and selectable by AI shopping and discovery agents.

**The 5–8 most actionable specifics**
1. **Background color contrast is the single highest-impact CSS variable**: Average TCR (Target Click Rate) improvement of +11.7% across 7 tested background colors vs. baseline. High-contrast backgrounds (orange #ff9800, blue #2196f3, green #4caf50, cyan #00bcd4) consistently outperform neutral/no-background. For listing pages, the highest-value item or featured dispensary should have a visually distinct card background.
2. **Card size is the second-highest lever**: Scaling card from 1.0 to 1.2 raises TCR by +12%; scaling to 1.5 raises it by +20% (Qwen3-VL experiment). Feature cards for orderweeddc's "verified" or "editor pick" dispensaries should be 20–50% larger than standard listing cards.
3. **Position is the strongest distractor**: Moving a target item from first position to middle causes large TCR drops across all models; moving to sidebar causes the largest drop (position_sidebar TCR as low as 0.055–0.080 vs. baseline 0.256–0.364). Place highest-priority listings (top-rated, verified, featured) at the top of every list, not in sidebars. For orderweeddc's category pages: verified dispensaries always above unverified; no sidebar-only placements for key merchants.
4. **Card-level blur is catastrophic; image-only blur is tolerable**: `card_clarity_blur_1px` p-value 1.53e-04 (highly significant negative effect). `image_clarity_blur_1px` p-value 0.209 (not significant). This means: every dispensary card must have sharp, readable text and structured data visible in the card itself. Hero images may be lower resolution without harming agent comprehension.
5. **Font styling and text color: safe to use freely**: No consistent significant effect on agent click behavior. Orderweeddc can use brand fonts and colors without worrying about agent preference — as long as basic readability is maintained (minimum ~14px, legible contrast).
6. **Sidebar placement = near-zero AI agent attention**: Position_sidebar TCR for OpenAI CUA: 0.055 (vs. baseline 0.364). For UI-TARS: 0.060. Sidebars are effectively invisible to current AI web agents. Never put key merchant info, filter controls, or primary navigation only in a sidebar if AI agentic commerce traffic matters.
7. **Text-centricity of agents**: When entire card text is blurred, agents "struggle to recognize or mention the target at all." This confirms that structured text in the DOM (not just images) is the critical signal. JSON-LD, ARIA labels, and clean HTML text on listing cards are all load-bearing for AI agent comprehension.
8. **Agents have strong first-position bias** (F-pattern / primacy effect): Clicks concentrate on the first few items across all models and scenarios. The first visible item in any list gets disproportionate attention. orderweeddc's "featured" slot logic should treat position 1 as the highest-value real estate for AI-traffic conversion.

**Direct applications to orderweeddc**

| Actionable item | Where it lands |
|---|---|
| Distinct background for featured/verified cards | Site change: add a CSS class `.card--verified` or `.card--featured` with a high-contrast background color (e.g., brand teal or amber) on dispensary listing cards for verified merchants. Apply to position-1 cards on category pages. |
| Card size differentiation | Site change: featured dispensary cards at 1.2–1.5× standard card height/width. Implement via Tailwind scale or explicit CSS card-size variant. |
| No sidebar key content | Site change: audit Next.js layout components — remove any dispensary listings, primary CTAs, or filter controls that are sidebar-only. Move to main-column or top-of-page placement. |
| Card text sharpness / DOM structure | Site change: every listing card must render its name, address, hours, license number, and primary category as readable HTML text (not image-only). JSON-LD on the page mirrors this data. SiteMind check: "Does each card contain ≥ 4 readable text fields?" |
| Top-of-list placement for verified merchants | Site page logic (Next.js): verified + licensed dispensaries always sort above unverified. Editor picks always position 1. Add as a data model rule, not just a visual one. |
| AI-agent readiness checklist for new pages | SiteMind check: new page QA must include: (a) featured card has contrast background, (b) no key content sidebar-only, (c) card text fields all readable, (d) primary listings top-sorted. |
| JSON-LD as fallback text layer | Site change / architecture: confirm that all listing data surfaced in cards also exists in `<script type="application/ld+json">` on the same page. This provides a text-based grounding layer for agents using DOM/accessibility-tree mode rather than screenshot mode. |

**What to ignore**
- Adversarial visual manipulations (pop-ups, prompt injection overlays) — the paper's security implications. We're the honest site trying to be found, not the attacker.
- Agent robustness benchmarks (WebArena, VisualWebArena scores) — academic evaluation infrastructure, not applicable to our build.
- Findings on image clarity for decorative photos — low impact; invest time elsewhere.
- Font family specifics — no consistent winner across models; standard web-safe fonts (Arial, system-ui) are fine.

---

## Document 4: chief-of-staff.txt
### "The Ultimate AI Chief of Staff Blueprint" (Less Doing / Tasklet)

**Core thesis**
An AI Chief of Staff is not a to-do list or calendar assistant but a persistent autonomous intelligence that protects time and attention by operating a structured decision framework (Tier 1 reversible actions execute-and-inform; Tier 2 irreversible actions draft-and-wait), a daily intelligence briefing with exactly 7 sections, and a tiered contact/escalation matrix — all built on a minimal viable tool stack (email, calendar, task manager) with a living personal profile document as persistent memory. The maturity model runs from cautious "New Hire" (weeks 1–2) to "Indispensable" (month 6+) through consistent delegation, correction, and trust-building. The operative philosophy is Optimize → Automate → Outsource applied through a single filter: "Is this something I should be doing at all?"

**The 5–8 most actionable specifics**
1. **7-section daily brief structure**: (1) Weather/context, (2) Today's calendar with prep flags, (3) Inbox priority queue (3–5 threads, ranked by urgency × relationship importance), (4) Slack/channel highlights, (5) Open loops (overdue tasks, pending responses, queued decisions), (6) One proactive flag (something the agent noticed unprompted), (7) Biometrics/health (if connected). Strict section count — no more, no less.
2. **Tier 1 / Tier 2 decision framework**: Tier 1 (reversible) → act and inform. Tier 2 (irreversible — financial above threshold, communications to 5+ people, legal, family) → draft and wait. "When in doubt, make it Tier 2. As trust builds, more actions graduate to Tier 1. Start conservative."
3. **Dollar threshold for autonomous decisions**: Set an explicit dollar amount below which the agent acts; above which it always escalates. Common: $50–$250. For orderweeddc sentinel: define an analogous threshold — e.g., "changes touching production state, billing, or public DNS require human approval regardless of confidence."
4. **Escalation matrix with hard stops**: Specific categories that are always escalated and never autonomously acted upon — legal documents, family/health, financial above threshold, emails to 5+ recipients. For orderweeddc sentinel equivalents: "any change touching live merchant license data, any public communication to merchants, any schema change on production."
5. **Onboarding interview / seed data**: Before the agent can make good decisions it needs explicit context: top priorities, key relationships (Tier A contacts), do-not-disturb windows, communication tone preference, and hard stop categories. For orderweeddc sentinel: the equivalent is a "site context document" pinned to the agent with: current top merchant priorities, SiteMind authority tiers, known schema debt, last audit findings.
6. **Living personal profile document**: A persistent document that accumulates context over time (travel IDs, preferences, vendor relationships). For orderweeddc sentinel: equivalent is a `site-context.json` or `sentinel-memory.md` in the repo that the agent updates with findings, change history, and known merchant notes — and which humans can audit.
7. **Maturity model with explicit calibration rituals**: "Correct the system when it's wrong. Silence = consent. One sentence of feedback is enough." The cadence: week 1 observe, week 2 calibrate, week 3 expand, week 4 trust-and-promote. For the sentinel: monthly review of its autonomous actions; explicit promotion of action categories from draft-only to auto-execute based on track record.
8. **Mirror Audit (advanced, 30+ days)**: One-time analysis of historical email/calendar to produce Optimize / Automate / Outsource / Eliminate quadrants. For orderweeddc: equivalent is an annual SiteMind "retrospective audit" — what did the sentinel flag that was acted on (Automate more), what was ignored (eliminate from checks), what took operator time that could be scripted (Outsource to script).

**Direct applications to orderweeddc**

| Actionable item | Where it lands |
|---|---|
| 7-section daily brief structure | Sentinel agent prompt / live-mode delivery: restructure the sentinel's daily output to mirror the 7-section brief. Sections: (1) Site health snapshot, (2) Today's audit priority, (3) Top 3–5 SiteMind findings ranked by severity × effort, (4) Competitor/market highlights, (5) Open loops (pending PRs, unresolved findings >7 days), (6) One proactive flag (something noticed that wasn't asked for), (7) Merchant health (any verified merchant with stale data). |
| Tier 1 / Tier 2 sentinel authority tiers | Sentinel system prompt: formalize exactly which sentinel actions are Tier 1 (auto-execute, then notify: update `llms.txt` draft, open GitHub draft PR, run audit script) vs. Tier 2 (draft and wait for human approval: merge PR, update live JSON-LD in production, add new merchant to directory, remove a merchant). |
| Hard-stop categories for sentinel | Sentinel prompt: add explicit hard-stop list — "Never autonomously: (a) update live production merchant license data, (b) send communications to merchants, (c) merge PRs to main, (d) modify robots.txt on production, (e) change structured data schema definitions." |
| Onboarding / seed context doc | Agent config: create `sentinel-context.md` pinned to the agent. Sections: current priority merchants, known schema debt, last SiteMind audit date and top findings, authority tier definitions, SiteMind check definitions. Update this doc monthly as part of the competitive loop. |
| Living site profile document | Repo: create `/docs/sentinel-memory.md` that the sentinel appends findings to (dates, what changed, what was flagged, what was resolved). Humans can audit this file in GitHub. SiteMind check: "Was sentinel-memory.md updated in the last 30 days?" |
| Maturity model / calibration ritual | Monthly competitive loop: add a "sentinel calibration" step — review last 30 days of autonomous actions, identify any that should be promoted to Tier 1 or demoted to Tier 2, update sentinel prompt accordingly. Log decision in sentinel-memory.md. |
| Pre-meeting / pre-audit intelligence packets | Sentinel duty: 24 hours before each monthly competitive loop review, sentinel generates an intelligence packet: last month's key changes, top 3 competitors' schema/content changes, current SiteMind score, open PRs. Delivered to operator inbox. |
| Mirror Audit equivalent | Annual SiteMind retrospective: operator reviews 12 months of sentinel outputs → Automate / Outsource / Eliminate / Escalate quadrant. Produces "stop-doing list" for sentinel checks that generate noise without value. |

**What to ignore**
- Tasklet-specific integrations (AgentMail, Bland.ai voice calls, Tesla API, Oura ring biometrics) — platform-specific, not applicable to orderweeddc's Hyperagent-hosted sentinel.
- Personal health/biometrics section of the daily brief — not relevant to a site-operations agent.
- Dollar-threshold for purchases — sentinel doesn't make purchases; translate to a "production-mutation threshold" instead.
- The "Three Feelings Test" (Relief, Leverage, Trust) — useful framing for operator check-ins but not a system rule.

---

## Cross-document: The 10 Moves That Matter

Ranked by estimated impact on orderweeddc's truth-first, AI-discovery-optimized, evidence-labeled directory.

### 1. Formalize sentinel authority tiers in the system prompt (Impact: Critical)
**Source**: agent-platforms + chief-of-staff  
Define three explicit tiers: `read_only` (crawl, audit, read GSC), `draft_only` (open GitHub draft PR, update llms.txt draft, write sentinel-memory.md), `human_approval_required` (merge to main, update live JSON-LD, modify robots.txt on production, add/remove merchants). Add "If you can write a deterministic function for the task, do that instead of agent reasoning" as Rule 0. This single change prevents authority creep and makes the sentinel safe to run in live mode.

### 2. Implement card-level visual differentiation for verified merchants (Impact: High)
**Source**: visual-attributes  
Add a CSS class for verified dispensary cards with a high-contrast background color and 1.2–1.5× card scale. Place verified merchants at position 1 in every list. Never put primary listing content in sidebars. Background color contrast alone increases AI agent click rate by +11.7% on average; card size increase to 1.5× raises it by +20%. This is agentic-commerce readiness — the highest-ROI site change from the academic paper.

### 3. Add the 7-section structured daily brief to sentinel output (Impact: High)
**Source**: chief-of-staff  
Restructure sentinel's live-mode daily output to the strict 7-section format: site health, audit priority, top 3–5 SiteMind findings (severity × effort ranked), competitor highlights, open loops, one proactive flag, merchant health. The single "one proactive flag" section forces the sentinel to surface something it noticed unprompted — the highest-value signal in any intelligence briefing.

### 4. Implement official-source change-detection monitoring as a sentinel duty (Impact: High)
**Source**: search-ai-discovery  
Add a weekly sentinel task: crawl Google Search Central docs RSS, Google Search Status Dashboard, Bing Webmaster blog, OpenAI crawler docs, Perplexity crawler docs; hash-compare against last known state; alert on any change. This is the radar system for Google spam-policy updates and AI-surface rule changes. Use the monitoring script template from the doc directly.

### 5. Add AI-visibility KPIs to SiteMind monthly audit (Impact: High)
**Source**: search-ai-discovery  
Replace any vague "AI presence" metric with four measured signals: (a) Google Search Console generative AI feature impressions, (b) Bing AI Performance grounding queries + cited pages, (c) Microsoft Clarity citation share, (d) ChatGPT referral count via `utm_source=chatgpt.com`. These are the official measurement surfaces as of 2026. Add as required fields in the monthly competitive loop report.

### 6. Enforce card text completeness as a SiteMind check (Impact: High)
**Source**: visual-attributes + search-ai-discovery (E-E-A-T)  
Every dispensary listing card must render ≥ 4 readable text fields (name, address, hours, license number) as HTML text (not image-only). JSON-LD on the page must mirror these fields. Card-level text blur is the most statistically significant negative factor for AI agent comprehension (p=1.53e-04). Add as SiteMind check: "Does each listing card contain ≥ 4 readable DOM text fields?" Run on every deploy.

### 7. Split robots.txt by purpose: search visibility vs. training (Impact: Medium-High)
**Source**: search-ai-discovery  
Implement the four-bot pattern: Googlebot allow, Google-Extended disallow (training opt-out, no search impact), OAI-SearchBot allow (ChatGPT search visibility), GPTBot disallow (training opt-out), PerplexityBot allow. Add robots.txt hash to sentinel's weekly diff check — alert if it changes unexpectedly. Document the rationale in the repo.

### 8. Create sentinel-memory.md as the living site context document (Impact: Medium-High)
**Source**: chief-of-staff + agent-platforms (proof packets)  
Create `/docs/sentinel-memory.md` in the repo. Sentinel appends to it: each audit finding with date, each schema change proposed, each merchant status change, each SiteMind check result. This is the equivalent of the capability ledger + proof packet concept from agent-platforms, adapted to orderweeddc's scale. Humans audit it in GitHub. SiteMind check: "Updated within 30 days?"

### 9. Add hard-stop content quality guardrails to the content engine (Impact: Medium-High)
**Source**: search-ai-discovery (spam thresholds)  
Every merchant page must pass: (a) ≥ 1 verifiable data point (license number from DC ABRA registry, verified hours), (b) ≥ 200 words of original non-commodity content, (c) no duplicated boilerplate across >3 pages without differentiation. These are the concrete spam-threshold guardrails that prevent scaled-content-abuse classification. Add as SiteMind content quality check. Add to merchant playbook as minimum data requirements before publishing a page.

### 10. Add monthly sentinel calibration ritual to competitive loop (Impact: Medium)
**Source**: chief-of-staff + agent-platforms (release gate maturity)  
Last step of each monthly competitive loop: operator reviews sentinel's last 30 autonomous actions, promotes or demotes action categories between Tier 1 and Tier 2 based on track record, updates sentinel system prompt accordingly, logs decision in sentinel-memory.md. This is the "silence = consent / correct what's wrong" maturity loop that prevents the sentinel from ossifying at its initial conservative posture and builds justified trust over time.

---
_File path: /agent/workspace/research/synthesis.md_
