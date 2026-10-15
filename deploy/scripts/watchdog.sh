#!/bin/sh
# Restarts the screen when it has frozen. teletraan-watchdog.timer runs it every
# 2 minutes as root, because restarting teletraan-kiosk needs that.
#
# The dashboard puts the time in the page title every 30 seconds (dashboard/core/
# heartbeat.js), and kiosk.sh starts the browser so that this machine can list
# its pages at http://127.0.0.1:9222/json. This script reads the title there.
# It restarts teletraan-kiosk when
#   - no browser process is running,
#   - the browser has no page, or
#   - the time in the title is more than 3 minutes old, or the title has none.
# A browser that started less than 3 minutes ago is left alone while it loads.
#
# So that a broken deploy is not restarted in a loop:
#   - at most one restart in 10 minutes,
#   - when a third restart would fall inside one hour, nothing is restarted and
#     the watchdog stops until the Mini boots again.
# What it has done is kept in the file watchdog-state in the data folder
# (/var/lib/teletraan/data, or TELETRAAN_DATA in local.env), one NAME=value
# line each: boot (the id of this boot), day and today (restarts counted for
# the day), stopped, and one restart= line with the time of each restart in the
# last hour. Delete the file to start the count again.
#
# Each restart, and the stop, tells Studio through status-write.sh (the status
# block on Start here shows Screen restarts today). That is best effort and
# never stops a restart. Nothing here reads a key.
set -eu

deploy=$(cd "$(dirname "$0")/.." && pwd)
env_file="$deploy/local.env"

# The value of a NAME=value line in local.env, without its quotes
setting() {
  [ -f "$env_file" ] || return 0
  sed -n "s/^$1=//p" "$env_file" | tail -n 1 | sed "s/^['\"]//; s/['\"]\$//"
}

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}
state="$data/watchdog-state"

page_list=http://127.0.0.1:9222/json
browser_pattern='--remote-debugging-port=9222'
service=teletraan-kiosk

# The limits, in seconds
title_limit_minutes=3
start_grace=180
restart_gap=600
hour=3600

# Where the id of this boot is. The test points it at a file.
boot_file=${WATCHDOG_BOOT_FILE:-/proc/sys/kernel/random/boot_id}

say() {
  echo "watchdog: $*"
}

for tool in curl pgrep ps systemctl awk; do
  command -v "$tool" > /dev/null 2>&1 || { say "$tool is not installed, so the screen cannot be checked." >&2; exit 1; }
done

now=$(date +%s)
today=$(date +%F)
boot=$(cat "$boot_file" 2> /dev/null || echo unknown)

# What this run found wrong, in words. Empty means the screen is fine.
problem=''

if ! pgrep -f -- "$browser_pattern" > /dev/null 2>&1; then
  problem='no browser process is running'
else
  list=$(curl --silent --max-time 5 --connect-timeout 3 "$page_list" 2> /dev/null || true)
  if ! printf '%s' "$list" | grep -q '"type": *"page"'; then
    problem='the browser has no page'
  else
    # The title looks like: Teletraan I (a middle dot) 14:07. The dot may arrive
    # as itself or as an escape, so only the clock at the end is read.
    clock=$(printf '%s' "$list" | sed -n 's/.*"title": *"Teletraan I [^"]* \([0-9][0-9]:[0-9][0-9]\)".*/\1/p' | head -n 1)
    if [ -z "$clock" ]; then
      problem='the page title has no time'
    else
      # Minutes between the title and now, across midnight. A title a minute or
      # two ahead of this clock is a rounding difference, not a stale page.
      late=$(awk -v then="$clock" -v now="$(date +%H:%M)" 'BEGIN {
        split(then, a, ":"); split(now, b, ":")
        d = (b[1] * 60 + b[2]) - (a[1] * 60 + a[2])
        d = (d % 1440 + 1440) % 1440
        if (d > 720) d -= 1440
        print d
      }')
      if [ "$late" -gt "$title_limit_minutes" ]; then
        problem="the page title is $late minutes old"
      fi
    fi
  fi
