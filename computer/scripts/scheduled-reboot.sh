#!/bin/bash
# Usage: scheduled-reboot.sh   (started by teletraan-reboot.timer every 5 minutes)
# The scheduled reboot of the Teletraan computer. It reads the five reboot fields of Dashboard Settings and the time
# zone of the Look page from Sanity (public, no key), keeps the last good copy in the data folder for an outage, and asks
# reboot-plan.mjs what to do (docs/control-page.md, "Scheduled reboot"). A reboot goes the way the control page's helper
# does it: sudo systemctl reboot, which computer/sudoers/teletraan-control allows. It prints one plain line for the
# journal, and keeps what Studio and the control page show in <data folder>/reboot/status.json, which
# status-write.sh reboot sends to the document status-mini.
#
# Guards, so that a reboot loop cannot happen: a slot is acted on once (the state file is written before the reboot),
# never within 10 minutes of boot and never within 6 hours of the last reboot. A key is never read here except by
# status-write.sh, which does not print it.
#
# Needs curl, jq and node 18 or newer. The tests set REBOOT_NOW (seconds) and REBOOT_UPTIME (seconds).
set -euo pipefail
. "$(dirname "$0")/lib.sh"

say() {
  echo "scheduled reboot: $*"
}

for tool in curl jq node; do
  if ! command -v "$tool" > /dev/null 2>&1; then
    echo "The $tool command is missing, so the scheduled reboot cannot run. See docs/updating-the-computer.md." >&2
    exit 1
  fi
done

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}
folder="$data/reboot"
mkdir -p "$folder"
chmod 755 "$folder" 2> /dev/null || true

# A run that starts while the last one is still going stops at once
exec 9> "$folder/.lock"
if ! flock -n 9; then
  say "the last run is still going."
  exit 0
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

now=${REBOOT_NOW:-$(date +%s)}
uptime_seconds=${REBOOT_UPTIME:-$(cut -d. -f1 /proc/uptime 2> /dev/null || echo 0)}

# GNU date takes -d @seconds, the BSD date on a Mac takes -r seconds
iso_at() {
  date -u -d "@$1" '+%Y-%m-%dT%H:%M:%SZ' 2> /dev/null || date -u -r "$1" '+%Y-%m-%dT%H:%M:%SZ'
}

project=$(config_value projectId)
dataset=$(config_value dataset)
version=$(config_value apiVersion)
if ! printf '%s' "$project" | grep -Eq '^[a-z0-9]+$' ||
  ! printf '%s' "$dataset" | grep -Eq '^[A-Za-z0-9_-]+$' ||
  ! printf '%s' "$version" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'; then
  echo "Could not read the project ID, dataset and API version from dashboard/config.js." >&2
  exit 1
fi

# The setting, the zone and what could hold the screen: an alert, announcements that are up now and talks near now
early=$(iso_at $((now - 21600)))
late=$(iso_at $((now + 1800)))
at_now=$(iso_at "$now")
query="{\"setting\": *[_id == \"dashboardSettings\"][0]{rebootEnabled, rebootTime, rebootDays, rebootSkipBusy, rebootWaitMinutes, alert}, \"zone\": *[_id == \"theme\"][0].timeZone, \"announcements\": *[_type == \"announcement\" && dateTime(start) <= dateTime(\"$at_now\") && dateTime(end) > dateTime(\"$at_now\")]{start, end}, \"talks\": *[_type == \"presentation\" && status == \"scheduled\" && dateTime(start) > dateTime(\"$early\") && dateTime(start) < dateTime(\"$late\")]{start, minutes}}"

fetched=0
status=0
curl --disable --silent --get --max-time 20 --connect-timeout 10 --max-filesize 1000000 --proto '=https' \
  --data-urlencode "query=$query" --data-urlencode 'perspective=published' \
  --output "$work/sanity.json" "https://$project.api.sanity.io/v$version/data/query/$dataset" 2> /dev/null || status=$?
