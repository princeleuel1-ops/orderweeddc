from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from improvement_contract import frontier_snapshot, validate_improvement_contract
from state_store import StateStore


def valid_contract() -> dict:
    return {
        "benchmark_evidence": [
            {
                "name": "current comparator",
                "capability": "bounded discovery",
                "evidence": "official capability page observed directly",
                "observed_at": "2026-07-17",
            }
        ],
        "measurement_contract": [
            {
                "metric": "critical journey assertions passing",
                "kind": "outcome",
                "baseline": 4,
                "target": 8,
                "unit": "assertions",
                "direction": "increase",
                "evidence": "baseline test receipt",
                "verification": "targeted deterministic test",
            },
            {
                "metric": "truth-boundary regressions",
                "kind": "guardrail",
                "baseline": 0,
                "target": 0,
                "unit": "failures",
                "direction": "decrease",
                "evidence": "workspace test receipt",
                "verification": "full workspace test",
            },
        ],
        "falsification_test": "Reject if any new critical journey assertion fails.",
        "promotion_rule": "Promote only with 8 assertions and zero truth regressions.",
        "next_frontier": "Measure the next untested critical journey.",
    }


class ImprovementContractTests(unittest.TestCase):
    def test_valid_contract_requires_gain_and_non_regressing_guardrail(self) -> None:
        result = validate_improvement_contract(valid_contract())
        self.assertTrue(result.valid, result.errors)
        self.assertEqual({"outcome", "guardrail"}, {item["kind"] for item in result.measurements})

    def test_outcome_without_strict_gain_fails_closed(self) -> None:
        contract = valid_contract()
        contract["measurement_contract"][0]["target"] = 4
        result = validate_improvement_contract(contract)
        self.assertFalse(result.valid)
        self.assertTrue(any("must improve" in error for error in result.errors))

    def test_regressing_guardrail_fails_closed(self) -> None:
        contract = valid_contract()
        contract["measurement_contract"][1]["target"] = 1
        result = validate_improvement_contract(contract)
        self.assertFalse(result.valid)
        self.assertTrue(any("must not regress" in error for error in result.errors))

    def test_missing_frontier_fields_are_not_treated_as_progress(self) -> None:
        result = validate_improvement_contract({})
        self.assertFalse(result.valid)
        self.assertIn("falsification_test must be explicit", result.errors)
        self.assertIn("promotion_rule must be explicit", result.errors)
        self.assertIn("next_frontier must be explicit", result.errors)

    def test_frontier_snapshot_counts_only_integrated_measured_work(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            store = StateStore(Path(raw) / "state.sqlite3")
            try:
                initial = frontier_snapshot(store)
                self.assertEqual(0, initial["verified_gain_count"])
                self.assertEqual(1, initial["frontier_epoch"])
                columns = {
                    row["name"]
                    for row in store.rows("PRAGMA table_info(codex_missions)")
                }
                self.assertIn("measurement_contract_json", columns)
            finally:
                store.close()


if __name__ == "__main__":
    unittest.main()
