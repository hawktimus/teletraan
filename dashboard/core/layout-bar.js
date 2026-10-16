// The geometry of the bar layout, the mirror, and when the page must be drawn again (part of layout.js).

import { shapeSets } from './style.js';
import { rectangle } from './layout-sidebar.js';
import { isLayout, screen } from './layout-core.js';

// The bar layout's numbers. They are the pictures of the bar layout, halved
// from 3840 x 2160 to the 1920 x 1080 screen, and they are written once, here.
// layout-apply.js hands them to layouts/bar.css and the two bar panels as
// variables (barCssVariables below), so a change here is all it takes.
// tests/layouts.test.mjs fails if they stop fitting the screen.

export const barSettings = {
  // The same margin all round. Every row is as wide as the screen less the two
  // margins, 1856, and every row is 24 below the one above it
  margin: { top: 32, bottom: 32, left: 32, right: 32 },
  rowGap: 24,

  // The banner across the top: the team name at one end and the war clock at the
  // other, 40 in from each end of the banner. The war clock is 766 x 128 and in the
  // middle of the banner's height. The name has the rest, less the gap: 986, which is 1.4
  // more than HAWKTIMUS PRIME needs at 96 px, so the war clock is as wide as it can be
  bannerHeight: 160,
  bannerPadding: 40,
  nameGap: 24,
  warClock: { width: 766, height: 128 },

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
