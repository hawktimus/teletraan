#!/bin/bash
# Usage: sudo install-watchdog.sh
# Installs the watchdog: copies its two systemd unit files and turns on its
# timer, which starts watchdog.sh every 2 minutes. The watchdog restarts the
# screen when it has frozen. It runs as root, so the unit file names no account.
# It checks that the tools the script needs are installed. It does not install
# them. Run it again after kiosk.sh changes, and restart the screen once
# (tools/teletraan/teletraan-tool restart), because the browser only opens its page
# list for the watchdog when kiosk.sh has started it.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

units="$computer/systemd"
repo=$(cd "$computer/.." && pwd -P)
target=/etc/systemd/system

# The unit files name the repository location directly
expected_repo=/opt/teletraan

# These checks only read, so they come first and nothing is changed until they
# pass. An empty unit file would be installed as an empty unit, so it counts as
# missing.
for unit in teletraan-watchdog.service teletraan-watchdog.timer; do
  if [ ! -s "$units/$unit" ]; then
    echo "The unit file $units/$unit is missing or empty. Pull the newest files first." >&2
    exit 1
  fi
done

if [ ! -x "$computer/scripts/watchdog.sh" ]; then
  echo "$computer/scripts/watchdog.sh is missing or cannot be run." >&2
  exit 1
fi

missing=""
command -v curl > /dev/null 2>&1 || missing="$missing curl"
command -v pgrep > /dev/null 2>&1 || missing="$missing procps"
command -v awk > /dev/null 2>&1 || missing="$missing gawk"
if [ -n "$missing" ]; then
  echo "These packages are not installed:$missing" >&2
  echo "Ask the team mentor, install them, and run this again:" >&2
  echo "  sudo apt install curl procps gawk" >&2
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "This changes the system, so it has to run with sudo:" >&2
  echo "  sudo $0" >&2
  exit 1
fi

if [ "$repo" != "$expected_repo" ]; then
  echo "The unit files expect the repository at $expected_repo, but it is at $repo." >&2
  echo "Move it there, or change the paths in the files in $units first." >&2
  exit 1
fi

echo "This will:"
echo "  1. copy these files to $target:"
echo "       teletraan-watchdog.service"
echo "       teletraan-watchdog.timer"
echo "  2. reload systemd"
echo "  3. turn on teletraan-watchdog.timer (every 2 minutes), and restart it so a"
echo "     changed schedule is used"
echo
printf 'Press Enter to go ahead, or Ctrl+C to stop. '
read -r answer

for unit in teletraan-watchdog.service teletraan-watchdog.timer; do
  install -m 644 "$units/$unit" "$target/$unit"
  if [ ! -s "$target/$unit" ]; then
    echo "The copy of $unit came out empty, so the watchdog was not turned on." >&2
    exit 1
  fi
done

systemctl daemon-reload
systemctl enable --now teletraan-watchdog.timer

# A timer that is already running may keep the schedule it started with, so
# a changed timer file is only certain to be used after a restart
systemctl restart teletraan-watchdog.timer
systemctl list-timers 'teletraan-watchdog*'
