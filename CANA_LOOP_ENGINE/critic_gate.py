"""Independent criticism gate; author output can never self-approve."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

from opencode_adapter import LaneExecution


REJECT = re.compile(r'"CANA_CRITIC"\s*:\s*"REJECT"|CANA_CRITIC:\s*REJECT', re.I)
PASS = re.compile(r'"CANA_CRITIC"\s*:\s*"PASS"|CANA_CRITIC:\s*PASS', re.I)


@dataclass(frozen=True)
class CriticDecision:
    accepted: bool
    findings: list[str]
    evidence_lane_ids: list[int]


class CriticGate:
    def evaluate(self, results: list[LaneExecution]) -> CriticDecision:
        critics = [result for result in results if result.lane_id in (2, 4)]
        findings: list[str] = []
        if len(critics) != 2:
            return CriticDecision(False, ["both Lane 2 and Lane 4 independent receipts are required"], [r.lane_id for r in critics])
        for result in critics:
            if not result.ok:
                findings.append(f"Lane {result.lane_id} execution failed: {result.error_class}")
            elif REJECT.search(result.output):
                findings.append(f"Lane {result.lane_id} rejected the work")
            elif not PASS.search(result.output):
                findings.append(f"Lane {result.lane_id} omitted an explicit critic decision")
        return CriticDecision(not findings, findings, [result.lane_id for result in critics])
