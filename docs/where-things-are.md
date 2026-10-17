# Where things are

This is the longer guide that used to be the top of the README. It says how
to try the dashboard on a computer, what each folder is for, where each
setting lives and what to run to check your work.

The Teletraan computer is the Mac mini that runs the dashboard on the TV. The team mentor,
[name of the team mentor], is the adult who holds the team's accounts and
passwords and says yes to anything new on the computer. Ask them before you install
software or when a step needs a login or a key.

## Try it on your computer

You need Python 3. Check with `python3 --version`. It should print a number.

Open a terminal in this folder. On a Mac, type `cd ` (with a space) and drag
the folder into the terminal window, then press Enter. On Debian, right click
the folder and choose Open in Terminal. Then run:

    python3 tools/serve.py

The terminal will say `Serving HTTP on 127.0.0.1 port 8080`. That is normal.
Leave it open. Then open http://localhost:8080/dashboard/ in a browser. Press
Ctrl+C in the terminal to stop the server. This server is for trying things
on a computer. On the Teletraan computer the web server in `computer/` does the same job.

The screen shows the editors' own content (production). To try things out with
the sample instead, put `?sample=1` on the end of the address, such as
`http://localhost:8080/dashboard/?sample=1`. While a page shows the sample,
every piece of sample text is in [square brackets] and a SAMPLE CONTENT label
shows on the screen. Nothing in Studio switches it, and `core/source.js` is the
one place that decides. Until the CORS origin is added in the Sanity project (docs/control-page.md,
First time, step 4), which is what lets the screen read Sanity, the screen has nothing
to show on production, so use `?sample=1`. A Studio with nothing published
shows an empty production screen. The browser console shows a 404 line for
`data/live/version.txt`. That is expected: the Teletraan computer writes that file.

A small text at the bottom right of the screen says when Sanity has been out
of reach for over two minutes, and why (core/connection.js). Its last two lines
are the Teletraan computer's name and addresses (core/device.js). To see it on your computer,
open the dashboard with no internet and no saved copy of the content (a private
window), wait two minutes, and put the four values in
`dashboard/data/live/device.json` as in "Finding the computer on the network" in
docs/rebuilding-the-computer.md. Git ignores the files in that folder. The Show
connection status switch in Dashboard Settings keeps a text of this kind on the
screen all the time, with the last read from Sanity and the item counts
(docs/rebuilding-the-computer.md, "Checking the connection").

## The editing screen (Studio)

The Sanity project exists. Its ID, `ybfqe345`, is in `studio/project.js` and in
`dashboard/config.js`, and its dataset is called `production`. What is left is
to run the Studio on a Mac, let the dashboard read from it, type some content
and look at it on the screen. docs/laptop-setup.md has every step.
In short, from the `studio` folder in the Terminal app: `npm install`,
`npx sanity login`, `npm run dev`, then add `http://localhost:8080` (this Mac, and the screen on
the Teletraan computer) and `http://teletraan.local:3229` (the Studio on the computer) as CORS origins in the Sanity project
settings, publish some content, and run `npm run deploy` so the
editors can sign in from anywhere.

