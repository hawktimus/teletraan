#!/bin/sh
# Installs the systemd units for the Mini and turns on the two timers: one
# downloads the calendars, one pulls the repository. The kiosk unit is copied
# but not turned on, because it takes over the screen.
set -eu

deploy=$(cd "$(dirname "$0")/.." && pwd)
units="$deploy/systemd"
repo=$(cd "$deploy/.." && pwd -P)
target=/etc/systemd/system

# The unit files name these two things directly
expected_repo=/opt/teletraan
expected_user=teletraan

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

if ! id "$expected_user" > /dev/null 2>&1; then
  echo "The unit files run everything as a user called $expected_user, and there is none." >&2
  echo "Create the user, or change User= in the files in $units first." >&2
  exit 1
fi

echo "This will:"
echo "  1. copy these files to $target:"
for unit in "$units"/teletraan-*; do
  echo "       $(basename "$unit")"
done
echo "  2. reload systemd"
echo "  3. turn on teletraan-calendars.timer (every 15 minutes)"
echo "     and teletraan-pull.timer (every 5 minutes), and restart them so a"
echo "     changed schedule is used"
echo "It does not turn on the kiosk. To do that later:"
echo "  sudo systemctl enable teletraan-kiosk.service"
echo
printf 'Press Enter to go ahead, or Ctrl+C to stop. '
read -r answer

for unit in "$units"/teletraan-*; do
  install -m 644 "$unit" "$target/"
done

systemctl daemon-reload
systemctl enable --now teletraan-calendars.timer teletraan-pull.timer

# A timer that is already running may keep the schedule it started with, so
# a changed timer file is only certain to be used after a restart
systemctl restart teletraan-calendars.timer teletraan-pull.timer
systemctl list-timers 'teletraan-*'
