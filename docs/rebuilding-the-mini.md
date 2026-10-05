# Rebuilding the Mini

How to take the Mac Mini (the Mini, see docs/where-things-are.md) from a fresh Debian install
to a working screen. Allow an afternoon.

Most of what the Mini shows comes back from somewhere else: the dashboard from
the repository, the content from Sanity (the service the editors type into)
and the calendars from BAND. Three things live only on the Mini and are lost
when its disk is wiped:

- `deploy/local.env`, which holds the calendar feed addresses
- the deploy key in `/home/hawktimus/.ssh`, if the repository is private
- the password of the `hawktimus` account

Before you wipe anything, keep a copy of each wherever the team mentor keeps
the team's passwords.

## Before you start

You need a USB stick with the Debian installer, a network cable, a keyboard,
the address of the repository, and the calendar feed addresses from BAND.

A school network can block things this page needs: SSH to the repository host
(port 22) and Docker Hub. If a step cannot connect, ask the team mentor.

**Do not install or create anything in this list until the team mentor has
said yes.**

| What | Why | Step |
|------|-----|------|
| Debian, and the `hawktimus` account the installer creates | the operating system | 2 |
| `openssh-server` (optional) | fix the Mini from another computer | 2 |
| `systemd-timesyncd`, only if step 3 says the clock is not kept in sync: `sudo apt install systemd-timesyncd`, then `sudo timedatectl set-ntp true` | keep the clock right | 3 |
| `git`, `curl`, `ca-certificates` | download the repository and the calendars | 4 |
| Docker Engine and the Compose plugin: `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, `docker-compose-plugin`. They come from Docker's own apt source, so Docker's apt repository and its signing key are added too. Debian's `docker.io` also works if `docker compose version` then runs. | run the web server | 5 |
| A read-only deploy key for the repository, if it is private | let the Mini pull updates | 6 |
| The `nginx:1.28-alpine` container image, downloaded from Docker Hub by Docker the first time the server starts | the web server itself | 9 |
| `xserver-xorg`, `xinit`, `x11-xserver-utils`, `chromium` | show the dashboard full screen | 11 |
| `unclutter` (optional) | hide the mouse pointer when testing inside a desktop | 11 |

The repository host needs an account that the team mentor holds. This page does
not create it. The Sanity project already exists, and its ID is in
dashboard/config.js. Setting up the Studio is done on a Mac, not on the Mini:
see studio/README.md.

## Steps

1. **Turn on power-on after a power cut.** Do this before wiping macOS. Start
   the Mini in macOS once, open System Preferences (System Settings on a
   newer macOS), choose Energy Saver, and tick "Start up automatically after
   a power failure". The Mini then switches itself on when the power returns.
   The setting normally survives installing Debian. If macOS is already gone,
   skip this step. The power test at the end shows whether it is needed.

2. **Install Debian.** Use a network cable. Put the installer stick in, hold
   the Option key while the Mini starts, and pick the stick (it may be called
   "EFI Boot"). Name the first user `hawktimus` and leave the root password
   empty, so that user can run `sudo`. (The scripts work with whatever the
   user is called. They use the account that owns the repository.) If the installer offers to install
   the boot loader for EFI, accept. When asked what to install, tick
   "standard system utilities" and nothing else. Do not install a desktop.
   "SSH server" is the one extra to tick, if the team mentor approves it.

3. **Set the time zone.** The date and time on the screen, and the countdown,
   come from the Mini's clock.

       sudo timedatectl set-timezone America/New_York
       timedatectl

   The output should include `System clock synchronized: yes`. If it says
   `no`, install `systemd-timesyncd` as in the table above.

4. **Install the basic tools.**

       sudo apt update
       sudo apt install git curl ca-certificates

5. **Install Docker.** Follow "Install Docker Engine on Debian" on
   docs.docker.com. Then check that both of these print a version:

       sudo docker version
       sudo docker compose version

6. **Get the repository.** The unit files expect it in `/opt/teletraan`.

       sudo mkdir /opt/teletraan
       sudo chown hawktimus:hawktimus /opt/teletraan
       git clone [repository address] /opt/teletraan

   If the repository is private, the Mini needs a read-only deploy key. The
   team mentor sets that up. The key stays in `/home/hawktimus/.ssh` and is
   never put in the repository. On Debian a user's group has the same name as
   the user, so the group is `hawktimus` too. If `git clone` cannot connect, port 22 may be
   blocked on the school network. Ask the team mentor.

7. **Make the data folder.** The calendars, `version.txt` and `device.json`
   go here, outside the repository.

       sudo mkdir -p /var/lib/teletraan/data
       sudo chown hawktimus:hawktimus /var/lib/teletraan/data

8. **Make local.env.** Lock the file before the addresses go in.

       cd /opt/teletraan/deploy
       cp local.example.env local.env
       chmod 600 local.env
       nano local.env

   Set `TELETRAAN_PORT` to `'3229'`. That is the port the dashboard uses on
   this team's Mini, so the screen is at `http://localhost:3229/dashboard/`,
   and that address must be a CORS origin in the Sanity project (studio/README.md,
   step 6). The template says 8080, so change it.

   Replace the placeholder with the real calendar address. Add one
   `CALENDAR_<ID>_URL` line for each calendar. Keep each address in single
   quotes. Use the `https://` or `webcal://` address. `fetch-calendars.sh`
   refuses a plain `http://` one.

   Then tell the dashboard which calendars to show. In Studio open Dashboard
   Settings, then the Calendars tab, and add one row for each calendar. The
   row's code must be the lowercase part of the name in `local.env`: `team`
   for `CALENDAR_TEAM_URL`. A code can be up to 20 characters. The Mini
   downloads every calendar in `local.env`, but the dashboard only shows a
   calendar that has a row. A new Studio starts with one row, `team`.

