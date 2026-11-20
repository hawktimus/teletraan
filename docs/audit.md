# Teletraan audit, 6 November 2026

Scope: the full repository at commit `06d4a07` (GitHub `Hawktimus/teletraan`, identical to the copy on Jason's Mac at `~/Projects/teletraan-build/teletraan`). Read-only. Five parallel passes (TV page, Mini scripts, Control page, Studio, tests/docs/hygiene), key findings re-verified by hand in the code. The test suite was run on Linux (see Tests).

Severity: **fix now** (wrong on the wall today or a real risk), **next build**, **later**, **won't fix**.

---

## 1. The ten findings that matter most

| # | Finding | Where | Severity |
|---|---|---|---|
| 1 | **Control page PIN defaults to the team numbers 3229 / 3426**, hard-coded and printed in the public repo and docs. Anyone on the school Wi-Fi who reads the repo can sign in, switch Wi-Fi, reboot, publish. The lockout is irrelevant against two known guesses. | `control/lib/auth.js:19`, `docs/control-page.md:319` | fix now |
| 2 | **Transitions are judged against a 60 Hz budget on a 30 Hz TV.** `slowMs: 34` means every frame on the 4K@30 output (33.3 ms) is on the edge; after two "slow" transitions the page permanently drops to Light motion. The Full transitions are probably never seen on the wall. | `dashboard/core/motion.js:31,49-58` | fix now |
| 3 | **Transitions can hang forever when frames stop.** `nextFrame()` and `animation.finished` are awaited with no timeout. If Chromium stops painting (TV off, input switched, GPU reset), the transition stays "running", the rotation clock is held, and the page freezes mid-swap. This is the frozen half-rendered screen. The heartbeat is a `setInterval` writing the page title, so the watchdog sees a healthy page. | `dashboard/core/reform-run.js:128-130`, `reform-light.js:79-88`, `heartbeat.js:28`, `computer/scripts/watchdog.sh:68-89` | fix now |
| 4 | **Display setup runs once at kiosk start.** `set_display` is never re-run when the output disappears and returns, so a TV that was off, or switched inputs, can come back at native 4K with no scaling. Nothing listens for display changes. | `computer/scripts/display.sh:68-70`, `kiosk.sh:144-146` | fix now |
| 5 | **Orange dots after a restart are a design flaw, not a glitch.** The TV's Monday and Band dots come from Sanity status documents written by the Mini (`status-write.sh`), round-tripped through Sanity and back into `content.json`. After a boot the sync service restores the old `lastSuccessAt` stamps, and the Monday/calendar timers are not kicked, so the stamps stay stale for up to 15–30 min. Control's dots read local files and probe Sanity live, so they are green. The two pages answer different questions. The TV Band dot can also never be red: `calendarErrors` is never queried. | `dashboard/core/dots-run.js:35-44`, `sync-status.js`, `computer/scripts/sync-service.mjs:142-147`, `dashboard/core/sanity-query.js:168`, `control/support/status-parts.js:63,170-177` | fix now |
| 6 | **The sync service reads Sanity with no token.** It works only because the dataset is public. The dataset holds student first names, photos, roles, mentor names, and Stuck-task notes. Making it private without first adding a read token to `sync-service.mjs` and `check-connection.sh` blanks the wall. | `computer/scripts/sync-service.mjs:200`, `check-connection.sh:64` | fix now |
| 7 | **`install-timers.sh` re-enables the pull timer that `install.sh` disables.** On the release layout `/opt/teletraan` is not a git checkout, so `pull.sh` fails every 5 min. Two deploy models coexist (in-place `git pull` vs release folders + symlink) and the docs describe both as current. | `computer/scripts/install-timers.sh:75,79`, `computer/install.sh:137` | fix now |
| 8 | **The DNS button sets `1.1.1.1 8.8.8.8`, not `8.8.8.8 8.8.4.4`**, only on the active connection, only when pressed. A Wi-Fi switch writes a fresh profile with DHCP DNS, so moving to `HawktimusDotNet` silently drops the public resolvers. netwatch sees "dns fail" and climbs restart → bounce → reboot, none of which fixes DNS. | `computer/scripts/net-root.sh:197-201,263`, `netwatch.sh:463-478` | fix now |
| 9 | **Release install swallows failures and never rolls back.** After flipping the `current` symlink, a failed kiosk restart or a page that never reports its build is caught and ignored; the four-step flow still shows "Done". Rollback exits the control service before awaiting the helper calls, so the UI shows an error for a flip that succeeded. Neither path runs the unit installers, so systemd units, sudoers and timers stay at the old version after "Update from GitHub". | `control/lib/install.js:421-535` (`.catch(() => {})` at 513,519), `control/routes/releases.js:40-53` | fix now |
| 10 | **Five reboot/restart paths, four partial ledgers, no shared gate.** watchdog (own file), scheduled reboot (`reboot/state.json`), netwatch (writes the same file), remote poller (own file), nightly (no ledger, no uptime check), Control helper (no limit at all). No tight loop is possible today because each has an uptime guard, but a Sunday scheduled reboot at 03:55 can be followed by nightly's 04:10 reboot. | `computer/scripts/nightly.sh:73-79`, `reboot-plan.mjs`, `netwatch.sh:411-449`, `remote-plan.mjs:121-126`, `control-helper.sh:89-110` | next build |

---

## 2. TV page (`dashboard/`)

**Rotation.** Two independent `while(true)` loops (grid 1, grid 2) plus the ticker in `core/schedule-run.js:265-315`. `findNext()` walks the playlist linearly and skips rows whose panel says `hasContent()` is false. Dwell is fixed per row (`pageSeconds`, grid 2 × 0.75, ticker × 1.5), counted in 250 ms ticks rather than wall clock. There are no weights; the only priority is `withCompetition` and `sparesFirst`. `findNext()` is the single place a usefulness score plugs in; `stayFor()` for dynamic dwell; `playableBlocks` in `views-play.js:291-294` for context modes so the block clock agrees.

Panels that play empty today:
- `robotStatus`, `wireframe`, `miniIdea1` placeholders sit in the default rotation four times per cycle and draw dashed boxes (`config-rotation.js:84-89`, `core/placeholder.js:2`). **next build**
- 14 competition cards have no `hasContent`; with mode `off`, `competitionRowMayPlay` returns **true**, so a row naming `competition-rank` shows "There is no rank yet" (`core/competition.js:322`). **next build**
- Photo panel: if every image fails, "NO PHOTO" holds the slot for the full turn (`panels/photo/panel.js:53-62`). **next build**
- Paged panels multiply dwell with no cap: a 10-page Events list at 30 s holds the frame for 5 min while the block clock expires (`schedule-run.js:298-303`). **next build**

**Failure surfaces.** Items 2 and 3 above. No `visibilitychange`/`pageshow` handling anywhere. `guard.js` and `core/busy.js` are sound. Image load has no timeout (`panels/photo/panel.js:93`). The only reloads are fatal-error and version-change; no periodic reload for memory hygiene.

**Data.** Calendar parsing is solid (TZID via `Intl`, DST-safe, COUNT/UNTIL/EXDATE correct). Gaps: floating times use the Mini's zone not the Look zone; unknown TZIDs (Outlook "Eastern Standard Time") fall back silently; **no dedupe**, so one event in two Band calendars shows twice (`core/events.js:152-163`). Monday department matching is exact lowercase against nine fixed words; "Design/CNC" or a trailing space drops the task silently with no count (`core/monday-views.js:50-53,75-77`).

**Performance.** Good hygiene: no blur/filter, 9 static box-shadows, idle art pauses while moving. Cheap wins: the glint animates `stroke-dashoffset` every frame forever (`frame.css:142,153-158`); 39 infinite animations, Neon runs 9 at once, Foundry 6; `decoding="async"` and preload of the current turn's photos.

**Text size.** 24 px in the bar layout countdown (`panels/countdown/panel.css:387,421`) **fix now**; 36 px body text in `base.css:724`, `monday.css:104,177`, monday-charts, competition-timeline, countdown; 40 px task names in `monday-department/panel.css:65` and `monday-projects/panel.css:61`. Chips at 30 and axes at 28 are within the rule.

**Code health.** `frame.css` 1866 lines, `runRotation` 199 lines, config across five `config*.js` files, `general`/`robotics`/`family` are three names for two things with no comment explaining why.

## 3. Mini (`computer/`)

Timers: pull 5 m, calendars 15 m, slides 2 m, monday 5 m (self-gated), frc 5 m, photos 15 m, news 2 h, match13 30 m, heartbeat 5 m, netwatch 2 m, watchdog 2 m, scheduled reboot check 5 m, nightly 04:00 (Sun 04:10), backup 03:15, cleanup 03:40, sync service continuous, remote poller 30 s.

- Kiosk: good crash recovery (Preferences patch, singleton lock removal, cache wipe, `Restart=always`). No memory flags. GPU rasterization forced on an Intel HD 3000 with `KIOSK_GRAPHICS` opt-outs.
- Sync service: atomic temp+rename writes, last good copy kept, every loop wrapped. Shape check before writing `content.json` is only `typeof === 'object'`; an empty answer would blank the wall (`sync-service.mjs:233-238`). `sync-status.json` rewritten every 10 s (8,640 writes/day; fine on SSD, noisy on the 2011 HDD).
- Security: sudoers exact-command, helper word list validated twice, every token via curl `--config -` on stdin, Wi-Fi password stdin-only with umask 077. Gaps: helper output (`network-info`, `wifi-scan`, `monday-debug`) is sent to the Control page unredacted despite the comment claiming otherwise (`control/routes/helper.js:54`); `/tmp/teletraan-monday-force` is mode 666 in shared /tmp; `logs/helper.log` is outside logrotate; dataset backups land in `/var/backups/teletraan` with default 644 (minors' names on disk).
- Robustness: `set -euo pipefail` everywhere, flock where it matters, every curl has `--max-time`. If `/var/lib/teletraan` is missing, the web container refuses to start (`create_host_path: false`) and the screen is black; a `tmpfiles.d` entry would fix it.
- Bash vs Node: ~130 `jq` invocations across monday (~870 lines), frc (6 files), match13 (439 lines), news, status-write (517 lines). Decisions already shell out to Node, so the split is accidental. Folding collectors into the sync service is medium-high effort, medium risk; do it only when touching those collectors anyway.

## 4. Control page (`control/`)

- Status disagreements are structural, not bugs in one line: Control's Sanity dot is "can I reach Sanity now" (green/red only); the TV's is "how fresh is the sync service's read" (green/amber only). Control shows Network "Late" at 1–2 netwatch failures; the TV shows green. After every control restart the Screen dot is amber for ~10 s and the banner says "Needs attention". Fix: both read `sync-status.json` for Sanity and Network; show "control can reach Sanity" as a separate fact; treat "no report yet" as unknown for 30 s.
- Security beyond the PIN: `timingSafeEqual` compare, HMAC cookie, `HttpOnly; SameSite=Strict`, `Secure` only behind HTTPS. Lockout keyed on `X-Real-IP`, so behind a proxy one wrong PIN locks everyone for an hour. Zip handling is solid (traversal, symlinks, size caps, CRC). Publish, rollback and the DNS buttons are confirmed client-side only; the helper words are confirmed server-side.
- UX: action feedback, polling with backoff and Page Visibility, offline banner, 48 px targets, skip link, `<dialog>` confirms are all in place. Legacy tab controls are 44 px. Install-step failures render raw stderr tails in Update, outside Details. No 360 px test.
- Code: two API wrappers, two body readers, two JSON senders, helper word list in two files, `shortCommit` and `versionLabel` duplicated against `dashboard/`. Hard-coded `http://teletraan.local:3229`, `Hawktimus/teletraan`, `main`. The "Studio can reach this page" probe ignores `X-Forwarded-Proto/Host`, so it tests the wrong origin on a tunnel.

## 5. Studio (`studio/`)

- `dashboardSettings`: **131 top-level fields, 273 total, 89 hidden**; 5 tabs and 10 fieldsets; the Advanced tab holds 85 fields, 61 hidden. Every field is fetched, validated and diffed on every edit and every "Play" publish.
- Twelve request objects live inside settings (`previewRequest`, `nextLookRequest`, `competitionPreviewRequest`, `holdPanel`, `holdRow`, `showView`, `previewTheme`, `pauseRotation`, `hideSubtheme`, `announceRequest`, `presentationTestRequest`, `hiddenRequest`), plus Mini-written `rebootStatus`/`miniStatus`. Publishing a stale settings draft (or Publish all) overwrites the Mini's `until` values and clears or re-asserts a hold. Split into `dashboardSettings` (visible fields), `screenRequests` (patched, never published) and `miniState`.
- **No datetime field sets `displayTimeZone`.** Sanity shows the browser's zone with no label. That is how 23:00Z was saved for "noon". Set `America/New_York` on `countdown.kickoff/rollout`, `alert.until`, `presentation.start`, `presentationDay.*`, `expires`; warn when the stored hour is outside 06:00–22:00.
- Hidden fields keep `required()` (`motionOnKiosk`), so a stale document can become unpublishable with no visible reason. `publish.disabled` is never checked, so a Play button on an invalid document silently does nothing.
- Personal data: `person.name` only *warns* on full names, so coach and mentor full names are present. `task.note` carries Monday Stuck notes. `plan.rows[].lead` has no first-name rule. Images on `cdn.sanity.io` stay public even in a private dataset unless the private-asset option is also enabled.
- `studioAddress = '[address of the hosted Studio]'` is a placeholder that renders as dead text on Start here (`start-here-parts.js:76`). `@sanity/icons` is imported in 37 files but not declared. README names two input files that don't exist. `apiVersion` literal repeated 19 times; weekday and time-format lists repeated three times each.

## 6. Tests, docs, hygiene

**Tests.** 239 files, ~98k lines, run 3 at a time with a 600 s cap. Coverage of rotation, DST, Monday labels, calendar filters, remote-action age, PIN lockout, netwatch and watchdog exists and is reasonably deep. Gaps: `calendar-expand.js` DST-shift logic for recurring events has no direct test; `control/lib/multipart.js` (attacker-reachable upload parsing) and `support/http.js` have none. Four fixture-heavy files of 4.8k–6.9k lines assert pixel sizes and exact HTML. Motion tests are silently skipped when Playwright is absent. No test touches the network.

**Result of the run here (Debian container, 15-minute cap):** 213 files passed, then the shell-script tests failed because they spawn `#!/bin/bash` scripts through `/bin/sh`, which is `dash` on Debian (`set -o pipefail` illegal). The suite passes on a Mac because `sh` is bash there. **The suite cannot run on the Mini or on Linux CI as written**, so a release gate on the Mini would fail for the wrong reason. Fix: spawn `bash` explicitly (or the script path with its shebang) in the test helpers, and run `bash -n` not `sh -n` in the syntax check.

**Secrets.** None found. The repo names the school, town, both team numbers, `teletraan.local`, port 3229 and the Control routes. Combined with the default PIN, that is actionable; alone, it is public FRC data. The commit history carries a personal author address.

**Forbidden words.** `tools/sweep.sh` was clean. Its list lacked a number of names of films, shows and AI tools that a student could plausibly paste in; they were added to `tools/sweep-words.txt` in the fix of item 20 and the repository is clean against them. `cybertron` is the theme id in 175 files and is also a franchise name, and `tailscale` appears in 35 files for a product that is not installed. Both are decisions for the owner, not bugs.

**Docs.** `docs/where-things-are.md` points at 14 files that moved to `studio/tools/`. `docs/control-page.md:240-241` are two contradicting paragraphs. `technical-deep-dive.md` pins itself to an old commit. README describes a "Neon Prime" theme that is not in `themeIds`. Four transition docs (1,015 lines) and two Monday docs overlap. `docs/changelog.md` is prose per "round", undated after round 8, with no hashes despite promising them.

**Versioning.** No `VERSION`, no root `package.json`, no git tags. The only counter is the release number in `RELEASE.json`. `docs/reference/` carries 29 MB of generated PNG/HTML in the main tree. `fflate.js` is vendored with its MIT license but no version recorded.

---

## 7. What is right and should stay

Worth saying, because the fix list is long: the local-snapshot architecture is correct and the page never fetches the internet; atomic writes everywhere; secrets never touch argv or logs; sudoers is exact; the Wi-Fi password path is careful; `guard.js` is sound; calendar parsing is better than most; the test culture is real (239 files, a word sweep, house-rule tests for text size and hex colours); Control's action feedback and offline handling are done properly. The problems are coordination (several components computing the same thing differently) and a handful of assumptions (60 Hz, display never changes, dataset is public, deploy is a pull).

## 8. Decisions needed from Jason

1. Keep the `cybertron` theme id? Renaming touches 175 files and the append-only stored-names ledger.
2. Keep `tailscale` references for the designed-not-installed Layer B, or strip them until it is approved?
3. Dataset private (after the read token is added), or stay public and strip notes and full names?
4. Which deploy model is canonical: Control releases (recommended) or in-place `git pull`? The other one should be removed, not left half-disabled.
5. Bar-layout countdown at 24 px: bigger text, or an explicit exception in the rule?

---

## Part A: what was done about each finding

Part A of the build that followed this audit fixed the items below. Where the code at the time of the fix differed from the audit, the code is what the table says. "Already" means the work was done in build 1.1.0 (`CHANGELOG.md`) before this part started.

| # | Item | State |
|---|---|---|
| 1 | The fixed PINs 3229 and 3426 | Done. `CONTROL_PIN` in `local.env` is the only PIN. The installer stops without it and the sign-in screen says "Set a PIN in the settings file". Add the line by hand over SSH before the first update to this build (docs/control-page.md, The PIN). |
| 2 | The sync service reads Sanity with no token | Done. `SANITY_READ_TOKEN`, else `SANITY_WRITE_TOKEN`, else none. The five shell scripts that read Sanity use it through `sanity_curl` in `lib.sh`. Steps to make the dataset private are in docs/OPERATIONS.md. |
| 3 | Helper output, force file, backups, helper log | Done. Output goes through `redactText`, the Monday force file is `monday/force` in the data folder, backups are mode 700 and 600, `logs/*.log` are rotated. |
| 4 | Full names, task notes | Done. A full name for a person or an agenda lead is an error. The Stuck note stays on the computer (`monday/notes.json`) and is not written to Sanity. |
| 5 to 8 | Slow-frame budget, hanging transitions, heartbeat, display recovery | Already (1.1.0). The Playwright test of item 6 was not run, because Playwright is not installed here; the frozen-screen test in `tests/frozen-screen.test.mjs` covers the same paths with a fake frame clock. |
| 9 | The dots | Done. The TV and the control page start from `sync-status.json`; Monday and Band read the local files; a source not yet read is grey for five minutes; the interim `calendarErrors` query was not added, because the dashboard must never ask for the calendar status document (it holds the titles of events a filter hides; `tests/calendar-status.test.mjs`), and the sync service's own failure record gives the Band dot its red instead; the Screen dot is not known for the first 30 seconds. `tests/dots-agree.test.mjs` holds the two to the same colours. |
| 10 | Two deploy models | Not done as written. The owner chose that `git pull` stays the deploy model, so the pull timer is not turned off. Only the part that is true in both models was done: `pull.sh` ends quietly when the folder is not a git checkout. |
| 11 | Update gate, rollback, confirm, units | Done, with two differences. The quick tests run before the switch only when the service has `bash` and `jq`, and say so when they are skipped. The helper word is `units-check`, which compares the units and tells the owner to run Install everything; it does not install them, because a root install of files from a tree the login user can write is a way to root (`tests/units-user.test.mjs`). |
| 12 | Nightly reboot stopgap | Already (the shared gate of 1.1.0). |
| 13 | Version reload during a talk | Already. `takeoverRunning()` is true for an alert, an announcement and a talk, and the version watcher asks it. |
| 14 | DNS as desired state | Done. `computer/config/network.conf`, `teletraan-dns.service`, `dns-apply`, the Wi-Fi switch, the netwatch fallback and restore, `make dns-status`, and a line on Control, Computer. |
| 15 | Rotation defects | Done. Competition Off skips the row; competition cards, placeholders and photos report no content; a photo load times out at 5 seconds; a visit holds at most 3 pages or 90 seconds. |
| 16 | Events and Monday | Done. Events are de-duplicated on UID and start, floating times use the Look zone, tasks with an unknown department are counted in the console. The list in `data-problems.json` is Part B. |
| 17 | Studio | Done. The Eastern options and an odd-hour warning on the datetime fields people type, no `required()` on a hidden field, the Play buttons are off with a reason while the page has an error, one `apiVersion`, `@sanity/icons` declared. The "Studio on the web" line of Start here was removed because its address is not written anywhere in the repository; add it back with the real address. |
| 18 | Text size | Partly. The 36 px and 40 px cases are named in `tests/house-rules.test.mjs`, and the test now also reads `base.css` and `monday.css`. The 24 px labels of the bar layout war clock were not raised: at 44 px each cell needs 200 px instead of 160 and the clock 886 px instead of 766, which no longer fits beside the team name and changes the numbers that `docs/layouts.md` and the layout tests hold. It needs a decision (see the notes of the commit). |
| 19 | Linux | The test helpers now start bash scripts with `/bin/bash`, and the syntax check reads each file with the shell its first line names. The full suite was run on this Mac. It has not been run on Linux yet. |
| 20 | Tests and hygiene | Done. A DST test for repeating events, tests for `multipart.js`, the new words in the sweep list, the docs fixed and dated. The version of `fflate` is not written anywhere in the repository, so the header line says that instead of guessing. |

## Part B: single status source and ingest validation

| Item | State |
|---|---|
| One status source | `sync-status.json` is the one file the TV dots and the control page read, and it now carries the failing health checks (`health`). The Studio status document still gets its words from `status-write.sh`; reading all three from `health.json` alone was not done. |
| Monday every 5 minutes | Done, with a 30 minute gap between 11 pm and 6 am so the daily budget of 900 holds (docs/OPERATIONS.md). The quiet-hours rule was tested only through the settings and the dots, not by a fake clock in `monday-sync.sh`. |
| Ingest validation | Done: `ingest-validate.mjs`, `data-problems.json`, Control under each source, the count in the Studio status document. |
| Required keys, status every 60 s | Done. The status file was already written every 60 seconds. |
| tmpfiles.d | Done (`computer/tmpfiles/teletraan.conf`). |

## Parts C to G: what is built and what is not

| Part | State |
|---|---|
| C, smart rotation | Not built. It is a new scheduler with a panel contract for every panel, and it needs the context modes, a Studio page and screenshots in every theme; it was not started. |
| D, new boards | Not built, apart from one input they need: Key Dates items of the Monday board are marked `deadline` and kept out of the task lists, for the Deadlines board. |
| E, Studio and Control | Partly. The Update button is on Now. Data problems are under each source on Update. The refresh is on Computer. The Dashboard Settings tab split, the `requests` singleton, the screenshot document and the context-mode lines were not built. |
| F, release gate | Partly: the Update runs `node --check` on every dashboard file and the quick tests before the switch, rolls back when the screen does not come up, and shows the reason (Part A). The headless smoke test against the local snapshot and `make release-check` were not built. |
| G, self-healing | The pre-meeting refresh is built (docs/OPERATIONS.md). The invisible page reload with saved state was not built. |
