# Teletraan I

The wall dashboard for Hawktimus Prime, FRC Team 3229 at Holly Springs High School.
This is intended to run on the TV in the classroom for robotics and will be running off of a device connected to the back. Currently, we are using a Mac mini 2014 which has Debian 13 installed on it and set for auto-login and auto-launch.

This dashboard should show the following items:
Team Name
Date/Time/Weather
Countdown Timer
Team Tasks
Upcoming Events
Sponsors
Photos - Randomized
A few other boards.

It is also programmed to make an announcement at the beginning of the meeting at 2:30pm and at 5:00pm.

The interface uses plain HTML, CSS, and Javascript. Nothing needs to be installed. If the code needs to be edited, just edit the file and refresh the page.

For adjusting the content that gets displayed, Sanity will be used. 

It is plain HTML, CSS and JavaScript. There is nothing to install and there is
no build step. Edit a file, refresh the page, see the change.

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

The screen starts out showing sample content, so it works before the editing
screen has anything in it. Every piece of sample text is in [square brackets].
It stays that way until `useSampleContent` in `dashboard/config.js` is changed
to `false`, which is step 8 of the setup in studio/README.md. The browser
console shows a few 404 lines for files under `data/live/`. That is expected:
the Mini downloads those files, so on your computer the dashboard uses the
ones in `data/sample/` instead.

## The editing screen (Studio)

The Sanity project exists. Its ID, `ybfqe345`, is in `studio/project.js` and in
`dashboard/config.js`, and its dataset is called `production`. What is left is
to run the Studio on a Mac, let the dashboard read from it, type some content
and switch the screen over from the sample. studio/README.md has every step.
In short, from the `studio` folder in the Terminal app: `npm install`,
`npx sanity login`, `npm run dev`, then add `http://localhost:8080` as a CORS
origin in the Sanity project settings, publish some content, set
`useSampleContent` to `false`, and run `npm run deploy` so the editors can
sign in from anywhere.

## What is where

    dashboard/
      index.html, shell.js    starts everything. index.html also draws the metal gradients
      registry.js             the list of every panel
      config.js               the weather location, the content source, the speeds, the defaults
      frame.js, frame.css     everything that moves, including the logo's show
      perf.js                 the frame-rate readout, shown with ?perf (the P key hides it)
      tokens.css              colours, the metal finish, sizes and timings
      base.css                the 1920x1080 screen and the shared metal shapes
      core/                   helpers used by several panels, including plate.js, which draws a plate
      panels/                 one folder per panel: a script and a stylesheet
      fonts/, assets/         fonts and pictures, all served from here
      data/sample/            sample content with marked placeholders
      data/live/              files the Mini downloads (never committed)
    studio/                   the Sanity editing screen, and check-schemas.mjs
    deploy/                   how the Mini runs it: web server, timers, scripts
    tools/
      serve.py                the server above
      test-calendar.mjs       checks for the calendar reader
      test-weather.mjs        checks for the weather reader and its pictures
      test-content.mjs        checks for the code that reads the editors' content
      testdata/               the calendar files test-calendar.mjs reads
      icons.html              every weather picture on one page, at
                              http://localhost:8080/tools/icons.html
      logo.html               the hawk logo large, with every act and key pose, at
                              http://localhost:8080/tools/logo.html
      perf/                   the comparison page for the speed test: the Tasks panel built
                              from plain plates, in metal or flat, at
                              http://localhost:8080/tools/perf/plates.html
    docs/                     how-to guides

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
  tab. The starting values are `defaultSettings.rotation` in
  `dashboard/config.js` and the lists in `studio/schemas/settingsRotation.js`.
- **The announcement times and words.** Dashboard Settings, Announcements
  tab. The starting values are `defaultSettings.announcements` in
  `dashboard/config.js` and `startingList` in
  `studio/schemas/settingsAnnouncements.js`. The announcement panel keeps
  one more copy of the first line, for an announcement that has none.
- **Where the weather is taken from.** `location` in `dashboard/config.js`
  only. Editors cannot change it. Use latitude and longitude: in the United
  States latitude is positive and longitude is negative. Temperatures are
  shown in Fahrenheit.
- **How fast a panel arrives.** The start times are the tables at the top of
  `dashboard/frame.js`. How long each move takes is in `dashboard/tokens.css`.
  Both are written for normal speed.
- **How fast everything goes.** Dashboard Settings, Screen tab, Speed: Very
  slow, Slow, Normal or Fast. It makes every move, and how long each panel and
  ticker line stays, 2, 1.5, 1 or 0.75 times as long. A panel never stays less
  than 5 seconds. The announcements and alerts, the clock, the countdown and
  the weather and calendar updates do not change. The numbers are `speeds` in
  `dashboard/config.js`. The starting value is `defaultSettings.speed` there,
  and its copy in `studio/schemas/dashboardSettings.js`.
- **The logo's show.** The hawk's wingbeats, its glide and its wing stretch. See
  docs/the-logo.md.
- **A new panel, or the metal look.** See docs/adding-a-panel.md. The metal is
  made from the colours in `dashboard/tokens.css`, so change those to restyle it.
- **A new field on something editors fill in.** See docs/adding-a-field.md.

## Checking your work

Run these in the terminal, from this folder. They need Node.js, the same
version as the Studio (22.12 or newer), and nothing else installed.

    node tools/test-calendar.mjs
    node tools/test-weather.mjs
    node tools/test-content.mjs
    node studio/check-schemas.mjs

Each one ends with a total such as `24 of 24 passed` and says FAIL beside
anything that went wrong. If anything fails, the command ends with an error.
Run all four after you change code under `dashboard/core/` or a file under
`studio/schemas/`.

## Special effects

- The old television effect plays every few minutes. Add `?demo=crt` to the
  address to see it now.
- The announcements can be tried with `?demo=announcement`, and an alert with
  `?demo=alert`.
- Calm mode (`?motion=calm`, or Motion in Dashboard Settings) switches off
  every effect and leaves only short fades.
- Speed can be tried with `?speed=very-slow`, `?speed=slow`, `?speed=normal`
  or `?speed=fast`. The address wins over Dashboard Settings.
- The screen is dressed as gunmetal: steel plates with gradients, bevelled
  edges, brushed streaks and bolts. That is `?finish=metal`, the normal look.
  `?finish=flat` shows the same screen in plain colours, with no gradients,
  bevel lines or streaks. Comparing the two on the Mini shows what the metal
  costs.

## Testing speed on the Mini

See docs/try-it-on-the-mini.md. It also compares the metal finish with the
flat one.

## Credits

The weather comes from Open-Meteo (open-meteo.com), a free service that needs
no key.