9. **Start the web server.**

       cd /opt/teletraan/deploy
       sudo docker compose --env-file local.env up -d
       curl -I http://localhost:3229/dashboard/

   The curl answer should start with `200` and include `Cache-Control:
   no-store`. The server starts by itself after every reboot.

10. **Turn on the timers.** Run the two scripts once by hand first, to see
    that they work.

        /opt/teletraan/deploy/scripts/pull.sh
        /opt/teletraan/deploy/scripts/fetch-calendars.sh
        sudo /opt/teletraan/deploy/scripts/install-timers.sh

    `fetch-calendars.sh` prints one line for each calendar and never prints an
    address.

11. **Set up the screen.** Install the display packages.

        sudo apt install xserver-xorg xinit x11-xserver-utils chromium

    The screen runs as a kiosk: a browser that fills the screen with no
    address bar, tabs or menus. Try it by hand before turning on the service,
    which takes over the Mini's screen. At the Mini's own keyboard, log in as
    `hawktimus` on the text screen and run the command below. If the service
    is already running, stop it first with
    `sudo systemctl stop teletraan-kiosk.service`.

        xinit /opt/teletraan/deploy/scripts/kiosk.sh -- :1 vt8

    If it says `Only console users are allowed to run the X server`, the
    command was not run from the Mini's own text screen. It does not work over
    SSH or from a terminal window inside a desktop. Type `tty` first. It
    should print `/dev/tty1` (or tty2, tty3), not `/dev/pts/0`.

    The dashboard appears on the TV. If something is wrong, the terminal
    prints why. To stop it, press Ctrl+Alt+F1 to go back to the text screen
    and press Ctrl+C. Then turn on the kiosk service so the browser starts at
    boot:

        sudo systemctl enable --now teletraan-kiosk.service

    The TV now shows the dashboard. To get a terminal back, press Ctrl+Alt+F1
    (hold the Fn key too on a Mac keyboard) and log in. To stop the screen,
    run `sudo systemctl stop teletraan-kiosk.service`. To use Firefox instead
    of Chromium, see the comments at the end of `deploy/scripts/kiosk.sh`.

12. **Stop the Mini sleeping.** `kiosk.sh` already turns off the screen saver
    and screen blanking. This stops Debian suspending the whole machine:

        sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target

    On the TV itself, turn off any sleep timer, auto power off and eco mode.
    An OLED or plasma TV is the exception, see Burn-in below.

