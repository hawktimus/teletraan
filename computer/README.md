# The Teletraan computer

Everything that runs on the Teletraan computer and puts the dashboard on the TV. The steps to set up a computer from
nothing are in `docs/rebuilding-the-computer.md`. This page says what each file
is for. Ask the team mentor (see docs/where-things-are.md) before
installing anything on the computer, and whenever a step needs a login or a key.

## How it fits together

- A web server container shows the `dashboard` folder at
  `http://localhost:8080/dashboard/`, the port in `TELETRAAN_PORT` in
  `local.env`. It can only be reached from the Teletraan computer. A second port, 3229, shows the control
  page and the Studio to the WiFi and to Tailscale (`docs/control-page.md`).
- A timer can run `pull.sh` every 5 minutes. A pull is a deploy: the files in the
  repository are the files on the screen. A computer that gets its files from a Mac
  (below) leaves this timer off and installs only the calendar and slides
  services (`docs/rebuilding-the-computer.md`, step 11).
- `tools/teletraan/teletraan-tool` runs on a Mac. It copies the files to the computer
  instead of pulling, keeps the keys and calendar lines of `local.env`, installs
  the services and shows the status (`docs/updating-the-computer.md`). Its words
  `update`, `status` and `restart` do one thing with no menu.
- `tools/mac/ship.sh` runs on the Mac you work on, not on the computer. It checks the code,
  pushes to GitHub, deploys the Studio and runs `teletraan-tool update --yes`, so
  the computer gets the files from that Mac and the screen restarts
  (`docs/shipping-from-the-mac.md`). `docs/laptop-setup.md` sets up a second Mac
  for it. A computer gets its files from this tool or from the pull timer, not both.
- A timer runs `fetch-calendars.sh` every 15 minutes. It saves the BAND
  calendars where the dashboard reads them. After each run, failed or not, the
  service also makes the document that the Calendars page in Studio shows
  (`docs/calendars-page.md`).
- A timer runs `slides-sync.sh` every 2 minutes. It downloads the slides of
  the talks that are coming up and saves them as pictures where the dashboard
  reads them.
- A timer wakes `frc-sync.sh` every 5 minutes. The script reads the public FRC
  data of each team and writes it into Sanity, about once an hour, or about every
  5 minutes while a team has an event on (`docs/frc-feed.md`).
- A timer wakes `monday-sync.sh` every 5 minutes. The script reads the task board and the
  milestones board of the Monday tab only as often as How often says, and writes the items
  into Sanity as tasks and milestones (`docs/monday.md`).
- A timer runs `watchdog.sh` every 2 minutes. It reads the page title that the
  dashboard refreshes every 30 seconds, from the browser's page list on
  127.0.0.1:9222, and restarts the kiosk service when the title is more than 3
  minutes old, the page is missing or the browser is gone. At most one restart
  in 10 minutes, and a third in an hour stops it until the next boot. Its count
  is the file `watchdog-state` in the data folder (`docs/coaches-guide.md`).
- A timer runs `backup-dataset.sh` at 03:15 every night. It exports the Sanity
  dataset to `/var/backups/teletraan/production-<date>.tar.gz` and keeps the
  newest 14 (`docs/coaches-guide.md`, Backups).
- The kiosk service starts a browser full screen when the computer boots. A kiosk
  is a browser with no address bar, tabs or menus.
- Two text drawings, `console/startup.txt` and `console/shutdown.txt`, fill the
  TV while the computer starts (above the login prompt) and while it shuts down.
  `install-console.sh` puts the first in `/etc/issue` and turns on a unit that
  prints the second. The container shows only the `dashboard` folder, so the
  drawings are not served.

