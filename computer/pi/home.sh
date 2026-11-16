#!/bin/bash
# The home screen of the console: shows the page of tiles (launcher/), starts what was chosen, and shows the page again
# when that ends. computer/pi/README.md, "The home screen".
#
#   home.sh
#
# Dashboard, Control, Meeting and Game Drop (the stream) are shown by launch.sh and end with Esc. Arcade and Lo-Fi hand the
# screen to EmulationStation with the matching list (menu.sh), and the Main Menu entry in there (or Quit) brings this back.
# autostart.sh runs it before EmulationStation. If the page cannot be shown twice in a row, or if it ends with nothing
# chosen, this ends and the start of the console goes on to EmulationStation with the menu list, the way it was before
# the home screen. It never runs as root and starts nothing at boot by itself.
set -u
here=${TELETRAAN_PI:-/opt/teletraan/computer/pi}
run=${TELETRAAN_RUN:-/run/user/$(id -u)}
es=${TELETRAAN_ES:-emulationstation}
choice_file=$run/teletraan-choice
# While this file is there, the Main Menu entry of EmulationStation quits it instead of starting the menu list (MainMenu.sh)
marker=$run/teletraan-home

mkdir -p "$run" 2> /dev/null
: > "$marker" 2> /dev/null
trap 'rm -f "$marker" "$choice_file"' EXIT

last=dashboard
misses=0
while true; do
  rm -f "$choice_file"
  "$here/launch.sh" home "$last"
  choice=$(cat "$choice_file" 2> /dev/null || true)
  rm -f "$choice_file"
  case $choice in
    dashboard | control | meeting | stream)
      last=$choice
      misses=0
      "$here/launch.sh" "$choice"
      ;;
    arcade | lofi)
      last=$choice
      misses=0
      "$here/menu.sh" "$choice" || break
      "$es"
      ;;
    *)
      # The page ended without a choice: Ctrl + Alt + Backspace, or the browser did not start
      misses=$((misses + 1))
      [ "$misses" -ge 2 ] && break
      sleep 1
      ;;
  esac
done
exit 0
