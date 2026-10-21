# The panel and view transitions

Two transitions sit beside the older ones (the page change, the swap and the hidden effects, docs/page-transitions.md and docs/hidden-transitions.md). Nothing older is changed.

- **Panel transition** (kind `reform`): the large panel goes to the next row of the same view. Only the main panel comes apart and goes together again.
- **View transition** (kind `reformView`): the view changes. Every panel of the page does the same at once. The side column and the main panel swap sides on the way, the team name, the team plate, the school line and the ticker label turn over to the next team's, and the hawk turns into the other team's hawk.

core/rotation.js says which kind a change is (`transitionKindFor`). core/transition-kinds.js is the list of kinds, and core/swap-run-play.js asks it at each page change of the large panel. A change of look that is not a view change (a theme, a preview, a Monday card) is still the swap in Full motion. Calm motion and no motion draw a plain change, with nothing in 3D. Light motion has its own, simpler run of each kind (see "Full, Light and Calm" below).

What each design board of docs/reference/transitions/ shows, and how the live screen compares, is in docs/transition-reference-guide.md.

## How long it takes

Both run on one skeleton of three seconds. Dashboard Settings, Look tab, has the length (`transitionSeconds`, 2 to 4, default 3). It stretches every time below by length / 3. The Speed setting stretches it again. The seconds of a row in the rotation are the time the panel holds between transitions and are not touched.

| Part | Time in the skeleton |
|------|----------------------|
| Loosen: screws spin out two turns and lift, latches open, braces slide out, rivets pop up from the corners | 0.00 to 0.40 |
| Fold: top and bottom edges, then left and right, fold in on themselves from both ends | 0.40 to 1.05 |
| Turn: the squares turn over in a wave from the top left | 1.10 to 1.90 |
| Unfold: left and right, then top and bottom | 1.95 to 2.60 |
| Tighten: rivets seat, braces slide in, latches shut, screws spin in last | 2.45 to 3.00 |

The numbers are in core/reform-plan.js (`reformTimes`) and nothing else writes them.

## How it is made

1. The old content is copied (core/reform-bake.js). A copy is the same elements with the look written into each one, so it no longer reads the page. This is needed because the old and the new look are on screen together during the turn, and the look (team colors, mirror, layout) is classes of the root element.
2. The copy covers the panel (or the whole stage, in a view transition) and the real page is out of sight. The page changes underneath, and the new content is copied the same way. This all happens before the three seconds start, in turns of a few milliseconds, so no frame is long while it is made (the screen shows the old page meanwhile, which takes about a tenth of a second for a panel and two thirds for a view). A view transition also copies the old frames, which stay until the edges that fold have covered them.
3. The content is cut into squares: 12 by 6 on the main panel, 3 by 8 on the side column, 16 by 1 on the banner and the ticker. Each square holds the old content on its face and the new content on its back, each cut to the square's window, so text splits across squares and joins again exactly. A box that lies wholly outside a window is kept empty, with its size, so what is left lays out as it did.
4. The grid exists only during the turn. A flat copy of the old content covers the squares until the turn starts, and a flat copy of the new content covers them from the moment the last square has seated. At rest there is one plate and no seams.
5. Each edge is two chains of four segments, hinged at knuckle pins. The edges, the screws, latches, braces, rivets, corner gears, pistons and teeth are the kit of the theme (styles/<theme>/transitions.js, `kit`). The Original kit draws them in the metal of the team. Each theme that has its own kit draws its own pieces; one that has none plays the plain kit (core/reform-plain.js), which draws grey plates and straps and nothing else, so no theme ever shows another theme's drawing. They come out of the corners as the transition starts and go back into them at the end (they grow from nothing, because a group that fades is drawn into a surface of its own every frame, which the 2011 computer cannot afford). The banner and the ticker are thin strips: they keep their long edges, the screws, the latches and the rivets of the long edges, and not the pieces that sit inside a frame.
6. There is one camera: `#reform` has the only perspective (1600px, origin 50% 45%). It leans in about 5 degrees down and 3 to the side while the frame is open, drifts to the other side during the turn and settles as the screws go in.

Every part moves by transform or opacity, on one clock: all of them are started with the same start time, so a part that is made late starts part way through and a test that sets the time sets it everywhere. The squares are made while they are hidden and are shown shortly before the turn, a few in a frame, so that no frame has to draw them all at once. The flat copies are the only parts that fade, and each fades for a moment only.

