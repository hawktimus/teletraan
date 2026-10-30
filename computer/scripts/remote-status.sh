#!/bin/bash
# Usage: remote-status.sh   (make remote-status)
# Prints the last remote action that the Teletraan computer handled, from the public document remoteControl in
# Sanity, and the last lines of the poller's log. No key is needed: the dataset is public, and only the
# fields the Studio shows are asked for.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

project=$(config_value projectId)
dataset=$(config_value dataset)
version=$(config_value apiVersion)
log_file="${TELETRAAN_LOG_DIR:-/var/log/teletraan}/remote.jsonl"

query='*[_id == "remoteControl"][0]{action, requestedBy, requestedAt, lastHandledAt, lastResult}'
echo "Last remote request (Sanity):"
if answer=$(curl -fsS --max-time 15 --get --data-urlencode "query=$query" "https://$project.api.sanity.io/v$version/data/query/$dataset" 2> /dev/null); then
  printf '%s' "$answer" | jq -r '.result // {} | "  action:       \(.action // "none")\n  requested by: \(.requestedBy // "-")\n  requested at: \(.requestedAt // "-")\n  handled at:   \(.lastHandledAt // "-")\n  result:       \(.lastResult // "-")"'
else
  echo "  Sanity could not be reached."
fi

echo
echo "Poller log (last 15 lines of $log_file):"
if [ -f "$log_file" ]; then
  tail -n 15 "$log_file"
else
  echo "  No log yet. Is teletraan-remote.service running? systemctl status teletraan-remote"
fi
