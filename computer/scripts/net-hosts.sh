#!/bin/bash
# Usage: net-hosts.sh allowlist     the hostnames the Teletraan computer contacts, for the school IT office (make allowlist)
#        net-hosts.sh test          the diagnostic once for every source, as a table (make net-test)
# The list itself is built by hosts.mjs from the files that hold each address. This script adds the hosts that only local.env
# knows, and it reads them by name: the calendar feeds (CALENDAR_<ID>_URL), HEARTBEAT_URL, NOTIFY_URL and NETWATCH_HOST. Of each
# address only the hostname is kept, here, before anything is passed on or printed: never the path, the query or a token.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

mode=${1:-}
case $mode in
  allowlist | test) ;;
  *) echo "Usage: net-hosts.sh allowlist|test" >&2; exit 2 ;;
esac
command -v node > /dev/null 2>&1 || { echo "node is not installed (sudo apt install nodejs)." >&2; exit 1; }
command -v jq > /dev/null 2>&1 || { echo "jq is not installed (sudo apt install jq)." >&2; exit 1; }

# The hostname of an address, or nothing. Quotes, webcal://, https://, a user name, a port, a path and a query are cut away.
host_of() {
  local value=$1
  case $value in ''|'['*) return 0 ;; esac
  value=${value#webcal://}
  value=${value#https://}
  value=${value#http://}
  value=${value%%/*}
  value=${value%%\?*}
  value=${value##*@}
  value=${value%%:*}
  if printf '%s' "$value" | grep -Eq '^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$'; then
    printf '%s' "$value" | tr 'A-Z' 'a-z'
  fi
}

extras='[]'
add() {
  [ -n "$3" ] || return 0
  extras=$(printf '%s' "$extras" | jq -c --arg name "$1" --arg purpose "$2" --arg host "$3" '. + [{name: $name, purpose: $purpose, host: $host}]')
}

if [ -f "$env_file" ]; then
  # The names only: the part of each line before the =
  for name in $(sed -n 's/^\(CALENDAR_[A-Za-z0-9_]*_URL\)=.*/\1/p' "$env_file"); do
    id=$(printf '%s' "${name#CALENDAR_}" | sed 's/_URL$//' | tr 'A-Z' 'a-z')
    add calendars "the BAND calendar feed of the $id calendar" "$(host_of "$(setting "$name")")"
  done
fi
add heartbeat 'the uptime monitor that is pinged every 5 minutes (HEARTBEAT_URL)' "$(host_of "$(setting HEARTBEAT_URL)")"
add push 'the push messages when the state changes (NOTIFY_URL)' "$(host_of "$(setting NOTIFY_URL)")"
add netwatch 'the network check of netwatch (NETWATCH_HOST)' "$(host_of "$(setting NETWATCH_HOST)")"

exec node "$computer/scripts/hosts.mjs" "$mode" --extras "$extras"
