#!/bin/bash
# Teletraan on the TV of the Raspberry Pi, started from EmulationStation (Ports, Teletraan).
# It starts the web server and the sync service, shows the dashboard full screen, and when the browser is closed it
# stops them again and EmulationStation is back. Leave with Select + Start on a controller, or Ctrl + Alt + Backspace.
# computer/pi/README.md has the rest.
set -u
here=/opt/teletraan/computer/pi
address=http://127.0.0.1:8080/dashboard/

sudo systemctl start teletraan-pi.target

# The page is asked for until the web server answers, for 15 seconds at most.
for _ in $(seq 1 60); do
  curl -fs -o /dev/null --max-time 2 "$address" && break
  sleep 0.25
done

# The same way the other full screen programs of this Pi take the screen: an X server on the console.
sudo xinit "$here/session.sh" "$address" -- :0 vt1 -nolisten tcp -quiet -nocursor > /dev/null 2>&1

sudo systemctl stop teletraan-pi.target
