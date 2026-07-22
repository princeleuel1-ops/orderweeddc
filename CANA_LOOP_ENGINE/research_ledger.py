"""Durable evidence ledger for source-backed research claims."""

from __future__ import annotations

import uuid
from pathlib import Path

from runtime_utils import sha256_text, utc_now
from state_store import StateStore


class ResearchLedger:
    def __init__(self, store: StateStore):
        self.store = store

    def record(
        self,
        *,
        mission_id: str,
        claim: str,
        source_type: str,
        source_url: str | None = None,
        artifact_path: Path | None = None,
        status: str = "unverified",
    ) -> str:
        research_id = f"RS-{uuid.uuid4().hex}"
        evidence_hash = sha256_text(
            "|".join((claim, source_type, source_url or "", str(artifact_path or "")))
        )
        self.store.execute(
            """
            INSERT INTO research(
              research_id,mission_id,claim,source_url,source_type,retrieved_at,
              evidence_hash,status,artifact_path
            ) VALUES(?,?,?,?,?,?,?,?,?)
            """,
            (
                research_id,
                mission_id,
                claim,
                source_url,
                source_type,
                utc_now(),
                evidence_hash,
                status,
                str(artifact_path) if artifact_path else None,
            ),
        )
        self.store.event("research_recorded", {"research_id": research_id, "status": status}, mission_id)
        return research_id

    def for_mission(self, mission_id: str) -> list[dict[str, object]]:
        return self.store.rows(
            "SELECT * FROM research WHERE mission_id=? ORDER BY retrieved_at",
            (mission_id,),
        )
