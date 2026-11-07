#!/bin/bash
# Usage: gate.sh allow <reason> [problem]   may this computer reboot now? 0 means yes and the reboot is recorded
#        gate.sh check <reason> [problem]   the same question, reading only
#
# The one door every reboot on this computer goes through. watchdog.sh, netwatch.sh, nightly.sh, scheduled-reboot.sh,
# the remote poller and the control helper all ask here first, so there is one budget and one record instead of five.
# The rules are in computer/scripts/supervisor-plan.mjs and the record is computer/scripts/ledger.mjs; this is only the
# short way for a shell script to ask.
#
# The reasons are recovery, netwatch and watchdog (the computer deciding by itself, which share a budget of one reboot
# in six hours and three in a day) and nightly, remote and control (a person, or a plan a person set up, which are
# outside that budget but still cannot reboot twice within ten minutes).
#
# A refusal is not a failure: it is the gate doing its job. It exits 3 and prints the plain reason, so the caller can
# log it and carry on.
#
# Exit 1 means the gate itself could not be asked. A repair the computer decided on by itself must then do nothing,
# because the limits are what stop a reboot loop and they could not be checked. A reboot a person asked for goes ahead
# and says so in the log: refusing the person at the button because node is missing would be the worse mistake.
#
#   if "$computer/scripts/gate.sh" allow watchdog frames; then ... reboot ... ; fi
set -euo pipefail
. "$(dirname "$0")/lib.sh"

node_bin=${TELETRAAN_NODE:-node}
mode=${1:-}
reason=${2:-}
problem=${3:-}

case $mode in
  allow|check) ;;
  *) echo "gate: say allow or check." >&2; exit 1 ;;
esac

if [ -z "$reason" ]; then
  echo "gate: say why the reboot is wanted." >&2
  exit 1
fi

if ! command -v "$node_bin" > /dev/null 2>&1; then
  echo "gate: node is not installed, so the reboot cannot be allowed." >&2
  exit 1
fi

exec "$node_bin" "$computer/scripts/ledger.mjs" "$mode" "$reason" "$problem"
