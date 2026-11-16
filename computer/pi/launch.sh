#!/bin/bash
# Teletraan on the TV of the Raspberry Pi, started from EmulationStation (Teletraan, then Dashboard or Control; Meeting).
# $1 says what to show: dashboard, which is also what it shows with nothing, control, or meeting, which is the list of
# presentations from the Google Drive folder (docs/presentations-drive.md), and Esc leaves it. Two more are for the
# home screen (home.sh): home, the page of tiles ($2 is the tile that is marked, the one chosen last), and stream, the
# live stream of the FIRST Kickoff in the browser (KICKOFF_URL in /opt/teletraan/local.env, or the channel of FIRST).
# It starts the web server, the sync service and the control service, shows the page full screen, and when the
# browser is closed it stops them again and EmulationStation is back.
# In the dashboard: X is next, Z is back, Esc leaves, Right Shift opens the control page. computer/pi/README.md has the rest.
set -u
here=/opt/teletraan/computer/pi
base=http://127.0.0.1:8080
extra=''
mode=${1:-dashboard}

# The address of the Kickoff stream: KICKOFF_URL from local.env when it is there and is a web address, else the live page
# of the FIRST Robotics Competition channel, which shows the stream while there is one. Only that one line is read.
kickoff_address() {
  local url=''
  [ -r /opt/teletraan/local.env ] && url=$(sed -n 's/^KICKOFF_URL=//p' /opt/teletraan/local.env | head -n 1 | tr -d '"'"'"'\r')
  case $url in
    https://*) printf '%s' "$url" ;;
    *) printf '%s' 'https://www.youtube.com/firstroboticscompetition/live' ;;
  esac
}

case $mode in
  home)
    page=launcher
    last=${2:-dashboard}
    case $last in dashboard | control | meeting | stream | arcade | lofi) ;; *) last=dashboard ;; esac
    address="$base/launcher/?focus=$last"
    ;;
  stream)
    page=stream
    address=$(kickoff_address)
    # A live stream has to start by itself, with sound, without anyone clicking
    extra='--autoplay-policy=no-user-gesture-required'
    ;;
  control)
    page=control
    address=$base/control/
    ;;
  meeting)
    # The page is the dashboard, with the list of presentations open and nothing else showing (dashboard/core/decks-run.js)
    page=dashboard
    address="$base/dashboard/?keys=console&meeting=1"
    ;;
  *)
    page=dashboard
    # ?keys=console turns on the keys of this copy (dashboard/core/console-keys.js)
    address="$base/dashboard/?keys=console"
    ;;
esac

# The home screen needs only the web server, and the stream needs none of it
case $mode in
  home) sudo systemctl start teletraan-pi-web.service ;;
  stream) ;;
  *) sudo systemctl start teletraan-pi.target ;;
esac

# The page is asked for until the web server answers, for 15 seconds at most.
if [ "$mode" != stream ]; then
  for _ in $(seq 1 60); do
    curl -fs -o /dev/null --max-time 2 "$address" && break
    sleep 0.25
  done
fi

# The same way the other full screen programs of this Pi take the screen: an X server on the console.
# The dashboard hides the mouse pointer itself, and the control page needs it.
sudo xinit "$here/session.sh" "$address" "$page" "$extra" -- :0 vt1 -nolisten tcp -quiet > /dev/null 2>&1

case $mode in
  home) sudo systemctl stop teletraan-pi-web.service ;;
  stream) ;;
  *) sudo systemctl stop teletraan-pi.target ;;
esac
