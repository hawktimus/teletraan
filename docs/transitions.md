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
2. The copy covers the panel (or the whole stage, in a view transition) and the real page is out of sight. The page changes underneath, and the new content is copied the same way.
3. The content is cut into squares: 12 by 6 on the main panel, 3 by 8 on the side column, 16 by 1 on the banner and the ticker. Each square holds the old content on its face and the new content on its back, each cut to the square's window, so text splits across squares and joins again exactly. A box that lies wholly outside a window is kept empty, with its size, so what is left lays out as it did.
4. The grid exists only during the turn. A flat copy of the old content covers the squares until the turn starts, and a flat copy of the new content covers them from the moment the last square has seated. At rest there is one plate and no seams.
5. Each edge is two chains of four segments, hinged at knuckle pins. The edges, the screws, latches, braces, rivets, corner gears, pistons and teeth are the kit of the theme (styles/<theme>/transitions.js, `kit`). The Original kit draws them in the metal of the team. Cybertron, Retro and Foundry play the Original kit under their own id until they have their own.
6. There is one camera: `#reform` has the only perspective (1600px, origin 50% 45%). It leans in about 5 degrees down and 3 to the side while the frame is open, drifts to the other side during the turn and settles as the screws go in.

Every part moves by transform or opacity, on one clock: all of them are started with the same start time, so a part that is made late starts part way through and a test that sets the time sets it everywhere.

## The hawk

The view transition draws the hawk on its own, as the four plates of core/logo.js (`hawkPieces`), each with the colors of the team it was on the front and the colors of the team it becomes on the back. It uses the robot of the logo: the wings swing down into legs and the body and the head lift (0.80 to 1.15), every plate turns over on its own hinge (to 1.45), the robot rides across to the new place of the logo, and stands up as the other hawk (by 2.05). A back face turns on the same point as its plate.

## What it costs

The 2011 computer has to hold 30 frames a second. The panel transition has about 240 elements with an animation of their own, the view transition about 650. tests/motion/reform.mjs plays each kind, measures the frames and fails if one is longer than 33 ms; it writes the element counts of the run. The copies are made a few milliseconds at a time, so no frame is long while the transition is being prepared.

## Try it

With `?sample=1&clock=fixed` the page has `window.teletraanTest`. `play('reform-panel')` goes to the next row, `play('reform-view')` changes the view.