13. **Turn off overscan on the TV.** Overscan crops the edges of the picture.
    In the TV's picture settings choose the size setting called "Just Scan",
    "Screen Fit", "1:1" or "Dot by Dot" (the name depends on the make). If
    the HDMI input can be named, name it "PC".

14. **Reboot and test.**

        sudo reboot

    Then go through What to check.

## Burn-in

The plates, the metal frames, the banner and the countdown stay in the same
place all day. Only the pages inside the frames change, and the frames lift off
for a moment at every page change and drop back to exactly where they were. On
an LCD or LED TV that does no harm and the code needs no change. On an OLED or
plasma TV a still picture can leave a faint copy of the frames and plates
behind. Switch that kind of TV off at night with its own timer or schedule, in
its settings. The Mini can keep running.

## What to check

- The dashboard is on the screen within two minutes of the Mini starting.
- `ssh hawktimus@<address> /opt/teletraan/deploy/scripts/check-connection.sh`
  ends with `OK` (see Checking the connection below).
- The clock matches a phone, and the date is right.
- All four sides of the frames and the whole ticker are visible. If
  an edge is cut off, go back to step 13. The frames are metal, gold unless
  Dashboard Settings says Silver (Screen, Frame metal), on purple plates. The
  large and small frames are silver now and then, about one page change in
  ten (Transitions, Frame finish).
- Every 20 seconds or so the pages change. Either the rows flip and the frame
  lifts a little and drops back, or the frame breaks into pieces that fold away
  and click back into place (Transitions, Page change style), and the screws at
  the joints turn out and back in. A bright dash runs round each big
  frame every few seconds. If that stutters, see `docs/try-it-on-the-mini.md`:
  `?glint=off` and `?finish=flat` are the first things to try.
- Events appear. `sudo journalctl -u teletraan-calendars.service -n 20`
  shows `updated` for every calendar. If a calendar says `updated` but its
  events never show, it has no row in Dashboard Settings, Calendars (step 8).
- The Photo panel shows the photos that are on in the Photos list in Studio
  (docs/editing-content.md, "Photos"). They come with the rest of the content,
  so there is nothing on the Mini to set up, and the old `photos.json` file in
  the data folder is no longer read. If the panel never comes up, the list has
  no photo that is switched on and not expired.
- Night mode (docs/night-mode.md) puts a black screen with the team logo up from
  23:30 to 11:30 Eastern, unless Dashboard Settings says otherwise (Night mode
  tab), and the TV stays on all night. To see it at once, open the Night mode
  tab, turn on Preview night mode and publish, then turn it off again. If the TV
  itself goes dark, that is the TV's own sleep setting, not the dashboard: turn
  its auto power off or sleep timer off.
- The hidden transitions (docs/hidden-transitions.md) are two rare surprises that
  replace a page change. To see each once on the Mini, open Dashboard Settings in
  Studio, open the menu next to Publish and click Play desktop reveal, then Play
  red eyes. Each plays within about 20 seconds. If the screen stutters during one,
  set both chances in the Hidden tab to 0 and tell whoever looks after the code.
  They never play at night, in calm motion, or over an alert or announcement.
- Make a small change on a laptop and push it. Within about 6 minutes (up to
  5 for the pull timer, up to 1 for the dashboard to notice) the screen
  reloads and shows it.
- Pull the power plug and put it back. The Mini should start by itself and
  show the dashboard. If it stays off, go back to step 1. If macOS is gone,
  ask the team mentor: the fix is a boot-time command for this model of Mini,
  and it has to be tried on the Mini itself.
- Switch the Mini and the TV off, then switch the Mini on first and the TV
  30 seconds later. The dashboard must still fill the TV exactly. If it is
  cropped or the wrong size, see "If the TV is not ready when the Mini
  starts" below.
- For the speed tests on the real hardware, use `docs/try-it-on-the-mini.md`.

The screen asks Sanity for Dashboard Settings first, and Content source there
says which content to show. While it is Sample, the screen shows the sample
content in `dashboard/data/sample/` (the content, with its three sample photos,
and the calendar) and does not read the calendars that the Mini downloads or
any other content from Sanity. A SAMPLE CONTENT label shows beside the TEAM
plate. Every piece of sample text is in [square brackets]. It still reloads
itself after an update, and the browser console shows a 404 for `version.txt`
in `data/live/` if the Mini has not written it. That is expected.

