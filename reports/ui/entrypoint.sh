#!/usr/bin/env sh

set -e

# if command is provided, execute it
if [ "$1" = "nginx" ]; then
  wait-for -t 30 "${APP_HOST?:APP_HOST missing}:${APP_PORT?:APP_PORT missing}"
fi
