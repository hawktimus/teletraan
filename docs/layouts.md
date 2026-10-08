# Layouts

A layout is where the regions of the screen sit. A theme (docs/adding-a-theme.md)
may name one. There are two:

- **standard**: the banner across the top, the large frame (Grid 1) on the left,
  the countdown and the small frame (Grid 2) on the right, and the ticker across
  the bottom. Every theme has it unless it says otherwise.
- **sidebar**: a strip across the top with the team name on one line and the
  clock at its right end, under it a column on the left and one large frame on the
  right, and the ticker across the whole bottom, as in the standard layout. There is
  no small frame. The theme Neon Prime has it.

The code is `dashboard/core/layout.js` (the numbers and the rules, with no page
in it), `dashboard/core/layout-apply.js` (puts the layout on the page) and
`dashboard/layouts/sidebar.css` (the placing). `node tools/test-layouts.mjs`
checks them.

## How a layout is chosen

The theme registry (`dashboard/themes/registry.js`) says which layout a theme
has. `layout: 'sidebar'` on a line gives it the sidebar layout. A line with no
layout has the standard one. The Studio's copy of the list (`studio/themes.js`)
says the same, and `node studio/check-schemas.mjs` fails if the two differ.

The layout is set before anything is drawn, so that a screen that starts with
Neon Prime chosen starts straight in the sidebar layout. `shell.js` does it as
its first step. It reads the Theme document in the copy of the content saved on
this computer (the same copy the screen uses when Sanity cannot be reached), works
out the theme as `theme-apply.js` will, and sets `data-layout` on the html
element. `?theme=neon-prime` in the address wins, like it does for colours. When
there is nothing saved yet, or the saved copy cannot be read, the screen starts
in the standard layout. While the screen shows the sample content there is no saved
copy to read (the sample is a file), so a sample whose theme has the sidebar layout
reloads once and then stays in the standard layout with the new colours. Use
`?theme=` to look at a layout with the sample.

When the theme that should be on screen has another layout than the page, for
example an editor switches the theme in Studio, colours alone cannot do it,
because the regions are drawn for one layout. The page **reloads once**, in the
moment the new theme would have gone on (at the next page change of the large
frame, or at once at start). Before it reloads it writes the layout it is
reloading for in `sessionStorage`, and a page that finds the same layout written
down does not reload again, so a screen can never reload in a loop. The note is
rubbed out as soon as the page is in the layout wanted. If the browser's storage
does not work, the page does not reload at all and the colours go on in the old
layout. It also does not reload while an alert or an announcement has the screen,
and tries again at the next page change and once a minute. Changing between two
themes that have the same layout is only colours and does not reload.

## The sidebar layout

All lengths are pixels of the 1920 x 1080 screen. They are written once, in
`dashboard/core/layout.js` (`sidebarSettings`), and `layout-apply.js` hands them
to `layouts/sidebar.css` as variables on the html element. To change a size,
change it there and run the tests.

| Part | x | y | width | height |
|------|---|---|-------|--------|
| Strip | 40 | 24 | 1840 | 144 |
| Clock slot (in the strip) | 1348 | 24 | 500 | 144 |
| Sidebar | 40 | 188 | 384 | 776 |
| Pane space | 456 | 188 | 1424 | 776 |
| Pane | 571 | 207 | 1188.7 | 730.6 |
| Ticker | 40 | 984 | 1840 | 72 |

The picture is to scale, one character across is 20 px and one line down is 45:

```
x 0        40       424  456                                          1880 1920
y 0  +--------------------------------------------------------------------+
     |                          margin 24                                 |
  24 |   +------------------------------------------------------------+   |
     |   | STRIP 1840 x 144                                           |   |
     |   | HAWKTIMUS PRIME, one line, 120 px      |CLOCK, DATE, WEATHER|   |
 168 |   +------------------------------------------------------------+   |
     |         row gap 20                                                 |
 188 |   +--------+      +---------------------------------------------+  |
     |   |SIDEBAR |      | PANE SPACE 1424 x 776                       |  |
     |   |384 x   |  32  |   +-------------------------------------+   |  |
     |   |776     | gap  |   | PANE: the large frame, scaled 1.0319|   |  |
     |   |        |      |   | 1188.7 x 730.6 at 571, 207          |   |  |
     |   |        |      |   +-------------------------------------+   |  |
 964 |   +--------+      +---------------------------------------------+  |
     |         row gap 20                                                 |
 984 |   +------------------------------------------------------------+   |
     |   | TICKER 1840 x 72: the tag, then the message on one line    |   |
1056 |   +------------------------------------------------------------+   |
     |                          margin 24                                 |
1080 +--------------------------------------------------------------------+
```

The margins are the same as the standard layout: 24 at the top and bottom and
40 at the sides. There are 20 between the strip and the row under it and between
that row and the ticker, and 32 between the sidebar and the pane space, as the
standard layout has between its rows and its columns.

