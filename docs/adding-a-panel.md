# Adding a panel

A panel is one page that goes in a box on the screen: Tasks, Events, a photo.
This page adds one, using `dashboard/panels/tasks/` as the example. Keep
`tasks.js` and `tasks.css` open beside it.

The large panel, the small panel and the ticker each keep one frame for as
long as the screen is up. A panel does not draw a frame. It draws its page,
and the frame stays while the page is swapped. How that works is in "The frame
and the page change" below.

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

The page fills its area, so the stylesheet does not give the panel a size.
Positions inside it count from the top left corner of the area, and the
frame is already there. Start the stylesheet with the block below. It places
the title and the body. With an empty stylesheet the title is hidden behind
the header plates.

    /* The header sits on top of the two header plates of the frame */
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
where Grid 1 has a header. For the ticker start from `panels/ticker/ticker.css`.

## 3. Write mount

`mount(host, content)` fills `host.innerHTML` with one `<section>`. Its class
is `page` and then the id. `content` is the data from Sanity, shaped like
`dashboard/data/sample/content.json`, plus `events`, `photos` and `weather`,
which may be missing.

    export function mount(host, content) {
      host.innerHTML = `
        <section class="page my-panel">
          <div class="header">
            <h2 class="title" data-slat="title">MY PANEL</h2>
          </div>
          <div class="rows">...</div>
        </section>`;
    }

A panel draws no plate and no frame. In Grid 1 the title must stay left of
x=664, about 9 capital letters. Keep everything 16px inside the frame and
clear of the cut corner at the bottom right.

## 4. Mark the slats

A slat is a piece of the page that turns over when the page changes: the
heading, a row, a card. Mark each one with `data-slat="name"`. `frame.js`
gives it its place in the order and the way it turns, so a panel never has
animation code. The names:

| Mark | Goes on | Turns |
|------|---------|-------|
| `title` | the big heading of a large panel | first |
| `tag` | the tag at the right end of that header | first, the other way |
| `item` | each row or card of a large panel | in the order they appear, each turning the other way from the one before |
| `label` | the label of a small panel, and the tag of the ticker | first |
| `content` | the main part of a small panel, and the ticker message | after the label, the other way |

Rows and cards need no number: their place in the page is the order. The
sixth and every later one go together, so a long page still finishes in
time. `tasks.js` marks its title, its tag and its three rows. A slat that is
not marked simply stays still while the others turn, so mark everything that
has text on it. A name that is not in the table is reported in the console.

Anything inside a slat turns with it. A thin metal bar under a row belongs
inside that row (step 5), so it turns with the row.

## 5. Use the kit for bars and cards

The metal is on the edges only, and a panel never writes a colour of its own
for it. These pieces are in `core/plate.js` and `base.css`, and they follow
Dashboard Settings (Frame metal) and the flat finish without any code in the
panel. A panel that needs a line, a card or a bar uses one of these:

- **A thin metal bar between rows.** `rowBarMarkup(length)` is a bar in a
  picture 20px high with the line through the middle. Put it inside the row,
  which is `position: relative`, and give `.row-bar` a `left` and a `top` in
  the panel's stylesheet. `tasks.css` puts it at the bottom of each row but
  the last, because the frame is there.
- **A card.** `cardMarkup(width, height)` is a purple card with a thin metal
  edge and the bottom right corner cut. Put it first inside a box of that
  size that is `position: relative`, then the text. The text needs
  `position: relative` too, so that it is drawn above the card. `leadership.js`
  and `spotlight.js` use cards.
- **A straight bar.** `<div class="bar"></div>` is 16px high, or add
  `bar-thin` for 8px. Give it a width. The banner rule is one.
- **A tag.** `tagMarkup(width)` is the slanted purple tag of the ticker.
- **Bolts** belong to the frame. A panel does not draw its own.
- **Text colours.** White, `--yellow`, `--lilac` and the status colours are all
  at least 4.5 to 1 against a plate or a card. Keep it that way: do not put
  text on a colour you have not checked. `--yellow` is the brand yellow, for
  text and small marks only. The metal called gold is a different colour.

## 6. Skip the panel when there is nothing to show

`hasContent(content)` is optional. When it returns `false` the rotation skips
the panel for now, as `tasks.js` does when there are no tasks. Use
`visibleItems(list)` from `core/content.js` on every list the editors fill
in, so hidden and expired items are left out.

## 7. Add it to the registry

In `dashboard/registry.js`, add one line to the list:

    { id: 'my-panel', region: 'grid1', topic: 'my-topic' },

## 8. Put it in the rotation

The panel's id is written in two more places. They have to match
`registry.js`, and `check-schemas.mjs` fails when they do not.

1. `dashboard/config.js`, in `defaultSettings.rotation`, in the list for its
   region. A row has no seconds: it follows Seconds per page in Dashboard
   Settings (a large panel stays that long, a small panel three quarters of
   it). Editors can give one row its own seconds in the Studio.

       { panel: 'my-panel', show: true },

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

## 9. Test it

Start the server with `python3 tools/serve.py` and open:

    http://localhost:8080/dashboard/?show=my-panel

It shows your panel in its frame, with the banner and the countdown. The frame
assembles, the page is held for 30 seconds, and then the page turns over and
arrives again. Wait for that once. Add `&motion=none` to stop everything moving, `&motion=calm` to see the
page fade instead of turn, and `&speed=very-slow` to see everything at half
speed. Then check:

