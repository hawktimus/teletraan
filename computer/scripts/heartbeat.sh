#!/bin/bash
# Usage: heartbeat.sh        (started by teletraan-heartbeat.timer every 5 minutes, as the login user)
#        heartbeat.sh --test (make heartbeat-test: one ping, one push, and what happened to each)
# Tells an external uptime monitor that the Teletraan computer is alive. When the local dashboard answers, this sends an
# HTTPS GET to HEARTBEAT_URL (local.env). With no value it does nothing and says nothing. The monitor alerts when the pings
# stop, so a ping is only sent while the dashboard is really being served: a computer that is up but showing nothing is
# not "alive". The address goes to curl on standard input, so it never shows in the process list or in a log.
#
# It also raises the push messages for the two states of the screen, through notify.sh: went offline (the content from
# Sanity is older than 10 minutes, by sync-status.json) and came back. The message for "went offline" is kept and goes out
# when the network is back, with the time it started. The last state is in <data folder>/heartbeat/state.
# Nothing here ever fails the unit: a ping or a push that does not work is logged and tried again at the next run.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}
folder="$data/heartbeat"
state="$folder/state"
port=$(setting TELETRAAN_PORT)
port=${port:-8080}
url=$(setting HEARTBEAT_URL)
offline_after=${HEARTBEAT_OFFLINE_SECONDS:-600}

mkdir -p "$folder" 2> /dev/null || true

# 0 when the dashboard of this computer answers
dashboard_up() {
  curl --silent --fail --max-time 10 --output /dev/null "http://127.0.0.1:$port/dashboard/" 2> /dev/null
}

# 0 when the content has been read from Sanity in the last 10 minutes. No sync file at all is not offline: the sync service
# may not be installed on this computer.
content_fresh() {
  local file="$data/sync-status.json" last now_s then
  [ -f "$file" ] || return 0
  command -v jq > /dev/null 2>&1 || return 0
  last=$(jq -r '.sources.sanity.lastSuccessAt // empty' "$file" 2> /dev/null || true)
  [ -n "$last" ] || return 1
  now_s=${HEARTBEAT_NOW:-$(date +%s)}
  then=$(date -u -d "$last" +%s 2> /dev/null || date -u -j -f '%Y-%m-%dT%H:%M:%S' "${last%%.*}" +%s 2> /dev/null || echo 0)
  [ $((now_s - then)) -le "$offline_after" ]
}

ping_monitor() {
  local code=0
  case $url in ''|'['*) return 2 ;; esac
  printf 'url = "%s"\n' "$url" |
    curl --silent --fail --max-time 15 --connect-timeout 10 --proto '=https' --config - --output /dev/null 2> /dev/null || code=$?
  return "$code"
}

if [ "${1:-}" = --test ]; then
  code=0
  ping_monitor || code=$?
  case $code in
    0) echo "ping: sent." ;;
    2) echo "ping: HEARTBEAT_URL is empty in local.env, so nothing is sent." ;;
    *) echo "ping: not sent (curl exit $code)." ;;
  esac
  "$computer/scripts/notify.sh" --test || true
  exit 0
fi

if dashboard_up; then
  code=0
  ping_monitor || code=$?
  case $code in
    0) log_json heartbeat ping sent "ok" ;;
    2) ;;
    *) log_json heartbeat ping failed "curl exit $code" ;;
  esac
else
  log_json heartbeat ping skipped "the local dashboard did not answer"
fi

previous=$(sed -n 's/^state=//p' "$state" 2> /dev/null | tail -n 1 || true)
since=$(sed -n 's/^since=//p' "$state" 2> /dev/null | tail -n 1 || true)
if content_fresh; then
  current=online
else
  current=offline
fi

if [ "$current" != "${previous:-online}" ]; then
  if [ "$current" = offline ]; then
    log_json heartbeat state offline "the content is older than $((offline_after / 60)) minutes"
    "$computer/scripts/notify.sh" "went offline, the content is older than $((offline_after / 60)) minutes" || true
    since=$(date +%H:%M)
  else
    log_json heartbeat state online "the content is fresh again"
    "$computer/scripts/notify.sh" "came back online (offline since ${since:-unknown})" || true
    since=''
  fi
fi
printf 'state=%s\nsince=%s\n' "$current" "${since:-}" > "$state" 2> /dev/null || true

# status.json in the data folder, and the same facts in the status-mini document of Studio (status-write.sh sync)
"$computer/scripts/status-write.sh" sync > /dev/null 2>&1 || true
exit 0
