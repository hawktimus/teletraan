#!/bin/bash
# Which list of systems EmulationStation shows on the Pi (computer/pi/README.md, "The menu").
#
#   menu.sh menu            the first screen: Teletraan, Meeting, Arcade, Lo-Fi
#   menu.sh arcade          the game systems, with a Main Menu entry to go back
#   menu.sh full            the whole list of the system, as before the menu existed (removes the user list)
#   menu.sh lofi            Lo-Fi Radio alone, with a Main Menu entry to go back (the Lo-Fi tile of the home screen)
#   menu.sh <list> restart  the same, and EmulationStation starts again at once to show it
#   menu.sh quit            EmulationStation ends and is not started again here: the home screen (home.sh) takes over
#
# Without restart it only changes the file, which is what the start of the console does (autostart.sh), before
# EmulationStation is up. The lists are made by es-systems.py when the Pi is installed.
set -eu
es=${ES_HOME:-$HOME/.emulationstation}
list=${1:-}

# Stops the program of EmulationStation and nothing else. The wrapper (emulationstation.sh) has the same name in the
# process list (cut to 15 letters, "emulationstatio"), so the program is told apart by the file it runs from.
# If the wrapper were stopped too, nothing would start EmulationStation again and the TV would stay on the terminal.
stop_program() {
  local program=/opt/retropie/supplementary/emulationstation/emulationstation pid
  for pid in $(pgrep -x emulationstatio || true); do
    if [ "$(readlink "/proc/$pid/exe" 2> /dev/null)" = "$program" ]; then kill "$pid"; fi
  done
}

if [ "$list" = quit ]; then
  stop_program
  exit 0
fi

case $list in
  menu | arcade | lofi)
    [ -f "$es/es_systems.$list.cfg" ] || { echo "Stopped: $es/es_systems.$list.cfg is not there. Run install-pi.sh again." >&2; exit 1; }
    cp "$es/es_systems.$list.cfg" "$es/es_systems.cfg.new"
    mv -f "$es/es_systems.cfg.new" "$es/es_systems.cfg"
    ;;
  full)
    rm -f "$es/es_systems.cfg"
    ;;
  *)
    echo "Usage: $0 menu|arcade|lofi|full [restart], or $0 quit" >&2
    exit 1
    ;;
esac

if [ "${2:-}" = restart ]; then
  # The same thing that Restart EmulationStation in its own menu does: the wrapper starts it again when /tmp/es-restart is there
  touch /tmp/es-restart
  stop_program
fi
