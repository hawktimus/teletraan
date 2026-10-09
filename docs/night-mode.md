# Night mode

Night mode is the screensaver. From 11:30 pm to 11:30 am the screen
shows black with the team logo and the team number under it, and the logo drifts
round the screen. The picture is never turned off: the Mini keeps sending a
signal, so the TV stays on and nothing has to wake up in the morning. The
kiosk script (`deploy/scripts/kiosk.sh`) already switches off the screen saver
and power saving of the Mini itself.

## The settings

They are in Dashboard Settings, in the Advanced tab. The starting values are
`defaultSettings` in `dashboard/config.js`, and the Studio fields are all in
`studio/schemas/settingsNight.js`.

| Field | What it does | Starts as |
|-------|--------------|-----------|
| Use night mode | The switch. Off, the dashboard stays on all night | on |
| Night style | Bouncing logo, or Blank black (nothing at all) | Bouncing logo |
| Logo width (pixels) | How wide the logo is, from 120 to 800 | 300 |
| Bounce speed | Slow, Normal or Fast | Normal |
| Preview night mode | Shows night mode now, whatever the time | off |

The switch starts on because this is a wall display that is left running. A
missing setting in the published page is the starting value, so a Studio that
has never saved the tab behaves as if it had.

**The times are fixed.** Night starts at 23:30 and ends at 11:30. They are
`nightStart` and `nightEnd` in `dashboard/core/constants.js`, and nothing in
Dashboard Settings changes them. The Studio still has the two fields
(`Night starts at` and `Night ends at`), hidden, with 23:30 and 11:30 in them, so
a page saved before they were hidden opens and publishes as it did. The screen
does not read what they hold. To change the times, change the two constants and
this page.

**The time zone is not a setting here.** Night mode uses the Time zone on the
Look page (it starts as America/New_York), the one the whole screen already
uses for dates. One zone for the screen means two settings can never disagree.
The clock in that zone is read with `Intl.DateTimeFormat`, so the Mini's own
time zone never matters.

The end time is before the start time, so night runs past midnight: 23:30 to
11:30 is the evening and the morning after. Night mode starts at the start time,
and the end time is the first minute that is no longer night. The change of
clocks in spring and autumn follows the clock on the wall, so night mode starts
at 23:30 by that clock on every night of the year.

## What you see

At the start time the black screen fades in over one second. Once it has faded
in, the dashboard under it is no longer drawn. The content is still read from
Sanity, the pages keep changing and the clock keeps going, so the screen is up
to date the moment night ends. No logo animation or screen glitch starts while
the night screen covers the picture. At the end time the black fades out over
a second.

- **Bouncing logo.** The logo and the number drift across the screen at a steady
  speed and bounce off the edges. Every bounce changes the colours to the next
  pair: gold plates with a white outline, light purple with gold, silver with
  light purple, white with silver. The number under the logo is 64 pixels, in
  the display face, and takes the colour of the plates.
- **A corner hit.** When the logo reaches a corner (both walls at once) it spins
  once, with a small pop in size, for 1.5 seconds, and the number flashes gold.
- **Blank black.** Black and nothing else.
- **Calm motion** (and no motion) keeps the logo still in the middle of the
  screen, with no bounce, spin or flash. The black still fades in and out in
  calm motion, in a plain fade.
- **Alerts and announcements** still show. They cover the night screen, which
  steps aside and waits, and comes back the moment they are over. The little
  connection status text at the bottom right is covered by the night screen like
  the rest of the dashboard.

## Trying it

Turn on "Preview night mode" in the Advanced tab and publish. The screen shows
night mode within a few seconds, even if "Use night mode" is off. Turn the
preview off and publish when you are done.

To try it on one computer without changing anything for the Mini, add
`?night=on` to the address (`http://localhost:8080/dashboard/?night=on`), or
`?night=off` to make sure it never shows. The address wins over Dashboard
Settings. `?motion=calm` and `?motion=none` show the still versions. The page
has no night mode in the test views `?show=` and `?stress`, unless `?night=` is
in the address too.

## How the bounce works

Nothing is worked out while the logo moves. It is two CSS animations
(`frame.css`, "Night mode"), one on each of two elements:

