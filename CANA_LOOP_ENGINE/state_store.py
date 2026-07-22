"""SQLite source of truth for missions, lanes, operations, and recovery."""

from __future__ import annotations

import contextlib
import json
import os
import sqlite3
from pathlib import Path
from typing import Any, Iterator

from runtime_utils import canonical_json, parse_time, utc_now
from security import sanitize


MISSION_STATES = frozenset(
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
    }
)
TERMINAL_STATES = frozenset({"failed_terminal", "superseded", "completed"})
ACTIVE_STATES = MISSION_STATES - TERMINAL_STATES - {"queued", "retry_wait", "blocked_external", "blocked_human"}

CODEX_MISSION_STATES = frozenset(
    {
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
)
CODEX_TERMINAL_STATES = frozenset(
    {
        "CODEX_TERMINAL_FAILURE",
        "CODEX_COMPLETED",
        "CODEX_REJECTED",
        "CODEX_INTEGRATED",
        "CODEX_REVERTED",
    }
)


class AlreadyRunning(RuntimeError):
    pass


class SingleInstanceLock:
    def __init__(self, path: Path):
        self.path = path
        self.handle: Any = None

    def __enter__(self) -> "SingleInstanceLock":
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.handle = self.path.open("a+b")
        self.handle.seek(0, os.SEEK_END)
        if self.handle.tell() == 0:
            self.handle.write(b"0")
            self.handle.flush()
        self.handle.seek(0)
        try:
            if os.name == "nt":
                import msvcrt

                msvcrt.locking(self.handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl

                fcntl.flock(self.handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            self.handle.close()
            self.handle = None
            raise AlreadyRunning("another CANA Loop supervisor owns the runtime lock") from exc
        return self

    def __exit__(self, *_: Any) -> None:
        if not self.handle:
            return
        with contextlib.suppress(OSError):
            self.handle.seek(0)
            if os.name == "nt":
                import msvcrt

                msvcrt.locking(self.handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(self.handle.fileno(), fcntl.LOCK_UN)
        self.handle.close()
        self.handle = None


class StateStore:
    def __init__(self, path: Path):
        self.path = path.resolve()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(self.path, timeout=30, isolation_level=None)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.execute("PRAGMA busy_timeout=30000")
        self._initialize()

    def _initialize(self) -> None:
        self.db.executescript(
            """
            CREATE TABLE IF NOT EXISTS missions (
                mission_id TEXT PRIMARY KEY,
                parent_mission_id TEXT,
                objective TEXT NOT NULL,
                rationale TEXT NOT NULL,
                lane TEXT NOT NULL,
                primary_model TEXT NOT NULL,
                fallback_models_json TEXT NOT NULL DEFAULT '[]',
                secret_reference TEXT NOT NULL,
                priority REAL NOT NULL,
                dependencies_json TEXT NOT NULL DEFAULT '[]',
                acceptance_criteria_json TEXT NOT NULL DEFAULT '[]',
                prohibited_changes_json TEXT NOT NULL DEFAULT '[]',
                assumptions_json TEXT NOT NULL DEFAULT '[]',
                sota_gap TEXT NOT NULL DEFAULT '',
                brittle_point TEXT NOT NULL DEFAULT '',
                success_metrics_json TEXT NOT NULL DEFAULT '[]',
                feedback_signals_json TEXT NOT NULL DEFAULT '[]',
                benchmark_evidence_json TEXT NOT NULL DEFAULT '[]',
                measurement_contract_json TEXT NOT NULL DEFAULT '[]',
                falsification_test TEXT NOT NULL DEFAULT '',
                promotion_rule TEXT NOT NULL DEFAULT '',
                next_frontier TEXT NOT NULL DEFAULT '',
                frontier_epoch INTEGER NOT NULL DEFAULT 1,
                strategy_revision INTEGER NOT NULL DEFAULT 1,
                progress_delta_json TEXT NOT NULL DEFAULT '{}',
                modifying INTEGER NOT NULL DEFAULT 0,
                state TEXT NOT NULL,
                worktree TEXT,
                branch_name TEXT,
                lease_owner TEXT,
                lease_started_at TEXT,
                lease_expires_at TEXT,
                attempt_number INTEGER NOT NULL DEFAULT 0,
                maximum_attempts INTEGER NOT NULL DEFAULT 3,
                opencode_session_id TEXT,
                prompt_hash TEXT,
                input_state_hash TEXT,
                changed_files_json TEXT NOT NULL DEFAULT '[]',
                diff_hash TEXT,
                commands_executed_json TEXT NOT NULL DEFAULT '[]',
                test_evidence_json TEXT NOT NULL DEFAULT '[]',
                critic_findings_json TEXT NOT NULL DEFAULT '[]',
                repair_history_json TEXT NOT NULL DEFAULT '[]',
                release_judge_decision TEXT,
                integration_reference TEXT,
                rollback_reference TEXT,
                blocker_classification TEXT,
                next_action TEXT NOT NULL,
                operation_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                completed_at TEXT,
                CHECK (modifying IN (0,1))
            );
            CREATE INDEX IF NOT EXISTS ix_missions_state_priority
                ON missions(state, priority DESC, created_at);
            CREATE INDEX IF NOT EXISTS ix_missions_lease
                ON missions(lease_expires_at);

            CREATE TABLE IF NOT EXISTS lane_runs (
                lane_run_id TEXT PRIMARY KEY,
                mission_id TEXT NOT NULL,
                cycle_id TEXT NOT NULL,
                lane_id INTEGER NOT NULL,
                lane_name TEXT NOT NULL,
                model TEXT NOT NULL,
                secret_reference TEXT NOT NULL,
                state TEXT NOT NULL,
                attempt INTEGER NOT NULL,
                started_at TEXT NOT NULL,
                finished_at TEXT,
                exit_code INTEGER,
                error_class TEXT,
                retry_after_seconds REAL,
                prompt_hash TEXT,
                output_hash TEXT,
                artifact_path TEXT,
                session_id TEXT,
                FOREIGN KEY(mission_id) REFERENCES missions(mission_id)
            );
            CREATE INDEX IF NOT EXISTS ix_lane_runs_mission ON lane_runs(mission_id, lane_id);

            CREATE TABLE IF NOT EXISTS operations (
                operation_id TEXT PRIMARY KEY,
                mission_id TEXT,
                kind TEXT NOT NULL,
                state TEXT NOT NULL,
                input_hash TEXT NOT NULL,
                result_json TEXT,
                started_at TEXT NOT NULL,
                completed_at TEXT
            );
            CREATE TABLE IF NOT EXISTS cooldowns (
                scope_type TEXT NOT NULL,
                scope_id TEXT NOT NULL,
                reason TEXT NOT NULL,
                attempt INTEGER NOT NULL,
                until_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY(scope_type, scope_id)
            );
            CREATE TABLE IF NOT EXISTS events (
                event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                event_type TEXT NOT NULL,
                mission_id TEXT,
                details_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS research (
                research_id TEXT PRIMARY KEY,
                mission_id TEXT NOT NULL,
                claim TEXT NOT NULL,
                source_url TEXT,
                source_type TEXT NOT NULL,
                retrieved_at TEXT NOT NULL,
                evidence_hash TEXT NOT NULL,
                status TEXT NOT NULL,
                artifact_path TEXT
            );
            CREATE TABLE IF NOT EXISTS integrations (
                integration_id TEXT PRIMARY KEY,
                mission_id TEXT NOT NULL,
                base_reference TEXT NOT NULL,
                branch_name TEXT NOT NULL,
                integration_reference TEXT,
                rollback_reference TEXT,
                state TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS runtime (
                key TEXT PRIMARY KEY,
                value_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS heartbeats (
                heartbeat_id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                pid INTEGER NOT NULL,
                phase TEXT NOT NULL,
                active_mission_id TEXT,
                progress_token TEXT
            );
            CREATE TABLE IF NOT EXISTS no_progress (
                fingerprint TEXT PRIMARY KEY,
                occurrences INTEGER NOT NULL,
                last_mission_id TEXT,
                last_seen_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS usage_daily (
                usage_day TEXT NOT NULL,
                secret_reference TEXT NOT NULL,
                model TEXT NOT NULL,
                request_count INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL,
                PRIMARY KEY(usage_day, secret_reference, model)
            );
            CREATE TABLE IF NOT EXISTS codex_missions (
                mission_id TEXT PRIMARY KEY,
                parent_mission_id TEXT,
                objective TEXT NOT NULL,
                priority_reason TEXT NOT NULL,
                completion_contract_ids_json TEXT NOT NULL DEFAULT '[]',
                acceptance_criteria_json TEXT NOT NULL DEFAULT '[]',
                prohibited_actions_json TEXT NOT NULL DEFAULT '[]',
                assumptions_json TEXT NOT NULL DEFAULT '[]',
                sota_gap TEXT NOT NULL DEFAULT '',
                brittle_point TEXT NOT NULL DEFAULT '',
                success_metrics_json TEXT NOT NULL DEFAULT '[]',
                feedback_signals_json TEXT NOT NULL DEFAULT '[]',
                benchmark_evidence_json TEXT NOT NULL DEFAULT '[]',
                measurement_contract_json TEXT NOT NULL DEFAULT '[]',
                falsification_test TEXT NOT NULL DEFAULT '',
                promotion_rule TEXT NOT NULL DEFAULT '',
                next_frontier TEXT NOT NULL DEFAULT '',
                frontier_epoch INTEGER NOT NULL DEFAULT 1,
                strategy_revision INTEGER NOT NULL DEFAULT 1,
                progress_delta_json TEXT NOT NULL DEFAULT '{}',
                priority REAL NOT NULL,
                baseline_revision TEXT NOT NULL,
                worktree TEXT,
                branch_name TEXT,
                codex_mode TEXT NOT NULL,
                command_structure_json TEXT NOT NULL DEFAULT '[]',
                session_id TEXT,
                process_id INTEGER,
                lease_owner TEXT,
                lease_started_at TEXT,
                lease_expires_at TEXT,
                attempt_count INTEGER NOT NULL DEFAULT 0,
                maximum_attempts INTEGER NOT NULL DEFAULT 3,
                prompt_hash TEXT,
                input_state_hash TEXT,
                changed_files_json TEXT NOT NULL DEFAULT '[]',
                candidate_revision TEXT,
                tests_executed_json TEXT NOT NULL DEFAULT '[]',
                result_evidence_json TEXT NOT NULL DEFAULT '[]',
                external_review_decisions_json TEXT NOT NULL DEFAULT '[]',
                integration_result_json TEXT,
                rollback_reference TEXT,
                terminal_state TEXT,
                blocker_classification TEXT,
                next_action TEXT NOT NULL,
                state TEXT NOT NULL,
                high_impact INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                completed_at TEXT,
                CHECK (high_impact IN (0,1))
            );
            CREATE INDEX IF NOT EXISTS ix_codex_missions_state_priority
                ON codex_missions(state, priority DESC, created_at);
            CREATE INDEX IF NOT EXISTS ix_codex_missions_lease
                ON codex_missions(lease_expires_at);
            CREATE TABLE IF NOT EXISTS codex_runs (
                run_id TEXT PRIMARY KEY,
                mission_id TEXT NOT NULL,
                state TEXT NOT NULL,
                process_id INTEGER,
                session_id TEXT,
                command_structure_json TEXT NOT NULL DEFAULT '[]',
                prompt_hash TEXT NOT NULL,
                output_hash TEXT,
                artifact_path TEXT,
                error_class TEXT,
                exit_code INTEGER,
                started_at TEXT NOT NULL,
                finished_at TEXT,
                FOREIGN KEY(mission_id) REFERENCES codex_missions(mission_id)
            );
            CREATE INDEX IF NOT EXISTS ix_codex_runs_mission
                ON codex_runs(mission_id, started_at);
            CREATE TABLE IF NOT EXISTS codex_reviews (
                review_id TEXT PRIMARY KEY,
                codex_mission_id TEXT NOT NULL,
                candidate_revision TEXT NOT NULL,
                reviewer_lane TEXT NOT NULL,
                reviewer_model TEXT,
                model_family TEXT,
                decision TEXT NOT NULL,
                evidence_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL,
                FOREIGN KEY(codex_mission_id) REFERENCES codex_missions(mission_id)
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ux_codex_review_candidate_lane
                ON codex_reviews(codex_mission_id, candidate_revision, reviewer_lane, model_family);
            CREATE TABLE IF NOT EXISTS codex_usage_daily (
                usage_day TEXT PRIMARY KEY,
                job_count INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            );
            """
        )
        self._ensure_columns(
            "missions",
            {
                "assumptions_json": "TEXT NOT NULL DEFAULT '[]'",
                "sota_gap": "TEXT NOT NULL DEFAULT ''",
                "brittle_point": "TEXT NOT NULL DEFAULT ''",
                "success_metrics_json": "TEXT NOT NULL DEFAULT '[]'",
                "feedback_signals_json": "TEXT NOT NULL DEFAULT '[]'",
                "benchmark_evidence_json": "TEXT NOT NULL DEFAULT '[]'",
                "measurement_contract_json": "TEXT NOT NULL DEFAULT '[]'",
                "falsification_test": "TEXT NOT NULL DEFAULT ''",
                "promotion_rule": "TEXT NOT NULL DEFAULT ''",
                "next_frontier": "TEXT NOT NULL DEFAULT ''",
                "frontier_epoch": "INTEGER NOT NULL DEFAULT 1",
                "strategy_revision": "INTEGER NOT NULL DEFAULT 1",
                "progress_delta_json": "TEXT NOT NULL DEFAULT '{}'",
            },
        )
        self._ensure_columns(
            "codex_missions",
            {
                "assumptions_json": "TEXT NOT NULL DEFAULT '[]'",
                "sota_gap": "TEXT NOT NULL DEFAULT ''",
                "brittle_point": "TEXT NOT NULL DEFAULT ''",
                "success_metrics_json": "TEXT NOT NULL DEFAULT '[]'",
                "feedback_signals_json": "TEXT NOT NULL DEFAULT '[]'",
                "benchmark_evidence_json": "TEXT NOT NULL DEFAULT '[]'",
                "measurement_contract_json": "TEXT NOT NULL DEFAULT '[]'",
                "falsification_test": "TEXT NOT NULL DEFAULT ''",
                "promotion_rule": "TEXT NOT NULL DEFAULT ''",
                "next_frontier": "TEXT NOT NULL DEFAULT ''",
                "frontier_epoch": "INTEGER NOT NULL DEFAULT 1",
                "strategy_revision": "INTEGER NOT NULL DEFAULT 1",
                "progress_delta_json": "TEXT NOT NULL DEFAULT '{}'",
            },
        )
        self.db.execute(
            """
            UPDATE missions
            SET assumptions_json=CASE
                  WHEN assumptions_json='[]' THEN
                    '["legacy mission: repository evidence is assumed current"]'
                  ELSE assumptions_json END,
                sota_gap=CASE WHEN sota_gap='' THEN objective ELSE sota_gap END,
                brittle_point=CASE WHEN brittle_point='' THEN
                  'legacy mission: weakest assumption must be tested before integration'
                  ELSE brittle_point END,
                success_metrics_json=CASE
                  WHEN success_metrics_json='[]' THEN acceptance_criteria_json
                  ELSE success_metrics_json END,
                feedback_signals_json=CASE
                  WHEN feedback_signals_json='[]' THEN
                    '["deterministic verification evidence"]'
                  ELSE feedback_signals_json END
            """
        )
        self.db.execute(
            """
            UPDATE codex_missions
            SET assumptions_json=CASE
                  WHEN assumptions_json='[]' THEN
                    '["legacy mission: repository evidence is assumed current"]'
                  ELSE assumptions_json END,
                sota_gap=CASE WHEN sota_gap='' THEN objective ELSE sota_gap END,
                brittle_point=CASE WHEN brittle_point='' THEN
                  'legacy mission: weakest assumption must be tested before integration'
                  ELSE brittle_point END,
                success_metrics_json=CASE
                  WHEN success_metrics_json='[]' THEN acceptance_criteria_json
                  ELSE success_metrics_json END,
                feedback_signals_json=CASE
                  WHEN feedback_signals_json='[]' THEN
                    '["deterministic verification evidence"]'
                  ELSE feedback_signals_json END
            """
        )
        self.db.execute(
            """
            UPDATE missions SET lease_owner=NULL,lease_started_at=NULL,lease_expires_at=NULL
            WHERE state IN ('completed','failed_terminal','superseded')
              AND (lease_owner IS NOT NULL OR lease_started_at IS NOT NULL OR lease_expires_at IS NOT NULL)
            """
        )
        self.db.execute(
            """
            UPDATE codex_missions
            SET lease_owner=NULL,lease_started_at=NULL,lease_expires_at=NULL,process_id=NULL
            WHERE state IN (
              'CODEX_TERMINAL_FAILURE','CODEX_COMPLETED','CODEX_REJECTED',
              'CODEX_INTEGRATED','CODEX_REVERTED'
            )
              AND (
                lease_owner IS NOT NULL OR lease_started_at IS NOT NULL
                OR lease_expires_at IS NOT NULL OR process_id IS NOT NULL
              )
            """
        )

    def _ensure_columns(self, table: str, columns: dict[str, str]) -> None:
        existing = {
            str(row["name"])
            for row in self.db.execute(f"PRAGMA table_info({table})").fetchall()
        }
        for name, declaration in columns.items():
            if name not in existing:
                self.db.execute(
                    f"ALTER TABLE {table} ADD COLUMN {name} {declaration}"
                )

    @contextlib.contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        self.db.execute("BEGIN IMMEDIATE")
        try:
            yield self.db
            self.db.execute("COMMIT")
        except Exception:
            self.db.execute("ROLLBACK")
            raise

    def close(self) -> None:
        self.db.close()

    def execute(self, sql: str, params: tuple[Any, ...] = ()) -> sqlite3.Cursor:
        return self.db.execute(sql, params)

    def rows(self, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        return [dict(row) for row in self.db.execute(sql, params).fetchall()]

    def row(self, sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
        value = self.db.execute(sql, params).fetchone()
        return dict(value) if value else None

    def event(self, event_type: str, details: dict[str, Any], mission_id: str | None = None) -> None:
        clean = json.loads(sanitize(json.dumps(details, ensure_ascii=False)))
        self.db.execute(
            "INSERT INTO events(created_at,event_type,mission_id,details_json) VALUES(?,?,?,?)",
            (utc_now(), event_type, mission_id, canonical_json(clean)),
        )

    def set_runtime(self, key: str, value: Any) -> None:
        now = utc_now()
        self.db.execute(
            """
            INSERT INTO runtime(key,value_json,updated_at) VALUES(?,?,?)
            ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at
            """,
            (key, canonical_json(value), now),
        )

    def get_runtime(self, key: str, default: Any = None) -> Any:
        row = self.db.execute("SELECT value_json FROM runtime WHERE key=?", (key,)).fetchone()
        return json.loads(row[0]) if row else default

    def begin_operation(
        self,
        operation_id: str,
        kind: str,
        input_hash: str,
        mission_id: str | None = None,
    ) -> tuple[bool, dict[str, Any] | None]:
        existing = self.row("SELECT * FROM operations WHERE operation_id=?", (operation_id,))
        if existing:
            result = json.loads(existing["result_json"]) if existing["result_json"] else None
            return False, result
        self.db.execute(
            """
            INSERT INTO operations(operation_id,mission_id,kind,state,input_hash,started_at)
            VALUES(?,?,?,'running',?,?)
            """,
            (operation_id, mission_id, kind, input_hash, utc_now()),
        )
        return True, None

    def finish_operation(self, operation_id: str, state: str, result: dict[str, Any]) -> None:
        self.db.execute(
            "UPDATE operations SET state=?,result_json=?,completed_at=? WHERE operation_id=?",
            (state, canonical_json(result), utc_now(), operation_id),
        )

    def recover_incomplete_operations(self) -> int:
        rows = self.rows("SELECT operation_id,mission_id,kind FROM operations WHERE state='running'")
        for row in rows:
            self.db.execute(
                "UPDATE operations SET state='interrupted',completed_at=? WHERE operation_id=?",
                (utc_now(), row["operation_id"]),
            )
            self.event("operation_recovered", row, row["mission_id"])
        return len(rows)

    def recover_orphaned_lane_runs(self) -> int:
        rows = self.rows("SELECT lane_run_id,mission_id,lane_id FROM lane_runs WHERE state='running'")
        for row in rows:
            self.db.execute(
                """
                UPDATE lane_runs SET state='interrupted',finished_at=?,
                  error_class='worker_exit' WHERE lane_run_id=?
                """,
                (utc_now(), row["lane_run_id"]),
            )
            self.event("orphaned_lane_run_recovered", row, row["mission_id"])
        return len(rows)

    def recover_orphaned_codex_runs(self) -> int:
        rows = self.rows(
            "SELECT run_id,mission_id,process_id FROM codex_runs WHERE state='running'"
        )
        for row in rows:
            self.db.execute(
                """
                UPDATE codex_runs SET state='interrupted',finished_at=?,
                  error_class='worker_exit' WHERE run_id=?
                """,
                (utc_now(), row["run_id"]),
            )
            self.event("orphaned_codex_run_recovered", row, row["mission_id"])
        return len(rows)

    def heartbeat(self, pid: int, phase: str, mission_id: str | None, progress_token: str | None) -> None:
        now = utc_now()
        self.db.execute(
            """
            INSERT INTO heartbeats(created_at,pid,phase,active_mission_id,progress_token)
            VALUES(?,?,?,?,?)
            """,
            (now, pid, phase, mission_id, progress_token),
        )
        self.db.execute(
            """
            DELETE FROM heartbeats
            WHERE heartbeat_id NOT IN (
              SELECT heartbeat_id FROM heartbeats ORDER BY heartbeat_id DESC LIMIT 500
            )
            """
        )

    def active_cooldowns(self) -> list[dict[str, Any]]:
        now = utc_now()
        return self.rows(
            "SELECT * FROM cooldowns WHERE until_at>? ORDER BY until_at",
            (now,),
        )

    def clear_expired_cooldowns(self) -> int:
        cursor = self.db.execute("DELETE FROM cooldowns WHERE until_at<=?", (utc_now(),))
        return cursor.rowcount

    def latest_heartbeat(self) -> dict[str, Any] | None:
        return self.row("SELECT * FROM heartbeats ORDER BY heartbeat_id DESC LIMIT 1")

    def stale_heartbeat(self, maximum_age_seconds: int) -> bool:
        latest = self.latest_heartbeat()
        if not latest:
            return True
        timestamp = parse_time(latest["created_at"])
        if timestamp is None:
            return True
        now = parse_time(utc_now())
        assert now is not None
        return (now - timestamp).total_seconds() > maximum_age_seconds
