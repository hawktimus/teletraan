# Subthemes

A subtheme is a small layer of pictures drawn over a theme and a view for a few days, such as a season. Nothing is designed yet. The only subtheme is a plain star, and it shows only with `?sample=1` in the address.

## Make one

Open EVENTS, then Subthemes, and click the plus button.

- Name: for editors only. It does not show on the screen.
- Subtheme on: turn it off to keep it without drawing it.
- First day and Last day: both days are included, in the kiosk time zone. Empty means no limit.
- Priority: when two subthemes are live, the higher number is drawn. A tie goes to the older one.
- Pictures: SVG or PNG files, each with a slot, a short lowercase name such as `star`.
- Rules: one row for each place. A row names the theme, the view, the slot, the place, the size (40 to 240) and the motion.

Click Publish all. The screen picks it up within a few seconds.

## The places

| Place | Where |
|-------|-------|
| banner-left | the margin above the left end of the banner |
| banner-right | the margin above the right end of the banner |
| countdown-top | the cut corner above the countdown (standard layout), the margin above the war clock (bar layout) |
| ticker-end | below the right end of the ticker |
| side-bottom | the right margin by the small panel (standard), the gap under the side column (bar) |
| main-corner | the cut corner of the large panel (standard), the gap above the right end of the main panel (bar) |

General plays the standard layout. Prime, Nova and Family play the bar layout. A place is a box that holds no text. A picture is scaled down to fit its box, so a small box makes a small picture, and it is cut off at the edge of the box.

The boxes are in `dashboard/core/anchors.js`, one set for each layout and each theme. Retro uses the boxes of Original. Measure them again when a frame moves, and change the numbers there.

## Motion

- none: the picture rests.
- drift: a sway of 6 pixels over 4 seconds.
- blink: the opacity goes down and up over 2 seconds.
- fall: a descent through the box over 20 seconds that starts again.

Only transform and opacity move. In calm motion every picture rests.

## How it is drawn

`core/subthemes.js` picks the live subtheme and the pictures for the theme, view and layout on the page. `core/subthemes-layer.js` draws them once into a layer just after the stage, and draws them again only when something changes. Each slot is one SVG symbol, and each place points at it with `<use>`. The drawings the screen has of its own are in `core/subtheme-art.js`.

The tests are in `tests/subthemes.test.mjs`.
