# Updating the Teletraan computer from a Mac

The control page does the everyday update (docs/control-page.md): one button, Update from GitHub, installs the newest commit of the public repository, and a folder upload installs a folder from a laptop. This tool is the first install and the way in when the page cannot be reached. Its install copies the repository to `~/teletraan-staging` on the Teletraan computer, runs `computer/install.sh` there, which makes it the next release, installs the services and restarts the screen. It does all of that in one run and asks for the computer's password once.

`tools/teletraan/teletraan-tool` is a menu that runs in Terminal on a Mac. It installs
the dashboard files and the services on the Teletraan computer, keeps the keys and the calendar links,
and shows what the computer last did. It works from any Mac that has the
repository, so a coach with a laptop can use it as well as the Mac in the room.

`tools/mac/ship.sh` uses it too: its last step is `teletraan-tool update --yes`
(`docs/shipping-from-the-mac.md`). The keys and calendar links are secrets, so they never go in the repository and
never go in Sanity, which anyone can read. They live on the Mac in `~/.teletraan/`
and on the Teletraan computer in `computer/local.env`.

## Before you start

- The repository on the Mac (`git clone`, then `git pull` for the newest tool).
  `docs/laptop-setup.md` goes through a new Mac from the start.
- The Teletraan computer's address as `user@host`. A Tailscale name works from anywhere, for
  example `hawktimus@teletraan`. On the school network the name the computer has there
  works, or its address from `docs/rebuilding-the-computer.md`, "Finding the computer on
  the network".
- The computer's password. A run uses one ssh connection, so ssh asks for the login password at most once.
  The tool then asks once, with the typing hidden, for the password that sudo needs, and sends it to the computer
  through the connection. It is never on a command line, never in a file and never printed, and the tool forgets it
  when the run ends. A computer whose login user needs no sudo password is not asked. To stop typing the ssh
  password, run `ssh-copy-id user@host` once.

## Start it

Pick one:

- Double-click `tools/teletraan/Teletraan Tool.command` in Finder. If macOS says it
  cannot open the file, right-click it, choose Open, and choose Open again.
- In Terminal, from the repository folder: `tools/teletraan/teletraan-tool`.
- In Terminal with a word after the name, to do one thing with no menu:
  `tools/teletraan/teletraan-tool update`, `status` or `restart`
  (see "From the command line" below).

## The first run

The first time, the tool asks for the Teletraan computer's address, checks that ssh works and
asks for a short name for the computer, such as `main`. It saves them in
`~/.teletraan/config`. That folder is private to your Mac account and is not part
of the repository. Nothing is saved if ssh cannot connect.

To add a second computer, choose `c`, then `a`. Choose `c` again to pick which computer the
other choices use. The menu names the one in use. One saved set of keys and
calendars serves both computers, and a save goes to the Teletraan computer you picked.

## The menu

| Choice | What it does |
|--------|--------------|
| 1 | Install everything on the Teletraan computer and restart the screen |
| 2 | Status of the Teletraan computer |
| 3 | Keys and calendars: change them, or copy them from the computer to this Mac |
| c | Choose another computer, or add one (a small line under the choices) |
| q | Quit |

### 1. Install everything

One run, one password. The tool copies this repository to `~/teletraan-staging` on the Teletraan computer with `rsync`, then runs one root shell on the computer that does all of this in order:

1. `computer/install.sh`. It makes the files the next release (docs/control-page.md, "How releases work"), builds the Studio, starts the containers and turns on the nightly timer. It pulls the Node image or the web server image first when the computer does not have it (a download from the internet, which the installer says). On a computer that has no control page yet it also makes the move to the releases layout, which is why this is the first install.
2. `install-calendars.sh`, `install-slides.sh`, `install-monday.sh`, `install-frc.sh`, `install-console.sh`, `install-watchdog.sh`, `install-backup.sh` and `install-nightly.sh`, one after another. They turn on the timers (the watchdog, the nightly backup and the nightly restart among them) and the boot and shutdown screens. Each one says what it will do and is given the Enter it waits for. They install no packages: one that finds a package missing stops and prints the `apt install` line to run, and the tool goes on to the next script and names the ones that stopped at the end. `install-console.sh` changes `/etc/issue`, so the team mentor should have said yes (`docs/rebuilding-the-computer.md`, the list at the top).
3. A restart of the screen, which is black for about ten seconds.

The live tree is never written to, and the last five releases stay on the computer for a rollback. The copy leaves out `.git`, `local.env`, `.env`, `node_modules`, `.DS_Store`, `studio/dist`, `studio/.sanity`, `_inputs` and `_outputs`, so the keys on the computer are never touched or overwritten.

