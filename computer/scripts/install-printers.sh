#!/bin/bash
# Usage: sudo install-printers.sh
# Installs the printer service (docs/printers.md): copies teletraan-printers.service to systemd, set to run as the account that owns
# the repository, turns it on and starts it again. The service watches the 3D printers listed in the printers file
# (/var/lib/teletraan/printers.json) and writes <data>/printers/status.json and the camera picture of a printer that is printing. It
# needs no key. If the printers file is not there, an empty one is made from computer/config/printers.example.json, which the
# service reads as no printers, so nothing shows on the screen until the addresses are put in it.
# Installing this again restarts the service, which is how an update of its code takes effect. It checks that node is installed
# and does not install it.
#
# Tests set PRINTERS_ROOT (a folder that stands for /), and fake id, stat, systemctl and node.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

units="$computer/systemd"
repo=$(cd "$computer/.." && pwd -P)
root=${PRINTERS_ROOT:-}
target=$root/etc/systemd/system
expected_repo=$root/opt/teletraan
unit=teletraan-printers.service
printers_file=$root/var/lib/teletraan/printers.json

# These checks only read, so they come first and nothing is changed until they pass
if [ ! -s "$units/$unit" ]; then
  echo "The unit file $units/$unit is missing or empty. Pull the newest files first." >&2
  exit 1
fi
for file in "$computer/scripts/printer-sync.mjs" "$computer/scripts/printer-ws.mjs" "$computer/config/printers.example.json"; do
  if [ ! -s "$file" ]; then
    echo "$file is missing. Pull the newest files first." >&2
    exit 1
  fi
done

if ! command -v node > /dev/null 2>&1; then
  echo "node is not installed. Ask the team mentor, install it (version 18 or newer), and run this again:" >&2
  echo "  sudo apt install nodejs" >&2
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
  echo "The unit file expects the repository at $expected_repo, but it is at $repo." >&2
  echo "Move it there, or change the paths in the file in $units first." >&2
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
echo "  1. copy $unit to $target, set to run as the account $account, writing to $data/printers"
echo "  2. make $printers_file from the example when it is not there (an empty list: no printer is watched until addresses are put in it)"
echo "  3. reload systemd, turn the service on and restart it"
echo
printf 'Press Enter to go ahead, or Ctrl+C to stop. '
read -r answer

mkdir -p "$target" "$(dirname "$printers_file")"

tmp=$(mktemp)
sed "s/^User=ACCOUNT\$/User=$account/; s#^Environment=TELETRAAN_DATA=.*\$#Environment=TELETRAAN_DATA=$data#" "$units/$unit" > "$tmp"
if [ ! -s "$tmp" ]; then
  echo "The copy of $unit came out empty, so nothing was installed." >&2
  rm -f "$tmp"
  exit 1
fi
install -m 644 "$tmp" "$target/$unit"
rm -f "$tmp"

# The substitution does nothing if the unit file was edited, and the service would then fail with a confusing message
if grep -q '^User=ACCOUNT$' "$target/$unit" || ! grep -q "^Environment=TELETRAAN_DATA=$data\$" "$target/$unit"; then
  echo "The account or the data folder was not filled in. Check the User= and Environment= lines in $units/$unit." >&2
  exit 1
fi

if [ ! -f "$printers_file" ]; then
  printf '{\n  "printers": []\n}\n' > "$printers_file"
  chown "$account:$group" "$printers_file"
  chmod 644 "$printers_file"
  echo "Made $printers_file with no printers. Put one entry in it for each printer (see computer/config/printers.example.json)."
fi

mkdir -p "$data"
chown "$account:$group" "$data"

systemctl daemon-reload
systemctl enable "$unit"
systemctl restart "$unit"
echo "printers install: done. The service writes $data/printers/status.json. Its messages are in: journalctl -u teletraan-printers"
