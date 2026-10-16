// The view on the page: the key of the view whose look is held, and the key written on the html element. The
// panels that carry the name of the view (the banners) read the page, the way the layout and the style are read
// (core/layout.js, layoutNow; core/style.js, styleNow). Plain functions with no page in sight until one is given.

import { viewKeys } from '../config.js';

// The view whose look is held: the one of the last step the large panel began (core/views-run.js)
let held = '';

export function heldView() {
  return held;
}

export function holdView(key) {
  held = viewKeys.includes(key) ? key : '';
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

// The words the banners draw for the view on the page: its name for the tag, its title when it has one of its own, and
// whether the tag is drawn. shell.js writes them with the view (it has the content), and the banners read them, so a
// banner does not need the views themselves.
export function viewLabelsNow(page = pageOrNone()) {
  const data = page && page.dataset ? page.dataset : {};
  return { name: data.viewName || '', title: data.viewTitle || '', tag: data.viewTag === 'on' };
}

export function applyViewLabels(labels, page = pageOrNone()) {
  if (!page || !page.dataset) return;

  const wanted = { viewName: labels.name, viewTitle: labels.title, viewTag: labels.tag ? 'on' : 'off' };
  Object.keys(wanted).forEach(name => {
    if (page.dataset[name] !== wanted[name]) page.dataset[name] = wanted[name];
  });
}
