// Tests for the read side of the Display tab content blocks (control/routes/content.js, control/support/content-read.js): the coming
// BAND events by day with the Studio's own judgement of each, the Show and Hide switch that writes one event rule drafts, publishing
// them, the FRC news rows, and the Leadership and Team leads read only. A fake Sanity that remembers; nothing leaves the process.
//
//   node tests/control-content.test.mjs

import assert from 'node:assert/strict';
import * as route from '../control/routes/content.js';
import { makeWorld } from './helpers/control-world.mjs';
import { makeFakeSanity } from './helpers/fake-sanity.mjs';

let passed = 0;
async function check(name, test) {
  await test();
  passed += 1;
  console.log('PASS  ' + name);
}

const hour = 3600000;
const tomorrowStart = Math.floor(Date.now() / (24 * hour) + 1) * 24 * hour;
const soon = tomorrowStart + 18 * hour;
const later = soon + 24 * hour;
const iso = time => new Date(time).toISOString();
const dayOf = time => iso(time).slice(0, 10);

function event(title, start, extra = {}) {
  return Object.assign({ _key: title, title: title, date: 'DATE', day: dayOf(start), time: '6:00 PM', shown: true, rule: '', start: iso(start), end: iso(start + 2 * hour) }, extra);
}

const docs = () => [
  { _id: 'team-prime', _type: 'team', name: 'HAWKTIMUS PRIME', code: 'prime', active: true },
  { _id: 'theme', _type: 'theme', timeZone: 'UTC' },
  { _id: 'dashboardSettings', _type: 'dashboardSettings', calendars: [{ _key: 'c1', id: 'team', name: 'Team calendar', kind: 'meetings', show: true }, { _key: 'c2', id: 'old', name: 'Old calendar', show: false }] },
  {
    _id: 'calendar-status', _type: 'calendarStatus', updatedAt: iso(Date.now() - 5 * 60000),
    calendars: [
      { _key: 'k1', code: 'team', fetchedAt: iso(Date.now() - 5 * 60000), eventCount: 3, occurrences: [
        event('Build meeting', soon),
        event('Strategy talk', later),
        event('', later, { title: '', shown: false, rule: 'No parents night' }),
        event('Yesterday meeting', Date.now() - 30 * hour),
      ] },
      { _key: 'k2', code: 'old', fetchedAt: iso(Date.now() - 5 * 60000), occurrences: [event('Old stuff', soon)] },
    ],
  },
  { _id: 'calendarFilter-rule-1', _type: 'calendarFilter', name: 'No parents night', action: 'hide', words: ['parents'], show: true },
  { _id: 'frc-news', _type: 'frcNews', lastSyncAt: iso(Date.now() - hour), items: [
    { _key: 'n1', title: 'New manual out', link: 'https://example.org/a', date: iso(Date.now() - 2 * 24 * hour), categories: ['FRC'] },
    { _key: 'n2', title: 'Hidden one', link: 'https://example.org/b', date: iso(Date.now() - 3 * 24 * hour), categories: ['FRC'] },
  ], hiddenItems: [] },
  { _id: 'person-1', _type: 'person', name: 'Jo', title: 'Coach', role: 'Coach', show: true, order: 1 },
  { _id: 'sub-1', _type: 'subteam', name: 'Build', lead: 'Sam', members: ['Ana', 'Bo'], show: true, team: { _type: 'reference', _ref: 'team-prime' } },
];

async function worldWith(documents = docs(), options = {}) {
  const world = await makeWorld([route], options);
  world.sanity = makeFakeSanity(documents);
  world.ctx.fetch = world.sanity.fetch;
  return world;
}

const call = (world, method, url, body) => world.router.call(method, url, body === undefined ? {} : { body });
const events = answer => answer.json.days.flatMap(day => day.events);
const byTitle = (answer, title) => events(answer).filter(item => item.title === title)[0];

