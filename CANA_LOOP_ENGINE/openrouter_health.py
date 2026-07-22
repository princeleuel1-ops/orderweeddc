"""Provider health, retry, cooldown, fallback, breaker, and usage accounting."""

from __future__ import annotations

import datetime as dt
import email.utils
import json
import random
import re
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

from runtime_utils import add_seconds, utc_now
from security import accepted_secret_reference
from state_store import StateStore


ERROR_PATTERNS = {
    "rate_limit": re.compile(r"\b(429|rate.?limit|too many requests)\b", re.I),
    "overloaded": re.compile(r"\b(503|overload|service unavailable)\b", re.I),
    "provider": re.compile(r"\b(500|502|504|gateway|provider unavailable)\b", re.I),
    "timeout": re.compile(r"\b(timeout|timed out|deadline)\b", re.I),
    "auth": re.compile(r"\b(401|403|unauthorized|forbidden|invalid api key)\b", re.I),
    "payment": re.compile(r"\b(402|payment|required|credit)\b", re.I),
    "model_unavailable": re.compile(r"\b(404|model not found|no endpoint|deprecated)\b", re.I),
    "malformed": re.compile(r"\b(malformed|invalid json|parse error|empty response)\b", re.I),
}


@dataclass(frozen=True)
class RetryDecision:
    error_class: str
    retryable: bool
    delay_seconds: float
    circuit_open: bool


class OpenRouterHealth:
    def __init__(self, store: StateStore, config: dict[str, Any], *, random_seed: int | None = None):
        self.store = store
        self.config = config
        self.random = random.Random(random_seed)

    @staticmethod
    def classify(status_code: int | None, text: str) -> str:
        if status_code == 429:
            return "rate_limit"
        if status_code == 503:
            return "overloaded"
        if status_code in (500, 502, 504):
            return "provider"
        if status_code in (401, 403):
            return "auth"
        if status_code == 402:
            return "payment"
        if status_code == 404:
            return "model_unavailable"
        for name, pattern in ERROR_PATTERNS.items():
            if pattern.search(text):
                return name
        return "worker"

    @staticmethod
    def parse_retry_after(value: str | None, now: dt.datetime | None = None) -> float | None:
        if not value:
            return None
        try:
            return max(0.0, float(value))
        except ValueError:
            pass
        try:
            parsed = email.utils.parsedate_to_datetime(value)
            current = now or dt.datetime.now(dt.timezone.utc)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=dt.timezone.utc)
            return max(0.0, (parsed - current).total_seconds())
        except (TypeError, ValueError):
            return None

    def accepted_references(self, references: list[str]) -> set[str]:
        return {reference for reference in references if accepted_secret_reference(reference)}

    def retry_decision(
        self,
        *,
        error_class: str,
        attempt: int,
        retry_after: str | None = None,
    ) -> RetryDecision:
        retryable = error_class in {"rate_limit", "overloaded", "provider", "timeout", "malformed", "worker"}
        maximum_attempts = int(self.config.get("maximum_retry_attempts", 5))
        if attempt >= maximum_attempts or not retryable:
            return RetryDecision(error_class, False, 0.0, True)
        explicit = self.parse_retry_after(retry_after)
        base = float(self.config.get("backoff_base_seconds", 30))
        ceiling = float(self.config.get("backoff_max_seconds", 3600))
        jitter = float(self.config.get("backoff_jitter_seconds", 10))
        exponential = min(ceiling, base * (2 ** max(0, attempt - 1)))
        delay = max(explicit or 0.0, exponential) + self.random.uniform(0.0, jitter)
        threshold = int(self.config.get("circuit_breaker_failures", 4))
        return RetryDecision(error_class, True, delay, attempt >= threshold)

    def register_failure(
        self,
        *,
        lane_id: int,
        secret_reference: str,
        model: str,
        error_class: str,
        attempt: int,
        retry_after: str | None = None,
    ) -> RetryDecision:
        decision = self.retry_decision(error_class=error_class, attempt=attempt, retry_after=retry_after)
        now = utc_now()
        until_at = add_seconds(now, decision.delay_seconds)
        scopes = (
            ("lane", str(lane_id)),
            ("secret_reference", secret_reference),
            ("model", model),
        )
        for scope_type, scope_id in scopes:
            self.store.execute(
                """
                INSERT INTO cooldowns(scope_type,scope_id,reason,attempt,until_at,updated_at)
                VALUES(?,?,?,?,?,?)
                ON CONFLICT(scope_type,scope_id) DO UPDATE SET
                  reason=excluded.reason,attempt=excluded.attempt,
                  until_at=excluded.until_at,updated_at=excluded.updated_at
                """,
                (scope_type, scope_id, error_class, attempt, until_at, now),
            )
        self.store.event(
            "provider_cooldown",
            {
                "lane_id": lane_id,
                "secret_reference": secret_reference,
                "model": model,
                "error_class": error_class,
                "delay_seconds": decision.delay_seconds,
                "circuit_open": decision.circuit_open,
            },
        )
        return decision

    def cooling_down(self, scope_type: str, scope_id: str) -> bool:
        self.store.clear_expired_cooldowns()
        row = self.store.row(
            "SELECT 1 FROM cooldowns WHERE scope_type=? AND scope_id=? AND until_at>?",
            (scope_type, scope_id, utc_now()),
        )
        return row is not None

    def select_model(self, lane: dict[str, Any]) -> str | None:
        if self.cooling_down("lane", str(lane["id"])):
            return None
        if self.cooling_down("secret_reference", lane["secret_reference"]):
            return None
        models = [lane["primary_model"], *lane.get("fallback_models", [])]
        return next((model for model in models if not self.cooling_down("model", model)), None)

    def record_request(self, secret_reference: str, model: str) -> None:
        today = dt.datetime.now().astimezone().date().isoformat()
        self.store.execute(
            """
            INSERT INTO usage_daily(usage_day,secret_reference,model,request_count,updated_at)
            VALUES(?,?,?,1,?)
            ON CONFLICT(usage_day,secret_reference,model) DO UPDATE SET
              request_count=request_count+1,updated_at=excluded.updated_at
            """,
            (today, secret_reference, model, utc_now()),
        )

    def daily_usage(self) -> list[dict[str, Any]]:
        today = dt.datetime.now().astimezone().date().isoformat()
        return self.store.rows(
            "SELECT * FROM usage_daily WHERE usage_day=? ORDER BY secret_reference,model",
            (today,),
        )

    def under_daily_cap(self, secret_reference: str) -> bool:
        today = dt.datetime.now().astimezone().date().isoformat()
        row = self.store.row(
            "SELECT COALESCE(SUM(request_count),0) AS count FROM usage_daily WHERE usage_day=? AND secret_reference=?",
            (today, secret_reference),
        )
        return int(row["count"] if row else 0) < int(self.config.get("daily_request_cap_per_reference", 45))

    def probe(self, reference: str, timeout: int = 15) -> dict[str, Any]:
        """Perform a lightweight provider check only after credential acceptance."""
        if not accepted_secret_reference(reference):
            return {"ok": False, "classification": "credential_preflight"}
        import os

        request = urllib.request.Request(
            self.config.get("models_endpoint", "https://openrouter.ai/api/v1/models"),
            headers={"Authorization": f"Bearer {os.environ[reference]}"},
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                json.load(response)
                return {"ok": True, "status_code": response.status}
        except urllib.error.HTTPError as exc:
            return {"ok": False, "status_code": exc.code, "classification": self.classify(exc.code, str(exc))}
        except (OSError, ValueError) as exc:
            return {"ok": False, "classification": self.classify(None, type(exc).__name__)}
