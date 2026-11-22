#!/bin/bash
# Usage: nightly.sh   (started by teletraan-nightly.timer)
# The nightly restarts. teletraan-nightly.timer runs it as the login user at 04:00 every
# day and again at 04:10 on Sundays (kiosk time, the time zone of the Teletraan computer). The restart and the
# reboot go through sudo -n, which computer/sudoers/teletraan-control allows for those two commands only.
#   about 04:00   restarts the screen (teletraan-kiosk)
#   about 04:10   on a Sunday, reboots the Teletraan computer
# Each decision is one line on standard output, which the journal keeps.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

systemctl_bin=${TELETRAAN_SYSTEMCTL:-/usr/bin/systemctl}

say() {
  echo "nightly: $*"
}

# Weekday number (1 is Monday) and HHMM. The test sets NIGHTLY_NOW to "7 0410".
when=${NIGHTLY_NOW:-$(date '+%u %H%M')}
day=${when% *}
clock=${when#* }

case $clock in
  035[5-9]|040[0-4]) job=kiosk ;;
  040[5-9]|041[0-9]|042[0-9]) job=reboot ;;
  *) say "$clock is not a time for a restart, so nothing is done."; exit 0 ;;
esac

if [ "$job" = reboot ] && [ "$day" != 7 ]; then
  say "no reboot except on Sunday."
  exit 0
fi

if [ "$job" = kiosk ]; then
  say "restarting teletraan-kiosk."
  log_json nightly screen restart "the nightly $job"
  sudo -n "$systemctl_bin" restart teletraan-kiosk.service
else
  # Every reboot on this computer asks the gate first (computer/scripts/gate.sh), which holds one record for all five
  # repair paths. The nightly reboot is outside the automatic budget, because a person asked for it by turning it on,
  # but it still cannot follow another reboot inside ten minutes, and it waits while the computer is in a boot loop.
  # A refusal is not a failure: it is the gate saying the computer has already been restarted enough.
  if ! why=$("$computer/scripts/gate.sh" allow nightly 2>&1); then
    say "the $job was not done: $why"
    log_json nightly screen reboot_refused "$why"
    exit 0
  fi
  say "rebooting the Teletraan computer ($why)."
  log_json nightly screen reboot "the nightly $job"
  sudo -n "$systemctl_bin" reboot
fi