## The Foundry kit

styles/foundry/transitions.js is a kit of its own and borrows nothing from the Original one, and styles/foundry/reform-kit.css draws it. The look is the metal of a fort: dark gunmetal with a lit line on the upper left of every part and a dark one on the lower right, and hazard yellow for the parts that lock. There is no shadow and no blur: the bevel is a line or a gradient. Every piece is Foundry's: hex bolts for the screws, hook latches for the latches, gusset straps for the braces, steel rivets, real cogs for the gears, pistons and ratchet teeth. The straps are gunmetal with a hazard stripe along the inside, whatever the metal of the team is, and the chassis behind the squares is a bulkhead of armor plates with hazard stripes. The squares are steel plates (`plateStops` in core/reform-plan.js): each slides out of its rack along the line it turns on, turns over while it is out and is slammed back in.

The sequence is the one of a fort: the structure unlocks (bolts spin out, deadbolts are drawn back, hooks open, the clamp ring loosens, the rams push out), the bulkhead shutters close and open, the plates slide away and turn while the cogs turn through the change, and then everything locks (the bars are slammed home and settle, the rams draw back, the ring clamps and the bolts drive in).

- Deadbolts: three on the top edge, three on the bottom, two on each side. They pop in, are drawn back along the edge (0.10 to 0.41, the top and bottom one way and the sides the other, so the four edges turn like a pinwheel) before anything folds, wait, and are slammed home at the end (2.48 to 2.65), go on by 3 pixels (the seat) and settle (by 2.72 to 2.85). They are gone by 3.00.
- Hand wheel at the top right of the region: spins open by one and a half turns (to 0.40) and shut again (2.50 to 3.00). A clamp ring round it opens (turns back 70 degrees and swells, to 0.35) and clamps shut with a settle (2.42 to 2.84).
- Rams on the corner diagonals, outside the corners: each is a cylinder that stays and a rod that is pushed out of it by 34 pixels (0.30 to 0.76 out, drawn back 1.95 to 2.62, with a seat of 3 pixels).
- Bulkhead shutters, on the large panel only: two leaves close over the window from its two sides (0.45 to 0.94, a hazard striped lip on the edge where they meet, a seat and a settle at 0.94 to 1.03), a locking bar is driven down across the seam (0.84 to 0.99), and the bar is drawn back and the leaves open (1.06 to 1.45) before the squares are far on. A leaf is a clip (`.reform-leaf`) with the plate that slides in it, so no part is ever drawn outside the window.
- A train of seven cogs in mesh under the large panel (panel transition only): two sizes in turn, each turning the other way from the one before, the small ones faster by the ratio of their teeth, turning through the whole change.
- Two gauges at the bottom corners (panel transition only): the face stays and the needle sweeps across and back while the mechanism runs.
- A jolt of the stage (a few pixels, translate only) when the bolts first break (0.10), when the shutters meet (0.95) and when the bolts lock (2.83).

A thin strip (the banner and the ticker) keeps the deadbolts, the wheel and its ring and has no rams, gauges, shutters or cogs. The view transition draws four regions at once and has room for 500 animated elements, so it leaves out the gauges and the cogs, has two bolts on each long edge of a strip and no ring on the strips and the side column; only the large panel has the shutters and the ring. `partsOf(rect, strip, { mode, main })` says which. The kit uses two optional hooks of core/reform-draw.js: `kit.extras(region, tracks, strip)` gives the element with its parts and their tracks (a part may have an `inner` track for the plate that slides inside it), and `kit.jolt()` returns the stops of a transform that shakes the layers. The deadbolts, the wheel and the rest are not on the Foundry frame at rest (core/theme-art-foundry.js draws the armor, the bolt rows, the brackets, the gears and the pistons), so they appear with the transition. The panel transition has about 282 elements with an animation of their own in Foundry (245 in Original) and the view transition 499 (limit 500).

## The cells

In the panel transition of a kit that asks for it (`lockParts: true`, the Original kit), each square sits in a cell (`.reform-cell`) that also holds one small part: a hinge barrel on the squares of a checkerboard and a lock pin on the others. While the square turns (its `startMs` to 470 ms later, `lockMs` in core/reform-plan.js) the cell slides out from the middle of the window by up to 18 pixels and shrinks a little, so the squares part and the chassis shows in the gaps; the pin draws back and the barrel turns a full turn. Then the cell slides back past its place by 3 pixels, the pin is driven home and the cell settles. The parts end at nothing and every cell ends on its place, so the page at the end is the real page. It is transform only, about 140 more animated elements, on the same clock as everything else.

