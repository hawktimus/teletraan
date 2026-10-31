# Control page inventory

Every control, display and behavior of the control page before the round 8 redesign, what is behind it, who needs it, and where it is now. The page has five areas: Now, Show, Update, Computer, Details (`docs/control-page.md`). A row is ticked in the Done column when the control exists in its new place and was tried: by `tests/control-areas-page.test.mjs` and `tests/control-tabs.test.mjs` for the page, and by the older `tests/control-*.test.mjs` for the routes and the Display, Content and Settings cards, which were moved and not rewritten.

Who: C is a coach, S is a student, M is the mentor or the person at the computer.

The API changes of this round are all additions: `GET overview`, `GET remote-last`, a `Secure` flag on the cookie over HTTPS, `mondayError` and `calendarErrors` in `GET status`, and `X-Forwarded-Host` accepted by the same-origin check. No endpoint, helper word or response field was renamed or removed.

## Where the functions that fit no area cleanly went

| Function | Where | Why |
|---|---|---|
| Photos upload, Announcements, Roster editing, Ticker and news, Calendar hide rules | Show, one section each | They are what the TV says, so they sit with what the TV plays. |
| Competition data | Update, Competition data | It is a read of an outside source, like Sync. |
| Monday check (Check the token, Monday debug) | Update, Monday check | It is about the Monday read. |
| Keys | Update, Keys | A source that stops working is usually a key or a link, and Update is where a source is fixed. |
| Screen fit | Computer, Screen fit | It is about the screen of the computer. |
| Clean up expired items | Computer, Clean up | It runs on the computer at night. |
| All settings | Details, All settings | A long editor for every Studio setting, for coaches. |
| Logs, health, last reads | Details | Raw text. |

## Status (the old Status tab)

| Control or behavior | What it does | API call or helper | Who | New location | Done |
|---|---|---|---|---|---|
| Held line ("Following the schedule." or who decides) | Says whether a request holds the TV | `GET request` | C S | Show, On the TV, top | [x] |
| Now on the wall card | Build, view, theme, layout, panel, team, page, hold, age of the report, rows on screen; refreshed every 10 s | `GET now`, `GET request` | C S | Show, On the TV; a one line version on Now | [x] |
| Live preview, Show live preview, the same button hides it | A moving picture of the TV, or a still copy that follows its report | `POST mirror/watch`, `GET mirror/status`, `/mirror/` pictures | C S | Show, On the TV | [x] |
| Where to change things links | Three links to Display, Content, Settings | none | S | Replaced by the five areas | [x] |
| Health block: release, earlier releases, screen, display, page loads, restarts, uptime, disk, memory, temperature, network, Sanity, Studio CORS, tunnel address, last errors | Read only health of the computer | `GET status`, `GET now` | C M | Details, Health | [x] |
| Status dots (Monday, Band, Sanity) with reasons | The three dots of the TV with the reason | `GET status` | C | Now, five dots (Network and Screen added); the old three with reasons in Details, Health | [x] |
| Last reads (content, calendars, slides, Monday, competition, news, Match13, Drive photos, screen started, backup) | When each source was last read | `GET status` | C | Details, Health; the sources with their last good time on Update, Sync | [x] |
| What do I do here? note, Got it, Help in the header | A note for each area, kept per browser | browser storage | S | Same, one note for each of the five areas | [x] |
| Auto-refresh 10 s (now) and 30 s (health) | Redraws only when the words changed | polling | all | Now: `GET overview` every 10 s while visible, paused when hidden, with backoff; Details, Health every 30 s | [x] |

## Display (the old Display tab)

