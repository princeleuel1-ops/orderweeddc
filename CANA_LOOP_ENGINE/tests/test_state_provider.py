from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

ENGINE_ROOT = Path(__file__).resolve().parents[1]
if str(ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ENGINE_ROOT))

from mission_queue import MissionQueue, MissionSpec
from opencode_adapter import OpenCodeAdapter
from openrouter_health import OpenRouterHealth
from runtime_utils import canonical_json, utc_now
from security import accepted_secret_reference, sanitize
from state_store import MISSION_STATES, StateStore

from support import temporary_git_repository


def spec(mission_id: str = "M-STATE-001", *, modifying: bool = False) -> MissionSpec:
    return MissionSpec(
        mission_id=mission_id,
        objective="Prove durable state",
        rationale="Acceptance fixture",
        lane="five_lane_cycle",
        primary_model="lane/primary",
        fallback_models=["lane/fallback"],
        secret_reference="CANA_LANE_1_API_KEY",
        priority=10,
        acceptance_criteria=["durable"],
        prohibited_changes=["none"],
        modifying=modifying,
    )


class StateStoreTests(unittest.TestCase):
    def test_mission_schema_supports_every_required_state_and_field(self) -> None:
        required_fields = {
            "mission_id",
            "parent_mission_id",
            "objective",
            "rationale",
            "lane",
            "primary_model",
            "fallback_models_json",
            "secret_reference",
            "priority",
            "dependencies_json",
            "acceptance_criteria_json",
            "prohibited_changes_json",
            "assumptions_json",
            "sota_gap",
            "brittle_point",
            "success_metrics_json",
            "feedback_signals_json",
            "strategy_revision",
            "progress_delta_json",
            "worktree",
            "lease_owner",
            "lease_started_at",
            "lease_expires_at",
            "attempt_number",
            "maximum_attempts",
            "opencode_session_id",
            "prompt_hash",
            "input_state_hash",
            "changed_files_json",
            "diff_hash",
            "commands_executed_json",
            "test_evidence_json",
            "critic_findings_json",
            "repair_history_json",
            "release_judge_decision",
            "integration_reference",
            "rollback_reference",
            "blocker_classification",
            "next_action",
            "created_at",
            "updated_at",
        }
        with tempfile.TemporaryDirectory() as raw:
            store = StateStore(Path(raw) / "state.sqlite3")
            columns = {row["name"] for row in store.rows("PRAGMA table_info(missions)")}
            store.close()
        self.assertTrue(required_fields <= columns)
        self.assertEqual(
            {
                "queued",
                "leased",
                "planning",
                "researching",
                "implementing",
                "awaiting_criticism",
                "rejected",
                "repairing",
                "awaiting_verification",
                "awaiting_release_judgment",
                "accepted",
                "integrating",
                "integrated",
                "post_integration_verification",
                "retry_wait",
                "blocked_external",
                "blocked_human",
                "failed_retryable",
                "failed_terminal",
                "superseded",
                "completed",
            },
            MISSION_STATES,
        )

    def test_mission_learning_contract_is_durable_and_nonempty(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            store = StateStore(Path(raw) / "state.sqlite3")
            queue = MissionQueue(store)
            self.assertTrue(queue.enqueue(spec()))
            mission = queue.get("M-STATE-001")
            self.assertTrue(json.loads(mission["assumptions_json"]))
            self.assertTrue(mission["sota_gap"])
            self.assertTrue(mission["brittle_point"])
            self.assertTrue(json.loads(mission["success_metrics_json"]))
            self.assertTrue(json.loads(mission["feedback_signals_json"]))
            self.assertEqual(1, mission["strategy_revision"])
            store.close()

    def test_state_survives_process_reopen(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "state.sqlite3"
            first = StateStore(path)
            queue = MissionQueue(first)
            self.assertTrue(queue.enqueue(spec()))
            leased = queue.lease_next("worker-a")
            self.assertEqual("leased", leased["state"])
            first.close()
            second = StateStore(path)
            restored = MissionQueue(second).get("M-STATE-001")
            self.assertEqual("leased", restored["state"])
            self.assertEqual("worker-a", restored["lease_owner"])
            second.close()

    def test_stale_lease_recovers(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            store = StateStore(Path(raw) / "state.sqlite3")
            queue = MissionQueue(store)
            queue.enqueue(spec())
            queue.lease_next("dead-worker", lease_seconds=-1)
            self.assertEqual(1, queue.recover_expired_leases())
            restored = queue.get("M-STATE-001")
            self.assertEqual("queued", restored["state"])
            self.assertEqual("orphaned_lease", restored["blocker_classification"])
            store.close()

    def test_leased_mission_can_fail_closed_on_external_authorization(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            store = StateStore(Path(raw) / "state.sqlite3")
            queue = MissionQueue(store)
            queue.enqueue(spec())
            queue.lease_next("worker")
            blocked = queue.transition(
                "M-STATE-001",
                "blocked_external",
                next_action="automatically retry after accepted provider access",
                updates={
                    "blocker_classification": "provider_authorization",
                    "lease_owner": None,
                    "lease_started_at": None,
                    "lease_expires_at": None,
                },
            )
            self.assertEqual("blocked_external", blocked["state"])
            self.assertIsNone(blocked["lease_owner"])
            store.close()

    def test_running_lane_and_operation_recover_after_crash(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "state.sqlite3"
            store = StateStore(path)
            queue = MissionQueue(store)
            queue.enqueue(spec())
            queue.lease_next("dead-worker")
            queue.transition("M-STATE-001", "planning", next_action="run")
            store.begin_operation("op-1", "fixture", "hash", "M-STATE-001")
            store.execute(
                """
                INSERT INTO lane_runs(
                  lane_run_id,mission_id,cycle_id,lane_id,lane_name,model,
                  secret_reference,state,attempt,started_at
                ) VALUES('lane-run','M-STATE-001','cycle',5,'release','model',
                         'CANA_LANE_1_API_KEY','running',1,?)
                """,
                (utc_now(),),
            )
            store.close()
            restarted = StateStore(path)
            self.assertEqual(1, restarted.recover_incomplete_operations())
            self.assertEqual(1, restarted.recover_orphaned_lane_runs())
            self.assertEqual(1, MissionQueue(restarted).recover_orphaned_active_missions())
            self.assertEqual("queued", MissionQueue(restarted).get("M-STATE-001")["state"])
            self.assertEqual(
                "interrupted",
                restarted.row("SELECT state FROM lane_runs WHERE lane_run_id='lane-run'")["state"],
            )
            restarted.close()

    def test_operation_identifier_is_idempotent(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            store = StateStore(Path(raw) / "state.sqlite3")
            first, _ = store.begin_operation("stable-op", "fixture", "input")
            self.assertTrue(first)
            store.finish_operation("stable-op", "completed", {"value": 7})
            second, result = store.begin_operation("stable-op", "fixture", "input")
            self.assertFalse(second)
            self.assertEqual({"value": 7}, result)
            store.close()


class ProviderResilienceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.store = StateStore(Path(self.temp.name) / "state.sqlite3")
        self.config = {
            "maximum_retry_attempts": 5,
            "backoff_base_seconds": 10,
            "backoff_max_seconds": 1000,
            "backoff_jitter_seconds": 0,
            "circuit_breaker_failures": 4,
            "daily_request_cap_per_reference": 2,
        }
        self.health = OpenRouterHealth(self.store, self.config, random_seed=1)

    def tearDown(self) -> None:
        self.store.close()
        self.temp.cleanup()

    def test_429_honors_retry_after_and_scoped_cooldowns(self) -> None:
        decision = self.health.register_failure(
            lane_id=2,
            secret_reference="CANA_LANE_2_API_KEY",
            model="lane/model",
            error_class="rate_limit",
            attempt=1,
            retry_after="120",
        )
        self.assertTrue(decision.retryable)
        self.assertGreaterEqual(decision.delay_seconds, 120)
        scopes = {(row["scope_type"], row["scope_id"]) for row in self.store.active_cooldowns()}
        self.assertEqual(
            {
                ("lane", "2"),
                ("secret_reference", "CANA_LANE_2_API_KEY"),
                ("model", "lane/model"),
            },
            scopes,
        )

    def test_503_uses_exponential_retry_and_breaker(self) -> None:
        decision = self.health.retry_decision(error_class="overloaded", attempt=4)
        self.assertTrue(decision.retryable)
        self.assertEqual(80, decision.delay_seconds)
        self.assertTrue(decision.circuit_open)

    def test_timeout_malformed_and_terminal_auth_are_classified(self) -> None:
        self.assertEqual("timeout", self.health.classify(None, "request timed out"))
        self.assertEqual("malformed", self.health.classify(None, "invalid JSON"))
        self.assertEqual("auth", self.health.classify(401, ""))
        self.assertFalse(self.health.retry_decision(error_class="auth", attempt=1).retryable)

    def test_daily_accounting_is_per_reference(self) -> None:
        self.health.record_request("REF_A", "model")
        self.health.record_request("REF_A", "model")
        self.health.record_request("REF_B", "model")
        self.assertFalse(self.health.under_daily_cap("REF_A"))
        self.assertTrue(self.health.under_daily_cap("REF_B"))

    def test_primary_failure_activates_configured_fallback(self) -> None:
        with temporary_git_repository() as repo:
            queue = MissionQueue(self.store)
            queue.enqueue(spec())
            mission = queue.lease_next("worker")
            lane = {
                "id": 1,
                "name": "strategy",
                "agent": "cana-strategist",
                "primary_model": "lane/primary",
                "fallback_models": ["lane/fallback"],
                "secret_reference": "CANA_LANE_1_API_KEY",
            }
            adapter = OpenCodeAdapter(
                workspace=repo,
                runtime_dir=Path(self.temp.name),
                store=self.store,
                health=self.health,
                config={"executable": "opencode"},
                secret_references=["CANA_LANE_1_API_KEY"],
                server_url="http://127.0.0.1:1",
                mock=True,
                mock_profile={"fail_models": ["lane/primary"]},
            )
            result = adapter.run_lane(
                cycle_id="cycle-fallback",
                mission=mission,
                lane=lane,
                prompt="bounded",
                working_directory=repo,
            )
            self.assertTrue(result.ok)
            self.assertEqual("lane/fallback", result.model)

    def test_sanitizer_removes_direct_and_pattern_secrets(self) -> None:
        fake = "fixture-secret-material-123456789"
        clean = sanitize(f"value={fake} api_key={fake}", [fake])
        self.assertNotIn(fake, clean)
        self.assertIn("[REDACTED_SECRET]", clean)
