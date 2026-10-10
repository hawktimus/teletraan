# Hidden transitions

This page also covers the Play announcements button, which sits beside the two Play
buttons for the transitions. See "Play announcements" below. The Run presentation test
button, and the five Preview buttons that end the menu, are covered after it.

A hidden transition is a rare surprise. Now and then, instead of an ordinary page
change, the whole screen does something else. There are two:

- **Desktop reveal.** The screen crashes like a computer with a blue screen. In order:
  1. About 2 seconds of rough blue glitching over the live screen. The whole screen
     jumps sideways, each block (the banner, the countdown, the large panel, the small
     panel and the ticker) jumps and shears on its own so the picture tears, thin blue
     bands jump across, and flat layers in three blues flicker at different strengths. Three
     times the screen is almost solid blue for about a tenth of a second.
  2. All five blocks come apart in 3D and fly away over a deep blue.
  3. A second glitch, about a second long, over the empty blue.
  4. A cut, with no fade, to a blue screen picture. It stays for 3 seconds.
  5. The screen comes back whole over the picture, showing the next page of each panel.
     Its frames break and fall into a pile, a cube rises out of the pile, and the frames fly
     back to their places (see "The frames fall and come back").
- **Red eyes.** The screen glitches with flat red flashes, then everything breaks
  apart and the screen goes black. A picture of two glowing red eyes fades in, stays
  for 2.5 seconds and fades out. The screen comes back whole, showing the next page of
  each panel, and its frames fall and come back as they do in the desktop reveal.

The pictures are four files that the team supplied, in `dashboard/assets/hidden/`.
Each transition has two, and they take turns (see "The pictures" below).

## The pictures

The four pictures are in `dashboard/assets/hidden/`:

| File | Size | Used by | How it fills the screen |
|------|------|---------|-------------------------|
| `red-eyes-1.webp` | 1672 x 941 | Red eyes | covers the whole screen |
| `red-eyes-2.webp` | 1920 x 1080 | Red eyes | covers the whole screen |
| `blue-screen-1.png` | 700 x 394 | Desktop reveal | covers the whole screen |
| `blue-screen-2.png` | 640 x 400 | Desktop reveal | shown whole, crisp, on its own blue |

A picture is never stretched. The three that are 16:9 (the shape of the screen) use
"cover": they fill the screen and, when the proportions are a hair off, cut off less than
a pixel. The old text-mode blue screen is 16:10 and only 640 pixels wide, so it uses
"contain": the whole picture is shown at the same proportions, as big as it can be (2.7
times), with hard pixel edges (`image-rendering`) so the text stays sharp, and the rest of the
screen is filled with the picture's own blue so there are no black bars. If it were cut to
fill the screen, its top and bottom would be lost.

**They take turns.** Each play of a transition takes the picture after the one it used last,
and goes back to the first after the second. The last one used is kept in the browser's storage
(`localStorage`, under `teletraan-hidden-picture-redEyes` and
`teletraan-hidden-picture-blueScreen`), so a Mini that restarts carries on with the other one.
If the storage cannot be used the pictures still take turns until the page is reloaded. The
two transitions keep their own place.

**They are loaded when the screen starts**, all four, and wait hidden in the backdrop, so the
cut to the blue screen is one frame. If one fails to load (a missing or damaged file) a note
goes to the browser console, the other picture of its set is used every time, and if none of
the set loads the step just waits its seconds over the plain backdrop. The transition still
ends and the screen comes back.

### Swapping a picture for another

1. Make the new picture with the same name as the old one and the same kind of size: 16:9
   for the three that cover the screen (for example 1920 x 1080), and a small picture that is
   already 16:10 for the old blue screen. A bigger picture is fine and looks sharper. Use
   `webp` or `png`, keep it under 300 KB so the Mini loads it at once, and use your own
   picture or one you have the right to use.
2. Put it in `dashboard/assets/hidden/`, replacing the old file, and push. The Mini
   pulls it on its next timer.