The view transition and the other kits draw no cells: they lost frames in the motion tests (docs/animation-review.md). A screen whose median frame is over 26 ms, and `?reform=lite`, draw the panel transition without cells. A kit that wants cells gives `draw('pin')` and `draw('barrel')` in its own style and sets `lockParts: true`.

The view transition has coarser grids than the panel (`viewGrids` in core/reform-plan.js: 8 by 4 on the main panel, 3 by 6 on the side column, 10 by 1 on the banner and the ticker), and a run may animate at most `animatedLimit` elements (400 for a panel, 500 for a view). tests/motion/reform.mjs fails above the limit.

## The hawk

The view transition draws the hawk on its own, at the size of the logo on the screen, as the four plates of core/logo.js (`hawkPieces`), each with the colors of the team it was on the front and the colors of the team it becomes on the back. It uses the robot of the logo: the wings swing down into legs and the body and the head lift (0.80 to 1.15), every plate turns over on its own hinge (to 1.45), the robot rides across to the new place of the logo, and stands up as the other hawk (by 2.05). A back face turns on the same point as its plate.

## What it costs

The 2011 computer has to hold 30 frames a second, and it could not be tried here. The panel transition has about 245 elements with an animation of their own (4800 elements in the layer, most of them in the copies), the view transition about 550 (11500 elements in the layer). tests/motion/reform.mjs plays each kind in a headless browser at 1920 x 1080 and prints the frame times and the counts. On the computer that was used, which draws with software, an idle page takes 17 ms a frame, the panel transition 17 ms and no frame over 34 ms, and the view transition 22 ms on average with between one frame in thirty and one in nine over 34 ms. The checks that matter on the Mini are these: `?perf` on the address shows the refresh times while a transition plays, and the 90th percentile should stay under 25 ms.

What costs most is not the number of parts but the size of what is drawn into a surface of its own and the layers drawn on top of each other: the flat copies (a whole page each), the chassis behind the squares, and any part that fades. So the covers fade for a moment only, nothing else fades, the edges and the hardware grow from the corners, the squares are hidden until just before the turn, and the hawk is drawn at its size on the screen. If the Mini is too slow, make the grids smaller in `grids` (core/reform-plan.js), take the hardware list down (`hardwareList`), or set the transition off by choosing calm motion.

A screen that is already drawing slowly (the median of the last sixty frames over 40 ms) gets the plain change, not a transition (`screenIsSlow` in core/reform-run.js).

## Try it

`?reform=off` on the address turns both transitions off for that page, so the older page change and swap play instead. With `?sample=1&clock=fixed` the page has `window.teletraanTest`. `play('reform-panel')` goes to the next row, `play('reform-view')` changes the view.

## The Cybertron kit

The Cybertron theme has a kit of its own (styles/cybertron/transitions.js for the pieces and their moves, styles/cybertron/reform-kit.css for how they look). It runs on the same skeleton and the same times as Original.

| Part | What it does |
|------|--------------|
| Power cores | Sit at the corners in place of the screws. They spin up and swell in loosen, stay large while the frame is open and settle as the frame closes. |
| Brackets | The corner braces retract to nothing in loosen and come back in tighten. |
| Bolts of light | Two short bars run along every edge out from the corners during loosen, and back to the corners during tighten. |
| Conduits | Thin lines charge from each corner to the middle of the edge in loosen and drain in tighten. |
| Scan bar | A neon bar sweeps down the window while the squares turn. It is cut to the window, so it never lies over a neighbor. |
| Squares | Each square collapses to a line of light, flips as a line and opens back out. The shade of the square is the light. |
| Chassis | A neon grid on the dark ground, in the neon of the team (gold for Prime, ice for Nova). |

The latches, rivets, gears, pistons and teeth of the Original kit are left out. All colors are tokens (styles/cybertron/tokens.css and the team tokens), and only transform and opacity move. The panel transition holds about 238 animated elements and the view transition about 538.

### What a kit may add

core/reform-draw.js asks a kit for four things, and each of the last three is optional:

