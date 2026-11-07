#!/bin/bash
# Usage: sudo install-health.sh
# Installs the three things that keep the screen up by themselves:
#   1. teletraan-health.service and .timer     looks the computer over every minute and writes health.json
#   2. teletraan-supervisor.service and .timer acts on what the checks say, and is the only thing that escalates
#   3. teletraan-display.service and .timer    notices the TV being switched away and puts the picture right
# and the folder they keep their state in, /var/lib/teletraan, owned by the login user.
#
# The supervisor starts in watching mode: it writes what it would have done and does nothing. It stays that way for the
# first day whatever the setting says, and after that it acts only while the Mode field on the Computer tab of Dashboard
# Settings says Fix. That is on purpose: read a day of its log before letting it restart anything
# (docs/OPERATIONS.md, "Watching first").
#
# Installing this again replaces the unit files and restarts the timers, which is how an update of their code takes
# effect. It checks that the tools are installed and does not install them.
#
# Tests set HEALTH_ROOT (a folder that stands for /), and fake id, stat and systemctl.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

units="$computer/systemd"
repo=$(cd "$computer/.." && pwd -P)
root=${HEALTH_ROOT:-}
target=$root/etc/systemd/system
state_folder=$root/var/lib/teletraan
expected_repo=$root/opt/teletraan
list="teletraan-health.service teletraan-health.timer teletraan-supervisor.service teletraan-supervisor.timer teletraan-display.service teletraan-display.timer"

# These checks only read, so they come first and nothing is changed until they pass
for unit in $list; do
  if [ ! -s "$units/$unit" ]; then
    echo "The unit file $units/$unit is missing or empty. Pull the newest files first." >&2
    exit 1
  fi
done
for file in "$computer/scripts/health.sh" "$computer/scripts/health-checks.mjs" "$computer/scripts/supervisor.sh" \
  "$computer/scripts/supervisor-plan.mjs" "$computer/scripts/ledger.mjs" "$computer/scripts/gate.sh" \
  "$computer/scripts/display-watch.sh" "$computer/scripts/diag.sh" "$computer/scripts/redact.mjs" \
  "$computer/scripts/page-command.py" "$computer/scripts/mirror.py"; do
  if [ ! -s "$file" ]; then
    echo "$file is missing. Pull the newest files first." >&2
    exit 1
  fi
done

missing=""
command -v curl > /dev/null 2>&1 || missing="$missing curl"
command -v node > /dev/null 2>&1 || missing="$missing nodejs"
command -v python3 > /dev/null 2>&1 || missing="$missing python3"
command -v flock > /dev/null 2>&1 || missing="$missing util-linux"
if [ -n "$missing" ]; then
  echo "These packages are not installed:$missing" >&2
  echo "Ask the team mentor, install them, and run this again:" >&2
  echo "  sudo apt install curl nodejs python3 util-linux" >&2
  exit 1
fi
command -v xrandr > /dev/null 2>&1 || echo "Note: xrandr is not installed, so the display checks and the display recovery will do nothing. (sudo apt install x11-xserver-utils)" >&2
command -v timeout > /dev/null 2>&1 || echo "Note: timeout is not installed, so a diagnostic report cannot limit how long a command may take. (sudo apt install coreutils)" >&2

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
  echo "The repository at $repo is owned by $account, and these services should not run as that." >&2
  echo "Give it to the account the Teletraan computer logs in with. If that account is called hawktimus:" >&2
  echo "  sudo chown -R hawktimus:hawktimus $repo" >&2
  exit 1
fi
group=$(id -gn "$account")

echo "This will:"
echo "  1. make $state_folder, owned by $account, for health.json, the reboot ledger and the reports"
echo "  2. copy these files to $target, set to run as the account $account:"
echo "       teletraan-health.service/.timer      looks the computer over every minute"
echo "       teletraan-supervisor.service/.timer  acts on what the checks say (watching only at first)"
echo "       teletraan-display.service/.timer     puts the picture right when the TV is switched away"
echo "  3. reload systemd and turn the three timers on"
echo
echo "The supervisor will watch and not act: for the first day always, and after that only while the Mode field on the"
echo "Computer tab of Dashboard Settings says Fix. Read a day of 'make supervisor-status' before changing it."
echo
printf 'Press Enter to go ahead, or Ctrl+C to stop. '
read -r answer

mkdir -p "$state_folder" "$target"
chown "$account:$group" "$state_folder"
chmod 755 "$state_folder"
for place in incidents reports; do
  mkdir -p "$state_folder/$place"
  chown "$account:$group" "$state_folder/$place"
  chmod 700 "$state_folder/$place"
done

tmp=$(mktemp)
for unit in $list; do
  sed "s/^User=ACCOUNT\$/User=$account/" "$units/$unit" > "$tmp"
  if [ ! -s "$tmp" ]; then
    echo "The copy of $unit came out empty, so nothing was installed." >&2
    rm -f "$tmp"
    exit 1
  fi
  install -m 644 "$tmp" "$target/$unit"
done
rm -f "$tmp"

# The substitution does nothing if a unit file was edited, and the service would then fail with a confusing message
for unit in teletraan-health.service teletraan-supervisor.service teletraan-display.service; do
  if grep -q '^User=ACCOUNT$' "$target/$unit"; then
    echo "The account was not filled in for $unit. Check the User= line in $units." >&2
    exit 1
  fi
done

systemctl daemon-reload
systemctl enable --now teletraan-health.timer teletraan-supervisor.timer teletraan-display.timer
systemctl list-timers 'teletraan-health*' 'teletraan-supervisor*' 'teletraan-display*' || true
echo "health install: done. 'make health' shows the checks and 'make supervisor-status' what it would do."
