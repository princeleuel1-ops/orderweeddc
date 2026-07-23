import json
import unittest
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

from rsi_paid_growth.authority import authorize, compute_plan_hash
from rsi_paid_growth.contracts import (
    ApprovalGrant, ChangeOperation, ConnectorFamily, Eligibility, EvidenceRef,
    ExecutionPlan, ExperimentSpec, Money, PolicyDecision, ProposalState, RiskLevel
)
from rsi_paid_growth.experiments import BinaryArm, analyze_binary, sample_ratio_mismatch
from rsi_paid_growth.ledger import ZERO, make_receipt, record_hash, verify_chain
from rsi_paid_growth.policy import EligibilityInput, evaluate
from rsi_paid_growth.state_machine import transition


class ControlTests(unittest.TestCase):
    def _plan(self, risk=RiskLevel.HIGH, spend="100.00"):
        now = datetime.now(timezone.utc)
        op = ChangeOperation("op1", "marketplace.sponsored.create.v1", "merchant/1/placement/1", "CREATE", None, "a"*64, "idem-1", "op2", "REVERSIBLE_EXACT")
        plan = ExecutionPlan(
            plan_id="p1", tenant_id="t1", account_id="a1", operations=(op,),
            max_spend=Money(Decimal(spend), "USD"),
            starts_at=(now - timedelta(minutes=1)).isoformat(),
            expires_at=(now + timedelta(minutes=10)).isoformat(),
            policy_decision=PolicyDecision(Eligibility.ELIGIBLE, "b"*64, ("passed",)),
            risk=risk, geography=("US-DC",), artifact_hashes=("c"*64,),
            stop_conditions=("budget_cap",), plan_sha256=""
        )
        return replace(plan, plan_sha256=compute_plan_hash(plan))

    def test_exactly_three_connector_families(self):
        self.assertEqual(len(list(ConnectorFamily)), 3)

    def test_policy_missing_authority_fails_closed(self):
        decision = evaluate(EligibilityInput(True, False, "service", True, True, True, True, True, True, True, True, "a"*64))
        self.assertEqual(decision.decision, Eligibility.NOT_ESTABLISHED)

    def test_policy_explicit_denial_is_ineligible(self):
        decision = evaluate(EligibilityInput(True, True, "restricted", True, False, True, True, True, True, True, True, "a"*64))
        self.assertEqual(decision.decision, Eligibility.INELIGIBLE)

    def test_high_risk_requires_two_distinct_approvers(self):
        plan = self._plan()
        grant = ApprovalGrant("g1", plan.plan_sha256, "human-1", "owner", "2026-07-23T00:00:00Z", "2026-07-24T00:00:00Z", "sig:1")
        ok, failures = authorize(plan, (grant,), Decimal("1000"))
        self.assertFalse(ok)
        self.assertIn("approval quorum not met", failures)

    def test_budget_escalation_denied(self):
        plan = self._plan(spend="1001")
        grants = tuple(ApprovalGrant(f"g{i}", plan.plan_sha256, f"human-{i}", "owner", "2026-07-23T00:00:00Z", "2026-07-24T00:00:00Z", f"sig:{i}") for i in (1,2))
        ok, failures = authorize(plan, grants, Decimal("1000"))
        self.assertFalse(ok)
        self.assertIn("budget cap exceeded", failures)

    def test_plan_tamper_breaks_hash(self):
        plan = self._plan()
        tampered = replace(plan, geography=("US-VA",))
        grants = tuple(ApprovalGrant(f"g{i}", plan.plan_sha256, f"human-{i}", "owner", "2026-07-23T00:00:00Z", "2026-07-24T00:00:00Z", f"sig:{i}") for i in (1,2))
        ok, failures = authorize(tampered, grants, Decimal("1000"))
        self.assertFalse(ok)
        self.assertIn("plan hash mismatch", failures)

    def test_illegal_state_skip_rejected(self):
        with self.assertRaises(ValueError):
            transition(ProposalState.DRAFT, ProposalState.EXECUTING)

    def test_ledger_chain_detects_tamper(self):
        r1 = make_receipt(receipt_id="r1", receipt_type="proposal", tenant_id="t", occurred_at="2026-07-23T00:00:00Z", recorded_at="2026-07-23T00:00:01Z", actor_id="s1", subject_sha256="a"*64, decision="CREATED", previous_record_sha256=ZERO)
        r2 = make_receipt(receipt_id="r2", receipt_type="approval", tenant_id="t", occurred_at="2026-07-23T00:00:02Z", recorded_at="2026-07-23T00:00:03Z", actor_id="h1", subject_sha256="b"*64, decision="APPROVED", previous_record_sha256=record_hash(r1))
        ok, _ = verify_chain([r1, r2])
        self.assertTrue(ok)
        tampered = replace(r2, decision="DENIED")
        ok, reason = verify_chain([r1, tampered])
        self.assertFalse(ok)
        self.assertIn("payload hash mismatch", reason)

    def test_binary_analysis_detects_large_uplift(self):
        result = analyze_binary(BinaryArm(1000, 100), BinaryArm(1000, 140))
        self.assertGreater(result.absolute_uplift, 0)
        self.assertLess(result.p_value_two_sided, 0.05)

    def test_sample_ratio_mismatch(self):
        self.assertTrue(sample_ratio_mismatch(1000, 1400))
        self.assertFalse(sample_ratio_mismatch(1000, 1000))

    def test_experiment_contract_rejects_bad_duration(self):
        with self.assertRaises(ValueError):
            ExperimentSpec("e","t","h","session","margin",(),0.05,0.8,0.1,14,7,Money(Decimal("10"),"USD"),"a"*64,"2026-07-23T00:00:00Z")

    def test_adversarial_court_complete(self):
        data = json.loads((Path(__file__).parents[1]/"fixtures/adversarial/court.json").read_text())
        names = {c["attack"] for c in data["required_cases"]}
        required = {"fabricated_revenue","duplicate_conversion","bot_spam_lead","poisoned_search_term","hidden_policy_violation","altered_landing_page","stale_price_inventory","mismatched_destination","credential_substitution","approval_replay","budget_escalation","attribution_window_manipulation","refund_omission","selective_reporting","fake_screenshot","forged_receipt","model_prompt_injection","connector_compromise","deployment_equivocation"}
        self.assertEqual(names, required)
        self.assertTrue(all(not c["silent_pass_allowed"] for c in data["required_cases"]))


if __name__ == "__main__":
    unittest.main()
