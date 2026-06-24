#!/usr/bin/env bash

lt_log() {
  local level="$1"
  shift
  printf '[%s] %s\n' "${level}" "$*"
}

lt_info() {
  lt_log INFO "$@"
}

lt_warn() {
  lt_log WARN "$@" >&2
}

lt_error() {
  lt_log ERROR "$@" >&2
}

lt_section() {
  printf '\n== %s ==\n' "$*"
}

lt_die() {
  lt_error "$*"
  exit 1
}