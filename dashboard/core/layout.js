// Layouts: where the regions of the screen sit. A theme (themes/registry.js)
// may name one with layout: 'standard' (the default when it says nothing) or
// layout: 'sidebar'. docs/layouts.md has the pictures and the numbers.
//
//   standard  the banner across the top, the large frame (grid1) on the left,
//             the countdown and the small frame (grid2) on the right, and the
//             ticker across the bottom
//   sidebar   a strip across the top with the team name on one line, under it a
//             column on the left (the countdown, logo and the rest) and one large
//             frame (grid1) on the right, scaled up to fill its space, and the
//             ticker across the whole bottom, as in the standard layout. No small
//             frame
//
// Everything here is plain functions and numbers with no page in sight, so
// tools/test-layouts.mjs can run them. core/layout-apply.js puts the answer on
// the page, before any region is drawn, and the stylesheet layouts/sidebar.css
// does the placing, from the numbers below.
//
// A layout cannot change while the screen runs, because the regions are drawn
// for one layout. When the theme changes to one with another layout, the page
// reloads once (mustReload below).

import { themes } from '../themes/registry.js';
import { isKnownTheme, resolveTheme } from './theme.js';

export const layouts = ['standard', 'sidebar'];
export const defaultLayout = 'standard';

export function isLayout(name) {
  return layouts.indexOf(name) !== -1;
}

// The layout a theme asks for. A theme with no layout, or one the registry does
// not know, gets the standard layout. list is only for the tests.
export function layoutOf(themeId, list) {
  const entry = (list || themes).filter(theme => theme.id === themeId)[0];
  return entry && isLayout(entry.layout) ? entry.layout : defaultLayout;
}

// The layout the screen should start in, worked out before any content is
// read, from the Theme document in the copy of the content saved on this
// computer (rawTheme, or null when there is none) and from ?theme= in the
// address (askedTheme). It follows the same rules as theme-apply.js, so the
// theme that goes on a moment later has the layout that is already on the page.
// Anything that goes wrong gives the standard layout.
export function chooseLayout(rawTheme, askedTheme, now) {
  try {
    const id = isKnownTheme(askedTheme) ? askedTheme : resolveTheme(rawTheme, now || new Date()).theme;
    return layoutOf(id);
  } catch (error) {
    return defaultLayout;
  }
}

// The layout on the page now. The page sets data-layout on the html element
// before anything is drawn (core/layout-apply.js). With no page, or no
// attribute, it is the standard layout.
export function layoutNow() {
  const page = typeof document === 'undefined' ? null : document.documentElement;
  const name = page && page.dataset ? page.dataset.layout : '';
  return isLayout(name) ? name : defaultLayout;
}


// What each layout has

// The regions that exist. A region that is not listed is never drawn, and the
// scheduler never gives it a page, so there is no small frame (grid2) in the
// sidebar layout and the panels in registry.js whose region is grid2 are
// skipped. The countdown is not one of them: it is in the sidebar.
const regionsIn = {
  standard: ['banner', 'countdown', 'grid1', 'grid2', 'ticker', 'overlay'],
  sidebar: ['banner', 'countdown', 'grid1', 'ticker', 'overlay'],
};

export function hasRegion(layout, region) {
  return (regionsIn[layout] || regionsIn[defaultLayout]).indexOf(region) !== -1;
}

// The regions that keep a frame while their pages change (core/areas.js)
const areaRegions = ['grid1', 'grid2', 'ticker'];

export function areasOf(layout) {
  return areaRegions.filter(region => hasRegion(layout, region));
}

// The areas a hidden transition waits for besides the large one, which is the
// one that asks for it (core/hidden-run.js)
export function otherAreas(layout) {
  return areasOf(layout).filter(region => region !== 'grid1');
}

// The pieces of the screen that fly apart in a hidden transition: the id of
// the element is 'region-' and the name. The sidebar layout has a block for the
// top strip, one for the whole sidebar column (which holds the banner and the
// countdown), one for the large frame and one for the ticker.
// core/layout-apply.js marks exactly these with data-block, and frame.css and
// layouts/sidebar.css give each one the way it flies.
const blocksIn = {
  standard: ['banner', 'grid1', 'countdown', 'grid2', 'ticker'],
  sidebar: ['strip', 'sidebar', 'grid1', 'ticker'],
};

export const everyBlock = ['banner', 'grid1', 'countdown', 'grid2', 'ticker', 'sidebar', 'strip'];

export function blocksOf(layout) {
  return blocksIn[layout] || blocksIn[defaultLayout];
}

// The parts of a seasonal pack that are drawn (core/season.js). The zones and
// the back layer were measured on the standard layout, so the sidebar layout
// draws only the header mark and the over layer, which cross the whole screen.
const seasonLayersIn = {
  standard: ['back', 'front', 'over'],
  sidebar: ['over'],
};

export function decorationLayers(layout) {
  return seasonLayersIn[layout] || seasonLayersIn[defaultLayout];
}

// The Neon Prime kit: moving neon for the sidebar layout (docs/layouts.md, "The
// kit"). It is drawn and moved by neon-kit.css and started by frame.js (setKit).
// It is on for this theme in this layout, and nowhere else.
export const kitTheme = 'neon-prime';

export function hasKit(themeId, layout) {
  return themeId === kitTheme && layout === 'sidebar';
}

// The few empty elements the kit needs, one list for each block that flies apart
// (blocksOf), so that they fly apart with it. core/layout-apply.js adds them when
// the sidebar layout is set up, and they show only while the kit's theme is on.
// Every one is a line, a row of ticks, a set of brackets or a layer for a
// sweeping line (neon-kit.css says which). The four <i> are the bars of the page
// change burst.
export const kitMarkup = {
  strip: '<div class="kit kit-strip"></div>',
  sidebar: '<div class="kit kit-side"></div><div class="kit kit-scan"></div>',
  grid1: '<div class="kit kit-pane"><i></i><i></i><i></i><i></i></div><div class="kit kit-brackets"></div>',
  ticker: '<div class="kit kit-ticker"></div>',
};


// The sidebar layout's numbers. Every length is a pixel of the 1920 x 1080
// screen. They are written once, here, and layout-apply.js hands them to
// layouts/sidebar.css as variables (cssVariables below), so a change here is
// all it takes. tools/test-layouts.mjs fails if they stop fitting the screen.

export const screen = { width: 1920, height: 1080 };

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

function rectangle(x, y, width, height) {
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

// Changing layout while the screen runs

export const reloadKey = 'teletraan-layout-reload';

// Decides whether the page must reload because the layout on the page is not
// the layout of the theme that is about to go on. storage is sessionStorage, or
// anything with getItem, setItem and removeItem, or null.
//
// A reload loop would leave a wall display blinking for ever, so it is made
// impossible: before the page reloads it writes down the layout it is
// reloading for, and a page that finds the same layout written down does not
// reload again. The note is rubbed out as soon as the layout on the page is
// the one wanted, so a later change reloads once more. When the note cannot be
// written or read, the answer is no: a reload that cannot be remembered might
// repeat.
export function mustReload(onPage, wanted, storage) {
  if (!isLayout(wanted) || onPage === wanted) {
    forget(storage);
    return false;
  }

  try {
    if (storage.getItem(reloadKey) === wanted) return false;
    storage.setItem(reloadKey, wanted);
    return storage.getItem(reloadKey) === wanted;
  } catch (error) {
    return false;
  }
}

function forget(storage) {
  try {
    storage.removeItem(reloadKey);
  } catch (error) {
    // nothing was written, so there is nothing to forget
  }
}
