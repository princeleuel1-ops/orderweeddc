from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

ENGINE_ROOT = Path(__file__).resolve().parents[1]
if str(ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ENGINE_ROOT))

from critic_gate import CriticGate
from integration_gate import IntegrationGate
from mission_queue import MissionQueue, MissionSpec
from no_progress_detector import NoProgressDetector
from opencode_adapter import LaneExecution
from release_judge import ReleaseJudge
from rollback_manager import RollbackManager
from state_store import StateStore
from verification_gate import VerificationGate
from worktree_manager import WorktreeManager

from support import git, temporary_git_repository


def mission_spec(mission_id: str) -> MissionSpec:
    return MissionSpec(
        mission_id=mission_id,
        objective="Modify a fixture safely",
        rationale="Acceptance fixture",
        lane="implementation",
        primary_model="lane/primary",
        fallback_models=["lane/fallback"],
        secret_reference="CANA_LANE_3_API_KEY",
        priority=10,
        acceptance_criteria=["tests pass"],
        prohibited_changes=["force push"],
        modifying=True,
    )


def lane_result(lane_id: int, output: str, ok: bool = True) -> LaneExecution:
    return LaneExecution(
        lane_run_id=f"lr-{lane_id}",
        lane_id=lane_id,
        lane_name=f"lane-{lane_id}",
        model="model",
        ok=ok,
        output=output,
        artifact_path=Path(f"lane-{lane_id}.txt"),
    )


