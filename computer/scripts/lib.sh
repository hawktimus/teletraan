# Shared by the scripts of this folder. Each one reads it with
#   . "$(dirname "$0")/lib.sh"
# right after "set -euo pipefail". It is read, never run.
#
# computer is the computer/ folder, repo the repository above it, config the dashboard
# settings file and env_file the keys file.
computer=$(cd "$(dirname "$0")/.." && pwd)
repo=$(dirname "$computer")
config="$repo/dashboard/config.js"
env_file="$computer/local.env"

# The value of a NAME=value line in local.env, without its quotes. Only the
# name asked for is read, because the other lines hold secrets. The last line
# wins when a name is repeated.
setting() {
  [ -f "$env_file" ] || return 0
  sed -n "s/^$1=//p" "$env_file" | tail -n 1 | sed "s/^['\"]//; s/['\"]\$//"
}

# One JSON line in /var/log/teletraan/<service>.jsonl, the same line jsonlog.mjs writes: ts, service, source, event,
# detail. TELETRAAN_LOG_DIR moves the folder for tests. A log that cannot be written never stops the script.
# Usage: log_json service source event detail
log_json() {
  local folder=${TELETRAAN_LOG_DIR:-/var/log/teletraan} line
  # The detail is cleaned and cut so that a stray quote or a new line cannot break the line
  line=$(printf '{"ts":"%s","service":"%s","source":"%s","event":"%s","detail":"%s"}' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" "$3" "$(printf '%s' "${4:-}" | tr -d '\000-\037"\\' | cut -c 1-300)")
  { mkdir -p "$folder" && printf '%s\n' "$line" >> "$folder/$1.jsonl"; } 2> /dev/null || true
}

# The quoted value of "name: 'value'," in dashboard/config.js. The project ID,
# the dataset and the API version are kept there and nowhere else.
config_value() {
  [ -f "$config" ] || return 0
  sed -n "s/^[[:space:]]*$1:[[:space:]]*'\([^']*\)'.*/\1/p" "$config" | head -n 1
}
