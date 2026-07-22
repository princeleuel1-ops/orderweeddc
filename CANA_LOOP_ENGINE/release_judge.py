"""Independent Lane 5 release decision parser and enforcement."""

from __future__ import annotations

import re
from dataclasses import dataclass

from opencode_adapter import LaneExecution


ACCEPT = re.compile(r'"CANA_RELEASE"\s*:\s*"ACCEPT"|CANA_RELEASE:\s*ACCEPT', re.I)
REJECT = re.compile(r'"CANA_RELEASE"\s*:\s*"REJECT"|CANA_RELEASE:\s*REJECT', re.I)
HOLD = re.compile(r'"CANA_RELEASE"\s*:\s*"HOLD"|CANA_RELEASE:\s*HOLD', re.I)


@dataclass(frozen=True)
class ReleaseDecision:
    decision: str
    accepted: bool
    reason: str


class ReleaseJudge:
    def evaluate(self, results: list[LaneExecution]) -> ReleaseDecision:
        lane_five = [result for result in results if result.lane_id == 5]
        if len(lane_five) != 1:
            return ReleaseDecision("HOLD", False, "exactly one independent Lane 5 receipt is required")
        result = lane_five[0]
        if not result.ok:
            return ReleaseDecision("HOLD", False, f"Lane 5 failed: {result.error_class}")
        if REJECT.search(result.output):
            return ReleaseDecision("REJECT", False, "Lane 5 rejected the mission")
        if HOLD.search(result.output):
            return ReleaseDecision("HOLD", False, "Lane 5 placed the mission on hold")
        if ACCEPT.search(result.output):
            return ReleaseDecision("ACCEPT", True, "Lane 5 accepted the verified mission")
        return ReleaseDecision("HOLD", False, "Lane 5 output omitted the required decision")
