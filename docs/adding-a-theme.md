# Adding a theme

A theme is a set of colours for the whole screen. The example adds a theme
called Ocean. Do the steps in order.

A theme changes colours and nothing else, with one exception: it may name a
layout, which says where the regions of the screen sit (see Layouts below). It
cannot move anything, change a size or add an animation. The metal on the frame
edges is not part of a theme: Frame metal in Dashboard Settings chooses it (Neon Prime is the one exception, see below). The hawk logo keeps its brand
colours unless the theme sets the three logo variables below.

## 1. The CSS file

1. Copy `dashboard/themes/alternate.css` to `dashboard/themes/ocean.css`. The
   file name is the theme's id. Use lowercase letters, digits and dashes.
2. In the new file, change the selector `html.theme-alternate` to
   `html.theme-ocean`. The part after `theme-` must be the id.
3. Change the colours. Keep every variable in the list below. A theme file
   holds variables and nothing else: no sizes, no rules for panels.
4. Write the colours as `#rrggbb`, or as `rgba(r, g, b, .16)` for
   `--yellow-faint`. A value like `var(--lilac)` is allowed and means "the
   same as that variable in this file".

The variables a theme must set, and what each is for:

| Variable | What it colours |
|----------|-----------------|
| `--ground` | behind everything, the banner and the full screen announcement |
| `--plate` | the body of a plate |
| `--card` | a card standing on a plate |
| `--purple` | the header tabs, the team plate and the ticker tag. The name is old: it is whatever colour the tabs are |
| `--purple-dark` | a darker shade of the tab colour, for the shaded side of the silhouette |
| `--yellow` | the accent, for text and small marks |
| `--white` | the main text |
| `--lilac` | the quiet text, such as the subteam beside a task |
| `--yellow-faint` | the accent at 16 percent strength, for the sweeping bar of light |
| `--danger` | red lamps, stripes and the bar beside a blocked task |
| `--danger-bright` | red text on a dark red plate, such as the connection status text |
| `--danger-plate` | the countdown plate and the band behind a blocked task |
| `--danger-hot` | the full screen alert and the countdown in its last week |
| `--danger-dark` | the unlit blocks of the countdown rail |
| `--status-progress` | an in progress task |
| `--status-next` | an up next task |
| `--status-done` | a done task |
| `--status-blocked` | a blocked task |

A theme may also set these, and leaves them out to keep the brand look:
`--logo-purple`, `--logo-tail` and `--logo-far` (the three colours of the hawk)
and the four `--silhouette-` variables (the picture shown for a person with no
photo, which follow the colours above).

The same list is in `dashboard/themes/required.js`, which the check reads, and
at the top of `dashboard/themes/hawktimus.css`.

## 2. The registry

Open `dashboard/themes/registry.js` and add a line to the list:

    {
      id: 'ocean',
      name: 'Ocean',
      description: 'A deep blue look.',
    },

The name is what editors see in Studio. It starts with a capital letter and has
no dash. The description is one line.

You do not need to link the file anywhere. The screen reads the registry and
links `themes/ocean.css` itself. Only `hawktimus.css` is linked in
`index.html`, because the screen needs it before anything is drawn.

## 3. The Studio's copy of the registry

The Studio is built on its own and cannot read the dashboard folder, so it has
its own copy of the list. Open `studio/themes.js` and add the same entry to
`themes`, with the same id, name and description.

## 4. Check it

Run these in the terminal, from the top folder:

    node tools/check-themes.mjs
    node tools/test-themes.mjs
    node studio/check-schemas.mjs

`check-themes.mjs` fails if the file is missing a variable, holds anything but
variables, or has no entry in the registry. It also fails if any text colour is
under 7 to 1 contrast against the background it is drawn on, for example
`--lilac` on `--plate`. It tries your theme alone and with every overlay
(seasonal pack) on top. The pairs it tests are listed at the top of the script. A
colour that fails is printed with its ratio. Make the text lighter or the
background darker. A screen is read from 20 feet away, so this is not a
suggestion.

`check-schemas.mjs` fails if `studio/themes.js` and the dashboard registry say
different things. It also runs `check-themes.mjs`, so it fails when that does.

## 5. Look at it

Open the dashboard with `?theme=ocean` on the end of the address, for example
`http://localhost:8080/dashboard/?theme=ocean`. The address wins over the Theme
page in Studio, for that page only. Look at every panel. Use `?demo=alert` for
the alert, and `?overlay=none` to be sure no overlay is on top.

