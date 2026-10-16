# Teletraan I

The wall dashboard for Hawktimus Prime and Hawktimus Nova, FRC Teams 3229 and 3426, at Holly Springs High School.

This is intended to run on the TV in the classroom for robotics and will be running off of a device connected to the back. Currently, we are using a Mac mini 2014 which has Debian 13 installed on it and set for auto-login and auto-launch.

It is also programmed to make an announcement at the beginning of the meeting at 2:30pm and at 5:00pm.

The interface uses plain HTML, CSS, and JavaScript. Nothing needs to be installed. If the code needs to be edited, just edit the file and refresh the page.

For adjusting the content that gets displayed, Sanity will be used.

## Editing the content in Sanity Studio

Almost everything on the screen is typed into the Studio, which is the editing page for the dashboard. Open it at [Studio address] and sign in.

The list on the left is what you can change. It opens with Start here and has four groups. A name in capitals is a heading, and Screens, Daily Agenda, Monday Tasks, Settings and Views are folders, with Presentations inside Daily Agenda:

    Start here
    Screens (kept for older settings, not used any more)
      Original
      Cybertron
      Minimal
    TASKS
      Daily Agenda
        Agenda items
        Presentations (Upcoming, Past)
        Meeting days
      Monday Tasks
        On the TV
        Hidden
      Monday Boards
      Tips and News
    EVENTS
      Calendars
      Calendar filters
      Subthemes
    ROSTER
      Leadership
      Team leads
      Sponsors
      Photos
    COACHES ONLY
      Settings
        Dashboard Settings
        Look
        Teams
        Views
          General
          Prime
          Nova
          Family
        Themes
      Extra panels

Click the one you want, change it, and press **Publish**. Nothing shows on the TV until it is published, and it gets there within a few seconds. Students start with docs/students.md, which has the same parts as the Start here page. Coaches have docs/coaches-guide.md.

- Every item has a **Show on screen** switch and an optional **Hide after** date, so things come down on their own.
- Every field says how many characters fit on the screen. Studio will not let you publish text that is too long.
- **Publish all**, in the top bar, lists every document that has a draft and publishes the ticked ones in one go. Each is checked first with the same rules as its Publish button, and one that fails is skipped with the reason while the rest are published.
- **Views** (Settings, then Views) is what plays on the TV: General, Prime, Nova and Family, each with a map of the screen. Click a letter to change the rows of the main panel and the side panel, or the banner. **Themes** (Settings, then Themes) holds the theme of each day of the week (docs/views-and-themes.md, docs/coaches-guide.md, "Views and themes").
- **Dashboard Settings** is the one page for the whole board: how long each page stays, the countdown dates, the announcement times and words, an alert, how presentations run, how big the portraits and photos are and how the portraits are drawn, and the Weekday schedule, the polish and the speed.
- Under Daily Agenda, Presentations holds the talks students have booked and the ones added by hand, and Meeting days holds the talk slots (docs/presentations.md). The plus button of Daily Agenda adds an Agenda item or a Presentation.
- Events are not typed in here. They come from the team's BAND calendars, and the Calendars page says how to add or hide one. To get an event on the screen, add it in the calendar app, or ask a coach for an Always show rule. A Calendar filter hides some BAND events, such as a meeting that repeats every week (docs/calendar-filters.md).
- Events Calendar, Places and Demo are not in the list on the left. The screen does not read Events Calendar entries. A place is added with Create new in the Location field of a task. The buttons that try the screen are on Start here.
- The order of the list on the left is one plain list in `studio/structure.js`. To change the order, move a line (docs/reordering-the-sidebar.md).

More detail is in docs/editing-content.md.

## Running it on your computer

You need Python 3. In a terminal, from this folder:

    python3 tools/serve.py

Then open http://localhost:8080/dashboard/ in a browser. Edit a file, refresh the page, and you will see the change. The screen shows the real content, which is covered in docs/laptop-setup.md. Add `?sample=1` to the address, such as http://localhost:8080/dashboard/?sample=1, to see made-up sample content instead (everything in [square brackets]).

## What each folder is

