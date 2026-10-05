# Hidden transitions

This page also covers the Play announcements button, which sits beside the two Play
buttons for the transitions. See "Play announcements" below.

A hidden transition is a rare surprise. Now and then, instead of an ordinary page
change, the whole screen does something else. There are two:

- **Desktop reveal.** The banner, the countdown, the large panel, the small panel
  and the ticker come apart in 3D and fly away. For about a second and a half the
  screen shows a plain wallpaper of blue and teal facets. Then the five blocks fly
  back together and click into place, showing the next page of each panel.
- **Red eyes.** The screen glitches with flat red flashes, then everything breaks
  apart and the screen goes black. Two red eyes open in the dark and an angular
  robot face shows round them for 2 seconds. It fades out and the screen comes back
  together showing the next page of each panel.

Both are drawn from plain polygons in the team's own faceted style. The wallpaper
has no icons or windows, and the face is not taken from anywhere.

## The Hidden tab

Open Studio, click Dashboard Settings and open the Hidden tab.

- **Allow hidden transitions.** The master switch. It starts on. Turn it off and
  neither transition ever plays, not even one you push (below).
- **Desktop reveal chance (percent).** How many page changes in 100 become the
  desktop reveal. From 0 to 100, and it starts at 1. 0 means never.
- **Red eyes chance (percent).** The same for red eyes. It starts at 1. 0 means
  never.
- **Last push.** Filled in by the Play buttons (below). You cannot type in it. It
  shows which transition was pushed last, and when.

The chance is for each page change of the large panel, which changes about every 20
seconds. With both at 1, about one page change in 50 is a surprise, so a few an hour
on the screen. One random number decides each page change: the first percent of
the way from 0 to 100 is the desktop reveal, the next is red eyes, and the rest is an
ordinary page change. If the two add up to more than 100, red eyes gets what is left.

## Play one now

1. Open Dashboard Settings in Studio.
2. Open the menu next to Publish (the three dots) and click **Play desktop reveal**
   or **Play red eyes**.
3. Look at the TV. It plays within about 20 seconds.

The menu has a third button, Play announcements, which is not a transition (see below).
Each of the two buttons above writes the kind and the time now into Last push and
publishes the page for you, so you do not click Publish. Any other change you had not published yet is
published too, as with the buttons that switch between sample and production content.

What the screen does with a push:

- It plays at the next page change of the large panel. If that is more than 20 seconds
  away, the large panel is asked to change page at once, so it plays within a few
  seconds.
- It ignores the chance. A chance of 0 does not stop a push.
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
- While the screen shows sample content (Content source in Dashboard Settings) it reads
  the settings from `dashboard/data/sample/content.json`, not from Studio, so a push
  does nothing. Switch back to production content first.

## Switch them off

- **For good:** turn off Allow hidden transitions, or set both chances to 0 (a push
  still works with the chances at 0, but not with the switch off).
- **For one of them:** set its chance to 0.
- **Calm and no motion** never play one. Motion in the Screen tab of Dashboard Settings
  set to Calm switches them off, and so does `?motion=calm` in the address.
- They also never play while a full screen alert or announcement is up, while a demo
  plays, or while the night screen is up. If one of those starts in the middle of a
  hidden transition, the transition stops at once and the screen goes back to normal.

## Play announcements

The menu next to Publish on Dashboard Settings has a third button, **Play announcements**.
It is not a transition, but it is built the same way: one click, and the TV plays it
within a few seconds. It plays every announcement in the Announcements tab that is
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
- While the screen shows sample content (Content source in Dashboard Settings) it reads
  the settings from `dashboard/data/sample/content.json`, not from Studio, so the button
  does nothing. Switch back to production content first.

A Demo step can play the same announcements: pick **All announcements** as its screen
(docs/demo.md).

## Try one

Add `?hidden=desktop` or `?hidden=redEyes` to the address and that transition plays at
the next page change of the large panel, once, whatever the chance says.
`?hidden=off` never plays any. Add `?night=off` too when it is night in the Theme
time zone, or the night screen will stop it. docs/try-it-on-the-mini.md lists every switch.

## How it works

The five blocks are the five regions marked `data-block` in `dashboard/index.html`.
When a transition plays, `core/hidden-run.js` sets `data-hidden` on `#world`, and
`frame.css` (the section "Hidden transitions") does all the moving:

| `data-hidden` | What happens                                                                  |
|---------------|-------------------------------------------------------------------------------|
| `glitch`      | Red eyes only. The screen jumps (the old television glitch) and a flat red layer flickers. At most two flashes in any second, and never brighter than .45 |
| `break`       | The blocks fly apart in 3D (`translate3d`, `rotateX`, `rotateY`, `rotateZ`) and fade. The backdrop layer fades in behind them |
| `apart`       | The blocks are out of sight. The pages of all three areas are swapped now, so nobody sees it |
| `build`       | The blocks fly back with the same overshoot and settle as the pieces of the mechanical page change, and the backdrop fades out |

The backdrop is under the stage. It is black, and `data-look` says what is on it:
`wallpaper`, or for red eyes `eyes`, `face` and `gone`. Everything moves with
`transform` and `opacity` only, and the eyes are flat shapes whose opacity changes.
Nothing glows or blurs.

