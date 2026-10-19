// The text of the Status and Settings tabs as HTML strings. They take the answers
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
// The report of the wall from the answer of GET /now, or null when there is none or the wall has gone quiet. The
// card and the Live preview both ask this, so they never disagree about whether the TV has reported.
export function wallReport(now) {
  return now && now.report && typeof now.report === 'object' && !now.quiet ? now.report : null;
}

export function nowCardHtml(now, at = new Date()) {
  if (!wallReport(now)) {
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

// Under this width (a phone) the frame never loads by itself: the whole dashboard in a frame is too much for it
export const previewAutoWidth = 900;

export function previewAutoLoads(viewportWidth) {
  return Number(viewportWidth) >= previewAutoWidth;
}

// The card holds no frame at first. The page makes the frame (tabs/now.js) when the person asks or the screen is
// wide, and takes it out again, so a phone never holds the whole dashboard in memory. data-src is its address.
export function previewCardHtml() {
  return card('Live preview',
    '<div class="preview" data-preview-box data-src="/dashboard/"><p class="preview-off" data-preview-off>The preview is off.</p></div>' +
    '<div class="buttons"><button type="button" class="act" data-preview-toggle aria-pressed="false">Show live preview</button></div>' +
    '<p class="note" data-preview-mode></p>' +
    '<p class="note" data-preview-facts></p>' +
    '<p class="note bad" data-preview-error hidden></p>' +
    '<p class="note" data-preview-open hidden><a href="/mirror/frame.jpg" target="_blank" rel="noopener">Open the picture in a new tab</a></p>' +
    '<div class="buttons" data-preview-black hidden><button type="button" class="act" data-preview-restart>Restart screen</button></div>' +
    '<p class="note" data-preview-line hidden></p>' +
    '<p class="note" data-preview-follow-note hidden>' + esc(followNote) + '</p>');
}

// The mirror: a moving picture of the TV that the Teletraan computer makes (computer/scripts/mirror.py). The words of
// the card for each state, and the frame rate from the times the frames were drawn.
export const mirrorWords = {
  waiting: 'Starting the mirror.',
  failed: 'The mirror could not start. Showing the copy that follows the screen.',
  black: 'The TV picture is black. The picture loads, but the browser on the TV is drawing nothing. Restart the screen.',
  noPython: 'The mirror needs python3 on the computer. Showing the copy that follows the screen.',
};

export const mirrorFrameWait = 10000;

export function mirrorLive(fps, mode = 'screencast') {
  const number = Number.isFinite(fps) && fps > 0 ? Math.round(fps * 10) / 10 : 0;
  if (mode === 'screenshots') return 'Live from the TV (screenshots, ' + number + ' a second)';
  return 'Live from the TV (screencast, ' + number + ' frames a second)';
}

// times are the millisecond clock readings of the frames drawn; only the last windowMs count
export function framesPerSecond(times, now, windowMs = 3000) {
  const recent = (Array.isArray(times) ? times : []).filter(time => now - time <= windowMs && time <= now);
  if (recent.length < 2) return 0;
  const span = (recent[recent.length - 1] - recent[0]) / 1000;
  return span > 0 ? (recent.length - 1) / span : 0;
}

// The words under the picture, from what the browser really loaded
export function pictureFacts(bytes, width, height) {
  const size = Number.isFinite(bytes) && bytes > 0 ? (Math.round((bytes / 1024) * 10) / 10) + ' KB, ' : '';
  if (!(width > 0) || !(height > 0)) return '';
  return 'Last picture: ' + size + width + ' by ' + height + ' pixels';
}

// status is the number a HEAD of the same address answered, or 0 when nothing answered
export function pictureErrorLine(status) {
  const answer = Number(status) > 0 ? 'the server answered ' + Number(status) : 'the server did not answer';
  return 'The picture could not be loaded: ' + answer + '. See Settings, Log.';
}

export function mirrorPictureAddress(counter) {
  return '/mirror/frame.jpg?n=' + encodeURIComponent(String(counter).trim());
}

export const followNote ='A copy that follows the screen. It shows the same panel, team and theme as the TV, and changes when the TV changes, within about ten seconds. Animations and the exact moment can differ.';

// Panels the dashboard address cannot hold: a takeover has no panel of its own to hold, and a stand-in is only drawn
// when something else is missing. The nearest plain panel is shown instead.
const noAddress = ['alert', 'announcement', 'talk', 'stand-in-tile', 'stand-in-ticker', 'banner', 'countdown', 'side', 'bar-banner', 'bar-column', 'ticker'];
const nearestPanel = 'tonight';
const mondayPanels = /^monday-/;
const themeWords = ['original', 'cybertron', 'retro', 'foundry'];
const viewWords = ['general', 'prime', 'nova', 'family'];

function words(id) {
  const text = String(id || '').replace(/-/g, ' ').trim();
  return text === '' ? '' : text.charAt(0).toUpperCase() + text.slice(1);
}

// What the preview frame should hold for one report of the wall: { src, line }. src is '' when the wall has not
// reported. Only the panel, team, theme, view and layout are in the address, so the frame changes only when one of
// them does. The page number is shown in the line and is not in the address: the dashboard address holds a panel at
// its first page.
export function followFor(report) {
  if (!report || typeof report !== 'object' || String(report.panel || '') === '') return { src: '', line: followLine(null) };

  const notes = [];
  let panel = String(report.panel);
  if (noAddress.includes(panel)) {
    notes.push(words(panel) + ' cannot be copied, so the copy shows ' + nearestPanel);
    panel = nearestPanel;
  } else if (mondayPanels.test(panel)) {
    notes.push('the copy has no department for this card');
  }

  const params = ['panel=' + encodeURIComponent(panel)];
  const team = String(report.team || '').trim();
  if (team !== '') params.push('team=' + encodeURIComponent(team));
  const theme = String(report.theme || '').trim();
  if (themeWords.includes(theme)) params.push('screen=' + theme);
  const view = String(report.view || '').trim();
  if (viewWords.includes(view)) params.push('view=' + view);
  if (report.layout === 'bar') params.push('layout=bar');
  params.push('still=1');

  const page = String(report.page || '').trim();
  const shown = [words(panel) + (page !== '' && page !== '1' ? ' (page ' + page + ')' : ''), team === '' ? 'both teams' : team, theme === '' ? 'theme not known' : theme];
  return { src: '/dashboard/?' + params.join('&'), line: followLine(shown, notes) };
}

export function followLine(shown, notes = []) {
  if (!shown) return 'The TV has not reported yet';
  return 'Showing: ' + shown.join(', ') + (notes.length ? '. Note: ' + notes.join('; ') + '.' : '');
}

function button(action, label, data = '', kind = '') {
  return '<button type="button" class="act ' + kind + '" data-action="' + esc(action) + '"' + data + '>' + esc(label) + '</button>';
}

function choice(name, items, label) {
  const list = items.map(item => '<option value="' + esc(item.value) + '">' + esc(item.label) + '</option>').join('');
  return '<label class="pick"><span>' + esc(label) + '</span><select name="' + esc(name) + '">' + list + '</select></label>';
}

function minuteField(name, label, usual, least, most) {
  return '<label class="pick"><span>' + esc(label) + '</span><input name="' + esc(name) + '" type="number" inputmode="numeric" min="' + least + '" max="' + most + '" step="1" value="' + usual + '"></label>';
}

// The theme and view previews. A preview has an end time, and the page shows what is left of it, and what the wall
// reports after a button is pressed (the report of the wall comes every 10 seconds, so a change can take that long to
// show). These are plain functions with no page in them.

export const previewMinutes = 10;
export const wallChecks = { answerSeconds: 15, notChangedSeconds: 20, stopSeconds: 60 };
export const notChangedWords = 'The wall has not changed yet. It checks every 10 seconds.';

const kindWords = { theme: 'theme', view: 'view' };

function clockText(date) {
  const two = number => (number < 10 ? '0' : '') + number;
  return two(date.getHours()) + ':' + two(date.getMinutes());
}

export function previewLeft(until, now = new Date()) {
  const end = Date.parse(until);
  if (!until || isNaN(end) || end <= now.getTime()) return { running: false, seconds: 0, endsAt: '', text: '' };

  const seconds = Math.ceil((end - now.getTime()) / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return { running: true, seconds: seconds, endsAt: clockText(new Date(end)), text: minutes + ':' + (rest < 10 ? '0' : '') + rest };
}

export function nameOfTheme(id) {
  return words(id);
}

// The line under a theme or view card while its request runs: "Previewing Cybertron until 14:32 (9:41 left)". The
// request is { theme, until } or { key, until }, as the service stores it. Empty when no request runs.
export function previewLine(kind, request, names, now = new Date()) {
  const id = request && (kind === 'theme' ? request.theme : request.key);
  const left = previewLeft(request && request.until, now);
  if (!id || !left.running) return '';

  const name = (names && names[id]) || words(id);
  return 'Previewing ' + name + ' until ' + left.endsAt + ' (' + left.text + ' left).';
}

// What the page says about the wall after a press. wanted is the id asked for, report is the wall's last report (or
// null), after is the seconds since the press. It says Done as soon as the wall shows it, and after 20 seconds with no
// change it says the wall has not changed yet.
export function wallCheck(kind, wanted, report, after, names) {
  const shown = report && typeof report === 'object' ? String(report[kind] || '') : '';
  const name = (names && names[wanted]) || words(wanted);

  if (shown === wanted) return { state: 'done', words: 'The wall shows ' + name + ' now.' };
  if (after >= wallChecks.notChangedSeconds) return { state: 'wait', words: notChangedWords };
  return { state: 'wait', words: 'Waiting for the wall. It reports every 10 seconds' + (shown ? ' and now shows ' + (names && names[shown] || words(shown)) : '') + '.' };
}

function previewBlock(kind) {
  return '<p class="note" data-left="' + kind + '" role="status"></p><p class="note" data-wall="' + kind + '" role="status"></p>';
}

export function nowControlsHtml(options) {
  const o = options || {};
  const views = (o.views || []).map(view => ({ value: view.key, label: view.name }));
  const themeWordsOf = o.themeNames || {};
  const themes = (o.themes || []).map(theme => ({ value: theme, label: themeWordsOf[theme] || words(theme) }));
  const panels = (o.panels || []).map(panel => ({ value: panel, label: panel }));
  const talks = (o.talks || []).map(talk => '<li>' + esc(talk.name || talk.topic || 'Talk') + ', ' + esc(talk.start) + '</li>').join('');
  const live = o.liveAnnouncements === null || o.liveAnnouncements === undefined ? 'not known' : o.liveAnnouncements;
  const blocked = o.canWrite === false ? '<p class="warn">SANITY_WRITE_TOKEN is not set. Add it in Settings, Keys, then these buttons work.</p>' : '';

  return '<div class="grid">' + blocked +
    card('Move on', '<div class="buttons">' + button('next', 'Next') + button('pause', 'Pause rotation') + button('resume', 'Resume rotation') + button('schedule', 'Back to schedule', '', 'quiet') + '</div>') +
    card('Hold this panel', choice('panel', panels, 'Panel') + '<div class="buttons">' + button('hold', 'Hold 1 minute', ' data-minutes="1"') + '</div>' +
      minuteField('hold-minutes', 'Minutes (1 to 60)', 10, 1, 60) + '<div class="buttons">' + button('hold', 'Hold for that many minutes', ' data-minutes-from="hold-minutes"') + '</div>') +
    card('Show a view', choice('view', views, 'View') + '<div class="buttons">' + button('view', 'Show this view') + button('schedule', 'Back to schedule', '', 'quiet') + '</div>' + previewBlock('view') +
      minuteField('view-minutes', 'Minutes (10 to 120)', 30, 10, 120) + '<div class="buttons">' + button('view', 'Show for that many minutes', ' data-minutes-from="view-minutes"') + '</div>') +
    card('Preview a theme', choice('theme', themes, 'Theme') + '<div class="buttons">' + button('theme', 'Preview this theme for ' + previewMinutes + ' minutes') + button('schedule', 'Back to schedule', '', 'quiet') + '</div>' + previewBlock('theme') +
      '<p class="note">The theme goes on the wall in a swap within about 20 seconds. After ' + previewMinutes + ' minutes the wall goes back to its schedule.</p>') +
    card('Announcements', '<p>' + esc(live) + ' live now.</p><div class="buttons">' + button('announce', 'Play announcement') + '</div>' +
      '<label class="pick"><span>Post an announcement (90 characters, two hours, both teams)</span><input name="text" maxlength="90" autocomplete="off"></label>' +
      '<div class="buttons">' + button('post-announcement', 'Post it') + '</div>') +
    card('Presentation', (talks ? '<ul class="rows">' + talks + '</ul>' : '<p>No talks booked in the next day.</p>') + '<div class="buttons">' + button('presentation-test', 'Run presentation test') + '</div>') +
    '</div>';
}

// The Keys tab. describe is GET env.
export function keysHtml(data) {
  const keys = (data && data.keys) || [];
  const calendars = (data && data.calendars) || [];

  const keyRows = keys.map(key => '<div class="key" data-key="' + esc(key.name) + '">' +
    '<div><strong>' + esc(key.label) + '</strong><span class="name">' + esc(key.name) + '</span><span class="masked">' + esc(key.masked) + '</span></div>' +
    '<div class="keyform"><input type="password" autocomplete="off" name="' + esc(key.name) + '" placeholder="New value">' +
    '<button type="button" class="act quiet" data-clear="' + esc(key.name) + '">Clear</button></div></div>').join('');

  const calendarRows = calendars.map(calendar => '<div class="key" data-calendar="' + esc(calendar.name) + '">' +
    '<div><strong>' + esc(calendar.code) + '</strong><span class="name">' + esc(calendar.name) + '</span><span class="masked">' + esc(calendar.masked) + '</span></div>' +
    '<div class="keyform"><input type="password" autocomplete="off" name="' + esc(calendar.name) + '" placeholder="New link">' +
    '<button type="button" class="act quiet" data-clear-calendar="' + esc(calendar.name) + '">Clear</button></div></div>').join('');

  return '<div class="grid">' +
    card('Keys', (keyRows || '<p>No keys are known.</p>') + '<p class="note">Leave a box empty to keep what is there. PIN: fixed</p>') +
    card('Calendars', (calendarRows || '<p>No calendars yet.</p>') + '<p class="note">A link starts with https:// or webcal://. Leave a box empty to keep the link.</p>' +
      '<div class="key newcal"><div><strong>Add a calendar</strong></div><div class="keyform"><input name="new-name" placeholder="Name" aria-label="Name of the new calendar" autocomplete="off"><input type="password" name="new-link" placeholder="Link" aria-label="Link of the new calendar" autocomplete="off"></div></div>') +
    '</div><div class="buttons"><button type="button" class="act" data-save>Save</button></div><p class="note" data-note></p>';
}

// The Log tab. lines is GET log.
export function logHtml(lines) {
  const list = Array.isArray(lines) ? lines : [];
  if (list.length === 0) return card('Log', '<p>The log is empty.</p>');
  return card('Log', '<pre class="log">' + list.map(esc).join('\n') + '</pre>');
}

// What a button says when it is done. Every button shows a result: Done in green, or the reason in red.
// body is what was sent. A helper word has a name of its own in the first argument.
export function doneWords(action, body = {}) {
  const minutes = body.minutes ? ' for ' + body.minutes + (body.minutes === 1 ? ' minute' : ' minutes') : '';
  const words = {
    next: 'The screen moves to its next panel within about 10 seconds.',
    pause: 'The rotation is paused.',
    resume: 'The rotation runs again.',
    schedule: 'The screen goes back to its schedule.',
    hold: 'The panel is held' + minutes + '. The screen takes it in within about 10 seconds.',
    view: 'The view is shown' + minutes + '. The wall takes it in within about 20 seconds.',
    theme: 'The theme is previewed for ' + previewMinutes + ' minutes. The wall takes it in within about 20 seconds.',
    announce: 'The announcements play within about 10 seconds. They wait if something else has the screen.',
    'post-announcement': 'The announcement is posted for two hours.',
    'presentation-test': 'The test talk starts within about 10 seconds. It waits if something else has the screen.',
    'restart-kiosk': 'The screen is restarting.',
    'restart-services': 'The services restarted.',
    reboot: 'The Teletraan computer is rebooting. This page is back in about a minute.',
    'sync-now': 'The ' + (body.target || 'sync') + ' sync has started.',
    refresh: 'The log is up to date.',
  };
  return words[action] || 'It worked.';
}

// { state, words } for the line under the buttons: done (green), bad (red) or wait (amber). A restart cuts the
// connection of the page, so for those words a lost connection is expected and the line says to wait.
export function outcome(result, action, body = {}) {
  if (result && result.ok) return { state: 'done', words: 'Done. ' + doneWords(action, body) };
  if (result && result.unreachable && ['reboot', 'restart-services'].includes(action)) {
    return { state: 'wait', words: 'Sent. The connection dropped, which is normal while the computer restarts. Wait about a minute, then reload this page.' };
  }
  return { state: 'bad', words: (result && result.error) || 'That did not work, and the Teletraan computer gave no reason. Settings, Log may have one.' };
}