await check('the calendar lists the coming events by day with their calendar and kind, and none that are over or from a calendar that is off', async () => {
  const world = await worldWith();
  const answer = await call(world, 'GET', '/content/calendar');
  assert.equal(answer.status, 200);
  const titles = events(answer).map(item => item.title);
  assert.ok(titles.includes('Build meeting') && titles.includes('Strategy talk'));
  assert.ok(!titles.includes('Yesterday meeting'), 'past events are not listed');
  const build = byTitle(answer, 'Build meeting');
  assert.equal(build.calendar, 'Team calendar');
  assert.equal(build.kind, 'Meetings');
  assert.equal(build.state.id, 'shown');
  assert.equal(build.state.canSwitch, true);
  assert.equal(answer.json.days[0].label, 'Tomorrow');
  assert.match(answer.json.download, /Last downloaded/);
  assert.equal(answer.json.pending, 0);
  assert.equal(answer.json.calendars.length, 2);
  const off = byTitle(answer, 'Old stuff');
  assert.equal(off.state.id, 'hidden-calendar');
  assert.equal(off.state.canSwitch, false);
});

await check('an event a Calendar filter hides says which rule, and has no title because the dataset is public', async () => {
  const world = await worldWith();
  const answer = await call(world, 'GET', '/content/calendar');
  const hidden = events(answer).filter(item => item.state.id === 'hidden-rule')[0];
  assert.ok(hidden, 'the hidden event is listed');
  assert.equal(hidden.title, 'Hidden event');
  assert.equal(hidden.rule, 'No parents night');
  assert.equal(hidden.state.canSwitch, false);
  assert.match(hidden.state.note, /Calendar filters/);
});

await check('the Hide switch drafts a one event rule in the shape of the Studio Calendars page, and nothing is published', async () => {
  const world = await worldWith();
  const key = byTitle(await call(world, 'GET', '/content/calendar'), 'Build meeting');
  const made = await call(world, 'POST', '/content/calendar/switch', { key: key.key });
  assert.equal(made.status, 200);
  const drafts = Object.values(world.sanity.stored).filter(doc => doc._id.startsWith('drafts.calendarFilter-one-'));
  assert.equal(drafts.length, 1);
  const rule = drafts[0];
  assert.equal(rule._type, 'calendarFilter');
  assert.equal(rule.scope, 'one');
  assert.equal(rule.action, 'hide');
  assert.equal(rule.eventCalendar, 'team');
  assert.equal(rule.eventTitle, 'Build meeting');
  assert.equal(rule.show, true);
  assert.ok(rule.name.length <= 40 && rule.name.startsWith('One event'));
  assert.ok(Date.parse(rule.expires) > soon, 'the rule stops by itself after the event');
  assert.deepEqual(Object.keys(world.sanity.stored).filter(id => id.startsWith('calendarFilter-one-')), [], 'the published rule list is unchanged');
  assert.equal(made.json.pending, 1);
  const after = byTitle(made, 'Build meeting');
  assert.equal(after.state.id, 'hidden-you');
  assert.equal(after.state.pending, true);
});

await check('Publish makes the waiting one event rules live and leaves other drafts alone; Show again withdraws a rule', async () => {
  const world = await worldWith();
  world.sanity.touch('calendarFilter-rule-1', { name: 'No parents night (edited)' });
  const first = byTitle(await call(world, 'GET', '/content/calendar'), 'Strategy talk');
  await call(world, 'POST', '/content/calendar/switch', { key: first.key });
  assert.equal((await call(world, 'POST', '/content/calendar/publish', {})).status, 400, 'a confirm is needed');
  const published = await call(world, 'POST', '/content/calendar/publish', { confirm: true });
  assert.equal(published.status, 200);
  assert.equal(published.json.pending, 0);
  const live = Object.keys(world.sanity.stored).filter(id => id.startsWith('calendarFilter-one-'));
  assert.equal(live.length, 1);
  assert.equal(world.sanity.stored[live[0]].eventTitle, 'Strategy talk');
  assert.ok(world.sanity.stored['drafts.calendarFilter-rule-1'], 'an unfinished draft of another rule is not published');
  assert.equal(byTitle(published, 'Strategy talk').state.id, 'hidden-you');

  const again = await call(world, 'POST', '/content/calendar/switch', { key: first.key });
  assert.equal(again.status, 200);
  const withdrawn = world.sanity.stored['drafts.' + live[0]];
  assert.equal(withdrawn.show, false, 'a published rule is turned off by a draft');
  assert.equal(withdrawn._type, 'calendarFilter');
  assert.equal(byTitle(again, 'Strategy talk').state.id, 'shown');
  const none = await call(world, 'POST', '/content/calendar/publish', { confirm: true });
  assert.equal(none.status, 200);
  assert.equal((await call(world, 'POST', '/content/calendar/publish', { confirm: true })).status, 409, 'nothing waits');
});

