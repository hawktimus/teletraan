# The control page

The control page runs on the Teletraan computer. Coaches use it from a phone or a laptop on the WiFi to update the dashboard and the Studio, see what is running and roll back. Nobody needs SSH for it.

Address: `http://teletraan.local:3229/`. It opens a small page with two big buttons, Control page and Studio. The control page itself is `http://teletraan.local:3229/control/`. The Tailscale name of the Teletraan computer works the same way: `http://<tailscale name>:3229/`. If the school WiFi blocks traffic between devices, `teletraan.local` will not open. Use the Tailscale name then.

The Studio has two ways in: the Studio button on the landing page and in the header of the control page (both open `/studio/` on port 3229), and port 3426, which goes straight to the Studio: `http://teletraan.local:3426/`. Port 3426 serves the Studio and nothing else.

The page has four tabs, in this order: Status, Display, Content and Settings, and the Studio button in the header. On a phone the four tabs are one row of 44 px buttons at the top.

- Status only shows. It has the Live preview of the wall, the Now on the wall card (build, view, theme, layout, team, panel, page, hold and the age of the report), three links (Change what is shown: Display, Change what it says: Content, and Sync and restart: Settings) and, at the bottom, Health: the release, the screen, page loads in 24 hours, restarts, how long the computer has been up, disk, memory and temperature when the computer tells them, Sanity, whether the Studio can reach this page, and the last errors of the control log. No button on Status changes the wall.
- Display is how the wall looks and plays: where it is pushed or planned. At the top is Show on the wall now: Playlist, Theme and view, Hold a panel and Messages (the buttons that used to be on Status), with Next, Pause and Reset to today's schedule kept at the bottom of a phone. Under it are the saved rotation rows and the theme of each weekday (The Display tab, below).
- Content is what the wall says: Ticker and news, Calendar, Roster, Announcements and Photos, five blocks that fold (the Content section, below).
- Settings has folding sections, drawn when opened. On a phone one is open at a time. In order: Updates (from GitHub, from a folder, roll back, the install through the bare repository), Keys (the keys and calendar links), Monitor Monday (Check the token, and Monday debug, which shows how Monday answers for one board number), Sync and restart, Scheduled reboot (below), Logs (the last lines of the logs and a download) and All settings (a line saying the Studio settings are coming, and a fixed place with the id `settings-all` for the file that edits them).

Old addresses still work: `#now`, `#health` and `#status` open Status; `#playlist`, `#hold`, `#messages` and `#theme` open Display; `#content`, `#content/ticker`, `#content/calendar`, `#content/roster`, `#content/announcements` and `#content/photos` open Content with that block open, and so do the older `#display/ticker`, `#display/photos` and the like, and the plain `#ticker`, `#news`, `#calendar`, `#roster`, `#announcements` and `#photos`; `#update`, `#keys`, `#monday`, `#sync`, `#restart`, `#reboot` and `#log` open Settings with that section open, and so does `#settings/<section>`. The list is in one place, `control/static/tabs.js`. Another file can add a block to a tab with `extendTab('display', { place: 'before', mount })` (Content is a tab of its own and is not an extension of Display), or to All settings with `extendTab('settings-all', { mount })`. The service lists any file in `tabs/` that calls `registerTab` or `extendTab`.

### Sync and restart

The section of Settings that holds what used to be on Status: Sync all, one button for each sync (calendars, Monday, competition, FRC news, Match13, Drive photos), Last reads (when each source was read), the three dots that the TV shows, and Restart screen, Restart services and Reboot the computer, each with a 10 second countdown to cancel.

Sync all calls `POST /control/api/sync-all`, which asks the helper for `sync-now` in this order: calendars, monday, frc, news, match13, photos-drive. It answers with a line for each: Ran, Skipped or Failed, with the reason in plain words. A sync that is not installed on the computer (systemd says the unit was not found) is skipped. A sync that fails never stops the ones after it. Under Which syncs Sync all runs, a box for each sync switches it off for Sync all; the choice is kept in this browser and sent as `skip`. The call can take a few minutes, so the page says to keep it open.

### Two layouts, one page

The page measures its width and sets a word on the root: wide (900 px and up), medium (600 to 899 px) or narrow (under 600 px). The code is shared (`control/static/tabs/arrange.js`), and `tabs/tabs.css` does the rest with a grid.

- Wide: Status has two columns, the Live preview on the left (it stays in view) and the card and links on the right, with Health below. The groups of Show on the wall now sit two by two.
- Medium and narrow: one column. The Now card is first and the Live preview is closed behind Show live preview (nothing loads until it is tapped, so a phone is not loaded with the whole dashboard). On Display each group folds and one is open at a time, and a bar at the bottom keeps Next, Pause or Resume, and Reset to today's schedule in reach. Health is closed under its own heading. Every field is 16 px or more so iPhone does not zoom.

The groups of Show on the wall now:

- Playlist: Next, one button that is Pause rotation or Resume rotation (it shows what a press does, and the line under it says what the rotation is doing now) and Back to schedule.
- Theme and view: the line Today the schedule uses Cybertron (from the saved schedule and the time zone of the Look page), the big button Reset to today's schedule, then Theme and View.
- Hold a panel, and Messages (Play announcement, Post an announcement, Play desktop reveal, Play red eyes and Run presentation test).

The line above the Now card, and above the groups, says who decides what the wall shows: Following the schedule, or Held by you: theme Retro until reset, view Nova until 14:32.

## Hidden transitions

Messages has two buttons, Play desktop reveal and Play red eyes. A press writes the same request as the Studio menu
(`hiddenRequest`, the kind and the time) and the button shows its result: Done in green with the time to expect, or the reason in red. If
Allow hidden transitions is off the page says so and writes nothing. The wall sees the request within about 10 seconds and
plays it within about 20.

Under the buttons the block Last hidden transition comes from the Now report, so it is as fresh as the report (10 seconds):

- `Desktop reveal at 10:42: picture loaded 700x394, played 9.4 s`: it worked.
- `Desktop reveal at 10:42: picture FAILED to load (the TV browser could not read blue-screen-1.png: error 0, http 404)`: the effect ran over the plain backdrop. The words after the file say why: http 404 means the file is not on the web server, http 200 means the file is there and the browser could not read it.
- `Red eyes at 10:42. Ignored: request older than 5 min.`: a request that did not play, and why.
- `The TV browser can read: PNG yes, WebP yes`: what the browser of the wall can decode. WebP NO explains red eyes with no picture.