The calendars, the slides, `version.txt` and `device.json` live in
`/var/lib/teletraan/data` on the Teletraan computer, not in the repository. The container
shows that folder as `dashboard/data/live/`, so nothing the computer downloads
ever shows up in git. The slides of a talk are in `slides/<talk id>/` there,
and the dashboard reads them at `data/live/slides/<talk id>/`. The scripts
write the calendars, the slides, `version.txt` and `device.json` (the computer's
name and addresses, written every minute by `kiosk.sh`, see "Finding the computer
on the network" in `docs/rebuilding-the-computer.md`). The photos are not on the
computer: they are uploaded in Studio and come with the rest of the content.

Do not delete `dashboard/data/live/.gitkeep`: Docker needs the empty folder
to attach the data folder to.

## Files

| File | What it does |
|------|--------------|
| `install.sh` | Installs a release of the repository on the Teletraan computer: the one-time move to the releases layout, the helper socket, the sudoers file, the Studio build, the web server and the control service. The control page and the Mac tool run it (`docs/control-page.md`) |
| `sudoers/teletraan-control` | The few commands the helper may run with sudo |
| `git/post-receive` | The hook of the optional bare repository that a laptop can push to (`docs/control-page.md`, The git path) |
| `scripts/lib.sh` | Read by every script: the folders, `setting` (the one reader of `local.env`) and `config_value` (the one reader of `dashboard/config.js`). Every script starts with `#!/bin/bash`, a usage line, `set -euo pipefail` and this file |
| `scripts/control-helper.sh` | The host side of the control page. It accepts a fixed list of words and nothing else, and logs each one |
| `scripts/display.sh` | Finds the connected screen with `xrandr` and sets a 1920 by 1080 framebuffer. `kiosk.sh` reads it |
| `docker-compose.yml` | Starts the web server container, fixed to one nginx version |
| `nginx/nginx.conf` | The web server's settings: no caching (except 10 seconds for a deck's `manifest.json`), file types, hidden files |
| `local.example.env` | The template for `local.env`, with placeholders only |
| `scripts/pull.sh` | Gets new commits and writes `version.txt` so an open dashboard reloads |
| `scripts/fetch-calendars.sh` | Downloads each calendar named in `local.env`, over https only. Leaves `calendar-sync.txt` in the data folder: for each calendar its code, when it was last downloaded properly and why the last try failed. It holds no address |
| `scripts/calendar-status.sh` | Makes `calendar-status.json` in the data folder, the document for the Calendars page in Studio, from `calendar-sync.txt`. With Node 18 or newer on the computer it also lists the next 40 events of each calendar, with the day of each, SHOWN or HIDDEN. Without Node it says so in the document. Prints no address |
| `scripts/calendar-status.mjs` | The part of `calendar-status.sh` that runs the dashboard's own calendar code and the Calendar filters. It never sees an address |
| `scripts/check-connection.sh` | Checks DNS, Sanity, CORS, BAND, the web container, the kiosk and the clock, one OK or FAIL line each. Run it over SSH, see "Checking the connection" in `docs/rebuilding-the-computer.md` |
| `scripts/check-calendars.sh` | Lists each event of the next 30 days of every calendar in `local.env`, SHOWN or HIDDEN with the name of the Calendar filter that hides it, and the counts. A KIND line gives the kind of the calendar, or no chip when it has none. A SHOWN line also gives the page of the Events panel and the kind of the calendar. It only reads and prints no address. It needs Node, which the computer does not have unless it was installed for the Calendars page, so run it on a computer that has Node and a copy of `local.env` |
| `scripts/check-calendars.mjs` | The part of `check-calendars.sh` that runs the dashboard's own calendar code |
| `scripts/slides-sync.sh` | Downloads the slides of the coming talks from Google Slides, turns them into pictures, and saves them with a `manifest.json`. `slides-sync.sh --test <link>` tries one deck and deletes what it made. Needs `poppler-utils`, `curl` and `jq` |
| `scripts/frc-sync.sh` | Reads the public FRC data of each team from The Blue Alliance and Statbotics and writes the document `frc-status` in Sanity. Every address and every place in an answer is in `scripts/frc-contract.sh`. The script is in parts that it reads from the same folder: `frc-contract.sh`, `frc-requests.sh`, `frc-modes.sh`, `frc-read.sh` and `frc-programs.sh`. `frc-sync.sh --check` tries the key, `--now` does a run whatever the time. Needs `curl` and `jq`, `TBA_AUTH_KEY` and `SANITY_WRITE_TOKEN` in `local.env`, and does nothing without them. See `docs/frc-feed.md` |
| `scripts/monday-sync.sh` | Reads the task board and the milestones board named in Dashboard Settings, at most 4 requests a run and 900 a day, and writes their items into Sanity as tasks and milestones, and the document `monday-status` with the boards the token can see and what it read from each. Every address, question and place in an answer is in `scripts/monday-contract.sh`. The script is in parts that it reads from the same folder: `monday-contract.sh`, `monday-requests.sh`, `monday-check.sh` and `monday-programs.sh`. `monday-sync.sh --check` tries the token. Needs `curl` and `jq`, `MONDAY_API_TOKEN` and `SANITY_WRITE_TOKEN` in `local.env`, and does nothing without them. See `docs/monday.md` |
| `scripts/status-write.sh` | Writes the time of a job into the document `status-mini` in Sanity, which Studio shows at the top of the Screen tab of Dashboard Settings. `status-write.sh calendar-status` sends the Calendars page document the same way. Needs `SANITY_WRITE_TOKEN` in `local.env` and does nothing without it. `status-write.sh --print` needs no key: it reads the document back and shows each time with its age. The calendar and slides services and `kiosk.sh` run it, see "Showing what the computer did in Studio" in `docs/rebuilding-the-computer.md` |
| `scripts/kiosk.sh` | Opens the browser full screen with the right settings, or any page given after its name. Also writes `device.json` every minute while the browser runs, and starts `status-write.sh kiosk` in the background |
| `scripts/install-timers.sh` | Copies the unit files into place and turns on the calendar timer and the pull timer |
| `scripts/install-calendars.sh` | Copies the two calendar unit files into place and turns on the calendar timer. Installs nothing else, so it leaves the pull timer off |
| `scripts/install-slides.sh` | Copies the two slides unit files into place and turns on the slides timer. Does not install the packages, it prints the `apt install` line when one is missing |
| `scripts/install-frc.sh` | Copies the two FRC unit files into place and turns on the FRC timer. Does not install the packages, it prints the `apt install` line when one is missing |
| `scripts/watchdog.sh` | Restarts the kiosk service when the screen has frozen (see above). Runs as root. Needs `curl`, `pgrep` and `awk`. Keeps its count in `watchdog-state` in the data folder |
| `scripts/install-watchdog.sh` | Copies the two watchdog unit files into place and turns on the watchdog timer. Does not install the packages, it prints the `apt install` line when one is missing |
| `scripts/nightly.sh` | Restarts the kiosk service at 04:00 and reboots the computer at 04:10 on Sundays. Runs as root from `teletraan-nightly.timer`. Skips either when a presentation is booked within the next hour or is running |
| `scripts/install-nightly.sh` | Copies the two nightly unit files into place and turns on the nightly timer. Needs `curl` |
| `scripts/backup-dataset.sh` | Exports the dataset with the Sanity tool in `studio/node_modules`, using `SANITY_WRITE_TOKEN` from `local.env` without printing it, keeps the newest 14 files and writes `lastBackupAt` to `status-mini`. Does nothing useful without the token |
| `scripts/install-backup.sh` | Makes `/var/backups/teletraan`, copies the two backup unit files into place and turns on the backup timer. Stops with the `npm install` line when the Sanity tool is missing from `studio/` |
| `scripts/install-monday.sh` | Copies the two Monday unit files into place and turns on the Monday timer. Does not install the packages, it prints the `apt install` line when one is missing |
| `scripts/install-console.sh` | Keeps a copy of `/etc/issue` once, writes the startup drawing above that text, copies `teletraan-console.service` and turns it on. Installs no package and is safe to run twice. The way back is in `docs/rebuilding-the-computer.md`, step 13 |
| `console/startup.txt`, `console/shutdown.txt` | The drawing shown above the login prompt while the computer starts, and the same drawing with the words "shutting down" for when it stops. Plain 7 bit text, at most 100 columns by 56 rows, with no backslash because the login prompt reads one as a code |
| `systemd/*.service`, `*.timer` | What runs, and how often |

