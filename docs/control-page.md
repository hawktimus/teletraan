# The control page

The control page runs on the Teletraan computer. Coaches use it from a phone or a laptop on the WiFi to update the dashboard and the Studio, see what is running and roll back. Nobody needs SSH for it.

Address: `http://teletraan.local:3229/`. It opens a small page with two big buttons, Control page and Studio. The control page itself is `http://teletraan.local:3229/control/`. The Tailscale name of the Teletraan computer works the same way: `http://<tailscale name>:3229/`. If the school WiFi blocks traffic between devices, `teletraan.local` will not open. Use the Tailscale name then.

The Studio has two ways in: the Studio button on the landing page and in the header of the control page (both open `/studio/` on port 3229), and port 3426, which goes straight to the Studio: `http://teletraan.local:3426/`. Port 3426 serves the Studio and nothing else.

The page has five tabs: Update, Now showing, Status, Keys and Log. This page covers the service itself and the Update tab. The other tabs have their own notes in the page. The Now showing tab has a Play announcement button, which plays the announcements of Dashboard Settings through the request route, and a box to post a short announcement.

## Holding a panel

On the Now showing tab, Hold this panel has a button, Hold 1 minute, and a field for whole minutes from 1 to 60 (it starts at 10) with the button Hold for that many minutes. The service refuses anything else with a plain sentence, and the hold ends by itself at that time. Show a view has the same kind of field, from 10 to 120 minutes. No other button has one.

## The Live preview

The Now showing tab has a Live preview card under the card of the wall. It is a copy of the dashboard in a frame, drawn at 1920 by 1080 and shrunk to the width of the card. The web server serves the dashboard read only on port 3229 as well as on the local port, with the same folder, the same cache rules and the same slides rule. The dashboard is public data, so nothing secret is served.

The copy runs by itself on the phone or laptop, so it may show a different panel than the TV at this moment. The card above it says what the TV shows. The copy does not report to the control page: the dashboard reports only when its address is `localhost` or `127.0.0.1`, and port 3229 refuses a report from any other address. The copy writes nothing. Its title heartbeat is only the title of its own frame.

## On a phone

The page is made for a phone first. It fits 320 to 430 pixels with no sideways scroll, the tabs wrap into rows, long values such as commit hashes and addresses wrap, and every field is 16px or larger so iOS does not zoom. The Live preview does not load by itself under 900px wide: tap Show live preview. It is taken out again when you change tab or the page goes to the background, because the whole dashboard in a frame is too heavy for a phone. If the page still does not finish loading, it shows a line with a Reload link instead of a bare page.

## First time

Do these once, in this order. The team mentor says yes to the Docker downloads in step 1.

1. On the Mac that has the repository, open `Teletraan Tool.command` (or run `tools/teletraan/teletraan-tool`) and choose 1, Install everything, or run `tools/teletraan/teletraan-tool update`. The Mac asks for the computer's password once, copies the repository to `~/teletraan-staging` on the computer and runs `computer/install.sh` there as root. The installer:
   - pulls the Node image (`node:22-alpine`) and the web server image (`nginx:1.28-alpine`) if the computer does not have them. It says which image and that this is a download. If a download fails, check that the computer is online and that the image name is right, then choose 1 again;
   - moves today's `/opt/teletraan` to `releases/1` and puts `local.env` at `/opt/teletraan/local.env`;
   - installs the helper socket, its service and the sudoers file;
   - installs the repository as the next release (release 2 on a computer that had a tree) and builds the Studio, which takes several minutes the first time;
   - starts the web server and the control service with `docker compose`, run as root, and turns on the nightly timer.

   The tool then installs the services and timers and restarts the screen (docs/updating-the-computer.md).
2. Allow the computer's address in Sanity, so the Studio on the computer can read the dataset. Open sanity.io/manage, choose the project, then API, then CORS origins, then Add CORS origin. Add `http://teletraan.local:3229` with Allow credentials ticked, and do the same for `http://<tailscale name>:3229`. If you open the Studio on port 3426, add `http://teletraan.local:3426` and `http://<tailscale name>:3426` too, because Sanity checks the address exactly as the browser shows it. The Status tab says "CORS origin missing" until this is done, and then names the 3426 address as well.
3. Open the address above and type the PIN: 3229 or 3426. Nothing has to be set up for it.

Release 1 is the old tree. It stays in the list as a record. It cannot be switched back to, because its folders are from before round 6.

## How releases work

