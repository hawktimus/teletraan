// The order the panels come and go in: the plain functions. They know nothing
// about the page, so tools/test-panel-order.mjs can run them.
//
// Dashboard Settings keeps the order as one list, rotation.order. Each row names
// a panel from registry.js and may switch it off or give it seconds. The large
// panels and the small panels are in the same list. Each area follows the rows
// that are its own, in the order they have there, so the two areas still run on
// their own timers (core/schedule.js).
//
// A page saved before that list existed has two lists instead, rotation.grid1
// (large panels) and rotation.grid2 (small panels). An empty order is built from
// them, so a screen that has never had the new list in Studio keeps its order.

import { panels } from '../registry.js';

const areas = ['grid1', 'grid2'];

function regionOf(id) {
  const panel = panels.find(item => item.id === id);
  return panel ? panel.region : null;
}

// The rows of one of the older lists. A panel in the wrong list is left out, as
// the schedule always did.
function rowsOf(list, area) {
  return (Array.isArray(list) ? list : [])
    .filter(step => step && regionOf(step.panel) === area)
    .map(step => Object.assign({}, step));
}

// The older lists as one: the large panels, then the small panels
export function orderFromLists(rotation) {
  const source = rotation || {};
  return areas.reduce((order, area) => order.concat(rowsOf(source[area], area)), []);
}

// The list the screen follows: the order in the settings, or one built from the older lists when it is empty
export function panelOrder(rotation) {
  const source = rotation || {};
  return Array.isArray(source.order) && source.order.length > 0 ? source.order : orderFromLists(source);
}

// The rows of one area, 'grid1' or 'grid2', in order
export function playlistOf(rotation, area) {
  return panelOrder(rotation).filter(step => step && regionOf(step.panel) === area);
}

// How many pages a panel has, 1 unless registry.js says more
function pagesOf(id) {
  const panel = panels.find(item => item.id === id);
  return panel && panel.pages > 1 ? panel.pages : 1;
}

// The rows a list follows, with one row for each page of a panel that has more than one. The Events
// panel is two rows, page 1 and page 2, one after the other. Each takes the switch and the seconds of
// the row it comes from. A panel with one page keeps its row as it is. The list is the same however
// many events there are: a page with nothing on it is skipped when the screen looks for the next panel
// (core/schedule.js), so the rows do not move when the content changes.
export function withPages(steps) {
  const expanded = [];

  steps.forEach(step => {
    const count = pagesOf(step.panel);
    if (count === 1) {
      expanded.push(step);
      return;
    }

    for (let page = 1; page <= count; page++) expanded.push(Object.assign({}, step, { page: page }));
  });
  return expanded;
}
