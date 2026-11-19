# Teletraan on the Raspberry Pi

The Pi under the office TV is a game console first. Teletraan is one more thing it can show, started from
EmulationStation and gone again when you leave it. Nothing here runs at boot, and nothing here writes to Sanity.

## The home screen

The console starts at a page of its own, not at EmulationStation: five tiles, Dashboard, Meeting, Game Drop, Lo-Fi and
Arcade. Left and Right (or the d-pad) choose, Enter or X (A on a controller) opens.

- Dashboard, Meeting: as below. Esc leaves and the home screen is back, with that tile marked.
- Game Drop: the live stream of the FIRST Kickoff in the browser, full screen. The address is `KICKOFF_URL` in
  `/opt/teletraan/local.env` when that line is there and starts with https://, and the live page of the FIRST Robotics
  Competition channel (`youtube.com/firstroboticscompetition/live`) when not. Esc leaves. Kickoff 2027 is Saturday,
  January 9, 2027 at 12:00 PM ET. Before and after a stream the page shows what that channel shows.
- Lo-Fi: EmulationStation with Main Menu and Lo-Fi Radio only.
- Arcade: EmulationStation with Main Menu and every game system. The Main Menu entry, or Quit in its Start menu, brings the
  home screen back.

`home.sh` runs it (a line in `/opt/retropie/configs/all/autostart.sh`, before the line of the menu list): it shows
`launcher/` in the browser, the tile that is chosen goes to `exit-watch.py` as `/pi/go/<name>`, which closes the page, and
`home.sh` starts what was chosen. If the page ends with nothing chosen twice in a row (Ctrl + Alt + Backspace twice, or the
browser did not start), `home.sh` ends and the console goes on to EmulationStation with the menu list below, the way it
started before the home screen. To go back to that for good, remove the `home.sh` line from `autostart.sh`.

## The menu

This is what EmulationStation shows when the home screen is not in use (or has stepped aside).

The console starts at a short menu: Teletraan, Meeting, Arcade, Lo-Fi.

- Teletraan has two entries, Dashboard and Control.
- Meeting opens the list of presentations from the Google Drive folder (see Meeting below).
- Arcade is every game system (NES, N64, PSP, the real Arcade and the rest). Its entry, "Enter the Arcade", shows them.
  The first system in there is Main Menu, and its entry, "Back to the Main Menu", brings the short menu back.
- Lo-Fi is the radio (see Lo-Fi below).

EmulationStation has no menu inside a menu, so the two lists are two files: `~/.emulationstation/es_systems.menu.cfg`
and `es_systems.arcade.cfg`. `menu.sh` copies one of them to `~/.emulationstation/es_systems.cfg`, which EmulationStation
reads in place of the full list of the system, and starts EmulationStation again. That takes a few seconds each way.
Every start of the console puts the menu back (a line in `/opt/retropie/configs/all/autostart.sh`).

    /opt/teletraan/computer/pi/menu.sh menu restart     # the short menu
    /opt/teletraan/computer/pi/menu.sh arcade restart   # the game systems
    /opt/teletraan/computer/pi/menu.sh full restart     # the way it was: the whole list of the system, no menu

The full list, `/etc/emulationstation/es_systems.cfg`, is never changed by the menu, so `menu.sh full restart` (or removing
`~/.emulationstation/es_systems.cfg` by hand and starting EmulationStation again) always brings the console back as it was.

## Start

Teletraan has two entries:

- Dashboard: the dashboard fills the TV after a few seconds.
- Control: the control page of this copy. The PIN is 3229 or 3426, or `CONTROL_PIN` if `local.env` has one.

## Meeting

The presentations of the Pi. They are separate from how the Teletraan computer at school plays a presentation: Meeting has
its own page (`meeting/`), its own list and pictures (`meeting-sync.sh`) and its own keys, and nothing of the dashboard is
used.

1. Meeting on the home screen opens the list of the Google Drive folder: Google Slides decks and PowerPoint files (.pptx,
   .ppt) only, the one added last at the top, with its number of slides and the day it was added. A deck that is still
   being made says Getting ready and cannot be opened yet.
