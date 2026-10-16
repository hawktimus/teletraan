# Where files moved

Round 6 moved files into the folders of README.md. Every move was made with `git mv`, so `git log --follow <new path>` shows the history of the file under its old path. A move changed nothing in a file except the paths it imports or reads. This page lists every old path and its new one.

A copy of the repository that still has a `deploy/` folder is older than this move. The Mac tool (`tools/mini/teletraan-mini update`) and the Ship app (`tools/mac/ship.sh`) stop with "This copy is older than round 6; update it." and change nothing. The control service and the installer are to do the same when they are written.

## Counts

| Area | Files moved |
|------|-------------|
| deploy/ and deploy/mac (now mini/ and tools/mac/) | 48 |
| Panels (dashboard/panels/<id>/) | 88 |
| Studio (inputs/ and tools/) | 37 |
| Tests (now in tests/) | 105 |

Files that did not move: `dashboard/` outside `panels/`, `studio/schemas/`, `studio/scripts/`, `studio/structure.js`, `studio/sanity.config.js`, `studio/sanity.cli.js`, `studio/project.js`, `studio/package.json`, `docs/`, `tools/screenshots.mjs`, `tools/sweep.sh`, `tools/sweep-words.txt`, `tools/frc-fixture.mjs`, `tools/serve.py`, `tools/icons.html`, `tools/logo.html`, `tools/zones.html`, `tools/perf/`, `tools/package.json` and `tools/mini/`.

## Decisions

- `deploy/nginx.conf` is `mini/nginx/nginx.conf`. The compose file mounts it from there. Every other file of `deploy/` kept its place under `mini/`.
- `local.env` is read from the same relative place as before: the sibling of the scripts' folder, now `mini/local.env`. The patterns of `.gitignore` cover `local.env` anywhere. `mini/build.txt` is ignored like `deploy/build.txt` was.
- The shell variable `deploy` that held that folder is now `mini`, in the scripts and in the tests that quote them.
- Paths written in the unit files are `/opt/teletraan/mini/scripts/...`.
- The refusal looks for `deploy/scripts`, the marker of the old layout, so an empty or ignored leftover `deploy/` folder does not stop anyone. It is in `tools/mini/teletraan-mini` (update only) and in the preflight of every word of `tools/mac/ship.sh`, with a test for each.
- Each panel's script and stylesheet are `panel.js` and `panel.css` in a folder named for the panel. `registry.js` builds those two paths from the id. `dashboard/styles/` and `dashboard/themes/` did not move.
- The Studio has two new folders. `inputs/` holds what an editor sees in a form or a page, the parts files that node can test, and the plain lists that copy the dashboard's (`themes.js`, `previews.js`, `hidden-transitions.js`, `demo-screens.js`, `dashboard-address.js`, `screen-ids.js`, `screen-panels.js`). `tools/` holds Publish all, the Screens map and its first fill (`screen-map.js`, `screen-seed.js`), the request buttons (`screen-requests.js`, `actions.js`) and `add-templates.js`. The schema files are untouched.
- `tests/` has the same depth as `tools/` had, so a test that reads `../dashboard` or `../studio` needed no change. A test file is named for the module it tests, or for the script when it tests a script (`display.test.mjs` for `display.sh`). A test of a script is a Node file that runs the script with fake `curl`, `ssh` and the like in a temporary folder. A `.sh` wrapper would only add a layer, so there is none. `tests/integration.test.mjs` was named for the round that wrote it and has a plain name now.
- `tests/run.mjs` runs every `tests/**/*.test.mjs` except `tests/helpers/` and `tests/data/`, three at a time, and checks `sh -n` and `bash -n` on every shell file under `mini/` and `tools/` as one line. `tools/mac/ship.sh` now runs `node tests/run.mjs` as its one check.
- Before the move the tests were: 94 files (90 `tools/test-*.mjs`, 3 `tools/check-*.mjs`, `studio/check-schemas.mjs`) and 2700 passing checks. After it, the runner reports 94 files and 2702 checks, the two more being the tests of the refusal.

