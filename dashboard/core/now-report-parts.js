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
    dots: dots,
  };
}

// The report for a moment. parts holds what the page knows:
//   view, theme, layout, team, panel, page, build   words or empty
//   requests                                 activeRequests() of core/screen-requests.js
//   dots                                     dotStates() of core/dots.js
export function makeReport(parts, now = new Date()) {
  const source = parts && typeof parts === 'object' ? parts : {};
  const requests = source.requests && typeof source.requests === 'object' ? source.requests : {};

  return cleanReport(Object.assign({}, source, { hold: requests.holdPanel, pause: requests.pauseRotation }), now);
}
