# The Growing Mind — recursive, vicarious-first intelligence

> We cannot afford to learn everything the expensive way. So the mind's first
> reflex is to learn from OTHERS' mistakes — competitors, the industry, the
> broader web — and convert each into a permanent law and a guard before it can
> ever reach us. Our own incidents are the rare, costly exception; every one is
> a failure of foresight we work to make unnecessary.

## The four faculties

1. **Perception (SENSE + Shadow Loop).** Continuously fingerprint competitor
   surfaces (`competitor-shadow.mjs`) and deep-crawl monthly. Every observed
   move — a shipped feature, a broken funnel, a policy change, a regulatory
   scar — is raw material.

2. **Judgment (triage).** Each observation is classified: a *win* to adopt
   better (Shadow Loop, 10-100X rule) or a *mistake* to learn from. Mistakes
   flow to the Mistake Ledger.

3. **Memory (the Mistake Ledger, `mistake-ledger.json`).** Every mistake entry
   MUST carry: source (competitor/industry/own), actor, the mistake, the
   evidence, the **law** it yields, and the **guard** that makes it impossible
   for us (with a code/test reference). An entry without a law and a guard is
   an *unlearned lesson* and is rejected by `mind-audit.mjs`.

4. **Growth (EVOLVE, recursive).** Monthly, the mind audits itself: are new
   lessons being captured? Are guards holding? It applies the plateau law
   (switch mutation mode after two flat cycles) and the stagnation thresholds.
   The mind that stops growing is treated as a defect.

## The vicarious-dominance mandate (enforced, not aspirational)
`mind-audit.mjs` fails the build unless **vicarious lessons outnumber
own-incident lessons**. Today: 14 lessons, 13 vicarious (93%), 1 own — and the
one own-incident (the Turbopack artifact incident) exists precisely to remind
the mind what first-hand tuition costs. The target is to keep pushing that
ratio up: every competitor stumble we catalogue is a mistake we now never make.

## How a new lesson is born (the loop that never stops)
1. Shadow Loop or SENSE observes an external failure (e.g. a rival's signup
   404s, a stale count, an AI-invisible data wall, a regulatory purge).
2. It is written to the ledger with source + evidence.
3. A **law** is derived (the general principle) and a **guard** is built (a
   test, a check, a schema constraint, a release gate) that makes the failure
   structurally impossible here.
4. `mind-audit.mjs` verifies the lesson is complete; the guard's test proves it
   holds. EVOLVE reviews whether the guard is still sufficient as we grow.

## Recursion & anti-fragility
- Guards are themselves watched: if a guarded failure mode ever recurs, the
  guard is upgraded and the incident logged as OWN — a signal the mind under-
  learned, which raises the bar next cycle.
- The mind never weakens a truth law, authority tier, hard stop, or guard to
  move faster. Growth that costs integrity is not growth.
- New faculties are added the same way capabilities always are: as Tier-2
  drafts with evidence, reviewed by the founder.

## Standing laws distilled from the ledger (applied everywhere)
- Query-derive every displayed count/date (VIC-001).
- Synthetic end-to-end checks on revenue-critical funnels (VIC-002).
- Verify AI-visibility end-to-end, never from policy-file presence (VIC-003).
- Crawler policy is measured strategy, re-derived each SENSE cycle (VIC-004).
- No unverifiable or statistically hollow social proof (VIC-005).
- Absolute geographic integrity; DC-only from the ABCA registry (VIC-006).
- Consumer-intent URLs are never repurposed for B2B capture (VIC-007).
- Time-bounded claims display validity + machine-readable validThrough (VIC-008).
- URL migrations always ship redirect maps; no URL abandoned to 404 (VIC-009).
- No medical claims anywhere; effects are labeled marketing convention (VIC-010).
- Sequencing + external-spend-zero before $20K MRR (VIC-011).
- Published pricing + self-serve in an SMB market (VIC-012).
- Verification-first data model; never vouch for the unchecked (VIC-013).
- Isolation-first artifact proof; hypothesis != proof (OWN-001 / OWD-D1..D8).