The full list of steps is in docs/hidden-transitions.md, "What the wall reports".

## Holding a panel

In the Hold a panel group there is a button, Hold 1 minute, and a field for whole minutes from 1 to 60 (it starts at 10) with the button Hold for that many minutes. The service refuses anything else with a plain sentence, and the hold ends by itself at that time. The view has a field of its own, from 10 to 120 minutes, and the theme has one under More, also from 10 to 120.

## Previewing a theme or a view

The Theme and view group has the pieces for this. Theme picks Original, Cybertron, Retro or Foundry. Switch to this theme stays until you reset it, or 24 hours. Preview for 10 minutes ends by itself (the field under More makes it 10 to 120 minutes). View picks Robotics, Prime, Nova or Condensed. Switch to this view stays until you reset it, or 24 hours, and Show for a time takes 10 to 120 minutes. Reset to today's schedule ends all of it at once (the theme, the view, a held panel and the pause) and says in one line what it cleared. The same four themes and four views are in the menu beside Publish on Dashboard Settings in the Studio (docs/switch-the-look.md), and both write the same fields in the same shape (`previewTheme { theme, until }` and `showView { key, until }`), so the screen reads them in one place (`activeRequests` in `dashboard/core/screen-requests.js`). The lists come from that file, so the page, the service and the screen cannot disagree.

A switch that stays is the same request with an end time 24 hours ahead. The service takes `hours` (1 to 24) or `until` (no more than 24 hours ahead) for a theme or a view, and refuses more with A theme or a view can stay for 24 hours at most. The screen obeys an end time up to 24 hours ahead (`longestMinutes` in `screen-requests.js`) and ignores one further off. A timed button keeps its rule: 10 to 120 minutes. The theme of today comes from `themeByWeekday` of Dashboard Settings and the time zone of the Look page; the views have no view of the day, they follow each other in `viewOrder`, so the page lists them. `GET /control/api/request` returns `todayTheme`, `todayViews` and the requests that run now.

When a view that was asked for has nothing to show (Condensed has only Monday cards, and none is on the TV), the wall stays on the schedule and says so in the report (`heldNote`), and the Now on the wall card shows it as the Held view line under Hold.

After a press the group shows a line, Previewing Cybertron until 14:32 with the minutes and seconds left (Cybertron stays until you reset it, for a switch). The page then asks what the wall reports every 3 seconds for a minute. When the report shows the theme or the view it asked for, the page says The wall shows Cybertron now. If the report still shows another one after 20 seconds, the page says The wall has not changed yet. It checks every 10 seconds. The TV reports every 10 seconds, and it asks for requests every 10 seconds, so a change normally shows within about 20 seconds. A change waits while an alert, a talk or the night screen has the screen.

On the wall a theme request has its own place in `dashboard/core/style.js` (`requestStyle`), so it wins over the theme of the day, over the rotation and over an older Preview button. A view request plays all the blocks of that view in the rotation list, one after the other. Condensed has no block in the list, so it plays the rows of its own document. When the request ends the screen goes back to the schedule in a swap.

## The Live preview

The Status tab has a Live preview card beside the card of the wall. It shows the TV moving, as a picture the Teletraan computer makes of the TV's own browser (the mirror, below). When the mirror cannot start, it shows a copy of the dashboard in a frame that follows the TV, drawn at 1920 by 1080 and shrunk to the width of the card. The web server serves the dashboard read only on port 3229 as well as on the local port, with the same folder, the same cache rules and the same slides rule. The dashboard is public data, so nothing secret is served.

### The mirror

When you open the tab (on a phone, when you tap Show live preview) the page asks the Teletraan computer to start the mirror. The page calls `POST /control/api/mirror/watch`, which asks the helper for `mirror-watch`. The helper touches the file `mirror/watch` in the data folder and starts `teletraan-mirror.service` if it is not running. That service runs `computer/scripts/mirror.py`, which asks the kiosk browser for a screencast over its debug port and writes the newest frame to `mirror/frame.jpg`, with a counter in `mirror/frame.n`. The page reads the counter, fetches the picture when the counter moved, and shows it under the words `Live from the TV` with the frames a second it draws. It asks `mirror-watch` again every 30 seconds while the tab is visible.

The service stops by itself when the watch file is older than 2 minutes (nobody is looking), when the browser closes its socket, or after 30 minutes. It leaves no picture behind. The page stops asking when you change tab or the page goes to the background.

If no picture arrives within 10 seconds, the card says `The mirror could not start. Showing the copy that follows the screen.` and shows the copy below. If python3 is missing on the computer the helper says `mirror: no python3` and the card says `The mirror needs python3 on the computer.` The installer checks `python3 --version`. Without it, it skips the unit and says so, and the rest of the install goes on. Python 3 is on a standard Debian install. Nothing is installed by the page.

What is exposed: the browser's debug port stays on 127.0.0.1 and nothing serves it. The web server on port 3229 serves two files from the data folder, read only and never cached: `/mirror/frame.jpg` and `/mirror/frame.n`. Like the dashboard on that port, they need no PIN, so anyone on the same WiFi or Tailscale network who knows the address can see the picture while the mirror runs. It is a picture of the TV and nothing else. The watch file is not served. Starting the mirror needs the PIN, because `/control/api/mirror/watch` is a control route.

The mirror is made at 960 by 540, JPEG quality 45, about 30 frames a second at most. The page shows fewer when the network is slow.

A screencast can come out black on a kiosk browser that has no window manager, and the size of a frame cannot tell that for sure. So `mirror.py` asks the page to be active and in front (`Page.enable`, `Page.bringToFront`, focus emulation and an active lifecycle state) and then looks at the picture itself. At the start and every 30 seconds, never more often, it takes one small PNG of the page (a quarter of the size), decodes it with zlib and the PNG filters in plain Python, and checks about 400 pixels on a grid. If more than 99 percent of them are near black (every colour channel under 12) the picture is black. Then it tries the other way of making pictures (screencast or screenshots) and writes down which one gave a picture. Three frames in a row under 3 KB, or no frame at all in 5 seconds, still switch a screencast to screenshots, about 4 a second, and the journal gets one line: `mirror: screencast was black, using screenshots`.

