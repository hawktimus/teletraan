#!/bin/bash
# Teletraan on the TV of the Raspberry Pi, started from EmulationStation (Teletraan, then Dashboard or Control).
# $1 says what to show: dashboard, which is also what it shows with nothing, or control.
# It starts the web server, the sync service and the control service, shows the page full screen, and when the
# browser is closed it stops them again and EmulationStation is back.
# In the dashboard: X is next, Z is back, Esc leaves, Right Shift opens the control page. computer/pi/README.md has the rest.
set -u
here=/opt/teletraan/computer/pi
base=http://127.0.0.1:8080

case ${1:-dashboard} in
  control)
    page=control
    address=$base/control/
    ;;
  *)
    page=dashboard
    # ?keys=console turns on the keys of this copy (dashboard/core/console-keys.js)
    address="$base/dashboard/?keys=console"
    ;;
esac

sudo systemctl start teletraan-pi.target

# The page is asked for until the web server answers, for 15 seconds at most.
for _ in $(seq 1 60); do
  curl -fs -o /dev/null --max-time 2 "$address" && break
  sleep 0.25
done

# The same way the other full screen programs of this Pi take the screen: an X server on the console.
# The dashboard hides the mouse pointer itself, and the control page needs it.
sudo xinit "$here/session.sh" "$address" "$page" -- :0 vt1 -nolisten tcp -quiet > /dev/null 2>&1

sudo systemctl stop teletraan-pi.target
