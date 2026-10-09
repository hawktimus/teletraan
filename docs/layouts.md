# Layouts

A layout is where the regions of the screen sit. A theme (docs/adding-a-theme.md)
may name one, and the Style setting in Dashboard Settings may force one. There are
three:

- **standard**: the banner across the top, the large frame (Grid 1) on the left,
  the countdown and the small frame (Grid 2) on the right, and the ticker across
  the bottom. Every theme has it unless it says otherwise.
- **sidebar**: a strip across the top with the team name on one line and the
  clock at its right end, under it a column on the left and one large frame on the
  right, and the ticker across the whole bottom, as in the standard layout. There is
  no small frame. The theme Neon Prime has it.
- **bar**: a banner across the top with the team name at one end and the war clock
  at the other, under it a thin side column and one main panel, and the ticker
  across the whole bottom. There is no small frame. The style Minimal has it,
  whatever theme is on (see "The bar layout").

Original and Cybertron are the two styles that have the layout of their theme. Cybertron
draws the same arrangement as Original in plates of gunmetal and steel (see "Cybertron").

A team with Mirror the layout switched on turns the standard and the bar layout left
to right (see "The mirror"). The sidebar layout is not turned. Every layout is placed in
pixels on a fixed 1920 by 1080 canvas (see "The screen is a fixed canvas").

The code is `dashboard/core/layout.js` (the numbers and the rules, with no page
in it), `dashboard/core/layout-apply.js` (puts the layout on the page),
`dashboard/core/style.js` (which style, and the layout it asks for) and
`dashboard/layouts/sidebar.css` and `dashboard/layouts/bar.css` (the placing).
`node tools/test-layouts.mjs` checks them.

## How a layout is chosen

The theme registry (`dashboard/themes/registry.js`) says which layout a theme
has. `layout: 'sidebar'` on a line gives it the sidebar layout. A line with no
layout has the standard one. The Studio's copy of the list (`studio/themes.js`)
says the same, and `node studio/check-schemas.mjs` fails if the two differ.

The style is the second thing that counts, and it wins. Style in Dashboard Settings
(Look tab) is Original, Cybertron or Minimal. Original and Cybertron keep the layout
of the theme, so a screen with Original is exactly what it was before there was a style,
and Neon Prime with Cybertron is the sidebar layout drawn in Cybertron's plates. Minimal
has the bar layout whatever the theme says, so Neon Prime with Minimal is the bar layout
in Neon Prime's colors. `core/style.js` works it out (`layoutFor`), and `?style=minimal` in
the address does the same for one page, over the setting. The theme still gives the
colors and the seasonal packs.

The layout is set before anything is drawn, so that a screen that starts with
Neon Prime chosen starts straight in the sidebar layout. `shell.js` does it as
its first step. It reads the Style and the Look document in the copy of the
content saved on this computer (the same copy the screen uses when Sanity cannot be
reached), puts `data-style` on the html element, works out the theme as
`theme-apply.js` will, and sets `data-layout`. `?theme=neon-prime` and `?style=` in
the address win, like they do for colours. When
there is nothing saved yet, or the saved copy cannot be read, the screen starts
in the standard layout. While the screen shows the sample content there is no saved
copy to read (the sample is a file), so a sample whose theme has the sidebar layout, or
whose style is Minimal, reloads once and then stays in the standard layout
with the new colours and the style Original. Use `?theme=` and `?style=` to look at a
layout with the sample. With `?team=` and `?overlay=` as well, every style, team and
seasonal pack can be looked at with the sample content, which has both teams. The same
holds for any page that cannot reload: it keeps the style it was drawn for.

When the theme and the style that should be on screen give another layout than
the page has, for example an editor switches the theme or the style in Studio,
colours alone cannot do it,
because the regions are drawn for one layout. The page **reloads once**, in the
moment the new theme would have gone on (at the next page change of the large
frame, or at once at start). Before it reloads it writes the layout it is
reloading for in `sessionStorage`, and a page that finds the same layout written
down does not reload again, so a screen can never reload in a loop. The note is
rubbed out as soon as the page is in the layout wanted. If the browser's storage
does not work, the page does not reload at all and the colours go on in the old
layout. It also does not reload while an alert or an announcement has the screen,
and tries again at the next page change and once a minute. Changing between two
themes that have the same layout is only colours and does not reload. Original and
Cybertron have the same layout but not the same frames, and the page does not reload for
that: it draws the frames again in the step that puts the style on the page (see
"Cybertron", "When the style changes"). Minimal has the bar layout, so changing to or from
it reloads once, in the same way as a change of layout. Changing the colours of any style,
or the theme or the team under it, does not.

## The screen is a fixed canvas

The screen is always 1920 by 1080 pixels, in every layout, with every style and
with either team. `base.css` gives `#screen` and the layers on it those two sizes. On
the TV the window is exactly that size and nothing is scaled. On a smaller window
`fitToScreen` in `shell.js` scales the whole picture with one transform, the same
across and down, and centres it. The page never reflows: there are no media queries,
no sizes in the window's units and no viewport tag.

So every part of a layout is placed in pixels, counted from the top left corner of
the canvas. This holds for the standard, sidebar and bar layouts, for the mirror and
for the war clock. A new layout does the same (see "Adding a layout"), and gives
its numbers in one place in `core/layout.js`.

`node tools/test-layouts.mjs` has two tests for this. One reads `index.html`,
`base.css`, `shell.js` and the size constants of every layout, and fails when one
of them is not 1920 by 1080 or when a layout stylesheet is responsive. The other
works out the bar layout, its mirror and the mirror of the mirror, and fails when
any part is outside 0 to 1920 across and 0 to 1080 down, or when two parts overlap.

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
sponsor logo and forecast panels. The large panels in the Panel order list in
Dashboard Settings are the rotation of the pane. The small panels in that list
are not used while a sidebar theme is on. The countdown is not a small panel: it lives in the sidebar. Grid 1 and
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

## The bar layout

A banner across the top, under it a thin side column and one main panel, and the
ticker across the bottom. The style Minimal has it. All lengths are
pixels of the 1920 x 1080 screen. They are written once, in `dashboard/core/layout.js`
(`barSettings`), and `layout-apply.js` hands them to `layouts/bar.css` and to the two
bar panels as variables on the html element. To change a size, change it there and
run the tests.

| Part | x | y | width | height |
|------|---|---|-------|--------|
| Banner | 32 | 32 | 1856 | 160 |
| Name slot | 72 | 32 | 1052 | 160 |
| War clock slot | 1148 | 52 | 700 | 120 |
| Row | 32 | 216 | 1856 | 736 |
| Rail | 32 | 216 | 12 | 736 |
| Side column | 68 | 216 | 300 | 736 |
| Main panel | 404 | 216 | 1484 | 736 |
| Header | 404 | 216 | 1484 | 120 |
| Page | 404 | 216 | 1483.37 | 735.97 |
| Bar ticker | 32 | 976 | 1856 | 72 |

