#!/usr/bin/env sh

set -e

# if command is provided, execute it
if [ "$1" == 'nginx' ]; then
  # check if UI_HOST and UI_PORT are set
  if [ -z "${APP_HOST}" ] || [ -z "${APP_PORT}" ]; then
    echo "APP_HOST and APP_PORT must be set"
    exit 1
  fi
  wait-for "${APP_HOST}:${APP_PORT}" -t 30 -- echo "App is up"
fi