| Folder | What it holds |
|--------|---------------|
| `dashboard/` | The TV page: `index.html`, `core/` (the modules with no page in them), `panels/<id>/` (each panel's `panel.js` and `panel.css`), `styles/<theme>/` (original, cybertron and retro), `themes/` (color files and seasonal packs), `layouts/` and `data/` |
| `studio/` | The Studio: `schemas/` (one file for each kind of content), `inputs/` (custom inputs, pages and the lists that copy the dashboard's), `tools/` (Publish all, the view defaults and the buttons), `structure.js` (the sidebar) and `static/` (made by the build, never committed) |
| `control/` | The control page service (Node, standard library only) and its pages: updates (Update from GitHub, or a folder), rollback, what is on the wall, the keys and the log (docs/control-page.md) |
| `computer/` | Everything that runs on the Teletraan computer: `install.sh`, `scripts/` (every script starts with `lib.sh`), `systemd/`, `nginx/`, `sudoers/`, `git/`, `console/`, `docker-compose.yml` and `local.example.env` |
| `tools/` | Things a coach runs on a Mac: `teletraan/` (the Mac tool), `mac/` (the Ship app), `screenshots.mjs`, `sweep.sh` with `sweep-words.txt`, `serve.py`, `frc-fixture.mjs`, the pages `icons.html`, `logo.html` and `zones.html`, and `perf/` |
| `tests/` | Every test, one file for each module or script, and `run.mjs` to run them all |
| `docs/` | The guides. `docs/paths.md` lists where every file moved to, `docs/where-things-are.md` is the long map and `docs/changelog.md` says what each round changed |

## Running the checks

    node tests/run.mjs             every test, three at a time, and the syntax of every shell file
    node tests/run.mjs calendar    only the tests whose file name has "calendar" in it
    node tests/run.mjs motion      only the motion tests, which need Playwright (tests/motion/README.md)

It prints one line for each file and a total, and exits with 1 when anything failed. Without Playwright the motion tests print one line that says they were skipped. A test is a Node file that exits 0 when it passes. A test of a shell script is a Node file too: it runs the script with fake `curl`, `ssh` and the like.

## What's included

- Team name, number, and school, with the animated hawk logo
- Date, time, and weather for Holly Springs
- Countdown timer to FRC Kickoff (January 9, 2027), then to Rollout
- Team tasks, which the Teletraan computer makes from the team's Monday boards, each with an optional point of contact, a priority and a due date. A Show on TV switch keeps a task off the screen, and a task typed by hand is never shown
- The Daily Agenda panel, headed AGENDA: the schedule for today's meeting, with the talks booked for today
- Upcoming events and the next event, from the team's BAND calendars, with Calendar filters that hide or keep events, such as a meeting that repeats every week. The Events panel has two pages of four that it scrolls between, each event has a chip for the kind of its calendar, and a coach can pin an event to page one
- Sponsors, with sponsor logos and thank-yous
- Photos, uploaded in Sanity and shown at random or newest first
- Subteam spotlight, leadership, and team leads
- Subteam rosters: the team lead and who is on each subteam
- Task counts and safety days
- Extra panels that can be built in Studio
- A ticker along the bottom for tips, news, reminders, and sponsor thanks
- Announcements at 2:30pm and 5:00pm ("WHAT TIME IS IT?", then "PRIMETIME"), with the times and words set in Studio
- Full-screen alerts that take over the whole screen
- The old-TV effect every few minutes
- Calm mode, which turns the effects off
- A speed setting for the whole board, and seconds per page that can be set for the whole board or for each board
- Polished gold or silver frame edges, picked in Studio
- A Polish setting in Studio that turns the polish down: Polished (the normal look, and the default), Flat (plain colour edges and no glint) or Plain (Flat, with no screws and no // in the panel headers). Flat and Plain are lighter on the computer, and `?look=flat` or `?look=plain` on the address tries one for a single page
- Four views that play one after another, for a few minutes each: General (the standard layout, with the agenda, events, leadership, photos, sponsors and the small panel), Prime and Nova (the bar layout, with the Monday cards of the team, Nova turned left to right) and Family (overall progress and status by department). The order and the minutes are set in Studio (docs/views.md). A swap, the pull apart and re-form of the frames, plays at every change of view
- Three themes, one for each day of the week on the Themes page: Original, Cybertron (gunmetal plates, neon lines, hex bolts and the wide war clock) and Retro (a marked copy of Original until it is designed). Each is a folder in `dashboard/styles/` (docs/views-and-themes.md, docs/layouts.md). `?style=` on the address tries one for a single page
- Subthemes: dated layers of small pictures at fixed places over a theme and a view, such as a season (docs/subthemes.md)
- Teams: Hawktimus Prime and Hawktimus Nova, each with a name, number, logo, nine colors, a metal (gold or steel), a glow switch and a switch that flips the whole screen left to right. The team of a view decides which team is on the banner, and the Weekday schedule of the Themes page gives each day a theme (docs/views.md). Tasks, agenda items, sponsors and most other things have a Team choice, and empty means Both (docs/add-the-nova-team.md, docs/team-on-an-item.md)
- Switch the look: the theme, the view, the team and the seasonal pack are separate settings, and four steps in Studio change them (docs/switch-the-look.md)
- A fixed 1920 by 1080 screen. Every layout, the mirror and the war clock are placed in pixels inside it, and the page scales the whole picture to the window and never reflows (docs/layouts.md, "The screen is a fixed canvas")
- Pages that flip like slats while the frames stay in place
- The animated hawk logo, and a team name that splits apart and locks back together every few minutes
- Layouts: a theme may have the sidebar layout, a strip across the top with the team name, a column on the left, one big frame on the right and the ticker across the whole bottom, with no small frame (docs/layouts.md). The theme Neon Prime has it: near black violet, indigo plates, gunmetal frames and neon cyan and magenta with amber marks, and no green. It has a kit of moving neon: the team name glitches now and then, bright dashes race along its lines, thin lines sweep down the big frame and the sidebar, and it all stops in calm mode, at night, and under an alert. Pick it on the Look page; the screen reloads once to change layout. Its speed on the computer has not been tested (docs/try-it-on-the-computer.md)
- Seasonal packs: Halloween, Thanksgiving, Christmas, New Year's, Valentine's Day, Competition Day and Summer Break. Each is a set of accent colours plus a small picture that replaces the double slash in every panel header, decorations in the empty edges of the screen (strings of lights, a scene along the bottom) and a few small, faint, slow pieces, such as snowflakes, that drift over the whole screen. The editors schedule them on the Look page in Studio, where a switch turns the pieces over the panels off. A rule can also add a ticker prefix, a banner line and corner art: line art that draws in once in the cut corners and holds still. A pack lies over every style and team. In calm mode nothing moves and those pieces are not drawn
- Night mode: from 11:30pm to 11:30am the screen goes black with a bouncing logo, and the picture is never turned off. The times are set in Studio
- Mechanical page changes: the frame breaks into plates and bars that fold away and click back together around the next page, with screws that turn at the joints. Studio can use these, the slat flip, or take turns
- Hidden transitions: now and then the screen glitches blue, its frames collapse into a pile and it cuts to a blue error screen, or it glitches red and shows two red eyes in the dark. Each ends with a cube putting the frames back. Each has two pictures that take turns. They can be played on request from Studio
- Competition cards: the season timeline, last season at a glance, the live rank, the next match with the chance of winning, the last results, the alliance and the district points, from the public data of each team that the computer reads. They come two days before an event and take priority during it, and a Preview competition button on Start here shows them on sample data (docs/frc-feed.md)
- Monday boards: the computer reads the task board and the milestones board named on the Monday tab of Dashboard Settings, as often as How often says (5 to 120 minutes, 30 to start with, at most 900 reads a day), and keeps their items in Sanity as tasks and milestones, with the department, team, status, priority, dates, hours and, if the switch is on, the first names of the owners. The tasks are listed under Monday Tasks, On the TV, the boards and the milestones are listed under Monday Boards, and Show on TV keeps one off the screen (docs/monday.md). The Monday panels are tasks by team and department, done by team, status by department, overall progress, timeline by team and board by team (docs/monday.md, "The eleven panels")
- A Play announcements button in Studio that plays every announcement that is switched on, once, without waiting for its time. The Now showing tab of the control page has a Play announcement button too, a box to post a short announcement and requests that hold a panel, show a view or try a theme for a few minutes (docs/control-page.md)
- A Publish all tool in the Studio's top bar that publishes all the drafts you tick, checking each one first and skipping any that would fail
- Presentations: a student books a short talk in a Google Form, and the talk appears in Studio. At its time the TV shows a title card, then the student's Google Slides one picture at a time, moved by a clicker, then a thank you card. The computer turns each deck into pictures before the talk (docs/presentations.md)
- A Run presentation test button in Studio that plays a sample talk with six sample slides, with no internet
- Preview buttons in Studio (Prime, Nova, Cybertron, Minimal and the next seasonal pack) that show that look on the TV for 2 minutes and then go back to the saved settings, without changing any setting. `?team=`, `?style=` and `?overlay=` on the address try any combination with the sample content
- A Start here page in Studio, the first line of the sidebar: a picture of the screen with its five areas, the three steps of every meeting and links to the control page, the Studio on the web and the guides. docs/students.md is the same page in words. What is left of the old demo is in docs/demo.md
- A calendar check (computer/scripts/check-calendars.sh) that lists the next 30 days of events, says which ones the Calendar filters hide, and gives the Events page and the kind of each one that shows
- A connection check for the computer (computer/scripts/check-connection.sh) and a small text on the screen that says why when Sanity cannot be reached
- A boot and shutdown screen: a text drawing of a person pointing two fingers at each other, with TELETRAAN I under it, shows on the TV above the login prompt while the computer starts and again while it shuts down (computer/console, docs/rebuilding-the-computer.md, step 13)
- The control page, on the computer at http://teletraan.local:3229/control/: update the dashboard and the Studio from a folder on any computer, roll back to one of the last five releases, see what is on the wall, the status of each job and the three dots, change the keys and read the log. Every build is shown as `v14 · a1b2c3d`, the release number and the first seven characters of the commit (docs/control-page.md)
- A Mac tool, tools/teletraan/teletraan-tool, that installs everything on the computer in one run with one password (the files, the services and the screen restart), keeps the three keys and the calendar links in a form (saved on the Mac in ~/.teletraan/, merged into computer/local.env on the computer, never printed), and shows what the computer last did. Double-click tools/teletraan/Teletraan Tool.command (docs/updating-the-computer.md). The words update, status and restart after its name do one thing with no menu and give an exit code, which is how the Ship app uses it
- A Ship app for a Mac, tools/mac/ship.sh (Ship Teletraan.app opens it): one window that checks the code, commits and pushes to GitHub, deploys the Studio without a question and has the Mac tool update the computer and restart the screen. Each step stops the run when it fails, and it looks at the Mac and at GitHub before it starts (docs/shipping-from-the-mac.md). A second Mac is set up with docs/laptop-setup.md

## What runs on the Teletraan computer

The scripts are in `computer/scripts/`, and the units that start them are in `computer/systemd/`. Every script starts with bash, a usage line, `set -euo pipefail` and `lib.sh`, which has the one reader of `local.env`. `monday-sync.sh` and `frc-sync.sh` read their parts (`monday-*.sh`, `frc-*.sh`) from the same folder. A change to a unit file takes effect only when its install script is run again (computer/README.md, "When a pull changes this folder").

- `pull.sh`: every 5 minutes on a computer that pulls by itself, gets new commits and writes `version.txt`, so an open screen reloads. A pull is a deploy. A computer that gets its files from a Mac (docs/shipping-from-the-mac.md) leaves this timer off
- `fetch-calendars.sh`: every 15 minutes, downloads the BAND calendars named in `local.env`. After each run `calendar-status.sh` and `status-write.sh calendar-status` write the document for the Calendars page
- `slides-sync.sh`: every 2 minutes, turns the Google Slides deck of each coming talk into pictures
- `frc-sync.sh`: wakes every 5 minutes, and reads the public competition data about once an hour, or about every 5 minutes while a team has an event on
- `monday-sync.sh`: woken every 5 minutes, reads the two Monday boards named in Dashboard Settings as often as How often says and keeps their items in Sanity as tasks and milestones
- `status-write.sh`: writes the time of a job into the status block at the top of Dashboard Settings. `status-write.sh --print` reads the block back and shows each time with its age
- `kiosk.sh`: starts the browser full screen when the Teletraan computer boots, writes `build.js` and writes `device.json` every minute
- `watchdog.sh`: every 2 minutes, restarts the screen when the page has stopped writing its heartbeat. `nightly.sh` restarts the screen at 04:00 and reboots the computer on Sundays, unless a talk is near. `backup-dataset.sh` exports the dataset at 03:15 and keeps 14
- `control-helper.sh`: the host side of the control page, which accepts a fixed list of words
- `install-timers.sh`, `install-calendars.sh`, `install-slides.sh`, `install-frc.sh`, `install-monday.sh`, `install-watchdog.sh`, `install-backup.sh` and `install-console.sh`: copy the unit files into place and turn on the timers, or the boot and shutdown screens. Run each once by hand, and again when its unit files change
- `check-connection.sh`: one OK or FAIL line each for the computer's connection to Sanity, BAND, Docker and the kiosk
- `check-calendars.sh`: lists the next 30 days of events and says which ones the Calendar filters hide. It needs Node, so it runs on a computer that has it

`computer/local.env` holds three keys, `SANITY_WRITE_TOKEN`, `MONDAY_API_TOKEN` and `TBA_AUTH_KEY`, and one `CALENDAR_<ID>_URL` line for each calendar. It is never committed. A script that does not find its key does nothing and says so in one line. docs/coaches-guide.md says what each key is for, and the Mac tool in docs/updating-the-computer.md can write these lines from a form.

## More guides

- docs/students.md: the students' page, with the same parts as the Start here page (docs/using-the-studio.md points to it)
- docs/monday-one-pager.md: one page for the project manager, with the Monday board rules and the settings not to touch
- docs/coaches-guide.md: the coaches' page, with the tabs of Dashboard Settings, the status block, the keys, the views and themes, Monday, the Calendars page and the competition feed
- docs/editing-content.md: using the Studio
- docs/publish-all.md: publishing many drafts at once, and what skipped and failed mean
- docs/switch-the-look.md: the four steps that change the theme, the view, the team and the seasonal pack
- docs/views.md, docs/views-and-themes.md and docs/subthemes.md: the four views and how they play, the Views and Themes pages, and the dated layers over a theme
- docs/control-page.md and docs/new-mac.md: the control page on the Teletraan computer, releases and roll back, and a new Mac
- docs/paths.md and docs/changelog.md: where every file moved to, and what each round changed
- docs/add-the-nova-team.md: importing the teams and filling in the Nova team
- docs/team-on-an-item.md: how the Team choice on an item works, and how to add it to another kind of content
- docs/presentations.md: booking talks, the Sanity token, the clicker keys and what to do when slides are not ready
- docs/up-next.md: the schedule and the talks in the Daily Agenda panel
- docs/calendar-filters.md: rules that hide or keep BAND events
- docs/hide-a-repeating-meeting.md: the four steps for hiding the Pre-Season meetings
- docs/calendar-links.md: adding a BAND calendar or changing its link
- docs/frc-feed.md: the competition data the computer reads, the seven cards on the screen, when they come and the Preview competition button
- docs/monday.md: the Monday boards the computer reads, how an item becomes a task, what happens when an item goes, and what is public
- docs/adding-a-field.md: adding a field to something editors fill in
- docs/adding-a-panel.md: adding a new board
- docs/rebuilding-the-computer.md: setting up the computer from scratch
- docs/shipping-from-the-mac.md: one window that checks, commits and pushes, deploys the Studio, and has the Mac tool update the computer and restart the screen
- docs/laptop-setup.md: a new Mac from the start: git and Node, the clone, the GitHub and Sanity sign-ins, the Ship app, the Mac tool, what is not in GitHub, and a checklist
- docs/updating-the-computer.md: the Mac tool that copies the files to the computer, keeps its keys and calendar links, installs the services, shows its status and restarts the screen
- docs/where-things-are.md: what each folder is for, where the settings live, and how to check your work
- docs/try-it-on-the-computer.md: testing speed on the computer
- docs/the-logo.md: how the hawk logo moves
- docs/layouts.md: the standard, sidebar and bar layouts, their numbers, the mirror, the styles and their frames, the war clock, how the big frame is scaled, and how to add a layout
- docs/seasonal-packs.md: the seasonal packs, where decorations go, how to add one, and suggested dates

The weather comes from Open-Meteo (open-meteo.com), a free service that needs no key.