2. Up and Down choose, Enter (or Space, or X) opens the deck.
3. Any key goes to the next slide. Left (or Page Up) goes back one. Esc leaves for the Dashboard. After the last slide the
   next key shows the list again. Esc in the list goes back to the home screen.

**Why it opens with no wait.** `teletraan-pi-meeting` runs all the time, not only while Teletraan is on the TV. Every 15
seconds it asks Google for the folder, and every deck that is new or changed is saved as 1920 wide pictures on the disk
of the Pi, newest added first. Opening Meeting asks it to look at once. A deck opens from the disk, and the page keeps the
slides around the one on screen already loaded, so a key press shows the next one with no wait. A deck that was put
in the folder a moment ago has to be made first: Google makes the pictures, which takes some seconds for a short deck and a
minute or two for a long one. The list shows it as Getting ready until then.

**What it needs** (in `/opt/teletraan/local.env`, made by hand): `GOOGLE_API_KEY`, and `MEETING_DRIVE_FOLDER=<the folder
link>`. The folder must be shared with Anyone with the link, as Viewer. Without the folder line, the folder of Dashboard
Settings in Sanity is read (read only). Without the key or the folder the list says which one is missing. The key is the
one the Drive photos use (docs/photos-drive.md).

**Limits.** Each slide is one still picture, as in a PDF: animations, videos and sounds do not play. A PowerPoint file is
drawn by Google, so fonts can differ a little. A deck is cut at 150 slides, and the 50 added last are kept. A file that has
its own sharing tighter than the folder shows Could not be made: not shared. To look at the folder by hand, with every
step printed: `/opt/teletraan/computer/pi/meeting-sync.sh`. The service log: `journalctl -u teletraan-pi-meeting -n 30`.
The list and the pictures are in `/var/lib/teletraan/meeting`.

## Lo-Fi

Lo-Fi Radio is not part of Teletraan: it lives in `/opt/retropie/configs/lofi` (`stations.tsv` is the list of channels,
`radio.py` the player) and in `~/RetroPie/lofi`. A channel is a stream address and a looping clip, played together.

CityPop is channel 8: the Japan City Pop stream of BOX Radio, which sends the track names. Its scene is a plain colour
gradient that ffmpeg made, until there is a real loop for it. The other channels still have their first scenes.

