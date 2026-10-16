#!/bin/bash
# Usage: sudo install-backup.sh
# Installs the nightly backup: copies its two systemd unit files, makes the
# folder /var/backups/teletraan, and turns on the timer, which starts
# backup-dataset.sh at 03:15. It checks that the Sanity tool is installed in
# studio/ and that local.env has the write token. It does not install anything.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

units="$mini/systemd"
repo=$(cd "$mini/.." && pwd -P)
target=/etc/systemd/system
backups=/var/backups/teletraan

# The unit files name the repository location directly
expected_repo=/opt/teletraan

# These checks only read, so they come first and nothing is changed until they
# pass. An empty unit file would be installed as an empty unit, so it counts as
# missing.
for unit in teletraan-backup.service teletraan-backup.timer; do
  if [ ! -s "$units/$unit" ]; then
    echo "The unit file $units/$unit is missing or empty. Pull the newest files first." >&2
    exit 1
  fi
done

if [ ! -x "$mini/scripts/backup-dataset.sh" ]; then
  echo "$mini/scripts/backup-dataset.sh is missing or cannot be run." >&2
  exit 1
fi

if [ ! -x "$repo/studio/node_modules/.bin/sanity" ]; then
  echo "The Sanity tool is not installed in $repo/studio." >&2
  echo "Ask the team mentor, install it, and run this again:" >&2
  echo "  cd $repo/studio && npm install" >&2
  exit 1
fi

missing=""
command -v gzip > /dev/null 2>&1 || missing="$missing gzip"
command -v curl > /dev/null 2>&1 || missing="$missing curl"
if [ -n "$missing" ]; then
  echo "These packages are not installed:$missing" >&2
  echo "Ask the team mentor, install them, and run this again:" >&2
  echo "  sudo apt install gzip curl" >&2
  exit 1
fi

# The token is only looked for, never shown
if ! grep -Eq "^SANITY_WRITE_TOKEN=['\"]?[A-Za-z0-9_.-]+" "$mini/local.env" 2> /dev/null; then
  echo "SANITY_WRITE_TOKEN is not in $mini/local.env, and the export needs it." >&2
  echo "Add it (docs/rebuilding-the-mini.md, the write token) and run this again." >&2
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
  echo "Give it to the account the Mini logs in with. If that account is called hawktimus:" >&2
  echo "  sudo chown -R hawktimus:hawktimus $repo" >&2
  exit 1
fi

echo "This will:"
echo "  1. make the folder $backups, owned by the account $account"
echo "  2. copy these files to $target, set to run as the account $account:"
echo "       teletraan-backup.service"
echo "       teletraan-backup.timer"
echo "  3. reload systemd"
echo "  4. turn on teletraan-backup.timer (every night at 03:15), and restart it so a"
echo "     changed schedule is used"
echo
printf 'Press Enter to go ahead, or Ctrl+C to stop. '
read -r answer

install -d -o "$account" -m 750 "$backups"

tmp=$(mktemp)
for unit in teletraan-backup.service teletraan-backup.timer; do
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
if grep -q '^User=ACCOUNT$' "$target/teletraan-backup.service"; then
  echo "The account name was not filled in. Check the User= line in $units." >&2
  exit 1
fi

systemctl daemon-reload
systemctl enable --now teletraan-backup.timer

# A timer that is already running may keep the schedule it started with, so
# a changed timer file is only certain to be used after a restart
systemctl restart teletraan-backup.timer
systemctl list-timers 'teletraan-backup*'
