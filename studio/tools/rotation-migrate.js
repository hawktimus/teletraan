// The first rotation list. Dashboard Settings, rotationRows, is filled once with the default rotation (default-rotation.js).
// dashboard/core/rotation.js (migrateRotation) does the same on the screen side, and tests/rotation.test.mjs compares the two.
// The older way, from the lists of the views, is migrateRotationRowsFromViews.
//
// Plain functions only, so that the test can run them with node.

import { defaultRotationRows } from './default-rotation.js';
import { defaultViews, familyPanels } from './view-defaults.js';

export const rotationViewNames = ['robotics', 'prime', 'nova'];
const viewKeys = ['general', 'prime', 'nova', 'family'];
const agendaPanel = 'tonight';

function nameOf(key) {
  return key === 'general' || key === 'family' ? 'robotics' : key;
}

function rowsOf(list) {
  return Array.isArray(list) ? list.filter(row => row && typeof row.panel === 'string' && row.panel !== '') : [];
}

// The rows of one view document, or the starting rows of the view when it has none. Family is always its two panels.
function listOf(key, doc) {
  if (key === 'family') return familyPanels.map(panel => ({ panel: panel, seconds: 30 }));

  const own = rowsOf(doc && doc.panels);
  return own.length > 0 ? own : defaultViews[key].panels;
}

function rowFrom(key, panel) {
  const row = { view: nameOf(key), panel: panel.panel, shown: true };
  ['seconds', 'department', 'photoCount', 'secondsPerPhoto'].forEach(field => {
    if (panel[field] !== undefined && panel[field] !== '') row[field] = panel[field];
  });
  if (row.panel === 'photo' && row.photoCount && row.secondsPerPhoto) row.seconds = row.photoCount * row.secondsPerPhoto;
  return row;
}

// Daily Agenda comes first in every run of Robotics rows
function agendaFirst(rows) {
  const out = [];
  let start = 0;

  while (start < rows.length) {
    let end = start;
    while (end < rows.length && rows[end].view === rows[start].view) end += 1;
    const block = rows.slice(start, end);

    if (block[0].view === 'robotics') {
      const found = block.findIndex(row => row.panel === agendaPanel);
      block.unshift(found >= 0 ? block.splice(found, 1)[0] : { view: 'robotics', panel: agendaPanel, seconds: 45, shown: true });
    }
    out.push(...block);
    start = end;
  }
  return out;
}

// The first fill: the default rotation, fifteen blocks (default-rotation.js), with a key on every row
export function migrateRotationRows() {
  return defaultRotationRows().map((row, index) => Object.assign({ _key: 'rotation-' + (index + 1) }, row));
}

// The list the lists of the views make. order is viewOrder of Dashboard Settings (empty: the four views), views is
// { general, prime, nova, family } with the documents that exist. The result has a key on every row. It is not the first fill any more.
export function migrateRotationRowsFromViews(order, views) {
  const listed = (Array.isArray(order) ? order : []).filter((key, at, all) => viewKeys.includes(key) && all.indexOf(key) === at);
  const keys = listed.length > 0 ? listed : viewKeys;
  const source = views && typeof views === 'object' ? views : {};
  const rows = [];

  keys.forEach(key => listOf(key, source[key]).forEach(panel => rows.push(rowFrom(key, panel))));
  return agendaFirst(rows).map((row, index) => Object.assign({ _key: 'rotation-' + (index + 1) }, row));
}