3. If the size or the kind of picture is different (a different shape, or a new name), change its
   line in `core/hidden-pictures.js` (`file`, `width`, `height`, `fit`, `fill` and `crisp`, which
   the comment at the top of that file explains) and run `node tools/test-effects.mjs`. The test
   checks that every file exists and is the size the list says.
4. Try it with `?hidden=desktop` or `?hidden=redEyes` in the address (see "Try one"). The
   address always plays the next picture, so add it twice to see both.

## The hidden transition settings

Open Studio, click Dashboard Settings and open the Advanced tab.

- **Allow hidden transitions.** The master switch. It starts on. Turn it off and
  neither transition ever plays, not even one you push (below).
- **Desktop reveal every (hours).** About once every this many hours of screen time.
  A whole number from 1 to 1000. It starts at 60.
- **Red eyes every (hours).** The same for red eyes. It starts at 60.
- **Last push.** Filled in by the Play buttons (below). You cannot type in it. It
  shows which transition was pushed last, and when.

The screen rolls at each page change of the large panel. That panel changes page every
Seconds per page (20 to start with, in the Screen tab), made longer or shorter by Speed.
The chance at one page change is those seconds divided by the hours in seconds. At 20
seconds and 60 hours that is 20 in 216000, which is 1 in 10800. A page change is not
a timetable: at 60 hours a transition comes about every 60 hours on average, and it can
come twice in a day or not for a week. One random number decides each page change: the
first share of the way from 0 to 1 is the desktop reveal, the next is red eyes, and the
rest is an ordinary page change.

Screen time is the time the screen shows its normal pages. Night mode, an alert, an
announcement, a demo, a talk and calm motion do not count, because nothing is rolled
then. A row with seconds of its own in the Screen tab changes the time for that one page,
so the hours are about right and not exact.

After any hidden transition has played, none comes about by chance for 4 hours. The 4 is
`hiddenGapHours` in `dashboard/config.js`. The time it played is kept in the browser's
storage (`localStorage`, under `teletraan-hidden-last-fired`), so a Mini that restarts
keeps the gap. If the storage is switched off, the screen keeps the time until the page
is reloaded. A push from the Studio and `?hidden=` ignore the gap, but they start one.

The two percent fields the page used to have, Desktop reveal chance and Red eyes chance,
are hidden. A settings page saved before the hours existed has no hours. It keeps
rolling by its percents (1 each to start with, so about one page change in 50 was a
surprise) until you fill in the hours and publish. A percent of 1 is 1 page change in
100, about every 33 minutes at 20 seconds, and the fewest hours the field takes is 1,
which is 1 page change in 180. So every old percent from 1 up is more often than the hours
can say. The Studio starts a new settings page at 60 hours for both.

## Play one now

1. Open Dashboard Settings in Studio.
2. Open the menu next to Publish (the three dots) and click **Play desktop reveal**
   or **Play red eyes**.
3. Look at the TV. It plays within about 20 seconds.

The menu has two more buttons that are not transitions, Play announcements and Run presentation test (see below).
Each of the two buttons above writes the kind and the time now into Last push and
publishes the page for you, so you do not click Publish. Any other change you had not published yet is
published too.

What the screen does with a push:

- It plays at the next page change of the large panel. If that is more than 20 seconds
  away, the large panel is asked to change page at once, so it plays within a few
  seconds.
- It ignores the hours and the 4 hour gap. It starts a gap, like any transition.
- It plays once. The screen keeps the push it handled last in the browser's storage
  (`localStorage`, under `teletraan-hidden-handled`), so a Mini that restarts never
  plays it again.
- It plays only while it is less than 60 seconds old, the same rule as the demo
  (docs/demo.md). The Mini's clock must be right: if it is more than a minute out,
  a push never plays.
- It waits for an alert, an announcement, a demo or the night screen to be over, if
  that happens inside the minute. Otherwise it is dropped.