## 6. Use it

Run `npm run deploy` in the studio folder so the editors see Ocean in their
list. The dashboard has it when the Mini next pulls the repo. Then, in Studio,
open Theme and either:

- pick it as the Default theme,
- pick it under "Use a theme now" to show it at once (set Until to end it by
  itself), or
- add a rule to the Schedule with the kind Theme, a start date and an end date.

## Layouts

A theme may name a layout in its registry line, with `layout: 'sidebar'`. A
layout is where the regions of the screen sit. A line with no `layout` has the
standard layout, the one every theme had before: the banner across the top, the
large frame and the small frame, and the ticker. Neon Prime has the sidebar
layout: a strip across the top with the team name on one line, under it a column on
the left with the clock, countdown and logo, and one big frame on the right, and the
ticker across the whole bottom. **It has no small frame**, so the
panels in the Small panels list are not shown while it is on, and the Large
panels list is the rotation of the one frame.

Put `layout: 'sidebar'` in the line in `dashboard/themes/registry.js` and in the
same line in `studio/themes.js`, and say in the description that the theme has a
sidebar and no small frame, so editors know what they are picking. The layout is
set before anything is drawn. When the screen is running in one layout and the
theme changes to a theme with another, the page reloads once, in the moment the
new theme would have gone on. Changing between themes with the same layout is
only colours. docs/layouts.md has the numbers, how the big frame is scaled and
how to add a layout.

## Neon Prime

Neon Prime is the theme with the sidebar layout (above). It is dark: a near
black violet ground, deep indigo plates and dark purple tabs, with frames of
gunmetal (dark steel) and three bright colours used sparingly: electric cyan,
hot magenta and amber. There is no green in it (a check fails for one, see
"No green" below). It is a mix of cyberpunk (the thin strokes, scan rules, tick
marks and neon) and giant machines (the cut corners, chevron bars, hazard
stripes and screwed steel plates). Everything is a flat
colour. There is no glow, blur, shadow, gradient that fakes a glow, or video, and
the decoration does not move. What does move is the kit, a set of seven neon
effects (docs/layouts.md, "The kit"). The Mini has not been tested with this
theme. Its speed with the layout and the kit is not known, so look at
docs/try-it-on-the-mini.md.

It is made of four files:

| File | What is in it |
|------|---------------|
| `dashboard/themes/neon-prime.css` | the 18 required colours, the three logo colours and the four silhouette colours. Nothing else, like every theme file |
| `dashboard/themes/decor/neon-prime-decor.css` | the neon colours that are not text, the gunmetal, the neon trim on the metal, the steel frame of the strip across the top, the marks on a page's header, the ticker tag's hazard bar, and the rail and the countdown's frame in the sidebar |
| `dashboard/layouts/sidebar.css` | where everything sits (docs/layouts.md). The theme does not move anything |
| `dashboard/neon-kit.css` | the kit: the lines, ticks and brackets that move, and every keyframe that moves them. It is a motion file and not a theme file, so it is next to `frame.css` and not in `themes/`. `tools/check-themes.mjs` guards it (docs/layouts.md, "The kit") |

The decoration is in its own file because a file in `dashboard/themes/` is a
list of colours and nothing else, and `tools/check-themes.mjs` fails for any
rule in it. `index.html` links the decor file, and every rule in it starts with
`html.theme-neon-prime`, so no other theme is touched. `node tools/test-themes.mjs`
fails for a rule that does not, and for a glow, blur, shadow, filter, text or
animation in it.

### The colours

The text colours reach at least 7 to 1 contrast on the plate they sit on, which
`node tools/check-themes.mjs` checks. The ratios below are on the plate.