await check('the switch refuses a hidden or unknown event, and needs the key and the PIN', async () => {
  const world = await worldWith();
  const hidden = events(await call(world, 'GET', '/content/calendar')).filter(item => item.state.id === 'hidden-rule')[0];
  assert.equal((await call(world, 'POST', '/content/calendar/switch', { key: hidden.key })).status, 400);
  assert.equal((await call(world, 'POST', '/content/calendar/switch', { key: 'nothing|here' })).status, 404);
  assert.equal((await call(world, 'POST', '/content/calendar/switch', {})).status, 400);
  assert.equal(world.sanity.log.length, 0);
  const noKey = await worldWith(docs(), { env: 'CONTROL_PIN=\'123456\'\n' });
  assert.equal((await call(noKey, 'POST', '/content/calendar/switch', { key: 'x' })).status, 503);
  assert.equal((await call(noKey, 'GET', '/content/calendar')).json.canWrite, false);
  const closed = await worldWith(docs(), { pin: false });
  assert.equal((await call(closed, 'GET', '/content/calendar')).status, 401);
  assert.equal((await call(closed, 'POST', '/content/calendar/publish', { confirm: true })).status, 401);
});

await check('a calendar status that is missing gives the notice of the Studio page, not an error', async () => {
  const world = await worldWith(docs().filter(doc => doc._id !== 'calendar-status'));
  const answer = await call(world, 'GET', '/content/calendar');
  assert.equal(answer.status, 200);
  assert.match(answer.json.notice, /Nothing yet/);
  assert.deepEqual(answer.json.days, []);
});

await check('the news rows are the FIRST headlines newest first with the hidden ones marked, and the settings come with the revision to save against', async () => {
  const withHidden = docs().concat([{ _id: 'drafts.dashboardSettings', _type: 'dashboardSettings', newsHiddenLinks: ['https://example.org/b'], newsInTicker: true, newsCategories: ['FRC'] }]);
  const world = await worldWith(withHidden);
  const answer = await call(world, 'GET', '/content/news');
  assert.equal(answer.status, 200);
  assert.deepEqual(answer.json.rows.map(row => [row.title, row.hidden]), [['New manual out', false], ['Hidden one', true]]);
  assert.equal(answer.json.inTicker, true);
  assert.deepEqual(answer.json.categories, ['FRC']);
  assert.ok(answer.json.rev.length > 0);
  assert.equal(answer.json.lines[0].label, 'Last read');
  const plain = await call(await worldWith(), 'GET', '/content/news');
  assert.deepEqual(plain.json.categories, ['FRC', 'Control System'], 'the starting categories when none is stored');
});

await check('Leadership and Team leads are listed read only with their team, and nothing in the answer is a contact detail', async () => {
  const world = await worldWith();
  const answer = await call(world, 'GET', '/content/people');
  assert.equal(answer.status, 200);
  assert.equal(answer.json.leadership[0].name, 'Jo');
  assert.equal(answer.json.leadership[0].role, 'Coach');
  assert.equal(answer.json.teamLeads[0].name, 'Sam');
  assert.equal(answer.json.teamLeads[0].team, 'HAWKTIMUS PRIME');
  assert.equal(answer.json.teamLeads[0].members, 2);
  assert.ok(!/@/.test(answer.text));
});

console.log('\n' + passed + ' of ' + passed + ' passed');
