// The blocks of what the wall says: Ticker and news, Calendar, Roster, Announcements and Photos. Each is a section of the Show
// area (#show/photos), and a block reads from Sanity when it is opened.

import { useContentStyles } from './content-list.js';
import { mountTicker } from './content-ticker.js';
import { mountCalendar } from './content-calendar.js';
import { mountRoster } from './content-roster.js';
import { mountAnnouncements } from './content-announcements.js';
import { mountPhotos } from './content-photos.js';
import { sentences } from '../guide.js';

export const blocks = [
  { id: 'ticker', title: 'Ticker and news', says: sentences['content.ticker'], mount: mountTicker },
  { id: 'calendar', title: 'Calendar', says: sentences['content.calendar'], mount: mountCalendar },
  { id: 'roster', title: 'Roster', says: sentences['content.roster'], mount: mountRoster },
  { id: 'announcements', title: 'Announcements', says: sentences['content.announcements'], mount: mountAnnouncements },
  { id: 'photos', title: 'Photos', says: sentences['content.photos'], mount: mountPhotos },
];

// Opens one block in a box. The Show area draws each block as a section of its own (areas/show.js), and a block reads
// from Sanity when its section is opened.
export function mountBlock(box, id) {
  useContentStyles();
  const block = blocks.find(item => item.id === id);
  if (!block) throw new Error('There is no block called ' + id + '.');
  box.textContent = 'Reading from Sanity.';
  return block.mount(box, {});
}
