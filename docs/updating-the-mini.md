# Updating the Mini from a Mac

`tools/mini/teletraan-mini` is a menu that runs in Terminal on a Mac. It copies
the dashboard files to the Mini, keeps the keys and the calendar links, shows what
the Mini last did and restarts the screen. It works from any Mac that has the
repository, so a coach with a laptop can use it as well as the Mac in the room.

It replaces the loose update script that used to sit in one person's home folder.
`deploy/mac/ship.sh` uses it too: its last step is `teletraan-mini update --yes`
(`docs/shipping-from-the-mac.md`). The keys and calendar links are secrets, so they never go in the repository and
never go in Sanity, which anyone can read. They live on the Mac in `~/.teletraan/`
and on the Mini in `deploy/local.env`.

## Before you start

- The repository on the Mac (`git clone`, then `git pull` for the newest tool).
  `docs/laptop-setup.md` goes through a new Mac from the start.
- The Mini's address as `user@host`. A Tailscale name works from anywhere, for
  example `hawktimus@teletraan`. On the school network the name the Mini has there
  works, or its address from `docs/rebuilding-the-mini.md`, "Finding the Mini on
  the network".
- The Mini's password. ssh asks for it, and so does sudo for the restart. The tool
  stores no password. To stop typing the ssh password, run
  `ssh-copy-id user@host` once. sudo still asks, which is on purpose.

## Start it

Pick one:

- Double-click `tools/mini/Teletraan Mini.command` in Finder. If macOS says it
  cannot open the file, right-click it, choose Open, and choose Open again.
- In Terminal, from the repository folder: `tools/mini/teletraan-mini`.
- In Terminal with a word after the name, to do one thing with no menu:
  `tools/mini/teletraan-mini update`, `status` or `restart`
  (see "From the command line" below).

## The first run

The first time, the tool asks for the Mini's address, checks that ssh works and
asks for a short name for the Mini, such as `main`. It saves them in
`~/.teletraan/config`. That folder is private to your Mac account and is not part
of the repository. Nothing is saved if ssh cannot connect.

To add a second Mini, choose 7, then `a`. Choose 7 again to pick which Mini the
other choices use. The menu names the one in use. One saved set of keys and
calendars serves both Minis, and a save goes to the Mini you picked.

## The menu

| Choice | What it does |
|--------|--------------|
| 1 | Update the Mini: copies the files, then restarts the screen |
| 2 | Keys and calendars: a form for the three keys and the calendar links |
| 3 | Copy the Mini's keys and calendars to this Mac |
| 4 | Install the services on the Mini |
| 5 | Status of the Mini |
| 6 | Restart the screen |
| 7 | Choose another Mini, or add one |
| q | Quit |

### 1. Update the Mini

Copies this repository to `/opt/teletraan` on the Mini with `rsync`, and removes
files there that are not here. It leaves alone `.git`, `local.env`, `.env`,
`node_modules`, `.DS_Store`, `studio/dist` and `studio/.sanity`, so the keys on the
Mini are never touched or overwritten. It then restarts the screen, which is black
for about ten seconds. A screen that is open does not reload by itself after a
copy, so the restart is part of the update.

After the copy the tool leaves the hash, the day and the branch of this repository in
the file `build.txt` in the deploy folder of the Mini and runs `status-write.sh version`, so the status block says
which build is on the wall. A folder with no git history skips this and says so.

The tool refuses to copy from a folder that is not the Teletraan repository,
because the copy removes files on the Mini.

If the update changed a file in `deploy/systemd/`, choose 4 to install the
services again. If it changed `docker-compose.yml` or `nginx.conf`, follow
`deploy/README.md`, "When a pull changes this folder".

The Mini gets new files in one of two ways. Either this tool copies them, which is
what `deploy/mac/ship.sh` does (`docs/shipping-from-the-mac.md`), or the Mini pulls
them from GitHub every 5 minutes with its pull timer. Use one. A copy leaves the
Mini's git folder looking changed, and a later pull stops with an error when a new
commit changes the same file. The tool asks first when the pull timer is on. To
make the Mini a copy-only Mini, turn the timer off on the Mini:

    sudo systemctl disable --now teletraan-pull.timer

### 2. Keys and calendars

