# Changes

Teletraan I is named by a build version (the `VERSION` file), not by numbered rounds. The newest build is first. Each
line says what changed for the people who use the screen, not how it was built.

## 1.2.0 — presentations from a Google Drive folder

A deck no longer has to be booked to be shown. Put a Google Slides deck or a PowerPoint file in one shared Google Drive
folder, pick it from a list, and the clicker runs it like a booked talk.

- **Fewer calls to Sanity.** The computer looks for a publish and writes its status once a minute, and asks for remote
  actions every two minutes, instead of every 10 and 30 seconds. A publish shows within a minute.
- **Update from GitHub no longer rolls back a working update.** The check that waits for the screen to report the new
  version looked in the wrong place, so every update was undone after 90 seconds although the screen had come up.
- **One folder, read all the time.** The Teletraan computer looks at the folder every 20 seconds. A file dropped in it
  is in the list within that time and can be played as soon as its pictures are made. A deck that is edited is made
  again by itself, and a file taken out leaves the list.
- **Pick it on the TV.** The play button of the clicker, or F5 or P on a keyboard, opens the list over the dashboard.
  Next and Back move, Enter or the black screen key starts the marked deck, Esc closes.
- **A mouse works in the list.** The row under the mouse is marked, because the pointer is hidden on the wall, and a left
  click starts it. A picked deck opens on its first slide with no title card, and one Esc ends it and returns to the
  dashboard.
- **Or on the control page.** Show has a Presentations section with a Play on the TV button for each deck. The pick
  goes to the screen of that computer only and does not pass through Sanity.
- **A folder that is not public works too.** When the folder cannot be shared with Anyone with the link, a small Google
  Apps Script that runs as someone who can open the folder hands the decks to the Teletraan computer. It sees only that
  folder and needs a secret word. Only Google Slides decks come this way. The steps are in docs/presentations-drive.md.
- **PowerPoint files work as they are.** Google turns a .pptx into the same pictures as a Slides deck, so nothing has
  to be converted first. Animations and videos do not play: each slide is one still picture.
- **Dashboard Settings has one new field**, Google Drive folder of presentations, in the Presentations section. Run
  presentations must be on. The key is the one the Drive photos use.
- **The Raspberry Pi 5 can run the dashboard** as its own system in RetroPie, with Dashboard and Control in it, without
  Docker and without the jobs that write to Sanity. On the Pi only, X is next, Z is back, Esc leaves and Right Shift
  opens the control page (computer/pi/README.md).
- **The Offline pill says which day.** "Offline since 7:40 PM" now reads "Offline since Oct 31, 7:40 PM" when that time
  is from an earlier day, so an old failure does not look like one from tonight. The competition feed is written to
  Sanity about once an hour when nothing changes, and the pill no longer calls that late after 20 minutes: it waits 70.
- **The Raspberry Pi 5 starts at a Hawktimus home screen** with five tiles: Dashboard, Meeting, Game Drop (the live FIRST
  Kickoff stream), Lo-Fi and Arcade. Esc in any of them comes back to it. Arcade and Lo-Fi open EmulationStation with
  their own list, and its Main Menu entry returns to the home screen. If the home screen cannot start, the console
  falls back to the EmulationStation menu described next.
- **The Raspberry Pi 5 starts at a menu**: Teletraan, Meeting, Arcade, Lo-Fi. Meeting opens the list of presentations on
  black, and Esc in the list goes back to the menu. Arcade holds every game system, with Main Menu first to come back.
  The full list of the console is not changed (`menu.sh full restart` brings it back).
- **Meeting on the Raspberry Pi is its own thing.** It lists the Google Drive folder with the deck added last at the top
  (Google Slides, .pptx and .ppt only). Choose one and any key goes to the next slide, Left goes back, Esc leaves for the
  Dashboard. The pictures are made ahead on the Pi all the time, so a deck opens at once. The Teletraan computer at school
  plays presentations as before.
- **Lo-Fi Radio has a CityPop channel** (the Japan City Pop stream). A channel can take a looping clip from a site with a
  clear licence, played under the stream (`computer/pi/lofi-scene.sh`, which records the source and the licence).

docs/presentations-drive.md has the set-up, the keys and what each message means.

## 1.1.0 — the screen keeps itself up

The screen had been going half drawn two days in a row: black at the top, a solid block over the lower half, pieces of
frame. It happened when the TV was switched off and on, or switched to another input and back. "Reset screen" from the
Control page fixed the picture but left the four dots amber, and only a full reboot put everything right. This build is
about that, and about the computer being able to say what went wrong without anyone logging into it.

- **The page knows whether it is actually painting.** The old heartbeat proved a timer was running, which is why
  nothing noticed: Chromium keeps the timers going and stops painting. The page now writes its clock in the title only
  while frames are arriving, and `FROZEN` when they are not, so the watchdog restarts the screen for the right reason
  and says `no frames` in the log.
