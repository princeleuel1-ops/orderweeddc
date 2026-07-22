from __future__ import annotations

import json
import os
import re
import sys
import tempfile
import unittest
from pathlib import Path

ENGINE_ROOT = Path(__file__).resolve().parents[1]
if str(ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ENGINE_ROOT))

from security import (
    accepted_secret_reference,
    sanitize,
    unauthorized_codex_invocations,
)


class SecurityContractTests(unittest.TestCase):
    def test_five_configured_references_are_unique_and_openrouter_backed(self) -> None:
        lanes = json.loads((ENGINE_ROOT / "config" / "lanes.json").read_text(encoding="utf-8"))["lanes"]
        references = [lane["secret_reference"] for lane in lanes]
        self.assertEqual(5, len(lanes))
        self.assertEqual(5, len(set(references)))
        self.assertEqual(
            {f"CANA_LANE_{lane}_API_KEY" for lane in range(1, 6)},
            set(references),
        )
        opencode = (ENGINE_ROOT / "config" / "opencode.json").read_text(encoding="utf-8")
        self.assertEqual(5, opencode.count("https://openrouter.ai/api/v1"))
        self.assertIn('"share": "disabled"', opencode)
        for reference in references:
            self.assertIn(f"{{env:{reference}}}", opencode)

    def test_configuration_contains_references_not_plaintext_keys(self) -> None:
        pattern = re.compile(r"sk-[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{20,}")
        for path in (ENGINE_ROOT / "config").glob("*.json"):
            self.assertIsNone(pattern.search(path.read_text(encoding="utf-8")), str(path))

    def test_only_adapter_may_invoke_installed_codex(self) -> None:
        self.assertEqual([], unauthorized_codex_invocations(ENGINE_ROOT))
        adapter = (ENGINE_ROOT / "codex_adapter.py").read_text(encoding="utf-8")
        self.assertIn("subprocess.Popen", adapter)
        self.assertIn('config.get("executable", "codex")', adapter)

    def test_no_secret_is_placed_in_process_arguments(self) -> None:
        start = (ENGINE_ROOT / "Start-CanaLoop.ps1").read_text(encoding="utf-8")
        adapter = (ENGINE_ROOT / "opencode_adapter.py").read_text(encoding="utf-8")
        codex_adapter = (ENGINE_ROOT / "codex_adapter.py").read_text(encoding="utf-8")
        self.assertNotRegex(start, r"--(?:api-?key|token|secret)")
        self.assertNotRegex(adapter, r"--(?:api-?key|token|secret)")
        self.assertNotRegex(codex_adapter, r"--(?:api-?key|token|secret)")
        self.assertIn("OPENCODE_SERVER_PASSWORD", start)

    def test_preflight_rejects_absent_reference_and_accepts_non_denied_fixture(self) -> None:
        reference = "CANA_TEST_EPHEMERAL_REFERENCE"
        original = os.environ.get(reference)
        try:
            os.environ.pop(reference, None)
            self.assertFalse(accepted_secret_reference(reference))
            os.environ[reference] = "fixture-value-that-is-not-a-real-provider-key"
            self.assertTrue(accepted_secret_reference(reference))
        finally:
            if original is None:
                os.environ.pop(reference, None)
            else:
                os.environ[reference] = original

    def test_redaction_removes_authorization_headers(self) -> None:
        clean = sanitize("Authorization: Bearer fixture")
        self.assertNotIn("fixture", clean)
