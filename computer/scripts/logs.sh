#!/bin/bash
# Usage: logs.sh [service] [lines]      (make logs, make logs SERVICE=sync LINES=100)
# The newest lines of the logs in /var/log/teletraan, one JSON line for each event, written plainly:
# time, service, source, event, detail. With no service every log is shown, each under its name. Needs jq; without it
# the raw lines are shown.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

folder=${TELETRAAN_LOG_DIR:-/var/log/teletraan}
service=${1:-}
lines=${2:-20}

case $lines in ''|*[!0-9]*) echo "The number of lines must be a number." >&2; exit 2 ;; esac
case $service in '' | *[!a-z0-9-]*) [ -z "$service" ] || { echo "The service is a name such as sync, netwatch, heartbeat or notify." >&2; exit 2; } ;; esac

if [ ! -d "$folder" ]; then
  echo "There is no log folder yet ($folder). The sync service and netwatch make it when they run (docs/OPERATIONS.md)."
  exit 0
fi

show() {
  local file=$1
  [ -s "$file" ] || return 0
  echo "== $(basename "$file" .jsonl)"
  if command -v jq > /dev/null 2>&1; then
    tail -n "$lines" "$file" | jq -r '[.ts, .source, .event, .detail] | join("  ")' 2> /dev/null || tail -n "$lines" "$file"
  else
    tail -n "$lines" "$file"
  fi
}

if [ -n "$service" ]; then
  show "$folder/$service.jsonl"
  [ -s "$folder/$service.jsonl" ] || echo "No log for $service yet."
else
  found=no
  for file in "$folder"/*.jsonl; do
    [ -e "$file" ] || continue
    found=yes
    show "$file"
  done
  [ "$found" = yes ] || echo "No log has been written yet."
fi
