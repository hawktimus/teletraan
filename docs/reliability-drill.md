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

## What remains

- With no saved copy and no Sanity at the very first start the placeholder panels (Robot Status, 3D View) show with empty bodies until the first read. They are marked placeholders and belong to the panel lane.
- The watchdog proves the page's JavaScript runs, not that the picture is right. A page that runs but draws wrongly is not restarted.
- After a third restart in an hour the watchdog stops until the next boot. The Sunday reboot (04:10) is the way out if nobody is there.
- The browser reconnects a dropped change stream about every 3 seconds with no backoff. One small request, but it goes on for as long as the network is down.
- A clock set backwards makes a saved weather reading or content copy look newer than it is until the clock catches up.
- `git fetch` in `pull.sh` has no time limit of its own. The 3 minute limit of the unit ends it.
- Not tried on the real Mini: the browser, systemd, Docker, nginx, the real clock and a real network cut. The scripts were read, and the watchdog, pull and the Sanity reader were run against fakes.
