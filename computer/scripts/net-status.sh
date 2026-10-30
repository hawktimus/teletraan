#!/bin/bash
# Usage: net-status.sh        (make net-status)
# How the Teletraan computer is doing with the network, read from the files the services keep and nothing else: each source of
# the sync service (when it last worked, when it last failed and why), and what netwatch has seen and done. It asks the
# network for nothing, so it works when the network is down. Needs jq.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

command -v jq > /dev/null 2>&1 || { echo "jq is not installed (sudo apt install jq)." >&2; exit 1; }

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}
sync_file="$data/sync-status.json"
netwatch_file=${NETWATCH_STATE:-/var/lib/teletraan/netwatch.json}
now_s=${NET_STATUS_NOW:-$(date +%s)}

# How long ago a time was, in words. GNU date reads the time, the BSD date on a Mac needs a format.
ago() {
  local text=$1 then
  [ -n "$text" ] && [ "$text" != null ] || { printf 'never'; return 0; }
  then=$(date -u -d "$text" +%s 2> /dev/null || date -u -j -f '%Y-%m-%dT%H:%M:%S' "${text%%.*}" +%s 2> /dev/null || echo 0)
  [ "$then" -gt 0 ] || { printf '%s' "$text"; return 0; }
  local seconds=$((now_s - then))
  if [ "$seconds" -lt 90 ]; then printf '%ss ago' "$seconds"
  elif [ "$seconds" -lt 5400 ]; then printf '%sm ago' $(((seconds + 30) / 60))
  else printf '%sh ago' $(((seconds + 1800) / 3600)); fi
}

echo "Sources of the sync service ($sync_file)"
if [ -f "$sync_file" ]; then
  echo "written $(ago "$(jq -r '.generatedAt // empty' "$sync_file")")"
  printf '%-12s %-12s %-12s %s\n' SOURCE 'LAST GOOD' 'LAST FAILED' 'WHY IT FAILED'
  for name in $(jq -r '.sources | keys_unsorted[]' "$sync_file"); do
    good=$(jq -r --arg n "$name" '.sources[$n].lastSuccessAt // empty' "$sync_file")
    bad=$(jq -r --arg n "$name" '.sources[$n].lastFailureAt // empty' "$sync_file")
    why=$(jq -r --arg n "$name" '.sources[$n].lastFailureReason // empty' "$sync_file")
    printf '%-12s %-12s %-12s %s\n' "$name" "$(ago "$good")" "$(ago "$bad")" "$why"
  done
else
  echo "no sync status yet. Is the sync service running? systemctl status teletraan-sync"
fi

echo
echo "Netwatch ($netwatch_file)"
if [ -s "$netwatch_file" ]; then
  echo "checked $(ago "$(jq -r '.lastCheckAt // empty' "$netwatch_file")"), failures in a row: $(jq -r '.failures' "$netwatch_file")"
  echo "last good check: $(ago "$(jq -r '.lastOkAt // empty' "$netwatch_file")")"
  echo "last action: $(jq -r '.lastAction' "$netwatch_file") ($(ago "$(jq -r '.lastActionAt // empty' "$netwatch_file")"))"
  echo "last reboot by netwatch: $(ago "$(jq -r '.lastRebootAt // empty' "$netwatch_file")")"
else
  echo "no netwatch record yet. Is the timer on? systemctl list-timers 'teletraan-netwatch*'"
fi

pending="$data/notify/pending"
echo
if [ -s "$pending" ]; then
  echo "Push messages waiting to be sent: $(wc -l < "$pending" | tr -d ' ')"
else
  echo "Push messages waiting to be sent: none"
fi
