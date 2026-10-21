// The Content tab: what the wall says. Five blocks that fold, Ticker and news, Calendar, Roster, Announcements and Photos. A block
// reads from Sanity the first time it is opened, so the tab itself opens fast. On a phone one block is open at a time. The address
// #content/photos opens a block. Display keeps how the wall looks and plays and has nothing of this.

import { registerTab, tabOrder } from '../tabs.js';
import { widthWord } from './arrange.js';
import { useContentStyles } from './content-list.js';
import { mountTicker } from './content-ticker.js';
import { mountCalendar } from './content-calendar.js';
import { mountRoster } from './content-roster.js';
import { mountAnnouncements } from './content-announcements.js';
import { mountPhotos } from './content-photos.js';

export const blocks = [
  { id: 'ticker', title: 'Ticker and news', says: 'The tips, news and reminders on the ticker, and the FIRST headlines.', mount: mountTicker },
  { id: 'calendar', title: 'Calendar', says: 'The coming BAND events, and which ones the wall shows.', mount: mountCalendar },
  { id: 'roster', title: 'Roster', says: 'Everyone on the team by team and role.', mount: mountRoster },
  { id: 'announcements', title: 'Announcements', says: 'The bar under the banner, for a notice people must see today.', mount: mountAnnouncements },
  { id: 'photos', title: 'Photos', says: 'The pictures of the Photo panel, and a way to add one.', mount: mountPhotos },
];

export function drawContent(box, ctx = {}) {
  useContentStyles();
  const root = document.createElement('div');
  root.className = 'tab ct';
  const head = document.createElement('section');
  head.className = 'card';
  head.innerHTML = '<h2>Content</h2><p class="word">What the wall says, edited here the same way as in the Studio: a change is a draft first, and it reaches the wall when you press Publish.</p>';
  root.append(head);

  const folds = [];
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
    details.addEventListener('toggle', () => {
      start();
      if (!details.open) return;
      // on a phone one block is open at a time
      if (widthWord(window.innerWidth) === 'narrow') folds.forEach(other => { if (other !== details) other.open = false; });
      if (ctx.remember) ctx.remember(block.id);
    });
    folds.push(details);
    root.append(details);
  });
  box.replaceChildren(root);
  const wanted = folds.filter(fold => fold.dataset.block === ctx.section)[0];
  if (wanted) wanted.open = true;
  return root;
}

registerTab({
  id: 'content',
  title: 'Content',
  order: tabOrder.content,
  render(element, section) {
    drawContent(element, { section: section, remember: id => history.replaceState(null, '', '#content/' + id) });
  },
});