## deploy/ and deploy/mac (now mini/ and tools/mac/)

| Old path | New path |
|----------|----------|
| `deploy/README.md` | `mini/README.md` |
| `deploy/console/shutdown.txt` | `mini/console/shutdown.txt` |
| `deploy/console/startup.txt` | `mini/console/startup.txt` |
| `deploy/docker-compose.yml` | `mini/docker-compose.yml` |
| `deploy/local.example.env` | `mini/local.example.env` |
| `deploy/nginx.conf` | `mini/nginx/nginx.conf` |
| `deploy/scripts/backup-dataset.sh` | `mini/scripts/backup-dataset.sh` |
| `deploy/scripts/calendar-status.mjs` | `mini/scripts/calendar-status.mjs` |
| `deploy/scripts/calendar-status.sh` | `mini/scripts/calendar-status.sh` |
| `deploy/scripts/check-calendars.mjs` | `mini/scripts/check-calendars.mjs` |
| `deploy/scripts/check-calendars.sh` | `mini/scripts/check-calendars.sh` |
| `deploy/scripts/check-connection.sh` | `mini/scripts/check-connection.sh` |
| `deploy/scripts/display.sh` | `mini/scripts/display.sh` |
| `deploy/scripts/fetch-calendars.sh` | `mini/scripts/fetch-calendars.sh` |
| `deploy/scripts/frc-sync.sh` | `mini/scripts/frc-sync.sh` |
| `deploy/scripts/install-backup.sh` | `mini/scripts/install-backup.sh` |
| `deploy/scripts/install-calendars.sh` | `mini/scripts/install-calendars.sh` |
| `deploy/scripts/install-console.sh` | `mini/scripts/install-console.sh` |
| `deploy/scripts/install-frc.sh` | `mini/scripts/install-frc.sh` |
| `deploy/scripts/install-monday.sh` | `mini/scripts/install-monday.sh` |
| `deploy/scripts/install-slides.sh` | `mini/scripts/install-slides.sh` |
| `deploy/scripts/install-timers.sh` | `mini/scripts/install-timers.sh` |
| `deploy/scripts/install-watchdog.sh` | `mini/scripts/install-watchdog.sh` |
| `deploy/scripts/kiosk.sh` | `mini/scripts/kiosk.sh` |
| `deploy/scripts/monday-sync.sh` | `mini/scripts/monday-sync.sh` |
| `deploy/scripts/pull.sh` | `mini/scripts/pull.sh` |
| `deploy/scripts/slides-sync.sh` | `mini/scripts/slides-sync.sh` |
| `deploy/scripts/status-write.sh` | `mini/scripts/status-write.sh` |
| `deploy/scripts/watchdog.sh` | `mini/scripts/watchdog.sh` |
| `deploy/systemd/teletraan-backup.service` | `mini/systemd/teletraan-backup.service` |
| `deploy/systemd/teletraan-backup.timer` | `mini/systemd/teletraan-backup.timer` |
| `deploy/systemd/teletraan-calendars.service` | `mini/systemd/teletraan-calendars.service` |
| `deploy/systemd/teletraan-calendars.timer` | `mini/systemd/teletraan-calendars.timer` |
| `deploy/systemd/teletraan-console.service` | `mini/systemd/teletraan-console.service` |
| `deploy/systemd/teletraan-frc.service` | `mini/systemd/teletraan-frc.service` |
| `deploy/systemd/teletraan-frc.timer` | `mini/systemd/teletraan-frc.timer` |
| `deploy/systemd/teletraan-kiosk.service` | `mini/systemd/teletraan-kiosk.service` |
| `deploy/systemd/teletraan-monday.service` | `mini/systemd/teletraan-monday.service` |
| `deploy/systemd/teletraan-monday.timer` | `mini/systemd/teletraan-monday.timer` |
| `deploy/systemd/teletraan-pull.service` | `mini/systemd/teletraan-pull.service` |
| `deploy/systemd/teletraan-pull.timer` | `mini/systemd/teletraan-pull.timer` |
| `deploy/systemd/teletraan-slides.service` | `mini/systemd/teletraan-slides.service` |
| `deploy/systemd/teletraan-slides.timer` | `mini/systemd/teletraan-slides.timer` |
| `deploy/systemd/teletraan-watchdog.service` | `mini/systemd/teletraan-watchdog.service` |
| `deploy/systemd/teletraan-watchdog.timer` | `mini/systemd/teletraan-watchdog.timer` |
| `deploy/mac/Ship` | `Teletraan.command` |
| `deploy/mac/make-app.sh` | `tools/mac/make-app.sh` |
| `deploy/mac/ship.sh` | `tools/mac/ship.sh` |

