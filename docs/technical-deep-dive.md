# Teletraan I: a technical deep dive

This describes the `main` branch of the Teletraan I repository as of commit `1b44659`. Other work is changing code in parallel, so a file name, a constant or an interval below may have moved since. Every claim was checked against the files named beside it, not only against the docs. Where the docs and the code disagree, section 14 says so. A short version is in `docs/technical-deep-dive-short.md`.

Teletraan I is the wall dashboard of FRC Teams 3229 (Hawktimus Prime) and 3426 (Hawktimus Nova) at Holly Springs High School. It is a web page on a 70 inch TV, driven by a small Linux computer behind the TV, fed by a hosted content database, and kept alive by shell scripts, systemd timers and two containers. It is written, run and maintained by students.

## 1. Purpose and constraints

The design follows from six constraints. Most of the odd-looking choices in the code come from one of them.

- **A wall TV read from 20 feet.** The picture is a fixed 1920 by 1080 canvas. Text is never smaller than 44 px except a short list of named exceptions (clock labels, chips, owner names, photo credit); body text is 56 to 64 px and headings 96 px and up. The page never reflows: `fitToScreen()` in `dashboard/shell-extras.js` applies one `transform: scale(min(width/1920, height/1080))` to the whole screen, which is 1 on the TV. Every layout, the mirror and the war clock are placed in pixels inside the canvas.
- **Old hardware.** The screen is shown by a Mac mini running Debian 13 with Chromium in kiosk mode. The age of the mini is stated two ways in the docs (section 14). Its graphics are weak, so animation is restricted to transforms, opacity and line drawing, and the code carries a guard that drops transitions when the screen is drawing slowly (section 5.9).
- **Students maintain it.** The maintainers know Java and not the web, so the dashboard has no framework, no bundler and no build step: plain HTML, CSS and ES modules. Edit a file, refresh, see the change. One folder per panel, one registry file, sparse comments that say why.
- **About ten people edit content.** Content lives in Sanity Studio, a hosted editor, so nobody edits code to change a sponsor or a tip.
- **Always on, unattended.** The screen must survive network outages, a bad deploy, a frozen browser and a power cut, and must never sit blank without saying why.
- **A public repository and a public dataset.** The repository is public, and so is the Sanity dataset. That forces a strict rule about what may be stored where (section 12).

## 2. The system on one page

```
  EDITORS (about 10)                      COACHES / MENTORS
  Sanity Studio (hosted + a copy on       Control page on the Mini
  the Mini at :3229/studio/)              PIN login, phone friendly
        |  publish                              |  update, keys, requests
        v                                       v
  +------------------+   HTTPS reads    +--------------------------------+
  |  Sanity dataset  |<-----------------|  THE TELETRAAN COMPUTER (Mini) |
  |  "production"    |----------------->|  Debian, systemd, Docker       |
  |  PUBLIC          |  writes: status, |                                |
  +--------+---------+  tasks, frc, ... |  [web: nginx 1.28]  [control:  |
           |                            |   :8080 local only   Node 22]  |
           | query + live events        |   :3229 LAN/Tailscale :3230    |
           | (published perspective)    |   :3426 Studio only   internal |
           v                            |                                |
  +------------------+   file reads     |  /opt/teletraan/releases/N     |
  |  Chromium kiosk  |<-----------------|  /opt/teletraan/current -> N   |
  |  1920x1080 page  |  data/live/*     |  /var/lib/teletraan/data       |
  |  (the dashboard) |                  |  /opt/teletraan/local.env      |
  +--------+---------+                  |  (secrets, mode 600)           |
           |                            |  systemd timers + scripts      |
           +--> HDMI --> 70 inch TV     +---------------+----------------+
                                                        |
        +-----------+-----------+-----------+-----------+-----------+
        | BAND iCal | Monday    | TBA +     | Match13   | Google    |
        | feeds     | GraphQL   | Statbotics| forecasts | Drive and |
        |           |           | FIRST blog|           | Slides    |
        +-----------+-----------+-----------+-----------+-----------+
          (weather: the page itself asks Open-Meteo directly)
```

The important idea: **the Mini is the only machine in the running system that holds secrets and talks to the team's private services; the screen only reads** (apart from a small status post to the control page on the same machine). The dashboard reads the public Sanity dataset over HTTPS and reads a few files the Mini keeps in a data folder. Everything private is turned into public-safe documents or local files by scripts on the Mini before the screen sees it.

## 3. Data flow, end to end

### 3.1 The sources

| Source | What it gives | Who reads it | How often | Where it lands |
|---|---|---|---|---|
| Sanity Studio (content) | Sponsors, tips, leadership, team leads, photos, agenda, talks, settings, teams, rotation | Dashboard, directly | On change (live stream) and every 5 min | Dashboard memory and `localStorage` |
| BAND calendars (iCal feeds) | Events | `fetch-calendars.sh` | Every 15 min | `.ics` files in the data folder |
| Monday.com (GraphQL) | Tasks of two boards | `monday-sync.sh` | Wakes every 5 min, reads by setting (5 to 120 min, default 30) | `task` documents and `monday-status` in Sanity |
| The Blue Alliance v3 and Statbotics v3 | Events, ranks, matches, ratings | `frc-sync.sh` | Wakes every 5 min, works about hourly, about every 5 min during an event | `frc-status` document in Sanity |
| Match13 | Forecasts | `match13-sync.sh` | Every 30 min while an event is near, every 6 h otherwise | `match13.json` in the data folder, never Sanity |
| FIRST community blog (RSS) | Headlines | `news-sync.sh` | Every 2 h | `frc-news` document in Sanity |
| Google Drive (folder of pictures) | Extra photos | `photos-drive-sync.sh` | Every 15 min | Pictures plus a manifest in the data folder |
| Google Slides (talk decks) | Slides | `slides-sync.sh` | Every 2 min, from 36 h before a talk | One JPEG per slide plus `manifest.json` |
| Open-Meteo | Weather | The dashboard itself, no key | Every 15 min | Memory, with a saved reading |
| GitHub (public repo) | Code | Control page "Update from GitHub" | On a button press | A new release folder |

Calendars deserve a note: `fetch-calendars.sh` accepts only https (`webcal://` is rewritten, `http://` refused), checks for `BEGIN:VCALENDAR`, writes through a temporary file, and records per calendar when it last succeeded and why it last failed, with no address in the record. With Node 18+ on the Mini, `calendar-status.sh` runs the dashboard's own calendar and filter modules to list each calendar's next 40 events as SHOWN or HIDDEN for the Studio's Calendars page, so the page and the TV cannot disagree.

