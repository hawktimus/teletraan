# Seasonal packs

A seasonal pack is a holiday look for the screen. It has two parts:

- **Colours.** A few accent colours laid over whichever theme is showing. These are an
  overlay: one small CSS file in `dashboard/themes/overlays/`.
- **Decorations.** A pack file, one JavaScript file in `dashboard/seasons/`, that holds three
  kinds of picture:
  - a **mark** that takes the place of the double slash at the right of every panel header
    (a pumpkin, a tree, a heart...). See "The header mark"
  - small **pieces over the panels**, such as snow, leaves and confetti, that drift slowly across
    the whole screen. See "The over layer"
  - **decorations in the empty places** along the edges of the screen: strings of lights, holly,
    a scene along the bottom edge

The editors see a pack as one choice, "Seasonal pack", on the Look page in Studio. Under
the hood the colours are called an overlay, and the id of a pack is the id of its overlay. The
ids are stored in Studio, so they never change:

| Id | Name in Studio |
|----|----------------|
| `halloween` | Halloween |
| `thanksgiving` | Thanksgiving |
| `christmas` | Christmas |
| `new-years` | New Year's |
| `valentines-day` | Valentine's Day |
| `competition-day` | Competition Day |
| `summer-break` | Summer Break |

The overlay called `example` is only a placeholder that shows how colours alone are written
(docs/adding-a-holiday-overlay.md). It has no decorations.

The front pieces of a pack are only ever over the empty places, so they never cover text, the logo, the
clock or anything inside a panel. The back pieces are behind everything. The over pieces are the one
exception: they cross the panels, and so cross words, which is why they are small, faint, slow and few.
In calm motion nothing moves, and the over pieces are not drawn at all.

The zones and the back layer were measured on the standard layout of Original. In the sidebar layout
(docs/layouts.md) they are not drawn. In Cybertron the back layer is drawn and the zones are not, because
the bolts and the brackets of its plates are where some zones were measured to be empty
(`styles/cybertron.css`). The header mark and the over layer show in every
layout, and a pack needs nothing extra for that (`decorationLayers` in `core/layout.js`).

A rule can also add a ticker prefix, a banner line and a corner art. See "Extras on a rule".

A pack lies over whatever style and team are on the screen. It changes no layout and no
team setting, and its accent colors come after the team's, so on the theme Hawktimus the
pack's accent wins while the pack is on. docs/switch-the-look.md has the four steps the
editors follow.

## Where decorations can go

The screen is full. Every row is used: the banner, the two columns of panels, and the ticker
along the bottom. There is no empty strip at the bottom: the ticker's line of text runs from y 984 to
y 1052, and its tag, with its edge, to y 1066. What is free is thin: the margins, the gaps between the
panels, the corners the frames cut off, and a strip under the ticker text. These were measured on the
full sample board. Each place is a **zone**, a fixed rectangle of the 1920 x 1080 screen with nothing in it:

    +----------------------------------------------------------------+
    |  top: a string of lights (26 px tall)                          |
    +---+--------------------------------------------------------+---+
    |   | banner: logo, team name, clock, date, school           |   |
    |   | corner-a                          corner-b             |   |
    | l | +--------------------+   +------------------------+    | r |
    | e | | large panel        | g | countdown              |    | i |
    | f | |                    | u +------------------------+    | g |
    | t | |                    | t | small panel            |    | h |
    |   | |                    | t |                        |    | t |
    |   | |                    | e |                        |    |   |
    |   | |                    | r |                        |    |   |
    |   | +--------------------+   +------------------------+    |   |
    |   |      string-a                string-b                  |   |
    |   | [TAG]  ticker text, one line at a time                 |   |
    +---+--------------------------------------------------------+---+
    |  ground: the scene along the bottom edge (26 px tall)          |
    +----------------------------------------------------------------+

(Not to scale.)

Each zone, with its rectangle (x and y are the top left corner, in pixels):

| Zone | x | y | Width | Height | What is around it |
|------|---|---|-------|--------|-------------------|
| `top` | 0 | 0 | 1920 | 26 | the strip above the banner. The banner's text starts at y 28 |
| `ground` | 0 | 1054 | 1920 | 26 | the strip under the ticker. The ticker text is cut off at y 1052. Left of x 270 the ticker tag's edge reaches y 1066, so a scene keeps low there |
| `left` | 0 | 360 | 30 | 690 | the margin left of the large panel, below its top left screw |
| `right` | 1890 | 30 | 30 | 846 | the margin right of the countdown and the small panel, above the small panel's bottom right screw |
| `gutter` | 1198 | 278 | 20 | 342 | the gap between the large panel and the countdown, above the small panel's screw |
| `string-a` | 244 | 970 | 836 | 14 | the gap between the large panel and the ticker, left of the large panel's bottom right screw |
| `string-b` | 1134 | 970 | 654 | 14 | the same gap, between the two bottom screws |
| `corner-a` | 0 | 240 | 96 | 28 | the cut corner at the top left of the large panel |
| `corner-b` | 1198 | 238 | 52 | 34 | the cut corner at the top left of the countdown |

The list is the one at the top of `dashboard/core/season.js`, with a line of comment for each. A
zone is at least 2 pixels clear of the nearest frame, screw or letter. The banner has no zone of
its own: the space right of the TEAM plate is taken by the SAMPLE CONTENT label and moves with the
length of the date.

### How the zones were measured

If you change a panel size, a margin or the ticker (`base.css`, `core/plate.js`), measure again.

1. Open `http://localhost:8080/dashboard/?motion=none&overlay=none` with the sample content showing,
   in a window that is exactly 1920 by 1080.
2. Take a screenshot at that size.
3. For each zone, check that every pixel of its rectangle is the ground colour (`--ground`).
   Any other colour is ink: a letter, an edge, a screw. Shrink the rectangle until none is left,
   then pull it in 2 pixels more.
