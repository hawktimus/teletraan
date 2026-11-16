#!/bin/bash
# Installs Teletraan on a Raspberry Pi that is also something else (a RetroPie console). computer/pi/README.md.
#
#   sudo computer/pi/install-pi.sh [commit]
#
# Run it on the Pi, from a copy of the repository that is not inside /opt/teletraan. It can be run again after an update.
# It is not computer/install.sh: no Docker, no kiosk at boot, no watchdog, no nightly reboot, nothing that writes to
# Sanity. It needs these packages first: chromium nginx-light nodejs python3-evdev poppler-utils curl jq xinit.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
tree=$(cd "$here/../.." && pwd)
root=/opt/teletraan
data=/var/lib/teletraan/data
commit=${1:-}

say() { printf '%s\n' "$*"; }
stop() { printf 'Stopped: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || stop "this changes the system, so run it with sudo."
account=${TELETRAAN_ACCOUNT:-${SUDO_USER:-}}
[ -n "$account" ] && [ "$account" != root ] || stop "run it with sudo from the login user, not as root itself."
group=$(id -gn "$account")
home=$(getent passwd "$account" | cut -d: -f6)
case $tree in "$root" | "$root"/*) stop "the copy to install cannot be inside $root." ;; esac
[ -f "$tree/dashboard/index.html" ] || stop "$tree has no dashboard/index.html."
[ -d "$tree/studio/tools" ] || stop "$tree has no studio folder, which the control service reads."
for tool in chromium nginx node curl jq pdftoppm xinit rsync; do
  command -v "$tool" > /dev/null 2>&1 || PATH=$PATH:/usr/sbin command -v "$tool" > /dev/null 2>&1 || stop "$tool is not installed."
done
python3 -c 'import evdev' 2> /dev/null || stop "python3-evdev is not installed."

release=$root/releases/1
mkdir -p "$release" "$root/web" "$data" /var/lib/teletraan-state

# The tree, without the things that are made here (the link to the data, the build stamp) and without any key file
rsync -a --delete \
  --exclude '.git' --exclude 'node_modules' --exclude 'local.env' \
  --exclude '/dashboard/data/live' --exclude '/dashboard/build.js' --exclude '/RELEASE.json' \
  "$tree/" "$release/"

ln -sfn releases/1 "$root/current"
for name in dashboard computer control; do ln -sfn "current/$name" "$root/$name"; done
ln -sfn ../current/dashboard "$root/web/dashboard"
# The page reads data/live; on the Teletraan computer Docker puts the data folder there, here it is a link
rm -rf "$release/dashboard/data/live"
ln -sfn "$data" "$release/dashboard/data/live"
# The scripts read computer/local.env. The file itself is /opt/teletraan/local.env and is made by hand.
ln -sfn "$root/local.env" "$release/computer/local.env"

version=$(cat "$tree/VERSION" 2> /dev/null || echo 0)
today=$(date -u +%Y-%m-%d)
printf '{\n  "version": "%s",\n  "commit": "%s",\n  "date": "%s",\n  "from": "pi",\n  "note": "Installed with computer/pi/install-pi.sh"\n}\n' \
  "$version" "$commit" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$release/RELEASE.json"
printf 'export const build = "%s-%s";\nexport const version = "%s";\nexport const commit = "%s";\nexport const date = "%s";\n' \
  "$version" "${commit:-pi}" "$version" "$commit" "$today" > "$release/dashboard/build.js"

chown -R "$account:$group" "$root" /var/lib/teletraan /var/lib/teletraan-state
chmod +x "$release"/computer/pi/*.sh "$release"/computer/pi/*.py "$release"/computer/scripts/*.sh 2> /dev/null || true

# The log folder is in memory
printf 'd /run/teletraan-logs 0755 %s %s -\n' "$account" "$group" > /etc/tmpfiles.d/teletraan-pi.conf
systemd-tmpfiles --create /etc/tmpfiles.d/teletraan-pi.conf

for unit in "$here"/systemd/teletraan-pi*; do
  sed "s/ACCOUNT/$account/g" "$unit" > "/etc/systemd/system/$(basename "$unit")"
  chmod 644 "/etc/systemd/system/$(basename "$unit")"
done
systemctl daemon-reload

# The Teletraan system in EmulationStation, beside Ports, with Dashboard and Control in it. Its look is a
# theme.xml in its own folder, which EmulationStation reads before the theme set, so the theme set is not touched.
# It shows after EmulationStation is started again.
roms=$home/RetroPie/roms
systems=/etc/emulationstation/es_systems.cfg
if [ -d "$roms" ]; then
  mkdir -p "$roms/teletraan"
  install -m 755 "$here/Dashboard.sh" "$here/Control.sh" "$roms/teletraan/"
  install -m 644 "$here/es-theme.xml" "$roms/teletraan/theme.xml"
  install -m 644 "$release/dashboard/assets/teletraan-wordmark.svg" "$roms/teletraan/logo.svg"
  chown -R "$account:$group" "$roms/teletraan"
  # The entry of the first version, under Ports
  rm -f "$roms/ports/Teletraan.sh"
  say "EmulationStation entries: $roms/teletraan (Dashboard, Control)"

  if [ -f "$systems" ] && ! grep -q '<name>teletraan</name>' "$systems"; then
    cp -p "$systems" "$systems.before-teletraan"
    python3 - "$systems" "$roms/teletraan" << 'PYTHON'
import re
import sys

path, folder = sys.argv[1], sys.argv[2]
text = open(path).read()
block = """  <system>
    <name>teletraan</name>
    <fullname>Teletraan</fullname>
    <path>%s</path>
    <extension>.sh .SH</extension>
    <command>bash %%ROM%%</command>
    <platform>pc</platform>
    <theme>teletraan</theme>
  </system>
""" % folder
# Right after Ports, or at the end of the list when there is no Ports
ports = re.search(r"<name>ports</name>.*?</system>[ \t]*\n", text, re.S)
if ports:
    text = text[:ports.end()] + block + text[ports.end():]
else:
    text = text.replace("</systemList>", block + "</systemList>", 1)
open(path, "w").write(text)
PYTHON
    say "Added the Teletraan system to $systems (the file from before is $systems.before-teletraan)"
  fi
fi

say "Installed version $version${commit:+ ($commit)} in $root."
[ -f "$root/local.env" ] || say "There is no $root/local.env yet. The dashboard runs without it; the calendars and the Drive folders need it (computer/pi/README.md)."
