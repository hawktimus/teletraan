// The layouts, their regions and the blocks of the screen (part of layout.js).

import { themes } from '../themes/registry.js';
import { isKnownTheme, resolveTheme } from './theme.js';
import { layoutFor } from './style.js';

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
// all it takes. tests/layouts.test.mjs fails if they stop fitting the screen.

export const screen = { width: 1920, height: 1080 };
