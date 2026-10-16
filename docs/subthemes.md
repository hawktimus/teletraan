# Subthemes

A subtheme is a small layer of pictures drawn over a theme and a view for a few days, such as a season. Three ship with the screen: Halloween, Winter and Kickoff. They draw on the frames, never inside a panel, so they never cover text. An editor can also make a subtheme of their own pictures.

## Turn on a shipped subtheme

There are three ways. The first that applies is used.

1. The address of the screen. `?subtheme=winter` draws Winter, and `?subtheme=none` draws none. Use it to look at one.
2. A rule of the schedule. In Settings, then Look, a rule for a seasonal pack has a Subtheme field: leave it empty for the pack's own, pick Halloween, Winter or Kickoff, or pick None to draw no subtheme while that pack is on.
3. A Subtheme document. Open EVENTS, then Subthemes, click the plus button, pick the subtheme in the Subtheme field, and set the first day and the last day. This is how to run Kickoff in January, with no pack.

When none of them names one, a pack brings its own: the Halloween pack brings Halloween and the Christmas pack brings Winter. The other packs bring none.

## What each one draws

| Subtheme | Pictures |
|----------|----------|
| Halloween | a garland of flags along the top of the banner, two pumpkins on the corner bolt, a web in the corner cut of the main panel that draws itself once, three bats on the ticker |
| Winter | deep snow on the top bar of every frame, icicles under the banner and under the main header, frost in the four corner cuts, a string of bulbs along the bottom of the banner that glow in turn, a drift under the ticker, snow falling in the gap column and the margins, a snowman on the corner bolt |
| Kickoff | a ribbon with a bow on the corner of the banner, confetti along the top of the ticker, two flags and a small gear in the corner by the side column |

The motion is small. The bulbs, the flakes, the bats, the confetti and the flags move. In calm and none motion every picture rests and the web is drawn.

## Element counts

The counts are for one layout of the screen, as the tests measure them. The Mini has to hold 30 frames a second, so a subtheme stays small.

| Subtheme | svg pictures | shapes | shapes that move |
|----------|--------------|--------|------------------|
| Halloween | 4 | 12 | 4 |
| Winter, standard layout | 17 | 38 | 11 |
| Winter, bar layout | 15 | 34 | 11 |
| Kickoff | 3 | 11 | 6 |

## The anchors

Each picture is placed in an anchor, a box worked out from the frames of the layout. The anchors have the same names on every theme (Original, Cybertron, Retro and Foundry) and in both layouts, the standard layout (split) and the bar layout. The sidebar layout has none, so a subtheme draws nothing there.

| Anchor | Where |
|--------|-------|
| `banner-bar-top` | the strip along the top bar of the banner |
| `banner-bar-bottom` | the strip along the bottom bar of the banner |
| `main-bar-top` | the top bar of the main panel |
| `side-bar-top` | the top bar of the countdown (standard layout only) |
| `panel-b-bar-top` | the top bar of the small panel (standard layout only) |
| `ticker-bar-top` | the top bar of the ticker |
| `ticker-bar-bottom` | under the bottom bar of the ticker |
| `main-header-gap` | under the top bar of the main panel, to the right of its title |
| `banner-cut` | the corner the banner cuts at its first corner |
| `corner-bolt` | the bolt at the lower end of the banner, with the margin beside it |
| `corner-cut-main-a` | the first cut of the main panel |
| `corner-cut-main-b` | the second cut of the main panel |
| `corner-cut-aux-a` | the first cut of the countdown (standard layout) or the ticker (bar layout) |
| `corner-cut-aux-b` | the second cut of the countdown or the ticker |
| `gap-column` | the gap between the main panel and the side column |
| `margin-left` | the margin at the left edge of the screen |
| `margin-right` | the margin at the right edge of the screen |
| `side-corner` | the margin beside the side column, at its foot |

A team trim can cut the other two corners of each frame (Nova), so the cuts follow it. In the bar layout Nova puts the side column on the right, so the gap column, the side corner and the bolt move with it. The numbers are in `dashboard/core/anchors.js`, in one table of frames. A frame that moves is changed there and every subtheme follows.

## How it is drawn

`core/subtheme-presets.js` lists the pictures of each subtheme and the anchor each goes in. `core/subtheme-shapes.js` draws them as text, sized to their anchor. `core/subtheme-preset-layer.js` puts them on the page, in one layer after the stage, and draws them again when the theme, the layout, the view or the team trim changes. Each picture is an svg as big as its anchor, so what is past the anchor is cut off.

The colors are the `--subtheme-` tokens in `tokens.css`. The classes that use them are in `subthemes.css`. The motion is in `frame.css`, and only transform, opacity and line drawing move, in full motion only. While the frames fly apart in a swap, the pictures are hidden.

To change a color, change its token. To move a picture, change its anchor in `core/subtheme-presets.js`. To add an anchor, add its box to both layouts in `core/anchors.js` and a line to the table above.

## Make one of your own

Open EVENTS, then Subthemes, and click the plus button.

- Name: for editors only. It does not show on the screen.
- Subtheme on: turn it off to keep it without drawing it.
- Subtheme: leave it empty to use your own pictures, or pick one of the three.
- First day and Last day: both days are included, in the kiosk time zone. Empty means no limit.
- Priority: when two subthemes are live, the higher number is drawn. A tie goes to the older one.
- Pictures: SVG or PNG files, each with a slot, a short lowercase name such as `star`.
- Rules: one row for each place. A row names the theme, the view, the slot, the place, the size (40 to 240) and the motion.

Click Publish all. The screen picks it up within a few seconds.

### The places of your own pictures

| Place | Where |
|-------|-------|
| banner-left | the margin above the left end of the banner |
| banner-right | the margin above the right end of the banner |
| countdown-top | the cut corner above the countdown (standard layout), the margin above the war clock (bar layout) |
| ticker-end | below the right end of the ticker |
| side-bottom | the right margin by the small panel (standard), the gap under the side column (bar) |
| main-corner | the cut corner of the large panel (standard), the gap above the right end of the main panel (bar) |

A place is a box that holds no text. A picture is scaled down to fit its box, so a small box makes a small picture, and it is cut off at the edge of the box. The boxes are in `dashboard/core/anchors.js`. Measure them again when a frame moves, and change the numbers there.

Your own pictures move in one of four ways: none, drift (a sway of 6 pixels over 4 seconds), blink (the opacity goes down and up over 2 seconds) and fall (a descent through the box over 20 seconds that starts again). In calm motion every picture rests.

The tests are in `tests/subthemes.test.mjs` and `tests/subthemes-part5.test.mjs`.
