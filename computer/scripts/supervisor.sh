#!/bin/bash
# Usage: supervisor.sh [--once]   (started by teletraan-supervisor.timer every minute)
# Reads the health file, asks computer/scripts/supervisor-plan.mjs what to do about each problem, and does it. It is the
# only thing on this computer that escalates: the watchdog, the network watchdog, the remote poller and the scheduled
# reboot keep their own detection but ask the gate (computer/scripts/gate.sh) before they reboot, so one budget covers
# every reason and a reboot loop cannot happen.
#
# The ladder, by how long one problem has been failing (supervisor-plan.mjs has the table):
#   1 min   load the page again             nothing goes black, nobody in the room notices
#   5 min   run or restart that service     the screen keeps playing
#   10 min  restart the screen session      a few seconds of black
#   20 min  repair the network              network problems only, and netwatch does the work
#   30 min  reboot                          one to two minutes dark, and only if the gate allows it
#
# Before anything that darkens the screen, and before every reboot, a diagnostic report is written into
# /var/lib/teletraan/incidents so there is a record of what it looked like at the time (computer/scripts/diag.sh). The
# capture is given ten seconds and never stops the repair.
#
# While it is watching only, it writes what it would have done and does nothing. That is how it starts: the Mode field
# on the Computer tab of Dashboard Settings has to say Fix before it acts. TELETRAAN_SUPERVISOR_DRY_RUN=1 also forces
# watching, whatever the setting says.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}
state_dir=${TELETRAAN_STATE_DIR:-/var/lib/teletraan}
health_file="$state_dir/health.json"
out_file="$state_dir/supervisor.json"
plan_file="$state_dir/.supervisor-plan.json"
systemctl_bin=${TELETRAAN_SYSTEMCTL:-/usr/bin/systemctl}
node_bin=${TELETRAAN_NODE:-node}
python_bin=${TELETRAAN_PYTHON:-python3}
page_port=${MIRROR_PORT:-9222}

say() {
  echo "supervisor: $*"
}

mkdir -p "$state_dir" 2> /dev/null || true
exec 9> "$state_dir/.supervisor.lock"
if ! flock -n 9; then
  exit 0
fi

if [ ! -s "$health_file" ]; then
  say "there is no health file yet, so there is nothing to act on."
  exit 0
fi
if ! command -v "$node_bin" > /dev/null 2>&1; then
  say "node is not installed, so nothing can be decided." >&2
  exit 1
fi

now_ms=$(($(date +%s) * 1000))
uptime=$(cut -d' ' -f1 /proc/uptime 2> /dev/null | cut -d. -f1 || echo 0)
case $uptime in ''|*[!0-9]*) uptime=0 ;; esac

# ----- watching, or fixing -----

# Fix only when the setting says so. The setting travels in the content the sync service writes, like every other
# setting, so it can be changed from the Studio without anyone logging in to this computer.
mode=watch
if [ "${TELETRAAN_SUPERVISOR_DRY_RUN:-0}" != 1 ]; then
  wanted=$(sed -n 's/.*"supervisorMode":"\([a-z]*\)".*/\1/p' "$data/live/content.json" 2> /dev/null | head -n 1 || true)
  [ "$wanted" = fix ] && mode=fix
fi
# And never in the first day after it was installed, however the setting reads: it watches first so that whoever
# installed it can read what it would have done.
installed_file="$state_dir/supervisor-installed"
[ -f "$installed_file" ] || date +%s > "$installed_file" 2> /dev/null || true
installed=$(cat "$installed_file" 2> /dev/null || echo 0)
case $installed in ''|*[!0-9]*) installed=0 ;; esac
if [ "$installed" -gt 0 ] && [ $(( $(date +%s) - installed )) -lt 86400 ]; then
  mode=watch
  first_day=yes
else
  first_day=no
fi

# ----- what the plan says -----

"$node_bin" "$computer/scripts/ledger.mjs" boot > /dev/null 2>&1 || true

network_ok=false
if [ -s "$state_dir/netwatch.json" ] && grep -q '"failures":0' "$state_dir/netwatch.json" 2> /dev/null; then
  network_ok=true
fi

# The plan is asked with the health file plus the three facts it cannot read from it
input="$state_dir/.supervisor-input.json"
if ! python_free_merge=$("$node_bin" -e '
  const fs = require("node:fs");
  const health = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  health.nowMs = Number(process.argv[2]);
  health.uptimeSeconds = Number(process.argv[3]);
  health.networkOk = process.argv[4] === "true";
  fs.writeFileSync(process.argv[5], JSON.stringify(health));
  process.stdout.write("ok");
' "$health_file" "$now_ms" "$uptime" "$network_ok" "$input" 2> /dev/null); then
  say "the health file could not be read." >&2
  exit 1
fi
unset python_free_merge

if ! "$node_bin" "$computer/scripts/supervisor-plan.mjs" plan "$input" "$state_dir/reboot-ledger.json" > "$plan_file" 2> /dev/null; then
  say "the plan could not be worked out." >&2
  exit 1
fi

words=$(sed -n 's/.*"words":"\([^"]*\)".*/\1/p' "$plan_file" | head -n 1 || true)
notes=$("$node_bin" -e '
  const made = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
  (made.notes || []).forEach(note => process.stdout.write(String(note) + "\n"));
' "$plan_file" 2> /dev/null || true)

# Each note is a state change, so it is said once, here, and not every minute
if [ -n "$notes" ]; then
  printf '%s\n' "$notes" | while IFS= read -r note; do
    [ -z "$note" ] && continue
    say "$note"
    log_json supervisor health note "$note"
    "$computer/scripts/notify.sh" "supervisor: $note" > /dev/null 2>&1 || true
  done
fi

# ----- the actions -----

# A report of what it looked like before anything was restarted. Ten seconds at most, and a failure is ignored.
capture() {
  [ "$mode" = fix ] || return 0
  timeout 10 "$computer/scripts/diag.sh" --incident "$1" > /dev/null 2>&1 || true
}

do_reload() {
  if ! command -v "$python_bin" > /dev/null 2>&1; then
    say "python3 is not installed, so the page cannot be loaded again."
    return 1
  fi
  MIRROR_PORT="$page_port" "$python_bin" "$computer/scripts/page-command.py" reload > /dev/null 2>&1
}

do_service() {
  local unit=$1
  case $unit in
    # The two that stay up are restarted; a collector that a timer runs is simply run now
    teletraan-sync|teletraan-kiosk) sudo -n "$systemctl_bin" restart "$unit.service" > /dev/null 2>&1 ;;
    *) sudo -n "$systemctl_bin" start "$unit.service" > /dev/null 2>&1 ;;
  esac
}

