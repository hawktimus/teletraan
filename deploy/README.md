# Deploy

Everything that puts the dashboard on the TV. The steps to set up a Mini from
nothing are in `docs/rebuilding-the-mini.md`. This page says what each file
is for. Ask the team mentor (see docs/where-things-are.md) before
installing anything on the Mini, and whenever a step needs a login or a key.

## How it fits together

- A web server container shows the `dashboard` folder at
  `http://localhost:3229/dashboard/`, the port in `TELETRAAN_PORT` in
  `local.env`. It can only be reached from the Mini.
- A timer runs `pull.sh` every 5 minutes. A pull is a deploy: the files in the
  repository are the files on the screen.
- A timer runs `fetch-calendars.sh` every 15 minutes. It saves the BAND
  calendars where the dashboard reads them.
- The kiosk service starts a browser full screen when the Mini boots. A kiosk
  is a browser with no address bar, tabs or menus.

The calendars, `version.txt` and `device.json` live in
`/var/lib/teletraan/data` on the Mini, not in the repository. The container
shows that folder as `dashboard/data/live/`, so nothing the Mini downloads
ever shows up in git. The scripts write the calendars, `version.txt` and
`device.json` (the Mini's name and addresses, written every minute by
`kiosk.sh`, see "Finding the Mini on the network" in
`docs/rebuilding-the-mini.md`). The photos are not on the Mini: they are
uploaded in Studio and come with the rest of the content. The dashboard used to
read a list of photos from a `photos.json` file in that folder. It does not any
more, so a file with that name left on an older Mini can be deleted.

Do not delete `dashboard/data/live/.gitkeep`: Docker needs the empty folder
to attach the data folder to.

## Files

| File | What it does |
|------|--------------|
| `docker-compose.yml` | Starts the web server container, fixed to one nginx version |
| `nginx.conf` | The web server's settings: no caching, file types, hidden files |
| `local.example.env` | The template for `local.env`, with placeholders only |
| `scripts/pull.sh` | Gets new commits and writes `version.txt` so an open dashboard reloads |
| `scripts/fetch-calendars.sh` | Downloads each calendar named in `local.env`, over https only |
| `scripts/check-connection.sh` | Checks DNS, Sanity, CORS, BAND, the web container, the kiosk and the clock, one OK or FAIL line each. Run it over SSH, see "Checking the connection" in `docs/rebuilding-the-mini.md` |
| `scripts/kiosk.sh` | Opens the browser full screen with the right settings, or any page given after its name. Also writes `device.json` every minute while the browser runs |
| `scripts/install-timers.sh` | Copies the unit files into place and turns on the two timers |
| `systemd/*.service`, `*.timer` | What runs, and how often |

## local.env

The real settings file is `local.env`. It holds the calendar feed addresses,
which are secrets, so it is never committed and only the Mini's account (the
one that owns the repository) may read it:

    cp local.example.env local.env
    chmod 600 local.env

The Mini's dashboard port is 3229. Set `TELETRAAN_PORT='3229'` in `local.env`:
the template and the fallback in `docker-compose.yml` still say 8080. The screen
and the Sanity CORS origin (studio/README.md, step 6) both use this port.

Git ignores the file wherever it sits, and also copies an editor leaves next
to it, such as `local.env.save`. Never paste a feed address into a file that
is committed, into a chat or into an issue.

## Everyday commands

Run these on the Mini. A command that starts with `sudo` needs administrator rights.

    sudo docker compose --env-file local.env up -d         start or update the web server
    sudo docker compose ps                                 is it running?
    sudo docker logs teletraan-web                         what has it said?
    systemctl list-timers 'teletraan-*'                    when do the timers run next?
    sudo journalctl -u teletraan-pull.service -n 30        what did the last pulls do?
    sudo journalctl -u teletraan-calendars.service -n 30   what did the last downloads do?
    sudo journalctl -u teletraan-kiosk.service -n 30       why is the screen black?
    sudo systemctl restart teletraan-kiosk.service         restart the browser
    sudo systemctl stop teletraan-kiosk.service            stop the screen, to use the Mini's terminal

Run `docker compose` from this folder. Ctrl+Alt+F1 at the Mini's own keyboard
(with the Fn key too on a Mac keyboard) leaves the screen and shows a text
login.

## When a pull changes this folder

A pull updates the dashboard at once. Changes inside `deploy/` only take
effect when someone applies them. `pull.sh` says so in the log when it
happens.

- `docker-compose.yml` or `nginx.conf` changed: run
  `sudo docker compose --env-file local.env up -d --force-recreate`
- a file in `systemd/` changed: run `sudo /opt/teletraan/deploy/scripts/install-timers.sh`, which
  also restarts the two timers, then
  `sudo systemctl restart teletraan-kiosk.service` if the kiosk file changed
- `pull.sh` or `fetch-calendars.sh` changed: nothing to do, the next run uses
  the new script
- `kiosk.sh` changed: restart the kiosk service, because the browser only
  reads the script when it starts

## Things that need the team mentor's yes

Installing the packages on the Mini, Docker's apt source and key, the nginx
image, and the deploy key all need the team mentor's yes first. The list, with
the step that uses each one, is the table at the top of
`docs/rebuilding-the-mini.md`.

## Names this folder assumes

The unit files use the repository location `/opt/teletraan`.
`install-timers.sh` stops with an explanation if the repository is somewhere
else. The account is not named in the unit files: they say `ACCOUNT`, and
`install-timers.sh` fills in the account that owns the repository, so it works
whatever the Mini's user is called. The repository must not be owned by root.
To use another location, change it in every file in `systemd/`.