- **A transition can no longer hang.** Every wait for a frame gives up after a second, every wait for an animation
  after its own length plus two seconds, and a transition that has not finished by its own length plus two seconds is
  forced to its end state and lets the rotation go. That is what left the screen half drawn.
- **The page puts itself right when the TV comes back.** Becoming visible again, coming back from the cache, a change
  of size: each one cancels whatever was playing, clears what a transition leaves behind, forces a repaint, reads the
  computer's files again so the dots tell the truth, and moves the rotation on.
- **Transitions are judged against the screen they are on.** The TV offers only 3840x2160 at 30 Hz, where a frame takes
  33.3 ms, and the budget was a fixed 34 ms. Every frame counted as slow, so after two changes the screen gave up Full
  transitions for the rest of the day and nobody ever saw them. The budget is now measured: a frame and a half of this
  screen, and never tighter than the old floor.
- **The display is set again when the screen comes back.** A new timer notices the output going away and returning,
  waits three seconds for the mode to settle, re-applies the setup the screen starts with, loads the page again, and
  restarts the screen session only if no frame has been painted fifteen seconds later. At most three of these in ten
  minutes. It changes no TV setting and adds no mode.
- **The amber dots after a restart are fixed at the cause.** The sync service used to keep the read times from before
  the computer restarted, so the wall showed stamps from half an hour ago while the Control page, which looks at the
  live files, showed green. Those times now start empty and the calendars and Monday are read once as the service
  starts, so they are fresh within a minute of a boot.
- **The computer checks itself every minute** and writes down what each check says: frames painting, the page
  answering, the display at its mode, the picture changing, the network, each source, the services, memory, disk and
  the clock.
- **It can fix itself, gently first.** Load the page again, run or restart the service, restart the screen session,
  repair the network, and only then reboot. Each step waits to see whether it worked.
- **It cannot get into a reboot loop.** One record covers every repair path — the screen watchdog, the network
  watchdog, the scheduled reboot, the nightly one and the buttons — so they share one budget instead of five: one
  automatic reboot in six hours, three in a day, and no reboot of any kind within ten minutes of another. Nothing
  reboots in the first ten minutes after a boot, or for a source that has failed while the network is fine, because
  that is the school filter or someone else's outage. If a reboot does not fix the thing it was for, the computer stops
  rebooting for it, keeps the gentle repairs running, leaves the last good content on the screen and says so once.
  Three boots in an hour stops it rebooting at all until a person says otherwise.
- **It watches before it acts.** For its first day it only writes down what it would have done, and after that it acts
  only while the Mode field on the Computer tab of Dashboard Settings says Fix.
- **One diagnostic report, from the Control page.** Details, Debug writes a file with the build, the display and what
  the kernel said about it, a picture of the screen, every heartbeat, the services and their journals, the network,
  each source, what the computer has tried and what it has left, and offers it to read, copy or download. The computer
  writes the same report by itself before it restarts or reboots anything. Every line goes through the rules the log
  download uses, so a report carries no key, no password and no calendar link.
- **Now says what the computer is fixing**, and the Screen dot is green only while the page is painting.
- `make version`, `make health`, `make supervisor-status`, `make supervisor-test`, `make display-status`,
  `make display-test`, `make watchdog-test`, `make diag` and `make diag-last`.

## Earlier builds

These were built before the version file existed, so they have no numbers of their own. They are listed by what they
added.

- **The screen reads only this computer.** A service on the computer reads the content, the weather and the pictures
  and writes them to local files; the page never reaches out to the internet itself. A failed read keeps the last good
  copy, so an outage leaves the wall as it was rather than blank. A status pill appears when a source has been stale
  for more than ten minutes.
- **Wi-Fi from the Control page.** Look for networks, pick one, type the password, and the computer joins it and tests
  the internet. If the password is wrong or nothing answers it goes back to the old network by itself. The password
  never reaches a log, a command line or Sanity. Also Restart the network, and a choice between public name servers
  and the network's own.
- **The network looks after itself.** A check every two minutes; three failures restart the network, six bounce the
  interface, fifteen reboot. Logs are kept as one line each for fourteen days. An optional heartbeat to an outside
  monitor and optional push messages.
- **Actions from the Studio, from anywhere.** Sync now, restart the dashboard, restart the services, reboot, show a
  view or a theme for an hour, pause and resume. The computer only ever runs words from a fixed list, ignores anything
  older than ten minutes, and writes the result back.
- **The Control page**, in five areas: Now, Show, Update, Computer and Details, in plain language, with the technical
  text only under Details. A PIN with a lockout, releases that can be rolled back, and the Studio served from the
  computer.
- **The Projects board from Monday**, with the mentor's first name and a Late chip when the timeline has passed.
- **Competition cards** from a week before the first event until a week after the last one ends, and nothing about
  competition outside that.
- **Views, themes and subthemes**: General, Prime, Nova and Family; the themes as folders; dated layers of decoration.
