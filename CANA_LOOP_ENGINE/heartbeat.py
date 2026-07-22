"""Atomic heartbeat writer with a maximum 30-second cadence."""

from __future__ import annotations

import os
import sqlite3
import threading
from pathlib import Path
from typing import Any

from runtime_utils import atomic_write_json, utc_now
from state_store import StateStore


class Heartbeat:
    def __init__(self, store: StateStore, path: Path, interval_seconds: int = 10):
        self.store = store
        self.path = path
        self.interval_seconds = max(1, min(30, int(interval_seconds)))
        self._stop = threading.Event()
        self._lock = threading.Lock()
        self._phase = "starting"
        self._mission_id: str | None = None
        self._progress_token: str | None = None
        self._extra: dict[str, Any] = {}
        self._thread: threading.Thread | None = None
        self._owner_thread_id = threading.get_ident()

    def update(
        self,
        phase: str,
        *,
        mission_id: str | None = None,
        progress_token: str | None = None,
        **extra: Any,
    ) -> None:
        with self._lock:
            self._phase = phase
            self._mission_id = mission_id
            self._progress_token = progress_token
            self._extra = extra
        if threading.get_ident() == self._owner_thread_id:
            self.store.set_runtime(
                "heartbeat_context",
                {
                    "phase": phase,
                    "active_mission_id": mission_id,
                    "progress_token": progress_token,
                    **extra,
                },
            )
        self.write()

    def write(self) -> None:
        with self._lock:
            payload = {
                "timestamp": utc_now(),
                "pid": os.getpid(),
                "phase": self._phase,
                "active_mission_id": self._mission_id,
                "progress_token": self._progress_token,
                **self._extra,
            }
        atomic_write_json(self.path, payload)
        if threading.get_ident() == self._owner_thread_id:
            self.store.heartbeat(
                payload["pid"],
                payload["phase"],
                payload["active_mission_id"],
                payload["progress_token"],
            )
        else:
            # sqlite connections are thread-affine by default. The heartbeat
            # thread uses a short independent WAL connection rather than
            # weakening that safety boundary for the authoritative store.
            connection = sqlite3.connect(self.store.path, timeout=30)
            try:
                connection.execute("PRAGMA busy_timeout=30000")
                connection.execute(
                    """
                    INSERT INTO heartbeats(
                      created_at,pid,phase,active_mission_id,progress_token
                    ) VALUES(?,?,?,?,?)
                    """,
                    (
                        payload["timestamp"],
                        payload["pid"],
                        payload["phase"],
                        payload["active_mission_id"],
                        payload["progress_token"],
                    ),
                )
                connection.execute(
                    """
                    DELETE FROM heartbeats
                    WHERE heartbeat_id NOT IN (
                      SELECT heartbeat_id FROM heartbeats
                      ORDER BY heartbeat_id DESC LIMIT 500
                    )
                    """
                )
                connection.commit()
            finally:
                connection.close()

    def _run(self) -> None:
        while not self._stop.wait(self.interval_seconds):
            self.write()

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self.write()
        self._thread = threading.Thread(target=self._run, name="cana-heartbeat", daemon=True)
        self._thread.start()

    def running(self) -> bool:
        return bool(self._thread and self._thread.is_alive())

    def stop(self, final_phase: str = "stopped") -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=self.interval_seconds + 1)
        self.update(final_phase)
