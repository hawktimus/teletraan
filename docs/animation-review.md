# Review of the transitions

This review was written before Light motion and before each theme got its own kit of every piece. docs/transition-reference-guide.md says what the design boards show and how the themes were mixed, docs/transitions.md has Full, Light and Calm, and docs/performance.md has the measurements after them. The budget of this page still holds for Full.

Goal of the owner: the screen should look like one machine that takes itself apart and builds itself again, with hundreds of parts that slide, turn, fold and lock in order, and not like a picture that changes shape. This page says what the transitions do now, what was measured, where they fall short, what was built and what is only proposed.

## What happens today

- **Panel transition (reform)**: the large panel goes to the next row. Details are in docs/transitions.md. In short: for 0.4 s screws, latches and braces come out; for 0.65 s the four edges fold in on themselves; the content is cut into 12 by 6 squares that turn over one by one in a wave (1.1 to 1.9 s); the edges unfold and the hardware locks (to 3.0 s).
- **View transition (reformView)**: the same on the banner, the side column, the main panel, the strip and the ticker at once, with the hawk riding across.
- **Per theme**: Original (gold and purple plates, the metal of the team), Cybertron (power cores, bolts of light, squares collapse to a line), Retro (comic pieces, squash and stretch, speed lines) and Foundry (deadbolts, hand wheel, rams, gauges, a jolt of the stage). Each has a kit in styles/<theme>/transitions.js.
- **Swap** (core/swap-plan.js): the older pull apart and re-form for a change of theme, a preview or a Monday card. Not measured here.
- **Guards**: calm motion and no motion draw a plain change and no transition. `?reform=off` plays the older change. `screenIsSlow` (median of the last 60 frames over 40 ms) gives the plain change. A transition runs only when nothing else has the screen.

## Measurements

Headless Chromium at 1920 by 1080, software drawing, sample content, `node tests/motion/run.mjs reform/`. The machine was busy with other work (load average about 23), so the longest frame moves by 15 to 30 ms from run to run, and the number of frames in three seconds (about 180 when nothing is wrong) is the steadier figure. The same unchanged code gave 173 and 155 frames in two runs.

| Run | Frames in 3 s | Longest frame | Animated elements | Elements in layer |
|-----|---------------|---------------|-------------------|-------------------|
| Original panel | 183 | 18 to 34 ms | 245 | 5241 |
| Cybertron panel | 173 | 35 ms | 228 | 4914 |
| Retro panel | 131 | 66 ms | 258 | 5757 |
| Foundry panel | 172 | 34 ms | 265 | 7237 |
| Original view | 150 | 84 ms | 543 | 11495 |
| Cybertron view | 127 | 85 ms | 507 | 10599 |
| Retro view | 95 | 82 ms | 558 | 11511 |
| Foundry view | 103 | 100 ms | 606 | 11732 |

Before any change 5 of the 36 rules failed on this machine (Cybertron panel, Retro panel and view, Foundry panel and view, all by one to three frames or by the allowed share of the view). Preparing a run (copying the page into the layer) took 30 to 290 ms for a panel and 470 to 530 ms for a view, in turns of 4 ms, so no frame is long while it is made.

What a frame costs: not the count of animated parts but the surfaces drawn into layers of their own. Each square is a 3D layer with two faces of real content, and the flat copies are whole pages. Every extra animated element with 3D around it cost measurably (see "What was built").

## Against the five goals

1. **Everything moves**: the edges, hardware and squares move, but the content is still for 1.1 s, and the hardware is small (8 to 22 px at the edges). The machine is the frame, not the panel. Gap.
2. **Interlocking**: the edges fold on knuckle pins, which is real. The squares have no relation to each other: each turns in its own place. Gap.
3. **Exploded to assembled**: the squares never leave their grid. The panel never looks taken apart. Gap (largest).
4. **Choreography**: the wave across the squares and the fold order are staged and overlap a little. Mostly met. There is no seat at the end of a square, only the end of the turn.
5. **Hard surface**: pieces are drawn solid with a rim, with no blur or glow. Met.

## Ranked proposals

Cost is measured against 33 to 34 ms per frame and about 180 frames in 3 s on the test machine.

1. **Cells with a lock pin or a hinge barrel (built, Original panel)**: every square sits in a cell that slides out from the middle, parts, and is driven back past its place and settles. About 140 more animated elements, no new layout, transform only. The test machine shows no change in frames (181 against 183). It is on for the Original panel only.
2. **The same for Cybertron, Retro and Foundry panels (not built)**: costs 10 to 17 percent of the frames on the test machine, because their kits already draw more layers. Needs the Mini measured first. Each kit would draw its own pin and barrel in its own colors (the kit already has `draw(role)`).
3. **Cells in the view transition (not built)**: the view already has 543 to 606 animated elements and fails the frame rule by the allowed share. Adding 380 more made it worse (27 over 34 ms against 0 to 24). Only after the view is cheaper (fewer squares in the banner and ticker).
4. **Rails and shutters over the content for the first second (not built)**: slats that slide across the old content along rails while the edges fold, so that the panel is not still. About 20 elements, cheap. Needs a design for what they cover, because the squares are hidden until 0.75 s.
5. **Gear trains between the corner gears (not built)**: line-art teeth that mesh and turn together. Low cost, adds detail only.
6. **A choreography seed shared by the squares of a swap**: the panel run already gives a random seed to the squares and the plan is deterministic from it.

## What was built

See docs/transitions.md, "The cells". Calm motion, `?reform=off` and `screenIsSlow` stay as before, and `?reform=lite` (or a median frame over 26 ms) draws the squares without cells. The rules are in tests/motion/reform.mjs (`every-cell-is-locked-at-the-end`) and tests/reform.test.mjs.

The contact sheets are made by `node tools/anim-strip.mjs --label <name>` into _outputs/anim/<name>/ (not committed).
