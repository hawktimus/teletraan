// The text of the four tabs (Now showing, Status, Keys, Log) as HTML strings. They take the answers
// of the control API and give markup, with every value from the Teletraan computer escaped. The tab files
// (now.js, status.js, keys.js, log.js) put the markup in the page and wire the buttons. Nothing
// here touches the page, so Node can try it.

export function esc(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// "3 minutes ago", "2 hours ago", or "not yet"
export function agoText(iso, now = new Date()) {
  const then = Date.parse(iso);
  if (!iso || isNaN(then)) return 'not yet';
  const seconds = Math.max(0, Math.round((now.getTime() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes + (minutes === 1 ? ' minute ago' : ' minutes ago');
  const hours = Math.round(minutes / 60);
  if (hours < 48) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
  return Math.round(hours / 24) + ' days ago';
}

function bytesText(bytes) {
  if (typeof bytes !== 'number') return 'not known';
  const gigabytes = bytes / (1024 * 1024 * 1024);
  return gigabytes >= 10 ? Math.round(gigabytes) + ' GB' : gigabytes.toFixed(1) + ' GB';
}

function row(label, value) {
  return '<div class="row"><dt>' + esc(label) + '</dt><dd>' + value + '</dd></div>';
}

function card(title, body, extra = '') {
  return '<section class="card ' + extra + '"><h2>' + esc(title) + '</h2>' + body + '</section>';
}

const colorWords = { green: 'Up to date', amber: 'Late', red: 'Failed' };

function dotRow(name, dot) {
  const color = dot && dot.color ? dot.color : 'amber';
  return '<div class="dot-row"><span class="dot" data-color="' + esc(color) + '"></span>' +
    '<div><strong>' + esc(name) + '</strong> <span class="word">' + esc(colorWords[color] || '') + '</span>' +
    '<p>' + esc(dot ? dot.reason : 'Not known.') + '</p></div></div>';
}

// The Status tab
export function statusHtml(data, now = new Date()) {
  if (!data) return card('Status', '<p>The Teletraan computer did not answer.</p>');
  const mini = data.mini || {};
  const previous = data.versions && data.versions.previous && data.versions.previous.length ? data.versions.previous.map(n => 'v' + n).join(', ') : 'none kept';
  const current = data.versions && data.versions.current !== null && data.versions.current !== undefined ? 'v' + data.versions.current : 'not known';
  const cors = data.cors ? (data.cors.ok ? 'Allowed' : 'Blocked: ' + esc(data.cors.message || 'Studio cannot reach this page') + (data.cors.also ? '. Add ' + esc(data.cors.origin) + '. If you open the Studio on port 3426, add ' + esc(data.cors.also) + ' too' : '')) : 'Not checked';
  const disk = data.disk ? bytesText(data.disk.freeBytes) + ' free of ' + bytesText(data.disk.totalBytes) : 'not known';

  const dots = card('The three dots on the TV',
    dotRow('Monday', data.dots && data.dots.monday) + dotRow('Band (calendars)', data.dots && data.dots.band) + dotRow('Sanity (content)', data.dots && data.dots.sanity));

  const running = card('Running', '<dl>' +
    row('Release', esc(current)) +
    row('Earlier releases', esc(previous)) +
    row('Screen', esc(data.kiosk || 'not known')) +
    row('Display', esc(data.display || 'not known')) +
    row('Screen restarts today', esc(data.kioskRestarts === null || data.kioskRestarts === undefined ? 'not known' : data.kioskRestarts)) +
    row('Last restart', esc(agoText(data.lastKioskRestartAt, now))) + '</dl>');

  const reads = card('Last reads', '<dl>' +
    row('Content', esc(agoText(mini.content, now))) +
    row('Calendars', esc(agoText(mini.calendars, now))) +
    row('Slides', esc(agoText(mini.slides, now))) +
    row('Monday', esc(agoText(mini.monday, now))) +
    row('Monday reads today', esc(data.mondayCallsToday === null || data.mondayCallsToday === undefined ? 'not known' : data.mondayCallsToday)) +
    row('Competition data', esc(agoText(mini.frc, now))) +
    row('Screen started', esc(agoText(mini.screenStarted, now))) +
    row('Last backup', esc(agoText(data.lastBackupAt, now))) + '</dl>');

  const around = card('The Teletraan computer', '<dl>' +
    row('Sanity', data.sanity && data.sanity.reachable ? 'Reachable' : 'Not reachable' + (data.sanity && data.sanity.error ? ': ' + esc(data.sanity.error) : '')) +
    row('Studio can reach this page', cors) +
    row('Disk', esc(disk)) +
    row('Tailscale address', esc(data.tailscale || 'not known')) + '</dl>');

  return '<div class="grid">' + dots + running + reads + around + '</div>';
}

// The Now showing tab: the card of the wall, then the buttons. options is GET request.
export function nowCardHtml(now, at = new Date()) {
  if (!now || !now.report || now.quiet) {
    const words = now && now.message ? now.message : 'No report from the wall yet';
    const last = now && now.report ? '<p>Last seen: ' + esc(now.report.panel || 'no panel') + ', view ' + esc(now.report.view || 'not known') + '.</p>' : '';
    return card('Now on the wall', '<p class="quiet">' + esc(words) + '</p>' + last, 'grey');
  }
  const report = now.report;
  const rows = (now.rows || []).map(line => '<li>' + esc(line) + '</li>').join('');
  return card('Now on the wall', '<dl>' +
    row('View', esc(report.view || 'not known')) +
    row('Theme', esc(report.theme || 'not known')) +
    row('Panel', esc(report.panel || 'not known')) +
    row('Team', esc(report.team || 'both')) +
    row('Page', esc(report.page || '1')) +
    row('Hold', esc(report.hold || (report.pause ? 'rotation paused' : 'none'))) +
    row('Build', esc(report.build || 'not known')) +
    row('Last report', esc(agoText(now.receivedAt, at))) + '</dl>' +
    (rows ? '<ul class="rows">' + rows + '</ul>' : ''));
}

// A copy of the screen at 1920 by 1080, drawn smaller by the page (tabs/now.js sets the scale from the width of the box)
export const previewWidth = 1920;
export const previewHeight = 1080;

export function previewScale(boxWidth) {
  const width = Number(boxWidth);
  return Number.isFinite(width) && width > 0 ? Math.round((width / previewWidth) * 10000) / 10000 : 0.1;
}

export function previewCardHtml() {
  return card('Live preview',
    '<div class="preview" data-preview-box><iframe data-preview-frame src="/dashboard/" title="A copy of the dashboard" width="' + previewWidth + '" height="' + previewHeight + '" sandbox="allow-scripts allow-same-origin" tabindex="-1"></iframe></div>' +
    '<p class="note">A copy of the screen on this device. It runs by itself, so it may show a different panel than the TV at this moment. The card above says what the TV shows.</p>');
}

function button(action, label, data = '', kind = '') {
  return '<button type="button" class="act ' + kind + '" data-action="' + esc(action) + '"' + data + '>' + esc(label) + '</button>';
}

function choice(name, items, label) {
  const list = items.map(item => '<option value="' + esc(item.value) + '">' + esc(item.label) + '</option>').join('');
  return '<label class="pick"><span>' + esc(label) + '</span><select name="' + esc(name) + '">' + list + '</select></label>';
}

export function nowControlsHtml(options) {
  const o = options || {};
  const views = (o.views || []).map(view => ({ value: view.key, label: view.name }));
  const themes = (o.themes || []).map(theme => ({ value: theme, label: theme }));
  const panels = (o.panels || []).map(panel => ({ value: panel, label: panel }));
  const talks = (o.talks || []).map(talk => '<li>' + esc(talk.name || talk.topic || 'Talk') + ', ' + esc(talk.start) + '</li>').join('');
  const live = o.liveAnnouncements === null || o.liveAnnouncements === undefined ? 'not known' : o.liveAnnouncements;
  const blocked = o.canWrite === false ? '<p class="warn">SANITY_WRITE_TOKEN is not set. Add it on the Keys tab, then these buttons work.</p>' : '';

  return '<div class="grid">' + blocked +
    card('Move on', '<div class="buttons">' + button('next', 'Next') + button('pause', 'Pause rotation') + button('resume', 'Resume rotation') + button('schedule', 'Back to schedule', '', 'quiet') + '</div>') +
    card('Hold this panel', choice('panel', panels, 'Panel') + '<div class="buttons">' + button('hold', 'Hold 10 minutes', ' data-minutes="10"') + button('hold', 'Hold 30 minutes', ' data-minutes="30"') + '</div>') +
    card('Show a view', choice('view', views, 'View') + '<div class="buttons">' + button('view', 'Show this view') + '</div>') +
    card('Preview a theme', choice('theme', themes, 'Theme') + '<div class="buttons">' + button('theme', 'Preview for 10 minutes') + '</div>') +
    card('Announcements', '<p>' + esc(live) + ' live now.</p><div class="buttons">' + button('announce', 'Play announcement') + '</div>' +
      '<label class="pick"><span>Post an announcement (90 characters, two hours, both teams)</span><input name="text" maxlength="90" autocomplete="off"></label>' +
      '<div class="buttons">' + button('post-announcement', 'Post it') + '</div>') +
    card('Presentation', (talks ? '<ul class="rows">' + talks + '</ul>' : '<p>No talks booked in the next day.</p>') + '<div class="buttons">' + button('presentation-test', 'Run presentation test') + '</div>') +
    '</div><p class="note" data-note></p>';
}

// The Keys tab. describe is GET env.
export function keysHtml(data) {
  const keys = (data && data.keys) || [];
  const calendars = (data && data.calendars) || [];

  const keyRows = keys.map(key => '<div class="key" data-key="' + esc(key.name) + '">' +
    '<div><strong>' + esc(key.label) + '</strong><span class="name">' + esc(key.name) + '</span><span class="masked">' + esc(key.masked) + '</span></div>' +
    '<div class="keyform"><input type="password" autocomplete="off" name="' + esc(key.name) + '" placeholder="New value (leave empty to keep)">' +
    '<button type="button" class="act quiet" data-clear="' + esc(key.name) + '">Clear</button></div></div>').join('');

  const calendarRows = calendars.map(calendar => '<div class="key" data-calendar="' + esc(calendar.name) + '">' +
    '<div><strong>' + esc(calendar.code) + '</strong><span class="name">' + esc(calendar.name) + '</span><span class="masked">' + esc(calendar.masked) + '</span></div>' +
    '<div class="keyform"><input type="password" autocomplete="off" name="' + esc(calendar.name) + '" placeholder="New link (leave empty to keep)">' +
    '<button type="button" class="act quiet" data-clear-calendar="' + esc(calendar.name) + '">Clear</button></div></div>').join('');

  return '<div class="grid">' +
    card('Keys', (keyRows || '<p>No keys are known.</p>') + '<p class="note">PIN: fixed</p>') +
    card('Calendars', (calendarRows || '<p>No calendars yet.</p>') +
      '<div class="key newcal"><div><strong>Add a calendar</strong></div><div class="keyform"><input name="new-name" placeholder="Name, such as Build season" autocomplete="off"><input type="password" name="new-link" placeholder="Link (https:// or webcal://)" autocomplete="off"></div></div>') +
    '</div><div class="buttons"><button type="button" class="act" data-save>Save</button></div><p class="note" data-note></p>';
}

// The Log tab. lines is GET log.
export function logHtml(lines) {
  const list = Array.isArray(lines) ? lines : [];
  if (list.length === 0) return card('Log', '<p>The log is empty.</p>');
  return card('Log', '<pre class="log">' + list.map(esc).join('\n') + '</pre>');
}
