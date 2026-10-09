# Page transitions

This is how the large panel and the small panel change page, how the frame
gets its metal, and how to add a third way of changing. Read
docs/adding-a-panel.md first for what an area is. The ticker has no frame, so
it only ever uses the slat change.

## Two changes

Every time the page in the large or the small panel changes, the frame's area
does one of two changes. The Page change style setting (Dashboard Settings,
Look tab) says which.

- **The slat change.** The screws come undone, the two halves of the frame lift
  a little and pull apart, and the rows and headings of the page (the slats)
  turn edge-on. The next page's slats turn in, the halves drop back and the
  screws turn in. It takes about a second each way.
- **The mechanical change.** The frame breaks into its pieces: the plates, the
  bars of the edge and the two corner brackets. The screws come undone first.
  Each piece pulls back a little, then slides away, turning in 3D, and fades
  out. The page's slats go with them. The new page is put in while everything
  is apart. Then the pieces come back in the same order, plates first, click
  into place with a small overshoot and a settle, and the screws turn in last.
  The default is 0.6 seconds to break and the same again to rebuild, and the
  Break and rebuild time setting changes it (0.3 to 2).

With Page change style on Alternate (the default) each frame takes turns, and
its first change is the mechanical one. The two frames take turns on their own.

Calm motion is a plain fade of the page and nothing turns or slides. Motion off
moves nothing. Both ignore Page change style. The mechanical change only
exists in full motion.

Now and then a hidden transition replaces a page change of the large panel: the
whole screen comes apart and rebuilds, with a blue error screen or a picture of two
red eyes behind it.
It uses the same keyframes (`piece-break` and `piece-build`) as the pieces of the
mechanical change, for five big blocks instead of a frame's pieces. See
docs/hidden-transitions.md.

## The metal

A page frame is gold or silver, and the metal is chosen at every page change,
while the frame is apart. Frame finish says how:

| Frame finish | What the frames do |
|--------------|--------------------|
| Mostly gold (the default) | gold, and silver on about one change in ten, picked at random |
| Alternate | gold, then silver, then gold, and so on |
| Gold only | always gold |
| Silver only | always silver |

Silver chance (percent) is the share of changes that bring silver with Mostly
gold. 10 is one in ten, 0 is never and 100 is every time.

The banner, the countdown and the logo never change. They keep the metal in
Frame metal (Screen tab). So Frame metal is the permanent edges and Frame finish
is the page frames. In the slat change the halves fade out as they lift and back
in as they drop, so the colour changes when they cannot be seen. In calm motion
a change of metal fades the whole panel out and in. Without a change of metal the
frame stays still. The finish decides nothing about the screws, which are
silver on every frame.

Both metals are drawn as static pictures and never animate. Silver is the
weathered, dull silver that Frame metal already offers.

## The screws

The joints of every frame have slotted screws. A screw is drawn once, as one
symbol in `index.html` (`screw-shape`), with a dark slot across the head so that
a turn can be seen, and silver whatever the frame's metal (the `--screw-`
colours in `tokens.css`). In the flat finish (`?finish=flat`) the head is one
plain silver and there is no shadow.

The screws hold still while a page is on screen. When any change starts they
come undone: each head turns several times anticlockwise, grows a little and
fades part of the way. When the change ends they turn back in, clockwise,
tighten with a small extra turn and settle. Both changes use the same two
moves. The slat change turns them 2 full turns over about a third of a second.
The mechanical change turns them one and a half turns, in a third of its break
time, and turns them back in during the last 40 percent of the rebuild. In calm
and none motion the screws stay still. The first time a frame assembles, the
screws turn in the same way.

## How it works

The code is in four places.

- `core/transitions.js` has the two choices, as plain functions that touch no
  page: `chooseStyle(setting, last)` and `chooseFinish(mode, chance, last,
  random)`. The tests are in `tools/test-effects.mjs`. `random` is passed in so
  a test can say which number comes up.
- `frame.js` keeps the settings (`setPageChange`, called from `shell.js`),
  chooses the next change for an area (`planChange(area)`) and starts it
  (`leave(area, change)`). `leave` writes the answer on the area:
  `data-change` is `slat` or `mechanical`, and `data-recolor` is `yes` when the
  metal is about to change. The area keeps the metal in `data-metal`, so
  `planChange` knows what the frame had last.
- `core/areas.js` runs the change: it leaves, swaps in the new page, writes the
  new metal in `data-metal` and arrives. All of that happens between the two
  states, while the frame is apart.
- `frame.css` has the motion, chosen by `data-state` (`xo` leaving, `xi`
  arriving) and `data-change`. `core/plate.js` builds the pieces.

The metal works through `data-metal` on the nearest element that has one.
`tokens.css` sets the `--metal-` colours for `[data-metal="gold"]` and
`[data-metal="silver"]`, so the html element has the permanent metal and each
area has its own, and everything in an area follows the area. Two things are
worth knowing if you change this. A variable made from other variables, such as
`--edge-rim: var(--metal-rim)`, is worked out on the element where it is set, so
those are set on every element that has a `data-metal`. And a gradient takes its
colours from the place it sits in the page, not from the shape that uses it, so
there is one set of edge gradients for each metal. `index.html` draws the gold
ones and `makeSilverGradients()` in `core/plate.js` copies them for silver.