Editors switch between sample and production in Studio (docs/editing-content.md),
and the Mini follows within about 30 seconds without a restart. The Mini asks
Sanity from the address `http://localhost:<port>`, with the port in
`TELETRAAN_PORT` in `local.env`, so that address must be a CORS origin in the
Sanity project settings (studio/README.md, step 6). If the Mini cannot read
Dashboard Settings and has no saved copy of them, it falls back to
`useSampleContent` in `dashboard/config.js`, which is `false`, so it shows the
editors' content. If the screen says SANITY UNREACHABLE: CORS BLOCKED, the
origin is the first thing to check (see Checking the connection, next).

## Checking the connection

One command checks everything the screen needs to get its content. Run it from
any computer that can reach the Mini, with the Mini's address (the screen shows
it, see the next section):

    ssh hawktimus@<address> /opt/teletraan/deploy/scripts/check-connection.sh

It prints one line for each check, `OK` or `FAIL` and then what it found, and
the last line is `OK` if every check passed or `FAIL` if any did not. A missing
tool or a failed check only fails its own line, so the others still run. Add
`-t` after `ssh` if Docker needs `sudo` and `sudo` needs a password.

    OK    DNS: api.sanity.io is found at [address]
    OK    Sanity: [project].apicdn.sanity.io answered HTTP 200
    OK    Dataset: [dataset] can be read without a login ([number] documents visible)
    OK    CORS: Sanity allows http://localhost:[port] (HTTP 200)
    OK    BAND: api.band.us answered HTTP 404
    OK    Web container: teletraan-web: Up [time]
    OK    Kiosk: teletraan-kiosk.service is active
    OK    Time: the clock is in sync, now [date and time]
    OK    Documents: [number] published
            [type]: [number]
    OK

- DNS: the Mini can turn `api.sanity.io` into an address. A FAIL here means the
  Mini has no working network or DNS.
- Sanity: the Sanity host answers at all. Any answer under 500 counts, and the
  line gives the HTTP code. Code 000 means no answer: the network or a firewall.
- Dataset: a plain query, with no login, gets a number back. A FAIL says the
  dataset needs a login. It must stay public (studio/README.md).
- CORS: Sanity gives the browser permission to read its answer for
  `http://localhost:<port>`. The port is read from `TELETRAAN_PORT` in
  `deploy/local.env`, and from `deploy/docker-compose.yml` if `local.env` has
  none. A FAIL says to add that address to the project's CORS origins at
  sanity.io/manage.
- BAND: `api.band.us` answers. Any answer, even "not found", means it can be
  reached, so the calendars can be downloaded.
- Web container: the container `teletraan-web` is running.
- Kiosk: `teletraan-kiosk.service` is active, which is the browser on the TV.
- Time: the clock is in sync. The date, the countdown and the schedules all
  come from it (step 3).
- Documents: how many published documents Sanity holds, for each type. Drafts
  are not counted, and neither are Sanity's own documents such as pictures. If a
  type you expect is missing, nothing of that type is published.

The project ID, the dataset and the API version are read from
`dashboard/config.js`, and nothing is written into the script. Only the line
`TELETRAAN_PORT` is read from `local.env`. The script never prints or sends a
calendar address, a key or a password. The Sanity checks do not send a login.

The screen says the same about Sanity by itself. When Sanity has been out of
reach for over two minutes, counted from the first read that failed, a small
red text comes up at the bottom right of the screen and says why:

    SANITY UNREACHABLE: NETWORK DOWN
    Last good read [time]
    [name] · Wi-Fi [address] · Tailscale [address]
    ssh hawktimus@[address]

- NETWORK DOWN: the browser cannot reach Sanity at all. Check the cable, the
  Wi-Fi and DNS. `check-connection.sh` shows which.
- CORS BLOCKED: the network works, but Sanity does not let the browser read the
  answer, because the address the screen runs from is not in the project's CORS
  origins. The address is `http://localhost:<port>`. It must be that exact
  address: `localhost` is not the same as `127.0.0.1`.