4. Change the rectangle in `core/season.js`. `node tools/check-seasons.mjs` fails if two zones overlap
   or one leaves the screen.

`tools/zones.html` shows every zone as an outline over the live dashboard, which makes step 3 quick:
open `http://localhost:8080/tools/zones.html`.

## How the layers work

`core/season.js` draws a pack into three layers, and takes them all away when no pack is on:

| Layer | Where in the page | What it is for |
|-------|-------------------|----------------|
| `#season-back` | just before `#backdrop`, so under the stage | as big as the screen. Its pieces drift behind the panels and show in the gaps and margins. It also holds the shapes, drawn once, that every piece points at |
| `#season-front` | just after `#stage` | made of zones. Each zone clips what is inside it, so a piece can never leave its zone and cross text |
| `#season-over` | just after `#season-front` | as big as the screen, over the panels. Its pieces fall, drift or rise across everything, slowly and faintly. It is not drawn in calm or none motion, or when the Look switch is off (see "The over layer") |

A back piece is behind the panels, and also behind the banner and the ticker, which have no plate of
their own, so a faint flake may pass behind a word. It is never in front of one. Keep back pieces faint
and slow, or keep them in the channels where the screen has no text, as Christmas does: the margins, and
the gap between the two columns.

All three let every click through. Everything that takes over the screen is above them: the red
glitch layer, the connection status text, the night screen, an alert, an announcement and the demo.
The hidden transitions: the back layer is under `#backdrop`, so the backdrop covers it, and the
front and over layers fade out as the blocks fly apart, stay out of sight while the screen is apart, and
fade back in as the blocks come home (the end of `dashboard/seasons/motion.css`). The night screen
covers all three, and the pieces are paused while it does.

A pack shows when the screen's look has an overlay with decorations. `core/theme-apply.js` tells
`shell.js` each time the look goes on the page, and `shell.js` asks `core/season.js` for the pack of
that overlay. So a pack appears and goes in the same step as its colours, at the next page change of the
large panel, and `?overlay=<id>` shows it at once. The pack file is read when it is first wanted and kept.

A pack that cannot be loaded, or has a piece with a mistake, never breaks the screen. A pack that
fails to load is logged in the browser console and the screen carries on without its decorations. A piece with a
problem is left out and logged, and the rest are drawn, and so is a mark with a mistake (the slashes stay). A pack
with nothing in it draws nothing, and has no layer.

### Calm and none motion

A pack never animates in calm or none motion. Every motion rule starts with `html[data-motion="full"]`,
so with any other setting each piece rests where its x and y put it. Pick the resting places so the
still picture looks right: it is what calm mode shows. The over layer is the exception to "rests": it is
not drawn at all, because a piece that stopped would sit on a word. The Speed setting
(`--pace`) makes every motion longer or shorter.

### What it costs

The screen is shown by a 2011 Mac Mini with a weak graphics chip. So:

- A pack may have at most **24 pieces that move**, and **60 pieces** in all, counting all three layers.
  The over layer has at most **14** of them. The check fails above that.
- Shapes are drawn once and every piece points at them (`<use>`). A piece is a small `div`, and the
  browser lifts it onto its own layer while it moves.
- Only `transform`, `opacity` and `stroke-dashoffset` (line drawing) are animated. No blur, no glow,
  no shadows, no gradients, no 3D, no video.
- One piece may be wide. A whole string of lights is one piece 1920 pixels wide, so the lights twinkle
  with one element per group and not one per bulb.

## The header mark

Every panel in the large panel has a small picture at the right of its header: two slanted bars, the double
slash (`doubleSlash()` in `dashboard/core/marks.js`). While a pack is on, that picture is the pack's own: a fir
tree, a pumpkin, a heart, a firework burst, a chequered flag, a sun. Every panel that draws the slashes gets
the mark with no change to the panel: Tasks, Events, Up Next, Subteam spotlight, Sponsor feature,
Photos, Leadership, Team Leads, Roster and Extra panels. (An Extra panel also uses the picture, at 28 x 38
pixels, as the bullet of a list block, so the mark is scaled down there.)

Each of the seven packs has a mark. `core/season.js` gives it to `core/marks.js` when the pack goes on and
takes it away when the pack goes, and the slashes come back. A page that is already on the screen keeps the
picture it was built with until its next page, so the change shows within a page or two. A mark is a still
picture, so it shows in calm motion too.

### The size box: 60 x 76 pixels

A mark may be **at most 60 pixels wide and 76 pixels high** (width x height). `markBox` in
`dashboard/core/marks.js` holds the numbers, and `tools/check-seasons.mjs` fails for a mark that is bigger.
They were measured on the large panel's header on the full sample board at 1920 x 1080, with the sample
content showing. Every header of the large panel is the same plate, 116 px high, so one box fits all ten panels:

- **Height.** On the right half of the header the plate colour is free from y 274 to y 367 on the screen: 94 px,
  between the metal edge above and the one below. The slashes are 54 x 72 and sit in the middle (y 282 to 354).
  A 76 px mark leaves 6 px above and 11 px below.
- **Width.** The mark is the last thing in the tag, with the tag's text (LEADERSHIP, TEAM LEADS, the subteam
  name in Roster, the tier in Sponsor feature, the date in Up Next) to its left. The text has to stay
  clear of the notch in the middle of the header, and a mark that is wider would push it towards the notch.
  The free plate colour goes on 27 px past the slashes (to x 1179, where the metal edge begins), so a mark
  may be 6 px wider than the slashes without moving the text: `.pack-mark` in `base.css` has
  `margin-right: -6px`, which lets the extra 6 px hang out to the right over the header's empty right padding.
  The text sits exactly where it sits with the slashes. The widest it could become, with 11 capital letters in
  Roster, already comes close to the notch with the slashes, and the mark does not make that worse.

If you change a header (its height, its padding, the plate), measure again the same way as the zones: take a
screenshot of a header with the slashes hidden, and find the biggest rectangle of plain plate colour round the
middle of the slot.

