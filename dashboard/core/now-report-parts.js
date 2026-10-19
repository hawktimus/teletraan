// The plain half of the report to the control page (core/now-report.js sends it, and
// control/routes/now.js checks it again). It knows nothing about the page.

import { dotNames } from './dots.js';

export const reportSeconds = 10;
export const reportAddress = '/control/api/now';

// A page on this computer: the Teletraan computer's own kiosk. A laptop that opens the dashboard must not report.
export function isLocalHost(hostname) {
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(String(hostname));
}

function text(value, longest) {
  return typeof value === 'string' ? value.trim().slice(0, longest) : '';
}

export const hiddenRunLongest = 400;

function flag(value) {
  return typeof value === 'boolean' ? value : null;
}

// The last hidden transition as the wall sends it: { kind, at, steps, ignored, browser, imageTypes }, or null when the
// wall sent none. The whole record is at most hiddenRunLongest characters as JSON. When it is longer, the steps that
// say least go first (the pile and the size on screen), then the oldest, then the browser is cut.
export function cleanHiddenRun(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const types = raw.imageTypes && typeof raw.imageTypes === 'object' ? raw.imageTypes : {};
  const run = {
    kind: text(raw.kind, 20),
    at: text(raw.at, 30),
    steps: (Array.isArray(raw.steps) ? raw.steps : []).filter(step => typeof step === 'string').slice(-12).map(step => text(step, 70)),
    ignored: text(raw.ignored, 100),
    browser: text(raw.browser, 30),
    imageTypes: { png: flag(types.png), webp: flag(types.webp) },
  };

  const tooLong = () => JSON.stringify(run).length > hiddenRunLongest;
  ['pile', 'on screen'].forEach(start => {
    while (tooLong() && run.steps.some(step => step.startsWith(start))) run.steps.splice(run.steps.findIndex(step => step.startsWith(start)), 1);
  });
  while (tooLong() && run.steps.length > 0) run.steps.shift();
  if (tooLong()) run.browser = run.browser.slice(0, 10);
  if (tooLong()) run.ignored = run.ignored.slice(0, 40);
  return run;
}

// A report in its sent shape, cleaned: words cut to size, anything else dropped. The control
// service uses this on what it receives.
export function cleanReport(raw, now = new Date()) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const dots = {};

  dotNames.forEach(name => {
    const state = source.dots && source.dots[name];
    dots[name] = state ? { color: text(state.color, 10), reason: text(state.reason, 200) } : { color: '', reason: '' };
  });

  return {
    at: now.toISOString(),
    view: text(source.view, 20),
    theme: text(source.theme, 20),
    layout: text(source.layout, 10),
    team: text(source.team, 40),
    panel: text(source.panel, 60),
    build: text(source.build, 40),
    page: text(source.page, 10),
    hold: text(source.hold, 60),
    pause: source.pause === true,
    heldNote: text(source.heldNote, 200),
    dots: dots,
    hiddenRun: cleanHiddenRun(source.hiddenRun),
  };
}

// The report for a moment. parts holds what the page knows:
//   view, theme, layout, team, panel, page, build   words or empty
//   requests                                 activeRequests() of core/screen-requests.js
//   dots                                     dotStates() of core/dots.js
//   hiddenRun                                hiddenRunReport() of core/hidden-log.js
export function makeReport(parts, now = new Date()) {
  const source = parts && typeof parts === 'object' ? parts : {};
  const requests = source.requests && typeof source.requests === 'object' ? source.requests : {};

  return cleanReport(Object.assign({}, source, { hold: requests.holdPanel, pause: requests.pauseRotation }), now);
}