**The strip** runs the whole width between the margins and holds the team name on
one line, HAWKTIMUS PRIME at 120 px, the size of a heading and as large as the
strip allows, and at its right end the clock, the date and the weather. The name
is 1231 px wide at that size in the display font (985 at 96, 1149 at 112, 1231 at
120 and 1313 at 128, measured in a real render). The clock has a slot 500 wide at
the right end (`stripClockWidth` in `layout.js`, the Clock slot row above), so the
name has 1260 px, 16 short of the clock's slot, with 29 px to spare. A name too
long for its slot squeezes its letters together, as the banner's name does: the
Studio allows 16 characters, which is about 1300 px at 120 px, so a name of the
most the Studio allows is squeezed by a few percent and still on one line. The
strip is 144 high: the line of the name is as high as its size, 120, with 12 px
above and below it, and the clock is the time at 96 px over the date and the
weather at 44 (84 + 48 = 132 high, 6 from the top). Every pixel taken from the
strip is a pixel less for the sidebar and for the pane, so the height is not more
than the name and the clock need. The clock is in the strip and not in the column
because the column is not high enough for it (see "The vertical budget"). `index.html` has the strip
(`#region-strip`) and two slots in it, `#strip-name` for the name and
`#strip-clock` for the clock, hidden while the standard layout is on. The side panel
draws the name, the clock and the weather and moves them into the slots
(`placeInStrip` in `panels/side/side.js`), because the panel is only drawn when it
is needed and the strip is a block of its own for the hidden transitions, so the
clock flies away with the strip. Nothing else is in the strip, except what the
theme draws as its look: Neon Prime draws a thin steel frame with two cut corners,
a box of the strip's own size that stays inside it (the decor file,
docs/adding-a-theme.md, "The decoration"). The name and the
clock have no entrance of their own: they are on the screen from the start. The
name effect (`core/name.js`, `frame.js`) finds the name by `data-name-effect`,
wherever it is.

**The sidebar** is 384 wide, 20 percent of the screen. The layout allows 15 to 20
percent (288 to 384), and 384 is the narrowest of the widths 288, 320, 352 and 384
in which every part fits at 44 px or more (see "Why 384" below). It is
`sidebarWidth` in `layout.js`, one number that the tests read. A narrower sidebar
would give the pane room to move and no bigger scale, because the height of the
row, and not its width, limits the pane (below). It is as high as the room between
the strip and the ticker, 776, and that is all the height there is to share between
the parts. From top to bottom it holds the countdown (kickoff or rollout), then the
logo with the SAMPLE CONTENT label beside it, the TEAM plate and the school.
Everything in it is 44 px or more.

`index.html` has the column and its three slots, and `layout-apply.js` fills
them when the sidebar layout is on:

| Slot | What goes in it |
|------|-----------------|
| `#region-sidebar` | the whole column. It is hidden in the standard layout |
| `#sidebar-top` | `#region-banner` is moved here, and the side panel is drawn into it. The panel is the whole column: the countdown, the logo, the TEAM plate and the school. Its team name, clock, date and weather are moved up into the strip |
| `#sidebar-countdown` | `#region-countdown` is moved here. Nothing is drawn in it, because the countdown is part of the side panel |
| `#sidebar-bottom` | nothing is drawn in it either |

The banner and the countdown panels are drawn for the standard layout, and do
not fit a column 384 wide, so the sidebar layout does not draw them. It draws
one panel, `side` (`dashboard/panels/side`), in the banner's region, and
`registry.js` says so (`fixedPanels`). See "The sidebar", next.

**The pane** is the large frame (Grid 1). Its panels are written for a frame
1152 wide and 708 high and are not redrawn. The frame is **scaled**: one CSS
transform, `scale(1.0319)` from its top left corner, the same across and down, so
text grows with it and never shrinks. What has to fit the pane space is the frame
with its screws, which reach 18 px past its left and top, 23 past the right and 25
past the bottom (measured in a real render of the standard layout), so the layout
fits a frame of 1193 by 751 at scale 1 to the space, with a pixel to spare in each
direction, so that putting the pane on a whole pixel can never push the frame out.
1.0319 is the biggest scale that does it, cut to four decimals so that rounding
can never make it too big. It is the height of the space that limits it
(775 / 751): the frame is 1231 wide in a space 1424 wide. The frame is then
centred in the space, so there are 96 px of space at each side of it and the screws
are never closer than the gaps to the strip, the sidebar and the ticker, which
the tests check.

The area is what is scaled, and not `#region-grid1`, because the hidden
transitions move the region with a transform of their own and would drop a scale
set on it.

**The ticker** runs along the whole bottom of the screen, under the sidebar and
the pane, and is the standard layout's ticker: 1840 by 72 (`.area[data-area="ticker"]`
in `base.css`), with the same tag on the left and the message on one line, cut
with an ellipsis when it is too long, swapped in place one item at a time.
`layouts/sidebar.css` only places it. The connection status text is capped to
the same width by the standard rule in `base.css`, and sits level with the
ticker's bottom, as it does in the standard layout.

**No small frame.** The sidebar layout never makes Grid 2 (`#region-grid2` is
empty and out of the way), and the scheduler leaves out every panel whose region
is `grid2` in `dashboard/registry.js`: the task counts, safety days, next event,
sponsor logo and forecast panels. The Large panels list in Dashboard Settings is
the rotation of the pane. The Small panels list is not used while a sidebar theme
is on. The countdown is not a small panel: it lives in the sidebar. Grid 1 and
Grid 2 never show the same topic, so with no Grid 2 the pane may show any topic.
`?show=` with a small panel shows nothing in this layout.