The mark is not allowed to be bigger than the box: `markProblems()` in `core/season.js` names the problem in
plain words, and `setPackMark()` in `core/marks.js` ignores a mark that is too big, so the screen keeps the slashes.

### The data

A pack has one `mark`, in the same plain svg format as a shape:

    mark: { viewBox: '0 0 60 76', markup: '<polygon points="30,0 60,76 0,76" fill="#2f9e63"/>' },

| Part | What it is |
|------|------------|
| `viewBox` | the size of the drawing, four numbers as in svg, such as `'0 0 60 76'` |
| `markup` | svg shapes as text: `polygon`, `polyline`, `rect`, `path`, `g`. No gradients, patterns, masks, clips, filters, scripts, links or styles. Flat shapes with hard edges, lit side and shaded side, like the logo |
| `width`, `height` | optional, in pixels, both or neither. With neither, the mark is drawn as big as fits the box and keeps the proportions of the `viewBox`. With both, each must fit the box |

Colours: a pack's own colours are written into the shapes with `fill`, so a tree stays green whatever theme is
on. The mark may also follow the accent colour of the pack (`--yellow`, which the overlay's CSS file sets).
Put the shapes that should take the accent colour inside `<g class="double-slash">` and make them
`polygon`s: `base.css` paints every polygon inside that class with `--yellow`, as it does the slashes. The
Christmas tree has a star done that way, so its star is the mint of the Christmas overlay.

Draw the mark in the middle of its `viewBox`, with 2 or 3 px of room all round if it has points, because it
sits close to the metal edges. Make the main shapes bold: it is read from 20 feet, and it is about 2 inches
tall on the screen.

An example, and the Christmas mark (`dashboard/seasons/christmas.js`) built the same way: three tiers, each lit
on the left and in shade on the right, a darker band under each tier, three baubles, a trunk, and a star in
the accent colour.

    const mark = {
      viewBox: '0 0 60 76',
      markup:
        '<polygon points="30,38 30,68 2,68" fill="#43c47c"/>' +
        '<polygon points="30,38 58,68 30,68" fill="#2a9a5e"/>' +
        '<g class="double-slash"><polygon points="30,0 32.2,4.8 37,7 32.2,9.2 30,14 27.8,9.2 23,7 27.8,4.8"/></g>',
    };

A pack with a mark that has a mistake still draws: the mark is left out and logged, and the slashes stay.

## The over layer

The edges of the screen are thin, so a decoration there is small. The over layer is the second way a pack
shows itself: a few small pieces, such as snowflakes, leaves, confetti, hearts, sparks or bubbles, that fall,
drift or rise across the **whole screen, over the panels**. A piece is only over a letter for a moment and
never hides a word, because every piece is:

| Rule | The limit |
|------|-----------|
| small | 18 to 44 px wide |
| faint | an `opacity` of 0.85 or less, which every piece must give |
| slow | a trip across or down takes 12 seconds or more (`fall`, `flutter`, `drift`, `rise`), a swing or a twinkle takes 2 seconds or more (`sway`, `twinkle`) |
| moving | a piece that stays still would sit on a word, so every piece has a motion |
| few | at most 14 pieces, and a finished pack has at least 8. With the other layers a pack still has at most 24 pieces that move |
| on the screen | x and y are screen pixels, and the piece fits the screen at rest |

The numbers are `overRules` in `dashboard/core/season.js`. Only these motions are allowed here: `fall`,
`flutter`, `drift`, `rise`, `sway` and `twinkle`. A piece with any other motion, or one that is too quick, is
refused by the check and left out of the screen, so a slip in a pack cannot put a fast piece over the panels.
(`flutter` was added for this layer: a fall that sways 30 px to each side, for snow, leaves and confetti. The
motions are described under "The motions".) Each of the seven packs has at least 8 over pieces:
`tools/check-seasons.mjs` fails for a pack that has fewer, or more than 14. A list called `stillToDo` at the top of
that file excuses a pack while it is being finished, and is empty once all seven are done.

### The data

A pack has a list called `over`, in the same piece format as `back` (see "The data format"), with `x` and `y`
in screen pixels and no `zone`. For a travelling piece the resting `x` and `y` are the middle of its path: `fall`
and `flutter` go from half of `travel` above `y` to half of `travel` below it, and `drift` goes from half of
`travel` left of `x` to half right of it. The Christmas snowflakes rest at `y` 518 to 529 and have a `travel` of
1300, so they start above the top edge and leave under the bottom edge.

    over: [
      { shape: 'snowflake', x: 235, y: 518, size: 44, opacity: 0.7, motion: 'flutter', seconds: 24, delay: -16.5, travel: 1300 },
      { shape: 'snowflake', x: 70, y: 529, size: 22, opacity: 0.85, motion: 'flutter', seconds: 44, delay: -3.1, travel: 1300 },
    ],

Give the pieces different sizes, speeds and `delay`s, and start them at once: a negative delay starts a piece
part of the way along its round, so the first screen already has pieces at every height. Spreading the
delays by the golden ratio (0.618 of a round further for each piece) does it with no pattern. A bigger piece is
the more faint, and falls faster, as if it were closer.

### How it is drawn

`core/season.js` draws the pieces into `#season-over`, a layer as big as the screen that goes in straight
after `#season-front`, so it is above the stage and under everything that takes over the screen: the red
and blue glitch layers, the connection status text, the night screen, an alert, an announcement and the demo.
It lets every click through and clips what is inside it. A pack with no `over` list gets no layer. The shapes
are the same shapes the other layers use, drawn once in the back layer. During a hidden transition it
behaves like the front layer: it fades out as the blocks fly apart, stays out of sight while the screen is
apart, and fades back in as the blocks come home. The night screen covers it, and its pieces wait while it does.

The layer is **not drawn at all in calm or none motion**, because a piece that stopped would sit on a word
(`season.css`: `.season-over` is `display: none`, and only `html[data-motion="full"]` turns it on). It is
also not drawn when the switch below is off.

### The Studio switch, and how to turn the layer off

On the Look page in Studio there is a switch, **Seasonal pieces over the panels**. It starts on, and a
missing value counts as on. Turn it off to keep only the header marks and the edge decorations. A change shows
within a few seconds, while the screen runs: the layer appears or disappears without a page change.

| Way | What it does |
|-----|--------------|
| the Look page switch | on or off for the real screen, for every pack |
| `?seasonover=off` (or `on`) in the address | the same, for that page only, whatever the Look page says. For trying |
| Calm motion in Dashboard Settings | the layer is not drawn, and nothing else of the pack moves either |
| `?motion=calm` in the address | the same, for that page only |

### Caution: the Mini's speed

The screen is shown by a 2011 Mac Mini with a weak graphics chip. **The Mini's speed has not been tested with
the over layer.** A piece over the panels is composited over a screen that is already busy, with frames that
draw lines and glints. The limits above (at most 14 over pieces, about 24 moving pieces in a pack, transform and
opacity only, a contained layer) are a careful guess. Before a pack goes on the real screen for days, put
it on the Mini with `?perf` and watch "animations running" and the frame rate (docs/try-it-on-the-mini.md). If the
screen stutters, turn the switch off first: the header marks and the edge decorations cost far less.

## The data format

A pack file exports one object called `pack`. Everything in it is plain data.

    export const pack = {
      shapes: {
        flake: { viewBox: '0 0 24 24', markup: '<polygon points="12,0 24,12 12,24 0,12" fill="#f4f7ff"/>' },
        bar: { viewBox: '0 0 100 6', markup: '<polygon points="0,0 100,0 100,6 0,6" fill="#f4c552"/>' },
      },

      scene: { viewBox: '0 -4 1920 26', markup: '<polygon points="0,22 0,16 1920,16 1920,22" fill="#f4f7ff"/>' },

      mark: { viewBox: '0 0 60 76', markup: '<polygon points="30,0 60,76 0,76" fill="#2f9e63"/>' },

      back: [
        { shape: 'flake', x: 1888, y: 420, size: 28, opacity: 0.4, motion: 'fall', seconds: 44, delay: -16, travel: 1500 },
      ],

      over: [
        { shape: 'flake', x: 905, y: 518, size: 44, opacity: 0.7, motion: 'flutter', seconds: 28, delay: -4.5, travel: 1300 },
      ],

      front: [
        { zone: 'left', shape: 'flake', x: 8, y: 110, size: 12, motion: 'fall', seconds: 20, delay: -4, travel: 800 },
        { zone: 'top', shape: 'bar', x: 100, y: 2, size: 60 },
      ],
    };

The parts:

| Part | What it is |
|------|------------|
| `shapes` | pictures, each drawn once. The key is the name. `viewBox` says the size of the drawing (four numbers, as in svg). `markup` is svg shapes as text: `polygon`, `polyline`, `rect`, `path`, `g`. Write the colours into the shapes with `fill` and `stroke`: a pack's colours are its own, so a tree stays green whatever theme is on |
| `scene` | one picture for the strip along the bottom edge. It is drawn in the `ground` zone, which is 1920 by 26, so its `viewBox` must have the same shape. Optional |
| `mark` | the picture that replaces the slashes in every panel header: `{ viewBox, markup }` and an optional `width` and `height`. At most 60 x 76 pixels. See "The header mark". Every pack except the placeholder has one |
| `back` | pieces behind the panels. Their x and y are screen pixels |
| `front` | pieces over the empty places, each in a zone. Their x and y are measured from the top left corner of the zone |
| `over` | pieces that cross the whole screen over the panels, small, faint and slow. Their x and y are screen pixels. 8 to 14 of them. See "The over layer" |
| `defaults` | optional. `{ cornerArt, tickerPrefix, bannerLine }`, the values a rule gets when it leaves its own empty. See "Extras on a rule" |

A piece:

| Field | Needed | What it does |
|-------|--------|--------------|
| `shape` | yes | the name of a shape in `shapes` |
| `x`, `y` | yes | where the top left corner rests, in pixels |
| `size` | yes | how wide it is, in pixels. The height follows from the shape's `viewBox`, so it is never squashed |
| `zone` | front only | the zone it is in. A back or over piece has none |
| `motion` | no | one of the motions below. With none, the piece stays still |
| `seconds` | with a motion | how long one round takes, from 1 to 600 |
| `delay` | no | seconds to wait before the first round. A negative number starts part way in, which keeps the pieces out of step |
| `travel` | no | how far a travelling motion goes, in pixels. Each motion has its own starting value |
| `opacity` | no | from 0 to 1, for a fainter piece |

A piece must fit inside its zone at rest (inside the screen for a back or over piece), or the check fails and the
screen leaves it out. A piece may travel out of its zone while it moves: the zone cuts it off.

A pack is data, so it holds **no keyframes and no animation code**. Writing JavaScript that makes the markup
is fine (`christmas.js` loops to draw its strings of lights and its trees), as long as it only makes text and
nothing in it moves by itself.

### The motions

Every motion is measured from the piece's resting place, the x and y in the pack. The keyframes are all in
`dashboard/seasons/motion.css`, and this list is the one at the top of that file.

| Motion | What it does | `travel` if you give none |
|--------|--------------|---------------------------|
| `fall` | drops, turning a little, fading in at the top and out at the bottom | 1200 px |
| `sway` | swings left and right, up to 8 degrees, about its top edge, like something hanging | |
| `drift` | crosses sideways, fading in at one end and out at the other | 1920 px |
| `rise` | floats up, fading in at the bottom and out at the top | 600 px |
| `twinkle` | fades down to a quarter of its strength and back | |
| `bob` | moves up and down and back | 6 px |
| `spin` | turns once round its middle | |
| `pulse` | swells to 1.2 times its size and back | |
| `draw` | draws its lines, holds, then wipes them away. The lines need `pathLength="1"` and `stroke-dasharray="1"` | |
| `sweep` | makes one quick pass across, then rests out of sight for the rest of the round | 600 px |
| `slide` | comes in from the left, stays, then leaves to the right | 200 px |
| `flutter` | drops like `fall` while swaying 30 px to the left and right, fading in at the top and out at the bottom | 1200 px |

To add a motion, write its keyframes in `motion.css` using only `transform`, `opacity` and `stroke-dashoffset`,
give it a rule in "One rule for each motion", add its name to `motions` in `core/season.js`, and add
its line to the list at the top of `motion.css`. `tools/check-seasons.mjs` fails if any of those is missing.

## Extras on a rule

A rule of a seasonal pack on the Look page can carry three more things besides the pictures of
the pack. Each is optional, and each shows only while that rule's pack is on the screen.

| Field in Studio | Limit | What it does |
|-----------------|-------|--------------|
| Ticker prefix | 12 characters | a word shown before each ticker line |
| Banner line | 40 characters | one short line of 44 px text in the banner |
| Corner art | leaves, snowflakes, gears, fireworks or None | line art in the two cut corners |

A pack file can carry a value of its own for each in `defaults`. It is used when the rule leaves the
field empty, and a value typed on the rule wins. For Corner art, None on the rule means no corner
art even when the pack has its own. Four packs have a corner art of their own and the other three
have none:

| Pack | Its own corner art |
|------|--------------------|
| `christmas` | snowflakes |
| `thanksgiving` | leaves |
| `competition-day` | gears |
| `new-years` | fireworks |
| `halloween`, `valentines-day`, `summer-break` | none |

    export const pack = {
      shapes: shapes,
      mark: mark,
      defaults: { cornerArt: 'snowflakes' },
      ...
    };

`defaults` may also hold `tickerPrefix` and `bannerLine`. No pack has one yet, so a prefix or a line
has to be typed on the rule. `node tools/check-seasons.mjs` names a default that is not allowed.

Where the screen finds them: `ruleExtras()` in `core/theme.js` reads the rule, the first one for the pack
that covers today (when Use a theme now shows a pack on a day no rule covers, the first rule for that
pack), and `packExtras()` adds the pack's `defaults`. Both clean the text: spaces at the ends go, doubled
spaces become one, and a value past its limit is cut off. The pack is the one on the page now, so the extras
come and go with the pack's colours.

While the sample content shows, its theme schedule has two example rules, named
[Winter pack] and [Fall pack], with a ticker prefix, a banner line and a corner art on each
(`dashboard/data/sample/content.json`). Add `?overlay=christmas` to the address to see a
pack at once.

### Ticker prefix

The prefix goes before each line of the ticker, in the accent colour: `HAPPY Bring a water bottle`. It is part
of the line, so the line still has to fit. A tip, a news line or a reminder may have 52 characters
(`studio/schemas/tipOrNews.js`). When the prefix, one space and the line come to more than 52
characters, that line is shown without the prefix and is never cut for it (`prefixFor()` in
`core/pack-extras.js`). A thank-you from a sponsor allows 54 characters, and a line that long never gets a prefix.
The prefix is in the ticker of every layout and every style.

### Banner line

The banner line is one line at 44 px, in the accent colour, cut off with an ellipsis. Nothing is free under the
date for it, so each layout puts it where there is room. The room is worked out from the sizes in the
stylesheets and has not been measured on the screen: keep the line short, and look at it with
`?overlay=<id>` before it goes on the wall.

| Layout | Where the line shows | Characters that show, roughly |
|--------|----------------------|-------------------------------|
| Standard | the bottom row of the banner, in place of the word DASHBOARD and the bar beside it, level with the school | 20 |
| Bar (Minimal) | the side column, under the weather. The TEAM plate, the school and the SAMPLE CONTENT label move down while there is a line (docs/layouts.md, "The side column") | 10 |
| Sidebar (Neon Prime) | nowhere. The strip has no free line of 44 px, and the date is in a slot 500 px wide | none |

The banner draws it (`panels/banner`, `panels/bar-column`) from `packExtras()`, and sets `data-line` on the
panel to `on` or `off`. The panel `side` does not ask for it.

### Corner art

Four ornaments of line art, drawn by hand in `core/corner-art.js`: leaves, snowflakes, gears and fireworks.
Each is a few paths in a 28 by 28 box, with a line 3 px wide, no fill, in the accent colour of the pack.

They go in the two cut corners, the zones `corner-a` (the large panel) and `corner-b` (the countdown). Those are the
only two corners of the frames with room that was measured. The other corners hold screws and text. The places are
`cornerPlaces` in `core/season.js`. The ornament is drawn after the pack's own pieces in the corner, so it lies over
the holly, the bell or the web that is already there.

The corners are zones of the front layer, which only the standard layout of Original draws. The sidebar and
bar layouts, and Cybertron, have no corner zones, so they draw no corner art.

The lines draw in once, in about 3 seconds, when the pack appears, and then hold still. The rule is at the end of
`seasons/motion.css`. It plays the first 35 percent of the `season-draw` keyframes, which end with every line whole, and
stops there. In calm and none motion nothing animates, so the ornament is drawn whole and still.

To add an ornament: add its paths to `ornaments` in `core/corner-art.js` (only `M`, `L`, `A` and `Z`, with a
3 px line kept 1.5 px inside the box), add its id and name to `cornerArts` in `studio/themes.js` before None, and run
`node tools/check-seasons.mjs` and `node studio/check-schemas.mjs`. The check names an ornament that leaves its
box, has a fill or uses an effect.

## How to add a pack

The seven packs already exist, with their colours and an empty pack file for the six that are not
finished. To add an eighth, or to finish one, do these steps in order. The Christmas pack
(`dashboard/seasons/christmas.js`) is the model: copy it and change it.

1. **Colours.** `dashboard/themes/overlays/<id>.css` holds the three accent variables: `--yellow`,
   `--yellow-faint` and `--lilac`. For a new pack, copy `christmas.css` and change the selector to
   `html.overlay-<id>`. A very pale colour is safe on the dark plates. Run `node tools/check-themes.mjs`:
   it tries the colours on every theme and fails if any text is under 7 to 1 contrast.
2. **Registry.** Add the pack to `dashboard/themes/overlays/registry.js` with `decorations: true`:

       {
         id: 'spring',
         name: 'Spring',
         description: 'Pale green accents and spring decorations along the edges.',
         decorations: true,
       },

   The description is one line of up to 120 characters. The id is stored in Studio, so choose it
   once.
3. **Studio's copy.** Add the same entry to `studio/themes.js`. `node studio/check-schemas.mjs` fails if the
   two lists differ, including the `decorations` flag.
4. **The pack file.** Copy `dashboard/seasons/christmas.js` to `dashboard/seasons/<id>.js`, or start from an empty
   pack:

       export const pack = { shapes: {}, scene: null, mark: null, back: [], front: [], over: [] };

5. **Draw the shapes and the mark.** Flat polygons with hard edges, in the faceted style of the logo
   (`core/logo.js`, `core/hidden-art.js`). Use two tones, a lit side and a shaded side, and no
   gradients, glow, blur or shadows. Keep them small: the zones are thin. The **mark** goes in the pack's
   `mark` and must fit 60 x 76 pixels (see "The header mark"); put the shapes that should follow the
   accent colour in `<g class="double-slash">`. The pieces over the panels need a shape too, 18 to 44 px
   when drawn.
6. **Place the pieces.** Put each front piece in a zone, and pick a resting place that looks right when it is still.
   Add motions with `seconds` and `delay`, and give pieces of the same kind different delays. Then
   write the `over` list: 8 to 14 small, faint, slow pieces across the whole screen, each with a motion
   (`fall`, `flutter`, `drift`, `rise`, `sway` or `twinkle`), an `opacity` of 0.85 or less, and a negative
   `delay` so the first screen already has pieces in flight (see "The over layer"). Count the pieces that
   move over all layers: a pack may have at most 24.
7. **Check it.** From the top folder:

       node tools/check-seasons.mjs
       node tools/test-seasons.mjs
       node tools/check-themes.mjs
       node studio/check-schemas.mjs

   `check-seasons.mjs` loads every pack and says in plain words what is wrong: a missing file, a motion or
   zone that does not exist, a piece outside its zone, too many pieces, a forbidden word, a keyframe in the wrong
   place, a pack with no mark, a mark bigger than its box, fewer than 8 or more than 14 over pieces, or an over piece
   that is too big, too solid, too quick or not moving. While you work on a pack, its id may sit in the `stillToDo`
   list at the top of that file, which excuses it from having a mark and over pieces. Take it out when the pack is done.
8. **Look at it** (below).
9. **Put it on the calendar.** Run `npm run deploy` in the `studio` folder so the editors see the pack
   in their list, and add a rule to the Look schedule (below).

## Looking at a pack

Look at the whole screen with the sample content showing, at 1920 by 1080, because that is how it is
read from across the room.

- `http://localhost:8080/dashboard/?overlay=christmas` shows the pack at once. Add `&motion=calm` to see
  it still, and `&motion=full` to see it move. `&theme=alternate` shows it over the other theme.
  `?overlay=none` shows none. The address wins over Studio, for that page only.
  `&seasonover=off` takes away the pieces over the panels and keeps the rest of the pack. Look at the
  header marks on a few panels with `&show=roster`, `&show=leadership`, `&show=tasks` and `&show=events`
  (each shows only that panel, and its header is where the mark is). The over layer is only drawn in full
  motion, so `&motion=calm` shows the pack without it. The mark is drawn into the pages built after the
  pack has loaded, so the first page after the screen starts still has the slashes: wait for the next page
  (30 seconds with `show`).
- `http://localhost:8080/tools/zones.html` shows the zones as outlines over the dashboard.
- On the Look page in Studio, "Use a theme now" with a seasonal pack picked shows it on the real screen
  at once. Set Until, or clear it afterwards.
- "Preview next pack" in the menu next to Publish on Dashboard Settings shows the pack after the one on
  the screen for 2 minutes, and then the Look page comes back, with nothing to clear
  (docs/hidden-transitions.md, "Preview a look").
- `?hidden=desktop` and `?hidden=redEyes` play a hidden transition, to see the front layer fade out and back.
  Add `&night=off` at night.

Look for: text that is hard to read near a piece, a piece that looks cut off, a resting place that looks wrong in
calm motion, a mark that touches the metal edge or the text beside it, over pieces that look like clutter or hide a
word for more than a moment, and how many things move at once (`?perf` shows "animations running").

## Putting a pack on the calendar

The editors decide when a pack shows. No rules are made for you. On the Look page in Studio, open
Schedule, add an item, and fill in:

- **Name.** For the editors only, up to 24 characters.
- **Kind.** Seasonal pack, then pick the pack.
- **Start date** and **End date.** Both are needed, and both days count.
- **Repeats every year.** On: only the month and the day count, so the same days come round every year and
  the year you pick is ignored. A rule may run over New Year: 30 December to 2 January needs this on.
- **Ticker prefix**, **Banner line** and **Corner art.** Optional, and only for a seasonal pack. Leave one empty to
  use the pack's own, if it has one. See "Extras on a rule".

The first rule of each kind that covers today is used, so put the rule that should win first. "Use a theme now"
on the same page wins over the schedule.

These are suggestions, not rules. The editors choose:

| Pack | Suggested dates | Notes |
|------|-----------------|-------|
| Halloween | 24 Oct to 31 Oct | repeat every year |
| Thanksgiving | 18 Nov to 28 Nov | Thanksgiving is the fourth Thursday of November, so its date moves. This window covers every year. Move it each year to match the week |
| Christmas | 14 Dec to 25 Dec | repeat every year |
| New Year's | 30 Dec to 2 Jan | repeat every year, with the start on 30 December and the end on 2 January, any year |
| Valentine's Day | 7 Feb to 14 Feb | repeat every year |
| Competition Day | no suggested dates | type each competition day yourself, one item per competition, with Repeats every year off |
| Summer Break | no suggested dates | type the first and last day of school yourself, with Repeats every year off, because the dates change each year |

## Halloween

The colours are in `halloween.css` and the decorations in `seasons/halloween.js`. A pale pumpkin orange for the
accent and a pale violet for the quiet text; both read at 7 to 1 on every theme (the orange is as dark as it can be
and still keep the 5.5 to 1 that Hawktimus's purple tabs allow). The deeper oranges and purples are in the
decorations, which are not text. It draws, with 23 pieces that move:

- a jack-o'-lantern in place of the slashes in every panel header: five ribs lit on the left and in shade on the right, a
  green stem, and a carved face. Each hole is dark with a lit shape inside it, which is how the candle shows from across the
  room. The lit rib at the far left follows the accent colour (pale orange). 60 x 76 pixels
- twelve pieces over the panels, of five kinds: four bats of different sizes and two poses that glide across the whole screen
  (52 to 72 seconds a trip), two ghosts that rise, two pieces of candy corn and two dry leaves that tumble down, and two
  embers that float up. They are faint (opacity .7 to .85), and the bats are the clearest
- two ghosts rising behind the panels in the margins, and candy corn falling down the margins and the gap between the columns
- a cobweb in each top corner of the screen, and a web in the cut corner of the large panel that draws itself, holds, and wipes away
- spiders on threads from the top edge and from the school name, swinging a little
- orange and violet bunting in the gap above the ticker
- a scene along the bottom edge: jack-o'-lanterns, tombstones, bare trees, iron fences and a haunted house. The carved faces
  and the house windows are lit by two flicker pieces, so the candles do not flicker together

## Thanksgiving

The colours are in `thanksgiving.css` and the decorations in `seasons/thanksgiving.js`. A warm amber for the accent
and a pale tan for the quiet text; both read at 7 to 1 on every theme. Brown is too dark to read as text on these
plates, so the browns are in the decorations. It draws, with 22 pieces that move:

- a turkey in place of the slashes in every panel header: nine tail feathers in reds, oranges, olive and brown fanned out
  behind a round brown body with a pale head, a red wattle and an orange beak. The lit half of the middle feather follows
  the accent colour (amber). 60 x 76 pixels
- twelve pieces over the panels: eleven maple, oak and ginkgo leaves and an acorn, in reds, oranges, golds and browns, that
  tumble and sway down across the whole screen. They take 26 to 46 seconds for a trip, the biggest (44 px) are the faintest
  and the fastest, and each starts at a different height. All the big falling leaves are in this layer
- two big faint leaves falling behind the panels in the margins, and a small leaf falling down each margin and the gap between the columns
- a vine along the top edge with four leaves hanging from it, two of which swing, and a thinner vine in each gap above the ticker with a leaf blowing along it
- a spray of leaves and acorns in the cut corner of the large panel, and a hanging acorn in the cut corner of the countdown
- a harvest scene along the bottom edge: a low line of autumn trees, corn stalks, pumpkins, hay bales, wheat sheaves, two scarecrows and a turkey. It stands still

## Christmas

The finished pack, and the model for the others (`christmas.css`, `seasons/christmas.js`). Pale mint green for
the accent and pale rose for the quiet text; both read at 7 to 1 on every theme. It draws, with 22 pieces that move:

- a fir tree in place of the slashes in every panel header: three tiers lit on the left and in shade on the right, three
  red baubles and a star in the accent colour (mint), 60 x 76 pixels
- twelve snowflakes over the panels, of three sizes (22, 32 and 44 px), that fall and sway across the whole screen.
  They take 24 to 52 seconds for a trip, the big ones are the faintest and the fastest, and each starts at a
  different height. All of the snow is in this layer: none is left behind the panels or in the margins, because a pack
  may only move about 24 pieces and the lights, holly, bell and lamps take ten of them
- a lit string along the top edge, and two thinner ones in the gap above the ticker. The bulbs are in groups that
  twinkle one after another
- holly in the cut corner of the large panel, with a gold star that swells, and a bell that swings in the cut corner of the countdown
- a snowy scene along the bottom edge: hills, trees, wrapped presents, a snowman and two lamp posts whose glass twinkles

## New Year's

`new-years.css`, `seasons/new-years.js`. Pale gold for the accent and cool silver for the quiet text; both read at
7 to 1 on every theme. The fireworks, confetti and skyline have their own colours in the pack file. It draws, with
23 pieces that move, and no text of any kind:

- a firework burst in place of the slashes in every panel header, 60 x 60 pixels: eight long gold rays and eight short
  silver ones round a cream middle with a core in the accent colour (gold), and a small ice blue or rose diamond
  beyond every short ray. Each ray is cut down its middle into a lit side and a shaded side
- ten pieces over the panels that fall, tumble or rise across the whole screen, in gold, silver, ice blue and rose:
  slips of confetti, twisted ribbons, a diamond, two five pointed stars and two balloons on strings. The confetti and
  stars flutter or fall in 26 to 48 seconds, the balloons rise in 46 and 54. Two four pointed sparkles twinkle in the
  margins, where there is no text. All the confetti is in this layer: none falls behind the panels or in the margins,
  because a pack may only move about 24 pieces in all
- fireworks in the margins and over the skyline. Each is a ring of lines that draw outward from a point, hold, and
  wipe away (the `draw` motion). In calm motion they rest fully drawn. The gap between the columns is too narrow for one
- a night skyline along the bottom edge: tall towers, a silver ball on a pole, and lit windows. A third of the
  windows twinkle
- a foil fringe along the top edge, whose strands shimmer in three groups
- bunting in the gap above the ticker
- two party hats and a folded streamer in the cut corner of the large panel, with a gold star that swells, and a
  clock at midnight (marks and two hands, no numbers) in the cut corner of the countdown

## Valentine's Day

`valentines-day.css`, `seasons/valentines-day.js`. Pink for the accent and a soft red for the quiet text; both read at
7 to 1 on every theme. A pink any stronger fails on the team plate, and a true red is too dark to read as text, so
the deep reds are in the decorations. It draws, with 20 pieces that move, and no text:

- a faceted heart with an arrow through it in place of the slashes in every panel header, 60 x 76 pixels: the heart in
  four facets from light pink at the upper left to deep rose at the lower right, a bright facet on the left lobe in the
  accent colour (pink), and a cream arrow with a gold head and pale feathers that goes in at the lower left and comes
  out at the upper right
- ten pieces over the panels that rise across the whole screen: eight faceted hearts of different sizes (24 to 44 px)
  in pink, rose, coral and pale pink, and two pink love letters with a red heart for a seal. A trip takes 22 to 50
  seconds, and the biggest hearts are the faintest and the quickest. Two small hearts twinkle in the margins, where there
  is no text. All the rising hearts are in this layer: none rise behind the panels or in the margins, because a pack
  may only move about 24 pieces in all
- a garland of hearts along the top edge, and small ones in the gap above the ticker
- along the bottom edge: a ribbon with hearts tucked into it, three bows, two hearts that beat and two arrows that
  fly across now and then. An arrow rests in the middle of its path, so calm motion shows it lying along the ribbon
- a heart with an arrow through it, the heart beating, in the cut corner of the large panel, and a bow that swings
  from a ribbon in the cut corner of the countdown

## Competition Day

Race day in the pit lane (`competition-day.css`, `seasons/competition-day.js`). A bright team gold for the accent
and a warm white for the quiet text; both read at 7 to 1 on every theme. The purple of the team stays in the theme, and the
decorations use it for the chequers, in violet and white, so nothing looks like another team's flag. It draws, with 23 pieces
that move (12 over the panels and 11 in the empty places):

- a chequered flag on a gold pole in place of the slashes in every panel header, 60 x 76 pixels: four columns of violet and
  white squares that wave (a column that tilts up catches the light and one that tilts down is in shade), a pole, a ball on
  top and a foot in the accent colour (gold), and a small gold gear at the foot
- twelve pieces over the panels, 22 to 44 px wide, for a finish line celebration in the team colours: three gears (gold, violet
  and white) that fall and turn a little, two small chequered flags on sticks and two torn-off chequer tiles that sway down,
  three strips of confetti (gold, violet and white) that sway down, and two glints (a gold and a white four pointed star)
  that rise like sparks. A trip takes 26 to 46 seconds, and the big gears are the faintest and the quickest. All of the
  confetti is in this layer: none falls behind the panels any more, because a pack may only move about 24 pieces
- pennants along the top edge, with a start light gantry in the middle whose five lights come on one after another (in three
  groups, so the groups are three pieces and not five), and a chequered banner swinging on each side of it
- in each cut corner a gear that turns and a burst of sparks that draw in lines and fade; the large panel's corner also has a wrench
- a chequered strip down each side margin, and a dashed gold pit lane line in the gap between the columns
- two chequered ribbons in the gaps above the ticker. They stand still
- a pit lane along the bottom edge: a chequered kerb (two rows of squares, 6 px high, the length of the screen), tyre stacks,
  cones, tool boxes, flags, light towers and pit robots standing on it, with a race car and a rolling robot that cross it now
  and then, and rest in the middle in calm motion

The ribbons and the two bursts of sparks in the pit lane stand still, so that the pieces over the panels have the moving
budget. The kerb is part of the scene and stays still. The race car and the robot keep low, below the ticker tag's edge.

## Summer Break

A day at the beach (`summer-break.css`, `seasons/summer-break.js`). A bright aqua for the accent and a warm sun cream
for the quiet text; both read at 7 to 1 on every theme. The deeper blues, the coral, the sand and the palm green are
in the decorations. It draws, with 21 pieces that move (12 over the panels and 9 in the empty places):

- a sun rising out of three bands of waves in place of the slashes in every panel header, 60 x 76 pixels: twelve rays in two
  tones round a faceted disc, and three bands of zigzag water in front of it. The first and last band are in the accent
  colour (aqua) and the middle one is a deeper blue
- twelve pieces over the panels, 26 to 44 px wide: six soap bubbles that rise (a ring with a very faint fill, so a word shows
  through it), two beach balls (one drifts across, one falls and turns), two sun sparkles that rise, and two gulls. A bubble
  takes 28 to 48 seconds for a trip. The gulls cross now and then: a gull takes 110 or 150 seconds for a round, and its path is
  much longer than the screen, so it is out of sight for more than half of its round and on the screen for about 50 seconds. All
  of the bubbles are in this layer: none rises behind the panels or up the margins any more, because a pack may only move about
  24 pieces
- a line of small swallow-tailed flags (coral, white, sun and sea colours) along the top edge. They stand still
- two sailboats crossing the gaps above the ticker, on a thin line of water
- in the cut corner of the large panel a palm whose fronds sway and a beach umbrella; in the cut corner of the countdown a
  sun whose rays turn
- a beach ball bobbing in the gap between the columns
- a beach along the bottom edge: three layers of waves that swell up and down out of step, a sandy edge with palms,
  umbrellas, sandcastles, surfboards, towels and crabs

The waves swell (they move up and down a few pixels) and do not slide sideways, because a piece has to rest inside its zone
and the zone cuts off whatever leaves it, so a layer cannot scroll round for ever. The waves are pieces laid under the
beach piece, which is still, so the sand and everything standing on it stay in front. Left of x 270 the waves are kept
below the ticker tag's edge, even at the top of a swell.
