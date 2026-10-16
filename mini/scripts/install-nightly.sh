#!/bin/sh
# Installs the nightly restarts: copies the two systemd unit files and turns on the
# timer, which starts nightly.sh at 04:00 every day and at 04:10 on Sundays. The script
# restarts the screen at 04:00 and reboots the Mini on Sunday, and skips either when a
# presentation is booked within the hour. It runs as root, so the unit file names no
# account. It checks that curl is installed. It does not install anything.
set -eu

mini=$(cd "$(dirname "$0")/.." && pwd)
units="$mini/systemd"
repo=$(cd "$mini/.." && pwd -P)
target=/etc/systemd/system

# The unit files name the repository location directly
expected_repo=/opt/teletraan

# These checks only read, so they come first and nothing is changed until they
# pass. An empty unit file would be installed as an empty unit, so it counts as
# missing.
for unit in teletraan-nightly.service teletraan-nightly.timer; do
  if [ ! -s "$units/$unit" ]; then
    echo "The unit file $units/$unit is missing or empty. Pull the newest files first." >&2
    exit 1
  fi
done

if [ ! -x "$mini/scripts/nightly.sh" ]; then
  echo "$mini/scripts/nightly.sh is missing or cannot be run." >&2
  exit 1
fi

missing=""
command -v curl > /dev/null 2>&1 || missing="$missing curl"
if [ -n "$missing" ]; then
  echo "These packages are not installed:$missing" >&2
  echo "Ask the team mentor, install them, and run this again:" >&2
  echo "  sudo apt install curl" >&2
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
echo "       teletraan-nightly.service"
echo "       teletraan-nightly.timer"
echo "  2. reload systemd"
echo "  3. turn on teletraan-nightly.timer (at 04:00, and on Sundays at 04:10), and restart it so a"
echo "     changed schedule is used"
echo
printf 'Press Enter to go ahead, or Ctrl+C to stop. '
read -r answer

for unit in teletraan-nightly.service teletraan-nightly.timer; do
  install -m 644 "$units/$unit" "$target/$unit"
  if [ ! -s "$target/$unit" ]; then
    echo "The copy of $unit came out empty, so the nightly restarts were not turned on." >&2
    exit 1
  fi
done

systemctl daemon-reload
systemctl enable --now teletraan-nightly.timer

# A timer that is already running may keep the schedule it started with, so
# a changed timer file is only certain to be used after a restart
systemctl restart teletraan-nightly.timer
systemctl list-timers 'teletraan-nightly*'
