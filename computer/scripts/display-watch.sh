#!/bin/bash
# Usage: display-watch.sh [--apply] [--status] [--test]   (started by teletraan-display.timer every 15 seconds)
# Notices when the TV is switched off, switched to another input, or switched back, and puts the picture right.
#
# The screen is set once when the kiosk starts (display.sh, called by kiosk.sh). A TV that was off, or on another input,
# comes back and offers its modes again, and nothing was listening: the framebuffer stays as the TV left it and the
# dashboard is drawn at the wrong size, or half drawn. This watches for that and re-applies the setup kiosk.sh used.
#
#   no flag    one look; acts when the display changed
#   --apply    set the mode again now, whatever the state file says (the supervisor calls this after a kiosk restart)
#   --status   print what it knows and the last events (make display-status)
#   --test     walk through the recovery with no display and no restart, and print each step (make display-test)
#
# What it does when the screen comes back: wait three seconds for the mode to settle, call set_display, then ask the
# page to load again. If no frame has been painted fifteen seconds later, restart the screen session.
#
# It never changes the TV's settings, never adds a mode and never picks a port: set_display chooses only from the modes
# the TV lists, which is the same choice kiosk.sh makes. At most three recoveries in ten minutes, then it says so and
# leaves the screen alone until the count ages out.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

state_dir=${TELETRAAN_STATE_DIR:-/var/lib/teletraan}
state_file="$state_dir/display.json"
events_file="$state_dir/display-events"
systemctl_bin=${TELETRAAN_SYSTEMCTL:-/usr/bin/systemctl}
python_bin=${TELETRAAN_PYTHON:-python3}
node_bin=${TELETRAAN_NODE:-node}
page_port=${MIRROR_PORT:-9222}

settle_seconds=${DISPLAY_SETTLE:-3}
frame_wait_seconds=${DISPLAY_FRAME_WAIT:-15}
most_recoveries=3
recovery_window=600

say() {
  echo "display-watch: $*"
}

# One line in the events file and one in the JSON log. The file is what --status prints and what the diagnostic
# report carries, so a person can see the order things happened in.
note() {
  local event=$1 detail=${2:-}
  printf '%s %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$event" "$detail" >> "$events_file" 2> /dev/null || true
  # Only the last 200 lines are worth keeping
  if [ -f "$events_file" ] && [ "$(wc -l < "$events_file" 2> /dev/null || echo 0)" -gt 240 ]; then
    tail -n 200 "$events_file" > "$events_file.tmp.$$" 2> /dev/null && mv -f "$events_file.tmp.$$" "$events_file" 2> /dev/null || rm -f "$events_file.tmp.$$" 2> /dev/null || true
  fi
  log_json display display "$event" "$detail"
}

mkdir -p "$state_dir" 2> /dev/null || true

display_name=$(kiosk_display)
export DISPLAY=${DISPLAY:-$display_name}

if ! command -v xrandr > /dev/null 2>&1; then
  [ "${1:-}" = --status ] && echo "xrandr is not installed on this computer."
  exit 0
fi

. "$computer/scripts/display.sh"

# What xrandr says now: the connected output, the mode in use and the framebuffer
look() {
  local text
  text=$(xrandr --query 2> /dev/null || true)
  out_name=$(printf '%s\n' "$text" | awk '$2 == "connected" { print $1; exit }')
  out_mode=$(printf '%s\n' "$text" | awk '
    $2 == "connected" { inside = 1; next }
    /^[^ \t]/ { inside = 0 }
    inside && $0 ~ /\*/ { print $1; exit }
  ')
  out_screen=$(printf '%s\n' "$text" | sed -n 's/^Screen [0-9]*:.*current \([0-9]* x [0-9]*\).*/\1/p' | head -n 1 | tr -d ' ')
}

write_state() {
  local temporary="$state_file.tmp.$$"
  if printf '{"at":"%s","output":"%s","mode":"%s","framebuffer":"%s","wanted":"%s","recoveries":%s,"recoveryAt":%s}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${out_name:-}" "${out_mode:-}" "${out_screen:-}" "$(display_wanted)" "${recoveries:-0}" "${recovery_at:-0}" \
    > "$temporary" 2> /dev/null; then
    chmod 644 "$temporary" 2> /dev/null || true
    mv -f "$temporary" "$state_file" 2> /dev/null || rm -f "$temporary" 2> /dev/null || true
  else
    rm -f "$temporary" 2> /dev/null || true
  fi
}

kept() {
  # No state file yet (the first look) is not an error: sed would exit 2 and set -e would end the script
  sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p" "$state_file" 2> /dev/null | head -n 1 || true
}
kept_number() {
  local value
  value=$(sed -n "s/.*\"$1\":\([0-9]*\).*/\1/p" "$state_file" 2> /dev/null | head -n 1 || true)
  case $value in ''|*[!0-9]*) echo 0 ;; *) echo "$value" ;; esac
}

frames_painted() {
  local age
  command -v "$python_bin" > /dev/null 2>&1 || return 0
  age=$(MIRROR_PORT="$page_port" "$python_bin" "$computer/scripts/page-command.py" frames 2> /dev/null || true)
  case $age in
    ''|*[!0-9]*) return 1 ;;
    *) [ "$age" -le 30 ] ;;
  esac
}

