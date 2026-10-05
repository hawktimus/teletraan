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

The Mini's name and addresses show in a red strip at the bottom of the screen,
only while the banner says OFFLINE (core/device.js). To see it on your
computer, open the dashboard with no internet and no saved copy of the content
(a private window), and put the four values in `dashboard/data/live/device.json`
as in "Finding the Mini on the network" in docs/rebuilding-the-mini.md. Git
ignores the files in that folder.

## The editing screen (Studio)

The Sanity project exists. Its ID, `ybfqe345`, is in `studio/project.js` and in
`dashboard/config.js`, and its dataset is called `production`. What is left is
to run the Studio on a Mac, let the dashboard read from it, type some content
and switch the screen over from the sample. studio/README.md has every step.
In short, from the `studio` folder in the Terminal app: `npm install`,
`npx sanity login`, `npm run dev`, then add `http://localhost:8080` as a CORS
origin in the Sanity project settings, publish some content, use "Use
production content" in Dashboard Settings, and run `npm run deploy` so the
editors can sign in from anywhere.

## What is where

    dashboard/
      index.html, shell.js    starts everything. index.html also draws the metal gradients
      registry.js             the list of every panel
      config.js               the weather location, the Sanity project, the fallback content flag, the speeds, the defaults
      frame.js, frame.css     everything that moves: the page change, the logo's show, the name effect,
                              the screen glitch and the scheduler that says when those two may start
      perf.js                 the frame-rate readout, shown with ?perf (the P key hides it)
      tokens.css              the two metals, sizes and timings
      themes/                 one CSS file of colour variables per theme, and registry.js listing them.
                              overlays/ has the holiday overlays the same way, and required.js lists
                              the variables a theme must set (docs/adding-a-theme.md)
      base.css                the 1920x1080 screen and the shared metal shapes
      core/                   helpers used by several panels. plate.js draws the frames, areas.js keeps
                              the frames in place while pages change, schedule.js says what shows when,
                              logo.js and name.js draw the hawk and the team name, source.js
                              decides sample or production content from Dashboard Settings,
                              images.js builds the addresses of photos from Sanity, portrait.js
                              draws a person's framed portrait with the name under it, theme.js
                              works out which theme and overlay apply, theme-apply.js puts them on the page,
                              events.js merges the BAND events with the Extra events from Studio,
                              device.js shows the Mini's name and addresses (data/live/device.json) in the
                              strip at the bottom of the screen, only while the banner says OFFLINE
      panels/                 one folder per panel: a script and a stylesheet
      fonts/, assets/         fonts and pictures, all served from here
      data/sample/            sample content with marked placeholders
      data/live/              files the Mini downloads (never committed)
    studio/                   the Sanity editing screen, its two content source buttons
                              (actions.js), its copy of the theme lists (themes.js), and check-schemas.mjs
    deploy/                   how the Mini runs it: web server, timers, scripts
    tools/
      serve.py                the server above
      test-calendar.mjs       checks for the calendar reader
      test-weather.mjs        checks for the weather reader and its pictures
      test-content.mjs        checks for the code that reads the editors' content, the photo
                              addresses, the pages of portraits, the merging of events and the
                              lines of the Mini's address
      test-themes.mjs         checks for which theme and overlay apply, and for putting them on the page
      test-effects.mjs        checks for when the name effect and the screen glitch may start (frame.js)
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
    docs/                     how-to guides. seed/ has content to import into the Studio:
                              extra-events.ndjson, the starting Extra events

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
- **The colour of the frame edges.** Dashboard Settings, Screen tab, Frame
  metal: Gold or Silver. Glint turns the bright spark that runs round each
  frame on or off. The metals are the `--metal-` colours in
  `dashboard/tokens.css`. Try them with `?metal=gold`, `?metal=silver` and
  `?glint=off`.
