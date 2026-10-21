// The top of the Display tab: Now on the wall with the theme picker, and Temporary push. A push holds a theme, a view, a panel,
// an announcement, a hidden transition or a pause on the wall for 1 to 60 minutes, then the wall returns to its schedule by
// itself (control/routes/push.js). What is chosen shows in the large picture first (previewTarget) and goes to the wall only
// when Push is pressed. The countdown follows the clock of the Teletraan computer, not the clock of this device.

import { api, showResult } from './api.js';
import { activeHtml, hiddenBlockHtml, holdHtml, namesOf, nowThemeHtml, pushBlockHtml } from './push-parts.js';
import { hiddenRunHtml } from './render.js';
import { titlesOf } from './display-parts.js';
import { nowLine } from '../display-preview.js';
import { clockOffset, holdWords, leftWords, previewTarget, secondsLeft, usualHold } from '../push-lib.js';

const pollSeconds = 15;
const reportSeconds = 10;

const pausedIn = state => (state.pushes || []).some(push => push.kind === 'pause');

// hooks: { choices(), rows(), selectedRow(), pictures(), onState(state), onReport(report) } give the rotation and the large picture of the page.
// boxes: { now, push, hidden } are the places the markup goes (hidden is the card under More tools, and may be left out). Returns { start, destroy }.
export function startPush(root, boxes, hooks) {
  let state = null;
  let names = namesOf({}, {});
  let offset = 0;
  let gone = false;
  let endingSoon = false;
  let lastReport = null;
  const draft = { theme: '', view: '', panel: '', hold: usualHold, text: '', level: 'notice', noticeTeam: '' };
  const timers = [];

  const nowMs = () => Date.now() + offset;

  function paintHold() {
    root.querySelectorAll('[data-hold-box]').forEach(box => { box.innerHTML = holdHtml(draft.hold); });
  }

  function paintActive() {
    const box = root.querySelector('[data-active]');
    if (box && state) box.innerHTML = activeHtml(state.pushes, state, names, nowMs());
  }

  function paintAll() {
    if (!state) return;
    names = namesOf(state, titlesOf(hooks.choices()));
    boxes.now.innerHTML = nowThemeHtml(state, draft, names);
    boxes.push.innerHTML = pushBlockHtml(state, draft, hooks.choices(), names);
    if (boxes.hidden) boxes.hidden.innerHTML = hiddenBlockHtml(state, lastReport);
  }

  function showPreview() {
    const pictures = hooks.pictures();
    if (!pictures || !state) return;
    pictures.setTarget(previewTarget(draft, hooks.rows(), hooks.selectedRow(), titlesOf(hooks.choices()), names));
  }

  async function load() {
    const answer = await api('GET', '/push');
    if (gone || !answer.ok) {
      if (!gone && !state) boxes.now.innerHTML = '<section class="card"><h2>Now on the wall</h2><p class="result" data-state="bad">' + answer.error.replace(/[<>&]/g, '') + '</p></section>';
      return;
    }
    const first = state === null;
    const before = state;
    state = answer.data;
    offset = clockOffset(state.serverTime, Date.now());
    endingSoon = false;
    if (first) {
      paintAll();
      if (hooks.onState) hooks.onState(state);
    } else {
      names = namesOf(state, titlesOf(hooks.choices()));
      paintActive();
      // The page hears of a new day or a pause, so the Theme rotation and the Playlist stay right
      if (hooks.onState && (before.today !== state.today || before.timeZone !== state.timeZone || pausedIn(before) !== pausedIn(state))) hooks.onState(state);
      const source = root.querySelector('[data-now-theme-source]');
      const name = root.querySelector('[data-now-theme-name]');
      const pushedTheme = state.pushes.find(push => push.kind === 'theme');
      const id = pushedTheme ? pushedTheme.id : state.week[state.today];
      if (name) name.textContent = names.themes[id] || id || 'Not known';
      if (source) source.textContent = pushedTheme ? 'Pushed by hand.' : state.today.charAt(0).toUpperCase() + state.today.slice(1) + ' schedule.';
    }
  }

  async function askReport() {
    if (gone || document.hidden) return;
    const answer = await api('GET', '/now');
    if (gone) return;
    const line = root.querySelector('[data-now-view]');
    const report = answer.ok && answer.data && answer.data.report && !answer.data.quiet ? answer.data.report : null;
    if (line) line.textContent = nowLine(report);
    lastReport = report;
    const hiddenRun = root.querySelector('[data-hidden-run]');
    if (hiddenRun) hiddenRun.innerHTML = hiddenRunHtml(report);
    if (hooks.onReport) hooks.onReport(report);
  }

  // Once a second: the words left on each push. A push that has run out is dropped from the list after a short wait.
  function tick() {
    if (!state) return;
    const now = nowMs();
    let over = false;
    root.querySelectorAll('.left[data-left]').forEach(element => {
      const until = element.dataset.left;
      if (until === '') return;
      if (secondsLeft(until, now) === 0) over = true;
      element.textContent = leftWords(until, now);
    });
    if (over && !endingSoon) {
      endingSoon = true;
      setTimeout(() => { if (!gone) load(); }, 3000);
    }
  }

  function mark(attribute, value) {
    root.querySelectorAll('[' + attribute + ']').forEach(button => {
      const on = button.getAttribute(attribute) === value;
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
      button.classList.toggle('quiet', !on);
    });
  }

  async function send(button, path, body, done) {
    button.disabled = true;
    showResult(button, 'working', 'Sending.');
    const answer = await api('POST', path, body);
    button.disabled = false;
    if (gone) return;
    showResult(button, answer.ok ? 'done' : 'bad', answer.ok ? done : answer.error);
    if (answer.ok) load();
  }

  function bad(button, words) {
    showResult(button, 'bad', words);
  }

  function onClick(event) {
    const hold = event.target.closest('button[data-hold]');
    if (hold) {
      draft.hold = Number(hold.dataset.hold);
      paintHold();
      return;
    }
    const theme = event.target.closest('button[data-theme-pick]');
    if (theme) {
      draft.theme = draft.theme === theme.dataset.themePick ? '' : theme.dataset.themePick;
      mark('data-theme-pick', draft.theme);
      return showPreview();
    }
    const view = event.target.closest('button[data-view-pick]');
    if (view) {
      draft.view = draft.view === view.dataset.viewPick ? '' : view.dataset.viewPick;
      mark('data-view-pick', draft.view);
      return showPreview();
    }

    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled || !state) return;
    const action = button.dataset.action;
    const forHold = holdWords(draft.hold);

    if (action === 'push-theme') {
      if (!draft.theme) return bad(button, 'Pick a theme first.');
      send(button, '/push', { kind: 'theme', theme: draft.theme, minutes: draft.hold }, 'Pushed ' + (names.themes[draft.theme] || draft.theme) + ' for ' + forHold + '.');
    } else if (action === 'push-view') {
      if (!draft.view) return bad(button, 'Pick a view first.');
      send(button, '/push', { kind: 'view', key: draft.view, minutes: draft.hold }, 'Pushed the ' + (names.views[draft.view] || draft.view) + ' view for ' + forHold + '.');
    } else if (action === 'push-panel') {
      if (!draft.panel) return bad(button, 'Pick a panel first.');
      send(button, '/push', { kind: 'panel', panel: draft.panel, minutes: draft.hold }, 'Pushed ' + (names.panels[draft.panel] || draft.panel) + ' for ' + forHold + '.');
    } else if (action === 'push-pause') {
      send(button, '/push', { kind: 'pause', minutes: draft.hold }, 'Rotation paused for ' + forHold + '.');
    } else if (action === 'push-announcement') {
      if (draft.text.trim() === '') return bad(button, 'Type the announcement first.');
      send(button, '/push', { kind: 'announcement', text: draft.text, level: draft.level, team: draft.noticeTeam, minutes: draft.hold }, 'Announcement posted for ' + forHold + '.');
    } else if (action === 'push-hidden') {
      send(button, '/push', { kind: 'hidden', transition: button.dataset.kind }, 'Sent. The wall plays it within a few seconds.');
    } else if (action === 'cancel') {
      send(button, '/push/cancel', { kind: button.dataset.kind }, 'Ended. The wall returns to its schedule.');
    } else if (action === 'reset') {
      send(button, '/push/reset', {}, 'Every push ended. The wall follows today\'s schedule.');
    }
  }

  function onChange(event) {
    const target = event.target;
    if ('panelPick' in target.dataset) {
      draft.panel = target.value;
      showPreview();
    } else if ('noticeLevel' in target.dataset) draft.level = target.value;
    else if ('noticeTeam' in target.dataset) draft.noticeTeam = target.value;
  }

  function onInput(event) {
    if (!('noticeText' in event.target.dataset)) return;
    draft.text = event.target.value;
    const count = root.querySelector('[data-notice-count]');
    if (count) count.textContent = draft.text.length + ' of 90 characters.';
  }

  // Picking a row of the rotation ends the preview of a push, so the tiles go back to unpressed
  function onCleared() {
    draft.theme = '';
    draft.view = '';
    draft.panel = '';
    mark('data-theme-pick', '');
    mark('data-view-pick', '');
    const select = root.querySelector('[data-panel-pick]');
    if (select) select.value = '';
  }

  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('input', onInput);
  root.addEventListener('preview-target-cleared', onCleared);

  return {
    async start() {
      await load();
      askReport();
      timers.push(setInterval(tick, 1000), setInterval(load, pollSeconds * 1000), setInterval(askReport, reportSeconds * 1000));
    },
    destroy() {
      gone = true;
      timers.forEach(clearInterval);
      root.removeEventListener('click', onClick);
      root.removeEventListener('change', onChange);
      root.removeEventListener('input', onInput);
      root.removeEventListener('preview-target-cleared', onCleared);
    },
  };
}
