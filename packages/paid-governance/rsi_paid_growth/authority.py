from __future__ import annotations
from datetime import datetime, timezone
from decimal import Decimal
from .canonical import sha256_hex
from .contracts import ApprovalGrant, Eligibility, ExecutionPlan, RiskLevel


def compute_plan_hash(plan: ExecutionPlan) -> str:
    payload = {
        "plan_id": plan.plan_id,
        "tenant_id": plan.tenant_id,
        "account_id": plan.account_id,
        "operations": plan.operations,
        "max_spend": plan.max_spend,
        "starts_at": plan.starts_at,
        "expires_at": plan.expires_at,
        "policy_decision": plan.policy_decision,
        "risk": plan.risk,
        "geography": plan.geography,
        "artifact_hashes": plan.artifact_hashes,
        "stop_conditions": plan.stop_conditions,
    }
    return sha256_hex(payload)


def authorize(plan: ExecutionPlan, approvals: tuple[ApprovalGrant, ...], tenant_budget_cap: Decimal, now: datetime | None = None) -> tuple[bool, tuple[str, ...]]:
    now = now or datetime.now(timezone.utc)
    failures = []
    expected_hash = compute_plan_hash(plan)
    if plan.plan_sha256 != expected_hash:
        failures.append("plan hash mismatch")
    if plan.policy_decision.decision not in {Eligibility.ELIGIBLE, Eligibility.ELIGIBLE_WITH_CONDITIONS}:
        failures.append("policy not eligible")
    if plan.risk == RiskLevel.PROHIBITED:
        failures.append("prohibited risk")
    if plan.max_spend.amount > tenant_budget_cap:
        failures.append("budget cap exceeded")
    try:
        expiry = datetime.fromisoformat(plan.expires_at.replace("Z", "+00:00"))
        start = datetime.fromisoformat(plan.starts_at.replace("Z", "+00:00"))
        if now < start or now >= expiry:
            failures.append("plan outside active interval")
    except ValueError:
        failures.append("invalid plan time")
    matching = [a for a in approvals if a.plan_sha256 == expected_hash]
    distinct_approvers = {a.approver_id for a in matching}
    required = 2 if plan.risk == RiskLevel.HIGH else 1 if plan.risk == RiskLevel.MODERATE else 0
    if len(distinct_approvers) < required:
        failures.append("approval quorum not met")
    if len({op.idempotency_key for op in plan.operations}) != len(plan.operations):
        failures.append("duplicate idempotency key")
    if any(not op.compensating_operation_id and op.reversible_class != "NON_REVERSIBLE" for op in plan.operations):
        failures.append("missing compensating operation")
    return (not failures, tuple(failures))
