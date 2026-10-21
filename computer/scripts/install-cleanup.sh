#!/bin/bash
# Usage: sudo install-cleanup.sh
# Installs the clean up of expired items: copies its two systemd unit files and turns on its timer, which starts
# expired-cleanup.sh at 03:40 every night. The script deletes only when Clean up expired items is on in Dashboard Settings
# and its Mode is Delete, and both are off to start with, so installing this deletes nothing. It checks that the packages
# the script needs are installed. It does not install them. It needs no sudoers rule: the script runs as the login user.
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
for unit in teletraan-cleanup.service teletraan-cleanup.timer; do
  if [ ! -s "$units/$unit" ]; then
    echo "The unit file $units/$unit is missing or empty. Pull the newest files first." >&2
    exit 1
  fi
done

for script in expired-cleanup.sh cleanup-plan.mjs; do
  if [ ! -s "$computer/scripts/$script" ]; then
    echo "$computer/scripts/$script is missing. Pull the newest files first." >&2
    exit 1
  fi
done
if [ ! -x "$computer/scripts/expired-cleanup.sh" ]; then
  echo "$computer/scripts/expired-cleanup.sh cannot be run." >&2
  exit 1
fi

missing=""
command -v curl > /dev/null 2>&1 || missing="$missing curl"
command -v jq > /dev/null 2>&1 || missing="$missing jq"
command -v node > /dev/null 2>&1 || missing="$missing nodejs"
command -v flock > /dev/null 2>&1 || missing="$missing util-linux"
if [ -n "$missing" ]; then
  echo "These packages are not installed:$missing" >&2
  echo "Ask the team mentor, install them (node must be version 18 or newer), and run this again:" >&2
  echo "  sudo apt install curl jq nodejs util-linux" >&2
  exit 1
fi
if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)' 2> /dev/null; then
  echo "Node is older than version 18. See docs/rebuilding-the-computer.md, step 19." >&2
  exit 1
fi

# The token is only looked for, never shown
if ! grep -Eq "^SANITY_WRITE_TOKEN=['\"]?[A-Za-z0-9_.-]+" "$computer/local.env" 2> /dev/null; then
  echo "Note: SANITY_WRITE_TOKEN is not in $computer/local.env. The clean up reads drafts and deletes with it, so it" >&2
  echo "does nothing until the key is added (the control page, Settings, Keys)." >&2
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

echo "This will:"
echo "  1. copy these files to $target, set to run as the account $account:"
echo "       teletraan-cleanup.service"
echo "       teletraan-cleanup.timer"
echo "  2. reload systemd"
echo "  3. turn on teletraan-cleanup.timer (every night at 03:40), and restart it so a"
echo "     changed schedule is used"
echo "Nothing is deleted until Clean up expired items is turned on and its Mode is Delete (docs/expired-cleanup.md)."
echo
printf 'Press Enter to go ahead, or Ctrl+C to stop. '
read -r answer

tmp=$(mktemp)
for unit in teletraan-cleanup.service teletraan-cleanup.timer; do
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
if grep -q '^User=ACCOUNT$' "$target/teletraan-cleanup.service"; then
  echo "The account name was not filled in. Check the User= line in $units." >&2
  exit 1
fi

systemctl daemon-reload
systemctl enable --now teletraan-cleanup.timer

# A timer that is already running may keep the schedule it started with, so
# a changed timer file is only certain to be used after a restart
systemctl restart teletraan-cleanup.timer
systemctl list-timers 'teletraan-cleanup*'
