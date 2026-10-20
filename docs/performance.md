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
| Script on a quiet screen | under 2% of one core (under 400 ms in 40 s) |
| Timers | 13 intervals alive and no more; waiting timeouts under 20 |
| Listeners | 139 plus or minus 24 (JS event listeners, `Performance.getMetrics`) |
| Page nodes (browser count) | under 5000 at rest, under 16000 at the top of a view change |
| JS heap | under 1 MB of rise for 100 row changes after the first 300; under 40 MB in all |
| Start | first panel under 3.5 s at `--slow 6`; 250 files and 2 MB or fewer |
| Network | no poll faster than every 10 seconds; Sanity full read at most every 5 minutes |

The motion rules in `tests/motion` check the frame time of the transitions (`reform.mjs`, 34 ms) and, for the leaks, `leaks.mjs`. `tools/perf/measure.mjs` is for finding the cause when one of them fails.

## What is not known

- The Teletraan computer was not measured. Its graphics chip is expected to be far slower than a laptop's at filling large layers (the frame, the glints, the transition pieces), and a CPU slowdown does not slow that. The 4x and 6x columns are the script and layout side only. A real run with `?perf` on the wall is the number that counts.
- The headless browser draws with software, which is why 17 ms frames are not reached during a transition even at 1x.
- Production reads of Sanity, the real size of the dataset's content and the real calendar feeds were not measured. A synthetic calendar of 460 events with 60 repeating ones parsed and expanded in under 30 ms.
- Firefox, if the kiosk runs it, was not measured.
