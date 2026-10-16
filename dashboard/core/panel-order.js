// The order the panels come and go in: the plain functions. They know nothing
// about the page, so tests/panel-order.test.mjs can run them.
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

// A Monday card is not a panel an editor orders here: it is a Monday row of a Screen (core/screens.js). A row that
// names one, from a page saved when Panel order offered them, is left out.
function isMondayCard(id) {
  const panel = panels.find(item => item.id === id);
  return Boolean(panel && panel.monday);
}

// The rows of one of the older lists. A panel in the wrong list is left out, as
// the schedule always did.
function rowsOf(list, area) {
  return (Array.isArray(list) ? list : [])
    .filter(step => step && regionOf(step.panel) === area && !isMondayCard(step.panel))
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
  return panelOrder(rotation).filter(step => step && regionOf(step.panel) === area && !isMondayCard(step.panel));
}

// How many pages a panel has, 1 unless registry.js says more
function pagesOf(id) {
  const panel = panels.find(item => item.id === id);
  return panel && panel.pages > 1 ? panel.pages : 1;
}

// The rows a list follows, with one row for each page of a panel that has more than one (pages in
// registry.js, which no panel has now: the Events panel scrolls through its own pages). Each takes the
// switch and the seconds of the row it comes from. A panel with one page keeps its row as it is. The
// list is the same however much content there is: a page with nothing on it is skipped when the screen
// looks for the next panel (core/schedule.js), so the rows do not move when the content changes.
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

// The small frame is never left empty. The list it follows is its own rows of Panel order, then every small
// panel the list does not name (the spares), then the one panel that always has something to show (the last
// resort, lastResort in registry.js). core/schedule.js tries them in that order, and only goes on to the next
// kind when the one before it has nothing with content, so the rows keep their order and their switches. A
// panel that has a row, switched on or off, is never a spare: a row that is off stays off. Each step has
// standIn: 'spare' or 'last', and a row of the list has none.
//
// The forecast comes first among the spares because it needs nothing from the editors, only the weather.
const sparesFirst = ['forecast', 'next-event', 'sponsor-logo', 'safety-days', 'task-counts'];

function spareRank(panel) {
  const place = sparesFirst.indexOf(panel.id);
  return place === -1 ? sparesFirst.length : place;
}

export function withStandIns(steps) {
  const named = steps.map(step => step.panel);
  const small = panels.filter(panel => panel.region === 'grid2' && !panel.testOnly);
  const spares = small
    .filter(panel => !panel.lastResort && !named.includes(panel.id))
    .sort((first, second) => spareRank(first) - spareRank(second))
    .map(panel => ({ panel: panel.id, show: true, standIn: 'spare' }));
  const last = small.filter(panel => panel.lastResort).map(panel => ({ panel: panel.id, show: true, standIn: 'last' }));

  return steps.concat(spares, last);
}