### The pieces

`core/plate.js` lists each frame's pieces next to its shape (`grid1.pieces`,
`grid2.pieces`). A piece is a plate (a polygon and a fill class), or a bar of the
frame (a line, drawn as an edge like the frame itself). Each one is an svg of its
own that is just big enough to hold it, with a `viewBox` that is its part of the
panel. That keeps every point where it is in the whole frame, so the pieces fit
together into the frame at rest, and the metal bands carry on from one to the
next. The large frame has 13 pieces and the small frame 12. The pieces are in the
area from the start but hidden (`display: none`). During a mechanical change they
are shown, and the frame at rest is hidden in their place.

Only the pieces are layers, and only while the change runs: `will-change` is set
on them in the two states of a mechanical change and nowhere else, and the area has
`perspective` only then too. So at rest there are no extra layers. During the
change there is one for each piece (13 or 12 for the large frame and the small
frame), on top of the slats, which turn as they always did.

Edges are cut in a straight run, on a whole number, so neighbouring pieces meet
exactly. Where a corner is turned, the corner is inside one piece.

The rivets of the Original style are in the pieces too. Each bar holds the rivets that
sit on its own line, and each rivet is in one piece only, so the dots fly away and come
back with the frame. The stamped id is not in a piece: it is hidden while the pieces are
shown, like the plates.

The frame of the main panel in the bar layout (Cybertron and Minimal) is cut into 12 pieces
with the names of the large frame's pieces, so the table in `frame.css` moves them. It has no
seam under its header, so it has no `seam-line` or `seam-notch`, and it has one more,
`plate-decor`, which holds the decoration. Its bars carry their neon lines and their
bolts. The ticker of that layout has a frame, and it does not lift or break: its page
change turns the slats only (docs/layouts.md, "Frames"). Minimal's main panel has the same 12
pieces: its rivets and its rust are each in the bar they are on, so they go with it, and its
weld seam and the line with ticks are in `plate-decor`. The bar layout never changes the
metal of a frame, because the steel is the metal of both of its styles.

To change where a piece goes, edit its line in the table in `frame.css`
(`[data-piece="name"]`). `--tx`, `--ty` and `--tz` are how far it moves, `--rx`,
`--ry` and `--rz` are how far it turns about each axis, and `--hold` is how late it
starts, from 0 to .3 of the break time. The small frame moves 0.6 times as far.
`tools/test-effects.mjs` checks that every piece has a line there and that the
whole change fits inside the break time.

## Adding a third change

1. Pick a name, for example `fold`, and add it to `pageChangeStyles` in
   `dashboard/config.js`. Add it to the list in
   `studio/schemas/settingsTransitions.js` with a title, and to the `choices` and
   `checkTransitionsTab` tables in `studio/check-schemas.mjs`.
2. Teach `chooseStyle` in `core/transitions.js` about it. Alternate takes turns
   between two. For three, make it step through a list, and change the tests in
   `tools/test-effects.mjs` to match.
3. Give it a time in `leaveMs()` in `frame.js` if it is not a second. Everything
   it waits for is in `leave` and `arrive`.
4. Write the motion in `frame.css` under `[data-motion="full"]
   .area[data-change="fold"]`, for `[data-state="xo"]` and `[data-state="xi"]`.
   Move only transform and opacity. Write every time as `calc(<seconds> *
   var(--pace))`, so the Speed setting stretches it. Set the screw times
   (`--unscrew-time`, `--screw-in-delay`, `--screw-in-time`) if the screws should
   not follow the slat change. Hide whatever your change replaces with
   `display: none`, as the mechanical change does with the frame at rest, so it
   holds no layer.
5. Add its words to `docs/editing-content.md` and this page.

Keep calm and none motion working: the rules are all under
`[data-motion="full"]`, and calm and none have no rules for your change. Use
`?change=fold` to try it.

## Trying it

- `?change=slat`, `?change=mechanical` or `?change=alternate` picks the change
  for this page, whatever Dashboard Settings says.
- `?frames=gold`, `silver`, `alternate` or `mostly-gold` picks the finish for the
  page frames.
- `?stress` changes the pages every few seconds, which is the quickest way to see
  a change over and over. Add `&glint=off` to keep the glint out of the way.
- `?finish=flat` keeps working: every edge is one plain stroke and the screws are
  one plain silver. `?motion=calm` and `?motion=none` have no breaking, turning
  or screws.

Measure on the Mini. The mechanical change paints the pieces when it starts and
the frame at rest again when it ends, which the slat change does not do, and it
promotes about a dozen layers while it runs. If that is too much, use Slat change
only. If the pieces still stutter on the Mini, `?finish=flat` costs less
(docs/try-it-on-the-mini.md).