The picture shows where the parts are. It is not to scale:

```
y 0  +--------------------------------------------------------------------+
     |                          margin 32                                 |
  32 |   +------------------------------------------------------------+   |
     |   | BANNER 1856 x 160                                          |   |
     |   | NAME slot 1052 wide          war clock slot 700 x 120      |   |
 192 |   +------------------------------------------------------------+   |
     |         row gap 24                                                 |
 216 |   +-+  +-------+  +-------------------------------------------+   |
     |   |R|  |SIDE   |  | MAIN PANEL 1484 x 736                     |   |
     |   |A|  |COLUMN |  |   header 120                              |   |
     |   |I|  |300 x  |36|   the page, scaled 1.0395, from the       |   |
     |   |L|  |736    |  |   top left corner                         |   |
 952 |   +-+  +-------+  +-------------------------------------------+   |
     |         row gap 24                                                 |
 976 |   +------------------------------------------------------------+   |
     |   | TICKER 1856 x 72: the tag, then the message on one line    |   |
1048 |   +------------------------------------------------------------+   |
     |                          margin 32                                 |
1080 +--------------------------------------------------------------------+
```

The margin is 32 on every side, and the rows are 24 apart, so the heights add up:
32 + 160 + 24 + 736 + 24 + 72 + 32 = 1080, and so do the widths: 32 + 336 + 36 + 1484
+ 32 = 1920. The rail is 12 wide, 24 from the column, and the column is 36 from the
main panel. The main panel is one frame for every topic in the large panels of the Panel order list.
There is no small frame and no countdown panel: the war clock has its slot in the
banner, and the scheduler leaves out every panel whose region is `grid2`, as it does in the
sidebar layout. Grid 1 and Grid 2 never show the same topic, so with no Grid 2 the main
panel may show any topic.

### The banner

`panels/bar-banner` draws it into `#region-banner`. The team name is at one end, one
line at the heading size (96 px), in a slot 1052 wide: HAWKTIMUS PRIME is 985 wide
at that size, and a longer name squeezes its letters together, as the banner's name
does, so the war clock never moves. The war clock's slot is at the other end, 700 by
120, in the middle of the banner's height, and the war clock is drawn in it (see "The war
clock"). Both are 40 in from the ends of the banner, with 24 between them.

### The war clock

The war clock is the countdown drawn a third time, 700 by 120, in the banner's slot. It has
the same source as the countdown in the standard layout and in the sidebar: the dates, the
labels and the second tick, all from Dashboard Settings (`core/countdown.js` works them out,
and `startCountdown` is given `{ war: true }`). Only the look is its own. The code is in
`panels/countdown` (`warMarkup`, `startWar` and `updateWar` in `countdown.js`, the rules in
`countdown.css`) and the housing is drawn by `warHousingMarkup` in `core/plate.js`.
`panels/bar-banner` puts it in its slot, and Minimal shows it (`styles/minimal.css`). Cybertron
shows the wide form of it in the countdown's place, which is its own section ("The wide war
clock", under "Cybertron"), and Original shows neither.

The housing is a plate of steel, with the edge of the frames (the shadow, the rim, the face, the
shade and the ridge, as in "Frames"), the same gradient as the armor tab, a cut corner of 22 at the
top left and the bottom right, four rivets at the corners, one horizontal weld seam between the
label and the date, and rust at the bottom left and the top right. The rust is a soft patch and a
short stroke, the flat finish leaves it off, and it never moves. Inside it, from left to right,
are a label block, a dark plate with the days and a dark plate with the time. Every part is placed
by hand, counted from the top left corner of the housing:

| Part | Top | Height | Left | Width | What it holds |
|------|-----|--------|------|-------|---------------|
| `.war-status` | 46 | 10 | 28 | 10 | the red square, which is `--danger` |
| `.war-lines` | 37 | 56 | 46 | 169 | the label in capitals, 24 px with the letters spaced, and under it the date in the same size, a line of 28 each |
| `.war-days-plate` | 14 | 92 | 223 | 176 | the days at 76 px and DAYS beside them at 24 px |
| `.war-time-plate` | 14 | 92 | 414 | 250 | the hours, minutes and seconds at 48 px, with HRS, MIN and SEC under them at 20 px, in three cells of 80 with a bar of 3 px between two cells |

The plates are `#0c0b09` with a 3 px border of `#2b2a26` and a gradient inside, from a faint
highlight at the top to a shade at the foot. The digits are the team's neon in Minimal, and amber
(`#ffb327`) in Cybertron, which is `--style-digits`. The date, DAYS and the small labels are a little
fainter. The rivets are 5 px, in the corners, 3 px clear of the plates. The labels, 20 and 24 px,
are text under 44 px, which only the war clock and the stamped ids may have. The list is in
`tools/test-layouts.mjs`.

**What it shows.** The label is the label from Dashboard Settings in capitals, with no IN, and the
date is under it, as `JAN 9`, or `NOW` for the rest of the day when the time has come. The days
are two digits, three when there are 100 or more, and the hours, minutes and seconds are two
each. They change with the same tick as the countdown, at once: there is no roll, no nudge of
chevrons, no lamp row, no serial plate and no pipes. After Rollout the label is COUNTDOWN
OVER, and while no date is set it is DATE NOT SET, which are the words the standard countdown
shows. They take both lines at 20 px (COUNTDOWN over OVER, and DATE NOT over SET), with the days
at 00 and the time at 00 00 00. In the last 30 days the digits and the labels turn orange (`--danger-bright`), and in the
last 7 they turn white and the borders of the plates turn red (`--danger`).

**What fits.** The numbers come from the advance widths of the display font, without kerning,
which only makes a word narrower. Two digits at 76 px are up to 111 wide and DAYS at 24 px is
about 64, and the plate has 170 inside its border, so the digits are set .04 em closer
together and DAYS .03 em, with 2 px between the days and DAYS. The 3 counts that are still wider
(69, 96 and 99) are wider than the plate by 1.4 px at the most, shared by both sides, and the
plate cuts off what is outside it. Three digits at 76 px would be 199 with DAYS, so a count of
100 or more is drawn at 48 px, like the time, and the widest of those, 999, is 166. The widest
pair of time digits at 48 px is 70 wide in its box of 76. KICKOFF at 24 px with its spaced letters
is 128 wide and ROLLOUT is 137, in the 169 of the label. COUNTDOWN at 20 px is 155. A label of up
to 12 characters that is wider than the line is cut off with an ellipsis, as the standard
countdown's is. This has been worked out from the font and not looked at on a screen.

