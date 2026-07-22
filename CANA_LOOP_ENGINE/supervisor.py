#!/usr/bin/env python3
"""Independent durable CANA five-lane supervisor."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import shutil
import sys
import time
import traceback
import uuid
from pathlib import Path
from typing import Any

ENGINE_ROOT = Path(__file__).resolve().parent
if str(ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ENGINE_ROOT))

from critic_gate import CriticGate
from codex_adapter import CodexAdapter
from codex_health import CodexHealth
from codex_lane import CodexLane
from codex_mission_runner import CodexMissionRunner
from heartbeat import Heartbeat
from integration_gate import IntegrationGate
from lane_manager import LaneManager
from mission_queue import InvalidTransition, MissionQueue, MissionSpec
from no_progress_detector import NoProgressDetector
from objective_engine import ObjectiveEngine
from opencode_adapter import LaneCrashed, OpenCodeAdapter
from openrouter_health import OpenRouterHealth
from release_judge import ReleaseJudge
from reporter import Reporter
from rollback_manager import RollbackManager
from runtime_utils import (
    add_seconds,
    atomic_write_json,
    canonical_json,
    parse_time,
    run_process,
    sha256_text,
    utc_now,
)
from security import sanitize, secret_values
from state_store import AlreadyRunning, SingleInstanceLock, StateStore
from verification_gate import VerificationGate
from worktree_manager import WorktreeManager, WorktreeReceipt


class Supervisor:
    def __init__(
        self,
        *,
        workspace: Path,
        runtime_dir: Path,
        config_path: Path,
        lanes_path: Path,
        server_url: str,
        max_parallel_lanes: int,
        mode: str,
        hours: float | None = None,
        until_release_ready: bool = False,
        mock_profile: dict[str, Any] | None = None,
        opencode_pid: int | None = None,
        enable_codex: bool = False,
        max_parallel_codex: int = 1,
    ):
        self.workspace = workspace.resolve()
        self.runtime_dir = runtime_dir.resolve()
        self.runtime_dir.mkdir(parents=True, exist_ok=True)
        self.config = json.loads(config_path.read_text(encoding="utf-8-sig"))
        lane_config = json.loads(lanes_path.read_text(encoding="utf-8-sig"))
        self.lanes: list[dict[str, Any]] = lane_config["lanes"]
        self.mode = mode
        self.mock = mode == "mock"
        self.mock_profile = mock_profile or {}
        self.server_url = server_url
        self.max_parallel_lanes = max(1, min(5, int(max_parallel_lanes)))
        self.enable_codex = bool(enable_codex)
        self.max_parallel_codex = max(1, min(1, int(max_parallel_codex)))
        self.store = StateStore(self.runtime_dir / "state.sqlite3")
        self.queue = MissionQueue(self.store)
        self.health = OpenRouterHealth(self.store, self.config["provider_resilience"])
        self.secret_references = [lane["secret_reference"] for lane in self.lanes]
        self.adapter = OpenCodeAdapter(
            workspace=self.workspace,
            runtime_dir=self.runtime_dir,
            store=self.store,
            health=self.health,
            config=self.config["opencode"],
            secret_references=self.secret_references,
            server_url=server_url,
            mock=self.mock,
            mock_profile=self.mock_profile,
        )
        self.lane_manager = LaneManager(
            lanes=self.lanes,
            adapter=self.adapter,
            store=self.store,
            prompts_dir=ENGINE_ROOT / "prompts",
            max_parallel_lanes=self.max_parallel_lanes,
        )
        self.objectives = ObjectiveEngine(self.workspace, self.store, self.queue, self.lanes)
        self.worktrees = WorktreeManager(self.workspace, self.runtime_dir, self.store)
        self.verification = VerificationGate(
            self.store,
            self.runtime_dir,
            [self.workspace, self.runtime_dir / "worktrees"],
        )
        self.critic = CriticGate()
        self.release_judge = ReleaseJudge()
        self.integration = IntegrationGate(self.workspace, self.store, self.queue, self.worktrees)
        self.rollback = RollbackManager(self.workspace, self.store)
        self.no_progress = NoProgressDetector(
            self.store, int(self.config.get("no_progress_threshold", 3))
        )
        self.reporter = Reporter(self.workspace, self.runtime_dir, self.store)
        self.heartbeat = Heartbeat(
            self.store,
            self.runtime_dir / "heartbeat.json",
            int(self.config.get("heartbeat_seconds", 10)),
        )
        self.control_dir = self.runtime_dir / "control"
        self.control_dir.mkdir(parents=True, exist_ok=True)
        self.codex_lane: CodexLane | None = None
        self.codex_adapter: CodexAdapter | None = None
        self.codex_health: CodexHealth | None = None
        self.codex_runner: CodexMissionRunner | None = None
        if self.enable_codex:
            codex_config = dict(self.config.get("codex", {}))
            codex_config["enabled"] = True
            self.codex_lane = CodexLane(self.store)
            self.codex_adapter = CodexAdapter(
                workspace=self.workspace,
                runtime_dir=self.runtime_dir,
                config=codex_config,
                mock=self.mock,
                mock_profile=self.mock_profile.get("codex", {}),
            )
            self.codex_health = CodexHealth(
                self.store, self.codex_adapter, codex_config
            )
            self.codex_runner = CodexMissionRunner(
                workspace=self.workspace,
                runtime_dir=self.runtime_dir,
                store=self.store,
                lane=self.codex_lane,
                adapter=self.codex_adapter,
                health=self.codex_health,
                worktrees=self.worktrees,
                verification=self.verification,
                review_queue=self.queue,
                no_progress=self.no_progress,
                lanes=self.lanes,
                prompts_dir=ENGINE_ROOT / "prompts",
                config=codex_config,
                manual_stop=self.manual_stop,
                heartbeat=self.heartbeat.update,
            )
        ending_condition: dict[str, Any]
        if hours is not None:
            ending_condition = {
                "kind": "hours",
                "hours": float(hours),
                "started_at": utc_now(),
                "ends_at": add_seconds(utc_now(), float(hours) * 3600),
            }
        elif until_release_ready:
            ending_condition = {
                "kind": "until_release_ready",
                "started_at": utc_now(),
                "weekly_checkpoint_seconds": int(self.config.get("weekly_checkpoint_seconds", 604800)),
            }
        else:
            ending_condition = {"kind": "once", "started_at": utc_now()}
        prior_ending = self.store.get_runtime("ending_condition")
        if prior_ending and hours is None and not until_release_ready:
            ending_condition = prior_ending
        self.store.set_runtime("mode", self.mode)
        self.store.set_runtime("ending_condition", ending_condition)
        self.store.set_runtime("supervisor_pid", os.getpid())
        self.store.set_runtime("opencode_pid", opencode_pid)
        self.store.set_runtime("opencode_server_url", server_url)
        self.store.set_runtime("lane_assignments", self.lane_manager.schedulable())
        self.store.set_runtime("max_parallel_lanes", self.max_parallel_lanes)
        self.store.set_runtime("codex_enabled", self.enable_codex)
        self.store.set_runtime("max_parallel_codex", self.max_parallel_codex)
        self.store.set_runtime(
            "blade_registry",
            [
                {
                    "blade": 0,
                    "name": "Codex Sovereign Architect and Principal Engineer",
                    "enabled": self.enable_codex,
                    "maximum_parallel": self.max_parallel_codex,
                },
                *[
                    {
                        "blade": lane["id"],
                        "name": lane["name"],
                        "model": lane["primary_model"],
                        "secret_reference": lane["secret_reference"],
                    }
                    for lane in self.lanes
                ],
            ],
        )
        self.store.set_runtime("completed", False)
        self.store.set_runtime(
            "active_child_processes",
            [{"kind": "opencode", "pid": opencode_pid}] if opencode_pid else [],
        )

    def close(self) -> None:
        if self.heartbeat.running():
            self.heartbeat.stop("stopped:supervisor-close")
        self.store.close()

    def manual_stop(self) -> bool:
        return (self.control_dir / "MANUAL_STOP").exists()

    def ending_reached(self) -> bool:
        ending = self.store.get_runtime("ending_condition", {})
        if ending.get("kind") == "hours":
            end = parse_time(ending.get("ends_at"))
            now = parse_time(utc_now())
            return bool(end and now and now >= end)
        if ending.get("kind") == "until_release_ready":
            scorecard = self.workspace / "CANA_CONTROL_TOWER" / "QUALITY_SCORECARD.md"
            text = scorecard.read_text(encoding="utf-8", errors="replace") if scorecard.is_file() else ""
            return "RELEASE-READY" in text and "NOT RELEASE-READY" not in text
        return False

    def preflight(self, *, require_server: bool = True) -> dict[str, Any]:
        structural: list[str] = []
        if not self.workspace.is_dir():
            structural.append("workspace_missing")
        if not self.worktrees.is_repository():
            structural.append("not_git_repository")
        if not shutil.which(self.config["opencode"].get("executable", "opencode")):
            structural.append("opencode_unavailable")
        opencode_config = ENGINE_ROOT / "config" / "opencode.json"
        if not opencode_config.is_file():
            structural.append("opencode_config_missing")
        else:
            value = opencode_config.read_text(encoding="utf-8")
            if "openrouter.ai/api/v1" not in value:
                structural.append("openrouter_provider_missing")
            if '"share": "disabled"' not in value:
                structural.append("public_share_not_disabled")
        if len(self.lanes) != 5:
            structural.append("five_lanes_not_configured")
        if len(set(self.secret_references)) != 5:
            structural.append("secret_references_not_independent")
        server_ready = self.adapter.server_health() if require_server and not self.mock else bool(self.mock)
        if require_server and not self.mock and not server_ready:
            structural.append("opencode_server_unreachable")
        accepted = self.health.accepted_references(self.secret_references)
        provider_status = {
            "accepted_count": len(accepted),
            "required_count": 5,
            "accepted_references": sorted(accepted),
            "blocked_reference_count": 5 - len(accepted),
            "ready_for_external_cycle": len(accepted) == 5,
            "checked_at": utc_now(),
        }
        codex_status: dict[str, Any] = {
            "enabled": False,
            "ready": False,
        }
        if self.enable_codex and self.codex_health:
            capabilities = self.codex_health.preflight()
            codex_status = {
                **self.codex_health.status(),
                "enabled": True,
                "blocker": capabilities.blocker,
            }
        self.store.set_runtime("provider_status", provider_status)
        result = {
            "ok": not structural
            and (
                self.mock
                or len(accepted) == 5
                or bool(codex_status.get("ready"))
            ),
            "structural_ok": not structural,
            "structural_blockers": structural,
            "provider": provider_status,
            "opencode_server_ready": server_ready,
            "lane_count": len(self.lanes),
            "independent_secret_reference_count": len(set(self.secret_references)),
            "workspace_primary_clean": self.worktrees.primary_is_clean() if self.worktrees.is_repository() else False,
            "codex": codex_status,
        }
        atomic_write_json(self.runtime_dir / "preflight.json", result)
        self.store.event(
            "preflight",
            {
                "structural_ok": result["structural_ok"],
                "provider_ready": provider_status["ready_for_external_cycle"],
                "server_ready": server_ready,
                "mode": self.mode,
                "codex_ready": bool(codex_status.get("ready")),
            },
        )
        self.reporter.write()
        return result

    def recover(self) -> dict[str, int]:
        operations = self.store.recover_incomplete_operations()
        lane_runs = self.store.recover_orphaned_lane_runs()
        stale = self.queue.recover_expired_leases()
        orphaned = self.queue.recover_orphaned_active_missions(live_owner=None)
        codex_runs = self.store.recover_orphaned_codex_runs()
        codex_verified = (
            self.codex_lane.recover_verified_nonmodifying()
            if self.codex_lane
            else 0
        )
        codex_missions = self.codex_lane.recover() if self.codex_lane else 0
        result = {
            "operations": operations,
            "lane_runs": lane_runs,
            "stale_leases": stale,
            "orphaned_missions": orphaned,
            "codex_runs": codex_runs,
            "codex_verified": codex_verified,
            "codex_missions": codex_missions,
        }
        self.store.event("supervisor_recovery", result)
        return result

    def _verification_commands(self, *, local: bool = False) -> list[list[str]]:
        key = "local_continuity_commands" if local else "mission_verification_commands"
        return [[str(part) for part in command] for command in self.config.get(key, [])]

    def _record_verification(self, mission_id: str, result: Any) -> None:
        serialized = [
            {
                "command_id": item.command_id,
                "argv": item.argv,
                "exit_code": item.exit_code,
                "output_hash": item.output_hash,
                "artifact_path": item.artifact_path,
            }
            for item in result.commands
        ]
        self.store.execute(
            """
            UPDATE missions SET commands_executed_json=?,test_evidence_json=?,
              progress_delta_json=?,updated_at=? WHERE mission_id=?
            """,
            (
                canonical_json([item["argv"] for item in serialized]),
                canonical_json(serialized),
                canonical_json(
                    {
                        "verification_passed": bool(result.passed),
                        "commands_executed": len(serialized),
                        "commands_passed": sum(
                            1 for item in serialized if item["exit_code"] == 0
                        ),
                        "evidence_hash": sha256_text(canonical_json(serialized)),
                    }
                ),
                utc_now(),
                mission_id,
            ),
        )

    def _fail_retryable(self, mission: dict[str, Any], reason: str, failure_class: str) -> None:
        current = self.queue.get(mission["mission_id"])
        if not current:
            return
        try:
            failed = self.queue.transition(
                mission["mission_id"],
                "failed_retryable",
                next_action="wait for bounded retry",
                updates={"blocker_classification": failure_class},
            )
        except InvalidTransition:
            return
        assessment = self.no_progress.observe(
            mission["mission_id"],
            {
                "prompt_hash": current.get("prompt_hash"),
                "plan_hash": sha256_text(
                    f"{current['objective']}|strategy:{current.get('strategy_revision', 1)}"
                ),
                "failure_class": failure_class,
                "changed_files": json.loads(current["changed_files_json"]),
                "evidence_hash": sha256_text(reason),
                "criteria_movement": 0,
                "score_movement": 0,
                "strategy_revision": current.get("strategy_revision", 1),
            },
        )
        if failed["attempt_number"] >= failed["maximum_attempts"] or assessment.no_progress:
            terminal = self.queue.transition(
                mission["mission_id"],
                "failed_terminal",
                next_action=(
                    "queue a changed-strategy pivot"
                    if assessment.no_progress
                    else "review preserved failure evidence"
                ),
                updates={"blocker_classification": "retry_ceiling" if not assessment.no_progress else "no_progress"},
            )
            if assessment.no_progress:
                pivot_id = self.queue.create_strategy_pivot(
                    terminal, assessment.next_action
                )
                self.store.execute(
                    "UPDATE missions SET next_action=?,updated_at=? WHERE mission_id=?",
                    (
                        f"strategy pivot {pivot_id} queued",
                        utc_now(),
                        mission["mission_id"],
                    ),
                )
            return
        retry = self.queue.transition(
            mission["mission_id"],
            "retry_wait",
            next_action="retry after recovery checkpoint",
        )
        self.queue.transition(
            mission["mission_id"],
            "queued",
            next_action="lease recovered mission",
            updates={
                "lease_owner": None,
                "lease_started_at": None,
                "lease_expires_at": None,
            },
        )

    def _run_local_continuity(self, mission: dict[str, Any]) -> bool:
        mission_id = mission["mission_id"]
        self.queue.transition(mission_id, "planning", next_action="run deterministic local continuity checks")
        self.queue.transition(mission_id, "awaiting_criticism", next_action="record non-model evidence boundary")
        self.store.execute(
            "UPDATE missions SET critic_findings_json=?,updated_at=? WHERE mission_id=?",
            (canonical_json(["non-mutating local continuity receipt; no external critic claimed"]), utc_now(), mission_id),
        )
        self.queue.transition(mission_id, "awaiting_verification", next_action="execute configured deterministic checks")
        result = self.verification.run(
            mission_id=mission_id,
            stage="local-continuity",
            commands=self._verification_commands(local=True),
            working_directory=self.workspace,
            timeout_seconds=int(self.config.get("verification_timeout_seconds", 900)),
        )
        self._record_verification(mission_id, result)
        if not result.passed:
            self.queue.transition(
                mission_id,
                "rejected",
                next_action="create repair mission from deterministic failure",
                updates={"blocker_classification": "deterministic_verification"},
            )
            self.queue.create_repair(self.queue.get(mission_id) or mission, result.failure or "verification failed")
            return False
        self.queue.transition(mission_id, "awaiting_release_judgment", next_action="label local evidence without external release claim")
        self.store.execute(
            "UPDATE missions SET release_judge_decision='LOCAL_EVIDENCE_ONLY',updated_at=? WHERE mission_id=?",
            (utc_now(), mission_id),
        )
        self.queue.transition(mission_id, "accepted", next_action="complete non-mutating local evidence mission")
        self.queue.transition(
            mission_id,
            "completed",
            next_action="await provider readiness or next independent local mission",
            updates={"rollback_reference": "not_applicable:non_mutating_local_evidence"},
        )
        return True

    def _worktree_for(self, mission: dict[str, Any]) -> tuple[Path, WorktreeReceipt | None]:
        if mission["lane"] == "codex_candidate_review" and mission.get("worktree"):
            candidate_path = Path(str(mission["worktree"])).resolve()
            if (
                candidate_path.is_dir()
                and self.worktrees.root in candidate_path.parents
            ):
                return candidate_path, None
            raise RuntimeError("Codex review worktree is missing or outside the approved root")
        if not mission["modifying"]:
            return self.workspace, None
        receipt = self.worktrees.create(mission["mission_id"])
        return receipt.path, receipt

    def _reject(
        self,
        mission: dict[str, Any],
        findings: list[str],
        release_decision: str | None = None,
    ) -> bool:
        mission_id = mission["mission_id"]
        self.queue.transition(
            mission_id,
            "rejected",
            next_action="repair independently rejected work",
            updates={
                "critic_findings_json": canonical_json(findings),
                "release_judge_decision": release_decision,
            },
        )
        rejected = self.queue.get(mission_id) or mission
        self.queue.create_repair(rejected, "; ".join(findings))
        return False

    def _run_five_lane(self, mission: dict[str, Any]) -> bool:
        mission_id = mission["mission_id"]
        working_directory, worktree_receipt = self._worktree_for(mission)
        self.queue.transition(mission_id, "planning", next_action="execute bounded five-lane protocol")
        self.queue.transition(mission_id, "researching", next_action="collect five independent receipts")
        self.heartbeat.update("five-lane-cycle", mission_id=mission_id, progress_token="lane-1")
        try:
            cycle_id, results = self.lane_manager.run_cycle(
                self.queue.get(mission_id) or mission,
                working_directory,
                before_lane=lambda lane_id: self.heartbeat.update(
                    "lane-running",
                    mission_id=mission_id,
                    progress_token=f"{cycle_id if 'cycle_id' in locals() else 'cycle'}:lane-{lane_id}",
                    lane_id=lane_id,
                ),
            )
        except LaneCrashed as exc:
            self.store.event("lane_crash_recovered", {"error_class": "worker_exit"}, mission_id)
            self._fail_retryable(mission, str(exc), "worker_exit")
            return False
        if len(results) != 5 or not all(result.ok for result in results):
            failure = next((result for result in results if not result.ok), None)
            self._fail_retryable(
                mission,
                failure.output if failure else "incomplete five-lane cycle",
                failure.error_class if failure and failure.error_class else "incomplete_cycle",
            )
            return False
        self.queue.transition(mission_id, "awaiting_criticism", next_action="enforce independent critic decisions")
        critic = self.critic.evaluate(results)
        self.store.execute(
            "UPDATE missions SET critic_findings_json=?,updated_at=? WHERE mission_id=?",
            (canonical_json(critic.findings), utc_now(), mission_id),
        )
        if not critic.accepted:
            return self._reject(mission, critic.findings)
        self.queue.transition(mission_id, "awaiting_verification", next_action="run deterministic mission verification")
        verification = self.verification.run(
            mission_id=mission_id,
            stage="pre-integration",
            commands=self._verification_commands(),
            working_directory=working_directory,
            timeout_seconds=int(self.config.get("verification_timeout_seconds", 900)),
        )
        self._record_verification(mission_id, verification)
        if not verification.passed:
            return self._reject(mission, [verification.failure or "deterministic verification failed"])
        self.queue.transition(mission_id, "awaiting_release_judgment", next_action="enforce independent Lane 5 decision")
        release = self.release_judge.evaluate(results)
        self.store.execute(
            "UPDATE missions SET release_judge_decision=?,updated_at=? WHERE mission_id=?",
            (release.decision, utc_now(), mission_id),
        )
        if not release.accepted:
            return self._reject(mission, [release.reason], release.decision)
        if mission["lane"] == "codex_candidate_review":
            self._record_codex_candidate_reviews(mission, results)
        self.queue.transition(mission_id, "accepted", next_action="integrate or complete accepted mission")
        if worktree_receipt:
            changes = self.worktrees.changes(worktree_receipt)
            if changes["changed_files"]:
                self.worktrees.commit_changes(
                    worktree_receipt, f"CANA mission {mission_id}: verified local integration"
                )
                mission = self.queue.get(mission_id) or mission
                self.queue.transition(mission_id, "integrating", next_action="merge reviewed worktree")
                integration = self.integration.integrate(
                    mission=mission,
                    receipt=worktree_receipt,
                    critic_passed=True,
                    verification_passed=True,
                    release_accepted=True,
                )
                if not integration.integrated:
                    self.queue.transition(
                        mission_id,
                        "rejected",
                        next_action="resolve integration blocker",
                        updates={"blocker_classification": integration.state},
                    )
                    return False
                self.queue.transition(mission_id, "integrated", next_action="run post-integration verification")
            else:
                self.store.execute(
                    "UPDATE missions SET rollback_reference='not_applicable:no_changed_files',updated_at=? WHERE mission_id=?",
                    (utc_now(), mission_id),
                )
        else:
            self.store.execute(
                "UPDATE missions SET rollback_reference='not_applicable:non_modifying',updated_at=? WHERE mission_id=?",
                (utc_now(), mission_id),
            )
        self.queue.transition(mission_id, "post_integration_verification", next_action="run fifth verification check")
        post = self.verification.run(
            mission_id=mission_id,
            stage="post-integration",
            commands=self._verification_commands(),
            working_directory=self.workspace if worktree_receipt else working_directory,
            timeout_seconds=int(self.config.get("verification_timeout_seconds", 900)),
        )
        if not post.passed:
            current = self.queue.get(mission_id) or mission
            integration_reference = current.get("integration_reference")
            if integration_reference:
                rollback = self.rollback.revert(
                    mission_id,
                    integration_reference,
                    post.failure or "post-integration verification failed",
                )
                self.queue.transition(
                    mission_id,
                    "repairing",
                    next_action="repair after post-integration rollback",
                    updates={"blocker_classification": "post_integration_regression"},
                )
                self.queue.create_repair(
                    self.queue.get(mission_id) or mission,
                    rollback.reason,
                )
            else:
                self.queue.transition(
                    mission_id,
                    "repairing",
                    next_action="repair post-verification failure",
                    updates={"blocker_classification": "post_verification_regression"},
                )
                self.queue.create_repair(
                    self.queue.get(mission_id) or mission,
                    post.failure or "post-verification failure",
                )
            return False
        completed_mission = self.queue.get(mission_id) or mission
        integration_reference = completed_mission.get("integration_reference")
        if integration_reference:
            self.store.set_runtime(
                "protected_integration_base", integration_reference
            )
            self.store.event(
                "protected_integration_base_advanced",
                {"commit": integration_reference},
                mission_id,
            )
        self.queue.transition(mission_id, "completed", next_action="queue next highest-value mission")
        self.store.event(
            "bounded_five_lane_mission_completed",
            {"cycle_id": cycle_id, "mode": self.mode, "lane_count": 5},
            mission_id,
        )
        return True

    @staticmethod
    def _model_family(model: str) -> str:
        value = model.split("/", 1)[-1]
        return value.split(":", 1)[0].lower()

    def _record_codex_candidate_reviews(
        self, review_mission: dict[str, Any], results: list[Any]
    ) -> None:
        if not self.codex_lane or not review_mission.get("parent_mission_id"):
            return
        candidate = str(review_mission.get("input_state_hash") or "")
        roles = {
            2: "truth",
            4: "adversarial_verification",
            5: "release_judge",
        }
        for result in results:
            role = roles.get(int(result.lane_id))
            if not role:
                continue
            self.codex_lane.record_review(
                mission_id=review_mission["parent_mission_id"],
                candidate_revision=candidate,
                reviewer_lane=role,
                reviewer_model=result.model,
                model_family=self._model_family(result.model),
                decision="APPROVE",
                evidence=[
                    {
                        "lane_run_id": result.lane_run_id,
                        "artifact_path": str(result.artifact_path),
                    }
                ],
            )

    def execute_one(self) -> bool:
        accepted = self.health.accepted_references(self.secret_references)
        self.queue.unblock_provider_ready(accepted)
        mission = self.queue.lease_next(f"supervisor:{os.getpid()}", int(self.config.get("lease_seconds", 900)))
        if not mission:
            return False
        mission_id = mission["mission_id"]
        self.heartbeat.update("mission-leased", mission_id=mission_id, progress_token=mission["operation_id"])
        if mission["lane"] == "local_verification":
            return self._run_local_continuity(mission)
        if not self.mock and len(accepted) != 5:
            self.queue.transition(
                mission_id,
                "blocked_external",
                next_action="automatically resume when all five accepted references are available",
                updates={
                    "blocker_classification": "provider_authorization",
                    "lease_owner": None,
                    "lease_started_at": None,
                    "lease_expires_at": None,
                },
            )
            return False
        return self._run_five_lane(mission)

    def execute_codex_one(self) -> bool:
        if not self.codex_runner or not self.codex_health:
            return False
        self.codex_runner.refresh_review_holds()
        self._integrate_ready_codex_candidates()
        self.codex_runner.ensure_continuation()
        status = self.codex_health.status()
        if (
            not status.get("ready")
            and not status.get("cooldown")
            and not self.codex_health.ceiling_reached()
        ):
            self.codex_health.preflight()
            status = self.codex_health.status()
        if self.codex_lane:
            self.codex_lane.resume_available(
                authenticated=bool(status.get("authenticated")),
                cooldown_active=bool(status.get("cooldown")),
                usage_ceiling_reached=self.codex_health.ceiling_reached(),
            )
        return self.codex_runner.execute_one()

    def _integrate_ready_codex_candidates(self) -> int:
        if not self.codex_lane:
            return 0
        rows = self.codex_lane.list({"CODEX_AWAITING_EXTERNAL_REVIEW"})
        integrated_count = 0
        for mission in rows:
            if mission.get("blocker_classification"):
                continue
            candidate = str(mission.get("candidate_revision") or "")
            decisions = self.codex_lane.review_decisions(
                mission["mission_id"], candidate
            )
            if not self.codex_lane.valid_external_approval(
                decisions, high_impact=bool(mission["high_impact"])
            ):
                continue
            path = Path(str(mission["worktree"])).resolve()
            receipt = WorktreeReceipt(
                mission["mission_id"],
                path,
                str(mission["branch_name"]),
                str(mission["baseline_revision"]),
                f"worktree:integrate:{mission['mission_id']}",
                "codex_missions",
            )
            if self.worktrees.head(path) != candidate:
                self.store.execute(
                    """
                    UPDATE codex_missions
                    SET blocker_classification='candidate_changed_after_review',
                      next_action='invalidate reviews and submit exact new candidate',
                      updated_at=? WHERE mission_id=?
                    """,
                    (utc_now(), mission["mission_id"]),
                )
                continue
            result = self.integration.integrate(
                mission=mission,
                receipt=receipt,
                critic_passed=True,
                verification_passed=True,
                release_accepted=True,
                mission_table="codex_missions",
            )
            if not result.integrated:
                self.store.execute(
                    """
                    UPDATE codex_missions SET blocker_classification=?,
                      next_action='repair integration blocker without bypassing reviews',
                      updated_at=? WHERE mission_id=?
                    """,
                    (result.state, utc_now(), mission["mission_id"]),
                )
                continue
            self.codex_lane.transition(
                mission["mission_id"],
                "CODEX_INTEGRATED",
                next_action="run and retain post-integration verification",
                updates={
                    "integration_result_json": canonical_json(result.__dict__),
                    "rollback_reference": result.rollback_reference,
                },
            )
            post = self.verification.run(
                mission_id=mission["mission_id"],
                stage="codex-post-integration",
                commands=self._verification_commands(),
                working_directory=self.workspace,
                timeout_seconds=int(
                    self.config.get("verification_timeout_seconds", 900)
                ),
            )
            if not post.passed and result.integration_reference:
                rollback = self.rollback.revert(
                    mission["mission_id"],
                    result.integration_reference,
                    post.failure or "Codex post-integration verification failed",
                    mission_table="codex_missions",
                )
                if rollback.rolled_back:
                    self.codex_lane.transition(
                        mission["mission_id"],
                        "CODEX_REVERTED",
                        next_action="create a repaired candidate from rollback evidence",
                        updates={
                            "blocker_classification": "post_integration_regression",
                            "rollback_reference": rollback.rollback_reference,
                        },
                    )
                continue
            if result.integration_reference:
                self.store.set_runtime(
                    "protected_integration_base", result.integration_reference
                )
            self.store.event(
                "codex_candidate_integrated_and_post_verified",
                {
                    "candidate_revision": candidate,
                    "integration_reference": result.integration_reference,
                    "rollback_reference": result.rollback_reference,
                },
                mission["mission_id"],
            )
            integrated_count += 1
        return integrated_count

    def ensure_opencode(self) -> bool:
        if self.mock or self.adapter.server_health():
            return True
        self.heartbeat.update("opencode-recovery", progress_token="restart-headless-server")
        try:
            pid = self.adapter.restart_server()
            self.store.set_runtime("opencode_pid", pid)
            self.reporter.write()
            return True
        except Exception as exc:
            self.store.event(
                "opencode_recovery_failed",
                {"error_class": type(exc).__name__, "message": sanitize(str(exc))},
            )
            self.heartbeat.update(
                "opencode-recovery-failed",
                progress_token=type(exc).__name__,
            )
            return False

    def _queue_followup(self, completed_mission_id: str) -> None:
        if self.mock:
            return
        completed = self.queue.get(completed_mission_id)
        if completed and completed["lane"] == "local_verification":
            return
        lane = self.lanes[0]
        mission_id = f"M-AUTO-{dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S')}-{uuid.uuid4().hex[:6]}"
        self.queue.enqueue(
            MissionSpec(
                mission_id=mission_id,
                parent_mission_id=completed_mission_id,
                objective="Recompute the highest-value unblocked CANA weakness and execute one bounded verified improvement.",
                rationale="Continuous mode immediately continues after a completed mission.",
                lane="five_lane_cycle",
                primary_model=lane["primary_model"],
                fallback_models=lane.get("fallback_models", []),
                secret_reference=lane["secret_reference"],
                priority=80,
                acceptance_criteria=[
                    "bounded scope",
                    "independent criticism",
                    "deterministic verification",
                    "independent release judgment",
                    "post-integration verification",
                ],
                prohibited_changes=["public deployment", "force push", "credential exposure"],
                modifying=False,
                assumptions=[
                    "Fresh evidence contains a more valuable unblocked weakness than the completed mission."
                ],
                sota_gap="Find and close the next measured product or release bottleneck.",
                brittle_point="A generic follow-up can repeat the prior recommendation without information gain.",
                success_metrics=[
                    "new mission differs from its parent",
                    "baseline, target, and verification method are explicit",
                ],
                feedback_signals=[
                    "completed mission evidence",
                    "repository state delta",
                    "control-tower score delta",
                ],
                strategy_revision=int(completed["strategy_revision"]) + 1
                if completed
                else 1,
            )
        )

    def run(self, *, once: bool = False) -> int:
        self.heartbeat.start()
        recovery = self.recover()
        self.objectives.ensure_seeded(mock=self.mock)
        if self.codex_runner:
            self.codex_runner.ensure_seeded()
        preflight = self.preflight(require_server=not self.mock)
        if not preflight["structural_ok"]:
            self.heartbeat.update("structural-preflight-blocked", progress_token=sha256_text(canonical_json(preflight)))
            self.reporter.write()
            return 2
        completed_before = {
            row["mission_id"] for row in self.queue.list({"completed"})
        }
        self.heartbeat.update("running", progress_token=sha256_text(canonical_json(recovery)))
        poll = max(2, int(self.config.get("idle_poll_seconds", 15)))
        while not self.manual_stop() and not self.ending_reached():
            self.objectives.ensure_seeded(mock=self.mock)
            codex_worked = self.execute_codex_one()
            if not self.ensure_opencode():
                self.reporter.write()
                if codex_worked and once:
                    break
                time.sleep(min(5, poll))
                continue
            worked = self.execute_one() or codex_worked
            self.reporter.write()
            completed_after = {
                row["mission_id"] for row in self.queue.list({"completed"})
            }
            for mission_id in completed_after - completed_before:
                self._queue_followup(mission_id)
            completed_before = completed_after
            if once:
                break
            if not worked:
                codex_status = (
                    self.codex_health.status() if self.codex_health else {}
                )
                phase = "idle:no-evidence-delta"
                if codex_status.get("cooldown") or (
                    self.codex_health and self.codex_health.ceiling_reached()
                ):
                    phase = "capacity-wait"
                elif self.store.get_runtime("provider_status", {}).get(
                    "ready_for_external_cycle"
                ):
                    phase = "idle"
                self.heartbeat.update(
                    phase,
                    progress_token="waiting-for-unblocked-mission",
                )
                deadline = time.monotonic() + poll
                while time.monotonic() < deadline and not self.manual_stop():
                    time.sleep(min(1.0, deadline - time.monotonic()))
            else:
                self.heartbeat.update("between-missions", progress_token=utc_now())
        reason = "manual_stop" if self.manual_stop() else "ending_condition"
        if self.ending_reached():
            self.store.set_runtime("completed", True)
        self.store.event("supervisor_stopped", {"reason": reason})
        self.reporter.write()
        self.heartbeat.stop(f"stopped:{reason}")
        return 0


def load_paths(args: argparse.Namespace) -> tuple[Path, Path, Path, Path]:
    workspace = args.workspace.resolve()
    runtime_dir = (args.runtime_dir or (workspace / ".cana-loop")).resolve()
    config_path = (args.config or (ENGINE_ROOT / "config" / "runtime.json")).resolve()
    lanes_path = (args.lanes or (ENGINE_ROOT / "config" / "lanes.json")).resolve()
    return workspace, runtime_dir, config_path, lanes_path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="CANA sovereign loop supervisor")
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--runtime-dir", type=Path)
    parser.add_argument("--config", type=Path)
    parser.add_argument("--lanes", type=Path)
    parser.add_argument("--server-url", default="http://127.0.0.1:4096")
    parser.add_argument("--opencode-pid", type=int)
    parser.add_argument("--max-parallel-lanes", type=int, default=5)
    parser.add_argument("--enable-codex", action="store_true")
    parser.add_argument("--max-parallel-codex", type=int, default=1)
    parser.add_argument("--hours", type=float)
    parser.add_argument("--until-release-ready", action="store_true")
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--mock", action="store_true")
    parser.add_argument("--mock-profile", type=Path)
    parser.add_argument("--preflight", action="store_true")
    parser.add_argument("--status", action="store_true")
    parser.add_argument("--extend-hours", type=float)
    parser.add_argument("--set-protected-base")
    parser.add_argument("--requeue-clean-base", action="store_true")
    parser.add_argument("--repair-codex-compatibility")
    parser.add_argument("--repair-codex-false-usage-limit")
    parser.add_argument("--repair-codex-verification-environment")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    workspace, runtime_dir, config_path, lanes_path = load_paths(args)
    if (
        args.set_protected_base
        or args.requeue_clean_base
        or args.repair_codex_compatibility
        or args.repair_codex_false_usage_limit
        or args.repair_codex_verification_environment
    ):
        store = StateStore(runtime_dir / "state.sqlite3")
        try:
            worktrees = WorktreeManager(workspace, runtime_dir, store)
            result: dict[str, Any] = {}
            if args.set_protected_base:
                if not worktrees.primary_is_clean():
                    raise RuntimeError(
                        "refusing to protect a baseline while the primary worktree is dirty"
                    )
                commit = worktrees.resolve_commit(args.set_protected_base)
                ancestor = run_process(
                    ["git", "merge-base", "--is-ancestor", commit, "HEAD"],
                    cwd=workspace,
                    timeout=60,
                )
                if ancestor.returncode != 0:
                    raise RuntimeError(
                        "protected baseline must be an ancestor of the current HEAD"
                    )
                store.set_runtime("baseline_commit", commit)
                store.set_runtime("protected_integration_base", commit)
                store.event("protected_integration_base_set", {"commit": commit})
                result["baseline_commit"] = commit
                result["protected_integration_base"] = commit
            if args.requeue_clean_base:
                if not worktrees.primary_is_clean():
                    raise RuntimeError(
                        "refusing to requeue clean-base missions while the primary worktree is dirty"
                    )
                result["requeued_missions"] = MissionQueue(
                    store
                ).requeue_clean_base_blocked()
            if args.repair_codex_compatibility:
                if not worktrees.primary_is_clean():
                    raise RuntimeError(
                        "refusing Codex compatibility repair while the primary tree is dirty"
                    )
                mission_id = str(args.repair_codex_compatibility)
                codex_lane = CodexLane(store)
                mission = codex_lane.get(mission_id)
                if not mission:
                    raise KeyError(mission_id)
                evidence = json.loads(mission["result_evidence_json"])
                compatibility_evidence = False
                for item in evidence:
                    artifact = Path(str(item.get("artifact_path") or ""))
                    if not artifact.is_file():
                        continue
                    text = artifact.read_text(
                        encoding="utf-8", errors="replace"
                    ).lower()
                    if (
                        "requires a newer version of codex" in text
                        or "unsupported model" in text
                    ):
                        compatibility_evidence = True
                        break
                if not compatibility_evidence:
                    raise RuntimeError(
                        "no preserved CLI/model compatibility failure evidence exists"
                    )
                runtime_config = json.loads(
                    config_path.read_text(encoding="utf-8-sig")
                )
                codex_config = runtime_config.get("codex", {})
                codex_adapter = CodexAdapter(
                    workspace=workspace,
                    runtime_dir=runtime_dir,
                    config=codex_config,
                )
                capabilities = codex_adapter.discover()
                if not (
                    capabilities.installed
                    and capabilities.authenticated
                    and capabilities.noninteractive_exec
                ):
                    raise RuntimeError(
                        "installed Codex is not ready after compatibility repair"
                    )
                superseded = codex_lane.repair_cli_compatibility(
                    mission_id
                )
                store.execute(
                    """
                    UPDATE codex_usage_daily SET job_count=0,updated_at=?
                    WHERE usage_day=?
                    """,
                    (
                        utc_now(),
                        dt.datetime.now(dt.timezone.utc).date().isoformat(),
                    ),
                )
                store.execute(
                    """
                    DELETE FROM cooldowns
                    WHERE scope_type='codex' AND scope_id='blade-0'
                    """
                )
                store.set_runtime(
                    "codex_capabilities", capabilities.to_dict()
                )
                result["codex_compatibility_requeued"] = mission_id
                result["superseded_loop_doctors"] = superseded
                result["codex_version"] = capabilities.version
            if args.repair_codex_false_usage_limit:
                if not worktrees.primary_is_clean():
                    raise RuntimeError(
                        "refusing Codex classification repair while the primary tree is dirty"
                    )
                mission_id = str(args.repair_codex_false_usage_limit)
                codex_lane = CodexLane(store)
                run_id = codex_lane.repair_false_usage_limit(mission_id)
                store.execute(
                    """
                    DELETE FROM cooldowns
                    WHERE scope_type='codex' AND scope_id='blade-0'
                      AND reason='usage_limit'
                    """
                )
                result["codex_false_usage_limit_requeued"] = mission_id
                result["reclassified_successful_run"] = run_id
            if args.repair_codex_verification_environment:
                if not worktrees.primary_is_clean():
                    raise RuntimeError(
                        "refusing verification-runner repair while the primary tree is dirty"
                    )
                mission_id = str(args.repair_codex_verification_environment)
                codex_lane = CodexLane(store)
                superseded = codex_lane.repair_verification_environment(
                    mission_id
                )
                result["codex_verification_environment_requeued"] = mission_id
                result["superseded_loop_doctors"] = superseded
            Reporter(workspace, runtime_dir, store).write()
            print(json.dumps(result, indent=2))
            return 0
        finally:
            store.close()
    if args.status:
        store = StateStore(runtime_dir / "state.sqlite3")
        try:
            print(json.dumps(Reporter(workspace, runtime_dir, store).write(), indent=2))
            return 0
        finally:
            store.close()
    if args.extend_hours is not None:
        store = StateStore(runtime_dir / "state.sqlite3")
        try:
            ending = store.get_runtime("ending_condition", {})
            base = ending.get("ends_at") or utc_now()
            ending.update(
                {
                    "kind": "hours",
                    "ends_at": add_seconds(base, float(args.extend_hours) * 3600),
                    "extended_at": utc_now(),
                    "extension_hours": float(args.extend_hours),
                }
            )
            store.set_runtime("ending_condition", ending)
            print(json.dumps(ending, indent=2))
            return 0
        finally:
            store.close()
    mock_profile = (
        json.loads(args.mock_profile.read_text(encoding="utf-8"))
        if args.mock_profile
        else {}
    )
    supervisor: Supervisor | None = None
    try:
        mode = "mock" if args.mock else "external"
        supervisor = Supervisor(
            workspace=workspace,
            runtime_dir=runtime_dir,
            config_path=config_path,
            lanes_path=lanes_path,
            server_url=args.server_url,
            max_parallel_lanes=args.max_parallel_lanes,
            mode=mode,
            hours=args.hours,
            until_release_ready=args.until_release_ready,
            mock_profile=mock_profile,
            opencode_pid=args.opencode_pid,
            enable_codex=args.enable_codex,
            max_parallel_codex=args.max_parallel_codex,
        )
        if args.preflight:
            result = supervisor.preflight(require_server=not args.mock)
            print(json.dumps(result, indent=2))
            return 0 if result["ok"] else 2
        with SingleInstanceLock(runtime_dir / "supervisor.lock"):
            return supervisor.run(once=args.once)
    except AlreadyRunning as exc:
        print(str(exc), file=sys.stderr)
        return 3
    except KeyboardInterrupt:
        return 130
    except Exception as exc:
        crash = {
            "timestamp": utc_now(),
            "error_class": type(exc).__name__,
            "message": sanitize(str(exc), secret_values([lane["secret_reference"] for lane in supervisor.lanes] if supervisor else [])),
            "traceback": sanitize(traceback.format_exc(), secret_values([lane["secret_reference"] for lane in supervisor.lanes] if supervisor else [])),
        }
        runtime_dir.mkdir(parents=True, exist_ok=True)
        atomic_write_json(runtime_dir / "last_crash.json", crash)
        if supervisor:
            supervisor.store.event("supervisor_crash", {"error_class": type(exc).__name__})
            supervisor.reporter.write()
        return 1
    finally:
        if supervisor:
            supervisor.close()


if __name__ == "__main__":
    raise SystemExit(main())
