"""Fail-closed contracts for measurable, compounding product improvement."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any


_DIRECTIONS = frozenset({"increase", "decrease"})
_KINDS = frozenset({"outcome", "guardrail"})


@dataclass(frozen=True)
class ImprovementValidation:
    valid: bool
    errors: tuple[str, ...]
    benchmark_evidence: tuple[dict[str, Any], ...]
    measurements: tuple[dict[str, Any], ...]


def _nonempty(value: Any, maximum: int = 1000) -> str:
    return str(value or "").strip()[:maximum]


def _finite_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def validate_improvement_contract(contract: dict[str, Any]) -> ImprovementValidation:
    """Normalize and validate the evidence needed to claim a measurable gain."""

    errors: list[str] = []
    raw_benchmarks = contract.get("benchmark_evidence")
    normalized_benchmarks: list[dict[str, Any]] = []
    if not isinstance(raw_benchmarks, list) or not raw_benchmarks:
        errors.append("benchmark_evidence must contain at least one current comparison")
    else:
        for index, item in enumerate(raw_benchmarks[:10]):
            if not isinstance(item, dict):
                errors.append(f"benchmark_evidence[{index}] must be an object")
                continue
            normalized = {
                "name": _nonempty(item.get("name"), 200),
                "capability": _nonempty(item.get("capability")),
                "evidence": _nonempty(item.get("evidence"), 2000),
                "observed_at": _nonempty(item.get("observed_at"), 100),
            }
            missing = [key for key, value in normalized.items() if not value]
            if missing:
                errors.append(
                    f"benchmark_evidence[{index}] is missing {', '.join(missing)}"
                )
                continue
            normalized_benchmarks.append(normalized)

    raw_measurements = contract.get("measurement_contract")
    normalized_measurements: list[dict[str, Any]] = []
    metric_ids: set[str] = set()
    if not isinstance(raw_measurements, list) or not raw_measurements:
        errors.append("measurement_contract must contain outcome and guardrail metrics")
    else:
        for index, item in enumerate(raw_measurements[:20]):
            if not isinstance(item, dict):
                errors.append(f"measurement_contract[{index}] must be an object")
                continue
            metric = _nonempty(item.get("metric"), 200)
            unit = _nonempty(item.get("unit"), 100)
            kind = _nonempty(item.get("kind"), 20).lower()
            direction = _nonempty(item.get("direction"), 20).lower()
            evidence = _nonempty(item.get("evidence"), 2000)
            verification = _nonempty(item.get("verification"), 2000)
            baseline = _finite_number(item.get("baseline"))
            target = _finite_number(item.get("target"))
            metric_id = " ".join(metric.lower().split())

            if not metric or not unit or not evidence or not verification:
                errors.append(
                    f"measurement_contract[{index}] requires metric, unit, evidence, and verification"
                )
                continue
            if metric_id in metric_ids:
                errors.append(f"measurement_contract[{index}] duplicates metric {metric!r}")
                continue
            metric_ids.add(metric_id)
            if kind not in _KINDS:
                errors.append(
                    f"measurement_contract[{index}].kind must be outcome or guardrail"
                )
                continue
            if direction not in _DIRECTIONS:
                errors.append(
                    f"measurement_contract[{index}].direction must be increase or decrease"
                )
                continue
            if baseline is None or target is None:
                errors.append(
                    f"measurement_contract[{index}] baseline and target must be finite numbers"
                )
                continue
            improves = target > baseline if direction == "increase" else target < baseline
            non_degrading = (
                target >= baseline if direction == "increase" else target <= baseline
            )
            if kind == "outcome" and not improves:
                errors.append(
                    f"outcome metric {metric!r} must improve beyond its baseline"
                )
                continue
            if kind == "guardrail" and not non_degrading:
                errors.append(f"guardrail metric {metric!r} must not regress")
                continue
            normalized_measurements.append(
                {
                    "metric": metric,
                    "kind": kind,
                    "baseline": baseline,
                    "target": target,
                    "unit": unit,
                    "direction": direction,
                    "evidence": evidence,
                    "verification": verification,
                }
            )

    kinds = {item["kind"] for item in normalized_measurements}
    if "outcome" not in kinds:
        errors.append("measurement_contract requires at least one improving outcome")
    if "guardrail" not in kinds:
        errors.append("measurement_contract requires at least one non-regressing guardrail")

    for field in ("falsification_test", "promotion_rule", "next_frontier"):
        if not _nonempty(contract.get(field), 4000):
            errors.append(f"{field} must be explicit")

    return ImprovementValidation(
        valid=not errors,
        errors=tuple(errors),
        benchmark_evidence=tuple(normalized_benchmarks),
        measurements=tuple(normalized_measurements),
    )


def frontier_snapshot(store: Any) -> dict[str, Any]:
    """Report verified gains separately from speculative candidate activity."""

    verified_codex = int(
        (
            store.row(
                """
                SELECT COUNT(*) AS count FROM codex_missions
                WHERE high_impact=1 AND state='CODEX_INTEGRATED'
                  AND measurement_contract_json!='[]'
                """
            )
            or {"count": 0}
        )["count"]
    )
    verified_lanes = int(
        (
            store.row(
                """
                SELECT COUNT(*) AS count FROM missions
                WHERE modifying=1 AND state='completed'
                  AND measurement_contract_json!='[]'
                """
            )
            or {"count": 0}
        )["count"]
    )
    pending_candidates = int(
        (
            store.row(
                """
                SELECT COUNT(*) AS count FROM codex_missions
                WHERE high_impact=1 AND state='CODEX_AWAITING_EXTERNAL_REVIEW'
                  AND candidate_revision IS NOT NULL
                """
            )
            or {"count": 0}
        )["count"]
    )
    stalled_approaches = int(
        (
            store.row(
                "SELECT COUNT(*) AS count FROM no_progress WHERE occurrences>=3"
            )
            or {"count": 0}
        )["count"]
    )
    verified_gains = verified_codex + verified_lanes
    return {
        "verified_gain_count": verified_gains,
        "frontier_epoch": verified_gains + 1,
        "pending_candidates_are_not_gains": pending_candidates,
        "stalled_approaches": stalled_approaches,
        "promotion_rule": (
            "promote only when an outcome beats its bound baseline, every guardrail "
            "is non-regressing, deterministic checks pass, and independent review "
            "accepts the exact candidate"
        ),
    }
