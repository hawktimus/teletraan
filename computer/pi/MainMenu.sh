#!/bin/bash
# The entry of the Main Menu system, the first one in the Arcade and in Lo-Fi (computer/pi/README.md, "The home screen").
# With the home screen up it quits EmulationStation, and the home screen is shown again. Without it (the console was
# started the way it was before) it shows the menu list of EmulationStation: Teletraan, Meeting, Arcade, Lo-Fi.
if [ -e "/run/user/$(id -u)/teletraan-home" ]; then
  exec /opt/teletraan/computer/pi/menu.sh quit
fi
exec /opt/teletraan/computer/pi/menu.sh menu restart