## Panels (dashboard/panels/<id>/)

| Old path | New path |
|----------|----------|
| `dashboard/panels/alert/alert.css` | `dashboard/panels/alert/panel.css` |
| `dashboard/panels/alert/alert.js` | `dashboard/panels/alert/panel.js` |
| `dashboard/panels/announcement/announcement.css` | `dashboard/panels/announcement/panel.css` |
| `dashboard/panels/announcement/announcement.js` | `dashboard/panels/announcement/panel.js` |
| `dashboard/panels/banner/banner.css` | `dashboard/panels/banner/panel.css` |
| `dashboard/panels/banner/banner.js` | `dashboard/panels/banner/panel.js` |
| `dashboard/panels/bar-banner/bar-banner.css` | `dashboard/panels/bar-banner/panel.css` |
| `dashboard/panels/bar-banner/bar-banner.js` | `dashboard/panels/bar-banner/panel.js` |
| `dashboard/panels/bar-column/bar-column.css` | `dashboard/panels/bar-column/panel.css` |
| `dashboard/panels/bar-column/bar-column.js` | `dashboard/panels/bar-column/panel.js` |
| `dashboard/panels/competition-alliance/competition-alliance.css` | `dashboard/panels/competition-alliance/panel.css` |
| `dashboard/panels/competition-alliance/competition-alliance.js` | `dashboard/panels/competition-alliance/panel.js` |
| `dashboard/panels/competition-district/competition-district.css` | `dashboard/panels/competition-district/panel.css` |
| `dashboard/panels/competition-district/competition-district.js` | `dashboard/panels/competition-district/panel.js` |
| `dashboard/panels/competition-last-season/competition-last-season.css` | `dashboard/panels/competition-last-season/panel.css` |
| `dashboard/panels/competition-last-season/competition-last-season.js` | `dashboard/panels/competition-last-season/panel.js` |
| `dashboard/panels/competition-next-match/competition-next-match.css` | `dashboard/panels/competition-next-match/panel.css` |
| `dashboard/panels/competition-next-match/competition-next-match.js` | `dashboard/panels/competition-next-match/panel.js` |
| `dashboard/panels/competition-rank/competition-rank.css` | `dashboard/panels/competition-rank/panel.css` |
| `dashboard/panels/competition-rank/competition-rank.js` | `dashboard/panels/competition-rank/panel.js` |
| `dashboard/panels/competition-results/competition-results.css` | `dashboard/panels/competition-results/panel.css` |
| `dashboard/panels/competition-results/competition-results.js` | `dashboard/panels/competition-results/panel.js` |
| `dashboard/panels/competition-timeline/competition-timeline.css` | `dashboard/panels/competition-timeline/panel.css` |
| `dashboard/panels/competition-timeline/competition-timeline.js` | `dashboard/panels/competition-timeline/panel.js` |
| `dashboard/panels/countdown/countdown.css` | `dashboard/panels/countdown/panel.css` |
| `dashboard/panels/countdown/countdown.js` | `dashboard/panels/countdown/panel.js` |
| `dashboard/panels/custom/custom.css` | `dashboard/panels/custom/panel.css` |
| `dashboard/panels/custom/custom.js` | `dashboard/panels/custom/panel.js` |
| `dashboard/panels/events/events.css` | `dashboard/panels/events/panel.css` |
| `dashboard/panels/events/events.js` | `dashboard/panels/events/panel.js` |
| `dashboard/panels/forecast/forecast.css` | `dashboard/panels/forecast/panel.css` |
| `dashboard/panels/forecast/forecast.js` | `dashboard/panels/forecast/panel.js` |
| `dashboard/panels/leadership/leadership.css` | `dashboard/panels/leadership/panel.css` |
| `dashboard/panels/leadership/leadership.js` | `dashboard/panels/leadership/panel.js` |
| `dashboard/panels/monday-board/monday-board.css` | `dashboard/panels/monday-board/panel.css` |
| `dashboard/panels/monday-board/monday-board.js` | `dashboard/panels/monday-board/panel.js` |
| `dashboard/panels/monday-done/monday-done.css` | `dashboard/panels/monday-done/panel.css` |
| `dashboard/panels/monday-done/monday-done.js` | `dashboard/panels/monday-done/panel.js` |
| `dashboard/panels/monday-milestones-both/monday-milestones-both.css` | `dashboard/panels/monday-milestones-both/panel.css` |
| `dashboard/panels/monday-milestones-both/monday-milestones-both.js` | `dashboard/panels/monday-milestones-both/panel.js` |
| `dashboard/panels/monday-milestones/monday-milestones.css` | `dashboard/panels/monday-milestones/panel.css` |
| `dashboard/panels/monday-milestones/monday-milestones.js` | `dashboard/panels/monday-milestones/panel.js` |
| `dashboard/panels/monday-overall/monday-overall.css` | `dashboard/panels/monday-overall/panel.css` |
| `dashboard/panels/monday-overall/monday-overall.js` | `dashboard/panels/monday-overall/panel.js` |
| `dashboard/panels/monday-progress-both/monday-progress-both.css` | `dashboard/panels/monday-progress-both/panel.css` |
| `dashboard/panels/monday-progress-both/monday-progress-both.js` | `dashboard/panels/monday-progress-both/panel.js` |
| `dashboard/panels/monday-progress/monday-progress.css` | `dashboard/panels/monday-progress/panel.css` |
| `dashboard/panels/monday-progress/monday-progress.js` | `dashboard/panels/monday-progress/panel.js` |
| `dashboard/panels/monday-status-depts/monday-status-depts.css` | `dashboard/panels/monday-status-depts/panel.css` |
| `dashboard/panels/monday-status-depts/monday-status-depts.js` | `dashboard/panels/monday-status-depts/panel.js` |
| `dashboard/panels/monday-tasks/monday-tasks.css` | `dashboard/panels/monday-tasks/panel.css` |
| `dashboard/panels/monday-tasks/monday-tasks.js` | `dashboard/panels/monday-tasks/panel.js` |
| `dashboard/panels/monday-timeline/monday-timeline.css` | `dashboard/panels/monday-timeline/panel.css` |
| `dashboard/panels/monday-timeline/monday-timeline.js` | `dashboard/panels/monday-timeline/panel.js` |
| `dashboard/panels/next-event/next-event.css` | `dashboard/panels/next-event/panel.css` |
| `dashboard/panels/next-event/next-event.js` | `dashboard/panels/next-event/panel.js` |
| `dashboard/panels/photo/photo.css` | `dashboard/panels/photo/panel.css` |
| `dashboard/panels/photo/photo.js` | `dashboard/panels/photo/panel.js` |
| `dashboard/panels/roster/roster.css` | `dashboard/panels/roster/panel.css` |
| `dashboard/panels/roster/roster.js` | `dashboard/panels/roster/panel.js` |
| `dashboard/panels/safety-days/safety-days.css` | `dashboard/panels/safety-days/panel.css` |
| `dashboard/panels/safety-days/safety-days.js` | `dashboard/panels/safety-days/panel.js` |
| `dashboard/panels/side/side.css` | `dashboard/panels/side/panel.css` |
| `dashboard/panels/side/side.js` | `dashboard/panels/side/panel.js` |
| `dashboard/panels/sponsor-feature/sponsor-feature.css` | `dashboard/panels/sponsor-feature/panel.css` |
| `dashboard/panels/sponsor-feature/sponsor-feature.js` | `dashboard/panels/sponsor-feature/panel.js` |
| `dashboard/panels/sponsor-logo/sponsor-logo.css` | `dashboard/panels/sponsor-logo/panel.css` |
| `dashboard/panels/sponsor-logo/sponsor-logo.js` | `dashboard/panels/sponsor-logo/panel.js` |
| `dashboard/panels/spotlight/spotlight.css` | `dashboard/panels/spotlight/panel.css` |
| `dashboard/panels/spotlight/spotlight.js` | `dashboard/panels/spotlight/panel.js` |
| `dashboard/panels/stand-in-ticker/stand-in-ticker.css` | `dashboard/panels/stand-in-ticker/panel.css` |
| `dashboard/panels/stand-in-ticker/stand-in-ticker.js` | `dashboard/panels/stand-in-ticker/panel.js` |
| `dashboard/panels/stand-in-tile/stand-in-tile.css` | `dashboard/panels/stand-in-tile/panel.css` |
| `dashboard/panels/stand-in-tile/stand-in-tile.js` | `dashboard/panels/stand-in-tile/panel.js` |
| `dashboard/panels/talk/talk.css` | `dashboard/panels/talk/panel.css` |
| `dashboard/panels/talk/talk.js` | `dashboard/panels/talk/panel.js` |
| `dashboard/panels/task-counts/task-counts.css` | `dashboard/panels/task-counts/panel.css` |
| `dashboard/panels/task-counts/task-counts.js` | `dashboard/panels/task-counts/panel.js` |
| `dashboard/panels/tasks/tasks.css` | `dashboard/panels/tasks/panel.css` |
| `dashboard/panels/tasks/tasks.js` | `dashboard/panels/tasks/panel.js` |
| `dashboard/panels/team-leads/team-leads.css` | `dashboard/panels/team-leads/panel.css` |
| `dashboard/panels/team-leads/team-leads.js` | `dashboard/panels/team-leads/panel.js` |
| `dashboard/panels/team-tile/team-tile.css` | `dashboard/panels/team-tile/panel.css` |
| `dashboard/panels/team-tile/team-tile.js` | `dashboard/panels/team-tile/panel.js` |
| `dashboard/panels/ticker/ticker.css` | `dashboard/panels/ticker/panel.css` |
| `dashboard/panels/ticker/ticker.js` | `dashboard/panels/ticker/panel.js` |
| `dashboard/panels/tonight/tonight.css` | `dashboard/panels/tonight/panel.css` |
| `dashboard/panels/tonight/tonight.js` | `dashboard/panels/tonight/panel.js` |

