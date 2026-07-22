"""Sanitized Codex availability, usage ceilings, and cooldown classification."""

from __future__ import annotations

import datetime as dt
from typing import Any

from codex_adapter import CodexAdapter, CodexCapabilities
from runtime_utils import add_seconds, parse_time, utc_now
from state_store import StateStore


class CodexHealth:
    def __init__(
        self, store: StateStore, adapter: CodexAdapter, config: dict[str, Any]
    ):
        self.store = store
        self.adapter = adapter
        self.config = config

    @staticmethod
    def usage_day() -> str:
        return dt.datetime.now(dt.timezone.utc).date().isoformat()

    def usage_count(self) -> int:
        row = self.store.row(
            "SELECT job_count FROM codex_usage_daily WHERE usage_day=?",
            (self.usage_day(),),
        )
        return int(row["job_count"]) if row else 0

    def increment_usage(self) -> int:
        now = utc_now()
        day = self.usage_day()
        self.store.execute(
            """
            INSERT INTO codex_usage_daily(usage_day,job_count,updated_at)
            VALUES(?,1,?)
            ON CONFLICT(usage_day) DO UPDATE SET
              job_count=codex_usage_daily.job_count+1,updated_at=excluded.updated_at
            """,
            (day, now),
        )
        return self.usage_count()

    def daily_ceiling(self) -> int | None:
        value = int(self.config.get("daily_job_ceiling", 6))
        return max(1, value) if value > 0 else None

    def ceiling_reached(self) -> bool:
        ceiling = self.daily_ceiling()
        return ceiling is not None and self.usage_count() >= ceiling

    def active_cooldown(self) -> dict[str, Any] | None:
        row = self.store.row(
            """
            SELECT * FROM cooldowns
            WHERE scope_type='codex' AND scope_id='blade-0' AND until_at>?
            """,
            (utc_now(),),
        )
        return row

    def record_cooldown(self, reason: str, seconds: int) -> str:
        now = utc_now()
        until_at = add_seconds(now, max(30, int(seconds)))
        existing = self.store.row(
            """
            SELECT attempt FROM cooldowns
            WHERE scope_type='codex' AND scope_id='blade-0'
            """
        )
        attempt = int(existing["attempt"]) + 1 if existing else 1
        self.store.execute(
            """
            INSERT INTO cooldowns(
              scope_type,scope_id,reason,attempt,until_at,updated_at
            ) VALUES('codex','blade-0',?,?,?,?)
            ON CONFLICT(scope_type,scope_id) DO UPDATE SET
              reason=excluded.reason,attempt=excluded.attempt,
              until_at=excluded.until_at,updated_at=excluded.updated_at
            """,
            (reason, attempt, until_at, now),
        )
        return until_at

    def clear_cooldown_if_expired(self) -> bool:
        row = self.store.row(
            """
            SELECT until_at FROM cooldowns
            WHERE scope_type='codex' AND scope_id='blade-0'
            """
        )
        if not row:
            return False
        until_at = parse_time(row["until_at"])
        now = parse_time(utc_now())
        if until_at and now and until_at > now:
            return False
        self.store.execute(
            "DELETE FROM cooldowns WHERE scope_type='codex' AND scope_id='blade-0'"
        )
        return True

    def preflight(self) -> CodexCapabilities:
        capabilities = self.adapter.discover()
        payload = capabilities.to_dict()
        payload["usage_today"] = self.usage_count()
        payload["daily_job_ceiling"] = self.daily_ceiling()
        payload["cooldown"] = self.active_cooldown()
        payload["ready"] = bool(
            capabilities.installed
            and capabilities.authenticated
            and capabilities.noninteractive_exec
            and capabilities.workspace_scoping
            and capabilities.approval_never
            and "workspace-write" in capabilities.sandbox_modes
            and "read-only" in capabilities.sandbox_modes
            and not payload["cooldown"]
            and not self.ceiling_reached()
        )
        self.store.set_runtime("codex_capabilities", payload)
        self.store.event(
            "codex_preflight",
            {
                "installed": capabilities.installed,
                "authenticated": capabilities.authenticated,
                "ready": payload["ready"],
                "blocker": capabilities.blocker,
            },
        )
        return capabilities

    def status(self) -> dict[str, Any]:
        value = self.store.get_runtime("codex_capabilities", {})
        if not isinstance(value, dict):
            value = {}
        value = dict(value)
        value["usage_today"] = self.usage_count()
        value["daily_job_ceiling"] = self.daily_ceiling()
        value["cooldown"] = self.active_cooldown()
        value["ready"] = bool(
            value.get("installed")
            and value.get("authenticated")
            and value.get("noninteractive_exec")
            and value.get("workspace_scoping")
            and value.get("approval_never")
            and "workspace-write" in value.get("sandbox_modes", [])
            and "read-only" in value.get("sandbox_modes", [])
            and not value["cooldown"]
            and not self.ceiling_reached()
        )
        return value
