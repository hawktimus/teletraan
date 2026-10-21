# Performance

The wall is a 2011 Mac Mini that runs the page for days. This page says what was measured, where the time goes, what was changed and what the budget is. The numbers were taken on a modern laptop with the CPU slowed down, not on the Teletraan computer, so they show where the cost is and do not promise a frame rate (see "What is not known").

## How to measure

`tools/perf/measure.mjs` opens the dashboard on the sample content with the clock fixed and the CPU slowed by a factor (`--slow 4` is four times slower). Playwright is a development dependency and is not on the Teletraan computer; name its folder with `NODE_PATH`.

    node tools/perf/measure.mjs rotation --slow 4 --rows 40    frame times at each change of the large panel, by panel
    node tools/perf/measure.mjs leak --slow 1 --rows 600       what the page keeps after many row changes
    node tools/perf/measure.mjs edits --rows 240               what it keeps after many edits of the content
    node tools/perf/measure.mjs soak --seconds 1800            the screen left alone
    node tools/perf/measure.mjs startup --slow 6               time to first paint and to the first panel
    node tools/perf/measure.mjs network --seconds 240          requests and bytes a minute
    node tools/perf/measure.mjs profile --seconds 40 --rows 12 where the script time goes
    node tools/perf/measure.mjs heap --seconds 400             objects made in a stretch and still alive after it
    node tools/perf/heap-diff.mjs --seconds 600                two heap snapshots, by kind of object
    node tools/perf/measure.mjs trace --slow 4 --rows 12       a trace for the Performance tab of the browser
    node tools/perf/transitions.mjs --slow 4 --motion light    each theme's panel and view transition: frames, animated elements, layouts

A row change is the Next look button of Start here (`core/test-hook.js`), so a change plays the whole panel transition. `?perf` on the real screen shows a refresh-time readout (`dashboard/perf.js`).

## Measurements

The sample content, 1920 x 1080, full motion, headless Chrome that draws with software. A frame is the gap between two animation frames, so 17 ms is 60 Hz and 34 ms is a frame that missed one refresh.

| What | 1x | 4x | 6x |
|------|----|----|----|
| Row changes: median frame | 17 ms | 17 ms | 17 ms |
| Row changes: 95th percentile frame | 33 ms | 34 ms | 34 ms |
| Row changes: slowest frame | 67 ms | 100 ms | 167 ms |
| Row changes: frames over 34 ms | 3.2% | 4.7% | 4.9% |
| Row changes: frames over 100 ms | 0 | 1 of 5358 | 11 of 5658 |
| Quiet screen, 8 seconds: frames over 34 ms | 0 | 2 of 476 | 3 of 469 |
| First paint | 0.2 s | 0.1 to 0.3 s | 0.3 to 0.5 s |
| First contentful paint | 0.8 to 1.0 s | 1.1 to 1.8 s | 2.3 to 2.5 s |
| First panel in the large frame | 1.0 to 1.4 s | 1.5 to 2.2 s | 2.7 to 3.1 s |

The start loads 250 files (130 scripts, the stylesheets and the sample pictures), 1.75 MB. The 1x column of the row changes is six changes, the others forty.

The slowest panels to arrive, at 4x (frames over 34 ms of the frames while the change and the 600 ms after it played):

| Panel | Frames over 34 ms | Slowest |
|-------|-------------------|---------|
| photo | 41 of 342 (12%) | 100 ms |
| competition-timeline | 20 of 189 (11%) | 83 ms |
| sponsor-feature | 32 of 360 (9%) | 67 ms |
| spotlight | 29 of 342 (8%) | 84 ms |
| events | 62 of 1180 (5%) | 100 ms |
| monday-charts | 15 of 681 (2%) | 67 ms |
| monday-department | 45 of 1799 (2%) | 84 ms |
| competition-last-season | 5 of 225 (2%) | 51 ms |
| leadership | 5 of 240 (2%) | 50 ms |