## Studio (inputs/ and tools/)

| Old path | New path |
|----------|----------|
| `studio/calendars-view-parts.js` | `studio/inputs/calendars-view-parts.js` |
| `studio/calendars-view.js` | `studio/inputs/calendars-view.js` |
| `studio/dashboard-address.js` | `studio/inputs/dashboard-address.js` |
| `studio/demo-screens.js` | `studio/inputs/demo-screens.js` |
| `studio/frc-status-input.js` | `studio/inputs/frc-status-input.js` |
| `studio/hidden-transitions.js` | `studio/inputs/hidden-transitions.js` |
| `studio/monday-boards-parts.js` | `studio/inputs/monday-boards-parts.js` |
| `studio/monday-boards-view.js` | `studio/inputs/monday-boards-view.js` |
| `studio/monday-pickers.js` | `studio/inputs/monday-pickers.js` |
| `studio/monday-status-input.js` | `studio/inputs/monday-status-input.js` |
| `studio/note-field.js` | `studio/inputs/note-field.js` |
| `studio/panel-order-input.js` | `studio/inputs/panel-order-input.js` |
| `studio/panel-preview.js` | `studio/inputs/panel-preview.js` |
| `studio/preview-panels-view.js` | `studio/inputs/preview-panels-view.js` |
| `studio/preview-panels.js` | `studio/inputs/preview-panels.js` |
| `studio/previews.js` | `studio/inputs/previews.js` |
| `studio/row-preview-input.js` | `studio/inputs/row-preview-input.js` |
| `studio/screen-context.js` | `studio/inputs/screen-context.js` |
| `studio/screen-fields.js` | `studio/inputs/screen-fields.js` |
| `studio/screen-ids.js` | `studio/inputs/screen-ids.js` |
| `studio/screen-input.js` | `studio/inputs/screen-input.js` |
| `studio/screen-panels.js` | `studio/inputs/screen-panels.js` |
| `studio/screen-parts.js` | `studio/inputs/screen-parts.js` |
| `studio/show-on-tv-input.js` | `studio/inputs/show-on-tv-input.js` |
| `studio/start-here-parts.js` | `studio/inputs/start-here-parts.js` |
| `studio/start-here.js` | `studio/inputs/start-here.js` |
| `studio/status-input.js` | `studio/inputs/status-input.js` |
| `studio/team-input.js` | `studio/inputs/team-input.js` |
| `studio/themes.js` | `studio/inputs/themes.js` |
| `studio/time-text.js` | `studio/inputs/time-text.js` |
| `studio/actions.js` | `studio/tools/actions.js` |
| `studio/add-templates.js` | `studio/tools/add-templates.js` |
| `studio/publish-all-tool.js` | `studio/tools/publish-all-tool.js` |
| `studio/publish-all.js` | `studio/tools/publish-all.js` |
| `studio/screen-map.js` | `studio/tools/screen-map.js` |
| `studio/screen-requests.js` | `studio/tools/screen-requests.js` |
| `studio/screen-seed.js` | `studio/tools/screen-seed.js` |

