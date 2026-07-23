# Recovery Package Analysis — 2026-07-23

**Analyst date:** 2026-07-23  
**Packages reviewed:** full, rsi, paid, cana  
**Baseline:** /agent/workspace/recovery/PROJECT_RECOVERY_PACKAGE (07-22)  
**Repo state:** orderweeddc already has Sentinel, competitive library, SiteMind audit, truth-aware JSON-LD, durable-agent-architecture skill.

---

## 1. Per-Package Digest

### 1.1 `full` — PROJECT_RECOVERY_PACKAGE (07-23)

**What it is:** A re-extraction of the RSI SiteMind project history (v3.2 → CWM-10.1-PD lineage). Canonical prompt and architecture docs, seven-plane architecture, Competitive World-Model, Territory Revenue Asset OS (CWM-10.1), Paid Demand Activation plane (CWM-10.1-PD), benchmark receipts, playbooks.

**What is genuinely new vs 07-22:**  
- `COMPETITIVE_WORLD_MODEL_CONTINUATION_PROMPT.md` — a tight operator-facing prompt for building temporal competitor strategy graphs (infers roadmaps, next moves, threat windows, disconfirmation tests) rather than static feature lists. The 07-22 package had a COMPETITIVE_WORLD_MODEL architecture doc but not this focused prompt form.  
- `CWM_10_1_TERRITORY_REVENUE_ASSET_OS.md` — explicit territory-graph model with greenlight courts, perimeter opportunity engine, anti-doorway/anti-thin/anti-duplicate courts, and portfolio economics governor. Elaborates beyond what 07-22 contained.  
- `CWM_10_1_PD_PAID_DEMAND_ACTIVATION_REVENUE_PROOF_PLANE.md` — the 11-step search-to-revenue continuity chain with 89 local tests, 24 JSON schemas, 10 OpenAPI paths, production Google Ads transport disabled. Local scaffold only — not merged into protected v4.2.  
- `VERSION_LINEAGE_V30_TO_CWM_10_1_PD.md` — explicit v3.0→v4.2→CWM-10.1→CWM-10.1-PD version chain, useful reference.

