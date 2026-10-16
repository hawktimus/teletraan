// The geometry of the sidebar layout (part of layout.js).

import { screen } from './layout-core.js';

export const sidebarSettings = {
  // The same margins and gaps as the standard layout (#stage in base.css)
  margin: { top: 24, bottom: 24, left: 40, right: 40 },
  columnGap: 32,
  rowGap: 20,

  // The strip across the top, with the team name on one line. HAWKTIMUS PRIME is
  // 1231 px wide at 120 px in the display font (measured in a real render): 985
  // at 96, 1149 at 112, 1231 at 120 and 1313 at 128. The strip is as wide as the
  // screen allows (1840), so the name leaves about 575 px at its right end. The strip
  // is 144 high: the name's line is as high as its size (120) and the rest is
  // the room round it for the neon trim. Every pixel taken here is taken from
  // the height of the sidebar and the pane.
  stripHeight: 144,
  nameSize: 120,

  // The clock, the date and the weather are at the right end of the strip, in a
  // slot this wide. The time is 280 wide at 96 px (10:59) with AM or PM 70 more,
  // and the date and the weather share the row under it (288 and 186 at their
  // widest). The sidebar is not high enough for them at 44 px or more, so they
  // are here (docs/layouts.md, "The vertical budget"). The name has the rest of
  // the strip, 1231 wide with the 32 px at its left.
  stripClockWidth: 500,

  // The sidebar is 20 percent of the screen (384). The layout allows 15 to 20
  // percent (288 to 384). 384 is the narrowest width in which every part fits at
  // 44 px or more: the days row alone needs 373 (docs/layouts.md, "Why 384").
  sidebarWidth: 384,

  // The ticker is the standard layout's: one line, 72 high, the width of the
  // screen less the margins (.area[data-area="ticker"] in base.css). The tag
  // is 72 high and the message is one line of 56 px text at 64 px.
  tickerHeight: 72,

  // The large area as it is drawn, before it is scaled (base.css and plate.js).
  // The panels are written for this size and are not redrawn.
  area: { width: 1152, height: 708 },

  // How far the frame's screws and their shadows reach outside the area's own
  // box, measured in a real render of the standard layout. The scaled frame has
  // to stay inside its space with them, so they are part of what is fitted.
  overhang: { left: 18, top: 18, right: 23, bottom: 25 },
};

export function rectangle(x, y, width, height) {
  return { x: x, y: y, width: width, height: height };
}

// Works out every rectangle of the sidebar layout from the settings, from the
// top of the screen down:
//
//   strip     across the top, between the margins
//   sidebar   under the strip, on the left, as high as the room between the
//             strip and the ticker
//   space     the rest of that row, to the right of the sidebar: where the
//             large frame goes
//   ticker    across the bottom, between the margins, as in the standard layout
//
// The scale is how much the large area is enlarged: the same number across and
// down, never a stretch, the biggest that lets the frame, with its screws, fit
// the space, cut down to four decimals so that rounding never makes it too big.
// A pixel is left over in each direction, so that putting the corner of the
// pane on a whole pixel (below) can never push the frame out of the space. The
// frame is then centred in the space.
export function makeSidebarGeometry(settings) {
  const s = settings || sidebarSettings;
  const inside = rectangle(s.margin.left, s.margin.top, screen.width - s.margin.left - s.margin.right, screen.height - s.margin.top - s.margin.bottom);

  const strip = rectangle(inside.x, inside.y, inside.width, s.stripHeight);
  const ticker = rectangle(inside.x, inside.y + inside.height - s.tickerHeight, inside.width, s.tickerHeight);

  const rowY = strip.y + strip.height + s.rowGap;
  const rowHeight = ticker.y - s.rowGap - rowY;
  const sidebar = rectangle(inside.x, rowY, s.sidebarWidth, rowHeight);

  const spaceX = sidebar.x + sidebar.width + s.columnGap;
  const space = rectangle(spaceX, rowY, inside.x + inside.width - spaceX, rowHeight);

  const frameAtOne = {
    width: s.area.width + s.overhang.left + s.overhang.right,
    height: s.area.height + s.overhang.top + s.overhang.bottom,
  };
  const fit = Math.min((space.width - 1) / frameAtOne.width, (space.height - 1) / frameAtOne.height);
  const scale = Math.floor(fit * 10000) / 10000;

  const frameWidth = frameAtOne.width * scale;
  const frameHeight = frameAtOne.height * scale;
  const frameX = space.x + (space.width - frameWidth) / 2;
  const frameY = space.y + (space.height - frameHeight) / 2;

  // Whole pixels, so the corner of the frame is not blurred by a half pixel
  const pane = rectangle(
    Math.round(frameX + s.overhang.left * scale),
    Math.round(frameY + s.overhang.top * scale),
    Math.round(s.area.width * scale * 10) / 10,
    Math.round(s.area.height * scale * 10) / 10
  );

  // The pane with its screws, which reach past it
  const frame = rectangle(
    pane.x - s.overhang.left * scale,
    pane.y - s.overhang.top * scale,
    frameWidth,
    frameHeight
  );

  return { strip: strip, sidebar: sidebar, space: space, pane: pane, frame: frame, ticker: ticker, scale: scale };
}

export const sidebarGeometry = makeSidebarGeometry(sidebarSettings);

// The numbers as the variables layouts/sidebar.css reads, each with its unit
export function cssVariables(geometry, settings) {
  const g = geometry || sidebarGeometry;
  const s = settings || sidebarSettings;
  const px = value => value + 'px';

  return {
    '--strip-x': px(g.strip.x),
    '--strip-y': px(g.strip.y),
    '--strip-width': px(g.strip.width),
    '--strip-height': px(g.strip.height),
    '--strip-name-size': px(s.nameSize),
    '--strip-clock-width': px(s.stripClockWidth),
    '--sidebar-x': px(g.sidebar.x),
    '--sidebar-y': px(g.sidebar.y),
    '--sidebar-width': px(g.sidebar.width),
    '--sidebar-height': px(g.sidebar.height),
    '--pane-x': px(g.pane.x),
    '--pane-y': px(g.pane.y),
    '--pane-width': px(g.pane.width),
    '--pane-height': px(g.pane.height),
    '--pane-scale': String(g.scale),
    '--ticker-x': px(g.ticker.x),
    '--ticker-y': px(g.ticker.y),
    '--ticker-width': px(g.ticker.width),
    '--ticker-height': px(g.ticker.height),
  };
}
