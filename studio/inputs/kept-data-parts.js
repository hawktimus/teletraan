// The parts of the Kept data page that need no Studio (kept-data-view.js draws them): what is kept, what the page
// says about it, and the id each link opens. Nothing here is deleted or renamed. tests/schemas.test.mjs reads this with node.

import { screenStyles, screenTitles, screenIdOf } from './screen-ids.js';
import { viewIdOf, viewTitles } from './view-ids.js';

export const words = {
  title: 'Kept data',
  notUsed: 'The wall does not use these.',
  keep: 'Do not delete: some old values are read when a new list is empty.',
  open: 'Open',
};

// The link ids. A screen and the Condensed view open the document with that id. The old events calendar opens its list.
export const eventsChild = 'extraEvent';
export const keptChildPrefix = 'kept-';

export const groups = [
  {
    id: 'screens',
    title: 'Old screens',
    says: 'The three screens the wall played before the Rotation page and the Views.',
    items: screenStyles.map(style => ({ id: keptChildPrefix + screenIdOf(style), title: screenTitles[style] })),
  },
  {
    id: 'views',
    title: 'The Condensed view',
    says: 'The old Family view. The rotation does not play it.',
    items: [{ id: keptChildPrefix + viewIdOf('family'), title: viewTitles.family }],
  },
  {
    id: 'events',
    title: 'The old events calendar type',
    says: 'Events typed by hand. They come from the BAND calendars now, and the screen no longer reads these.',
    items: [{ id: keptChildPrefix + eventsChild, title: 'Events Calendar' }],
  },
];

// What a link id opens: the type and the document id, or the list of a type
export function targetOf(childId) {
  const plain = String(childId).indexOf(keptChildPrefix) === 0 ? String(childId).slice(keptChildPrefix.length) : '';
  if (plain === eventsChild) return { list: 'extraEvent' };
  if (plain === viewIdOf('family')) return { type: 'view', id: plain, title: viewTitles.family };
  const style = screenStyles.filter(item => screenIdOf(item) === plain)[0];
  return style ? { type: 'screen', id: plain, title: screenTitles[style] } : null;
}
