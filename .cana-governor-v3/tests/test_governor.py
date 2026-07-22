from __future__ import annotations

import importlib.util
import hashlib
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from unittest import mock
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


governor_module = load_module("cana_governor", ROOT / "scripts" / "cana_governor.py")
image_module = load_module("gemini_image_worker", ROOT / "scripts" / "gemini_image_worker.py")


class GovernorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)
        self.workspace = self.base / "workspace"
        self.workspace.mkdir()
        subprocess.run(["git", "init"], cwd=self.workspace, check=True, capture_output=True)
        subprocess.run(
            ["git", "config", "user.email", "test@example.invalid"],
            cwd=self.workspace,
            check=True,
        )
        subprocess.run(
            ["git", "config", "user.name", "Governor Test"], cwd=self.workspace, check=True
        )
        (self.workspace / "README.md").write_text("# test\n", encoding="utf-8")
        subprocess.run(["git", "add", "README.md"], cwd=self.workspace, check=True)
        subprocess.run(["git", "commit", "-m", "seed"], cwd=self.workspace, check=True, capture_output=True)

        self.bundle = self.base / "bundle"
        (self.bundle / "config").mkdir(parents=True)
        (self.bundle / "prompts").mkdir()
        (self.bundle / ".opencode").mkdir()
        (self.bundle / "prompts" / "GOVERNOR_CHARTER.md").write_text(
            "# Test charter\nNever invent proof.\n", encoding="utf-8"
        )
        (self.bundle / "config" / "opencode.governor.json").write_text("{}\n", encoding="utf-8")
        config = json.loads((ROOT / "config" / "governor.json").read_text(encoding="utf-8"))
        config["workspace"] = str(self.workspace)
        config["cycle_delay_seconds"] = 0
        config["pause_poll_seconds"] = 0
        config["backoff"]["base_seconds"] = 0
        config["backoff"]["maximum_seconds"] = 0
        config["backoff"]["jitter_seconds"] = 0
        self.config_path = self.bundle / "config" / "governor.json"
        self.config_path.write_text(json.dumps(config), encoding="utf-8")

    def tearDown(self) -> None:
        self.temp.cleanup()

    def test_dry_run_pass_queues_next_mission_and_persists_receipts(self) -> None:
        governor = governor_module.Governor(self.config_path, dry_run=True)
        try:
            code = governor.run(once=True)
            self.assertEqual(code, 0)
            passed = governor.db.execute(
                "SELECT status,last_verdict FROM missions WHERE mission_id='M-STAGE-001'"
            ).fetchone()
            self.assertEqual(tuple(passed), ("passed", "PASS"))
            queued = governor.db.execute(
                "SELECT COUNT(*) FROM missions WHERE status='queued'"
            ).fetchone()[0]
            self.assertEqual(queued, 1)
            lanes = governor.db.execute("SELECT COUNT(*) FROM lane_runs").fetchone()[0]
            self.assertEqual(lanes, 5)
            self.assertEqual(governor.usage(), 0)
            receipts = list((self.workspace / ".governor" / "artifacts").glob("*/cycle-receipt.json"))
            self.assertEqual(len(receipts), 1)
        finally:
            governor.close()

    def test_durable_stop_prevents_cycle(self) -> None:
        governor = governor_module.Governor(self.config_path, dry_run=True)
        try:
            (governor.control / "STOP").write_text("stop", encoding="utf-8")
            code = governor.run(once=True)
            self.assertEqual(code, 0)
            cycles = governor.db.execute("SELECT COUNT(*) FROM cycles").fetchone()[0]
            self.assertEqual(cycles, 0)
        finally:
            governor.close()

    def test_restart_resumes_the_auto_queued_mission(self) -> None:
        first = governor_module.Governor(self.config_path, dry_run=True)
        try:
            self.assertEqual(first.run(once=True), 0)
        finally:
            first.close()
        second = governor_module.Governor(self.config_path, dry_run=True)
        try:
            self.assertEqual(second.run(once=True), 0)
            passed = second.db.execute(
                "SELECT COUNT(*) FROM missions WHERE status='passed'"
            ).fetchone()[0]
            queued = second.db.execute(
                "SELECT COUNT(*) FROM missions WHERE status='queued'"
            ).fetchone()[0]
            self.assertEqual(passed, 2)
            self.assertEqual(queued, 1)
        finally:
            second.close()

    def test_restart_recovers_orphaned_running_cycle(self) -> None:
        first = governor_module.Governor(self.config_path, dry_run=True)
        try:
            now = governor_module.utc_now()
            first.db.execute(
                """
                INSERT INTO cycles(cycle_id,mission_id,started_at,status)
                VALUES('C-ORPHANED','M-STAGE-001',?,'running')
                """,
                (now,),
            )
            first.db.execute(
                """
                UPDATE missions
                SET status='running',updated_at=?,last_cycle_id='C-ORPHANED'
                WHERE mission_id='M-STAGE-001'
                """,
                (now,),
            )
            first.db.commit()
        finally:
            first.close()

        restarted = governor_module.Governor(self.config_path, dry_run=True)
        try:
            self.assertEqual(restarted.run(once=True), 0)
            orphaned = restarted.db.execute(
                "SELECT status,error_class FROM cycles WHERE cycle_id='C-ORPHANED'"
            ).fetchone()
            self.assertEqual(tuple(orphaned), ("interrupted", "worker_exit"))
            mission = restarted.db.execute(
                "SELECT status,last_verdict FROM missions WHERE mission_id='M-STAGE-001'"
            ).fetchone()
            self.assertEqual(tuple(mission), ("passed", "PASS"))
            recovery_events = restarted.db.execute(
                "SELECT COUNT(*) FROM events WHERE event_type='orphaned_run_recovered'"
            ).fetchone()[0]
            self.assertEqual(recovery_events, 1)
        finally:
            restarted.close()

    def test_preflight_rejects_known_compromised_lane_keys(self) -> None:
        governor = governor_module.Governor(self.config_path, dry_run=False)
        fake_key = "sk-or-v1-" + ("a" * 64)
        digest = hashlib.sha256(fake_key.encode("utf-8")).hexdigest()
        lane_env = {
            f"CANA_LANE_{lane}_API_KEY": fake_key
            for lane in range(1, 6)
        }
        try:
            with mock.patch.object(
                governor_module, "COMPROMISED_KEY_SHA256", {digest}
            ), mock.patch.dict(os.environ, lane_env, clear=False):
                errors = governor.preflight(require_keys=True)
            compromised = [
                error for error in errors if "compromised credential" in error
            ]
            self.assertEqual(len(compromised), 5)
            self.assertTrue(all(fake_key not in error for error in errors))
        finally:
            governor.close()

    def test_single_instance_lock_rejects_duplicate_owner(self) -> None:
        lock_path = self.workspace / ".governor" / "test.lock"
        with governor_module.SingleInstanceLock(lock_path):
            with self.assertRaises(governor_module.AlreadyRunning):
                with governor_module.SingleInstanceLock(lock_path):
                    pass

    def test_quota_reserves_complete_five_lane_cycle(self) -> None:
        governor = governor_module.Governor(self.config_path, dry_run=True)
        try:
            governor.config["daily_request_cap"] = 19
            self.assertFalse(governor.quota_allows_cycle())
            governor.config["daily_request_cap"] = 20
            self.assertTrue(governor.quota_allows_cycle())
        finally:
            governor.close()

    def test_error_classification_and_redaction(self) -> None:
        self.assertEqual(governor_module.classify_provider_error("HTTP 429"), "rate_limit")
        self.assertEqual(governor_module.classify_provider_error("402 payment required"), "payment")
        self.assertEqual(governor_module.classify_provider_error("404 model not found"), "model_unavailable")
        clean = governor_module.sanitize("key=sk-secretvalue123456789")
        self.assertNotIn("secretvalue", clean)
        structured = governor_module.structured_error_text(
            '{"type":"step_start","message":"ordinary"}\n'
            '{"type":"session.error","error":{"status":429}}\n'
        )
        self.assertIn("429", structured)
        self.assertNotIn("ordinary", structured)

    def test_image_manifest_blocks_path_escape(self) -> None:
        request = {
            "id": "x",
            "prompt": "Original adult editorial artwork with abstract leaves and no commercial claims.",
            "aspect_ratio": "16:9",
            "image_size": "1K",
            "target_relative_path": "../outside.png",
            "rationale": "test",
            "rights_confirmed": True,
            "safety_reviewed": True,
        }
        target, errors = image_module._validate(request, self.workspace)
        self.assertIsNone(target)
        self.assertTrue(any("escapes" in item for item in errors))


if __name__ == "__main__":
    unittest.main()
