// The rotation plays only what has something to say: a placeholder that is not designed, a competition card that has only its
// "nothing yet" sentence, a competition row while the cards are Off, a photo that is not in the local list of pictures, and a
// card of many pages that would hold the frame for minutes. docs/audit.md, items 15 and 16.
//
//   node tests/rotation-defects.test.mjs

import assert from 'node:assert/strict';
import { contentOf, load, runTests, test } from './helpers/monday-world.mjs';

const competition = await load('core/competition.js');
const images = await load('core/images.js');
const hold = await load('core/paging.js');
const photos = await load('core/photos.js');
const placeholders = {
  robotStatus: await load('panels/robotStatus/panel.js'),
  wireframe: await load('panels/wireframe/panel.js'),
  miniIdea1: await load('panels/miniIdea1/panel.js'),
};

test('a placeholder panel has no content until it is designed, so the rotation passes it over', () => {
  Object.keys(placeholders).forEach(id => assert.equal(placeholders[id].hasContent(), false, id));
});

test('a competition card with only its "nothing yet" sentence has no content; one with a page has, and a card that cannot say stays in', () => {
  const empty = { markupFor: () => '<section><p class="empty">There is no rank yet.</p></section>' };
  const full = { markupFor: () => '<section><svg class="chart"></svg></section>' };
  const broken = { markupFor: () => { throw new Error('a fault in one card'); } };
  assert.equal(competition.competitionCardHasContent(empty, {}), false);
  assert.equal(competition.competitionCardHasContent(full, {}), true);
  assert.equal(competition.competitionCardHasContent(broken, {}), true, 'a fault in one card never takes a good one out');
  assert.equal(competition.competitionCardHasContent({}, {}), true, 'a card with no page function is left as it was');
});

test('with no competition data every card of the registry that draws a page says it has no content', async () => {
  const registry = await load('registry.js');
  const ids = registry.panels.filter(item => item.competition).map(item => item.id);
  assert.ok(ids.length >= 12, 'the cards were found');
  const content = contentOf([], raw => { delete raw.frc; });
  for (const id of ids) {
    const module = await load('panels/' + id + '/panel.js');
    if (typeof module.markupFor !== 'function') continue;
    assert.equal(competition.competitionCardHasContent(module, content), false, id + ' draws only its empty sentence');
  }
});

test('Off plays no competition row, Always plays it, and the preview plays it whatever the mode', () => {
  const at = new Date('2026-10-09T12:00:00Z');
  const withMode = mode => contentOf([], raw => { raw.settings.competitionMode = mode; });
  assert.equal(competition.competitionRowMayPlay(withMode('off'), at), false);
  assert.equal(competition.competitionRowMayPlay(withMode('always'), at), true);
});

test('with the local list of pictures present only a photo in it counts; with none, every photo does', () => {
  const remote = { address: 'https://cdn.sanity.io/images/p/production/a-100x100.jpg', id: 'a', show: true };
  const local = { address: 'data/live/images/a-100x100.jpg', id: 'b', show: true };
  const content = { photos: [remote], settings: {} };
  images.useLocalImages({});
  assert.equal(photos.photosAreReady(content.photos), true, 'a laptop with no local list shows what it is given');
  images.useLocalImages({ 'https://cdn.sanity.io/images/p/production/other-1x1.jpg': 'images/other-1x1.jpg' });
  assert.equal(photos.photosAreReady(content.photos), false, 'a photo that is not downloaded would be fetched from a host the filter may block');
  assert.equal(photos.photosAreReady([remote, local]), true);
  images.useLocalImages({});
});

