# Teletraan I

The wall dashboard for Hawktimus Prime, FRC Team 3229 at Holly Springs High School.

This is intended to run on the TV in the classroom for robotics and will be running off of a device connected to the back. Currently, we are using a Mac mini 2014 which has Debian 13 installed on it and set for auto-login and auto-launch.

It is also programmed to make an announcement at the beginning of the meeting at 2:30pm and at 5:00pm.

The interface uses plain HTML, CSS, and JavaScript. Nothing needs to be installed. If the code needs to be edited, just edit the file and refresh the page.

For adjusting the content that gets displayed, Sanity will be used.

## Editing the content in Sanity Studio

Almost everything on the screen is typed into the Studio, which is the editing page for the dashboard. Open it at [Studio address] and sign in.

The list on the left is what you can change: Tasks, Up Next, Presentations, Events Calendar, Calendar filters, Subteams, Leadership, Sponsors, Photos, Tips and News, Custom Panels, Dashboard Settings, Theme, Places, and Demo. Click the one you want, change it, and press **Publish**. Nothing shows on the TV until it is published, and it gets there within a few seconds.

- Every item has a **Show on screen** switch and an optional **Hide after** date, so things come down on their own.
- Every field says how many characters fit on the screen. Studio will not let you publish text that is too long.
- **Publish all**, in the top bar, lists every document that has a draft and publishes the ticked ones in one go. Each is checked first with the same rules as its Publish button, and one that fails is skipped with the reason while the rest are published.
- **Dashboard Settings** is the one page for the whole board: which boards show and in what order, how long each stays, the countdown dates, the announcement times and words, an alert, how presentations run, how big the portraits and photos are, and the look and the speed.
- Presentations holds the Meeting days that have talk slots, and the talks students have booked (docs/presentations.md).
- BAND events are not typed in here. They come from the team's BAND calendars. Events that are not on BAND go in Events Calendar. A Calendar filter hides some BAND events, such as a meeting that repeats every week (docs/calendar-filters.md).
- The order of the list on the left is one plain list in `studio/structure.js`. To change the order, move a line (docs/reordering-the-sidebar.md).

More detail is in docs/editing-content.md.

## Running it on your computer

You need Python 3. In a terminal, from this folder:

    python3 tools/serve.py

Then open http://localhost:8080/dashboard/ in a browser. Edit a file, refresh the page, and you will see the change. The screen shows sample content (everything in [square brackets]) until it is switched over to the real content, which is covered in studio/README.md.

## What's included

