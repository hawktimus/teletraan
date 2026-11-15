# Teletraan on the Raspberry Pi

The Pi under the office TV is a game console first. Teletraan is one more thing it can show, started from
EmulationStation and gone again when you leave it. Nothing here runs at boot, and nothing here writes to Sanity.

## Start

EmulationStation, Ports, Teletraan. The dashboard fills the TV after a few seconds.

## Stop

- Controller: hold Select and press Start.
- Keyboard: Ctrl + Alt + Backspace.

EmulationStation comes back as it was.

## What runs while it is up

`teletraan-pi.target` is started by the launcher and stopped when you leave.

| Unit | What it does | Needs a key |
| --- | --- | --- |
| `teletraan-pi-web` | The web server, on this computer only, port 8080 | no |
| `teletraan-pi-sync` | Reads the content and the weather and keeps the last good copy | no |
| `teletraan-pi-calendars` | Downloads the team calendars, every 15 minutes | the calendar addresses |
| `teletraan-pi-photos` | Copies the Drive photo folder, every 15 minutes | `GOOGLE_API_KEY` |
| `teletraan-pi-slides` | Downloads the slides of the next talks, every 2 minutes | no |

Monday cards and the competition data are written into Sanity by the Teletraan computer at school, and the Pi reads them
from there like any other content. The Pi does not run the Monday sync, the competition sync, the news, the status
writer, the cleanup or the backup. Two computers writing the same documents would overwrite each other.

## The keys

`/opt/teletraan/local.env` is made by hand and is not in the repository. Start from `computer/local.example.env`.
While the Pi is the home copy it needs only these:

- the `CALENDAR_..._URL` lines, for the calendar events
- `GOOGLE_API_KEY`, for the Drive photo folder

Leave `SANITY_WRITE_TOKEN`, `MONDAY_API_TOKEN` and `TBA_AUTH_KEY` out. They are for the computer that writes.

    cp /opt/teletraan/computer/local.example.env /opt/teletraan/local.env
    chmod 600 /opt/teletraan/local.env
    nano /opt/teletraan/local.env

Without the file the dashboard still runs: content, weather, Monday cards and competition data show, and the calendar
events and Drive photos do not.

## Where things are

| What | Where |
| --- | --- |
| The installed copy | `/opt/teletraan/releases/1`, with `/opt/teletraan/current` pointing at it |
| The last good content | `/var/lib/teletraan/data` (on the SD card, so it is there after a restart) |
| Logs | `/run/teletraan-logs` (in memory, gone after a restart) |
| The browser profile and cache | `/run/user/1000/teletraan-chromium` (in memory, removed on leaving) |
| The Ports entry | `~/RetroPie/roms/ports/Teletraan.sh` |
| These files | `computer/pi/` |

## Update

On the Mac, in the repository:

    git ls-files -c -o --exclude-standard -- dashboard computer control VERSION CHANGELOG.md README.md \
      | grep -v 'local\.env$' \
      | rsync -a --delete --files-from=- ./ pi@retropie5:/home/pi/teletraan-stage/

Then on the Pi:

    cd ~/teletraan-stage && sudo ./computer/pi/install-pi.sh "$(cat VERSION)"

Do not copy the whole folder: it holds things that are not part of Teletraan.

## When something is wrong

- The TV stays on EmulationStation: run `/opt/teletraan/computer/pi/launch.sh` from a keyboard on the Pi and read what it says.
- A black screen that does not leave: from the Mac, `ssh pi@retropie5`, then `sudo systemctl stop teletraan-pi.target` and
  `sudo systemctl restart getty@tty1`. That restarts EmulationStation.
- Old content: `systemctl status teletraan-pi-sync` and `tail /run/teletraan-logs/sync.jsonl`.
- Hot: `vcgencmd measure_temp` and `vcgencmd get_throttled`. This Pi runs warm with EmulationStation alone.
- To check it without the TV: `Xvfb :9 -screen 0 1920x1080x24 &`, then
  `sudo env DISPLAY=:9 /opt/teletraan/computer/pi/session.sh`, and take a picture with
  `ffmpeg -f x11grab -video_size 1920x1080 -i :9 -frames:v 1 /tmp/teletraan.png`.

## Remove it

    sudo systemctl stop teletraan-pi.target
    sudo rm /etc/systemd/system/teletraan-pi* /etc/tmpfiles.d/teletraan-pi.conf
    sudo systemctl daemon-reload
    rm ~/RetroPie/roms/ports/Teletraan.sh
    sudo rm -r /opt/teletraan /var/lib/teletraan /var/lib/teletraan-state

The packages it added: chromium, nginx-light, nodejs, python3-evdev, poppler-utils. The nginx service of the system is
masked, because Teletraan runs its own copy of nginx only while it is up.

## If the Pi has to stand in for the school computer

Not set up. The school computer is installed with `computer/install.sh`, which takes over the whole machine (kiosk at
boot, watchdog, nightly restart, Docker). To make the Pi a real spare, install it that way on a second SD card and
keep this one for games. Only one computer may hold the write keys at a time.
