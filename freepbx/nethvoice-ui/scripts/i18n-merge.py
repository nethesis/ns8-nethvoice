#!/usr/bin/env python3
import fcntl
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "src" / "i18n"


def merge(target, source):
    for key, value in source.items():
        if isinstance(value, dict):
            merge(target.setdefault(key, {}), value)
        else:
            target[key] = value


def main():
    payload = json.load(sys.stdin)
    lock = open(ROOT.parent.parent / 'node_modules' / '.i18n-merge.lock', 'w')
    fcntl.flock(lock, fcntl.LOCK_EX)
    for locale in ("en", "it"):
        path = ROOT / locale / "translation.json"
        current = json.loads(path.read_text()) if path.exists() else {}
        merge(current, payload[locale])
        path.write_text(json.dumps(current, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
