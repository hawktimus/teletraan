// The one place the page learns how the computer is doing. It asks GET overview every 10 seconds while the tab is
// visible and not at all while it is hidden (the Page Visibility API), and tells whoever listens. When the computer does not
// answer, the last known answer stays and listeners are told the computer is unreachable; the page then asks again after
// 10, 20, 40 and at most 60 seconds, and goes back to 10 when it answers.

import { api } from './tabs/api.js';

// The last answer is kept for this tab only (sessionStorage), so a reload while the computer is away still has something to show
function lastAnswer() {
  try { return JSON.parse(window.sessionStorage.getItem('teletraan.control.overview') || 'null'); } catch (error) { return null; }
}

function keepAnswer(value) {
  try { window.sessionStorage.setItem('teletraan.control.overview', JSON.stringify(value)); } catch (error) { /* nothing is kept */ }
}

export const timing = { everyMs: 10000, longestMs: 60000 };

export const store = {
  overview: lastAnswer(),
  checkedAt: null,
  unreachable: false,
  failures: 0,
  reason: '',
};

const listeners = new Set();

export function subscribe(listener) {
  listeners.add(listener);
  if (store.overview || store.unreachable) listener(store);
  return () => listeners.delete(listener);
}

function tell() {
  listeners.forEach(listener => listener(store));
}

// How long to wait before the next try, from how many tries in a row failed: 10, 20, 40, 60, 60 seconds
export function waitAfter(failures, base = timing.everyMs, longest = timing.longestMs) {
  return failures <= 0 ? base : Math.min(longest, base * 2 ** (failures - 1));
}

let timer = null;
let started = false;
let asking = false;

// Asks now. Gives true when the computer answered.
export async function refreshNow() {
  if (asking) return !store.unreachable;
  asking = true;
  const answer = await api('GET', '/overview');
  asking = false;
  if (answer.ok && answer.data) {
    store.overview = answer.data;
    store.checkedAt = new Date().toISOString();
    store.unreachable = false;
    store.failures = 0;
    store.reason = '';
    keepAnswer(answer.data);
  } else {
    // A sign-in that ended sends the person to the sign-in form, the same as any other call
    if (/Enter the PIN/.test(answer.error || '')) { window.location.reload(); return false; }
    store.unreachable = true;
    store.failures += 1;
    store.reason = answer.error || '';
  }
  tell();
  return !store.unreachable;
}

function schedule() {
  clearTimeout(timer);
  if (!started || document.visibilityState === 'hidden') return;
  timer = setTimeout(async () => {
    await refreshNow();
    schedule();
  }, waitAfter(store.failures));
}

function onVisible() {
  if (document.visibilityState === 'hidden') {
    clearTimeout(timer);
    return;
  }
  // Back in view: ask at once, then go on every 10 seconds
  refreshNow().then(schedule);
}

export function startPolling() {
  if (started) return;
  started = true;
  document.addEventListener('visibilitychange', onVisible);
  refreshNow().then(schedule);
}

export function stopPolling() {
  started = false;
  clearTimeout(timer);
  document.removeEventListener('visibilitychange', onVisible);
}