A form in the terminal. Each key shows as its first 4 characters and dots, or not
set. For each of `SANITY_WRITE_TOKEN`, `MONDAY_API_TOKEN` and `TBA_AUTH_KEY` press
`e` to type a new value, `k` or Return to keep it, or `c` to clear it. What you
type is hidden. A value too short to show 4 characters of safely shows as dots
only.

The calendars come next, as a name and a link. Press `a` to add one, `e` to change
a link, `r` to remove one, and Return when done.

- The name becomes the middle of the line `CALENDAR_<ID>_URL` on the Mini:
  `Build season` becomes `CALENDAR_BUILD_SEASON_URL`. Studio uses the lowercase
  form, `build_season`, as the code of the calendar. A code can be up to 20
  characters. A new calendar needs a row with that code in Dashboard Settings,
  Calendars, or the screen shows nothing from it (`docs/calendar-links.md`).
- A link starts with `https://` or `webcal://`. A `webcal://` link is stored as
  `https://`. A link that starts with `http://` is refused, because it is not
  secure.
- A key has letters, digits, dots, dashes and underscores only. The tool refuses
  anything else and does not repeat what you typed.

When you save, the tool:

1. writes `~/.teletraan/secrets.env` on the Mac, readable by you only;
2. sends the lines to the Mini with `scp` and merges them into
   `/opt/teletraan/deploy/local.env`: a line with the same name is replaced, a
   cleared key or a removed calendar is taken out, every other line stays as it
   was, and the file keeps mode 600 and belongs to the login user;
3. removes the copies it made on the Mini;
4. starts the calendar service once, with
   `sudo systemctl start teletraan-calendars.service`, so the Calendars page in
   Studio is up to date. The Mini's password is asked here.

The keys are made in the places `docs/rebuilding-the-mini.md` names: the Sanity
write token in "Showing what the Mini did in Studio", the Blue Alliance key in
step 17 and the Monday token in step 18. A calendar link comes from BAND
(`docs/calendar-links.md`).

If the values cannot be sent, they stay saved on the Mac. Choose 2 again, leave
everything as it is, and answer yes to sending the saved values.

A Mac that has no saved values yet should choose 3 first. Otherwise the form shows
every key as not set, and a key or a calendar that only the Mini has cannot be
changed or removed from here.

### 3. Copy the Mini's keys and calendars to this Mac

For a second computer, or after a Mac is replaced. It asks first, because it
replaces what the Mac has saved. It reads only the three keys and the
`CALENDAR_<ID>_URL` lines from `local.env` on the Mini, and prints nothing from
them. A placeholder that still starts with `[` is left out, and so is a value that
does not look like a key or a link.

### 4. Install the services on the Mini

Runs `install-calendars.sh`, `install-slides.sh`, `install-monday.sh`,
`install-frc.sh`, `install-console.sh`, `install-watchdog.sh` and `install-backup.sh`
on the Mini, one after another. They turn on the timers (the watchdog and the
nightly backup among them) and the boot and shutdown screens. After the first
`install-watchdog.sh`, restart the screen once (choose 6, or `teletraan-mini
restart`), because the browser only opens the page list for the watchdog when
`kiosk.sh` starts it. They install no packages: one
that finds a package missing stops and prints the `apt install` line to run. The
tool goes on to the next script.

Each script says what it will do and waits for Enter, and the Mini asks for its
password. `install-console.sh` changes `/etc/issue`. The tool asks whether the
team mentor has said yes before it starts (`docs/rebuilding-the-mini.md`, the list
at the top).

### 5. Status of the Mini

Runs two scripts on the Mini and shows what they print:

- `status-write.sh --print` gives each time the Mini wrote into Studio's status
  block, and how long ago: the content update it saw, the calendars, the slides,
  Monday, the competition data and the start of the screen. It needs no key.
- `check-calendars.sh` lists the coming events of each calendar, SHOWN or HIDDEN
  (`docs/rebuilding-the-mini.md`, "Adding or changing a calendar"). It needs Node
  on the Mini (step 19 there). Without Node it says so.

Everything that comes back passes through a filter that hides every saved key and
link, and anything that looks like a web address, so a script that goes wrong
cannot put one on your screen.

### 6. Restart the screen

