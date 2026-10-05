#!/bin/bash
# Makes "Ship Teletraan.app", a small app that opens Terminal and runs ship.sh,
# so it can sit in the Dock or in Applications. The app only holds the path to
# "Ship Teletraan.command" in this folder, so if you move the repository, run
# this again. Nothing is installed: it writes one app to the folder you give.
#
#   deploy/mac/make-app.sh                  puts the app on the Desktop
#   deploy/mac/make-app.sh ~/Applications   puts it in that folder
set -eu

here=$(cd "$(dirname "$0")" && pwd)
destination=${1:-"$HOME/Desktop"}
command_file="$here/Ship Teletraan.command"

[ -f "$command_file" ] || { echo "Missing: $command_file" >&2; exit 1; }
[ -d "$destination" ] || { echo "That folder does not exist: $destination" >&2; exit 1; }
command -v osacompile >/dev/null 2>&1 || { echo "osacompile is part of macOS and was not found." >&2; exit 1; }

# 'open -a Terminal' hands the file to Terminal, so macOS does not ask for
# permission to control another app
osacompile -o "$destination/Ship Teletraan.app" -e "do shell script \"open -a Terminal \" & quoted form of \"$command_file\""

echo "Made: $destination/Ship Teletraan.app"
