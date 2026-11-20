#!/bin/bash
# Usage: pre-meeting-refresh.sh   (started by teletraan-refresh.timer every 5 minutes)
# The refresh before the afternoon meeting, 13:30 Eastern on weekdays by default (Dashboard Settings, Computer). The picture
# is not disturbed unless something is wrong: it reads every source, runs the health check, and then
#   all green          reloads the page only
#   something amber    restarts what is wrong (the sync service, the screen) and checks again
#   still not healthy, or up more than 7 days   reboots, through the gate (computer/scripts/gate.sh, reason nightly, which is a
#                      scheduled reboot and not part of the recovery budget)
# It waits while a talk is booked within 30 minutes or a Band event of kind Meetings is on, and gives up 90 minutes after the
# time. The rules are in refresh-plan.mjs. What it decided, and why, is in <data folder>/refresh/last.json for the control page,
# and one line of the journal. It holds no key.
#
# Tests set REFRESH_NOW (milliseconds), REFRESH_UPTIME (seconds), REFRESH_WAIT (seconds to wait after a repair), TELETRAAN_SUDO,
# TELETRAAN_PYTHON and TELETRAAN_STATE_DIR.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

say() {
  echo "pre-meeting refresh: $*"
}

for tool in jq node; do
  command -v "$tool" > /dev/null 2>&1 || { echo "The $tool command is missing, so the refresh cannot run." >&2; exit 1; }
done

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}
state_dir=${TELETRAAN_STATE_DIR:-/var/lib/teletraan}
folder="$data/refresh"
mkdir -p "$folder"
chmod 755 "$folder" 2> /dev/null || true
sudo_bin=${TELETRAAN_SUDO:-sudo}
python_bin=${TELETRAAN_PYTHON:-python3}
systemctl_bin=${TELETRAAN_SYSTEMCTL:-/usr/bin/systemctl}
page_port=${MIRROR_PORT:-9222}
repair_wait=${REFRESH_WAIT:-60}

# A run that starts while the last one is still going stops at once
exec 9> "$folder/.lock"
flock -n 9 || { say "the last run is still going."; exit 0; }

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

now_ms=${REFRESH_NOW:-$(($(date +%s) * 1000))}
uptime_seconds=${REFRESH_UPTIME:-$(cut -d. -f1 /proc/uptime 2> /dev/null || echo 0)}
state_file="$folder/state.json"
last_file="$folder/last.json"
[ -s "$state_file" ] || echo '{}' > "$state_file"

# What the plan needs: the settings and the zone from the last good content, the talks and the meetings
node "$computer/scripts/refresh-context.mjs" "$data" "$now_ms" > "$work/context.json" 2> /dev/null || echo '{}' > "$work/context.json"
jq -n --argjson now "$now_ms" --slurpfile context "$work/context.json" --slurpfile state "$state_file" \
  '{now: $now, settings: ($context[0].settings // {}), zone: ($context[0].zone // ""), talks: ($context[0].talks // []), events: ($context[0].events // []), state: $state[0]}' > "$work/input.json"
node "$computer/scripts/refresh-plan.mjs" "$work/input.json" > "$work/start.json"

slot=$(jq -r '.slot' "$work/start.json")
reason=$(jq -r '.reason' "$work/start.json")
settings_time=$(jq -r '.settings.refreshTime // "13:30"' "$work/input.json")

# One line of what was decided, for Control and the Studio
record() {
  local decision=$1 clock
  clock=$(date -u -d "@$((now_ms / 1000))" '+%Y-%m-%dT%H:%M:%SZ' 2> /dev/null || date -u -r "$((now_ms / 1000))" '+%Y-%m-%dT%H:%M:%SZ')
  jq -n -c --arg time "$settings_time" --arg decision "$decision" --arg at "$clock" --arg slot "$slot" \
    '{time: $time, decision: $decision, at: $at, slot: $slot}' > "$last_file.new"
  chmod 644 "$last_file.new"
  mv -f "$last_file.new" "$last_file"
  log_json refresh computer decision "$decision"
  say "$decision"
}