## The sidebar

The column on the left is one panel, `side`: `dashboard/panels/side/side.js` and
`side.css`. In the standard layout the banner and the countdown stay on the
screen the whole time. In the sidebar layout this panel is what stays, and it
holds everything they hold, except the wordmark. `registry.js` lists it with
`layout: 'sidebar'`, and `fixedPanels(layout)` in the same file says which panels
`shell.js` draws: the panels with that layout when there are any, and otherwise the
banner and the countdown. It is drawn into `#region-banner`, which `layout-apply.js`
moved into the column.

In the column, from top to bottom, it has the countdown, then the logo (with the
SAMPLE CONTENT label at its right while the sample content is on), the TEAM plate
and the school. The team name, the clock with the date, and the weather are part of
the panel too, but they are drawn in the strip across the top of the screen (see
"The strip" above). The Teletraan I wordmark is left out: it is a picture of
letters 44 px high, which makes it 385.4 px wide, wider than the column, and
making it narrower would make its letters smaller than 44 px.

### Why the clock is in the strip

The clock, the date and the weather are at the right end of the top strip, and
the rest stays in the column, because the column cannot hold all of it. The column
is 776 high. These are the heights of the parts at 44 px or more, measured in a
real render:

| Part | Height |
|------|--------|
| the clock, the date and the weather in the column (the time 84 at 96 px, the date 48, the weather 48, one under the other, because the date at its widest is 288 and the weather 186 and together they are wider than the 384 column) | 180 |
| the countdown (the label and the date, the days at 184 px, the DAYS row, the hours, minutes and seconds with their units, the rail) | 408 |
| the logo (90), the TEAM plate (76) and the school in up to three lines (138), with 14 and 10 between them, from 4 down to 332 | 332 |
| the gaps between them (8 under the clock, 24 above the logo) | 32 |
| **together** | **952** |

952 is 176 more than 776. Even with the smallest each part can be, the time at 64
px (a body size, so 64 + 44 + 44 = 152 for the clock), the days at 132 px (344 for
the countdown) and no gap anywhere (304 for the logo, plate and school), it is 800,
24 more than the column has. So the clock, the date and the weather are at the
right end of the strip, where the room is: the strip's right end was free, 545 px
wide and 144 high, and the clock takes 500 of it. Without them the column is 764
of its 776, 12 px to spare.

### Why 384

The widths 288, 320, 352 and 384 were tried in turn with the real parts and their
worst case text: the time 10:59 with PM, the date MON MAR 29, 104°F, the label
ROLLOUT IN with MAR 29, 399 days, 49 for the hours, minutes and seconds, TEAM
32290, and HOLLY SPRINGS HIGH SCHOOL (which takes three lines). These are the
widths in px (the display font, measured in a real render), and what each part needs
with the offsets side.css gives it:

| Part | Its text | Needs |
|------|----------|-------|
| the label, 16 from each side | ROLLOUT IN, 277 | 309 |
| DAYS, the bars and the lamp, and the date, 16 from each side | DAYS 118, MAR 29 177 | 238 |
| the days and the two chevrons (44 at each side) | 399 at 132 px, 285 | 373 |
| HRS, MIN and SEC in three columns with 8 between them | HRS, 95 | 341 |
| the TEAM plate, its words 8 short of the plate's cut corner | TEAM 32290, 298 | 364 |
| the school in three lines | HIGH SCHOOL, 311 | 343 |
| the logo (112, 14 in) and the SAMPLE CONTENT label (230) | | 368 |
| the wordmark at 44 px high | | 385 |

The widest need is the three digit day count with its chevrons, 373. So 288 and
320 fail on four or more parts, and 352 fails on three: the days (373 against 352),
the plate (364) and the logo with the label (368). 384 is the narrowest of the four
widths that holds all of them, with 11 px to spare at the days, and the wordmark
fits none of them. A narrower column could not be used to give the pane more room
either: the pane is limited by the height of the row, not by its width.

### The vertical budget

The panel is 384 wide and 776 high, the whole of the column. Every part is placed
by hand, with the top it starts at, counted from the top of the column, and the
height it has. Nothing is moved by what is in another part, so a long school name or
a three digit day count cannot push anything. The parts inside the brand count from
the top of the brand, and the parts of the countdown from the top of the countdown.
`side.css` has the same numbers, and `node tools/test-layouts.mjs` fails if the two
differ.

**In the strip**, at its right end, in the slot `#strip-clock` (the Clock slot row
above: 500 wide and as high as the strip, 144). Tops are counted from the top of the
strip:

| Part | Top | Height | Left | Width | What it holds |
|------|-----|--------|------|-------|---------------|
| `.side-clock` | 6 | 132 | 0 | 500 | the time at 96 px with AM or PM at 44 beside it (84 high), and under it the date at 44 (48 high) |
| `.side-weather` | 90 | 48 | at the right | as wide as it is | on the date row, at the right: the picture (48 px) and the temperature (44 px) |

**In the column**, tops counted from the top of the column:

