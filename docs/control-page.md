# The control page

The control page runs on the Mini. Coaches use it from a phone or a laptop on the WiFi to update the dashboard and the Studio, see what is running and roll back. Nobody needs SSH for it.

Address: `http://teletraan.local:3229/control/`. The Tailscale name of the Mini works the same way: `http://<tailscale name>:3229/control/`. If the school WiFi blocks traffic between devices, `teletraan.local` will not open. Use the Tailscale name then.

The page has five tabs: Update, Now showing, Status, Keys and Log. This page covers the service itself and the Update tab. The other tabs have their own notes in the page. The Now showing tab has a Play announcement button, which plays the announcements of Dashboard Settings through the request route, and a box to post a short announcement.

## First time

Do these once, in this order. The team mentor says yes to the Docker download in step 1.

1. On the Mini, pull the Node image: `docker pull node:22-alpine`. The installer needs it and says so when it is missing.
2. On the Mac that has the repository, open `Teletraan Mini.command` (or run `tools/mini/teletraan-mini`) and choose 8, Set the PIN of the control page. A PIN is 6 to 12 digits. It is saved on the Mac and on the Mini in `local.env`.
3. Choose 1 in the same menu, or run `tools/mini/teletraan-mini update`. The Mac copies the repository to `~/teletraan-staging` on the Mini and runs `mini/install.sh` there with sudo. The installer:
   - moves today's `/opt/teletraan` to `releases/1` and puts `local.env` at `/opt/teletraan/local.env`;
   - installs the helper socket, its service and the sudoers file;
   - installs the repository as the next release (release 2 on a Mini that had a tree) and builds the Studio, which takes several minutes the first time;
   - starts the web server and the control service and restarts the screen.
4. Allow the Mini's address in Sanity, so the Studio on the Mini can read the dataset. Open sanity.io/manage, choose the project, then API, then CORS origins, then Add CORS origin. Add `http://teletraan.local:3229` with Allow credentials ticked, and do the same for `http://<tailscale name>:3229`. The Status tab says "CORS origin missing" until this is done.
5. Open the address above and type the PIN.

Release 1 is the old tree. It stays in the list as a record. It cannot be switched back to, because its folders are from before round 6.

## How releases work

`/opt/teletraan/releases/<n>/` holds a full copy of the repository for each version. `/opt/teletraan/current` is a link to the one on the wall. The web server, the screen, the timers, the control service and the Studio all read through `current`. `local.env` stays at `/opt/teletraan/local.env` and is linked into each release's `mini/` folder.

- The number only goes up. The counter is in `releases/COUNTER`. To start at a higher number, write that number in the file. The next release is one more than it.
- The last 5 releases are kept. Older ones are removed when a new one is installed. The one on the wall is never removed.
- Each release has `RELEASE.json` with the version, the commit, the date, where it came from (`upload` or `git`), the note and the tree hash. The tree hash is the SHA-256 over the files in `dashboard/`, `studio/schemas/`, `mini/` and `control/`. The page uses it to tell whether a folder on a laptop is the one on the wall.
- Everything that shows a build shows it as `v14 · a1b2c3d`: the version number and the first 7 characters of the commit. `dashboard/build.js` holds `build`, `version`, `commit` and `date`. It is written from `RELEASE.json` at install and when the screen starts.
- `/opt/teletraan/mini`, `/opt/teletraan/dashboard` and the other folder names are links through `current`, so the unit files and the install scripts keep their paths.

## The Update tab

1. Choose Pick the repository folder and pick the Teletraan folder on this computer. The page remembers its name.
2. It reads `.git/HEAD` when the folder has one, works out the tree hash with the same rules as the Mini and shows one of:
   - `Your folder: v14 · a1b2c3d` when the folder is a release on the Mini;
   - `Your folder: v14 · a1b2c3d · uncommitted changes` when the commit is a release but the files differ;
   - `Your folder: v? · a1b2c3d · not on the wall yet` for a commit the Mini has not seen;
   - `Your folder: v? · commit unknown` when the folder has no `.git`.
3. Next to it is `On the wall: v14 · a1b2c3d`. The button, Push → wall, is off when the folder is exactly what is on the wall.
4. Type a note if you want one. Press the button. The browser zips the folder in memory without `.git`, `node_modules`, `local.env`, `_inputs`, `_outputs` and the generated files, up to 100 MB, and uploads it.
5. The page then shows one line for each step of the install: unpack, check the files, check the schemas, build the Studio, write the release files, switch, restart the screen, wait for the screen. A failure before the switch removes the half-built folder and leaves the wall as it was. The number is used up either way.

The browser zip needs one file that is not in the repository yet: `control/static/vendor/fflate.js`. `control/static/vendor/README-fflate.txt` says what to add. Until then the page says the zip library is missing, and the Mac tool still works.

### Roll back

The Roll back box lists the kept releases with version, date and note. Pick one, press Switch to this version and confirm. `current` flips and the screen restarts. Nothing is built again, because each release holds its own Studio build. Rolling forward works the same way.

## The git path (optional)

No GitHub is needed. The installer makes a bare repository at `/srv/teletraan.git` with a `post-receive` hook. A push of `main` installs it as the next release with the same steps as the Update tab. The Update tab shows the lines with the user and host filled in:

    git remote add mini <user>@<host>:/srv/teletraan.git
    git push mini main

On a new computer: `git clone <user>@<host>:/srv/teletraan.git teletraan`. This needs an SSH key. docs/new-mac.md says when you do not need one.

## When the page cannot be reached

The Mac tool is the way in. `tools/mini/teletraan-mini update` does the same install as the Update tab, and `tools/mini/teletraan-mini restart` restarts the screen. Both need SSH.

## The helper and restarts

The page cannot restart anything by itself. It asks a helper on the host through a Unix socket, `/run/teletraan/control.sock`, which only the login user can use. The helper (`mini/scripts/control-helper.sh`) knows these words and nothing else: `restart-kiosk`, `restart-services`, `reboot`, `status`, `sync-now calendars`, `sync-now monday`, `sync-now frc`, `write-env` and `monday-check`. `status` prints `kiosk:`, `display:`, `tailscale:` and other `name: value` lines. Each one is written to `/opt/teletraan/logs/helper.log` with the time. Anything else is refused and logged.

The sudoers file `/etc/sudoers.d/teletraan-control` lets the login user run `systemctl restart teletraan-*`, `systemctl restart nginx`, `systemctl start teletraan-*.service` and `/sbin/reboot` without a password, and nothing more.

The control container mounts `/opt/teletraan` (read and write), the `/run/teletraan` folder that holds the socket, and `local.env` read only. It does not mount the Docker socket or anything under `/etc`.

## The PIN

`CONTROL_PIN` in `local.env` is 6 to 12 digits. The page asks for it once and keeps a signed cookie for 30 days. Six wrong tries from one address in ten minutes block that address for an hour. A new PIN ends every cookie. With no PIN set the page only says to set one with the Mac tool.

## Where the code is

- `control/server.js`, `control/lib/` and `control/routes/`: the service. Every file in `routes/` is loaded by name order, so a new route needs only a new file.
- `control/static/`: the pages. A file named `tab-<name>.js`, and each file in `control/static/tabs/` that calls `registerTab`, is a tab and registers itself.
- `mini/install.sh`, `mini/git/post-receive`, `mini/sudoers/`, `mini/systemd/teletraan-control.socket` and `teletraan-control@.service`: the installer and the host side.
- `control/bin/install-tree.js`: the install steps from a folder. The installer and the git hook run it in the Node image.
