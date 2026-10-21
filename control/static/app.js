// The shell of the page: loads the tab files the service lists, draws the tab bar and shows the tab in the address.

import { tabs, resolveAddress, extensionsFor } from './tabs.js';
import { api, shortDate } from './api.js';
import { mountHelpNote, resetHelp } from './guide.js';

const bar = document.getElementById('tabs');
const page = document.getElementById('page');
let leave = null;
let current = '';

// A tab's render may be async, so what it returns may be a promise of a function to call when the tab is left
function leaver(result) {
  const pending = Promise.resolve(result).catch(() => null);
  return () => pending.then(done => { if (typeof done === 'function') done(); });
}

// Blocks that other files add to a tab (extendTab in tabs.js) sit in boxes of their own, before or after the tab, so the
// tab can draw its page again without touching them
function addExtensions(tab, fresh, stops) {
  const place = name => {
    const list = extensionsFor(tab.id, name);
    list.forEach(item => {
      const box = document.createElement('div');
      box.dataset.extension = tab.id;
      // A tab can leave a slot for the blocks (Display does, to keep them in its left column); without one they sit beside it
      const slot = fresh.querySelector('[data-extension-slot="' + name + '"]');
      if (slot) slot.append(box);
      else if (name === 'before') fresh.before(box);
      else fresh.after(box);
      stops.push(leaver(item.mount(box)));
    });
  };
  place('before');
  place('after');
}

function show(address) {
  const { id, section } = resolveAddress(address);
  const tab = tabs.find(other => other.id === id) || tabs[0];
  if (!tab) return;
  if (leave) leave();
  // Only the open tab is in the tab order. The arrow keys move between the tabs (below).
  bar.querySelectorAll('button').forEach(button => {
    const on = button.dataset.id === tab.id;
    button.setAttribute('aria-selected', String(on));
    button.tabIndex = on ? 0 : -1;
  });
  page.setAttribute('aria-labelledby', 'tab-' + tab.id);
  page.replaceChildren();
  const fresh = document.createElement('div');
  page.append(fresh);
  current = tab.id;
  mountHelpNote(page, tab.id);
  const stops = [leaver(tab.render(fresh, section))];
  addExtensions(tab, fresh, stops);
  leave = () => stops.forEach(stop => stop());
  history.replaceState(null, '', '#' + tab.id + (section && id === tab.id ? '/' + section : ''));
}

async function wallLine() {
  try {
    const answer = await api('releases');
    const live = answer.releases.find(release => release.current);
    if (!live) return;
    const commit = live.commit ? ' · ' + live.commit : '';
    document.getElementById('on-wall').textContent = 'On the wall: v' + live.version + commit + (live.date ? ' · ' + shortDate(live.date) : '');
  } catch (error) {
    // the Update section of Settings shows the reason
  }
}

// Left and right arrows, Home and End move from tab to tab and open the one they land on, as on any tab bar
function moveBetweenTabs(event) {
  const buttons = Array.from(bar.querySelectorAll('button'));
  const at = buttons.indexOf(document.activeElement);
  if (at < 0) return;
  const last = buttons.length - 1;
  const to = { ArrowRight: at === last ? 0 : at + 1, ArrowLeft: at === 0 ? last : at - 1, Home: 0, End: last }[event.key];
  if (to === undefined) return;
  event.preventDefault();
  buttons[to].focus();
  show(buttons[to].dataset.id);
}

async function start() {
  const list = await api('tabs');
  for (const name of list.tabs) await import('./' + name);
  tabs.forEach(tab => {
    const button = document.createElement('button');
    button.type = 'button';
    button.role = 'tab';
    button.id = 'tab-' + tab.id;
    button.setAttribute('aria-controls', 'page');
    button.dataset.id = tab.id;
    button.textContent = tab.title;
    button.addEventListener('click', () => show(tab.id));
    bar.appendChild(button);
  });
  bar.addEventListener('keydown', moveBetweenTabs);
  document.getElementById('help').addEventListener('click', () => {
    resetHelp();
    show(current);
    window.scrollTo(0, 0);
  });
  show(location.hash.slice(1));
  // an address typed or followed while the page is open (replaceState in show() does not fire this)
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
  wallLine();
}

// If the list of tabs cannot be read, say so in the page instead of leaving the loading line
start().catch(error => {
  const words = document.createElement('p');
  words.className = 'bad';
  words.textContent = 'The page could not load its tabs: ' + error.message + ' ';
  const again = document.createElement('a');
  again.href = './';
  again.textContent = 'Reload the page.';
  words.append(again);
  page.replaceChildren(words);
});