## local.env

The real settings file is `local.env`. It holds the calendar feed addresses, the
Sanity write token (`SANITY_WRITE_TOKEN`), the key for the FRC feed
(`TBA_AUTH_KEY`) and the token for Monday (`MONDAY_API_TOKEN`), which are secrets, so it is never
committed and only the Teletraan computer's account (the one that owns the repository) may
read it:

    cp local.example.env local.env
    chmod 600 local.env

The dashboard's port is `TELETRAAN_PORT` in `local.env`, 8080 to start with, and it
is open on the Teletraan computer itself only. The screen and the Sanity CORS origin
(docs/control-page.md, First time, step 4) both use this port. Port 3229 is the
control page and the Studio, open to the WiFi and to Tailscale, so `TELETRAAN_PORT`
must not be 3229.

Git ignores the file wherever it sits, and also copies an editor leaves next
to it, such as `local.env.save`. Never paste a feed address into a file that
is committed, into a chat or into an issue.

The Mac tool (`docs/updating-the-computer.md`) can write the three keys and the
calendar lines from a form. It replaces the lines it is given, keeps every other
line and leaves the file at mode 600.

## Everyday commands

Run these on the Teletraan computer. A command that starts with `sudo` needs administrator rights.

    sudo docker compose --env-file local.env up -d         start or update the web server
    sudo docker compose ps                                 is it running?
    sudo docker logs teletraan-web                         what has it said?
    systemctl list-timers 'teletraan-*'                    when do the timers run next?
    sudo journalctl -u teletraan-pull.service -n 30        what did the last pulls do?
    sudo journalctl -u teletraan-calendars.service -n 30   what did the last downloads do?
    sudo journalctl -u teletraan-slides.service -n 30      what did the last slide downloads do?
    sudo journalctl -u teletraan-frc.service -n 30         what did the last FRC runs do?
    sudo journalctl -u teletraan-monday.service -n 30      what did the last Monday runs do?
    sudo journalctl -u teletraan-watchdog.service -n 30    why did the screen restart?
    sudo journalctl -u teletraan-backup.service -n 30      did last night's backup work?
    sudo journalctl -u teletraan-kiosk.service -n 30       why is the screen black?
    sudo systemctl restart teletraan-kiosk.service         restart the browser
    sudo systemctl stop teletraan-kiosk.service            stop the screen, to use the Teletraan computer's terminal

