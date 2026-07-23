from __future__ import annotations
from dataclasses import dataclass
from .contracts import Eligibility, PolicyDecision


@dataclass(frozen=True)
class EligibilityInput:
    advertiser_verified: bool
    authority_present: bool
    product_classification: str | None
    jurisdiction_established: bool
    channel_policy_allows: bool | None
    audience_eligible: bool | None
    consent_sufficient: bool | None
    creative_verified: bool | None
    destination_verified: bool | None
    measurement_allowed: bool | None
    required_certification_present: bool | None
    policy_snapshot_sha256: str


def evaluate(value: EligibilityInput) -> PolicyDecision:
    if not value.advertiser_verified:
        return PolicyDecision(Eligibility.NOT_ESTABLISHED, value.policy_snapshot_sha256, ("advertiser identity missing",))
    if not value.authority_present:
        return PolicyDecision(Eligibility.NOT_ESTABLISHED, value.policy_snapshot_sha256, ("customer authority missing",))
    if value.product_classification is None or not value.jurisdiction_established:
        return PolicyDecision(Eligibility.NOT_ESTABLISHED, value.policy_snapshot_sha256, ("product or jurisdiction not established",))
    dimensions = {
        "channel policy": value.channel_policy_allows,
        "audience": value.audience_eligible,
        "consent": value.consent_sufficient,
        "creative": value.creative_verified,
        "destination": value.destination_verified,
        "measurement": value.measurement_allowed,
        "certification": value.required_certification_present,
    }
    denied = tuple(name for name, result in dimensions.items() if result is False)
    unknown = tuple(name for name, result in dimensions.items() if result is None)
    if denied:
        return PolicyDecision(Eligibility.INELIGIBLE, value.policy_snapshot_sha256, tuple(f"{x} denied" for x in denied))
    if unknown:
        return PolicyDecision(Eligibility.NOT_ESTABLISHED, value.policy_snapshot_sha256, tuple(f"{x} missing" for x in unknown))
    return PolicyDecision(Eligibility.ELIGIBLE, value.policy_snapshot_sha256, ("all required dimensions passed",))
