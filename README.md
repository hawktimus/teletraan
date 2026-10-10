# Teletraan I

The wall dashboard for Hawktimus Prime, FRC Team 3229 at Holly Springs High School.

This is intended to run on the TV in the classroom for robotics and will be running off of a device connected to the back. Currently, we are using a Mac mini 2014 which has Debian 13 installed on it and set for auto-login and auto-launch.

It is also programmed to make an announcement at the beginning of the meeting at 2:30pm and at 5:00pm.

The interface uses plain HTML, CSS, and JavaScript. Nothing needs to be installed. If the code needs to be edited, just edit the file and refresh the page.

For adjusting the content that gets displayed, Sanity will be used.

## Editing the content in Sanity Studio

Almost everything on the screen is typed into the Studio, which is the editing page for the dashboard. Open it at [Studio address] and sign in.

The list on the left is what you can change. It opens with Start here and has four groups. A name in capitals is a heading, and Daily Agenda, Tasks and Settings are folders:

    Start here
    EVERY MEETING
      Daily Agenda
        Agenda items
        Presentations (Upcoming, Past)
        Meeting days
      Tasks
        Pinned
        From the board
        Hidden
      Tips and News
    EVENTS
      Calendars
      Calendar filters
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
      Extra panels

Click the one you want, change it, and press **Publish**. Nothing shows on the TV until it is published, and it gets there within a few seconds. Students start with docs/using-the-studio.md, which has the same parts as the Start here page. Coaches have docs/coaches-guide.md.

- Every item has a **Show on screen** switch and an optional **Hide after** date, so things come down on their own.
- Every field says how many characters fit on the screen. Studio will not let you publish text that is too long.
- **Publish all**, in the top bar, lists every document that has a draft and publishes the ticked ones in one go. Each is checked first with the same rules as its Publish button, and one that fails is skipped with the reason while the rest are published.
- **Dashboard Settings** is the one page for the whole board: which boards show and in what order, how long each stays, the countdown dates, the announcement times and words, an alert, how presentations run, which team is on the screen, how big the portraits and photos are, and the style, the polish and the speed.
- Under Daily Agenda, Presentations holds the talks students have booked and the ones added by hand, and Meeting days holds the talk slots (docs/presentations.md). The plus button of Daily Agenda adds an Agenda item or a Presentation.
- Events are not typed in here. They come from the team's BAND calendars, and the Calendars page says how to add or hide one. To get an event on the screen, add it in the calendar app, or ask a coach for an Always show rule. A Calendar filter hides some BAND events, such as a meeting that repeats every week (docs/calendar-filters.md).
- Events Calendar, Places and Demo are not in the list on the left any more. The screen does not read Events Calendar entries. A place is added with Create new in the Location field of a task. The buttons that try the screen are on Start here.
- The order of the list on the left is one plain list in `studio/structure.js`. To change the order, move a line (docs/reordering-the-sidebar.md).

More detail is in docs/editing-content.md.

## Running it on your computer

You need Python 3. In a terminal, from this folder:

    python3 tools/serve.py

Then open http://localhost:8080/dashboard/ in a browser. Edit a file, refresh the page, and you will see the change. The screen shows the real content, which is covered in studio/README.md. Add `?sample=1` to the address, such as http://localhost:8080/dashboard/?sample=1, to see made-up sample content instead (everything in [square brackets]).

## What's included

