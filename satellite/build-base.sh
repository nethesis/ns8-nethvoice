#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-or-later
set -euo pipefail
satellite_dir=$(cd -- "$(dirname -- "$0")" && pwd)
source_dir=$(mktemp -d)
trap 'rm -rf "$source_dir"' EXIT
bash "${satellite_dir}/fetch-source.sh" "${source_dir}/source"
buildah build --force-rm --layers --jobs "$(nproc)" \
    --file "${source_dir}/source/Containerfile" --tag "$1" "${source_dir}/source"
