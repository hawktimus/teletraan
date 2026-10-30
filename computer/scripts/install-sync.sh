#!/bin/bash
# Usage: sudo install-sync.sh
# Installs the sync service and the heartbeat, and the log folder they and the other services write to:
#   1. teletraan-sync.service (runs all the time, started again by systemd if it stops) and teletraan-heartbeat.service
#      and .timer (every 5 minutes), run as the login user
#   2. /var/log/teletraan, owned by the login user, and /etc/logrotate.d/teletraan (14 days, 5 MB, compressed)
# The sync service reads Sanity and the weather and writes the files that the dashboard shows (docs/OPERATIONS.md). It
# reads no key. The heartbeat does nothing until HEARTBEAT_URL or NOTIFY_URL is set in local.env. Installing this again
# restarts the sync service, which is how an update of its code takes effect. It checks that the tools are installed and
# does not install them.
#
# Tests set SYNC_ROOT (a folder that stands for /), and fake id, stat, systemctl and node.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

units="$computer/systemd"
repo=$(cd "$computer/.." && pwd -P)
root=${SYNC_ROOT:-}
target=$root/etc/systemd/system
log_folder=$root/var/log/teletraan
rotate_file=$root/etc/logrotate.d/teletraan
expected_repo=$root/opt/teletraan
list="teletraan-sync.service teletraan-heartbeat.service teletraan-heartbeat.timer"

# These checks only read, so they come first and nothing is changed until they pass
for unit in $list; do
  if [ ! -s "$units/$unit" ]; then
    echo "The unit file $units/$unit is missing or empty. Pull the newest files first." >&2
    exit 1
  fi
done
for file in "$computer/scripts/sync-service.mjs" "$computer/scripts/net-probe.mjs" "$computer/scripts/jsonlog.mjs" "$computer/scripts/heartbeat.sh" "$computer/scripts/notify.sh" "$computer/logrotate/teletraan"; do
  if [ ! -s "$file" ]; then
    echo "$file is missing. Pull the newest files first." >&2
    exit 1
  fi
done

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
command -v logrotate > /dev/null 2>&1 || echo "Note: logrotate is not installed, so the logs in $log_folder will not be cut. (sudo apt install logrotate)" >&2

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

account=$(stat -c %U "$repo")
if [ "$account" = root ] || [ "$account" = UNKNOWN ] || ! id "$account" > /dev/null 2>&1; then
  echo "The repository at $repo is owned by $account, and the service should not run as that." >&2
  echo "Give it to the account the Teletraan computer logs in with. If that account is called hawktimus:" >&2
  echo "  sudo chown -R hawktimus:hawktimus $repo" >&2
  exit 1
fi
group=$(id -gn "$account")

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}
if ! printf '%s' "$data" | grep -Eq '^/[A-Za-z0-9._/-]+$'; then
  echo "TELETRAAN_DATA in local.env is not a plain folder name." >&2
  exit 1
fi

echo "This will:"
echo "  1. make $log_folder, owned by $account"
echo "  2. copy the log rotation rule to $rotate_file (14 days, 5 MB, compressed)"
echo "  3. copy these files to $target, set to run as the account $account:"
echo "       teletraan-sync.service        reads Sanity and the weather into $data"
echo "       teletraan-heartbeat.service   pings the uptime monitor and sends the push messages"
echo "       teletraan-heartbeat.timer     every 5 minutes"
echo "  4. reload systemd, turn the service and the timer on, and restart the service"
echo
printf 'Press Enter to go ahead, or Ctrl+C to stop. '
read -r answer

mkdir -p "$log_folder" "$(dirname "$rotate_file")" "$target"
chown "$account:$group" "$log_folder"
chmod 755 "$log_folder"

tmp=$(mktemp)
sed "s/ACCOUNT/$account/g" "$computer/logrotate/teletraan" > "$tmp"
install -m 644 "$tmp" "$rotate_file"

for unit in $list; do
  sed "s/^User=ACCOUNT\$/User=$account/; s#^Environment=TELETRAAN_DATA=.*\$#Environment=TELETRAAN_DATA=$data#" "$units/$unit" > "$tmp"
  if [ ! -s "$tmp" ]; then
    echo "The copy of $unit came out empty, so nothing was installed." >&2
    rm -f "$tmp"
    exit 1
  fi
  install -m 644 "$tmp" "$target/$unit"
done
rm -f "$tmp"

# The substitution does nothing if a unit file was edited, and the service would then fail with a confusing message
if grep -q '^User=ACCOUNT$' "$target/teletraan-sync.service" "$target/teletraan-heartbeat.service" ||
  ! grep -q "^Environment=TELETRAAN_DATA=$data\$" "$target/teletraan-sync.service"; then
  echo "The account or the data folder was not filled in. Check the User= and Environment= lines in $units." >&2
  exit 1
fi

# The dashboard shows a file only if the web server can read it
mkdir -p "$data"
chown "$account:$group" "$data"

systemctl daemon-reload
systemctl enable --now teletraan-sync.service teletraan-heartbeat.timer
systemctl restart teletraan-sync.service teletraan-heartbeat.timer
systemctl list-timers 'teletraan-heartbeat*' || true
echo "sync install: done. The log is $log_folder/sync.jsonl."