| Control or behavior | What it does | API call or helper | Who | New location | Done |
|---|---|---|---|---|---|
| Pushed now strip | Shows the pushes that hold the TV and ends one | `GET push`, `POST push/cancel` | C S | Show, On the TV | [x] |
| On the wall now card: status line, Pause, Resume, Next, Back to schedule, Reset | Moves the rotation | `POST request`, `POST push`, `POST push/reset` | C S | Show, On the TV | [x] |
| Show on the wall (view, panel, panel menus, hold length) | Holds a view or a panel for 1 to 60 minutes | `POST push` | C S | Show, On the TV | [x] |
| Theme card, Switch to this theme | Holds a theme for 1 to 60 minutes | `POST push` | C S | Show, On the TV | [x] |
| Announce and effects: announcement, Play announcement, Post announcement, messages, Run presentation test, hidden transitions | Short pushes | `POST push`, `POST request` | C | Show, On the TV (More tools) | [x] |
| Preview a theme or a view, the large picture, the small picture of a row, Preview the selected row instead, Show the picture | Pictures of what a row would draw; changes nothing | the dashboard in a frame | C S | Show, On the TV | [x] |
| Rotation rows: view, panel, seconds, Show on screen, team, department, list, chart, photo count, seconds per photo | The loop the TV plays | `GET display`, `POST display/save` | C | Show, On the TV | [x] |
| Row buttons: Up, Down, Delete, Copy, Add row at the end, Fill from the standard order (press twice), Edit the rotation | Edits the list on the page | none until saved | C | Show, On the TV | [x] |
| Themes by weekday, general view title, transition seconds | The theme of each day | `POST display/save` | C | Show, On the TV | [x] |
| Motion (full or calm) | How much the TV moves | `POST display/save` | C | Show, On the TV (More tools) | [x] |
| Quick hide buttons (every Nova row, every row of a panel) | Flips Show on screen for many rows | page only until saved | C | Show, On the TV (More tools) | [x] |
| Save bar: Save to draft, Publish to the wall, Refresh from Sanity, Undo, unsaved count | One bar for every draft | `POST display/save`, `POST display/publish`, `GET display` | C | Show, On the TV; the same bar on every page that saves a draft | [x] |
| Revision check and the Studio has a newer copy card (Replace, Refresh, Keep editing) | Catches a change made in the Studio meanwhile | `GET display/rev`, `POST display/check` | C | Show, On the TV | [x] |
| Next, Pause and Reset bar fixed above the bottom bar on a phone | Thumb reach | none | C S | Show, On the TV, above the navigation bar | [x] |
| Subtheme | There is no control for it on the old page: subthemes are dated layers set in the Studio | none | C | Not a control. The page does not show it, as before | [x] |

## Content (the old Content tab)

| Control or behavior | What it does | API call or helper | Who | New location | Done |
|---|---|---|---|---|---|
| Ticker and news: add, edit, Hide, Show, Up, Down, Delete, counter against the Studio limit, preview, FRC news hide | Tips, news and reminders | `GET docs/:type`, `POST docs/:type`, `POST docs/:type/:id/save`, `/publish`, `/delete`, `GET content/news` | C S | Show, Ticker and news | [x] |
| Calendar: events by day, Hide, switch of a calendar, publish | Hide rules for BAND events | `GET content/calendar`, `POST content/calendar/switch`, `POST content/calendar/publish` | C | Show, Calendar | [x] |
| Roster: list by team and role, counts, filter, search, edit existing people, Hide, Delete, team lead members | Editing of existing people (first names only) | `GET content/people`, `GET docs/:type`, `POST docs/:type/:id/save` | C S | Show, Roster | [x] |
| Announcements: live, waiting and over chips, Post now | The bar under the banner | `POST content/announcement/post`, `POST docs/:type` | C S | Show, Announcements | [x] |
| Photos: Add photo (upload), credit, caption, expiry, fit, Hide, Delete | Photo documents | `POST photo-upload`, `GET content/photo-source`, `POST docs/:type/:id/save` | C S | Show, Photos | [x] |
| Blocks fold, one open at a time on a phone | Layout | none | S | Each block is a section of Show with its own address | [x] |

## Settings (the old Settings tab)