It writes `mirror/state.json` with `state` (`ok` or `black`), `mode` (`screencast` or `screenshots`), `fps`, `bytes` and the pixel size of the last picture, `sampled` (true when a PNG was read) and `tried` (what each way gave). `GET /control/api/mirror/status` gives it as `picture`, and the page asks every 5 seconds.

The page counts a frame only when the browser loaded the picture (the image fires load and has a width). The line under the picture says which way it is made: `Live from the TV (screencast, 12 frames a second)` or `Live from the TV (screenshots, 4 a second)`, and under it the size of the last picture, for example `Last picture: 38.4 KB, 960 by 540 pixels`.

Two different things can go wrong, and the card says which:

- Black: the picture loads but the browser on the TV draws nothing. The card says `The TV picture is black. The picture loads, but the browser on the TV is drawing nothing. Restart the screen.` and points to Settings, Sync and restart, where Restart screen is (Status never changes the wall).
- Cannot load: the picture does not arrive at all. The card shows a red line with the answer of the web server, for example `The picture could not be loaded: the server answered 403. See Settings, Logs.`, and a link `Open the picture in a new tab`. A 404 means the picture is not written, a 403 means the web server may not read the file.

The mirror folder is made by the login user with mode 755 and its files are set to 644 after each write, so the web server (another user) can read them whatever the umask of the service is.

If the picture is black or missing, look at it without the page. On the Teletraan computer run `ls -la /var/lib/teletraan/data/mirror/` and `curl -sI http://localhost:3229/mirror/frame.jpg`, and `journalctl -u teletraan-mirror`.

### The copy that follows the screen

The copy follows the TV. A page cannot join the session of another browser, so the copy is built from the report the TV posts every 10 seconds (view, theme, layout, team, panel, page). The tab asks for the report every 5 seconds. It builds the address of the frame from it, for example `/dashboard/?panel=events&team=prime&screen=cybertron&view=prime&still=1`, and changes the frame only when that address is not the one it holds. A report that did not change never reloads the frame. The line under the card says `Showing: <panel>, <team>, <theme>`, or `The TV has not reported yet` when there is no report.

The copy is a still picture of the same panel in the same team, theme, view and layout. It does not rotate, play transitions, hidden transitions, talks, alerts or announcements, and it writes nothing. It changes when the TV changes, within about ten seconds. Animations and the exact moment can differ. The page number is shown in the line but not copied: the copy holds the panel at its first page.

Some things cannot be copied. A takeover (alert, announcement, talk) or a stand-in has no panel to hold, so the copy shows the Tonight panel and the line says so. A Monday card is copied without its department, and the line says so. The view and the bar layout are written on the copy but the mirror of the Family view is not.

The copy does not report to the control page: the dashboard reports only when its address is `localhost` or `127.0.0.1`, and port 3229 refuses a report from any other address. The addresses `view=` and `layout=bar` are read only together with `panel=` and `still=1`. The `screen=` address also takes the themes Retro and Foundry.

## The Display tab

From the top: Now on the wall, the Preview, Temporary push, Rotation (what plays, in order) and Theme rotation (which theme plays each day). On a phone they come in that order in one column. On a wide screen the Preview stays in view beside the others. The Status tab only reads. Display is where things are pushed and edited.

Now on the wall. The theme on the wall in large letters, with where it comes from (the weekday schedule or pushed by hand), the line the wall reports about itself and four theme tiles. Pick a theme to see it in the Preview, choose how long to hold it (1, 5, 15, 30 or 60 minutes, 15 to start) and press Push theme to the wall. Back to the schedule ends the pushed theme. Under that is every push that is running, each with the time left (counted from the clock of the Teletraan computer, once a second) and a Cancel button, and Reset to today's schedule, which ends all of them at once.

Preview. Whatever you pick in Temporary push or Now on the wall is drawn in the large picture first, on the live content, in the theme, view and panel you picked, and the words under the picture say it is not on the wall yet. Pushing is a separate button. Pick a row in the Rotation and the picture goes back to that row (or press Preview the selected row instead). The picture is the dashboard with `?rowpreview=` and `&screen=<theme>`.

Temporary push. Each push holds for the chosen minutes and then the wall returns to its schedule by itself.

- View: Robotics, Prime, Nova or Condensed. Writes `showView`.
- Panel: any panel in the list. Writes `holdPanel`. The wall shows the panel with the settings of its first row in the rotation.
- Theme: writes `previewTheme`.
- Announcement: text up to 90 characters, Notice or Important, Both teams or one team. It is the bar under the banner (docs/announcements.md), one published document with the id `push-notice`, replaced by each new one, starting now and ending after the hold. Cancel and Reset move its end to now.
- Hidden transitions: Desktop reveal or Red eyes, played at once. Writes `hiddenRequest`. It has no time left, and Cancel works for 2 minutes. Allow hidden transitions must be on in Dashboard Settings.
- Pause rotation: writes `pauseRotation`.

Reset to today's schedule clears `holdPanel`, `showView`, `previewTheme`, `pauseRotation` and `hiddenRequest` and ends the announcement. The calls are `GET /control/api/push` (what is pushed, the week and the choices), `POST /control/api/push` with `{ kind, minutes, ... }` (kind is theme, view, panel, pause, hidden or announcement; hidden also takes `transition`), `POST /control/api/push/cancel` with `{ kind }` and `POST /control/api/push/reset`. They need the PIN and `SANITY_WRITE_TOKEN` like every write, and a minute count outside 1 to 60 is refused. The Status buttons keep their own ranges and still work.

Rotation and Theme rotation. The rows, Quick hide, pictures, the Motion card, Save to draft and Publish to the wall are described below. Theme rotation has a strip of the week that marks today and follows the pickers before you save, a theme for each weekday, the banner title for Robotics and the seconds of each transition. The time zone is the one on the Look page and is shown, not edited, here. Save and Publish are repeated in that card and work the same way.

The Rotation part is the Rotation board for a phone. The Studio stays the source of truth: the tab reads Dashboard Settings from Sanity every time it opens, and again with Refresh from Sanity, and it writes the same stored fields the Studio writes. The Studio Rotation board and the Look page stay fully editable, and a change in either shows in the other after a refresh.

