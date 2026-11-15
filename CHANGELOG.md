# Changes

Teletraan I is named by a build version (the `VERSION` file), not by numbered rounds. The newest build is first. Each
line says what changed for the people who use the screen, not how it was built.

## 1.2.0 — presentations from a Google Drive folder

A deck no longer has to be booked to be shown. Put a Google Slides deck or a PowerPoint file in one shared Google Drive
folder, pick it from a list, and the clicker runs it like a booked talk.

- **One folder, read all the time.** The Teletraan computer looks at the folder every 20 seconds. A file dropped in it
  is in the list within that time and can be played as soon as its pictures are made. A deck that is edited is made
  again by itself, and a file taken out leaves the list.
- **Pick it on the TV.** The play button of the clicker, or F5 or P on a keyboard, opens the list over the dashboard.
  Next and Back move, Enter or the black screen key starts the marked deck, Esc closes.
- **Or on the control page.** Show has a Presentations section with a Play on the TV button for each deck. The pick
  goes to the screen of that computer only and does not pass through Sanity.
- **PowerPoint files work as they are.** Google turns a .pptx into the same pictures as a Slides deck, so nothing has
  to be converted first. Animations and videos do not play: each slide is one still picture.
- **Dashboard Settings has one new field**, Google Drive folder of presentations, in the Presentations section. Run
  presentations must be on. The key is the one the Drive photos use.
- **The Raspberry Pi 5 can run the dashboard** as an entry under Ports in RetroPie, without Docker and without the jobs
  that write to Sanity (computer/pi/README.md).

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
