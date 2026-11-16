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

# The token for reading Sanity: SANITY_READ_TOKEN, else SANITY_WRITE_TOKEN, else nothing. A line that still starts with [
# is the placeholder and counts as nothing. Never printed by any script; it only goes to sanity_curl.
sanity_read_token() {
  local token
  token=$(setting SANITY_READ_TOKEN)
  case $token in '' | \[*) token=$(setting SANITY_WRITE_TOKEN) ;; esac
  case $token in \[*) token= ;; esac
  printf '%s' "$token"
}

# curl for a read from Sanity's API. With a token in local.env the request carries it, handed to curl on its standard
# input so that it is never on a command line or in a process list; with none it is plain curl, which works while the
# dataset is public. The arguments are curl's own.
sanity_curl() {
  local token lead=()
  token=$(sanity_read_token)
  # --disable only works as curl's first word, so it stays first
  if [ "${1:-}" = --disable ]; then
    lead=(--disable)
    shift
  fi
  if [ -n "$token" ]; then
    printf 'header = "Authorization: Bearer %s"\n' "$token" | curl ${lead[@]+"${lead[@]}"} --config - "$@"
  else
    curl ${lead[@]+"${lead[@]}"} "$@"
  fi
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