- It never plays with Allow hidden transitions off, or in calm or no motion. A push is
  not kept for later: after 60 seconds it is too old, so turning the switch on after
  that does not play it.
- While a page shows sample content (`?sample=1` on its address) it reads
  the settings from `dashboard/data/sample/content.json`, not from Studio, so a push
  does nothing. Open the screen without `?sample=1` first.

## Switch them off

- **For good:** turn off Allow hidden transitions. A push does not work with the
  switch off either.
- **For one of them:** set its hours to 1000, about once in six weeks of screen time.
  The hours cannot be 0.
- **Calm and no motion** never play one. Motion in the Screen tab of Dashboard Settings
  set to Calm switches them off, and so does `?motion=calm` in the address.
- They also never play while a full screen alert or announcement is up, while a demo
  plays, or while the night screen is up. If one of those starts in the middle of a
  hidden transition, the transition stops at once and the screen goes back to normal.

## Play announcements

The menu next to Publish on Dashboard Settings has a third button, **Play announcements**.
It is not a transition, but it is built the same way: one click, and the TV plays it
within a few seconds. It plays every announcement in the Screen tab that is
switched on, once, one after another. Use it to show visitors the announcements, or to
check them, without waiting for 14:30.

1. Open Dashboard Settings in Studio.
2. Open the menu next to Publish (the three dots) and click **Play announcements**.
3. Look at the TV.

The button writes the time now into `announceRequest` and publishes the page for you, so
you do not click Publish. Any other change you had not published yet is published too.
`announceRequest` has one field, `requestedAt`, and editors never see it in Studio: it is
hidden, but its value stays in the page.

What the screen does with it:

- It plays each announcement that is switched on (Show on screen), in the order of the
  list. An announcement that is switched off is skipped.
- Each plays at its normal length: the seconds of its first line and then, if it has
  one, the seconds of its second line, with the old television effect between them. It is
  the same full screen announcement as one that comes at its own time.
- It ignores each announcement's Time and Days. One set for Friday at 17:00 plays on a
  Monday morning, and one with no day ticked plays too.
- It plays once. The screen keeps the request it handled last in the browser's storage
  (`localStorage`, under `teletraan-announce-handled`), so a Mini that restarts never
  plays it again. This is separate from the demo's and the hidden transitions' own.
- It plays only while the request is less than 60 seconds old, the same rule as the demo
  (docs/demo.md) and a pushed hidden transition. The Mini's clock must be right: if it is
  more than a minute out, it never plays.
- It waits for an alert, an announcement, a demo, a hidden transition or the night screen
  to be over, if that happens inside the minute. Otherwise it is dropped.
- With no announcement switched on, nothing plays. The request still counts as used, so
  switching one on a moment later does not play it. Click the button again.
- While they play, the normal pages stop changing. A real alert that comes on takes the
  screen and the rest do not play. Click the button again while they play and they start
  again from the first. An announcement that comes due at its own time while these play is
  missed, because only one announcement can have the screen.
- The list is taken when the request starts, so editing the announcements while they play
  changes the next click and not this one.
- While a page shows sample content (`?sample=1` on its address) it reads
  the settings from `dashboard/data/sample/content.json`, not from Studio, so the button
  does nothing. Open the screen without `?sample=1` first.

A Demo step can play the same announcements: pick **All announcements** as its screen
(docs/demo.md).

## Run presentation test

The last button in the menu next to Publish on Dashboard Settings is **Run presentation test**.
Click it and the TV starts a sample talk within a few seconds: the title card, then six sample
slides that say SLIDE and a number, then the thank you card. Press the clicker to begin, as at a
real talk. It needs no internet and no Google deck, because the talk and its slides are in
`dashboard/data/sample/`. Use it to check the clicker and the screen before a meeting.

The button writes the time now into `presentationTestRequest` and publishes the page for you. It
follows the same rules as Play announcements: it runs once, only while the request is less than 60
seconds old, and it waits for an alert, an announcement, a talk, a demo, a hidden transition or the
night screen to be over. Run presentations in the Presentations tab must be on. While a page
shows sample content (`?sample=1`) it reads the settings from `dashboard/data/sample/content.json`, so the button
does nothing. Open the screen without `?sample=1` first.

