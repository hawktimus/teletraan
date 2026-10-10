#!/bin/sh
# Installs the systemd units for the Mini and turns on the two timers: one
# downloads the calendars, one pulls the repository. The kiosk unit is copied
# but not turned on, because it takes over the screen.
set -eu

deploy=$(cd "$(dirname "$0")/.." && pwd)
units="$deploy/systemd"
repo=$(cd "$deploy/.." && pwd -P)
target=/etc/systemd/system

# The unit files name the repository location directly
expected_repo=/opt/teletraan

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
  echo "The repository at $repo is owned by $account, and the timers should not run as that." >&2
  echo "Give it to the account the Mini logs in with. If that account is called hawktimus:" >&2
  echo "  sudo chown -R hawktimus:hawktimus $repo" >&2
  exit 1
fi

echo "This will:"
echo "  1. copy these files to $target, set to run as the account $account:"
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
if ! command -v node > /dev/null 2>&1; then
  echo "Node is not installed here. The Calendars page in Studio will say when each calendar"
  echo "was downloaded and why a download failed, but it will not list the coming events."
  echo "docs/calendars-page.md says how to turn the list on."
  echo
fi
printf 'Press Enter to go ahead, or Ctrl+C to stop. '
read -r answer

tmp=$(mktemp)
for unit in "$units"/teletraan-*; do
  sed "s/^User=ACCOUNT\$/User=$account/" "$unit" > "$tmp"
  install -m 644 "$tmp" "$target/$(basename "$unit")"
done
rm -f "$tmp"

# The substitution does nothing if a unit file was edited, and the service would
# then fail later with a confusing message
if grep -q '^User=ACCOUNT$' "$target"/teletraan-*.service; then
  echo "The account name was not filled in. Check the User= line in $units." >&2
  exit 1
fi

systemctl daemon-reload
systemctl enable --now teletraan-calendars.timer teletraan-pull.timer

# A timer that is already running may keep the schedule it started with, so
# a changed timer file is only certain to be used after a restart
systemctl restart teletraan-calendars.timer teletraan-pull.timer
systemctl list-timers 'teletraan-*'
