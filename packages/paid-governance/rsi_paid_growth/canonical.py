"""Deterministic JSON subset for local scaffold verification.

This is not a complete RFC 8785 implementation. Production must use a vetted,
standards-conformant canonicalization library.
"""
from __future__ import annotations
import hashlib
import json
from dataclasses import asdict, is_dataclass
from enum import Enum
from decimal import Decimal
from typing import Any


def _default(value: Any):
    if is_dataclass(value):
        return asdict(value)
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, Decimal):
        return format(value, "f")
    raise TypeError(f"Unsupported type: {type(value)!r}")


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        default=_default,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    ).encode("utf-8")


def sha256_hex(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()