| Control or behavior | What it does | API call or helper | Who | New location | Done |
|---|---|---|---|---|---|
| Update from GitHub, Check again | Installs the newest version, steps shown | `GET github/latest`, `POST github/update` | C M | Update, Publish (asks first, names the dark time) | [x] |
| From a folder: Pick the repository folder, note, Push to the wall | Zips the folder in the page, uploads, installs | `POST releases` | C M | Update, Publish (asks first) | [x] |
| Roll back, Switch to this version | Activates an older release | `GET releases`, `POST releases/:n/activate` | C M | Update, Publish (asks first) | [x] |
| On the wall: v14 line in the header | The release that runs | `GET releases` | all | Header, and Update, Publish (current and previous release) | [x] |
| Push with git (optional): remote, push and clone lines | The git path | `GET update-info` | M | Computer, Copy project (guided steps) | [x] |
| Keys: set or clear a key, calendar names and links, PIN shown as fixed | Writes `local.env` through the helper | `GET env`, `POST env` | C M | Update, Keys | [x] |
| Monitor Monday: Check the token, Monday debug with a board number | Asks Monday | `POST helper/monday-check`, `POST helper/monday-debug` | C M | Update, Monday check | [x] |
| Sync all and the chips for which syncs it runs | Runs the syncs in order, one failing does not stop the others | `POST sync-all`, `POST helper/sync-now` | C S M | Now (Sync everything), Update, Sync (Sync everything and a switch on each source) | [x] |
| Per source Sync now: calendars, Monday, competition, FRC news, Match13, Drive photos | One sync | `POST helper/sync-now` with a target | C S M | Update, Sync, a card for each source | [x] |
| Per source Ran, Failed, Skipped lines | The result of each sync | answer of `sync-all` | C | Update, Sync (list under Sync everything, the chip and the last result on each card) | [x] |
| Check the network now | Prints the connection and what the watchdog did | `POST helper/network-info` | C M | Computer, Network (the report in Details, Action output) | [x] |
| Restart screen | Restarts the kiosk, asked first (10 s countdown) | `POST helper/restart-kiosk` | C M | Now and Computer, Restart the dashboard (asks, says 30 seconds) | [x] |
| Restart services | Restarts the web server, sync service and timers | `POST helper/restart-services` | C M | Computer, Restart services (asks) | [x] |
| Reboot the computer | Reboots | `POST helper/reboot` | M | Computer, Reboot the computer (asks) | [x] |
| Competition data: Read again | Reads the FRC feed | `POST helper/sync-now` frc | C | Update, Competition data; also a card in Update, Sync | [x] |
| Screen: Fit the dashboard to the screen, by hand, presets, Reset to Auto | Sets how the picture fills the TV window | `GET docs`, `POST doc/:id/save`, `POST doc/:id/publish` | M | Computer, Screen fit | [x] |
| Scheduled reboot: switch, days, time, wait, save, publish | When the computer restarts itself | `GET reboot`, `POST reboot/save`, `POST reboot/publish` | C M | Computer, Scheduled reboot | [x] |
| Clean up expired items: switch, days, mode, Show what would be deleted now, Delete | Nightly clean up | `GET cleanup`, `POST cleanup/preview`, `/save`, `/publish`, `/delete` | C | Computer, Clean up | [x] |
| Logs: Verbose, Refresh, Download the verbose log | The control and helper logs | `GET log`, `GET log/download` | C M | Details, Logs | [x] |
| All settings: every Studio setting, drawn from the Studio schemas | Edit and publish any setting | `GET spec`, `GET doc/:id`, `POST doc/:id/save`, `POST doc/:id/publish` | C | Details, All settings | [x] |
| One section open at a time on a phone | Layout | none | S | Each section has its own address | [x] |

## Header, shell and sign-in

| Control or behavior | What it does | API call or helper | Who | New location | Done |
|---|---|---|---|---|---|
| Four tab buttons, bottom bar on a phone | Navigation | hash | all | Five links: bottom bar on a phone, sidebar from 900 px; one address for each area and section | [x] |
| Arrow keys, Home and End between tabs | Keyboard | none | all | Replaced by ordinary links: Tab and Enter | [x] |
| Old addresses (`#status`, `#display`, `#content/...`, `#settings/...`, `#keys`, `#reboot`...) | Bookmarks | hash | all | Still land in the right area and section | [x] |
| Help button | Brings every note back | browser storage | S | Header | [x] |
| Studio button | Opens the Studio in a new tab | link | all | Header, a relative link | [x] |
| Theme button | New: System, Light or Dark, remembered | browser storage | all | Header | [x] |
| Loading line, noscript text, "could not load" line | First paint and failure | none | all | Same | [x] |
| Sign-in form, PIN field, wrong PIN message | Asks for the PIN | `GET session`, `POST login` | all | Sign-in screen: the tries left, a countdown when blocked | [x] |
| Cookie (30 days, HttpOnly, SameSite Strict, Path /control), two fixed PINs or `CONTROL_PIN` | Session | `lib/auth.js` | all | Unchanged; `Secure` added over HTTPS | [x] |
| Lockout: six wrong tries in ten minutes block an address for an hour, kept across restarts | Slows a guess | `lib/auth.js` | M | Unchanged; the sign-in screen says how long | [x] |
| A 401 sends the page back to the sign-in form | Session ended | all calls | all | Same | [x] |
| Dashboard report (`POST now`, local only) | The TV reports what it shows every 10 s | `POST now` | M | Unchanged | [x] |
| Error texts: "could not be reached", "Enter the PIN first", "not answering" | What a failed call says | `tabs/api.js` | all | Same words; the private tunnel name replaces the product name | [x] |