What it shows. Each row of the rotation list is a card with its number, its panel, a View select (Robotics, Prime or Nova), a Panel select, Seconds, and Show on screen. Rows that follow each other in one view are one group, as on the Studio board, with the time of the group. Up and Down move a row. Copy, Delete (it asks you to press again), Add a row, Undo (the last 20 changes) and Fill from the standard order (it asks you to press again) work as they do in the Studio. A Photo row has Photos and Seconds per photo. A Department tasks row has three dropdowns, Department (one of the nine), List (Open or Done) and Team (Both, Prime or Nova), and a TV charts row has Chart and Team, the same as the Details of the Studio board. Another row's Department, Page and Small panel are shown as words and kept as they are; change those in the Studio. A row of one of the eleven retired Monday panels keeps its place, plays nothing, and says Retired, use Department tasks. Under the rows, Theme of each weekday has a theme for each day, the banner title for Robotics and the transition length. Under that, a Motion card has two boxes, Motion (Full, Light or Calm) and Motion on the TV computer (Light or Full). It is a section of its own, so the rows and the theme can be saved without it.

Quick hide. A group above the rows hides rows for a while without deleting them. Hide all Nova rows switches Show on screen off for every row whose view is Nova, and there is one button for each panel in the list, Robot Status and 3D view first (the panels `robotStatus` and `wireframe`). Each label says what it will do and to how many rows, for example Hide Robot Status (6 rows). When no row of the group is on, the button reads Show and turns them all back on. A row that is already in the wanted state is not counted. These buttons only change the list on the page and Undo takes them back. Nothing is sent until Save to draft, and Publish to the wall puts it on the wall. The rows keep their seconds, panel and every other setting, so Show brings them back as they were.

Monday rows. Under the quick buttons, Remove retired Monday rows (N) appears only when N, the rows of the eleven older Monday panels, is more than 0. It takes exactly those rows out of the page's copy and never touches another row. It says how many it removed. Then press Save to draft and Publish to the wall. Undo puts them back. An older Monday tasks row with a department is removed like the others, because the Department tasks rows replace it. Add the nine Department tasks rows (Robotics, Open) adds one row, open, for both teams, 30 seconds, for each of the nine departments that has no Department tasks row yet, and Add the three TV charts rows does the same for the Status, Progress and Timeline charts. Each label names how many rows it will add (for example Add the 4 missing Department tasks rows) and a button is left out when there is nothing to add. The Studio Rotation board has the same three buttons (docs/rotation-board.md).

What it writes. Save to draft writes only the fields you changed, to the draft of Dashboard Settings: `rotationRows` (with `department`, `list`, `chart` and `team` on a Monday row), and `themeByWeekday`, `generalViewTitle` and `transitionSeconds`, and `motion` and `motionOnKiosk` (the Motion card). No stored name is changed. The draft is made from the published document when there is none, as the Studio does, so the other fields are kept. Save never touches the published document. Publish to the wall is a separate button, and it publishes the whole draft, so any waiting edit made in the Studio goes on the wall with it. The control service writes with `SANITY_WRITE_TOKEN` from `local.env` at the moment of the write. The key never reaches the browser. Without it the tab can read but not save, and says so.

Two people at once. The page remembers the revision it loaded. Before every save and every publish the service reads Dashboard Settings again and compares. When the Studio changed it in between, nothing is written and the page asks: Replace the Studio copy, Refresh from Sanity and drop my changes, or Keep editing. The write also names the revision it replaces, so a Studio edit in the last second is caught by Sanity itself. While the tab is open it checks the revision every minute and says when the Studio copy is newer.

What the wall would do with each row. Under each row the tab says Will show now, Skipped now with the reason, or Off, and lists the items it would draw: Monday tasks, FRC news posts, events and, for the Competition: Rank row, the TBA rank and next match, and for the Competition: Team metrics row one line for each page of the card with its first numbers. The answer is not a copy of the rules. The service builds the content the way the wall does (the same query and cleaning in `dashboard/core/sanity.js`), asks `viewSteps` for the steps of the row and the `hasContent` of the panel, which are the functions the wall asks, so a rule changed in the dashboard changes the tab too. The checks use the published content, with the row as it is on the page. It is read again at most once a minute.

Where the data is. Monday tasks, FRC news and the TBA data (the `frc-status` document) are Sanity documents the Teletraan computer writes, so the service reads them from Sanity as the wall does. The calendar files and `match13.json` are files in the data folder, which the control service has read only. Competition data at the foot of the tab lists the TBA ranks and the Match13 matches. Match13 never goes to Sanity: the service reads `match13.json` and sends it only to this page, behind the PIN. `tests/control-display.test.mjs` checks that a save and a publish carry none of it.

Motion. Full plays every transition of the theme, Light plays one simple change at each panel and view change and keeps the idle sweeps still, and Calm only fades (docs/transitions.md, "Full, Light and Calm"). The Teletraan computer plays Light even when Motion says Full, unless Motion on the TV computer says Full. The card is the same two fields as Studio, Look, Motion. To try Full on one computer, add `?motion=full` to the address of its screen. `GET /control/api/display` answers `motion: { motion, motionOnKiosk }` and a save may carry `motion: { motion, motionOnKiosk }`, which is checked (`cleanMotion` in control/support/display.js) and refused with a 400 when a value is not on the list.

The calls are `GET /control/api/display`, `GET /control/api/display/rev`, `POST /control/api/display/check`, `POST /control/api/display/save` and `POST /control/api/display/publish`.

### Pictures of a row

The Display tab shows what a row looks like. A large picture follows the selected row, and each row can have a small one. They are the real dashboard, not a copy of its drawing code: the page opens `/dashboard/` (the read only copy that port 3229 serves) in a frame at 1920 by 1080 and shrinks it with a CSS transform. The frame reads the same content as the wall: Sanity, and the Monday, calendar, Match13 and TBA data. It keeps its normal live listener, so a change made in the Studio or by the Monday sync shows in the picture within seconds, and the page does nothing to help it.

