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
                              bounce, spin and fades, and the hidden transitions (docs/hidden-transitions.md)
      perf.js                 the frame-rate readout, shown with ?perf (the P key hides it)
      tokens.css              the two metals, the screws, sizes and timings
      themes/                 one CSS file of colour variables per theme, and registry.js listing them.
                              overlays/ has the holiday overlays the same way, and required.js lists
                              the variables a theme must set (docs/adding-a-theme.md)
      base.css                the 1920x1080 screen and the shared metal shapes
      core/                   helpers used by several panels. plate.js draws the frames, areas.js keeps
                              the frames in place while pages change, schedule.js says what shows when,
                              logo.js and name.js draw the hawk and the team name, source.js
                              decides sample or production content from Dashboard Settings,
                              images.js builds the addresses of photos from Sanity, photos.js says
                              which photos the Photo panel shows and in what order, portrait.js
                              draws a person's framed portrait with the name under it, roster.js
                              makes the pages of the Subteam roster panel, theme.js
                              works out which theme and overlay apply, theme-apply.js puts them on the page,
                              transitions.js chooses the style and the metal of the next page change,
                              events.js merges the BAND events with the Extra events from Studio,
                              connection.js decides why Sanity could not be read and writes the
                              connection status text at the bottom right, device.js reads the Mini's
                              name and addresses (data/live/device.json) for the red version of it
                              night.js says when it is night and where the screensaver logo starts,
                              and night-screen.js draws the night screen (docs/night-mode.md),
                              demo.js decides when a demo from the Studio's Demo page plays and runs its
                              steps, demo-screens.js lists the screens a demo can show, and
                              demo-runner.js starts it (docs/demo.md),
                              hidden.js decides when a hidden transition replaces a page change,
                              hidden-transitions.js lists them, hidden-run.js plays them and
                              hidden-art.js draws their wallpaper and face (docs/hidden-transitions.md),
                              tick.js is the one clock of the screen: it tells every panel when a real
                              second starts by reading the time, not by counting, so the digits never
                              drift, and a panel should write to the page only what has changed
      panels/                 one folder per panel: a script and a stylesheet
      fonts/, assets/         fonts and pictures, all served from here
      data/sample/            sample content with marked placeholders
      data/live/              files the Mini downloads (never committed)
    studio/                   the Sanity editing screen, its buttons (actions.js: the two content source
                              buttons, the Play buttons of the hidden transitions, and Run demo and Stop demo),
                              its copy of the theme lists (themes.js), its copy of the demo screens
                              (demo-screens.js), its copy of the hidden transitions (hidden-transitions.js),
                              and check-schemas.mjs.
                              scripts/ has make-templates.mjs, which writes the CSV templates from the
                              schemas, and import-csv.mjs, which checks filled-in CSVs and makes a file
                              for sanity dataset import (docs/importing-from-csv.md)
    deploy/                   how the Mini runs it: web server, timers, scripts. scripts/check-connection.sh
                              checks the Mini's connection to Sanity, BAND, Docker and the kiosk with one
                              OK or FAIL line each (docs/rebuilding-the-mini.md, "Checking the connection")
    tools/
      serve.py                the server above
      test-calendar.mjs       checks for the calendar reader
      test-weather.mjs        checks for the weather reader and its pictures
      test-content.mjs        checks for the code that reads the editors' content, the photo
                              addresses, which photos show and in what order, the pages of
                              portraits and of the subteam roster, the subteam members, the merging of events and the
                              lines of the Mini's address, and the reasons and the lines of the
                              connection status text
      test-themes.mjs         checks for which theme and overlay apply, and for putting them on the page
      test-night.mjs          checks for night mode: when it is night in a time zone, where the bouncing
                              logo starts and how often it hits a corner, and the night stylesheet
      test-effects.mjs        checks for when the logo animations, the name effect and the screen glitch may start
                              (frame.js), for choosing the page change style and the metal of the frames, and
                              for when a demo plays and what stops it (core/demo.js), and for when a hidden
                              transition plays (core/hidden.js) and what its stylesheet moves
      test-tick.mjs           checks for the clock of the screen (tick.js) with a fake clock, and that the
                              countdown and the banner write only what changed each second
      test-templates.mjs      checks that the CSV templates match the schemas, and the CSV importer
      test-connection-script.mjs  checks for deploy/scripts/check-connection.sh, with fake tools
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
                              adding-a-theme.md, adding-a-holiday-overlay.md, rebuilding-the-mini.md,
                              try-it-on-the-mini.md, the-logo.md, page-transitions.md, night-mode.md,
                              hidden-transitions.md, demo.md and importing-from-csv.md.
                              seed/ has content to import into the Studio: extra-events.ndjson, the
                              starting Extra events. content-templates/ has one CSV template for each
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
  setting: night mode uses the Time zone on the Theme page. `core/night.js`
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
  transitions") moves the five blocks. Try one with `?hidden=desktop` or `?hidden=redEyes`.
- **The demo.** The Demo page in Studio (docs/demo.md): Run demo and Stop demo
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
  `photoSeconds` in `dashboard/config.js`). The screen reads them with the rest of
  the content (`photos` in `core/sanity.js`) and asks Sanity for each at no more
  than 1920 pixels wide (`screenPhotoUrl` in `core/images.js`). `core/photos.js`
  chooses the photo and the one after it, and the panel in `panels/photo/` starts
  loading the next one. docs/editing-content.md has the advice for the people who
  upload. The sample content's `photos` list is what shows on the sample. There is
  no photo list file on the Mini.
