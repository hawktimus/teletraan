#!/bin/sh
# Opens the dashboard full screen in Chromium. teletraan-kiosk.service runs it
# through xinit. When the browser closes, this script ends and the service
# starts everything again.
set -eu

deploy=$(cd "$(dirname "$0")/.." && pwd)
env_file="$deploy/local.env"

# The value of a NAME=value line in local.env, without its quotes
setting() {
  [ -f "$env_file" ] || return 0
  sed -n "s/^$1=//p" "$env_file" | tail -n 1 | sed "s/^['\"]//; s/['\"]\$//"
}

port=$(setting TELETRAAN_PORT)
dashboard="http://localhost:${port:-8080}/dashboard/"

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}

# Tell Studio that the screen has started. It runs in the background with its
# output thrown away, so a slow or missing network never holds the screen back.
# It does nothing without a write token in local.env.
"$deploy/scripts/status-write.sh" kiosk > /dev/null 2>&1 &

# The text of $1 made safe to put between the quotes of a JSON string
json_text() {
  printf '%s' "$1" | sed 's/[[:cntrl:]]//g; s/\\/\\\\/g; s/"/\\"/g'
}

# Writes device.json in the data folder: the Mini's name, its Wi-Fi and
# Tailscale addresses and the time. With nothing else to go on, this is how
# someone finds the Mini on a school network they cannot look at. The
# dashboard shows it only while its connection status text says Sanity is
# unreachable (core/connection.js).
#
# Written the way pull.sh writes version.txt: a temporary file in the same
# folder, then mv, so the web server never reads half a file.
#
# Every command here may be missing or may fail on a given Mini. A value that
# cannot be found stays empty, and the function never fails, because a
# missing address must not stop the screen from starting.
write_device_info() {
  [ -d "$data" ] || return 0

  name=$(hostname 2> /dev/null | sed 1q || true)

  # The first IPv4 address on an interface whose name starts with wl (wlan0,
  # wlp2s0). The line looks like: 3: wlp2s0 inet 192.168.1.23/24 brd ...
  wifi=$(ip -4 -o addr show 2> /dev/null | awk '$2 ~ /^wl/ { split($4, parts, "/"); print parts[1]; exit }' || true)

  # Tailscale tells its own address. If the command is missing or says
  # nothing, the tailscale0 interface has it.
  tailscale_address=""
  if command -v tailscale > /dev/null 2>&1; then
    tailscale_address=$(tailscale ip -4 2> /dev/null | sed 1q || true)
  fi
  if [ -z "$tailscale_address" ]; then
    tailscale_address=$(ip -4 -o addr show dev tailscale0 2> /dev/null | awk '{ split($4, parts, "/"); print parts[1]; exit }' || true)
  fi

  now=$(date -u +%Y-%m-%dT%H:%M:%SZ 2> /dev/null || true)

  temporary="$data/device.json.tmp.$$"
  if printf '{"hostname":"%s","wifi":"%s","tailscale":"%s","time":"%s"}\n' \
    "$(json_text "$name")" "$(json_text "$wifi")" "$(json_text "$tailscale_address")" "$(json_text "$now")" \
    2> /dev/null > "$temporary"; then
    chmod 644 "$temporary" 2> /dev/null || true
    mv -f "$temporary" "$data/device.json" 2> /dev/null || rm -f "$temporary"
  else
    rm -f "$temporary" 2> /dev/null || true
  fi
  return 0
}

# An address after the script name opens that page instead of the dashboard.
# To try the script by hand with no desktop, stop the service, log in at the
# Mini's own text screen (Ctrl+Alt+F1) and run:
#   xinit /opt/teletraan/deploy/scripts/kiosk.sh [address] -- :1 vt8
url="${1:-$dashboard}"

# The profile is kept between runs because the dashboard saves its last known
# content in it, and that copy is what the screen shows if the network is down
# after a reboot.
profile="$HOME/.config/teletraan-kiosk"

# The container may still be starting after a boot. This waits for the
# dashboard even when another address was given, which curl could not open
# (chrome://gpu, for example).
curl --fail --silent --output /dev/null --retry 30 --retry-delay 2 --retry-connrefused "$dashboard"

# No screen saver, no blank screen, no power saving
xset s off
xset s noblank
xset -dpms

# The service also starts X without a pointer. This covers a desktop session.
if command -v unclutter > /dev/null 2>&1; then
  unclutter -idle 1 -root &
fi

# After a power cut Chromium thinks it crashed and offers to restore pages.
# Marking the last run as clean stops the question.
if [ -f "$profile/Default/Preferences" ]; then
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"Crashed"/"exit_type":"Normal"/' "$profile/Default/Preferences"
fi

# After a power cut the profile still holds a lock from the old run, and
# Chromium then waits or refuses to start. Only this script uses the profile
# and the service runs one copy of it, so a lock found here is always stale.
rm -f "$profile/SingletonLock" "$profile/SingletonCookie" "$profile/SingletonSocket"

# Every minute, in the background, write device.json (see write_device_info
# above). The first write is now. exec keeps this script's process number for
# the browser, so when the browser closes that number goes away and the loop
# ends by itself. Its output is thrown away and a failed write is ignored:
# this must never get in the way of the screen. A temporary file left by an
# earlier run that was cut short is removed first.
kiosk=$$
rm -f "$data"/device.json.tmp.* 2> /dev/null || true
(
  while kill -0 "$kiosk" 2> /dev/null; do
    write_device_info || true
    sleep 60
  done
) > /dev/null 2>&1 &

# --kiosk: full screen with no address bar or tabs
# --force-device-scale-factor=1: never zoomed, one dashboard pixel is one TV pixel
# --disable-features=Translate: no translate prompt
# --password-store=basic: never asks for a keyring password
exec chromium \
  --kiosk \
  --user-data-dir="$profile" \
  --window-position=0,0 \
  --window-size=1920,1080 \
  --force-device-scale-factor=1 \
  --no-first-run \
  --no-default-browser-check \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --hide-crash-restore-bubble \
  --disable-features=Translate \
  --password-store=basic \
  --enable-gpu-rasterization \
  --ignore-gpu-blocklist \
  "$url"

# To use Firefox instead of Chromium, install firefox-esr and replace the
# exec command above with:
#
#   exec firefox-esr --kiosk --no-remote --profile "$profile" "$url"
#
# Firefox has no flags for the rest, so put these lines in "$profile/user.js":
#
#   user_pref("browser.sessionstore.resume_from_crash", false);
#   user_pref("browser.shell.checkDefaultBrowser", false);
#   user_pref("browser.translations.automaticallyPopup", false);
#   user_pref("browser.startup.homepage_override.mstone", "ignore");
#   user_pref("gfx.webrender.all", true);
#   user_pref("layers.acceleration.force-enabled", true);
#
# Firefox fills the screen by itself, so it needs no window size. The
# Preferences fix above is only for Chromium.