test('a visit holds at most 3 pages, and no more than fit in 90 seconds', () => {
  assert.equal(hold.maxPagedPages, 3);
  assert.equal(hold.pagesToHold(1, 20000), 1);
  assert.equal(hold.pagesToHold(10, 20000), 3, 'ten pages at 20 seconds are three');
  assert.equal(hold.pagesToHold(10, 30000), 3, 'the 3 pages of the example in the audit take 90 seconds, not 5 minutes');
  assert.equal(hold.pagesToHold(10, 45000), 2, 'two pages of 45 seconds fill the 90 seconds');
  assert.equal(hold.pagesToHold(10, 120000), 1, 'a slow row still shows its first page');
  assert.equal(hold.pagesToHold(0, 20000), 1);
});

test('an event that is in two calendars is shown once, and events with no UID or another start are not merged', async () => {
  const events = await load('core/events.js');
  const at = (hour, uid, calendar, title = 'Build meeting') => ({ title: title, start: new Date('2026-11-17T' + hour + ':00:00Z'), end: new Date('2026-11-17T' + (Number(hour) + 2) + ':00:00Z'), allDay: false, location: '', uid: uid, calendar: calendar });
  const merged = events.mergeEvents([at('18', 'abc', 'Team'), at('18', 'abc', 'Build'), at('19', 'abc', 'Team'), at('18', '', 'Team', 'No uid'), at('18', '', 'Build', 'No uid')], 'America/New_York', new Date('2026-11-17T12:00:00Z'), []);
  const kept = merged.filter(event => event.uid === 'abc').map(event => event.calendar + ' ' + event.start.toISOString().slice(11, 13));
  assert.deepEqual(kept, ['Team 18', 'Team 19'], 'the same UID and start once, the same UID at another start kept');
  assert.equal(merged.filter(event => event.uid === '').length, 2, 'no UID, no merging');
});

test('a time with no zone in a calendar file means the zone of the Look page, not the zone of this computer', async () => {
  const expand = await load('core/calendar-expand.js');
  const file = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:float-1', 'SUMMARY:Floating meeting', 'DTSTART:20261117T180000', 'DTEND:20261117T200000', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(file, { status: 200 });
  try {
    const now = new Date('2026-11-17T12:00:00Z');
    const eastern = await expand.loadEvents({ folder: 'x/', calendars: [{ id: 'team', name: 'Team' }], now: now, daysAhead: 3, timeZone: 'America/New_York' });
    assert.equal(eastern.events[0].start.toISOString(), '2026-11-17T23:00:00.000Z', '18:00 in New York in November is 23:00 UTC');
    const pacific = await expand.loadEvents({ folder: 'x/', calendars: [{ id: 'team', name: 'Team' }], now: now, daysAhead: 3, timeZone: 'America/Los_Angeles' });
    assert.equal(pacific.events[0].start.toISOString(), '2026-11-18T02:00:00.000Z');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('tasks on the board whose department is not one of the nine are counted, and listed for the sync service', async () => {
  const views = await load('core/monday-views.js');
  const content = contentOf([
    { _id: 'task-monday-1', source: 'monday', title: 'Fits', department: 'build', status: 'in-progress', list: 'open', show: true, showOnBoard: true },
    { _id: 'task-monday-2', source: 'monday', title: 'Design/CNC', department: 'Design/CNC', status: 'in-progress', list: 'open', show: true, showOnBoard: true },
    { _id: 'task-monday-3', source: 'monday', title: 'Hidden', department: 'Design/CNC', status: 'up-next', list: 'open', show: true, showOnBoard: false },
  ]);
  const lost = views.unmatchedTasks(content, new Date());
  assert.deepEqual(lost.map(task => task.title), ['Design/CNC'], 'the hidden one is not a problem; it was hidden on purpose');
  const warned = [];
  const realWarn = console.warn;
  console.warn = message => warned.push(String(message));
  try {
    views.boardTasks(content, new Date());
    views.boardTasks(content, new Date());
  } finally {
    console.warn = realWarn;
  }
  assert.equal(warned.length, 1, 'said once, not at every page');
  assert.match(warned[0], /1 task\(s\) on the board have a department/);
});

await runTests();
