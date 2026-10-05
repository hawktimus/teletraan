# Shipping from the Mac

`deploy/mac/ship.sh` does the whole trip from the Mac you work on to the TV in
one window: it checks the code, commits and pushes it to GitHub, updates the
Studio, and tells the Mini to pull. It can also restart the screen on the Mini.
It stores no password. Git, Sanity, ssh and sudo each ask you for theirs, in
the same window, when they need it.

The Mini pulls from GitHub by itself every 5 minutes. This script only makes
the change arrive now instead of within 5 minutes.

## Start it

Pick one:

- Double-click `deploy/mac/Ship Teletraan.command` in Finder.
- Run `deploy/mac/make-app.sh` once. It writes `Ship Teletraan.app` to the
  Desktop (or to the folder you give it, for example
  `deploy/mac/make-app.sh ~/Applications`). Drag that into the Dock. The app
  only opens Terminal and runs the same `.command` file. If you move the
  repository folder, run `make-app.sh` again, because the app holds the path.
- In a terminal: `deploy/mac/ship.sh`, with an action after it to skip the menu.

## The menu

| Choice | Action word | What it does |
|--------|-------------|--------------|
| 1 | `all` | checks, commit and push, Studio, the Mini pulls |
| 2 | `all-restart` | the same, then restarts the screen on the Mini |
| 3 | `push` | checks, commit and push only |
| 4 | `studio` | updates the Studio only |
| 5 | `mini` | the Mini pulls only |
| 6 | `restart` | restarts the screen on the Mini only |

Add `--dry-run` to any action word to see every command that would run, without
running anything. For example `deploy/mac/ship.sh --dry-run all-restart`.

## What each step does

1. **Checks.** Runs every `tools/test-*.mjs`, every `tools/check-*.mjs` and
   `studio/check-schemas.mjs`, each with `node`. A failure is listed by name. You
   can go on anyway or stop. To see why one failed, run it by itself, for
   example `node tools/test-content.mjs`.
2. **Commit and push.** Shows what changed, asks for a short description, commits
   everything and runs `git push`. It refuses to commit a file that looks like a
   secret (`local.env`, any `.env` file, a `.pem` or `.key` file, an ssh key). It
   warns when you are not on the `main` branch, because the Mini follows `main`.
   It never forces a push. If GitHub has a change this Mac does not have, the push
   is refused and the script tells you to run `git pull --no-rebase` first.
3. **Studio.** Runs `npm run deploy` in `studio/`, which puts the Studio's forms
   on sanity.io so the editors see new fields. If it asks you to log in, stop and
   run `npx sanity login` in the `studio` folder, then start again. The packages
   must be installed once with `npm install` in `studio/`.
4. **The Mini pulls.** Connects with `ssh -t hawktimus@teletraan.local` and runs
   `/opt/teletraan/deploy/scripts/pull.sh`, then compares the Mini's commit with
   the one on GitHub and says if they differ. A dashboard that is already open
   reloads itself within a minute of a pull, so nothing else is needed.
5. **Restart (only in choices 2 and 6).** Runs
   `sudo systemctl restart teletraan-kiosk.service` on the Mini. This restarts the
   browser that fills the TV. The screen is black for about ten seconds. `ssh -t`
   lets `sudo` ask for the Mini's password in this window. Use it when the screen
   looks stuck or wrong. It does not restart the web server container: when a
   file in `deploy/` changed, follow `deploy/README.md`.

Each step stops the whole run when it fails, and the last lines say what had
worked before it stopped. Running it again is safe: a step that has nothing to do
says so.

## Why the pull is not run with sudo

`pull.sh` runs as `hawktimus`, the account that owns `/opt/teletraan`, and the
Mini's own timer runs it the same way. A pull run as root would leave files in
the repository that only root can change, and the next timer pull would then
fail with "permission denied" and the screen would stop updating. So only the
restart uses `sudo`. If you ever need to run the pull by hand on the Mini, run it
without `sudo`.

## If the Mini cannot be reached

The script says "could not reach". Check that the Mini is on and on the same
network as this Mac. If `teletraan.local` does not resolve, find the Mini's IP
address (`docs/rebuilding-the-mini.md`, "Finding the Mini on the network") and use
it for one run:

    MINI_ADDRESS=hawktimus@192.168.1.50 deploy/mac/ship.sh

To stop typing the Mini's ssh password, set up a key once with
`ssh-copy-id hawktimus@teletraan.local` (it asks for the password one last time).
`sudo` still asks for it, which is on purpose.

## Changing the settings

The Mini's address, its repository folder and the name of the screen's service are
three lines at the top of `ship.sh`. They are not secrets, so they are written in
the file.
