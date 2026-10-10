#!/bin/sh
# Installs the FRC feed: copies its two systemd unit files and turns on its
# timer, which starts frc-sync.sh every 5 minutes. The script itself does its
# work about once an hour, and every 5 minutes while a team has an event on. It
# checks that the packages the script needs are installed. It does not install
# them.
set -eu

deploy=$(cd "$(dirname "$0")/.." && pwd)
units="$deploy/systemd"
repo=$(cd "$deploy/.." && pwd -P)
target=/etc/systemd/system

# The unit files name the repository location directly
expected_repo=/opt/teletraan

# These checks only read, so they come first and nothing is changed until they
# pass. An empty unit file would be installed as an empty unit, so it counts as
# missing.
for unit in teletraan-frc.service teletraan-frc.timer; do
  if [ ! -s "$units/$unit" ]; then
    echo "The unit file $units/$unit is missing or empty. Pull the newest files first." >&2
    exit 1
  fi
done

if [ ! -x "$deploy/scripts/frc-sync.sh" ]; then
  echo "$deploy/scripts/frc-sync.sh is missing or cannot be run." >&2
  exit 1
fi

missing=""
command -v curl > /dev/null 2>&1 || missing="$missing curl"
command -v jq > /dev/null 2>&1 || missing="$missing jq"
if [ -n "$missing" ]; then
  echo "These packages are not installed:$missing" >&2
  echo "Ask the team mentor, install them, and run this again:" >&2
  echo "  sudo apt install curl jq" >&2
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
echo "  1. copy these files to $target, set to run as the account $account:"
echo "       teletraan-frc.service"
echo "       teletraan-frc.timer"
echo "  2. reload systemd"
echo "  3. turn on teletraan-frc.timer (every 5 minutes), and restart it so a"
echo "     changed schedule is used"
echo
printf 'Press Enter to go ahead, or Ctrl+C to stop. '
read -r answer

tmp=$(mktemp)
for unit in teletraan-frc.service teletraan-frc.timer; do
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
if grep -q '^User=ACCOUNT$' "$target/teletraan-frc.service"; then
  echo "The account name was not filled in. Check the User= line in $units." >&2
  exit 1
fi

systemctl daemon-reload
systemctl enable --now teletraan-frc.timer

# A timer that is already running may keep the schedule it started with, so
# a changed timer file is only certain to be used after a restart
systemctl restart teletraan-frc.timer
systemctl list-timers 'teletraan-frc*'
