# Where things are

This is the longer guide that used to be the top of the README. It says how
to try the dashboard on a computer, what each folder is for, where each
setting lives and what to run to check your work.

The Mini is the Mac mini that runs the dashboard on the TV. The team mentor,
[name of the team mentor], is the adult who holds the team's accounts and
passwords and says yes to anything new on the Mini. Ask them before you install
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
on a computer. On the Mini the web server in `deploy/` does the same job.

The screen shows the editors' own content (production). To try things out with
the sample instead, put `?sample=1` on the end of the address, such as
`http://localhost:8080/dashboard/?sample=1`. While a page shows the sample,
every piece of sample text is in [square brackets] and a SAMPLE CONTENT label
shows on the screen. Nothing in Studio switches it, and `core/source.js` is the
one place that decides. Until the setup in studio/README.md is finished (step 6,
the CORS origin, is what lets the screen read Sanity), the screen has nothing
to show on production, so use `?sample=1`. A Studio with nothing published
shows an empty production screen. The browser console shows a 404 line for
`data/live/version.txt`. That is expected: the Mini writes that file.

A small text at the bottom right of the screen says when Sanity has been out
of reach for over two minutes, and why (core/connection.js). Its last two lines
are the Mini's name and addresses (core/device.js). To see it on your computer,
open the dashboard with no internet and no saved copy of the content (a private
window), wait two minutes, and put the four values in
`dashboard/data/live/device.json` as in "Finding the Mini on the network" in
docs/rebuilding-the-mini.md. Git ignores the files in that folder. The Show
connection status switch in Dashboard Settings keeps a text of this kind on the
screen all the time, with the last read from Sanity and the item counts
(docs/rebuilding-the-mini.md, "Checking the connection").

## The editing screen (Studio)

The Sanity project exists. Its ID, `ybfqe345`, is in `studio/project.js` and in
`dashboard/config.js`, and its dataset is called `production`. What is left is
to run the Studio on a Mac, let the dashboard read from it, type some content
and look at it on the screen. studio/README.md has every step.
In short, from the `studio` folder in the Terminal app: `npm install`,
`npx sanity login`, `npm run dev`, then add `http://localhost:8080` (this Mac)
and `http://localhost:3229` (the Mini) as CORS origins in the Sanity project
settings, publish some content, and run `npm run deploy` so the
editors can sign in from anywhere.

