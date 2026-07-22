"""Bounded Blade 0 mission execution with durable evidence and review holds."""

from __future__ import annotations

import json
import os
import re
import uuid
from pathlib import Path
from typing import Any, Callable

from codex_adapter import CodexAdapter, CodexExecution
from codex_health import CodexHealth
from codex_lane import (
    CodexLane,
    CodexMissionSpec,
    CodexTransitionError,
)
from improvement_contract import frontier_snapshot, validate_improvement_contract
from mission_queue import MissionQueue
from no_progress_detector import NoProgressDetector
from runtime_utils import canonical_json, run_process, sha256_text, utc_now
from security import unauthorized_codex_invocations
from state_store import StateStore
from verification_gate import VerificationGate, VerificationResult
from worktree_manager import WorktreeManager, WorktreeReceipt


FIRST_CODEX_MISSION_ID = "CODEX-RELEASE-MERCHANT-001"


class CodexMissionRunner:
    def __init__(
        self,
        *,
        workspace: Path,
        runtime_dir: Path,
        store: StateStore,
        lane: CodexLane,
        adapter: CodexAdapter,
        health: CodexHealth,
        worktrees: WorktreeManager,
        verification: VerificationGate,
        review_queue: MissionQueue,
        no_progress: NoProgressDetector,
        lanes: list[dict[str, Any]],
        prompts_dir: Path,
        config: dict[str, Any],
        manual_stop: Callable[[], bool],
        heartbeat: Callable[..., None],
    ):
        self.workspace = workspace.resolve()
        self.runtime_dir = runtime_dir.resolve()
        self.store = store
        self.lane = lane
        self.adapter = adapter
        self.health = health
        self.worktrees = worktrees
        self.verification = verification
        self.review_queue = review_queue
        self.no_progress = no_progress
        self.lanes = lanes
        self.prompts_dir = prompts_dir
        self.config = config
        self.manual_stop = manual_stop
        self.heartbeat = heartbeat

    def ensure_seeded(self) -> list[str]:
        protected = self.worktrees.protected_base()
        created: list[str] = []
        first = CodexMissionSpec(
            mission_id=FIRST_CODEX_MISSION_ID,
            objective=(
                "Harden retailer-manager dashboard profile, menu, catalog, inventory, "
                "and deal mutations with bounded validation, transactional writes, "
                "duplicate prevention, ownership preservation, minimal audit evidence, "
                "and meaningful regression tests."
            ),
            priority_reason=(
                "The current scorecard and next-action record identify merchant mutation "
                "integrity as the highest-value unblocked release-integrity weakness."
            ),
            completion_contract_ids=[
                "RELEASE-INTEGRITY",
                "AUTHORIZATION",
                "VALIDATION",
                "TRANSACTIONAL-CONSISTENCY",
                "TRUTHFUL-DATA",
            ],
            acceptance_criteria=[
                "all dashboard mutation inputs have explicit server-side bounds and validation",
                "multi-write mutations are atomic",
                "duplicate menu/catalog records are prevented deterministically",
                "price, quantity, and duration constraints reject unsafe values",
                "retailer-manager ownership checks remain enforced for every mutation",
                "audit records contain necessary identifiers without oversharing form data",
                "meaningful tests prove rejection, ownership, duplicate, and transaction behavior",
                "targeted tests and git diff validation pass",
            ],
            prohibited_actions=[
                "public deployment",
                "force push or history rewrite",
                "credential access or changes",
                "Codex invocation from authored code",
                "self-approval or self-integration",
                "unrelated product redesign",
            ],
            baseline_revision=protected,
            priority=1000,
            codex_mode="sovereign-builder",
            maximum_attempts=max(1, int(self.config.get("maximum_attempts", 3))),
            high_impact=True,
            assumptions=[
                "The scorecard correctly ranks mutation integrity as the highest release risk.",
                "Existing ownership rules are valid and must be preserved.",
            ],
            sota_gap=(
                "Merchant mutation paths lack uniformly bounded, atomic, duplicate-safe "
                "server enforcement with regression evidence."
            ),
            brittle_point=(
                "A partial hardening can appear correct while one mutation path still "
                "bypasses ownership, validation, or transaction boundaries."
            ),
            success_metrics=[
                "all named mutation paths have server-side bounds",
                "multi-write paths are transactional",
                "behavior-focused tests reject unsafe and duplicate operations",
                "targeted verification passes",
            ],
            feedback_signals=[
                "changed-file inventory",
                "targeted test receipts",
                "authorization and validation assertions",
                "candidate revision hash",
            ],
        )
        if self.lane.enqueue(first):
            created.append(first.mission_id)
        return created

    def _evidence_inventory(self) -> dict[str, dict[str, Any]]:
        control = self.workspace / "CANA_CONTROL_TOWER"
        names = [
            "COMPLETION_CONTRACT.md",
            "PRODUCT_SURFACE_INVENTORY.md",
            "QUALITY_SCORECARD.md",
            "PROMISE_TO_PROOF_LEDGER.md",
            "CURRENT_STATE.md",
            "BLOCKERS.md",
            "AMBITION_ROADMAP.md",
            "NEXT_ACTION.md",
            "BASELINE_RECEIPT.md",
        ]
        result: dict[str, dict[str, Any]] = {}
        for name in names:
            path = control / name
            if not path.is_file():
                result[name] = {"status": "MISSING"}
                continue
            text = path.read_text(encoding="utf-8", errors="replace")
            result[name] = {
                "status": "PRESENT",
                "sha256": sha256_text(text),
                "characters": len(text),
            }
        return result

    def _prompt(self, mission: dict[str, Any], receipt: WorktreeReceipt) -> str:
        mode = str(mission["codex_mode"])
        prompt_name = {
            "loop-doctor": "codex-loop-doctor.md",
            "reviewer": "codex-reviewer.md",
            "builder": "codex-builder.md",
            "sovereign-builder": "codex-sovereign.md",
        }.get(mode, "codex-sovereign.md")
        base = (self.prompts_dir / prompt_name).read_text(
            encoding="utf-8", errors="replace"
        )
        builder = ""
        if mode in {"builder", "sovereign-builder"}:
            builder = (self.prompts_dir / "codex-builder.md").read_text(
                encoding="utf-8", errors="replace"
            )
        compounding = ""
        if mode == "sovereign":
            compounding = (
                self.prompts_dir / "zenith-compounding.md"
            ).read_text(encoding="utf-8", errors="replace")
        contract = {
            "mission_id": mission["mission_id"],
            "objective": mission["objective"],
            "priority_reason": mission["priority_reason"],
            "completion_contract_ids": json.loads(
                mission["completion_contract_ids_json"]
            ),
            "acceptance_criteria": json.loads(
                mission["acceptance_criteria_json"]
            ),
            "prohibited_actions": json.loads(
                mission["prohibited_actions_json"]
            ),
            "baseline_revision": receipt.base_reference,
            "isolated_worktree": str(receipt.path),
            "attempt": mission["attempt_count"],
            "strategy_revision": mission["strategy_revision"],
            "assumptions": json.loads(mission["assumptions_json"]),
            "sota_gap": mission["sota_gap"],
            "brittle_point": mission["brittle_point"],
            "success_metrics": json.loads(mission["success_metrics_json"]),
            "feedback_signals": json.loads(mission["feedback_signals_json"]),
            "benchmark_evidence": json.loads(
                mission.get("benchmark_evidence_json") or "[]"
            ),
            "measurement_contract": json.loads(
                mission.get("measurement_contract_json") or "[]"
            ),
            "falsification_test": mission.get("falsification_test") or "",
            "promotion_rule": mission.get("promotion_rule") or "",
            "next_frontier": mission.get("next_frontier") or "",
            "frontier_epoch": int(mission.get("frontier_epoch") or 1),
            "frontier_state": frontier_snapshot(self.store),
            "evidence_inventory": self._evidence_inventory(),
        }
        return (
            f"{base}\n\n{builder}\n\n{compounding}\n\n"
            "## Durable mission contract\n\n"
            f"```json\n{json.dumps(contract, indent=2)}\n```\n\n"
            "Work only inside the assigned worktree. Inspect repository evidence directly. "
            "The control-tower inventory above is truthful: do not invent missing documents. "
            "For any Next.js code, first read the relevant documentation under "
            "`node_modules/next/dist/docs/` as required by `apps/web/AGENTS.md`. "
            "Implement the bounded change and tests now. Do not invoke Codex, merge, approve "
            "your own work, deploy, push, alter credentials, or change the protected baseline. "
            "Leave changes in the worktree for the supervisor to verify and commit. End with "
            "a concise evidence report containing changed files, checks attempted, remaining "
            "risks, and exact acceptance-criteria coverage."
        )

    def _receipt(self, mission: dict[str, Any]) -> WorktreeReceipt:
        existing = mission.get("worktree")
        if existing:
            path = Path(str(existing)).resolve()
            if (
                path.is_dir()
                and self.worktrees.root in path.parents
                and mission.get("branch_name")
            ):
                return WorktreeReceipt(
                    mission["mission_id"],
                    path,
                    str(mission["branch_name"]),
                    str(mission["baseline_revision"]),
                    f"worktree:resume:{mission['mission_id']}",
                    "codex_missions",
                )
        return self.worktrees.create(
            mission["mission_id"],
            base_reference=str(mission["baseline_revision"]),
            mission_table="codex_missions",
            branch_namespace="cana-codex",
        )

    def _verification_commands(self, modifying: bool) -> list[list[str]]:
        key = (
            "targeted_verification_commands"
            if modifying
            else "readonly_verification_commands"
        )
        commands = self.config.get(key, [])
        return [[str(part) for part in command] for command in commands]

    @staticmethod
    def _verification_evidence(
        result: VerificationResult,
    ) -> list[dict[str, Any]]:
        return [
            {
                "command_id": command.command_id,
                "argv": command.argv,
                "exit_code": command.exit_code,
                "timed_out": command.timed_out,
                "output_hash": command.output_hash,
                "artifact_path": command.artifact_path,
            }
            for command in result.commands
        ]

    def _combined_evidence(
        self, mission_id: str, additions: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        row = self.lane.get(mission_id)
        existing = (
            json.loads(row["result_evidence_json"])
            if row and row.get("result_evidence_json")
            else []
        )
        return [*existing, *additions]

    def _active_children(self, child_pid: int | None = None) -> None:
        opencode_pid = self.store.get_runtime("opencode_pid")
        children: list[dict[str, Any]] = []
        if opencode_pid:
            children.append({"kind": "opencode", "pid": opencode_pid})
        if child_pid:
            children.append({"kind": "codex", "pid": child_pid})
        self.store.set_runtime("active_child_processes", children)
        self.store.set_runtime("codex_child_pid", child_pid)

    def _on_start(
        self,
        mission: dict[str, Any],
        prompt_hash: str,
        run_id: str,
        pid: int,
        command_structure: list[str],
    ) -> None:
        now = utc_now()
        self.store.execute(
            """
            INSERT INTO codex_runs(
              run_id,mission_id,state,process_id,command_structure_json,
              prompt_hash,started_at
            ) VALUES(?,?,'running',?,?,?,?)
            """,
            (
                run_id,
                mission["mission_id"],
                pid,
                canonical_json(command_structure),
                prompt_hash,
                now,
            ),
        )
        self.store.execute(
            """
            UPDATE codex_missions
            SET state='CODEX_WORKING',process_id=?,command_structure_json=?,
              prompt_hash=?,next_action='complete bounded implementation',
              updated_at=?
            WHERE mission_id=? AND state='CODEX_STARTING'
            """,
            (
                pid,
                canonical_json(command_structure),
                prompt_hash,
                now,
                mission["mission_id"],
            ),
        )
        self._active_children(pid)
        self.heartbeat(
            "codex-working",
            mission_id=mission["mission_id"],
            progress_token=run_id,
            codex_pid=pid,
        )

    def _record_execution(
        self, mission_id: str, execution: CodexExecution
    ) -> None:
        self.store.execute(
            """
            UPDATE codex_runs
            SET state=?,session_id=?,output_hash=?,artifact_path=?,error_class=?,
              exit_code=?,finished_at=?
            WHERE run_id=?
            """,
            (
                "completed" if execution.ok else "failed",
                execution.session_id,
                execution.output_hash,
                execution.artifact_path,
                execution.error_class,
                execution.exit_code,
                execution.finished_at,
                execution.run_id,
            ),
        )
        evidence = [
            {
                "run_id": execution.run_id,
                "output_hash": execution.output_hash,
                "artifact_path": execution.artifact_path,
                "error_class": execution.error_class,
                "exit_code": execution.exit_code,
                "started_at": execution.started_at,
                "finished_at": execution.finished_at,
            }
        ]
        self.store.execute(
            """
            UPDATE codex_missions
            SET session_id=?,process_id=NULL,result_evidence_json=?,updated_at=?
            WHERE mission_id=?
            """,
            (
                execution.session_id,
                canonical_json(
                    self._combined_evidence(mission_id, evidence)
                ),
                utc_now(),
                mission_id,
            ),
        )
        self._active_children(None)

    def _handle_execution_failure(
        self, mission: dict[str, Any], execution: CodexExecution
    ) -> None:
        mission_id = mission["mission_id"]
        error = execution.error_class or "worker_exit"
        if error == "usage_limit":
            until_at = self.health.record_cooldown(
                error, int(self.config.get("usage_cooldown_seconds", 3600))
            )
            self.lane.transition(
                mission_id,
                "CODEX_USAGE_LIMIT",
                next_action=f"resume automatically after {until_at}",
                updates={
                    "blocker_classification": "codex_usage_limit",
                    "lease_owner": None,
                    "lease_started_at": None,
                    "lease_expires_at": None,
                },
            )
            return
        if error == "auth_required":
            self.lane.transition(
                mission_id,
                "CODEX_AUTH_REQUIRED",
                next_action="resume automatically when authenticated Codex becomes available",
                updates={
                    "blocker_classification": "codex_auth_required",
                    "lease_owner": None,
                    "lease_started_at": None,
                    "lease_expires_at": None,
                },
            )
            return
        if error == "configuration":
            until_at = self.health.record_cooldown(
                error,
                int(self.config.get("configuration_cooldown_seconds", 900)),
            )
            self.lane.transition(
                mission_id,
                "CODEX_COOLDOWN",
                next_action=(
                    "refresh installed CLI/model compatibility, then resume "
                    f"automatically after {until_at}"
                ),
                updates={
                    "blocker_classification": "codex_cli_or_model_compatibility",
                    "session_id": None,
                    "lease_owner": None,
                    "lease_started_at": None,
                    "lease_expires_at": None,
                },
            )
            return
        current = self.lane.transition(
            mission_id,
            "CODEX_RETRYABLE_FAILURE",
            next_action="recover bounded job from durable worktree and session",
            updates={
                "blocker_classification": error,
                "process_id": None,
                "lease_owner": None,
                "lease_started_at": None,
                "lease_expires_at": None,
            },
        )
        assessment = self.no_progress.observe(
            mission_id,
            {
                "prompt_hash": execution.prompt_hash,
                "plan_hash": sha256_text(
                    f"{current['objective']}|strategy:{current.get('strategy_revision', 1)}"
                ),
                "failure_class": error,
                "changed_files": json.loads(current["changed_files_json"]),
                "evidence_hash": execution.output_hash,
                "criteria_movement": 0,
                "score_movement": 0,
                "strategy_revision": current.get("strategy_revision", 1),
            },
        )
        if error in {"configuration", "timeout"} or assessment.occurrences >= 2:
            self.store.execute(
                """
                UPDATE codex_missions SET session_id=NULL,
                  next_action='replace stale session and retry from fresh repository state',
                  updated_at=? WHERE mission_id=?
                """,
                (utc_now(), mission_id),
            )
            self.store.event(
                "codex_stale_session_replaced",
                {
                    "error_class": error,
                    "occurrences": assessment.occurrences,
                },
                mission_id,
            )
        if (
            int(current["attempt_count"]) >= int(current["maximum_attempts"])
            or assessment.no_progress
        ):
            self.lane.transition(
                mission_id,
                "CODEX_TERMINAL_FAILURE",
                next_action="inspect preserved evidence and run Loop Doctor prerequisite",
                updates={
                    "blocker_classification": (
                        "no_progress" if assessment.no_progress else "retry_ceiling"
                    )
                },
            )
            self._queue_loop_doctor(mission_id, error)
            return
        self.lane.transition(
            mission_id,
            "CODEX_QUEUED",
            next_action="resume supported session in preserved worktree",
        )

    def _queue_loop_doctor(self, parent_id: str, reason: str) -> str:
        mission_id = f"CODEX-DOCTOR-{uuid.uuid4().hex[:10]}"
        self.lane.enqueue(
            CodexMissionSpec(
                mission_id=mission_id,
                parent_mission_id=parent_id,
                objective=(
                    f"Diagnose Blade 0 no-progress or failure for {parent_id}, preserve "
                    "evidence, and define a narrower restartable prerequisite without edits."
                ),
                priority_reason=f"Loop Doctor redirect required after {reason}.",
                completion_contract_ids=["DURABLE-RECOVERY", "NO-PROGRESS"],
                acceptance_criteria=[
                    "actual cause is evidence-backed",
                    "next mission is narrowed or split",
                    "no implementation or approval is fabricated",
                ],
                prohibited_actions=[
                    "repository modification",
                    "Codex invocation",
                    "credential access",
                    "self-approval",
                ],
                baseline_revision=self.worktrees.protected_base(),
                priority=950,
                codex_mode="loop-doctor",
                maximum_attempts=2,
                high_impact=False,
                assumptions=[
                    "Preserved run evidence can distinguish a product defect from an execution defect."
                ],
                sota_gap="Convert a terminal or repeated failure into a narrower executable prerequisite.",
                brittle_point="The diagnosis may repeat the same approach under a different label.",
                success_metrics=[
                    "cause is tied to preserved evidence",
                    "next strategy differs measurably",
                    "no implementation or approval is fabricated",
                ],
                feedback_signals=[
                    "failure class",
                    "no-progress fingerprint",
                    "preserved run and verification receipts",
                ],
                strategy_revision=2,
            )
        )
        return mission_id

    def _schedule_continuation(self, parent_id: str) -> str:
        mission_id = f"CODEX-NEXT-{uuid.uuid4().hex[:10]}"
        parent = self.lane.get(parent_id)
        frontier = frontier_snapshot(self.store)
        self.lane.enqueue(
            CodexMissionSpec(
                mission_id=mission_id,
                parent_mission_id=parent_id,
                objective=(
                    "Inspect fresh repository and control-tower state, rank the next "
                    "highest-value unblocked Horizon A, B, or C mission after "
                    f"{parent_id}, and produce an evidence-backed measurable mission "
                    "contract without modifying code."
                ),
                priority_reason=(
                    "Blade 0 must continue useful selection work while the current "
                    "high-impact candidate waits for independent external review."
                ),
                completion_contract_ids=[
                    "CONTINUOUS-SELECTION",
                    "CATEGORY-LEADERSHIP",
                ],
                acceptance_criteria=[
                    "one non-duplicate next mission is ranked against alternatives",
                    "user problem, evidence, differentiation, success measure, risk, cost, dependencies, and rollback are explicit",
                    "current benchmark evidence names the observed capability and observation date",
                    "at least one numeric outcome strictly improves and one numeric guardrail does not regress",
                    "falsification, promotion, and next-frontier rules are explicit",
                    "missing evidence is labeled missing rather than invented",
                ],
                prohibited_actions=[
                    "repository modification",
                    "self-approval",
                    "public deployment",
                    "credential access",
                    "Codex invocation",
                ],
                baseline_revision=self.worktrees.protected_base(),
                priority=500,
                codex_mode="sovereign",
                maximum_attempts=2,
                high_impact=False,
                assumptions=[
                    "Fresh evidence can expose a higher-value gap than repeated discussion.",
                    "A recommendation is useful only with a baseline and falsifiable target.",
                ],
                sota_gap="Identify the highest-value unblocked gap without repeating prior recommendations.",
                brittle_point="A selection cycle can consume inference while producing no new measurable strategy.",
                success_metrics=[
                    "recommendation differs from its parent cycle",
                    "baseline and target metric are explicit",
                    "outcome target strictly beats its bound baseline",
                    "guardrail target is equal or better than its bound baseline",
                    "one weakest assumption and falsification test are explicit",
                    "risk, cost, dependency, and rollback are named",
                ],
                feedback_signals=[
                    "repository HEAD",
                    "control-tower evidence hashes",
                    "prior mission lineage",
                    "recommendation fingerprint",
                    "current competitor and product benchmark evidence",
                    "numeric outcome and guardrail receipts",
                ],
                falsification_test=(
                    "Reject the recommendation when its comparison evidence is stale, "
                    "its outcome does not improve, or any guardrail regresses."
                ),
                promotion_rule=str(frontier["promotion_rule"]),
                next_frontier=(
                    "If the candidate is promoted, bind the measured result as the "
                    "next baseline and attack the next highest-value constraint."
                ),
                frontier_epoch=int(frontier["frontier_epoch"]),
                strategy_revision=max(
                    2, int((parent or {}).get("strategy_revision") or 1) + 1
                ),
            )
        )
        return mission_id

    @staticmethod
    def _parse_recommended_contract(text: str) -> dict[str, Any] | None:
        match = re.search(
            r"CANA_JSON_START\s*(.*?)\s*CANA_JSON_END",
            text,
            flags=re.DOTALL | re.IGNORECASE,
        )
        if not match:
            return None
        payload = match.group(1).strip()
        payload = re.sub(r"^```(?:json)?\s*", "", payload, flags=re.IGNORECASE)
        payload = re.sub(r"\s*```$", "", payload)
        try:
            value = json.loads(payload)
        except json.JSONDecodeError:
            return None
        if not isinstance(value, dict):
            return None
        required = (
            "mission_id",
            "horizon",
            "objective",
            "sota_gap",
            "assumptions",
            "brittle_point",
            "evidence",
            "success_measure",
            "acceptance_tests",
            "allowed_files",
            "prohibited_actions",
            "risk_tier",
            "risk",
            "dependencies",
            "experiment",
            "rollback",
            "maximum_attempts",
            "benchmark_evidence",
            "measurement_contract",
            "falsification_test",
            "promotion_rule",
            "next_frontier",
        )
        if any(field not in value for field in required):
            return None
        if any(
            not str(value.get(field) or "").strip()
            for field in (
                "mission_id",
                "horizon",
                "objective",
                "sota_gap",
                "brittle_point",
                "risk_tier",
                "risk",
                "experiment",
                "rollback",
                "falsification_test",
                "promotion_rule",
                "next_frontier",
            )
        ):
            return None
        validation = validate_improvement_contract(value)
        if not validation.valid:
            return None
        value["benchmark_evidence"] = list(validation.benchmark_evidence)
        value["measurement_contract"] = list(validation.measurements)
        return value

    @staticmethod
    def _agent_text(artifact_path: str) -> str:
        path = Path(artifact_path)
        if not path.is_file():
            return ""
        messages: list[str] = []
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            item = event.get("item") if isinstance(event, dict) else None
            if (
                isinstance(item, dict)
                and item.get("type") == "agent_message"
                and item.get("text")
            ):
                messages.append(str(item["text"]))
        return "\n".join(messages)

    @staticmethod
    def _string_list(value: Any) -> list[str]:
        if isinstance(value, str):
            value = [value]
        if not isinstance(value, list):
            return []
        return [
            str(item).strip()[:1000]
            for item in value[:50]
            if str(item).strip()
        ]

    def _materialize_recommended_mission(
        self, parent: dict[str, Any], execution: CodexExecution
    ) -> str | None:
        protected_base = self.worktrees.protected_base()
        if str(parent["baseline_revision"]) != protected_base:
            self.store.event(
                "codex_selection_baseline_advanced",
                {
                    "selection_baseline": str(parent["baseline_revision"]),
                    "protected_baseline": protected_base,
                    "recommendation_materialized": False,
                },
                parent["mission_id"],
            )
            return None
        contract = self._parse_recommended_contract(
            self._agent_text(execution.artifact_path)
        )
        if not contract:
            failures = int(
                self.store.get_runtime("selection_contract_failure_count", 0)
            ) + 1
            self.store.set_runtime("selection_contract_failure_count", failures)
            self.store.event(
                "codex_selection_contract_missing",
                {"failure_count": failures, "run_id": execution.run_id},
                parent["mission_id"],
            )
            return None
        raw_id = str(contract["mission_id"]).upper()
        mission_id = re.sub(r"[^A-Z0-9_-]+", "-", raw_id).strip("-")[:96]
        if not mission_id:
            mission_id = f"CODEX-BUILD-{uuid.uuid4().hex[:12]}"
        acceptance = self._string_list(contract.get("acceptance_tests"))
        success = self._string_list(contract.get("success_measure"))
        allowed = self._string_list(contract.get("allowed_files"))
        if allowed:
            acceptance.append("Allowed file scope: " + ", ".join(allowed))
        assumptions = self._string_list(contract.get("assumptions"))
        assumptions.extend(
            f"Unresolved evidence: {item}"
            for item in self._string_list(contract.get("unknowns"))
        )
        prohibited = self._string_list(contract.get("prohibited_actions"))
        prohibited.extend(
            [
                "Codex invocation",
                "self-approval or self-integration",
                "credential access",
                "public deployment",
                "force push or history rewrite",
            ]
        )
        horizon = str(contract.get("horizon") or "A").upper()
        priority = {"A": 900.0, "B": 700.0, "C": 500.0}.get(horizon, 500.0)
        risk_tier = str(contract.get("risk_tier") or "UNCLASSIFIED")
        try:
            requested_attempts = int(contract.get("maximum_attempts") or 2)
        except (TypeError, ValueError):
            requested_attempts = 2
        maximum_attempts = max(1, min(3, requested_attempts))
        frontier = frontier_snapshot(self.store)
        created = self.lane.enqueue(
            CodexMissionSpec(
                mission_id=mission_id,
                parent_mission_id=parent["mission_id"],
                objective=str(contract["objective"]).strip()[:4000],
                priority_reason=(
                    f"Horizon {horizon}; selected from verified repository evidence. "
                    f"Risk tier: {risk_tier}."
                ),
                completion_contract_ids=[horizon, risk_tier],
                acceptance_criteria=acceptance or success,
                prohibited_actions=sorted(set(prohibited)),
                baseline_revision=self.worktrees.protected_base(),
                priority=priority,
                codex_mode="sovereign-builder",
                maximum_attempts=maximum_attempts,
                high_impact=True,
                assumptions=assumptions
                or ["The cited repository evidence remains valid at lease time."],
                sota_gap=str(
                    contract.get("sota_gap")
                    or contract.get("hypothesis")
                    or contract["objective"]
                ).strip()[:4000],
                brittle_point=str(
                    contract.get("brittle_point") or contract["risk"]
                ).strip()[:4000],
                success_metrics=success or acceptance,
                feedback_signals=[
                    "exact baseline revision",
                    "changed-file inventory",
                    "targeted verification receipts",
                    "acceptance-criteria coverage",
                    *[
                        str(item["verification"])
                        for item in contract["measurement_contract"]
                    ],
                ],
                benchmark_evidence=list(contract["benchmark_evidence"]),
                measurement_contract=list(contract["measurement_contract"]),
                falsification_test=str(contract["falsification_test"]).strip()[:4000],
                promotion_rule=str(contract["promotion_rule"]).strip()[:4000],
                next_frontier=str(contract["next_frontier"]).strip()[:4000],
                frontier_epoch=int(frontier["frontier_epoch"]),
            )
        )
        if created:
            self.store.set_runtime("selection_contract_failure_count", 0)
            self.store.event(
                "codex_recommendation_materialized",
                {
                    "recommended_mission_id": mission_id,
                    "parent_mission_id": parent["mission_id"],
                    "horizon": horizon,
                    "risk_tier": risk_tier,
                    "frontier_epoch": int(frontier["frontier_epoch"]),
                    "measurement_count": len(contract["measurement_contract"]),
                },
                parent["mission_id"],
            )
            return mission_id
        self.store.event(
            "codex_recommendation_duplicate",
            {"recommended_mission_id": mission_id},
            parent["mission_id"],
        )
        return None

    def ensure_continuation(self) -> str | None:
        failure_count = int(
            self.store.get_runtime("selection_contract_failure_count", 0)
        )
        if failure_count >= int(
            self.config.get("selection_contract_failure_threshold", 3)
        ):
            return None
        backlog_cap = max(
            1, int(self.config.get("maximum_pending_builder_missions", 20))
        )
        pending_builders = self.store.row(
            """
            SELECT COUNT(*) AS count FROM codex_missions
            WHERE high_impact=1 AND state NOT IN (
              'CODEX_TERMINAL_FAILURE','CODEX_COMPLETED','CODEX_REJECTED',
              'CODEX_INTEGRATED','CODEX_REVERTED'
            )
            """
        )
        if int((pending_builders or {"count": 0})["count"]) >= backlog_cap:
            return None
        selection = self.store.row(
            """
            SELECT mission_id FROM codex_missions
            WHERE high_impact=0 AND state IN (
              'CODEX_QUEUED','CODEX_STARTING','CODEX_WORKING','CODEX_TESTING',
              'CODEX_REPAIRING','CODEX_COOLDOWN','CODEX_USAGE_LIMIT',
              'CODEX_AUTH_REQUIRED','CODEX_RETRYABLE_FAILURE'
            ) LIMIT 1
            """
        )
        if selection:
            return None
        parent = self.store.row(
            """
            SELECT mission_id FROM codex_missions
            ORDER BY updated_at DESC LIMIT 1
            """
        )
        parent_id = (
            str(parent["mission_id"]) if parent else FIRST_CODEX_MISSION_ID
        )
        mission_id = self._schedule_continuation(parent_id)
        self.store.set_runtime(
            "codex_next_mission",
            {"mission_id": mission_id, "scheduled_at": utc_now()},
        )
        return mission_id

    def _complete_nonmodifying(
        self,
        mission: dict[str, Any],
        receipt: WorktreeReceipt,
        execution: CodexExecution,
    ) -> None:
        result = self.verification.run(
            mission_id=mission["mission_id"],
            stage="codex-readonly",
            commands=self._verification_commands(False),
            working_directory=receipt.path,
            timeout_seconds=int(
                self.config.get("verification_timeout_seconds", 300)
            ),
        )
        evidence = self._verification_evidence(result)
        self.store.execute(
            """
            UPDATE codex_missions
            SET tests_executed_json=?,result_evidence_json=?,
              progress_delta_json=?,updated_at=?
            WHERE mission_id=?
            """,
            (
                canonical_json([item["argv"] for item in evidence]),
                canonical_json(
                    self._combined_evidence(mission["mission_id"], evidence)
                ),
                canonical_json(
                    {
                        "verification_passed": bool(result.passed),
                        "commands_executed": len(evidence),
                        "commands_passed": sum(
                            1 for item in evidence if item["exit_code"] == 0
                        ),
                        "evidence_hash": sha256_text(canonical_json(evidence)),
                    }
                ),
                utc_now(),
                mission["mission_id"],
            ),
        )
        if result.passed:
            recommended_id = self._materialize_recommended_mission(
                mission, execution
            )
            self.lane.transition(
                mission["mission_id"],
                "CODEX_COMPLETED",
                next_action="lease the next highest-value safe mission",
                updates={"rollback_reference": "not_applicable:non_modifying"},
            )
            self.store.set_runtime(
                "codex_last_recommended_mission", recommended_id
            )
            self.ensure_continuation()
        else:
            self.lane.transition(
                mission["mission_id"],
                "CODEX_REJECTED",
                next_action="review deterministic failure evidence",
                updates={"blocker_classification": "deterministic_verification"},
            )

    def execute_one(self) -> bool:
        self.health.clear_cooldown_if_expired()
        status = self.health.status()
        if not status.get("ready"):
            return False
        mission = self.lane.lease_next(
            f"supervisor:{os.getpid()}",
            int(self.config.get("lease_seconds", 1800)),
            maximum_pending_review_candidates=int(
                self.config.get("maximum_pending_review_candidates", 5)
            ),
        )
        if not mission:
            return False
        mission_id = mission["mission_id"]
        protected_base = self.worktrees.protected_base()
        parent = (
            self.lane.get(str(mission["parent_mission_id"]))
            if mission.get("parent_mission_id")
            else None
        )
        parent_selection_stale = bool(
            bool(mission["high_impact"])
            and parent
            and str(parent.get("codex_mode")) == "sovereign"
            and str(parent["baseline_revision"]) != protected_base
        )
        mission_baseline_stale = (
            str(mission["baseline_revision"]) != protected_base
        )
        if mission_baseline_stale or parent_selection_stale:
            self.lane.transition(
                mission_id,
                "CODEX_REJECTED",
                next_action=(
                    "superseded by protected integration base; select a fresh "
                    "evidence-bound contract"
                ),
                updates={
                    "blocker_classification": "stale_protected_baseline",
                    "process_id": None,
                    "lease_owner": None,
                    "lease_started_at": None,
                    "lease_expires_at": None,
                },
            )
            self.store.event(
                "codex_stale_baseline_rejected",
                {
                    "stored_baseline": str(mission["baseline_revision"]),
                    "protected_baseline": protected_base,
                    "selection_baseline": (
                        str(parent["baseline_revision"])
                        if parent_selection_stale and parent
                        else None
                    ),
                    "stale_source": (
                        "mission_baseline"
                        if mission_baseline_stale
                        else "selection_baseline"
                    ),
                    "worktree_created": False,
                    "adapter_invoked": False,
                    "usage_incremented": False,
                },
                mission_id,
            )
            next_id = self._schedule_continuation(mission_id)
            self.store.set_runtime(
                "codex_next_mission",
                {"mission_id": next_id, "scheduled_at": utc_now()},
            )
            return True
        receipt = self._receipt(mission)
        mission = self.lane.get(mission_id) or mission
        prompt = self._prompt(mission, receipt)
        prompt_hash = sha256_text(prompt)
        self.health.increment_usage()
        try:
            execution = self.adapter.run(
                mission_id=mission_id,
                prompt=prompt,
                working_directory=receipt.path,
                modifying=bool(mission["high_impact"]),
                session_id=(
                    str(mission["session_id"]) if mission.get("session_id") else None
                ),
                on_start=lambda run_id, pid, structure: self._on_start(
                    mission, prompt_hash, run_id, pid, structure
                ),
                should_stop=self.manual_stop,
            )
        except Exception as exc:
            synthetic = CodexExecution(
                run_id=f"CR-BOOT-{uuid.uuid4().hex}",
                ok=False,
                exit_code=None,
                process_id=None,
                session_id=mission.get("session_id"),
                started_at=utc_now(),
                finished_at=utc_now(),
                prompt_hash=prompt_hash,
                output_hash=sha256_text(type(exc).__name__),
                artifact_path="",
                error_class="worker_exit",
                timed_out=False,
                stopped=False,
                resumed=bool(mission.get("session_id")),
                command_structure=[],
                output_excerpt=type(exc).__name__,
            )
            current = self.lane.get(mission_id)
            if current and current["state"] == "CODEX_STARTING":
                self.store.execute(
                    """
                    UPDATE codex_missions SET state='CODEX_WORKING',updated_at=?
                    WHERE mission_id=?
                    """,
                    (utc_now(), mission_id),
                )
            self._active_children(None)
            self._handle_execution_failure(
                self.lane.get(mission_id) or mission, synthetic
            )
            return True
        self._record_execution(mission_id, execution)
        if not execution.ok:
            self._handle_execution_failure(
                self.lane.get(mission_id) or mission, execution
            )
            return True
        current = self.lane.get(mission_id) or mission
        self.lane.transition(
            mission_id,
            "CODEX_TESTING",
            next_action="run deterministic targeted verification",
        )
        if not bool(current["high_impact"]):
            self._complete_nonmodifying(
                self.lane.get(mission_id) or current, receipt, execution
            )
            return True
        changes = self.worktrees.changes(receipt)
        if not changes["changed_files"]:
            assessment = self.no_progress.observe(
                mission_id,
                {
                    "prompt_hash": execution.prompt_hash,
                    "plan_hash": sha256_text(
                        f"{current['objective']}|strategy:{current.get('strategy_revision', 1)}"
                    ),
                    "failure_class": "no_changed_files",
                    "changed_files": [],
                    "evidence_hash": execution.output_hash,
                    "criteria_movement": 0,
                    "score_movement": 0,
                    "strategy_revision": current.get("strategy_revision", 1),
                },
            )
            self.lane.transition(
                mission_id,
                "CODEX_REJECTED",
                next_action="run Loop Doctor and split the implementation mission",
                updates={"blocker_classification": "no_changed_files"},
            )
            self._queue_loop_doctor(
                mission_id,
                "no_changed_files" if not assessment.no_progress else "no_progress",
            )
            return True
        recursive_invocations = unauthorized_codex_invocations(receipt.path)
        if recursive_invocations:
            self.store.execute(
                """
                UPDATE codex_missions SET result_evidence_json=?,updated_at=?
                WHERE mission_id=?
                """,
                (
                    canonical_json(
                        self._combined_evidence(
                            mission_id,
                            [
                                {
                                    "gate": "authorized_codex_boundary",
                                    "violations": recursive_invocations,
                                }
                            ],
                        )
                    ),
                    utc_now(),
                    mission_id,
                ),
            )
            self.lane.transition(
                mission_id,
                "CODEX_REJECTED",
                next_action="remove unauthorized recursive Codex invocation",
                updates={
                    "blocker_classification": "unauthorized_codex_invocation"
                },
            )
            return True
        verification = self.verification.run(
            mission_id=mission_id,
            stage="codex-targeted",
            commands=self._verification_commands(True),
            working_directory=receipt.path,
            timeout_seconds=int(
                self.config.get("verification_timeout_seconds", 900)
            ),
        )
        evidence = self._verification_evidence(verification)
        self.store.execute(
            """
            UPDATE codex_missions
            SET tests_executed_json=?,result_evidence_json=?,
              progress_delta_json=?,updated_at=?
            WHERE mission_id=?
            """,
            (
                canonical_json([item["argv"] for item in evidence]),
                canonical_json(evidence),
                canonical_json(
                    {
                        "verification_passed": bool(verification.passed),
                        "commands_executed": len(evidence),
                        "commands_passed": sum(
                            1 for item in evidence if item["exit_code"] == 0
                        ),
                        "changed_files": changes["changed_files"],
                        "evidence_hash": sha256_text(canonical_json(evidence)),
                    }
                ),
                utc_now(),
                mission_id,
            ),
        )
        if not verification.passed:
            self.lane.transition(
                mission_id,
                "CODEX_REPAIRING",
                next_action="resume bounded session and repair deterministic failure",
                updates={"blocker_classification": "deterministic_verification"},
            )
            self.lane.transition(
                mission_id,
                "CODEX_QUEUED",
                next_action="resume preserved worktree for repair",
                updates={
                    "lease_owner": None,
                    "lease_started_at": None,
                    "lease_expires_at": None,
                },
            )
            return True
        candidate = self.worktrees.commit_changes(
            receipt, f"CANA Codex mission {mission_id}: bounded candidate"
        )
        candidate = candidate or self.worktrees.head(receipt.path)
        final_changes = self.worktrees.changes(receipt)
        self.lane.transition(
            mission_id,
            "CODEX_AWAITING_EXTERNAL_REVIEW",
            next_action="await Truth, Adversarial Verification, and Release Judge on exact candidate",
            updates={
                "candidate_revision": candidate,
                "changed_files_json": canonical_json(
                    final_changes["changed_files"]
                ),
                "lease_owner": None,
                "lease_started_at": None,
                "lease_expires_at": None,
                "process_id": None,
                "blocker_classification": "external_review_provider_authorization",
            },
        )
        review_id = self.review_queue.enqueue_codex_candidate_review(
            codex_mission=self.lane.get(mission_id) or mission,
            candidate_revision=candidate,
            worktree=str(receipt.path),
            lane=self.lanes[1],
        )
        self.store.event(
            "codex_candidate_submitted_for_external_review",
            {"candidate_revision": candidate, "review_mission_id": review_id},
            mission_id,
        )
        next_id = self._schedule_continuation(mission_id)
        self.store.set_runtime(
            "codex_next_mission",
            {"mission_id": next_id, "scheduled_at": utc_now()},
        )
        return True

    def refresh_review_holds(self) -> int:
        """Integrate nothing unless the exact candidate has every independent approval."""
        waiting = self.lane.list({"CODEX_AWAITING_EXTERNAL_REVIEW"})
        refreshed = 0
        for mission in waiting:
            candidate = str(mission.get("candidate_revision") or "")
            decisions = self.lane.review_decisions(
                mission["mission_id"], candidate
            )
            self.store.execute(
                """
                UPDATE codex_missions
                SET external_review_decisions_json=?,updated_at=?
                WHERE mission_id=?
                """,
                (
                    canonical_json(decisions),
                    utc_now(),
                    mission["mission_id"],
                ),
            )
            if not self.lane.valid_external_approval(
                decisions, high_impact=bool(mission["high_impact"])
            ):
                refreshed += 1
                continue
            # Integration remains a distinct supervisor action. This runner records
            # readiness; the existing gate performs the actual reversible merge.
            self.store.execute(
                """
                UPDATE codex_missions
                SET blocker_classification=NULL,
                  next_action='integrate exact independently approved candidate',
                  updated_at=?
                WHERE mission_id=?
                """,
                (utc_now(), mission["mission_id"]),
            )
            refreshed += 1
        return refreshed
