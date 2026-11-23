"""Verification of the Standard Webhooks envelope used by both SIP providers."""

import base64
import hashlib
import hmac
import json
import time
from collections.abc import Mapping

MAX_BODY_BYTES = 256 * 1024
MAX_AGE_SECONDS = 300


def verify_webhook(secret: str, raw_body: bytes, headers: Mapping[str, str]) -> dict:
    """Return authenticated JSON, or raise ValueError without leaking the secret."""
    if not isinstance(raw_body, bytes) or len(raw_body) > MAX_BODY_BYTES:
        raise ValueError("invalid webhook body")
    if not isinstance(secret, str) or not secret.startswith("whsec_"):
        raise ValueError("invalid webhook secret")
    try:
        key = base64.b64decode(secret[6:], validate=True)
        if not key:
            raise ValueError
        lower = {str(k).lower(): str(v) for k, v in headers.items()}
        webhook_id = lower["webhook-id"]
        timestamp_text = lower["webhook-timestamp"]
        signature_header = lower["webhook-signature"]
        if not webhook_id or len(webhook_id) > 256 or not timestamp_text.isascii():
            raise ValueError
        timestamp = int(timestamp_text)
        if abs(int(time.time()) - timestamp) > MAX_AGE_SECONDS:
            raise ValueError
        signed = webhook_id.encode() + b"." + timestamp_text.encode() + b"." + raw_body
        expected = hmac.new(key, signed, hashlib.sha256).digest()
        candidates = signature_header.split(" ")
        verified = False
        for candidate in candidates:
            version, separator, encoded = candidate.partition(",")
            if version != "v1" or not separator:
                continue
            try:
                provided = base64.b64decode(encoded, validate=True)
            except (ValueError, base64.binascii.Error):
                continue
            verified |= hmac.compare_digest(expected, provided)
        if not verified:
            raise ValueError
        event = json.loads(raw_body)
        if not isinstance(event, dict):
            raise ValueError
        return event
    except (KeyError, TypeError, UnicodeError, ValueError, base64.binascii.Error, json.JSONDecodeError) as exc:
        raise ValueError("invalid webhook") from exc