| Colour | Value | Used for | Contrast |
|--------|-------|----------|----------|
| `--ground` | `#06030d` | behind everything | |
| `--plate` | `#130a27` | the body of a plate | |
| `--card` | `#1f1141` | a card on a plate | |
| `--purple` | `#2d1a5c` | the header tabs, the team plate, the ticker tag | |
| `--purple-dark` | `#1b0f3f` | the shaded side of the silhouette | |
| `--yellow` | `#ffae2b` | amber, the accent: headings, numerals, the date, the team number, small marks | 10.3 |
| `--white` | `#f4f1ff` | main text | 17.2 |
| `--lilac` | `#b8a8ff` | quiet text | 9.2 |
| `--yellow-faint` | `rgba(255, 174, 43, .16)` | the sweeping bar of light | |
| `--danger` | `#ff2e63` | red lamps and stripes | |
| `--danger-bright` | `#ff93ab` | red text on the dark red plate | 9.1 |
| `--danger-plate` | `#1f0712` | the countdown plate, the band behind a blocked task | |
| `--danger-hot` | `#5a0a22` | the alert, the countdown in its last week | |
| `--danger-dark` | `#330b1a` | the unlit blocks of the countdown rail | |
| `--status-progress` | `#2de6ff` | in progress: electric cyan | 12.6 |
| `--status-next` | the same as `--lilac` | up next | 9.2 |
| `--status-done` | `#d7f1ff` | done: ice white, with a check mark | 16.3 |
| `--status-blocked` | `#ff8aa3` | blocked: pink red | 8.6 |
| `--logo-purple`, `--logo-tail`, `--logo-far` | `#6a3fe6`, `#4b27b3`, `#2f1a7d` | the hawk, lighter than the plates so it shows on the dark | |
| `--silhouette-light`, `-shade`, `-cut`, `-slash` | `#4a2ca0`, `#2b1766`, `#0d0620`, `#2de6ff` | the picture for a person with no photo | |

A status is always shown with a shape and a word as well as its colour, as in
the other themes. The four are different hues: cyan (in progress, with two
slanted bars), lilac (up next, an outlined box), ice white (done, a check mark)
and pink red (blocked, a stop sign). The neon colours of the decor file are not
text, so they are not in the contrast check:

| Colour | Value | Where |
|--------|-------|-------|
| `--neon-cyan` | `#2de6ff` | the trim on every frame, ticks, rules and blocks |
| `--neon-magenta` | `#ff2bd6` | the glint (the dash that runs round a frame), blocks, the red frame's trim |
| `--neon-dark` | `#07030f` | the dark half of the hazard stripes |
| `--grid-line` | `#1a0e38` | the faint squares on the pane's plate |
| `--screen-line` | `#0f0725` | the faint squares behind everything |

The amber in the hazard stripes is `--yellow`, so a seasonal pack that
recolours the accent recolours them too (the Christmas pack makes them mint, by
design: the pack is not the theme).

### No green

Neon Prime reads as dark purple and gunmetal with cyan and magenta neon and
amber marks. It has no green: no colour in `neon-prime.css` or in
`neon-prime-decor.css` has a hue from 65 to 175 degrees (yellow green, green and
teal green), unless it is a grey. `node tools/check-themes.mjs` reads both files
(hex colours, `rgb()`, `rgba()`, `hsl()`, `hsla()` and the colour words such as
`lime`) and fails with the file, the line, the colour and its hue, for example
`themes/neon-prime.css line 43: #4dffa6 is a green (hue 150 degrees, teal green)`.
`node tools/test-themes.mjs` makes sure the check does fail, on a copy of the
files with a green added. When a theme needs a third colour next to cyan and
magenta, use amber or orange (hue 15 to 55), or violet or white. The seasonal
packs recolour the accent on purpose (Christmas is green) and are not these
files.

### The gunmetal

The metal of a frame edge is a set of variables, `--metal-1` (the brightest) to
`--metal-8`, with the grime, rim, ridge, glint, shade and flat colour (the
section "The metal" in `tokens.css`). Gold and silver are two sets of them. The
edge is drawn once in `index.html` as gradients that read those variables, and
`core/plate.js` makes a second copy of each gradient for silver. A frame points
at the gradients of the `data-metal` it sits in: the html element has one
(Frame metal in Dashboard Settings) and each large frame area has its own (Frame
finish, chosen at every page change).

Neon Prime is a third metal, and it does not use that setting. The first rule of
the decor file sets the same eight tones and the other six colours on the html
element and on every element that has `data-metal`, so a frame, the banner's
bars, the logo's outline and the gradients all get the gunmetal whether Frame
metal says gold or silver. Because the colours are variables, nothing in
`plate.js` or `index.html` changes, and every other theme is exactly as before.
It is dark steel with a trace of violet and the same worn streaks, nowhere near
white. The ridge, the bright line on the lit edge of a frame, is neon cyan. The
glint is magenta. The screws are dark steel. The red metal of the countdown is
still red, with a magenta ridge.