| Part | Top | Height | Left | Width | What it holds |
|------|-----|--------|------|-------|---------------|
| `.side-countdown` | 0 | 408 | 0 | 384 | the countdown, stacked (its parts are below) |
| `.side-brand` | 432 | 344 | 0 | 384 | the logo, the SAMPLE CONTENT label, the TEAM plate and the school |
| `.side-logo` | 4 | 90 | 14 | 112 | in the brand: the animated logo, at the left. Its parts reach about 15 px past its box while the show plays, which is room it has |
| `.side-sample` | 5 | 88 | 154 | 230 | in the brand: the SAMPLE CONTENT label, only while the sample content is on, at the right of the logo, in two lines of 44 px (SAMPLE, then CONTENT) |
| `.side-team` | 108 | 76 | 0 | 384 | in the brand: the TEAM plate, as wide as the column |
| `.side-school` | 194 | 138 | 16 | 352 | in the brand: the school, under the plate, in up to three lines of 46 px |

The gaps are 24 between the countdown and the brand, 14 between the logo and the
plate, and 10 between the plate and the school. The brand ends at 776, the bottom of
the column, which is 20 above the ticker, and the school ends 12 above that, at 332
of the brand's 344. Together the countdown, the gap and the brand are 408 + 24 +
344 = 776.

**In the countdown**, tops counted from the top of the countdown (408 high). The
countdown is stacked: the label, the date under it, the big day count, the word DAYS
with the bars and the lamp, the hours, minutes and seconds with their units under
them, and the rail:

| Part | Top | Height | Left | Width | What it holds |
|------|-----|--------|------|-------|---------------|
| `.top-line` | 8 | 88 | 16 | 352 | the label (44, up to 352 wide) and the date under it (44). With no date (COUNTDOWN OVER, DATE NOT SET) the label has both lines |
| `.days` | 100 | 136 | 0 | 384 | the day count at 184 px (132 for three digits), with a chevron at each side |
| `.days-word` | 236 | 44 | 16 | as wide as it is | DAYS or DAY, 118 wide, at the left of the DAYS row |
| `.stripes` | 252 | 12 | 150 | 182 | the row of slanted bars, in the DAYS row, 16 from the word and from the lamp |
| `.lamp` | 248 | 20 | at the right, 16 in | 20 | the pulsing lamp, at the right end of the DAYS row (side.css counts it from the top of the top line, 240) |
| `.time-row` | 284 | 100 | 16 | 352 | the hours, minutes and seconds (56) in three columns, with HRS, MIN and SEC under them (44) |
| `.segments` | 390 | 12 | 16 | 352 | the rail of 12 blocks |

The parts are 4 px apart from each other, except the rail, which is 6 below the
units, and the countdown ends 6 under the rail.

### The class names

A theme styles the sidebar through these classes and nothing else. Each is one
element, and each is inside the one container `.side`, until the panel moves the
name, the clock and the weather into the strip:

| Class | What it is |
|-------|------------|
| `.side` | the panel, 384 by 776 |
| `.side-name` | the team name, an `h1` of one line of letters, which the name effect splits. It is part of the panel, and the panel moves it into the strip across the top of the screen, where `layouts/sidebar.css` gives it its size and its place |
| `.side-clock` | the time (`.time`), AM or PM (`.suffix`) and the date (`.date`). Moved into the strip, at its right end |
| `.side-weather` | the weather picture (`.weather-icon`) and the temperature (`.temperature`). Moved into the strip with the clock |
| `.side-countdown` | the countdown, with `data-level` set to `calm`, `tense` (the last month) or `critical` (the last week) |
| `.side-brand` | the container of the lower block: the logo, the label, the plate and the school |
| `.side-logo` | the animated logo, which also has the class `logo` that the effects look for |
| `.side-team` | the TEAM plate, with the number in a `b` |
| `.side-school` | the school, in a `.school-text` that may take three lines |
| `.side-sample` | the SAMPLE CONTENT label, in the brand, at the right of the logo. It is empty, and hidden, when the content is the editors' own |

There is no `.side-wordmark`: the panel does not draw the wordmark (see above).

Every part has `box-sizing: border-box` and a fixed size, so a border a theme
adds does not change its size. Padding does: a theme that needs a decoration
should use a border, an outline or a `::before` or `::after`. `side.css` sets
sizes, places and the size of the text, and these colours, all from theme
variables so that it looks right in any theme: the date, the units and the team
number are `--yellow`, the countdown has the face `--panel-face` and the numbers
`--count-color` and the lamp, the bars, the chevrons and the lit blocks of the
rail `--accent` (the same as the standard countdown, which set them by
`data-level`), and the SAMPLE CONTENT label is `--ground` on `--yellow`.

### What is on each part

- **The name** is built by `nameMarkup` in `core/name.js`, the same call the
  banner uses: one line of letters, so the name effect, which moves every letter
  in turn, is the one the banner has. It is in the strip at 120 px, with the
  clock's slot at its right. `splitName` and `nameLinesMarkup` (the name on two
  lines) are still in `core/name.js`, with their tests, and nothing draws them.
- **The clock** is written once a minute, as in the banner, into the strip. **The
  weather** is written when new weather arrives, and is `--°F` with no picture until
  there is a reading (or when the last one is too old). Both are found by the panel
  in the strip when it writes them (`part` in `side.js`).
