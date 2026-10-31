// How every button that does something behaves, in one place (docs/control-page.md, "Actions"):
//
//   - while it runs the button is disabled and shows a spinner, and its line says what is happening
//   - after 10 seconds the line adds "Still working", and after 60 seconds the page stops waiting
//   - the end is one clear line, "Done at 3:12 PM" or "Didn't finish: <reason>", in an aria-live region
//   - the last result is kept in this browser per action, so it is still there after you leave and come back
//   - only an action that can hurt asks first: the question says what will happen and how long the screen may go dark
//
// An action is { id, label, doing, run(signal), confirm, variant, icon }. run gives { ok, words, raw }: words is the plain
// sentence of the result, raw is the technical text for the Details area.

import { el, esc, recallJson, remember } from './dom.js';
import { icon } from './icons.js';
import { api } from './tabs/api.js';
import { clockWords, doneWords, failedWords, plainReason, whenWords } from './words.js';
import { recordOutput } from './output-log.js';

// Tests make these short
export const timing = { slowMs: 10000, hardMs: 60000 };

// ----- the last result of each action, kept in this browser -----

export function lastResult(id) {
  const found = recallJson('last.' + id, null);
  return found && typeof found === 'object' && found.state ? found : null;
}

export function saveResult(id, state, words, label) {
  remember('last.' + id, { state: state, words: String(words || ''), at: new Date().toISOString(), label: label || id });
}

// The newest result of any action this browser ran: { id, label, state, words, at }, or null. Now and Computer show it as the
// last action of this page, next to the last action that came from the Studio.
export function latestResult() {
  let best = null;
  try {
    for (let at = 0; at < window.localStorage.length; at += 1) {
      const key = window.localStorage.key(at);
      if (!key || !key.startsWith('teletraan.control.last.')) continue;
      const found = JSON.parse(window.localStorage.getItem(key));
      if (found && found.state && found.at && (!best || found.at > best.at)) best = Object.assign({ id: key.slice('teletraan.control.last.'.length) }, found);
    }
  } catch (error) {
    return best;
  }
  return best;
}

// "Last time: Done at 3:12 PM, 20 min ago", or '' when this browser has not run it
export function lastWords(id, now = new Date()) {
  const last = lastResult(id);
  if (!last) return '';
  return 'Last time: ' + last.words + (last.at ? ' (' + whenWords(last.at, now) + ')' : '');
}

// ----- the question before an action that can hurt -----

// spec: { title, body (one or two sentences), dark (how long the screen may go dark, words), confirmLabel, danger }
// Gives a promise of true or false. A dialog traps the keys while it is open and Escape cancels.
export function confirmAction(spec) {
  return new Promise(resolve => {
    if (typeof HTMLDialogElement === 'undefined' || typeof document.createElement('dialog').showModal !== 'function') {
      resolve(window.confirm(spec.title + '\n\n' + spec.body + (spec.dark ? '\n' + spec.dark : '')));
      return;
    }
    const dialog = el('dialog', 'ask');
    dialog.setAttribute('aria-labelledby', 'ask-title');
    dialog.innerHTML = '<form method="dialog"><h2 id="ask-title">' + esc(spec.title) + '</h2><p>' + esc(spec.body) + '</p>' +
      (spec.dark ? '<p class="ask-dark">' + icon('clock') + '<span>' + esc(spec.dark) + '</span></p>' : '') +
      '<div class="ask-buttons"><button type="submit" value="no" class="btn btn-secondary" data-ask="no" autofocus>Cancel</button>' +
      '<button type="submit" value="yes" class="btn ' + (spec.danger === false ? 'btn-primary' : 'btn-danger') + '" data-ask="yes">' + esc(spec.confirmLabel || 'Yes, do it') + '</button></div></form>';
    document.body.append(dialog);
    const opener = document.activeElement;
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'yes');
      dialog.remove();
      if (opener && typeof opener.focus === 'function') opener.focus();
    });
    dialog.showModal();
  });
}

// ----- one action -----

// Builds the button and the line under it. Gives { root, button, status, start }. start() runs the action as if the button was pressed.
export function actionButton(spec) {
  const root = el('div', 'act-box');
  const button = el('button', 'btn btn-' + (spec.variant || 'secondary'));
  button.type = 'button';
  if (spec.id) button.dataset.action = spec.id;
  button.innerHTML = (spec.icon ? icon(spec.icon) : '') + '<span class="btn-label">' + esc(spec.label) + '</span><span class="spinner" hidden aria-hidden="true"></span>';
  const status = el('p', 'action-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  root.append(button, status);

  function show(state, words) {
    status.dataset.state = state;
    status.textContent = words;
  }

  const last = lastResult(spec.id);
  if (last) show(last.state, 'Last time: ' + last.words + (last.at ? ' (' + clockWords(last.at) + ')' : ''));
  else if (spec.hint) show('idle', spec.hint);

  let busy = false;
  async function start() {
    if (busy) return null;
    if (spec.confirm && !(await confirmAction(spec.confirm))) return null;
    busy = true;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.querySelector('.spinner').hidden = false;
    show('working', (spec.doing || spec.label) + '...');
    const controller = new AbortController();
    const slow = setTimeout(() => show('working', (spec.doing || spec.label) + '... Still working. Some actions take up to a minute.'), timing.slowMs);
    // An action that makes several calls gives each its own 60 seconds (ownTimeout), as Sync everything does
    const hard = spec.ownTimeout ? null : setTimeout(() => controller.abort(), timing.hardMs);
    let result;
    try {
      result = await spec.run(controller.signal);
    } catch (error) {
      result = { ok: false, words: error && error.message, raw: String(error && error.stack || error) };
    }
    clearTimeout(slow);
    clearTimeout(hard);
    busy = false;
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.querySelector('.spinner').hidden = true;
    const words = result.ok ? (result.words ? doneWords(new Date()) + '. ' + result.words : doneWords(new Date())) : failedWords(plainReason(result.words));
    show(result.ok ? 'done' : 'bad', words);
    saveResult(spec.id, result.ok ? 'done' : 'bad', words, spec.label);
    recordOutput({ id: spec.id, label: spec.label, ok: result.ok, raw: result.raw === undefined ? words : result.raw });
    if (typeof spec.after === 'function') spec.after(result);
    return result;
  }
  button.addEventListener('click', start);
  return { root: root, button: button, status: status, start: start };
}

// ----- calls to the host helper -----

// A run function for actionButton that asks the helper for one word. extra is the body, for example { target: 'calendars' }.
// A restart or a reboot must say it was confirmed: the question is asked before, so confirmed is true here.
export function helperRun(word, extra = {}, confirmed = false) {
  return async signal => {
    const result = await api('POST', '/helper/' + word, Object.assign({}, extra, confirmed ? { confirmed: true } : {}), signal);
    if (!result.ok) return { ok: false, words: result.error, raw: result.error };
    return { ok: true, words: '', raw: String((result.data && result.data.output) || '') };
  };
}
