// Layouts: where the regions of the screen sit. A theme (themes/registry.js)
// may name one with layout: 'standard' (the default when it says nothing) or
// layout: 'sidebar'. The Style setting (core/style.js) may force the third, 'bar'.
// docs/layouts.md has the pictures and the numbers.
//
//   standard  the banner across the top, the large frame (grid1) on the left,
//             the countdown and the small frame (grid2) on the right, and the
//             ticker across the bottom
//   sidebar   a strip across the top with the team name on one line, under it a
//             column on the left (the countdown, logo and the rest) and one large
//             frame (grid1) on the right, scaled up to fill its space, and the
//             ticker across the whole bottom, as in the standard layout. No small
//             frame
//   bar       a banner across the top with the team name at one end and the war
//             clock at the other, under it a thin side column and one main panel
//             (grid1), and the ticker across the whole bottom. No small frame.
//             The style Minimal uses it
//
// Everything here is plain functions and numbers with no page in sight, so
// tools/test-layouts.mjs can run them. core/layout-apply.js puts the answer on
// the page, before any region is drawn, and the stylesheets layouts/sidebar.css
// and layouts/bar.css do the placing, from the numbers below.
//
// A layout cannot change while the screen runs, because the regions are drawn
// for one layout. When the theme or the style changes to one with another layout,
// the page reloads once (mustReload below). A change between Original and Cybertron
// keeps the layout and only draws the frames again (core/areas.js, redrawFrames).

import { themes } from '../themes/registry.js';
import { isKnownTheme, resolveTheme } from './theme.js';
import { layoutFor, shapeSets } from './style.js';