fi

if [ -z "$problem" ]; then
  exit 0
fi

# A browser that has only just started has not had time to draw its first beat
oldest=$(pgrep -o -f -- "$browser_pattern" 2> /dev/null || true)
if [ -n "$oldest" ]; then
  age=$(ps -o etimes= -p "$oldest" 2> /dev/null | tr -d ' ' || true)
  case $age in
    ''|*[!0-9]*) ;;
    *)
      if [ "$age" -lt "$start_grace" ]; then
        say "$problem, but the browser started $age seconds ago, so it is given time."
        exit 0
      fi
      ;;
  esac
fi

# What the state file says. A new boot starts a clean count, and so does a new day for the count of the day.
kept_boot=$(sed -n 's/^boot=//p' "$state" 2> /dev/null | head -n 1 || true)
kept_day=$(sed -n 's/^day=//p' "$state" 2> /dev/null | head -n 1 || true)
kept_today=$(sed -n 's/^today=//p' "$state" 2> /dev/null | head -n 1 || true)
kept_stopped=$(sed -n 's/^stopped=//p' "$state" 2> /dev/null | head -n 1 || true)
kept_restarts=$(sed -n 's/^restart=//p' "$state" 2> /dev/null || true)

if [ "$kept_boot" != "$boot" ]; then
  kept_stopped=''
  kept_restarts=''
  kept_day=''
fi
if [ "$kept_day" != "$today" ]; then
  kept_today=0
fi
case $kept_today in ''|*[!0-9]*) kept_today=0 ;; esac

if [ "$kept_stopped" = 1 ]; then
  say "$problem. Restarting was stopped earlier in this boot, so nothing is done."
  exit 0
fi

# Only the restarts of the last hour matter
recent=$(printf '%s\n' "$kept_restarts" | awk -v now="$now" -v hour="$hour" '$1 ~ /^[0-9]+$/ && now - $1 < hour { print $1 }')
in_hour=$(printf '%s\n' "$recent" | awk 'NF { n++ } END { print n + 0 }')
newest=$(printf '%s\n' "$recent" | awk 'NF && $1 > m { m = $1 } END { print m + 0 }')

# Writes the state file by way of a temporary file in the same folder, so a cut power does not leave half a file
save_state() {
  temporary="$state.tmp.$$"
  {
    echo "boot=$boot"
    echo "day=$today"
    echo "today=$1"
    [ "$2" = 1 ] && echo "stopped=1"
    printf '%s\n' "$3" | awk 'NF { print "restart=" $1 }'
  } > "$temporary" 2> /dev/null && mv -f "$temporary" "$state" 2> /dev/null || {
    rm -f "$temporary" 2> /dev/null || true
    return 1
  }
}

tell_studio() {
  "$deploy/scripts/status-write.sh" restart "$1" > /dev/null 2>&1 || true
}

if [ "$newest" -gt 0 ] && [ $((now - newest)) -lt "$restart_gap" ]; then
  say "$problem, but the screen was restarted $((now - newest)) seconds ago. Waiting."
  exit 0
fi

if [ "$in_hour" -ge 2 ]; then
  if save_state "$kept_today" 1 "$recent"; then
    say "$problem. That would be the third restart in an hour, so restarting stops until the next boot."
    tell_studio "$kept_today"
    exit 0
  fi
  say "could not write $state." >&2
  exit 1
fi

# The state is written first. If it cannot be, nothing is restarted, because then the limits above could not be kept.
count=$((kept_today + 1))
if ! save_state "$count" 0 "$(printf '%s\n%s' "$recent" "$now")"; then
  say "$problem, but $state cannot be written, so nothing is restarted." >&2
  exit 1
fi

say "$problem. Restarting $service (restart $count today)."
systemctl restart "$service"
tell_studio "$count"