- **The countdown** is the standard countdown's code (`core/countdown.js`, which
  `panels/countdown` uses too), so its dates come from Dashboard Settings the
  same way and it counts to Kickoff, then Rollout, shows NOW for the rest of the
  day, and goes tense in the last 30 days and critical in the last 7. It is
  drawn stacked in the column's 384. `countdown.js` works out the label and the
  date as if they were on one line, and the panel gives it a room of 553 px for
  that (`COUNTDOWN_LINE_ROOM`: the label's own 352 px line, the 24 gap that
  `countdown.js` keeps, and the widest date, 177), so that the IN and the date
  are dropped only when the label itself is too wide for its own line. A label of
  up to 12 letters fits: ROLLOUT IN is 277 px, and a longer one goes on to a second
  line, which shows only when there is no date to go under it (COUNTDOWN OVER is
  438 px and takes two lines, COUNTDOWN and OVER). With a date, a second line is
  not shown. The day count is 184 px, and 132 for three digits, as in the standard
  countdown (269 px at most for two digits and 285 for three, in the 296 between
  the chevrons). It has a flat face and no red frame of its own. A theme may frame
  it, through `.side-countdown`. Its text is 44 px or more: the label and the date
  44, DAYS 44, HRS, MIN and SEC 44, the hours, minutes and seconds 56.
- **The TEAM plate** is the banner's plate at a width of 384, with the text at
  44 px, so that TEAM with a five digit number fits (298 px, 8 clear of the plate's cut
  corner). At 56 px it would be 372 and would run into the corner.
- **The school** may take three lines, for example HOLLY / SPRINGS HIGH / SCHOOL, in
  352 px lines, centred. A fourth line is cut off with an ellipsis, and a word
  longer than a line (a 12 letter word is more than 340) is broken. The Studio
  allows 30 characters: HOLLY SPRINGS HIGH SCHOOL, WASHINGTON HIGH SCHOOL OF ARTS
  and WILLIAMSBURG TECHNICAL ACADEMY fit in three lines.
- **The SAMPLE CONTENT label** is a block of two lines at the right of the logo
  while the sample content is on. It is taken out of the flow, so showing or hiding
  it moves nothing.

### How it is drawn

`panels/side/side.js` builds the panel (`sideMarkup`), and `mount` and `update`
are the two calls every panel has. `core/panels.js` calls `update` each time the
content changes, through `updatePanel('side', content)` in `rebuild()` in
`shell.js`. The logo, the name effect and the digits that roll are the shared
code in `frame.js` (the entrance and the effects start from the `.logo` the
panel has, as they did from the banner's). The panel has no animation code. How
its parts arrive, one after another, is the table `sequences.side` in `frame.js`,
which has a line for every `data-part` in the panel. The name, the clock and the
weather are not in it, because they are in the strip, outside the panel.

The panel adds no moving element and no animated layer that the banner and the
countdown did not have: the lamp on the countdown pulses, the seconds roll, and
the logo and the name play now and then. Its speed on the Mini has not been
tested (see "The Mini", below).

## What else works in each layout

- **Page changes** (slats and the mechanical change) are the same, inside the
  scaled pane. The frame's metal comes from Dashboard Settings, as in the
  standard layout, unless the theme sets its own. Neon Prime does: gunmetal,
  whatever Frame metal says (docs/adding-a-theme.md, "Neon Prime").
- **Hidden transitions** break apart the blocks that exist in the layout. The
  standard layout has five (banner, large frame, countdown, small frame, ticker).
  The sidebar layout has four: the strip, the sidebar, the pane and the ticker. The
  strip flies up and the ticker down, as the banner and the ticker do in the
  standard layout, the sidebar to the left and the pane to the right, one after
  another (the strip first, the ticker last). Each block's pose (how far it flies,
  how it turns, how late it starts) is a line in the table in `frame.css`, and for
  the sidebar layout in `layouts/sidebar.css`. `layout-apply.js` marks the four
  with `data-block`, and the blocks of the standard layout that the sidebar layout
  does not have lose the mark. A transition still ends in a clean rebuild, and
  waits for no small frame.
- **Alerts, announcements, the night screen, the demo and the connection text**
  are layers as big as the screen. They do not depend on the layout, and cover it.
  The connection text is as wide as the ticker at most, as it is in the standard
  layout.
- **Seasonal packs**: the header mark and the pieces over the panels work in
  every layout. The zone and back decorations of the packs (strings of lights,
  the scene along the bottom, pieces in the margins) were measured on the
  standard layout, and are drawn only there. In the sidebar layout they are left
  out (`decorationLayers` in `core/layout.js`, `setLayers` in `core/season.js`).
  docs/seasonal-packs.md has the details.
- **The test switches** work: `?stress` shows the large frame and the ticker
  together (there is no small frame to show), `?only=tasks` shows only the large
  frame, `?perf` shows the readout in the bottom right corner, and `?show=` with
  a panel of the Large panels list shows that panel. `?show=` with a small panel
  (task counts, next event, forecast, safety days, sponsor logo) shows an empty
  screen, because the layout has no place for it.
- **The kit**: Neon Prime has a set of moving neon, the kit (below). It stops
  while an alert, an announcement, the night screen or a hidden transition has
  the screen, and in calm and none motion nothing of it moves.
