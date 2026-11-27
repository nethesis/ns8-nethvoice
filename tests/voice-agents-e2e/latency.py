"""Score the configured Italian welcome on the silent SIP caller's clock."""
import math
from statistics import median

from scenarios import require


def score_greeting(words, origin_ms):
    tokens = [word.casefold() for word, _ in words]
    salutations = {"benvenuto", "benvenuta", "benvenuti", "benvenute", "buongiorno", "buonasera", "ciao", "salve"}
    openings = []
    for marker, word in enumerate(tokens):
        if word not in ("corallo", "corello") or marker == 0 or tokens[marker - 1] != "laboratorio":
            continue
        # Allow a direct address or one linking preposition. Unrelated speech
        # before the actual welcome must not bring its onset forward.
        first = marker - 2
        if first >= 0 and tokens[first] in ("al", "dal", "del", "nel", "il"):
            first -= 1
        if first < 0 or tokens[first] not in salutations:
            first = None
        if first is None and marker + 1 < len(tokens) and tokens[marker + 1] in salutations:
            first = marker - 1
            end = marker + 1
        else:
            end = marker
        if first is not None and any(words[i+1][1] - words[i][1] > 1.2 for i in range(first, end)):
            first = None
        if first is not None:
            openings.append(first)
    result = {"greetings": len(openings)}
    if len(openings) == 1:
        result["onset_ms"] = max(0, round(origin_ms + 1000 * words[openings[0]][1]))
    return result


def measure_greeting(case, row):
    route = case.configure(callbacks=False)
    phone = case.history.latency_phone(case.case)
    case.baseline = {r["run_id"] for r in case.lab.activity(case.transport)}
    case.dial_attempted = True
    phone.dial(route)
    try:
        origin, wav = phone.greeting_capture()
    finally:
        phone.hangup()
        activity = case.terminal_activity()
        row.update(run_id=activity["run_id"], outcome=activity["outcome"],
                   error_code=activity.get("error_code"), first_output_ms=activity.get("first_output_ms"))
    events = case.lab.trace(row["run_id"], case.transport)["events"]
    row["phases"] = [{k: event[k] for k in ("event_type", "phase", "elapsed_ms", "duration_ms") if k in event}
                     for event in events if event.get("event_type") == "provider_output" or event.get("phase") in
                     ("media_prepare", "provider_start", "provider_output", "provider_audio", "greeting", "pbx_audio")]
    words = case.speech.greeting_words(wav)
    row.update(score_greeting(words, origin))
    if row["greetings"] != 1:
        row["heard"] = " ".join(word for word, _ in words)[:160]
    require(activity["adapter"] == "live_ws", "Expected primary Live WebSocket adapter")
    require(activity["outcome"] == "completed", f"Expected completed call, observed {activity['outcome']}")
    require(row["greetings"] == 1, f"Expected one configured greeting, observed {row['greetings']}")


def latency_summary(rows):
    onsets = sorted(row["onset_ms"] for row in rows if row.get("greetings") == 1 and "onset_ms" in row)
    within = sum(ms <= 3000 for ms in onsets)
    fallback = sum(row.get("outcome") == "fallback" or any(run.get("outcome") == "fallback" for run in row.get("observed", {}).get("runs", []))
                   for row in rows)
    # An unobserved welcome has infinite latency in the percentile denominator.
    rank = math.ceil(.95 * len(rows))
    return {"attempts": len(rows), "heard_once": len(onsets), "within_3000_ms": within,
            "missing_or_unverified": sum(row.get("greetings", 0) == 0 for row in rows),
            "duplicated": sum(row.get("greetings", 0) > 1 for row in rows), "known_fallbacks": fallback,
            "median_heard_ms": median(onsets) if onsets else None,
            "p95_ms": onsets[rank-1] if 0 < rank <= len(onsets) else None,
            "worst_ms": max(onsets) if onsets and len(onsets) == len(rows) else None,
            "passed": bool(rows) and all(row["status"] == "passed" for row in rows)
                      and len(onsets) == len(rows) and within >= rank}