if [ "$(jq -r '.start' "$work/start.json")" != true ]; then
  if [ "$(jq -r '.wait' "$work/start.json")" = true ]; then
    # Said once for each wait reason, so the log does not get a line every 5 minutes
    if [ "$(jq -r '.lastWait // ""' "$state_file")" != "$reason" ]; then
      jq -c --arg why "$reason" '.lastWait = $why' "$state_file" > "$work/state.json" && mv -f "$work/state.json" "$state_file"
      record "$reason"
    fi
  elif printf '%s' "$reason" | grep -q 'time has passed' && [ "$(jq -r '.lastWait // ""' "$state_file")" != "" ] && [ "$(jq -r '.skipped // ""' "$state_file")" != "$slot" ]; then
    # It waited for a talk or a meeting for 90 minutes and never got its turn
    waited=$(jq -r '.lastWait // "a talk or a meeting"' "$state_file" | sed 's/^Waiting: //')
    jq -c --arg slot "$slot" '.skipped = $slot | .lastSlot = $slot | .lastWait = ""' "$state_file" > "$work/state.json" && mv -f "$work/state.json" "$state_file"
    record "skipped: $waited"
  fi
  exit 0
fi

# Starting. The slot is written first, so a run that is cut short is not started a second time.
jq -c --arg slot "$slot" '.lastSlot = $slot | .lastWait = ""' "$state_file" > "$work/state.json" && mv -f "$work/state.json" "$state_file"

# 1. Read every source again. A source that is not on this computer, or that fails, is left to the health check.
for unit in calendars monday frc news photos-drive match13; do
  "$sudo_bin" -n "$systemctl_bin" start "teletraan-$unit.service" > /dev/null 2>&1 || true
done

failing_names() {
  "$computer/scripts/health.sh" > /dev/null 2>&1 || true
  jq -r '(.checks // {}) | to_entries | map(select(.value.ok == false) | .key) | @json' "$state_dir/health.json" 2> /dev/null || echo '[]'
}

plan_after() {
  jq -n -c --argjson failing "$1" --argjson uptime "$uptime_seconds" --argjson after "$2" '{kind: "repair", failing: $failing, uptimeSeconds: $uptime, afterRepair: $after}' > "$work/repair-input.json"
  node "$computer/scripts/refresh-plan.mjs" "$work/repair-input.json"
}

reboot_now() {
  local why=$1
  if ! gate_why=$("$computer/scripts/gate.sh" allow nightly 2>&1); then
    record "wanted a reboot ($why) but the gate said no: $gate_why"
    exit 0
  fi
  record "rebooting: $why"
  "$sudo_bin" -n "$systemctl_bin" reboot || record "the reboot was refused. Check that computer/sudoers/teletraan-control is installed."
  exit 0
}

failing=$(failing_names)
decision=$(plan_after "$failing" false)
action=$(printf '%s' "$decision" | jq -r '.action')
why=$(printf '%s' "$decision" | jq -r '.reason')

case $action in
  reload)
    MIRROR_PORT="$page_port" "$python_bin" "$computer/scripts/page-command.py" reload > /dev/null 2>&1 || true
    record "reloaded page only, all green"
    ;;
  reboot)
    reboot_now "$why"
    ;;
  repair)
    restarted=$(printf '%s' "$decision" | jq -r '.services | join(" and ")')
    for service in $(printf '%s' "$decision" | jq -r '.services[]'); do
      case $service in
        screen) "$sudo_bin" -n "$systemctl_bin" restart teletraan-kiosk.service > /dev/null 2>&1 || true ;;
        sync) "$sudo_bin" -n "$systemctl_bin" restart teletraan-sync.service > /dev/null 2>&1 || true ;;
      esac
    done
    sleep "$repair_wait"
    failing=$(failing_names)
    decision=$(plan_after "$failing" true)
    if [ "$(printf '%s' "$decision" | jq -r '.action')" = reboot ]; then
      reboot_now "$(printf '%s' "$decision" | jq -r '.reason')"
    fi
    record "restarted the $restarted service, and it is green now"
    ;;
esac
