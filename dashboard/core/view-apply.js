// The view on the page: the key of the view whose look is held, and the key written on the html element. The
// panels that carry the name of the view (the banners) read the page, the way the layout and the style are read
// (core/layout.js, layoutNow; core/style.js, styleNow). Plain functions with no page in sight until one is given.

import { viewKeys } from '../config.js';

// The view whose look is held: the one of the last step the large panel began (core/views-run.js)
let held = '';

export function heldView() {
  return held;
}

// The layout of the held view. core/style.js asks for it, so that a bar view is in the bar layout whatever theme is on.
let heldLayoutName = '';

export function heldLayout() {
  return heldLayoutName;
}

export function holdView(key, layout = '') {
  held = viewKeys.includes(key) ? key : '';
  heldLayoutName = held !== '' && (layout === 'bar' || layout === 'standard') ? layout : '';
}

function pageOrNone() {
  return typeof document === 'undefined' ? null : document.documentElement;
}

// The view on the page now. With no page, or no attribute, it is none.
export function viewNow(page = pageOrNone()) {
  const name = page && page.dataset ? page.dataset.view : '';
  return viewKeys.includes(name) ? name : '';
}

// Written only when it changes. Returns true when the page had another view, so the panels that carry its name can be
// drawn again. A name that is not a view leaves the page as it is.
export function applyView(key, page = pageOrNone()) {
  if (!page || !page.dataset || !viewKeys.includes(key) || page.dataset.view === key) return false;

  page.dataset.view = key;
  return true;
}

// The theme written on the page for the control page's report (core/now-report.js reads data-theme). Written only when
// it changes.
export function applyTheme(theme, page = pageOrNone()) {
  if (!page || !page.dataset || typeof theme !== 'string' || theme === '' || page.dataset.theme === theme) return false;

  page.dataset.theme = theme;
  return true;
}
