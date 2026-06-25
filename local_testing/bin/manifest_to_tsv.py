#!/usr/bin/env python3

import json
import sys


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: manifest_to_tsv.py <manifest.json>", file=sys.stderr)
        return 1

    with open(sys.argv[1], "r", encoding="utf-8") as handle:
        manifest = json.load(handle)

    operations = manifest.get("operations", [])
    for operation in operations:
        if operation.get("enabled", True) is False:
            continue
        payload = operation.get("payload")
        payload_text = "" if payload is None else json.dumps(payload, separators=(",", ":"))
        expected = ",".join(str(code) for code in operation.get("expected_status", [200]))
        row = [
            operation.get("name", ""),
            operation["method"],
            operation["path"],
            payload_text,
            expected,
        ]
        print("\t".join(row))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())