The large picture. From 1000 px wide it stays in view beside the rows. On a phone it is above the rows. A row is selected by a click or by focus on any of its fields, and the card of that row gets a yellow edge. Under the picture are the title of the row, its chip and its reason (Will show now, or Skipped now with why, or Off) and the line `What the TV shows now`, taken from the report of the wall every 10 seconds. The picture follows the settings of the row as they are on the page, so a department, a list, a team, a small panel or a photo count that is changed and not yet saved is drawn at once. Seconds and Show on screen do not change the picture, so they do not load it again. A panel that the dashboard no longer draws (a retired Monday panel) has no picture and says so.

The small pictures. Each row has a 240 by 135 slot that shows its title until a picture is made. A picture is made only when its slot is on screen (with a margin of 200 px). At most 6 are live. A frame that scrolls out of view is reused for the next row, and the selected row always keeps its picture while it is on screen. Everything is dropped while the tab is hidden and made again when it is shown. The switch Show thumbnails is on a computer by default and off on a phone, and is remembered in the browser (`teletraan-display-thumbs`). On a phone, when it is on, only the selected row has a small picture. A card that stays when the list changes keeps its element (`tabs/display-patch.js`), so changing one row does not load every small picture again.

The frames run in the browser of the person who opened the page, loaded from the Teletraan computer on port 3229. They never run on the TV. If the page is opened on the Teletraan computer itself (the address is `localhost` or `127.0.0.1`, which only the kiosk uses), a note says so, the small pictures are off and the switch is locked, and the large picture waits for the button Draw the picture here anyway. Open the page on your own computer or phone.

What a frame may do. It is a frame with `sandbox="allow-scripts allow-same-origin"` and `referrerpolicy="no-referrer"`, so no form, popup, download or page change. It needs its own address to load the dashboard modules, which is why it is not isolated from the page: the dashboard is our own code, and the safety is in what it is told to do. The address has `?rowpreview=` with the row as JSON, and the dashboard then draws that one row and holds it (docs/layouts.md, "Switches of the address"). A page opened that way never starts the rotation, a talk, an alert, a hidden transition, the night screen, the heartbeat or the report to this page. It also refuses every request that is not a read and every request to `/control/`, and writes nothing to the browser (`dashboard/core/row-preview-guard.js`), so it has no write route and no key, and the service gives it none: the key stays in `local.env`. `tests/row-preview.test.mjs` and `tests/control-display-pictures.test.mjs` check this.

Cost. `node tools/measure-display-pictures.mjs` opens the tab in Chromium on a Mac with the sample content and prints memory, CPU over 10 seconds and the frame rate. One run, on a 1600 by 2400 window: the page with no picture 260 MB for the whole browser; with the large picture 285 MB; with the large picture and the 3 small ones that fit a 1440 by 900 laptop screen 388 MB; with the large picture and 6 small ones 500 MB. That is about 35 MB for each picture, and 240 MB at most. The JavaScript heap goes from 3.7 to 16 MB and the page from 15 000 to 39 000 nodes, and the CPU is 3 percent of one core while the pictures hold still, with the page at 60 frames a second. The browser memory moves by 50 MB or more from one run to the next, so read the order of the numbers, not the last digit. This is the cost to the computer that opened the page, never to the Teletraan computer.

## Content (the Content tab)

The Content tab opens with one sentence and five blocks that fold. Each one reads from Sanity the first time it is opened, and on a phone one is open at a time. `#content/photos` opens a block by its address. A change is a draft first and reaches the wall only when you press Publish, which is how the Studio works too, so either place works.

- **Ticker and news.** The Tips and News lines of the Studio: Add line, Edit (the text counts against the 52 characters that fit, and the kind, team, order, Show on screen and Hide after are the Studio fields), Hide or Show, Up and Down (they renumber the order in tens), Publish, Drop changes and Delete. Each line shows how the ticker draws it, a tag (TIP, NEWS or REMINDER) and the text. Below the lines are the FRC news headlines the Teletraan computer read, read only, with the categories that are kept and a Hide or Show button for each headline. That button writes the hidden list of Dashboard Settings to its draft, the same list as the FRC news section of the Competition page, and a Publish button publishes the Dashboard Settings draft, with every other waiting change in it.
- **Calendar.** The coming BAND events from the document the Teletraan computer writes (calendar-status), by day, with the calendar and kind of each and whether a Calendar filter hides it from the wall and which rule. Events are edited in BAND, never here. The Hide or Show button on an event drafts a one event rule in the same shape as the Studio Calendars page (id starting `calendarFilter-one-`), and Publish makes the waiting event rules live. It publishes those rules only, never a rule someone is still writing in the Studio. An event a rule hides is listed without its title, because the dataset is public, so its button is off.
- **Roster.** Everyone on the roster (the type Roster person) grouped by team and then by role, with counts, and Add, Edit, Hide, Publish and Delete as above. Portraits are added in the Studio and show here read only. Under the roster, the Leadership and Team leads lists of the Studio are listed read only, with a link that opens the Studio. They are not copied. No panel of the wall shows the roster yet (docs/roster.md).
- **Announcements.** The Announcement documents (the bar under the banner, docs/announcements.md): the text with a counter against 90 characters, start, end, team and level, each with a chip, Live now, Waiting or Over, and Add, Edit, Publish and Delete. The type has no Show switch, so a Hide button is not offered: end it or delete it. A line says how many are live and that two live ones alternate every 12 seconds. Above the list is Post now: the text, the level, the team and 5 to 120 minutes make an announcement that starts this minute, is published at once and ends by itself (`POST /control/api/content/announcement/post`, held to the same text, level and minutes rules as the push of the Display tab, but written as an announcement of its own so it never replaces another).
- **Photos.** The Photo documents as a grid of small pictures, newest first, each asked from Sanity at 480 pixels wide and never the original. A card has the caption, the credit, the fit, the expiry, a chip, and Hide or Show, Edit (caption up to 36, credit up to 14 and a first name with the Studio warning for a space, an @ or a number, fit, Show on screen, Hide after), Publish and Delete. The picture itself is never replaced here. Above the grid, the Photos source (Upload photos, Google Drive folder or both, the end of the Drive folder id and the last read) is shown read only with a link to Settings, All settings, Photos. Add photo sends a JPEG, PNG or WebP picture up to 15 MB to `POST /control/api/photo-upload` as the raw body, with the type in Content-Type and the caption and credit in the headers X-Caption and X-Credit (written with encodeURIComponent). The service checks the type, the size and the first bytes of the file, stores it in the asset store of Sanity with the write key of the computer, and makes a Photo draft that points at it, switched on. The name of the file is not sent to Sanity, because the dataset is public and a name can hold a last name. nginx lets a body through up to 110 MB without buffering it, so no setting changed.