After the copy the tool gives the installer the short hash of this repository. The release number comes from the counter on the Teletraan computer, so the build shows as `v14 · a1b2c3d` everywhere. A folder with no git history has no hash and says so.

The tool refuses to copy from a folder that is not the Teletraan repository, and from a copy that still has a `deploy/` folder: "This copy is older than round 6; update it." Nothing is copied then. The password is asked before anything is copied, so a wrong one costs nothing: "That password was wrong. Choose the same thing again to try another."

The first update that has the mirror (the moving Live preview) needs this tool once, because it adds a unit file, `teletraan-mirror.service`, which only the installer copies into place. The control page's Update tab does not copy unit files. After that, updates from the control page are enough. The installer checks `python3 --version` and skips the unit with a note when python3 is missing. The existing sudoers rule already lets the helper start `teletraan-*.service` units, so nothing in sudoers needs to change.

A computer that pulls from GitHub by itself with the pull timer should not also get files from this tool. Use one. To make the Teletraan computer a copy-only computer, turn the timer off on the computer:

    sudo systemctl disable --now teletraan-pull.timer

### 2. Status of the Teletraan computer

Runs two scripts on the Teletraan computer and shows what they print:

- `status-write.sh --print` gives each time the Teletraan computer wrote into Studio's status
  block, and how long ago: the content update it saw, the calendars, the slides,
  Monday, the competition data and the start of the screen. It needs no key.
- `check-calendars.sh` lists the coming events of each calendar, SHOWN or HIDDEN
  (`docs/rebuilding-the-computer.md`, "Adding or changing a calendar"). It needs Node
  on the computer (step 19 there). Without Node it says so.

Everything that comes back passes through a filter that hides every saved key and
link, and anything that looks like a web address, so a script that goes wrong
cannot put one on your screen.

### 3. Keys and calendars

Choice 3 opens a small menu: 1 changes the keys and the calendar links (the form below), 2 copies the computer's values to this Mac, and `b` goes back.

#### 1. The form

A form in the terminal. Each key shows as its first 4 characters and dots, or not
set. For each of `SANITY_WRITE_TOKEN`, `MONDAY_API_TOKEN` and `TBA_AUTH_KEY` press
`e` to type a new value, `k` or Return to keep it, or `c` to clear it. What you
type is hidden. A value too short to show 4 characters of safely shows as dots
only.

The calendars come next, as a name and a link. Press `a` to add one, `e` to change
a link, `r` to remove one, and Return when done.

- The name becomes the middle of the line `CALENDAR_<ID>_URL` on the Teletraan computer:
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
2. sends the lines to the Teletraan computer with `scp` and merges them into
   `/opt/teletraan/computer/local.env`: a line with the same name is replaced, a
   cleared key or a removed calendar is taken out, every other line stays as it
   was, and the file keeps mode 600 and belongs to the login user;
3. removes the copies it made on the computer;
4. starts the calendar service once, with
   `sudo systemctl start teletraan-calendars.service`, so the Calendars page in
   Studio is up to date. The computer's password is asked here.

The keys are made in the places `docs/rebuilding-the-computer.md` names: the Sanity
write token in "Showing what the Teletraan computer did in Studio", the Blue Alliance key in
step 17 and the Monday token in step 18. A calendar link comes from BAND
(`docs/calendar-links.md`).

If the values cannot be sent, they stay saved on the Mac. Choose 3, then 1 again, leave
everything as it is, and answer yes to sending the saved values.

A Mac that has no saved values yet should copy the computer's values first (3, then 2). Otherwise the form shows
every key as not set, and a key or a calendar that only the Teletraan computer has cannot be
changed or removed from here.

#### 2. Copy the Teletraan computer's keys and calendars to this Mac

For a second computer, or after a Mac is replaced. It asks first, because it
replaces what the Mac has saved. It reads only the three keys and the
`CALENDAR_<ID>_URL` lines from `local.env` on the Teletraan computer, and prints nothing from
them. A placeholder that still starts with `[` is left out, and so is a value that
does not look like a key or a link.

## From the command line

A word after the name does what the same menu choice does, for the Teletraan computer in use,
with no menu. `restart` has no menu choice; it is only a word. `tools/mac/ship.sh` runs these.

| Command | Same as | What it does |
|---------|---------|--------------|
| `tools/teletraan/teletraan-tool update` | 1 | the same as choice 1: installs the files as the next release, installs the services and restarts the screen |
| `tools/teletraan/teletraan-tool status` | 2 | shows what the Teletraan computer last did and the calendars |
| `tools/teletraan/teletraan-tool restart` | none | restarts the screen only. The screen is black for about ten seconds and the web server container is not restarted |