- Team name, number, and school, with the animated hawk logo
- Date, time, and weather for Holly Springs
- Countdown timer to FRC Kickoff (January 9, 2027), then to Rollout
- Team tasks, each with an optional point of contact and a location picked from a list of places
- Up Next, the schedule for today's meeting, with the talks booked for today
- Upcoming events and the next event, from the team's BAND calendars, with Calendar filters that hide or keep events, such as a meeting that repeats every week
- Sponsors, with sponsor logos and thank-yous
- Photos, uploaded in Sanity and shown at random or newest first
- Subteam spotlight, leadership, and team leads
- Subteam rosters: the team lead and who is on each subteam
- Task counts and safety days
- Custom boards that can be built in Studio
- A ticker along the bottom for tips, news, reminders, and sponsor thanks
- Announcements at 2:30pm and 5:00pm ("WHAT TIME IS IT?", then "PRIMETIME"), with the times and words set in Studio
- Full-screen alerts that take over the whole screen
- The old-TV effect every few minutes
- Calm mode, which turns the effects off
- A speed setting for the whole board, and seconds per page that can be set for the whole board or for each board
- Polished gold or silver frame edges, picked in Studio
- A Look setting in Studio that turns the polish down: Polished (the normal look, and the default), Flat (plain colour edges and no glint) or Plain (Flat, with no screws and no // in the panel headers). Flat and Plain are lighter on the Mini, and `?look=flat` or `?look=plain` on the address tries one for a single page
- Pages that flip like slats while the frames stay in place
- The animated hawk logo, and a team name that splits apart and locks back together every few minutes
- Layouts: a theme may have the sidebar layout, a strip across the top with the team name, a column on the left, one big frame on the right and the ticker across the whole bottom, with no small frame (docs/layouts.md). The theme Neon Prime has it: near black violet, indigo plates, gunmetal frames and neon cyan and magenta with amber marks, and no green. It has a kit of moving neon: the team name glitches now and then, bright dashes race along its lines, thin lines sweep down the big frame and the sidebar, and it all stops in calm mode, at night, and under an alert. Pick it on the Theme page; the screen reloads once to change layout. Its speed on the Mini has not been tested (docs/try-it-on-the-mini.md)
- Seasonal packs: Halloween, Thanksgiving, Christmas, New Year's, Valentine's Day, Competition Day and Summer Break. Each is a set of accent colours plus a small picture that replaces the double slash in every panel header, decorations in the empty edges of the screen (strings of lights, a scene along the bottom) and a few small, faint, slow pieces, such as snowflakes, that drift over the whole screen. The editors schedule them on the Theme page in Studio, where a switch turns the pieces over the panels off. In calm mode nothing moves and those pieces are not drawn
- Night mode: from 11:30pm to 11:30am the screen goes black with a bouncing logo, and the picture is never turned off. The times are set in Studio
- Mechanical page changes: the frame breaks into plates and bars that fold away and click back together around the next page, with screws that turn at the joints. Studio can use these, the slat flip, or take turns
- Hidden transitions: now and then the screen glitches blue, comes apart and cuts to a blue error screen, or glitches red and shows two red eyes in the dark. Each has two pictures that take turns. They can be played on request from Studio
- A Play announcements button in Studio that plays every announcement that is switched on, once, without waiting for its time
- A Publish all tool in the Studio's top bar that publishes all the drafts you tick, checking each one first and skipping any that would fail
- Presentations: a student books a short talk in a Google Form, and the talk appears in Studio. At its time the TV shows a title card, then the student's Google Slides one picture at a time, moved by a clicker, then a thank you card. The Mini turns each deck into pictures before the talk (docs/presentations.md)
- A Run presentation test button in Studio that plays a sample talk with six sample slides, with no internet
- A demo for visitors that plays the announcement and night mode on request from Studio
- A calendar check (deploy/scripts/check-calendars.sh) that lists the next 30 days of events and says which ones the Calendar filters hide
- A connection check for the Mini (deploy/scripts/check-connection.sh) and a small text on the screen that says why when Sanity cannot be reached

## More guides

- docs/editing-content.md: using the Studio
- docs/publish-all.md: publishing many drafts at once, and what skipped and failed mean
- docs/presentations.md: booking talks, the Sanity token, the clicker keys and what to do when slides are not ready
- docs/up-next.md: the schedule and the talks in the Up Next panel
- docs/calendar-filters.md: rules that hide or keep BAND events
- docs/hide-a-repeating-meeting.md: the four steps for hiding the Pre-Season meetings
- docs/calendar-links.md: adding a BAND calendar or changing its link
- docs/adding-a-field.md: adding a field to something editors fill in
- docs/adding-a-panel.md: adding a new board
- docs/rebuilding-the-mini.md: setting up the Mini from scratch
- docs/shipping-from-the-mac.md: one window that commits, pushes, updates the Studio and tells the Mini to pull
- docs/where-things-are.md: what each folder is for, where the settings live, and how to check your work
- docs/try-it-on-the-mini.md: testing speed on the Mini
- docs/the-logo.md: how the hawk logo moves
- docs/layouts.md: the standard and the sidebar layout, their numbers, how the big frame is scaled, and how to add a layout
- docs/seasonal-packs.md: the seasonal packs, where decorations go, how to add one, and suggested dates

The weather comes from Open-Meteo (open-meteo.com), a free service that needs no key.
