// What the wall adds by itself, for the Automatic panels section of the Rotation board (docs/rotation-board.md): the cards in
// plain words, the mode of the competition cards, and the one status line from the frc-status document. Plain functions only,
// so that tests/rotation-auto.test.mjs can run them with node. The ids are the ones of dashboard/registry.js, and
// tests/rotation-panels-explained.test.mjs fails when a registered panel is neither offered by the board nor listed here.

import { panelTitleOf } from './rotation-titles.js';

// competitionLeadDays in dashboard/config-lists.js
export const leadDays = 2;
export const competitionModes = ['auto', 'always', 'off', 'around'];
export const modeTitles = { auto: 'Auto', always: 'Always', off: 'Off', around: 'Before and after' };

export const addedByWall = 'Added by the wall, not a row.';

const cardWhen = 'From 2 days before an event while the mode is Auto.';
const eventDays = 'Comes in from 2 days before an event to its last day while the mode is Auto.';

// Each card is { id, title, shows, when, panels, row }. panels are registry ids the card explains. row says whether the same
// panel can also be put in the list as a row of its own.
export const autoCards = [
  { id: 'competition-next-match', title: 'Next match', shows: 'The match, its time, the teams on each alliance and the chance that red wins.', when: cardWhen, panels: ['competition-next-match'], row: false },
  { id: 'competition-rank', title: 'Live rank', shows: 'The rank, how many teams are ranked, the record and the ranking points.', when: cardWhen, panels: [], row: true },
  { id: 'competition-results', title: 'Results strip (Match Statistics)', shows: 'The last 8 matches as red and blue chips with the score.', when: eventDays, panels: ['competition-results'], row: false },
  { id: 'competition-alliance', title: 'Alliance board', shows: 'The alliance number and the teams on it, once the selection has been made.', when: eventDays, panels: ['competition-alliance'], row: false },
  { id: 'competition-timeline', title: 'Season timeline', shows: 'A line of the coming dates: the countdown date, each event and the state championship.', when: 'All season while Auto is on and a date is ahead.', panels: ['competition-timeline'], row: false },
  { id: 'competition-district', title: 'District points', shows: 'The district points, the rank and a bar toward the state cutoff.', when: 'Once the first event of the season has started, while the mode is Auto.', panels: ['competition-district'], row: false },
  { id: 'competition-forecast', title: 'Event forecast (Match13)', shows: 'How Match13 expects the event to end for each team: the most likely rank and its range.', when: cardWhen, panels: ['competition-forecast'], row: false },
  { id: 'competition-qualify', title: 'Championship chances (Match13)', shows: 'The chance of the District and the World Championship for each team, with the cutline.', when: 'Once the first event of the season has started, while the mode is Auto.', panels: ['competition-qualify'], row: false },
  { id: 'competition-preview', title: 'Event preview', shows: 'The next event, the time left, how many teams come, where each of our teams would rank, the best eight teams and the season trend. Ratings from Match13 when it has them, otherwise Statbotics.', when: 'From 14 days before an event to the day before it, while the mode is Before and after.', panels: ['competition-preview'], row: false },
  { id: 'competition-matches', title: 'Our matches', shows: 'Our qualification matches with the chance of winning each, the expected record, the hardest and the easiest match.', when: 'In the preview days once the match schedule is posted, while the mode is Before and after.', panels: ['competition-matches'], row: false },
  { id: 'competition-recap', title: 'Event recap', shows: 'The final rank, record, ranking points, the change in EPA, the district points gained, the awards and the trend.', when: 'For 7 days from the day after an event, while the mode is Before and after.', panels: ['competition-recap'], row: false },
  { id: 'competition-last-season', title: 'Last season at a glance', shows: 'The record of last season, the rank at each event and the EPA after each.', when: 'Before the first event of the season starts, while the mode is Auto.', panels: ['competition-last-season'], row: false },
];