- **Photos of people.** Leadership in Studio, Photo and "Show photo on
  screen" (docs/editing-content.md). The screen asks Sanity for each photo at
  the size it is shown, 280 by 280 pixels, in `core/portrait.js`. The silhouette
  for a person with no photo is drawn once in `dashboard/index.html`, and its
  four colours are the `--silhouette-` variables in `dashboard/tokens.css`.
  Three portraits fit on a page, set by `slotsPerPage` in `core/portrait.js`.
  The starting value of the switch is `defaultPerson.showPhoto` in
  `dashboard/config.js` and its copy in `studio/schemas/person.js`.
- **Subteam members.** The Members list of a subteam in Studio
  (`studio/schemas/subteam.js`): first names, up to 24 of 12 characters, with no
  digits and no repeats. The screen tidies them in `normalizeSubteam` in
  `core/sanity.js` (trimmed, no repeats, at most 24, always a list).
  `core/roster.js` makes the pages of the Subteam roster panel, 16 names to a
  page, and the panel is in `panels/roster/`. Its two columns are 344px wide in
  `roster.css`, which holds a name of 12 characters at 56px.
- **Events that are not on BAND.** Extra events in Studio
  (`studio/schemas/extraEvent.js`), described in docs/editing-content.md. The
  screen reads them with the rest of the content (`extraEvents` in
  `core/sanity.js`). `core/events.js` joins them to the BAND events: it sorts
  by start, drops an event once its last day has passed in the Time zone on
  the Theme page, and keeps only the BAND one when both have the same date and
  one title contains the other. `shell.js` merges again when the content
  changes and once a minute. The Events panel and the Next event tile only draw
  the list. An event with no start time is all-day and shows its date and no
  time. The starting seven are in `docs/seed/extra-events.ndjson`, and the
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
- **The theme (the colours of the whole screen), and holiday overlays.** Theme
  in Studio. Its Default theme, "Use a theme now", Schedule and Time zone
  decide which theme and overlay show. The themes are the files in
  `dashboard/themes/` and the lists are `registry.js` there and in
  `dashboard/themes/overlays/`, with a copy in `studio/themes.js`. The starting
  values are `defaultThemeSettings` in `dashboard/config.js` and their copy in
  `studio/schemas/theme.js`. A new theme is docs/adding-a-theme.md and a new
  overlay is docs/adding-a-holiday-overlay.md. The screen works out the theme
  when it starts and once a minute, and changes it at the next page change of
  the large panel. The Time zone is also the one the Theme page uses to read
  dates. Try a theme with `?theme=<id>` and an overlay with `?overlay=<id>`.
- **A new panel, or the look of the frames.** See docs/adding-a-panel.md. How the
  frames change page and get their metal is docs/page-transitions.md. The
  plates are flat purple and the metal is on the edges only. The metal is made
  from the colours in `dashboard/tokens.css`, so change those to restyle it.
  The other colours are the theme's: `dashboard/themes/hawktimus.css`.
- **A new field on something editors fill in.** See docs/adding-a-field.md.
- **Many items at once from a spreadsheet.** See docs/importing-from-csv.md.
  The CSV templates in `docs/content-templates/` are written from the schemas
  by `studio/scripts/make-templates.mjs`, so a schema change means running it
  again.

## Checking your work

Run these in the terminal, from this folder. They need Node.js, the same
version as the Studio (22.12 or newer), and nothing else installed.

    node tools/test-calendar.mjs
    node tools/test-weather.mjs
    node tools/test-content.mjs
    node tools/test-themes.mjs
    node tools/test-effects.mjs
    node tools/test-tick.mjs
    node tools/test-night.mjs
    node tools/test-templates.mjs
    node tools/test-connection-script.mjs
    node tools/check-themes.mjs
    node studio/check-schemas.mjs

Each one ends with a total such as `24 of 24 passed` and says FAIL beside
anything that went wrong. If anything fails, the command ends with an error.
Run all eleven after you change code under `dashboard/core/` or a file under
`studio/schemas/`. `check-schemas.mjs` runs `check-themes.mjs` itself, so after
you change a file in `dashboard/themes/` it is enough to run `check-schemas.mjs`.
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
  (`?overlay=none` for no overlay). The address wins over the Theme page.
- A hidden transition can be tried with `?hidden=desktop` or `?hidden=redEyes`, and kept
  away with `?hidden=off` (docs/hidden-transitions.md). Add `?night=off` at night.
- The night screen can be tried with `?night=on`, and kept away with `?night=off`
  (docs/night-mode.md). It also has a Preview night mode switch in Dashboard Settings.
- The announcement and the night screen together can be shown with Run demo on the
  Demo page in Studio (docs/demo.md).
- Calm mode (`?motion=calm`, or Motion in Dashboard Settings) switches off
  every effect and leaves only short fades. `?motion=none` stops all movement.
- Speed can be tried with `?speed=very-slow`, `?speed=slow`, `?speed=normal`
  or `?speed=fast`. The address wins over Dashboard Settings.
- The frames have polished, aged metal edges with silver screws at the joints.
  That is `?finish=metal`, the normal look. `?finish=flat` shows the same screen
  with plain one-colour edges, flat silver screws and no shadow or glint. Comparing the two on the Mini
  shows what the metal costs. docs/try-it-on-the-mini.md lists every switch.

## Testing speed on the Mini

See docs/try-it-on-the-mini.md. It also compares the metal finish with the
flat one.

## Credits

The weather comes from Open-Meteo (open-meteo.com), a free service that needs
no key.