- ACCESS DENIED: Sanity answered 401 or 403. Check that the dataset is still
  public and that `projectId` and `dataset` in `dashboard/config.js` are right.
- OTHER ERROR: anything else, such as an error at Sanity or an answer the screen
  cannot use. The browser console on a laptop shows more.

The last good read is the time of day of the last time the screen read
Sanity. If there has been none since the screen started, it says there has been
no good read yet, and the screen shows its saved copy, if it has one. The text
is gone at once when Sanity answers again. The two lines about the Mini are the
ones in the next section, and they are only on the screen while the red text is.

The reason is found with a second, plain request to the same Sanity host that
the browser lets through without letting the page read it. If it gets an
answer, the host is there and only the permission is missing (CORS). If it
gets none, the network is down. It is only made after a read fails with no
answer, never on a good read.

In Studio, Dashboard Settings has a Connection tab with the switch Show
connection status. Turn it on to keep the text on the screen all the time, for
setting up or looking into a problem. It then has these lines, in a dark plate
instead of the red one:

    Sanity OK · last read [time]
    Tasks [n] · Sponsors [n] · Tips [n] · Subteams [n]
    People [n] · Events Calendar [n] · Plan [n] · Custom panels [n]
    Calendars read [time]

The first line says `Saved copy from [time]` while the screen shows a copy
saved on the Mini and has not read Sanity yet. The counts are what Sanity sent,
including items that are switched off or have expired, so they can be higher
than what is on the screen. Plan is 1 when there is a plan for today and 0 when
there is not. The calendar time is when the screen last read every calendar
file, which is not the same as when the Mini downloaded them. It says
`Calendars not read yet` until the screen has read them all, and again for as
long as one calendar file cannot be read. To see when the Mini last downloaded
the calendars, use `sudo journalctl -u teletraan-calendars.service -n 20`.

## Finding the Mini on the network

Without access to the school's network tools, the Mini tells you its own
address. While the kiosk is running, `scripts/kiosk.sh` writes
`/var/lib/teletraan/data/device.json` once a minute, in the same safe way
`pull.sh` writes `version.txt`. It has four values:

    {"hostname":"[name]","wifi":"[address]","tailscale":"[address]","time":"[UTC time]"}

- `hostname` is the Mini's name.
- `wifi` is the first IPv4 address on a Wi-Fi interface (a name that starts
  with `wl`). A Mini on a network cable has no Wi-Fi address, so this is empty.
- `tailscale` is the address from `tailscale ip -4`, or the one on the
  `tailscale0` interface. It is empty when Tailscale is not installed or not
  connected. This page does not install Tailscale.
- `time` is when the file was written, in UTC.

A value the Mini cannot find is left empty, and the file is still written.
To read it on the Mini:

    cat /var/lib/teletraan/data/device.json

The screen shows the same thing, but only while the red connection status text
is up, which is when Sanity has been out of reach for over two minutes (see
Checking the connection above). The last two lines of that text are about the
Mini:

    [name] · Wi-Fi [address] · Tailscale [address]
    ssh hawktimus@[address]

The second line uses the Tailscale address if there is one, and otherwise the
Wi-Fi address. A part that is empty is left out, and the two lines are left out
if the Mini has no name or address at all. The text reads the file again every
minute while it is showing, so it is at most a minute old, and the lines go
away at once when Sanity answers again. They are never on the screen
otherwise, not even when Show connection status is on. If the two lines are
missing while the text is red, the file is missing: see the next paragraph.

The loop that writes the file starts with the kiosk script. After the new
`kiosk.sh` has been pulled, the running kiosk still has the old copy, so
restart it:

    sudo systemctl restart teletraan-kiosk.service

The `ssh` line only works if the SSH server is installed (step 2), and the
Wi-Fi address only from a computer on the same school network.

## If the TV is not ready when the Mini starts

After a power cut the Mini often finishes starting before the TV answers. X,
the display system, then starts without knowing the screen size and cannot
grow later. Tell it the size in advance. Make the folder if it is missing,
then create a file in it:

    sudo mkdir -p /etc/X11/xorg.conf.d
    sudo nano /etc/X11/xorg.conf.d/10-screen.conf