Run `docker compose` from this folder. Ctrl+Alt+F1 at the Teletraan computer's own keyboard
(with the Fn key too on a Mac keyboard) leaves the screen and shows a text
login.

## When a pull changes this folder

A pull updates the dashboard at once. Changes inside `computer/` only take
effect when someone applies them. `pull.sh` says so in the log when it
happens.

- `docker-compose.yml` or `nginx.conf` changed: run
  `sudo docker compose --env-file local.env up -d --force-recreate`
- a file in `systemd/` changed: run `sudo /opt/teletraan/computer/scripts/install-timers.sh`, which
  also restarts the two timers, then
  `sudo systemctl restart teletraan-kiosk.service` if the kiosk file changed
- a calendar file in `systemd/` changed on a computer without the pull timer: run
  `sudo /opt/teletraan/computer/scripts/install-calendars.sh`
- a slides file in `systemd/` changed: run
  `sudo /opt/teletraan/computer/scripts/install-slides.sh`
- an FRC file in `systemd/` changed: run
  `sudo /opt/teletraan/computer/scripts/install-frc.sh`
- a Monday file in `systemd/` changed: run
  `sudo /opt/teletraan/computer/scripts/install-monday.sh`
- a watchdog file in `systemd/` changed: run
  `sudo /opt/teletraan/computer/scripts/install-watchdog.sh`
- a backup file in `systemd/` changed: run
  `sudo /opt/teletraan/computer/scripts/install-backup.sh`
- a nightly file in `systemd/` changed: run
  `sudo /opt/teletraan/computer/scripts/install-nightly.sh`
- `console/startup.txt` changed: run
  `sudo /opt/teletraan/computer/scripts/install-console.sh`, because `/etc/issue`
  is a copy of it. `console/shutdown.txt` changed: nothing to do, the unit
  reads the file when the Teletraan computer stops. `teletraan-console.service` changed: run
  the same script
- `pull.sh`, `fetch-calendars.sh`, `slides-sync.sh`, `frc-sync.sh` or `monday-sync.sh` changed: nothing to do,
  the next run uses the new script
- `kiosk.sh` changed: restart the kiosk service, because the browser only
  reads the script when it starts

## Things that need the team mentor's yes

Installing the packages on the Teletraan computer (and Node 18 or newer, if the Calendars page is
to list events), Docker's apt source and key, the nginx image, the deploy key and
the change to `/etc/issue` all need the team mentor's yes first. The list, with
the step that uses each one, is the table at the top of
`docs/rebuilding-the-computer.md`.

## Names this folder assumes

The unit files use the repository location `/opt/teletraan`.
`install-timers.sh`, `install-calendars.sh`, `install-slides.sh`, `install-frc.sh`,
`install-monday.sh`, `install-watchdog.sh`, `install-nightly.sh`, `install-backup.sh` and `install-console.sh` stop with an explanation if the repository is somewhere
else. The account is not named
in the unit files: they say `ACCOUNT`, and the install script fills in the
account that owns the repository, so it works whatever the Teletraan computer's user is
called. The repository must not be owned by root. `teletraan-console.service`
runs as root and has no account in it.
To use another location, change it in every file in `systemd/`.
