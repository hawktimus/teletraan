// The four requests a coach makes from the control page (control/routes/request.js): hold a
// panel, show a view, preview a theme, pause the rotation. Each one is a hidden object in Dashboard
// Settings with an until time, so a request that is forgotten ends on its own. The runtime asks
// activeRequests once a second or so and acts on what it gives back.

import { isRecord } from './text.js';

export const viewKeys = ['general', 'prime', 'nova', 'family'];
export const themeIds = ['original', 'cybertron', 'retro'];

// The longest a request may run. The control page asks for 10 to 120 minutes, and a time further off
// than this is a mistake, so it is not obeyed.
export const longestMinutes = 120;

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

  return {
    holdPanel: hold ? tidy.holdPanel.panel : '',
    showView: view ? tidy.showView.key : '',
    previewTheme: theme ? tidy.previewTheme.theme : '',
    pauseRotation: pause,
  };
}
