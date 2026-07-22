"""Detect repeated approaches and redirect toward a useful independent workstream."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from runtime_utils import canonical_json, sha256_text, utc_now
from state_store import StateStore


@dataclass(frozen=True)
class ProgressAssessment:
    no_progress: bool
    occurrences: int
    fingerprint: str
    next_action: str


class NoProgressDetector:
    def __init__(self, store: StateStore, threshold: int = 3):
        self.store = store
        self.threshold = max(2, int(threshold))

    def observe(self, mission_id: str, observation: dict[str, Any]) -> ProgressAssessment:
        normalized = {
            "approach_hash": observation.get("plan_hash")
            or observation.get("prompt_hash"),
            "failure_class": observation.get("failure_class"),
            "changed_files": sorted(observation.get("changed_files", [])),
            "criteria_movement": observation.get("criteria_movement", 0),
            "score_movement": observation.get("score_movement", 0),
            "reverted": bool(observation.get("reverted")),
            "test_failure_hash": observation.get("test_failure_hash"),
            "strategy_revision": observation.get("strategy_revision", 1),
            "architecture_only": bool(observation.get("architecture_only")),
            "cosmetic_only": bool(observation.get("cosmetic_only")),
        }
        fingerprint = sha256_text(canonical_json(normalized))
        row = self.store.row("SELECT occurrences FROM no_progress WHERE fingerprint=?", (fingerprint,))
        occurrences = int(row["occurrences"]) + 1 if row else 1
        self.store.execute(
            """
            INSERT INTO no_progress(fingerprint,occurrences,last_mission_id,last_seen_at)
            VALUES(?,?,?,?)
            ON CONFLICT(fingerprint) DO UPDATE SET
              occurrences=excluded.occurrences,last_mission_id=excluded.last_mission_id,
              last_seen_at=excluded.last_seen_at
            """,
            (fingerprint, occurrences, mission_id, utc_now()),
        )
        no_progress = occurrences >= self.threshold
        next_action = (
            "stop repeated approach; decompose, change lane/model, strengthen evidence, or reconcile"
            if no_progress
            else "continue bounded attempt"
        )
        if no_progress:
            self.store.event(
                "no_progress_detected",
                {
                    "fingerprint": fingerprint,
                    "occurrences": occurrences,
                    "evidence_hash": observation.get("evidence_hash"),
                    "next_action": next_action,
                },
                mission_id,
            )
        return ProgressAssessment(no_progress, occurrences, fingerprint, next_action)