The lists use the generic collection routes of the control service, which draw their forms from the Studio schemas like All settings does:

- `GET /control/api/docs/<type>` lists the documents of one kind, the draft when there is one.
- `POST /control/api/docs/<type>` makes a new draft with a new id from `{ set }`.
- `GET /control/api/docs/<type>/<id>`, `POST .../save` (`{ set, unset, baseRev, force }`) and `POST .../publish` (`{ confirm, rev, force }`) work as the singleton routes do, with the same revision conflict and the same refusal of an unknown field or a value over a limit.
- `POST .../delete` takes `{ confirm, rev, draftOnly }`. A published document is removed, with its draft, only when `confirm` is true. `draftOnly` drops the waiting changes and keeps the published copy. A draft that was never published needs no confirm.

Only the types the plan names as `collection` (studio/tools/schema-plan.js: tipOrNews, rosterPerson, announcement and photo) are allowed. The read routes are `GET /control/api/content/calendar`, `POST /control/api/content/calendar/switch`, `POST /control/api/content/calendar/publish`, `GET /control/api/content/news`, `GET /control/api/content/people`, `GET /control/api/content/photo-source`, `POST /control/api/content/announcement/post` and `POST /control/api/photo-upload`. Every route needs the PIN, a write needs SANITY_WRITE_TOKEN on the computer, and no answer holds the key.

## All settings

Settings has a section, All settings, with every setting the Studio has, so the owner can change them from the control page as well as from the Studio. The form is not written by hand. The service reads the Studio schemas of the live release (`studio/schemas`) and makes a form spec from them (`studio/tools/schema-spec.js`, with the plan in `studio/tools/schema-plan.js`). A new field of the Studio shows up on this page by itself, and the stored names are the ones the Studio uses.

- A search box finds a setting by words from its title or description ("glint", "night mode"), across every tab of the page it is on, and lists the same words on other pages (Teams, Views).
- Settings page picks the document: Dashboard Settings (Timing, Look, Photos, Countdown, Calendars, Monday, Competition, Today, Advanced), Look rules, the four Views, each Team (colors, metal, glow, mirror and trim), Extra panels and Subthemes.
- Each field shows its one-line description, its limits (a counter against the Studio character limit, a range for a number), a swatch and a hex box for a color, and an Unsaved mark. Undo goes back one change, Discard my changes goes back to what was loaded, and each changed field has its own Undo.
- Save to draft writes only the changed fields to the draft, with the revision check. If the Studio changed the document meanwhile, the page asks: Replace with my changes, Refresh from Sanity or Keep editing. Publish asks first and publishes only that one document.
- Left out, and listed with the reason when the tests run (`node tests/schema-spec.test.mjs`): what the Display tab owns (the rotation rows, the theme of each weekday, the banner title for Robotics, the transition length, the Motion card), the Scheduled reboot card, one-time requests that buttons write, notes and status lines, pictures and other uploads, links to anything but a team, and settings the screen does not read any more.
- A drift test fails with a plain message when the Studio has a field that the page neither draws nor lists as left out.

`GET /control/api/spec`, `GET /control/api/docs`, `GET /control/api/doc/<id>`, `POST /control/api/doc/<id>/save` and `POST /control/api/doc/<id>/publish` are the calls (`control/routes/settings-doc.js`). Only documents the spec names are allowed, a name that is not a field of the spec is refused, and every value is checked against the limits of the spec before anything is sent to Sanity. Publish needs `confirm: true`. The write key stays on the Teletraan computer and is never in an answer. The page is `control/static/tabs/settings-all.js` (`mountSettingsAll(container, ctx)`).

## The Scheduled reboot section

Settings has a section, Scheduled reboot, for the reboot of the Teletraan computer at a time of day. It is off to start with. The card shows two lines at the top, `Next reboot: Tue 03:30` and `Last reboot: 3 hours ago (Tue 03:30, as scheduled)`, then Reboot on a schedule (the switch), Reboot at (the time, 24 hour), Reboot on (the days, Sunday to Saturday), Not while a talk, an alert or an announcement is playing, and Wait up to (minutes), then reboot anyway (1 to 120, 30 to start with). The time is read in the time zone of the Look page.

The Studio is the source of truth, and the card shows the same values: Dashboard Settings, Advanced, Scheduled reboot has the same five fields, with the same two lines at the top. Both write the same stored fields of Dashboard Settings (`rebootEnabled`, `rebootTime`, `rebootDays`, `rebootSkipBusy` and `rebootWaitMinutes`), so a change in one shows in the other. The card follows the pattern of the Display tab:

- Save to draft writes only these fields to the draft of Dashboard Settings. It checks the revision first and asks before it replaces a newer Studio edit.
- Publish asks first, because a publish puts every waiting change of Dashboard Settings on the wall, including edits made in the Studio. The service refuses a publish that does not say `confirm: true`. The page, not the service, asks the owner.
- The timer reads the published setting, so nothing changes on the computer until it is published.

`GET /control/api/reboot`, `POST /control/api/reboot/save` and `POST /control/api/reboot/publish` are the calls (`control/routes/reboot.js`). The write key stays on the Teletraan computer and is never in an answer.

### How the computer decides

`teletraan-reboot.timer` wakes `computer/scripts/scheduled-reboot.sh` every 5 minutes. The script reads the five fields, the time zone of the Look page and what could hold the screen (an alert, an announcement that is up, a booked talk) from Sanity, which is public and needs no key. It keeps the last good setting in `reboot/setting.json` in the data folder, so when Sanity cannot be reached it goes on with the last known setting. When Sanity cannot be asked what is playing, the reboot goes ahead on schedule. `computer/scripts/reboot-plan.mjs` decides, and the script reboots with `sudo systemctl reboot`, the command the helper uses and the sudoers file allows.

