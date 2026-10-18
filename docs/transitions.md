# The panel and view transitions

Two transitions sit beside the older ones (the page change, the swap and the hidden effects, docs/page-transitions.md and docs/hidden-transitions.md). Nothing older is changed.

- **Panel transition** (kind `reform`): the large panel goes to the next row of the same view. Only the main panel comes apart and goes together again.
- **View transition** (kind `reformView`): the view changes. Every panel of the page does the same at once. The side column and the main panel swap sides on the way, the team name, the team plate, the school line and the ticker label turn over to the next team's, and the hawk turns into the other team's hawk.

core/rotation.js says which kind a change is (`transitionKindFor`). core/transition-kinds.js is the list of kinds, and core/swap-run-play.js asks it at each page change of the large panel. A change of look that is not a view change (a theme, a preview, a Monday card) is still the swap. Calm motion and no motion draw a plain change, with nothing in 3D.

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
5. Each edge is two chains of four segments, hinged at knuckle pins. The edges, the screws, latches, braces, rivets, corner gears, pistons and teeth are the kit of the theme (styles/<theme>/transitions.js, `kit`). The Original kit draws them in the metal of the team. Cybertron and Retro play the Original kit under their own id until they have their own. Foundry has its own (the Foundry section below). They come out of the corners as the transition starts and go back into them at the end (they grow from nothing, because a group that fades is drawn into a surface of its own every frame, which the 2011 computer cannot afford). The banner and the ticker are thin strips: they keep their long edges, the screws, the latches and the rivets of the long edges, and not the pieces that sit inside a frame.
6. There is one camera: `#reform` has the only perspective (1600px, origin 50% 45%). It leans in about 5 degrees down and 3 to the side while the frame is open, drifts to the other side during the turn and settles as the screws go in.

Every part moves by transform or opacity, on one clock: all of them are started with the same start time, so a part that is made late starts part way through and a test that sets the time sets it everywhere. The squares are made while they are hidden and are shown shortly before the turn, a few in a frame, so that no frame has to draw them all at once. The flat copies are the only parts that fade, and each fades for a moment only.

## The Foundry kit

styles/foundry/transitions.js is the Original kit with pieces added to every region, and styles/foundry/reform-kit.css draws them. The straps are blued steel with a hazard stripe, whatever the metal of the team is, and the chassis behind the squares is a steel floor with hazard stripes.

- Deadbolts: three on the top edge, three on the bottom, two on each side. They pop in, are drawn back along the edge (0.10 to 0.41, the top and bottom one way and the sides the other, so the four edges turn like a pinwheel) before anything folds, wait, and are slammed home at the end (2.48 to 2.83). They are gone by 3.00.
- Hand wheel at the top right of the region: spins open by one and a half turns (to 0.40) and shut again (2.50 to 3.00).
- Rams on the corner diagonals, outside the corners: the rods push out 26 pixels while the frame is open (0.30 to 1.06 out, back by 2.61).
- Two gauges at the bottom corners: the face stays and the needle sweeps across and back while the mechanism runs.
- A jolt of the stage (a few pixels, translate only) when the bolts first break (0.10) and again when they lock (2.83).

A thin strip (the banner and the ticker) keeps the deadbolts and the wheel and has no rams or gauges. The kit asks for no new thing of the engine except two optional hooks in core/reform-draw.js: `kit.extras(rect, strip)` returns more pieces of hardware in the shape of `hardwareList` (a piece with `own` set has its own stops from nothing to nothing and is not grown), and `kit.jolt()` returns the stops of a transform that shakes the layers. The deadbolts and the wheel are not on the Foundry frame at rest (core/theme-art.js draws a bolt flange, gears and pistons), so they appear with the transition. The panel transition has about 265 elements with an animation of their own in Foundry (245 in Original) and the view transition about 606 (545).

## The hawk

The view transition draws the hawk on its own, at the size of the logo on the screen, as the four plates of core/logo.js (`hawkPieces`), each with the colors of the team it was on the front and the colors of the team it becomes on the back. It uses the robot of the logo: the wings swing down into legs and the body and the head lift (0.80 to 1.15), every plate turns over on its own hinge (to 1.45), the robot rides across to the new place of the logo, and stands up as the other hawk (by 2.05). A back face turns on the same point as its plate.

## What it costs

The 2011 computer has to hold 30 frames a second, and it could not be tried here. The panel transition has about 245 elements with an animation of their own (4800 elements in the layer, most of them in the copies), the view transition about 550 (11500 elements in the layer). tests/motion/reform.mjs plays each kind in a headless browser at 1920 x 1080 and prints the frame times and the counts. On the computer that was used, which draws with software, an idle page takes 17 ms a frame, the panel transition 17 ms and no frame over 34 ms, and the view transition 22 ms on average with between one frame in thirty and one in nine over 34 ms. The checks that matter on the Mini are these: `?perf` on the address shows the refresh times while a transition plays, and the 90th percentile should stay under 25 ms.

What costs most is not the number of parts but the size of what is drawn into a surface of its own and the layers drawn on top of each other: the flat copies (a whole page each), the chassis behind the squares, and any part that fades. So the covers fade for a moment only, nothing else fades, the edges and the hardware grow from the corners, the squares are hidden until just before the turn, and the hawk is drawn at its size on the screen. If the Mini is too slow, make the grids smaller in `grids` (core/reform-plan.js), take the hardware list down (`hardwareList`), or set the transition off by choosing calm motion.

A screen that is already drawing slowly (the median of the last sixty frames over 40 ms) gets the plain change, not a transition (`screenIsSlow` in core/reform-run.js).

## Try it

`?reform=off` on the address turns both transitions off for that page, so the older page change and swap play instead. With `?sample=1&clock=fixed` the page has `window.teletraanTest`. `play('reform-panel')` goes to the next row, `play('reform-view')` changes the view.
