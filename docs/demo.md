# The demo

A demo shows a few of the screen's special screens one after another, for
visitors or for a check that they work, without waiting for 14:30 or for night.
You start it from the editing screen (Studio) with one click. It plays once, and
then the screen goes back to what it was doing.

## Run a demo

1. Open Studio and click Demo in the sidebar.
2. Open the menu next to Publish (the three dots) and click Run demo.
3. Look at the TV. The demo starts within a few seconds.

Click Stop demo in the same menu to end it early. Stop demo is switched off when
no demo has been asked for. Click Run demo again while a demo is playing and it
starts again from the first step. Run demo and Stop demo each publish the page
for you, so you do not click Publish.

Dashboard Settings has a button of its own for the presentation mode, **Run
presentation test**, in the same menu as Play announcements. It starts the sample
talk with six sample slides, so you can try the clicker without a booked talk. It
is not a demo step and does not use this page. docs/hidden-transitions.md explains it.

## What the page holds

- Requested at: the time Run demo was clicked. Run demo fills it in and Stop demo
  clears it. You cannot type in it.
- Steps: the screens to show, one after the other, up to 10. Each step has a
  Screen and the Seconds it stays, from 5 to 300. A new Demo page starts with the
  Announcement for 30 seconds and then Night mode for 30 seconds. Drag the steps
  to change the order, or add the same screen twice.
- Demo announcement text: the words of the Announcement step, up to 24
  characters. Leave it empty to use the first announcement in Dashboard Settings
  (both its lines, if it has two). If there is no announcement to use, the screen
  shows [DEMO ANNOUNCEMENT].

The screens you can pick are the ones in the list of "demo screens" in the code:

- Announcement: the full screen announcement. With the Demo announcement text it
  is one line. The step's seconds are how long the words stay up. The announcement
  takes a few more seconds to arrive and to leave.
- All announcements: every announcement in Dashboard Settings that is switched on,
  one after another, in the order of the list. Each plays at its own length (the
  seconds of its first line and of its second line), whatever its time and days say.
  It is the same as the Play announcements button on Dashboard Settings
  (docs/hidden-transitions.md). The step's seconds are not used: the step lasts as
  long as the announcements do, and it is over at once when none is switched on. The
  Demo announcement text is not used either. Stop demo ends it early.
- Night mode: the black screensaver with the bouncing logo. It shows whatever the
  time is, whether or not Use night mode is on, and whatever Night style says. It
  ignores `?night=off` too. The step's seconds count from when it starts to fade
  in.

## What the screen does

The screen reads the Demo page with the rest of the content, so a click on Run
demo reaches it within a few seconds. Then:

- **A request starts a demo only if it is recent and new.** It must be no more
  than 60 seconds old, and it must not be the request the screen handled last.
  The screen keeps that request in the browser's storage (`localStorage`, under
  `teletraan-demo-handled`). So a Mini that restarts a minute after a demo does
  not play it again, and one that restarts later finds a request that is too old.
  A request up to 5 seconds in the future counts too, in case the clock of the
  computer that clicked is a little ahead. The Mini's clock must be right for
  this: if it is more than a minute out, a demo never starts. The Time line of
  `deploy/scripts/check-connection.sh` shows it (docs/rebuilding-the-mini.md).
- **The steps play once, in order.** While they play, the normal pages stop
  changing and the logo effects and the screen glitch do not start by themselves.
  When the last step ends, the pages change again and the screen is back where
  it was. Night mode goes back to what the clock and Dashboard Settings say, so
  it stays up if it really is night.
- **Stop demo, or a new Run demo,** ends the demo that is playing. The screen
  that is up is taken away at once, and the rest of the steps do not play.
- **A real alert wins.** If an alert comes on during a demo, the demo ends. If an
  alert or a real announcement is on screen when you click Run demo, the demo
  waits until it is over, as long as the request is still under a minute old, and
  between two steps it ends if one has the screen.
- **Calm and none still work.** In calm mode the screens fade, and with no motion
  nothing moves, as at any other time.
- **Sample content has its own Demo.** While the screen shows sample content
  (Content source in Dashboard Settings) it reads the demo from
  `dashboard/data/sample/content.json`, not from Studio, so Run demo has no
  effect. Switch back to production content first.

The demo is not a screen on the normal rotation. It is also not the same as the
`?demo=announcement` address switch, which only plays one announcement once for
testing.

## Add a demo screen

A demo screen is one entry in a list, plus its name in the Studio's copy of the
list. Nothing else needs to know about it.

1. Add an entry to `demoScreens` in `dashboard/core/demo-screens.js`. The key is
   the id the Studio stores: lower case, with a hyphen between words. `name` is the
   words editors pick it by. `run(context)` puts the screen up. It does one of two
   things:

   - It returns a function that takes the screen away. The runner waits the step's
     seconds and then calls that function. Night mode does this.

         'my-screen': {
           name: 'My screen',
           async run(context) {
             const mine = await import('./my-screen.js');
             mine.show();
             return mine.hide;
           },
         },

   - It is an async function that is done when the screen is over. Use
     `context.waitSeconds(context.seconds)` to wait out the step, and
     `context.cancelled()` to find out that the demo was stopped. The announcement
     does this: it passes `context.cancelled` to `runAnnouncement` in
     `core/takeover.js`, which ends early when it says true.

   `context` also has `getContent()`, the newest content. Load code that touches
   the page with `import()` inside `run`, as the entries above do, so that the
   file can still be read by the tests and by `check-schemas.mjs`.

2. Add the same id and name, in the same place in the list, to
   `studio/demo-screens.js`. The Studio is built on its own and cannot read the
   dashboard folder, which is why the list is written twice.

3. Run `node tools/test-effects.mjs` and `node studio/check-schemas.mjs`. The
   second one fails if the two lists differ. Then run `npm run deploy` in the
   `studio` folder so the editors see the new screen in the Screen list.

A screen has to give back everything it took. It must not pause or resume the
rotation itself, because the runner does. Anything that moves on it follows the
animation rules (transform, opacity and line drawing only), and it must still
work in calm and none motion. If it changes the page for a while, put the page
back in the function it returns, or when `context.cancelled()` says so.

## Where the code is

- `dashboard/core/demo-screens.js`: the list of screens, and what the
  announcement step shows. The All announcements step uses `enabledAnnouncements`
  and `playEach` in `dashboard/core/announce.js`.
- `dashboard/core/demo.js`: the plain functions, with no page in them. They tidy
  the Demo page into `content.demo`, decide whether a request should run
  (`shouldRunDemo`), remember the handled request, and run the steps
  (`makeDemoRunner`). The tests for them are in `tools/test-effects.mjs`, and the
  tests for `content.demo` are in `tools/test-content.mjs`.
- `dashboard/core/demo-runner.js`: gives `makeDemoRunner` the real screen and
  looks once a second. `shell.js` starts it after the alerts and announcements.
- Small hooks in other files: `pauseRotation` and `resumeRotation` in
  `core/schedule.js` count, so a demo and an announcement can both pause the
  rotation; `setEffectsPaused` in `frame.js`; `showNightNow` and `endNightNow` in
  `core/night-screen.js`; `alertsStarted` and the third argument of
  `runAnnouncement` in `core/takeover.js`.
- `studio/schemas/demo.js` is the page, `studio/actions.js` has Run demo and Stop
  demo, and `studio/demo-screens.js` is the Studio's copy of the list. The
  starting values are `defaultDemo` in `dashboard/config.js` and their copy in
  `studio/schemas/demo.js`.
