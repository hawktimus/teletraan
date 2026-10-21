# Reliability drill

What the wall does when something it depends on goes wrong. The screen runs for months on a 2011 Mac Mini, so every row below was tried on purpose. Each case was run in a real browser (Playwright) with the outside answers made by the test, and the scripts of the Mini were read for the same question: what happens when this fails, hangs or runs twice?

The browser cases are in `tests/reliability.test.mjs` (37 cases, skipped when Playwright is not installed). The reader of Sanity is also tested without a browser in `tests/outage.test.mjs`, the pull in `tests/pull.test.mjs` and the watchdog in `tests/watchdog.test.mjs`. Nothing here ran on the real Mini.

"Recovers" means with nobody touching it. "Thrown" means an uncaught error or a console error that is not the logged warning of the case.

## The screen

| Case | What the screen does | Recovers | Thrown or blank |
|------|----------------------|----------|-----------------|
| Sanity unreachable at start, no saved copy | Team name, clock, countdown and the placeholder panels. Red Sanity dot. After 2 minutes the connection text with the reason. | Yes, at the next read (every 30 s) | No |
| Sanity unreachable at start, saved copy | Starts from the copy at once | Yes | No |
| Sanity goes away in the middle of a run | Content stays. Connection text and amber STALE chip on the Monday panels after 2 minutes (was up to 7, see Fixed). | Yes, within 30 s of Sanity coming back | No |
| Sanity answers 500, 403, a login page, half a JSON file, no result, or never answers (given up after 15 s) | Same as unreachable: content kept, reason shown (denied or other) | Yes | No |
| Network switched off and on every 20 s for 4 minutes | Follows it. Heap 10 MB and about 1400 page nodes the whole time, no growth | Yes | No |
| Change stream drops or is refused | Browser tries again about every 3 s (a refusal: after 60 s). The request poll (10 s) and the full read (5 min) cover the gap | Yes | No |
| Saved copy damaged (not JSON, null, a number, an array, wrong types inside) | Ignored, or cleaned. The first read replaces it | Yes | No |
| Browser storage refuses reads and writes, or is full | Runs without a saved copy. Heartbeat title still written | Yes | No |
| Content of unexpected shape: lists of junk, lists that are objects, every section null, every field null, every setting the wrong type | Defaults and the placeholder panels | n/a | No |
| 30000 characters in every text | Text cut with an ellipsis. The 200000 character calendar title too | n/a | No |
| 500 tasks, 300 people, 500 tips, 300 rotation rows of 3 s | Plays through. The saved copy may not fit in storage and is then not kept (logged) | n/a | No |
| Every rotation row has nothing to show | Falls back to the Season panel, not a blank frame | n/a | No |
| Calendar file missing, empty, a web page, cut short, bad dates, an endless repeat, 6000 events | Events panel empty or with the events that parse. A calendar that fails keeps its last events | Yes, at the next read (10 min) | No |
| match13.json missing, garbage, nulls | Forecast panels leave out what they cannot show | Yes, every 10 min | No |
| Slides manifest cut short, failed, 10000 pages, pages that 404 | "Slides are not ready. Ask a coach." or the pictures that load. The clicker still ends the talk | Yes | No |
| Weather service down or odd answer | Dashes. A reading is kept for 2 hours, then dropped | Yes, every 15 min | No |
| Photo address answers 404 or is cut off | The photo is skipped. With none left the panel says NO PHOTO | Yes | No |
| version.txt empty (caught while written) | Ignored (was a reload, see Fixed) | n/a | No |
| Monday data older than twice its interval | Amber STALE chip with the minutes | Yes, at the next sync | No |
| Day rollover at midnight | Theme follows the weekday in place (Monday to Tuesday: original to cybertron) | n/a | No |
| Night mode at 23:30 and 11:30 | Starts and ends on time | n/a | No |
| Clock set back 3 hours, 6 hours asleep, after kickoff, 1970 | Clock, countdown and title follow | n/a | No |
| Alert or talk arrives during a swap | The swap finishes, then the alert or the title card takes the screen | n/a | No |

## The Mini

