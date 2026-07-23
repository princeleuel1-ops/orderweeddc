from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any, Optional


class ConnectorFamily(str, Enum):
    EVIDENCE_MEASUREMENT = "EVIDENCE_MEASUREMENT"
    CONTROLLED_EXECUTION = "CONTROLLED_EXECUTION"
    BUSINESS_OUTCOME_SETTLEMENT = "BUSINESS_OUTCOME_SETTLEMENT"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    PROHIBITED = "PROHIBITED"


class Eligibility(str, Enum):
    ELIGIBLE = "ELIGIBLE"
    ELIGIBLE_WITH_CONDITIONS = "ELIGIBLE_WITH_CONDITIONS"
    INELIGIBLE = "INELIGIBLE"
    NOT_ESTABLISHED = "NOT_ESTABLISHED"


class ProposalState(str, Enum):
    DRAFT = "DRAFT"
    EVIDENCE_COMPLETE = "EVIDENCE_COMPLETE"
    POLICY_ELIGIBLE = "POLICY_ELIGIBLE"
    SIMULATED = "SIMULATED"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    APPROVED = "APPROVED"
    LEASED = "LEASED"
    EXECUTING = "EXECUTING"
    EXECUTED_UNVERIFIED = "EXECUTED_UNVERIFIED"
    VERIFIED = "VERIFIED"
    SETTLING = "SETTLING"
    SETTLED = "SETTLED"
    DENIED = "DENIED"
    EXPIRED = "EXPIRED"
    REVOKED = "REVOKED"
    FAILED = "FAILED"
    QUARANTINED = "QUARANTINED"
    ROLLED_BACK = "ROLLED_BACK"
    NOT_ESTABLISHED = "NOT_ESTABLISHED"


class TruthLabel(str, Enum):
    OBSERVED = "OBSERVED"
    VALIDATED = "VALIDATED"
    MATCHED = "MATCHED"
    ATTRIBUTED = "ATTRIBUTED"
    CAUSAL = "CAUSAL"
    SETTLED = "SETTLED"
    NOT_ESTABLISHED = "NOT_ESTABLISHED"


@dataclass(frozen=True)
class Money:
    amount: Decimal
    currency: str

    def __post_init__(self):
        if len(self.currency) != 3 or not self.currency.isalpha():
            raise ValueError("currency must be a three-letter code")


@dataclass(frozen=True)
class EvidenceRef:
    uri: str
    sha256: str
    observed_at: str
    source_system: str
    confidence: str = "DIRECT"

    def __post_init__(self):
        if len(self.sha256) != 64:
            raise ValueError("sha256 must be 64 hex characters")
        int(self.sha256, 16)


@dataclass(frozen=True)
class PolicyDecision:
    decision: Eligibility
    snapshot_sha256: str
    reasons: tuple[str, ...]
    conditions: tuple[str, ...] = ()
    expires_at: Optional[str] = None


@dataclass(frozen=True)
class ChangeOperation:
    operation_id: str
    capability_id: str
    resource: str
    method: str
    before_sha256: Optional[str]
    desired_sha256: str
    idempotency_key: str
    compensating_operation_id: Optional[str]
    reversible_class: str


@dataclass(frozen=True)
class ExecutionPlan:
    plan_id: str
    tenant_id: str
    account_id: str
    operations: tuple[ChangeOperation, ...]
    max_spend: Money
    starts_at: str
    expires_at: str
    policy_decision: PolicyDecision
    risk: RiskLevel
    geography: tuple[str, ...]
    artifact_hashes: tuple[str, ...]
    stop_conditions: tuple[str, ...]
    plan_sha256: str = ""


@dataclass(frozen=True)
class ApprovalGrant:
    approval_id: str
    plan_sha256: str
    approver_id: str
    authority_role: str
    granted_at: str
    expires_at: str
    signature_ref: str


@dataclass(frozen=True)
class ExecutionLease:
    lease_id: str
    plan_sha256: str
    tenant_id: str
    executor_id: str
    operation_ids: tuple[str, ...]
    nonce: str
    not_before: str
    expires_at: str
    revocation_epoch: int


@dataclass(frozen=True)
class OutcomeEvent:
    event_id: str
    tenant_id: str
    subject_id: str
    event_type: str
    event_time: str
    ingestion_time: str
    source_ref: EvidenceRef
    deduplication_key: str
    truth: TruthLabel
    value: Optional[Money] = None
    consent_state: str = "NOT_APPLICABLE"
    adjustment_of: Optional[str] = None


@dataclass(frozen=True)
class ExperimentSpec:
    experiment_id: str
    tenant_id: str
    hypothesis: str
    randomization_unit: str
    primary_metric: str
    guardrails: tuple[str, ...]
    alpha: float
    power: float
    minimum_detectable_effect: float
    minimum_duration_days: int
    maximum_duration_days: int
    maximum_spend: Money
    analysis_code_sha256: str
    preregistered_at: str

    def __post_init__(self):
        if not (0 < self.alpha < 0.5):
            raise ValueError("alpha out of range")
        if not (0.5 <= self.power < 1):
            raise ValueError("power out of range")
        if self.minimum_duration_days <= 0:
            raise ValueError("minimum duration must be positive")
        if self.maximum_duration_days < self.minimum_duration_days:
            raise ValueError("maximum duration before minimum duration")


@dataclass(frozen=True)
class Receipt:
    schema_version: str
    receipt_id: str
    receipt_type: str
    tenant_id: str
    occurred_at: str
    recorded_at: str
    actor_id: str
    subject_sha256: str
    decision: str
    previous_record_sha256: str
    payload_sha256: str


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
