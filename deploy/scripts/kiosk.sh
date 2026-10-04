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