To put a loop behind a channel, download a clip from a site that says what you may do with it (Pexels, Pixabay with "AI
generated" switched off, the Internet Archive, Wikimedia Commons), then, on the Pi:

    /opt/teletraan/computer/pi/lofi-scene.sh 08-citypop ~/Downloads/clip.mp4 <the page it came from> "<its licence>" "<the artist>"

It cuts the clip to 1920x1080 without sound, replaces the scene (the old one is kept once in `scenes/before/`), makes the
picture EmulationStation shows, and adds a line to `scenes/LICENCES.tsv`. It will not run without a source and a licence.
Not from YouTube: its terms do not allow it, and the artwork belongs to whoever made it. After a change to
`stations.tsv`, rebuild the list with `python3 /opt/retropie/configs/lofi/gen_gamelist.py` while EmulationStation is
stopped (EmulationStation writes the list back when it is running).

## Keys in the dashboard

These work on the Pi only. The screen at school does not have them.

| Key | Controller name in RetroPie | What it does |
| --- | --- | --- |
| X | A | The large panel changes to its next step now |
| Z | B | The large panel goes back one step |
| Esc | | Leaves, back to EmulationStation |
| Right Shift | Select | Opens the control page |

X and Z wait while a swap is playing or an alert, a talk or the night screen has the TV.

The letters are the keyboard keys that EmulationStation has for A, B and Select on this Pi. A controller is not
read for them yet: none is set up in EmulationStation.

## Stop

- In the dashboard: Esc.
- On the control page: Esc.
- Anywhere, keyboard: Ctrl + Alt + Backspace.
- Anywhere, controller: hold Select and press Start.

EmulationStation comes back as it was.

## What runs while it is up

`teletraan-pi.target` is started by the launcher and stopped when you leave. The one thing that is up all the time is
`teletraan-pi-meeting` (Meeting, above): it only reads, and works at the lowest priority.

| Unit | What it does | Needs a key |
| --- | --- | --- |
| `teletraan-pi-web` | The web server, on this computer only, port 8080 | no |
| `teletraan-pi-sync` | Reads the content and the weather and keeps the last good copy | no |
| `teletraan-pi-calendars` | Downloads the team calendars, every 15 minutes | the calendar addresses |
| `teletraan-pi-photos` | Copies the Drive photo folder, every 15 minutes | `GOOGLE_API_KEY` |
| `teletraan-pi-slides` | Downloads the slides of the next talks, every 2 minutes | no |
| `teletraan-pi-control` | The control page, on this computer only | no |
| `teletraan-pi-frc` | Reads The Blue Alliance and Statbotics and writes the competition feed (`frc-status`) into Sanity, about hourly, every 5 minutes during an event | `TBA_AUTH_KEY` and `SANITY_WRITE_TOKEN` |

Sanity is the source of truth and the dashboard only reads it, so more than one computer may write to it. The Pi writes
one thing: the competition feed (`teletraan-pi-frc`), and only while Teletraan is up on the TV, so the feed is not
kept up when the console is on games. The Monday cards still come from the Teletraan computer at school. The Pi does
not run the Monday sync, the news, the status writer, the cleanup or the backup. The competition feed is one document
that a run replaces whole from the same public data, so two computers writing it give the same result; the sync pill
shows the time of the last write from either. Without the two keys below the unit says which one is missing and stops.

## The keys

`/opt/teletraan/local.env` is made by hand and is not in the repository. Start from `computer/local.example.env`.
While the Pi is the home copy it needs only these:

- the `CALENDAR_..._URL` lines, for the calendar events
- `GOOGLE_API_KEY`, for the Drive photo folder and for Meeting, and `MEETING_DRIVE_FOLDER`, the folder link for Meeting
- `TBA_AUTH_KEY` and `SANITY_WRITE_TOKEN`, for the competition feed. Leave `MONDAY_API_TOKEN` out: the Monday sync is not
  run here. The key file is made by hand on the Pi and is never copied from the school computer by a script. To see that
  the Blue Alliance key works: `/opt/teletraan/computer/scripts/frc-sync.sh --check` (it writes nothing).

    cp /opt/teletraan/computer/local.example.env /opt/teletraan/local.env
    chmod 600 /opt/teletraan/local.env
    nano /opt/teletraan/local.env

Without the file the dashboard still runs: content, weather, Monday cards and competition data show, and the calendar
events, the Drive photos and Meeting do not.

The Pi does not run the list of presentations of the dashboard (F5 or P). Presentations are Meeting.

## The control page here

It is the same control page as at school, open to this computer only. What works without more keys: Now, the
Presentations section of Show, and everything that only reads. What does not: anything that saves to Sanity, because
this copy has no `SANITY_WRITE_TOKEN` unless the competition feed is set up here, and the buttons that
update, reboot or save keys, because the helper they use is not installed here.

## Where things are

| What | Where |
| --- | --- |
| The installed copy | `/opt/teletraan/releases/1`, with `/opt/teletraan/current` pointing at it |
| The last good content | `/var/lib/teletraan/data` (on the SD card, so it is there after a restart) |
| Logs | `/run/teletraan-logs` (in memory, gone after a restart) |
| The browser profile and cache | `/run/user/1000/teletraan-chromium` (in memory, removed on leaving) |
| The full list of systems | `/etc/emulationstation/es_systems.cfg` (the file from before is beside it, `.before-teletraan`) |
| The menu and the Arcade lists | `~/.emulationstation/es_systems.menu.cfg`, `es_systems.arcade.cfg`; the one in use is `es_systems.cfg` there |
| The home screen | `computer/pi/launcher/` (the page), `home.sh` (the loop), `exit-watch.py` (`/pi/go/<name>`) |
| The start of the console | `/opt/retropie/configs/all/autostart.sh` (the file from before is beside it, `.before-teletraan`) |
| The entries and their look | `~/RetroPie/roms/teletraan/`, `meeting/`, `arcademenu/`, `mainmenu/` (entries, `theme.xml`, `logo.svg`). The Hawktimus theme set is not changed. |
| Lo-Fi | `/opt/retropie/configs/lofi/` and `~/RetroPie/lofi/` (not in this repository, except `lofi-scene.sh`) |
| These files | `computer/pi/` |

## Update

On the Mac, in the repository:

    git ls-files -c -o --exclude-standard -- dashboard computer control studio VERSION CHANGELOG.md README.md \
      | grep -v 'local\.env$' \
      | rsync -a --delete --files-from=- ./ pi@retropie5:/home/pi/teletraan-stage/

Then on the Pi:

    cd ~/teletraan-stage && sudo ./computer/pi/install-pi.sh "$(cat VERSION)"

Do not copy the whole folder: it holds things that are not part of Teletraan.

## When something is wrong

- The TV stays on EmulationStation: run `/opt/teletraan/computer/pi/launch.sh` from a keyboard on the Pi and read what it says.
- The home screen does not show, or the console starts at EmulationStation: `/opt/teletraan/computer/pi/home.sh` from a
  keyboard on the Pi shows what stops it. Two misses in a row hand the screen to EmulationStation on purpose.
- Game Drop shows no video or no sound: the stream is a normal YouTube page, so it needs the Pi's sound output to be the
  TV and a stream that is live. `KICKOFF_URL` in `local.env` can point at a particular stream.
- The menu is wrong, or a system is missing: `/opt/teletraan/computer/pi/menu.sh full restart` brings the whole list back, and
  `sudo computer/pi/install-pi.sh` makes the two short lists again from it.
- Meeting says the list is not ready: `systemctl status teletraan-pi-meeting`. A deck stays on Getting ready: run
  `/opt/teletraan/computer/pi/meeting-sync.sh` by hand and read what it says.
- Esc in Meeting does nothing: the page has not loaded. Hold Select and press Start, or press Ctrl + Alt + Backspace.
- A black screen that does not leave: from the Mac, `ssh pi@retropie5`, then `sudo systemctl stop teletraan-pi.target` and
  `sudo systemctl restart getty@tty1`. That restarts EmulationStation.
- Old content: `systemctl status teletraan-pi-sync` and `tail /run/teletraan-logs/sync.jsonl`.
- Hot: `vcgencmd measure_temp` and `vcgencmd get_throttled`. This Pi runs warm with EmulationStation alone.
- To check it without the TV: `Xvfb :9 -screen 0 1920x1080x24 &`, then
  `sudo env DISPLAY=:9 /opt/teletraan/computer/pi/session.sh`, and take a picture with
  `ffmpeg -f x11grab -video_size 1920x1080 -i :9 -frames:v 1 /tmp/teletraan.png`.

## Remove it

    sudo systemctl stop teletraan-pi.target
    sudo systemctl disable --now teletraan-pi-meeting.service
    sudo rm /etc/systemd/system/teletraan-pi* /etc/tmpfiles.d/teletraan-pi.conf
    sudo systemctl daemon-reload
    rm -r ~/RetroPie/roms/teletraan ~/RetroPie/roms/meeting ~/RetroPie/roms/arcademenu ~/RetroPie/roms/mainmenu
    rm ~/.emulationstation/es_systems.cfg ~/.emulationstation/es_systems.menu.cfg ~/.emulationstation/es_systems.arcade.cfg
    sudo cp /opt/retropie/configs/all/autostart.sh.before-teletraan /opt/retropie/configs/all/autostart.sh
    sudo cp /etc/emulationstation/es_systems.cfg.before-teletraan /etc/emulationstation/es_systems.cfg
    sudo rm -r /opt/teletraan /var/lib/teletraan /var/lib/teletraan-state

The packages it added: chromium, nginx-light, nodejs, python3-evdev, poppler-utils. The nginx service of the system is
masked, because Teletraan runs its own copy of nginx only while it is up.

## If the Pi has to stand in for the school computer

Not set up. The school computer is installed with `computer/install.sh`, which takes over the whole machine (kiosk at
boot, watchdog, nightly restart, Docker). To make the Pi a real spare, install it that way on a second SD card and
keep this one for games. Only one computer may hold the write keys at a time.
