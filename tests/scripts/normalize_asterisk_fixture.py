#!/usr/bin/env python3

# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later

import argparse
import json
import sys
from pathlib import Path


def normalize_text(content):
    lines = content.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    stripped_lines = [line.rstrip() for line in lines]
    normalized = "\n".join(stripped_lines).strip("\n")
    if normalized:
        return normalized + "\n"
    return ""


def main():
    parser = argparse.ArgumentParser(description="Normalize captured fixture files")
    parser.add_argument("--input-dir", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    written_files = []
    for source_path in sorted(path for path in input_dir.rglob("*") if path.is_file()):
        if source_path.name == "capture-report.json":
            continue
        relative_path = source_path.relative_to(input_dir)
        target_path = output_dir / relative_path
        target_path.parent.mkdir(parents=True, exist_ok=True)
        normalized_content = normalize_text(source_path.read_text(encoding="utf-8"))
        target_path.write_text(normalized_content, encoding="utf-8")
        written_files.append(str(relative_path))

    print(json.dumps({"files": written_files}, indent=2, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)