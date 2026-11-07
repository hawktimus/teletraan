#!/bin/bash
# Usage: health.sh [--print]   (started by teletraan-health.timer every minute)
# Looks this computer over and writes /var/lib/teletraan/health.json: one entry for each check, with ok, since and a
# plain detail line. It decides nothing and repairs nothing. The supervisor (computer/scripts/supervisor.sh) reads the
# file and acts; the control page and the Studio status read it to say how things are.
#
# What it reads, and never asks twice:
#   the page        the browser's debugging port on 127.0.0.1, for the page and when it last painted a frame
#   the display     xrandr, through display.sh, which is also what sets the mode
#   the picture      one frame from mirror.py every 5 minutes, hashed, to catch a picture that has stopped changing
#   the network      netwatch.json, which netwatch.sh wrote: the gateway, the name lookup and the HTTPS check
#   the sources      sync-status.json and the files the collectors leave
#   the services     systemctl, for what is running and what keeps restarting
#   the computer     /proc, df and the thermal zone
#
# Which readings count as a problem is in computer/scripts/health-checks.mjs, not here, so there is one place that
# decides and one place that gathers. --print writes the file and prints it.
#
# Nothing here uses sudo and nothing here reads a key. A reading that cannot be taken is left out, and a check with no
# reading is left out of the file rather than failed: a fact nobody could gather is not a fault.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}
state_dir=${TELETRAAN_STATE_DIR:-/var/lib/teletraan}
health_file="$state_dir/health.json"
picture_state="$state_dir/picture.json"
netwatch_state=${NETWATCH_STATE:-$state_dir/netwatch.json}
systemctl_bin=${TELETRAAN_SYSTEMCTL:-/usr/bin/systemctl}
node_bin=${TELETRAAN_NODE:-node}
python_bin=${TELETRAAN_PYTHON:-python3}
page_port=${MIRROR_PORT:-9222}

# How often a frame of the picture is captured, in seconds, and how long an unchanged picture may go before it counts
# as stuck. mirror.py draws the page again for the frame, so this is kept well apart.
picture_every=300

say() {
  echo "health: $*"
}

# A run that starts while the last one is still going stops at once
mkdir -p "$state_dir" 2> /dev/null || true
exec 9> "$state_dir/.health.lock"
if ! flock -n 9; then
  exit 0
fi

now=$(date +%s)
now_ms=$((now * 1000))

# ----- the readings, as JSON members -----

readings=""
add() {
  readings="$readings$1"
}
# A number member, left out when the value is not a number
add_number() {
  case ${2:-} in
    ''|*[!0-9.-]*) return 0 ;;
  esac
  add "\"$1\":$2,"
}
add_bool() {
  add "\"$1\":$2,"
}
# A text member, with anything that is not plain taken out
add_text() {
  add "\"$1\":\"$(printf '%s' "${2:-}" | tr -d '\000-\037"\\' | cut -c 1-120)\","
}

# ----- the page and its frames -----

page_list="http://127.0.0.1:$page_port/json"
page_answers=false
if list=$(curl --silent --max-time 5 --connect-timeout 3 "$page_list" 2> /dev/null) && printf '%s' "$list" | grep -q '"type": *"page"'; then
  page_answers=true
fi
add_bool pageAnswers "$page_answers"

if [ "$page_answers" = true ]; then
  # The page keeps the time of its last painted frame (dashboard/core/frames.js) and answers with its age in seconds
  frame_age=''
  if command -v "$python_bin" > /dev/null 2>&1; then
    frame_age=$(MIRROR_PORT="$page_port" "$python_bin" "$computer/scripts/page-command.py" frames 2> /dev/null || true)
  fi
  case $frame_age in
    ''|*[!0-9]*)
      add_bool framesFresh false
      add_text framesDetail "the page did not say when it last painted"
      ;;
    *) add_number frameAgeSeconds "$frame_age" ;;
  esac

  # The page title is the older heartbeat, which watchdog.sh also reads. FROZEN in place of the clock is the page saying
  # that its timers run but no frame has been painted.
  title=$(printf '%s' "$list" | sed -n 's/.*"title": *"\(Teletraan I [^"]*\)".*/\1/p' | head -n 1)
  if printf '%s' "$title" | grep -q 'FROZEN'; then
    add_bool framesFresh false
    add_text framesDetail "the page says it is not painting"
  fi
  clock=$(printf '%s' "$title" | sed -n 's/.*[^0-9]\([0-9][0-9]:[0-9][0-9]\)$/\1/p')
  if [ -n "$clock" ]; then
    page_age=$(awk -v then="$clock" -v now="$(date +%H:%M)" 'BEGIN {
      split(then, a, ":"); split(now, b, ":")
      d = (b[1] * 60 + b[2]) - (a[1] * 60 + a[2])
      d = (d % 1440 + 1440) % 1440
      if (d > 720) d -= 1440
      if (d < 0) d = 0
      print d * 60
    }')
    add_number pageAgeSeconds "$page_age"
  fi
