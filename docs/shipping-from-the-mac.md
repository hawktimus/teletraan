# Shipping from the Mac

`tools/mac/ship.sh` does the whole trip from the Mac you work on to the TV in
one window: it checks the code, commits and pushes it to GitHub, deploys the
Studio, and has the Mac tool copy the files to the Teletraan computer and restart the screen.
It stores no password. Git, Sanity, ssh and sudo each ask you for theirs, in the
same window, when they need it. The Mac tool asks for the sudo password once per run.

The Teletraan computer gets its files from the Mac, not from GitHub. The Mac tool
(`tools/teletraan/teletraan-tool`, `docs/updating-the-computer.md`) copies the folder you
ship from, so the computer shows what is on the Mac at that moment. GitHub is the
shared copy that the laptop and any other computer start from. A second
computer sets itself up with `docs/laptop-setup.md`.

## Start it

Pick one:

- Double-click `tools/mac/Ship Teletraan.command` in Finder.
- Run `tools/mac/make-app.sh` once. It writes `Ship Teletraan.app` to the
  Desktop (or to the folder you give it, for example
  `tools/mac/make-app.sh ~/Applications`). Drag that into the Dock. The app
  only opens Terminal and runs the same `.command` file.
- In a terminal: `tools/mac/ship.sh`, with an action after it to skip the menu.

The app on a Mac updates by itself. It holds only the path to
`Ship Teletraan.command` in the repository folder, so when `git pull` or an edit
changes `ship.sh`, the next time the app opens it runs the new script. It needs
making again only if you move the repository folder. A laptop makes its own app,
once, with `make-app.sh` (`docs/laptop-setup.md`, step 6). Do not copy the app
from one Mac to another, because the path in it is the path on the first Mac.

## The menu

| Choice | Action word | What it does |
|--------|-------------|--------------|
| 1 | `all` | checks this Mac and GitHub, then the code, commit and push, the Studio, and the Teletraan computer (copy and restart) |
| 2 | `push` | checks, commit and push only |
| 3 | `studio` | deploys the Studio only |
| 4 | `computer` | updates the computer and restarts the screen only |
| 5 | `status` | shows the status of the computer |

The older words still work. `all-restart` is the same as `all`, which now
restarts the screen as part of the update. `restart` restarts the screen on the
computer and copies nothing.

Add `--dry-run` to any action word to see every command that would run, without
running anything, asking a question or looking at GitHub. For example
`tools/mac/ship.sh --dry-run all`.

## Before anything runs

The script first looks at this Mac and lists every gap at once, each with the
command that fills it. Nothing is committed or sent until the list is empty.
Which of these it looks at depends on the action:

- `git`, `node`, `npm`, `ssh` and `rsync` are installed.
- For the Studio, Node is 22.12 or newer and `studio/node_modules` exists. If
  it does not, the line says `cd studio && npm ci` with the full path.
- For a commit, git knows a name and an email (`git config --global user.name`
  and `user.email`).
- For the Teletraan computer, the Mac tool has a saved computer. If not, the line says to run
  `tools/teletraan/teletraan-tool` once and give it the computer's address.

For `all` and `computer` it also runs `git fetch` and compares this folder with
GitHub. If GitHub has commits this folder does not have, it stops and says to
run `git pull --no-rebase`. The Mac tool copies this folder as it is, so an old
folder would put old files on the Teletraan computer. If GitHub cannot be reached, it says so
and goes on.

## What each step does

1. **Checks.** Runs `node tests/run.mjs`, which runs every test in `tests/` and
   checks the syntax of every shell file. It takes a few minutes. A failure is
   listed by name. You can go on anyway or stop. To see why one failed, run it
   by itself, for example `node tests/run.mjs content`.
2. **Commit and push.** Shows what changed, asks for a short description, commits
   everything and runs `git push`. It refuses to commit a file that looks like a
   secret (`local.env`, any `.env` file, a `.pem` or `.key` file, an ssh key). It
   asks before pushing a branch other than `main`, because the laptop and other
   computers start from `main`. It never forces a push. If GitHub has a change
   this Mac does not have, the push is refused and the script tells you to run
   `git pull --no-rebase` first.
3. **Studio.** Runs `npm run deploy` in `studio/`, which puts the Studio's forms
   on sanity.io so the editors see new fields. It asks nothing about a hostname:
   `studio/sanity.cli.js` holds `deployment: { appId: ... }`, the id of the
   hosted Studio, and Sanity reads it. If it says you are not logged in, stop and
   run `npx sanity login` in the `studio` folder, then start again.
4. **The Teletraan computer.** Runs `tools/teletraan/teletraan-tool update --yes`. The Mac tool
   copies this folder to a staging folder on the computer with `rsync`, leaves the
   computer's `local.env`, `.git` and `node_modules` alone, installs the files as the
   next release, installs the services and restarts the screen. The screen is black for
   about ten seconds. The tool asks for the computer's password once in this
   window. `--yes` skips the Go ahead question only. A screen that is open does
   not reload by itself after a copy, which is why the restart is part of the
   update. If a file in `computer/` changed, follow `computer/README.md`.

Each step stops the whole run when it fails, and the last lines say what had
worked before it stopped. Running it again is safe: a step that has nothing to do
says so.

## If the Teletraan computer still pulls by itself

A computer can also pull from GitHub every 5 minutes (the pull timer). A computer that
gets its files from the Mac should not, because a pull stops with an error when
a file the Mac copied is also changed by a new commit. The Mac tool checks. When
the pull timer is on it asks Copy anyway, and `--yes` does not answer that one,
because it is a warning. Nobody to answer counts as no, the copy does not happen
and the run stops. To make the Teletraan computer a copy-only computer, turn the timer off on the
computer:

    sudo systemctl disable --now teletraan-pull.timer

## If the Teletraan computer cannot be reached

The script says "could not reach". Check that the Teletraan computer is on and that this Mac is
on the same network, or on Tailscale. If the name does not resolve, find the
computer's IP address (`docs/rebuilding-the-computer.md`, "Finding the computer on the
network") and save it with the Mac tool (choice `c`, then `a`).

To stop typing the Teletraan computer's ssh password, set up a key once with
`ssh-copy-id hawktimus@teletraan.local` (it asks for the password one last time).
`sudo` still asks for it, which is on purpose.

## Changing the settings

The Teletraan computer's address is not in `ship.sh` any more. The Mac tool keeps it in
`~/.teletraan/config`, and choice `c` of the tool picks another computer or adds one.
Ship uses the computer that is in use. The computer's repository folder and the name of
the screen's service are two lines at the top of `tools/teletraan/teletraan-tool`:
`COMPUTER_REPO` and `COMPUTER_KIOSK`. They are not secrets, so they are written in the
file.
