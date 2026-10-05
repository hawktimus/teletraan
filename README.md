# Teletraan I

The wall dashboard for Hawktimus Prime, FRC Team 3229 at Holly Springs High School.

This is intended to run on the TV in the classroom for robotics and will be running off of a device connected to the back. Currently, we are using a Mac mini 2014 which has Debian 13 installed on it and set for auto-login and auto-launch.

It is also programmed to make an announcement at the beginning of the meeting at 2:30pm and at 5:00pm.

The interface uses plain HTML, CSS, and JavaScript. Nothing needs to be installed. If the code needs to be edited, just edit the file and refresh the page.

For adjusting the content that gets displayed, Sanity will be used.

## Editing the content in Sanity Studio

Almost everything on the screen is typed into the Studio, which is the editing page for the dashboard. Open it at [Studio address] and sign in.

The list on the left is what you can change: Tasks, Tonight's Plan, Extra events, Sponsors, Tips and News, Subteams, Leadership, Photos, Custom Panels, Dashboard Settings, Theme, and Demo. Click the one you want, change it, and press **Publish**. Nothing shows on the TV until it is published, and it gets there within a few seconds.

- Every item has a **Show on screen** switch and an optional **Hide after** date, so things come down on their own.
- Every field says how many characters fit on the screen. Studio will not let you publish text that is too long.
- **Dashboard Settings** is the one page for the whole board: which boards show and in what order, how long each stays, the countdown dates, the announcement times and words, an alert, and the look and the speed.
- BAND events are not typed in here. They come from the team's BAND calendars. Events that are not on BAND go in Extra events.

More detail is in docs/editing-content.md.

## Running it on your computer

You need Python 3. In a terminal, from this folder:

    python3 tools/serve.py

Then open http://localhost:8080/dashboard/ in a browser. Edit a file, refresh the page, and you will see the change. The screen shows sample content (everything in [square brackets]) until it is switched over to the real content, which is covered in studio/README.md.

## What's included

- Team name, number, and school, with the animated hawk logo
- Date, time, and weather for Holly Springs
- Countdown timer to FRC Kickoff (January 9, 2027), then to Rollout
- Team tasks
- Tonight's plan
- Upcoming events and the next event, from the team's BAND calendars
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
- Pages that flip like slats while the frames stay in place
- The animated hawk logo, and a team name that splits apart and locks back together every few minutes
- Night mode: from 11:30pm to 11:30am the screen goes black with a bouncing logo, and the picture is never turned off. The times are set in Studio
- Mechanical page changes: the frame breaks into plates and bars that fold away and click back together around the next page, with screws that turn at the joints. Studio can use these, the slat flip, or take turns
- Hidden transitions: now and then the whole screen comes apart to show a desktop, or a face with red eyes. They can be played on request from Studio
- A demo for visitors that plays the announcement and night mode on request from Studio
- A connection check for the Mini (deploy/scripts/check-connection.sh) and a small text on the screen that says why when Sanity cannot be reached

## More guides

- docs/editing-content.md: using the Studio
- docs/adding-a-field.md: adding a field to something editors fill in
- docs/adding-a-panel.md: adding a new board
- docs/rebuilding-the-mini.md: setting up the Mini from scratch
- docs/where-things-are.md: what each folder is for, where the settings live, and how to check your work
- docs/try-it-on-the-mini.md: testing speed on the Mini
- docs/the-logo.md: how the hawk logo moves

The weather comes from Open-Meteo (open-meteo.com), a free service that needs no key.