## Preview a look

The last five buttons in the menu next to Publish on Dashboard Settings are **Preview Prime**,
**Preview Nova**, **Preview Cybertron**, **Preview Minimal** and **Preview next pack**. Each one
shows a look on the TV for 2 minutes, and then the screen goes back to the saved settings. Use
them to show visitors a style, to check a team's colors and its mirror, or to see a seasonal pack
on a day it is not scheduled.

1. Open Dashboard Settings in Studio.
2. Open the menu next to Publish (the three dots) and click a Preview button.
3. Look at the TV.

The button writes its kind and the time now into `previewRequest` and publishes the page for you.
`previewRequest` has two fields, `kind` and `requestedAt`, and editors never see it in Studio: it is
hidden, but its value stays in the page. Nothing else in Dashboard Settings or on the Look page is
changed, so there is nothing to put back.

What each button holds for 2 minutes:

| Button | What the screen shows |
|--------|-----------------------|
| Preview Prime | the Prime team, whatever Team order says |
| Preview Nova | the Nova team, whatever Team order says. With no Nova team document in Studio it stays on Prime |
| Preview Cybertron | the Cybertron style, whatever Styles by day says and whatever `?style=` says |
| Preview Minimal | the Minimal style, in the same way |
| Preview next pack | the seasonal pack after the one on the screen, in the order of the list in `dashboard/themes/overlays/registry.js` |

What the screen does with it:

- A team goes on at the next page change, in the moment the large frame is apart, like a swap in Alternate
  mode. The name, the number, the logo, the colors and the mirror change together.
- A style or a pack goes on at the next page change too, and the pages are asked to move on at once, so it
  takes a few seconds. A style with another layout reloads the page once when it goes on and once when it
  goes back. The preview is kept in the browser's storage (`localStorage`, under
  `teletraan-preview-active`) so that the reload does not lose it. A preview that is over, or not
  readable, is dropped.
- Next pack takes the pack on the screen now, whether the Look page or an earlier preview put it
  there, and moves to the one after it. After the last it goes round to the first. The placeholder overlay
  is not a pack. Click it again for the next pack. The ticker prefix, the banner line and the corner art
  are the ones typed on that pack's rule on the Look page, or the pack's own (docs/seasonal-packs.md).
- It starts once, and only while the request is less than 60 seconds old, the same rule as the demo
  (docs/demo.md). The screen keeps the request it handled last in `localStorage`, under
  `teletraan-preview-handled`, so a Mini that restarts never starts it again. This is separate from the
  demo's, the hidden transitions', the announcements' and the presentation test's own.
- It waits for an alert, an announcement, a talk, a demo, a hidden transition or the night screen to be
  over, if that happens inside the minute. Otherwise it is dropped. An alert that comes on while it is
  showing does not end it and does not make it longer.
- Another click while a preview is showing replaces it, and the 2 minutes count from the new click.
- At the end the screen goes back to the settings at the next page change, and the page reloads once more
  if the style it goes back to has another layout.
- While a page shows sample content (`?sample=1` on its address) it reads the settings from
  `dashboard/data/sample/content.json`, not from Studio, so the buttons do nothing. To try every style,
  team and pack with the sample content, put `?style=`, `?team=` and `?overlay=` on the address
  (docs/try-it-on-the-mini.md). The sample content has both teams.

To add a preview, add an entry to `previewKinds` in `dashboard/core/preview.js`, the same id and name to
`studio/previews.js`, and the id to the choices in `studio/check-schemas.mjs` (search it for
`previewRequest.kind`). A kind holds one thing: a team mode, a style or the next pack. Then run
`node tools/test-effects.mjs` and `node studio/check-schemas.mjs`, and run `npm run deploy` in the
`studio` folder so the editors see the button.