Restarts the browser that fills the TV. Use it when the screen looks stuck or
wrong. The screen is black for about ten seconds. It does not restart the web
server container.

## From the command line

A word after the name does what the same menu choice does, for the Mini in use,
with no menu. `deploy/mac/ship.sh` runs these.

| Command | Same as | What it does |
|---------|---------|--------------|
| `tools/mini/teletraan-mini update` | 1 | copies the files, then restarts the screen |
| `tools/mini/teletraan-mini status` | 5 | shows what the Mini last did and the calendars |
| `tools/mini/teletraan-mini restart` | 6 | restarts the screen |

- `--yes` skips the Go ahead question of `update`, so nobody has to press Return.
  It does not answer the Copy anyway question that appears when the Mini's pull
  timer is on. That one is a warning, and no is its answer if nobody gives one.
- `--mini NAME` uses the saved Mini with that name for this one run. It does not
  change the Mini in use. A name that is not saved stops the run and lists the
  names that are. Example: `tools/mini/teletraan-mini --mini spare restart`.
- The exit code is 0 when every step worked and not 0 when one failed or did not
  happen: a Mini that cannot be reached, a copy that stopped, a restart that
  failed, a question that nobody answered. A failed copy does not restart the
  screen. A script can rely on this.
- It prints no key and no calendar link, the same as the menu. A word the tool
  does not know prints the usage and exits with 2, and the word is not repeated.
- With no Mini saved yet it stops and says to run the tool once with no word, to
  give it the Mini's address. It does not ask for the address in a command.

Choices 2, 3, 4 and 7 stay in the menu, because they ask questions.

## What stays secret

- `~/.teletraan/config` holds the Mini's address. `~/.teletraan/secrets.env` holds
  the keys and links, mode 600. The folder is never in the repository.
- The tool never prints a key or a calendar link. It shows the first 4 characters
  and dots, and its error messages say what is wrong without repeating the value.
- Values travel in a file with `scp`, not on a command line, so they are not in
  the list of running programs on either computer.
- Do not copy `~/.teletraan/` to another Mac by email or chat. A second Mac gets
  the values with choice 3. If a Mac is lost, make new keys and send them with
  choice 2.

## When something stops

| What you see | What to do |
|--------------|------------|
| could not reach the Mini | Is the Mini on? Is this Mac on the same network, or on Tailscale? Try the address by hand: `ssh user@host`. |
| The copy stopped (rsync exit code) | Run choice 1 again. The Mini may have some of the new files until then. If the lines above say `rsync: command not found`, the Mini needs `sudo apt install rsync`, after the team mentor's yes. |
| Line N of the new values is not a key or a calendar | Nothing was changed on the Mini. `~/.teletraan/secrets.env` was edited by hand. Delete the line or use the form. |
| The calendar service did not run | The service is not installed on this Mini. Choose 4, or see step 11 of `docs/rebuilding-the-mini.md`. |
| The Mini has an older status-write.sh | Choose 1 to copy the newest files, or run `tools/mini/teletraan-mini update`. |
| no Mini is saved on this Mac yet | A command word needs a saved Mini. Run `tools/mini/teletraan-mini` with no word, once, and give it the address. |
| a question needed an answer and none came | The Mini's pull timer is on and the command had nobody to ask. Run the update by hand and answer, or turn the pull timer off. |
| A calendar was added and the screen shows nothing from it | It needs a row in Dashboard Settings, Calendars, with the code the tool printed. |
| macOS will not open the .command file | Right-click it, choose Open, and choose Open again. |

## Changing the settings

The Mini's folder and the name of the screen's service are two lines at the top of
`tools/mini/teletraan-mini`: `MINI_REPO` and `MINI_KIOSK`. They are not secrets.
The merge that runs on the Mini is `tools/mini/merge-env.sh`. It handles only the
three keys and the `CALENDAR_<ID>_URL` lines, so it cannot change the port or the
data folder.

The tool runs on the bash that comes with macOS, version 3.2, so it uses no newer
shell features. `node tools/test-mini-tool.mjs` checks the menu and
`node tools/test-mini-tool-commands.mjs` checks the command words, both with fake
`ssh`, `scp` and `rsync`. Nothing in those tests touches a real Mini.