- the browser console shows no errors from your files. In sample mode it does
  show 404 lines for files under `data/live/` (the photo list, the calendars
  and `version.txt`) and a warning about a calendar. That is expected: the
  Mini downloads those files, so on your computer the dashboard falls back to
  `data/sample/`.
- no text is smaller than 44px
- nothing crosses the frame or the cut corner
- everything with text on it turns over, in order from the top, and nothing
  stays behind while the rest turns
- the panel still looks right with `&finish=flat` and with `&metal=silver`
  added to the address
- the panel looks right with no items, one item, many items and a very long
  title, and text such as `<b>` shows as plain text

## The frame and the page change

The large panel, the small panel and the ticker are areas. An area is made the
first time a page needs it (so `?show=my-panel` draws only the large frame)
and then stays, in the same place, for as long as the screen is up. Only the
page inside it is swapped. `core/areas.js` builds the area and swaps the page.
Its parts, from the back to the front:

1. the plate: the purple fills, and the thin metal seams under the header
2. the shadows of the two frame halves, one svg each
3. the two halves of the frame, one svg each, with the bolts
4. the glint, the bright dash that runs round the frame now and then
5. the page: your panel's section

The ticker has no frame. Its tag and its message are two slats that swap in
place.

The area carries a state in `data-state`, and `frame.css` moves everything
from that. A page's seconds count from the moment it starts to arrive until it
has left. Seconds per page in Dashboard Settings is the large panel. The small
panel is three quarters of it and the ticker one and a half times, and a row
with seconds of its own uses those.

| State | When | What moves |
|-------|------|------------|
| `in` | the first page of the area | the plates slide in, the frame lines are drawn, the bolts pop in, then the slats turn in |
| `xo` | the old page's last second | the bolts turn a quarter to release the frame, the halves lift off and pull apart, the slats pull back and turn edge-on |
| `xi` | the new page arriving | the slats turn in, the halves drop back, the bolts turn back and lock |
| `shown` | at rest | nothing, except the glint |
| `out` | the area is taken away | the whole area fades |

The two halves are the left side, top left corner and top, and the right side,
bottom right corner and bottom. Each half and each shadow is an svg of its own,
so while the halves lift the browser moves four pictures and draws no lines.
The shadows travel further than the bars, and that growing gap is what reads
as depth. In calm motion nothing turns, slides or lifts: the old page fades out
in 0.3 seconds and the new one fades in. With motion off nothing moves.

## The look

The plates are flat purple on a purple-black ground. The metal is on the edges
only: every frame line, the thin bars between rows, the edge of a card, the
bolts and the outline of the logo. It is one shape drawn five times, back to
front: its shadow (a dark copy moved down and right), its dark rim, its banded
face, a soft shade on the lower half and a bright ridge on the lit edge. The
shape is drawn once in `core/plate.js` and the colours come from
`tokens.css`. The gradients are in `index.html`.

Four attributes on the `html` element change how it looks. Each has a
Dashboard Settings field and an address switch, and the address wins.

| Attribute | Values | Dashboard Settings | Address |
|-----------|--------|--------------------|---------|
| `data-metal` | `gold` (dull antique gold, the default) or `silver` (weathered silver) | Screen, Frame metal | `?metal=silver` |
| `data-glint` | `on` (the default) or `off`: the bright dash that runs round each big frame | Screen, Glint | `?glint=off` |
| `data-finish` | `metal` (the default) or `flat` | none | `?finish=flat` |
| `data-motion` | `full` (the default), `calm` or `none` | Screen, Motion (full or calm) | `?motion=calm` |

The countdown and the alert are always red metal, whatever `data-metal` says.
The announcement's warning tape is the brand yellow, because it is tape and
not metal.

**The flat finish.** Every edge becomes one plain stroke with no shadow, rim,
shade, ridge or glint, and every bolt a plain hexagon. The turning slats and
the lifting halves stay, so it is the same screen with less to paint. If the
screen on the Mini is slow, this is the first thing to try
(docs/try-it-on-the-mini.md).

**Do not:**

- write a hex colour, `rgb()` or a gradient for metal in a panel's own
  stylesheet or script
- use `box-shadow`, `text-shadow`, `filter`, `backdrop-filter`, `blur()`,
  `drop-shadow()`, `mix-blend-mode` or video. They are too slow on the Mini.
  A shadow is a dark copy of the shape moved a few pixels, as the frame does.
- use a 3D transform (`perspective`, `translateZ`, `rotateX`, `rotateY`). The
  slat turns, the name effect and the logo are the only places, and
  `frame.css` has them all. The frame halves lifting and the bolts turning are
  flat moves.
- animate colours, gradients, sizes or filters. Only transform, opacity and
  line drawing change.
- add a layer that covers the whole screen, or a big repeating texture

### Panels that draw their own frame

The banner, the countdown, the alert and the announcement are not pages in an
area. Each draws its own frame and arrives and leaves as one piece. They label
their parts with `data-part`, and the tables at the top of `frame.js` say
when each part arrives and with what effect. `?demo=alert` and
`?demo=announcement` show the last two. A new panel for the large panel, the
small panel or the ticker never needs any of this.

## The rules

- **No animation code in a panel.** No `@keyframes`, `transition`, `animate()`,
  `setTimeout`, `setInterval` or `requestAnimationFrame`. Everything moves
  through `frame.js` and `frame.css`, where a new effect is added for all.
  Every time there is multiplied by the Speed setting, so a new time in
  `frame.css` or `tokens.css` is written `calc(400ms * var(--pace))`, and code
  that waits uses `frame.pace()`.
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