- **The Mini** is a 2011 Mac mini. The layout itself adds no moving element and
  no full screen animated layer: it takes the small frame (its frame, screws and
  glint) away and keeps the pane and the ticker as they were. The kit adds nine
  small parts that move all the time and two short bursts (see "Moving
  elements"). Its speed on the Mini has not been tested. Test it as
  docs/try-it-on-the-mini.md says before relying on it.

## What does not show in the sidebar layout

- The small frame (Grid 2) and the five panels of the Small panels list: task
  counts, safety days, next event, sponsor logo and the weather forecast. The
  sidebar shows only the temperature and the picture of the weather, not the
  high and the low. Task counts, next event and the sponsor logo have larger
  relatives that stay in the Large panels list (Tasks, Events and Sponsor
  feature). Safety days and the forecast have no large version, so editors who
  want them on the screen pick another theme.
- The wide banner of the standard layout (logo, name, school, date, clock,
  weather and wordmark across the top). The strip and the sidebar hold the same
  things, and they are the same panel's data. The wordmark is the one thing left
  out: at 44 px high it is wider than the column.
- The strings of lights, scenes and pieces in the margins that a seasonal pack
  draws (its zone and back decorations). The pack's header mark and the small
  pieces over the panels do show.
- The frame metal setting. Neon Prime has frames of gunmetal whatever Frame metal
  says.

## The kit

The kit is the moving neon of Neon Prime: seven effects that make the screen
read as cyberpunk with a little machine in it (angular, data and hardware), spread
over the strip, the sidebar, the pane and the ticker. It is on for that theme in
the sidebar layout (`hasKit` in `core/layout.js`) and nowhere else. Every shape is
flat colour and thin lines. Nothing glows, blurs or casts a shadow, and only
`transform`, `opacity` and `stroke-dashoffset` change.

| File | What is in it |
|------|---------------|
| `dashboard/neon-kit.css` | the shapes of the kit and every keyframe it uses (one of the three places where something moves, with `frame.css` and `seasons/motion.css`), and the rules that play them |
| `dashboard/frame.js`, the section "The Neon Prime kit" | puts `data-kit="on"` on the html element while the kit may move, and times the two effects that are events |
| `dashboard/core/layout.js` (`kitMarkup`, `hasKit`) and `core/layout-apply.js` | the six empty boxes and four bars the kit draws in, added inside the four blocks so that they fly apart with them in a hidden transition |
| `dashboard/shell.js` and `core/takeover.js` | tell `frame.js` which theme is on, and when an alert or an announcement has the screen |
| `tools/check-themes.mjs` | fails for a keyframe outside the three motion files, and for anything else that breaks the rules above (it runs inside `studio/check-schemas.mjs` too) |

### The effects

| Effect | Where | How often | Elements | Keyframes (all in `neon-kit.css`) |
|--------|-------|-----------|----------|-----------------------------------|
| Name glitch | the team name in the strip. Flat cyan and magenta copies of each letter jump a few pixels in steps behind it, and a band of each letter jumps sideways in front. The name is always there to read | every 12 to 25 seconds, a new number each time, for .4 seconds | none at rest. 42 for .4 s: the three spare pieces of each of the 14 letters (`core/name.js`) | `kit-glitch-left`, `kit-glitch-right`, `kit-glitch-slice` |
| Data packets | a bright dash (a dull tail, a cyan body, a pale head) races along the line under the strip, the line on the right of the sidebar and the line above the ticker. The strip's runs to the right, the ticker's to the left, the sidebar's down | each runs for about a quarter of its round (8.6 s, 7.2 s and 11.3 s) and rests out of sight for the rest | 3, all the time | `kit-run-right`, `kit-run-down`, `kit-run-left` |
| Scan sweep | a thin pale line with a faint flat tint behind it sweeps down the body of the large frame, below its header, and down the sidebar | the pane's every 10.7 s, the sidebar's every 17 s, each over about 40 percent of its round | 2, all the time | `kit-sweep` |
| Neon flicker | the bright parts of the line above the ticker and of the line beside the sidebar stutter like a faulty tube | a pattern of two or three quick dips in each round of 13 s and 19 s | 2, all the time | `kit-flicker-a`, `kit-flicker-b` |
| HUD brackets | four corner brackets round the large frame, in the free space at its two sides, breathe in and out a few pixels | there and back in 5.6 s | 1, all the time (the four brackets are the corners of one box) | `kit-breathe` |
| Tick chase | a group of lit ticks travels along the row of ticks under the strip, one tick at a time | a pass every 9.4 s | 1, all the time | `kit-tick-chase` |
| Page change burst | four bars of glitch jump sideways across the body of the large frame when a new page starts to arrive in it, besides the page change that Dashboard Settings chose | .3 s, at each page change of the large frame (not the first page) | none at rest. 4 for .3 s | `kit-burst` |

Nine parts move all the time (the packets, the sweeps, the flicker, the brackets
and the tick chase). Everything else is a short event. No two parts have the same
time, and each starts part of the way in (a negative delay), so the kit never falls
into a loop. `tools/test-layouts.mjs` fails if two times are the same, if a part
has no negative delay, or if more than 12 parts play all the time.

Where the shapes sit. The three lines are in the gaps between the blocks (the 20
px under the strip, the 20 px above the ticker and the 32 px between the sidebar
and the pane), with their ticks and their bright parts, and are drawn at rest too.
The brackets are the corners of the pane's space, a few pixels in from them. The
sweep and the burst are in a layer inside the large frame, in the body of the
frame under its header (1116 by 510 px at the frame's own size, scaled with it),
off its metal and its cut corners. The sidebar's sweep is a
layer as big as the column. The places come from the variables `core/layout.js`
gives the page, so a change of the numbers there moves the kit too.

### When nothing moves

- **Calm and none motion**: nothing moves. The lines, ticks and brackets are
  drawn at rest, and the packets, the sweeping lines and the bars wait out of
  sight.
- **The night screen, an alert, an announcement, a hidden transition**:
  `frame.js` takes `data-kit` off the html element and the animations stop, which
  is also why the kit costs nothing while the screen is covered. Any glitch or burst
  that is playing ends on the spot, and the kit starts again when the screen is
  back.
- **A demo** (the Demo page): the two events are silent. The rest goes on.
- **The two events** also wait for the moment: the name glitch is skipped while the
  name effect, the logo or the screen glitch is playing and while a page is
  changing, and it is never saved up (the next one comes 12 to 25 seconds after
  the one that was skipped). The glitch has one timer waiting for the next one and
  one for the end of the one that plays, and the burst has one for its end. They are
  cleared when the theme goes away (`setKit(false)`), and the one that waits is
  cleared when the motion leaves full.
- **`?kit=off`** in the address switches the whole kit off for that page, to see
  what it costs (docs/try-it-on-the-mini.md).

`tools/test-effects.mjs` tests all of this with a fake clock.

### What it was not

Three more were thought of and left out. Falling data on the bare ground would run
behind the small text of the strip and the sidebar, where almost all of the ground
has text on it. A slowly sliding hazard stripe would be a second moving thing next
to the TEAM plate. A line drawing at start would repeat what the frames already do
when the screen starts (they draw themselves in).

### Adding an effect

1. Say where it is: the strip, the sidebar, the pane or the ticker. Draw it in a
   box inside that block, so that it flies apart with the block in a hidden
   transition. Use one of the boxes in `kitMarkup` (`core/layout.js`), or its
   `::before` and `::after`, before adding an element. The few elements are the
   point: `tools/test-layouts.mjs` counts them.
2. Write its shape in `dashboard/neon-kit.css`, with a selector that starts
   `html.theme-neon-prime[data-layout="sidebar"]`, in flat colour. Take its place
   from the layout variables, not from numbers.
3. Write its keyframes in the same file, named `kit-<what it does>`, with one
   line above them saying what they are for. Only `transform`, `opacity` and
   `stroke-dashoffset` may change.
4. Play it with a rule that starts `html[data-kit="on"][data-motion="full"]`, with
   a time that no other part has and a negative delay. Wrap the time in
   `calc(... * var(--pace))` like the others, so the Speed setting stretches it.
5. If it is an event, put its timing in `frame.js`, in the section "The Neon Prime
   kit": the gap, the blocked states (call `kitMayFire()`), the timer that is
   cleared in `setKit(false)`, and a class that the stylesheet plays. Add its tests
   to `tools/test-effects.mjs`.
6. Run every test. `node tools/check-themes.mjs` says which rule was broken, and
   in which line. Count what moves with `?perf` ("animations running"), write the
   new count in the tables here, and keep the parts that play all the time to about
   a dozen.

## Moving elements

An animated element is one that `document.getAnimations()` counts: the CSS
animations and the Web Animations the shared frame code runs (`frame.js`). The
readout from `?perf` ("animations running") is the same count. These numbers
were taken in a desktop Chromium on a Mac, **not on the Mini**, at 1920 x 1080
with full motion and the glint on, with a page change every 8 seconds (the
shortest Seconds per page), counting every 200 milliseconds for 50 seconds, six
seconds after the page started. The same sample content, the six pages open in one
browser at the same time, once for each layout and once for each style of page
change (the kit off rows have `?kit=off` on the address):

| Page change | Layout | Lowest | Middle | 9 samples in 10 at or under | Highest | Average |
|-------------|--------|--------|--------|-----------------------------|---------|---------|
| Slat | standard | 4 | 17 | 32 | 51 | 15.5 |
| Slat | sidebar, kit off | 2 | 5 | 21 | 35 | 8.6 |
| Slat | sidebar, kit on | 11 | 14 | 33 | 54 | 18.5 |
| Mechanical | standard | 4 | 8 | 32 | 67 | 16.1 |
| Mechanical | sidebar, kit off | 2 | 5 | 27 | 43 | 9.3 |
| Mechanical | sidebar, kit on | 11 | 14 | 37 | 56 | 18.4 |

What goes on all the time, six seconds after the page started: the standard layout
has 3 (the glint of each of its two frames and the pulse of the countdown's lamp).
The sidebar layout with the kit off has 2 (one glint, one lamp: it has one large
frame and no small frame, so one glint, one set of screws and one page change
fewer, and the side panel adds none of its own beyond what the banner and the
countdown had). With the kit on it has 11: the 9 parts of the kit, the glint and the
lamp. The limit set for this theme was about 16 that go on all the time, and the
rest short events.

With the kit on, the sidebar layout is heavier than the standard one on average, by
19 percent with a slat change (18.5 against 15.5) and by 14 percent with the
mechanical change (18.4 against 16.1). That is under a third, so no effect was
taken out. At the top it is 54 against 51 with the slat change and 56 against 67
with the mechanical one. The kit is the difference of 9 all the time (the lowest is
11 and not 2), and 4 more for .3 seconds at each page change (the burst). The
highest numbers include a name glitch, which is 42 pieces for .4 seconds (and
never while a page changes, so it is not added to the page change's own count). In
the 58 seconds of each kit on run the burst played 5 times in the slat run and 6 in
the mechanical one (.3 s each, at a page change of the large frame), and the name
glitch played twice in the slat run (.4 s each) and not at all in the mechanical
one: a glitch that comes due while a page is changing is skipped, and with a page
change every 8 seconds and the mechanical style that is most of the time. With the
usual Seconds per page it plays nearer to every 12 to 25 seconds. The kit stops with `?motion=calm` and `?motion=none`, where nothing of it
is counted (the count at rest is 0 in both), and while the night screen, an alert,
an announcement or a hidden transition has the screen.

**Be careful with these numbers.** They count elements and say nothing about
speed. The Mini's speed with the sidebar layout has **not been tested**, and the
layout does one thing the standard layout does not: it draws the large frame
through a CSS scale of 1.0319, and a scaled layer may cost more on the Mini's
graphics chip than an unscaled one. Run the tests in docs/try-it-on-the-mini.md,
section 7, on the Mini before relying on this theme on the TV.

## Looking at a layout

Add `?theme=neon-prime` to the address, with `?night=off&hidden=off` to keep
those away while you look: `http://localhost:8080/dashboard/?theme=neon-prime&night=off&hidden=off`.
`?show=<panel id>` shows one panel in the pane. `?hidden=desktop` and
`?hidden=redEyes` play the hidden transitions, and `?demo=alert` the alert.
Without `?theme=` the screen follows the Theme page, and reloads once when the
theme with another layout comes on.

To check a layout by hand, look at every panel of the Large panels list with
`?show=` (tasks, events, tonight, spotlight, sponsor-feature, photo, leadership,
team-leads, roster and custom). For each one:

1. The smallest text is 44 px or more. In the browser's developer tools, a
   panel's font size is multiplied by the scale of the pane (1.0319), so it is
   never smaller than it is in the standard layout.
2. Nothing sticks out of the frame, and nothing is under its two cut corners (top
   left and bottom right). The panels are the same size in both layouts, so a
   panel that fits in the standard layout fits here.
3. The team name is on one line in the strip, and the name effect still plays on
   it (every few minutes, or at the time Dashboard Settings says). The clock, the
   date and the weather are at the right end of the strip and do not touch the name,
   with the widest time (10:59 PM), date (MON MAR 29) and temperature (104°F). In
   the sidebar the parts do not touch each other, with a three digit day count, a
   label of 12 letters, a long school name (30 characters) and a five digit team
   number, and COUNTDOWN OVER takes two lines of the label.
4. The ticker shows its tag and the whole message, with a tip of 52 characters
   (the most the Studio allows) and a very short one.
5. Look at the page change, `?hidden=desktop`, `?hidden=redEyes`, `?demo=alert`,
   `?demo=announcement`, `?night=on`, `?overlay=christmas`, `?motion=calm`,
   `?motion=none`, `?finish=flat` and `?kit=off`. Each one that takes the whole screen covers the strip, the
   sidebar, the pane and the ticker, and the screen comes back as it was.
6. Watch the kit for a minute at full motion: the packets race along the three
   lines, the thin lines sweep down the pane and the sidebar, the name glitches
   now and then and the bars cross the pane at each page change. No word is under
   anything for more than a moment. To see the name glitch at once, type
   `document.querySelector('[data-name-effect]').classList.add('glitching')` in the
   browser's console, and take the class off again with `remove`. With
   `?motion=calm` the lines, ticks and brackets are there and nothing moves.

Then run every test (docs/where-things-are.md, "Checking your work").

## Adding a layout

1. Pick a name, lowercase, for example `wide`. Add it to `layouts` in
   `dashboard/core/layout.js`.
2. In the same file say which regions it has (`regionsIn`), which blocks fly
   apart (`blocksIn`), and which parts of a seasonal pack it draws
   (`seasonLayersIn`). If it has its own numbers, write them once as
   `sidebarSettings` does, with a function that works out the rectangles and one
   that gives the variables.
3. Put its markup in `index.html` (hidden, like `#region-sidebar`) and have
   `layout-apply.js` set it up (`placeRegions`) when the layout is chosen.
4. Write `dashboard/layouts/wide.css`, link it in `index.html` after
   `frame.css`, and start every selector with `html[data-layout="wide"]`, so the
   other layouts are never touched. `tools/test-layouts.mjs` fails for a rule
   that does not.
5. Give a theme `layout: 'wide'` in `dashboard/themes/registry.js` and in
   `studio/themes.js`, and add it to the checks in `tools/test-layouts.mjs`.
6. Run every test (docs/where-things-are.md, "Checking your work").