The slow frames are in the panel transition (the first half second, where the page is copied into pieces) and not in the panels: the panels with the most pieces on a page are the slowest, and a quiet panel draws at 60 Hz.

Memory after hundreds of row changes (`leak`, 1x, the garbage collector run before each reading):

| Row changes | JS heap | Page nodes | Listeners | Intervals | Timeouts waiting |
|-------------|---------|---------------|-----------|-----------|------------------|
| 0 (at start) | 4.0 MB | 3938 | 139 | 13 | 13 |
| 60 | 5.2 MB | 3152 | 139 | 13 | 5 |
| 300 | 6.1 MB | 3338 | 139 | 13 | 5 |
| 600 | 6.4 MB | 2676 | 139 | 13 | 4 |

The nodes go up and down with the panel that happens to be on the screen and are not a trend. The timers and listeners do not move. The heap rises while code is first used (4.0 to 6.1 MB in the first 300 changes) and then flattens (6.2 to 6.4 MB from change 360 to 600). A heap snapshot at 2 and at 12 minutes (`tools/perf/heap-diff.mjs`) shows what the rise is: 1.3 MB, of which about 0.9 MB is code the browser compiled as pages were used for the first time, and no page data. 240 edits of the content (a changed tip, as a publish in Studio does) kept 1.4 MB, the same rise.