**What is ALREADY IMPLEMENTED in orderweeddc / Sentinel:**  
- Competitor authority tiers and watch list: already in `docs/competitive/sentinel-agent-spec.md` (Tier 1/2/3 with Leafly, Weedmaps, Where's Weed, DCWeedHub, etc.).  
- Evidence ledger concept, truth laws, proof-before-action: already in orderweeddc's architecture and SiteMind audit.  
- Draft-only gated auto-merge: already in Sentinel's EVOLVE gate.  
- Weekly EARN/HEAL cycles, monthly SENSE/EVOLVE: already in Sentinel heartbeat.  
- JSON-LD with verification provenance: already live in orderweeddc.  
- No-pay-to-rank doctrine: already in orderweeddc's ratified truth laws.

**Net new value:** The CWM Continuation Prompt (temporal competitor strategy inference), Territory Revenue graph model, and the full CWM-10.1-PD paid plane architecture (useful as design doc for future Featured/sponsored tier governance). Deduplication from 07-22: the seven-plane architecture, Zenith master prompt, NINE-TO-TEN court, and source resurrection playbook are essentially the same as 07-22; no significant new content there.

---

### 1.2 `rsi` — RSI_PROJECT_RECOVERY_PACKAGE_2026-07-23

**What it is:** An RSI-specific reorganization with numbered sections (00–10): manifests, best prompts, system prompts, core architecture, code/scripts, research findings, benchmarks, playbooks, key originals, distilled insights, open questions. 78 files. More systematically organized than the 07-22 package.

**What is genuinely new vs 07-22 and vs orderweeddc:**  
- `SEARCH_AND_AI_VISIBILITY_OPERATOR.prompt.md` — compact operator prompt (14 lines + 10-step loop) encoding the distinction between rankings, AI citation frequency, referrals, conversions, and outcomes as separate metrics. More distilled than anything in the 07-22 package; directly usable as a Sentinel sub-prompt.  
- `FRONTIER_RECURSION_LOOP_SKILL.md` — structured iterative-improvement skill with 5 modes (IMPROVE, RED_TEAM, RESUME, SELF-APPLY, HORIZON_REOPEN), 10-step iteration protocol, plateau law (stop after two cycles under 5% improvement threshold), and mutation scoring rubric. Genuinely operationally novel; our Sentinel's EVOLVE phase has the concept but not this structured protocol.  
- `CANONICAL_LAWS.md` (30 laws) — the most distilled version of governing laws across the project. Overlaps substantially with orderweeddc's existing truth laws but adds laws 14–20 (generated code ≠ deployed state ≠ business outcome; attribution ≠ incrementality; etc.) that are not explicitly written into orderweeddc's spec.  
- `MARKETPLACE_RANKING_SPONSORSHIP_PLAYBOOK.md` — explicit separation of organic ranking factors from paid sponsorship record-keeping (buyer, dates, surface, targeting, price, impressions, clicks, leads, outcomes). More specific than our current spec.  
- `POLICY_AND_LEGAL_REVALIDATION.md` — checklist for what must be revalidated before production: licensing, age/product eligibility, advertising, account/landing-page policy, review incentives, privacy/consent/analytics. Useful operational checklist not duplicated in orderweeddc.  
- Reconstructed Python scripts (`connector_contract.py`, `daily_growth_state_machine.py`) — sketch-level code, not real logic; lower value than the paid module.

**What is ALREADY IMPLEMENTED:**  
- Evidence-governed architecture, competitor tiers, truth labels, resourcefulness ladder: all in orderweeddc.  
- Daily heartbeat cadence: Sentinel.  
- Draft-PR gated auto-merge: Sentinel EVOLVE gate.  
- Where's Weed business model findings: already in `docs/research/wheresweed-monetization-digest.md`.

---

### 1.3 `paid` — RSI_SITEMIND_PAID_GROWTH_BASELINE_2026-07-23

**Covered in depth in Section 2 below.**

---

### 1.4 `cana` — CANA PROJECT_RECOVERY_PACKAGE

**What it is:** A CANA-project-specific recovery (separate from RSI SiteMind), covering the Hermes/CANA/Zenith/SiteMind multi-agent harness, institutional digital twin concept, Orderweeddc sovereign governor loop, and research synthesis from a Windows-based CANA runtime with 69,108 inventoried paths.

**What is genuinely new vs 07-22 and vs orderweeddc:**  
- `HERMES_INSTITUTIONAL_DIGITAL_TWIN.md` — the "Institutional Reconstruction Engine" concept: reconstruct a website not just as pages/code but as people, roles, routines, incentives, tools, vendors, policies, approvals, data flows, and failure modes before attempting to operate it. The OBSERVE→RECONSTRUCT→COMPARE TO TWIN→PROPOSE→SIMULATE→AUTHORIZE→ACTUATE→VERIFY→SETTLE→UPDATE TWIN loop. More specific than orderweeddc's current Sentinel spec.  
- `ORDERWEEDDC_SOVEREIGN_GOVERNOR_LOOP.md` — extremely detailed sovereign governor skill with 12-state machine, explicit authority boundaries (what is automatic vs what requires approval), full report schema, retry/stagnation rules (max 12 cycles per mission, escalate after 3 non-improving cycles), and evaluation stack. More granular than orderweeddc's current Sentinel spec and worth merging.  
- `50_HIGHEST_LEVERAGE_INSIGHTS.md` — insights #13, #19, #22, #23, #28, #33, #35, #42, #43, #46, #48 are genuinely new (see Section 3.1).  
- `PRODUCTIZATION_AND_REVENUE_WEDGES.md` — B2B QA/monitoring as standalone pre-marketplace product; Diagnostic audit as entry SKU; "lead with loss prevented" positioning. Adds resolution to our tier structure.  
- `COMPETITOR_AND_TOOL_ATLAS.md` — adds agent/runtime tools (Temporal, Restate, DBOS, LangGraph, Browser Use, SWE-agent, etc.) and visual regression tools (Argos, Percy, Chromatic, Applitools) not in our `docs/competitive/tech-dna.md`.  
- `GOOGLE_ADS_AUTOMATION_FINDINGS.md` — "Demand-to-Revenue Governor" reconciliation loop (intent purchased → promise → landing page → action → qualification → revenue/profit → policy issue → next experiment).

**What is ALREADY IMPLEMENTED:**  
- Competitor watch list, truth laws, no-pay-to-rank, sequencing law: all in orderweeddc.  
- Sentinel heartbeat/EARN/HEAL/SENSE/EVOLVE: already built.  
- Where's Weed monetization digest: already in `docs/research/`.

**CANA-specific note:** The VERIFIED_TEST_AND_AUDIT_LEDGER explicitly records that CANA Recovery V2.1 disproved visual/query/evidence claims (synthetic metadata, hard-coded query paths). Do not adopt V2.1 claims as established capability.

---

## 2. The Paid-Growth Engine (Deep Dive)

### 2.1 What the package is

`RSI_SITEMIND_PAID_GROWTH_BASELINE_2026-07-23` is a **clean-room specification and control-plane test scaffold** for a paid advertising governance system. The README states explicitly: "CLEAN-ROOM SPECIFICATION AND CONTROL-PLANE TEST SCAFFOLD. Protected-source implementation: NOT PERFORMED. Production readiness: NOT ESTABLISHED."

It is not a working ad system. It is a governance architecture for one.

### 2.2 Architecture summary

**Five logical planes:** Observation → Intelligence/Proposal → Deterministic Governance → Controlled Execution → Verification/Settlement → Learning.

**Three connector families only (law enforced by test):** EVIDENCE_MEASUREMENT, CONTROLLED_EXECUTION, BUSINESS_OUTCOME_SETTLEMENT. No fourth family permitted.

**Core law:** "Models propose. Deterministic policy services authorize. Narrowly scoped executors act. The evidence ledger proves what happened."

**Python module — `rsi_paid_growth/` (6 files):**

| File | What it does | Real logic or scaffolding? |
|---|---|---|
| `policy.py` | Deterministic eligibility engine. 12-dimension cascade. Missing evidence → NOT_ESTABLISHED (fail-closed). Returns ELIGIBLE / ELIGIBLE_WITH_CONDITIONS / INELIGIBLE / NOT_ESTABLISHED. | Real logic. |
| `authority.py` | Plan hash binding; time window checks; quorum enforcement (0/1/2 distinct human approvers for LOW/MODERATE/HIGH; PROHIBITED cannot approve); idempotency key uniqueness; compensating operation presence. | Real logic. |
| `state_machine.py` | 18-state FSM (DRAFT→…→SETTLED). Illegal transitions raise ValueError immediately. | Real logic. |
| `ledger.py` | Append-only hash-chained receipt ledger. Detects duplicate IDs, chain breaks, and payload hash mismatches. | Real logic. |
| `experiments.py` | Binary A/B analysis: z-score, two-sided p-value (erf-based CDF), relative uplift, SRM chi-squared detection. Real math. | Real logic. |
| `canonical.py` | Deterministic JSON → SHA-256. Self-declared not full RFC 8785 (stated explicitly). | Real logic with documented gap. |
| `contracts.py` | Typed dataclasses for all objects: ConnectorFamily, RiskLevel, Eligibility, ProposalState, TruthLabel, ExecutionPlan, ApprovalGrant, Receipt, PolicyDecision. | Foundation, not scaffolding. |

### 2.3 Test results

Ran `python3 -m unittest discover -s tests -v` (stdlib only, no external deps):

```
test_adversarial_court_complete ............. ok
test_binary_analysis_detects_large_uplift ... ok
test_budget_escalation_denied ............... ok
test_exactly_three_connector_families ....... ok
test_experiment_contract_rejects_bad_duration ok
test_high_risk_requires_two_distinct_approvers ok
test_illegal_state_skip_rejected ............ ok
test_ledger_chain_detects_tamper ............ ok
test_plan_tamper_breaks_hash ................ ok
test_policy_explicit_denial_is_ineligible ... ok
test_policy_missing_authority_fails_closed .. ok
test_sample_ratio_mismatch .................. ok

Ran 12 tests in 0.002s — ALL PASS
```

`python3 scripts_verify.py` → `PASS clean_room_baseline_integrity; production_status=NOT_ESTABLISHED`.

### 2.4 Cannabis advertising reality check

- Meta/Instagram: THC cannabis ads banned.
- Google Search Ads: US cannabis banned; Canada pilot only.
- Google Display, YouTube: cannabis banned.
- What IS open: owned marketplace sponsored placement (our Featured tier), email to opted-in users (if lawful), organic SEO/AIO, on-site deal promotion.

`policy.py` will correctly return `INELIGIBLE` or `NOT_ESTABLISHED` for every mainstream external channel. That is correct behavior. The policy engine's Section 4.5 explicitly notes that when external channels are ineligible, the router may propose "transparent sponsored placement on an authorized owned marketplace" — which is precisely orderweeddc's Featured tier.

### 2.5 `docs/11_DRAFT_ONLY_PILOT.md` — Featured Tier Pilot Spec

This document designs the first one-merchant pilot for an owned marketplace surface (not an external platform). Required preconditions: signed customer authority, verified business identity/license, verified inventory/price/offer, sponsorship disclosure policy, privacy/consent config, baseline analytics in read-only shadow mode, rollback artifact, preregistered experiment with guardrails, two-person approval, independent verifier. Primary metric: settled contribution margin per eligible session. This is the correct specification for orderweeddc's Featured tier launch.

### 2.6 Verdict: Port selectively, archive architecture docs, do not ignore.

**Port now:** The `rsi_paid_growth/` Python module as `packages/paid-governance/` or `apps/web/lib/paid-governance/` (6 files, 12 tests, stdlib only). This gives orderweeddc a tested eligibility gate, state machine, ledger, and A/B math foundation for the Featured tier — before any real ad spend is required to build it.

**Archive:** `docs/11_DRAFT_ONLY_PILOT.md`, `docs/04_POLICY_ELIGIBILITY_ENGINE.md`, `docs/05_APPROVAL_AND_ROLLBACK.md` as governance blueprints.

**Do not represent as:** a working ad system, a live connector, or established production capability. The 13_NOT_ESTABLISHED doc lists 22 things this package does not prove — honor that list.

---

## 3. The Gold Extractions

### 3.1 `cana/09_distilled_insights/50_HIGHEST_LEVERAGE_INSIGHTS.md` — 10 best NOT already implemented

1. **#19: No worker should certify its own output.** Independent verification gate is implied but not explicitly encoded as a law in the Sentinel. Should be added as an explicit rule to the EVOLVE gate.

2. **#22/#23: Two non-improving cycles → stagnation handling; three failed attempts → root-cause analysis, not another retry.** The Sentinel has a resourcefulness ladder but lacks explicit numeric stagnation thresholds. Actionable addition.

3. **#28: Real visual analysis must come from pixels, not filenames or SHA substrings.** No explicit anti-proxy-evidence law in current Sentinel. Worth adding as a named anti-pattern.

4. **#33: Ads are not automated until revenue/profit is reconciled.** Not stated anywhere in orderweeddc's spec. Directly relevant to the Featured tier.

5. **#35: Track model/provider/cost and whether the expense created reusable learning.** No cost-per-cycle tracking in the Sentinel. Gap for when Sentinel starts using expensive API calls.

6. **#42/#43: SiteMind can become a sellable B2B evidence/visual QA product before the full platform is complete; first module is Local Answer Governor / website QA and visibility monitoring.** Hasn't been formalized as a product milestone in orderweeddc. Aligns with our pricing tiers but gives a concrete pre-marketplace delivery path.

7. **#46: A local licensed-retailer registry is the shared data foundation for consumer AND B2B products.** Our existing docs treat the registry as a directory. This frames it as shared data infrastructure powering both B2C and B2B SKUs — a positioning and architecture distinction.

8. **#48: Rejected hypotheses are assets; preserve them to prevent repeated failure.** Sentinel spec doesn't mandate preserving rejected experiments. Should be added to EVOLVE cycle output.

9. **#41: The Website Institutional Digital Twin should include roles, routines, incentives and paid/organic mechanics.** The Sentinel currently observes public signals; it doesn't model the institutional structure behind a competitor's website. Differentiation opportunity for SiteMind-for-Dispensaries.

10. **#34: External media spend defaults to zero without explicit approval.** Not stated as a law in orderweeddc. Should be an explicit guardrail in the Featured tier spec.

### 3.2 `cana/05_research_and_findings/COMPETITOR_AND_TOOL_ATLAS.md` and `GOOGLE_ADS_AUTOMATION_FINDINGS.md`

**New vs `docs/competitive/`:**

`COMPETITOR_AND_TOOL_ATLAS.md` adds to `docs/competitive/tech-dna.md`:
- Agent/runtime layer not in our docs: Temporal, Restate, DBOS, Prefect, Dapr Workflow, LangGraph, Eve, Browser Use, Tasklet, Relevance AI, Letta, Composio, n8n, SWE-agent, Aider, OpenHands.
- Visual verification tools not in our docs: Astryx (agent-operable accessible React design system), Argos/Percy/Chromatic/Applitools.
- ScrapeCreators (provider-neutral social/ad intelligence).
- Search/growth tools not in our docs: Search Atlas/OTTO SEO, seoClarity, Conductor, BrightEdge, Botify, Lumar, Alli AI, AirOps.
- CRO/testing platforms not in our docs: Statsig, Optimizely, VWO, Amplitude, LaunchDarkly, Northbeam.

`GOOGLE_ADS_AUTOMATION_FINDINGS.md` is new as a structured doc — the "Demand-to-Revenue Governor" reconciliation loop (intent purchased → promise → landing page → action → qualified → revenue/profit → policy issue → next experiment) is more tightly specified than anything in orderweeddc's docs. Directly relevant to Featured tier design.

**Our existing competitive docs are ahead on:** specific DC competitor mechanics (Leafly/Weedmaps sitemap analysis, JSON-LD patterns, llms.txt status, DC SERP visibility). The cana atlas is broader but shallower on DC-specific signals.

### 3.3 `cana/09_distilled_insights/PRODUCTIZATION_AND_REVENUE_WEDGES.md`

**New vs ratified plan (free listings → Featured $249-499 → SiteMind-for-Dispensaries $299-999 → city multiplication):**

1. **"Verified Visibility + Website QA + Local Answer Monitoring" as a standalone B2B service** delivered before consumer marketplace matures. Different go-to-market sequencing: the B2B QA/monitoring product can be sold independently as a proof vehicle, not only after the directory has traction.

2. **License/board/hearing intelligence subscription** as a distinct SKU. Implied in our competitive library but not as a billable product.

3. **"Diagnostic/entry audit" as an explicit entry product** before monthly monitoring. Adds a lower-friction first purchase that our current tier structure skips.

4. **"Lead with a concrete loss prevented or outcome improved" — not 'autonomous AI'** as the sales positioning frame. Not yet in our product docs.

5. **Product ladder with 5 resolution levels** (Diagnostic audit → Monthly monitoring → Growth operations/experiments → Full merchant ecommerce OS → Marketplace/media/attribution). More granular than our current 4-tier structure.

**What is already ratified:** Free listings → Featured → SiteMind-for-Dispensaries → city multiplication. The cana wedge analysis doesn't contradict this; it adds B2B sequencing that can run in parallel.

### 3.4 `rsi/01_best_prompts/SEARCH_AND_AI_VISIBILITY_OPERATOR.prompt.md` and `FRONTIER_RECURSION_LOOP_SKILL.md`

**SEARCH_AND_AI_VISIBILITY_OPERATOR:**  
The 10-step loop (OFFICIAL SOURCE WATCH → CHANGE DIFF → POLICY CLASSIFICATION → SURFACE-SPECIFIC MEASUREMENT → TECHNICAL/CONTENT DIAGNOSIS → HYPOTHESIS + COUNTER-HYPOTHESIS → REVERSIBLE TEST → EXACT DEPLOYMENT VERIFICATION → OUTCOME SETTLEMENT → SCALE OR ROLLBACK) is more operationally specific than the Sentinel's current SENSE phase prompt. The explicit instruction to keep rankings, citations, referrals, conversions, and outcomes as separate metrics is not encoded anywhere in the current Sentinel prompts. Adds the AI-citation tracking dimension (share of AI answer) that the Sentinel doesn't currently measure.

**Verdict:** Fold into Sentinel SENSE sub-prompt verbatim. 14 lines, high signal density.

**FRONTIER_RECURSION_LOOP_SKILL:**  
Our Sentinel's EVOLVE phase conceptually does recursive improvement, but it lacks:
- 5 structured modes (IMPROVE, RED_TEAM, RESUME, SELF-APPLY, HORIZON_REOPEN).
- Mandate to generate at least five structurally different mutations before selecting.
- Explicit plateau law: stop after two consecutive iterations under the 5% weighted-improvement threshold when contradictions are resolved.
- 10-dimension mutation scoring rubric (ambition delta, proofability, feasibility, safety, reversibility, cost, time, compounding, defensibility, simplicity).
- Red-team checklist (dependencies, incentives, novelty, safety, scale, economics, evidence, strongest assumption, simpler alternatives).

**Verdict:** Port as Sentinel EVOLVE sub-skill. It is the most operationally complete iteration protocol across all four packages.

### 3.5 `full/01_best_prompts/COMPETITIVE_WORLD_MODEL_CONTINUATION_PROMPT.md` + `CWM_10_1_*`

**COMPETITIVE_WORLD_MODEL_CONTINUATION_PROMPT:**  
"Convert raw signals into evidence-backed capability maps, temporal strategy graphs, roadmap hypotheses, confidence bands, counter-hypotheses, likely next moves, threat and opportunity windows, response options, disconfirmation tests." The prohibition "Do not summarize competitors as static feature lists. Infer mechanisms, sequences, resource commitments, constraints, and future intent" is not in our current Sentinel spec.

**Verdict:** Fold into Sentinel SENSE phase alongside the AI visibility operator prompt.

**CWM_10_1_TERRITORY_REVENUE_ASSET_OS:**  
Territory graph model (geographic hierarchy, reachability, economic adjacency, provider capacity, policy) is relevant as a design doc for orderweeddc's neighborhood expansion phase.

**Verdict:** Archive as `docs/competitive/territory-revenue-model.md` for city-multiplication phase.

**CWM_10_1_PD (Paid Demand Activation plane):**  
The search-to-revenue continuity chain and 11-step production write protocol are directly relevant to the Featured tier. Covered in Section 2.

---

## 4. Contradictions and Hazards

### 4.1 No doctrinal contradictions found

None of the four packages contradict orderweeddc's ratified doctrine. All packages explicitly affirm: cannabis is HIGH or PROHIBITED for external ad channels; organic ranking and sponsored placement must be separate and transparent; models propose, deterministic systems authorize; missing evidence → NOT_ESTABLISHED; synthetic metrics are not customer outcomes.

### 4.2 Hazards to avoid

**H1: Hermes/CANA/Zenith/FPV-OMEGA multi-agent harness complexity.**  
For orderweeddc — one Sentinel, one product, one revenue surface — adding Hermes as a parent organizational governor above CANA/SiteMind/Zenith would add complexity without proportionate value. The institutional digital twin concept is valuable; the full Hermes harness is premature for this stage.

**H2: CANA V2.1 audit self-correction.**  
The VERIFIED_TEST_AND_AUDIT_LEDGER in the cana package explicitly disproves visual/query/evidence claims from CANA Recovery V2.1 (synthetic metadata, hard-coded query paths). Do not adopt any CANA V2.1 claims about visual analysis capability as established. The self-correction is honest but means some CANA materials in the wider archive are theater, not substance.

**H3: Paid engine "NOT_ESTABLISHED" boundary.**  
The paid engine's 12 local tests pass, but the package documents 22 things it does NOT prove (no live connectors, no customers, no revenue, no production security, no ad acceptance, no benchmark superiority). Port this as a governance scaffold only. Tests prove internal contract consistency; they prove no external effect.

**H4: Policy snapshot dates.**  
Both rsi and cana packages explicitly flag that cannabis advertising, licensing, and operating rules are time-sensitive and jurisdiction-specific. `POLICY_AND_LEGAL_REVALIDATION.md` identifies a full revalidation checklist that must be run before any production deployment. Do not treat any policy statement in these packages as current law.

**H5: Where's Weed revenue figures.**  
`WHERES_WEED_BUSINESS_MODEL_FINDINGS.md` reports DC packages "up to about $3,000/month" and operator payments "$60,000–$100,000 during COVID." These are explicitly flagged as "not independently established here." Do not use as benchmarks without current verification.

**H6: Visual agent click-rate figures.**  
`VISUAL_WEB_AGENT_FINDINGS.md` reports click change figures (~11.7%, ~12%, ~20%). The doc explicitly says "Verify against the original paper before publication." Do not cite these numbers.

---

## 5. Integration Verdict

### (a) Port Now

1. **`rsi_paid_growth/` Python module** → `packages/paid-governance/` (6 files, 12 passing tests, stdlib only). Real logic: eligibility gate, state machine, hash-chained ledger, A/B math. Foundation for the Featured tier.

2. **`SEARCH_AND_AI_VISIBILITY_OPERATOR.prompt.md`** → Fold verbatim into Sentinel SENSE phase sub-prompt. Adds AI-citation tracking and explicit metric-separation law. 14 lines, high signal density.

3. **`FRONTIER_RECURSION_LOOP_SKILL.md`** → Port as Sentinel EVOLVE sub-skill. Adds structured mutation protocol, plateau law (5% / 2 cycles), and red-team checklist our current EVOLVE phase lacks.

4. **`COMPETITIVE_WORLD_MODEL_CONTINUATION_PROMPT.md`** → Fold into Sentinel SENSE phase. Adds temporal competitor strategy inference (roadmap hypotheses, threat windows, disconfirmation tests) vs our current static-profile approach.

5. **Laws 14–20 from `CANONICAL_LAWS.md`** (generated code ≠ deployed state; deployed state ≠ business outcome; attribution ≠ incrementality; internal signatures ≠ independent verification; fixture success ≠ production performance; rankings/citations/referrals/conversions/revenue remain separate; paid placement ≠ organic relevance) → Add explicitly to `docs/PRODUCT_IDENTITY.md` or new `docs/CANONICAL_LAWS.md`.

6. **Stagnation thresholds** (insights #22/#23: 2 non-improving cycles → stagnation, 3 failed attempts → root-cause required, max 12 cycles per mission) → Add to `docs/competitive/sentinel-agent-spec.md`.

7. **"No worker certifies its own output" law** (insight #19) → Add as explicit law to Sentinel EVOLVE gate.

### (b) Archive in Repo Docs

8. **`docs/11_DRAFT_ONLY_PILOT.md`** (paid package) → `docs/competitive/featured-tier-pilot-spec.md`. One-merchant, one-offer, two-approver, contribution-margin-primary experiment design for the first Featured tier launch.

9. **`docs/04_POLICY_ELIGIBILITY_ENGINE.md` + `docs/05_APPROVAL_AND_ROLLBACK.md`** (paid package) → `docs/competitive/paid-governance-architecture.md`. Governance blueprint for Featured tier.

10. **`ORDERWEEDDC_SOVEREIGN_GOVERNOR_LOOP.md`** (cana) → `docs/competitive/sovereign-governor-loop.md`. More detailed than current Sentinel spec; reference for next Sentinel upgrade.

11. **`HERMES_INSTITUTIONAL_DIGITAL_TWIN.md`** (cana) → `docs/competitive/institutional-digital-twin.md`. Long-term SiteMind-for-Dispensaries differentiator.

12. **`COMPETITOR_AND_TOOL_ATLAS.md`** new entries (cana) → Merge agent/runtime and visual-verification tool list into `docs/competitive/tech-dna.md`.

13. **`CWM_10_1_TERRITORY_REVENUE_ASSET_OS.md`** (full) → `docs/competitive/territory-revenue-model.md`. City-multiplication reference.

14. **`PRODUCTIZATION_AND_REVENUE_WEDGES.md`** (cana) → `docs/competitive/revenue-wedges.md`. B2B QA sequencing and entry-audit SKU are new resolution beyond current tier structure.

15. **`MARKETPLACE_RANKING_SPONSORSHIP_PLAYBOOK.md`** (rsi) → Merge record-keeping fields into existing marketplace docs.

16. **`POLICY_AND_LEGAL_REVALIDATION.md`** (rsi) → `docs/competitive/policy-revalidation-checklist.md`. Operational pre-launch checklist.

17. **`full/03_core_architecture/` folder** → `docs/sitemind-architecture/` for reference. Source material for any future SiteMind-for-Dispensaries product spec.

### (c) Ignore

18. **Hermes/FPV-OMEGA multi-agent harness** (cana). Too complex for current stage; single Sentinel is correct architecture.

19. **Reconstructed Python scripts in `rsi/04_code_and_scripts/reconstructed/`**. Lower fidelity than the paid module; skip.

20. **CANA Windows PowerShell scripts** (`Collect-LiveRepositoryInventory.ps1`). Platform-specific, not applicable to Node/Linux stack.

21. **`rsi/08_key_files_originals/orderweeddc-ULTIMATE_ORIGINAL.html`**. Prior HTML artifact; orderweeddc already has a more advanced implementation.

22. **Impossible Horizon skills** (rsi `01_best_prompts/IMPOSSIBLE_HORIZON_*`). Aspirational vision prompts; no operational content not already covered by FRONTIER_RECURSION_LOOP_SKILL.

23. **Full `full` and `rsi` packages as-is**. Content worth having is extracted in items (a) and (b). Avoid storing the entire 78-file RSI package in orderweeddc as noise.

---

## Appendix: Test Execution Record

```
Package: paid/RSI_SITEMIND_PAID_GROWTH_BASELINE_2026-07-23
Command: python3 -m unittest discover -s tests -v
Result:  12/12 PASS (0.002s)
Command: python3 scripts_verify.py
Result:  PASS clean_room_baseline_integrity; production_status=NOT_ESTABLISHED
```

No logic tests exist in full, rsi, or cana packages (validation scripts check file integrity only; the cana package validator checks SHA-256 manifest consistency, not logic).
