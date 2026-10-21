// The Now on the wall card of Status (it only shows) and the controls of the Display tab (they change what the wall shows). The
// card refreshes every 10 seconds, the length of the dashboard's own report. The Live preview card is in preview.js.

import { api, showResult, useStyles } from './api.js';
import { heldLine, nowCardHtml, nowControlsHtml, outcome, pauseStateWords, previewLine, previewMinutes, wallCheck, wallChecks, wallReport } from './render.js';

// The sentence for a minutes field that holds no whole number inside its own limits, or '' when it is fine
function fieldProblem(field) {
  const text = field ? field.value.trim() : '';
  const number = Number(text);
  if (text === '' || !Number.isInteger(number) || number < Number(field.min) || number > Number(field.max)) {
    return 'Type a whole number of minutes from ' + field.min + ' to ' + field.max + '.';
  }
  return '';
}

// The theme and view requests of this page: what was asked, when it ends, and when it was pressed. A press starts the
// check of the wall: it asks for the report every 3 seconds for a minute and writes what the wall shows under the card.
// A request that was already running when the tab opened has no check, only its end time.
function makeWatcher(root, options) {
  const names = { theme: options.themeNames || {}, view: {} };
  (options.views || []).forEach(view => { names.view[view.key] = view.name; });
  const requests = { theme: null, view: null };
  const checks = { theme: null, view: null };
  const stored = options.requests || {};
  if (stored.previewTheme && stored.previewTheme.theme) requests.theme = { id: stored.previewTheme.theme, until: stored.previewTheme.until };
  if (stored.showView && stored.showView.key) requests.view = { id: stored.showView.key, until: stored.showView.until };

  const line = (name, kind) => root.querySelector('[data-' + name + '="' + kind + '"]');
  const put = (name, kind, text, state) => {
    const box = line(name, kind);
    if (!box) return;
    box.textContent = text;
    if (state) box.dataset.state = state; else delete box.dataset.state;
  };

  function show() {
    ['theme', 'view'].forEach(kind => {
      const request = requests[kind];
      const shape = request ? (kind === 'theme' ? { theme: request.id, until: request.until } : { key: request.id, until: request.until }) : null;
      const words = shape ? previewLine(kind, shape, names[kind], new Date()) : '';
      put('left', kind, words);
      if (shape && words === '') requests[kind] = null;
    });
  }

  async function check(kind) {
    const watch = checks[kind];
    if (!watch) return;
    const after = (Date.now() - watch.at) / 1000;
    if (after > wallChecks.stopSeconds) { checks[kind] = null; return; }

    const answer = await api('GET', '/now');
    if (checks[kind] !== watch) return;
    const report = answer.ok ? wallReport(answer.data) : null;
    const result = wallCheck(kind, watch.id, report, after, names[kind]);
    put('wall', kind, result.words, result.state);
    if (result.state === 'done') checks[kind] = null;
  }

  return {
    // Called after a press that worked. until comes from the service.
    asked(action, body, until) {
      const kind = action === 'theme' ? 'theme' : 'view';
      const id = kind === 'theme' ? body.theme : body.key;
      const end = until || new Date(Date.now() + (kind === 'theme' ? previewMinutes : Number(body.minutes) || 30) * 60000).toISOString();
      requests[kind] = { id: id, until: end };
      checks[kind] = { id: id, at: Date.now() };
      put('wall', kind, 'Waiting for the wall. It reports every 10 seconds.', 'wait');
      show();
    },
    cleared() {
      requests.theme = null;
      requests.view = null;
      checks.theme = null;
      checks.view = null;
      ['theme', 'view'].forEach(kind => { put('wall', kind, ''); });
      show();
    },
    tick(count) {
      show();
      if (count % 3 === 0) { check('theme'); check('view'); }
    },
  };
}

// Every Pause or Resume button (the group and the bar at the bottom of a phone) says what a press does
function setPaused(root, paused) {
  root.querySelectorAll('[data-toggle-pause]').forEach(toggle => {
    toggle.dataset.action = paused ? 'resume' : 'pause';
    toggle.textContent = paused ? 'Resume rotation' : 'Pause rotation';
  });
  root.querySelectorAll('[data-pause-state]').forEach(line => { line.textContent = paused ? pauseStateWords.paused : pauseStateWords.running; });
}

// A press is shown at once, and a report of the wall that is older than the press must not turn it back
const pressed = { at: 0 };

function pausedBy(requests, now = new Date()) {
  const until = requests && requests.pauseRotation && requests.pauseRotation.until;
  return Boolean(until) && Date.parse(until) > now.getTime();
}

