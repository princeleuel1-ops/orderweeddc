from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ENGINE_ROOT = Path(__file__).resolve().parents[1]
if str(ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ENGINE_ROOT))

from codex_adapter import CodexAdapter
from security import unauthorized_codex_invocations


def config() -> dict[str, object]:
    return {
        "executable": "codex",
        "reasoning_effort": "high",
        "approval_policy": "never",
        "modifying_sandbox": "workspace-write",
        "readonly_sandbox": "read-only",
        "job_timeout_seconds": 30,
        "max_output_bytes": 65536,
    }


class CodexAdapterTests(unittest.TestCase):
    def test_successful_output_cannot_be_misclassified_as_a_usage_limit(self) -> None:
        output = "usage: git diff [options]\n-l <n> prevent rename limits"

        self.assertIsNone(
            CodexAdapter.classify(
                0,
                output,
                timed_out=False,
                stopped=False,
            )
        )

    def test_command_is_bounded_scoped_and_prompt_is_not_an_argument(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            adapter = CodexAdapter(
                workspace=root,
                runtime_dir=root / "runtime",
                config=config(),
            )
            command = adapter.build_command(
                working_directory=root, modifying=True
            )
            joined = " ".join(command)
            self.assertIn("workspace-write", command)
            self.assertIn("never", command)
            self.assertIn(str(root.resolve()), command)
            self.assertEqual("-", command[-1])
            self.assertNotIn("private mission prompt", joined)
            self.assertNotIn("danger-full-access", command)

    def test_resume_uses_supported_session_and_read_only_sandbox(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            adapter = CodexAdapter(
                workspace=root,
                runtime_dir=root / "runtime",
                config=config(),
            )
            session = "00000000-0000-4000-8000-000000000123"
            command = adapter.build_command(
                working_directory=root,
                modifying=False,
                session_id=session,
            )
            self.assertIn("resume", command)
            self.assertIn(session, command)
            self.assertIn("read-only", command)
            self.assertNotIn("workspace-write", command)

    def test_structured_session_and_failure_classes_are_detected(self) -> None:
        output = (
            '{"type":"thread.started",'
            '"thread_id":"00000000-0000-4000-8000-000000000123"}'
        )
        self.assertEqual(
            "00000000-0000-4000-8000-000000000123",
            CodexAdapter.session_id(output),
        )
        self.assertEqual(
            "usage_limit",
            CodexAdapter.classify(
                1, "usage limit reached", timed_out=False, stopped=False
            ),
        )
        self.assertEqual(
            "auth_required",
            CodexAdapter.classify(
                1, "login required", timed_out=False, stopped=False
            ),
        )
        self.assertEqual(
            "timeout",
            CodexAdapter.classify(
                None, "", timed_out=True, stopped=False
            ),
        )
        self.assertEqual(
            "configuration",
            CodexAdapter.classify(
                1,
                "The model requires a newer version of Codex.",
                timed_out=False,
                stopped=False,
            ),
        )

    def test_mock_execution_captures_session_and_safe_stop(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            starts: list[tuple[str, int, list[str]]] = []
            adapter = CodexAdapter(
                workspace=root,
                runtime_dir=root / "runtime",
                config=config(),
                mock=True,
            )
            result = adapter.run(
                mission_id="CX-MOCK",
                prompt="bounded fixture",
                working_directory=root,
                modifying=False,
                on_start=lambda run_id, pid, structure: starts.append(
                    (run_id, pid, structure)
                ),
                should_stop=lambda: True,
            )
            self.assertEqual(1, len(starts))
            self.assertTrue(result.stopped)
            self.assertEqual("manual_stop", result.error_class)
            self.assertTrue(Path(result.artifact_path).is_file())

    def test_static_boundary_rejects_no_authorized_production_caller(self) -> None:
        self.assertEqual([], unauthorized_codex_invocations(ENGINE_ROOT))


if __name__ == "__main__":
    unittest.main()
