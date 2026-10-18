// The Now showing tab: what is on the wall, and the buttons that change it. The card refreshes every
// 10 seconds, the length of the dashboard's own report. The Live preview card is in preview.js.

import { registerTab } from '../tabs.js';
import { api, showResult, useStyles } from './api.js';
import { nowCardHtml, nowControlsHtml, outcome, previewCardHtml, previewLine, previewMinutes, wallCheck, wallChecks, wallReport } from './render.js';
import { wirePreview } from './preview.js';

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

function wire(root, watcher) {
  root.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const body = { action: action };
    const value = name => { const field = root.querySelector('[name="' + name + '"]'); return field ? field.value : ''; };

    // A fixed button has its minutes in data-minutes; the other one reads the field named in data-minutes-from
    if (action === 'hold') body.panel = value('panel');
    if (action === 'view') body.key = value('view');
    if (button.dataset.minutes) body.minutes = Number(button.dataset.minutes);
    if (button.dataset.minutesFrom) {
      const field = root.querySelector('[name="' + button.dataset.minutesFrom + '"]');
      const bad = fieldProblem(field);
      if (bad) { showResult(button, 'bad', bad); return; }
      body.minutes = Number(field.value);
    }
    if (action === 'theme') body.theme = value('theme');
    if (action === 'post-announcement') body.text = value('text');

    button.disabled = true;
    showResult(button, 'working', 'Sending.');
    const result = await api('POST', '/request', body);
    button.disabled = false;
    const shown = outcome(result, action, body);
    showResult(button, shown.state, shown.words);
    if (result.ok && (action === 'theme' || action === 'view')) watcher.asked(action, body, result.data && result.data.until);
    if (result.ok && action === 'schedule') watcher.cleared();
  });
}

registerTab({
  id: 'now',
  title: 'Now showing',
  order: 20,
  async render(container) {
    useStyles();
    container.innerHTML = '<div class="tab"><div data-card></div><div data-preview-card></div><div data-controls></div></div>';
    const cardBox = container.querySelector('[data-card]');
    const previewBox = container.querySelector('[data-preview-card]');
    previewBox.innerHTML = previewCardHtml();
    let stopPreview = wirePreview(previewBox);
    let timer = null;
    let left = false;
    let ticker = null;
    const leave = () => { left = true; clearInterval(timer); clearInterval(ticker); if (stopPreview) stopPreview(); stopPreview = null; };

    const controls = container.querySelector('[data-controls]');
    const options = await api('GET', '/request');
    if (left) return leave;
    controls.innerHTML = nowControlsHtml(options.ok ? options.data : null);
    const watcher = makeWatcher(controls, options.ok && options.data ? options.data : {});
    wire(controls, watcher);
    watcher.tick(0);
    let ticks = 0;
    ticker = setInterval(() => { ticks += 1; watcher.tick(ticks); }, 1000);

    // Only the card of the wall is redrawn, and only when its words changed, so the scroll position stays
    let last = '';
    async function refresh() {
      const answer = await api('GET', '/now');
      if (left) return;
      const html = nowCardHtml(answer.ok ? answer.data : { message: answer.error });
      if (html === last) return;
      last = html;
      cardBox.innerHTML = html;
    }
    await refresh();
    if (!left) timer = setInterval(refresh, 10000);
    return leave;
  },
});
