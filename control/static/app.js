// The shell of the page: loads the tab files the service lists, draws the tab bar and shows the tab in the address.

import { tabs } from './tabs.js';
import { api, shortDate } from './api.js';

const bar = document.getElementById('tabs');
const page = document.getElementById('page');
let leave = null;

function show(id) {
  const tab = tabs.find(other => other.id === id) || tabs[0];
  if (!tab) return;
  if (typeof leave === 'function') leave();
  bar.querySelectorAll('button').forEach(button => button.setAttribute('aria-selected', String(button.dataset.id === tab.id)));
  page.replaceChildren();
  leave = tab.render(page) || null;
  history.replaceState(null, '', '#' + tab.id);
}

async function wallLine() {
  try {
    const answer = await api('releases');
    const live = answer.releases.find(release => release.current);
    if (!live) return;
    const commit = live.commit ? ' · ' + live.commit : '';
    document.getElementById('on-wall').textContent = 'On the wall: v' + live.version + commit + (live.date ? ' · ' + shortDate(live.date) : '');
  } catch (error) {
    // the Update tab shows the reason
  }
}

async function start() {
  const list = await api('tabs');
  for (const name of list.tabs) await import('./' + name);
  tabs.forEach(tab => {
    const button = document.createElement('button');
    button.type = 'button';
    button.role = 'tab';
    button.dataset.id = tab.id;
    button.textContent = tab.title;
    button.addEventListener('click', () => show(tab.id));
    bar.appendChild(button);
  });
  show(location.hash.slice(1));
  wallLine();
}

start();