## What is where

    dashboard/
      index.html, shell.js    starts everything. index.html also draws the metal gradients
      registry.js             the list of every panel
      package.json            tells Node that the .js files here are modules, so the calendar scripts on the
                              computer can read them (docs/calendars-page.md). Browsers do not use it
      config.js               the weather location, the Sanity project, the fallback content flag, the speeds, the defaults
      frame.js, frame.css     everything that moves: the page change (the slat change and the mechanical
                              change, docs/page-transitions.md), the screws, the logo's entrance, spin and
                              flying hawk, the name effect, the screen glitch and the scheduler that says
                              when each of those may start. frame.css also has the night screen's
                              bounce, spin and fades, and the hidden transitions (docs/hidden-transitions.md).
                              frame.js has pause(reason) and resume(reason) too, the one hold a talk takes on
                              the whole screen: the pages, the effects, the hidden transitions, night mode and
                              the announcements wait until it is let go
      neon-kit.css            the moving neon of Neon Prime, the kit: its lines, ticks and brackets and every
                              keyframe they use (docs/layouts.md, "The kit"). frame.js has the part of it that
                              is timed (the name glitch and the burst at a page change)
      perf.js                 the frame-rate readout, shown with ?perf (the P key hides it)
      tokens.css              the two metals, the screws, sizes and timings
      teams.css               the seven team colors, started at the Prime values, and the four colors the
                              theme Hawktimus takes from them (core/teams.js sets them on the html element)
      trim.css                the rules for the trim choices of a team (round bolts, the other corners cut on
                              the cards, dots on the page, the outlined name, the bar at the
                              start of the ticker and the neon countdown), each for a class that core/teams.js
                              puts on the html element (docs/layouts.md, "Team trim")
      themes/                 one CSS file of colour variables per colour file (Hawktimus, Neon Prime,
                              Alternate), and registry.js listing them. These files are not the themes
                              of the Themes page: those are the folders of styles/. overlays/ has the
                              seasonal packs' colours the same way, and required.js lists the variables
                              a colour file must set. decor/ has what Neon Prime adds to its colours
                              (docs/adding-a-theme.md)
      seasons/                the decorations of the seasonal packs: one file for each pack, with its
                              header mark, its pieces over the panels and its edge decorations
                              (christmas.js is the finished model), motion.css with every keyframe they
                              use, and season.css with the layout of the three layers
                              (docs/seasonal-packs.md)
      layouts/                sidebar.css, the placing of the sidebar layout: a strip across the top with the team
                              name, a column on the left, one big frame scaled up on the right and the ticker
                              across the whole bottom, with no small frame. bar.css, the placing of the bar layout
                              (a banner, a side column, one main panel and the ticker) and its mirror. The numbers
                              are in core/layout.js (docs/layouts.md)
      styles/                 one folder for each theme on the Themes page: original, cybertron and retro
                              (retro is a marked copy of original until it is designed). A folder has
                              tokens.css (the colors), theme.css (frames, textures and type), frame.css
                              and transitions.js. core/style-loader.js finds the folder from the theme id
                              (docs/layouts.md, "Cybertron"; docs/views-and-themes.md)
      subthemes.css           the layer of pictures over a theme and a view (docs/subthemes.md)
      status-dots.css         the three dots at the foot of the screen (core/dots.js)
      build.example.js        the shape of build.js, which the control service writes for each release and
                              kiosk.sh writes when the screen starts. Git ignores build.js itself
      base.css                the fixed 1920x1080 screen and the shared metal shapes. Nothing is responsive:
                              shell.js scales the whole screen to the window (docs/layouts.md, "The screen is
                              a fixed canvas")
      core/                   helpers used by several panels. plate.js draws the frames, and the three steel frames
                              of the bar layout, with Minimal's own three (docs/layouts.md, "Frames") and the
                              four of Cybertron ("Cybertron"), and the housing of the war clock, areas.js keeps
                              the frames in place while pages change and draws them again when a style with other frames
                              goes on, schedule.js says what shows when,
                              panel-order.js holds the older Panel order list in Dashboard Settings, which is hidden now,
                              and the rows of the small frame,
                              logo.js and name.js draw the hawk and the team name (name.js can also put the
                              name on two lines, which nothing uses now), countdown.js is the countdown's parts and
                              the code that writes its numbers, for every layout and for the war clock,
                              countdown-title.js says where the title of the countdown breaks onto a second line, source.js
                              decides sample or production content from ?sample=1 in the address,
                              images.js builds the addresses of photos from Sanity, photos.js says
                              which photos the Photo panel shows and in what order, portrait.js
                              draws a person's framed portrait, with the name under it or as a row,
                              in the shape and with the frame the Portraits settings say, and says
                              how many rows a page holds, leadership.js lists the people of the
                              Leadership panel, team-leads.js
                              makes the rows of the Team Leads panel, roster.js
                              makes the pages of the Subteam roster panel, task-source.js says whether a task
                              is from the team board and keeps only those, theme.js
                              works out which theme and overlay apply, theme-apply.js puts them on the page,
                              layout.js says which layout a theme has, which regions and blocks a layout
                              has, the numbers of the sidebar and bar layouts and when a change of layout
                              that failed may reload the page, layout-apply.js sets the layout on the page before
                              anything is drawn and changes it while the screen runs, and style.js says which style the screen has and which
                              layout a style asks for (docs/layouts.md),
                              teams.js holds the teams, says which one the mode and the clock ask for,
                              says whether an item shows for it (showsForTeam, used by visibleItems in
                              content.js) and puts its colors, the mirror class, its trim, its metal and its
                              glow on the page, and team-run.js asks it once a second and moves the pages on when
                              the team changes (docs/team-on-an-item.md),
                              season.js draws the decorations of the overlay's seasonal pack in three layers
                              and hands its header mark to marks.js, which draws the picture at the right of
                              every panel header (the double slash, or the pack's mark), corner-art.js holds
                              the four ornaments of line art that go in the cut corners, pack-extras.js
                              decides the ticker prefix, banner line and corner art of the pack on the page,
                              transitions.js chooses the style and the metal of the next page change and
                              plans how the frames collapse into a pile and rise again in a hidden
                              transition,
                              look.js turns the Polish setting (polished, flat or plain) into the page
                              switches the stylesheets read (data-finish, data-glint and data-look),
                              events.js filters and sorts the BAND events, and writes the dates of an event,
                              event-pages.js splits those events into the two pages of the Events panel (which scrolls from one to the next),
                              with the kind of each and the pinned ones first (docs/calendar-filters.md),
                              connection.js decides why Sanity could not be read and writes the
                              connection status text at the bottom right, device.js reads the Teletraan computer's
                              name and addresses (data/live/device.json) for the red version of it
                              night.js says when it is night and where the screensaver logo starts,
                              and night-screen.js draws the night screen (docs/night-mode.md),
                              constants.js holds the values that have one right answer: the night times,
                              the speaker wait and the overrun of a talk,
                              demo.js decides when a demo from the Studio's Demo page plays and runs its
                              steps, demo-screens.js lists the screens a demo can show, and
                              demo-runner.js starts it (docs/demo.md),
                              announce.js decides when the Play announcements button plays every
                              announcement that is switched on, and announce-run.js starts it
                              (docs/hidden-transitions.md),
                              notice.js decides which Announcement documents are live and which one
                              is up, and notice-run.js draws the bar under the banner
                              (docs/announcements.md),
                              hidden.js decides when a hidden transition replaces a page change,
                              hidden-transitions.js lists them, hidden-run.js plays them,
                              hidden-pile.js finds the frames that fall at their end and writes where
                              each one lies, and hidden-pictures.js lists their four pictures (in
                              assets/hidden) and which one plays next (docs/hidden-transitions.md),
                              presentation.js decides when a booked talk shows its title card and its
                              slides, what each key of the clicker and each button of the mouse does and
                              which talks were skipped, and presentation-run.js puts that on the screen
                              and reads the keys and the mouse (the cards and the slides are drawn by
                              panels/talk, docs/presentations.md),
                              presentation-test.js decides when the Run presentation test button starts
                              the sample talk, and presentation-test-run.js starts it
                              (docs/hidden-transitions.md),
                              preview.js decides when a Preview button holds a team, a style or a seasonal
                              pack on the screen for 2 minutes, and preview-run.js starts it. What it holds is
                              kept by previewStyle in style.js, previewTeam in teams.js and previewPack in
                              theme.js (docs/hidden-transitions.md, "Preview a look"),
                              screens.js reads the three Screen documents, which are kept for the Monday
                              style and the banner settings and to give a view its first rows
                              (docs/views.md),
                              swap-plan.js decides the one swap of every change of look and of Monday card
                              (which piece starts when, which old piece each new one takes over from, where it
                              re-forms, whether the icon of the logo flutters or only goes with them, and how), swap-run.js plays it on the page, in full motion,
                              calm motion or none, and busy.js says that a transition has the screen
                              (docs/layouts.md, "The swap"),
                              frc.js cleans the frc-status document the computer writes and has the date helpers for
                              it, competition.js decides which competition cards are due now (from the document,
                              the clock and the Competition cards setting) and mixes them into the list of the
                              large panel, competition-draw.js is what the cards share, and competition-preview.js
                              decides when the Preview competition button shows the cards on sample data and
                              competition-preview-run.js starts it (docs/frc-feed.md),
                              monday.js picks and ranks the board tasks for the Monday cards and has the rules of the Monday
                              panels (visible, team, department, overdue, rank, hours, stale), monday-views.js works out
                              what each of the six panels of the task board draws and monday-draw.js draws their header
                              (with the amber STALE chip) and rows (docs/layouts.md, "The Monday cards"), team-title.js writes
                              the name of a team on a header, text-width.js counts the width of a line of capitals,
                              header-room.js has the room a header leaves for its title and for the words at its right
                              end (docs/layouts.md, "The header of a large panel"),
                              tick.js is the one clock of the screen: it tells every panel when a real
                              second starts by reading the time, not by counting, so the digits never
                              drift, and a panel should write to the page only what has changed
      core/ (views and themes)
        views.js              the four views (General, Prime, Nova, Family): their documents, the order,
                              the minutes, the rows of each step and the look of a step (docs/views.md).
                              views-run.js gives it the real screen, and view-apply.js writes the view
                              on the page
        style-loader.js       finds the folder of a theme in styles/ from its id
        anchors.js            the boxes a subtheme can draw in, for each layout, and the frame anchors of the shipped ones
        subthemes.js          picks the live subtheme and its pictures; subthemes-layer.js draws them
                              over the stage once; subtheme-art.js has the drawings the screen has of
                              its own (docs/subthemes.md)
        subtheme-presets.js   the three subthemes the screen ships (halloween, winter, kickoff) and their anchors
        subtheme-shapes.js    the drawings of those three, as text, sized to an anchor
        subtheme-preset-layer.js  draws the chosen one over the frames, and again when the theme or layout changes
        version-label.js      the text of a build, "v14 · a1b2c3d", from build.js
        now-report.js         tells the control page what is on the wall every 10 seconds;
                              now-report-parts.js is the plain half of the report
        dots.js               the rules of the three dots (Monday, Band, Sanity); dots-run.js draws them
        heartbeat.js          writes the time in the page title every 30 seconds, which the watchdog
                              on the computer reads
        still.js              the ?panel= preview address; still-run.js draws the one panel
        competition-address.js  ?competition=1&event= puts the competition cards on with one event's
                              data; competition-address-run.js gives it the page
        takeover.js           the alert and the announcements at set times, which cover the screen
        time.js               turns dates into the text on the screen and reads typed dates
        weather.js            the weather from Open-Meteo, kept for two hours; weather-icons.js draws
                              the pictures
      panels/                 one folder per panel: a script and a stylesheet. panels/side is the whole
                              column of the sidebar layout, in place of the banner and the countdown
                              (docs/layouts.md, "The sidebar"). panels/bar-banner and panels/bar-column are
                              the banner and the side column of the bar layout (docs/layouts.md, "The bar
                              layout"). The war clock in that banner is drawn by panels/countdown, as a
                              second rendering of the countdown (docs/layouts.md, "The war clock").
                              panels/tonight is the Daily Agenda panel, headed AGENDA (docs/up-next.md).
                              panels/competition-* are the seven competition cards, each plain SVG
                              (docs/frc-feed.md). panels/monday-tasks, monday-done, monday-status-depts, monday-overall,
                              monday-timeline and monday-board are the six panels of the task board, and the other
                              panels/monday-* the older cards (docs/layouts.md, "The Monday cards"). panels/team-tile is the small frame's last
                              resort (docs/layouts.md, "Panel B, the small frame")
      fonts/, assets/         fonts and pictures, all served from here
      data/sample/            sample content with marked placeholders, and a sample talk with six slides
                              (slides/presentation-sample)
      data/live/              files the computer downloads (never committed)
    studio/                   the Sanity editing screen, its sidebar (structure.js: one list with a line
                              for each entry, so changing the order means moving a line,
                              docs/reordering-the-sidebar.md, docs/studio-map.md), its buttons (tools/actions.js: the Play buttons of the hidden transitions, Play announcements, Run presentation test and the Preview buttons;
                              tools/team-actions.js: Use the standard colors for this team, with its table in tools/team-standard.js),
                              its pages that are not documents (inputs/start-here.js, inputs/rotation-board-view.js, inputs/themes-view.js, inputs/today-view.js, inputs/look-view.js, inputs/competition-view.js, inputs/kept-data-view.js (each with a -parts.js file that needs no Studio), inputs/field-editor.js and draft-fields.js, which the pages share, inputs/team-colors-input.js, inputs/calendars-view.js and
                              inputs/monday-boards-view.js, whose rows and words are in inputs/calendars-view-parts.js,
                              docs/calendars-page.md, and inputs/monday-boards-parts.js),
                              the words and picture of Start here (inputs/start-here-parts.js), what its request
                              buttons write, shared with tools/actions.js (tools/screen-requests.js), and the address
                              that Preview the screen opens (inputs/dashboard-address.js),
                              its copy of the theme lists (inputs/themes.js), its copy of the demo screens
                              (inputs/demo-screens.js), its copy of the hidden transitions (inputs/hidden-transitions.js),
                              its copy of the previews (inputs/previews.js),
                              the Publish all tool in the top bar (tools/publish-all-tool.js is the page and
                              tools/publish-all.js is its logic, docs/publish-all.md), and tests/schemas.test.mjs.
                              schemas/ has a file for each kind of content. calendarFilter.js is the
                              Calendar filters (docs/calendar-filters.md), presentationDay.js the Meeting
                              days, presentation.js the booked talks and settingsPresentations.js the
                              Presentations tab of Dashboard Settings (docs/presentations.md). team.js is the
                              Teams list and settingsTeams.js the team fields of the Look tab, which are hidden now. settingsLook.js is
                              the Weekday schedule and the hidden Styles by day, Monday style, Team order and How the look changes.
                              screen.js is the three Screens (docs/coaches-guide.md, "Screens"). status.js is the
                              document the computer writes (the status block, settingsStatus.js and inputs/status-input.js), and calendarStatus.js
                              the one it writes for the Calendars page. inputs/time-text.js has the ages in words that
                              both use. frcStatus.js is the document the computer writes for the competition cards,
                              settingsCompetition.js the Competition tab and inputs/frc-status-input.js its connection block.
                              mondayStatus.js is the document the computer writes for the Monday tab, settingsMonday.js
                              the Monday tab, inputs/monday-status-input.js its connection block and inputs/monday-pickers.js
                              the board and column lists of a board entry (docs/monday.md).
                              The form of a Screen is inputs/screen-input.js: the Editing switch, the map (tools/screen-map.js is its
                              boxes) and the first fill of the rows from the Panel order (tools/screen-seed.js). inputs/screen-fields.js has the
                              inputs inside the sections, inputs/screen-context.js what the form shares with them, inputs/screen-parts.js
                              the words and what the form reads from Sanity, inputs/screen-panels.js the panels a row can name and the
                              rules for its team, and inputs/screen-ids.js the three ids and the style each stands for.
                              settingsRotation.js is the ticker seconds of Dashboard Settings and the hidden Panel order list, and
                              inputs/panel-order-input.js fills that list when it is empty. The Team radio on tasks, sponsors and
                              the other kinds of content is inputs/team-input.js, put on each by teamField in fields.js
                              scripts/ has make-templates.mjs, which writes the CSV templates from the
                              schemas, and import-csv.mjs, which checks filled-in CSVs and makes a file
                              for sanity dataset import (docs/importing-from-csv.md)
      views and themes        schemas/view.js is the four View documents (General, Prime, Nova, Family),
                              inputs/view-ids.js their ids and inputs/view-input.js their form, with the
                              map. tools/view-defaults.js is what each view starts with and tools/view-seed.js
                              fills a view that has no rows from the Screens. schemas/settingsViews.js has the
                              view and theme fields of the Look tab. inputs/themes-view.js is the Themes page
                              and holds the weekday schedule, inputs/theme-ids.js and inputs/theme-styles.js
                              are the themes it lists (the folders of dashboard/styles/). schemas/subtheme.js
                              is the Subthemes list (docs/subthemes.md)
      other files             schemas/announcement.js is the bar under the banner (docs/announcements.md),
                              schemas/customPanel.js and customPanelBlocks.js the Extra panels, sponsor.js the
                              Sponsors, tipOrNews.js Tips and News, presentationTimes.js the times in the
                              lists, and index.js the list of every type. inputs/control-address.js is where the
                              control page is, inputs/monday-token-input.js with tools/monday-check.js the Test
                              the token button, inputs/panel-preview.js, preview-panels.js,
                              preview-panels-view.js and row-preview-input.js the panel previews,
                              inputs/note-field.js the one line notes in a form, and tools/add-templates.js what
                              a plus button makes
    control/                  the control page service (docs/control-page.md). server.js starts it and
                              lib/ holds the router, auth (PIN, cookie, lockout), releases, the install steps,
                              the zip reader, the tree hash, the local.env merge, the Studio build, the
                              CORS probe and the client of the host helper. routes/ has one file for each group
                              of calls and index.js loads them in alphabetical order. support/ has what the
                              routes share: http.js, keys.js, requests.js, status-parts.js, now-rows.js,
                              env-file.js and sanity.js. static/ is the pages (index.html and one file for each
                              tab) with the browser copy of the tree hash and the fonts. bin/install-tree.js
                              installs a release from the command line
    computer/                     how the computer runs it: web server, timers, scripts. scripts/check-connection.sh
                              checks the computer's connection to Sanity, BAND, Docker and the kiosk with one
                              OK or FAIL line each (docs/rebuilding-the-computer.md, "Checking the connection").
                              scripts/fetch-calendars.sh downloads the BAND calendars in local.env into the
                              data folder (docs/calendar-links.md) and leaves calendar-sync.txt, a line for
                              each calendar with its last good download and why a download failed.
                              scripts/calendar-status.sh makes the document for the Calendars page from it,
                              and lists the next events when Node is installed, with calendar-status.mjs
                              (docs/calendars-page.md).
                              scripts/check-calendars.sh lists the events of each calendar in local.env,
                              says which ones the Calendar filters hide, and for the others which page of
                              the Events panel they are on and their kind. It needs Node, so it runs on a
                              computer that has it, not on the computer. check-calendars.mjs is the part of it
                              that runs the dashboard's own calendar code.
                              scripts/slides-sync.sh downloads the slides of the coming talks and turns them
                              into pictures in the data folder (docs/presentations.md).
                              scripts/status-write.sh writes the time of a job into the status-mini document
                              in Sanity, for the status block in Dashboard Settings (docs/rebuilding-the-computer.md,
                              "Showing what the computer did in Studio").
                              scripts/frc-sync.sh reads the public FRC data of each team and writes it into
                              the frc-status document in Sanity, and install-frc.sh turns on its timer
                              (docs/frc-feed.md).
                              scripts/monday-sync.sh reads the Monday boards named in Dashboard Settings and
                              writes their items into Sanity as tasks, with the monday-status document, and
                              install-monday.sh turns on its timer (docs/monday.md). Its other parts are
                              monday-contract.sh (where each value sits in an answer, and the limits),
                              monday-requests.sh (asking Monday, writing to Sanity, reading a board),
                              monday-check.sh (--check) and monday-programs.sh (the jq programs).
                              frc-sync.sh is split the same way into frc-contract.sh, frc-requests.sh,
                              frc-modes.sh, frc-read.sh and frc-programs.sh.
                              scripts/lib.sh is read by every script: the folders, the local.env reader
                              (setting) and the config.js reader (config_value). Every script starts with
                              bash, a usage line, set -euo pipefail and lib.sh.
                              scripts/pull.sh, watchdog.sh, nightly.sh, kiosk.sh and display.sh run the
                              screen: the pull, the 2 minute watchdog, the 04:00 restart and the Sunday
                              reboot, the browser, and the detection of the connected display.
                              install-watchdog.sh, install-nightly.sh and install-backup.sh turn on their
                              timers. scripts/control-helper.sh is the host side of the control page.
                              install.sh installs a release of the repository and sets the control page
                              up, sudoers/ lets the helper run the few commands it needs, nginx/ and
                              docker-compose.yml are the web server, and git/ is the optional bare
                              repository.
                              scripts/install-timers.sh turns on the calendar timer and the pull timer,
                              install-calendars.sh only the calendar timer and install-slides.sh the slides
                              timer (docs/rebuilding-the-computer.md, step 11). systemd/ has the unit files they
                              copy into place.
                              scripts/install-console.sh writes the startup drawing above the old text of
                              /etc/issue and turns on teletraan-console.service, which shows the shutdown
                              drawing. The two drawings are console/startup.txt and console/shutdown.txt
                              (docs/rebuilding-the-computer.md, step 13).
    tools/
      serve.py                the server above
      screenshots.mjs         takes a picture of every panel in each view and theme, into _outputs/screens
      sweep.sh, sweep-words.txt  look through the files git tracks for names that do not belong there
      frc-fixture.mjs         turns one past event into the fixture of the competition cards
      zones.html              the zones of the seasonal packs outlined over the dashboard, at
                              http://localhost:8080/tools/zones.html
      teletraan/                 the Mac tool that updates the computer and keeps its keys and calendars:
                              teletraan-tool (the menu, and the words update, status and restart),
                              Teletraan Tool.command (double-click it) and merge-env.sh, which runs on the
                              computer (docs/updating-the-computer.md)
      icons.html              every weather picture on one page, at
                              http://localhost:8080/tools/icons.html
      logo.html               the hawk logo large, with every act and key pose, at
                              http://localhost:8080/tools/logo.html
      perf/                   the comparison page for the speed test: the Tasks panel built
                              from plain plates, in metal or flat, at
                              http://localhost:8080/tools/perf/plates.html
      mac/                    for the Mac you work on: ship.sh checks the code, commits, pushes,
                              deploys the Studio and has the Mac tool update the computer and restart the screen;
                              make-app.sh makes Ship Teletraan.app (docs/shipping-from-the-mac.md,
                              docs/laptop-setup.md for a second Mac)
    tests/                  every test, one file for each module or script (<module>.test.mjs). run.mjs runs them all:
                              node tests/run.mjs, or node tests/run.mjs <word> for the files with the word in the name.
                              A test of a shell script is a Node file that runs the script with fakes in a temporary folder.
      run.mjs                 the runner: three files at a time, one line each, a total, and sh -n and bash -n on every shell file
      computer-scripts.test.mjs   checks that every script in computer/scripts starts the same way (bash, a usage line,
                              set -euo pipefail, lib.sh) and that lib.sh holds the only readers of local.env and
                              config.js. helpers/script-parts.mjs gives a test the parts of a split script
      control-auth, control-keys, control-pages, control-releases, control-request, control-status,
      control-zip-hash, control-helper (.test.mjs)
                              check the control service: the PIN, cookie and lockout, the Keys tab, the text of
                              the tabs, releases and installs, the Now showing requests, the status routes, the
                              zip check and tree hash, and the host helper (docs/control-page.md)
      install-sh.test.mjs     checks computer/install.sh: it refuses a tree with deploy/, moves an old tree into
                              releases/1, installs the helper socket and the sudoers file
      nightly.test.mjs        checks nightly.sh and its units: the 04:00 restart, the Sunday reboot and the skip
                              when a talk is booked within the hour
      display.test.mjs        checks display.sh with a fake xrandr
      no-old-code.test.mjs    checks that the TV never runs old code after an update (the ?v=<build> on every file)
      dots.test.mjs           checks the three dots (core/dots.js)
      subthemes.test.mjs      checks subthemes: the live window, priority, rules, anchors and the layer
      subthemes-part5.test.mjs  checks the three shipped subthemes: frame anchors on every theme and layout, no drawing inside a frame, counts, calm
      theme-folders.test.mjs  checks the four files of each theme folder and the loader
      nova-palette.test.mjs   checks the Nova palette (gold main, purple accent, gold metal)
      small-foot.test.mjs     checks the last line of a page of the small frame in Cybertron against the slashes
      check-preview.test.mjs  checks that the panel preview list is in step with the registry
      frc-event.test.mjs      checks ?competition=1&event= and frc-sync.sh --event with a fake curl
      calendar.test.mjs       checks for the calendar reader, and for the Calendar filters that take events
                              off the screen (core/events.js)
      weather.test.mjs        checks for the weather reader and its pictures
      content.test.mjs        checks for the code that reads the editors' content, the photo
                              addresses, which photos show and in what order, the pages of
                              portraits, of the subteam roster, the subteam members, the events list and the
                              lines of the computer's address, and the reasons and the lines of the
                              connection status text, for the Polish setting: its cleaning, the
                              switches each look sets and the rules for Plain in base.css, and for
                              teams: the cleaning of a team, the team each mode asks for, which items
                              show for which team in every panel, and the Teams settings
      themes.test.mjs         checks for which theme and overlay apply, for putting them on the page, for the
                              ticker prefix, banner line and corner art that a seasonal pack rule can carry, and
                              for putting the team on the page: its nine colors, the mirror class,
                              the classes of its trim, its metal and its glow
      layouts.test.mjs        checks for the layouts: which layout a theme and a style have, the numbers of the
                              sidebar and bar layouts, the mirror, that the screen is always 1920 x 1080,
                              the reload that a failed change of layout falls back to and that it cannot loop, that the scheduler leaves
                              out the small frame, the blocks of a hidden transition, that a seasonal pack
                              draws only what a layout allows, and the war clock: its housing, its digits and
                              labels, its sizes and that it does not move
      seasons.test.mjs        checks for choosing, loading and drawing a seasonal pack (core/season.js), for its
                              header mark (core/marks.js), its over layer and the Look switch that turns that off,
                              for its corner art (core/corner-art.js), for a pack that is missing, broken or slow,
                              and that check-seasons.mjs fails for each kind of mistake
      night.test.mjs          checks for night mode: when it is night in a time zone, where the bouncing
                              logo starts and how often it hits a corner, and the night stylesheet
      presentation.test.mjs   checks for presentation mode (core/presentation.js): when a talk is due, how it
                              goes from the title card to the thanks card, which talks are skipped, and what
                              each key of the clicker does
      screen-seed.test.mjs    checks for the first rows of a Screen (studio/tools/screen-seed.js): the owner's Panel order
                              becomes 16 main rows and five side rows, seconds carry over, a row switched off is left out,
                              and the rules for the team of a row (studio/inputs/screen-panels.js)
      panel-order.test.mjs    checks for the Panel order list (core/panel-order.js): the list built from the
                              two older lists, and what each area of the screen follows
      panel-b.test.mjs        checks that the small frame under the countdown is never empty in the standard layout:
                              the list with its spares and its last resort (core/panel-order.js), the order the real
                              scheduler chooses in, that a row that is off stays off, that the sidebar and bar layouts
                              have no small frame, and the team tile (panels/team-tile)
      fixed-values.test.mjs   checks that the screen ignores the stored night times, speaker wait and overrun,
                              and uses the fixed values in core/constants.js
      effects.test.mjs        checks for when the logo animations, the name effect and the screen glitch may start
                              (frame.js), for choosing the page change style and the metal of the frames, and
                              for when a demo plays and what stops it (core/demo.js), and for when a hidden
                              transition plays (core/hidden.js) and what its stylesheet moves
      hidden-hours.test.mjs   checks that a hidden transition comes about once every so many hours of screen
                              time (core/hidden.js): the chance of one page change, the older percent, the
                              cleaning of the hours and the gap after a transition has played
      tick.test.mjs           checks for the clock of the screen (tick.js) with a fake clock, and that the
                              countdown and the banner write only what changed each second
      publish-all.test.mjs    checks for the logic of the Publish all tool: which drafts are listed, the
                              transaction for each, the order, the skipped reasons and the summary
      templates.test.mjs      checks that the CSV templates match the schemas, and the CSV importer
      check-connection.test.mjs  checks for computer/scripts/check-connection.sh, with fake tools
      slides-sync.test.mjs  checks for computer/scripts/slides-sync.sh and install-slides.sh, with fake tools
      install-calendars.test.mjs  checks for computer/scripts/install-calendars.sh: that it stops before it changes
                              anything, and that it installs the calendar units only
      check-calendars.test.mjs  checks for computer/scripts/check-calendars.sh, with a fake curl
      event-pages.test.mjs    checks for the two pages of the Events panel (core/event-pages.js): four events
                              to a page, no second page for four or fewer, the kind chips, Group events by
                              kind, the pinned events, and the step for each page in the rotation
      events-scroll.test.mjs  checks the scroll of the Events panel: both pages in one list, eight events two pages, five a page
                              of four and a page of one, the step of the list in Original, Minimal and Cybertron, the holds
                              (core/schedule.js with stand-ins) and calm and none (frame.js)
      status-write.test.mjs   checks for computer/scripts/status-write.sh, with a fake curl, that the services and
                              kiosk.sh run it, and that the dashboard never reads the status document
      calendar-status.test.mjs  checks for what the computer writes for the Calendars page: the sync file of
                              fetch-calendars.sh, the document of calendar-status.sh and calendar-status.mjs
                              (SHOWN or HIDDEN with the rule, the error case, no address anywhere, with and
                              without Node), and status-write.sh calendar-status, with a fake curl
      calendars-view.test.mjs checks for the rows and lines of the Calendars page in Studio
      calendars-hide.test.mjs checks for the Hide buttons of the Calendars page: the rules they make, the same
                              id for the same rule, the matching that follows the screen's, Show again, the
                              day and the 40 events the computer lists, and the size of the document
      calendar-node.test.mjs  checks that the calendar scripts run on Node 18: dashboard/package.json makes the
                              dashboard files modules, nothing in their imports needs a newer Node, and both
                              scripts list events with the newer built-ins taken away
      frc-sync.test.mjs     checks for computer/scripts/frc-sync.sh and install-frc.sh, with a fake curl and made-up
                              answers: the requests, the status document, the ETags, the limit of 60 requests, the
                              snapshots, and that the key and the token are never printed or saved
      monday-sync.test.mjs    checks for computer/scripts/monday-sync.sh and install-monday.sh, with a fake curl and
                              made-up boards: the statuses and priorities by label number, the department that
                              gives the Team lead, the dates, the hours, the owner names, the milestones, Show on TV
                              that is never written, a task or milestone that goes, the daily counts, the budget of
                              reads, errors from Monday, and that the tokens are never printed or saved
      monday-docs.test.mjs    checks docs/monday.md and that no other document still describes the old setup
      team-name.test.mjs      checks that a team's name and number come from the Team document only
      build-version.test.mjs  checks the build on the wall (core/build-stamp.js, status-write.sh version)
      sweep.test.mjs          checks tools/sweep.sh, which keeps the words in tools/sweep-words.txt out of the repository
      watchdog.test.mjs, backup-dataset.test.mjs  check computer/scripts/watchdog.sh and backup-dataset.sh
                              with a fake curl and a fake browser page list
      notice.test.mjs         checks the announcement bar under the banner (core/notice.js, core/notice-run.js)
      photo-row.test.mjs      checks the Photos row: its count, the seconds of each photo and the total
      booking.test.mjs        checks the talk booking path with fixtures
      still.test.mjs, previews.test.mjs  check the panel preview address and the Studio side of it;
                              check-preview.mjs checks the list of preview panels against registry.js
      screenshots.test.mjs    checks tools/screenshots.mjs, which takes a picture of every panel
                              (node tools/screenshots.mjs, needs Playwright on a laptop, never on the computer)
      integration.test.mjs  checks where the Monday sync, the preview, the Photos row and the announcement plate meet
      monday-settings.test.mjs  checks for the two Monday settings on the screen's side: the list of boards and the
                              owner switch, and their starting values
      monday-boards.test.mjs  checks for the rows and lines of the Monday Boards page in Studio
      competition.test.mjs    checks for the competition cards (core/frc.js, core/competition.js and the panels in
                              panels/competition-*): the cards due on each day of the season in each mode, the mix into the
                              large panel's list, each card from the sample and with nothing to show, that no text is under
                              44px or runs out of its body, and the guard of Preview competition
      monday-rules.test.mjs, monday-panels.test.mjs, monday-acceptance.test.mjs  check the rules of the Monday panels and the stale
                              chip, the six panels and the department picker of the Screens builder, and the acceptance cases of
                              the order (monday-world.mjs is what they share)
      monday-cards.test.mjs   checks for the older Monday cards (core/monday.js and the panels in panels/monday-*): the
                              ranking, Show on TV off, the weeks around a Monday and
                              the time zone, five rows and +N more, the line of at most 12 points, the sentences with
                              nothing to show, that no text is under 44px but the sizes the order sets, and that a team has the cards only with board tasks
      season-timeline.test.mjs  checks for the season timeline card: the names of the events (the short name, without a year),
                              the numbered dots, TODAY and the countdown on the line, the legend of six rows, +N more events, and
                              that it fits its body
      monday-rows.test.mjs    checks for the rows of the tasks card and the cards of both teams: the mix of ten rows, the page marker
                              and the scroll (frame.js and core/schedule.js with stand-ins), the two cards of both teams, the
                              words beside the chip in a header, the names of a team (core/team-title.js)
      monday-fill.test.mjs    checks that the Monday cards fill the main panel of the bar layout (monday.css and the
                              progress cards), that the standard layout is as it was, and that no weld seam or other
                              vertical line is drawn under a card (core/areas.js, layouts/bar-minimal.css)
      blank-team.test.mjs     checks for a blank team: an item with no team shows for either team, a header has no team chip
                              for things that are for both teams, the cards of both teams read MILESTONES or PROGRESS alone,
                              a row from a board with no team has no label, and no panel has a Prime or Nova flavor
      cybertron.test.mjs      checks for Cybertron on the layout of Original: which layout each style has, its four
                              frames, the stage, the banner and the ticker on their plates, the wide war clock, and
                              that the frames are drawn again when the style changes
      minimal.test.mjs        checks for Minimal on the bar layout: what the order gives it, what it must not have
                              (serial text, hazard stripes, scanlines, slashes, conduit, brackets), and the list of
                              what it shares with Cybertron
      team-trim.test.mjs      checks for the trim of a team: both teams of the sample content on a fake page, the
                              classes of every field, the frames with the other corners cut and the slanted tab
                              (the Prime frame turned across, the 60 degree line, the pieces), and the rules of trim.css
      team-colors.test.mjs    checks for the colors, the metal and the glow of a team: both teams in each style, with the
                              edge gradient and the body color worked out from the stylesheets, and that Prime is as it was in Original
      pile.test.mjs           checks for the hidden transitions' pile: the plan of the collapse, the pile and the
                              rise (at most 40 pieces, 5.5 seconds, every piece back in its place), the stylesheet
                              that moves them, the cube, and the script that finds the pieces on a fake page
      person-rows.test.mjs    checks for the rows of the Team Leads and Leadership panels: four rows to a
                              panel, who is in them, the portrait size, and the sizes in base.css
      photo-fit.test.mjs      checks for the Photo fit setting and the Fit of a photo: which mode a photo
                              has, the photo that fills the body of the panel and the cut that panels/photo/panel.css makes
                              for each frame (worked out from core/plate.js), the plate of the caption and
                              the credit, the fade in frame.css, and the sample photos
      photo-pages.test.mjs    checks for the pages of the Photo panel: how a stay is shared between photos
                              (3 photos at 30 seconds, 7 photos at 30 seconds), the stay worked out from the
                              Panel order row and the Speed setting, and the turns of both orders
      portrait-size.test.mjs  checks for a portrait size above 100: the rows a page holds, the height of a row,
                              the classes that say how many rows are on a page, that Leadership and Team Leads page through everyone and a
                              change of the setting skips nobody (core/turns.js), and the table in the docs
      portrait-settings.test.mjs  checks for the Portraits settings: the two sizes set apart, the old Portrait
                              size copied into both while neither is set, and the shape and the frame
      lead-photo.test.mjs     checks for the photo of a team lead: which address a lead gets (its own photo, the
                              silhouette, or the photo of the person with the same name), the reader, and the
                              Team Leads and Subteam roster panels with their early loading
      presentation-mouse.test.mjs  checks for the mouse in presentation mode: what each button does, the second
                              click of a double click, a click on the card that says the slides are not ready,
                              the context menu, the hidden cursor, and the rotation that starts again
      swap.test.mjs           checks for the swap (core/swap-plan.js): the pull apart, the re-form, the match of old and
                              new pieces and the path of the icon of the logo, and core/swap-run.js against a small stand-in
                              for the page and a clock moved by hand
      swap-smooth.test.mjs    checks that the swap is one gesture: every piece of the old look has a place in the new one
                              (the pieces of seven looks are in tests/data/swap-pieces.json), nothing jumps at the switch,
                              something always moves, and the calm and no motion paths; also the layout changed on the
                              running page (core/layout-apply.js), the regions at the gate (core/areas.js) and the list
                              of the small frame that runs in every layout (core/schedule.js)
      monday-style.test.mjs   checks that the Monday rows are in the Monday style only: the Monday row left out
                              while the style cannot go on the page, and a held look going on in a swap
                              (core/views-run.js on a small page)
      screens.test.mjs        checks for the Screens (core/screens.js): the three documents as they are read, the
                              Screen of each weekday, the rows built from the Panel order, the list of the large
                              panel, and the swap between two rows
      look-rotation.test.mjs  checks the page side of the views (core/views-run.js): what the large panel asks
                              schedule.js, a style and a team held the way a preview holds them, the Next look
                              now guard, the swap as the one way a look goes on, and the docs
      screen-seed-dashboard.test.mjs  checks for the first rows of a Screen on the screen side
                              (core/screen-seed.js): the same Panel order and the same rows as the Studio side
      screen-seed-parity.test.mjs  runs the Studio rule (studio/tools/screen-seed.js) and the screen rule (core/screens.js,
                              core/screen-seed.js) on the same Panel orders and the same Team documents, and checks
                              that the main rows, the side rows and the Monday style come out the same
      install-console.test.mjs        checks for the boot and shutdown drawings (plain 7 bit text, the size, the
                              symmetry of the figure, the same text in the sample content), for
                              install-console.sh in a fake root (it stops before it changes anything, keeps the
                              copy of /etc/issue, and does nothing the second time) and for the unit
      teletraan-tool.test.mjs      checks for the Mac tool in tools/teletraan/ and for merge-env.sh, with fake ssh, scp
                              and rsync: the masking, webcal to https, the merge into local.env, the menu
                              choices, and that no key or calendar link is printed or put on a command line
      teletraan-tool-commands.test.mjs  checks for the words of the Mac tool (update, status, restart, --yes and
                              --computer), with the same fake tools: the steps in order, the exit code of a failing
                              step, and that nothing secret is printed
      ship.test.mjs    checks for tools/mac/ship.sh, with a fake git, node, npm, ssh and rsync on a PATH
                              that holds no real one: the steps in order, a failing step stops the rest, --dry-run
                              runs nothing, no question about a hostname, the look at this Mac and at GitHub
                              first, and that no key is printed
      laptop-docs.test.mjs    checks for docs/laptop-setup.md and the shipping docs: the steps, one command in
                              each code block, the plain style, and that the commands the guide names exist
      title-plate.test.mjs    checks for the header of a large panel: where the line that ends the tab is in every frame
                              (Original, Cybertron and Minimal, both teams, the slanted tab), that the title has its room
                              before it and the words theirs after it, the widest titles and dates, the slashes left out
                              when the words need the room, and that the Photo panel has no title
      plate-edges.test.mjs    checks for the thin plate edge: its widths against the other frames', the TEAM plate and
                              the ticker's tag and frame, and that the text on them (TEAM and the number, the name
                              above, TELETRAAN I under, the ticker's line and its word) has 2 px clear of the metal
      countdown-title.test.mjs  checks for the title of the countdown: how wide it is in the display font and where it
                              breaks, what the red countdown and the two war clocks write for it (one line at 36 px,
                              two lines, a smaller size), the room in panels/countdown/panel.css, and the Studio field that warns
                              above 28 characters
      hawk-cadence.test.mjs   checks for the Hawktimus icon: the usual mark at rest for both teams, the flying hawk every
                              5 minutes with a swap not starting the count again, and what the icon does in a swap
                              (a slight flutter, only carried by a Monday card, none in calm and no motion)
      check-seasons.test.mjs    fails if a seasonal pack is not in the data format, has a piece outside its zone, too
                              many pieces, a forbidden word, no header mark, a mark bigger than its box (60 x 76),
                              fewer than 8 or more than 14 pieces over the panels, an over piece that is too big,
                              solid or quick, an ornament of corner art that leaves its box or has a fill, or
                              animation anywhere but seasons/motion.css
      check-themes.test.mjs     fails if a theme or overlay is missing a variable or has text that is
                              hard to read
      data/                   the calendar files calendar.test.mjs reads, and the pieces of seven looks that
                              swap-smooth.test.mjs reads (swap-pieces.json, measured in a render at 1920 x 1080)
    docs/                     how-to guides: students.md (the students' page, with the parts of the
                              Start here page; using-the-studio.md points to it), monday-one-pager.md (the
                              project manager's page for the Monday boards), announcements.md (the bar under the banner), coaches-guide.md (the coaches' page: the tabs, the status block, the
                              three keys, the Screens and the feeds, with links to the detail),
                              editing-content.md, adding-a-field.md, adding-a-panel.md,
                              adding-a-theme.md, layouts.md, adding-a-holiday-overlay.md, seasonal-packs.md, rebuilding-the-computer.md,
                              try-it-on-the-computer.md, the-logo.md, page-transitions.md, night-mode.md,
                              hidden-transitions.md, demo.md, publish-all.md, reordering-the-sidebar.md, studio-map.md,
                              importing-from-csv.md, presentations.md, up-next.md, calendar-filters.md,
                              calendar-links.md, calendars-page.md, hide-a-repeating-meeting.md, switch-the-look.md,
                              add-the-nova-team.md, team-on-an-item.md, frc-feed.md, monday.md, updating-the-computer.md,
                              shipping-from-the-mac.md and laptop-setup.md.
                              seed/ has content to import into the Studio: places.ndjson, the three
                              starting places, teams.ndjson, the two starting teams, and extra-events.ndjson, the
                              old Events Calendar entries, which the screen no longer reads. content-templates/ has one CSV template for each
                              kind of content (importing-from-csv.md)

## Changing things

Values saved in Dashboard Settings (in the editing screen) win. The file
`dashboard/config.js` only fills in what the editors have not set. The Studio
has a copy of each starting value in `studio/schemas/`, and
`tests/schemas.test.mjs` fails if the two copies differ, so change both. To
change what is on the TV today, use Dashboard Settings and leave the files
alone.

- **The Kickoff date.** Dashboard Settings, Countdown tab. The starting value
  is `defaultSettings.countdown.kickoff` in `dashboard/config.js`, written like
  `2027-01-09T12:00`, and its copy `initialValue` in
  `studio/schemas/dashboardSettings.js`, written in UTC. The countdown counts
  to 12:00 noon on that day, on the Teletraan computer's clock, which is set to Eastern
  time. Noon is a guess and not the real start time of the event, so set the
  real time in Dashboard Settings.
- **How long a panel stays, and in what order.** Dashboard Settings, Screen
  tab. "Seconds per page" is the time for the whole board (`pageSeconds` in
  `dashboard/config.js`, 20 to start). The small panel stays three quarters as
  long and the ticker one and a half times as long. A row of a Screen can
  have seconds of its own, and then that is used instead. The order is the rows of
  the three Screens (Screens, under Start here, `studio/schemas/screen.js`): `mainRows` and `sideRows`.
  A Screen with no rows gets them from the older Panel order list (`rotation.order`, hidden now),
  and while that is empty from the lists in `defaultSettings.rotation` (`core/panel-order.js`,
  `studio/tools/screen-seed.js`). The panels a row can name are in `studio/inputs/screen-panels.js`.
  The Weekday schedule (`screenSchedule` in `defaultSettings`) picks the Screen of each day.
  The Photo row is the exception: it has `photoCount` (1 to 20, 4 to start) and
  `secondsPerPhoto` (5 to 60, 10 to start) in place of its seconds, which are their product
  (`photoRowOf` in `dashboard/core/screens.js`, `takeRun` and `rowPlan` in `dashboard/core/photos.js`).
  `photoSeconds` in the Screen tab is hidden and not used any more.
- **The colour of the frame edges.** Dashboard Settings, Screen tab, Frame
  metal: Gold or Silver. It is the metal of the banner, the countdown and the
  logo, which never change. Glint turns the bright spark that runs round each
  frame on or off. The metals are the `--metal-` colours in
  `dashboard/tokens.css`. Try them with `?metal=gold`, `?metal=silver` and
  `?glint=off`.
- **How much polish the frames have.** Dashboard Settings, Screen tab, Polish:
  Polished (as now, the default), Flat or Plain. Flat is the flat finish with
  no glint, and Plain is Flat with no screws on the frames and no double slash
  in the panel headers. The list of looks and the starting value (`looks` and
  `defaultSettings.look`) are in `dashboard/config.js`, and the field is in
  `studio/schemas/dashboardSettings.js`. `core/look.js` turns the look into the
  `data-finish`, `data-glint` and `data-look` switches on the html element
  (`useLookSetting` in `shell.js` does it at every content change, so a change
  in Studio shows at once), and the two rules for Plain are in `base.css`, next
  to the flat finish. It works with every theme. Try one with `?look=polished`,
  `?look=flat` or `?look=plain`: the address wins over the setting for that page
  only, and `?finish=` and `?glint=` in the same address win over the look. To
  add a look, see the first lines of `core/look.js`.
- **How a page changes, and the metal of the page frames.** Dashboard Settings,
  Look tab (docs/page-transitions.md): Page change style (alternate,
  slat or mechanical), Break and rebuild time, Frame finish (mostly gold,
  alternate, gold or silver only) and Silver chance. The starting values are
  `pageChangeStyle`, `breakSeconds`, `frameFinish` and `silverChance` in
  `defaultSettings` in `dashboard/config.js`, and the limits are `limits`
  there. The Studio fields are all in `studio/schemas/settingsTransitions.js`,
  so the whole section can be removed by deleting that file. `core/transitions.js`
  chooses, `frame.js` starts the change and `frame.css` has the motion. Try them
  with `?change=slat|mechanical|alternate` and
  `?frames=gold|silver|alternate|mostly-gold`.
- **Night mode, the screensaver.** Dashboard Settings, Advanced tab
  (docs/night-mode.md): Use night mode, Night style, Logo width, Bounce speed
  and Preview night mode. The start and end times are fixed in
  `dashboard/core/constants.js`. The starting values are
  `nightEnabled`, `nightStyle`, `nightLogoWidth`,
  `nightSpeed` and `nightPreview` in `defaultSettings` in `dashboard/config.js`,
  with `nightSpeeds` (the seconds the logo takes to cross the screen) and
  `limits` there. The Studio fields are all in `studio/schemas/settingsNight.js`,
  so the whole section can be removed by deleting that file. There is no time zone
  setting: night mode uses the Time zone on the Look page. `core/night.js`
  decides when it is night and where the logo starts, `core/night-screen.js`
  shows and hides the black layer, and `frame.css` ("Night mode") has the
  bounce, the spin and the fades. Try it with `?night=on` and `?night=off`.
- **Hidden transitions.** Dashboard Settings, Advanced tab (docs/hidden-transitions.md):
  Allow hidden transitions, Desktop reveal every (hours) and Red eyes every (hours), and Last push, with
  the buttons Play desktop reveal and Play red eyes in the menu beside Publish. The starting
  values are `hiddenEnabled`, `desktopEveryHours`, `redEyesEveryHours`, `desktopChance`, `redEyesChance`
  and `hiddenRequest` in `defaultSettings` in `dashboard/config.js`, with `limits` there. The two chances
  are hidden and only a page saved before the hours existed uses them, and `hiddenGapHours` there is the
  4 hours after one has played in which none comes about by chance. The Studio fields are all in
  `studio/schemas/settingsHidden.js`, the buttons are made in `studio/tools/actions.js` from
  `studio/inputs/hidden-transitions.js`, a copy of `hiddenTransitions` in
  `dashboard/core/hidden-transitions.js`. A new transition is one entry in each, plus an hours
  field and a chance field. `core/hidden.js` decides, `core/hidden-run.js` plays, and `frame.css` ("Hidden
  transitions" and "The blue glitch") moves the glitches. Both collapse the frames into a pile
  before the effect and end with a cube putting them back (`core/hidden-pile.js`,
  `planPile` in `core/transitions.js`, and "The frames collapse and come back" in `frame.css`). The four
  pictures are in `dashboard/assets/hidden/`, and `core/hidden-pictures.js` says how each one
  fills the screen and which one plays next. Try one with `?hidden=desktop` or `?hidden=redEyes`.
- **Play announcements.** A button in the menu beside Publish on Dashboard Settings
  (docs/hidden-transitions.md) that plays every announcement that is switched on, once, whatever
  its time and days. It writes the hidden `announceRequest` field (`announceRequestField` in
  `studio/schemas/settingsAnnouncements.js`, the button is `usePlayAnnouncementsAction` in
  `studio/tools/actions.js`). The starting value is `announceRequest` in `defaultSettings` in
  `dashboard/config.js`. `core/announce.js` decides and `core/announce-run.js` plays it. A Demo step
  can use it too: All announcements in `demoScreens`. The Start here page has this button too, and
  both write what `announceRequest` in `studio/tools/screen-requests.js` gives.
- **Preview buttons.** The last five buttons in the same menu (docs/hidden-transitions.md, "Preview a look"):
  Preview Prime, Preview Nova, Preview Cybertron, Preview Minimal and Preview next pack. Each shows its look on
  the screen for `previewSeconds` (2 minutes) in `dashboard/config.js` and then the saved settings come back,
  and none writes a setting. They write the hidden `previewRequest` field (`previewRequestField` in
  `studio/schemas/settingsPreview.js`, the buttons are `previewActions` in `studio/tools/actions.js`, made from the
  list in `studio/inputs/previews.js`, a copy of `previewKinds` in `dashboard/core/preview.js`). The starting value is
  `previewRequest` in `defaultSettings` in `dashboard/config.js`. `core/preview.js` decides and
  `core/preview-run.js` runs it.
- **Run presentation test.** The button after Play announcements in the same menu
  (docs/hidden-transitions.md). It starts the sample talk, with its six sample slides in
  `dashboard/data/sample/slides/presentation-sample/`, and needs no internet. It writes the hidden
  `presentationTestRequest` field (`presentationTestRequestField` in
  `studio/schemas/settingsPresentations.js`, the button is `useRunPresentationTestAction` in
  `studio/tools/actions.js`). The starting value is `presentationTestRequest` in `defaultSettings` in
  `dashboard/config.js`. `core/presentation-test.js` decides, `core/presentation-test-run.js` reads the
  sample talk and `startTestTalk` in `core/presentation-run.js` puts it on the screen. The Start here
  page has this button too, and both write what `presentationTestRequest` in
  `studio/tools/screen-requests.js` gives.
- **Next look now and Preview competition.** Two buttons on the Start here page only. Each writes a hidden
  field of Dashboard Settings, `nextLookRequest` and `competitionPreviewRequest` (`nextLookRequestField` and
  `competitionPreviewRequestField` in `studio/schemas/settingsRequests.js`), through `studio/tools/screen-requests.js`.
  The starting values are in `defaultSettings` in `dashboard/config.js`, and `fixSettingValues` in
  `dashboard/core/content.js` keeps each one a time or empty.
- **The competition cards.** Dashboard Settings, Competition tab (docs/frc-feed.md). The mode, Auto, Always or
  Off, and a switch for each of the seven cards are in `studio/schemas/settingsCompetition.js`, with the
  starting values in `defaultSettings`, the lists in `competitionModes` and `competitionSwitches` and
  `competitionLeadDays` (2 days) and `competitionPreviewSeconds` (120) in `dashboard/config.js`. The cards
  are the panels `dashboard/panels/competition-*`, flagged `competition: true` in `registry.js`, and the
  list of them with the rule for each is `cards` in `dashboard/core/competition.js`. The data is the
  document `frc-status` (type `frcStatus`, `studio/schemas/frcStatus.js`), which `computer/scripts/frc-sync.sh`
  writes and `core/sanity.js` reads with the rest of the content and `core/frc.js` cleans. It is public. The
  Preview competition button on Start here writes `competitionPreviewRequest`, and
  `core/competition-preview.js` and `core/competition-preview-run.js` show the cards on the sample data in
  `dashboard/data/sample/content.json`. The block at the top of the tab is `studio/inputs/frc-status-input.js`.
- **The Monday board.** Dashboard Settings, Monday tab (docs/monday.md). The task board, the milestones board, how
  often the computer reads and the owner switch are in `studio/schemas/settingsMonday.js`, with the starting values
  `mondayTaskBoard`, `mondayMilestoneBoard`, `mondayEveryMinutes` and `mondayShowOwners` in `defaultSettings` in
  `dashboard/config.js` and at the top of `computer/scripts/monday-sync.sh`; `tests/schemas.test.mjs` and
  `tests/monday-sync.test.mjs` fail when the three differ. The older `mondayBoards` list is hidden and not read. The
  computer reads the settings, and `fixSettingValues` in `dashboard/core/content.js` only keeps them tidy.
  `computer/scripts/monday-sync.sh` writes the tasks (id `task-monday-` and the item number, `source` monday, the
  status, priority, `showOnBoard`, `contact`, `owners`, `startDate`, `dueDate`, `estHours`, `completedOn`,
  `milestoneIds` and `hiddenReason`, `mondayBoardId` and `mondayBoardName`), the milestones (id `milestone-monday-` and
  the item number, type `milestone`, `studio/schemas/milestone.js`) and the document `monday-status` (type
  `mondayStatus`, `studio/schemas/mondayStatus.js`, with the boards the token can see, `taskCount`,
  `hiddenUnassigned` and the count of reads, `callsToday` and `callsDate`). The block at the top of the tab is
  `studio/inputs/monday-status-input.js`, and the board and column lists of the pickers are `studio/inputs/monday-pickers.js`, which read
  `monday-status`. The CSV template of a task has no column for the fields the sync writes.
- **The Monday panels.** The six panels of the task board are `dashboard/panels/monday-tasks`, `monday-done`,
  `monday-status-depts`, `monday-overall`, `monday-timeline` and `monday-board` (docs/monday.md, "The eleven panels"),
  flagged `monday: true` in `registry.js`, in no Panel order list and in no starting list. `dashboard/core/monday.js` has the
  rules (which task is visible, its team and department, overdue, rank, hours, the stale chip), `core/monday-views.js`
  works out what each panel draws, and `dashboard/monday.css` has what they share. A Monday row of a Screen (`core/screens.js`)
  gets its department from the row. The older cards (`monday-milestones`, `monday-progress` and the two for both teams,
  docs/layouts.md, "The Monday cards") stay in the registry and `mondaySteps` and `bothSteps` still give their steps; a saved
  row that names one plays as the tasks panel. A card with more than five rows scrolls: `scrollPages` in its script,
  `core/schedule.js` and `scrollCard` in `dashboard/frame.js`. The daily counts and `lastSyncAt` are in the document
  `monday-status`, which `core/sanity.js` reads and `tidyMondayStatus` cleans.
  `dashboard/data/sample/content.json` has board tasks and milestones for both teams and a `monday` document.
- **The demo.** The Demo page in Studio (docs/demo.md), which has no buttons and no line in the sidebar now:
  the Steps and the Demo announcement text. The starting values
  are `defaultDemo` in `dashboard/config.js` and their copy in
  `studio/schemas/demo.js`, with `limits.demoSeconds` and `demoMaxSteps` there.
  The screens a demo can show are `demoScreens` in `dashboard/core/demo-screens.js`
  with a copy in `studio/inputs/demo-screens.js`. A new screen is one entry in each
  (docs/demo.md). `core/demo.js` decides when a demo plays and runs the steps.
- **The logo animations and the team name effect.** Dashboard Settings, Look
  tab (docs/the-logo.md). A master switch, the entrance, and for the spin, the
  flying hawk and the name effect a switch, the seconds between plays (0 is
  never) and the seconds one play lasts. The starting values are
  `logoAnimations`, `logoEntrance`, `logoSpin`, `logoSpinEvery`,
  `logoSpinDuration`, `logoHawk`, `logoHawkEvery`, `logoHawkDuration`,
  `nameTransform`, `nameEvery` and `nameDuration` in `defaultSettings` in
  `dashboard/config.js`, and the limits are `limits` there. `logoHawkEvery` and
  `nameEvery` are hidden and not read: each Screen says in minutes how often the
  hawk and the name effect play. The Studio fields
  are all in `studio/schemas/settingsLogo.js`, so the whole section can be removed
  by deleting that file. `frame.js` decides when any of them may start (one at
  a time, never while a page is changing), and `frame.css` has the motion.
- **The screen glitch.** Dashboard Settings, Screen tab, Screen glitch: a
  switch, the seconds between glitches (0 is never) and the seconds one lasts.
  The starting value is `crt` in `defaultSettings` in `dashboard/config.js`.
  The glitch is the old television effect over the whole screen, and it
  waits in the same line as the logo animations. A published glitch that still
  has `everyMinutes` is read as seconds (`tidyGlitch` in
  `dashboard/core/content.js`).
- **The announcement times and words.** Dashboard Settings, Screen
  tab. The starting values are `defaultSettings.announcements` in
  `dashboard/config.js` and `startingList` in
  `studio/schemas/settingsAnnouncements.js`. The announcement panel keeps
  one more copy of the first line, for an announcement that has none.
- **Sample or production content.** The screen always shows production. A
  page shows the sample when its address has `?sample=1` (docs/editing-content.md,
  "Sample content"). `askForSample` and `chosenSource` in `dashboard/core/source.js`
  decide, and `shell.js` passes them the address. Content source and Switch back
  to production at are still hidden fields in `studio/schemas/dashboardSettings.js`,
  so that nothing saved is lost, and the dashboard does not read them.
- **What the computer last did.** Dashboard Settings, Screen tab, Status of the Teletraan computer.
  The computer writes the document `status-mini` with `computer/scripts/status-write.sh`,
  which the calendar and slides services and `kiosk.sh` start, and which needs
  `SANITY_WRITE_TOKEN` in `computer/local.env` (docs/rebuilding-the-computer.md, "Showing
  what the computer did in Studio"). The type is `studio/schemas/status.js` and the block
  is `studio/inputs/status-input.js`. The dashboard never reads it.
- **Photos for the Photo panel.** Photos in the Studio sidebar
  (`studio/schemas/photo.js`): a picture, an optional caption, a first name
  credit, "Show on screen" and "Hide after". Dashboard Settings, Screen tab: Photo
  order (random or newest first) (`photoOrder` in `dashboard/config.js`; the old
  Seconds per photo, `photoSeconds`, is hidden and a Photo row of a Screen sets its own), the Portraits box below and
  Photo fit (`photoFit`, with `photoFits` in `dashboard/config.js`).
  The screen reads them with the rest of
  the content (`photos` in `core/sanity.js`) and asks Sanity for each at no more
  than 1920 pixels wide (`screenPhotoUrl` in `core/images.js`). `core/photos.js`
  chooses the photos of each turn of the panel (`makePhotoQueue`) and says how
  many there are and for how long each stays (`turnPlan`, from the stay that
  `photoStay` works out), and the panel in `panels/photo/` starts loading the
  photo that opens the next turn. docs/editing-content.md has the advice for the
  people who upload. The sample content's `photos` list is what shows on the sample. There is
  no photo list file on the computer.
- **How big the pictures are.** Dashboard Settings, Screen tab: the Portraits
  box, and "Photo size, percent" (`photoScale`, hidden and not used, because a
  photo fills the panel). The Portraits box has "Leadership portrait size, percent"
  (`leadershipPortrait`), "Team leads and Roster portrait size, percent"
  (`rosterPortrait`), "Portrait shape" (`portraitShape`: `square`, `rounded` or
  `circle`) and "Portrait frame" (`portraitFrame`: `metal`, `line` or `none`).
  Each size is a whole percent from 60 to 220 starting at 100, where 100 is a
  portrait of 120 pixels in a row (see "Photos of people" below for what a
  bigger portrait changes). The old "Portrait size, percent" (`portraitScale`)
  is hidden in the form and stays in the schema. `portraitPercentOf` in
  `core/content.js` copies it into both sizes while neither has been saved,
  in the dashboard's reading of the settings, and writes nothing to Sanity. The starting values and
  the limits are in `dashboard/config.js` (`defaultSettings`, `limits`,
  `portraitShapes` and `portraitFrames`), and the Studio fields
  in `studio/schemas/settingsPhotos.js`. `fixSettingValues` in
  `core/content.js` rounds and clamps them (`tidyScale`), and anything missing
  or odd is the starting value. The portraits: `portraitSizes` in `core/portrait.js` works out
  the card, the photo and the space between them (292, 280 and 6 at 100) and
  `slotMarkup` hands them to `base.css` as three variables on the `.portrait`
  element. The card is always drawn 292 square and the browser draws it
  smaller, which keeps its metal edge and cut corner in proportion. The slot
  stays 352 wide and the text keeps its size, so a smaller portrait is only
  centred in its slot, and the slot never grows past 100. `portraitLook` gives
  the shape and the frame from the settings. The usual look, a square with the
  metal edge, adds nothing to the markup. Another shape or frame adds a class
  (`shape-rounded`, `shape-circle`, `frame-line`, `frame-none`) and hands the
  clip of the picture to `base.css` as `--portrait-clip`, and
  `--portrait-clip-flipped` for the team trim that cuts the other corner
  (`trim.css`). The Photo panel has
  no size of its own: the photo fills the body of the frame (next point).
- **Fill the frame or show the whole photo.** Dashboard Settings, Screen tab,
  Photo fit (`photoFit`: `fill` or `whole`, starting at `fill`), and the Fit
  field of a Photo (`fit`: `setting`, `fill` or `whole`) in
  `studio/schemas/settingsPhotos.js` and `studio/schemas/photo.js`. `fixSettingValues`
  in `core/content.js` turns an unknown setting into `fill`, and `normalizePhoto`
  in `core/sanity.js` keeps a photo's `fit` only when it is `fill` or `whole`,
  and adds its `size`, the part the editor kept in pixels (`keptSize` in
  `core/images.js`), which the panel no longer reads. `fitOf` in `core/photos.js` says
  how a photo is drawn. `panels/photo/panel.js` only draws: one `figure.shot` for
  each photo of the turn, each with `data-fit`, on top of each other in
  `.photo-body`, which is one slat. In `panels/photo/panel.css` a shot is cut with `object-fit:
  cover` or, shown whole, `contain` on the color of the body of the frame.
  `.photo-body` is the whole panel under the header and is cut to the body of the
  frame on screen: the rules in `panels/photo/panel.css` are written for each frame the large
  panel can have, found by the `data-frame` of the area (`frameKind` in
  `core/plate.js`), a little in from the metal because the page lies over the
  frame. `tests/photo-fit.test.mjs` works the shapes out from `core/plate.js`
  and holds the stylesheet to them, so when a frame changes, that test says which
  rule to change. The fade from one photo to the next is in `frame.css` (`.photo
  .shot`), and `--hold` and `--shot` on the page time it. The caption and the credit
  are on one plate (`.note`, in the color of the team's plates) in each shot.
  `tests/photo-fit.test.mjs` and `tests/photo-pages.test.mjs` have the tests.
- **Photos of people.** Leadership in Studio, Photo and "Show photo on
  screen" (docs/editing-content.md). A Team lead (`studio/schemas/subteam.js`)
  has the same two fields, right after Lead. The screen asks Sanity for each
  photo at the size it is shown, 280 by 280 pixels, in `core/portrait.js`, and
  for a Team lead's photo in the same way as for a person's (`contentQuery` in
  `core/sanity.js`, tidied by `normalizeSubteam`). `leadAddress` in
  `core/portrait.js` gives the address for a team lead: its own photo, the
  silhouette when its switch is off, and otherwise the photo of the person in
  Leadership with the same name (`personNamed`), as before the field existed.
  The Team Leads rows, the Subteam roster slot and their early loading all use
  it. The silhouette for a person with no photo is drawn once in
  `dashboard/index.html`, and its four colours are the `--silhouette-`
  variables in `dashboard/tokens.css`.
  Four rows fit on a panel at a portrait size of 100 and below, set by
  `rowsPerPage` in `core/portrait.js`, and `rowsMarkup` draws them. Above 100 a
  row is taller and fewer fit: `rowLayout` gives `rows` from the table `rowSteps`
  (4 up to 100, 3 up to 138, 2 up to 200 and 1 up to 220), the `height` of a row
  (the body of 576 divided by the rows: 144, 192, 288 or 576). `rowsMarkup` hands the
  height to `base.css` as `--row-height` and adds the class `rows-4`, `rows-3`,
  `rows-2` or `rows-1`, which the stylesheet reads: a page of four has no room for the
  third line, and a page of two or one lets the name take two lines. Leadership
  takes its size from `leadershipPortrait`, and Team Leads and the Roster slot
  from `rosterPortrait`, so the two panels can be at different sizes.
  `core/leadership.js` lists the people of the Leadership panel: the coaches,
  then the captains, then the mentors. `core/team-leads.js` makes the rows of the
  Team Leads panel, one for each subteam in the order of the Order field. Both
  panels show one page each time they come round, with the size of the page
  from `rowLayout` at each turn (`makePages` in `core/turns.js` goes on from the
  first person not shown yet when the size changes), so nobody is dropped. The
  rows are in the section People portraits in
  `dashboard/base.css`: four of 144 pixels fill the 576 pixel body, as in the
  Events panel. A row is the portrait, then the name (72 pixels), the role (44, in
  the team accent) and the line (36, quiet) stacked beside it, and a chip at the
  right end; a 2 pixel rule in the team's plate color is under each row but the last.
  Leadership's chip is `chipOf` in `core/leadership.js`: the Role of the person
  (the field `title`), in capitals, or the role when no Role is typed. A Leadership
  row has no second line and no metal on the frame, and the Group field is hidden
  and not read. The Team Leads chip is the subteam name, and its
  third line is the Line field of the subteam, or the subteam name. In a row the portrait is 120 pixels square at 100 (`rowSizes` in
  `core/portrait.js`), up to 264 at 220, and on the Subteam roster panel it is 292 pixels square with the
  280 pixel photo 6 pixels in from the edge (`portraitSize`). The photo is
  always asked for at 280, whatever the portrait size setting says, so the copy
  loaded ahead of time is the one shown. `showcaseOf` in `core/team-leads.js` is
  there for a later mode that shows one subteam's lead and its members. Nothing
  calls it yet. `tests/person-rows.test.mjs`, `tests/leadership-role.test.mjs`,
  `tests/portrait-size.test.mjs`, `tests/portrait-settings.test.mjs` and
  `tests/lead-photo.test.mjs` have the tests of the rows and the photos.
  In Cybertron the rows end above the slashes of the frame
  (`tests/stripe-foot.test.mjs`).
  The starting value of the switch is `defaultPerson.showPhoto` in
  `dashboard/config.js` and its copy in `studio/schemas/person.js`, which
  `studio/schemas/subteam.js` follows.
- **Subteam members.** The Members list of a subteam in Studio
  (`studio/schemas/subteam.js`): first names, up to 24 of 12 characters, with no
  digits and no repeats. The screen tidies them in `normalizeSubteam` in
  `core/sanity.js` (trimmed, no repeats, at most 24, always a list).
  `core/roster.js` makes the pages of the Subteam roster panel, 16 names to a
  page, and the panel is in `panels/roster/`. Its two columns are 344px wide in
  `panels/roster/panel.css`, which holds a name of 12 characters at 56px.
- **The events.** They come from the BAND calendars (`core/calendar.js`). Events
  Calendar in Studio (`studio/schemas/extraEvent.js`) is still a kind of content, but it
  has no line in the sidebar, the New menu does not offer it, and the screen no longer
  reads it: there is no `extraEvents` in `core/sanity.js`. `core/events.js` takes out the
  events a Calendar filter hides, sorts by start, and drops an event once its last day
  has passed in the Time zone on the Look page. `shell.js` does it again when the
  content changes and once a minute. The Events panel and the Next event tile only draw
  the list. Both write the date with `eventDate()` in `core/events.js`, in the
  Time zone on the Look page: the month with the day (`APR 2`), the weekday
  where the panel shows one, and a range as `APR 2-4` or `MAR 30-APR 1`. An
  all-day event shows its date and no time. The old seven entries are in
  `docs/seed/extra-events.ndjson`, and there is no need to import them.
- **Where the weather is taken from.** `location` in `dashboard/config.js`
  only. Editors cannot change it. Use latitude and longitude: in the United
  States latitude is positive and longitude is negative. Temperatures are
  shown in Fahrenheit.
- **How fast a page changes.** How long each move takes is in
  `dashboard/tokens.css` and `dashboard/frame.css`. Both are written for
  normal speed. Panels never contain animation code.
- **How fast everything goes.** Dashboard Settings, Screen tab, Speed: Very
  slow, Slow, Normal or Fast. It makes every move, and how long each panel and
  ticker line stays, 2, 1.5, 1 or 0.75 times as long. A panel never stays less
  than 5 seconds. The announcements and alerts, the clock, the countdown and
  the weather and calendar updates do not change. The numbers are `speeds` in
  `dashboard/config.js`. The starting value is `defaultSettings.speed` there,
  and its copy in `studio/schemas/dashboardSettings.js`.
- **When the logo animations first play.** The name effect plays 2 seconds after
  the logo starts, the flying hawk at 13 seconds and the spin at 50 seconds. After
  that each repeats at its own interval. See docs/the-logo.md.
- **The connection status text.** Dashboard Settings, Advanced tab, Show
  connection status (`showConnectionStatus` in `defaultSettings` in
  `dashboard/config.js`, the Studio field in `studio/schemas/dashboardSettings.js`).
  `core/connection.js` works out the lines and the reason, and `shell.js` draws
  them into `#connection-status`. It comes up in red by itself after two minutes
  without Sanity. The command for the computer is `computer/scripts/check-connection.sh`
  (docs/rebuilding-the-computer.md, "Checking the connection").
- **The theme (the colours of the whole screen), and seasonal packs (holiday
  overlays).** Look in Studio. Its Default theme, "Use a theme now", Schedule and Time zone
  decide which theme and overlay show. The themes are the files in
  `dashboard/themes/` and the lists are `registry.js` there and in
  `dashboard/themes/overlays/`, with a copy in `studio/inputs/themes.js`. The starting
  values are `defaultThemeSettings` in `dashboard/config.js` and their copy in
  `studio/schemas/theme.js`. A new theme is docs/adding-a-theme.md and a new
  overlay is docs/adding-a-holiday-overlay.md. An overlay may also have
  decorations (a header mark, pieces over the panels and edge decorations), which
  together make a seasonal pack:
  `dashboard/core/season.js` draws them from `dashboard/seasons/<id>.js`, and
  docs/seasonal-packs.md explains the mark, the over layer, the zones, the data format and the motions.
  The Look page's "Seasonal pieces over the panels" switch is `seasonOverPanels`.
  A rule for a seasonal pack can also carry a ticker prefix, a banner line and a corner art:
  `dashboard/core/pack-extras.js` has the limits and the merge with the pack's `defaults`,
  `dashboard/core/corner-art.js` the four ornaments, and `packExtras()` in `core/theme.js` is what
  the ticker and the banner ask for (docs/seasonal-packs.md, "Extras on a rule").
  The screen works out the theme
  when it starts and once a minute, and changes it at the next page change of
  the large panel. The Time zone is also the one the Look page uses to read
  dates. Try a theme with `?theme=<id>` and an overlay with `?overlay=<id>`.
- **The style of the whole screen.** Style in Dashboard Settings (Look tab) is
  Original (the screen as it was), Cybertron or Minimal. The names are `styles` in
  `dashboard/config.js`, `dashboard/core/style.js` puts `data-style` on the html
  element and says which layout a style asks for, and there is a stylesheet for each
  in `dashboard/styles/`. Minimal has the bar layout whatever the theme says, and
  Original and Cybertron have the layout of the theme. `?style=cybertron` in the address
  shows one for a single page. The four steps for the editors are in docs/switch-the-look.md.
- **The war clock.** The countdown drawn a second time: 766 by 128 in the banner of the bar
  layout, which is Minimal, and 616 by 200 in the countdown's place in Cybertron (the wide form,
  `warMarkup('wide')`, drawn into the countdown panel). It reads the same label and dates as the countdown
  (Dashboard Settings, Countdown tab), so there is nothing to set for it. The numbers come from
  `core/countdown.js`, `panels/countdown/panel.js` writes them (`warMarkup`, `startWar` and
  `updateWar`), `panels/bar-banner` puts it in its slot, `core/plate.js` draws the housing
  (`warHousingMarkup`) and `panels/countdown/panel.css` places every part. The digits are
  amber in Cybertron and the team's neon in Minimal. The title has the first line with the date at its
  right end, at 36 px, and takes a second line when it does not fit, in both clocks and in the red countdown
  of Original (`core/countdown-title.js`). docs/layouts.md, "The war clock" and "The wide war clock", has
  the sizes.
- **The teams, and the team on the screen.** Teams in the Studio sidebar, under Coaches only
  (`studio/schemas/team.js`): a name, a short name, a number, a code, an optional logo, seven
  colors, Mirror the layout, six trim choices (bolts, cut corners, header end, page grid,
  ticker label and countdown color), the Outlined name switch (the older Team name look and Bird pose are hidden), Active and Order. The two starting teams are in
  `docs/seed/teams.ndjson`, and the command to import them is in docs/add-the-nova-team.md.
  Dashboard Settings, Look tab: Team mode (`teamMode`, Prime only to start with, from
  `teamModes`) and Minutes for each team (`alternateMinutes`, 5 to start with, 1 to 30), in
  `studio/schemas/settingsTeams.js`, so the whole section can be removed by deleting that file. Both
  are hidden now (docs/layouts.md, "The views"). The starting values, the limits and the built-in Prime team (`primeTeam`, which the screen uses
  when the Studio has no teams) are in `dashboard/config.js`. `teamsFrom` in `core/sanity.js`
  cleans the documents, `core/teams.js` chooses the team (`chooseTeam`) and puts it on the page
  (`applyTeamLook`), and `core/areas.js` calls `changeTeamNow` while the large frame is apart, so
  a swap never happens in the middle of a panel. `teams.css` has the starting colors, and `trim.css` and
  the frames in `core/plate.js` have the trim. Try one
  with `?team=prime|nova|alternate`, or with the Preview Prime and Preview Nova buttons.
- **Which team an item is for.** The Team field of a task, plan, subteam, person, sponsor, talk,
  meeting day, extra panel and tip or news line (`teamField` in
  `studio/schemas/fields.js`, the radio in `studio/inputs/team-input.js`). Leave it blank when it is for both teams. The query in
  `core/sanity.js` asks for `team->code`, and every panel takes its items through `visibleItems` in
  `core/content.js`, which asks `showsForTeam` in `core/teams.js`. docs/team-on-an-item.md says
  how it works and how to give another kind of content the field. In the CSV templates `team` is
  the last column (docs/importing-from-csv.md).
- **Where the regions of the screen sit (the layout).** A theme may have the
  sidebar layout (`layout: 'sidebar'` in `dashboard/themes/registry.js` and
  `studio/inputs/themes.js`): Neon Prime has it. A style may have the bar layout. The numbers are in
  `dashboard/core/layout.js`, the placing in `dashboard/layouts/sidebar.css`, the
  column's content in `dashboard/panels/side/`, and docs/layouts.md has the
  sizes, how the big frame is scaled, what does not show, and how to add a layout.
  Neon Prime also has the kit, seven moving neon effects (the name glitch, data
  packets, sweeping lines and others): `dashboard/neon-kit.css`, the section
  "The Neon Prime kit" in `dashboard/frame.js`, and docs/layouts.md, "The kit",
  which also says how to add an effect.
  Try it with `?theme=neon-prime`, and test its speed on the computer with
  docs/try-it-on-the-computer.md, section 7.
- **A new panel, or the look of the frames.** See docs/adding-a-panel.md. How the
  frames change page and get their metal is docs/page-transitions.md. The
  plates are flat purple and the metal is on the edges only. The metal is made
  from the colours in `dashboard/tokens.css`, so change those to restyle it.
  The other colours are the theme's: `dashboard/themes/hawktimus.css`.
- **A task's contact and location.** Two optional fields of a task in Studio
  (`studio/schemas/task.js`). The contact is a first name of up to 12
  characters. The location is a reference to a place (`studio/schemas/place.js`:
  a name of up to 16 characters that no other place has, capitals ignored, and
  a show switch). Places has no line in the sidebar: a place is added with Create new
  in the Location field of a task, and opened from there. The query in `core/sanity.js`
  follows the reference (`location->name`) and asks whether the place is showing, and
  `normalizeTask` in the same file turns a hidden, deleted or nameless place into no
  location.
  The task stays on the screen. The Tasks panel (`panels/tasks/`) draws a task
  with a contact or a location on two lines, so a row of two lines holds one
  such task or two plain tasks, and a page is three rows. When there are more
  rows it shows the next page each time it comes round (`makePages` in
  `core/turns.js`). A Done task shows only its name. The starting places are in
  `docs/seed/places.ndjson`, and the command to import them is in
  docs/editing-content.md. In the CSV templates `contact` and `location` come
  before the `team` column of task.csv, and the importer knows the starting places
  (docs/importing-from-csv.md).
- **Tasks from the team board and Show on TV.** A task has more fields in
  `studio/schemas/task.js`: `source` (manual or monday, hidden, a task with none was
  typed by hand), `mondayId`, `mondayBoardId` and `mondayBoardName` (hidden), `priority`
  and `showOnTv`. The Monday Tasks line of the sidebar is a folder of two lists, On the
  TV and Hidden, whose filters are at the top of `studio/structure.js`. Every task is in
  one list, and a task typed by hand is in Hidden. Every task opens read only except
  Show on TV, with one line at the top, and `studio/inputs/show-on-tv-input.js` draws a task
  with no value as on. There is no plus button and no template, and
  `sanity.config.js` keeps `task` out of the New menus. Monday Boards is a page,
  `studio/inputs/monday-boards-view.js` with its rows in `studio/inputs/monday-boards-parts.js`: the
  name of a chosen board opens the same two lists kept to that board, which
  `tasksOfBoard` in `studio/structure.js` builds. On the screen, `isVisible` in
  `core/content.js` is the one place that reads `showOnTv`, so both task panels leave
  out a task that is off. `core/sanity.js` keeps only the tasks from the board with
  `fromBoardOnly` from `core/task-source.js`, and they keep their Order. `priority`,
  `mondayId`, `mondayBoardId` and `mondayBoardName` are not read by the screen.
  `tests/task-board.test.mjs` tests the screen side. In the CSV templates `priority`
  and `showOnTv` are the last two columns of task.csv, and `source` and `mondayId`
  have no column.
- **A new field on something editors fill in.** See docs/adding-a-field.md.
- **Many items at once from a spreadsheet.** See docs/importing-from-csv.md.
  The CSV templates in `docs/content-templates/` are written from the schemas
  by `studio/scripts/make-templates.mjs`, so a schema change means running it
  again.

## Checking your work

Run these in the terminal, from this folder. They need Node.js, the same
version as the Studio (22.12 or newer), and nothing else installed. The
exceptions are `slides-sync.test.mjs`, `frc-sync.test.mjs`, `monday-sync.test.mjs` and `backup-dataset.test.mjs`, which need `jq`.

    node tests/run.mjs             every test, three at a time, and the syntax of every shell file
    node tests/run.mjs calendar    only the tests with "calendar" in the file name

A test of a shell script is a Node file that runs the script with fake `curl`, `ssh` and the like. Each file can also be run by itself:

    node tests/calendar.test.mjs
    node tests/weather.test.mjs
    node tests/content.test.mjs
    node tests/themes.test.mjs
    node tests/layouts.test.mjs
    node tests/seasons.test.mjs
    node tests/effects.test.mjs
    node tests/hidden-hours.test.mjs
    node tests/tick.test.mjs
    node tests/night.test.mjs
    node tests/presentation.test.mjs
    node tests/panel-order.test.mjs
    node tests/fixed-values.test.mjs
    node tests/templates.test.mjs
    node tests/publish-all.test.mjs
    node tests/check-connection.test.mjs
    node tests/slides-sync.test.mjs
    node tests/install-calendars.test.mjs
    node tests/check-calendars.test.mjs
    node tests/event-pages.test.mjs
    node tests/events-scroll.test.mjs
    node tests/status-write.test.mjs
    node tests/frc-sync.test.mjs
    node tests/monday-sync.test.mjs
    node tests/monday-settings.test.mjs
    node tests/monday-boards.test.mjs
    node tests/blank-team.test.mjs
    node tests/competition.test.mjs
    node tests/monday-cards.test.mjs
    node tests/monday-fill.test.mjs
    node tests/cybertron.test.mjs
    node tests/minimal.test.mjs
    node tests/team-trim.test.mjs
    node tests/team-colors.test.mjs
    node tests/pile.test.mjs
    node tests/person-rows.test.mjs
    node tests/photo-fit.test.mjs
    node tests/presentation-mouse.test.mjs
    node tests/look-rotation.test.mjs
    node tests/screens.test.mjs
    node tests/screen-seed.test.mjs
    node tests/screen-seed-dashboard.test.mjs
    node tests/swap.test.mjs
    node tests/swap-smooth.test.mjs
    node tests/monday-style.test.mjs
    node tests/install-console.test.mjs
    node tests/calendar-status.test.mjs
    node tests/calendars-view.test.mjs
    node tests/teletraan-tool.test.mjs
    node tests/teletraan-tool-commands.test.mjs
    node tests/ship.test.mjs
    node tests/laptop-docs.test.mjs
    node tests/plate-edges.test.mjs
    node tests/title-plate.test.mjs
    node tests/countdown-title.test.mjs
    node tests/check-themes.test.mjs
    node tests/check-seasons.test.mjs
    node tests/schemas.test.mjs

Each one ends with a total such as `24 of 24 passed` and says FAIL beside
anything that went wrong. If anything fails, the command ends with an error.
Run all of them after you change code under `dashboard/core/` or a file under
`studio/schemas/`. `tests/schemas.test.mjs` runs `check-themes.mjs` and `check-seasons.mjs`
itself, so after you change a file in `dashboard/themes/` or `dashboard/seasons/` it is
enough to run `tests/schemas.test.mjs`.
`templates.test.mjs` fails when the CSV templates are out of date, so after a
schema change run `node scripts/make-templates.mjs` in the `studio` folder.

`check-themes.mjs` needs 7 to 1 contrast for every text colour on the
background it is drawn on, for every theme with and without every overlay.
Three pairs in the Hawktimus theme are under 7 to 1 today (yellow on the tab
colour, and the blocked task colour on the plate and on the dark red plate).
They are listed in the script as known exceptions and may not get worse. The
colours were not changed.

## Special effects

- The old television effect (the screen glitch) plays every few minutes, as
  Dashboard Settings says. Add `?demo=crt` to the address to see it every 8
  seconds. It goes through the same rules, so it waits while a page is
  changing or another effect is playing. In the browser console,
  `import('./frame.js').then(frame => frame.playCrt())` plays it once and
  `frame.playNameEffect()` does the same for the name.
- The announcements can be tried with `?demo=announcement`, and an alert with
  `?demo=alert`.
- A theme can be tried with `?theme=<id>` and an overlay with `?overlay=<id>`
  (`?overlay=none` for no overlay). The address wins over the Look page.
- A style can be tried with `?style=original|cybertron|minimal` and a team with
  `?team=prime|nova|alternate`. The address wins over Dashboard Settings, for that page only.
  The sample content has both teams, so every style, team and pack can be looked at together,
  for example `?style=minimal&team=nova&overlay=christmas`. The Preview buttons in Studio do the
  same on the TV for 2 minutes (docs/hidden-transitions.md, "Preview a look").
- A hidden transition can be tried with `?hidden=desktop` or `?hidden=redEyes`, and kept
  away with `?hidden=off` (docs/hidden-transitions.md). Add `?night=off` at night.
- The night screen can be tried with `?night=on`, and kept away with `?night=off`
  (docs/night-mode.md). It also has a Preview night mode switch in Dashboard Settings.
- The announcement can be shown with Play announcement on the Start here page in Studio
  (docs/editing-content.md). The announcement and the night screen together are the demo
  in docs/demo.md, which Studio no longer starts.
- Calm mode (`?motion=calm`, or Motion in Dashboard Settings) switches off
  every effect and leaves only short fades. `?motion=none` stops all movement.
- Speed can be tried with `?speed=very-slow`, `?speed=slow`, `?speed=normal`
  or `?speed=fast`. The address wins over Dashboard Settings.
- The frames have polished, aged metal edges with silver screws at the joints.
  That is `?finish=metal`, the normal look. `?finish=flat` shows the same screen
  with plain one-colour edges, flat silver screws and no shadow or glint. Comparing the two on the Teletraan computer
  shows what the metal costs. The Polish setting in Dashboard Settings sets this
  finish: Polished is `metal`, Flat and Plain are `flat`, and `?look=plain` also
  hides the screws and the double slash in the headers. docs/try-it-on-the-computer.md lists every switch.

## Testing speed on the Teletraan computer

See docs/try-it-on-the-computer.md. It also compares the metal finish with the
flat one.

## Credits

The weather comes from Open-Meteo (open-meteo.com), a free service that needs
no key.
