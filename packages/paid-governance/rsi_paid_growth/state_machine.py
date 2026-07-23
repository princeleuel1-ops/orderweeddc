from __future__ import annotations
from .contracts import ProposalState

_ALLOWED = {
    ProposalState.DRAFT: {ProposalState.EVIDENCE_COMPLETE, ProposalState.DENIED, ProposalState.NOT_ESTABLISHED},
    ProposalState.EVIDENCE_COMPLETE: {ProposalState.POLICY_ELIGIBLE, ProposalState.DENIED, ProposalState.NOT_ESTABLISHED},
    ProposalState.POLICY_ELIGIBLE: {ProposalState.SIMULATED, ProposalState.DENIED, ProposalState.EXPIRED},
    ProposalState.SIMULATED: {ProposalState.AWAITING_APPROVAL, ProposalState.DENIED, ProposalState.FAILED},
    ProposalState.AWAITING_APPROVAL: {ProposalState.APPROVED, ProposalState.DENIED, ProposalState.EXPIRED, ProposalState.REVOKED},
    ProposalState.APPROVED: {ProposalState.LEASED, ProposalState.EXPIRED, ProposalState.REVOKED},
    ProposalState.LEASED: {ProposalState.EXECUTING, ProposalState.EXPIRED, ProposalState.REVOKED},
    ProposalState.EXECUTING: {ProposalState.EXECUTED_UNVERIFIED, ProposalState.FAILED, ProposalState.QUARANTINED},
    ProposalState.EXECUTED_UNVERIFIED: {ProposalState.VERIFIED, ProposalState.QUARANTINED, ProposalState.ROLLED_BACK},
    ProposalState.VERIFIED: {ProposalState.SETTLING, ProposalState.ROLLED_BACK},
    ProposalState.SETTLING: {ProposalState.SETTLED, ProposalState.QUARANTINED},
    ProposalState.QUARANTINED: {ProposalState.ROLLED_BACK, ProposalState.FAILED},
}


def can_transition(current: ProposalState, target: ProposalState) -> bool:
    return target in _ALLOWED.get(current, set())


def transition(current: ProposalState, target: ProposalState) -> ProposalState:
    if not can_transition(current, target):
        raise ValueError(f"illegal proposal transition: {current.value} -> {target.value}")
    return target