- The slot is the scheduled time of the day on a ticked day, worked out in the time zone of the screen, so the time holds across the days the clocks change.
- A slot is acted on within 10 minutes of its time. A slot that was missed because the computer was off is not made up.
- The setting has to have been in effect before the slot. A time published at 03:36 does not reboot for the 03:30 of that day.
- With the skip rule on, a talk (from 10 minutes before it starts to the end of its minutes plus the wait and the overrun), an alert or an announcement makes the run wait, and it reboots anyway after the wait.
- Guards: a slot is used once, and the state file is written before the reboot. No reboot within 10 minutes of boot, and none within 6 hours of the last reboot, whoever made it (the uptime counts, so the Sunday reboot of `nightly.sh` is also a gap). A reboot the system refuses is not tried again every 5 minutes.
- One plain line goes to the journal for each run: `scheduled reboot: rebooting for Tue 03:30.` Read it with `journalctl -u teletraan-reboot.service`.
- The next and the last reboot go to the document `status-mini` (`nextRebootAt`, `nextRebootText`, `lastRebootAt`, `lastRebootWhy`) by `status-write.sh reboot`, and only when they changed.

The Sunday reboot at 04:10 that `nightly.sh` makes is a separate thing and stays. Pick a time for the scheduled reboot that is not 04:10 on a Sunday. If the two fall within 6 hours of each other, the later one is skipped.

To turn it on, see docs/updating-the-computer.md ("Turn on the scheduled reboot").

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
2. Allow the computer's address in Sanity, so the Studio on the computer can read the dataset. Open sanity.io/manage, choose the project, then API, then CORS origins, then Add CORS origin. Add `http://teletraan.local:3229` with Allow credentials ticked, and do the same for `http://<tailscale name>:3229`. If you open the Studio on port 3426, add `http://teletraan.local:3426` and `http://<tailscale name>:3426` too, because Sanity checks the address exactly as the browser shows it. The Status tab says "CORS origin missing" until this is done, and then names the 3426 address as well. On a shared Wi-Fi, leave Allow credentials off for the teletraan.local addresses and use the Tailscale name: a page on plain HTTP can be changed on the way, and with credentials allowed it could act as the signed-in editor (docs/security-review.md).
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

The top of Settings, Updates is the card From GitHub. It needs no login and no key, because the repository (github.com/Hawktimus/teletraan) is public.

1. The card shows `On GitHub: <short hash> <message>` and `On the wall: v14 · a1b2c3d`.
2. Press Update from GitHub and confirm. The computer downloads the zip of that exact commit (about 100 MB at most, 2 minutes at most), takes off the one top folder GitHub puts in it and installs it with the same steps as the folder upload: download, unpack, check the files, check the schemas, build the Studio, write the release files, switch, restart the screen, wait for the screen. A failure before the switch leaves the wall as it was.
3. The release note reads `From GitHub <short hash> <message>` and `RELEASE.json` says `from: github`.
4. The button reads Already on the wall and is off when the newest commit is the one on the wall. Check again asks GitHub once more.

If GitHub answers too often the card says "GitHub is limiting requests. Try again in a few minutes." If the computer is offline it says it could not reach GitHub. Only one update runs at a time. The control container needs outbound HTTPS to `api.github.com` and `codeload.github.com`. No compose or nginx change is needed, because the control service makes the calls itself. The code is `control/lib/github.js` and `control/routes/github.js`; the repository, the branch and the addresses are the constants at the top of the first.

## The Update section

It is the first section of Settings.


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

No GitHub is needed. The installer makes a bare repository at `/srv/teletraan.git` with a `post-receive` hook. A push of `main` installs it as the next release with the same steps as Settings, Updates. The Update tab shows the lines with the user and host filled in:

    git remote add teletraan <user>@<host>:/srv/teletraan.git
    git push teletraan main

The login user is not in the docker group, so the hook does not run docker. It calls `sudo -n /usr/local/sbin/teletraan-install-tree <staging folder> <commit>`. That file is a root-owned copy of `computer/git/install-tree-as-root.sh`, and the sudoers file lets the login user run that one path and nothing else. The wrapper checks that the folder is a real folder directly under `/var/tmp`, named `teletraan-push.*`, owned by the caller, and that the commit is a short hash. It then runs the same install as the Update tab, with the root, the user ids and the image read from `/usr/local/etc/teletraan-install.conf`, and restarts the control service.

The first push after this change needs the Mac tool update once (`tools/teletraan/teletraan-tool update`, menu 1), because only the installer writes the wrapper, the config file and the sudoers line. After that, `git push teletraan main` installs.

What the errors mean:

- `The install needs the sudoers rule. Run the installer again from the Mac tool (menu 1).`: the sudoers line is not there yet. Run the update once.
- `teletraan-install.conf is missing` or `sudo: a password is required` with no wrapper: the same cause.
- `the staging folder ...` or `the commit is not a short hash`: the wrapper refused its arguments. The hook always gives it good ones, so this means something else called it.
- `The install stopped. The wall is unchanged.`: the install itself failed. The lines above it say why, and Settings, Logs has the rest.

On a new computer: `git clone <user>@<host>:/srv/teletraan.git teletraan`. This needs an SSH key. docs/new-mac.md says when you do not need one.

## When the page cannot be reached

The Mac tool is the way in. `tools/teletraan/teletraan-tool update` does the same install as Settings, Updates, and `tools/teletraan/teletraan-tool restart` restarts the screen. Both need SSH.

## The helper and restarts

The page cannot restart anything by itself. It asks a helper on the host through a Unix socket, `/run/teletraan/control.sock`, which only the login user can use. The helper (`computer/scripts/control-helper.sh`) knows these words and nothing else: `restart-kiosk`, `restart-services`, `reboot`, `status`, `sync-now calendars`, `sync-now monday`, `sync-now frc`, `sync-now news` (the FRC news read), `sync-now photos-drive`, `sync-now match13`, `write-env`, `monday-check` and `monday-debug <board number>` (digits only, 20 at most; it runs `monday-sync.sh --debug` and its answer holds no token and no names of people). `status` prints `kiosk:`, `display:`, `tailscale:` and other `name: value` lines. Each one is written to `/opt/teletraan/logs/helper.log` with the time. Anything else is refused and logged.

