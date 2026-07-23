#!/usr/bin/env python3
"""Validate a Durable Agent Architecture JSON contract with no external dependencies."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


REQUIRED_PATHS = [
    ("contract_version",),
    ("system_name",),
    ("layers", "execution", "state_store"),
    ("layers", "execution", "checkpoint_granularity"),
    ("layers", "execution", "authoritative_state_location"),
    ("layers", "execution", "retry_policy", "whole_run_retry"),
    ("layers", "execution", "observability", "full_session_trace"),
    ("layers", "context", "model_adapter_interface"),
    ("layers", "context", "provider_objects_cross_boundary"),
    ("layers", "compute", "sandbox_is_ephemeral"),
    ("layers", "compute", "sandbox_is_authoritative_state"),
    ("budgets", "max_steps"),
    ("budgets", "max_runtime_minutes"),
    ("budgets", "max_recursion_depth"),
    ("change_safety", "canary_required"),
    ("change_safety", "rollback_required"),
]


def get_path(data: dict[str, Any], path: tuple[str, ...]) -> tuple[bool, Any]:
    current: Any = data
    for key in path:
        if not isinstance(current, dict) or key not in current:
            return False, None
        current = current[key]
    return True, current


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: validate_architecture.py <architecture-contract.json>", file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"ERROR: file not found: {path}", file=sys.stderr)
        return 2
    except json.JSONDecodeError as exc:
        print(f"ERROR: invalid JSON: {exc}", file=sys.stderr)
        return 2

    errors: list[str] = []
    warnings: list[str] = []

    for required in REQUIRED_PATHS:
        present, _ = get_path(data, required)
        if not present:
            errors.append("Missing required field: " + ".".join(required))

    def value(path_parts: tuple[str, ...]) -> Any:
        return get_path(data, path_parts)[1]

    if value(("layers", "execution", "authoritative_state_location")) != "external":
        errors.append("Authoritative state must be external to workers/sandboxes.")
    if value(("layers", "execution", "retry_policy", "whole_run_retry")) is not False:
        errors.append("whole_run_retry must be false; retry bounded failed steps instead.")
    if value(("layers", "execution", "observability", "full_session_trace")) is not True:
        errors.append("full_session_trace must be true.")
    if value(("layers", "context", "provider_objects_cross_boundary")) is not False:
        errors.append("Provider-specific objects must not cross the context boundary.")
    if value(("layers", "compute", "sandbox_is_ephemeral")) is not True:
        errors.append("Sandboxes must be treated as ephemeral.")
    if value(("layers", "compute", "sandbox_is_authoritative_state")) is not False:
        errors.append("A sandbox must not be the authoritative state store.")
    if value(("change_safety", "reviewer_can_directly_mutate_production")) is not False:
        errors.append("Reviewer must not directly mutate production without gates.")

    for budget_key in ("max_steps", "max_runtime_minutes", "max_recursion_depth"):
        budget_value = value(("budgets", budget_key))
        if not isinstance(budget_value, int) or budget_value <= 0:
            errors.append(f"budgets.{budget_key} must be a positive integer.")

    verifications = data.get("required_verification", [])
    if not isinstance(verifications, list) or len(verifications) < 6:
        warnings.append("Add a broader failure-drill suite to required_verification.")

    if errors:
        print("FAIL")
        for item in errors:
            print(f"- ERROR: {item}")
        for item in warnings:
            print(f"- WARNING: {item}")
        return 1

    print("PASS: architecture contract satisfies the core durable-agent rules.")
    for item in warnings:
        print(f"- WARNING: {item}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
