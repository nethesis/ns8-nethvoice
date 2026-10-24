#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-or-later
set -euo pipefail
satellite_dir=$(cd -- "$(dirname -- "$0")" && pwd)
source "${satellite_dir}/upstream.env"
archive_dir=$(mktemp -d)
trap 'rm -rf "$archive_dir"' EXIT
curl --fail --silent --show-error --location --retry 3 \
    "https://github.com/nethesis/satellite/archive/${SATELLITE_SOURCE_COMMIT}.tar.gz" \
    --output "${archive_dir}/satellite.tar.gz"
printf '%s  %s\n' "$SATELLITE_SOURCE_SHA256" "${archive_dir}/satellite.tar.gz" | sha256sum --check
mkdir -p "$1"
tar -xzf "${archive_dir}/satellite.tar.gz" --strip-components=1 -C "$1"
