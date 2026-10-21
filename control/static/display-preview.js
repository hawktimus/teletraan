// The plain functions behind the pictures of a row in the Display tab: the address of the frame, which small pictures are
// live, the switch that is remembered, and the words. No page is touched here, so tests/control-display-preview.test.mjs
// can read it with node. The page code is tabs/display-preview.js.
//
// A picture is the real dashboard (/dashboard/ on this same server) in a frame, with ?rowpreview= and the row as JSON
// (dashboard/core/row-preview.js). The page asks the dashboard for nothing else and gives it no key.

export const dashboardPath = '/dashboard/';
export const thumbSize = { width: 240, height: 135 };
export const canvas = { width: 1920, height: 1080 };
// At most this many small pictures are live at one time. The rest of the rows show their title.
export const mostThumbs = 6;
// Under this width (a phone) the large picture sits above the rows, and a small picture shows only for the selected row
export const splitWidth = 1000;
export const switchName = 'teletraan-display-thumbs';
// What the frame may do: run the dashboard's own scripts on its own address, nothing else (no forms, popups, downloads
// or moving the page)
export const sandbox = 'allow-scripts allow-same-origin';
export const nowSeconds = 10;

// The fields of a row that change what the picture shows. Seconds and Show on screen are not here, so changing them does
// not load the frame again.
export const pictureFields = ['panel', 'view', 'side', 'department', 'list', 'chart', 'team', 'part', 'photoCount', 'secondsPerPhoto'];

// The part of a row the picture is made from, in a fixed order so that the same row always gives the same address
export function pictureRow(row) {
  const picked = {};
  pictureFields.forEach(name => {
    if (row && row[name] !== undefined && row[name] !== null && row[name] !== '') picked[name] = row[name];
  });
  return picked;
}

// The address of the frame, or '' when the row has no panel to draw
export function pictureAddress(row, theme) {
  const picked = pictureRow(row);
  if (typeof picked.panel !== 'string' || picked.panel === '') return '';
  // screen= is the theme the picture is drawn in (core/still.js); without it the picture takes the theme of today
  const screen = typeof theme === 'string' && /^[a-z]+$/.test(theme) ? '&screen=' + theme : '';
  return dashboardPath + '?rowpreview=' + encodeURIComponent(JSON.stringify(picked)) + screen;
}

// The scale of a frame drawn at 1920 by 1080 inside a box of this width
export function scaleFor(boxWidth) {
  const width = Number(boxWidth);
  return Number.isFinite(width) && width > 0 ? Math.round((width / canvas.width) * 10000) / 10000 : thumbSize.width / canvas.width;
}

// True when the page is open in the browser of the Teletraan computer itself (the kiosk loads it from localhost)
export function isKioskHost(hostname) {
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(String(hostname || '').toLowerCase());
}

export function isPhone(width) {
  return !(Number(width) >= splitWidth);
}

// The switch Show thumbnails: what was saved, else on for a computer and off for a phone. The kiosk never has them.
export function thumbsWanted(saved, width, kiosk) {
  if (kiosk) return false;
  if (saved === 'on') return true;
  if (saved === 'off') return false;
  return !isPhone(width);
}

export function readSwitch(storage) {
  try {
    return storage ? storage.getItem(switchName) : null;
  } catch (error) {
    return null;
  }
}

export function writeSwitch(storage, on) {
  try {
    if (storage) storage.setItem(switchName, on ? 'on' : 'off');
  } catch (error) {
    // the switch still works for this visit
  }
}

// Which rows get a live small picture. visibleKeys are the rows whose small picture is on screen, in page order. A phone
// shows only the selected row's. The selected row always has one when it is on screen, and the rest fill up to max.
export function chooseLive(visibleKeys, selectedKey, max = mostThumbs, phone = false) {
  const keys = phone ? visibleKeys.filter(key => key === selectedKey) : visibleKeys.slice();
  if (keys.length <= max) return keys;

  const picked = keys.slice(0, max);
  if (selectedKey && keys.includes(selectedKey) && !picked.includes(selectedKey)) picked[max - 1] = selectedKey;
  return keys.filter(key => picked.includes(key));
}

// A row with a panel that the dashboard does not draw has no picture: a retired Monday panel or a panel not chosen
export function hasPicture(row, titles) {
  return Boolean(row && typeof row.panel === 'string' && row.panel !== '' && titles[row.panel] !== undefined);
}

export const words = {
  note: 'The real dashboard, with the content the wall reads and the settings of this row as they are on this page, saved or not. The picture holds still.',
  nothing: 'There is no row to draw. Add a row or pick one.',
  retired: 'This panel is not drawn any more, so there is no picture. Pick another panel.',
  noPanel: 'Pick a panel for this row to see it.',
  kiosk: 'This page is open on the Teletraan computer itself. The pictures run on the TV and would slow it, so they are off here. Open this page on your own computer or phone to see them.',
  kioskButton: 'Draw the picture here anyway',
  hidden: 'The picture is paused while this tab is hidden.',
  now: 'What the TV shows now: ',
  notReported: 'The TV has not reported yet.',
};

// The line under the picture: what the TV shows now, from the report the wall sends every 10 seconds
export function nowLine(report) {
  if (!report || typeof report !== 'object' || String(report.panel || '') === '') return words.now + 'not known yet.';
  const parts = [String(report.panel).replace(/-/g, ' ')];
  const page = String(report.page || '').trim();
  if (page !== '' && page !== '1') parts[0] += ' (page ' + page + ')';
  parts.push(String(report.team || '').trim() === '' ? 'both teams' : String(report.team).trim());
  if (String(report.view || '').trim() !== '') parts.push('view ' + String(report.view).trim());
  if (String(report.theme || '').trim() !== '') parts.push('theme ' + String(report.theme).trim());
  return words.now + parts.join(', ') + '.';
}
