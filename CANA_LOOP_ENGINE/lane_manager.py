"""Five independently configured and schedulable canonical lanes."""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any, Callable

from opencode_adapter import LaneExecution, OpenCodeAdapter
from runtime_utils import canonical_json, sha256_text, utc_now
from state_store import StateStore


class LaneManager:
    def __init__(
        self,
        *,
        lanes: list[dict[str, Any]],
        adapter: OpenCodeAdapter,
        store: StateStore,
        prompts_dir: Path,
        max_parallel_lanes: int = 5,
    ):
        if len(lanes) != 5 or {int(lane["id"]) for lane in lanes} != {1, 2, 3, 4, 5}:
            raise ValueError("exactly five canonical lane IDs are required")
        references = [lane["secret_reference"] for lane in lanes]
        if len(set(references)) != 5:
            raise ValueError("five independently addressable secret references are required")
        self.lanes = sorted(lanes, key=lambda lane: int(lane["id"]))
        self.adapter = adapter
        self.store = store
        self.prompts_dir = prompts_dir
        self.max_parallel_lanes = max(1, min(5, int(max_parallel_lanes)))

    def lane(self, lane_id: int) -> dict[str, Any]:
        return next(item for item in self.lanes if int(item["id"]) == lane_id)

    def schedulable(self) -> list[dict[str, Any]]:
        return [
            {
                "lane_id": int(lane["id"]),
                "name": lane["name"],
                "model": lane["primary_model"],
                "fallback_models": lane.get("fallback_models", []),
                "secret_reference": lane["secret_reference"],
                "agent": lane["agent"],
            }
            for lane in self.lanes
        ]

    def codex_external_review_roles(self) -> dict[str, dict[str, Any]]:
        """Return the non-Codex gates authorized to review an exact candidate."""
        return {
            "truth": self.lane(2),
            "adversarial_verification": self.lane(4),
            "release_judge": self.lane(5),
        }

    def _prompt(
        self,
        *,
        lane: dict[str, Any],
        mission: dict[str, Any],
        prior: list[LaneExecution],
        cycle_id: str,
    ) -> str:
        role = (self.prompts_dir / lane["prompt"]).read_text(encoding="utf-8")
        envelope = {
            "cycle_id": cycle_id,
            "mission_id": mission["mission_id"],
            "objective": mission["objective"],
            "rationale": mission["rationale"],
            "acceptance_criteria": json.loads(mission["acceptance_criteria_json"]),
            "prohibited_changes": json.loads(mission["prohibited_changes_json"]),
            "attempt": mission["attempt_number"],
            "worktree": mission.get("worktree"),
        }
        prior_receipts = [
            {
                "lane_id": result.lane_id,
                "lane_name": result.lane_name,
                "model": result.model,
                "output": result.output[-24000:],
                "output_hash": sha256_text(result.output),
            }
            for result in prior
        ]
        return (
            f"{role}\n\n# Durable mission envelope\n\n"
            f"```json\n{json.dumps(envelope, indent=2)}\n```\n\n"
            f"# Prior independent lane receipts\n\n"
            f"```json\n{json.dumps(prior_receipts, indent=2)}\n```\n"
        )

    def run_cycle(
        self,
        mission: dict[str, Any],
        working_directory: Path,
        *,
        before_lane: Callable[[int], None] | None = None,
    ) -> tuple[str, list[LaneExecution]]:
        cycle_id = f"CYCLE-{uuid.uuid4().hex}"
        prior: list[LaneExecution] = []
        for lane in self.lanes:
            lane_id = int(lane["id"])
            if before_lane:
                before_lane(lane_id)
            prompt = self._prompt(lane=lane, mission=mission, prior=prior, cycle_id=cycle_id)
            result = self.adapter.run_lane(
                cycle_id=cycle_id,
                mission=mission,
                lane=lane,
                prompt=prompt,
                working_directory=working_directory,
                session_id=mission.get("opencode_session_id"),
            )
            prior.append(result)
            self.store.event(
                "lane_completed" if result.ok else "lane_failed",
                {
                    "cycle_id": cycle_id,
                    "lane_id": lane_id,
                    "lane_name": lane["name"],
                    "model": result.model,
                    "artifact_path": str(result.artifact_path),
                    "error_class": result.error_class,
                },
                mission["mission_id"],
            )
            if result.session_id:
                self.store.execute(
                    "UPDATE missions SET opencode_session_id=?,updated_at=? WHERE mission_id=?",
                    (result.session_id, utc_now(), mission["mission_id"]),
                )
            if not result.ok:
                break
        return cycle_id, prior