## Try one

Add `?hidden=desktop` or `?hidden=redEyes` to the address and that transition plays at
the next page change of the large panel, once, whatever the hours and the gap say.
`?hidden=off` never plays any. Add `?night=off` too when it is night in the Look
time zone, or the night screen will stop it. docs/try-it-on-the-mini.md lists every switch.

## The frames fall and come back

This is how both transitions end. The screen comes back whole with the next page of each
panel, and then the metal of the frames falls, a cube rises, and the metal flies back. The three
parts take 5 seconds at the most. Nothing else on the screen moves meanwhile, and the rotation
clock is held, so no panel changes page until the content is back.

1. **Fall, 1.6 seconds.** The words, lists and pictures fade away in the first .3 seconds, so only
   the metal is left. Every piece of metal lets go at its own moment, from 0 to .4 seconds after the
   start, tips back by 20 to 70 degrees, turns up to 25 degrees in the plane and falls to the bottom
   of the screen. It makes one bounce of 30 pixels and settles. The pieces end in a loose pile in the
   bottom 120 pixels, side by side from left to right in the order they fell. A piece that is taller
   than the band is scaled down until it fits.
2. **Cube.** While the last pieces are still falling, at 1 second, a cube of 120 pixels rises from below
   the bottom edge in .6 seconds and sits above the middle of the pile. It is drawn in lines in the
   team accent. It turns once about its upright axis in .8 seconds, and its opacity pulses twice from 1 to
   .4 and back to 1, .4 seconds for each pulse.
3. **Lift.** On the second pulse, at 2 seconds, the pieces lift from the pile in the opposite order, one every
   60 milliseconds, and fly back to their places in .5 seconds with the easing of the first assembly. Each
   one undoes its own tip and turn. The cube shrinks to a point in the middle of the large panel and is gone
   when the last piece is home. With 40 pieces that is at 4.84 seconds. If there were more pieces the gap
   would shrink so that the last one is home by 5 seconds.
4. **Build.** The frames show again as they were. The backdrop fades out and the content comes in the way it does
   at the first assembly: the pages of the panels turn in, and the banner and the countdown bring in their own
   parts. This part is not in the 5 seconds.

What falls is every piece of metal the page draws as a separate element:

| What | Where |
|------|-------|
| The pieces of a frame that is cut up (12 or 13) | the large and the small frame, and the main panel of the bar layout |
| The fills and the two halves of a frame | the countdown of Original, the banner and the ticker of Cybertron and of the bar layout |
| Every bolt | on all of them |
| A region that paints a box of its own | the strip and the sidebar of the sidebar layout |

That makes 38 pieces in the standard layout in Original, 50 in Cybertron, 19 in the sidebar layout and 32 and
30 in the bar layout (Minimal has 30). The most that fall is 40. Above that the smallest ones, which are always bolts, are
folded into the plate they are bolted to and fall with it. The shadows, the glint and the stamped id are not
pieces: they are left out while the metal is down. A bolt gets a copy of its own in `#pile` and the bolt on
the frame hides until the pieces are home. The Original banner and ticker have no frame, so only their words
fade.

Each run uses a new random seed, so the order and the pile are different every time. A seed always gives the
same run, which is how `tools/test-pile.mjs` tests it.

The numbers are in `pileTimes` and `pileShape` in `dashboard/core/transitions.js`. The same times are in
`frame.css` (the section "The frames fall and come back"), and `tools/test-pile.mjs` fails when the two
differ. After a change run `node tools/test-pile.mjs` and `node tools/test-effects.mjs`.

## How it works

The five blocks are the five regions marked `data-block` in `dashboard/index.html`.
That is the standard layout. The sidebar layout (docs/layouts.md) has four blocks:
the top strip, the sidebar, the large panel and the ticker. `core/layout-apply.js` moves `data-block`
to them when the page starts, and their poses are in `layouts/sidebar.css`. Everything
else here is the same, and the transition waits for no small panel there.
When a transition plays, `core/hidden-run.js` sets `data-hidden` on `#world`, and
`frame.css` (the section "Hidden transitions") does all the moving:

