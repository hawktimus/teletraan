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
// tests/layouts.test.mjs can run them. core/layout-apply.js puts the answer on
// the page, before any region is drawn, and the stylesheets layouts/sidebar.css
// and layouts/bar.css do the placing, from the numbers below.
//
// The regions are drawn for one layout at a time. When the theme or the style changes to
// one with another layout, the page changes layout while the screen runs, in a swap
// (core/layout-apply.js, changeLayout). Only if that fails does the page reload, once
// (mustReload below). A change between Original and Cybertron keeps the layout and only
// draws the frames again (core/areas.js, redrawFrames).

export {
  layouts, defaultLayout, isLayout, layoutOf, chooseLayout, layoutNow, hasRegion, areasOf, otherAreas, everyBlock,
  blocksOf, decorationLayers, kitTheme, hasKit, kitMarkup, screen,
} from './layout-core.js';
export { sidebarSettings, makeSidebarGeometry, sidebarGeometry, cssVariables } from './layout-sidebar.js';
export {
  barSettings, makeBarGeometry, barGeometry, rectanglesOf, mirrorRectangle, mirrorGeometry, barCssVariables,
  reloadKey, drawnFor, isDrawn, mustReload,
} from './layout-bar.js';