## What is where

    dashboard/
      index.html, shell.js    starts everything. index.html also draws the metal gradients
      registry.js             the list of every panel
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
      trim.css                the rules for the eight trim choices of a team (round bolts, the other corners cut on
                              the cards, dots on the page, the bird in flight, the outlined name, the bar at the
                              start of the ticker and the neon countdown), each for a class that core/teams.js
                              puts on the html element (docs/layouts.md, "Team trim")
      themes/                 one CSS file of colour variables per theme, and registry.js listing them.
                              overlays/ has the seasonal packs' colours the same way (the overlays),
                              and required.js lists the variables a theme must set.
                              decor/ has what Neon Prime adds to its colours: the gunmetal and the
                              neon decoration (docs/adding-a-theme.md, "Neon Prime")
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
      styles/                 one stylesheet for each style (Style in Dashboard Settings): original.css has the
                              mirror of the standard layout, which Cybertron has too, and cybertron.css and
                              minimal.css each set custom properties and paint the page background, the plates
                              and the decoration of the frames that only that style has (docs/layouts.md,
                              "Styles", "Frames" and "Cybertron")
      base.css                the fixed 1920x1080 screen and the shared metal shapes. Nothing is responsive:
                              shell.js scales the whole screen to the window (docs/layouts.md, "The screen is
                              a fixed canvas")
      core/                   helpers used by several panels. plate.js draws the frames, and the three steel frames
                              of the bar layout, with Minimal's own three (docs/layouts.md, "Frames") and the
                              four of Cybertron ("Cybertron"), and the housing of the war clock, areas.js keeps
                              the frames in place while pages change and draws them again when a style with other frames
                              goes on, schedule.js says what shows when,
                              panel-order.js says in what order (the Panel order list in Dashboard Settings),
                              logo.js and name.js draw the hawk and the team name (name.js can also put the
                              name on two lines, which nothing uses now), countdown.js is the countdown's parts and
                              the code that writes its numbers, for every layout and for the war clock, source.js
                              decides sample or production content from ?sample=1 in the address,
                              images.js builds the addresses of photos from Sanity, photos.js says
                              which photos the Photo panel shows and in what order, portrait.js
                              draws a person's framed portrait, with the name under it or as a row,
                              leadership.js picks the four people of the Leadership panel, team-leads.js
                              makes the rows of the Team Leads panel, roster.js
                              makes the pages of the Subteam roster panel, task-source.js says whether a task
                              is pinned or from the team board and puts the pinned ones first, theme.js
                              works out which theme and overlay apply, theme-apply.js puts them on the page,
                              layout.js says which layout a theme has, which regions and blocks a layout
                              has, the numbers of the sidebar and bar layouts and when a change of layout must
                              reload the page, layout-apply.js sets the layout on the page before
                              anything is drawn, and style.js says which style the screen has and which
                              layout a style asks for (docs/layouts.md),
                              teams.js holds the teams, says which one the mode and the clock ask for,
                              says whether an item shows for it (showsForTeam, used by visibleItems in
                              content.js) and puts its colors, its initials and the mirror class on the
                              page, and team-run.js asks it once a second and moves the pages on when
                              the team changes (docs/team-on-an-item.md),
                              season.js draws the decorations of the overlay's seasonal pack in three layers
                              and hands its header mark to marks.js, which draws the picture at the right of
                              every panel header (the double slash, or the pack's mark), corner-art.js holds
                              the four ornaments of line art that go in the cut corners, pack-extras.js
                              decides the ticker prefix, banner line and corner art of the pack on the page,
                              transitions.js chooses the style and the metal of the next page change and
                              plans how the frames fall into a pile and come back at the end of a hidden
                              transition,
                              look.js turns the Polish setting (polished, flat or plain) into the page
                              switches the stylesheets read (data-finish, data-glint and data-look),
                              events.js filters and sorts the BAND events, and writes the dates of an event,
                              event-pages.js splits those events into the two pages of the Events panel,
                              with the kind of each and the pinned ones first (docs/calendar-filters.md),
                              connection.js decides why Sanity could not be read and writes the
                              connection status text at the bottom right, device.js reads the Mini's
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
                              look-rotation.js decides which look comes next (the style of the day, the
                              order of the teams, their Monday cards and the Next look now guard), and
                              look-rotation-run.js plays the three swaps and keeps the pass in localStorage
                              (docs/layouts.md, "The look rotation"),
                              frc.js cleans the frc-status document the Mini writes and has the date helpers for
                              it, competition.js decides which competition cards are due now (from the document,
                              the clock and the Competition cards setting) and mixes them into the list of the
                              large panel, competition-draw.js is what the cards share, and competition-preview.js
                              decides when the Preview competition button shows the cards on sample data and
                              competition-preview-run.js starts it (docs/frc-feed.md),
                              monday.js picks and ranks the board tasks for the Monday cards and monday-draw.js
                              draws their page (docs/layouts.md, "The Monday cards"),
                              tick.js is the one clock of the screen: it tells every panel when a real
                              second starts by reading the time, not by counting, so the digits never
                              drift, and a panel should write to the page only what has changed
      panels/                 one folder per panel: a script and a stylesheet. panels/side is the whole
                              column of the sidebar layout, in place of the banner and the countdown
                              (docs/layouts.md, "The sidebar"). panels/bar-banner and panels/bar-column are
                              the banner and the side column of the bar layout (docs/layouts.md, "The bar
                              layout"). The war clock in that banner is drawn by panels/countdown, as a
                              second rendering of the countdown (docs/layouts.md, "The war clock").
                              panels/tonight is the Daily Agenda panel, headed AGENDA (docs/up-next.md).
                              panels/competition-* are the seven competition cards, each plain SVG
                              (docs/frc-feed.md). panels/monday-* are the three Monday cards
                              (docs/layouts.md, "The Monday cards")
      fonts/, assets/         fonts and pictures, all served from here
      data/sample/            sample content with marked placeholders, and a sample talk with six slides
                              (slides/presentation-sample)
      data/live/              files the Mini downloads (never committed)
    studio/                   the Sanity editing screen, its sidebar (structure.js: one list with a line
                              for each entry, so changing the order means moving a line,
                              docs/reordering-the-sidebar.md), its buttons (actions.js: the Play buttons of the hidden transitions, Play announcements, Run presentation test and the Preview buttons),
                              its two pages that are not documents (start-here.js and calendars-view.js,
                              whose rows and words are in calendars-view-parts.js, docs/calendars-page.md),
                              the words and picture of Start here (start-here-parts.js), what its request
                              buttons write, shared with actions.js (screen-requests.js), and the address
                              that Preview the screen opens (dashboard-address.js),
                              its copy of the theme lists (themes.js), its copy of the demo screens
                              (demo-screens.js), its copy of the hidden transitions (hidden-transitions.js),
                              its copy of the previews (previews.js),
                              the Publish all tool in the top bar (publish-all-tool.js is the page and
                              publish-all.js is its logic, docs/publish-all.md), and check-schemas.mjs.
                              schemas/ has a file for each kind of content. calendarFilter.js is the
                              Calendar filters (docs/calendar-filters.md), presentationDay.js the Meeting
                              days, presentation.js the booked talks and settingsPresentations.js the
                              Presentations tab of Dashboard Settings (docs/presentations.md). team.js is the
                              Teams list and settingsTeams.js the team fields of the Look tab, which are hidden now. settingsLook.js is
                              Styles by day, Monday style, Team order and How the look changes. status.js is the
                              document the Mini writes (the status block, settingsStatus.js and status-input.js), and calendarStatus.js
                              the one it writes for the Calendars page. time-text.js has the ages in words that
                              both use. frcStatus.js is the document the Mini writes for the competition cards,
                              settingsCompetition.js the Competition tab and frc-status-input.js its connection block.
                              settingsRotation.js is the Panels
                              box of Dashboard Settings, and panel-order-input.js fills its Panel order list when it is empty. The Team radio on tasks, sponsors and
                              the other kinds of content is team-input.js, put on each by teamField in fields.js
                              scripts/ has make-templates.mjs, which writes the CSV templates from the
                              schemas, and import-csv.mjs, which checks filled-in CSVs and makes a file
                              for sanity dataset import (docs/importing-from-csv.md)
    deploy/                   how the Mini runs it: web server, timers, scripts. scripts/check-connection.sh
                              checks the Mini's connection to Sanity, BAND, Docker and the kiosk with one
                              OK or FAIL line each (docs/rebuilding-the-mini.md, "Checking the connection").
                              scripts/fetch-calendars.sh downloads the BAND calendars in local.env into the
                              data folder (docs/calendar-links.md) and leaves calendar-sync.txt, a line for
                              each calendar with its last good download and why a download failed.
                              scripts/calendar-status.sh makes the document for the Calendars page from it,
                              and lists the next events when Node is installed, with calendar-status.mjs
                              (docs/calendars-page.md).
                              scripts/check-calendars.sh lists the events of each calendar in local.env,
                              says which ones the Calendar filters hide, and for the others which page of
                              the Events panel they are on and their kind. It needs Node, so it runs on a
                              computer that has it, not on the Mini. check-calendars.mjs is the part of it
                              that runs the dashboard's own calendar code.
                              scripts/slides-sync.sh downloads the slides of the coming talks and turns them
                              into pictures in the data folder (docs/presentations.md).
                              scripts/status-write.sh writes the time of a job into the status-mini document
                              in Sanity, for the status block in Dashboard Settings (docs/rebuilding-the-mini.md,
                              "Showing what the Mini did in Studio").
                              scripts/frc-sync.sh reads the public FRC data of each team and writes it into
                              the frc-status document in Sanity, and install-frc.sh turns on its timer
                              (docs/frc-feed.md).
                              scripts/install-timers.sh turns on the calendar timer and the pull timer,
                              install-calendars.sh only the calendar timer and install-slides.sh the slides
                              timer (docs/rebuilding-the-mini.md, step 11). systemd/ has the unit files they
                              copy into place.
                              scripts/install-console.sh writes the startup drawing above the old text of
                              /etc/issue and turns on teletraan-console.service, which shows the shutdown
                              drawing. The two drawings are console/startup.txt and console/shutdown.txt
                              (docs/rebuilding-the-mini.md, step 13).
                              mac/ is for the Mac you work on: ship.sh commits, pushes, updates the Studio
                              and tells the Mini to pull (docs/shipping-from-the-mac.md)
    tools/
      serve.py                the server above
      presentation-booking/   the Apps Script code behind the Google Form where students book a talk
                              (docs/presentations.md)
      test-calendar.mjs       checks for the calendar reader, and for the Calendar filters that take events
                              off the screen (core/events.js)
      test-weather.mjs        checks for the weather reader and its pictures
      test-content.mjs        checks for the code that reads the editors' content, the photo
                              addresses, which photos show and in what order, the pages of
                              portraits, of the subteam roster, the subteam members, the events list and the
                              lines of the Mini's address, and the reasons and the lines of the
                              connection status text, for the Polish setting: its cleaning, the
                              switches each look sets and the rules for Plain in base.css, and for
                              teams: the cleaning of a team, the team each mode asks for, which items
                              show for which team in every panel, and the Teams settings
      test-themes.mjs         checks for which theme and overlay apply, for putting them on the page, for the
                              ticker prefix, banner line and corner art that a seasonal pack rule can carry, and
                              for putting the team on the page: its seven colors, its initials, the mirror class
                              and the classes of its trim
      test-layouts.mjs        checks for the layouts: which layout a theme and a style have, the numbers of the
                              sidebar and bar layouts, the mirror, that the screen is always 1920 x 1080,
                              the reload that changes layout and that it cannot loop, that the scheduler leaves
                              out the small frame, the blocks of a hidden transition, that a seasonal pack
                              draws only what a layout allows, and the war clock: its housing, its digits and
                              labels, its sizes and that it does not move
      test-seasons.mjs        checks for choosing, loading and drawing a seasonal pack (core/season.js), for its
                              header mark (core/marks.js), its over layer and the Look switch that turns that off,
                              for its corner art (core/corner-art.js), for a pack that is missing, broken or slow,
                              and that check-seasons.mjs fails for each kind of mistake
      test-night.mjs          checks for night mode: when it is night in a time zone, where the bouncing
                              logo starts and how often it hits a corner, and the night stylesheet
      test-presentation.mjs   checks for presentation mode (core/presentation.js): when a talk is due, how it
                              goes from the title card to the thanks card, which talks are skipped, and what
                              each key of the clicker does
      test-panel-order.mjs    checks for the Panel order list (core/panel-order.js): the list built from the
                              two older lists, and what each area of the screen follows
      test-fixed-values.mjs   checks that the screen ignores the stored night times, speaker wait and overrun,
                              and uses the fixed values in core/constants.js
      test-effects.mjs        checks for when the logo animations, the name effect and the screen glitch may start
                              (frame.js), for choosing the page change style and the metal of the frames, and
                              for when a demo plays and what stops it (core/demo.js), and for when a hidden
                              transition plays (core/hidden.js) and what its stylesheet moves
      test-hidden-hours.mjs   checks that a hidden transition comes about once every so many hours of screen
                              time (core/hidden.js): the chance of one page change, the older percent, the
                              cleaning of the hours and the gap after a transition has played
      test-tick.mjs           checks for the clock of the screen (tick.js) with a fake clock, and that the
                              countdown and the banner write only what changed each second
      test-publish-all.mjs    checks for the logic of the Publish all tool: which drafts are listed, the
                              transaction for each, the order, the skipped reasons and the summary
      test-templates.mjs      checks that the CSV templates match the schemas, and the CSV importer
      test-connection-script.mjs  checks for deploy/scripts/check-connection.sh, with fake tools
      test-slides-script.mjs  checks for deploy/scripts/slides-sync.sh and install-slides.sh, with fake tools
      test-install-calendars.mjs  checks for deploy/scripts/install-calendars.sh: that it stops before it changes
                              anything, and that it installs the calendar units only
      test-calendars-script.mjs  checks for deploy/scripts/check-calendars.sh, with a fake curl
      test-event-pages.mjs    checks for the two pages of the Events panel (core/event-pages.js): four events
                              to a page, no second page for four or fewer, the kind chips, Group events by
                              kind, the pinned events, and the step for each page in the rotation
      test-status-write.mjs   checks for deploy/scripts/status-write.sh, with a fake curl, that the services and
                              kiosk.sh run it, and that the dashboard never reads the status document
      test-calendar-status.mjs  checks for what the Mini writes for the Calendars page: the sync file of
                              fetch-calendars.sh, the document of calendar-status.sh and calendar-status.mjs
                              (SHOWN or HIDDEN with the rule, the error case, no address anywhere, with and
                              without Node), and status-write.sh calendar-status, with a fake curl
      test-calendars-view.mjs checks for the rows and lines of the Calendars page in Studio
      test-frc-script.mjs     checks for deploy/scripts/frc-sync.sh and install-frc.sh, with a fake curl and made-up
                              answers: the requests, the status document, the ETags, the limit of 60 requests, the
                              snapshots, and that the key and the token are never printed or saved
      test-competition.mjs    checks for the competition cards (core/frc.js, core/competition.js and the panels in
                              panels/competition-*): the cards due on each day of the season in each mode, the mix into the
                              large panel's list, each card from the sample and with nothing to show, that no text is under
                              44px or runs out of its body, and the guard of Preview competition
      test-monday-cards.mjs   checks for the Monday cards (core/monday.js and the panels in panels/monday-*): the
                              columns and the ranking, pinned tasks first, Show on TV off, the weeks around a Monday and
                              the time zone, six rows and +N more, the line of at most 12 points, the sentences with
                              nothing to show, that no text is under 44px, and that a team has the cards only with board tasks
      test-cybertron.mjs      checks for Cybertron on the layout of Original: which layout each style has, its four
                              frames, the stage, the banner and the ticker on their plates, the wide war clock, and
                              that the frames are drawn again when the style changes
      test-minimal.mjs        checks for Minimal on the bar layout: what the order gives it, what it must not have
                              (stamped ids, hazard stripes, scanlines, slashes, conduit, brackets), and the list of
                              what it shares with Cybertron
      test-team-trim.mjs      checks for the trim of a team: both teams of the sample content on a fake page, the
                              classes of every field, the frames with the other corners cut and the slanted tab
                              (the Prime frame turned across, the 60 degree line, the pieces), and the rules of trim.css
      test-pile.mjs           checks for the end of the hidden transitions: the plan of the fall, the pile and the
                              lift (at most 40 pieces, 5 seconds, every piece back in its place), the stylesheet
                              that moves them, the cube, and the script that finds the pieces on a fake page
      test-person-rows.mjs    checks for the rows of the Team Leads and Leadership panels: four rows to a
                              panel, who is in them, the portrait size, and the sizes in base.css
      test-presentation-mouse.mjs  checks for the mouse in presentation mode: what each button does, the second
                              click of a double click, a click on the card that says the slides are not ready,
                              the context menu, the hidden cursor, and the rotation that starts again
      test-look-rotation.mjs  checks for the look rotation (core/look-rotation.js): the style of the day, the
                              order of the passes in a cycle, the boundary rule, a restart, one look holding,
                              empty lists, the Next look now guard, and the question schedule.js asks at the
                              end of every pass
      test-console.mjs        checks for the boot and shutdown drawings (plain 7 bit text, the size, the
                              symmetry of the figure, the same text in the sample content), for
                              install-console.sh in a fake root (it stops before it changes anything, keeps the
                              copy of /etc/issue, and does nothing the second time) and for the unit
      check-seasons.mjs       fails if a seasonal pack is not in the data format, has a piece outside its zone, too
                              many pieces, a forbidden word, no header mark, a mark bigger than its box (60 x 76),
                              fewer than 8 or more than 14 pieces over the panels, an over piece that is too big,
                              solid or quick, an ornament of corner art that leaves its box or has a fill, or
                              animation anywhere but seasons/motion.css
      zones.html              the zones of the seasonal packs outlined over the dashboard, at
                              http://localhost:8080/tools/zones.html
      check-themes.mjs        fails if a theme or overlay is missing a variable or has text that is
                              hard to read
      testdata/               the calendar files test-calendar.mjs reads
      icons.html              every weather picture on one page, at
                              http://localhost:8080/tools/icons.html
      logo.html               the hawk logo large, with every act and key pose, at
                              http://localhost:8080/tools/logo.html
      perf/                   the comparison page for the speed test: the Tasks panel built
                              from plain plates, in metal or flat, at
                              http://localhost:8080/tools/perf/plates.html
    docs/                     how-to guides: editing-content.md, adding-a-field.md, adding-a-panel.md,
                              adding-a-theme.md, layouts.md, adding-a-holiday-overlay.md, seasonal-packs.md, rebuilding-the-mini.md,
                              try-it-on-the-mini.md, the-logo.md, page-transitions.md, night-mode.md,
                              hidden-transitions.md, demo.md, publish-all.md, reordering-the-sidebar.md,
                              importing-from-csv.md, presentations.md, up-next.md, calendar-filters.md,
                              calendar-links.md, calendars-page.md, hide-a-repeating-meeting.md, switch-the-look.md,
                              add-the-nova-team.md, team-on-an-item.md and frc-feed.md.
                              seed/ has content to import into the Studio: places.ndjson, the three
                              starting places, teams.ndjson, the two starting teams, and extra-events.ndjson, the
                              old Events Calendar entries, which the screen no longer reads. content-templates/ has one CSV template for each
                              kind of content (importing-from-csv.md)

## Changing things

Values saved in Dashboard Settings (in the editing screen) win. The file
`dashboard/config.js` only fills in what the editors have not set. The Studio
has a copy of each starting value in `studio/schemas/`, and
`studio/check-schemas.mjs` fails if the two copies differ, so change both. To
change what is on the TV today, use Dashboard Settings and leave the files
alone.

- **The Kickoff date.** Dashboard Settings, Countdown tab. The starting value
  is `defaultSettings.countdown.kickoff` in `dashboard/config.js`, written like
  `2027-01-09T12:00`, and its copy `initialValue` in
  `studio/schemas/dashboardSettings.js`, written in UTC. The countdown counts
  to 12:00 noon on that day, on the Mini's clock, which is set to Eastern
  time. Noon is a guess and not the real start time of the event, so set the
  real time in Dashboard Settings.
- **How long a panel stays, and in what order.** Dashboard Settings, Screen
  tab. "Seconds per page" is the time for the whole board (`pageSeconds` in
  `dashboard/config.js`, 20 to start). The small panel stays three quarters as
  long and the ticker one and a half times as long. A panel in the lists can
  have seconds of its own, and then that is used instead. The order is the
  Panel order list in Dashboard Settings (`rotation.order`). While that list is
  empty the screen builds it from the lists in `defaultSettings.rotation`
  (`core/panel-order.js`). The panels it offers are in
  `studio/schemas/settingsRotation.js`.
  The Photo panel is the exception: with no seconds of its own it follows
  "Seconds per photo" in the Screen tab (`photoSeconds`, 16 to start).
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
  `studio/schemas/settingsHidden.js`, the buttons are made in `studio/actions.js` from
  `studio/hidden-transitions.js`, a copy of `hiddenTransitions` in
  `dashboard/core/hidden-transitions.js`. A new transition is one entry in each, plus an hours
  field and a chance field. `core/hidden.js` decides, `core/hidden-run.js` plays, and `frame.css` ("Hidden
  transitions" and "The blue glitch") moves the five blocks and the glitches. Both end with
  the frames falling into a pile and a cube putting them back (`core/hidden-pile.js`,
  `planPile` in `core/transitions.js`, and "The frames fall and come back" in `frame.css`). The four
  pictures are in `dashboard/assets/hidden/`, and `core/hidden-pictures.js` says how each one
  fills the screen and which one plays next. Try one with `?hidden=desktop` or `?hidden=redEyes`.
- **Play announcements.** A button in the menu beside Publish on Dashboard Settings
  (docs/hidden-transitions.md) that plays every announcement that is switched on, once, whatever
  its time and days. It writes the hidden `announceRequest` field (`announceRequestField` in
  `studio/schemas/settingsAnnouncements.js`, the button is `usePlayAnnouncementsAction` in
  `studio/actions.js`). The starting value is `announceRequest` in `defaultSettings` in
  `dashboard/config.js`. `core/announce.js` decides and `core/announce-run.js` plays it. A Demo step
  can use it too: All announcements in `demoScreens`. The Start here page has this button too, and
  both write what `announceRequest` in `studio/screen-requests.js` gives.
- **Preview buttons.** The last five buttons in the same menu (docs/hidden-transitions.md, "Preview a look"):
  Preview Prime, Preview Nova, Preview Cybertron, Preview Minimal and Preview next pack. Each shows its look on
  the screen for `previewSeconds` (2 minutes) in `dashboard/config.js` and then the saved settings come back,
  and none writes a setting. They write the hidden `previewRequest` field (`previewRequestField` in
  `studio/schemas/settingsPreview.js`, the buttons are `previewActions` in `studio/actions.js`, made from the
  list in `studio/previews.js`, a copy of `previewKinds` in `dashboard/core/preview.js`). The starting value is
  `previewRequest` in `defaultSettings` in `dashboard/config.js`. `core/preview.js` decides and
  `core/preview-run.js` runs it.
- **Run presentation test.** The button after Play announcements in the same menu
  (docs/hidden-transitions.md). It starts the sample talk, with its six sample slides in
  `dashboard/data/sample/slides/presentation-sample/`, and needs no internet. It writes the hidden
  `presentationTestRequest` field (`presentationTestRequestField` in
  `studio/schemas/settingsPresentations.js`, the button is `useRunPresentationTestAction` in
  `studio/actions.js`). The starting value is `presentationTestRequest` in `defaultSettings` in
  `dashboard/config.js`. `core/presentation-test.js` decides, `core/presentation-test-run.js` reads the
  sample talk and `startTestTalk` in `core/presentation-run.js` puts it on the screen. The Start here
  page has this button too, and both write what `presentationTestRequest` in
  `studio/screen-requests.js` gives.
- **Next look now and Preview competition.** Two buttons on the Start here page only. Each writes a hidden
  field of Dashboard Settings, `nextLookRequest` and `competitionPreviewRequest` (`nextLookRequestField` and
  `competitionPreviewRequestField` in `studio/schemas/settingsRequests.js`), through `studio/screen-requests.js`.
  The starting values are in `defaultSettings` in `dashboard/config.js`, and `fixSettingValues` in
  `dashboard/core/content.js` keeps each one a time or empty.
- **The competition cards.** Dashboard Settings, Competition tab (docs/frc-feed.md). The mode, Auto, Always or
  Off, and a switch for each of the seven cards are in `studio/schemas/settingsCompetition.js`, with the
  starting values in `defaultSettings`, the lists in `competitionModes` and `competitionSwitches` and
  `competitionLeadDays` (2 days) and `competitionPreviewSeconds` (120) in `dashboard/config.js`. The cards
  are the panels `dashboard/panels/competition-*`, flagged `competition: true` in `registry.js`, and the
  list of them with the rule for each is `cards` in `dashboard/core/competition.js`. The data is the
  document `frc-status` (type `frcStatus`, `studio/schemas/frcStatus.js`), which `deploy/scripts/frc-sync.sh`
  writes and `core/sanity.js` reads with the rest of the content and `core/frc.js` cleans. It is public. The
  Preview competition button on Start here writes `competitionPreviewRequest`, and
  `core/competition-preview.js` and `core/competition-preview-run.js` show the cards on the sample data in
  `dashboard/data/sample/content.json`. The block at the top of the tab is `studio/frc-status-input.js`.
- **The Monday cards.** The three panels `dashboard/panels/monday-tasks`, `monday-milestones` and `monday-progress`
  (docs/layouts.md, "The Monday cards"), flagged `monday: true` in `registry.js` and offered in Panel order in
  `studio/schemas/settingsRotation.js` but in no starting list. `mondayCards` in `dashboard/core/look-rotation.js`
  gives them to a team that has tasks with the source monday, and `dashboard/core/monday.js` picks and ranks the
  tasks. The tasks are the ones the board sync writes (`source` monday, `mondayId`, `priority`, `dueDate`, `showOnTv`),
  and the daily counts are in the document `monday-status`, which `core/sanity.js` reads and `tidyMondayStatus` cleans.
  `dashboard/data/sample/content.json` has board tasks for two Team lead entries and a `monday` document.
- **The demo.** The Demo page in Studio (docs/demo.md), which has no buttons and no line in the sidebar now:
  the Steps and the Demo announcement text. The starting values
  are `defaultDemo` in `dashboard/config.js` and their copy in
  `studio/schemas/demo.js`, with `limits.demoSeconds` and `demoMaxSteps` there.
  The screens a demo can show are `demoScreens` in `dashboard/core/demo-screens.js`
  with a copy in `studio/demo-screens.js`. A new screen is one entry in each
  (docs/demo.md). `core/demo.js` decides when a demo plays and runs the steps.
- **The logo animations and the team name effect.** Dashboard Settings, Look
  tab (docs/the-logo.md). A master switch, the entrance, and for the spin, the
  flying hawk and the name effect a switch, the seconds between plays (0 is
  never) and the seconds one play lasts. The starting values are
  `logoAnimations`, `logoEntrance`, `logoSpin`, `logoSpinEvery`,
  `logoSpinDuration`, `logoHawk`, `logoHawkEvery`, `logoHawkDuration`,
  `nameTransform`, `nameEvery` and `nameDuration` in `defaultSettings` in
  `dashboard/config.js`, and the limits are `limits` there. The Studio fields
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
- **What the Mini last did.** Dashboard Settings, Screen tab, Status of the Mini.
  The Mini writes the document `status-mini` with `deploy/scripts/status-write.sh`,
  which the calendar and slides services and `kiosk.sh` start, and which needs
  `SANITY_WRITE_TOKEN` in `deploy/local.env` (docs/rebuilding-the-mini.md, "Showing
  what the Mini did in Studio"). The type is `studio/schemas/status.js` and the block
  is `studio/status-input.js`. The dashboard never reads it.
- **Photos for the Photo panel.** Photos in the Studio sidebar
  (`studio/schemas/photo.js`): a picture, an optional caption, a first name
  credit, "Show on screen" and "Hide after". Dashboard Settings, Screen tab: Photo
  order (random or newest first) and Seconds per photo (`photoOrder` and
  `photoSeconds` in `dashboard/config.js`), and the two size settings below.
  The screen reads them with the rest of
  the content (`photos` in `core/sanity.js`) and asks Sanity for each at no more
  than 1920 pixels wide (`screenPhotoUrl` in `core/images.js`). `core/photos.js`
  chooses the photo and the one after it, and the panel in `panels/photo/` starts
  loading the next one. docs/editing-content.md has the advice for the people who
  upload. The sample content's `photos` list is what shows on the sample. There is
  no photo list file on the Mini.
- **How big the pictures are.** Dashboard Settings, Screen tab: "Portrait size,
  percent" (`portraitScale`) and "Photo size, percent" (`photoScale`). Each is a
  whole percent from 60 to 100, starting at 100, which is the full size and the
  largest that fits the frames. The starting values and the limits are in
  `dashboard/config.js` (`defaultSettings` and `limits`), and the Studio fields
  in `studio/schemas/settingsPhotos.js`. `fixSettingValues` in
  `core/content.js` rounds and clamps them (`tidyScale`), and anything missing
  or odd is 100. The portraits: `portraitSizes` in `core/portrait.js` works out
  the card, the photo and the space between them (292, 280 and 6 at 100) and
  `slotMarkup` hands them to `base.css` as three variables on the `.portrait`
  element. The card is always drawn 292 square and the browser draws it
  smaller, which keeps its metal edge and cut corner in proportion. The slot
  stays 352 wide and the text keeps its size, so a smaller portrait is only
  centred in its slot. The Photo panel: `photoLayout` in `core/photos.js` works
  out where the card and the caption go (1096 by 464, or 514 with no caption, at
  100). `cardMarkup` draws the card at that size with the same cut corner and
  edge, and the card sits in the middle of the panel with the caption directly
  under it.
- **Photos of people.** Leadership in Studio, Photo and "Show photo on
  screen" (docs/editing-content.md). The screen asks Sanity for each photo at
  the size it is shown, 280 by 280 pixels, in `core/portrait.js`. The silhouette
  for a person with no photo is drawn once in `dashboard/index.html`, and its
  four colours are the `--silhouette-` variables in `dashboard/tokens.css`.
  Four rows fit on a panel, set by `rowsPerPage` in `core/portrait.js`, and
  `rowsMarkup` draws them. `core/leadership.js` picks the people of the
  Leadership panel: the coaches, then the captains, then the mentors, the first
  four. `core/team-leads.js` makes the rows of the Team Leads panel, one for each
  subteam in the order of the Order field, and the panel shows four each time it
  comes round. The rows are in the section People portraits in
  `dashboard/base.css`: four of 144 pixels fill the 576 pixel body, as in the
  Events panel. In a row the portrait is 124 pixels square (`rowSizes` in
  `core/portrait.js`), and on the Subteam roster panel it is 292 pixels square with the
  280 pixel photo 6 pixels in from the edge (`portraitSize`). The photo is
  always asked for at 280, whatever the Portrait size setting says, so the copy
  loaded ahead of time is the one shown. `showcaseOf` in `core/team-leads.js` is
  there for a later mode that shows one subteam's lead and its members. Nothing
  calls it yet. `tools/test-person-rows.mjs` has the tests of the rows.
  The starting value of the switch is `defaultPerson.showPhoto` in
  `dashboard/config.js` and its copy in `studio/schemas/person.js`.
- **Subteam members.** The Members list of a subteam in Studio
  (`studio/schemas/subteam.js`): first names, up to 24 of 12 characters, with no
  digits and no repeats. The screen tidies them in `normalizeSubteam` in
  `core/sanity.js` (trimmed, no repeats, at most 24, always a list).
  `core/roster.js` makes the pages of the Subteam roster panel, 16 names to a
  page, and the panel is in `panels/roster/`. Its two columns are 344px wide in
  `roster.css`, which holds a name of 12 characters at 56px.
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
  without Sanity. The command for the Mini is `deploy/scripts/check-connection.sh`
  (docs/rebuilding-the-mini.md, "Checking the connection").
- **The theme (the colours of the whole screen), and seasonal packs (holiday
  overlays).** Look in Studio. Its Default theme, "Use a theme now", Schedule and Time zone
  decide which theme and overlay show. The themes are the files in
  `dashboard/themes/` and the lists are `registry.js` there and in
  `dashboard/themes/overlays/`, with a copy in `studio/themes.js`. The starting
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
- **The war clock.** The countdown drawn a second time: 700 by 120 in the banner of the bar
  layout, which is Minimal, and 616 by 200 in the countdown's place in Cybertron (the wide form,
  `warMarkup('wide')`, drawn into the countdown panel). It reads the same label and dates as the countdown
  (Dashboard Settings, Countdown tab), so there is nothing to set for it. The numbers come from
  `core/countdown.js`, `panels/countdown/countdown.js` writes them (`warMarkup`, `startWar` and
  `updateWar`), `panels/bar-banner` puts it in its slot, `core/plate.js` draws the housing
  (`warHousingMarkup`) and `panels/countdown/countdown.css` places every part. The digits are
  amber in Cybertron and the team's neon in Minimal. docs/layouts.md, "The war clock" and "The wide war clock", has
  the sizes.
- **The teams, and the team on the screen.** Teams in the Studio sidebar, under Settings
  (`studio/schemas/team.js`): a name, a short name, a number, a code, an optional logo, seven
  colors, Mirror the layout, the eight trim choices (bolts, cut corners, header end, page grid,
  bird pose, team name look, ticker label and countdown color), Active and Order. The two starting teams are in
  `docs/seed/teams.ndjson`, and the command to import them is in docs/add-the-nova-team.md.
  Dashboard Settings, Look tab: Team mode (`teamMode`, Prime only to start with, from
  `teamModes`) and Minutes for each team (`alternateMinutes`, 5 to start with, 1 to 30), in
  `studio/schemas/settingsTeams.js`, so the whole section can be removed by deleting that file. Both
  are hidden now, and the screen uses them only when Team order is empty (docs/layouts.md, "The look
  rotation"). The starting values, the limits and the built-in Prime team (`primeTeam`, which the screen uses
  when the Studio has no teams) are in `dashboard/config.js`. `teamsFrom` in `core/sanity.js`
  cleans the documents, `core/teams.js` chooses the team (`chooseTeam`) and puts it on the page
  (`applyTeamLook`), and `core/areas.js` calls `changeTeamNow` while the large frame is apart, so
  a swap never happens in the middle of a panel. `teams.css` has the starting colors, and `trim.css` and
  the frames in `core/plate.js` have the trim. Try one
  with `?team=prime|nova|alternate`, or with the Preview Prime and Preview Nova buttons.
- **Which team an item is for.** The Team field of a task, plan, subteam, person, sponsor, talk,
  meeting day, extra panel and tip or news line (`teamField` in
  `studio/schemas/fields.js`, the radio in `studio/team-input.js`). Empty means Both. The query in
  `core/sanity.js` asks for `team->code`, and every panel takes its items through `visibleItems` in
  `core/content.js`, which asks `showsForTeam` in `core/teams.js`. docs/team-on-an-item.md says
  how it works and how to give another kind of content the field. In the CSV templates `team` is
  the last column (docs/importing-from-csv.md).
- **Where the regions of the screen sit (the layout).** A theme may have the
  sidebar layout (`layout: 'sidebar'` in `dashboard/themes/registry.js` and
  `studio/themes.js`): Neon Prime has it. A style may have the bar layout. The numbers are in
  `dashboard/core/layout.js`, the placing in `dashboard/layouts/sidebar.css`, the
  column's content in `dashboard/panels/side/`, and docs/layouts.md has the
  sizes, how the big frame is scaled, what does not show, and how to add a layout.
  Neon Prime also has the kit, seven moving neon effects (the name glitch, data
  packets, sweeping lines and others): `dashboard/neon-kit.css`, the section
  "The Neon Prime kit" in `dashboard/frame.js`, and docs/layouts.md, "The kit",
  which also says how to add an effect.
  Try it with `?theme=neon-prime`, and test its speed on the Mini with
  docs/try-it-on-the-mini.md, section 7.
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
- **Tasks from the team board, pinned tasks and Show on TV.** A task has four more
  fields in `studio/schemas/task.js`: `source` (manual or monday, hidden, a task with
  none is pinned), `mondayId` (hidden), `priority` and `showOnTv`. The Tasks line of
  the sidebar is a folder of three lists, Pinned, From the board and Hidden, whose
  filters are at the top of `studio/structure.js`. Every task is in one list. A task
  with source monday opens read only except Show on TV, with one line at the top, and
  `studio/show-on-tv-input.js` draws a task with no value as on. The folder's plus
  button, Pin a task, is the template `pinnedTask` in `studio/add-templates.js`, which
  `sanity.config.js` hands to the Studio and keeps out of the New menus. On the screen,
  `isVisible` in `core/content.js` is the one place that reads `showOnTv`, so both task
  panels leave out a task that is off. `core/sanity.js` puts
  pinned tasks before board tasks with `pinnedFirst` from `core/task-source.js`, and
  each group keeps its Order. `priority` and `mondayId` are not read by the screen.
  `tools/test-task-board.mjs` tests the screen side. In the CSV templates `priority`
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
exceptions are `test-slides-script.mjs` and `test-frc-script.mjs`, which need `jq`.

    node tools/test-calendar.mjs
    node tools/test-weather.mjs
    node tools/test-content.mjs
    node tools/test-themes.mjs
    node tools/test-layouts.mjs
    node tools/test-seasons.mjs
    node tools/test-effects.mjs
    node tools/test-hidden-hours.mjs
    node tools/test-tick.mjs
    node tools/test-night.mjs
    node tools/test-presentation.mjs
    node tools/test-panel-order.mjs
    node tools/test-fixed-values.mjs
    node tools/test-templates.mjs
    node tools/test-publish-all.mjs
    node tools/test-connection-script.mjs
    node tools/test-slides-script.mjs
    node tools/test-install-calendars.mjs
    node tools/test-calendars-script.mjs
    node tools/test-event-pages.mjs
    node tools/test-status-write.mjs
    node tools/test-frc-script.mjs
    node tools/test-competition.mjs
    node tools/test-monday-cards.mjs
    node tools/test-cybertron.mjs
    node tools/test-minimal.mjs
    node tools/test-team-trim.mjs
    node tools/test-pile.mjs
    node tools/test-person-rows.mjs
    node tools/test-presentation-mouse.mjs
    node tools/test-look-rotation.mjs
    node tools/test-console.mjs
    node tools/test-calendar-status.mjs
    node tools/test-calendars-view.mjs
    node tools/check-themes.mjs
    node tools/check-seasons.mjs
    node studio/check-schemas.mjs

Each one ends with a total such as `24 of 24 passed` and says FAIL beside
anything that went wrong. If anything fails, the command ends with an error.
Run all of them after you change code under `dashboard/core/` or a file under
`studio/schemas/`. `check-schemas.mjs` runs `check-themes.mjs` and `check-seasons.mjs`
itself, so after you change a file in `dashboard/themes/` or `dashboard/seasons/` it is
enough to run `check-schemas.mjs`.
`test-templates.mjs` fails when the CSV templates are out of date, so after a
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
  with plain one-colour edges, flat silver screws and no shadow or glint. Comparing the two on the Mini
  shows what the metal costs. The Polish setting in Dashboard Settings sets this
  finish: Polished is `metal`, Flat and Plain are `flat`, and `?look=plain` also
  hides the screws and the double slash in the headers. docs/try-it-on-the-mini.md lists every switch.

## Testing speed on the Mini

See docs/try-it-on-the-mini.md. It also compares the metal finish with the
flat one.

## Credits

The weather comes from Open-Meteo (open-meteo.com), a free service that needs
no key.
