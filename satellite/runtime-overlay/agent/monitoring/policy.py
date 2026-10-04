"""Shared monitoring policy validation; missing policy means metadata only."""

DEFAULT_POLICY = {"metadata_retention_days": 30, "transcript_retention_days": 7,
                  "transcripts": {"internal": False, "external": False},
                  "capture_versions": {"internal": 1, "external": 1}}


def validate_policy(value=None):
    value = DEFAULT_POLICY if value is None else value
    if not isinstance(value, dict) or set(value) != set(DEFAULT_POLICY):
        raise ValueError("invalid monitoring policy")
    result = dict(value)
    for key in ("metadata_retention_days", "transcript_retention_days"):
        if type(result[key]) is not int or not 1 <= result[key] <= 365:
            raise ValueError("invalid retention")
    if result["transcript_retention_days"] > result["metadata_retention_days"]:
        raise ValueError("transcript retention exceeds metadata retention")
    for key in ("transcripts", "capture_versions"):
        if not isinstance(result[key], dict) or set(result[key]) != {"internal", "external"}:
            raise ValueError("invalid capture policy")
        result[key] = dict(result[key])
    if any(type(v) is not bool for v in result["transcripts"].values()):
        raise ValueError("invalid transcript setting")
    if any(type(v) is not int or not 1 <= v <= 2**53-1 for v in result["capture_versions"].values()):
        raise ValueError("invalid capture version")
    return result