- **The team name effect and the screen glitch.** Dashboard Settings, Logo and
  effects tab. Each has a switch, the seconds between plays (0 is never) and
  the seconds one play lasts. The starting values are `nameTransform`,
  `nameEvery`, `nameDuration` and `crt` in `defaultSettings` in
  `dashboard/config.js`, and the limits are `limits` there. The name splits
  into pieces, spins and locks back together. The glitch is the old television
  effect over the whole screen. `frame.js` decides when either may start (one
  at a time, never while a page is changing, the name only while the logo
  rests), and `frame.css` has the motion. A published glitch that still has
  `everyMinutes` is read as seconds (`tidyGlitch` in `dashboard/core/content.js`).
  The logo's own timing is not a Studio setting. It is the list `logoShow` in
  `dashboard/frame.js`.
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
- **Photos of people.** Leadership in Studio, Photo and "Show photo on
  screen" (docs/editing-content.md). The screen asks Sanity for each photo at
  the size it is shown, 280 by 280 pixels, in `core/portrait.js`. The silhouette
  for a person with no photo is drawn once in `dashboard/index.html`, and its
  four colours are the `--silhouette-` variables in `dashboard/tokens.css`.
  Three portraits fit on a page, set by `slotsPerPage` in `core/portrait.js`.
  The starting value of the switch is `defaultPerson.showPhoto` in
  `dashboard/config.js` and its copy in `studio/schemas/person.js`.
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
- **The logo's show.** A 24 second show: the hawk, a robot, a flying hawk and
  back. See docs/the-logo.md.
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
- **A new panel, or the look of the frames.** See docs/adding-a-panel.md. The
  plates are flat purple and the metal is on the edges only. The metal is made
  from the colours in `dashboard/tokens.css`, so change those to restyle it.
  The other colours are the theme's: `dashboard/themes/hawktimus.css`.
- **A new field on something editors fill in.** See docs/adding-a-field.md.

## Checking your work

Run these in the terminal, from this folder. They need Node.js, the same
version as the Studio (22.12 or newer), and nothing else installed.

    node tools/test-calendar.mjs
    node tools/test-weather.mjs
    node tools/test-content.mjs
    node tools/test-themes.mjs
    node tools/test-effects.mjs
    node tools/check-themes.mjs
    node studio/check-schemas.mjs

Each one ends with a total such as `24 of 24 passed` and says FAIL beside
anything that went wrong. If anything fails, the command ends with an error.
Run all seven after you change code under `dashboard/core/` or a file under
`studio/schemas/`. `check-schemas.mjs` runs `check-themes.mjs` itself, so after
you change a file in `dashboard/themes/` it is enough to run `check-schemas.mjs`.

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
  changing or the name effect is playing. In the browser console,
  `import('./frame.js').then(frame => frame.playCrt())` plays it once and
  `frame.playNameEffect()` does the same for the name.
- The announcements can be tried with `?demo=announcement`, and an alert with
  `?demo=alert`.
- A theme can be tried with `?theme=<id>` and an overlay with `?overlay=<id>`
  (`?overlay=none` for no overlay). The address wins over the Theme page.
- Calm mode (`?motion=calm`, or Motion in Dashboard Settings) switches off
  every effect and leaves only short fades. `?motion=none` stops all movement.
- Speed can be tried with `?speed=very-slow`, `?speed=slow`, `?speed=normal`
  or `?speed=fast`. The address wins over Dashboard Settings.
- The frames have polished, aged metal edges with bolts. That is
  `?finish=metal`, the normal look. `?finish=flat` shows the same screen with
  plain one-colour edges and no shadow or glint. Comparing the two on the Mini
  shows what the metal costs. docs/try-it-on-the-mini.md lists every switch.

## Testing speed on the Mini

See docs/try-it-on-the-mini.md. It also compares the metal finish with the
flat one.

## Credits

The weather comes from Open-Meteo (open-meteo.com), a free service that needs
no key.
