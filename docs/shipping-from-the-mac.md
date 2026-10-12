# Shipping from the Mac

`deploy/mac/ship.sh` does the whole trip from the Mac you work on to the TV in
one window: it checks the code, commits and pushes it to GitHub, deploys the
Studio, and has the Mac tool copy the files to the Mini and restart the screen.
It stores no password. Git, Sanity, ssh and sudo each ask you for theirs, in the
same window, when they need it.

The Mini gets its files from the Mac, not from GitHub. The Mac tool
(`tools/mini/teletraan-mini`, `docs/updating-the-mini.md`) copies the folder you
ship from, so the Mini shows what is on the Mac at that moment. GitHub is the
shared copy that the laptop and any other computer start from. A second
computer sets itself up with `docs/laptop-setup.md`.

## Start it

Pick one:

- Double-click `deploy/mac/Ship Teletraan.command` in Finder.
- Run `deploy/mac/make-app.sh` once. It writes `Ship Teletraan.app` to the
  Desktop (or to the folder you give it, for example
  `deploy/mac/make-app.sh ~/Applications`). Drag that into the Dock. The app
  only opens Terminal and runs the same `.command` file.
- In a terminal: `deploy/mac/ship.sh`, with an action after it to skip the menu.

The app on a Mac updates by itself. It holds only the path to
`Ship Teletraan.command` in the repository folder, so when `git pull` or an edit
changes `ship.sh`, the next time the app opens it runs the new script. It needs
making again only if you move the repository folder. A laptop makes its own app,
once, with `make-app.sh` (`docs/laptop-setup.md`, step 6). Do not copy the app
from one Mac to another, because the path in it is the path on the first Mac.

## The menu

| Choice | Action word | What it does |
|--------|-------------|--------------|
| 1 | `all` | checks this Mac and GitHub, then the code, commit and push, the Studio, and the Mini (copy and restart) |
| 2 | `push` | checks, commit and push only |
| 3 | `studio` | deploys the Studio only |
| 4 | `mini` | updates the Mini and restarts the screen only |
| 5 | `status` | shows the status of the Mini |

The older words still work. `all-restart` is the same as `all`, which now
restarts the screen as part of the update. `restart` restarts the screen on the
Mini and copies nothing.

Add `--dry-run` to any action word to see every command that would run, without
running anything, asking a question or looking at GitHub. For example
`deploy/mac/ship.sh --dry-run all`.

## Before anything runs

The script first looks at this Mac and lists every gap at once, each with the
command that fills it. Nothing is committed or sent until the list is empty.
Which of these it looks at depends on the action:

- `git`, `node`, `npm`, `ssh` and `rsync` are installed.
- For the Studio, Node is 22.12 or newer and `studio/node_modules` exists. If
  it does not, the line says `cd studio && npm install` with the full path.
- For a commit, git knows a name and an email (`git config --global user.name`
  and `user.email`).
- For the Mini, the Mac tool has a saved Mini. If not, the line says to run
  `tools/mini/teletraan-mini` once and give it the Mini's address.

For `all` and `mini` it also runs `git fetch` and compares this folder with
GitHub. If GitHub has commits this folder does not have, it stops and says to
run `git pull --no-rebase`. The Mac tool copies this folder as it is, so an old
folder would put old files on the Mini. If GitHub cannot be reached, it says so
and goes on.

## What each step does

1. **Checks.** Runs every `tools/test-*.mjs`, every `tools/check-*.mjs` and
   `studio/check-schemas.mjs`, each with `node`. A failure is listed by name. You
   can go on anyway or stop. To see why one failed, run it by itself, for
   example `node tools/test-content.mjs`.
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
4. **The Mini.** Runs `tools/mini/teletraan-mini update --yes`. The Mac tool
   copies this folder to `/opt/teletraan` on the Mini with `rsync`, leaves the
   Mini's `local.env`, `.git` and `node_modules` alone, and restarts the screen
   with `sudo systemctl restart teletraan-kiosk.service`. The screen is black for
   about ten seconds. `ssh -t` lets `sudo` ask for the Mini's password in this
   window. `--yes` skips the Go ahead question only. A screen that is open does
   not reload by itself after a copy, which is why the restart is part of the
   update. If a file in `deploy/` changed, follow `deploy/README.md`.

Each step stops the whole run when it fails, and the last lines say what had
worked before it stopped. Running it again is safe: a step that has nothing to do
says so.

## If the Mini still pulls by itself

A Mini can also pull from GitHub every 5 minutes (the pull timer). A Mini that
gets its files from the Mac should not, because a pull stops with an error when
a file the Mac copied is also changed by a new commit. The Mac tool checks. When
the pull timer is on it asks Copy anyway, and `--yes` does not answer that one,
because it is a warning. Nobody to answer counts as no, the copy does not happen
and the run stops. To make the Mini a copy-only Mini, turn the timer off on the
Mini:

    sudo systemctl disable --now teletraan-pull.timer

## If the Mini cannot be reached

The script says "could not reach". Check that the Mini is on and that this Mac is
on the same network, or on Tailscale. If the name does not resolve, find the
Mini's IP address (`docs/rebuilding-the-mini.md`, "Finding the Mini on the
network") and save it with the Mac tool (choice 7, then `a`).

To stop typing the Mini's ssh password, set up a key once with
`ssh-copy-id hawktimus@teletraan.local` (it asks for the password one last time).
`sudo` still asks for it, which is on purpose.

## Changing the settings

The Mini's address is not in `ship.sh` any more. The Mac tool keeps it in
`~/.teletraan/config`, and choice 7 of the tool picks another Mini or adds one.
Ship uses the Mini that is in use. The Mini's repository folder and the name of
the screen's service are two lines at the top of `tools/mini/teletraan-mini`:
`MINI_REPO` and `MINI_KIOSK`. They are not secrets, so they are written in the
file.
