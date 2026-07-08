import json
import logging
import os
import sys
from typing import Any, Dict

import ai
import db

logger = logging.getLogger("call_processor")


def _read_stdin_json() -> Dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        raise ValueError("Expected JSON on stdin")
    return json.loads(raw)


def main() -> int:
    log_level_str = os.getenv("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_str, logging.INFO)
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s",
    )

    try:
        payload = _read_stdin_json()
        transcript_id = int(payload["transcript_id"])
        raw_transcription = str(payload["raw_transcription"])
        summary = bool(payload.get("summary", False))

        logger.info(
            "Processing transcript_id=%s raw_len=%d summary=%s",
            transcript_id,
            len(raw_transcription or ""),
            summary,
        )

        if db.is_configured():
            db.replace_transcript_embeddings(
                transcript_id=transcript_id,
                raw_transcription=raw_transcription,
            )

            if not summary:
                logger.info("Skipping AI summary/sentiment (summary=false)")
                sys.stdout.write(json.dumps({"ok": True, "sentiment": None}))
                return 0

            logger.info("Starting AI enrichment")
            cleaned, summary, sentiment = ai.generate_clean_summary_sentiment(raw_transcription)
            logger.info(
                "AI enrichment done (cleaned_len=%d summary_len=%d sentiment=%s)",
                len(cleaned or ""),
                len(summary or ""),
                sentiment,
            )

            db.update_transcript_ai_fields(
                transcript_id=transcript_id,
                cleaned_transcription=cleaned,
                summary=summary,
                sentiment=sentiment,
            )
            sys.stdout.write(json.dumps({"ok": True, "sentiment": sentiment}))
        return 0
    except Exception:
        logger.exception("Call processing failed")
        sys.stdout.write(json.dumps({"ok": False}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