## New in round 8

| Control or behavior | What it does | API call or helper | Who | Where | Done |
|---|---|---|---|---|---|
| Status banner (All good, Needs attention, count, time of last check) | One line for everything | `GET overview` | all | Now | [x] |
| Five dots (Sanity, Monday, Band, Network, Screen), each opens its facts | Which source is the problem | `GET overview` | all | Now | [x] |
| Sync everything, Refresh the screen, Restart the dashboard | The three large buttons | `POST helper/sync-now`, `POST push/reset`, `POST helper/restart-kiosk` | all | Now | [x] |
| Attention list with a plain sentence, what the TV still shows, a safe fix and Show details | Failures in plain words | `GET overview`, `control/static/words.js` | all | Now | [x] |
| Last remote action | The last thing done from the Studio | `GET remote-last` (`remote-last.json`) | C M | Now and Computer, Restart | [x] |
| Last action of this page | The last result of any button, kept per browser | browser storage | all | Now and Computer, Restart | [x] |
| Can't reach the computer banner with the last known status and time, backoff 10, 20, 40, 60 s | The computer is away | `GET overview` fails | all | Every area | [x] |
| Action output | The technical text of every button, 40 entries in this browser | none | C M | Details, Action output | [x] |
| Sticky Sync everything on a phone | Reach | none | all | Now and Update, Sync | [x] |
| Uptime, connection, signal and address | Facts of the computer | `GET status`, `POST helper/network-info` | C M | Computer, Restart | [x] |
| Restart network, DNS actions | Not in this version of the helper (the helper has no word for them), so no button | none | M | Not added. The computer repairs the network by itself and Run network check shows what it did | [x] |

## Manual checks for accessibility

No offline checker was available, so the checks were done by hand and by tests that read the page itself. `tests/control-areas-page.test.mjs` runs the ones marked T.

- T. Contrast: the computed color of every piece of text against the color behind it is at least 4.5 to 1 (3 to 1 from 24 px, or 18.66 px bold), in light and dark, on the five areas at 390 and 1440 px wide and on twelve sections at 390.
- T. Keyboard: Tab and Enter reach each area; Tab moves through each area; every control that takes focus shows a ring (an outline or a shadow); Space and Enter press a button.
- T. Status is never a color alone: a chip, a dot and a banner always carry a word and a shape; `tests` read the words of the five dots.
- T. A 360 px phone has no sideways scroll in any area; every navigation link, primary button and dot is at least 48 px high.
- T. `prefers-reduced-motion` stops the spinner turning.
- T. The result of every action is in a `role="status"` region with `aria-live="polite"`; the sign-in message too.
- T. No console error in a pass through every area, and no request goes to a host other than the page's own.
- By hand: one `h1` (the title), one `h2` for each area, `h3` for the cards under it, so the headings are in order; `nav`, `main` and `header` are used for what they are; a skip link is the first thing Tab reaches; every control has a visible name (a label, its text or an `aria-label`); the question before a restart is a modal `dialog` that holds focus, closes on Escape and gives the focus back to the button; sections of an area are links with `aria-current="page"` on the open one.
- By hand: zoom to 200 percent keeps every line readable and nothing is cut off; text can be set larger in the browser without breaking a card.
- Not done: a screen reader pass on a real device. A coach with VoiceOver or TalkBack should read Now once and say what is confusing.