- `draw(role)`: the drawing of a piece of hardware, or the chassis.
- `hardware(item)`: the stops of a piece (a different move), or `null` to leave that piece out.
- `squares(square, move)`: `{ transform, shade }`, the stops of a square and of its shade.
- `extras(region, tracks, strip, behind)`: an element with parts of the kit's own for a region. A part gets its move by `tracks.add(element, 'transform', stops)`, and the stops are in milliseconds of the skeleton.
- `light(width, height, role)`: the parts of the Light transition, described in "Full, Light and Calm" below.

A kit file may not use 3D (tests/house-rules.test.mjs lists the files that may). A kit that wants a turn of squares of its own takes it from a function of core/reform-plan.js, as Foundry does with `plateStops`.

## The Retro kit

Retro runs on the same skeleton and the same times as Original. Only the kit differs (styles/retro/transitions.js and styles/retro/reform-kit.css, colors in styles/retro/tokens.css as --retro-*).

Retro moves like a classic cartoon. Hard surface rules do not apply to it. The vocabulary, in the order a cartoon uses it (times are of the skeleton, in seconds):

- **Anticipation.** The whole stage squashes down a few pixels and then stretches up as the screws pop (0.30 to 0.52). The screws dip small before they pop out (0.07) and rise before they go in (2.45 to 2.66). Each joint winds back 14 degrees before it folds or unfolds. Each square squashes down and leans back before it turns.
- **Squash and stretch.** A square squashes wide (1.16 by 0.80), turns stretched tall (0.80 by 1.22), lands squashed (1.20 by 0.78) and bounces to rest, each bounce smaller than the one before (`squares`). The stage squashes as the squares land (1.83 to 2.04) and as the frame locks (2.64 to 2.88), and jiggles a quarter of a degree on the launch (`jolt`, a few pixels, transform only).
- **Bounce with decreasing overshoot.** A joint swings 28 degrees past its fold, then 8, 7 and 3 and rests. The screws, braces and rivets use the spring ease (`cubic-bezier(.34,1.56,.64,1)`). The star pops 1.3, 0.86, 1.1, 0.97, 1.02 and rests.
- **Poof clouds.** A cloud with a scalloped edge and a hot core pops at each corner of the large panel as the screws come out (0 to 0.5) and again as they go in (2.64 to 3.0). The other regions of a view have two.
- **Jagged starburst.** Fourteen spikes of uneven length, in ink, pop color, the hot color and paper, behind the squares (1.04 to 1.80), wobbling while it holds.
- **Spinning stars.** Four five point stars spin out of the burst and back (1.10 to 1.85).
- **Speed lines and motion streaks.** Speed lines streak from both sides of the frame while the edges fold and unfold. Four streaks race across the panel as the squares turn (1.16 to 1.90). Both are the class `rr-speed`.
- **Curtain wipe.** A band with a scalloped edge pulls back, then sweeps across the panel inside a clip of the size of the panel (1.06 to 1.76).
- **Sparkles.** Six sparkles twinkle around the frame as it locks (2.50 to 2.90).
- The chassis is a halftone, a sheet of dots. The hardware is flat color with a thick ink line, in the accent color of the team. The hot color is `--retro-hot`, the primary color of the team.

The kit hooks it uses: `squares`, `hardware` (own stops for the screws, the spring ease for the rest), `jolt`, `extras` and `light`. The poofs, burst, stars, streaks, curtain and sparkles are the `extras` of the large panel; the burst has to lie behind the squares, so `extras` gets a fourth argument, `behind`, with the chassis element, and the burst is put after it. The joints are changed in the tracks list that `extras` gets (each is changed once). A view draws fewer of them (two stars, two poofs, no streaks, four sparkles on the main panel, two poofs on each other region) to stay inside its budget.

The Retro panel transition has about 273 animated elements (Original about 245) and the view transition about 453 (the limit is 500). Measured at 4 times slower, before and after this change, Retro has the same share of frames over 34 ms inside the noise of the test machine (the panel about 8 to 12 percent, the view 20 to 30 percent); both rules of tests/motion/reform.mjs were already marginal for Retro and still are. Check `?perf` on the Teletraan computer, which plays Light.

## One vocabulary for each theme

