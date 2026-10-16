# Motion tests

These tests open the dashboard in a real browser, play each transition and check rules. They look at where things are and when, and do not compare pictures, so a change of design does not break them. Each rule is one test. A failure is one line that names the element, the time and the measurement, for example:

    #region-grid1 plate-body-left at 1250 ms: 3.2px from its place (limit 1px)

The frames of a failed test are in `_outputs/motion/<test>/` (git ignores it): `failure.txt` with every line, and PNG files that draw the pieces as boxes (red where the rule failed) or show the screen.

## How to run them

Playwright is a development dependency of `tools/` and is never on the Mini. On a laptop that has it:

    node tests/motion/run.mjs              every rule, about ten minutes
    node tests/motion/run.mjs swap         only the rules with "swap" in their name
    node tests/run.mjs                     every test of the repository, and this one last
    node tests/run.mjs motion              only the motion tests, through the runner

If Playwright is not installed the runner prints one line, `skip  motion tests`, and carries on, so the Mini and any other Mac stay green. To install it, run `npm install` in `tools/` (ask first, it is a download). To use a copy that is somewhere else, name its folder: `NODE_PATH=/path/to/node_modules node tests/motion/run.mjs`. It uses Chrome for Testing, which Playwright downloads for itself.

## How a test works

1. `run.mjs` serves `dashboard/` on a free port of this computer and starts the browser.
2. Each page is opened with `?sample=1&clock=fixed&motion=full&night=off`. `clock=fixed` makes the clock of the page start at 14:00 on Wednesday 14 October 2026, so the night hours and the weekday themes are the same on every run. With `?sample=1` and `clock=fixed` the page has `window.teletraanTest` (`dashboard/core/test-hook.js`, and nothing on the wall). `window.teletraanTest.play(name)` starts one transition: `view-swap`, `team-swap`, `blue-screen`, `red-eyes`, `monday-scroll`, `photo-cross`, `name-glitch`, `hawk-flap`.
3. `lib/probe.js` runs inside the page. It wraps `Element.animate`, so it knows every animation when it is made, pauses them and sets their time. So "at 200 ms" is the screen at exactly 200 ms, whatever the computer is doing. The measurements go back to the test, which judges them.

## The rules

| File | Rules |
|------|-------|
| `swap.mjs` | Pull-apart swap, for a change of view and for a change of team: at 0 ms every piece is in place; at 200 and 350 ms no two blocks of text overlap and no piece is outside the canvas by more than its own size; at 1250 ms every piece has landed within 1px with opacity 1; the hawk stays on the canvas and ends in the slot of the logo. The team swap also lands mirrored. |
| `hidden.mjs` | Blue screen and red eyes: the collapse leaves no piece out of the pile and no content showing, the effect plays, the cube rises from below the screen, shrinks and ends, every piece and bolt returns within 1px, and the collapse, cube and rebuild take no more than 6 seconds more than the effect. |
| `monday.mjs` | The three Monday cards that scroll, in every look: five row heights in 600 ms by transform only, and no row shows outside the clip. |
| `photo.mjs` | The photo cross changes opacity only, and two photos are never both above 0.9. |
| `effects.mjs` | The name glitch and the hawk flap never run while `isBusy()`, held by hand, in a swap and in a hidden transition. |
| `animated.mjs` | Every `@keyframes` and every animation that runs uses only transform, opacity and line drawing, and the elements they move keep their filter, shadows, width and height. |
| `seams.mjs` | The pieces of every frame overlap by a pixel at 1920 x 1080 and at 3840 x 2160. |
| `text.mjs` | Chips, labels and headers fit their box with 8px to spare. The countdown title wraps by `core/countdown-title.js` and is never cut. The department labels of the Monday panels fit the widest department. |
| `marks.mjs` | Placeholder markers, sample tags and plate ids appear only with `?sample=1`. |

## Where a rule is looser than the order

Say so here and in the commit that did it, so nobody wonders.

- Letters of one word, and a bracket that touches the line under it, are not text blocks that overlap (`swap.mjs`): only ink that overlaps by more than 4px does.
- A seam is a run of at least 8 pixels along an edge. A pinhole of a few pixels where three pieces meet at a corner is not counted (`seams.mjs`).
- The title of a panel has the 16px that the design keeps between its room and the metal of the line (`dashboard/core/header-room.js`), so LEADERSHIP at 96px, 650.6px wide in 656px, has 21px before the metal and 5px in its box (`text.mjs`).

## Adding a rule

Write a function that takes what the probe measured and returns a list of lines. Each line names the element, the time and the measurement. Add it to the `tests` of a file here, or start a new file and add its name to `modules` in `run.mjs`. A run that several rules read is made once with `ctx.scenario`. A page that needs to do something new gets it from `dashboard/core/test-hook.js`, in `plays`.