The blocks are promoted to layers (`will-change`) and given a perspective only while
they fly, in `break` and `build`. Between those, and the rest of the time, there is
nothing extra for the Mini to hold. The five blocks, the backdrop and, for red eyes,
the red layer are the only layers a hidden transition adds.

Swapping the pages: when the large panel's page change comes up, it asks for a hidden
transition (`core/areas.js`). If one plays, the transition first waits for the three
areas to be at rest. When the blocks are apart it swaps the large panel's next page,
and it asks the small panel and the ticker to move on to theirs. They pick their next
page as they always do, wait at a gate in `core/areas.js` until the screen is apart,
and swap it unseen. A region that is late carries on with an ordinary page change once
the screen is whole again.

The Speed setting stretches every time, as it does for every other move. Calm and no
motion never play one. `?finish=flat` works as always.

## Add a hidden transition

A transition is one entry in a list, plus a few lines to give it a chance setting.

1. Add an entry to `hiddenTransitions` in `dashboard/core/hidden-transitions.js`. The
   key is the id the Studio stores. `name` is the words on its Play button.
   `chanceField` is the name of its chance setting. `run(scene)` is the show, one line
   for each step. The steps are `scene.glitch(seconds)`, `scene.breakApart('wallpaper')`
   or `scene.breakApart('black')`, `scene.wait(seconds)`, `scene.show('eyes' | 'face' |
   'gone', seconds)` and `scene.rebuild()`. It must end with `scene.rebuild()`.

       myTransition: {
         name: 'My transition',
         chanceField: 'myChance',
         async run(scene) {
           await scene.breakApart('black');
           await scene.wait(1);
           await scene.rebuild();
         },
       },

   A new picture is a new `data-look` in `frame.css` and a new function in
   `core/hidden-art.js`, and a new step in `makeScene` in `core/hidden-run.js`.
2. In `dashboard/config.js` add the chance to `defaultSettings` (`myChance: 1`) and to
   `limits` (`myChance: { min: 0, max: 100 }`).
3. In `studio/hidden-transitions.js` add the same id, name and chance field, in the
   same place in the list. The Studio is built on its own and cannot read the
   dashboard folder, which is why the list is written twice. The Play button comes from
   this list, so there is nothing to add in `actions.js`.
4. In `studio/schemas/settingsHidden.js` add the chance field, a copy of
   `desktopChance`. Add its name to `hiddenNames` and the number tables in
   `studio/check-schemas.mjs` (search it for `desktopChance`).
5. Run `node tools/test-effects.mjs`, `node tools/test-content.mjs` and
   `node studio/check-schemas.mjs`. Then run `npm run deploy` in the `studio` folder so
   the editors see the new field and button.

## Where the code is

- `dashboard/core/hidden-transitions.js`: the list, and the show of each.
- `dashboard/core/hidden.js`: the plain functions, with no page in them. They decide
  what happens at a page change (`chooseHidden`: the chance, the master switch, calm
  motion, what blocks it, a push), and tidy and remember a push. The tests are in
  `tools/test-effects.mjs`.
- `dashboard/core/hidden-run.js`: plays a transition: asks at each page change, sets
  the attributes, waits, and puts the screen back whatever happens.
- `dashboard/core/hidden-art.js`: the wallpaper and the face, as polygons.
- `dashboard/core/announce.js`: the plain functions behind Play announcements, with no page
  in them: tidying `announceRequest`, which announcements play (`enabledAnnouncements`),
  playing them one after another (`playEach`), and the runner that applies the guard and
  waits for the screen (`makeAnnounceRunner`). The tests are in `tools/test-effects.mjs`.
- `dashboard/core/announce-run.js`: gives that runner the real screen, and plays each
  announcement with `runAnnouncement` in `core/takeover.js`. `hiddenPlaying` in
  `core/hidden-run.js` is how it knows a hidden transition has the screen.
- `dashboard/core/areas.js` and `core/schedule.js`: the hook at the large panel's page
  change, the gate for the other areas, and `moveOn` (ask a region to change page now).
- `dashboard/frame.css` ("Hidden transitions"), `base.css`, `tokens.css` (the colours
  and times) and `index.html` (`#backdrop`, `#red-wash` and `data-block`).
- `dashboard/frame.js`: `setHiddenPlaying` holds the logo effects and the screen glitch
  still while one plays, and `playGlitch` gives it its red glitches.
- `studio/schemas/settingsAnnouncements.js` has the hidden `announceRequest` field
  (`announceRequestField`), and `usePlayAnnouncementsAction` in `studio/actions.js` is the
  button. The starting value is `announceRequest` in `defaultSettings` in
  `dashboard/config.js`.
- `studio/schemas/settingsHidden.js` is the tab, `studio/actions.js` has the Play
  buttons, and `studio/hidden-transitions.js` is the Studio's copy of the list. The
  starting values are `hiddenEnabled`, `desktopChance`, `redEyesChance` and
  `hiddenRequest` in `defaultSettings` in `dashboard/config.js`.