| Script | Failure handling | Verdict |
|--------|------------------|---------|
| `watchdog.sh` | Restarts on no browser, no page or a title more than 3 minutes old. One restart in 10 minutes, a third in an hour stops until boot. State file written by temporary file and `mv`, and no state means no restart. | Fixed a stamp from the future (below) |
| `pull.sh` | Refuses on a git lock, a merge that cannot fast-forward and now on less than 200 MB free. `TimeoutStartSec=3min` ends a hung fetch. `version.txt` written by `mv`. | Fixed disk space (below) |
| `kiosk.sh` | Waits for the web server (60 s, then systemd starts it again every 10 s), clears stale browser locks, `device.json` and `build.js` written by `mv` | Fine |
| `fetch-calendars.sh` | 60 s and 20 MB limits per feed, keeps the old file unless the new one is a whole calendar, temporary files cleaned after 10 minutes. No lock: a oneshot timer does not overlap itself, and a second run only renames files | Fine |
| `monday-sync.sh`, `frc-sync.sh`, `match13-sync.sh`, `news-sync.sh`, `photos-drive-sync.sh`, `slides-sync.sh` | `flock` so two runs never overlap, curl time limits, work folder inside the data folder so the last `mv` is a rename, a leftover work folder removed at the next run, Monday limited to 900 reads a day | Fine |
| `backup-dataset.sh` | Writes `.partial`, checks it with `gzip -t` and the first line, so a bad export never replaces a good one. Keeps 14. 1 hour limit | Fine |
| `nightly.sh` | Skips when a talk is near. When Sanity cannot be asked it goes ahead | Fine |
| systemd units | Every oneshot has `TimeoutStartSec`. Timers use `OnUnitActiveSec`, so a clock jump cannot start a burst of runs | Fine |

## Fixed

- A mid-run outage was noticed late. The 10 second request poll failed silently and the full read comes every 5 minutes, so the connection text and the Monday STALE chip came up to 7 minutes after Sanity went away. A failed poll now asks for a full read when the last one worked and is over a minute old (`dashboard/core/content-source.js`). `tests/outage.test.mjs`.
- A saved copy that was an array counted as a copy. It is now ignored.
- An empty `version.txt` reloaded the wall. It is now ignored (`dashboard/shell-extras.js`).
- The watchdog could hold every restart off. A restart stamped after the current time (the Mini boots with a wrong clock, then sets it back) made "restarted a moment ago" true until the clock caught up. Such stamps are dropped (`computer/scripts/watchdog.sh`, test in `tests/watchdog.test.mjs`).
- `pull.sh` could run a merge on a full disk, which stops half way and leaves a mix of old and new files. It stops below 200 MB free and says why (`tests/pull.test.mjs`).

## A white flash on the TV

The owner sees the wall flash white for a split second, now and then, with no animation to blame. Each cause was checked in the code. The page itself was also played in a real browser (Playwright, sample content, a screencast of every painted frame at the size of the window, frames counted when over half of their pixels are near white): 150 seconds of steady running, 90 seconds each with the desktop reveal and the red eyes forced, and six page loads, with no white frame and no page load during the run. That says the dashboard does not paint white by itself in that browser. It does not say what the 2011 graphics chip does, which could not be tried here.

| Candidate | Verdict |
|-----------|---------|
| Page reload from the version check (`shell-extras.js`) | Only when `version.txt` changes to another non-empty text, which is a deploy. An error answer, an empty file and a failed fetch do nothing (tested in `tests/flash.test.mjs`). Not a random cause. |
| Reload when the page could not start (`index.html`, 25 seconds; `showFatal`, 30 seconds) | Only after a start that failed. On a slow computer a start over 25 seconds would trigger it, once, at boot. |
| Reload for a layout change (`layout-apply.js`) | Only when changing the layout live threw an error, and once per layout. |
| Meta refresh, service worker, cache API, navigation by script | None exist (tested). |
| Watchdog (`watchdog.sh`), nightly restart, `restart-kiosk` from the control page or an install | Restart the browser: the screen goes black and then draws again, at most once in 10 minutes for the watchdog, at 04:00 for the nightly job. They are logged (`journalctl -u teletraan-watchdog`). Cannot be "frequent and random" unless the log says so. |
| `device.json` every 60 s | Writes a file and runs `hostname`, `ip` and `tailscale`. No `xrandr` and no browser contact. Not a cause. `xrandr` runs once, at the start (`display.sh`). |
| Live preview of the control page (`mirror.py`) | Likely cause while someone has the preview open. It took a PNG with `Page.captureScreenshot` (with a clip and a scale) at the start and every 30 seconds, and fell back to a screenshot 4 times a second. A screenshot makes the browser draw the page again. Fixed: with a screencast that works there is no screenshot at all, the fallback is 1 a second, and the probe runs only in the fallback. It runs only while the preview tab is open: the control page renews a watch file every 30 seconds and the script stops 120 seconds after the last renewal (30 minutes at most). Nothing starts it without a person. |
| Page paint: no background before the stylesheets | The 35 stylesheets block the first paint, so no white was seen in the tests. But `index.html` swapped the `href` of every stylesheet to the build number after the page began, and a changed `href` takes the old style off until the new file loads. Fixed: a copy is added and the old sheet goes when the copy has loaded. A dark `color-scheme` and an inline `html, body` background in the head cover any moment with no style. |
| Hidden transitions, subthemes, announcements, night mode, stale chip, fonts | Played in the browser run above with no white frame. Fonts use `font-display: block`, so text is held back, not drawn in a white fallback. |
| Chromium and the graphics chip (`kiosk.sh`) | Not provable here, and the most likely cause of a short random white flash left. `--ignore-gpu-blocklist --enable-gpu-rasterization` force the 2011 chip to draw although the browser lists it as unreliable. When the graphics process dies the browser starts it again, and the window is white until it has redrawn. |