The sudoers file `/etc/sudoers.d/teletraan-control` lets the login user run these without a password, and nothing more: `systemctl restart teletraan-kiosk.service`, `systemctl restart` of the six timers (calendars, monday, slides, watchdog, nightly, reboot), `systemctl start` of the six sync services (calendars, monday, frc, news, photos-drive, match13) and of `teletraan-mirror.service`, `docker restart teletraan-web` and `systemctl reboot`. Each line names one unit and one command, with no wildcard, so another unit or an extra argument is refused. The watchdog, the nightly restart and the scheduled reboot run as the login user and use the same file; add a command by adding a line there and in `tests/sudoers.test.mjs`. The helper runs each by its full path, `/usr/bin/systemctl` and `/usr/bin/docker`, and the file lists the same paths. The reboot is also listed as `/bin/systemctl reboot`, `/usr/sbin/reboot` and `/sbin/reboot`, in case `sudo` compares the path as typed.

The control container mounts `/opt/teletraan` (read and write, which includes `local.env`) and the `/run/teletraan` folder that holds the socket. It reads `local.env` through the folder and not as a mount of its own file, so a key saved in the Keys section of Settings is seen at once. It does not mount the Docker socket or anything under `/etc`.

## When a button does nothing

Every button on the Display tab and in Settings shows a line under it: Done in green, or the reason in red. A reboot or a services restart cuts the page's own connection, so those show an amber line that says to wait a minute and reload.

- "The control page could not reach the helper on this computer. Run the installer again." The socket `/run/teletraan/control.sock` is missing or the control container cannot use it. Run `sudo computer/install.sh` again (from the Mac tool, choose 1).
- "Sanity refused the write. Check SANITY_WRITE_TOKEN in Settings, Keys." The key is missing the write right, or is wrong.
- "Run presentations is switched off" means the screen would ignore the test.
- "The helper did not finish (failed 1). sudo: a password is required" means the sudoers file does not allow the command. Run the installer again.

Two commands on the Teletraan computer show what happened:

    tail -n 40 /opt/teletraan/logs/helper.log
    sudo journalctl -u teletraan-control@* -n 40 --no-pager

The first has one line for each word the helper was asked, and a `failed` line with the reason from `sudo` when a command did not run. The second has what the helper printed to the journal.

The screen sees a request from the control page or the Studio (Run presentation test, Play announcement, Next look now, Hold, Show a view, Preview a theme) within about 10 seconds: it reads only those fields of Dashboard Settings every 10 seconds, besides the full read every 5 minutes and the live change stream. A test request counts for one minute, so a screen that only read every 5 minutes would usually miss it.

## The PIN

The page accepts exactly two PINs, 3229 and 3426. They are a constant list in `control/lib/auth.js`. The page asks once and keeps a signed cookie for 30 days. Six wrong tries from one address in ten minutes block that address for an hour. The Keys section of Settings shows "PIN: fixed" and has no field for it.

To make the page take one other PIN, add the line `CONTROL_PIN='4417'` to `/opt/teletraan/local.env` by hand over SSH (4 to 12 digits, nothing else is checked). The page then accepts only that PIN, the two fixed ones stop working, and every cookie made before is over. Take the line out to go back to the two fixed PINs. A value that is not 4 to 12 digits is ignored. The Mac tool and the Keys section of Settings never write this line and leave it alone.

## Where the code is

- `control/server.js`, `control/lib/` and `control/routes/`: the service. Every file in `routes/` is loaded by name order, so a new route needs only a new file.
- `control/routes/display.js`, `control/support/display.js` and `control/support/display-wall.js`: the Display tab (reading, checking and writing Dashboard Settings, and the wall check). `control/static/tabs/display.js`, `display-parts.js` and `control/static/display-rows.js`: the page. `display-rows.js` copies the row rules of `studio/tools/rotation-board.js`, and `tests/control-display.test.mjs` runs both on the same rows.
- `control/routes/collection-doc.js`, `control/routes/content.js`, `control/support/collection-doc.js` and `control/support/content-read.js`: the lists and the read routes of the Content section. `control/static/tabs/content-blocks.js` mounts the three blocks, `content-list.js` is the list with its form, `content-ticker.js`, `content-calendar.js` and `content-roster.js` are the blocks, `content-items.js` holds the plain rules and `content.css` the look. The calendar rules are the Studio's own, loaded from `studio/inputs/calendars-list-parts.js`.
- `control/static/display-preview.js` (plain functions), `control/static/tabs/display-preview.js` (the frames), `display-preview-parts.js` (the markup) and `display-patch.js` (keeps the card of a row that stays): the pictures of a row. `dashboard/core/row-preview.js` and `row-preview-guard.js` are the dashboard side. `tests/helpers/display-world.mjs` is the control service on a fake address for browser tests, and `tools/measure-display-pictures.mjs` measures the cost.
- `control/static/`: the pages. A file named `tab-<name>.js`, and each file in `control/static/tabs/` that calls `registerTab`, is a tab and registers itself.
- `computer/install.sh`, `computer/git/post-receive`, `computer/sudoers/`, `computer/systemd/teletraan-control.socket` and `teletraan-control@.service`: the installer and the host side.
- `control/bin/install-tree.js`: the install steps from a folder. The installer and the git hook run it in the Node image.

## The log and the download

Settings, Logs shows the last 200 lines of the control log and of the helper log. Verbose shows the last 1000. Refresh reads them again. Download the verbose log saves one text file, `teletraan-log-<date>.txt`, from `GET /control/api/log/download` (it needs the PIN). The file holds a header (release, uptime, disk), the control log, the helper log and what the helper reads from the computer: the python3 version, `docker ps` when the login user may run it without sudo, and the last 300 lines of the journal of each `teletraan-*` unit. The helper word is `log-bundle`; it uses no sudo, so the journal is complete only when the login user may read it (a member of the `systemd-journal` group).

Keys and calendar links are hidden in this file. It is safe to send to a coach. Every line goes through `control/lib/redact.js`, which replaces the value after `SANITY_WRITE_TOKEN=`, `MONDAY_API_TOKEN=`, `TBA_AUTH_KEY=`, `GOOGLE_API_KEY=`, `CONTROL_PIN=` and `CALENDAR_*_URL=` (and any other setting whose name ends in TOKEN, SECRET, PASSWORD or API_KEY), any Bearer token, any JWT, any run of 40 or more letters and digits (so a full 40 character commit id is hidden too) and any calendar link with `<hidden>`. `tests/control-log.test.mjs` plants each kind in the logs and checks the file.
