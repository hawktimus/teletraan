// The top of the Display tab: the strip of what is pushed, On the wall now (playback and Show a panel), Theme, and Announce and
// effects. A push holds a theme, a view, a panel, an announcement, a hidden transition or a pause on the wall for 1 to 60 minutes,
// then the wall returns to its schedule by itself (control/routes/push.js). What is chosen shows in the large picture first
// (previewTarget) and goes to the wall only when its button is pressed. The countdown follows the clock of the Teletraan computer,
// not the clock of this device. Next, Pause, Back to schedule and the messages use the request route of the Status buttons.

import { api, showResult } from './api.js';
import { activeHtml, announceHtml, heldHtml, namesOf, onWallHtml, pausedIn, showSettingsHtml, themeCardHtml, themeOfNow } from './push-parts.js';
import { doneWords, hiddenRunHtml, pauseStateWords } from './render.js';
import { settingsOf } from './show-panel-fields.js';
import { titlesOf } from './display-parts.js';
import { clockOffset, holdWords, leftWords, previewTarget, secondsLeft, usualHold } from '../push-lib.js';
import { wireMoreTools } from '../guide.js';

const pollSeconds = 15;
const reportSeconds = 10;
const previewThemeMinutes = 10;

// hooks: { choices(), rows(), selectedRow(), pictures(), onState(state), onReport(report), onPainted() } give the rotation and the large
// picture of the page. boxes: { strip, now, theme, announce } are the places the markup goes. Returns { start, destroy }.
export function startPush(root, boxes, hooks) {
  let state = null;
  let request = {};
  let names = namesOf({}, {});
  let offset = 0;
  let gone = false;
  let endingSoon = false;
  let lastReport = null;
  const draft = { theme: '', view: '', panel: '', settings: {}, hold: usualHold, text: '', level: 'notice', noticeTeam: '' };
  const timers = [];

  const nowMs = () => Date.now() + offset;

  function paintHold() {
    root.querySelectorAll('[data-hold-box]').forEach(box => {
      box.querySelectorAll('button[data-hold]').forEach(button => {
        const on = Number(button.dataset.hold) === draft.hold;
        button.setAttribute('aria-pressed', on ? 'true' : 'false');
        button.classList.toggle('quiet', !on);
      });
    });
  }

  // Every Pause or Resume button (the card and the bar at the foot of a phone) says what a press does
  function setPaused(paused) {
    root.querySelectorAll('[data-toggle-pause]').forEach(toggle => {
      toggle.dataset.action = paused ? 'resume' : 'pause';
      toggle.textContent = paused ? 'Resume rotation' : 'Pause rotation';
    });
    root.querySelectorAll('[data-pause-state]').forEach(line => { line.textContent = paused ? pauseStateWords.paused : pauseStateWords.running; });
  }

  function paintActive() {
    if (!state) return;
    const strip = root.querySelector('[data-active]');
    if (strip) strip.innerHTML = activeHtml(state.pushes, state, names, nowMs());
    root.querySelectorAll('[data-held-now]').forEach(line => { line.innerHTML = heldHtml(state.pushes, names, nowMs()); });
  }

  function paintTheme() {
    const theme = themeOfNow(state);
    root.querySelectorAll('[data-now-theme-name]').forEach(item => { item.textContent = names.themes[theme.id] || theme.id || 'Not known'; });
    root.querySelectorAll('[data-now-theme-source]').forEach(item => { item.textContent = theme.source; });
  }

  function paintSettings() {
    const box = root.querySelector('[data-show-settings]');
    if (box) box.innerHTML = showSettingsHtml(draft, hooks.choices(), rowOfPanel());
  }

  function rowOfPanel() {
    return draft.panel ? hooks.rows().find(row => row.panel === draft.panel) || null : null;
  }

  function paintAll() {
    if (!state) return;
    names = namesOf(state, titlesOf(hooks.choices()));
    boxes.now.innerHTML = onWallHtml(state, draft, hooks.choices(), names, nowMs());
    boxes.theme.innerHTML = themeCardHtml(state, draft, names);
    boxes.announce.innerHTML = announceHtml(state, draft, lastReport, request);
    wireMoreTools(boxes.announce);
    setPaused(pausedIn(state.pushes));
    paintActive();
    if (hooks.onPainted) hooks.onPainted();
  }

  function showPreview() {
    const pictures = hooks.pictures();
    if (!pictures || !state) return;
    const picked = Object.assign({}, draft, { settings: settingsOf(draft.panel, draft.settings, hooks.choices()) });
    pictures.setTarget(previewTarget(picked, hooks.rows(), hooks.selectedRow(), titlesOf(hooks.choices()), names));
  }

  async function load() {
    const answer = await api('GET', '/push');
    if (gone || !answer.ok) {
      if (!gone && !state) boxes.now.innerHTML = '<section class="card"><h2>On the wall now</h2><p class="result" data-state="bad">' + answer.error.replace(/[<>&]/g, '') + '</p></section>';
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
      paintTheme();
      setPaused(pausedIn(state.pushes));
      // The page hears of a new day or a pause, so the Theme rotation and the playlist words stay right
      if (hooks.onState && (before.today !== state.today || before.timeZone !== state.timeZone || pausedIn(before.pushes) !== pausedIn(state.pushes))) hooks.onState(state);
    }
  }

  async function askReport() {
    if (gone || document.hidden) return;
    const answer = await api('GET', '/now');
    if (gone) return;
    const report = answer.ok && answer.data && answer.data.report && !answer.data.quiet ? answer.data.report : null;
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

  // Each answer is written under the button that was pressed. The bar at the foot of a phone has room for one word.
  function putResult(button, kind, words) {
    const inBar = Boolean(button.closest('[data-quickbar]'));
    showResult(button, kind, inBar && kind === 'done' ? 'Done.' : words);
    if (inBar) setTimeout(() => { const line = button.closest('.buttons').nextElementSibling; if (line && line.classList.contains('result')) line.textContent = ''; }, 6000);
  }

  async function send(button, path, body, done) {
    button.disabled = true;
    putResult(button, 'working', 'Sending.');
    const answer = await api('POST', path, body);
    button.disabled = false;
    if (gone) return false;
    putResult(button, answer.ok ? 'done' : 'bad', answer.ok ? done : answer.error);
    if (answer.ok) load();
    return answer.ok;
  }

  // The same words the Status buttons used, for the actions that go to the request route
  function ask(button, body) {
    return send(button, '/request', body, doneWords(body.action, body));
  }

  function bad(button, words) {
    putResult(button, 'bad', words);
  }

  // A view and a panel are two pushes. The view is sent first, so the panel is found in it.
  async function showOnWall(button) {
    if (!draft.view && !draft.panel) return bad(button, 'Pick a view or a panel first.');
    const forHold = holdWords(draft.hold);
    const view = draft.view ? 'the ' + (names.views[draft.view] || draft.view) + ' view' : '';
    const panel = draft.panel ? names.panels[draft.panel] || draft.panel : '';
    button.disabled = true;
    putResult(button, 'working', 'Sending.');
    let answer = { ok: true };
    if (draft.view) answer = await api('POST', '/push', { kind: 'view', key: draft.view, minutes: draft.hold });
    if (answer.ok && draft.panel) answer = await api('POST', '/push', { kind: 'panel', panel: draft.panel, minutes: draft.hold });
    button.disabled = false;
    if (gone) return;
    putResult(button, answer.ok ? 'done' : 'bad', answer.ok ? 'Showing ' + (panel && view ? panel + ' in ' + view : panel || view) + ' for ' + forHold + '.' : answer.error);
    if (answer.ok) load();
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

    if (['next', 'pause', 'resume', 'schedule', 'announce', 'presentation-test'].includes(action)) {
      ask(button, { action: action }).then(worked => {
        if (worked && (action === 'pause' || action === 'resume')) setPaused(action === 'pause');
      });
    } else if (action === 'show-on-wall') showOnWall(button);
    else if (action === 'push-theme') {
      if (!draft.theme) return bad(button, 'Pick a theme first.');
      send(button, '/push', { kind: 'theme', theme: draft.theme, minutes: draft.hold }, 'Switched to ' + (names.themes[draft.theme] || draft.theme) + ' for ' + forHold + '.');
    } else if (action === 'preview-theme') {
      if (!draft.theme) return bad(button, 'Pick a theme first.');
      send(button, '/push', { kind: 'theme', theme: draft.theme, minutes: previewThemeMinutes }, 'Previewing ' + (names.themes[draft.theme] || draft.theme) + ' for ' + holdWords(previewThemeMinutes) + '.');
    } else if (action === 'push-announcement') {
      if (draft.text.trim() === '') return bad(button, 'Type the announcement first.');
      send(button, '/push', { kind: 'announcement', text: draft.text, level: draft.level, team: draft.noticeTeam, minutes: draft.hold }, 'Announcement posted for ' + forHold + '.');
    } else if (action === 'post-announcement') {
      if (draft.text.trim() === '') return bad(button, 'Type the announcement first.');
      ask(button, { action: 'post-announcement', text: draft.text });
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
      draft.settings = {};
      paintSettings();
      showPreview();
    } else if ('showField' in target.dataset) {
      draft.settings[target.dataset.showField] = target.value;
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
    draft.settings = {};
    mark('data-theme-pick', '');
    mark('data-view-pick', '');
    const select = root.querySelector('[data-panel-pick]');
    if (select) select.value = '';
    paintSettings();
  }

  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('input', onInput);
  root.addEventListener('preview-target-cleared', onCleared);

  return {
    async start() {
      // The live announcements and the booked talks come with the request route. Without them the card says not known.
      const asked = await api('GET', '/request');
      if (asked.ok && asked.data) request = asked.data;
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
