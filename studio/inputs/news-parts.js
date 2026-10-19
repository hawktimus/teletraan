// The parts of the FRC news section that need no Studio (news-section.js draws them): the stored names, the words, and the
// plain functions that work out the list of headlines, the switches and the hidden list. The section is part of the
// Competition page. It reads the document frc-news, which the Teletraan computer writes with computer/scripts/news-sync.sh,
// and writes only the four fields below, to the draft of Dashboard Settings. tests/studio-news.test.mjs reads this with node.

import { ageText, clockText } from './time-text.js';
import { isRecord } from './plain-values.js';

export const newsDocumentId = 'frc-news';

// The four fields of Dashboard Settings the section writes (schemas/settingsNews.js). Dashboard Settings hides them.
export const newsNames = ['newsEnabled', 'newsCategories', 'newsInTicker', 'newsHiddenLinks'];

// The same as startingNewsCategories in schemas/settingsNews.js and newsCategories in dashboard/config-settings.js
export const startingCategories = ['FRC', 'Control System'];
export const mostCategories = 12;
export const mostHidden = 100;
export const longestCategory = 30;

// Only what the section shows, so the question stays small
export const newsQuestion = '*[_id == $id][0] { lastSyncAt, lastError, "items": coalesce(items, []), "hiddenItems": coalesce(hiddenItems, []) }';

export const words = {
  title: 'FRC news',
  intro: 'Headlines from the FIRST community blog. The Teletraan computer reads the blog every 2 hours and keeps the newest ten in the categories below. Put the panel FRC news in a row of the Rotation to show them. Click Publish all in the top bar after a change.',
  headlinesOnly: 'Headlines only. The text stays on FIRST\'s site.',
  enabled: 'Read FRC news',
  enabledSays: 'On reads the FIRST blog and lets the FRC news panel play. Off reads nothing and the panel is skipped.',
  inTicker: 'Show news in the ticker',
  inTickerSays: 'On adds the newest three headlines to the ticker as FIRST: and the headline.',
  categories: 'Categories',
  categoriesSays: 'Only posts with one of these categories of the FIRST blog are kept. The category names are the ones on the blog, such as FRC or Control System.',
  addCategory: 'Add a category',
  add: 'Add',
  remove: 'Remove',
  startingNote: 'No category is chosen, so the starting two are used: FRC and Control System.',
  lastRead: 'Last read',
  lastError: 'Last error',
  notYet: 'Not yet',
  none: 'None',
  reading: 'Reading the headlines.',
  unreadable: 'The headlines could not be read. Refresh the page to try again.',
  noHeadlines: 'No headlines yet. The first read comes within 2 hours of the news timer being turned on (docs/frc-news.md). If it does not come, open Status on the control page.',
  headlines: 'Headlines',
  headlinesSays: 'Turn Show off to hide a headline from the TV. A hidden headline stays in the list so you can show it again.',
  show: 'Show',
  hiddenFlag: 'Hidden',
  systemcoreFlag: 'SystemCore',
  offNote: 'Read FRC news is off, so the TV shows no headlines and the computer reads nothing.',
  needsPublish: 'Dashboard Settings has not been published yet. Open it, click Publish once, and come back.',
  tooManyHidden: 'Up to ' + mostHidden + ' headlines can be hidden. Show some again first.',
  categoryProblems: {
    empty: 'Type a category first.',
    long: 'A category is up to ' + longestCategory + ' characters.',
    many: 'Up to ' + mostCategories + ' categories.',
    again: 'That category is already in the list.',
  },
};

// The links the editors hid: a list of text, whatever else is stored
export function hiddenLinksOf(settings) {
  const stored = isRecord(settings) && Array.isArray(settings.newsHiddenLinks) ? settings.newsHiddenLinks : [];
  return stored.filter(link => typeof link === 'string' && link !== '');
}

// The categories as stored, or the starting two when none is stored (as the computer and the screen read them)
export function categoriesOf(settings) {
  const stored = isRecord(settings) && Array.isArray(settings.newsCategories) ? settings.newsCategories.filter(name => typeof name === 'string' && name.trim() !== '').map(name => name.trim()) : [];
  return stored.length > 0 ? stored : startingCategories.slice();
}

export function usesStartingCategories(settings) {
  const stored = isRecord(settings) && Array.isArray(settings.newsCategories) ? settings.newsCategories.filter(name => typeof name === 'string' && name.trim() !== '') : [];
  return stored.length === 0;
}

// The list with a category added, or the problem in words. Case does not matter when looking for a repeat.
export function addedCategory(list, typed) {
  const name = typeof typed === 'string' ? typed.replace(/\s+/g, ' ').trim() : '';
  if (name === '') return { list: list, problem: words.categoryProblems.empty };
  if (name.length > longestCategory) return { list: list, problem: words.categoryProblems.long };
  if (list.some(item => item.toLowerCase() === name.toLowerCase())) return { list: list, problem: words.categoryProblems.again };
  if (list.length >= mostCategories) return { list: list, problem: words.categoryProblems.many };
  return { list: list.concat([name]), problem: '' };
}

export function removedCategory(list, name) {
  return list.filter(item => item !== name);
}

// The headlines of the document and the hidden ones, newest first, each with whether it is hidden now. The settings are
// the draft of Dashboard Settings, so a switch shows at once, before the computer has read the blog again. A headline with no
// address cannot be hidden and is left out.
export function rowsOf(news, settings) {
  const doc = isRecord(news) ? news : {};
  const hidden = hiddenLinksOf(settings);
  const all = (Array.isArray(doc.items) ? doc.items : []).concat(Array.isArray(doc.hiddenItems) ? doc.hiddenItems : []);
  const seen = [];
  const rows = [];

  all.filter(isRecord).forEach(item => {
    if (typeof item.link !== 'string' || item.link === '' || typeof item.title !== 'string' || item.title === '' || seen.includes(item.link)) return;
    seen.push(item.link);
    rows.push({ link: item.link, title: item.title, date: typeof item.date === 'string' ? item.date : '', systemcore: item.systemcore === true, hidden: hidden.includes(item.link) });
  });
  return rows.sort((first, second) => (Date.parse(second.date) || 0) - (Date.parse(first.date) || 0));
}

// The hidden list after a headline is hidden or shown. A link that is not in the list is added to hide, and one that is is
// removed to show. The list keeps its order, and is cut to the most it may hold: hiding another past that is refused.
export function changedHidden(list, link, hide) {
  const without = list.filter(item => item !== link);
  if (!hide) return { list: without, problem: '' };
  if (without.length >= mostHidden) return { list: list, problem: words.tooManyHidden };
  return { list: without.concat([link]), problem: '' };
}

// A date as Sep 23, in the time zone of the editor's own computer
export function shortDate(iso) {
  const time = Date.parse(iso);
  if (isNaN(time)) return '';
  return new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// The lines about the last read: when, and what went wrong
export function readLines(news, now) {
  const doc = isRecord(news) ? news : {};
  const age = ageText(doc.lastSyncAt, now);
  const clock = clockText(doc.lastSyncAt);

  return [
    { label: words.lastRead, text: age && clock ? age + ' (' + clock + ')' : words.notYet },
    { label: words.lastError, text: typeof doc.lastError === 'string' && doc.lastError !== '' ? doc.lastError : words.none },
  ];
}
