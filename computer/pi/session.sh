#!/bin/bash
# Runs as root inside the X server that launch.sh starts. $1 is the address to show and $2 the page it is:
# dashboard or control, which the exit watcher needs to know what Esc means.
# The browser and the exit watcher run as the login user. When the browser ends, this ends, and so does the X server.
set -u
here=$(cd "$(dirname "$0")" && pwd)
address=${1:-http://127.0.0.1:8080/dashboard/}
page=${2:-dashboard}
account=${TELETRAAN_ACCOUNT:-pi}
display=${DISPLAY:-:0}
run_dir=/run/user/$(id -u "$account")
profile=$run_dir/teletraan-chromium

# No screen saver and no power saving while the dashboard is up
xset -display "$display" s off -dpms > /dev/null 2>&1
xset -display "$display" s noblank > /dev/null 2>&1

# An arrow for the control page, in place of the cross of a bare X server
xsetroot -display "$display" -cursor_name left_ptr > /dev/null 2>&1

# The size of the screen as the X server has it, 1920x1080 if it cannot be read
size=$(xdpyinfo -display "$display" 2> /dev/null | sed -n 's/^ *dimensions: *\([0-9]*\)x\([0-9]*\) .*/\1,\2/p' | head -n 1)
[ -n "$size" ] || size=1920,1080

sudo -u "$account" -H env DISPLAY="$display" "$here/exit-watch.py" "$profile" "$page" &
watcher=$!

# The profile and the cache are in memory (the run folder of the user), so the SD card is not written. Nothing in the
# profile is needed again: the last good content is in /var/lib/teletraan/data.
sudo -u "$account" -H env DISPLAY="$display" chromium \
  --kiosk \
  --user-data-dir="$profile" \
  --disk-cache-dir="$profile/cache" \
  --window-position=0,0 \
  --window-size="$size" \
  --force-device-scale-factor=1 \
  --no-first-run \
  --no-default-browser-check \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --hide-crash-restore-bubble \
  --disable-features=Translate \
  --password-store=basic \
  ${TELETRAAN_BROWSER_FLAGS:-} \
  "$address" > /dev/null 2>&1

kill "$watcher" > /dev/null 2>&1
rm -rf "$profile"
exit 0
