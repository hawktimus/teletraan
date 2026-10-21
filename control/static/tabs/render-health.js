// The text of the health block on Status and of the dots and last reads on Settings, Sync and restart. They take the
// answer of GET status (and of GET now for the page loads) and give markup, with every value escaped. Nothing here touches
// the page, so Node can try it.

import { agoText, bytesText, card, dotRow, esc, row, wallReport } from './render.js';

// "3 days 4 hours", "5 hours 12 minutes", "40 minutes"
export function uptimeText(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return 'not known';
  const minutes = Math.floor(seconds / 60);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  const unit = (count, word) => count + ' ' + word + (count === 1 ? '' : 's');
  if (days > 0) return unit(days, 'day') + ' ' + unit(hours, 'hour');
  if (hours > 0) return unit(hours, 'hour') + ' ' + unit(rest, 'minute');
  return unit(rest, 'minute');
}

export function corsWords(cors) {
  if (!cors) return 'Not checked';
  if (cors.ok) return 'Allowed';
  return 'Blocked: ' + esc(cors.message || 'Studio cannot reach this page') +
    (cors.also ? '. Add ' + esc(cors.origin) + '. If you open the Studio on port 3426, add ' + esc(cors.also) + ' too' : '');
}

function memoryWords(memory) {
  if (!memory || !memory.totalKb) return '';
  const used = Math.max(0, memory.totalKb - memory.availableKb);
  return Math.round((used / memory.totalKb) * 100) + ' percent used, ' + bytesText(memory.availableKb * 1024) + ' free';
}

// How many times the page of the wall started in 24 hours, from the report of the wall
function loadsWords(wall) {
  const report = wallReport(wall) || (wall && wall.report && typeof wall.report === 'object' ? wall.report : null);
  if (!report || report.loads === null || report.loads === undefined) return 'not reported yet';
  return String(report.loads) + (report.loadReason ? ', last reason: ' + report.loadReason : '');
}

// The three dots on the TV, with the reason behind each
export function dotsHtml(data) {
  if (!data) return card('The three dots on the TV', '<p>The Teletraan computer did not answer. Check that it is on and on the WiFi, then reload this page.</p>');
  const dots = data.dots || {};
  return card('The three dots on the TV', dotRow('Monday', dots.monday) + dotRow('Band (calendars)', dots.band) + dotRow('Sanity (content)', dots.sanity), '', 'health.dots');
}

// When the Teletraan computer last read each source
export function readsHtml(data, now = new Date()) {
  if (!data) return card('Last reads', '<p>The Teletraan computer did not answer. Check that it is on and on the WiFi, then reload this page.</p>');
  const mini = data.mini || {};
  const headlines = mini.news && typeof mini.newsCount === 'number' ? ', ' + mini.newsCount + (mini.newsCount === 1 ? ' headline' : ' headlines') : '';
  return card('Last reads', '<dl>' +
    row('Content', esc(agoText(mini.content, now))) +
    row('Calendars', esc(agoText(mini.calendars, now))) +
    row('Slides', esc(agoText(mini.slides, now))) +
    row('Monday', esc(agoText(mini.monday, now))) +
    row('Monday reads today', esc(data.mondayCallsToday === null || data.mondayCallsToday === undefined ? 'not known' : data.mondayCallsToday)) +
    row('Competition data', esc(agoText(mini.frc, now))) +
    row('FRC news', esc(agoText(mini.news, now) + headlines)) +
    row('Match13', esc(agoText(mini.match13, now))) +
    row('Drive photos', esc(agoText(mini.photos, now))) +
    row('Screen started', esc(agoText(mini.screenStarted, now))) +
    row('Last backup', esc(agoText(data.lastBackupAt, now))) + '</dl>', '', 'health.reads');
}

// The health block at the bottom of Status. data is GET status, wall is GET now. Memory and temperature are left out when
// the computer does not tell them.
export function healthHtml(data, wall, now = new Date()) {
  if (!data) return card('Health', '<p>The Teletraan computer did not answer. Check that it is on and on the WiFi, then reload this page.</p>');
  const previous = data.versions && data.versions.previous && data.versions.previous.length ? data.versions.previous.map(n => 'v' + n).join(', ') : 'none kept';
  const current = data.versions && data.versions.current !== null && data.versions.current !== undefined ? 'v' + data.versions.current : 'not known';
  const disk = data.disk ? bytesText(data.disk.freeBytes) + ' free of ' + bytesText(data.disk.totalBytes) : 'not known';
  const memory = memoryWords(data.memory);
  const warm = typeof data.temperatureC === 'number' ? data.temperatureC + ' degrees C' : '';

  const running = card('Running', '<dl>' +
    row('Release', esc(current)) +
    row('Earlier releases', esc(previous)) +
    row('Screen', esc(data.kiosk || 'not known')) +
    row('Display', esc(data.display || 'not known')) +
    row('Page loads in 24 hours', esc(loadsWords(wall))) +
    row('Screen restarts today', esc(data.kioskRestarts === null || data.kioskRestarts === undefined ? 'not known' : data.kioskRestarts)) +
    row('Last restart', esc(agoText(data.lastKioskRestartAt, now))) + '</dl>', '', 'health.running');

  const around = card('The Teletraan computer', '<dl>' +
    row('Up for', esc(uptimeText(data.uptimeSeconds))) +
    row('Disk', esc(disk)) +
    (memory ? row('Memory', esc(memory)) : '') +
    (warm ? row('Temperature', esc(warm)) : '') +
    row('Sanity', data.sanity && data.sanity.reachable ? 'Reachable' : 'Not reachable' + (data.sanity && data.sanity.error ? ': ' + esc(data.sanity.error) : '')) +
    row('Studio can reach this page', corsWords(data.cors)) +
    row('Tailscale address', esc(data.tailscale || 'not known')) + '</dl>', '', 'health.computer');

  const errors = Array.isArray(data.lastErrors) ? data.lastErrors : [];
  const last = card('Last errors', errors.length
    ? '<ul class="rows">' + errors.map(line => '<li>' + esc(line) + '</li>').join('') + '</ul>'
    : '<p class="quiet">No failures in the control log.</p>', '', 'health.errors');

  return '<div class="grid">' + running + around + last + '</div>';
}
