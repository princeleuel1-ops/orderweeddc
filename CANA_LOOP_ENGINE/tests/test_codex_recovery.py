from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

ENGINE_ROOT = Path(__file__).resolve().parents[1]
if str(ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ENGINE_ROOT))

from codex_adapter import CodexAdapter
from codex_health import CodexHealth
from codex_lane import CodexLane, CodexMissionSpec
from runtime_utils import utc_now
from state_store import CODEX_MISSION_STATES, StateStore


def mission(
    mission_id: str, *, high_impact: bool = True
) -> CodexMissionSpec:
    return CodexMissionSpec(
        mission_id=mission_id,
        objective=f"Bounded objective {mission_id}",
        priority_reason="recovery fixture",
        completion_contract_ids=["FIXTURE"],
        acceptance_criteria=["durable"],
        prohibited_actions=["deploy"],
        baseline_revision="fixture-base",
        priority=10,
        high_impact=high_impact,
    )


class CodexRecoveryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.store = StateStore(self.root / "state.sqlite3")
        self.lane = CodexLane(self.store)

    def tearDown(self) -> None:
        self.store.close()
        self.temp.cleanup()

    def test_schema_has_required_states_and_evidence_fields(self) -> None:
        required_states = {
            "CODEX_QUEUED",
            "CODEX_STARTING",
            "CODEX_WORKING",
            "CODEX_TESTING",
            "CODEX_AWAITING_EXTERNAL_REVIEW",
            "CODEX_REPAIRING",
            "CODEX_COOLDOWN",
            "CODEX_USAGE_LIMIT",
            "CODEX_AUTH_REQUIRED",
            "CODEX_RETRYABLE_FAILURE",
            "CODEX_TERMINAL_FAILURE",
            "CODEX_COMPLETED",
            "CODEX_REJECTED",
            "CODEX_INTEGRATED",
            "CODEX_REVERTED",
        }
        self.assertEqual(required_states, CODEX_MISSION_STATES)
        columns = {
            row["name"]
            for row in self.store.rows("PRAGMA table_info(codex_missions)")
        }
        self.assertTrue(
            {
                "mission_id",
                "objective",
                "priority_reason",
                "completion_contract_ids_json",
                "acceptance_criteria_json",
                "prohibited_actions_json",
                "assumptions_json",
                "sota_gap",
                "brittle_point",
                "success_metrics_json",
                "feedback_signals_json",
                "strategy_revision",
                "progress_delta_json",
                "baseline_revision",
                "worktree",
                "codex_mode",
                "command_structure_json",
                "session_id",
                "process_id",
                "lease_expires_at",
                "prompt_hash",
                "input_state_hash",
                "candidate_revision",
                "tests_executed_json",
                "result_evidence_json",
                "external_review_decisions_json",
                "integration_result_json",
                "rollback_reference",
                "terminal_state",
                "next_action",
            }
            <= columns
        )

    def test_zero_daily_ceiling_defers_to_actual_provider_limit(self) -> None:
        adapter = CodexAdapter(
            workspace=self.root,
            runtime_dir=self.root / "runtime",
            config={"daily_job_ceiling": 0},
            mock=True,
        )
        health = CodexHealth(self.store, adapter, {"daily_job_ceiling": 0})
        for _ in range(10):
            health.increment_usage()
        self.assertIsNone(health.daily_ceiling())
        self.assertFalse(health.ceiling_reached())

    def test_duplicate_objective_and_duplicate_worker_are_prevented(self) -> None:
        self.assertTrue(self.lane.enqueue(mission("CX-A")))
        duplicate = CodexMissionSpec(
            **{
                **mission("CX-B").__dict__,
                "objective": mission("CX-A").objective,
            }
        )
        self.assertFalse(self.lane.enqueue(duplicate))
        self.assertIsNotNone(self.lane.lease_next("worker-a"))
        self.assertIsNone(self.lane.lease_next("worker-b"))

    def test_crashed_process_and_lease_recover_to_queue(self) -> None:
        self.lane.enqueue(mission("CX-CRASH"))
        leased = self.lane.lease_next("dead-supervisor")
        self.store.execute(
            """
            UPDATE codex_missions
            SET state='CODEX_WORKING',process_id=99999999
            WHERE mission_id=?
            """,
            (leased["mission_id"],),
        )
        self.store.execute(
            """
            INSERT INTO codex_runs(
              run_id,mission_id,state,process_id,prompt_hash,started_at
            ) VALUES('run-crash',?,'running',99999999,'hash',?)
            """,
            (leased["mission_id"], utc_now()),
        )
        self.assertEqual(1, self.store.recover_orphaned_codex_runs())
        self.assertEqual(1, self.lane.recover())
        self.assertEqual("CODEX_QUEUED", self.lane.get("CX-CRASH")["state"])
        self.assertEqual(
            "interrupted",
            self.store.row(
                "SELECT state FROM codex_runs WHERE run_id='run-crash'"
            )["state"],
        )

    def test_usage_limit_records_cooldown_without_blocking_other_state(self) -> None:
        adapter = CodexAdapter(
            workspace=self.root,
            runtime_dir=self.root / "runtime",
            config={"daily_job_ceiling": 1},
            mock=True,
            mock_profile={"error_class": "usage_limit"},
        )
        health = CodexHealth(
            self.store,
            adapter,
            {"daily_job_ceiling": 1, "usage_cooldown_seconds": 60},
        )
        health.increment_usage()
        until_at = health.record_cooldown("usage_limit", 60)
        self.assertTrue(health.ceiling_reached())
        self.assertIsNotNone(health.active_cooldown())
        self.assertTrue(until_at)
        self.assertEqual([], self.store.rows("SELECT * FROM missions"))

    def test_successful_false_usage_limit_is_audited_and_requeued(self) -> None:
        self.lane.enqueue(mission("CX-FALSE-LIMIT"))
        leased = self.lane.lease_next("worker")
        self.store.execute(
            """
            UPDATE codex_missions
            SET state='CODEX_USAGE_LIMIT',session_id='preserved-session',
              worktree='preserved-worktree',blocker_classification='codex_usage_limit'
            WHERE mission_id=?
            """,
            (leased["mission_id"],),
        )
        self.store.execute(
            """
            INSERT INTO codex_runs(
              run_id,mission_id,state,process_id,prompt_hash,output_hash,
              error_class,exit_code,started_at,finished_at
            ) VALUES(
              'run-false-limit',?,'failed',123,'prompt','output',
              'usage_limit',0,?,?
            )
            """,
            (leased["mission_id"], utc_now(), utc_now()),
        )

        run_id = self.lane.repair_false_usage_limit(leased["mission_id"])

        repaired = self.lane.get(leased["mission_id"])
        self.assertEqual("run-false-limit", run_id)
        self.assertEqual("CODEX_QUEUED", repaired["state"])
        self.assertEqual("preserved-session", repaired["session_id"])
        self.assertEqual("preserved-worktree", repaired["worktree"])
        run = self.store.row(
            "SELECT state,error_class FROM codex_runs WHERE run_id=?",
            (run_id,),
        )
        self.assertEqual("completed", run["state"])
        self.assertIsNone(run["error_class"])
        event = self.store.row(
            """
            SELECT event_type FROM events
            WHERE mission_id=? ORDER BY event_id DESC LIMIT 1
            """,
            (leased["mission_id"],),
        )
        self.assertEqual("codex_false_usage_limit_repaired", event["event_type"])

    def test_verification_environment_failure_preserves_session_on_requeue(self) -> None:
        self.lane.enqueue(mission("CX-VERIFY-ENV"))
        leased = self.lane.lease_next("worker")
        self.store.execute(
            """
            UPDATE codex_missions
            SET state='CODEX_TERMINAL_FAILURE',
              terminal_state='CODEX_TERMINAL_FAILURE',
              session_id='preserved-session',worktree='preserved-worktree',
              attempt_count=3,completed_at=?
            WHERE mission_id=?
            """,
            (utc_now(), leased["mission_id"]),
        )
        self.store.event(
            "verification_failed",
            {
                "passed": False,
                "failure": "command 1 exited None",
                "commands": [
                    {
                        "argv": ["npm", "test"],
                        "exit_code": None,
                        "artifact_path": "missing-executable.txt",
                    }
                ],
            },
            leased["mission_id"],
        )

        self.lane.repair_verification_environment(leased["mission_id"])

        repaired = self.lane.get(leased["mission_id"])
        self.assertEqual("CODEX_QUEUED", repaired["state"])
        self.assertEqual(0, repaired["attempt_count"])
        self.assertEqual("preserved-session", repaired["session_id"])
        self.assertEqual("preserved-worktree", repaired["worktree"])

    def test_passed_readonly_gate_recovers_without_another_codex_job(self) -> None:
        self.lane.enqueue(mission("CX-READONLY-RECOVERY", high_impact=False))
        leased = self.lane.lease_next("dead-supervisor")
        self.store.execute(
            """
            UPDATE codex_missions
            SET state='CODEX_QUEUED',process_id=NULL,lease_owner=NULL,
              lease_started_at=NULL,lease_expires_at=NULL
            WHERE mission_id=?
            """,
            (leased["mission_id"],),
        )
        started_at = utc_now()
        self.store.execute(
            """
            INSERT INTO codex_runs(
              run_id,mission_id,state,process_id,prompt_hash,output_hash,
              exit_code,started_at,finished_at
            ) VALUES(
              'run-readonly-recovery',?,'completed',123,'prompt','output',
              0,?,?
            )
            """,
            (leased["mission_id"], started_at, utc_now()),
        )
        self.store.event(
            "verification_passed",
            {
                "passed": True,
                "stage": "codex-readonly",
                "failure": None,
                "commands": [
                    {
                        "argv": ["git", "diff", "--check"],
                        "exit_code": 0,
                        "output_hash": "empty-diff",
                        "artifact_path": "receipt.txt",
                    }
                ],
            },
            leased["mission_id"],
        )

        self.assertEqual(1, self.lane.recover_verified_nonmodifying())

        recovered = self.lane.get(leased["mission_id"])
        self.assertEqual("CODEX_COMPLETED", recovered["state"])
        self.assertEqual(
            [["git", "diff", "--check"]],
            json.loads(recovered["tests_executed_json"]),
        )
        self.assertEqual(
            "not_applicable:non_modifying",
            recovered["rollback_reference"],
        )

    def test_high_impact_review_requires_all_roles_and_two_non_codex_families(self) -> None:
        decisions = [
            {
                "reviewer_lane": "truth",
                "decision": "APPROVE",
                "model_family": "family-a",
            },
            {
                "reviewer_lane": "adversarial_verification",
                "decision": "APPROVE",
                "model_family": "family-a",
            },
            {
                "reviewer_lane": "release_judge",
                "decision": "APPROVE",
                "model_family": "family-a",
            },
        ]
        self.assertFalse(
            self.lane.valid_external_approval(decisions, high_impact=True)
        )
        decisions[-1]["model_family"] = "family-b"
        self.assertTrue(
            self.lane.valid_external_approval(decisions, high_impact=True)
        )

    def test_modifying_candidate_hold_allows_readonly_continuation_only(self) -> None:
        self.lane.enqueue(mission("CX-MOD"))
        self.lane.enqueue(mission("CX-READ", high_impact=False))
        first = self.lane.lease_next("worker")
        self.assertEqual("CX-MOD", first["mission_id"])
        self.store.execute(
            """
            UPDATE codex_missions SET state='CODEX_AWAITING_EXTERNAL_REVIEW',
              candidate_revision='candidate',process_id=NULL
            WHERE mission_id='CX-MOD'
            """
        )
        second = self.lane.lease_next("worker")
        self.assertEqual("CX-READ", second["mission_id"])

    def test_bounded_review_backlog_does_not_block_isolated_builder(self) -> None:
        self.lane.enqueue(mission("CX-MOD-ONE"))
        first = self.lane.lease_next("worker")
        self.assertEqual("CX-MOD-ONE", first["mission_id"])
        self.store.execute(
            """
            UPDATE codex_missions SET state='CODEX_AWAITING_EXTERNAL_REVIEW',
              candidate_revision='candidate-one',process_id=NULL
            WHERE mission_id='CX-MOD-ONE'
            """
        )
        self.lane.enqueue(mission("CX-MOD-TWO"))
        second = self.lane.lease_next(
            "worker", maximum_pending_review_candidates=2
        )
        self.assertEqual("CX-MOD-TWO", second["mission_id"])

    def test_audited_compatibility_repair_requeues_terminal_mission(self) -> None:
        self.lane.enqueue(mission("CX-COMPAT"))
        self.lane.lease_next("worker")
        self.store.execute(
            """
            UPDATE codex_missions
            SET state='CODEX_TERMINAL_FAILURE',
              terminal_state='CODEX_TERMINAL_FAILURE',
              blocker_classification='retry_ceiling',
              attempt_count=3,completed_at=?
            WHERE mission_id='CX-COMPAT'
            """,
            (utc_now(),),
        )
        self.lane.enqueue(
            CodexMissionSpec(
                **{
                    **mission("CX-DOCTOR", high_impact=False).__dict__,
                    "parent_mission_id": "CX-COMPAT",
                    "codex_mode": "loop-doctor",
                }
            )
        )
        superseded = self.lane.repair_cli_compatibility("CX-COMPAT")
        repaired = self.lane.get("CX-COMPAT")
        self.assertEqual("CODEX_QUEUED", repaired["state"])
        self.assertEqual(0, repaired["attempt_count"])
        self.assertIsNone(repaired["terminal_state"])
        self.assertEqual(["CX-DOCTOR"], superseded)
        self.assertEqual(
            "CODEX_REJECTED", self.lane.get("CX-DOCTOR")["state"]
        )


if __name__ == "__main__":
    unittest.main()