export const layouts = ['standard', 'sidebar', 'bar'];
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
// read, from the Look document in the copy of the content saved on this
// computer (rawTheme, or null when there is none) and from ?theme= in the
// address (askedTheme). It follows the same rules as theme-apply.js, so the
// theme that goes on a moment later has the layout that is already on the page.
// style is the style that has been chosen (core/style.js): Original leaves the
// theme's layout alone, and the others have a layout of their own whatever the
// theme says. Anything that goes wrong gives the layout the style forces, or the
// standard layout.
export function chooseLayout(rawTheme, askedTheme, now, style) {
  try {
    const id = isKnownTheme(askedTheme) ? askedTheme : resolveTheme(rawTheme, now || new Date()).theme;
    return layoutFor(style, layoutOf(id));
  } catch (error) {
    return layoutFor(style, defaultLayout);
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
  // The war clock is in the banner, so the countdown has no region of its own. The
  // side column is a region of its own, and its panels are the ones registry.js
  // lists with region: 'column'
  bar: ['banner', 'column', 'grid1', 'ticker', 'overlay'],
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
// core/layout-apply.js marks exactly these with data-block, and frame.css,
// layouts/sidebar.css and layouts/bar.css give each one the way it flies. The bar
// layout has four: the banner, the side column, the main panel and the ticker.
const blocksIn = {
  standard: ['banner', 'grid1', 'countdown', 'grid2', 'ticker'],
  sidebar: ['strip', 'sidebar', 'grid1', 'ticker'],
  bar: ['banner', 'column', 'grid1', 'ticker'],
};

export const everyBlock = ['banner', 'grid1', 'countdown', 'grid2', 'ticker', 'sidebar', 'strip', 'column'];

export function blocksOf(layout) {
  return blocksIn[layout] || blocksIn[defaultLayout];
}

// The parts of a seasonal pack that are drawn (core/season.js). The zones and
// the back layer were measured on the standard layout, so the sidebar and bar
// layouts draw only the header mark and the over layer, which cross the whole screen.
const seasonLayersIn = {
  standard: ['back', 'front', 'over'],
  sidebar: ['over'],
  bar: ['over'],
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

// The bar layout's numbers. They are the pictures of the bar layout, halved
// from 3840 x 2160 to the 1920 x 1080 screen, and they are written once, here.
// layout-apply.js hands them to layouts/bar.css and the two bar panels as
// variables (barCssVariables below), so a change here is all it takes.
// tools/test-layouts.mjs fails if they stop fitting the screen.

export const barSettings = {
  // The same margin all round. Every row is as wide as the screen less the two
  // margins, 1856, and every row is 24 below the one above it
  margin: { top: 32, bottom: 32, left: 32, right: 32 },
  rowGap: 24,

  // The banner across the top: the team name at one end and the war clock at the
  // other, 40 in from each end of the banner. The war clock is 700 x 120 and in the
  // middle of the banner's height. The name has the rest, less the gap
  bannerHeight: 160,
  bannerPadding: 40,
  nameGap: 24,
  warClock: { width: 700, height: 120 },

  // The side column: a rail 12 wide at the edge of the screen, 24 of space, then the
  // column itself, 300 wide. The column and the main panel are 36 apart, and both are
  // as high as the main panel
  railWidth: 12,
  railGap: 24,
  columnWidth: 300,
  columnGap: 36,

  // The main panel is the large frame (grid1). Its header is 120 high. It is the
  // surface a booked talk uses too (docs/presentations.md)
  main: { width: 1484, height: 736 },
  headerHeight: 120,

  // The ticker is the standard layout's, as wide as the row. The tag is 72 high
  tickerHeight: 72,

  // The large area as it is drawn, before it is scaled (base.css and plate.js). The
  // panels are written for this size, 1152 wide, and are not redrawn
  area: { width: 1152, height: 708 },
};

// Works out every rectangle of the bar layout from the settings, from the top of
// the screen down:
//
//   banner    across the top, between the margins
//   name      the team name's slot, at the left end of the banner
//   war       the war clock's slot, at the right end of the banner
//   middle    the row under the banner: the side column, then the main panel
//   side      the rail and the column, at the left end of the row
//   rail      the strip of ticks at the edge of the screen
//   column    the clock, the date, the weather, the TEAM plate, the school and the hawk
//   main      the large frame (grid1)
//   ticker    across the bottom, between the margins
//
// The main panel is 1484 wide and 736 high, and the panels are written for 1152 by
// 708. The page is scaled the same amount across and down, never stretched: the
// scale is the height of the panel over the height the panels are written for (736
// over 708), cut down to four decimals so that rounding never makes it too big. The
// area (the frame and the page inside it) is made as wide as the panel needs at that
// scale, 1427, and the panels leave the width they were written for as it is, so the
// extra width is not used by any panel (docs/layouts.md, "The width of the main
// panel"). page is where the scaled area lands on the screen, which is a little
// inside main.
export function makeBarGeometry(settings) {
  const s = settings || barSettings;
  const margin = s.margin;
  const inside = rectangle(margin.left, margin.top, screen.width - margin.left - margin.right, screen.height - margin.top - margin.bottom);

  const banner = rectangle(inside.x, inside.y, inside.width, s.bannerHeight);
  const war = rectangle(
    banner.x + banner.width - s.bannerPadding - s.warClock.width,
    banner.y + (banner.height - s.warClock.height) / 2,
    s.warClock.width,
    s.warClock.height
  );
  const nameX = banner.x + s.bannerPadding;
  const name = rectangle(nameX, banner.y, war.x - s.nameGap - nameX, banner.height);

  const rowY = banner.y + banner.height + s.rowGap;
  const sideWidth = s.railWidth + s.railGap + s.columnWidth;
  const side = rectangle(inside.x, rowY, sideWidth, s.main.height);
  const rail = rectangle(side.x, rowY, s.railWidth, s.main.height);
  const column = rectangle(side.x + s.railWidth + s.railGap, rowY, s.columnWidth, s.main.height);
  const main = rectangle(side.x + side.width + s.columnGap, rowY, s.main.width, s.main.height);
  const middle = rectangle(inside.x, rowY, main.x + main.width - inside.x, s.main.height);
  const ticker = rectangle(inside.x, middle.y + middle.height + s.rowGap, inside.width, s.tickerHeight);

  const scale = Math.floor(s.main.height / s.area.height * 10000) / 10000;
  const areaWidth = Math.floor(s.main.width / scale);
  const page = rectangle(main.x, main.y, Math.round(areaWidth * scale * 100) / 100, Math.round(s.area.height * scale * 100) / 100);

  // The header band of the main panel, on the screen
  const header = rectangle(main.x, main.y, main.width, s.headerHeight);

  return {
    banner: banner, name: name, war: war, middle: middle, side: side, rail: rail, column: column,
    main: main, header: header, ticker: ticker, page: page, scale: scale, areaWidth: areaWidth,
  };
}

export const barGeometry = makeBarGeometry(barSettings);

// The rectangles of a geometry, by name
export function rectanglesOf(geometry) {
  return Object.keys(geometry).filter(name => typeof geometry[name] === 'object').reduce((all, name) => {
    all[name] = geometry[name];
    return all;
  }, {});
}

// The same rectangle turned left to right across the screen. Only x changes: what was at
// the left margin is at the right margin, and the rectangle keeps its size and its height
export function mirrorRectangle(box) {
  return rectangle(screen.width - box.x - box.width, box.y, box.width, box.height);
}

// Every rectangle of a geometry, mirrored. This is what the mirror (layouts/bar.css,
// html.mirrored) does to the screen with flex-direction, and the tests hold the two to
// the same answer. The numbers that are not rectangles are the same. The page is the
// one rectangle that is not turned: the panels read from the left, so it stays at the
// left edge of the main panel, which has moved.
export function mirrorGeometry(geometry) {
  const mirrored = Object.assign({}, geometry);
  Object.keys(rectanglesOf(geometry)).forEach(name => {
    mirrored[name] = mirrorRectangle(geometry[name]);
  });
  mirrored.page = rectangle(mirrored.main.x, geometry.page.y, geometry.page.width, geometry.page.height);
  return mirrored;
}

// The numbers as the variables layouts/bar.css and the bar panels read, each with its unit
export function barCssVariables(geometry, settings) {
  const g = geometry || barGeometry;
  const s = settings || barSettings;
  const px = value => value + 'px';

  return {
    '--bar-banner-x': px(g.banner.x),
    '--bar-banner-y': px(g.banner.y),
    '--bar-banner-width': px(g.banner.width),
    '--bar-banner-height': px(g.banner.height),
    '--bar-banner-padding': px(s.bannerPadding),
    '--bar-name-gap': px(s.nameGap),
    '--bar-war-width': px(g.war.width),
    '--bar-war-height': px(g.war.height),
    '--bar-middle-x': px(g.middle.x),
    '--bar-middle-y': px(g.middle.y),
    '--bar-middle-width': px(g.middle.width),
    '--bar-middle-height': px(g.middle.height),
    '--bar-side-width': px(g.side.width),
    '--bar-rail-width': px(g.rail.width),
    '--bar-rail-gap': px(s.railGap),
    '--bar-column-width': px(g.column.width),
    '--bar-column-gap': px(s.columnGap),
    '--bar-main-width': px(g.main.width),
    '--bar-main-height': px(g.main.height),
    '--bar-area-width': px(g.areaWidth),
    '--bar-scale': String(g.scale),
    '--bar-ticker-x': px(g.ticker.x),
    '--bar-ticker-y': px(g.ticker.y),
    '--bar-ticker-width': px(g.ticker.width),
    '--bar-ticker-height': px(g.ticker.height),
  };
}

// Changing layout while the screen runs

export const reloadKey = 'teletraan-layout-reload';

// What a page is drawn for: its layout, and in the bar layout the corners of its frames
// when the style has its own (core/style.js, shapesFor), written 'bar-minimal'. Frames with
// other corners in the same layout are drawn again while the screen runs, not by a reload
// (core/areas.js, redrawFrames), so the standard layout is the same page for Original and
// for Cybertron.
export function drawnFor(layout, shapes) {
  return layout === 'bar' && shapeSets.indexOf(shapes) !== -1 ? layout + '-' + shapes : layout;
}

export function isDrawn(name) {
  return isLayout(name) || shapeSets.some(shapes => name === drawnFor('bar', shapes));
}

// Decides whether the page must reload because what the page is drawn for is not
// what the theme and style that are about to go on need (drawnFor: a layout, or a
// layout with the corners of a style). storage is sessionStorage, or anything with
// getItem, setItem and removeItem, or null.
//
// A reload loop would leave a wall display blinking for ever, so it is made
// impossible: before the page reloads it writes down the layout it is
// reloading for, and a page that finds the same layout written down does not
// reload again. The note is rubbed out as soon as the layout on the page is
// the one wanted, so a later change reloads once more. When the note cannot be
// written or read, the answer is no: a reload that cannot be remembered might
// repeat.
export function mustReload(onPage, wanted, storage) {
  if (!isDrawn(wanted) || onPage === wanted) {
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