reload_page() {
  command -v "$python_bin" > /dev/null 2>&1 || return 1
  MIRROR_PORT="$page_port" "$python_bin" "$computer/scripts/page-command.py" reload > /dev/null 2>&1
}

# ----- the simple words -----

if [ "${1:-}" = --status ]; then
  look
  echo "output: ${out_name:-none}"
  echo "mode in use: ${out_mode:-unknown}"
  echo "framebuffer: ${out_screen:-unknown}"
  echo "wanted: $(display_wanted)"
  echo "recoveries in the last 10 minutes: $(kept_number recoveries)"
  echo
  echo "the last events:"
  tail -n 20 "$events_file" 2> /dev/null || echo "none yet"
  exit 0
fi

if [ "${1:-}" = --apply ]; then
  look
  if [ -z "${out_name:-}" ]; then
    say "no screen is connected, so there is nothing to set."
    exit 0
  fi
  set_display || true
  look
  note reapplied_mode "${out_name:-none} ${out_mode:-unknown} framebuffer ${out_screen:-unknown}"
  recoveries=$(kept_number recoveries)
  recovery_at=$(kept_number recoveryAt)
  write_state
  exit 0
fi

if [ "${1:-}" = --test ]; then
  # The whole path with nothing touched: this is what would happen if the TV came back now
  echo "1. a screen appears where there was none"
  echo "2. wait $settle_seconds seconds for its mode to settle"
  echo "3. set_display picks from the modes the TV lists (wanted: $(display_wanted))"
  echo "4. ask the page to load again"
  echo "5. if no frame has been painted after $frame_wait_seconds seconds, restart teletraan-kiosk"
  echo "   at most $most_recoveries of these in $((recovery_window / 60)) minutes"
  echo
  echo "now: output ${out_name:-}, nothing was changed."
  look
  echo "output ${out_name:-none}, mode ${out_mode:-unknown}, framebuffer ${out_screen:-unknown}"
  exit 0
fi

# ----- one look -----

look
before_name=$(kept output)
before_mode=$(kept mode)
before_screen=$(kept framebuffer)
recoveries=$(kept_number recoveries)
recovery_at=$(kept_number recoveryAt)
now=$(date +%s)

# The count of recoveries ages out, so a bad afternoon does not stop it helping tomorrow
if [ "$recovery_at" -gt 0 ] && [ $((now - recovery_at)) -gt "$recovery_window" ]; then
  recoveries=0
  recovery_at=0
fi

# Nothing is known yet: write what is there and do nothing. The first run after an install must not restart anything.
if [ ! -f "$state_file" ]; then
  write_state
  note first_look "${out_name:-none} ${out_mode:-unknown} framebuffer ${out_screen:-unknown}"
  exit 0
fi

wanted=$(display_wanted)
need_recovery=no
reason=''

if [ -z "${out_name:-}" ]; then
  if [ -n "$before_name" ]; then
    note display_disconnected "$before_name went away"
  fi
  write_state
  exit 0
fi

if [ -z "$before_name" ]; then
  need_recovery=yes
  reason="the screen came back as $out_name"
  note display_connected "$out_name ${out_mode:-unknown}"
elif [ "${out_screen:-}" != "$wanted" ] && [ -n "${out_screen:-}" ]; then
  need_recovery=yes
  reason="the framebuffer is ${out_screen} and should be $wanted"
elif [ "${out_mode:-}" != "$before_mode" ] && [ -n "${out_mode:-}" ] && [ -n "$before_mode" ]; then
  need_recovery=yes
  reason="the mode changed from $before_mode to ${out_mode}"
fi

if [ "$need_recovery" = no ]; then
  write_state
  exit 0
fi

if [ "$recoveries" -ge "$most_recoveries" ]; then
  note display_recovery_giving_up "$reason, but there have already been $recoveries recoveries"
  say "$reason, but $recoveries recoveries have been made in the last $((recovery_window / 60)) minutes, so the screen is left alone."
  write_state
  exit 0
fi

say "$reason. Setting the screen again."
sleep "$settle_seconds"
set_display || true
look
note reapplied_mode "$reason -> ${out_mode:-unknown} framebuffer ${out_screen:-unknown}"

recoveries=$((recoveries + 1))
recovery_at=$now
write_state

if reload_page; then
  note reload "after setting the mode again"
else
  note reload "could not be asked for"
fi

sleep "$frame_wait_seconds"
if frames_painted; then
  say "the page is drawing again."
  note recovered "frames are being painted"
  exit 0
fi

note kiosk_restart "no frames $frame_wait_seconds seconds after the reload"
say "no frames after the reload, so the screen session is restarted."
"$node_bin" "$computer/scripts/ledger.mjs" action display 3 restart-kiosk "display recovery" > /dev/null 2>&1 || true
if ! sudo -n "$systemctl_bin" restart teletraan-kiosk.service > /dev/null 2>&1; then
  say "the restart was refused. Check that computer/sudoers/teletraan-control is installed." >&2
  note kiosk_restart_refused "sudo refused"
  exit 1
fi