Two sources are written by people rather than polled. A **Google Form and an Apps Script** (outside the repository) book talks and write `presentation` documents into Sanity. The Studio and the control page also write **request fields** (play an announcement, hold a panel, preview a theme) into the Dashboard Settings document.

### 3.2 The flow as a picture

```
 Phone / laptop --- Control page ---+
                                    | writes request fields
 Studio (editors) ------------------+--------> SANITY DATASET (public)
                                                  ^   |
 Mini scripts (write token) ----------------------+   |
   monday-sync  -> task docs, monday-status           | read, published only
   frc-sync     -> frc-status                         | + live change stream
   news-sync    -> frc-news                           v
   status-write -> status-mini, calendar-status    DASHBOARD (in Chromium)
                                                      ^
 BAND iCal  --fetch-calendars--> data/calendars/*.ics-+  file reads over
 Match13    --match13-sync-----> data/match13.json ----+  http://localhost:8080
 Drive      --photos-drive-sync-> data/photos/ --------+  /dashboard/data/live/
 Slides     --slides-sync------> data/slides/<id>/ ----+
 Mini kiosk.sh -----------------> data/device.json, version.txt
 Weather: the page asks api.open-meteo.com directly (no key)
 Dashboard --POST every 10 s--> control page "Now on the wall" (local only)
```

### 3.3 What is public and what stays local

The Sanity dataset `production` (project id `ybfqe345`, API version `2025-02-19`) is public: the dashboard reads it with no token, and anyone who knows the project id, which is part of every address the screen asks for, can query it.

Public by design, in Sanity: all editor content, task titles with first names only, department counts, competition data (team numbers, nicknames, match results), FRC news headlines and links, the request fields, and the status documents the Mini writes (`status-mini`, `calendar-status`, `monday-status`, `frc-status`, `frc-news`). One consequence: `calendar-status` holds the titles of upcoming events, including events a filter hides from the TV, and anyone who queries the dataset can read them.

Local to the Mini, never in Sanity or git: the keys, the raw calendar files, the Match13 numbers (Match13 marks its answers private), device name and addresses, the watchdog state, and the nightly backups.

### 3.4 Secrets

All secrets live in one file, `/opt/teletraan/local.env`, mode 600, outside any release folder, never committed (git ignores it and editor copies such as `local.env.save`). It holds:

- `SANITY_WRITE_TOKEN`, `MONDAY_API_TOKEN`, `TBA_AUTH_KEY`
- `GOOGLE_API_KEY` (Drive photo folder), `MATCH13_API_KEY`, optional `SANITY_AUTH_TOKEN`
- one `CALENDAR_<ID>_URL` line per BAND calendar (the feed address is a secret)
- optionally `CONTROL_PIN`

(Some summaries say three keys; the code in `control/support/keys.js` knows six. See section 14.)

How the code keeps them out of sight:

- `computer/scripts/lib.sh` has the one reader of `local.env` (`setting NAME`), and every script starts with it. The control service has one reader too.
- The Blue Alliance and Match13 keys are passed to `curl` as a config line on standard input, so they never appear in a process list. Scripts name a calendar by its id and never print an address.
- The control page shows a key as its first four characters and dots, validates new values (a calendar link must be `https://`; `webcal://` is rewritten), and writes through the helper socket, which renames a new file over `local.env` and keeps `local.env.previous`.
- The log download passes every line through `control/lib/redact.js`, which hides named keys, bearer tokens, JWT-shaped strings, calendar links, secret-looking query parameters and any 40+ character run of token characters.

The Mac tool (`tools/teletraan/`) keeps a second copy of the keys at `~/.teletraan/secrets.env` on the owner's Mac and merges them into the Mini's `local.env` over SSH without printing them. The Google Apps Script that books talks holds its own Sanity token in Script Properties, outside the repository.

## 4. The Teletraan computer

### 4.1 Layout on disk

```
/opt/teletraan/
  releases/1 2 3 ...      full copy of the repo per release, last 5 kept
  releases/COUNTER        only goes up, a number is never reused
  current -> releases/N   the live release (a symlink)
  local.env               secrets, mode 600 (shared by all releases)
  control-secret          HMAC secret for PIN cookies, mode 600
  cache/                  npm cache, built Studio modules by lockfile hash
  logs/                   control.log, helper.log
/var/lib/teletraan/data   written by scripts, mounted read-only into containers
  calendars/ slides/ photos/ match13.json device.json version.txt mirror/
  calendar-sync.txt calendar-status.json watchdog-state
/var/backups/teletraan/   production-<date>.ndjson.gz, newest 14
/run/teletraan/control.sock   the helper socket
```

Each release folder is a full checkout plus a `RELEASE.json` (version, commit, date, source, note, tree hash) and a prebuilt `studio-dist/`. `computer/local.env` inside a release is a symlink to the shared file.

### 4.2 Containers

`computer/docker-compose.yml` defines two services.

- **web** (`nginx:1.28-alpine`, pinned so a rebuild years later runs the server `nginx.conf` was written for). It mounts `current/dashboard`, `current/studio-dist` and the data folder, all read-only. Port 8080 (`TELETRAAN_PORT`) is published on `127.0.0.1` only, so the dashboard URL the kiosk uses cannot be reached from the network. Port **3229** (landing page, control page proxy, Studio, and a read-only copy of the dashboard) and port **3426** (Studio only) are open to the WiFi and to Tailscale.
- **control** (`node:22-alpine`). It runs the control service and, for each release, `npm ci` and the Studio build. It listens on 3230 on the Docker network only; no port is published. It mounts `/opt/teletraan` read-write, the helper socket folder, and the data folder read-only.

`nginx.conf` sends `no-store` for data, `no-cache` (revalidate by ETag) for HTML, JS and CSS, and one week for images and fonts. The comment explains why there is no long max-age on scripts: modules import each other by path, a `?v=` on the entry script does not reach them, and a long cache would leave old code running after an update.

### 4.3 Timers and scripts

