from __future__ import annotations

import datetime as dt
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ENGINE_ROOT = Path(__file__).resolve().parents[1]
if str(ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ENGINE_ROOT))

from mission_queue import MissionQueue
from codex_lane import CodexLane, CodexMissionSpec
from reporter import Reporter
from state_store import StateStore
from supervisor import Supervisor
from watchdog import Watchdog

from support import temporary_git_repository


class SupervisorAcceptanceTests(unittest.TestCase):
    def _supervisor(
        self,
        repo: Path,
        runtime: Path,
        profile: dict[str, object] | None = None,
    ) -> Supervisor:
        return Supervisor(
            workspace=repo,
            runtime_dir=runtime,
            config_path=ENGINE_ROOT / "config" / "runtime.json",
            lanes_path=ENGINE_ROOT / "config" / "lanes.json",
            server_url="http://127.0.0.1:1",
            max_parallel_lanes=5,
            mode="mock",
            mock_profile=profile,
        )

    def test_mocked_five_lane_end_to_end_mission_completes(self) -> None:
        with temporary_git_repository() as repo, tempfile.TemporaryDirectory() as raw:
            supervisor = self._supervisor(repo, Path(raw))
            try:
                self.assertEqual(0, supervisor.run(once=True))
                mission = supervisor.queue.get("M-MOCK-FIVE-LANE-001")
                self.assertEqual("completed", mission["state"])
                lane_runs = supervisor.store.rows(
                    "SELECT lane_id,state,secret_reference FROM lane_runs ORDER BY lane_id"
                )
                self.assertEqual([1, 2, 3, 4, 5], [row["lane_id"] for row in lane_runs])
                self.assertTrue(all(row["state"] == "completed" for row in lane_runs))
                self.assertEqual(5, len({row["secret_reference"] for row in lane_runs}))
                self.assertEqual("ACCEPT", mission["release_judge_decision"])
                self.assertEqual("not_applicable:non_modifying", mission["rollback_reference"])
            finally:
                supervisor.close()

    def test_critic_rejection_creates_repair(self) -> None:
        profile = {"lane_outputs": {"2": '{"CANA_CRITIC":"REJECT"}'}}
        with temporary_git_repository() as repo, tempfile.TemporaryDirectory() as raw:
            supervisor = self._supervisor(repo, Path(raw), profile)
            try:
                self.assertEqual(0, supervisor.run(once=True))
                mission = supervisor.queue.get("M-MOCK-FIVE-LANE-001")
                self.assertEqual("rejected", mission["state"])
                repairs = supervisor.store.rows(
                    "SELECT * FROM missions WHERE parent_mission_id='M-MOCK-FIVE-LANE-001'"
                )
                self.assertEqual(1, len(repairs))
                self.assertEqual("queued", repairs[0]["state"])
            finally:
                supervisor.close()

    def test_release_judge_rejection_blocks_completion(self) -> None:
        profile = {"lane_outputs": {"5": '{"CANA_RELEASE":"REJECT"}'}}
        with temporary_git_repository() as repo, tempfile.TemporaryDirectory() as raw:
            supervisor = self._supervisor(repo, Path(raw), profile)
            try:
                self.assertEqual(0, supervisor.run(once=True))
                mission = supervisor.queue.get("M-MOCK-FIVE-LANE-001")
                self.assertEqual("rejected", mission["state"])
                self.assertEqual("REJECT", mission["release_judge_decision"])
                self.assertIsNone(mission["integration_reference"])
            finally:
                supervisor.close()

    def test_lane_five_crash_is_checkpointed_and_requeued(self) -> None:
        with temporary_git_repository() as repo, tempfile.TemporaryDirectory() as raw:
            supervisor = self._supervisor(repo, Path(raw), {"crash_lane": 5})
            try:
                self.assertEqual(0, supervisor.run(once=True))
                mission = supervisor.queue.get("M-MOCK-FIVE-LANE-001")
                self.assertEqual("queued", mission["state"])
                lane_five = supervisor.store.row(
                    "SELECT state,error_class FROM lane_runs WHERE lane_id=5"
                )
                self.assertEqual("crashed", lane_five["state"])
                self.assertEqual("worker_exit", lane_five["error_class"])
                event = supervisor.store.row(
                    "SELECT event_type FROM events WHERE event_type='lane_crash_recovered'"
                )
                self.assertIsNotNone(event)
            finally:
                supervisor.close()

    def test_supervisor_and_worker_crash_state_recovers_after_reopen(self) -> None:
        with temporary_git_repository() as repo, tempfile.TemporaryDirectory() as raw:
            runtime = Path(raw)
            first = self._supervisor(repo, runtime)
            first.objectives.ensure_seeded(mock=True)
            mission = first.queue.lease_next("dead-supervisor")
            first.queue.transition(mission["mission_id"], "planning", next_action="simulate crash")
            first.store.execute(
                """
                INSERT INTO lane_runs(
                  lane_run_id,mission_id,cycle_id,lane_id,lane_name,model,
                  secret_reference,state,attempt,started_at
                ) VALUES('orphan-lane',?,'cycle',5,'release','model',
                         'CANA_LANE_5_API_KEY','running',1,'2026-01-01T00:00:00+00:00')
                """,
                (mission["mission_id"],),
            )
            first.close()
            second = self._supervisor(repo, runtime)
            try:
                recovered = second.recover()
                self.assertEqual(1, recovered["lane_runs"])
                self.assertEqual(1, recovered["orphaned_missions"])
                self.assertEqual("queued", second.queue.get(mission["mission_id"])["state"])
                self.assertEqual(
                    "interrupted",
                    second.store.row("SELECT state FROM lane_runs WHERE lane_run_id='orphan-lane'")["state"],
                )
            finally:
                second.close()

    def test_status_reports_lanes_models_missions_cooldowns_and_next_actions(self) -> None:
        with temporary_git_repository() as repo, tempfile.TemporaryDirectory() as raw:
            supervisor = self._supervisor(repo, Path(raw))
            try:
                supervisor.objectives.ensure_seeded(mock=True)
                supervisor.store.set_runtime(
                    "provider_status",
                    {
                        "accepted_count": 0,
                        "required_count": 5,
                        "accepted_references": [],
                        "ready_for_external_cycle": False,
                    },
                )
                status = supervisor.reporter.write()
                self.assertEqual(5, len(status["configured_lanes"]))
                self.assertTrue(status["missions"])
                self.assertIn("cooldowns", status)
                self.assertTrue(status["next_actions"])
                self.assertIn("heartbeat", status)
                self.assertTrue((repo / "CANA_CONTROL_TOWER" / "EXTERNAL_LOOP_STATUS.json").is_file())
            finally:
                supervisor.close()

    def test_status_usage_snapshot_reads_live_daily_counter(self) -> None:
        with temporary_git_repository() as repo, tempfile.TemporaryDirectory() as raw:
            supervisor = self._supervisor(repo, Path(raw))
            try:
                supervisor.store.execute(
                    """
                    INSERT INTO codex_usage_daily(usage_day,job_count,updated_at)
                    VALUES(?,?,?)
                    """,
                    (
                        dt.datetime.now(dt.timezone.utc).date().isoformat(),
                        7,
                        "2026-01-01T00:00:00+00:00",
                    ),
                )
                status = supervisor.reporter.snapshot()
                self.assertEqual(7, status["codex"]["capabilities"]["usage_today"])
            finally:
                supervisor.close()

    def test_watchdog_restart_simulation_respects_manual_stop(self) -> None:
        with temporary_git_repository() as repo, tempfile.TemporaryDirectory() as raw:
            runtime = Path(raw)
            store = StateStore(runtime / "state.sqlite3")
            store.set_runtime("supervisor_pid", 99999999)
            store.set_runtime(
                "ending_condition",
                {"kind": "hours", "ends_at": "2099-01-01T00:00:00+00:00"},
            )
            store.set_runtime("completed", False)
            store.close()
            watchdog = Watchdog(repo, runtime)
            try:
                result = watchdog.run(simulate=True)
                self.assertTrue(result["restart"])
                self.assertEqual("supervisor_missing_or_stale", result["reason"])
                (runtime / "control").mkdir(parents=True)
                (runtime / "control" / "MANUAL_STOP").write_text("stop", encoding="utf-8")
                stopped = watchdog.run(simulate=True)
                self.assertFalse(stopped["restart"])
                self.assertEqual("manual_stop", stopped["reason"])
            finally:
                watchdog.close()

    def test_watchdog_rejects_reused_unrelated_pid_even_with_fresh_heartbeat(self) -> None:
        with temporary_git_repository() as repo, tempfile.TemporaryDirectory() as raw:
            runtime = Path(raw)
            store = StateStore(runtime / "state.sqlite3")
            store.set_runtime("supervisor_pid", os.getpid())
            store.set_runtime(
                "ending_condition",
                {"kind": "hours", "ends_at": "2099-01-01T00:00:00+00:00"},
            )
            store.set_runtime("completed", False)
            store.heartbeat(os.getpid(), "running", None, "fresh-but-unrelated")
            store.close()
            watchdog = Watchdog(repo, runtime)
            try:
                result = watchdog.run(simulate=True)
                self.assertTrue(result["restart"])
                self.assertEqual("supervisor_missing_or_stale", result["reason"])
            finally:
                watchdog.close()

    def test_watchdog_expires_only_a_verified_orphan_codex_lease(self) -> None:
        with temporary_git_repository() as repo, tempfile.TemporaryDirectory() as raw:
            runtime = Path(raw)
            store = StateStore(runtime / "state.sqlite3")
            lane = CodexLane(store)
            lane.enqueue(
                CodexMissionSpec(
                    mission_id="CODEX-WATCHDOG-001",
                    objective="prove bounded orphan recovery",
                    priority_reason="crash recovery acceptance",
                    baseline_revision="baseline",
                    priority=100,
                    acceptance_criteria=["expired orphan is recoverable"],
                    prohibited_actions=["touch unrelated processes"],
                )
            )
            leased = lane.lease_next("dead-supervisor", lease_seconds=-1)
            self.assertIsNotNone(leased)
            lane.transition(
                "CODEX-WATCHDOG-001",
                "CODEX_WORKING",
                next_action="finish bounded job",
                updates={"process_id": 424242},
            )
            store.set_runtime("supervisor_pid", 99999999)
            store.set_runtime(
                "active_child_processes",
                [{"kind": "codex", "pid": 424242}],
            )
            store.set_runtime(
                "ending_condition",
                {"kind": "hours", "ends_at": "2099-01-01T00:00:00+00:00"},
            )
            store.set_runtime("completed", False)
            store.close()
            watchdog = Watchdog(repo, runtime)
            try:
                with mock.patch(
                    "watchdog.process_matches",
                    side_effect=lambda pid, tokens: int(pid or 0) == 424242,
                ):
                    result = watchdog.run(simulate=True)
                self.assertTrue(result["restart"])
                self.assertEqual("codex_child_lease_expired", result["reason"])
            finally:
                watchdog.close()

    def test_watchdog_installer_runs_on_battery_power(self) -> None:
        installer = (ENGINE_ROOT / "Install-CanaLoopWatchdog.ps1").read_text(
            encoding="utf-8"
        )
        self.assertIn("-AllowStartIfOnBatteries", installer)
        self.assertIn("-DontStopIfGoingOnBatteries", installer)

    def test_codex_usage_limit_does_not_stop_five_lane_or_deterministic_work(self) -> None:
        with temporary_git_repository() as repo, tempfile.TemporaryDirectory() as raw:
            supervisor = Supervisor(
                workspace=repo,
                runtime_dir=Path(raw),
                config_path=ENGINE_ROOT / "config" / "runtime.json",
                lanes_path=ENGINE_ROOT / "config" / "lanes.json",
                server_url="http://127.0.0.1:1",
                max_parallel_lanes=5,
                mode="mock",
                mock_profile={"codex": {"error_class": "usage_limit"}},
                enable_codex=True,
                max_parallel_codex=1,
            )
            try:
                self.assertEqual(0, supervisor.run(once=True))
                codex = supervisor.codex_lane.get("CODEX-RELEASE-MERCHANT-001")
                self.assertEqual("CODEX_USAGE_LIMIT", codex["state"])
                main = supervisor.queue.get("M-MOCK-FIVE-LANE-001")
                self.assertEqual("completed", main["state"])
                self.assertEqual(
                    5,
                    len(
                        supervisor.store.rows(
                            """
                            SELECT lane_run_id FROM lane_runs
                            WHERE mission_id='M-MOCK-FIVE-LANE-001'
                            """
                        )
                    ),
                )
            finally:
                supervisor.close()

    def test_stale_high_impact_baseline_is_rejected_before_codex_or_worktree(self) -> None:
        with temporary_git_repository() as repo, tempfile.TemporaryDirectory() as raw:
            supervisor = Supervisor(
                workspace=repo,
                runtime_dir=Path(raw),
                config_path=ENGINE_ROOT / "config" / "runtime.json",
                lanes_path=ENGINE_ROOT / "config" / "lanes.json",
                server_url="http://127.0.0.1:1",
                max_parallel_lanes=5,
                mode="mock",
                mock_profile={"codex": {"output": "must not run"}},
                enable_codex=True,
                max_parallel_codex=1,
            )
            try:
                protected = supervisor.worktrees.head()
                supervisor.store.set_runtime(
                    "protected_integration_base", protected
                )
                supervisor.codex_lane.enqueue(
                    CodexMissionSpec(
                        mission_id="CODEX-STALE-001",
                        objective="change one stale fixture",
                        priority_reason="prove stale work is refused",
                        baseline_revision="stale-baseline",
                        priority=9999,
                        acceptance_criteria=["no adapter invocation"],
                        prohibited_actions=["create a worktree"],
                    )
                )
                before = supervisor.codex_health.usage_count()
                self.assertTrue(supervisor.execute_codex_one())
                stale = supervisor.codex_lane.get("CODEX-STALE-001")
                self.assertEqual("CODEX_REJECTED", stale["state"])
                self.assertEqual(
                    "stale_protected_baseline",
                    stale["blocker_classification"],
                )
                self.assertIsNone(stale["worktree"])
                self.assertEqual(before, supervisor.codex_health.usage_count())
                event = supervisor.store.row(
                    """
                    SELECT details_json FROM events
                    WHERE event_type='codex_stale_baseline_rejected'
                    ORDER BY event_id DESC LIMIT 1
                    """
                )
                details = json.loads(event["details_json"])
                self.assertFalse(details["worktree_created"])
                self.assertFalse(details["adapter_invoked"])
                self.assertFalse(details["usage_incremented"])
            finally:
                supervisor.close()

    def test_builder_from_stale_selection_is_rejected_at_current_base(self) -> None:
        with temporary_git_repository() as repo, tempfile.TemporaryDirectory() as raw:
            supervisor = Supervisor(
                workspace=repo,
                runtime_dir=Path(raw),
                config_path=ENGINE_ROOT / "config" / "runtime.json",
                lanes_path=ENGINE_ROOT / "config" / "lanes.json",
                server_url="http://127.0.0.1:1",
                max_parallel_lanes=5,
                mode="mock",
                mock_profile={"codex": {"output": "must not run"}},
                enable_codex=True,
                max_parallel_codex=1,
            )
            try:
                protected = supervisor.worktrees.head()
                supervisor.store.set_runtime(
                    "protected_integration_base", protected
                )
                supervisor.codex_lane.enqueue(
                    CodexMissionSpec(
                        mission_id="CODEX-STALE-SELECTION",
                        objective="select from stale evidence",
                        priority_reason="compare-and-swap fixture",
                        baseline_revision="stale-selection-base",
                        priority=500,
                        acceptance_criteria=["selection is never reused"],
                        prohibited_actions=["modify"],
                        codex_mode="sovereign",
                        high_impact=False,
                    )
                )
                supervisor.store.execute(
                    """
                    UPDATE codex_missions
                    SET state='CODEX_COMPLETED',terminal_state='CODEX_COMPLETED',
                      completed_at=updated_at
                    WHERE mission_id='CODEX-STALE-SELECTION'
                    """
                )
                supervisor.codex_lane.enqueue(
                    CodexMissionSpec(
                        mission_id="CODEX-FRESH-BUILDER",
                        parent_mission_id="CODEX-STALE-SELECTION",
                        objective="build from stale selection evidence",
                        priority_reason="compare-and-swap fixture",
                        baseline_revision=protected,
                        priority=9999,
                        acceptance_criteria=["no adapter invocation"],
                        prohibited_actions=["create a worktree"],
                        codex_mode="sovereign-builder",
                    )
                )
                before = supervisor.codex_health.usage_count()
                self.assertTrue(supervisor.execute_codex_one())
                builder = supervisor.codex_lane.get("CODEX-FRESH-BUILDER")
                self.assertEqual("CODEX_REJECTED", builder["state"])
                self.assertIsNone(builder["worktree"])
                self.assertEqual(before, supervisor.codex_health.usage_count())
                event = supervisor.store.row(
                    """
                    SELECT details_json FROM events
                    WHERE event_type='codex_stale_baseline_rejected'
                    ORDER BY event_id DESC LIMIT 1
                    """
                )
                details = json.loads(event["details_json"])
                self.assertEqual("selection_baseline", details["stale_source"])
                self.assertFalse(details["adapter_invoked"])
            finally:
                supervisor.close()

    def test_codex_readonly_continuation_persists_evidence_and_completes(self) -> None:
        with temporary_git_repository() as repo, tempfile.TemporaryDirectory() as raw:
            contract = {
                "mission_id": "M-TEST-BUILD-001",
                "horizon": "A",
                "objective": "Harden one bounded fixture path.",
                "sota_gap": "The fixture lacks one enforced invariant.",
                "assumptions": ["The fixture represents the affected path."],
                "brittle_point": "The assertion may cover only the happy path.",
                "evidence": ["fixture evidence"],
                "success_measure": ["one negative-path assertion passes"],
                "acceptance_tests": ["git diff --check passes"],
                "allowed_files": ["README.md"],
                "prohibited_actions": ["deploy"],
                "risk_tier": "TEST",
                "risk": "A partial assertion could create false confidence.",
                "dependencies": ["fixture repository"],
                "experiment": "Run the negative-path assertion.",
                "rollback": "Revert the local candidate commit.",
                "maximum_attempts": 2,
                "benchmark_evidence": [
                    {
                        "name": "fixture baseline",
                        "capability": "negative-path enforcement",
                        "evidence": "the current fixture has no negative-path assertion",
                        "observed_at": "2026-07-17",
                    }
                ],
                "measurement_contract": [
                    {
                        "metric": "negative-path assertions",
                        "kind": "outcome",
                        "baseline": 0,
                        "target": 1,
                        "unit": "assertions",
                        "direction": "increase",
                        "evidence": "fixture baseline",
                        "verification": "targeted fixture test",
                    },
                    {
                        "metric": "existing fixture regressions",
                        "kind": "guardrail",
                        "baseline": 0,
                        "target": 0,
                        "unit": "failures",
                        "direction": "decrease",
                        "evidence": "existing test receipt",
                        "verification": "existing fixture tests",
                    },
                ],
                "falsification_test": "Reject if the negative-path assertion fails.",
                "promotion_rule": "Promote only with one new assertion and zero regressions.",
                "next_frontier": "Measure the next untested fixture boundary.",
            }
            output = "\n".join(
                [
                    json.dumps(
                        {
                            "type": "thread.started",
                            "thread_id": "00000000-0000-4000-8000-000000000001",
                        }
                    ),
                    json.dumps(
                        {
                            "type": "item.completed",
                            "item": {
                                "type": "agent_message",
                                "text": (
                                    "CANA_JSON_START\n```json\n"
                                    + json.dumps(contract)
                                    + "\n```\nCANA_JSON_END"
                                ),
                            },
                        }
                    ),
                ]
            )
            supervisor = Supervisor(
                workspace=repo,
                runtime_dir=Path(raw),
                config_path=ENGINE_ROOT / "config" / "runtime.json",
                lanes_path=ENGINE_ROOT / "config" / "lanes.json",
                server_url="http://127.0.0.1:1",
                max_parallel_lanes=5,
                mode="mock",
                mock_profile={"codex": {"output": output}},
                enable_codex=True,
                max_parallel_codex=1,
            )
            try:
                supervisor.codex_lane.enqueue(
                    CodexMissionSpec(
                        mission_id="CODEX-READONLY-001",
                        objective="Rank one evidence-backed next mission.",
                        priority_reason="continuation fixture",
                        baseline_revision=supervisor.worktrees.head(),
                        priority=100,
                        acceptance_criteria=["rank one mission"],
                        prohibited_actions=["modify repository"],
                        codex_mode="sovereign",
                        high_impact=False,
                    )
                )

                self.assertTrue(supervisor.execute_codex_one())

                completed = supervisor.codex_lane.get("CODEX-READONLY-001")
                self.assertEqual("CODEX_COMPLETED", completed["state"])
                self.assertEqual(
                    [["git", "diff", "--check"]],
                    json.loads(completed["tests_executed_json"]),
                )
                self.assertTrue(json.loads(completed["result_evidence_json"]))
                recommended = supervisor.codex_lane.get("M-TEST-BUILD-001")
                self.assertIsNotNone(recommended)
                self.assertEqual("CODEX_QUEUED", recommended["state"])
                self.assertEqual(
                    "The assertion may cover only the happy path.",
                    recommended["brittle_point"],
                )
                measurements = json.loads(recommended["measurement_contract_json"])
                self.assertEqual(["outcome", "guardrail"], [item["kind"] for item in measurements])
                self.assertEqual(1, recommended["frontier_epoch"])
                continuations = supervisor.codex_lane.list({"CODEX_QUEUED"})
                self.assertTrue(
                    any(
                        row["parent_mission_id"] == completed["mission_id"]
                        for row in continuations
                    )
                )
            finally:
                supervisor.close()

    def test_codex_candidate_is_committed_reviewed_and_held_from_self_integration(self) -> None:
        with temporary_git_repository() as repo, tempfile.TemporaryDirectory() as raw:
            runtime = Path(raw)
            config = json.loads(
                (ENGINE_ROOT / "config" / "runtime.json").read_text(
                    encoding="utf-8"
                )
            )
            config["codex"]["targeted_verification_commands"] = [
                ["git", "diff", "--check"]
            ]
            config["codex"]["readonly_verification_commands"] = [
                ["git", "diff", "--check"]
            ]
            config_path = runtime / "runtime.json"
            config_path.write_text(json.dumps(config), encoding="utf-8")
            supervisor = Supervisor(
                workspace=repo,
                runtime_dir=runtime,
                config_path=config_path,
                lanes_path=ENGINE_ROOT / "config" / "lanes.json",
                server_url="http://127.0.0.1:1",
                max_parallel_lanes=5,
                mode="mock",
                mock_profile={
                    "codex": {
                        "write_fixture": {
                            "path": "codex-candidate.txt",
                            "content": "bounded candidate\n",
                        }
                    }
                },
                enable_codex=True,
                max_parallel_codex=1,
            )
            try:
                self.assertEqual(0, supervisor.run(once=True))
                candidate = supervisor.codex_lane.get(
                    "CODEX-RELEASE-MERCHANT-001"
                )
                self.assertEqual(
                    "CODEX_AWAITING_EXTERNAL_REVIEW", candidate["state"]
                )
                self.assertTrue(candidate["candidate_revision"])
                self.assertIn(
                    "codex-candidate.txt",
                    json.loads(candidate["changed_files_json"]),
                )
                reviews = supervisor.codex_lane.review_decisions(
                    candidate["mission_id"], candidate["candidate_revision"]
                )
                self.assertEqual(
                    {
                        "truth",
                        "adversarial_verification",
                        "release_judge",
                    },
                    {row["reviewer_lane"] for row in reviews},
                )
                self.assertFalse(
                    supervisor.codex_lane.valid_external_approval(
                        reviews, high_impact=True
                    )
                )
                self.assertFalse((repo / "codex-candidate.txt").exists())
                next_missions = supervisor.codex_lane.list({"CODEX_QUEUED"})
                self.assertTrue(
                    any(
                        row["parent_mission_id"] == candidate["mission_id"]
                        for row in next_missions
                    )
                )
            finally:
                supervisor.close()
