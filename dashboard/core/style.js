// The Style setting of Dashboard Settings (the names are in `styles` in config.js).
// A style is one word that picks the theme of the whole screen: original, cybertron,
// retro or foundry (themeIds in config.js). The old name minimal still works as a request for the
// bar layout in the Original theme. Three things follow from it:
//
//   data-style   set on the html element: the id of the theme (or the old name minimal, which no
//                theme stylesheet reads). The folder styles/<id>/
//                has the stylesheets (core/style-loader.js). Each one only sets custom
//                properties and the rules its theme needs
//   the layout   The themes keep the layout their colour theme names (core/layout.js):
//                the standard layout, or the sidebar layout for Neon Prime. The bar layout
//                is asked for by a view, or by the old name minimal
//   data-shapes  set on the html element. It is the corners of the frames the page has
//                drawn: Cybertron has its own (core/plate.js, frameKind), the bar layout has
//                Minimal's in every theme, and Original has the usual ones, so it is not there
//                for it. It is written when the page starts, and again when a style with
//                other frames goes on while the screen runs (recordShapes, and redrawFrames
//                in core/areas.js)
//
// The team (core/teams.js) is a different thing: it sets the colors and the mirror
// switch, and any style can have either team. The Screens (core/screens.js) change
// both together, through rotateStyle below and rotateTeam in core/teams.js, and they go on the
// page in the same step as a preview does.
//
// chooseStyle and layoutFor are plain functions with no page in sight, so the tests in
// tests/layouts.test.mjs can run them. applyStyle and startStyle put the answer on the
// page. To add a theme: add its id to `themeIds` in config.js, a line to `shapeOf` below, a
// folder in styles/ with the four files (core/style-loader.js), linked from index.html, and a
// title to the list in studio/schemas/dashboardSettings.js.

import { barStyle, defaultSettings, styles, themeIds } from '../config.js';

export function isStyle(name) {
  return styles.includes(name) || themeIds.includes(name);
}

// The theme a name stands for: the three themes are themselves, and the old name Minimal is the Original
// theme, drawn in the bar layout (below). Anything else is the default theme.
export function themeOf(name) {
  if (name === barStyle) return 'original';
  return isStyle(name) ? name : defaultSettings.style;
}

// The layout a name asks for, or null when the theme decides. Only the old name Minimal asks for one.
const forcedLayout = { minimal: 'bar' };

// The corners of the frames a theme draws, or '' for the usual ones. Frames are drawn
// once for each area, so a theme that goes on while the screen runs has them drawn again
// (core/areas.js, redrawFrames).
const shapeOf = { original: '', cybertron: 'cybertron', retro: '', foundry: '' };

// The frames of the bar layout are Minimal's, in every theme. A page that goes to the bar layout or from
// it changes layout too (core/layout-apply.js, changeLayout)
const barShapes = 'minimal';
export const shapeSets = Object.values(shapeOf).filter(Boolean).concat(barShapes);

// The frames that have the metal of the team, steel or gold (tokens.css): Cybertron's, and those of the bar
// layout. The page change never gives them another metal (core/areas.js)
export function hasSteel(style, layout = '') {
  return layout === 'bar' || themeOf(style) === 'cybertron';
}

// layout is the layout the frames are drawn for. Without one the old name Minimal still gives its own corners
export function shapesFor(style, layout = '') {
  if (layout === 'bar' || (layout === '' && style === barStyle)) return barShapes;
  return isStyle(style) ? shapeOf[themeOf(style)] : '';
}

// A preview (core/preview.js) holds a style on the screen for a while without writing the
// setting. until is a time in milliseconds. A new call replaces the one before, and a
// name that is not a style ends it.
let previewed = null; // { style, until }

export function previewStyle(style, until) {
  previewed = isStyle(style) && typeof until === 'number' && isFinite(until) ? { style: style, until: until } : null;
}

// The Screens (core/screens.js) hold the style of the row that plays, the way a preview
// holds one, but weaker: a preview and ?style= win over it, and it wins over Style in Dashboard
// Settings. A name that is not a style lets go, and the setting decides again.
let rotated = '';

export function rotateStyle(style) {
  rotated = isStyle(style) ? style : '';
}

// saved is Style from Dashboard Settings, and asked is ?style= in the address. The
// address wins, for this page only, like the other switches. Anything that is not a
// style is ignored. A preview that has time left wins over both, and the style the
// Screens hold comes after the address and before the setting. now is a Date.
export function chooseStyle(saved, asked, now = new Date()) {
  if (previewed && now.getTime() < previewed.until) return previewed.style;
  if (isStyle(asked)) return asked;
  if (rotated !== '') return rotated;
  if (isStyle(saved)) return saved;
  return defaultSettings.style;
}

// themeLayout is the layout the theme names (layoutOf in core/layout.js)
// The views hold the layout of the view that plays (core/views-run.js), and the bar layout goes with any theme
let rotatedLayout = '';

export function rotateLayout(layout) {
  rotatedLayout = layout === 'bar' ? 'bar' : '';
}

export function layoutFor(style, themeLayout) {
  const forced = isStyle(style) ? forcedLayout[style] : null;
  return forced || rotatedLayout || themeLayout;
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
export function recordShapes(style, page = pageOrNone(), layout = '') {
  if (!page || !page.dataset) return;

  const shapes = shapesFor(style, layout);
  if (shapes) page.dataset.shapes = shapes;
  else delete page.dataset.shapes;
}