All units use `/opt/teletraan` and an `ACCOUNT` placeholder that each `install-*.sh` replaces with the repository owner. A unit file change takes effect only when its install script is run again (the control page's update runs `computer/install.sh`, which does this).

| Unit | Schedule | What it does |
|---|---|---|
| `teletraan-calendars` | 1 min after boot, then every 15 min | Download BAND feeds (https only), then write the Calendars page document |
| `teletraan-slides` | every 2 min | Turn the Google Slides deck of coming talks into JPEGs |
| `teletraan-monday` | every 5 min | Wake the Monday sync, which reads only when due |
| `teletraan-frc` | every 5 min | Wake the competition sync |
| `teletraan-match13` | every 30 min | Match13 forecasts |
| `teletraan-news` | every 2 h | FIRST blog headlines |
| `teletraan-photos-drive` | every 15 min | Copy pictures from a Drive folder |
| `teletraan-watchdog` | every 2 min (5 min after boot) | Restart a frozen screen |
| `teletraan-nightly` | 04:00 daily, 04:10 Sunday | Restart the kiosk; reboot on Sunday |
| `teletraan-backup` | 03:15 daily | Export the dataset |
| `teletraan-pull` | every 5 min, optional | `git pull`, only on a Mini that deploys by pulling |
| `teletraan-kiosk` | service, `Restart=always` | X server plus Chromium |
| `teletraan-control.socket` | socket, `Accept=yes` | Starts `control-helper.sh` once per request |

Every script begins with `#!/bin/bash`, a usage line, `set -euo pipefail` and `. lib.sh`. Long ones are split into parts (`monday-contract.sh`, `-requests.sh`, `-check.sh`, `-programs.sh`, and the same for `frc-*`). The "contract" file of each integration holds every address, id, label number and path into an answer in one place, so a change at the other end is a one-file edit. A script that needs a key and does not find it does nothing and says so in one line. The scripts need `curl`, `jq`, `poppler-utils` (slides), `gzip`, Python 3 (the mirror) and, for the Calendars page document, Node 18+; installing any of them needs the team mentor's yes.

### 4.4 The kiosk, the display and the watchdog

`kiosk.sh` is started by `xinit` from the kiosk service. It writes `dashboard/build.js` from `RELEASE.json` (so every file request carries `?v=<build>` and the TV never runs stale code); waits for the dashboard to answer; finds the connected screen with `xrandr` and sets a 1920 by 1080 framebuffer; turns off screen blanking; clears Chromium's crash flags and stale profile locks (a power cut would otherwise raise a "restore pages" prompt); removes only the cache folders, keeping `Local Storage`, because the dashboard's last known content lives there; writes `device.json` (hostname, WiFi and Tailscale addresses) every minute so someone can find the Mini on a school network; and starts `chromium --kiosk --force-device-scale-factor=1` with a debugging port on `127.0.0.1:9222`.

The **heartbeat** closes the loop. Every 30 seconds the page writes the clock into its own title (`Teletraan I · 14:07`, `dashboard/core/heartbeat.js`). `watchdog.sh` lists the browser's pages at `127.0.0.1:9222/json` and restarts the kiosk service when there is no browser, no page, no time in the title, or the title is more than 3 minutes old. It will not restart a browser younger than 180 seconds, will not restart twice within 600 seconds, and when a third restart would fall inside one hour it stops until the next boot, so a bad deploy cannot loop forever. State is a file written through a temporary file and `mv`, and each restart is reported to Studio.

`nightly.sh` restarts the kiosk at 04:00 and reboots on Sunday at 04:10, and skips either when a talk is booked to start within the next hour or is running. If Sanity cannot be asked, the restart goes ahead.

`backup-dataset.sh` exports every document through Sanity's export endpoint with `curl` and `gzip`, keeps 14 files, and records the time in `status-mini`. Image files are not in the export. The backups sit on the Mini's own disk.

### 4.5 Boot and shutdown drawings

`computer/console/startup.txt` is a plain 7-bit text drawing (at most 100 columns by 56 rows, no backslash because the login prompt would read one as an escape) that `install-console.sh` writes above `/etc/issue`, so the TV shows it above the login prompt while the Mini starts. `shutdown.txt` is printed by `teletraan-console.service` at shutdown.

### 4.6 Releases, update paths and rollback

A release is `releases/<n>/`. Installing one (`control/lib/install.js`) is a fixed list of steps that the page shows one per line: unpack, check files, check schemas (runs `tests/schemas.test.mjs` from the new tree, 3 minute limit), build the Studio, write release files, switch, restart, wait. Before the switch, any failure removes the half-built folder and leaves `current` alone. The switch is a symlink made beside the old one and renamed over it, so there is never a moment without a link. Then `restart-services` and `restart-kiosk` go through the helper, and the service waits up to 90 seconds for the dashboard to report the new build in its 10 second status post. The last 5 releases are kept, and **rollback** is another switch plus restart.

Ways to get code onto the Mini: **Update from GitHub** on the control page (asks the public GitHub API for the newest commit of `main`, downloads the zip of that exact 40-character hash, capped at 100 MB and 120 s, and installs it, with no login and no `Authorization` header); **upload a folder** (zipped in the browser with a vendored `fflate`); **the Mac tool** (`teletraan-tool update` copies the working tree over SSH and runs `computer/install.sh`); **a bare repository** on the Mini whose hook installs a release when `main` is pushed; and **`pull.sh` on a timer**, which the other paths leave off.

`computer/install.sh` does the one-time move to the releases layout, installs the helper socket and a sudoers drop-in (checked with `visudo`), installs a tree as the next release, starts the containers and installs the nightly timer. It installs no packages.

## 5. Dashboard architecture

About 35,600 lines of JavaScript and 12,300 of CSS, no dependencies, 47 panel folders, 165 files in `core/`. Files are kept small (the largest in `core/` are a few hundred lines).

### 5.1 Startup (`shell.js`)

`shell.js` documents its URL switches at the top (`?motion=`, `?speed=`, `?style=`, `?team=`, `?show=<panel>`, `?sample=1`, `?perf`, `?debug`, and more). The order matters: style and layout first, so nothing is ever drawn in the wrong place; `fitToScreen()`; wait up to 4 s for fonts; load every panel module from `registry.js`; take the first content or, after 2 s, start with defaults and swap the real content in when it arrives; theme before the first panel; the night screen before any panel (so a Mini that restarts at 3 am never flashes the dashboard); then the fixed panels, takeovers, talks, status dots, the report to the control page and the views. Each optional part is wrapped (`startOptional`), so one failing part never stops the screen. If startup itself fails, `showFatal()` draws "Teletraan I could not start. Trying again in 30 seconds." And a plain script in `index.html` waits 25 seconds and, if `shell.js` never ran (a core file failed to load), shows the same sentence and reloads after 30 more.

### 5.2 The registry and the panel contract

`dashboard/registry.js` is a list of `{ id, region, topic, ... }` entries; the script and stylesheet default to `panels/<id>/panel.js` and `panel.css`. Regions are `banner`, `countdown`, `column`, `grid1` (large), `grid2` (small, "Panel B"), `ticker` and `overlay` (alert, announcement, talk). Flags give meaning: `layout`, `competition`, `monday`, `placeholder`, `rotationOnly`, `lastResort` (the team tile, shown only when nothing else can fill the small frame) and `testOnly`.

A grid or ticker panel exports `hasContent(content)` and `mount(host, content)` and draws only its page. The area supplies the frame and the page change (`core/areas.js`). The banner, countdown and overlay panels draw their own frames. `topic` implements one rule: Grid 1 and Grid 2 never show the same topic at once, so while Tasks is on the left the task counts are skipped (`core/schedule.js`).

### 5.3 Content: reading Sanity and surviving outages

`core/sanity-query.js` holds one large GROQ query for the whole content shape (settings, theme, tasks, sponsors, tips, notices, subteams, people, photos, presentations, plans, filters, subthemes, custom panels, teams, screens, views, and the status documents). Details that matter:

- It asks `perspective=published` on the ordinary `api.sanity.io` host, **not** the CDN host, so a publish shows at once.
- `core/content-source.js` reads on three triggers: Sanity's **live change stream** (`/data/live/events/`; edits within 300 ms join one read), a **poll every 5 minutes**, and a retry **30 s** after a failure. A dropped `EventSource` reconnects by itself; after an error reply the code reopens it after 60 s.
- Every good read is saved to `localStorage` (`teletraan-last-content`). On start, with a saved copy the screen draws at once and reads Sanity right after; without one it waits.
- A failed read keeps the content on screen. Only after **2 minutes** of failures is the screen "offline", and a small text says why (`network`, `cors`, `denied`, `other`), working out CORS versus no network with a second `no-cors` probe (`core/connection.js`). While offline, Monday panels show a stale chip whatever their age.
- The request fields (announce, hold a panel, show a view, preview a theme, pause, hidden request, and so on) are polled alone **every 10 seconds** (`core/request-poll.js`), so a button press does not wait for the stream.
- `normalizeContent()` cleans everything and `withDefaults()` fills the gaps, so a half-filled document cannot crash a panel. `?sample=1` shows the sample content in `data/sample/`; nothing stored can switch the screen to the sample.
- Weather is a direct call to Open-Meteo every 15 minutes. A failed read keeps the last reading until it is 2 hours old, then the temperature blanks (`core/weather.js`).

The page also checks `data/live/version.txt` every minute and reloads when it changes (never during an alert or announcement). Only the pull path writes that file; an install from the control page or the Mac tool restarts the kiosk instead, and `build.js` plus the `?v=<build>` on every file keeps the new browser session from using old code.

### 5.4 Rotation and views

The large panel plays **one ordered list**: Dashboard Settings, `rotationRows`, rows of `{ view, panel, seconds, shown }` plus per-panel fields (`department`, `list`, `chart`, `team`, `part`, `side`, `photoCount`, `secondsPerPhoto`). The stored name is `rotationRows` because `rotation` is already the ticker block. The code is in `core/rotation.js` and `core/views-play.js`.

- Rows that follow each other in one view form a **block**. The view changes only between blocks.
- A row whose panel has nothing to show is skipped with no gap; a block with nothing is skipped whole; if only one block has content it stays.
- A row's `seconds` (6 to 120) overrides Seconds per page.
- If no row is shown, the screen plays the default rotation (`config-rotation.js`, 15 blocks), which `tests/default-rotation.test.mjs` pins to a copy in `studio/tools/default-rotation.js`.
- **Views**: Robotics (the stored key is still `general`), Prime and Nova. Robotics has two layouts chosen per row (`roboticsWidePanels` get the bar layout); Prime and Nova use the bar layout, with Nova mirrored. The older Family view is no longer played.
- Time stands still while an alert, announcement, talk, demo, night screen or hidden transition has the screen; the view that was interrupted comes back at the panel that was next.
- Requests override the schedule: hold a panel (1 to 60 min), hold a view, preview a theme (10 to 120 min, or up to 24 hours), pause. `activeRequests()` in `core/screen-requests.js` reads them once a second.

### 5.5 Layouts, themes, styles, teams, packs, subthemes

The vocabulary overlaps, so precisely:

- **Layout**: where things go. `standard` (banner, large panel, countdown, small panel, ticker), `sidebar` (Neon Prime: name across the top, a 20 percent left column, one big pane, a full-width ticker, no small frame) and `bar` (a top banner with team name and war clock, a thin side column, one main panel, ticker; no small frame). CSS is in `dashboard/layouts/`.
- **Style / theme**: a folder `dashboard/styles/<id>/` (tokens, theme, frame, reform kit, transitions, background). Four exist: `original`, `cybertron` (gunmetal plates, neon lines, the wide war clock), `foundry`, and `retro` (a marked copy of Original, not yet designed). The default week is Original on Mon, Wed, Fri and Sun and Cybertron on Tue, Thu and Sat, in the time zone of the Look page. A style only sets custom properties and the rules it needs; `base.css` and `frame.css` are not forked.
- **Colour themes** (`dashboard/themes/`): `hawktimus`, `alternate`, `neon-prime`, plus holiday overlays. Only `hawktimus` takes its colours from the team.
- **Team** (`core/teams.js`): a Studio document with name, number, logo, twelve colours, a metal, a glow switch, a mirror switch and eight trim choices. `applyTeamLook()` is the one place that touches the page: it sets `--team-*` custom properties and mirror, trim, metal and glow classes on the root element. `showsForTeam()` filters items (empty means Both). No team documents means the built-in Prime team. The mirror is one class on the root that flips the layout, never a second copy of the markup.
- **Seasonal packs** (`dashboard/seasons/`): data files for seven holidays. Three layers (`#season-back`, `#season-front` made of fixed text-free zones, `#season-over`) hold a header mark, decorations and a few small slow pieces. A Look switch turns the pieces over the panels off, and calm motion draws none.
- **Subthemes** (`core/subthemes.js`): dated layers of small pictures at six named anchors (`banner-left`, `banner-right`, `countdown-top`, `ticker-end`, `side-bottom`, `main-corner`), boxes of the 1920 by 1080 screen that hold no text.

### 5.6 The frame module and the animation rules

`frame.js` re-exports six small modules (`frame-pages.js`, `frame-effects.js`, `frame-logo.js`, `frame-kit.js`, `frame-sequences.js`, `frame-state.js`). **All animation lives there**; panels contain no animation code and label their pieces with `data-slat` or `data-part`. The three big areas keep one frame for good and swap only the page inside (`core/areas.js`, `changePage()`).

The rules, enforced by tests rather than by hope:

- Animate only `transform`, `opacity` and line drawing (stroke dash). No blur, glow, drop shadow or video. `tests/graphics.test.mjs` fails on any SVG filter or blur, and `tests/motion/animated.mjs` checks every `@keyframes` and running animation in a real browser.
- Colours are written only in token files, theme files, packs and the built-in team (`tests/graphics.test.mjs`).
- Time-based settings go through `pace()`: Speed (`very-slow` 2, `slow` 1.5, `normal` 1, `fast` 0.75) multiplies every time via a `--pace` custom property.

### 5.7 Calm mode

Motion has three values, `full`, `calm`, `none` (Dashboard Settings, or `?motion=`; anything else falls back to `full` with a console warning). In `calm` and `none`, `setMotion()` stops the CRT effect, rests the logos, disarms the neon-kit glitch, the seasonal drifting pieces are not drawn, and the reform transitions are not drawn (`kindToPlay()` returns the plain change unless motion is `full`).

### 5.8 Transitions

There are four families, from oldest to newest:

1. **Page change** inside a region: a slat flip or a mechanical change (the frame breaks into plates and bars), chosen on the Look page.
2. **The swap** (`core/swap-run*.js`): the screen pulls apart and re-forms in 1.25 s (scaled by a setting) with the hawk fluttering. It still plays for changes of look that are not a view change.
3. **Reform transitions** (`core/reform-*.js`, `docs/transitions.md`): the **panel transition** (kind `reform`) when the large panel goes to the next row of the same view, and the **view transition** (kind `reformView`) when the view changes. Both run on one 3 second skeleton (screws loosen, edges fold, squares turn over in a wave, edges unfold, screws tighten), scaled by `transitionSeconds` (2 to 4). The old content is baked into a copy with its look written into each element (`reform-bake.js`), the page changes underneath while covered, and the grid of squares (12 by 6 on the main panel) exists only during the turn. A style can supply its own hardware kit.
4. **Hidden transitions** (`core/hidden*.js`): a rare surprise, a "desktop reveal" (a blue crash screen) or "red eyes". The frames fall into a pile, the effect plays over it, a cube rises and the pieces rebuild the screen, in at most 6 seconds more than the effect. The Studio default is about once per 60 hours of screen time with a 4 hour gap after one plays; a master switch turns them off.

One flag, `core/busy.js`, says a transition is running; the name glitch, the hawk and other timed effects ask `isBusy()` and wait. `kindToPlay()` in `core/reform-plan.js` allows a reform only in full motion, never while another transition or a takeover has the screen, never when a look is waiting to go on (that is the swap's job), and never on a slow screen.

### 5.9 The slow-screen guard

`core/reform-run.js` keeps the last 60 frame gaps while no transition plays. If at least 30 samples exist and their median is over 40 ms (below 25 frames a second), `screenIsSlow()` is true and the plain change plays instead of a transition. A transition therefore cannot make a struggling Mini worse. `?perf` shows a live frame-time readout (late is over 25 ms), and `?reform=off` turns the reform transitions off for comparison.

### 5.10 Alerts, announcements, talks and the night screen

- **Takeover** (`core/takeover.js`): a full-screen alert, or timed full-screen announcements (the starting ones are set for 14:30 and 17:00), pause the normal panels. `takeoverRunning()` is asked by everything that must not start over a cover.
- **Bar announcements** (`core/notice.js`): up to 90 characters, with a start, end, optional team and level. An 80 px plate sits under the banner with a 12 px gap and the panels shrink to make room. Two live ones alternate every 12 seconds. This is a different thing from the full-screen announcements.
- **Talks** (`core/presentation*.js`, `panels/talk`): a booked talk takes the whole screen at its start: a title card (which waits up to `noShowMinutes` = 5 for the speaker's first press), the student's slides one picture at a time, then a thank-you card. A talk may overrun its slot by `graceMinutes` = 5. A clicker (Page Down and Page Up), the keyboard or the mouse (left click forward, right click back) moves the slides; Esc twice ends the talk. Slides are JPEGs made ahead by `slides-sync.sh` from a Google Slides deck exported as PDF and cut with `pdftoppm` (at most 60 pages), so the TV never loads Google.
- **Night screen** (`core/night*.js`): black with a bouncing logo from 23:30 to 11:30 in the Look page time zone (`core/constants.js`). The picture is never turned off.

### 5.11 Other panels worth knowing

The Events panel (`panels/events`, `core/event-pages.js`) shows four events and scrolls by transform only (600 ms) to the next four; with four or fewer it does not scroll. Events come only from the BAND iCal files, parsed in the browser (`core/calendar-parse.js`, with time zones and repeating events expanded in `calendar-expand.js`, capped by `maxOccurrences`). Calendar filters typed in the Studio hide or keep occurrences after expansion, and an "always show" rule can pin up to 3 events to page one. An event carries a kind chip only when its calendar has a kind.

The Photo panel asks Sanity's image CDN for a width of at most 1920 (`photoMaxWidth` in `core/images.js`), shows only visible, unexpired photos, and can also read a Drive folder through the Mini's manifest. The status dots (three 16 px dots: Monday, Band, Sanity) go amber when a source is late.

## 6. The Studio

`studio/` is a Sanity Studio (React 19, `sanity` ^6.17, `styled-components`: the only npm dependencies of the project besides a laptop-only browser test tool). It is deployed to Sanity's hosted Studio and also built on the Mini for `/studio/`. Sanity login gates editing in both places.

- **Schemas**: one file per content type in `studio/schemas/` (about 50). Every field has a one-line description, character limits match what fits on screen, and most items have a show/hide switch, an optional expiry and a Team field (Both, Prime, Nova). `tests/schemas.test.mjs` checks that the schemas, the sidebar, the panel lists and the dashboard's own copies agree.
- **Sidebar**: one plain list in `studio/structure.js`: Start here, Rotation, Today, Ticker, Events (Calendars, Calendar filters), People (Leadership, Team leads, Sponsors), Photos, Monday, Teams and views, Look, Competition, then COACHES ONLY: Dashboard Settings, Extra panels, Kept data. Types with no line (Events Calendar, Places, Demo, the old Screens) stay in the schema so nothing already typed is lost.
- **Custom pages** (`studio/inputs/`): Start here (what Teletraan I is, a picture of the screen, the three steps of every meeting), the Rotation board (drag rows, a live "will it show now" line per row, a loop preview), Calendars (what each BAND calendar brings in, SHOWN or HIDDEN), a read-only Monday page, Look, Competition, Photos, Today and Kept data. A panel preview renders a panel in an iframe of the dashboard (`studio/scripts/copy-dashboard.mjs` copies the dashboard in at build time).
- **Publish workflow**: edits save drafts; **Publish all** in the top bar (`studio/tools/publish-all.js`) lists every draft, validates each with the rules of its own Publish button, publishes one document per transaction (one bad document never blocks the rest) and reports skipped ones with the reason. The screen sees only published documents. There is no staging dataset.
- **The Mini writes documents too** (`status-mini`, `calendar-status`, `monday-status`, `frc-status`, `frc-news`, `task`), so they have no New-menu entry.

## 7. The control page

`control/` is a Node 22 service using only the standard library plus one vendored file (`fflate`, for zipping a folder in the browser). nginx proxies `/control/` to it. Routes are plain files in `control/routes/`, loaded alphabetically by `routes/index.js`, so a new route file needs no registration. The page has four tabs (Status, Display, Content, Settings) and a Studio button, is built phone-first (16 px fields, a bottom bar with Next, Pause and Reset), and has a layout that follows its measured width.

- **PIN login** (`control/lib/auth.js`): a PIN of 4 to 12 digits from `CONTROL_PIN` in `local.env`; if that is not set, a built-in fallback is used, so set one (`docs/security-review.md`). A good PIN gives a cookie holding an expiry and an HMAC-SHA-256 signature, `HttpOnly; SameSite=Strict; Path=/control`, valid 30 days; changing the PIN ends every old cookie. Six wrong tries from one address in ten minutes block that address for an hour. Comparison is constant time. The secret is generated on first start into a mode 600 file.
- **The helper socket**: the container cannot run host commands. It writes one line to `/run/teletraan/control.sock`; systemd starts `control-helper.sh` per connection, as the login user. The helper accepts a fixed list of words (`restart-kiosk`, `restart-services`, `reboot`, `status`, `sync-now <one of six names>`, `monday-check`, `monday-debug <board number>`, `write-env`, `mirror-*`, `log-bundle`) and refuses everything else with one log line. A sudoers drop-in lets that user run only `systemctl restart/start teletraan-*`, `docker restart teletraan-web`, a reboot, and the install wrapper. `write-env` checks that every line is a comment, blank or `NAME=value`, caps the input at 64 KB, keeps the previous file and renames the new one over it.
- **Update**: Update from GitHub, upload a folder, roll back among 5 releases, with the step-by-step stream described in 4.6.
- **Now on the wall**: the dashboard POSTs a small report (build, view, theme, layout, team, panel, page) every 10 seconds to `/control/api/now`. This is the one route that needs no PIN; it accepts the call only when `X-Real-IP` is loopback (nginx sets it to `127.0.0.1` for the local server and to the real address for the LAN server, where the route is GET-only), caps the body at 8 KB and cleans it. A report older than 40 seconds means the wall has gone quiet. The control service imports `cleanReport` from `dashboard/core/now-report-parts.js`, so the two sides share one parser.
- **Controls write to Sanity, not to the wall**: Play announcement, hold a panel, show a view, preview a theme, pause, play a hidden transition and run the presentation test write request fields into Dashboard Settings with the write token; the wall polls them every 10 seconds, so a change normally shows within about 20.
- **Display tab**: the Rotation board for a phone, plus the theme of each weekday. It reads Dashboard Settings from Sanity, edits rows (move, copy, delete, undo, quick hide by team or panel), and says per row whether the wall would show or skip it by running the dashboard's own query, `viewSteps` and `hasContent` functions, so the answer is not a second copy of the rules. It saves only changed fields to the draft and publishes with a separate button. Before every save it re-reads the revision and asks before overwriting a newer Studio edit, and the write names the revision it replaces, so Sanity itself catches a race.
- **Live preview and the mirror**: `mirror.py` (Python 3, standard library) opens the kiosk browser's DevTools socket, requests a screencast (960 by 540, JPEG quality 45) and writes the newest frame to the data folder. Because a screencast can come out black on a kiosk browser, it samples about 400 pixels of a small PNG decoded with zlib and falls back to screenshots (about 4 a second) if the picture is black. It runs only while the tab is open (it stops after 2 minutes without a ping, or 30 minutes). nginx serves the two frame files on 3229. If the mirror cannot start, the page shows a still copy of the dashboard built from the wall's report.
- **Keys**: a form per key and per calendar (set, keep, clear), with masked display. **Monday** section: check the token, and Monday debug for one board number. **Log**: last lines and a redacted bundle download.

## 8. Monday integration

The sync is deliberately simple after a rebuild. Two boards are read **by number**: Robotics Tasks (every task, one group per department plus a Done group) and Completed Tasks (finished work, all counted as done). Their ids, the column ids and the label numbers are in one file, `computer/scripts/monday-contract.sh`. The API version is one named line (`2026-01`).

Why numbers: students rename labels, so the script reads the **index of a label** and never its words. A number not in a table means status To Do, team General, no priority, Show on TV, no department.

**Multi-level boards.** Both boards are multi-level: a task is a parent item and its steps are subitems, and **subitems are never read**. On a multi-level board the status column of a parent answers only when the query asks for `capabilities: [CALCULATED]`, and then as a `BatteryValue`, a list of `{ key, count }` where `key` is a label number as text. The script takes the key that most subitems carry as the parent's status when there is no direct index. A people column returns ids only, so names come from a third query, and **only the first word of the first person's name is ever kept**. Items arrive in pages of 200, with at most **10 requests per run** and **900 per day** (Monday allows about 1,000); past the budget the script waits for midnight. A run that hits its limit stops, says so, and deletes nothing.

**The rules for a task** (`monday-programs.sh`, written as jq programs and tested on made-up answers):

- Only parent items with an id, a title and a department are kept.
- The department is the item's **group** when the group title is one of the nine departments (Build, Electrical, Programming, Design, CNC, Strategy, Operations, Business, Marketing); otherwise the Department column (this is how tasks in the Done group get one). No department, no task.
- The list is **Done** when the status is Done, or the group is Done, or the item is on Completed Tasks; otherwise **Open** (To Do, In Progress, In Review, Stuck).
- Team comes from the Team column (Prime, Nova, or General, shown for both). Priority, the start and end of the Timeline, Date Completed and Estimated Hours are carried; titles are capped at 40 characters.
- A Show on TV? column of Hide sets `showOnBoard` false. The script never sends the Studio's own `show` switch, so an editor's choice survives a sync.

Each task becomes a document `task-monday-<item number>`, created and filled in one group of mutations (never left empty), patched only when it differs from what is stored. When both boards were read to the end, a task whose item vanished is deleted along with its draft. The document `monday-status` records `lastSyncAt`, `lastError` in plain words, `callsToday`, per-board readings, per-department open and done counts, and a daily snapshot of the open count (up to 120 days). The Studio Monday page and the status dot read it, and the Monday panels show an amber STALE chip when the data is older than twice the interval.

**The two panels** (the eleven older Monday panels are retired and their stored rows say so): `monday-department` is a table for one department, one list, one team or both (Status, Project, Contact, Priority, Estimated Completion Date; four rows in view, scrolling four at a time, at most 20); `monday-charts` draws Status by department, Overall progress (estimated hours done over all hours, or task counts if no hours) or a Timeline over three months with a today line.

## 9. Competition, Match13 and news

- **frc-sync** (`computer/scripts/frc-*.sh`) reads The Blue Alliance v3 (events, matches, rankings, alliances, awards, district rankings) and Statbotics v3 (EPA ratings and win probabilities) for the teams in the Team documents (key `frc<number>`) and **replaces** the single document `frc-status`. All addresses and answer paths are in `frc-contract.sh`. Statbotics ratings are kept 12 hours, at most 60 requests a run.
- **Twelve competition cards** (`panels/competition-*`): next match, rank, results, alliance, season timeline, district points, last season, event preview, our matches, event recap, forecast, qualify chances. A Studio setting picks the mode: Auto (from 2 days before an event), Always, Off, or Before and after (a preview from 14 days before, nothing while on, a recap for 7 days after). A Preview competition button shows them on sample data.
- **Match13** forecasts go to `match13.json` in the data folder, never to Sanity, because Match13 marks its answers private. The script is deliberately polite: at most 20 requests a run, ETags so unchanged answers cost a 304, a User-Agent naming the project, and strict handling of 429 (wait as long as asked), server errors (wait an hour) and 401 (wait 6 hours or until the key changes). Only a time, a state and a count go to Sanity (`status-mini`).
- **FIRST news**: `news-sync.sh` reads the community blog RSS (an awk reader), stores headline, link, date and categories only, never body text, in `frc-news`.

## 10. Testing

- `node tests/run.mjs` runs every `tests/**/*.test.mjs` (179 files) three at a time with a 10 minute limit each, plus a syntax check of every shell file. A test is a Node file that exits 0 on pass. `node tests/run.mjs <word>` filters by path. Shell scripts are tested by running them against fake `curl`, `ssh` and the like (`tests/helpers/`).
- **Rule-based motion tests** (`tests/motion/`, Playwright, a laptop-only dependency): they open the dashboard at `?sample=1&clock=fixed`, wrap `Element.animate` to pause every animation and set its time, and check **rules**, not pictures, so a design change does not break them: no text overlap and nothing outside the canvas during a swap, every piece back within 1 px, seams of at most a pixel at 1920 by 1080 and 3840 by 2160, text fits its box with 8 px to spare, only transform, opacity and line drawing animate. Without Playwright they print one skip line.
- **Graphics checks** (`tests/graphics.test.mjs`): every SVG has a `viewBox`, no filters or blur, no embedded picture over 50 KB, unique ids; shared shapes are written once and reused with `<use>`; hex colours appear only in token files.
- **Consistency checks** (`tests/schemas.test.mjs` and others): Studio and dashboard lists agree, the sidebar covers every type, the default rotation matches in two places, the project id matches in both config files. A release install runs the schema check on the incoming tree before switching.
- **Sweep** (`tools/sweep.sh`, run by the pre-push hook) greps every tracked file for banned words (names of software assistants, film and franchise names, credit lines). **Screenshots** (`tools/screenshots.mjs`) draw every panel and each view in each theme and team into `_outputs/screens`.
- The watchdog and mirror tests are timing and process dependent and occasionally flaky.

## 11. Deployment and the ship flow

The owner's Mac runs **Ship Teletraan.app** (`tools/mac/ship.sh`), one window of steps that each stop the run on failure: check the Mac, compare with GitHub (it refuses if GitHub has commits the folder lacks), run the same checks a student can run, commit and push, deploy the hosted Studio (`deployment.appId` in `studio/sanity.cli.js` stops the hostname question), then `teletraan-tool update --yes` copies the tree to the Mini, installs it as the next release and restarts the screen. No password is stored; git, Sanity, SSH and sudo ask in the window, and `--dry-run` shows the plan. Without a Mac, the control page's Update from GitHub does the Mini half from a phone. The screen is black for about ten seconds during the restart. Because the Studio is built on the Mini, an update that changes `studio/package-lock.json` runs `npm ci`, which is slow on this hardware and needs outbound network access.

## 12. Security and privacy decisions

What was decided, and why:

- **Public dataset, no token on the screen.** The screen needs no credentials, so it is safe on any network, and a publish shows within a second or two. The price is that everything in the dataset is world-readable, so the content rules are: first names only, no email addresses, nothing secret in any document. Talk titles and student first names are public, and students are told so.
- **Secrets in one file on one machine**, read through one reader and passed to `curl` on standard input (section 3.4), with redaction of logs as a second line.
- **Write access only from the Mini and the control service.** The write token is an Editor-level Sanity token. The browser never sees it: the Display tab saves through the service.
- **A narrow privileged surface.** The control container cannot run host commands. It speaks to a socket whose handler accepts a fixed word list, behind a sudoers rule limited to `teletraan-*` units, one container restart and a reboot.
- **Network exposure.** The dashboard is bound to loopback. Ports 3229 and 3426 face the WiFi and Tailscale. The control page is behind the PIN and the Studio behind Sanity login. The Sanity project must allow `http://localhost:8080` and `http://teletraan.local:3229` as CORS origins, and the control page checks and reports it.
- **Dependencies.** The dashboard has none, the control service has one vendored file, the Studio has four npm packages (with their trees). Adding any dependency needs the owner's yes, and installing software on the Mini needs the mentor's yes.

## 13. Known limitations and honest risks

These are things a careful reader should know before reusing the design.

1. **Frame time on the real hardware is unproven.** The transitions are heavy (a panel transition has about 245 animated elements, a view transition about 550, in a layer of 4,800 and 11,500 elements). The motion rule allows no frame over 34 ms in the panel transition, but for the view transition it allows **one frame in seven over 34 ms** (none over 100 ms), measured in a headless, software-rendered browser on a development machine at about 22 ms average. `docs/transitions.md` says the Mini "could not be tried here". The sidebar layout's neon kit and the seasonal pieces are also documented as not tested on the Mini. The slow-screen guard (5.9) and calm motion are the safety net, and `?perf` is the instrument (target: 90th percentile under 25 ms).
2. **Integrations were written from documentation and fixtures.** The FRC feed docs state that none of it "has been tried against the live services", and two Statbotics paths were not checked against a live answer. The Match13 script and cards "have not been run on the Teletraan computer". The Monday sync is tested on a recorded real answer of one board (per the latest commit message), but an earlier changelog entry records its API version as not yet tried with the live token. Treat first runs as experiments.
3. **Hardening is a setup step.** The control page PIN, which addresses the ports listen on, GitHub account protection and token scopes are set per computer (`docs/security-review.md` lists the steps). Do them before reusing the design.
4. **Single machine, single point of failure.** One Mini, one disk, no redundancy. The mitigations are the cached content, the watchdog, the nightly restart, rollback among 5 releases, and the fact that the content lives in Sanity.
5. **The control and dashboard code are coupled.** The control service imports from `dashboard/core` (the report cleaner and the display checks). That avoids duplicated rules but means a dashboard refactor can break the control page; `tests/control-display*.test.mjs` exist to catch that.
6. **Duplicated lists.** The Studio cannot import from the dashboard folder, so lists (themes, panels, default rotation, view defaults) exist in two places, held together by tests. A new value must be added in both.
7. **Naming debt.** "Theme", "style", "look", "view", "screen", "team", "pack" and "subtheme" mean different things, and old names survive in stored data (`general` for Robotics, `rotationRows`) because stored names are never renamed.
8. **The delight features are the largest performance risk.** Hidden transitions, seasonal pieces and the neon kit can all be switched off.

## 14. Where the docs and the code disagree

Checked on `1b44659`. The code is right in every case below.

- **Hardware age.** `README.md` says a Mac mini 2014 with Debian 13. `docs/layouts.md`, `docs/seasonal-packs.md` and `docs/transitions.md` say 2011. The code does not say.
- **Competition cards.** `docs/rotation-board.md` ("Automatic panels") lists seven cards. The registry has twelve `competition-*` panels and `docs/frc-feed.md` says twelve.
- **Views.** `docs/views.md` says that until the reform transitions are drawn the screen plays the swap. They are drawn (`core/transition-kinds.js`, `core/reform-*.js`). Its table of what each view starts with also differs from `defaultRotationRows()` in `config-rotation.js`, which is the source of truth and is pinned by a test.
- **Adding a panel.** `docs/adding-a-panel.md` tells the reader to run `node tests/schemas.test.mjs` in the `studio` folder. The test is `tests/schemas.test.mjs` at the repository root. The panel titles shown on the Rotation board also live in `studio/tools/rotation-titles.js`, which that doc does not mention.
- **Themes.** `README.md` says "Three themes" in one place and lists four style folders (original, cybertron, retro, foundry) in another. Four exist; retro is a marked copy of original.
- **Key count.** Several docs say "three keys" (`SANITY_WRITE_TOKEN`, `MONDAY_API_TOKEN`, `TBA_AUTH_KEY`). `control/support/keys.js` knows six, adding `GOOGLE_API_KEY`, `MATCH13_API_KEY` and `SANITY_AUTH_TOKEN`, and `redact.js` hides all of them plus `CONTROL_PIN`.
- **3D.** The original design brief says animation uses no 3D. The swap and the reform transitions use `perspective(...)` and 3D rotations (`core/swap-plan-hawk.js`, `core/reform-plan.js`, `reform.css`). The motion rule still limits animation to transform, opacity and line drawing, and calm motion and the slow-screen guard switch the 3D off.
- **The original brief, in general.** The brief (kept outside the repository) predates the rotation list, the views, the control page and the rebuilt Monday sync. It describes Screen documents, a TASKS/EVENTS/ROSTER sidebar, a configurable Monday tab with column ids and six Monday panels, and a `mini/` folder. The code has one Rotation list, Views, the sidebar in section 6, two fixed Monday boards with two panels, and a `computer/` folder.
- **Hidden transition cadence.** The Studio starts both hidden transitions at about once per 60 hours of screen time with a 4 hour gap (`hiddenGapHours`). The dashboard's own `defaultSettings` start the hours at 0, meaning not set, which falls back to rolling a one percent chance at each page change. A settings document that never went through the Studio therefore behaves differently.

## 15. How to extend

### Add a panel

1. Make `dashboard/panels/<id>/panel.js` and `panel.css`. Export `hasContent(content)` (return false when there is nothing to show, so the rotation skips it) and `mount(host, content)` (write one `<section class="page ...">` into `host`). Use the kit in `core/plate.js` for bars and cards; mark pieces that flip with `data-slat`; write no animation code.
2. Add one line to `dashboard/registry.js` with its `region` and `topic`.
3. Make it choosable: add it to `studio/tools/rotation-titles.js` (the panel groups), and check the lists named in `docs/adding-a-panel.md` section 8.
4. Add a row for it on the Rotation board (or the Display tab). A saved list replaces the default, so a new panel is not on the TV until a row exists.
5. Run `node tests/run.mjs`. The schema test names any list that is missing the panel. Run `npm run deploy` in `studio/` so editors see it. Check text sizes: nothing under 44 px unless a named exception.

### Add a field

1. Add it to the schema in `studio/schemas/<type>.js` with a one-line description and a limit that fits the screen.
2. Add it to the GROQ query in `core/sanity-query.js` and to the normalizer in `core/sanity-*.js` so it is cleaned and defaulted.
3. Use it in the panel. Add a default in `config-settings.js` if it is a setting.
4. Update the CSV template in `docs/content-templates/` if the type has one, and the test that compares lists.
5. Deploy the Studio. Never rename a stored field.

## 16. Glossary

- **Teletraan computer, the Mini**: the Mac mini behind the TV.
- **Panel**: one piece of content in `dashboard/panels/<id>/`. **Region**: banner, countdown, column, grid1 (large), grid2 (small, "Panel B"), ticker, overlay.
- **Row**: one line of the rotation list. **Block**: consecutive rows of one view.
- **View**: Robotics, Prime or Nova. **Layout**: standard, sidebar or bar. **Style / theme**: original, cybertron, foundry or retro. **Pack**: a seasonal overlay. **Subtheme**: dated pictures at fixed anchors. **Team**: Prime or Nova, a Studio document.
- **Swap**: the pull-apart and re-form look change. **Reform**: the panel or view transition. **Hidden transition**: desktop reveal or red eyes.
- **Takeover**: a full-screen alert or announcement. **War clock**: the wide countdown in the bar banner and in Cybertron.
- **Data folder**: `/var/lib/teletraan/data`, shown to the dashboard as `data/live/`. **Contract file**: the script part holding every address, id and answer path of one integration. **Helper**: the socket script that does the few host actions the control page may ask for.
- **Release**: a numbered full copy of the repository; **current** is the live one. **Heartbeat**: the clock the page writes into its title every 30 seconds for the watchdog. **Kiosk**: a browser with no address bar, tabs or menus.
- **BAND, TBA, Match13, Statbotics**: the team calendar app, The Blue Alliance, a forecasting service, and a ratings service. **GROQ**: Sanity's query language; **perspective** is which version of documents a query sees (`published` here).
