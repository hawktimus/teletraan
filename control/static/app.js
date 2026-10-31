// The shell of the page: loads the area files the service lists, draws the navigation (a bar at the bottom of a phone, a sidebar
// from 900 px), shows the area in the address (#now, #show/photos, ...), keeps the light or dark choice, and tells every area
// when the computer cannot be reached. The address is the only state: a link, a reload and the Back button all land in the same place.

import { tabs, resolveAddress } from './tabs.js';
import { api, shortDate } from './api.js';
import { mountHelpNote, resetHelp } from './guide.js';
import { startPolling, subscribe, timing, waitAfter } from './poll.js';
import { icon } from './icons.js';
import { clockWords } from './words.js';
import { recall, remember } from './dom.js';

const nav = document.getElementById('tabs');
const page = document.getElementById('page');
const area = document.getElementById('area');
const offline = document.getElementById('offline');
let leave = null;
let current = '';
let firstShow = true;

// A render may be async, so what it returns may be a promise of a function to call when the area is left
function leaver(result) {
  const pending = Promise.resolve(result).catch(() => null);
  return () => pending.then(done => { if (typeof done === 'function') done(); });
}

function show(address) {
  const { id, section } = resolveAddress(address);
  const tab = tabs.find(other => other.id === id) || tabs[0];
  if (!tab) return;
  if (leave) leave();
  nav.querySelectorAll('a').forEach(link => {
    if (link.dataset.id === tab.id) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  area.replaceChildren();
  const fresh = document.createElement('div');
  fresh.className = 'area area-' + tab.id;
  area.append(fresh);
  current = tab.id;
  mountHelpNote(area, tab.id);
  leave = leaver(tab.render(fresh, section));
  document.title = tab.title + ' - Teletraan I control';
  const clean = tab.id + (section && id === tab.id ? '/' + section : '');
  if (location.hash.slice(1) !== clean) history.replaceState(null, '', '#' + clean);
  // A person who followed a link starts at the heading of the new area; the first draw leaves the focus alone
  if (!firstShow) {
    window.scrollTo(0, 0);
    const heading = area.querySelector('h2');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }
  firstShow = false;
}

async function wallLine() {
  try {
    const answer = await api('releases');
    const live = answer.releases.find(release => release.current);
    if (!live) return;
    const commit = live.commit ? ' · ' + live.commit : '';
    document.getElementById('on-wall').textContent = 'On the wall: v' + live.version + commit + (live.date ? ' · ' + shortDate(live.date) : '');
  } catch (error) {
    // Update, Publish shows the reason
  }
}

// ----- light and dark -----

const themeWords = { system: 'System', light: 'Light', dark: 'Dark' };

function applyTheme(choice) {
  const root = document.documentElement;
  if (choice === 'light' || choice === 'dark') root.dataset.theme = choice;
  else delete root.dataset.theme;
  const button = document.getElementById('theme');
  const dark = choice === 'dark' || (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  button.innerHTML = icon(dark ? 'moon' : 'sun', 22) + '<span class="tool-word">Theme: ' + themeWords[choice] + '</span>';
  button.setAttribute('aria-label', 'Theme: ' + themeWords[choice] + '. Press to change it.');
}

function startTheme() {
  let choice = recall('theme', 'system');
  if (!themeWords[choice]) choice = 'system';
  applyTheme(choice);
  document.getElementById('theme').addEventListener('click', () => {
    choice = choice === 'system' ? 'light' : choice === 'light' ? 'dark' : 'system';
    remember('theme', choice);
    applyTheme(choice);
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(choice));
}

// ----- the computer cannot be reached -----

function startOffline() {
  let tick = null;
  subscribe(store => {
    clearInterval(tick);
    if (!store.unreachable) {
      offline.hidden = true;
      return;
    }
    const known = store.checkedAt ? 'The last known status is from ' + clockWords(store.checkedAt) + ' and is still shown.' : 'There is no earlier status to show yet.';
    const wait = waitAfter(store.failures, timing.everyMs, timing.longestMs) / 1000;
    offline.hidden = false;
    offline.innerHTML = '<p>' + icon('wifi', 22) + '<strong>Can\'t reach the computer.</strong></p><p>' + known + ' Check that this device is on the same WiFi, or on the private tunnel. The TV is not affected. Trying again every ' + wait + ' seconds.</p>';
  });
}

async function start() {
  const list = await api('tabs');
  for (const name of list.tabs) await import('./' + name);
  tabs.forEach(tab => {
    const link = document.createElement('a');
    link.href = '#' + tab.id;
    link.dataset.id = tab.id;
    link.innerHTML = icon(tab.icon, 24) + '<span>' + tab.title + '</span>';
    nav.appendChild(link);
  });
  startTheme();
  // The address is the area, so the skip link moves the focus instead of changing the address
  document.querySelector('.skip').addEventListener('click', event => {
    event.preventDefault();
    page.focus();
  });
  document.getElementById('help').addEventListener('click', () => {
    resetHelp();
    show(current);
    window.scrollTo(0, 0);
  });
  show(location.hash.slice(1));
  // An address typed or followed while the page is open (replaceState in show() does not fire this)
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
  startOffline();
  startPolling();
  wallLine();
}

// If the list of areas cannot be read, say so in the page instead of leaving the loading line
start().catch(error => {
  const words = document.createElement('p');
  words.className = 'bad';
  words.textContent = 'The page could not load: ' + error.message + ' ';
  const again = document.createElement('a');
  again.href = './';
  again.textContent = 'Reload the page.';
  words.append(again);
  area.replaceChildren(words);
});