| `data-hidden` | What happens                                                                  |
|---------------|-------------------------------------------------------------------------------|
| `glitch`      | Red: the screen jumps (the old television glitch) and a flat red layer flickers. At most two flashes in any second, and never brighter than .45. Blue: the blue glitch above |
| `break`       | The blocks fly apart in 3D (`translate3d`, `rotateX`, `rotateY`, `rotateZ`) and fade. The backdrop layer fades in behind them |
| `apart`       | The blocks are out of sight. The pages of all three areas are swapped now, so nobody sees it |
| `fall`        | The screen is whole again. The frames fall, the cube rises and, once `data-lift` is also on `#world`, the frames fly back. The backdrop stays as it is |
| `build`       | The backdrop fades out and the content comes in as it does at the first assembly |

`data-tint` is on `#world` while a glitch plays: `red` or `blue`. A glitch can also
play while the blocks are apart, and then `data-hidden` stays `apart` and only `data-tint`
is there.

The backdrop is under the stage. `data-look` says what it shows: black (the default),
`blue` (a deep blue) or `picture`, which is the background colour of the picture on it.
The pictures are `img` elements that `core/hidden-run.js` adds to it when the screen
starts, each one invisible until a step gives it a `data-state`: `in` fades it in, `on`
shows it at once and `out` fades it out. The cut to a blue screen is `on` straight away,
so the picture is there on the next frame, with no fade. Everything moves with `transform`
and `opacity` only. Nothing glows or blurs, and nothing is blended or filtered.

The blue glitch (`scene.glitch(seconds, 'blue')`) is the red glitch made rough. It is in
`frame.css` ("The blue glitch") and uses `#blue-glitch` in `index.html`: three flat washes
(old blue, new blue and a pale blue) and six torn pieces, thin flat bands. All of it
moves in steps, never in a smooth slide, at times that are not evenly spaced. At most three
big flashes happen in one glitch, so never more than three in a second, and the pale blue
is never more than a fifth opaque. A test in `tools/test-effects.mjs` counts them.

The blocks are promoted to layers (`will-change`) and given a perspective only while
they fly apart, in `break`. Between those, and the rest of the time, there is
nothing extra for the Mini to hold. The blocks (five, or four in the sidebar layout), the backdrop, the picture and, for the
glitches, the red layer or the blue layers (three washes and six pieces, for about 2 and 1
seconds) are the only layers a hidden transition adds, apart from the pieces that fall. Those
are up to 40 for the 5 seconds of the fall, the lift and the cube, with the perspective in the
`transform` of each one. The four pictures wait in the backdrop, which is not drawn until a
transition plays.

Swapping the pages: when the large panel's page change comes up, it asks for a hidden
transition (`core/areas.js`). If one plays, the transition first waits for the three
areas to be at rest. When the blocks are apart it swaps the large panel's next page,
and it asks the small panel and the ticker (only the ticker in the sidebar layout) to
move on to theirs. They pick their next
page as they always do, wait at a gate in `core/areas.js` until the screen is apart,
and swap it unseen. A region that is late carries on with an ordinary page change once
the screen is whole again.

The Speed setting stretches every time, as it does for every other move. Calm and no
motion never play one. `?finish=flat` works as always.

## Add a hidden transition

A transition is one entry in a list, plus a few lines to give it an hours setting and a
chance setting.

