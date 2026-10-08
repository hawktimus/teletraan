// Puts the layout on the page (core/layout.js decides which one). Two jobs:
//
//   startLayout()      the first thing the screen does, before any region, area
//                      or panel is drawn. It sets data-layout on the html element,
//                      and for the sidebar layout it also hands the numbers to
//                      layouts/sidebar.css, shows the top strip and moves the banner
//                      and the countdown into the sidebar column.
//   holdForLayout()    asked by theme-apply.js each time a theme is about to go
//                      on. When the theme has another layout than the page, the
//                      page reloads, once, and starts in the right one.
//
// Nothing here moves anything. docs/layouts.md explains the layouts.

import { blocksOf, chooseLayout, cssVariables, defaultLayout, everyBlock, kitMarkup, layoutNow, layoutOf, mustReload } from './layout.js';

// address is ?theme= from the address bar, or null. readTheme() gives the Theme
// document as it was saved the last time the content was read from Sanity, or
// null (core/content.js, savedTheme). page is the html element, and only the
// tests give another. Returns the layout it chose. Whatever goes wrong, the
// screen starts in the standard layout.
export function startLayout(address, readTheme, page = document.documentElement) {
  let layout = defaultLayout;

  try {
    layout = chooseLayout(readTheme(), address, new Date());
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

// The sidebar layout has two elements of its own in index.html: the top strip,
// with a slot for the team name and one for the clock, and the column, with a
// slot for each part of it. The banner and the countdown keep their own panels and regions, which are
// moved into their slots, and the strip and the sidebar are two of the blocks
// of the hidden transitions. The team name, the clock and the weather are moved
// into the strip by the side panel itself (panels/side/side.js), because they are
// only drawn when the panel is. The standard layout needs none of this, and is left exactly as index.html
// has it.
function placeRegions(layout, page) {
  const find = id => {
    const element = document.getElementById(id);
    if (!element) throw new Error('index.html has no #' + id);
    return element;
  };

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

  const wanted = blocksOf(layout);
  everyBlock.forEach(name => {
    const element = document.getElementById('region-' + name);
    if (!element) return;

    if (wanted.indexOf(name) !== -1) element.setAttribute('data-block', '');
    else element.removeAttribute('data-block');
  });

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

// look is { theme, overlay }. Returns true when this look must not go on the
// page now: the page is reloading to change layout, or it has to wait for the
// moment it can, because an alert or an announcement has the screen and the
// new page would not bring it back. theme-apply.js asks again at its next
// page change and once a minute. When the layout is the same, or the page
// cannot safely reload (core/layout.js, mustReload), it returns false and the
// colours go on as usual. busy() is true while something has the screen.
export function holdForLayout(look, busy) {
  const wanted = layoutOf(look.theme);
  const onPage = layoutNow();
  const storage = savedStorage();

  if (wanted === onPage) {
    mustReload(onPage, wanted, storage); // rubs the note out
    return false;
  }
  if (busy && busy()) return true;
  if (!mustReload(onPage, wanted, storage)) return false;

  window.location.reload();
  return true;
}