**The mirror.** The slot is at the other end of the banner when the layout is mirrored, and the
war clock in it is the same picture: the label block at the left, then the days, then the time.
It reads from the left like every plate, and nothing turns it round.

### The side column

`panels/bar-column` draws it into `#region-column`, which is the rail and the column
together, 336 wide. The rail is a box of its own size that the style draws. Every part
of the column is placed by hand, with the top it starts at, counted from the top of the
column, and the height it has, so a long school name cannot push anything. The numbers
are in `bar-column.css`, and `node tools/test-layouts.mjs` fails if they differ.

| Part | Top | Height | Left | Width | What it holds |
|------|-----|--------|------|-------|---------------|
| `.bar-clock` | 0 | 192 | 0 | 300 | the time and AM or PM, a rule under them, the date and the weather |
| `.bar-time` | 0 | 90 | 0 | 300 | the time at 84 px with AM or PM at 44 beside it, and the rule under them |
| `.bar-date` | 96 | 48 | 0 | 300 | the date at 44, centred |
| `.bar-weather` | 144 | 48 | 0 | 300 | the weather picture (48 px) and the temperature (44 px), centred |
| `.bar-team` | 208 | 76 | 0 | 300 | the TEAM plate, as wide as the column |
| `.bar-school` | 296 | 184 | 0 | 300 | the school, in up to four lines of 46 px |
| `.bar-sample` | 488 | 88 | 35 | 230 | the SAMPLE CONTENT label, only while the sample content is on, in two lines of 44 px |
| `.bar-logo` | 599 | 137 | 65 | 170 | the animated logo, at the foot of the column |

The widest time (10:59 at 84 px is 245 wide) with PM (71 wide) is 316, and the
column is 300, so the letters of the time are 5 px closer together (297). The TEAM
plate is 300 wide, and the words TEAM 3229 fit it at 44 px. A five digit number is
wider than the plate allows beside its cut corner. The logo's parts reach about 23 px
past its box while the show plays, which fits in the 24 between the column and the
ticker. All text is 44 px or more.

A seasonal pack can add a banner line (docs/seasonal-packs.md, "Banner line"). It is
`.bar-line`, one line of 44 px under the weather, centred and cut off with an ellipsis, and about
10 characters of it fit in 300 px. While there is a line, `bar-column.js` sets `data-line` on the
panel to `on`, and the parts under it move down. The 44 px come out of the gaps, and the logo stays
where it is. These are the places while the line is on:

| Part | Top | Height | Without a line |
|------|-----|--------|----------------|
| `.bar-line` | 192 | 44 | not there |
| `.bar-team` | 240 | 76 | top 208 |
| `.bar-school` | 322 | 176 | top 296, height 184 |
| `.bar-sample` | 504 | 88 | top 488 |

The school keeps its four lines, now of 44 px instead of 46. The label ends 7 px above the logo's
box instead of 23, so while the show plays the logo's parts may pass behind the label for a moment.
The label is only there while the sample content shows, so this happens only then.

### The width of the main panel

The panels are written for a page 1152 wide and 708 high, and the main panel is 1484
by 736. The page is **scaled**, one CSS transform, `scale(1.0395)` from its top left
corner, the same across and down, so text grows with it and never shrinks. 1.0395 is
736 over 708, cut to four decimals so that rounding never makes it too big. It is the
height that limits it: scaled to the width the page would be 912 high. The area is
made 1427 wide before the scale (`areaWidth`), which is 1483.37 on the screen, a
little under the 1484 of the panel. The area is what is scaled, and not
`#region-grid1`, because the hidden transitions move the region with a transform of
their own and would drop a scale set on it.

The panels keep their rows, their line limits and their rules, and show no more
content than they did: only the text is bigger, by 3.95 percent. **No panel stretches
to the extra width.** The page keeps the width it was written for, 1152, which is 1197
on the screen, at the left of the panel, and the 286 px at the right of it are not
used by any panel. This is the least invasive way, because no panel has to change, and
it is the only one that never shows a panel in two widths. A width variable could
stretch a panel's boxes, but every panel has a part that is drawn by the code at a
fixed length, and a variable cannot reach that:

| Panel | Fixed in the stylesheet | Fixed in the code |
|-------|-------------------------|-------------------|
| Tasks | header and rows 1152, row text 960 and 900 | row bars 1124 (`tasks.js`) |
| Events | header and rows 1152 | row bars 1124 (`events.js`) |
| Daily Agenda (`tonight`) | header and rows 1152, plan card 1096 | plan card 1096 by 140 and row bars 1124 (`tonight.js`) |
| Subteam spotlight | header and story 1152, name card 1096 | name card 1096 by 128 (`spotlight.js`) |
| Sponsor feature | header and story 1152, name card 1096 | cards 1096 by 128 and 360 by 280 (`sponsor-feature.js`) |
| Photo | header 1152 | card 1096 wide and the caption's edge at 1056 (`core/photos.js`) |
| Leadership, Team leads | header and rows 1152 | row bars 1124 and portrait cards (`portrait.js`) |
| Roster | header 1152, the body in a box 1096 wide, in the middle of it | portrait card 292 square |
| Custom | header 1152, page 1096, blocks 1056 and 1034 | block cards and bars 1056 (`custom.js`) |

The one panel whose content is in the middle of a box (Roster) is the one a variable
could stretch from the stylesheet alone, and it is left like the rest. To fill the width, those fixed lengths in the code would have to
become something the page passes in, panel by panel, and the cut corners of the frame,
which the panels keep their text clear of, would have to be looked at again. `plate.js`
draws the large frame of the standard layout for 1152 by 708. A frame drawn for these
styles is drawn for the area, 1427 by 708 before the scale.

### The mirror

A team can have Mirror switched on (Teams in Studio, `core/teams.js`), and then the
layout is turned left to right. `core/teams.js` puts the class `mirrored` on the html
element, in the same step as the team's colors, so it changes at the moment the
large frame is apart, and never in the middle of a panel. It is one mechanism: the
rules in `layouts/bar.css` that start with `html.mirrored[data-layout="bar"]`.

- **The flex rows** are turned by one rule, `flex-direction: row-reverse`: the row
  of the side column and the main panel (`#bar-middle`), the banner (`.bar-banner`),
  the side column with its rail (`.bar-column`) and the ticker (`.ticker`). So the
  side column and its rail are at the right, the war clock at the left and the name
  at the right, and the ticker's tag at the right end.