with this in it:

    Section "Screen"
      Identifier "Screen0"
      SubSection "Display"
        Virtual 1920 1080
      EndSubSection
    EndSection

Reboot and repeat the test with the Mini first.

## Recovering

Start with the log for the part that is wrong.

| What you see | What to try |
|--------------|-------------|
| `xinit` says "Only console users are allowed to run the X server" | You are not on a real text screen. Run `tty`: if it prints `/dev/pts/...` you are in SSH or in a terminal window. Go to the Mini's own keyboard, press Ctrl+Alt+F3 (hold the Fn key too on a Mac keyboard) and log in as `hawktimus` there. If it still says it on a real text screen, run `sudo dpkg-reconfigure x11-common` and choose "Anybody". If the Mini starts into a desktop with a login picture instead of a text login, it is not set up the way this page assumes: tell the team mentor. The kiosk service does not have this problem, because it starts X on the console itself. |
| Black screen, nothing | `sudo journalctl -u teletraan-kiosk.service -n 50`. A line about X or a missing package means step 11 is not finished. `sudo systemctl restart teletraan-kiosk.service` starts it again. |
| "Teletraan I could not start. Trying again in 30 seconds." | The browser works but the dashboard could not start, for example a file would not load or a panel failed. It retries by itself, and a fix that has been pulled is picked up on the next try. To see why, run the same commit on a laptop (`python3 tools/serve.py`) and read the browser console there. |
| The screen says SANITY UNREACHABLE | Run `check-connection.sh` (see Checking the connection). Its FAIL lines say which part is wrong, and the reason on the screen says which kind of fault it is. |
| The browser says it cannot connect | `sudo docker compose ps` in `/opt/teletraan/deploy`. If it is not running, run step 9 again. |
| Calendars are old | `sudo journalctl -u teletraan-calendars.service -n 30`. "The server said no" usually means BAND changed the address. Get a new one and edit `local.env`. The old file stays on screen until a download works. |
| A change never arrives | `sudo journalctl -u teletraan-pull.service -n 30`, then see the next three rows. |
| The pull log says local changes would be overwritten | Someone edited a file on the Mini. Look with `git -C /opt/teletraan status`. Ask before throwing those changes away. Files on the Mini should never be edited by hand. |
| The pull log says "Not possible to fast-forward" | Someone force-pushed or rewrote the shared branch. Do not follow git's hint to merge or rebase. After checking that nobody edited files on the Mini, run `git -C /opt/teletraan fetch` and then `git -C /opt/teletraan reset --hard '@{u}'`. The next pull updates `version.txt`. |
| The pull log says a git lock file is in the way | A power cut stopped git half way. Check that no git is running with `pgrep git`, which should print nothing. Then run `rm /opt/teletraan/.git/index.lock`, and then the two git commands from the row above, because the files may be half updated. |
| A bad change went out | Fix it on a laptop and push the fix, or push a revert. The Mini follows within 5 minutes. Do not roll the Mini back by hand, the next pull would undo it. |
| The screen is blank or frozen | `sudo systemctl restart teletraan-kiosk.service`. If it keeps happening, note the time and tell the team mentor. |
| Nothing works | Do this page again from step 1. |

When anything under `deploy/` changes, someone has to apply it by hand. How
is in `deploy/README.md`.

## Upkeep

Debian does not update itself. Once or twice a year, on a day with no event,
run these and check that the screen comes back:

    sudo apt update
    sudo apt upgrade
    sudo reboot

Tell the team mentor when you do it. Chromium and Docker are the parts that
reach the internet, so they matter most.

The web server image is fixed to one version in `deploy/docker-compose.yml`.
To move to a newer one, ask the team mentor first, change the tag, and run
step 9 again.

The `hawktimus` account runs the browser and also owns `local.env`, so
`chmod 600` only keeps other accounts out. Do not use the Mini to browse the
web.

## Credits

The weather comes from Open-Meteo (open-meteo.com), a free service that needs
no key or account.