## Tests (now in tests/)

| Old path | New path |
|----------|----------|
| `tools/test-backup-script.mjs` | `tests/backup-dataset.test.mjs` |
| `tools/test-blank-team.mjs` | `tests/blank-team.test.mjs` |
| `tools/test-booking.mjs` | `tests/booking.test.mjs` |
| `tools/test-build-version.mjs` | `tests/build-version.test.mjs` |
| `tools/test-calendar-node.mjs` | `tests/calendar-node.test.mjs` |
| `tools/test-calendar-status.mjs` | `tests/calendar-status.test.mjs` |
| `tools/test-calendar.mjs` | `tests/calendar.test.mjs` |
| `tools/test-calendars-hide.mjs` | `tests/calendars-hide.test.mjs` |
| `tools/test-calendars-view.mjs` | `tests/calendars-view.test.mjs` |
| `tools/test-calendars-script.mjs` | `tests/check-calendars.test.mjs` |
| `tools/test-connection-script.mjs` | `tests/check-connection.test.mjs` |
| `tools/check-preview.mjs` | `tests/check-preview.test.mjs` |
| `tools/check-seasons.mjs` | `tests/check-seasons.test.mjs` |
| `tools/check-themes.mjs` | `tests/check-themes.test.mjs` |
| `tools/test-competition.mjs` | `tests/competition.test.mjs` |
| `tools/test-content.mjs` | `tests/content.test.mjs` |
| `tools/test-countdown-title.mjs` | `tests/countdown-title.test.mjs` |
| `tools/test-cybertron.mjs` | `tests/cybertron.test.mjs` |
| `tools/testdata/booking/booking.json` | `tests/data/booking/booking.json` |
| `tools/testdata/daylight-saving.ics` | `tests/data/daylight-saving.ics` |
| `tools/testdata/frc-event-answer.json` | `tests/data/frc-event-answer.json` |
| `tools/testdata/monthly.ics` | `tests/data/monthly.ics` |
| `tools/testdata/odd-input.ics` | `tests/data/odd-input.ics` |
| `tools/testdata/overrides.ics` | `tests/data/overrides.ics` |
| `tools/testdata/single-events.ics` | `tests/data/single-events.ics` |
| `tools/testdata/swap-pieces.json` | `tests/data/swap-pieces.json` |
| `tools/testdata/text.ics` | `tests/data/text.ics` |
| `tools/testdata/weekly.ics` | `tests/data/weekly.ics` |
| `tools/test-kiosk-display.mjs` | `tests/display.test.mjs` |
| `tools/test-effects.mjs` | `tests/effects.test.mjs` |
| `tools/test-event-pages.mjs` | `tests/event-pages.test.mjs` |
| `tools/test-events-scroll.mjs` | `tests/events-scroll.test.mjs` |
| `tools/test-fixed-values.mjs` | `tests/fixed-values.test.mjs` |
| `tools/test-frc-event.mjs` | `tests/frc-event.test.mjs` |
| `tools/test-frc-script.mjs` | `tests/frc-sync.test.mjs` |
| `tools/test-hawk-cadence.mjs` | `tests/hawk-cadence.test.mjs` |
| `tools/monday-world.mjs` | `tests/helpers/monday-world.mjs` |
| `tools/test-hidden-hours.mjs` | `tests/hidden-hours.test.mjs` |
| `tools/test-install-calendars.mjs` | `tests/install-calendars.test.mjs` |
| `tools/test-console.mjs` | `tests/install-console.test.mjs` |
| `tools/test-integration-round5.mjs` | `tests/integration.test.mjs` |
| `tools/test-laptop-docs.mjs` | `tests/laptop-docs.test.mjs` |
| `tools/test-layouts.mjs` | `tests/layouts.test.mjs` |
| `tools/test-lead-photo.mjs` | `tests/lead-photo.test.mjs` |
| `tools/test-leadership-role.mjs` | `tests/leadership-role.test.mjs` |
| `tools/test-look-rotation.mjs` | `tests/look-rotation.test.mjs` |
| `tools/test-minimal.mjs` | `tests/minimal.test.mjs` |
| `tools/test-monday-acceptance.mjs` | `tests/monday-acceptance.test.mjs` |
| `tools/test-monday-boards.mjs` | `tests/monday-boards.test.mjs` |
| `tools/test-monday-cards.mjs` | `tests/monday-cards.test.mjs` |
| `tools/test-monday-docs.mjs` | `tests/monday-docs.test.mjs` |
| `tools/test-monday-fill.mjs` | `tests/monday-fill.test.mjs` |
| `tools/test-monday-panels.mjs` | `tests/monday-panels.test.mjs` |
| `tools/test-monday-rows.mjs` | `tests/monday-rows.test.mjs` |
| `tools/test-monday-rules.mjs` | `tests/monday-rules.test.mjs` |
| `tools/test-monday-settings.mjs` | `tests/monday-settings.test.mjs` |
| `tools/test-monday-style.mjs` | `tests/monday-style.test.mjs` |
| `tools/test-monday-sync.mjs` | `tests/monday-sync.test.mjs` |
| `tools/test-night.mjs` | `tests/night.test.mjs` |
| `tools/test-no-old-code.mjs` | `tests/no-old-code.test.mjs` |
| `tools/test-notice.mjs` | `tests/notice.test.mjs` |
| `tools/test-nova-palette.mjs` | `tests/nova-palette.test.mjs` |
| `tools/test-panel-b.mjs` | `tests/panel-b.test.mjs` |
| `tools/test-panel-order.mjs` | `tests/panel-order.test.mjs` |
| `tools/test-person-rows.mjs` | `tests/person-rows.test.mjs` |
| `tools/test-photo-fit.mjs` | `tests/photo-fit.test.mjs` |
| `tools/test-photo-pages.mjs` | `tests/photo-pages.test.mjs` |
| `tools/test-photo-row.mjs` | `tests/photo-row.test.mjs` |
| `tools/test-pile.mjs` | `tests/pile.test.mjs` |
| `tools/test-plate-edges.mjs` | `tests/plate-edges.test.mjs` |
| `tools/test-portrait-settings.mjs` | `tests/portrait-settings.test.mjs` |
| `tools/test-portrait-size.mjs` | `tests/portrait-size.test.mjs` |
| `tools/test-presentation-mouse.mjs` | `tests/presentation-mouse.test.mjs` |
| `tools/test-presentation.mjs` | `tests/presentation.test.mjs` |
| `tools/test-previews.mjs` | `tests/previews.test.mjs` |
| `tools/test-publish-all.mjs` | `tests/publish-all.test.mjs` |
| `studio/check-schemas.mjs` | `tests/schemas.test.mjs` |
| `tools/test-screen-seed-dashboard.mjs` | `tests/screen-seed-dashboard.test.mjs` |
| `tools/test-screen-seed-parity.mjs` | `tests/screen-seed-parity.test.mjs` |
| `tools/test-screen-seed.mjs` | `tests/screen-seed.test.mjs` |
| `tools/test-screens.mjs` | `tests/screens.test.mjs` |
| `tools/test-screenshots.mjs` | `tests/screenshots.test.mjs` |
| `tools/test-season-timeline.mjs` | `tests/season-timeline.test.mjs` |
| `tools/test-seasons.mjs` | `tests/seasons.test.mjs` |
| `tools/test-ship-script.mjs` | `tests/ship.test.mjs` |
| `tools/test-slides-script.mjs` | `tests/slides-sync.test.mjs` |
| `tools/test-small-foot.mjs` | `tests/small-foot.test.mjs` |
| `tools/test-status-write.mjs` | `tests/status-write.test.mjs` |
| `tools/test-still.mjs` | `tests/still.test.mjs` |
| `tools/test-stripe-foot.mjs` | `tests/stripe-foot.test.mjs` |
| `tools/test-swap-smooth.mjs` | `tests/swap-smooth.test.mjs` |
| `tools/test-swap.mjs` | `tests/swap.test.mjs` |
| `tools/test-sweep.mjs` | `tests/sweep.test.mjs` |
| `tools/test-task-board.mjs` | `tests/task-board.test.mjs` |
| `tools/test-team-colors.mjs` | `tests/team-colors.test.mjs` |
| `tools/test-team-name.mjs` | `tests/team-name.test.mjs` |
| `tools/test-team-trim.mjs` | `tests/team-trim.test.mjs` |
| `tools/test-mini-tool-commands.mjs` | `tests/teletraan-mini-commands.test.mjs` |
| `tools/test-mini-tool.mjs` | `tests/teletraan-mini.test.mjs` |
| `tools/test-templates.mjs` | `tests/templates.test.mjs` |
| `tools/test-themes.mjs` | `tests/themes.test.mjs` |
| `tools/test-tick.mjs` | `tests/tick.test.mjs` |
| `tools/test-title-plate.mjs` | `tests/title-plate.test.mjs` |
| `tools/test-watchdog-script.mjs` | `tests/watchdog.test.mjs` |
| `tools/test-weather.mjs` | `tests/weather.test.mjs` |

## Themes

| Old path | New path |
|----------|----------|
| `dashboard/styles/original.css` | `dashboard/styles/original/theme.css` |
| `dashboard/styles/cybertron.css` | `dashboard/styles/cybertron/theme.css` (its `--style-*` rule is in `tokens.css` beside it) |
| `dashboard/styles/minimal.css` | `dashboard/layouts/bar-minimal.css` |
