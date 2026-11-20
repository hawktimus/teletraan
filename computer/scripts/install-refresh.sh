#!/bin/bash
# Usage: sudo install-refresh.sh
# Installs the pre-meeting refresh: copies its two systemd unit files and turns on its timer, which wakes
# pre-meeting-refresh.sh every 5 minutes. The script acts only at its time on a refresh day (13:30 on weekdays to start with,
# Dashboard Settings, Computer), so installing this does nothing at once. It checks that the packages the script needs are installed.
# It does not install them. It also checks that the sudoers drop-in allows the reboot.
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
for unit in teletraan-refresh.service teletraan-refresh.timer; do
  if [ ! -s "$units/$unit" ]; then
    echo "The unit file $units/$unit is missing or empty. Pull the newest files first." >&2
    exit 1
  fi
done

for script in pre-meeting-refresh.sh refresh-plan.mjs refresh-context.mjs; do
  if [ ! -s "$computer/scripts/$script" ]; then
    echo "$computer/scripts/$script is missing. Pull the newest files first." >&2
    exit 1
  fi
done
if [ ! -x "$computer/scripts/pre-meeting-refresh.sh" ]; then
  echo "$computer/scripts/pre-meeting-refresh.sh cannot be run." >&2
  exit 1
fi

missing=""
command -v curl > /dev/null 2>&1 || missing="$missing curl"
command -v jq > /dev/null 2>&1 || missing="$missing jq"
command -v node > /dev/null 2>&1 || missing="$missing nodejs"
if [ -n "$missing" ]; then
  echo "These packages are not installed:$missing" >&2
  echo "Ask the team mentor, install them (node must be version 18 or newer), and run this again:" >&2
  echo "  sudo apt install curl jq nodejs" >&2
  exit 1
fi
if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)' 2> /dev/null; then
  echo "Node is older than version 18. See docs/rebuilding-the-computer.md, step 19." >&2
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

# Everything runs as the account that owns the repository, so the account's
# name is not written in the unit files. They say ACCOUNT, and it is replaced
# with the real name as each file is copied.
account=$(stat -c %U "$repo")
if [ "$account" = root ] || [ "$account" = UNKNOWN ] || ! id "$account" > /dev/null 2>&1; then
  echo "The repository at $repo is owned by $account, and the timer should not run as that." >&2
  echo "Give it to the account the Teletraan computer logs in with. If that account is called hawktimus:" >&2
  echo "  sudo chown -R hawktimus:hawktimus $repo" >&2
  exit 1
fi

# The reboot is the one the control page uses, so the same sudoers file has to be there
if ! grep -qs '/usr/bin/systemctl reboot' /etc/sudoers.d/teletraan-control; then
  echo "Note: /etc/sudoers.d/teletraan-control does not allow the reboot yet. Run computer/install.sh again, or the" >&2
  echo "scheduled reboot will log that it was refused." >&2
fi

echo "This will:"
echo "  1. copy these files to $target, set to run as the account $account:"
echo "       teletraan-refresh.service"
echo "       teletraan-refresh.timer"
echo "  2. reload systemd"
echo "  3. turn on teletraan-refresh.timer (every 5 minutes), and restart it so a"
echo "     changed schedule is used"
echo "Nothing is touched before the time set in Dashboard Settings, Computer, Pre-meeting refresh."
echo
printf 'Press Enter to go ahead, or Ctrl+C to stop. '
read -r answer

tmp=$(mktemp)
for unit in teletraan-refresh.service teletraan-refresh.timer; do
  sed "s/^User=ACCOUNT\$/User=$account/" "$units/$unit" > "$tmp"
  if [ ! -s "$tmp" ]; then
    echo "The copy of $unit came out empty, so nothing was installed." >&2
    rm -f "$tmp"
    exit 1
  fi
  install -m 644 "$tmp" "$target/$unit"
done
rm -f "$tmp"

# The substitution does nothing if a unit file was edited, and the service would
# then fail later with a confusing message
if grep -q '^User=ACCOUNT$' "$target/teletraan-refresh.service"; then
  echo "The account name was not filled in. Check the User= line in $units." >&2
  exit 1
fi

systemctl daemon-reload
systemctl enable --now teletraan-refresh.timer

# A timer that is already running may keep the schedule it started with, so
# a changed timer file is only certain to be used after a restart
systemctl restart teletraan-refresh.timer
systemctl list-timers 'teletraan-refresh*'
