#!/bin/bash
# Usage: diag.sh [--incident <reason>] [--print] [--list]
# Writes one plain-text report with everything needed to work out why the screen is wrong, so nobody has to log in to
# this computer over ssh to find out. The control page has a button for it (Details, Debug), make diag writes one by
# hand, and the supervisor writes one by itself before it restarts or reboots anything.
#
#   no flag              write a report into /var/lib/teletraan/reports and print its path
#   --incident <reason>  write it into /var/lib/teletraan/incidents instead, named after the reason
#   --print              also print the report
#   --list               print the reports there are, newest first
#
# Every section says where it came from and when. The last 20 reports and the last 20 incidents are kept.
#
# Nothing in a report is secret. Every line goes through computer/scripts/redact.mjs, which is the same list of rules
# the log download uses: the keys file is never read at all, and tokens, passwords, calendar links and the paths of
# addresses are taken out of everything else. tests/diag-redaction.test.mjs feeds made-up keys and feed links through
# the whole thing and fails if any of them comes out the other end.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}
state_dir=${TELETRAAN_STATE_DIR:-/var/lib/teletraan}
reports_dir="$state_dir/reports"
incidents_dir="$state_dir/incidents"
node_bin=${TELETRAAN_NODE:-node}
python_bin=${TELETRAAN_PYTHON:-python3}
systemctl_bin=${TELETRAAN_SYSTEMCTL:-/usr/bin/systemctl}
page_port=${MIRROR_PORT:-9222}
keep=20

mode=report
reason=''
print=no
while [ $# -gt 0 ]; do
  case $1 in
    --incident) mode=incident; reason=${2:-unknown}; shift 2 ;;
    --print) print=yes; shift ;;
    --list) mode=list; shift ;;
    *) echo "diag: $1 is not one of --incident, --print or --list." >&2; exit 1 ;;
  esac
done

folder=$reports_dir
[ "$mode" = incident ] && folder=$incidents_dir

if [ "$mode" = list ]; then
  for place in "$reports_dir" "$incidents_dir"; do
    [ -d "$place" ] || continue
    ls -1t "$place" 2> /dev/null | head -n "$keep" | while IFS= read -r name; do
      printf '%s\t%s\t%s\n' "$name" "$(date -r "$place/$name" -u +%Y-%m-%dT%H:%M:%SZ 2> /dev/null || true)" "$place/$name"
    done
  done
  exit 0
fi

mkdir -p "$folder" 2> /dev/null || { echo "diag: $folder cannot be made." >&2; exit 1; }
chmod 700 "$folder" 2> /dev/null || true

stamp=$(date -u +%Y%m%dT%H%M%SZ)
safe_reason=$(printf '%s' "$reason" | tr -c 'A-Za-z0-9-' '-' | cut -c 1-24)
name="report-$stamp"
[ "$mode" = incident ] && name="report-$stamp-${safe_reason:-unknown}"
base="$folder/$name"
raw="$base.raw"
report="$base.txt"

# ----- the sections -----

# Each section prints a heading that says what it is and where it came from, then whatever could be read. A command that
# is missing or fails prints one line saying so: a report is never allowed to fail, because it is written at the worst
# moments.
section() {
  printf '\n==== %s ====\n' "$1"
}
run() {
  # Every command is given a few seconds. A hanging command must not hold up a reboot.
  timeout "${2:-5}" bash -c "$1" 2>&1 | head -n "${3:-200}" || echo "(could not be read)"
}
show_file() {
  if [ -s "$1" ]; then
    head -c "${2:-20000}" "$1"
    printf '\n'
  else
    echo "(no file at $1)"
  fi
}

