#!/bin/bash
# Usage: sudo install-watchdog.sh
# Installs the watchdog: copies its two systemd unit files and turns on its
# timer, which starts watchdog.sh every 2 minutes. The watchdog restarts the
# screen when it has frozen. It runs as the login user, not root, and the unit file says ACCOUNT where the name goes.
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

# The units run as the account that owns the repository, so the account's name is not written in the unit files.
# They say ACCOUNT, and it is replaced with the real name as each file is copied.
account=$(stat -c %U "$repo")
if [ "$account" = root ] || [ "$account" = UNKNOWN ] || ! id "$account" > /dev/null 2>&1; then
  echo "The repository at $repo is owned by $account, and the timer should not run as that." >&2
  echo "Give it to the account the Teletraan computer logs in with. If that account is called hawktimus:" >&2
  echo "  sudo chown -R hawktimus:hawktimus $repo" >&2
  exit 1
fi

# The restart and the reboot go through sudo, so the same sudoers file as the control page has to be there
if ! grep -qs 'restart teletraan-kiosk.service' /etc/sudoers.d/teletraan-control; then
  echo "Note: /etc/sudoers.d/teletraan-control does not allow the screen restart yet. Run computer/install.sh again, or the" >&2
  echo "watchdog will log that sudo refused it." >&2
fi

# A unit from an earlier install had no User= line and ran as root. It is replaced below.
if [ -f "$target/teletraan-watchdog.service" ] && ! grep -q '^User=' "$target/teletraan-watchdog.service"; then
  echo "The installed teletraan-watchdog.service runs as root. It is replaced by one that runs as $account."
fi

echo "This will:"
echo "  1. copy these files to $target, set to run as the account $account:"
echo "       teletraan-watchdog.service"
echo "       teletraan-watchdog.timer"
echo "  2. reload systemd"
echo "  3. turn on teletraan-watchdog.timer (every 2 minutes), and restart it so a"
echo "     changed schedule is used"
echo
printf 'Press Enter to go ahead, or Ctrl+C to stop. '
read -r answer

tmp=$(mktemp)
for unit in teletraan-watchdog.service teletraan-watchdog.timer; do
  sed "s/^User=ACCOUNT\$/User=$account/" "$units/$unit" > "$tmp"
  if [ ! -s "$tmp" ]; then
    echo "The copy of $unit came out empty, so nothing was installed." >&2
    rm -f "$tmp"
    exit 1
  fi
  install -m 644 "$tmp" "$target/$unit"
done
rm -f "$tmp"

# The substitution does nothing if a unit file was edited, and the service would then fail later with a confusing message
if ! grep -q "^User=$account\$" "$target/teletraan-watchdog.service"; then
  echo "The account name was not filled in. Check the User= line in $units." >&2
  exit 1
fi

# The count of restarts was written by root before this change. The login user has to be able to write it.
data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}
if [ -f "$data/watchdog-state" ]; then
  chown "$account" "$data/watchdog-state"
fi

systemctl daemon-reload
systemctl enable --now teletraan-watchdog.timer

# A timer that is already running may keep the schedule it started with, so
# a changed timer file is only certain to be used after a restart
systemctl restart teletraan-watchdog.timer
systemctl list-timers 'teletraan-watchdog*'