`/opt/teletraan/releases/<n>/` holds a full copy of the repository for each version. `/opt/teletraan/current` is a link to the one on the wall. The web server, the screen, the timers, the control service and the Studio all read through `current`. `local.env` stays at `/opt/teletraan/local.env` and is linked into each release's `computer/` folder.

- The number only goes up. The counter is in `releases/COUNTER`. To start at a higher number, write that number in the file. The next release is one more than it.
- The last 5 releases are kept. Older ones are removed when a new one is installed. The one on the wall is never removed.
- Each release has `RELEASE.json` with the version, the commit, the date, where it came from (`upload`, `git` or `github`), the note and the tree hash. The tree hash is the SHA-256 over the files in `dashboard/`, `studio/schemas/`, `computer/` and `control/`. The page uses it to tell whether a folder on a laptop is the one on the wall.
- Everything that shows a build shows it as `v14 · a1b2c3d`: the version number and the first 7 characters of the commit. `dashboard/build.js` holds `build`, `version`, `commit` and `date`. It is written from `RELEASE.json` at install and when the screen starts.
- `/opt/teletraan/computer`, `/opt/teletraan/dashboard` and the other folder names are links through `current`, so the unit files and the install scripts keep their paths.

## Update from GitHub

The top of the Update tab is the card From GitHub. It needs no login and no key, because the repository (github.com/Hawktimus/teletraan) is public.

1. The card shows `On GitHub: <short hash> <message>` and `On the wall: v14 · a1b2c3d`.
2. Press Update from GitHub and confirm. The computer downloads the zip of that exact commit (about 100 MB at most, 2 minutes at most), takes off the one top folder GitHub puts in it and installs it with the same steps as the folder upload: download, unpack, check the files, check the schemas, build the Studio, write the release files, switch, restart the screen, wait for the screen. A failure before the switch leaves the wall as it was.
3. The release note reads `From GitHub <short hash> <message>` and `RELEASE.json` says `from: github`.
4. The button reads Already on the wall and is off when the newest commit is the one on the wall. Check again asks GitHub once more.

If GitHub answers too often the card says "GitHub is limiting requests. Try again in a few minutes." If the computer is offline it says it could not reach GitHub. Only one update runs at a time. The control container needs outbound HTTPS to `api.github.com` and `codeload.github.com`. No compose or nginx change is needed, because the control service makes the calls itself. The code is `control/lib/github.js` and `control/routes/github.js`; the repository, the branch and the addresses are the constants at the top of the first.

## The Update tab

The folder upload sits below the GitHub card, headed From a folder on this computer.

1. Choose Pick the repository folder and pick the Teletraan folder on this computer. The page remembers its name.
2. It reads `.git/HEAD` when the folder has one, works out the tree hash with the same rules as the Teletraan computer and shows one of:
   - `Your folder: v14 · a1b2c3d` when the folder is a release on the computer;
   - `Your folder: v14 · a1b2c3d · uncommitted changes` when the commit is a release but the files differ;
   - `Your folder: v? · a1b2c3d · not on the wall yet` for a commit the computer has not seen;
   - `Your folder: v? · commit unknown` when the folder has no `.git`.
3. Next to it is `On the wall: v14 · a1b2c3d`. The button, Push → wall, is off when the folder is exactly what is on the wall.
4. Type a note if you want one. Press the button. The browser zips the folder in memory without `.git`, `node_modules`, `local.env`, `_inputs`, `_outputs` and the generated files, up to 100 MB, and uploads it.
5. The page then shows one line for each step of the install: unpack, check the files, check the schemas, build the Studio, write the release files, switch, restart the screen, wait for the screen. A failure before the switch removes the half-built folder and leaves the wall as it was. The number is used up either way.

The browser zip uses one vendored file, `control/static/vendor/fflate.js`, with its licence in `control/static/vendor/LICENSE-fflate.txt`. If the file is ever missing, the page says the zip library is missing, and the Mac tool still works.

### Roll back

The Roll back box lists the kept releases with version, date and note. Pick one, press Switch to this version and confirm. `current` flips and the screen restarts. Nothing is built again, because each release holds its own Studio build. Rolling forward works the same way.

## The git path (optional)

No GitHub is needed. The installer makes a bare repository at `/srv/teletraan.git` with a `post-receive` hook. A push of `main` installs it as the next release with the same steps as the Update tab. The Update tab shows the lines with the user and host filled in:

    git remote add teletraan <user>@<host>:/srv/teletraan.git
    git push teletraan main

