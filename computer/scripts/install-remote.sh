#!/bin/bash
# Usage: sudo install-remote.sh
# Installs the remote action poller: copies teletraan-remote.service, makes the log folder and turns the service on.
# The service polls Sanity every 30 seconds and runs the Studio buttons Restart dashboard, Restart services and
# Reboot computer through the helper socket. It runs as the login user. It installs no package: it needs node.
# Run it again when the unit file changes. It is one of the steps of Install everything, so without SANITY_WRITE_TOKEN in
# local.env it says so in one line, changes nothing and ends with success: the rest of the install goes on.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

unit="$computer/systemd/teletraan-remote.service"
repo=$(cd "$computer/.." && pwd -P)
target=/etc/systemd/system
log_folder=/var/log/teletraan
expected_repo=/opt/teletraan

# The poller needs the token to write the answer. Only the name is looked for, the value is never shown.
if [ -z "$(setting SANITY_WRITE_TOKEN)" ]; then
  echo "install-remote: SANITY_WRITE_TOKEN is not in local.env yet, so the remote action service was not installed. Add the key with the Keys tab of the control page and install again."
  exit 0
fi

if [ ! -s "$unit" ]; then
  echo "The unit file $unit is missing or empty. Pull the newest files first." >&2
  exit 1
fi

if [ ! -f "$computer/scripts/remote-poller.mjs" ]; then
  echo "$computer/scripts/remote-poller.mjs is missing. Pull the newest files first." >&2
  exit 1
fi

if ! command -v node > /dev/null 2>&1; then
  echo "node is not installed. Ask the team mentor, install it, and run this again:" >&2
  echo "  sudo apt install nodejs" >&2
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "This changes the system, so it has to run with sudo:" >&2
  echo "  sudo $0" >&2
  exit 1
fi

if [ "$repo" != "$expected_repo" ]; then
  echo "The unit file expects the repository at $expected_repo, but it is at $repo." >&2
  exit 1
fi

account=$(stat -c %U "$repo")
if [ "$account" = root ] || [ "$account" = UNKNOWN ] || ! id "$account" > /dev/null 2>&1; then
  echo "The repository at $repo is owned by $account, and the service should not run as that." >&2
  echo "Give it to the account the Teletraan computer logs in with, then run this again." >&2
  exit 1
fi

if [ ! -S /run/teletraan/control.sock ]; then
  echo "Note: the helper socket /run/teletraan/control.sock is not there yet. Run computer/install.sh, which turns on teletraan-control.socket." >&2
fi

echo "This will:"
echo "  1. make $log_folder, owned by $account (the log remote.jsonl is written there)"
echo "  2. copy teletraan-remote.service to $target, set to run as $account"
echo "  3. reload systemd and turn on teletraan-remote.service"
echo
printf 'Press Enter to go ahead, or Ctrl+C to stop. '
read -r answer

install -d -o "$account" -m 755 "$log_folder"

tmp=$(mktemp)
sed "s/^User=ACCOUNT\$/User=$account/" "$unit" > "$tmp"
if ! grep -q "^User=$account\$" "$tmp"; then
  rm -f "$tmp"
  echo "The account name was not filled in. Check the User= line in $unit." >&2
  exit 1
fi
install -m 644 "$tmp" "$target/teletraan-remote.service"
rm -f "$tmp"

systemctl daemon-reload
systemctl enable teletraan-remote.service
systemctl restart teletraan-remote.service
systemctl --no-pager status teletraan-remote.service | head -n 5 || true
