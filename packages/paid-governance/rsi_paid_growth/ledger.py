from __future__ import annotations
from dataclasses import asdict
from .canonical import sha256_hex
from .contracts import Receipt

ZERO = "0" * 64


def make_receipt(*, receipt_id: str, receipt_type: str, tenant_id: str, occurred_at: str,
                 recorded_at: str, actor_id: str, subject_sha256: str, decision: str,
                 previous_record_sha256: str) -> Receipt:
    payload = {
        "schema_version": "1.0",
        "receipt_id": receipt_id,
        "receipt_type": receipt_type,
        "tenant_id": tenant_id,
        "occurred_at": occurred_at,
        "recorded_at": recorded_at,
        "actor_id": actor_id,
        "subject_sha256": subject_sha256,
        "decision": decision,
        "previous_record_sha256": previous_record_sha256,
    }
    return Receipt(payload_sha256=sha256_hex(payload), **payload)


def record_hash(receipt: Receipt) -> str:
    return sha256_hex(asdict(receipt))


def verify_chain(receipts: list[Receipt]) -> tuple[bool, str]:
    previous = ZERO
    seen = set()
    for index, receipt in enumerate(receipts):
        if receipt.receipt_id in seen:
            return False, f"duplicate receipt id at {index}"
        seen.add(receipt.receipt_id)
        if receipt.previous_record_sha256 != previous:
            return False, f"chain mismatch at {index}"
        payload = asdict(receipt)
        claimed = payload.pop("payload_sha256")
        if sha256_hex(payload) != claimed:
            return False, f"payload hash mismatch at {index}"
        previous = record_hash(receipt)
    return True, previous