### Page loads recorded

The page writes down each load and why (`dashboard/core/page-loads.js`): in localStorage (the last 100) and in the report to the control page every 10 seconds. The Log tab of the control page starts with `Page loads in the last 24 hours: n, last reason: ...`, and the control log has a line `wall page load at ...` for each one. Reasons: `a new version was installed`, `the page could not start`, `the layout changed and could not be changed live`, `the browser started or opened the page` (also after a restart of the screen) and `reloaded from outside the page (no reason was written down)`. The next time the TV flashes: if the count did not go up, the page did not reload and the cause is the browser or the graphics.

### Checklist on the Teletraan computer

1. Note the time of the next flash. Open the Log tab of the control page: did the page load count go up, and does the control log have a `wall page load` line at that time?
2. Was the Live preview open on a phone or laptop at that time? Close the tab and watch for an hour.
3. `journalctl -u teletraan-kiosk --since "1 hour ago" | grep -i "gpu\|exited\|crash\|lost"`. A line such as `GPU process exited unexpectedly` is the browser starting its graphics again (the kiosk script now sends the browser's errors to the journal).
4. `journalctl -u teletraan-watchdog --since today` and `journalctl -u teletraan-nightly --since today`: any restart at that time?
5. If step 3 found graphics lines: add `KIOSK_GRAPHICS=plain` to `local.env`, restart the screen, and watch a day. If the flash goes on, `KIOSK_GRAPHICS=software` (the processor draws everything, so check `?perf` for late frames). Remove the line to go back.
6. `dmesg | grep -i "i915\|drm\|gpu"` for resets of the graphics driver at the time of the flash. A TV that loses its signal for a moment (cable, HDMI handshake, TV input switching) looks the same as a flash: try another cable or port.

## The network goes away when idle

The owner's TV shows the red banner SANITY UNREACHABLE: NETWORK DOWN most days after sitting idle. The cause is not known; the Wi-Fi chip sleeping, the driver dropping, the lease, NetworkManager giving up after 4 tries and a suspended computer are all possible, and docs/network.md lists the commands that find out which. What the system does about it:

| Case | What happens | Recovers | Tested |
|------|--------------|----------|--------|
| Network gone for 30 minutes on the page | Banner after 2 minutes. After 10 minutes down and one repair step, the extra line: The Teletraan computer is trying to fix this by itself (from `device.json`). Content stays. | Yes, within 35 seconds of the network returning (a read every 30 seconds after a failure), no page reload | `tests/reliability.test.mjs`, with the clock moved in 35 second jumps |
| Network gone for 6 minutes on the computer | 3 failed checks, then one repair step at a time: dhcp, reconnect, service, screen, and a reboot only after 30 minutes | Usually at step 1 to 3 | `tests/network-watchdog.test.mjs` |
| Network gone for 14 hours | Steps 1 to 4 once each, a reboot at most every 6 hours, never in the first 10 minutes after boot, never within 6 hours of the scheduled reboot | When the network returns, which clears the count | the same |
| Drops again within 30 minutes | The steps that ran less than 30 minutes ago are skipped | Yes | the same |
| Sanity answers with an error page | Counts as a working network, nothing is repaired | n/a | the same |
| Certificate refused but the gateway and lookup work | Treated as a wrong clock, not a network fault | n/a | the same |
| The sudo rule is missing | The step is logged as failed and counted as taken, so it does not repeat | n/a | the same |
| The run is cut between disconnect and connect | A marker file makes the next run connect the interface | Yes | read, not run |

Limits: the watchdog cannot know about a booked talk, because Sanity cannot be asked while the network is down, so step 4 or 5 can restart the screen during a talk after 6 minutes of no network. A restart of NetworkManager can reset the connection for a second or two. `connection.autoconnect-retries = 0` and `ipv4.dhcp-timeout = 2147483647` were written from the NetworkManager manual and not tried on the computer.

## What remains

- With no saved copy and no Sanity at the very first start the placeholder panels (Robot Status, 3D View) show with empty bodies until the first read. They are marked placeholders and belong to the panel lane.
- The watchdog proves the page's JavaScript runs, not that the picture is right. A page that runs but draws wrongly is not restarted.
- After a third restart in an hour the watchdog stops until the next boot. The Sunday reboot (04:10) is the way out if nobody is there.
- The browser reconnects a dropped change stream about every 3 seconds with no backoff. One small request, but it goes on for as long as the network is down.
- A clock set backwards makes a saved weather reading or content copy look newer than it is until the clock catches up.
- `git fetch` in `pull.sh` has no time limit of its own. The 3 minute limit of the unit ends it.
- Not tried on the real Mini: the browser, systemd, Docker, nginx, the real clock and a real network cut. The scripts were read, and the watchdog, pull and the Sanity reader were run against fakes.