- **The text** that has a box of its own goes to the other end of it: the name, the
  time, and the ticker's message, which ends at the tag. A part that is read in one
  order, the letters of the name, the time and AM or PM, the picture and the
  temperature, is never turned: `tools/test-layouts.mjs` names each of them.
- **Decoration** that has no text and no transform of its own, such as a cut corner
  or a notch, turns with the class `mirror-art`, which is `transform: scaleX(-1)`.
  Text is never turned round.
- **The war clock** is in its slot at the other end of the banner, and what is in it is not
  turned: the label, the days and the time read from the left (see "The war clock").
- **The hidden transitions** fly the side column to the right and the main panel to
  the left.

`makeBarGeometry` has the same answer as numbers, and `mirrorGeometry` turns every
rectangle: `x` becomes 1920 less `x` and the width, and nothing else changes. The one
rectangle it does not turn is the page, which stays at the left edge of the main
panel, because the panels read from the left. The tests check that the mirrored layout
is still inside the screen and still overlaps nothing, and that the order of the parts
is the one the rules give. The banner, the row and the ticker are as wide as the
screen between two equal margins, so each is its own mirror.

| Part | x | y | width | height |
|------|---|---|-------|--------|
| Mirrored rail | 1876 | 216 | 12 | 736 |
| Mirrored side column | 1552 | 216 | 300 | 736 |
| Mirrored main panel | 32 | 216 | 1484 | 736 |
| Mirrored name slot | 796 | 32 | 1052 | 160 |
| Mirrored war clock slot | 72 | 52 | 700 | 120 |

The standard layout is mirrored by `styles/original.css`, as the same idea: the two
columns change places, the banner's logo goes to the far end and its clock to the
left end of the name block, and the ticker's tag goes to the right end. Its frames
and the pages in them are not turned: they keep their shapes and read from the left.
The sidebar layout is not mirrored. The zones of a seasonal pack (the front layer)
were measured on the layout as it is not mirrored, so they are not drawn while it is
mirrored. A test reads the stylesheets of the standard layout and fails for any flex row
that `styles/original.css` does not turn, unless the test names it as a row that keeps its
order, with the reason: the letters of the name, the time, the TEAM plate, the date and the
weather, the word on the ticker's tag, and the lines of the countdown.

### Styles

A style is `data-style` on the html element, and one stylesheet in `dashboard/styles/`.
The first rule of a stylesheet sets the custom properties of its style. The rules after
it paint what only that style has: the page background, the plates, the rail beside
the side column (Minimal) and the decoration of its frames. A stylesheet never copies
`base.css` or `frame.css`, and every rule in it starts with its own style, so a style
cannot change another. Original and Cybertron have the layout of the theme, and Minimal
the bar layout (`layouts/bar.css`), and the team gives the colors.

| File | What it has |
|------|-------------|
| `styles/original.css` | no custom properties, and the mirror of the standard layout, which Cybertron has too |
| `styles/cybertron.css` | `--style-body` and `--style-raised` (the gunmetal plates), the two colors of the armor tab, the 56 px chamfer, the neon and pink of the team, amber digits and rust for the war clock, a 96 px grid at .07 and scanlines at .035. Then the rules that paint the page background, the plates and the decoration of the frames, and lay out the stage, the banner and the ticker for their plates (see "Cybertron") |
| `styles/minimal.css` | the 34 px chamfer, the neon and pink of the team, digits in the team's neon, the team's background for the plates, the two colors of the armor tab, the rust, a 48 px grid at .07 and no scanlines. Then the rules that paint the grid, the plates, the rail and the rivets that Original also has, take the `//` mark off the headers, and paint what only Minimal draws on a frame (see "Minimal") |

The style goes on the page at the same moment as a new theme (`theme-apply.js`
carries it in the look), and a style with another layout reloads the page once, with
the guard above. The frames are drawn by `core/plate.js` and are described under "Frames"
and "Cybertron".

Original also has rivets and stamped plate ids on its frames. `core/plate.js` puts
both in the markup of every frame that has them, and `base.css` shows them while
`data-style` is `original`. Minimal draws the rivets on its own frames too, with the same
code, and `styles/minimal.css` shows them there (see "Minimal"). Minimal has no stamped id:
none of its frames has one in its markup, and neither has Cybertron's. The rivets are a row of dots, one every 90 px, along each long straight
edge of the large frame, the small frame and the countdown. An edge under 180 px has
none, so the cut corners and the countdown's teeth have none. The ids are `HP-01` on
the large frame, `HP-02` on the countdown and `HP-03` on the small frame. The letters
are the initials of the team's name (`teamInitials` in `core/teams.js`), so the Nova
team gives `HN`, and they change with the team at the same moment as the colors. The id
is 20 px, which is under the 44 px rule. It is the one text that may be, and the list
is in `tools/test-layouts.mjs`. A mirrored screen has the same frames, so the same
rivets and ids. Alerts and announcements have neither.

`tools/test-layouts.mjs` has one test for each style. It loads the stylesheet of the style
with the css it overrides, which is every stylesheet `index.html` links apart from the other
two styles, and the stylesheet of every panel. It fails when a custom property that a rule
for that style reads has no value in those files, in a script (the numbers of the layouts,
and the few names that a script writes) or in a fallback, and when a text is under 44 px.
The text that may be is the explicit list: the stamped plate id, 20 px, which only Original shows,
and for Minimal the labels of the narrow war clock, 20 and 24 px. Cybertron's wide war clock has none. A rule for
another style, or for a layout the style never has, is not looked at.

### Frames

The bar layout has three frames of its own. `core/plate.js` makes their shapes with
`makeBarShape`: the main panel's (`bar-main`), the banner's (`bar-banner`) and the
ticker's (`bar-ticker`). The main panel and the ticker are areas, and `core/areas.js` asks
`frameKind` which frame an area has: the large panel has `bar-main` in this layout, and
the ticker has `bar-ticker`, where in the other layouts it has none. The banner draws its
own, as the countdown does (`plateMarkup('bar-banner')`). Minimal has its own three (see
"Minimal"), and Minimal is the only style with the bar layout, so these three are what
`frameKind` gives only for a bar page whose style has no frames of its own, which no style is
now. They carry all of Cybertron's decoration, which is how the bar layout was drawn before
Cybertron took the layout of its theme, and the tests still hold them to their numbers.
Cybertron has the layout of Original and so has four frames of its own, the sizes of the
frames of that layout (see "Cybertron"). All of them are made by the same function from the
same markup. The markup has everything, and `base.css` and the style's own stylesheet show
what the style has.