1. Add an entry to `hiddenTransitions` in `dashboard/core/hidden-transitions.js`. The
   key is the id the Studio stores. `name` is the words on its Play button.
   `hoursField` is the name of its hours setting and `chanceField` the name of its
   percent setting, which only a page saved before the hours existed still uses.
   `run(scene)` is the show, one line
   for each step. The steps are `scene.glitch(seconds)` (red) or `scene.glitch(seconds,
   'blue')`, `scene.breakApart('black')` or `scene.breakApart('blue')`,
   `scene.wait(seconds)`, `scene.pictureIn(set, seconds)` (fades the next picture of the
   set in), `scene.pictureCut(set, seconds)` (shows it at once and holds it),
   `scene.pictureOut(seconds)` and `scene.rebuild()` (the screen comes back whole and the
   frames fall and come back, see above). A set is `'redEyes'` or
   `'blueScreen'`. It must end with `scene.rebuild()`.

       myTransition: {
         name: 'My transition',
         hoursField: 'myEveryHours',
         chanceField: 'myChance',
         async run(scene) {
           await scene.breakApart('black');
           await scene.wait(1);
           await scene.rebuild();
         },
       },

   A new set of pictures is a new list in `core/hidden-pictures.js`, and its files go in
   `dashboard/assets/hidden/`. A new kind of step is a new function in `makeScene` in
   `core/hidden-run.js` and its moves in `frame.css`.
2. In `dashboard/config.js` add the hours and the chance to `defaultSettings`
   (`myEveryHours: 0`, which means not set, and `myChance: 1`) and to `limits`
   (`myEveryHours: { min: 1, max: 1000 }` and `myChance: { min: 0, max: 100 }`). Add
   the hours to the sample content, `dashboard/data/sample/content.json`.
3. In `studio/hidden-transitions.js` add the same id, name, hours field and chance field, in the
   same place in the list. The Studio is built on its own and cannot read the
   dashboard folder, which is why the list is written twice. The Play button comes from
   this list, so there is nothing to add in `actions.js`.
4. In `studio/schemas/settingsHidden.js` add the hours field, a copy of
   `desktopEveryHours`, and the hidden chance field, a copy of `desktopChance`. Add
   their names to `hiddenNames` and the number tables in
   `studio/check-schemas.mjs` (search it for `desktopEveryHours`).
5. Run `node tools/test-effects.mjs`, `node tools/test-content.mjs`,
   `node tools/test-hidden-hours.mjs` and `node studio/check-schemas.mjs`. Then run `npm run deploy` in the `studio` folder so
   the editors see the new field and button.

## Where the code is

- `dashboard/core/hidden-transitions.js`: the list, and the show of each.
- `dashboard/core/hidden.js`: the plain functions, with no page in them. They decide
  what happens at a page change (`chooseHidden`: the hours and the pace, the older
  percent, the gap after a transition, the master switch, calm motion, what blocks it,
  a push), and tidy and remember a push and the time of the last transition. The tests
  are in `tools/test-effects.mjs`, and the hours and the gap are in
  `tools/test-hidden-hours.mjs`.
- `dashboard/core/hidden-run.js`: plays a transition: asks at each page change, sets
  the attributes, waits, and puts the screen back whatever happens. `scene.rebuild()` in it
  times the fall, the cube, the lift and the build, and holds the rotation clock
  (`pauseRotation` and `resumeRotation` in `core/schedule.js`).
- `dashboard/core/hidden-pile.js`: finds what falls on the page, measures it, hands the list
  to `planPile` and writes the answer on the pieces, the cube and the content. `makePile()`
  returns `release`, `showCube`, `finish`, `contentIn` and `clear`.
- `dashboard/core/transitions.js` (the second half): `planPile`, `mergeSmall`, `boxInPose`,
  `seededRandom` and the numbers `pileTimes` and `pileShape`. They have no page in them.
  The tests are in `tools/test-pile.mjs`.
- `dashboard/core/hidden-pictures.js`: the four pictures (file name, size, how each fills the
  screen) and which one plays next. Plain functions, tested in `tools/test-effects.mjs`.
- `dashboard/assets/hidden/`: the four picture files.
- `dashboard/core/images.js`: `preloadImages`, which loads the four pictures when the screen starts.
- `dashboard/core/announce.js`: the plain functions behind Play announcements, with no page
  in them: tidying `announceRequest`, which announcements play (`enabledAnnouncements`),
  playing them one after another (`playEach`), and the runner that applies the guard and
  waits for the screen (`makeAnnounceRunner`). The tests are in `tools/test-effects.mjs`.