fi

# ----- the display -----

display_name=$(setting KIOSK_DISPLAY)
display_name=${display_name:-:1}
if command -v xrandr > /dev/null 2>&1; then
  # display.sh knows which size is wanted and how to read xrandr, and it is what kiosk.sh uses to set the mode
  . "$computer/scripts/display.sh"
  wanted=$(display_wanted)
  output=$(DISPLAY="$display_name" xrandr --query 2> /dev/null | awk '$2 == "connected" { print $1; exit }' || true)
  if [ -n "$output" ]; then
    # The mode in use is the one marked with a star
    current=$(DISPLAY="$display_name" xrandr --query 2> /dev/null | awk '
      $2 == "connected" { inside = 1; next }
      /^[^ \t]/ { inside = 0 }
      inside && $0 ~ /\*/ { print $1; exit }
    ' || true)
    # The framebuffer is what the dashboard draws into, and is what the wanted size is about
    screen=$(DISPLAY="$display_name" xrandr --query 2> /dev/null | sed -n 's/^Screen [0-9]*:.*current \([0-9]* x [0-9]*\).*/\1/p' | head -n 1 | tr -d ' ' || true)
    add_bool displayConnected true
    add_text displayMode "${screen:-$current}"
    add_text displayWanted "$wanted"
  else
    add_bool displayConnected false
    add_text displayMode ""
    add_text displayWanted "$wanted"
  fi
fi

# ----- the picture -----

# One frame every five minutes, hashed. An unchanged hash while the rotation is on means the picture has stopped.
# mirror.py is left alone while someone is watching the live preview, so the two never fight over the browser.
picture_same_minutes=''
picture_flat=''
if [ "$page_answers" = true ] && command -v "$python_bin" > /dev/null 2>&1 \
  && ! "$systemctl_bin" is-active --quiet teletraan-mirror.service 2> /dev/null; then
  last_shot=0
  [ ! -f "$picture_state" ] || last_shot=$(sed -n 's/.*"at":\([0-9]*\).*/\1/p' "$picture_state" | head -n 1)
  case $last_shot in ''|*[!0-9]*) last_shot=0 ;; esac

  if [ $((now - last_shot)) -ge "$picture_every" ]; then
    frame="$data/mirror/frame.jpg"
    rm -f "$frame" 2> /dev/null || true
    MIRROR_PORT="$page_port" MIRROR_DATA="$data" MIRROR_MAX=8 MIRROR_IDLE=8 \
      "$python_bin" "$computer/scripts/mirror.py" > /dev/null 2>&1 || true
    if [ -f "$frame" ]; then
      hash=$(sha1sum "$frame" 2> /dev/null | cut -c 1-16 || true)
      kept_hash=$(sed -n 's/.*"hash":"\([0-9a-f]*\)".*/\1/p' "$picture_state" 2> /dev/null | head -n 1 || true)
      kept_since=$(sed -n 's/.*"since":\([0-9]*\).*/\1/p' "$picture_state" 2> /dev/null | head -n 1 || true)
      case $kept_since in ''|*[!0-9]*) kept_since=0 ;; esac
      since=$now
      [ "$hash" = "$kept_hash" ] && [ "$kept_since" -gt 0 ] && since=$kept_since
      printf '{"at":%s,"hash":"%s","since":%s}\n' "$now" "${hash:-none}" "$since" > "$picture_state.tmp.$$" 2> /dev/null \
        && mv -f "$picture_state.tmp.$$" "$picture_state" 2> /dev/null || rm -f "$picture_state.tmp.$$" 2> /dev/null || true
    fi
  fi

  if [ -f "$picture_state" ]; then
    kept_since=$(sed -n 's/.*"since":\([0-9]*\).*/\1/p' "$picture_state" | head -n 1 || true)
    case $kept_since in
      ''|*[!0-9]*) ;;
      *) picture_same_minutes=$(( (now - kept_since) / 60 )) ;;
    esac
  fi
  # mirror.py's own reading of whether the picture is black
  if [ -f "$data/mirror/state.json" ] && grep -q '"state": *"black"' "$data/mirror/state.json" 2> /dev/null; then
    picture_flat=1
  fi
fi
add_number pictureSameMinutes "$picture_same_minutes"
add_number pictureFlatShare "$picture_flat"
# The picture is only expected to change while the rotation is playing
if [ -f "$data/live/content.json" ] && grep -q '"pauseRotation"' "$data/live/content.json" 2> /dev/null \
  && grep -q '"pauseRotation":{"on":true' "$data/live/content.json" 2> /dev/null; then
  add_bool rotationOn false
fi

# ----- the network, from what netwatch already found out -----

