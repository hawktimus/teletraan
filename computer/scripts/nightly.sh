#!/bin/bash
# Usage: nightly.sh   (started by teletraan-nightly.timer)
# The nightly restarts. teletraan-nightly.timer runs it as the login user at 04:00 every
# day and again at 04:10 on Sundays (kiosk time, the time zone of the Teletraan computer). The restart and the
# reboot go through sudo -n, which computer/sudoers/teletraan-control allows for those two commands only.
#   about 04:00   restarts the screen (teletraan-kiosk)
#   about 04:10   on a Sunday, reboots the Teletraan computer
# Either is skipped when a presentation is booked to start within the next hour
# or is running now, so a talk is never cut off. The booking is asked from
# Sanity, which is public and needs no key. When Sanity cannot be asked, the
# restart goes ahead: it is the middle of the night. A skipped restart is not
# made up later; the next night's run does it. Each decision is one line on
# standard output, which the journal keeps.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

# Seconds. A talk that began up to this long ago may still be running.
look_ahead=3600
look_back=7200
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

# The number of booked talks that start in the next hour or are on now.
# Gives nothing when Sanity cannot be asked.
talks_near() {
  project=$(config_value projectId)
  dataset=$(config_value dataset)
  version=$(config_value apiVersion)
  printf '%s' "$project" | grep -Eq '^[a-z0-9]+$' || return 0
  printf '%s' "$dataset" | grep -Eq '^[A-Za-z0-9_-]+$' || return 0
  printf '%s' "$version" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' || return 0

  now=$(date +%s)
  late=$(iso_at $((now + look_ahead)))
  early=$(iso_at $((now - look_back)))
  query="count(*[_type == \"presentation\" && status == \"scheduled\" && dateTime(start) < dateTime(\"$late\") && dateTime(start) > dateTime(\"$early\")])"
  answer=$(curl --silent --max-time 20 --connect-timeout 10 --get \
    "https://$project.api.sanity.io/v$version/data/query/$dataset" \
    --data-urlencode "query=$query" --data-urlencode 'perspective=published' 2> /dev/null) || return 0
  printf '%s' "$answer" | sed -n 's/.*"result":\([0-9][0-9]*\).*/\1/p' | head -n 1
}

# GNU date takes -d @seconds, the BSD date on a Mac takes -r seconds
iso_at() {
  date -u -d "@$1" '+%Y-%m-%dT%H:%M:%SZ' 2> /dev/null || date -u -r "$1" '+%Y-%m-%dT%H:%M:%SZ'
}

near=$(talks_near)
case $near in
  ''|0) ;;
  *) say "a presentation is booked within the next hour, so the $job is skipped."; exit 0 ;;
esac

if [ "$job" = kiosk ]; then
  say "restarting teletraan-kiosk."
  sudo -n "$systemctl_bin" restart teletraan-kiosk.service
else
  say "rebooting the Teletraan computer."
  sudo -n "$systemctl_bin" reboot
fi