A theme plays its own drawing for every transition, and no theme plays the drawing of another. The classes of a kit have its own prefix: `rk-` Original, `ck-` Cybertron, `rr-` Retro, `fk-` Foundry. The stylesheet of a theme (styles/<theme>/reform-kit.css) restyles the engine only with rules that start with `html[data-style="<theme>"]`. dashboard/reform-kit.css is the plain kit and names no theme. A theme with no kit, or one whose file cannot be loaded, plays the plain kit. tests/transition-vocabulary.test.mjs and the rules `vocabulary/...` of tests/motion/light.mjs check all of it. To give a new theme its own transitions, copy styles/foundry/transitions.js and reform-kit.css, give the classes a new prefix, and add the prefix to the tests.

## Full, Light and Calm

The setting Motion (Dashboard Settings, stored as `motion`) has three values. The older stored values full and calm mean what they always did.

| Motion | What the screen does |
|--------|----------------------|
| Full | Every transition of the theme, as above. The sweeps and sprites that run on a quiet screen rest while a transition plays. |
| Light | One simple change at each panel change and view change, a few parts, and the idle sweeps and sprites stand still. No hidden transition (the desktop reveal and the red eyes) plays. |
| Calm | A fade. As before. |

**Light.** core/reform-light.js draws two plates that close over each region from its two sides, changes the page under them and opens them again, in 0.84 seconds at normal speed (420 ms each way, `lightTimes` in core/reform-plan.js, never longer than a Full run of the shortest length). A panel change covers the large panel only. A view change covers the banner, the side column, the main panel and the ticker, each with its own two plates, and the stage is out of sight while the page changes under them. Nothing is copied or cut into squares, no layer is bigger than its region, and at most 40 elements move (a panel 5 to 7, a view 20 to 28). The theme says what the plates and the few parts on them look like: `light(width, height, role)` in the kit gives a list of `{ cls, markup, x, y, w, h, close, open }`, the box of each part in its region and the keyframes it plays while the plates close and while they open (transform and opacity only), and the stylesheet of the theme draws the plates (`.reform-light-plate`).

| Theme | Plates | Parts |
|-------|--------|-------|
| Original | Gold plates in the metal of the team | Four screws that turn in at the corners, a lock pin across the seam |
| Cybertron | Gunmetal with a neon edge | A neon line down the seam, two power cores, a scan bar on the large panel |
| Retro | Two curtains in pop color with ink lines and dots, each with a scalloped edge. They slam shut with a squash and a rebound, and open with a wind-up | A jagged starburst that pops where they meet |
| Foundry | Bulkhead shutters of gunmetal with a hazard striped lip and a row of bolts | Two deadbolts across the seam that seat and settle, a hand wheel on the seam, two cogs in mesh (one cog on a strip) |

In Light there is no swap either: a theme that goes on, a preview or a Monday card changes under the plates of the view transition (`kindToPlay` in core/reform-plan.js, `light`). The slow screen guard (`screenIsSlow`) and `?reform=off` still give the plain change.

**Where the setting is.** Studio, Look, Motion has Motion and Motion on the TV computer. The control page, Display tab, has the same two boxes in a Motion card, and writes the same stored fields to the draft (`motion` and `motionOnKiosk`). The address can say it for one page: `?motion=full`, `?motion=light`, `?motion=calm` or `?motion=none`, and the address wins over everything.

**The Teletraan computer plays Light.** When Motion is Full, the TV computer plays Light unless Motion on the TV computer (`motionOnKiosk`, starting value light) says Full. The page knows it is the TV computer because the kiosk script writes `data/live/device.json` on that computer and nowhere else, and the page reads it once when it starts (`readKiosk` in core/motion.js). A laptop has no such file and plays what Motion says. To try Full on a spare computer, add `?motion=full` to the address of its kiosk, or set Motion on the TV computer to Full while you test and back after. A laptop that opens the address of the TV computer in a browser also finds the file and plays Light, and `?motion=full` on that address plays Full.

**Full gives itself up.** A Full run counts its frames. When two transitions in a row miss the budget (more than a fifth of the frames over 34 ms, or one over 200 ms), the screen writes one line in the console and plays Light until the page is loaded again (`noteRun` in core/motion.js).

The page carries `data-weight="light"` while Light is on (in Full, a screen that gave up has it too) and `data-moving` while any transition holds the screen. frame.css, base.css, neon-kit.css and seasons/motion.css use them: the three glint sweeps, the subtheme sprites, the seasonal pieces, the backgrounds, the gears and the pistons of a theme rest while `data-moving` is on and are drawn still in Light.