On a new computer: `git clone <user>@<host>:/srv/teletraan.git teletraan`. This needs an SSH key. docs/new-mac.md says when you do not need one.

## When the page cannot be reached

The Mac tool is the way in. `tools/teletraan/teletraan-tool update` does the same install as the Update tab, and `tools/teletraan/teletraan-tool restart` restarts the screen. Both need SSH.

## The helper and restarts

The page cannot restart anything by itself. It asks a helper on the host through a Unix socket, `/run/teletraan/control.sock`, which only the login user can use. The helper (`computer/scripts/control-helper.sh`) knows these words and nothing else: `restart-kiosk`, `restart-services`, `reboot`, `status`, `sync-now calendars`, `sync-now monday`, `sync-now frc`, `write-env` and `monday-check`. `status` prints `kiosk:`, `display:`, `tailscale:` and other `name: value` lines. Each one is written to `/opt/teletraan/logs/helper.log` with the time. Anything else is refused and logged.

The sudoers file `/etc/sudoers.d/teletraan-control` lets the login user run `systemctl restart teletraan-*`, `docker restart teletraan-web`, `systemctl start teletraan-*.service` and `systemctl reboot` without a password, and nothing more. The helper runs each by its full path, `/usr/bin/systemctl` and `/usr/bin/docker`, and the file lists the same paths. The reboot is also listed as `/bin/systemctl reboot`, `/usr/sbin/reboot` and `/sbin/reboot`, in case `sudo` compares the path as typed.

The control container mounts `/opt/teletraan` (read and write, which includes `local.env`) and the `/run/teletraan` folder that holds the socket. It reads `local.env` through the folder and not as a mount of its own file, so a key saved on the Keys tab is seen at once. It does not mount the Docker socket or anything under `/etc`.

## When a button does nothing

Every button on the Now showing, Status and Log tabs shows a line under it: Done in green, or the reason in red. A reboot or a services restart cuts the page's own connection, so those show an amber line that says to wait a minute and reload.

- "The control page could not reach the helper on this computer. Run the installer again." The socket `/run/teletraan/control.sock` is missing or the control container cannot use it. Run `sudo computer/install.sh` again (from the Mac tool, choose 1).
- "Sanity refused the write. Check SANITY_WRITE_TOKEN on the Keys tab." The key is missing the write right, or is wrong.
- "Run presentations is switched off" means the screen would ignore the test.
- "The helper did not finish (failed 1). sudo: a password is required" means the sudoers file does not allow the command. Run the installer again.

Two commands on the Teletraan computer show what happened:

    tail -n 40 /opt/teletraan/logs/helper.log
    sudo journalctl -u teletraan-control@* -n 40 --no-pager

The first has one line for each word the helper was asked, and a `failed` line with the reason from `sudo` when a command did not run. The second has what the helper printed to the journal.

The screen sees a request from the control page or the Studio (Run presentation test, Play announcement, Next look now, Hold, Show a view) within about 10 seconds: it reads only those fields of Dashboard Settings every 10 seconds, besides the full read every 5 minutes and the live change stream. A test request counts for one minute, so a screen that only read every 5 minutes would usually miss it.

## The PIN

The page accepts exactly two PINs, 3229 and 3426. They are a constant list in `control/lib/auth.js`. The page asks once and keeps a signed cookie for 30 days. Six wrong tries from one address in ten minutes block that address for an hour. The Keys tab shows "PIN: fixed" and has no field for it.

To make the page take one other PIN, add the line `CONTROL_PIN='4417'` to `/opt/teletraan/local.env` by hand over SSH (4 to 12 digits, nothing else is checked). The page then accepts only that PIN, the two fixed ones stop working, and every cookie made before is over. Take the line out to go back to the two fixed PINs. A value that is not 4 to 12 digits is ignored. The Mac tool and the Keys tab never write this line and leave it alone.

## Where the code is

- `control/server.js`, `control/lib/` and `control/routes/`: the service. Every file in `routes/` is loaded by name order, so a new route needs only a new file.
- `control/static/`: the pages. A file named `tab-<name>.js`, and each file in `control/static/tabs/` that calls `registerTab`, is a tab and registers itself.
- `computer/install.sh`, `computer/git/post-receive`, `computer/sudoers/`, `computer/systemd/teletraan-control.socket` and `teletraan-control@.service`: the installer and the host side.
- `control/bin/install-tree.js`: the install steps from a folder. The installer and the git hook run it in the Node image.
