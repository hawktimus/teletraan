# Adding a panel

A panel is one box on the screen: Tasks, Events, a photo. This page adds one,
using `dashboard/panels/tasks/` as the example. Keep `tasks.js` and
`tasks.css` open beside it.

A new panel touches four places: its own folder, `registry.js`, `config.js`
and the Studio's list of panels. A check tells you when they disagree. Do the
steps in order.

## 1. Pick the details

- **id**: lowercase with dashes, for example `my-panel`. It is the folder
  name and the file names.
- **region**: `grid1` is the large panel on the left (1152 x 708). `grid2` is
  the small one under the countdown (656 x 372). The ticker is 1840 x 72.
- **topic**: what it is about. Grid 1 and Grid 2 never show the same topic at
  once, so Tasks and the task counts both use `tasks`. Give a new panel its
  own topic unless it repeats another.

## 2. Make the folder

    dashboard/panels/my-panel/my-panel.js
    dashboard/panels/my-panel/my-panel.css

Every selector in the stylesheet starts with the panel's own class, such as
`.my-panel .row`, so it cannot touch another panel.

Start the stylesheet with the block below. It gives the panel its size and
places the title and the body. With an empty stylesheet the panel is only
about 250px tall and the title is hidden behind the plate.

    .my-panel {
      width: 1152px;
      height: 708px;
    }

    /* The header sits on top of the two header plates drawn by plate.js */
    .my-panel .header {
      position: absolute;
      left: 0;
      top: 4px;
      box-sizing: border-box;
      width: 1152px;
      height: 116px;
      padding: 0 40px 0 76px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .my-panel .title {
      margin: 0;
      font: 700 var(--size-heading)/96px var(--font-display);
    }

    .my-panel .rows {
      position: absolute;
      left: 0;
      top: 124px;
      width: 1152px;
      height: 576px;
    }

That block is for a Grid 1 panel. For a Grid 2 panel start from the top of
`panels/next-event/next-event.css` instead. It is 656 x 372 and has a `.label`
where Grid 1 has a header.

## 3. Write mount

`mount(host, content)` fills `host.innerHTML` with one `<section>`. Its class
is the id. `data-sequence` names the table in `frame.js` that moves it (see
step 4), and for a grid panel it is the region. `content` is the data from
Sanity, shaped like `dashboard/data/sample/content.json`, plus `events`,
`photos` and `weather`, which may be missing.

    import { plateMarkup, scanMarkup } from '../../core/plate.js';

    export function mount(host, content) {
      host.innerHTML = `
        <section class="panel my-panel" data-sequence="grid1">
          ${plateMarkup('grid1')}
          ${scanMarkup('grid1')}
          <div class="header">
            <h2 class="title" data-part="title">MY PANEL</h2>
          </div>
          <div class="rows">...</div>
        </section>`;
    }

`plateMarkup` and `scanMarkup` (in `core/plate.js`) draw the plate. In Grid 1
the title must stay left of x=664, about 9 capital letters. Keep everything
16px inside the frame and clear of the cut corner at the bottom right. How the
plate is painted is in "The metal look" below.

## 4. Label the parts

Mark each piece that should move with `data-part="name"`. `frame.js` does the
rest. At the top of `frame.js`, the `sequences` table lists the names each
kind of panel understands:

- `grid1`: body, header-left, header-right, outline, seam, title, tag,
  divider, row, content, stud, scan
- `grid2`: body, header-left, header-right, outline, seam, label, row,
  content, scan
- `ticker`: tag, message

The plate labels its own shapes. You label your text. Rows that should
arrive one after another also get `data-index="0"`, `"1"`, `"2"` and so on,
as `tasks.js` does. A part that is not in the table simply appears.

## 5. Skip the panel when there is nothing to show

`hasContent(content)` is optional. When it returns `false` the rotation skips
the panel for now, as `tasks.js` does when there are no tasks. Use
`visibleItems(list)` from `core/content.js` on every list the editors fill
in, so hidden and expired items are left out.

## 6. Add it to the registry

In `dashboard/registry.js`, add one line to the list:

    { id: 'my-panel', region: 'grid1', topic: 'my-topic' },

## 7. Put it in the rotation

The panel's id is written in two more places. They have to match
`registry.js`, and `check-schemas.mjs` fails when they do not.

1. `dashboard/config.js`, in `defaultSettings.rotation`, in the list for its
   region. The number is how many seconds it stays. Grid 1 panels use 16 and
   Grid 2 panels use 12, the same as the Studio's starting values:

       { panel: 'my-panel', show: true, seconds: 16 },

2. `studio/schemas/settingsRotation.js`, in `largePanels` (Grid 1) or
   `smallPanels` (Grid 2). The title is the name editors see in the list:

       { title: 'My panel', value: 'my-panel' },

Put both lines at the same position in their lists. The Studio starts with the
list in `settingsRotation.js`, and the check compares it with `config.js`.

Then run this in the `studio` folder. It needs nothing installed:

    node check-schemas.mjs

Every line must say PASS. A FAIL line names the list that is missing the
panel.

Editors can hide the panel, reorder it or change its seconds in Dashboard
Settings, on the Panels tab. Two things have to happen first:

- Run `npm run deploy` in the `studio` folder so the editors' copy of the
  Studio has the new panel (see Going live in docs/adding-a-field.md).
- If Dashboard Settings already has a saved list, an editor adds a row for the
  panel there. A saved list replaces the one in `config.js`, so until then the
  panel is not on the TV.

## 8. Test it

Start the server with `python3 tools/serve.py` and open:

    http://localhost:8080/dashboard/?show=my-panel

It shows only your panel, 30 seconds at a time. Add `&motion=none` to stop
everything moving. Then check:

- the browser console shows no errors from your files. In sample mode it does
  show 404 lines for files under `data/live/` (the photo list, the calendars
  and `version.txt`) and a warning about a calendar. That is expected: the
  Mini downloads those files, so on your computer the dashboard falls back to
  `data/sample/`.
- no text is smaller than 44px
- nothing crosses the frame or the cut corner
- the panel still looks right with `&finish=flat` added to the address
- the panel looks right with no items, one item, many items and a very long
  title, and text such as `<b>` shows as plain text

## The metal look

The screen is dressed as dark gunmetal armour: steel plates with a bevelled
frame, a purple tab, brass seams and bolts. Purple and gold are the team's
colours. Red is only for danger (the countdown, the alert, blocked tasks). The
look is one small kit, so a panel uses the kit by name and never writes a
colour of its own for metal.

**Colours.** The metal is made from the colour tokens at the top of
`tokens.css`: `--plate`, `--header`, `--rim`, `--purple`, the `--brass-...`
ones and the `--danger-...` ones. To restyle the metal, change those.

**Gradients for SVG shapes.** Each one is drawn once, in the hidden SVG at the
top of `index.html`, and has a token in `tokens.css`. Use the token and never
the colours:

    fill: var(--fill-plate);     steel, lighter at the top
    fill: var(--fill-header);    the steel strip beside a header tab
    fill: var(--fill-rim);       the bright frame round a plate
    fill: var(--fill-tab);       anodised purple
    fill: var(--fill-brass);     brass
    fill: var(--fill-danger-plate);  red-tinted steel
    fill: var(--fill-danger-hot);    brighter red steel (the alert)
    fill: var(--fill-danger-rim);    a red frame

A plain `div` cannot use these, so ordinary boxes use solid colours:
`--plate`, `--card`, `--pocket`, `--ground`, and `--trim` for a brass line.
Lines drawn on top of metal also use tokens: `--groove` (a dark cut),
`--groove-lit` (the light edge below it), `--trim`, `--trim-dark`,
`--trim-lit` and `--bevel-lit`.

**What a plate is made of.** `plateMarkup` draws the body (steel with faint
brushed streaks), the purple header tab, the steel header strip with its
slots, the frame with a thin bevel line just inside it, a brass seam between
the header pieces and under the header, dividers, and bolts on the corners.
You only write the text. The header text goes in a `.header` box on top, as in
step 2. Body text goes straight on the steel and is white, gold or lilac, which
are all 7 to 1 or better on the body of a plate. Keep it that way: do not put
text on a colour you have not checked.

- **Divider.** A groove (dark line, light line 3px below it). Pass the heights
  to `plateMarkup`, as `tasks.js` does with `dividers`.
- **Seam.** A rod of brass: dark brass, brass, then a bright line. They are in
  the shapes at the top of `plate.js`.
- **Card or tray sunk into the steel.** In SVG, draw a polygon with class
  `pocket`, and before it a copy of the same polygon moved 2px down with class
  `pocket-lit`. In HTML use `background: var(--card)` with
  `border-top: 4px solid var(--groove)` and
  `border-bottom: 2px solid var(--groove-lit)`.
- **Label tab.** `tagMarkup(width)` is a small purple tab with a brass edge.
- **Hazard tape.** `repeating-linear-gradient(-45deg, var(--gold) 0,
  var(--gold) 12px, var(--groove) 12px, var(--groove) 24px)`. Use
  `var(--danger)` in place of gold for red tape. It is a still pattern, so it
  is cheap.

**Bolts.** There is one bolt, drawn once in `index.html` as `#bolt`. To add
one to a shape, put its centre and width in `boltMarkup` from `plate.js`:

    import { boltMarkup } from '../../core/plate.js';

    <svg width="200" height="100" viewBox="0 0 200 100">
      ${boltMarkup(20, 20, 24)}           a steel bolt, 24px wide
      ${boltMarkup(180, 20, 24, 'brass')} a brass one
    </svg>

The bolts on the plates come from the `studs` list of each shape at the top of
`plate.js`. Add a point there and the bolt appears, and `frame.js` turns it in
with the others.

**A different colour for one panel.** A panel changes its own plate by
setting these on its root class, and everything inside follows:

    .my-panel {
      --panel-face: var(--fill-danger-plate);  the body of the plate
      --panel-frame: var(--fill-danger-rim);   the frame round it
      --bolt-fill: var(--fill-brass);          the bolt heads
    }

The countdown (red steel), the alert (a red face on a steel frame) and the
announcement (a brass frame and bolts) are done this way, so look at their
stylesheets. A full screen panel gets its frame from `frameMarkup()`, which is
a plate of the same kind.

**The flat finish.** Add `?finish=flat` to the address, or put
`data-finish="flat"` on the `html` element. It swaps every `--fill-...` token
for one plain colour and drops the bevel lines and streaks (the rule is at the
bottom of `tokens.css`). If the screen on the Mini is slow, this is the first
thing to try. A new `--fill-...` token must get a plain colour in that rule
too, or the flat finish will leave a gradient behind.

**To add a new gradient,** draw it once in `index.html` with its stops
reading colour tokens, give it a `--fill-...` token and a flat colour in
`tokens.css`, and use the token.

**Do not:**

- write a hex colour, `rgb()` or a gradient for metal in a panel's own
  stylesheet or script
- use `box-shadow`, `text-shadow`, `filter`, `backdrop-filter`, `blur()`,
  `mix-blend-mode`, 3D transforms or video. They are too slow on the Mini.
- animate the metal. It is painted into still shapes, and only `frame.js`
  moves them, by transform, opacity and line drawing.
- add a layer that covers the whole screen, or a big repeating texture. Put
  the streaks only where the kit puts them.
- copy the gradient stops into a panel, so the colours exist in one place

## The rules

- **No animation code in a panel.** No `@keyframes`, `transition`, `animate()`,
  `setTimeout`, `setInterval` or `requestAnimationFrame`. Everything moves
  through `frame.js` and `frame.css`, where a new effect is added for all.
  Every time there is multiplied by the Speed setting, so a new time in
  `tokens.css` is written `calc(400ms * var(--pace))`, and code that waits
  uses `frame.pace()`.
- **Text sizes** come from `tokens.css`. The smallest is `var(--size-label)`
  (44px), body text is `var(--size-body)` (56px) or `var(--size-body-large)`
  (64px), and headings are `var(--size-heading)` (96px). The big numbers have
  their own tokens, such as `var(--size-stat)`. Colours come from there too.
  If no token fits, add one to `tokens.css`. Do not write a size or a colour
  code in a panel.
- **Escape editors' text.** Anything an editor typed goes through
  `escapeHtml()` from `core/text.js` before it goes into a template. It also
  turns a missing field into nothing, so the screen never says `undefined`.
- **One line per item.** The whole screen is `white-space: nowrap`. Cut a
  long line with `overflow: hidden; text-overflow: ellipsis`, as `tasks.css`
  does, or set `white-space: normal` on a box that should wrap.
- **Placeholders** go in [square brackets]. Never invent names or numbers.