do_kiosk() {
  capture restart-kiosk
  sudo -n "$systemctl_bin" restart teletraan-kiosk.service > /dev/null 2>&1 || return 1
  # The session comes back with the display as the TV offers it, so the mode is set again
  ( sleep 15; "$computer/scripts/display-watch.sh" --apply > /dev/null 2>&1 || true ) > /dev/null 2>&1 &
  return 0
}

do_network() {
  # netwatch owns the network ladder; running it now is how the supervisor asks for the next step of it
  "$computer/scripts/netwatch.sh" > /dev/null 2>&1
}

do_reboot() {
  local problem=$1
  # The gate is asked again at the moment of the reboot, and it records it before the computer goes down
  local why
  if ! why=$("$computer/scripts/gate.sh" allow recovery "$problem" 2>&1); then
    say "the reboot was refused at the door: $why"
    log_json supervisor health reboot_refused "$problem: $why"
    return 1
  fi
  capture reboot
  log_json supervisor health reboot "$problem: $why"
  "$computer/scripts/notify.sh" "supervisor: restarting the computer because $problem could not be fixed" > /dev/null 2>&1 || true
  sudo -n "$systemctl_bin" reboot > /dev/null 2>&1
}

# The actions come out one a line, tab separated, into a file rather than a pipe: a pipe would put the loop below in a
# subshell, where the count it keeps would be thrown away at the end.
actions_file="$state_dir/.supervisor-actions"
"$node_bin" -e '
  const made = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
  (made.actions || []).forEach(item => {
    process.stdout.write([item.problem, item.step, item.action, item.service || "", String(item.why || "").replace(/\t/g, " ")].join("\t") + "\n");
  });
' "$plan_file" > "$actions_file" 2> /dev/null || : > "$actions_file"

acted=0
while IFS="$(printf '\t')" read -r problem step action unit why; do
  [ -z "${problem:-}" ] && continue
  acted=$((acted + 1))
  if [ "$mode" != fix ]; then
    say "would take step $step for $problem ($action): $why"
    log_json supervisor health would "$problem step $step $action: $why"
    continue
  fi

  say "step $step for $problem: $action ($why)"
  code=0
  case $action in
    reload) do_reload || code=$? ;;
    restart-service) do_service "$unit" || code=$? ;;
    restart-kiosk) do_kiosk || code=$? ;;
    restart-network) do_network || code=$? ;;
    reboot) do_reboot "$problem" || code=$? ;;
    *) say "the plan asked for $action, which this script does not know." >&2; code=1 ;;
  esac

  if [ "$code" -eq 0 ]; then
    log_json supervisor health action "$problem step $step $action"
    "$computer/scripts/notify.sh" "supervisor: $action for $problem (step $step of 5)" > /dev/null 2>&1 || true
  else
    log_json supervisor health action_failed "$problem step $step $action failed with $code"
  fi
  "$node_bin" "$computer/scripts/ledger.mjs" action "$problem" "$step" "$action" "$([ "$code" -eq 0 ] && echo done || echo "failed $code")" > /dev/null 2>&1 || true
done < "$actions_file"
rm -f "$actions_file" 2> /dev/null || true

# What the ladder decided is kept whether it acted or only watched, so a problem does not start again at step 1 every
# minute. In watching mode the steps are still marked, which is what makes the log read like the real thing.
"$node_bin" "$computer/scripts/ledger.mjs" apply "$plan_file" > /dev/null 2>&1 || true

# ----- what the pages read -----

temporary="$out_file.tmp.$$"
if printf '{"generatedAt":"%s","mode":"%s","firstDay":"%s","words":"%s","actions":%s,"health":"%s"}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$mode" "$first_day" "$words" "$acted" "$health_file" > "$temporary" 2> /dev/null; then
  chmod 644 "$temporary" 2> /dev/null || true
  mv -f "$temporary" "$out_file" 2> /dev/null || rm -f "$temporary" 2> /dev/null || true
else
  rm -f "$temporary" 2> /dev/null || true
fi

# The Studio shows the same sentence in its own read-only block. Best effort: it needs a write token and the network,
# and a screen that cannot reach Sanity must still fix itself.
"$computer/scripts/status-write.sh" supervisor > /dev/null 2>&1 || true

if [ "$acted" -eq 0 ]; then
  say "$words"
fi