{
  version=$(cat "$repo/VERSION" 2> /dev/null || echo unknown)
  printf 'Teletraan I diagnostic report\n'
  printf 'written: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'build version: %s\n' "$version"
  printf 'why: %s\n' "${reason:-asked for by hand}"
  printf 'host: %s\n' "$(hostname 2> /dev/null || true)"

  section "the build, and when it was installed (RELEASE.json, dashboard/build.js)"
  show_file "$repo/RELEASE.json" 2000
  show_file "$repo/dashboard/build.js" 1000
  printf 'release folder: %s\n' "$(readlink -f "$repo" 2> /dev/null || true)"

  section "how long it has been up, and the last boots (uptime, last reboot)"
  run "uptime" 5 5
  run "cut -d' ' -f1 /proc/uptime" 5 2
  run "last reboot" 5 12

  section "what the health checks say (/var/lib/teletraan/health.json, written every minute by health.sh)"
  show_file "$state_dir/health.json" 8000

  section "what the supervisor is doing (supervisor.json and the reboot ledger)"
  show_file "$state_dir/supervisor.json" 3000
  show_file "$state_dir/reboot-ledger.json" 8000

  section "the display now (xrandr, and the state display-watch.sh keeps)"
  display_name=$(setting KIOSK_DISPLAY)
  display_name=${display_name:-:1}
  run "DISPLAY='$display_name' xrandr --verbose" 8 160
  show_file "$state_dir/display.json" 2000
  printf '\nthe last display events:\n'
  run "tail -n 40 '$state_dir/display-events'" 5 40

  section "what the kernel said about the screen (dmesg, the last 30 minutes)"
  run "journalctl -k --since '30 min ago' --no-pager -o short-iso | grep -iE 'drm|hdmi|edid|i915|gpu' " 10 80

  section "the picture of the screen now (mirror.py)"
  if command -v "$python_bin" > /dev/null 2>&1 && ! "$systemctl_bin" is-active --quiet teletraan-mirror.service 2> /dev/null; then
    if MIRROR_PORT="$page_port" MIRROR_DATA="$data" MIRROR_MAX=8 MIRROR_IDLE=8 timeout 12 "$python_bin" "$computer/scripts/mirror.py" > /dev/null 2>&1 && [ -s "$data/mirror/frame.jpg" ]; then
      cp -f "$data/mirror/frame.jpg" "$base.jpg" 2> /dev/null || true
      chmod 600 "$base.jpg" 2> /dev/null || true
      printf 'saved next to this report as %s (%s bytes)\n' "$name.jpg" "$(wc -c < "$base.jpg" 2> /dev/null || echo 0)"
    else
      printf 'the picture could not be taken\n'
    fi
    show_file "$data/mirror/state.json" 1000
  else
    printf 'skipped: python3 is missing, or someone is watching the live preview\n'
  fi

  section "the heartbeats (how old each file and the page title are)"
  for item in "$data/live/content.json" "$data/live/sync-status.json" "$state_dir/health.json" "$data/network/status.json"; do
    if [ -f "$item" ]; then
      printf '%s: %s seconds old\n' "$(basename "$item")" "$(( $(date +%s) - $(stat -c %Y "$item" 2> /dev/null || echo 0) ))"
    else
      printf '%s: missing\n' "$(basename "$item")"
    fi
  done
  printf 'the page title: %s\n' "$(curl --silent --max-time 5 "http://127.0.0.1:$page_port/json" 2> /dev/null | sed -n 's/.*"title": *"\([^"]*\)".*/\1/p' | head -n 1 || echo '(the browser did not answer)')"
  printf 'the last frame was: %s seconds ago\n' "$(MIRROR_PORT="$page_port" timeout 8 "$python_bin" "$computer/scripts/page-command.py" frames 2> /dev/null || echo 'not said')"

  section "the services (which failed, and how often each has restarted)"
  run "$systemctl_bin --failed --no-pager" 8 40
  for unit in $("$systemctl_bin" list-unit-files 'teletraan-*' --no-legend 2> /dev/null | awk '{ print $1 }' | head -n 40); do
    printf '%-40s %-10s restarts %s\n' "$unit" "$("$systemctl_bin" is-active "$unit" 2> /dev/null || true)" "$("$systemctl_bin" show -p NRestarts --value "$unit" 2> /dev/null || true)"
  done

  section "the kiosk and the watchdog (the last lines of each journal)"
  run "journalctl -u teletraan-kiosk.service -n 50 --no-pager -o short-iso" 10 50
  run "journalctl -u teletraan-watchdog.service -n 50 --no-pager -o short-iso" 10 50
  run "journalctl -u teletraan-supervisor.service -n 50 --no-pager -o short-iso" 10 50

  section "the logs this computer keeps (/var/log/teletraan, the last lines of each)"
  for file in "${TELETRAAN_LOG_DIR:-/var/log/teletraan}"/*.jsonl; do
    [ -f "$file" ] || continue
    printf '\n-- %s --\n' "$(basename "$file")"
    tail -n 200 "$file" 2> /dev/null || true
  done

  section "the network (the link, the gateway, the resolvers, and what netwatch found)"
  run "ip -4 -o addr show" 5 20
  run "ip route" 5 20
  run "cat /etc/resolv.conf" 5 20
  "$computer/scripts/network-info.sh" --summary 2> /dev/null || echo "(network-info said nothing)"
  show_file "$state_dir/netwatch.json" 2000
  show_file "$data/network/status.json" 2000
  if [ -x "$computer/scripts/dns-status.sh" ]; then
    printf '\nthe name servers wanted and in use:\n'
    run "'$computer/scripts/dns-status.sh'" 8 20
  fi

  section "each source: the last good read and the last failure (sync-status.json)"
  show_file "$data/live/sync-status.json" 6000

  section "what this computer has left (load, memory, the browser, the disk, the temperature)"
  run "cat /proc/loadavg" 5 2
  run "free -m" 5 8
  run "ps -o pid,rss,etimes,comm -C chromium --sort=-rss" 5 12
  run "df -h /" 5 6
  run "df -h '$state_dir'" 5 6
  printf 'temperature: %s C\n' "$(awk '{ printf "%d", $1 / 1000 }' /sys/class/thermal/thermal_zone0/temp 2> /dev/null || echo 'not said')"
  if command -v vcgencmd > /dev/null 2>&1; then
    run "vcgencmd get_throttled" 5 2
  else
    printf 'throttling flags: this computer does not report them\n'
  fi
  run "journalctl -p err -k -n 20 --no-pager -o short-iso" 8 20
} > "$raw" 2>&1 || true

# ----- the one thing that must not fail: nothing secret goes out -----

if command -v "$node_bin" > /dev/null 2>&1; then
  if ! "$node_bin" "$computer/scripts/redact.mjs" < "$raw" > "$report" 2> /dev/null; then
    rm -f "$report"
    echo "diag: the report could not be cleaned of keys, so it was thrown away." >&2
    rm -f "$raw"
    exit 1
  fi
else
  # Without node nothing can be cleaned, and an uncleaned report is never written
  rm -f "$raw"
  echo "diag: node is not installed, so a report cannot be cleaned of keys and none was written." >&2
  exit 1
fi
rm -f "$raw"
chmod 600 "$report" 2> /dev/null || true

# Only the newest reports are kept, so the disk cannot fill with them
ls -1t "$folder" 2> /dev/null | tail -n +$((keep * 2 + 1)) | while IFS= read -r old; do
  rm -f "$folder/$old" 2> /dev/null || true
done

log_json diag diag written "$name ${reason:-by hand}"
echo "$report"
[ "$print" = yes ] && cat "$report"
exit 0
