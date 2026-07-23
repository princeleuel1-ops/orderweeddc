# 11. Draft-Only Pilot for One Authorized Business Owner

## 11.1 Pilot identity

**Pilot:** one Washington, D.C. cannabis dispensary or delivery-company owner purchasing transparent sponsored visibility on an RSI-controlled marketplace surface.

**Current authority state:** `NOT PROVIDED`  
**Live execution:** `BLOCKED`  
**Real merchant/account:** `TO_BE_BOUND_BY_SIGNED_AUTHORITY`

This pilot is intentionally designed around an owned marketplace placement rather than assuming eligibility for an external advertising platform. Any external channel is a separate policy decision.

## 11.2 Pilot goal

Determine whether a clearly labeled sponsored merchant placement and intent-matched merchant landing experience create incremental, settled contribution margin for the authorized owner without misleading ranking, hiding sponsorship, violating policy or weakening organic relevance.

## 11.3 Scope

- One merchant.
- One verified service area.
- One verified offer or deal.
- One marketplace intent cluster.
- One sponsored placement format.
- One landing-page variant.
- One control population.
- Fixed maximum spend and duration.
- No external retargeting in the first pilot.
- No use of sensitive personal traits.

## 11.4 Required preconditions

1. Signed customer authority with exact account, budget, duration and kill-switch contacts.
2. Verified business identity, license/authorization evidence and service geography as required.
3. Verified inventory, price, offer terms and expiration.
4. Marketplace sponsorship disclosure and ranking policy.
5. Privacy notice, consent and retention configuration.
6. Baseline analytics and business-outcome connector in read-only shadow mode.
7. Exact rollback artifact.
8. Preregistered experiment and guardrails.
9. Independent verifier identity.
10. Two-person approval for launch.

## 11.5 Experiment

- Randomization unit: eligible marketplace session or stable privacy-preserving visitor ID.
- Control: current organic marketplace experience.
- Treatment: clearly labeled sponsored placement plus intent-matched merchant page.
- Primary metric: settled contribution margin per eligible session.
- Secondary: qualified order rate and merchant acquisition cost.
- Guardrails: complaints, bounce, page failures, cancellations, refunds, policy incidents, organic-result degradation and concentration risk.
- Decision: fixed-horizon or preregistered sequential-safe rule.
- Result labels: `WON`, `LOST`, `INCONCLUSIVE`, `INVALIDATED`, or `STOPPED_FOR_SAFETY`.

## 11.6 Daily operations

- Verify offer, availability and service area before serving.
- Reconcile spend and merchant budget.
- Check placement disclosure and destination hash.
- Inspect invalid traffic, order quality, cancellations and refunds.
- Stop automatically at cap, expiry, policy change or verification mismatch.

## 11.7 Pilot completion packet

A stranger must be able to verify authorization, serving, spend, clicks/visits, orders, collected revenue, refunds, contribution margin, experiment assignment, incremental effect, policy decision and rollback without trusting the model or merchant narrative.
