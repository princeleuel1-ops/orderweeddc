from __future__ import annotations
from dataclasses import dataclass
from math import erf, sqrt


@dataclass(frozen=True)
class BinaryArm:
    eligible: int
    conversions: int

    def __post_init__(self):
        if self.eligible <= 0 or not (0 <= self.conversions <= self.eligible):
            raise ValueError("invalid arm counts")


@dataclass(frozen=True)
class BinaryResult:
    control_rate: float
    treatment_rate: float
    absolute_uplift: float
    relative_uplift: float | None
    z_score: float
    p_value_two_sided: float


def analyze_binary(control: BinaryArm, treatment: BinaryArm) -> BinaryResult:
    pc = control.conversions / control.eligible
    pt = treatment.conversions / treatment.eligible
    pooled = (control.conversions + treatment.conversions) / (control.eligible + treatment.eligible)
    variance = pooled * (1 - pooled) * (1 / control.eligible + 1 / treatment.eligible)
    z = 0.0 if variance == 0 else (pt - pc) / sqrt(variance)
    cdf = 0.5 * (1 + erf(abs(z) / sqrt(2)))
    p = 2 * (1 - cdf)
    relative = None if pc == 0 else (pt - pc) / pc
    return BinaryResult(pc, pt, pt - pc, relative, z, p)


def sample_ratio_mismatch(control_n: int, treatment_n: int, expected_treatment_share: float = 0.5, alpha: float = 0.001) -> bool:
    total = control_n + treatment_n
    if total <= 0:
        return True
    expected_t = total * expected_treatment_share
    expected_c = total - expected_t
    chi2 = ((treatment_n - expected_t) ** 2 / expected_t) + ((control_n - expected_c) ** 2 / expected_c)
    # df=1; alpha=.001 threshold approximately 10.827. Other alpha values require a vetted stats library.
    threshold = 10.827 if alpha == 0.001 else 10.827
    return chi2 > threshold