if [ -s "$netwatch_state" ]; then
  fails=$(sed -n 's/.*"failures":\([0-9]*\).*/\1/p' "$netwatch_state" | head -n 1)
  case $fails in
    ''|*[!0-9]*) ;;
    *) [ "$fails" -eq 0 ] && add_bool networkOk true || add_bool networkOk false ;;
  esac
  dns=$(sed -n 's/.*"dns":"\([a-z]*\)".*/\1/p' "$netwatch_state" | head -n 1)
  case $dns in
    ok|skip) add_bool dnsOk true ;;
    fail) add_bool dnsOk false ;;
  esac
fi

# ----- the sources -----

sync_file="$data/sync-status.json"
ages=""
source_age() {
  local stamp="$1" name="$2" seconds
  [ -n "$stamp" ] || return 0
  seconds=$(date -d "$stamp" +%s 2> /dev/null || true)
  case $seconds in
    ''|*[!0-9]*) return 0 ;;
  esac
  [ "$seconds" -le "$now" ] || return 0
  ages="$ages\"$name\":$((now - seconds)),"
}
if [ -s "$sync_file" ]; then
  for name in sanity calendars monday competition; do
    stamp=$(sed -n "s/.*\"$name\":{[^}]*\"lastSuccessAt\":\"\([^\"]*\)\".*/\1/p" "$sync_file" | head -n 1)
    source_age "$stamp" "$name"
  done
fi
[ -z "$ages" ] || add "\"sourceAgeSeconds\":{${ages%,}},"

monday_every=$(sed -n 's/.*"mondayEveryMinutes":\([0-9]*\).*/\1/p' "$data/live/content.json" 2> /dev/null | head -n 1 || true)
add_number mondayEveryMinutes "$monday_every"

# ----- the services -----

services=""
for unit in sync kiosk netwatch watchdog; do
  name="teletraan-$unit"
  "$systemctl_bin" list-unit-files "$name.service" > /dev/null 2>&1 || continue
  active=false
  "$systemctl_bin" is-active --quiet "$name.service" 2> /dev/null && active=true
  # A unit with a timer is not expected to be running between its runs, so only the two that stay up are judged
  case $unit in
    netwatch|watchdog) active=true ;;
  esac
  restarts=$("$systemctl_bin" show -p NRestarts --value "$name.service" 2> /dev/null || echo 0)
  case $restarts in ''|*[!0-9]*) restarts=0 ;; esac
  services="$services{\"name\":\"$name\",\"active\":$active,\"restarts\":$restarts},"
done
[ -z "$services" ] || add "\"services\":[${services%,}],"

# ----- what the computer has left -----

rss=$(ps -o rss= -C chromium 2> /dev/null | awk '{ total += $1 } END { print total + 0 }' || true)
[ -n "$rss" ] && [ "$rss" != 0 ] && add_number chromiumRssKb "$rss"

free_share=$(df -Pk "$state_dir" 2> /dev/null | awk 'NR == 2 && $2 > 0 { printf "%.3f", $4 / $2 }' || true)
add_number diskFreeShare "$free_share"
add_number memAvailableKb "$(awk '/^MemAvailable:/ { print $2 }' /proc/meminfo 2> /dev/null || true)"
add_number tempC "$(awk '{ printf "%d", $1 / 1000 }' /sys/class/thermal/thermal_zone0/temp 2> /dev/null || true)"

if command -v timedatectl > /dev/null 2>&1; then
  if timedatectl show -p NTPSynchronized --value 2> /dev/null | grep -q yes; then
    add_bool clockSynced true
  else
    add_bool clockSynced false
  fi
fi

add_number uptimeSeconds "$(cut -d' ' -f1 /proc/uptime 2> /dev/null | cut -d. -f1 || true)"
add_text bootId "$(cat /proc/sys/kernel/random/boot_id 2> /dev/null || true)"
add_number nowMs "$now_ms"

# ----- the file -----

input="$state_dir/.health-readings.json"
printf '{%s}\n' "${readings%,}" > "$input" 2> /dev/null || { say "could not write the readings." >&2; exit 1; }

if ! command -v "$node_bin" > /dev/null 2>&1; then
  say "node is not installed, so the checks cannot be worked out." >&2
  exit 1
fi
temporary="$health_file.tmp.$$"
if "$node_bin" "$computer/scripts/health-checks.mjs" "$input" "$health_file" > "$temporary" 2> /dev/null; then
  chmod 644 "$temporary" 2> /dev/null || true
  mv -f "$temporary" "$health_file" 2> /dev/null || { rm -f "$temporary"; say "could not write $health_file." >&2; exit 1; }
else
  rm -f "$temporary" 2> /dev/null || true
  say "the checks could not be worked out." >&2
  exit 1
fi

# ----- housekeeping, so the disk cannot fill -----

# The logs are rotated by logrotate, and these are the files nothing else prunes: the incident reports and the frames.
find "$state_dir/incidents" -maxdepth 1 -name 'report-*' -mtime +14 -delete 2> /dev/null || true
find "$data/mirror" -maxdepth 1 -name 'frame-*.jpg' -mtime +2 -delete 2> /dev/null || true

if [ "${1:-}" = --print ]; then
  cat "$health_file"
fi