The screen left alone for 21 minutes (`soak`, the rotation, the small frame and the ticker running by themselves): the heap went from 4.9 MB at 90 s to 6.0 MB at 10 minutes and stayed at 6.0 to 6.3 MB to the end. Nodes 2600 to 3400, listeners 139, intervals 13 and timeouts 4 to 5 throughout. (An early run showed a rise of 4 KB a second. It was the measuring tool's own list of frame times, and the tool now empties it.)

Network (`network`, sample content; the Teletraan computer in production reads Sanity instead of the sample file):

| Request | Rate | Why |
|---------|------|-----|
| POST /control/api/now | 6 a minute, empty answer | the report to the control service on this computer |
| data/live/version.txt | 1 a minute | a new build reloads the page |
| data/sample/content.json | 2 a minute, 53 KB each | the sample is a file; not read in production |
| Sanity full read | 1 every 5 minutes, and 300 ms after a publish | `core/content-source.js` |
| Sanity request fields | 6 a minute, a few hundred bytes | `core/request-poll.js`, so a button press is not missed if the stream is down |
| Sanity change stream | one open connection | reopened after 60 s if it closes |
| Weather | 1 every 15 minutes | `core/weather.js` |
| Calendar files | every 10 minutes | the files on this computer |
| Device file | 1 a minute, only while the screen says Sanity is out of reach | `core/device.js` |
| Photos | at most 1920 px wide (`photoMaxWidth`), asked for again when the panel turns | from Sanity's own address, so its cache headers apply; not measured here |

Nothing polls faster than every 10 seconds and nothing grows with the time the screen has run. Production reads of Sanity were not measured: the sample is used so that no request leaves this computer.

## Where the time goes

The sampling profiler (`profile`) over a quiet 40 seconds and 12 row changes, 1x:

- Script is small: 383 ms in 40 seconds before the change below (1%), 159 ms after. The rest of a frame is style, layout and paint.
- One function took two thirds of the quiet script time: `dateIn` in `core/theme.js` made a new `Intl.DateTimeFormat` on every call, and the screen calls it many times each second (the look, the events, the Screen schedule, the competition cards). 253 ms in 40 s fell to 17 ms.
- The rest is the garbage collector (35 to 58 ms) and the copying of the page for the transition (`cloneNode`, `getComputedStyle`, `getBoundingClientRect`).

The trace at 4x (`trace`, 12 row changes): style recalculation is the largest single item (3.4 s over the run), then script, painting and layer building, and almost all of it is inside the transitions.

- Forced layouts (script asking for a size while the page is dirty) happen only in the transition code: `screenPlace` in `core/hidden-pile.js` (called by `core/swap-run-play.js`, 15 layouts of 4 ms), `startHawk` in `core/swap-run-copy.js`, `copyElement` and `copyStyle` in `core/reform-bake.js` (3 to 4 ms each, once per element copied). In the panels and in the clock, banner and ticker there are none: the countdown measures with a canvas and writes a part only when its value changed, and the banner clock writes once a minute.
- A panel change grows the page about five times for a moment (1400 elements to 7000), and a view change likewise (3200 nodes to 15000 by the browser's own count, which includes text). They go away when the transition ends.
- 34 compositing layers are on screen at rest. Three `glint` sweeps (1144 x 700, 648 x 312, 648 x 364) and the sprites of a subtheme run forever, so the page asks for a new frame 60 times a second even when nothing else moves.

## What was changed

- `dateIn` keeps one formatter for each time zone (`core/theme.js`, tested in `tests/themes.test.mjs`).
- `tools/perf/measure.mjs`, this page, and the motion rule `leaks/rows-do-not-grow-the-page` (`tests/motion/leaks.mjs`), which moves the large panel through 30 rows and fails when timers, listeners, running animations, page elements or the JS heap are higher after 30 than after 6.

Nothing leaked, so no listener, timer or cache needed a repair. Every `setInterval` in the dashboard is started once (13 live at all times), every listener is on the window, the document, the stream or an element that goes with its page, the per-second clock drops the listener of a panel that has left the page, the last content in localStorage is one key that is replaced and not added to, and the maps and lists kept in modules are bounded or are weak maps.

## Findings for the animation lane

Not changed here, because the code is in the transitions.

- `core/reform-bake.js` (`copyElement`, `copyStyle`, `walk`) reads `getComputedStyle` for each element it copies right after writing the copy. Reading all the styles first and writing after would turn a layout for each element into one layout. It is the largest script cost of a panel change.
- `core/hidden-pile.js` `screenPlace` and `findBoxes` force a layout each time the swap or the pile asks for the place of the screen. The place can be read once for the whole swap.
- `core/swap-run-copy.js` `startHawk` forces a layout in the middle of a swap.
- `core/reform-run.js` `watchFrame` asks for an animation frame forever to see how fast the screen is. With the three glints it is not the only reason for 60 frames a second, but it is the only one that does no drawing. It could count the frames only while a transition is about to start.
- Peak page elements in a transition (7000 for a panel, 15000 for a view) are the biggest cost on a slow computer. The first 500 ms of a change is where every frame over 34 ms is.
- The three `glint` sweeps are the only things that move on a quiet screen besides the lamp and the subtheme sprites. If the Teletraan computer cannot keep 60 frames a second, switching Polish to Flat removes the glint (docs/switch-the-look.md).

## The budget

Measured with `tools/perf/measure.mjs` at `--slow 4`. A change that goes over a line is looked at before it is kept.

| What | Budget |
|------|--------|
| Quiet screen | median frame 17 ms, no frame over 100 ms in a minute |
| Row change | 95th percentile frame at most 34 ms, at most 1 frame in 1000 over 100 ms |
| Light transition | at most 40 elements animate, none bigger than its region, and no frame over 34 ms in a panel at `--slow 6` |
| Full transition | at most 400 animated elements in a panel and 500 in a view (`animatedLimit`) |
| Script on a quiet screen | under 2% of one core (under 400 ms in 40 s) |
| Timers | 13 intervals alive and no more; waiting timeouts under 20 |
| Listeners | 139 plus or minus 24 (JS event listeners, `Performance.getMetrics`) |
| Page nodes (browser count) | under 5000 at rest, under 16000 at the top of a view change |
| JS heap | under 1 MB of rise for 100 row changes after the first 300; under 40 MB in all |
| Start | first panel under 3.5 s at `--slow 6`; 250 files and 2 MB or fewer |
| Network | no poll faster than every 10 seconds; Sanity full read at most every 5 minutes |

The motion rules in `tests/motion` check the frame time of the transitions (`reform.mjs`, 34 ms) and, for the leaks, `leaks.mjs`. `tools/perf/measure.mjs` is for finding the cause when one of them fails.

## Transitions: Full and Light

`tools/perf/transitions.mjs` plays the panel and the view transition of each theme twice, with the CPU slowed, and prints the frames, the frames over 34 ms and over 100 ms, the slowest frame, the elements that animate, the elements in the layer and the layouts and style recalculations of the run (`--motion full` or `light`, `--slow 4` or `6`). The numbers are of a laptop with a throttle, as above, and the Teletraan computer was not measured. The frame count is not comparable between rows of a column (a play lasts as long as it lasts, and the preparing of a run is part of it).

Before the work on the freezes (Full, as it was), CPU 4x slower, then 6x:

| Run | Over 34 ms | Over 100 ms | Slowest | Animated | In layer | Layouts |
|-----|-----------|-------------|---------|----------|----------|---------|
| Original panel | 7 / 22 | 0 / 0 | 67 / 67 ms | 387 | 6128 | 43 / 41 |
| Original view | 58 / 70 | 4 / 10 | 117 / 183 ms | 543 | 11449 | 29 / 30 |
| Cybertron panel | 4 / 13 | 0 / 0 | 50 / 68 ms | 228 | 5121 | 19 / 18 |
| Cybertron view | 58 / 63 | 2 / 9 | 101 / 167 ms | 543 | 10525 | 29 / 29 |
| Retro panel | 35 / 54 | 0 / 1 | 51 / 101 ms | 258 | 5984 | 26 / 25 |
| Retro view | 75 / 74 | 8 / 13 | 134 / 200 ms | 558 | 13169 | 31 / 32 |
| Foundry panel | 45 / 37 | 1 / 0 | 118 / 82 ms | 265 | 7464 | 151 / 174 |
| Foundry view | 67 / 70 | 3 / 13 | 116 / 216 ms | 606 | 12765 | 59 / 72 |

After, Full (same machine, same runs):

| Run | Over 34 ms | Over 100 ms | Slowest | Animated | In layer | Layouts |
|-----|-----------|-------------|---------|----------|----------|---------|
| Original panel | 4 / 11 | 0 / 0 | 35 / 52 ms | 387 | 6128 | 46 / 44 |
| Original view | 57 / 52 | 0 / 1 | 85 / 102 ms | 427 | 7149 | 23 / 13 |
| Cybertron panel | 2 / 6 | 0 / 0 | 35 / 50 ms | 228 | 5121 | 19 / 20 |
| Cybertron view | 43 / 53 | 1 / 2 | 101 / 117 ms | 427 | 6837 | 7 / 13 |
| Retro panel | 12 / 12 | 0 / 0 | 35 / 51 ms | 258 | 5984 | 32 / 30 |
| Retro view | 42 / 55 | 0 / 1 | 82 / 165 ms | 442 | 7169 | 9 / 10 |
| Foundry panel | 6 / 17 | 0 / 0 | 35 / 65 ms | 265 | 7780 | 31 / 35 |
| Foundry view | 38 / 53 | 1 / 1 | 100 / 102 ms | 490 | 7445 | 9 / 13 |

After, Light:

| Run | Over 34 ms | Over 100 ms | Slowest | Animated | In layer | Layouts |
|-----|-----------|-------------|---------|----------|----------|---------|
| Original panel | 0 / 0 | 0 / 0 | 19 / 19 ms | 7 | 29 | 23 / 24 |
| Original view | 2 / 2 | 0 / 1 | 35 / 100 ms | 28 | 110 | 14 / 14 |
| Cybertron panel | 0 / 0 | 0 / 0 | 19 / 19 ms | 6 | 19 | 7 / 8 |
| Cybertron view | 5 / 5 | 0 / 1 | 83 / 117 ms | 21 | 67 | 13 / 14 |
| Retro panel | 0 / 0 | 0 / 0 | 19 / 33 ms | 5 | 12 | 14 / 14 |
| Retro view | 1 / 4 | 0 / 0 | 50 / 100 ms | 20 | 42 | 13 / 13 |
| Foundry panel | 0 / 0 | 0 / 0 | 34 / 34 ms | 6 | 33 | 13 / 15 |
| Foundry view | 1 / 3 | 0 / 0 | 35 / 83 ms | 24 | 126 | 12 / 13 |

What the tables say. A Light panel change draws 5 to 7 animated elements and a Light view change 20 to 28, against 228 to 387 and 543 to 606, and the layer is a hundredth of the size. At 6x slower a Light run has no frame over 34 ms in a panel and at most 5 in a view, where a Full view has 52 to 80. A Full run now has fewer elements: the view draws coarser grids and is capped (`animatedLimit`), the Foundry panel lays the page out 31 times and not 151, and the Full runs over 34 ms are fewer (Foundry panel 45 to 6, Retro panel 35 to 12 at 4x). A Full view is still heavy: more than a third of its frames are over 34 ms on a slowed laptop, which is why the Teletraan computer plays Light.

What was changed:

- **Idle drawing.** The three glint sweeps, the sprites of a subtheme, the seasonal pieces, the backgrounds and the gears and pistons of a theme stop while a transition plays (the page has `data-moving`, written by `core/busy.js`) and are not drawn at all in Light (`data-weight="light"`). The rules are in frame.css, base.css, neon-kit.css and seasons/motion.css.
- **The Foundry pistons** moved a shape inside an svg with a CSS transform, which made the browser lay the whole page out on every frame, all day, in the Foundry theme (60 layouts a second on a quiet screen). The rod is an svg of its own now (`core/theme-art.js`), and a quiet Foundry screen lays out a few times a second.
- **The slow screen check** (`core/reform-run.js`) asked for an animation frame forever. It counts 40 frames every 10 seconds now, the first 12 seconds after the start, and a burst that finishes replaces the last. The guard itself (a median frame over 40 ms gives the plain change) is unchanged.
- **Elements.** A view draws about 70 squares and not 130 (`viewGrids` in `core/reform-plan.js`), and a run may not animate more than `animatedLimit` elements (400 for a panel, 500 for a view). tests/motion/reform.mjs fails above it.
- **The place of the screen** (`screenPlace` in `core/hidden-pile.js`) is read once and again after a resize, and not for every swap, hidden transition and pile.
- **Full gives itself up.** Two Full transitions in a row that miss the budget switch the screen to Light until it is loaded again (`core/motion.js`). One line goes to the console.
- **Light** is a transition of its own (docs/transitions.md): two plates and a few parts, nothing copied, nothing cut into squares.

What was looked at and left. `copyElement` and `copyStyle` in `core/reform-bake.js` read a style and a box from the page and write to a copy that is not in the page yet, so they do not force a layout for each element as this page suspected: a whole panel change has 19 to 46 layouts in all, and the first half second is the style work of copying 1400 elements, which is what Light avoids. `startHawk` in `core/swap-run-copy.js` forces one layout of about 4 ms once for each swap, and the swap is only played in Full for a look that is held.

## What is not known

- The Teletraan computer was not measured. Its graphics chip is expected to be far slower than a laptop's at filling large layers (the frame, the glints, the transition pieces), and a CPU slowdown does not slow that. The 4x and 6x columns are the script and layout side only. A real run with `?perf` on the wall is the number that counts.
- The headless browser draws with software, which is why 17 ms frames are not reached during a transition even at 1x.
- Production reads of Sanity, the real size of the dataset's content and the real calendar feeds were not measured. A synthetic calendar of 460 events with 60 repeating ones parsed and expanded in under 30 ms.
- Firefox, if the kiosk runs it, was not measured.