- `.night-x` moves the logo sideways, from the left wall to the right wall and
  back (`direction: alternate`), at one steady speed (`linear`), for ever.
- `.night-y` does the same up and down.

Each one's distance is worked out by CSS from the screen (1920 by 1080) and the
size of the logo block, so changing Logo width needs no code. The browser does
the moving on its own, with no script running per frame. The script does three
small things: it sets the two durations and two delays once when night mode
starts, it changes the colour pair when the browser says an animation reached a
wall (`animationiteration`), and it plays the corner hit when both axes say so
within 100 milliseconds of each other.

Two cheap layers are promoted to the graphics card for the bounce (one per
element), and a corner hit adds the logo and the number for 1.5 seconds. Nothing
blurs, glows, casts a shadow or changes colour smoothly: the colours change
suddenly, by switching the variables the one drawing uses.

### How often a corner is hit

The logo reaches a side wall once every 23 seconds and a top or bottom wall once
every 17 seconds at Normal. The two numbers share no common factor, so both
walls are reached at the same moment, which is a corner, only once every
23 x 17 = 391 seconds, about 6.5 minutes.

| Speed | Across the screen | Down the screen | A corner every | In a 12 hour night |
|-------|-------------------|-----------------|----------------|--------------------|
| Slow | 31 seconds | 23 seconds | 713 seconds, about 12 minutes | about 60 times |
| Normal | 23 seconds | 17 seconds | 391 seconds, about 6.5 minutes | about 110 times |
| Fast | 17 seconds | 13 seconds | 221 seconds, about 3.7 minutes | about 195 times |

A corner can only happen if the two animations start at the right places, so
the script picks the first corner hit and starts each animation part of the way
through, with a negative delay. `nightPlan` in `dashboard/core/night.js` picks a
whole number of seconds between 120 and 300 (`nightFirstHit` in
`dashboard/config.js`), so the first corner comes two to five minutes after
night mode starts, and not later than the first repeat. For that moment it
starts the sideways animation `across - (first hit mod across)` seconds in, and
the other the same way. The logo is then in a corner at the first hit and again
every 391 seconds, and at no other moment. The picked moment is also kept away
from the walls, so the logo never starts in a corner or against an edge. The
draw is random, so each night follows a different path.

## In a demo

The Test the screen page in Studio (docs/demo.md) can show the night screen for a few seconds
whatever the time is. The demo shows the bouncing logo, whether or not Use night mode
is on and whatever Night style says, and it wins over `?night=off`. When the step
ends the night screen goes back to what the clock and the settings say. An alert
or an announcement still shows over it. `showNightNow` and `endNightNow` in
`dashboard/core/night-screen.js` do this.

## Changing things

- **The speeds.** `nightSpeeds` in `dashboard/config.js`. Keep each pair of
  numbers whole seconds with no common factor (two different prime numbers is the
  easy way), or the logo meets the walls at the same moment more often, or never.
  The repeat is the two numbers multiplied. After a change, update the table
  above, the descriptions in `studio/schemas/settingsNight.js` and the numbers in
  `tools/test-night.mjs`, which checks them.
- **The colours.** `#night .night-block[data-pair="..."]` in `dashboard/base.css`:
  one rule for each pair, made of theme colours (`--yellow`, `--lilac`, `--white`)
  and `--silver` in `dashboard/tokens.css`. Add a rule for a new pair and raise
  `pairCount` in `dashboard/core/night.js` by one.
- **The logo.** `emblemMarkup` in `dashboard/core/logo.js` draws the four plates
  from the same shapes as the logo in the banner, once, with CSS variables for
  the colours. The number is the team number from Dashboard Settings (Screen
  tab).
- **The corner hit.** `night-spin` and `night-flash` in `dashboard/frame.css`.
- **When it is night.** `inNightWindow` in `dashboard/core/night.js`, with its
  tests, and the two times in `dashboard/core/constants.js`.

`node tools/test-night.mjs` runs the checks: midnight, other time zones (it asks
computers set to other zones too), the days the clocks change, that the logo is
in a corner at the first hit and every 391 seconds after it and at no other
moment, that it never starts in a corner, how a corner hit is told from a
bounce, and that the stylesheet moves nothing but transform and opacity.