Every frame is a rectangle with ten corners, its line 4 px inside the edge of its box. It has
a cut corner at the top left and the bottom right, and a step at the top right and the bottom
left, which is the cut corners turned half way round. The corners run clockwise from the
bottom left: 0 is the bottom left corner, one step above the bottom line, 1 and 2 are the
two ends of the top left cut corner, 3 and 4 are the ends of the step at the top right, 5 is
the top right corner, one step below the top line, 6 and 7 are the two ends of the bottom
right cut corner, and 8 and 9 are the ends of the step at the bottom left.

| Frame | Drawn for | Cut corner | Step | Run | Bolts |
|-------|-----------|------------|------|-----|-------|
| `bar-main` | 1427 x 708 | 56 | 24 | 150 | 6 |
| `bar-banner` | 1856 x 160 | 56 | 24 | 150 | 6 |
| `bar-ticker` | 1856 x 72 | 32 | 16 | 100 | 2 |

The run is how far from its corner a step starts. The main panel is drawn for the area
before it is scaled (1427 is `areaWidth` in `core/layout.js`), and its header band is the same
116 px high as the large frame's, which is 120 px on the screen. The ticker is only 72 high,
so its cut corner is 32 and it has two bolts, and it has no conduit or slashes, which would
cross its text. It also has no hazard stripe, because it has no header. The banner and the
ticker are as big as their regions. A frame is not turned by the mirror. It keeps its
shape and its corners, as the frames of the other layouts do, and only the regions move.

From the bottom up, each half of the edge is drawn like the other frames: the shadow, the
dark rim, the steel face, the shade and the ridge. The steel is the metal in `tokens.css`
(`--metal` tokens for `data-metal="steel"`) with its three gradients in `index.html`. Both
styles give it to the html element and to every area, so the frame metal and the page change
never change it, and `core/areas.js` makes no change of metal for either style. Then come the
neon lines, on one path that is the outline 10 px inside, so they follow every corner.

| Part | What it is | Where it is |
|------|------------|-------------|
| Neon line | 4 px, `--style-neon` | 10 px inside the edge, both styles |
| Wide neon lines | the same path at 14 px and .25 opacity, and at 24 px and .12 | Cybertron only, and not in the flat finish |
| Hex bolt | a hexagon 33 px wide and 38 high, with a dark rim, a silver face and a dot | at the joints: corners 1, 2, 5, 6, 7 and 0 (the ticker has 2 and 7) |
| Armor tab | a gradient, a dark bevel, a bright line up and left, and the team's plate color inset | the header of the main panel, 664 px across at the top and slanted at the end |
| Hazard stripe | 12 px high, slanted bars 22 px wide every 44, in the team's accent | under the header, Cybertron only |
| Conduit | a 3 px pink line, `--style-pink` | 16 px inside the edge along the top left corner and the top, and along the bottom right corner and the bottom, and under the hazard stripe |
| Slashes | six slanted bars in the neon, 22 px wide every 40 | along the bottom, at the right end, Cybertron only |
| Brackets | a 4 px pink line, with a leg of 60 px down the side and 70 px along the top | 22 px outside the top left and the bottom right cut corners, Cybertron only |
| Plate seams | three faint dark lines, 3 px | across the body of the main panel, Cybertron only |

The bolts are drawn where the screws of the other frames are and have the same class, so
they turn in and out in the same page change, and the Plain look takes them away. The ticker
holds still while its message changes: its four frame svgs have other names than the ones the
page change lifts (`still-frame-a` and the others), and its bolts do not turn. Everything
Cybertron draws on a frame is in one group (`data-part="decor"`), which comes in after the
lines are drawn. Nothing in a frame is animated, apart from the arrival and the page change
that every frame has, and nothing is a picture or a filter.

The mechanical page change breaks the main panel's frame into 12 pieces, with the same names
as the large frame's pieces, so `frame.css` moves them the same way. The decoration is a
plate of its own (`plate-decor`), the armor tab's details are in the plate of the tab, and the
bars carry their neon lines and their bolts. Each bolt is in one piece. The bars put end to
end are the whole outline. Because the neon line is found by moving points of the outline,
a piece finds its own the same way.

To change a size, change it in `barFrames` in `core/plate.js`, and the same number in this
section. The cut corner of Cybertron is also `--style-chamfer` in `styles/cybertron.css`, and
Minimal's is the one in `styles/minimal.css`.
Run `node tools/test-layouts.mjs`: it holds the shapes to the sizes of the layout, finds
every frame inside the 1920 x 1080 screen, in the layout and in its mirror, and checks the
numbers in the table above.

#### Minimal

Minimal draws the same three frames with shapes of its own: `bar-main-minimal`,
`bar-banner-minimal` and `bar-ticker-minimal`. They have the same ten corners with smaller
cuts, and the table is read as the one above.

| Frame | Drawn for | Cut corner | Step | Run | Bolts |
|-------|-----------|------------|------|-----|-------|
| `bar-main-minimal` | 1427 x 708 | 34 | 16 | 100 | 4 |
| `bar-banner-minimal` | 1856 x 160 | 34 | 16 | 100 | 4 |
| `bar-ticker-minimal` | 1856 x 72 | 20 | 10 | 60 | 4 |

Frames are drawn once and stay for as long as the page is up, so the corners are chosen
when the page starts. `core/style.js` writes `data-shapes` on the html element then
(`shapesFor`), and `frameKind` in `core/plate.js` gives the name of the frame for it. A page
that goes to Minimal, or back from it, is drawn again: it changes layout, so it reloads once,
with the same guard (`drawnFor` and `mustReload` in `core/layout.js`). A page that changes the
colors, the theme or the team does not.

What Minimal draws on a frame is in the same markup as the rest, and `styles/minimal.css`
paints it. It has none of Cybertron's decoration: no wide neon lines, hazard stripe,
conduit, slashes, brackets or plate seams. Its frames have no stamped id or any other
serial text, and its page has no scanlines and no raised plate. The `//` mark at the right end
of a panel's header is off, as the pictures of Minimal have none and the ticks stand there.

| Part | What it is | Where it is |
|------|------------|-------------|
| Neon line | 4 px, `--style-neon`: one neon line, with none of the wide ones | 10 px inside the edge |
| Hex bolt | the same bolt as Cybertron's | the four joints: both ends of the top left and of the bottom right cut corner |
| Rivets | dots of 5 px radius with a dark rim, one every 90 px, as Original's | every straight edge of 180 px or more |
| Rust | rust at the two bottom corners of every frame: an arc of 4 px, `--style-rust`, with a soft patch under it that is a radial gradient (`wear-rust` in `index.html`) | one arc on the left edge just above the step, bulging into the frame, and one on the bottom edge just before the cut corner |
| Weld seam | a dark 3 px line with a faint light 3 px line 4 px beside it | the main panel only, at x = 1188, from under the header to just above the bottom. It is 36 px past the 1152 the pages are written for, so it crosses no text |
| Header line | a 3 px neon line | along the foot of the header, with 39 ticks standing on it: every 18, 4 wide and 10 high, from the slanted end of the tab to the right edge |