- `dashboard/core/announce-run.js`: gives that runner the real screen, and plays each
  announcement with `runAnnouncement` in `core/takeover.js`. `hiddenPlaying` in
  `core/hidden-run.js` is how it knows a hidden transition has the screen.
- `dashboard/core/presentation-test.js`: the plain functions behind Run presentation test, with no
  page in them: tidying `presentationTestRequest` and the runner that applies the guard and waits for
  the screen (`makePresentationTestRunner`). The tests are in `tools/test-effects.mjs`.
- `dashboard/core/presentation-test-run.js`: gives that runner the real screen, reads the sample talk
  from `dashboard/data/sample/content.json` and hands it to `startTestTalk` in
  `core/presentation-run.js`. Its slides and manifest.json are in
  `dashboard/data/sample/slides/presentation-sample/`.
- `dashboard/core/preview.js`: the plain functions behind the Preview buttons, with no page in them: the
  kinds, tidying `previewRequest`, which pack is next (`nextPack`), the saved preview that survives a reload
  (`resumePreview`) and the runner that applies the guard and waits for the screen
  (`makePreviewRunner`). The tests are in `tools/test-effects.mjs`.
- `dashboard/core/preview-run.js`: gives that runner the real screen and asks the page to work out its
  look again. What it holds is three small functions: `previewStyle` in `core/style.js`, `previewTeam` in
  `core/teams.js` and `previewPack` in `core/theme.js`. Each keeps a value and a time in memory and is
  read by the code that chooses the style, the team and the pack, so no setting is written.
- `dashboard/core/areas.js` and `core/schedule.js`: the hook at the large panel's page
  change, the gate for the other areas, and `moveOn` (ask a region to change page now).
- `dashboard/frame.css` ("The frames fall and come back", "Hidden transitions" and "The blue
  glitch"), `base.css` (the layers, the pictures and the cube), `tokens.css` (the colours and
  times) and `index.html` (`#backdrop`, `#red-wash`, `#blue-glitch`, `#pile` with the cube, and
  `data-block`).
- `dashboard/frame.js`: `setHiddenPlaying` holds the logo effects and the screen glitch
  still while one plays, and `playGlitch` gives it its red glitches. `enter(panel, true)`
  brings in the content of a panel without drawing its frame again, which is what the build does.
- `studio/schemas/settingsAnnouncements.js` has the hidden `announceRequest` field
  (`announceRequestField`), and `usePlayAnnouncementsAction` in `studio/actions.js` is the
  button. The starting value is `announceRequest` in `defaultSettings` in
  `dashboard/config.js`.
- `studio/schemas/settingsPresentations.js` has the hidden `presentationTestRequest` field
  (`presentationTestRequestField`), and `useRunPresentationTestAction` in `studio/actions.js` is the
  button. The starting value is `presentationTestRequest` in `defaultSettings` in
  `dashboard/config.js`.
- `studio/schemas/settingsPreview.js` has the hidden `previewRequest` field (`previewRequestField`, in the
  Screen tab), `studio/previews.js` is the Studio's copy of the kinds, and `previewActions` in
  `studio/actions.js` are the buttons. The starting value is `previewRequest` in `defaultSettings` in
  `dashboard/config.js`, and `previewSeconds` there is the 2 minutes.
- `studio/schemas/settingsHidden.js` is the tab, `studio/actions.js` has the Play
  buttons, and `studio/hidden-transitions.js` is the Studio's copy of the list. The
  starting values are `hiddenEnabled`, `desktopEveryHours`, `redEyesEveryHours`,
  `desktopChance`, `redEyesChance` and `hiddenRequest` in `defaultSettings` in
  `dashboard/config.js`. The hours start at 0 there, which means not set, and at 60 in
  the Studio. `hiddenGapHours` is the 4 hour gap.