- Team name, number, and school, with the animated hawk logo
- Date, time, and weather for Holly Springs
- Countdown timer to FRC Kickoff (January 9, 2027), then to Rollout
- Team tasks, each with an optional point of contact, a place, picked in the Location field of the task, where Create new adds one, and a priority. A Show on TV switch keeps a task off the screen, and pinned tasks come before tasks from the team board
- The Daily Agenda panel, headed AGENDA: the schedule for today's meeting, with the talks booked for today
- Upcoming events and the next event, from the team's BAND calendars, with Calendar filters that hide or keep events, such as a meeting that repeats every week. The Events panel has two pages of four, each event has a chip for the kind of its calendar, and a coach can pin an event to page one
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
- A Polish setting in Studio that turns the polish down: Polished (the normal look, and the default), Flat (plain colour edges and no glint) or Plain (Flat, with no screws and no // in the panel headers). Flat and Plain are lighter on the Mini, and `?look=flat` or `?look=plain` on the address tries one for a single page
- A Style setting in Studio: Original (the screen as it has always been), Cybertron or Minimal. Original and Cybertron have the layout of the theme: a banner, the large frame, the countdown over the small frame and the ticker. Cybertron draws it in gunmetal plates with a steel edge, a neon line just inside the edge, hex bolts at the joints, a hazard stripe under each header, pink conduit and brackets, a row of neon slashes and a grid with scanlines behind the screen, and its countdown is the war clock, in a steel housing, in place of the red frame. Minimal has the bar layout: a banner across the top with the team name and the war clock, a thin side column and one main panel, in steel frames with smaller cut corners, rivets, rust at two corners, a weld seam on the main panel, tick marks along the header line and a finer grid (docs/layouts.md). `?style=cybertron` or `?style=minimal` on the address tries one for a single page
- Teams: Hawktimus Prime and Hawktimus Nova, each with a name, number, logo, seven colors and a switch that flips the whole screen left to right. Team order in Studio puts the teams on the screen in turn, each for a pass of the panels, with everything changing together at a page change, and Styles by day gives each day a style (docs/layouts.md, "The look rotation"). Tasks, agenda items, sponsors and most other things have a Team choice, and empty means Both (docs/add-the-nova-team.md, docs/team-on-an-item.md)
- Switch the look: the style, the team and the seasonal pack are three separate settings, and four steps in Studio change them (docs/switch-the-look.md)
- A fixed 1920 by 1080 screen. Every layout, the mirror and the war clock are placed in pixels inside it, and the page scales the whole picture to the window and never reflows (docs/layouts.md, "The screen is a fixed canvas")
- Pages that flip like slats while the frames stay in place
- The animated hawk logo, and a team name that splits apart and locks back together every few minutes
- Layouts: a theme may have the sidebar layout, a strip across the top with the team name, a column on the left, one big frame on the right and the ticker across the whole bottom, with no small frame (docs/layouts.md). The theme Neon Prime has it: near black violet, indigo plates, gunmetal frames and neon cyan and magenta with amber marks, and no green. It has a kit of moving neon: the team name glitches now and then, bright dashes race along its lines, thin lines sweep down the big frame and the sidebar, and it all stops in calm mode, at night, and under an alert. Pick it on the Look page; the screen reloads once to change layout. Its speed on the Mini has not been tested (docs/try-it-on-the-mini.md)
- Seasonal packs: Halloween, Thanksgiving, Christmas, New Year's, Valentine's Day, Competition Day and Summer Break. Each is a set of accent colours plus a small picture that replaces the double slash in every panel header, decorations in the empty edges of the screen (strings of lights, a scene along the bottom) and a few small, faint, slow pieces, such as snowflakes, that drift over the whole screen. The editors schedule them on the Look page in Studio, where a switch turns the pieces over the panels off. A rule can also add a ticker prefix, a banner line and corner art: line art that draws in once in the cut corners and holds still. A pack lies over every style and team. In calm mode nothing moves and those pieces are not drawn
- Night mode: from 11:30pm to 11:30am the screen goes black with a bouncing logo, and the picture is never turned off. The times are set in Studio
- Mechanical page changes: the frame breaks into plates and bars that fold away and click back together around the next page, with screws that turn at the joints. Studio can use these, the slat flip, or take turns
- Hidden transitions: now and then the screen glitches blue, comes apart and cuts to a blue error screen, or glitches red and shows two red eyes in the dark. Each ends with the frames falling into a pile and a cube putting them back. Each has two pictures that take turns. They can be played on request from Studio
- Competition cards: the season timeline, last season at a glance, the live rank, the next match with the chance of winning, the last results, the alliance and the district points, from the public data of each team that the Mini reads. They come two days before an event and take priority during it, and a Preview competition button on Start here shows them on sample data (docs/frc-feed.md)
- Monday boards: the Mini reads the boards named on the Monday tab of Dashboard Settings every 10 minutes and keeps their items in Sanity as tasks, with the status, priority, due date and, if the switch is on, the first name of the owner. The tasks are listed under Tasks, From the board, and Show on TV keeps one off the screen (docs/monday.md). A team that has such tasks on the TV ends its pass of the look rotation with three Monday cards: tasks by Team lead, milestones by week and progress over time (docs/layouts.md, "The Monday cards")
- A Play announcements button in Studio that plays every announcement that is switched on, once, without waiting for its time
- A Publish all tool in the Studio's top bar that publishes all the drafts you tick, checking each one first and skipping any that would fail
- Presentations: a student books a short talk in a Google Form, and the talk appears in Studio. At its time the TV shows a title card, then the student's Google Slides one picture at a time, moved by a clicker, then a thank you card. The Mini turns each deck into pictures before the talk (docs/presentations.md)
- A Run presentation test button in Studio that plays a sample talk with six sample slides, with no internet
- Preview buttons in Studio (Prime, Nova, Cybertron, Minimal and the next seasonal pack) that show that look on the TV for 2 minutes and then go back to the saved settings, without changing any setting. `?team=`, `?style=` and `?overlay=` on the address try any combination with the sample content
- A Start here page in Studio, the first line of the sidebar: a picture of the screen with its five areas, the three steps of every meeting and five buttons that try the screen (Play announcement, Run presentation test, Next look now, Preview competition and Preview the screen). docs/using-the-studio.md is the same page in words. What is left of the old demo is in docs/demo.md
- A calendar check (deploy/scripts/check-calendars.sh) that lists the next 30 days of events, says which ones the Calendar filters hide, and gives the Events page and the kind of each one that shows
- A connection check for the Mini (deploy/scripts/check-connection.sh) and a small text on the screen that says why when Sanity cannot be reached
- A boot and shutdown screen: a text drawing of a person pointing two fingers at each other, with TELETRAAN I under it, shows on the TV above the login prompt while the Mini starts and again while it shuts down (deploy/console, docs/rebuilding-the-mini.md, step 13)

## What runs on the Mini

The scripts are in `deploy/scripts/`, and the units that start them are in `deploy/systemd/`. A change to a unit file takes effect only when its install script is run again (deploy/README.md, "When a pull changes this folder").

- `pull.sh`: every 5 minutes, gets new commits and writes `version.txt`, so an open screen reloads. A pull is a deploy
- `fetch-calendars.sh`: every 15 minutes, downloads the BAND calendars named in `local.env`. After each run `calendar-status.sh` and `status-write.sh calendar-status` write the document for the Calendars page
- `slides-sync.sh`: every 2 minutes, turns the Google Slides deck of each coming talk into pictures
- `frc-sync.sh`: wakes every 5 minutes, and reads the public competition data about once an hour, or about every 5 minutes while a team has an event on
- `monday-sync.sh`: every 10 minutes, reads the Monday boards named in Dashboard Settings and keeps their items in Sanity as tasks
- `status-write.sh`: writes the time of a job into the status block at the top of Dashboard Settings
- `kiosk.sh`: starts the browser full screen when the Mini boots, and writes `device.json` every minute
- `install-timers.sh`, `install-calendars.sh`, `install-slides.sh`, `install-frc.sh`, `install-monday.sh` and `install-console.sh`: copy the unit files into place and turn on the timers, or the boot and shutdown screens. Run each once by hand, and again when its unit files change
- `check-connection.sh`: one OK or FAIL line each for the Mini's connection to Sanity, BAND, Docker and the kiosk
- `check-calendars.sh`: lists the next 30 days of events and says which ones the Calendar filters hide. It needs Node, so it runs on a computer that has it

`deploy/local.env` holds three keys, `SANITY_WRITE_TOKEN`, `MONDAY_API_TOKEN` and `TBA_AUTH_KEY`, and one `CALENDAR_<ID>_URL` line for each calendar. It is never committed. A script that does not find its key does nothing and says so in one line. docs/coaches-guide.md says what each key is for.

## More guides

- docs/using-the-studio.md: the students' page, with the same parts as the Start here page
- docs/coaches-guide.md: the coaches' page, with the tabs of Dashboard Settings, the status block, the keys, the look rotation, Monday, the Calendars page and the competition feed
- docs/editing-content.md: using the Studio
- docs/publish-all.md: publishing many drafts at once, and what skipped and failed mean
- docs/switch-the-look.md: the four steps that change the style, the team and the seasonal pack
- docs/add-the-nova-team.md: importing the teams, filling in the Nova team and setting the team mode
- docs/team-on-an-item.md: how the Team choice on an item works, and how to add it to another kind of content
- docs/presentations.md: booking talks, the Sanity token, the clicker keys and what to do when slides are not ready
- docs/up-next.md: the schedule and the talks in the Daily Agenda panel
- docs/calendar-filters.md: rules that hide or keep BAND events
- docs/hide-a-repeating-meeting.md: the four steps for hiding the Pre-Season meetings
- docs/calendar-links.md: adding a BAND calendar or changing its link
- docs/frc-feed.md: the competition data the Mini reads, the seven cards on the screen, when they come and the Preview competition button
- docs/monday.md: the Monday boards the Mini reads, how an item becomes a task, what happens when an item goes, and what is public
- docs/adding-a-field.md: adding a field to something editors fill in
- docs/adding-a-panel.md: adding a new board
- docs/rebuilding-the-mini.md: setting up the Mini from scratch
- docs/shipping-from-the-mac.md: one window that commits, pushes, updates the Studio and tells the Mini to pull
- docs/where-things-are.md: what each folder is for, where the settings live, and how to check your work
- docs/try-it-on-the-mini.md: testing speed on the Mini
- docs/the-logo.md: how the hawk logo moves
- docs/layouts.md: the standard, sidebar and bar layouts, their numbers, the mirror, the styles and their frames, the war clock, how the big frame is scaled, and how to add a layout
- docs/seasonal-packs.md: the seasonal packs, where decorations go, how to add one, and suggested dates

The weather comes from Open-Meteo (open-meteo.com), a free service that needs no key.