- `--yes` skips the Go ahead question of `update`, so nobody has to press Return.
  Without `--yes`, a command word with nobody to answer counts as no and stops.
- `--computer NAME` uses the saved computer with that name for this one run. It does not
  change the Teletraan computer in use. A name that is not saved stops the run and lists the
  names that are. Example: `tools/teletraan/teletraan-tool --computer spare restart`.
- The exit code is 0 when every step worked and not 0 when one failed or did not
  happen: a computer that cannot be reached, a copy that stopped, a restart that
  failed, a question that nobody answered. A failed copy does not restart the
  screen. A script can rely on this.
- It prints no key and no calendar link, the same as the menu. A word the tool
  does not know prints the usage and exits with 2, and the word is not repeated.
- With no computer saved yet it stops and says to run the tool once with no word, to
  give it the computer's address. It does not ask for the address in a command.

Choices 3 and `c` stay in the menu, because they ask questions.

## What stays secret

- `~/.teletraan/config` holds the Teletraan computer's address. `~/.teletraan/secrets.env` holds
  the keys and links, mode 600. The folder is never in the repository.
- The tool never prints a key or a calendar link. It shows the first 4 characters
  and dots, and its error messages say what is wrong without repeating the value.
- Values travel in a file with `scp`, not on a command line, so they are not in
  the list of running programs on either computer.
- Do not copy `~/.teletraan/` to another Mac by email or chat. A second Mac gets
  the values with 3, then 2. If a Mac is lost, make new keys and send them with
  3, then 1.

## When something stops

| What you see | What to do |
|--------------|------------|
| could not reach the Teletraan computer | Is the computer on? Is this Mac on the same network, or on Tailscale? Try the address by hand: `ssh user@host`. |
| The copy stopped (rsync exit code) | Run choice 1 again. The staging folder on the computer may have some of the new files until then, and the live tree is not touched. If the lines above say `rsync: command not found`, the computer needs `sudo apt install rsync`, after the team mentor's yes. |
| Line N of the new values is not a key or a calendar | Nothing was changed on the computer. `~/.teletraan/secrets.env` was edited by hand. Delete the line or use the form. |
| The calendar service did not run | The service is not installed on this computer. Choose 1 to install everything, or see step 11 of `docs/rebuilding-the-computer.md`. |
| That password was wrong | The password for sudo on the computer was not accepted. Choose the same thing again and type it again. |
| These did not install: and a list of names | An install script stopped, usually because a package is missing. The lines above print the `apt install` line to run, after the team mentor's yes. Then choose 1 again. |
| The computer has an older status-write.sh | Choose 1 to copy the newest files, or run `tools/teletraan/teletraan-tool update`. |
| no computer is saved on this Mac yet | A command word needs a saved computer. Run `tools/teletraan/teletraan-tool` with no word, once, and give it the address. |
| a question needed an answer and none came | The command had nobody to ask. Add `--yes` to `update`, or run the update by hand and answer. |
| A calendar was added and the screen shows nothing from it | It needs a row in Dashboard Settings, Calendars, with the code the tool printed. |
| `git push teletraan main` says the install needs the sudoers rule, or permission denied for docker | The push hook gets its root helper and sudoers line from `computer/install.sh`. Choose 1 once, then push again (docs/control-page.md, "The git path"). |
| The Reboot or Run presentation test button on the control page does nothing | The Update tab and Update from GitHub do not touch the sudoers file, the unit files or the compose file. They come from `computer/install.sh`. Choose 1 once so that the computer has the newest ones (the reboot rule, port 3426, the landing page and the keys folder). Then read `docs/control-page.md`, "When a button does nothing". |
| macOS will not open the .command file | Right-click it, choose Open, and choose Open again. |

## Changing the settings

The Teletraan computer's folder and the name of the screen's service are two lines at the top of
`tools/teletraan/teletraan-tool`: `COMPUTER_REPO` and `COMPUTER_KIOSK`. They are not secrets.
The merge that runs on the computer is `tools/teletraan/merge-env.sh`. It handles only the
three keys and the `CALENDAR_<ID>_URL` lines, so it cannot change the port or the
data folder.

The tool runs on the bash that comes with macOS, version 3.2, so it uses no newer
shell features. `node tests/teletraan-tool.test.mjs` checks the menu and
`node tests/teletraan-tool-commands.test.mjs` checks the command words, both with fake
`ssh`, `scp` and `rsync`. Nothing in those tests touches a real computer.