class GateTests(unittest.TestCase):
    def test_independent_critic_rejection_requires_repair(self) -> None:
        decision = CriticGate().evaluate(
            [
                lane_result(2, '{"CANA_CRITIC":"REJECT"}'),
                lane_result(4, '{"CANA_CRITIC":"PASS"}'),
            ]
        )
        self.assertFalse(decision.accepted)
        self.assertIn("Lane 2 rejected", decision.findings[0])

    def test_missing_or_rejected_release_judge_blocks_integration(self) -> None:
        judge = ReleaseJudge()
        self.assertFalse(judge.evaluate([]).accepted)
        self.assertEqual(
            "REJECT",
            judge.evaluate([lane_result(5, '{"CANA_RELEASE":"REJECT"}')]).decision,
        )

    def test_failed_validation_command_blocks(self) -> None:
        with temporary_git_repository() as repo, tempfile.TemporaryDirectory() as raw:
            store = StateStore(Path(raw) / "state.sqlite3")
            gate = VerificationGate(store, Path(raw), [repo])
            result = gate.run(
                mission_id="M-FAIL",
                stage="pre-integration",
                commands=[[sys.executable, "-c", "raise SystemExit(7)"]],
                working_directory=repo,
            )
            self.assertFalse(result.passed)
            self.assertEqual(7, result.commands[0].exit_code)
            store.close()

    def test_no_progress_threshold_redirects_repeated_approach(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            store = StateStore(Path(raw) / "state.sqlite3")
            detector = NoProgressDetector(store, threshold=3)
            observation = {
                "prompt_hash": "same",
                "failure_class": "same",
                "changed_files": [],
                "evidence_hash": "same",
                "criteria_movement": 0,
                "score_movement": 0,
            }
            self.assertFalse(detector.observe("M-1", observation).no_progress)
            self.assertFalse(detector.observe("M-1", observation).no_progress)
            third = detector.observe("M-1", observation)
            self.assertTrue(third.no_progress)
            self.assertIn("decompose", third.next_action)
            store.close()

    def test_no_progress_ignores_session_and_output_churn(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            store = StateStore(Path(raw) / "state.sqlite3")
            detector = NoProgressDetector(store, threshold=3)
            for attempt in range(1, 4):
                result = detector.observe(
                    "M-CHURN",
                    {
                        "prompt_hash": f"attempt-specific-prompt-{attempt}",
                        "plan_hash": "stable-plan",
                        "failure_class": "same",
                        "changed_files": [],
                        "evidence_hash": f"different-output-{attempt}",
                        "session_id": f"different-session-{attempt}",
                        "criteria_movement": 0,
                        "score_movement": 0,
                        "strategy_revision": 1,
                    },
                )
            self.assertTrue(result.no_progress)
            self.assertEqual(3, result.occurrences)
            store.close()


class WorktreeIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repo_context = temporary_git_repository()
        self.repo = self.repo_context.__enter__()
        self.runtime_context = tempfile.TemporaryDirectory(prefix="cana-runtime-")
        self.runtime = Path(self.runtime_context.name)
        self.store = StateStore(self.runtime / "state.sqlite3")
        self.queue = MissionQueue(self.store)
        self.worktrees = WorktreeManager(self.repo, self.runtime, self.store)
        self.integration = IntegrationGate(self.repo, self.store, self.queue, self.worktrees)

    def tearDown(self) -> None:
        self.store.close()
        self.runtime_context.cleanup()
        self.repo_context.__exit__(None, None, None)

    def _create_change(self, mission_id: str, filename: str, content: str):
        self.queue.enqueue(mission_spec(mission_id))
        mission = self.queue.lease_next(f"worker-{mission_id}")
        receipt = self.worktrees.create(mission_id)
        (receipt.path / filename).write_text(content, encoding="utf-8")
        self.worktrees.commit_changes(receipt, f"{mission_id} fixture change")
        return self.queue.get(mission_id), receipt

    def test_modifying_mission_uses_isolated_worktree(self) -> None:
        mission, receipt = self._create_change("M-WORKTREE", "isolated.txt", "isolated\n")
        self.assertNotEqual(self.repo, receipt.path)
        self.assertIn(self.worktrees.root, receipt.path.parents)
        self.assertFalse((self.repo / "isolated.txt").exists())
        self.assertTrue((receipt.path / "isolated.txt").exists())

    def test_first_modified_porcelain_path_keeps_its_first_character(self) -> None:
        self.queue.enqueue(mission_spec("M-PORCELAIN"))
        self.queue.lease_next("worker-porcelain")
        receipt = self.worktrees.create("M-PORCELAIN")
        (receipt.path / "shared.txt").write_text("changed\n", encoding="utf-8")

        changes = self.worktrees.changes(receipt)

        self.assertEqual(["shared.txt"], changes["changed_files"])

    def test_modifying_mission_uses_protected_integration_base(self) -> None:
        protected = self.worktrees.head()
        (self.repo / "after-baseline.txt").write_text("later\n", encoding="utf-8")
        git(self.repo, "add", "--all")
        git(self.repo, "commit", "-m", "advance primary")
        self.store.set_runtime("protected_integration_base", protected)
        self.queue.enqueue(mission_spec("M-PROTECTED"))
        self.queue.lease_next("worker-protected")
        receipt = self.worktrees.create("M-PROTECTED")
        self.assertEqual(protected, receipt.base_reference)
        self.assertFalse((receipt.path / "after-baseline.txt").exists())

    def test_clean_base_requeue_does_not_unblock_provider_mission(self) -> None:
        self.queue.enqueue(mission_spec("M-DIRTY"))
        self.queue.enqueue(mission_spec("M-PROVIDER"))
        self.store.execute(
            """
            UPDATE missions SET state='rejected',blocker_classification='blocked_dirty_primary'
            WHERE mission_id='M-DIRTY'
            """
        )
        self.store.execute(
            """
            UPDATE missions SET state='blocked_external',blocker_classification='provider_authorization'
            WHERE mission_id='M-PROVIDER'
            """
        )
        self.assertEqual(["M-DIRTY"], self.queue.requeue_clean_base_blocked())
        self.assertEqual("queued", self.queue.get("M-DIRTY")["state"])
        self.assertEqual("blocked_external", self.queue.get("M-PROVIDER")["state"])

    def test_no_progress_pivot_changes_strategy_revision_and_routing(self) -> None:
        self.queue.enqueue(mission_spec("M-PIVOT"))
        stalled = self.queue.get("M-PIVOT")
        pivot_id = self.queue.create_strategy_pivot(stalled, "repeated approach")
        pivot = self.queue.get(pivot_id)
        self.assertEqual(2, pivot["strategy_revision"])
        self.assertEqual("lane/fallback", pivot["primary_model"])
        self.assertIn("prior strategy", pivot["brittle_point"].lower())

    def test_failed_gate_prevents_merge(self) -> None:
        mission, receipt = self._create_change("M-BLOCKED", "blocked.txt", "blocked\n")
        result = self.integration.integrate(
            mission=mission,
            receipt=receipt,
            critic_passed=True,
            verification_passed=False,
            release_accepted=True,
        )
        self.assertFalse(result.integrated)
        self.assertEqual("blocked_by_gate", result.state)
        self.assertFalse((self.repo / "blocked.txt").exists())

    def test_accepted_change_integrates_with_rollback_reference_and_reverts(self) -> None:
        mission, receipt = self._create_change("M-INTEGRATE", "accepted.txt", "accepted\n")
        result = self.integration.integrate(
            mission=mission,
            receipt=receipt,
            critic_passed=True,
            verification_passed=True,
            release_accepted=True,
        )
        self.assertTrue(result.integrated)
        self.assertTrue(result.rollback_reference.startswith("git-revert:"))
        self.assertTrue((self.repo / "accepted.txt").exists())
        rollback = RollbackManager(self.repo, self.store).revert(
            mission["mission_id"],
            result.integration_reference,
            "simulated post-integration verification failure",
        )
        self.assertTrue(rollback.rolled_back)
        self.assertFalse((self.repo / "accepted.txt").exists())

    def test_file_conflict_creates_reconciliation_instead_of_overwrite(self) -> None:
        first_mission, first = self._create_change("M-CONFLICT-A", "shared.txt", "first\n")
        second_mission, second = self._create_change("M-CONFLICT-B", "shared.txt", "second\n")
        first_result = self.integration.integrate(
            mission=first_mission,
            receipt=first,
            critic_passed=True,
            verification_passed=True,
            release_accepted=True,
        )
        self.assertTrue(first_result.integrated)
        second_result = self.integration.integrate(
            mission=second_mission,
            receipt=second,
            critic_passed=True,
            verification_passed=True,
            release_accepted=True,
        )
        self.assertFalse(second_result.integrated)
        self.assertEqual("conflict", second_result.state)
        self.assertIsNotNone(second_result.reconciliation_mission_id)
        reconciliation = self.queue.get(second_result.reconciliation_mission_id)
        self.assertEqual("queued", reconciliation["state"])
        self.assertEqual("first\n", (self.repo / "shared.txt").read_text(encoding="utf-8"))

    def test_explicit_overlap_detection_creates_reconciliation(self) -> None:
        self.queue.enqueue(mission_spec("M-OVERLAP"))
        mission = self.queue.get("M-OVERLAP")
        result = self.integration.reject_overlap(
            mission,
            ["apps/web/a.ts", "apps/web/shared.ts"],
            ["apps/web/shared.ts", "apps/web/b.ts"],
        )
        self.assertIsNotNone(result)
        self.assertEqual("conflict", result.state)
        self.assertIsNotNone(self.queue.get("M-OVERLAP-RECONCILE"))
