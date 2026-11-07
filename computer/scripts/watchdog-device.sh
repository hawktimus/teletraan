#!/bin/bash
# Usage: watchdog-device.sh   (make watchdog-test)
# Says whether this computer has a hardware watchdog, and what turning it on would mean. It changes nothing.
#
# A hardware watchdog is a timer in the chipset. systemd pats it every so often, and if systemd ever stops patting it
# the machine resets itself. It is the last line against a kernel that has locked up, which no script can do anything
# about because no script is running either.
#
# It is off here on purpose. Turning it on means a computer that resets itself with no record of why, and on a 2011
# machine the device may be missing or may not work. Nothing turns it on automatically: Jason reads this, and if the
# device is there and he wants it, he adds the two lines it prints and reboots once to see that the machine comes back.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

echo "The hardware watchdog on this computer"
echo

if [ ! -e /dev/watchdog ] && [ ! -d /sys/class/watchdog ]; then
  echo "There is no watchdog device: no /dev/watchdog and no /sys/class/watchdog."
  echo "Nothing to turn on, and nothing to do. The software watchdog (teletraan-watchdog.timer) and the"
  echo "supervisor are what keep the screen up on this machine."
  exit 0
fi

if [ -d /sys/class/watchdog ]; then
  for device in /sys/class/watchdog/watchdog*; do
    [ -d "$device" ] || continue
    echo "device:    $(basename "$device")"
    echo "  driver:  $(cat "$device/identity" 2> /dev/null || echo 'not said')"
    echo "  state:   $(cat "$device/state" 2> /dev/null || echo 'not said')"
    echo "  timeout: $(cat "$device/timeout" 2> /dev/null || echo 'not said') seconds"
  done
fi
[ ! -e /dev/watchdog ] || echo "/dev/watchdog is there."

echo
echo "What systemd does with it now:"
echo "  RuntimeWatchdogSec: $(systemctl show -p RuntimeWatchdogUSec --value 2> /dev/null || echo 'not said')"
echo
echo "It is not turned on. To turn it on, put these two lines in /etc/systemd/system.conf:"
echo "    RuntimeWatchdogSec=60"
echo "    RebootWatchdogSec=10min"
echo "then run 'sudo systemctl daemon-reexec', and reboot once to check that the machine comes back."
echo
echo "Only do that if the device above has a real driver and a timeout. A watchdog that does not work can"
echo "reset the computer for no reason, and nothing would say why."