if [ "$status" -eq 0 ] && jq -e '.result | objects' "$work/sanity.json" > /dev/null 2>&1; then
  fetched=1
fi

cache="$folder/setting.json"
if [ "$fetched" -eq 1 ]; then
  # Only the setting and the zone are kept. What holds the screen is asked again each time.
  jq -c '{setting: (.result.setting // {} | del(.alert)), zone: .result.zone}' "$work/sanity.json" > "$work/cache.json"
  mv -f "$work/cache.json" "$cache"
  jq -c --argjson now "$((now * 1000))" --argjson up "$uptime_seconds" \
    '{setting: (.result.setting // {} | del(.alert)), zone: .result.zone, nowMs: $now, uptimeSeconds: $up,
      busyData: {alert: .result.setting.alert, announcements: .result.announcements, talks: .result.talks}}' \
    "$work/sanity.json" > "$work/input.json"
elif [ -s "$cache" ] && jq -e 'objects' "$cache" > /dev/null 2>&1; then
  say "Sanity could not be asked, so the last known setting is used."
  jq -c --argjson now "$((now * 1000))" --argjson up "$uptime_seconds" \
    '{setting: .setting, zone: .zone, nowMs: $now, uptimeSeconds: $up, busyData: null}' "$cache" > "$work/input.json"
else
  say "Sanity could not be asked and no setting is kept, so nothing is done."
  exit 0
fi

state="$folder/state.json"
[ -f "$state" ] || echo '{}' > "$state"
if ! node "$computer/scripts/reboot-plan.mjs" "$work/input.json" "$state" > "$work/plan.json"; then
  echo "scheduled reboot: reboot-plan.mjs failed, so nothing is done." >&2
  exit 1
fi

action=$(jq -r '.action' "$work/plan.json")
line=$(jq -r '.line' "$work/plan.json" | tr -c 'A-Za-z0-9 .,:()/-' '?')
say "$line"

# What Studio and the control page show: the next slot from the plan and the last reboot from the state file.
# status.json is sent only when it changed, so a quiet night is no writes.
write_status() {
  jq -c --slurpfile plan "$work/plan.json" \
    '{nextRebootAt: $plan[0].nextAt, nextRebootText: $plan[0].nextText,
      lastRebootAt: (if (.lastRebootAt // 0) > 0 then (.lastRebootAt / 1000 | todate) else "" end),
      lastRebootWhy: (.lastWhy // "")}' "$state" > "$work/status.json"
  if [ ! -f "$folder/status.json" ] || ! cmp -s "$work/status.json" "$folder/status.json"; then
    cp "$work/status.json" "$folder/status.json"
    chmod 644 "$folder/status.json" 2> /dev/null || true
    "$computer/scripts/status-write.sh" reboot > /dev/null 2>&1 || true
  fi
}

save_state() {
  jq -c '.state' "$work/plan.json" > "$work/state.json"
  cp "$state" "$work/state.before"
  mv -f "$work/state.json" "$state"
}

if [ "$action" != reboot ]; then
  save_state
  write_status
  exit 0
fi

# The state goes first, so a reboot that is asked for twice is still one reboot
save_state
write_status

systemctl_bin=${TELETRAAN_SYSTEMCTL:-/usr/bin/systemctl}
code=0
sudo -n "$systemctl_bin" reboot > /dev/null 2>&1 || code=$?
if [ "$code" -ne 0 ]; then
  # The slot stays handled, so a failure is not tried again every 5 minutes. The last reboot goes back to the one before.
  say "the reboot was refused (code $code). Check that computer/sudoers/teletraan-control is installed."
  jq -c -s '.[0] as $before | .[1] | .lastRebootAt = ($before.lastRebootAt // 0) | .lastWhy = ($before.lastWhy // "")' \
    "$work/state.before" "$state" > "$work/state.back"
  mv -f "$work/state.back" "$state"
  write_status
  exit 1
fi