The flat finish (`?finish=flat`) hides the ridge in every theme. In Neon Prime the
ridge is the neon trim, one plain line and not polish, so the Flat and Plain looks
(Look in Dashboard Settings) keep it, with a rule in the decor file
(`data-look` is set by `core/look.js`). The steel bars (the rail and the countdown's
frame) have the same cyan line in their gradients, and the flat finish takes it
away too, so a second rule gives the three bar gradients back as one cyan line each,
on the flat steel. `?finish=flat` on its own still hides both.
The Look setting does not change anything else about a theme: the colours, the kit and
the seasonal packs are as they were.

Because the metal is the same whatever a page change picks, the usual fade of
the frame while the metal changes is not played in this theme (the end of the
decor file): the frame lifts and drops as it does when the metal stays.

### The decoration, and how to change it

Every decoration is one box with a list of background layers. Each layer is one
flat shape, a rectangle or a run of stripes, written as a gradient with hard
stops, which is how this code draws a plain rectangle (the blocked task rows in
`tasks.css` do the same). The parts:

- **The strip** across the top, with the team name and the clock. Its own plate
  (a placeholder in `layouts/sidebar.css`) is taken away and drawn again as the
  `::before` of `#region-strip`: a thin steel frame, the same bars as the
  countdown's, with two cut corners (top right and bottom left) and a cyan line
  along each cut. The box is the strip's own size and nothing else, so it flies
  apart with the strip in a hidden transition and never reaches the text (the
  bars are 8 thick, the digits of the clock start 16 under the top of the strip
  and the letters of the name 32 in from its side). It is drawn only in the
  sidebar layout. The pane has no decoration of its own outside its frame: the
  lines in the gaps round it, the brackets and everything that moves are the
  kit's (`neon-kit.css`).
- **The page.** Faint squares under the text of a large panel, and on its
  header a hazard bar under the title and a row of ticks on the plate to the
  right of the notch. They sit in the 14 pixels under the header text, which no
  panel uses, and stop before the header's mark. They are not shown while the
  frame is being built or is in pieces for the mechanical page change, and come
  back with it.
- **The ticker.** A hazard bar under the tag.
- **The sidebar.** The column, 384 wide, has no frame of its own: there is no
  room for one round the school and the plate. There is a steel rail in the
  screen's left margin (x 8 to 24) with neon blocks on it, and the countdown has
  its own steel frame with two cut corners and a cyan line along each cut. The
  steel is the banner's bar drawn along the rail and round the countdown and the
  strip, and the flat finish (`?finish=flat`) makes it one plain colour (the Flat
  and Plain looks keep the cyan line along it). The line
  on the right of the column, with its ticks and its racing dash, is the kit's.
- **The screen.** The faint squares behind everything.

While the sample content is on and the page is in the standard layout (the sample
cannot start in the sidebar layout, docs/layouts.md), Neon Prime's colours, its
gunmetal, the trim and the marks on a page go on the standard layout, and the
strip's frame, the ticker's bar and the sidebar parts are left out.

To change a colour, change the variable at the top of the decor file, or the
colour in `neon-prime.css`. To move or resize a block, change the position and
size in its layer: the part before the slash is where it starts, the part after
is its width and height. To take a decoration away, delete its rule. A new
decoration follows the same rules: it starts with `html.theme-neon-prime`, is
flat colour and thin lines, has no text, and does not move. If it does move, it
is a line drawing or a transform written in `frame.css`, like the glint, or in
`neon-kit.css`, which is where the moving neon of this theme goes (see "Adding an
effect" in docs/layouts.md).

The decor file adds no moving element and no layer that is animated. The moving
neon is the glint that already ran round the frames, now magenta, and the kit,
which is nine small parts that move all the time and two short bursts, counted in
docs/layouts.md, "Moving elements".

## How the screen picks a theme

The screen works out the theme and the overlay when it starts and again every
minute, in the Time zone set on the Theme page. In this order:

1. Use a theme now, until its Until time. A part left empty is decided by the
   next step.
2. The Schedule. The first rule of each kind that covers today. Themes and
   overlays are picked on their own.
3. The Default theme, and no overlay.

An overlay may have decorations (a seasonal pack). They go on and come off in
the same step as the overlay's colours (docs/seasonal-packs.md).

A change does not happen in front of people. It waits for the next page change
in the large panel and goes on in the moment its frame is apart. If no page
change comes for a minute, it goes on anyway. At start it goes on at once.
