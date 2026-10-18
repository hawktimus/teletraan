#!/bin/bash
# Usage: control-helper.sh   (started by teletraan-control.socket; reads one command line from standard input)
# The host side of the control page. teletraan-control.socket starts one copy of this for each connection,
# as the login user, with the connection as standard input and output. The first line is a word and an optional
# argument. write-env also reads the new local.env from the rest of the input. Anything that is not one of the
# words below is refused with one line in the log. The last line of the answer is ok, refused or failed <code>.
#
# Only the commands the sudoers drop-in allows are run with sudo (computer/sudoers/teletraan-control). They are
# run by full path, because sudo matches the path it finds, and the same path is in that file.
#
# Nothing started here may be left running after the answer: when this script ends, systemd stops the whole
# service, and a background job goes with it. That is why the reboot is asked for before the answer is sent.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

root=${TELETRAAN_ROOT:-/opt/teletraan}
log_file="$root/logs/helper.log"
systemctl_bin=${TELETRAAN_SYSTEMCTL:-/usr/bin/systemctl}
docker_bin=${TELETRAAN_DOCKER:-/usr/bin/docker}

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "$log_file" 2> /dev/null || true
}

# Runs a command as root through sudo. When it fails, its first lines go into the answer and the log, so the page
# can say why ("a password is required" means the sudoers file is not installed or does not allow the command).
as_root() {
  local said code=0
  said=$(sudo -n "$@" 2>&1) || code=$?
  if [ "$code" -ne 0 ]; then
    [ -z "$said" ] || printf '%s\n' "$said" | head -n 3 | cut -c 1-160
    log "failed $code: $(printf '%s' "$said" | head -n 1 | tr -c 'A-Za-z0-9 .:/_-' '?' | cut -c 1-100)"
  fi
  return "$code"
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
  restart-kiosk|restart-services|reboot|status|monday-check|mirror-start|mirror-watch|mirror-status)
    [ -z "$argument" ] || refuse "$shown"
    ;;
  sync-now)
    case $argument in
      calendars|monday|frc|photos-drive) ;;
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
    code=0
    as_root "$systemctl_bin" restart teletraan-kiosk.service || code=$?
    finish "$code"
    ;;
  restart-services)
    # The web server is a container here, and a restart makes it read the release that current points at. It goes
    # last, because the page reaches this helper through it and loses its connection when it restarts.
    for timer in calendars monday slides watchdog nightly; do
      sudo -n "$systemctl_bin" restart "teletraan-$timer.timer" > /dev/null 2>&1 || true
    done
    code=0
    as_root "$docker_bin" restart teletraan-web || code=$?
    finish "$code"
    ;;
  reboot)
    code=0
    as_root "$systemctl_bin" reboot || code=$?
    [ "$code" -ne 0 ] || echo "The Teletraan computer is rebooting."
    finish "$code"
    ;;
  status)
    echo "user: $(id -un)"
    echo "host: $(hostname 2> /dev/null | tr -c 'A-Za-z0-9.-' '?')"
    echo "kiosk: $(systemctl is-active teletraan-kiosk.service 2> /dev/null || true)"
    echo "uptime: $(cut -d' ' -f1 /proc/uptime 2> /dev/null || true)"
    echo "diskFreeKb: $(df -Pk "$root" 2> /dev/null | awk 'NR == 2 { print $4 }')"
    echo "tailscale: $(tailscale ip -4 2> /dev/null | head -n 1 || true)"
    echo "display: $(journalctl -u teletraan-kiosk.service -n 300 --no-pager 2> /dev/null | grep 'display:' | tail -n 1 | sed 's/^.*display: //' | cut -c 1-200)"
    finish 0
    ;;
  sync-now)
    code=0
    as_root "$systemctl_bin" start "teletraan-$argument.service" || code=$?
    finish "$code"
    ;;
  monday-check)
    code=0
    "$root/computer/scripts/monday-sync.sh" --check || code=$?
    finish "$code"
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
    code=0
    mv -f "$temporary" "$root/local.env" || code=$?
    finish "$code"
    ;;
  mirror-start|mirror-watch|mirror-status)
    # The picture of the screen (computer/scripts/mirror.py). It needs python3 and nothing else. mirror-watch also
    # touches the file that keeps it running, and starting a service that already runs does nothing.
    if ! command -v python3 > /dev/null 2>&1; then
      echo "mirror: no python3"
      finish 0
    fi
    mirror_data=${TELETRAAN_DATA_DIR:-$(setting TELETRAAN_DATA)}
    mirror_data=${mirror_data:-/var/lib/teletraan/data}
    code=0
    # The web server reads this folder as another user, so it is made by the login user and open to read
    if [ "$word" != mirror-status ]; then
      { mkdir -p "$mirror_data/mirror" && chmod 755 "$mirror_data/mirror"; } || code=$?
    fi
    if [ "$word" = mirror-watch ] && [ "$code" -eq 0 ]; then
      { touch "$mirror_data/mirror/watch" && chmod 644 "$mirror_data/mirror/watch"; } || code=$?
    fi
    if [ "$word" != mirror-status ] && [ "$code" -eq 0 ]; then
      as_root "$systemctl_bin" start teletraan-mirror.service || code=$?
    fi
    if "$systemctl_bin" is-active --quiet teletraan-mirror.service 2> /dev/null; then
      echo "mirror: running"
    else
      echo "mirror: stopped"
    fi
    finish "$code"
    ;;
esac
