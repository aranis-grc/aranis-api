"""
Verifying an Aranis webhook signature in Python (Flask).

    pip install flask
    ARANIS_WEBHOOK_SECRET=whsec_... python verify_webhook.py

No Aranis dependency — the scheme is HMAC-SHA256 over "{timestamp}.{raw_body}", the
same shape Stripe uses, so this is ~30 lines of stdlib.
"""

import hashlib
import hmac
import json
import os
import time

from flask import Flask, request

app = Flask(__name__)

SECRET = os.environ["ARANIS_WEBHOOK_SECRET"].encode()
TOLERANCE_SECONDS = 300


class VerificationError(Exception):
    """Raised for anything that means 'do not process this delivery'."""


def verify(raw_body: bytes, signature_header: str | None, now: int | None = None) -> dict:
    """Verifies a delivery and returns the parsed event.

    `raw_body` must be the exact bytes received. Re-serializing parsed JSON changes key
    order and whitespace, and the signature will not match.
    """
    if not signature_header:
        raise VerificationError("missing Aranis-Signature header")

    timestamp: int | None = None
    signatures: list[str] = []
    for part in signature_header.split(","):
        key, _, value = part.partition("=")
        if key.strip() == "t":
            try:
                timestamp = int(value)
            except ValueError:
                pass
        elif key.strip() == "v1":
            signatures.append(value.strip())

    if timestamp is None or not signatures:
        raise VerificationError("malformed Aranis-Signature header")

    # Checked before the HMAC so a replayed body never reaches the comparison. The
    # timestamp is inside the signed payload, so it cannot be moved forward without
    # invalidating the signature.
    current = now if now is not None else int(time.time())
    if abs(current - timestamp) > TOLERANCE_SECONDS:
        raise VerificationError("timestamp outside tolerance — treating as a replay")

    expected = hmac.new(
        SECRET, f"{timestamp}.".encode() + raw_body, hashlib.sha256
    ).hexdigest()

    # compare_digest, never ==: a plain comparison leaks the position of the first
    # differing byte through timing.
    if not any(hmac.compare_digest(candidate, expected) for candidate in signatures):
        raise VerificationError("signature does not match")

    return json.loads(raw_body)


@app.post("/webhooks/aranis")
def receive():
    try:
        event = verify(request.get_data(), request.headers.get("Aranis-Signature"))
    except VerificationError as err:
        # 400, not 500 — a bad signature is not something a retry can fix, and a 5xx
        # would make Aranis retry it five times.
        app.logger.warning("rejected delivery: %s", err)
        return "invalid signature", 400

    # Delivery is at-least-once: deduplicate on event_id before doing any real work.
    app.logger.info("received %s (%s)", event["type"], event["event_id"])

    # Acknowledge quickly — the delivery times out after 5 seconds, and a timeout counts
    # as a failure. Queue the real work instead of doing it inline.
    return "ok", 200


if __name__ == "__main__":
    app.run(port=3000)