The armor tab is the same as Cybertron's, with the team's plate color inset and two colors of
its own (`--style-armor-top` and `--style-armor-bottom`). The plates are the team's background
color. The rust is on the steel, in the second half of the frame and in the pieces of the page
change that have the corners, and it comes in with the rivets once the lines are drawn. The
flat finish leaves it off. The grid, the rivets and the rust never move. The mirror turns the
regions and not the frames, so the same frames, rivets, rust and seam are at the same
corners of a mirrored screen.

What Minimal and Cybertron share, and why. The order gives both a steel edge with a neon line
inside it, hex bolts, a raised armor header with the team's plate color inset, and a grid on the
page, and one function in `core/plate.js` draws both. So they share the steel (`tokens.css`), the
4 px neon line, the hex bolt, the armor tab, the rule that gives a plate its face (it reads
`--style-body`, which is gunmetal in one and the team's background in the other), the TEAM plate
and the ticker's tag in the plate color, the hawk's outline in the team's accent, the grid layer (96 px in Cybertron and 48 px in
Minimal, both at .07, each in its own stylesheet), the header without a `//` mark, and the war
clock, which is the same clock in two forms. Everything else is one style's. In
`styles/minimal.css`: the rivets, the rust, the weld seam, the header line and its ticks, the rail,
the 34 px cuts and the plates in the team's background color. In `styles/cybertron.css`: the
gunmetal body, the wide neon lines, the hazard stripe, the conduit, the slashes, the brackets, the
plate seams, the scanlines, the 56 px cuts and the amber digits. `tools/test-minimal.mjs` lists
what is shared, so a new shared rule fails it until the list says so.

The main panel shows the same rows the panel always showed. Neither style adds a colored
chip in front of a title, and no panel is laid out as chip, title and place. The panels keep
their rows, their line limits and their rules, and only the text is bigger, because the main
panel is scaled up (see "The width of the main panel").

## Cybertron

Cybertron has the layout of its theme, as Original does: the banner across the top, the
large frame on the left, the countdown over the small frame on the right and the ticker
across the bottom, or the sidebar layout for Neon Prime. What it changes is the drawing. Every
frame is a plate of gunmetal (`--style-body`, `#15181f`) with a steel edge, the neon of the team
just inside the edge and two wider and fainter lines of the same neon outside it, and the
countdown is the war clock in place of the red frame. `styles/cybertron.css` paints it and
`core/plate.js` draws the four frames. The mirror turns it as it turns Original, with the same
rules (`styles/original.css`). Nothing Cybertron draws moves of its own, apart from the arrival and the
page change that every frame has.

The sidebar layout (Neon Prime) has the large frame and the ticker of Cybertron, scaled as they
are for Original. Its column keeps the red countdown, because the war clock is 616 wide and the
column is 384.

The arrangement is Original's with the plates of Cybertron drawn on it. The panels in the
large and the small frame are not changed: the frames are the sizes of Original's, and the
headers are as high.

### The stage

The stage of the standard layout is laid out for the banner's plate, which is 16 higher than the
banner of Original. The 16 come from the top margin and from the two gaps, so the large frame, the
countdown and the small frame keep their sizes, the large frame is 6 lower, and the ticker is where
it is in Original. The rule is in `styles/cybertron.css`, for the standard layout only. All lengths
are pixels of the 1920 x 1080 screen.

| Part | Cybertron | Original |
|------|-----------|----------|
| Top margin | 20 | 24 |
| Banner | 228 | 212 |
| Gap under the banner and under the large frame | 14 | 20 |
| Large frame, and the countdown over the small frame | 708 | 708 |
| Ticker | 72 | 72 |
| Bottom margin | 24 | 24 |

20 + 228 + 14 + 708 + 14 + 72 + 24 is 1080. The side margins are 40 and the columns are 1152
and 656 with 32 between them, as in Original. The countdown is 320 high and the small frame 372,
16 apart. A test works out the boxes from the stylesheet and finds every frame, with its bolts and
its brackets, inside the screen, in the layout and in its mirror.

### The frames

`core/plate.js` makes four frames with `makeBarShape`, the function that makes the frames of the bar
layout, each the size of the frame of Original that it stands in for. `frameKind` gives their names
(`core/style.js` says that Cybertron has its own corners with `shapesFor`), and `core/areas.js` and
the banner draw them. The corners are numbered and drawn as in "Frames".

| Frame | Drawn for | Cut corner | Step | Run | Bolts |
|-------|-----------|------------|------|-----|-------|
| `cybertron-grid1` | 1152 x 708 | 56 | 24 | 150 | 6 |
| `cybertron-grid2` | 656 x 372 | 56 | 24 | 120 | 6 |
| `cybertron-banner` | 1840 x 228 | 32 | 16 | 100 | 6 |
| `cybertron-ticker` | 1840 x 72 | 32 | 16 | 100 | 2 |

The large and the small frame have a header as high as the ones they stand in for (120 and 84), an
armor tab with the team's plate color inset, the hazard stripe in the team's accent under it, the
pink conduit along the top and under the stripe, six slashes along the bottom at the right end, pink
brackets outside the top left and the bottom right cut corners (legs of 60 down and 70 along on the
large frame, 40 and 50 on the small one), faint plate seams across the body (three on the large
frame, at 264, 408 and 552, and two on the small one, at 160 and 252), and the 12 pieces of the
mechanical page change. The banner has the conduit and the brackets, and the ticker only the
brackets, with legs of 40 and 50: it is 72 high and has no room for more. The banner and the ticker
are one plate each, and the ticker holds still while its message changes. None of the four has
rivets, rust or a stamped plate id. The rivets are Original's and Minimal's, the rust is Minimal's
and the id is Original's. All of it is in the markup,
and `styles/cybertron.css` shows it. The wide neon lines are left off in the flat finish.

