#!/bin/bash
# Which list of systems EmulationStation shows on the Pi (computer/pi/README.md, "The menu").
#
#   menu.sh menu            the first screen: Teletraan, Meeting, Arcade, Lo-Fi
#   menu.sh arcade          the game systems, with a Main Menu entry to go back
#   menu.sh full            the whole list of the system, as before the menu existed (removes the user list)
#   menu.sh <list> restart  the same, and EmulationStation starts again at once to show it
#
# Without restart it only changes the file, which is what the start of the console does (autostart.sh), before
# EmulationStation is up. The lists are made by es-systems.py when the Pi is installed.
set -eu
es=${ES_HOME:-$HOME/.emulationstation}
list=${1:-}

case $list in
  menu | arcade)
    [ -f "$es/es_systems.$list.cfg" ] || { echo "Stopped: $es/es_systems.$list.cfg is not there. Run install-pi.sh again." >&2; exit 1; }
    cp "$es/es_systems.$list.cfg" "$es/es_systems.cfg.new"
    mv -f "$es/es_systems.cfg.new" "$es/es_systems.cfg"
    ;;
  full)
    rm -f "$es/es_systems.cfg"
    ;;
  *)
    echo "Usage: $0 menu|arcade|full [restart]" >&2
    exit 1
    ;;
esac

if [ "${2:-}" = restart ]; then
  # The same thing that Restart EmulationStation in its own menu does: the wrapper (emulationstation.sh) starts
  # it again when /tmp/es-restart is there. The name is cut to 15 letters in the process list.
  touch /tmp/es-restart
  pkill -x emulationstatio || true
fi