function wire(root, watcher, afterPress) {
  root.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const body = { action: action };
    // A group of choices has one input for each button, and the chosen one answers
    const value = name => { const field = root.querySelector('[name="' + name + '"]:checked') || root.querySelector('[name="' + name + '"]'); return field ? field.value : ''; };

    // A fixed button has its minutes in data-minutes; the other one reads the field named in data-minutes-from
    if (action === 'hold') body.panel = value('panel');
    if (action === 'view') body.key = value('view');
    if (button.dataset.hours) body.hours = Number(button.dataset.hours);
    if (button.dataset.minutes) body.minutes = Number(button.dataset.minutes);
    if (button.dataset.minutesFrom) {
      const field = root.querySelector('[name="' + button.dataset.minutesFrom + '"]');
      const bad = fieldProblem(field);
      if (bad) { showResult(button, 'bad', bad); return; }
      body.minutes = Number(field.value);
    }
    if (action === 'theme') body.theme = value('theme');
    if (action === 'post-announcement') body.text = value('text');
    if (action === 'hidden') body.kind = button.dataset.kind;

    button.disabled = true;
    showResult(button, 'working', 'Sending.');
    const result = await api('POST', '/request', body);
    button.disabled = false;
    const shown = outcome(result, action, body);
    // The bar at the bottom of a phone has room for one word; the longer sentence is in the group above
    const inBar = Boolean(button.closest('[data-quickbar]'));
    showResult(button, shown.state, inBar && shown.state === 'done' ? 'Done.' : shown.words);
    if (result.ok) afterPress();
    if (result.ok && (action === 'theme' || action === 'view')) watcher.asked(action, body, result.data && result.data.until);
    if (result.ok && action === 'schedule') { watcher.cleared(); setPaused(root, false); pressed.at = Date.now(); }
    if (result.ok && (action === 'pause' || action === 'resume')) { setPaused(root, action === 'pause'); pressed.at = Date.now(); }
    // The words under the bar at the bottom of a phone go away by themselves
    if (button.closest('[data-quickbar]')) setTimeout(() => { const line = button.closest('.buttons').nextElementSibling; if (line && line.classList.contains('result')) line.textContent = ''; }, 6000);
  });
}

// The line that says who decides what the wall shows: the requests that run now, drawn again every 5 seconds so a
// request that ended goes away. options is the answer of GET request. Returns { set(requests), stop() }.
function makeHeld(heldBox, options) {
  const data = options.ok && options.data ? options.data : {};
  const names = { theme: data.themeNames || {}, view: {}, panel: data.panelNames || {} };
  (data.views || []).forEach(view => { names.view[view.key] = view.name; });
  let requests = data.requests || null;
  const draw = () => {
    const words = heldLine(requests, names, new Date());
    heldBox.textContent = words;
    heldBox.dataset.held = words === 'Following the schedule.' ? 'no' : 'yes';
  };
  draw();
  const timer = setInterval(draw, 5000);
  return { set(next) { requests = next; draw(); }, stop() { clearInterval(timer); } };
}

// Status: the line of who decides, and the card of the wall. Nothing here writes. Returns the function that stops it.
export async function mountCard(boxes) {
  useStyles();
  const { cardBox, heldBox } = boxes;
  let left = false;
  let timer = null;
  let held = null;
  const leave = () => { left = true; clearInterval(timer); if (held) held.stop(); };

  // Only the card is redrawn, and only when its words changed, so the scroll position stays
  let last = '';
  async function refresh() {
    const [answer, asked] = await Promise.all([api('GET', '/now'), api('GET', '/request')]);
    if (left) return;
    if (held && asked.ok && asked.data) held.set(asked.data.requests);
    const html = nowCardHtml(answer.ok ? answer.data : { message: answer.error });
    if (html === last) return;
    last = html;
    cardBox.innerHTML = html;
  }
  held = makeHeld(heldBox, await api('GET', '/request'));
  if (left) return leave;
  await refresh();
  if (!left) timer = setInterval(refresh, 10000);
  return leave;
}

// Display: the buttons that change what the wall shows. boxes are root (holds the groups and the bar), controls and
// heldBox. Returns the function that stops it.
export async function mountControls(boxes) {
  useStyles();
  const { controls, root, heldBox } = boxes;
  let timer = null;
  let left = false;
  let ticker = null;
  let held = null;
  const leave = () => { left = true; clearInterval(timer); clearInterval(ticker); if (held) held.stop(); };

  const options = await api('GET', '/request');
  if (left) return leave;
  controls.innerHTML = nowControlsHtml(options.ok ? options.data : null);
  const watcher = makeWatcher(controls, options.ok && options.data ? options.data : {});
  let askAgain = () => {};
  wire(root, watcher, () => askAgain());
  setPaused(root, pausedBy(options.ok && options.data ? options.data.requests : null));
  watcher.tick(0);
  let ticks = 0;
  ticker = setInterval(() => { ticks += 1; watcher.tick(ticks); }, 1000);

  held = makeHeld(heldBox, options);
  askAgain = () => askRequests();
  async function askRequests() {
    const answer = await api('GET', '/request');
    if (left || !answer.ok || !answer.data) return;
    held.set(answer.data.requests);
    if (Date.now() - pressed.at > 15000) setPaused(root, pausedBy(answer.data.requests));
  }

  async function refresh() {
    askRequests();
    const answer = await api('GET', '/now');
    if (left) return;
    if (answer.ok && wallReport(answer.data) && Date.now() - pressed.at > 15000) setPaused(root, wallReport(answer.data).pause === true);
  }
  await refresh();
  if (!left) timer = setInterval(refresh, 10000);
  return leave;
}
