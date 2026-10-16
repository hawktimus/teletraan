#!/bin/sh
# The host side of the control page. teletraan-control.socket starts one copy of this for each connection,
# as the login user, with the connection as standard input and output. The first line is a word and an optional
# argument. write-env also reads the new local.env from the rest of the input. Anything that is not one of the
# words below is refused with one line in the log. The last line of the answer is ok, refused or failed <code>.
#
# Only the commands the sudoers drop-in allows are run with sudo (mini/sudoers/teletraan-control).
set -u

root=${TELETRAAN_ROOT:-/opt/teletraan}
log_file="$root/logs/helper.log"

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "$log_file" 2> /dev/null || true
}

refuse() {
  log "refused: $1"
  echo "refused"
  exit 0
}

finish() {
  if [ "$1" -eq 0 ]; then
    echo "ok"
  else
    echo "failed $1"
  fi
  exit 0
}

IFS= read -r line || exit 0
word=${line%% *}
argument=''
case $line in
  *' '*) argument=${line#* } ;;
esac

# The log line shows only a short, plain version of what was asked
shown=$(printf '%s' "$line" | tr -c 'A-Za-z0-9 -' '?' | cut -c 1-40)

case $word in
  restart-kiosk|restart-services|reboot|status|monday-check)
    [ -z "$argument" ] || refuse "$shown"
    ;;
  sync-now)
    case $argument in
      calendars|monday|frc) ;;
      *) refuse "$shown" ;;
    esac
    ;;
  write-env)
    [ -z "$argument" ] || refuse "$shown"
    ;;
  *) refuse "$shown" ;;
esac

log "$word${argument:+ $argument}"

case $word in
  restart-kiosk)
    sudo -n systemctl restart teletraan-kiosk.service
    finish $?
    ;;
  restart-services)
    # The web server is a container here, and a restart makes it read the release that current points at
    if command -v docker > /dev/null 2>&1; then
      docker restart teletraan-web > /dev/null 2>&1 || sudo -n systemctl restart nginx > /dev/null 2>&1 || true
    else
      sudo -n systemctl restart nginx > /dev/null 2>&1 || true
    fi
    for timer in calendars monday slides watchdog nightly; do
      sudo -n systemctl restart "teletraan-$timer.timer" > /dev/null 2>&1 || true
    done
    finish 0
    ;;
  reboot)
    echo "The Mini reboots in 3 seconds."
    ( sleep 3; sudo -n /sbin/reboot ) > /dev/null 2>&1 &
    finish 0
    ;;
  status)
    echo "user=$(id -un)"
    echo "host=$(hostname 2> /dev/null | tr -c 'A-Za-z0-9.-' '?')"
    echo "kiosk=$(systemctl is-active teletraan-kiosk.service 2> /dev/null || true)"
    echo "uptime=$(cut -d' ' -f1 /proc/uptime 2> /dev/null || true)"
    echo "diskFreeKb=$(df -Pk "$root" 2> /dev/null | awk 'NR == 2 { print $4 }')"
    echo "tailscale=$(tailscale ip -4 2> /dev/null | head -n 1)"
    echo "display=$(journalctl -u teletraan-kiosk.service -n 300 --no-pager 2> /dev/null | grep 'display:' | tail -n 1 | cut -c 1-200)"
    finish 0
    ;;
  sync-now)
    sudo -n systemctl start "teletraan-$argument.service"
    finish $?
    ;;
  monday-check)
    "$root/mini/scripts/monday-sync.sh" --check
    finish $?
    ;;
  write-env)
    temporary="$root/local.env.new"
    ( umask 077; head -c 65536 > "$temporary" ) 2> /dev/null || finish 1
    # A line is a comment, empty, or NAME=value. Anything else means the text was not an env file.
    if [ ! -s "$temporary" ] || grep -Eqv '^([A-Za-z_][A-Za-z0-9_]*=.*|#.*|[[:space:]]*)$' "$temporary"; then
      rm -f "$temporary"
      log "write-env refused: not an env file"
      echo "refused"
      exit 0
    fi
    chmod 600 "$temporary"
    [ ! -f "$root/local.env" ] || cp -p "$root/local.env" "$root/local.env.previous" 2> /dev/null || true
    mv -f "$temporary" "$root/local.env"
    finish $?
    ;;
esac
