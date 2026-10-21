// The Content section at the foot of the Display tab: three blocks that fold, Ticker and news, Calendar and Roster. A block reads
// from Sanity the first time it is opened, so the Display tab itself opens as fast as before. The block is added with extendTab, so
// the Display tab files do not know about it.

import { extendTab } from '../tabs.js';
import { useContentStyles } from './content-list.js';
import { mountTicker } from './content-ticker.js';
import { mountCalendar } from './content-calendar.js';
import { mountRoster } from './content-roster.js';

export const blocks = [
  { id: 'ticker', title: 'Ticker and news', says: 'The tips, news and reminders on the ticker, and the FIRST headlines.', mount: mountTicker },
  { id: 'calendar', title: 'Calendar', says: 'The coming BAND events, and which ones the wall shows.', mount: mountCalendar },
  { id: 'roster', title: 'Roster', says: 'Everyone on the team by team and role.', mount: mountRoster },
];

export function drawContent(box, ctx = {}) {
  useContentStyles();
  const root = document.createElement('div');
  root.className = 'tab ct';
  const head = document.createElement('section');
  head.className = 'card';
  head.innerHTML = '<h2>Content</h2><p class="word">What the wall says, edited here the same way as in the Studio: a change is a draft first, and it reaches the wall when you press Publish.</p>';
  root.append(head);

  blocks.forEach(block => {
    const details = document.createElement('details');
    details.className = 'ct-block';
    details.dataset.block = block.id;
    const summary = document.createElement('summary');
    const title = document.createElement('span');
    title.className = 'ct-block-title';
    title.textContent = block.title;
    const says = document.createElement('span');
    says.className = 'ct-block-says';
    says.textContent = block.says;
    summary.append(title, says);
    const body = document.createElement('div');
    body.className = 'ct-block-body';
    details.append(summary, body);
    let started = false;
    const start = () => {
      if (started || !details.open) return;
      started = true;
      body.textContent = 'Reading from Sanity.';
      block.mount(body, ctx).catch(error => { body.textContent = 'This block could not load: ' + error.message; });
    };
    details.addEventListener('toggle', start);
    root.append(details);
  });
  box.replaceChildren(root);
  return root;
}

extendTab('display', {
  place: 'after',
  mount(box) {
    drawContent(box);
  },
});
