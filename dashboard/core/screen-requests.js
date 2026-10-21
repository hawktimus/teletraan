// The four requests a coach makes from the control page (control/routes/request.js): hold a
// panel, show a view, preview a theme, pause the rotation. Each one is a hidden object in Dashboard
// Settings with an until time, so a request that is forgotten ends on its own. The runtime asks
// activeRequests once a second or so and acts on what it gives back.

import { isRecord } from './text.js';
import { tidyRotationRow } from './rotation.js';

export const viewKeys = ['general', 'prime', 'nova', 'family'];
export const themeIds = ['original', 'cybertron', 'retro', 'foundry'];

// The longest a request may run. The timed buttons of the control page ask for up to 120 minutes and the buttons that
// stay until a reset ask for 24 hours. A time further off than this is a mistake, so it is not obeyed.
export const longestMinutes = 24 * 60;

function timeOrEmpty(value) {
  return typeof value === 'string' && !isNaN(Date.parse(value)) ? value : '';
}

function wordOrEmpty(value, allowed) {
  return typeof value === 'string' && allowed.includes(value) ? value : '';
}

function panelOrEmpty(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9-]{0,59}$/.test(value) ? value : '';
}

function pieces(raw, name, clean) {
  const source = isRecord(raw) ? raw : {};
  const result = { until: timeOrEmpty(source.until) };
  if (name) result[name] = clean(source[name]);
  return result;
}

function tidyHoldPanel(raw) {
  return pieces(raw, 'panel', panelOrEmpty);
}

function tidyShowView(raw) {
  // robotics is the other name of general
  return pieces(raw, 'key', value => wordOrEmpty(value === 'robotics' ? 'general' : value, viewKeys));
}

function tidyPreviewTheme(raw) {
  return pieces(raw, 'theme', value => wordOrEmpty(value, themeIds));
}

function tidyPauseRotation(raw) {
  return pieces(raw, '', null);
}

// The row a hold carries (holdRow of Dashboard Settings): the one row the control page showed in its picture, as JSON in at
// most this many characters. It has the fields of a row of the Rotation (core/row-preview.js reads the same ones).
export const longestHoldRow = 400;

// The view a row names as the views code spells it. family is the Condensed view, which a row of the Rotation cannot name, so
// it is read from the text and not from the tidy row.
const viewOfHoldRow = { robotics: 'general', general: 'general', prime: 'prime', nova: 'nova', family: 'family' };

// The held row of a hold on panel: { row, view } with row tidy (core/rotation.js) and view the view it names ('' when it
// names none), or null when there is no row, it cannot be read, or it is for another panel than the hold. The wall then
// plays the panel as it did before the row existed, from the first row of the Rotation that has it.
export function tidyHoldRow(raw, panel) {
  if (typeof raw !== 'string' || raw === '' || raw.length > longestHoldRow) return null;

  let found;
  try {
    found = JSON.parse(raw);
  } catch (error) {
    return null;
  }
  if (!isRecord(found)) return null;

  const named = typeof found.view === 'string' ? viewOfHoldRow[found.view.trim().toLowerCase()] || '' : '';
  if (found.view !== undefined && found.view !== '' && named === '') return null;

  const row = tidyRotationRow(Object.assign({ view: 'robotics' }, found, { shown: true }));
  if (row === null || row.retired === true || row.panel !== panel) return null;
  return { row: row, view: named };
}

// The four fields of the settings, always complete
export function tidyScreenRequests(settings) {
  const source = isRecord(settings) ? settings : {};

  return {
    holdPanel: tidyHoldPanel(source.holdPanel),
    showView: tidyShowView(source.showView),
    previewTheme: tidyPreviewTheme(source.previewTheme),
    pauseRotation: tidyPauseRotation(source.pauseRotation),
  };
}

// True while the until time is ahead of now and not further ahead than the longest request
export function stillRunning(until, now) {
  const end = Date.parse(until);
  if (isNaN(end)) return false;
  const left = end - now.getTime();
  return left > 0 && left <= longestMinutes * 60 * 1000;
}

// What the screen is asked to do at this moment. A word is empty when there is no such request or it
// has ended.
export function activeRequests(settings, now = new Date()) {
  const tidy = tidyScreenRequests(settings);
  const hold = tidy.holdPanel.panel !== '' && stillRunning(tidy.holdPanel.until, now);
  const view = tidy.showView.key !== '' && stillRunning(tidy.showView.until, now);
  const theme = tidy.previewTheme.theme !== '' && stillRunning(tidy.previewTheme.until, now);
  const pause = stillRunning(tidy.pauseRotation.until, now);
  const held = hold && isRecord(settings) ? tidyHoldRow(settings.holdRow, tidy.holdPanel.panel) : null;

  return {
    holdPanel: hold ? tidy.holdPanel.panel : '',
    // the row of the hold, and the view it names, or null and '' while the hold has no readable row
    heldRow: held ? held.row : null,
    heldRowView: held ? held.view : '',
    showView: view ? tidy.showView.key : '',
    previewTheme: theme ? tidy.previewTheme.theme : '',
    pauseRotation: pause,
  };
}
