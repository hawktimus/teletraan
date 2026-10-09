// The Style setting of Dashboard Settings (the names are in `styles` in config.js).
// A style is one word that picks the look of the whole screen. Three things follow
// from it:
//
//   data-style   set on the html element. The stylesheets in styles/ read it. Each one
//                only sets custom properties and the layout rules its style needs
//   the layout   Original and Cybertron keep the layout their theme names (core/layout.js):
//                the standard layout, or the sidebar layout for Neon Prime. Minimal uses
//                the bar layout, whatever the theme says
//   data-shapes  set on the html element. It is the corners of the frames the page has
//                drawn: Cybertron and Minimal have their own (core/plate.js, frameKind), and
//                Original has the usual ones, so it is not there for it. It is written when
//                the page starts, and again when a style with other frames goes on while the
//                screen runs (recordShapes, and redrawFrames in core/areas.js)
//
// The team (core/teams.js) is a different thing: it sets the colors and the mirror
// switch, and any style can have either team.
//
// chooseStyle and layoutFor are plain functions with no page in sight, so the tests in
// tools/test-layouts.mjs can run them. applyStyle and startStyle put the answer on the
// page. To add a style: add its name to `styles` in config.js, a line to `forcedLayout`
// and one to `shapeOf` below, a stylesheet in styles/ linked from index.html, and a title
// to the list in studio/schemas/dashboardSettings.js.

import { defaultSettings, styles } from '../config.js';

export function isStyle(name) {
  return styles.includes(name);
}

// The layout a style asks for, or null when the theme decides
const forcedLayout = { original: null, cybertron: null, minimal: 'bar' };

// The corners of the frames a style draws, or '' for the usual ones. Frames are drawn
// once for each area, so a style that goes on while the screen runs has them drawn again
// (core/areas.js, redrawFrames). Minimal's frames are the ones of the bar layout, which
// is another layout, so a page that goes to it or from it reloads (core/layout.js, drawnFor)
const shapeOf = { original: '', cybertron: 'cybertron', minimal: 'minimal' };
export const shapeSets = Object.values(shapeOf).filter(Boolean);

// The styles with steel for the metal of every frame. The page change never gives their
// frames another metal (core/areas.js)
const steelStyles = ['cybertron', 'minimal'];

export function hasSteel(style) {
  return steelStyles.includes(style);
}

export function shapesFor(style) {
  return isStyle(style) ? shapeOf[style] : '';
}

// A preview (core/preview.js) holds a style on the screen for a while without writing the
// setting. until is a time in milliseconds. A new call replaces the one before, and a
// name that is not a style ends it.
let previewed = null; // { style, until }

export function previewStyle(style, until) {
  previewed = isStyle(style) && typeof until === 'number' && isFinite(until) ? { style: style, until: until } : null;
}

// saved is Style from Dashboard Settings, and asked is ?style= in the address. The
// address wins, for this page only, like the other switches. Anything that is not a
// style is ignored. A preview that has time left wins over both. now is a Date.
export function chooseStyle(saved, asked, now = new Date()) {
  if (previewed && now.getTime() < previewed.until) return previewed.style;
  if (isStyle(asked)) return asked;
  if (isStyle(saved)) return saved;
  return defaultSettings.style;
}

// themeLayout is the layout the theme names (layoutOf in core/layout.js)
export function layoutFor(style, themeLayout) {
  const forced = isStyle(style) ? forcedLayout[style] : null;
  return forced || themeLayout;
}

function pageOrNone() {
  return typeof document === 'undefined' ? null : document.documentElement;
}

// The style on the page now. With no page, or no attribute, it is the default.
export function styleNow(page = pageOrNone()) {
  const name = page && page.dataset ? page.dataset.style : '';
  return isStyle(name) ? name : defaultSettings.style;
}

// The corners of the frames this page has drawn
export function shapesNow(page = pageOrNone()) {
  const name = page && page.dataset ? page.dataset.shapes : '';
  return shapeSets.includes(name) ? name : '';
}

// Written only when it changes, because the style is looked at again with every look
// that goes on the page, and the same value written twice can make the browser restyle it
export function applyStyle(style, page = pageOrNone()) {
  if (!page || !isStyle(style)) return;

  if (page.dataset.style !== style) page.dataset.style = style;
}

// The first thing the screen does about its style, before the layout is set up and
// before anything is drawn. asked is ?style= from the address bar, or null. readSaved()
// gives the Style saved the last time the content was read from Sanity, or null
// (core/content.js, savedStyle). Returns the style it put on the page. Whatever goes
// wrong, the screen starts in the original style.
export function startStyle(asked, readSaved, page = pageOrNone()) {
  let style = defaultSettings.style;

  try {
    style = chooseStyle(readSaved(), asked);
  } catch (error) {
    console.error('Could not choose the style. The screen starts in the original style.', error);
  }

  applyStyle(style, page);
  recordShapes(style, page);
  return style;
}

// Says which frames the page has been drawn with. startStyle does it for the first
// frames, and redrawFrames asks for it when a style with other frames goes on
export function recordShapes(style, page = pageOrNone()) {
  if (!page || !page.dataset) return;

  const shapes = shapesFor(style);
  if (shapes) page.dataset.shapes = shapes;
  else delete page.dataset.shapes;
}
