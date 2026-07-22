#!/usr/bin/env python3
"""Budgeted Gemini/Nano Banana image manifest worker for CANA."""

from __future__ import annotations

import base64
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import sqlite3
import uuid
from pathlib import Path
from typing import Any


ALLOWED_RATIOS = {"1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"}
ALLOWED_SIZES = {"0.5K", "1K", "2K", "4K"}
BLOCKED_PROMPT = re.compile(
    r"(?i)\b(for children|for kids|underage|cures? |treats? |guaranteed medical|fake review|fake license|fake lab result)\b"
)


def _utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def _local_day() -> str:
    return dt.datetime.now().astimezone().date().isoformat()


def _atomic_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    temporary.write_bytes(data)
    os.replace(temporary, path)


def _atomic_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    temporary.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(temporary, path)


def _inside(child: Path, parent: Path) -> bool:
    try:
        child.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def _validate(request: dict[str, Any], workspace: Path) -> tuple[Path | None, list[str]]:
    errors: list[str] = []
    required = {
        "id",
        "prompt",
        "aspect_ratio",
        "image_size",
        "target_relative_path",
        "rationale",
        "rights_confirmed",
        "safety_reviewed",
    }
    missing = sorted(required.difference(request))
    if missing:
        errors.append("missing fields: " + ", ".join(missing))
    if not request.get("rights_confirmed"):
        errors.append("rights_confirmed must be true")
    if not request.get("safety_reviewed"):
        errors.append("safety_reviewed must be true")
    prompt = str(request.get("prompt", "")).strip()
    if len(prompt) < 40:
        errors.append("prompt is too short to be reviewable")
    if BLOCKED_PROMPT.search(prompt):
        errors.append("prompt contains a blocked youth/medical/fabrication instruction")
    if request.get("aspect_ratio") not in ALLOWED_RATIOS:
        errors.append("unsupported aspect_ratio")
    if request.get("image_size") not in ALLOWED_SIZES:
        errors.append("unsupported image_size; use uppercase K")
    relative = Path(str(request.get("target_relative_path", "")))
    target = (workspace / relative).resolve()
    if relative.is_absolute() or not _inside(target, workspace):
        errors.append("target path escapes the workspace")
    if target.suffix.lower() not in {".png", ".jpg", ".jpeg"}:
        errors.append("target must be PNG or JPEG")
    return (target if not errors else None), errors


def _image_count(db: sqlite3.Connection) -> int:
    row = db.execute(
        "SELECT image_requests FROM usage_daily WHERE usage_day=?", (_local_day(),)
    ).fetchone()
    return int(row[0]) if row else 0


def _debit(db: sqlite3.Connection) -> None:
    now = _utc_now()
    db.execute(
        """
        INSERT INTO usage_daily(usage_day,model_requests,image_requests,updated_at)
        VALUES(?,0,1,?)
        ON CONFLICT(usage_day) DO UPDATE SET
          image_requests=image_requests+1,
          updated_at=excluded.updated_at
        """,
        (_local_day(), now),
    )
    db.commit()


def process_pending(
    workspace: Path,
    runtime: Path,
    config: dict[str, Any],
    db: sqlite3.Connection,
) -> dict[str, Any]:
    pending = runtime / "image-requests" / "pending"
    completed = runtime / "image-requests" / "completed"
    rejected = runtime / "image-requests" / "rejected"
    receipts = runtime / "image-requests" / "receipts"
    for directory in (pending, completed, rejected, receipts):
        directory.mkdir(parents=True, exist_ok=True)
    key_env = config.get("key_env", "GEMINI_API_KEY")
    if not os.environ.get(key_env):
        return {"processed": 0, "reason": f"missing {key_env}"}
    maximum = int(config.get("max_images_per_day", 0))
    remaining = max(0, maximum - _image_count(db))
    if remaining == 0:
        return {"processed": 0, "reason": "daily image cap reached"}

    try:
        from google import genai
    except ImportError as exc:
        raise RuntimeError("google-genai is not installed") from exc

    client = genai.Client(api_key=os.environ[key_env])
    processed = 0
    rejected_count = 0
    for request_path in sorted(pending.glob("*.json")):
        if processed >= remaining:
            break
        try:
            request = json.loads(request_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            _atomic_json(rejected / request_path.name, {"error": type(exc).__name__})
            request_path.unlink(missing_ok=True)
            rejected_count += 1
            continue
        target, errors = _validate(request, workspace)
        request_id = re.sub(r"[^A-Za-z0-9_.-]", "-", str(request.get("id", request_path.stem)))[:100]
        receipt_path = receipts / f"{request_id}.json"
        if receipt_path.exists():
            errors.append("duplicate request id")
        if errors or target is None:
            _atomic_json(rejected / request_path.name, {"request": request, "errors": errors})
            request_path.unlink(missing_ok=True)
            rejected_count += 1
            continue

        _debit(db)  # An attempted provider call consumes budget even if it fails.
        interaction = client.interactions.create(
            model=config["model"],
            input=request["prompt"],
            response_format={
                "type": "image",
                "mime_type": "image/png" if target.suffix.lower() == ".png" else "image/jpeg",
                "aspect_ratio": request["aspect_ratio"],
                "image_size": request["image_size"],
            },
        )
        encoded = interaction.output_image.data
        image_bytes = base64.b64decode(encoded) if isinstance(encoded, str) else bytes(encoded)
        _atomic_bytes(target, image_bytes)
        receipt = {
            "request_id": request_id,
            "generated_at": _utc_now(),
            "model": config["model"],
            "prompt_sha256": hashlib.sha256(request["prompt"].encode("utf-8")).hexdigest(),
            "output_sha256": hashlib.sha256(image_bytes).hexdigest(),
            "target_relative_path": str(target.relative_to(workspace)),
            "aspect_ratio": request["aspect_ratio"],
            "image_size": request["image_size"],
            "rights_confirmed": True,
            "safety_reviewed": True,
        }
        _atomic_json(receipt_path, receipt)
        shutil.move(str(request_path), str(completed / request_path.name))
        processed += 1
    return {"processed": processed, "rejected": rejected_count, "remaining_before_run": remaining}
