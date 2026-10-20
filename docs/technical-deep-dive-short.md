# Teletraan I: executive summary

This summarizes the `main` branch as of commit `1b44659`. The full account, with file names, constants and the places where the docs and the code disagree, is in `docs/technical-deep-dive.md`.

## What it is

Teletraan I is the always-on wall dashboard of FRC Teams 3229 (Hawktimus Prime) and 3426 (Hawktimus Nova) at Holly Springs High School. It runs on a 70 inch TV, read from across the room, so the picture is a fixed 1920 by 1080 canvas that is scaled to the window and never reflows. It shows the clock, countdown, agenda, events, tasks by department, leadership, sponsors, photos, weather, competition status and a ticker. It can take over the whole screen for an alert, a timed announcement or a student's booked talk with slides.

## The shape of the system

- **A hosted content database.** About ten people edit in Sanity Studio and press Publish all. The screen reads the published documents over HTTPS, listens to Sanity's live change stream and polls every 5 minutes. Every good read is cached in the browser, so an outage leaves the last content on screen, and the screen admits it is offline only after 2 minutes of failures.
- **A small Linux computer behind the TV.** A Mac mini running Debian 13 starts Chromium in kiosk mode, with two containers beside it: nginx (the dashboard files and a copy of the Studio) and a Node service (the control page). About a dozen systemd timers run shell scripts that fetch what the screen cannot.
- **No secrets on the screen.** The dashboard has no credentials. The Mini holds every key in one file (`local.env`, mode 600, never committed) and turns private data into public-safe documents or local files first.

## Where the data comes from

| Source | Via | Cadence |
|---|---|---|
| Studio content | The dashboard directly | Live stream, plus every 5 min |
| BAND calendars (iCal) | Script to local files | Every 15 min |
| Monday.com, two fixed boards | Script writes task documents | Reads every 30 min by default |
| The Blue Alliance, Statbotics | Script writes one status document | About hourly, about 5 min during an event |
| Match13 forecasts | Script to a local file only | Every 30 min near an event |
| Weather | The page asks Open-Meteo, no key | Every 15 min |

The Sanity dataset and the GitHub repository are public, so the rules are strict: first names only, no emails, no key in any document, calendar addresses and tokens only in `local.env`, and redacted logs.

## Design choices worth noticing

- **No framework, build step or dependency in the dashboard.** About 35,000 lines of plain HTML, CSS and ES modules, one folder per panel, one registry file, because the student maintainers know Java and not the web.
- **All animation in one module, with hard rules.** Panels contain no animation code, and only transform, opacity and line drawing may animate. Browser tests pause every animation and check rules (no overlap, nothing off the canvas, every piece back in place) rather than comparing pictures.
- **Graceful degradation.** Calm and no-motion modes, a guard that skips transitions when the median frame time passes 40 ms, error isolation at startup, and automatic retry if a core file fails to load.
- **Rotation as data.** One ordered list of rows (view, panel, seconds, shown) says what the main panel plays. Views pick the team, layout and mirror; styles, seasonal packs and dated picture layers sit on top without forking the base CSS.
- **Operations built for neglect.** Each update is a numbered release with an atomic symlink switch and rollback across five. A watchdog reads a heartbeat the page writes into its own title and restarts a frozen browser, with limits so a bad deploy cannot loop. There are nightly restarts and backups, and a phone-friendly control page with a PIN, a live preview and update-from-GitHub.
- **Narrow privilege.** The control container cannot run host commands. It sends one word at a time to a socket whose handler accepts a fixed list, behind a sudoers rule limited to the project's own units.

## Tested and shipped

`node tests/run.mjs` runs about 180 test files and a syntax check of every shell script, using fake `curl` and `ssh`. Motion tests need Playwright on a laptop and skip themselves without it. One Mac app checks, commits, pushes, deploys the Studio, copies the release to the Mini and restarts the screen.

## Honest risks

1. **Performance on the real Mini is unproven.** The view transition is allowed one frame in seven over 34 ms in the headless test, and the docs say the Mini could not be tried. The slow-screen guard and calm motion are the safety net.
2. **Several integrations came from documentation and recorded answers.** The competition feed and Match13 have not run against live services on the Mini.
3. **Hardening is a setup step.** The control page PIN, which addresses the ports listen on, GitHub account protection and token scopes are set per computer (`docs/security-review.md`).
4. **One machine, local backups.** Nightly exports stay on the Mini's disk and exclude images, and there is one Mini, so the cached content, the watchdog and the rollback among five releases are the safety net.
