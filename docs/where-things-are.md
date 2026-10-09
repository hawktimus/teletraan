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

The screen asks the editing screen's Dashboard Settings which content to show:
the sample or the editors' own (production). While it shows the sample, every
piece of sample text is in [square brackets] and a SAMPLE CONTENT label shows
on the screen. If the settings cannot be read, and none were saved on this
computer, `useSampleContent` in `dashboard/config.js` decides: `true` shows
the sample, `false` shows the editors' content. That is the case before the
setup in studio/README.md is finished (step 6, the CORS origin, is what lets
the screen read them). Once it can read them, a Studio with nothing published
shows production, which is empty, until someone uses "Use sample content". The
browser console shows a 404 line for `data/live/version.txt`. That is
expected: the Mini writes that file.

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
and switch the screen over from the sample. studio/README.md has every step.
In short, from the `studio` folder in the Terminal app: `npm install`,
`npx sanity login`, `npm run dev`, then add `http://localhost:8080` (this Mac)
and `http://localhost:3229` (the Mini) as CORS origins in the Sanity project
settings, publish some content, use "Use
production content" in Dashboard Settings, and run `npm run deploy` so the
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
                              logo.js and name.js draw the hawk and the team name (name.js can also put the
                              name on two lines, which nothing uses now), countdown.js is the countdown's parts and
                              the code that writes its numbers, for every layout and for the war clock, source.js
                              decides sample or production content from Dashboard Settings,
                              images.js builds the addresses of photos from Sanity, photos.js says
                              which photos the Photo panel shows and in what order, portrait.js
                              draws a person's framed portrait with the name under it, leadership.js
                              makes the pages of the Leadership panel, one role to a page, roster.js
                              makes the pages of the Subteam roster panel, theme.js
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
                              transitions.js chooses the style and the metal of the next page change,
                              look.js turns the Polish setting (polished, flat or plain) into the page
                              switches the stylesheets read (data-finish, data-glint and data-look),
                              events.js merges the BAND events with the Events Calendar entries from Studio,
                              connection.js decides why Sanity could not be read and writes the
                              connection status text at the bottom right, device.js reads the Mini's
                              name and addresses (data/live/device.json) for the red version of it
                              night.js says when it is night and where the screensaver logo starts,
                              and night-screen.js draws the night screen (docs/night-mode.md),
                              demo.js decides when a demo from the Studio's Test the screen page plays and runs its
                              steps, demo-screens.js lists the screens a demo can show, and
                              demo-runner.js starts it (docs/demo.md),
                              announce.js decides when the Play announcements button plays every
                              announcement that is switched on, and announce-run.js starts it
                              (docs/hidden-transitions.md),
                              hidden.js decides when a hidden transition replaces a page change,
                              hidden-transitions.js lists them, hidden-run.js plays them and
                              hidden-pictures.js lists their four pictures (in assets/hidden) and
                              which one plays next (docs/hidden-transitions.md),
                              presentation.js decides when a booked talk shows its title card and its
                              slides, what each key of the clicker does and which talks were skipped,
                              and presentation-run.js puts that on the screen and reads the keys (the
                              cards and the slides are drawn by panels/talk, docs/presentations.md),
                              presentation-test.js decides when the Run presentation test button starts
                              the sample talk, and presentation-test-run.js starts it
                              (docs/hidden-transitions.md),
                              preview.js decides when a Preview button holds a team, a style or a seasonal
                              pack on the screen for 2 minutes, and preview-run.js starts it. What it holds is
                              kept by previewStyle in style.js, previewTeam in teams.js and previewPack in
                              theme.js (docs/hidden-transitions.md, "Preview a look"),
                              tick.js is the one clock of the screen: it tells every panel when a real
                              second starts by reading the time, not by counting, so the digits never
                              drift, and a panel should write to the page only what has changed
      panels/                 one folder per panel: a script and a stylesheet. panels/side is the whole
                              column of the sidebar layout, in place of the banner and the countdown
                              (docs/layouts.md, "The sidebar"). panels/bar-banner and panels/bar-column are
                              the banner and the side column of the bar layout (docs/layouts.md, "The bar
                              layout"). The war clock in that banner is drawn by panels/countdown, as a
                              second rendering of the countdown (docs/layouts.md, "The war clock").
                              panels/tonight is the Up Next panel (docs/up-next.md)
      fonts/, assets/         fonts and pictures, all served from here
      data/sample/            sample content with marked placeholders, and a sample talk with six slides
                              (slides/presentation-sample)
      data/live/              files the Mini downloads (never committed)
    studio/                   the Sanity editing screen, its sidebar (structure.js: one list with a line
                              for each entry, so changing the order means moving a line,
                              docs/reordering-the-sidebar.md), its buttons (actions.js: the two content source
                              buttons, the Play buttons of the hidden transitions, Play announcements, Run presentation test, the Preview buttons, and Run demo and Stop demo),
                              its two pages that are not documents (start-here.js and calendars-view.js),
                              its copy of the theme lists (themes.js), its copy of the demo screens
                              (demo-screens.js), its copy of the hidden transitions (hidden-transitions.js),
                              its copy of the previews (previews.js),
                              the Publish all tool in the top bar (publish-all-tool.js is the page and
                              publish-all.js is its logic, docs/publish-all.md), and check-schemas.mjs.
                              schemas/ has a file for each kind of content. calendarFilter.js is the
                              Calendar filters (docs/calendar-filters.md), presentationDay.js the Meeting
                              days, presentation.js the booked talks and settingsPresentations.js the
                              Presentations tab of Dashboard Settings (docs/presentations.md). team.js is the
                              Teams list and settingsTeams.js the Teams tab. The Team radio on tasks, sponsors and
                              the other kinds of content is team-input.js, put on each by teamField in fields.js
                              scripts/ has make-templates.mjs, which writes the CSV templates from the
                              schemas, and import-csv.mjs, which checks filled-in CSVs and makes a file
                              for sanity dataset import (docs/importing-from-csv.md)
    deploy/                   how the Mini runs it: web server, timers, scripts. scripts/check-connection.sh
                              checks the Mini's connection to Sanity, BAND, Docker and the kiosk with one
                              OK or FAIL line each (docs/rebuilding-the-mini.md, "Checking the connection").
                              scripts/fetch-calendars.sh downloads the BAND calendars in local.env into the
                              data folder (docs/calendar-links.md).
                              scripts/check-calendars.sh lists the events of each calendar in local.env and
                              says which ones the Calendar filters hide. It needs Node, so it runs on a
                              computer that has it, not on the Mini. check-calendars.mjs is the part of it
                              that runs the dashboard's own calendar code.
                              scripts/slides-sync.sh downloads the slides of the coming talks and turns them
                              into pictures in the data folder (docs/presentations.md).
                              scripts/install-timers.sh turns on the calendar timer and the pull timer,
                              install-calendars.sh only the calendar timer and install-slides.sh the slides
                              timer (docs/rebuilding-the-mini.md, step 11). systemd/ has the unit files they
                              copy into place.
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
                              portraits, of the Leadership panel and of the subteam roster, the subteam members, the merging of events and the
                              lines of the Mini's address, and the reasons and the lines of the
                              connection status text, for the Polish setting: its cleaning, the
                              switches each look sets and the rules for Plain in base.css, and for
                              teams: the cleaning of a team, the team each mode asks for, which items
                              show for which team in every panel, and the Teams settings
      test-themes.mjs         checks for which theme and overlay apply, for putting them on the page, for the
                              ticker prefix, banner line and corner art that a seasonal pack rule can carry, and
                              for putting the team on the page: its seven colors, its initials and the mirror class
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
      test-effects.mjs        checks for when the logo animations, the name effect and the screen glitch may start
                              (frame.js), for choosing the page change style and the metal of the frames, and
                              for when a demo plays and what stops it (core/demo.js), and for when a hidden
                              transition plays (core/hidden.js) and what its stylesheet moves
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
      test-cybertron.mjs      checks for Cybertron on the layout of Original: which layout each style has, its four
                              frames, the stage, the banner and the ticker on their plates, the wide war clock, and
                              that the frames are drawn again when the style changes
      test-minimal.mjs        checks for Minimal on the bar layout: what the order gives it, what it must not have
                              (stamped ids, hazard stripes, scanlines, slashes, conduit, brackets), and the list of
                              what it shares with Cybertron
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
                              calendar-links.md, hide-a-repeating-meeting.md, switch-the-look.md,
                              add-the-nova-team.md and team-on-an-item.md.
                              seed/ has content to import into the Studio: places.ndjson, the three
                              starting locations, teams.ndjson, the two starting teams, and extra-events.ndjson, the
                              starting Events Calendar entries. content-templates/ has one CSV template for each
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
- **How long a panel stays, and in what order.** Dashboard Settings, Panels
  tab. "Seconds per page" is the time for the whole board (`pageSeconds` in
  `dashboard/config.js`, 20 to start). The small panel stays three quarters as
  long and the ticker one and a half times as long. A panel in the lists can
  have seconds of its own, and then that is used instead. The order is the
  lists in `defaultSettings.rotation` and `studio/schemas/settingsRotation.js`.
  The Photo panel is the exception: with no seconds of its own it follows
  "Seconds per photo" in the Photos tab (`photoSeconds`, 16 to start).
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
  Transitions tab (docs/page-transitions.md): Page change style (alternate,
  slat or mechanical), Break and rebuild time, Frame finish (mostly gold,
  alternate, gold or silver only) and Silver chance. The starting values are
  `pageChangeStyle`, `breakSeconds`, `frameFinish` and `silverChance` in
  `defaultSettings` in `dashboard/config.js`, and the limits are `limits`
  there. The Studio fields are all in `studio/schemas/settingsTransitions.js`,
  so the whole tab can be removed by deleting that file. `core/transitions.js`
  chooses, `frame.js` starts the change and `frame.css` has the motion. Try them
  with `?change=slat|mechanical|alternate` and
  `?frames=gold|silver|alternate|mostly-gold`.
- **Night mode, the screensaver.** Dashboard Settings, Night mode tab
  (docs/night-mode.md): Use night mode, Night style, the start and end times,
  Logo width, Bounce speed and Preview night mode. The starting values are
  `nightEnabled`, `nightStyle`, `nightStart`, `nightEnd`, `nightLogoWidth`,
  `nightSpeed` and `nightPreview` in `defaultSettings` in `dashboard/config.js`,
  with `nightSpeeds` (the seconds the logo takes to cross the screen) and
  `limits` there. The Studio fields are all in `studio/schemas/settingsNight.js`,
  so the whole tab can be removed by deleting that file. There is no time zone
  setting: night mode uses the Time zone on the Look page. `core/night.js`
  decides when it is night and where the logo starts, `core/night-screen.js`
  shows and hides the black layer, and `frame.css` ("Night mode") has the
  bounce, the spin and the fades. Try it with `?night=on` and `?night=off`.
- **Hidden transitions.** Dashboard Settings, Hidden tab (docs/hidden-transitions.md):
  Allow hidden transitions, Desktop reveal chance and Red eyes chance, and Last push, with
  the buttons Play desktop reveal and Play red eyes in the menu beside Publish. The starting
  values are `hiddenEnabled`, `desktopChance`, `redEyesChance` and `hiddenRequest` in
  `defaultSettings` in `dashboard/config.js`, with `limits` there. The Studio fields are all in
  `studio/schemas/settingsHidden.js`, the buttons are made in `studio/actions.js` from
  `studio/hidden-transitions.js`, a copy of `hiddenTransitions` in
  `dashboard/core/hidden-transitions.js`. A new transition is one entry in each, plus a chance
  field. `core/hidden.js` decides, `core/hidden-run.js` plays, and `frame.css` ("Hidden
  transitions" and "The blue glitch") moves the five blocks and the glitches. The four
  pictures are in `dashboard/assets/hidden/`, and `core/hidden-pictures.js` says how each one
  fills the screen and which one plays next. Try one with `?hidden=desktop` or `?hidden=redEyes`.
- **Play announcements.** A button in the menu beside Publish on Dashboard Settings
  (docs/hidden-transitions.md) that plays every announcement that is switched on, once, whatever
  its time and days. It writes the hidden `announceRequest` field (`announceRequestField` in
  `studio/schemas/settingsAnnouncements.js`, the button is `usePlayAnnouncementsAction` in
  `studio/actions.js`). The starting value is `announceRequest` in `defaultSettings` in
  `dashboard/config.js`. `core/announce.js` decides and `core/announce-run.js` plays it. A Demo step
  can use it too: All announcements in `demoScreens`.
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
  sample talk and `startTestTalk` in `core/presentation-run.js` puts it on the screen.
- **The demo.** The Test the screen page in Studio (docs/demo.md): Run demo and Stop demo
  in its menu, the Steps, and the Demo announcement text. The starting values
  are `defaultDemo` in `dashboard/config.js` and their copy in
  `studio/schemas/demo.js`, with `limits.demoSeconds` and `demoMaxSteps` there.
  The screens a demo can show are `demoScreens` in `dashboard/core/demo-screens.js`
  with a copy in `studio/demo-screens.js`. A new screen is one entry in each
  (docs/demo.md). `core/demo.js` decides when a demo plays and runs the steps.
- **The logo animations and the team name effect.** Dashboard Settings, Logo
  tab (docs/the-logo.md). A master switch, the entrance, and for the spin, the
  flying hawk and the name effect a switch, the seconds between plays (0 is
  never) and the seconds one play lasts. The starting values are
  `logoAnimations`, `logoEntrance`, `logoSpin`, `logoSpinEvery`,
  `logoSpinDuration`, `logoHawk`, `logoHawkEvery`, `logoHawkDuration`,
  `nameTransform`, `nameEvery` and `nameDuration` in `defaultSettings` in
  `dashboard/config.js`, and the limits are `limits` there. The Studio fields
  are all in `studio/schemas/settingsLogo.js`, so the whole tab can be removed
  by deleting that file. `frame.js` decides when any of them may start (one at
  a time, never while a page is changing), and `frame.css` has the motion.
- **The screen glitch.** Dashboard Settings, Screen tab, Screen glitch: a
  switch, the seconds between glitches (0 is never) and the seconds one lasts.
  The starting value is `crt` in `defaultSettings` in `dashboard/config.js`.
  The glitch is the old television effect over the whole screen, and it
  waits in the same line as the logo animations. A published glitch that still
  has `everyMinutes` is read as seconds (`tidyGlitch` in
  `dashboard/core/content.js`).
- **The announcement times and words.** Dashboard Settings, Announcements
  tab. The starting values are `defaultSettings.announcements` in
  `dashboard/config.js` and `startingList` in
  `studio/schemas/settingsAnnouncements.js`. The announcement panel keeps
  one more copy of the first line, for an announcement that has none.
- **Sample or production content.** Dashboard Settings, Content source tab,
  or the "Use sample content" and "Use production content" buttons in the menu
  beside Publish (docs/editing-content.md). The screen follows within about 30
  seconds. "Switch back to production at" ends a stretch of sample content by
  itself. `useSampleContent` in `dashboard/config.js` is not that switch. It is
  only what the screen does when it cannot read Dashboard Settings and has no
  saved copy of them. The starting value of Content source is
  `defaultSettings.contentSource` in `dashboard/config.js` and its copy in
  `studio/schemas/dashboardSettings.js`.
- **Photos for the Photo panel.** Photos in the Studio sidebar
  (`studio/schemas/photo.js`): a picture, an optional caption, a first name
  credit, "Show on screen" and "Hide after". Dashboard Settings, Photos tab: Photo
  order (random or newest first) and Seconds per photo (`photoOrder` and
  `photoSeconds` in `dashboard/config.js`), and the two size settings below.
  The screen reads them with the rest of
  the content (`photos` in `core/sanity.js`) and asks Sanity for each at no more
  than 1920 pixels wide (`screenPhotoUrl` in `core/images.js`). `core/photos.js`
  chooses the photo and the one after it, and the panel in `panels/photo/` starts
  loading the next one. docs/editing-content.md has the advice for the people who
  upload. The sample content's `photos` list is what shows on the sample. There is
  no photo list file on the Mini.
- **How big the pictures are.** Dashboard Settings, Photos tab: "Portrait size,
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
  Three portraits fit on a page, set by `slotsPerPage` in `core/portrait.js`.
  `core/leadership.js` builds the pages of the Leadership panel from it: one
  role to a page (coaches, captains, mentors), and a role with more than three
  people is shared out evenly, so 4 are 2 and 2. A shorter page keeps the same
  portrait size and sits in the middle of the row (the section People
  portraits in `dashboard/base.css`). At full size the portrait is 292 pixels
  square with the 280 pixel photo 6 pixels in from the edge (`portraitSize` in
  `core/portrait.js`). The photo is always asked for at 280, whatever the
  Portrait size setting says, so the copy loaded ahead of time is the one shown.
  The starting value of the switch is `defaultPerson.showPhoto` in
  `dashboard/config.js` and its copy in `studio/schemas/person.js`.
- **Subteam members.** The Members list of a subteam in Studio
  (`studio/schemas/subteam.js`): first names, up to 24 of 12 characters, with no
  digits and no repeats. The screen tidies them in `normalizeSubteam` in
  `core/sanity.js` (trimmed, no repeats, at most 24, always a list).
  `core/roster.js` makes the pages of the Subteam roster panel, 16 names to a
  page, and the panel is in `panels/roster/`. Its two columns are 344px wide in
  `roster.css`, which holds a name of 12 characters at 56px.
- **Events that are not on BAND.** Events Calendar in Studio
  (`studio/schemas/extraEvent.js`), described in docs/editing-content.md. The
  screen reads them with the rest of the content (`extraEvents` in
  `core/sanity.js`). `core/events.js` joins them to the BAND events: it sorts
  by start, drops an event once its last day has passed in the Time zone on
  the Look page, and keeps only the BAND one when both have the same date and
  one title contains the other. `shell.js` merges again when the content
  changes and once a minute. The Events panel and the Next event tile only draw
  the list. Both write the date with `eventDate()` in `core/events.js`, in the
  Time zone on the Look page: the month with the day (`APR 2`), the weekday
  where the panel shows one, and a range as `APR 2-4` or `MAR 30-APR 1`. An
  event with no start time is all-day and shows its date and no time. The starting seven are in `docs/seed/extra-events.ndjson`, and the
  command to import them is in docs/editing-content.md. The sample content has
  three of its own.
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
- **The connection status text.** Dashboard Settings, Connection tab, Show
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
- **The style of the whole screen.** Style in Dashboard Settings (Screen tab) is
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
- **The teams, and the team on the screen.** Teams in the Studio sidebar
  (`studio/schemas/team.js`): a name, a short name, a number, a code, an optional logo, seven
  colors, Mirror the layout, Active and Order. The two starting teams are in
  `docs/seed/teams.ndjson`, and the command to import them is in docs/add-the-nova-team.md.
  Dashboard Settings, Teams tab: Team mode (`teamMode`, Prime only to start with, from
  `teamModes`) and Minutes for each team (`alternateMinutes`, 5 to start with, 1 to 30), in
  `studio/schemas/settingsTeams.js`, so the whole tab can be removed by deleting that file. The
  starting values, the limits and the built-in Prime team (`primeTeam`, which the screen uses
  when the Studio has no teams) are in `dashboard/config.js`. `teamsFrom` in `core/sanity.js`
  cleans the documents, `core/teams.js` chooses the team (`chooseTeam`) and puts it on the page
  (`applyTeamLook`), and `core/areas.js` calls `changeTeamNow` while the large frame is apart, so
  a swap never happens in the middle of a panel. `teams.css` has the starting colors. Try one
  with `?team=prime|nova|alternate`, or with the Preview Prime and Preview Nova buttons.
- **Which team an item is for.** The Team field of a task, plan, subteam, person, sponsor, talk,
  meeting day, extra panel, tip or news line and Events Calendar entry (`teamField` in
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
  characters. The location is a reference to a Locations entry (`studio/schemas/place.js`:
  a name of up to 16 characters that no other location has, capitals ignored, and
  a show switch). The query in `core/sanity.js` follows the reference
  (`location->name`) and asks whether the location is showing, and `normalizeTask`
  in the same file turns a hidden, deleted or nameless location into no location.
  The task stays on the screen. The Tasks panel (`panels/tasks/`) draws a task
  with a contact or a location on two lines, so a row of two lines holds one
  such task or two plain tasks, and a page is three rows. When there are more
  rows it shows the next page each time it comes round (`makePages` in
  `core/turns.js`). A Done task shows only its name. The starting locations are in
  `docs/seed/places.ndjson`, and the command to import them is in
  docs/editing-content.md. In the CSV templates `contact` and `location` are
  the last two columns of task.csv, and the importer knows the starting locations
  (docs/importing-from-csv.md).
- **A new field on something editors fill in.** See docs/adding-a-field.md.
- **Many items at once from a spreadsheet.** See docs/importing-from-csv.md.
  The CSV templates in `docs/content-templates/` are written from the schemas
  by `studio/scripts/make-templates.mjs`, so a schema change means running it
  again.

## Checking your work

Run these in the terminal, from this folder. They need Node.js, the same
version as the Studio (22.12 or newer), and nothing else installed. The one
exception is `test-slides-script.mjs`, which needs `jq`.

    node tools/test-calendar.mjs
    node tools/test-weather.mjs
    node tools/test-content.mjs
    node tools/test-themes.mjs
    node tools/test-layouts.mjs
    node tools/test-seasons.mjs
    node tools/test-effects.mjs
    node tools/test-tick.mjs
    node tools/test-night.mjs
    node tools/test-presentation.mjs
    node tools/test-templates.mjs
    node tools/test-publish-all.mjs
    node tools/test-connection-script.mjs
    node tools/test-slides-script.mjs
    node tools/test-install-calendars.mjs
    node tools/test-calendars-script.mjs
    node tools/test-cybertron.mjs
    node tools/test-minimal.mjs
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
- The announcement and the night screen together can be shown with Run demo on the
  Test the screen page in Studio (docs/demo.md).
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
