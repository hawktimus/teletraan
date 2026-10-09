// Puts the layout on the page (core/layout.js decides which one). Two jobs:
//
//   startLayout()      the first thing the screen does, before any region, area
//                      or panel is drawn. It sets data-layout on the html element,
//                      and for the sidebar layout it also hands the numbers to
//                      layouts/sidebar.css, shows the top strip and moves the banner
//                      and the countdown into the sidebar column. For the bar layout
//                      it hands the numbers to layouts/bar.css, shows the row of
//                      the side column and the main panel, and moves the large
//                      frame into it.
//   holdForLayout()    asked by theme-apply.js each time a look is about to go
//                      on. When the theme and the style give another layout than
//                      the page has, the page reloads, once, and starts in the
//                      right one.
//
// Nothing here moves anything. docs/layouts.md explains the layouts.

import { barCssVariables, blocksOf, chooseLayout, cssVariables, defaultLayout, drawnFor, everyBlock, kitMarkup, layoutNow, layoutOf, mustReload } from './layout.js';
import { layoutFor, shapesFor, shapesNow, styleNow } from './style.js';

// address is ?theme= from the address bar, or null. readTheme() gives the Theme
// document as it was saved the last time the content was read from Sanity, or
// null (core/content.js, savedTheme). page is the html element, and only the
// tests give another. style is the style startStyle() chose (core/style.js), and
// the layout of Minimal is the bar layout whatever the theme says. Original and
// Cybertron have the layout of the theme.
// Returns the layout it chose. Whatever goes wrong, the screen starts in the
// standard layout.
export function startLayout(address, readTheme, page = document.documentElement, style) {
  let layout = defaultLayout;

  try {
    layout = chooseLayout(readTheme(), address, new Date(), style);
  } catch (error) {
    console.error('Could not choose the layout. The screen starts in the standard layout.', error);
  }

  try {
    if (layout !== defaultLayout) placeRegions(layout, page);
  } catch (error) {
    console.error('Could not set up the ' + layout + ' layout. The screen starts in the standard layout.', error);
    layout = defaultLayout;
  }

  page.dataset.layout = layout;
  return layout;
}

// The elements a layout needs are in index.html, hidden. Everything a layout needs
// is found before anything is moved or shown, so a missing one leaves the page as
// it was and the screen starts in the standard layout.
function find(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error('index.html has no #' + id);
  return element;
}

function placeRegions(layout, page) {
  if (layout === 'bar') placeBar(page);
  else placeSidebar(layout, page);
}

// The blocks of the layout are the regions that fly apart in a hidden transition:
// each gets data-block, and the standard layout's blocks that this one has not lose it
function markBlocks(layout) {
  const wanted = blocksOf(layout);
  everyBlock.forEach(name => {
    const element = document.getElementById('region-' + name);
    if (!element) return;

    if (wanted.indexOf(name) !== -1) element.setAttribute('data-block', '');
    else element.removeAttribute('data-block');
  });
}

// The bar layout has one element of its own in index.html: the row under the banner
// (#bar-middle), with the side column (#region-column) in it. The large frame is
// moved into the row after the column, and the row is a flex row, so the mirror
// (layouts/bar.css) only has to turn it round. The banner, the column and the ticker
// are drawn by the panels registry.js lists for this layout (panels/bar-banner and
// panels/bar-column), and the banner, the column, the large frame and the ticker are
// its four blocks of the hidden transitions. The standard layout's countdown and
// small frame stay in index.html, empty and out of the way (layouts/bar.css).
function placeBar(page) {
  const middle = find('bar-middle');
  const column = find('region-column');
  const grid1 = find('region-grid1');
  find('region-banner');
  find('region-ticker');

  middle.hidden = false;
  column.hidden = false;
  middle.appendChild(grid1);

  markBlocks('bar');

  const variables = barCssVariables();
  Object.keys(variables).forEach(name => page.style.setProperty(name, variables[name]));
}

// The sidebar layout has two elements of its own in index.html: the top strip,
// with a slot for the team name and one for the clock, and the column, with a
// slot for each part of it. The banner and the countdown keep their own panels and regions, which are
// moved into their slots, and the strip and the sidebar are two of the blocks
// of the hidden transitions. The team name, the clock and the weather are moved
// into the strip by the side panel itself (panels/side/side.js), because they are
// only drawn when the panel is. The standard layout needs none of this, and is left exactly as index.html
// has it.
function placeSidebar(layout, page) {
  // Everything is found before anything is moved, so a missing slot leaves the page as it was
  const strip = find('region-strip');
  find('strip-name'); // only checked here: the side panel puts the name in it
  find('strip-clock'); // and the clock, the date and the weather in this one
  const sidebar = find('region-sidebar');
  const topSlot = find('sidebar-top');
  const countdownSlot = find('sidebar-countdown');
  const banner = find('region-banner');
  const countdown = find('region-countdown');

  topSlot.appendChild(banner);
  countdownSlot.appendChild(countdown);
  strip.hidden = false;
  sidebar.hidden = false;

  markBlocks(layout);

  const variables = cssVariables();
  Object.keys(variables).forEach(name => page.style.setProperty(name, variables[name]));

  addKit();
}

// The few empty elements of the Neon Prime kit (core/layout.js, kitMarkup), put
// inside the blocks so that they fly apart with them. neon-kit.css draws and
// moves them, and only while that theme is on. They are added last and on their
// own, because the layout does not depend on them: a page that cannot take them
// goes on without them.
function addKit() {
  try {
    Object.keys(kitMarkup).forEach(block => {
      const region = document.getElementById('region-' + block);
      if (region) region.insertAdjacentHTML('beforeend', kitMarkup[block]);
    });
  } catch (error) {
    console.error('Could not add the kit to the layout. The screen goes on without it.', error);
  }
}

// Even asking for sessionStorage can throw, for example when the browser has storage switched off
function savedStorage() {
  try {
    return window.sessionStorage;
  } catch (error) {
    return null;
  }
}

// look is { theme, overlay, style }. Returns true when this look must not go on the
// page now: the page is reloading to change layout (or to draw the frames of the bar
// layout with the corners of another style), or it has to wait for the
// moment it can, because an alert or an announcement has the screen and the
// new page would not bring it back. theme-apply.js asks again at its next
// page change and once a minute. When the layout is the same, or the page
// cannot safely reload (core/layout.js, mustReload), it returns false and the
// colours go on as usual, with the style the page already has. busy() is true while
// something has the screen. A look with no style is the original style, which leaves the layout to the theme.
export function holdForLayout(look, busy) {
  const wanted = drawnFor(layoutFor(look.style, layoutOf(look.theme)), shapesFor(look.style));
  const onPage = drawnFor(layoutNow(), shapesNow());
  const storage = savedStorage();

  if (wanted === onPage) {
    mustReload(onPage, wanted, storage); // rubs the note out
    return false;
  }
  if (busy && busy()) return true;
  if (!mustReload(onPage, wanted, storage)) {
    // The page stays as it was drawn, so the style stays too: a style would not fit regions drawn for another layout
    look.style = styleNow();
    return false;
  }

  window.location.reload();
  return true;
}