The `//` mark at the right end of a panel's header is not drawn in Cybertron (`.header
svg.double-slash` is hidden, as the Plain look hides it). The step at the top right is where its
top would be, and the pictures of Cybertron have no mark there. A seasonal pack's own mark is
another picture (`pack-mark`) and stays.

### The wide war clock

The countdown of Cybertron is the war clock in its wide form, 616 by 200, in the middle of the
countdown's region (656 by 320): 20 from each side and 60 above and below. It is the war clock of
the bar layout (see "The war clock") laid out for 616 by 200, and it has the same source: the dates,
the labels and the second tick come from Dashboard Settings, and `startCountdown` is given
`{ war: true }`, so the label has no IN, the days are two digits (three from 100) and every number
changes at once. The code is `warMarkup('wide')` in `panels/countdown/countdown.js`, which `mount`
puts in a slot (`.war-slot`) of a panel of its own (`.countdown-war`), the rules at the end of
`panels/countdown/countdown.css`, and `warHousingMarkup('wide')` in `core/plate.js`. The panel has
one part that arrives, the slot (`countdown-war` in the table of `frame.js`), and no part of the
clock has a line of its own. The narrow form is as it was, and Minimal keeps it.

The housing is the narrow one's at another size: a plate of steel with the edge of the frames, a cut
corner of 34 at the top left and the bottom right, four rivets, one weld seam between the label and
the plates, and rust at the bottom left and the top right. The rust is a soft patch and a short
stroke, the flat finish leaves it off, and it never moves. Every part is placed by hand, counted from
the top left corner of the housing:

| Part | Top | Height | Left | Width | What it holds |
|------|-----|--------|------|-------|---------------|
| `.war-status` | 33 | 14 | 52 | 14 | the red square, which is `--danger` |
| `.war-lines` | 18 | 44 | 74 | 494 | the label in capitals on the left and the date at the right end, on one line at 44 px with the letters spaced |
| `.war-days-plate` | 68 | 102 | 22 | 248 | the days at 76 px and DAYS beside them at 44 px |
| `.war-time-plate` | 68 | 102 | 278 | 300 | the hours, minutes and seconds at 52 px, with HRS, MIN and SEC under them at 44 px, in three cells of 98 with a bar of 3 px between two cells |

The plates, the digits and the colors are the narrow clock's: `#0c0b09` with a 3 px border of
`#2b2a26`, amber digits from `--style-digits`, a date, DAYS and labels that are a little fainter,
orange in the last 30 days, and white with red borders in the last 7. The rivets are 5 px, one at
each corner, clear of the plates and of the rim. The text is all 44 px or more, so the wide clock is
not on the list of text under 44 px, which only the narrow clock and the stamped ids are on.

**What it shows.** The label is the label from Dashboard Settings in capitals, with no IN, and the
date is at the right end of the same line, as `JAN 9`, or `NOW` for the rest of the day when the time
has come. After Rollout the label is COUNTDOWN OVER, and while no date is set it is DATE NOT SET, the
words the standard countdown shows, on the same line with no date, with the days at 00 and the time
at 00 00 00.

**What fits.** The numbers come from the advance widths of the display font, without kerning, which
only makes a word narrower. Two digits at 76 px with DAYS at 44 px and the letters set .04 em and .03
em closer are up to 225 wide (at 99 days), in the 242 that is inside the plate's border. Three digits
at that size would not fit, so 100 days or more is drawn at 56 px, and the widest of those is 236. The
widest pair of time digits at 52 px is 76 wide in its box of 96, and HRS, MIN and SEC are 93, 88 and 87
in their cells of 98. KICKOFF is 217 wide and the widest date is 192, so with 24 between them they are
433 of the 494, and ROLLOUT is 232 and makes 448. COUNTDOWN OVER, with no date, is 476. A label that
is too wide for what the date leaves is cut off with an ellipsis, as the standard countdown's is.
This has been worked out from the font and not looked at on a screen.

**The mirror.** The slot is in the countdown's region, which is in the left column when the layout is
mirrored, and the clock in it is the same picture: the label at the left, then the days, then the
time. It reads from the left like every plate, and nothing turns it round.

### The banner

The banner stands on `cybertron-banner`, which is the whole banner box, 1840 by 228. The steel, the
neon and the bolts take up the first 20 or so inside it, so the parts of the banner are laid out in
what is left. They are the parts of Original's banner (`panels/banner`), with the plate drawn first
under them, and `styles/cybertron.css` has the sizes:

| Part | Size |
|------|------|
| Content | 1752 x 192: 18 from the top and the bottom, 40 from the left and 48 from the right |
| Hawk | 187 x 150, which is Original's 219 x 176 at .854 (`--k` is .17) |
| Name | 72 high, with the TEAM plate directly under it |
| TEAM plate | 76 high, as in Original |
| Bottom row | 44 high, as in Original: the wordmark, DASHBOARD, the bar and the school |
| Clock and date | 8 lower than in Original, clear of the step at the top right |

The name and the TEAM plate are 148 and the bottom row is 44, which are the 192. The hawk's top left
corner is about 27 from the line of the cut corner at the top left, and the end of the bottom row is
about 18 from the line of the cut corner at the bottom right, where 16 is the neon, its width and 4
more. The clock ends before the bolt at the top right. The numbers are worked out and held by
`tools/test-cybertron.mjs`, and have not been looked at on a screen. The SAMPLE CONTENT badge
stays level with the TEAM plate, as it is in Original. The banner line of a seasonal pack takes
the place of DASHBOARD and the bar, as it does in Original.

### The ticker

The ticker's frame is `cybertron-ticker`, as big as its area (1840 by 72). The tag and the message
start 16 in from each end, which puts the tag over the plate's cut corner as the bar layout has it.
The mirror turns the row round and the padding is the same on both sides. In Original the ticker has
no frame, and the area draws only its two slats.

### The mirror

The standard layout is turned by `styles/original.css`, and its rules are for the layout and not for a
style, so they turn Cybertron as they turn Original: the two columns change places, the banner's
hawk goes to the far end and the clock to the left end of the name block, and the ticker's tag goes
to the right end. The frames are not turned: they keep their shapes and the pages in them read from
the left. The one thing Cybertron adds is the margins of the banner, which change sides so that the
hawk and the bottom row are as far from the cut corners as they are when it is not mirrored.

### When the style changes

Frames are drawn once for an area, so a style with other frames has to draw them again. Original and
Cybertron share a layout, so the page does not reload when the style changes between them. In the
step that puts the style on the page (`useStyle` in `shell.js`, at the moment the large frame is
apart), `shell.js` writes the corners of the new style (`recordShapes` in `core/style.js`), asks
`redrawFrames` in `core/areas.js` to put the new frame round each area that is on screen, and
draws the banner and the countdown again, because those two draw their own. Only the frame is
replaced: the page in each area stays where it is. A change to or from Minimal is a change of
layout and reloads the page once, as before.

Look at it with `?style=cybertron&night=off&hidden=off` on the address, with `?team=nova` for the
mirror, and with Style in Dashboard Settings changed between Original and Cybertron on the open
screen ("Looking at a layout" has the list of what to check). `node tools/test-cybertron.mjs` checks
the numbers in this section against the code.

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
  waits for no small frame. The bar layout has four too: the banner, the side
  column, the main panel and the ticker, with the poses of the column and the main
  panel in `layouts/bar.css`. The rebuild is the frames falling into a pile and
  coming back (docs/hidden-transitions.md): they fall as the pieces they are drawn
  in, in every layout, and the strip and the sidebar fall whole.