// The cards that are not competition cards. The panels are the ones the card explains that no picker offers.
export const otherCards = [
  {
    id: 'announcements', title: 'Announcement bar and alerts', shows: 'An announcement is a plate under the banner. An alert fills the screen. Both sit on top of everything, whatever row plays.',
    when: 'While an announcement is live, and when an alert is set in Dashboard Settings.', panels: ['announcement', 'alert'], row: false,
  },
  {
    id: 'talks', title: 'Booked talks', shows: 'A talk takes the whole screen at its start time: a title card, the slides and a thank you card. The rotation waits until it is over.',
    when: 'At the start time of a booked talk.', panels: ['talk'], row: false,
  },
  {
    id: 'small-panel', title: 'The small panel on the right', shows: 'In the Robotics split layout the small frame plays the Small panel of each row, and otherwise the small panels of the view. The Team tile is the last resort when no other small panel has content.',
    when: 'Whenever the layout has a small frame.', panels: ['team-tile'], row: false,
  },
  {
    id: 'always-on', title: 'The banner, countdown and ticker', shows: 'The banner, the countdown, the ticker and the side columns of the sidebar and bar layouts stay on screen all the time. Tips and News feed the ticker.',
    when: 'Always.', panels: ['banner', 'countdown', 'side', 'bar-banner', 'bar-column', 'ticker'], row: false,
  },
  {
    id: 'decorations', title: 'Season packs and subthemes', shows: 'Not panels. They decorate the screen with accent colors, a header mark and slow pieces. Set them in Look.',
    when: 'By their dates.', panels: [], row: false,
  },
];

export const allAutoCards = autoCards.concat(otherCards);

// Every registry id the cards explain
export function explainedIds() {
  return allAutoCards.reduce((all, card) => all.concat(card.panels), []);
}

export function canBeRow(card) {
  return card.row === true;
}

export function rowWords(card) {
  if (canBeRow(card)) return 'Can also be a row: yes, ' + panelTitleOf(card.id) + '.';
  return 'Can also be a row: no.';
}

// The mode of the competition cards from the documents found (draft first, then published), auto when it is not set
export function competitionModeFrom(documents) {
  const found = Array.isArray(documents) ? documents : [];
  const source = found.filter(doc => doc && doc._id === 'drafts.dashboardSettings')[0] || found.filter(doc => doc && doc._id === 'dashboardSettings')[0] || {};
  return competitionModes.indexOf(source.competitionMode) === -1 ? 'auto' : source.competitionMode;
}

export const frcQuestion = '*[_id == "frc-status"][0] { "events": teams[].events[] { name, shortName, startDate, endDate } }';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function dateParts(text) {
  const found = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(text || ''));
  return found ? { year: Number(found[1]), month: Number(found[2]), day: Number(found[3]) } : null;
}

// 2027-03-12 as 12 March 2027
export function dateWords(text) {
  const parts = dateParts(text);
  return parts && parts.month >= 1 && parts.month <= 12 ? parts.day + ' ' + months[parts.month - 1] + ' ' + parts.year : '';
}

// The date some days before (a negative number goes back) a plain date, as a plain date
export function shiftDate(text, days) {
  const parts = dateParts(text);
  if (!parts) return '';
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days)).toISOString().slice(0, 10);
}

// The date today as the browser knows it, as a plain date
export function todayText(now = new Date()) {
  const pad = number => String(number).padStart(2, '0');
  return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
}

// The next event that is not over, from { events: [{ name, shortName, startDate, endDate }] }, or null
export function nextEvent(frc, today) {
  const events = frc && Array.isArray(frc.events) ? frc.events : [];
  const coming = events
    .filter(event => event && dateParts(event.startDate) && (event.endDate || event.startDate) >= today)
    .sort((first, second) => (first.startDate < second.startDate ? -1 : first.startDate > second.startDate ? 1 : 0));
  return coming[0] || null;
}

// The line under the competition cards. frc is what frcQuestion found, or null when there is no document. unreadable is true when
// the document could not be read at all.
export function competitionStatus(frc, mode, today, unreadable = false) {
  if (mode === 'off') return 'The mode is Off, so the wall adds no competition card.';
  if (unreadable) return 'The competition data could not be read. Refresh the page to try again.';
  if (!frc) return 'No competition data has been read yet, so no card has anything to show.';

  const event = nextEvent(frc, today);
  const always = mode === 'always' ? ' The mode is Always, so every card with data shows whatever the date.' : '';
  if (!event) return 'No event is coming up: the cards are off.' + always;

  const name = (event.shortName || event.name || 'An event').trim();
  const starts = shiftDate(event.startDate, -leadDays);
  const when = starts <= today ? 'the cards are on now' : 'the cards start on ' + dateWords(starts);
  return 'Next event: ' + name + ' on ' + dateWords(event.startDate) + ': ' + when + '.' + always;
}