- **Alerts, announcements, the night screen, the demo and the connection text**
  are layers as big as the screen. They do not depend on the layout, and cover it.
  The connection text is as wide as the ticker at most, as it is in the standard
  layout, and in the bar layout it is moved to the ticker's own corner.
- **Seasonal packs**: the header mark and the pieces over the panels work in
  every layout. The zone and back decorations of the packs (strings of lights,
  the scene along the bottom, pieces in the margins) were measured on the
  standard layout, and are drawn only there. In the sidebar layout they are left
  out (`decorationLayers` in `core/layout.js`, `setLayers` in `core/season.js`), and
  so are they in the bar layout. Cybertron has the standard layout and draws the back
  layer, and `styles/cybertron.css` hides the front layer, because the bolts and brackets of
  its plates are where some of the zones were measured to be empty. The corner art of a pack
  is in the cut corners, which are zones, so only Original with the standard layout draws it. The ticker prefix shows in every layout. The
  banner line shows in the standard banner and the bar layout's side column, and not in the
  sidebar layout. docs/seasonal-packs.md has the details.
- **The test switches** work: `?stress` shows the large frame and the ticker
  together (there is no small frame to show), `?only=tasks` shows only the large
  frame, `?perf` shows the readout in the bottom right corner, and `?show=` with
  a large panel of the Panel order list shows that panel. `?show=` with a small panel
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

- The small frame (Grid 2) and the five small panels of the Panel order list: task
  counts, safety days, next event, sponsor logo and the weather forecast. The
  sidebar shows only the temperature and the picture of the weather, not the
  high and the low. Task counts, next event and the sponsor logo have larger
  relatives that stay among the large panels (Tasks, Events and Sponsor
  feature). Safety days and the forecast have no large version, so editors who
  want them on the screen pick another theme.
- The wide banner of the standard layout (logo, name, school, date, clock,
  weather and wordmark across the top). The strip and the sidebar hold the same
  things, and they are the same panel's data. The wordmark is the one thing left
  out: at 44 px high it is wider than the column.
- The strings of lights, scenes and pieces in the margins that a seasonal pack
  draws (its zone and back decorations), and its corner art. The pack's header mark, the
  small pieces over the panels and the ticker prefix do show. The banner line does not: the
  strip has no free line of 44 px, and the date and weather fill the slot at its right end.
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
Without `?theme=` the screen follows the Look page, and reloads once when the
theme with another layout comes on. For the bar layout use `?style=minimal`, for example
`http://localhost:8080/dashboard/?style=minimal&night=off&hidden=off`, and for Cybertron
`?style=cybertron`, which has the layout of the theme.
To look at the mirror, add `?team=nova` to the address, which shows the Nova team with
its mirror whatever Team mode says, with the sample content or with the team documents.
Or type `document.documentElement.classList.add('mirrored')` in the browser's console,
and take the class off again with `remove`. It is the class the Teams setting puts on
the page for a team with Mirror on. The Preview buttons on Dashboard Settings show a
style or a team on the real screen for 2 minutes (docs/hidden-transitions.md).

To check the frames of Cybertron by hand, open `?style=cybertron&night=off&hidden=off` and look
at each of them, then add the class `mirrored` as above and look again:

1. Each frame is closed, with a cut corner at the top left and the bottom right and a step
   at the other two, and a bolt at each of those corners. The frames are the same in the
   mirror: only the regions move.
2. The neon line is just inside the steel edge all the way round, and the pink conduit is
   just inside the neon. The title of a panel and the last row of text do not touch the
   conduit, the neon or the slashes.
3. The hazard stripe is under the header, from edge to edge, and the tab is above it, on the
   large frame and on the small one.
4. The brackets are outside the frames and do not touch the frame next to them, and nothing is
   outside the screen.
5. Watch a page change with Page change style set to mechanical (Look tab): the
   frame breaks into pieces, the decoration goes with them, and everything comes back in
   place. The ticker's frame stays still while its message changes.
6. The hawk, the name, the TEAM plate, the clock, the date and the bottom row of the banner are
   inside the plate, and none touches the steel or a bolt. The war clock is in the middle of
   the countdown's place, and its days, hours, minutes and seconds change at once.
7. With the screen open, change Style in Dashboard Settings between Original and Cybertron. The
   screen does not reload: the frames, the banner and the countdown change in one step.

Then open `?style=minimal&night=off&hidden=off` and look at the three frames again, in the layout
and in the mirror:

1. The cut corners are smaller: 34 on the main panel and the banner and 20 on the ticker. There
   is a bolt at both ends of the top left and of the bottom right cut corner, and none at the
   steps.
2. There is one neon line just inside the steel, with no wider glow lines, and there is no
   hazard stripe, conduit, slashes, brackets, plate seams or scanlines, and no `//` mark in a header.
3. Rivets run along the long straight edges, one every 90 px, and none along a short one.
4. There is rust at the bottom left and the bottom right of each frame, and it holds still.
   The Flat look takes it away.
5. There is no stamped id and no serial text anywhere. The weld seam stands to the right of the
   pages, and it crosses no text on any large panel of the Panel order list. The ticks stand on the
   neon line at the foot of the header and do not touch the title.
6. With the screen open, change Style in Dashboard Settings between Cybertron and Minimal. The
   screen reloads once, because the layout changes, and then has the new style.

To check a layout by hand, look at every large panel of the Panel order list with
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
   that gives the variables. Every rectangle is in pixels of the 1920 by 1080
   canvas. Use no percent of the window, no media query and no unit of the window.
3. Put its markup in `index.html` (hidden, like `#region-sidebar`) and have
   `layout-apply.js` set it up (`placeRegions`) when the layout is chosen.
4. Write `dashboard/layouts/wide.css`, link it in `index.html` after
   `frame.css`, and start every selector with `html[data-layout="wide"]`, so the
   other layouts are never touched. `tools/test-layouts.mjs` fails for a rule
   that does not.
5. Give a theme `layout: 'wide'` in `dashboard/themes/registry.js` and in
   `studio/themes.js`, and add it to the checks in `tools/test-layouts.mjs`,
   including the two that keep a layout inside the screen ("The screen is a fixed
   canvas").
6. Or, if a style should have the layout, add the style's name to `forcedLayout` in
   `dashboard/core/style.js`.
7. Run every test (docs/where-things-are.md, "Checking your work").
