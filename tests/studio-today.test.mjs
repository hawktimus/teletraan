// Tests for the Today page of the Studio (studio/inputs/today-view.js, today-parts.js): the sections and their
// sentences, the announcements turned into cards, the full screen messages as rows, and the rule that the page
// writes only what it shows, only to drafts, and never changes a stored name. The Studio is not installed, so the
// page runs on small stand-ins (tests/helpers/studio-world.mjs).
//
//   node tests/studio-today.test.mjs

import assert from 'node:assert/strict';
import { openStudio, nodesWhere, wordsIn, fakeClient } from './helpers/studio-world.mjs';

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const studio = await openStudio();
const parts = await studio.load('inputs/today-parts.js');
const view = await studio.load('inputs/today-view.js');
const editor = await studio.load('inputs/field-editor-parts.js');
const settingsType = (await studio.load('schemas/dashboardSettings.js')).default;

const now = Date.parse('2026-10-17T15:00:00.000Z');
const hours = count => new Date(now + count * 3600000).toISOString();

const timed = [
  { _key: 'k1', time: '14:30', title: 'WHAT TIME IS IT?', followUp: 'PRIMETIME', titleSeconds: 12, followUpSeconds: 10, days: [1, 2, 3, 4, 5], show: true },
  { _key: 'k2', time: '17:00', title: 'WHAT TIME IS IT?', followUp: 'PRIMETIME', titleSeconds: 12, followUpSeconds: 10, days: [1, 2, 3, 4, 5], show: true },
];

function documents() {
  return [
    { _id: 'dashboardSettings', _type: 'dashboardSettings', motion: 'calm', alert: { on: false, headline: 'LOCKDOWN', message: 'Stay put' }, announcements: timed },
    { _id: 'team-prime', _type: 'team', name: 'Hawktimus Prime', active: true },
    { _id: 'team-nova', _type: 'team', name: 'Hawktimus Nova', active: true },
    { _id: 'a1', _type: 'announcement', text: 'Pizza at 6', start: hours(-1), end: hours(2), level: 'notice' },
    { _id: 'a2', _type: 'announcement', text: 'Old news', start: hours(-30), end: hours(-20), level: 'important' },
    { _id: 'drafts.a3', _type: 'announcement', text: 'Draft only', start: hours(5), end: hours(8), level: 'notice' },
  ];
}

function field(tree, id) {
  return nodesWhere(tree, node => node.props && node.props['data-field'] === id)[0];
}

function control(tree, id, type) {
  const row = field(tree, id);
  return row && nodesWhere(row, node => node.type === (type || 'input') || node.type === 'textarea')[0];
}

async function opened() {
  globalThis.studioClient = fakeClient(documents());
  const page = studio.mount(view.TodayView);
  await page.settle();
  return { page: page, client: globalThis.studioClient };
}

test('the page has the alert, the bar, the full screen messages and the links, each with one plain sentence about the TV', async () => {
  const { page } = await opened();
  const blocks = nodesWhere(page.tree(), node => node.props && node.props['data-block']).map(node => node.props['data-block']).filter(name => ['alert', 'plate', 'timed', 'links'].indexOf(name) !== -1);
  assert.deepEqual(blocks, ['alert', 'plate', 'timed', 'links']);

  ['alert', 'plate', 'timed', 'links'].forEach(name => {
    const block = nodesWhere(page.tree(), node => node.props && node.props['data-block'] === name)[0];
    assert.ok(wordsIn(block).indexOf(parts.sections[name].says) !== -1, name + ' should say what it looks like on the TV');
    assert.equal(parts.sections[name].says.split(/[.]\s*/).filter(Boolean).length, 1, name + ' should be one sentence');
  });
  assert.match(wordsIn(page.tree()), /Everything that puts a message on the TV today/);
  Object.values(parts.sections).forEach(section => assert.ok(!/[—–!]/.test(section.title + section.says), 'no dash or exclamation mark'));
});

test('the links open the agenda, the talks and the meeting days in the next pane', async () => {
  const { page } = await opened();
  const links = nodesWhere(page.tree(), node => node.type === 'ChildLink').map(node => node.props.childId);
  assert.deepEqual(links.filter(id => id.indexOf(parts.announcementChildPrefix) !== 0), ['agenda', 'presentations', 'meetingDays']);
  assert.ok(links.indexOf(parts.announcementChildPrefix + 'a1') !== -1, 'a card opens its announcement in the full form');
});

test('announcements become cards: the draft wins, live and coming ones first, past ones last', () => {
  const cards = parts.cardsFrom(documents(), now);
  assert.deepEqual(cards.current.map(card => card.id), ['a1', 'a3']);
  assert.deepEqual(cards.past.map(card => card.id), ['a2']);
  assert.equal(cards.current[0].standing.indexOf('live, ends in'), 0);
  assert.equal(cards.current[1].isNew, true, 'a draft with no published copy is new');
  assert.equal(parts.baseId('drafts.abc'), 'abc');

  const both = parts.cardsFrom(documents().concat([{ _id: 'drafts.a1', _type: 'announcement', text: 'Pizza at 7', start: hours(-1), end: hours(2), level: 'important' }]), now);
  assert.equal(both.current[0].text, 'Pizza at 7', 'the draft is what the page shows');
  assert.equal(both.current[0].isNew, false);
});

test('a new announcement starts now, ends at the end of the day, and is a draft with the notice level', () => {
  const made = parts.newAnnouncementFields(now, 'announcement-x');
  assert.equal(made._id, 'drafts.announcement-x');
  assert.equal(made._type, 'announcement');
  assert.equal(made.level, 'notice');
  assert.ok(Date.parse(made.end) > Date.parse(made.start));
  assert.ok(Date.parse(made.end) - Date.parse(made.start) <= 24 * 3600000);
  assert.equal(made.team, undefined, 'a new one is for both teams');
});

test('the rows of the full screen messages change by key and keep the others', () => {
  const rows = parts.timedRowsFrom({ announcements: timed });
  assert.equal(parts.timedRowsFrom(null).length, 0);
  assert.equal(parts.withRow(rows, 'k1', { set: { time: '15:00' }, unset: [] })[0].time, '15:00');
  assert.equal(parts.withRow(rows, 'k1', { set: { time: '15:00' }, unset: [] })[1], rows[1]);
  assert.equal(parts.withRow(rows, 'k1', { set: {}, unset: ['followUp'] })[0].followUp, undefined);
  assert.deepEqual(parts.withoutRow(rows, 'k1').map(row => row._key), ['k2']);
  assert.deepEqual(parts.withDay([1, 3], 2, true), [1, 2, 3]);
  assert.deepEqual(parts.withDay([1, 3], 3, false), [1]);
  assert.equal(parts.blankTimedRow('x').show, true);
  assert.deepEqual(parts.blankTimedRow('x').days, [0, 1, 2, 3, 4, 5, 6]);
});

test('the rows take their limits from the fields of the schema', () => {
  const fields = settingsType.fields;
  const headline = editor.specOf(fields, 'alert.headline');
  assert.equal(headline.maxLength, 24);
  assert.match(editor.problemWith(headline, 'x'.repeat(25)), /Too long/);
  assert.equal(editor.problemWith(headline, ''), '', 'an empty headline is allowed');
  assert.equal(editor.specOf(fields, 'alert.message').maxLength, 90);
  assert.equal(editor.specOf(fields, 'alert.on').kind, 'switch');
  assert.equal(editor.specOf(fields, 'alert.until').kind, 'datetime');

  const member = fields.filter(item => item.name === 'announcements')[0].of[0].fields;
  assert.match(editor.problemWith(editor.specOf(member, 'time'), '9:30'), /24 hour time/);
  assert.equal(editor.problemWith(editor.specOf(member, 'time'), '09:30'), '');
  assert.match(editor.problemWith(editor.specOf(member, 'time'), ''), /Enter the time/);
  assert.match(editor.problemWith(editor.specOf(member, 'titleSeconds'), 2), /from 3 to 60/);
  assert.equal(editor.problemWith(editor.specOf(member, 'titleSeconds'), 12), '');
  assert.match(editor.problemWith(editor.specOf(member, 'title'), 'x'.repeat(25)), /Too long/);
});

test('a date and time goes to the box of the browser and back', () => {
  const text = editor.toLocalInput('2026-10-17T15:00:00.000Z');
  assert.match(text, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  assert.equal(editor.fromLocalInput(text), '2026-10-17T15:00:00.000Z');
  assert.equal(editor.toLocalInput(''), '');
  assert.equal(editor.fromLocalInput(''), '');
});

test('the alert switch writes only the alert to the draft of Dashboard Settings, keeps the other alert values and never publishes', async () => {
  const { page, client } = await opened();
  control(page.tree(), 'alert.on').props.onChange({ target: { checked: true } });
  await page.settle();

  const creates = client.calls.filter(call => call.create);
  assert.equal(creates.length, 1);
  assert.equal(creates[0].create._id, 'drafts.dashboardSettings');
  assert.equal(creates[0].create.motion, 'calm', 'the draft is made from the published document');
  const patches = client.calls.filter(call => call.patch);
  assert.equal(patches.length, 1);
  assert.equal(patches[0].patch, 'drafts.dashboardSettings');
  assert.deepEqual(Object.keys(patches[0].set), ['alert']);
  assert.deepEqual(patches[0].set.alert, { on: true, headline: 'LOCKDOWN', message: 'Stay put' });
  assert.equal(client.stored.dashboardSettings.alert.on, false, 'the published document is untouched');
  assert.match(wordsIn(page.tree()), /Saved as a draft\. Click Publish all in the top bar\./);
});

test('a headline that is too long is not saved and the row says what to do', async () => {
  const { page, client } = await opened();
  control(page.tree(), 'alert.headline').props.onBlur({ target: { value: 'x'.repeat(25) } });
  await page.settle();
  assert.equal(client.calls.filter(call => call.patch).length, 0);
  assert.match(wordsIn(field(page.tree(), 'alert.headline')), /Too long\. Up to 24 characters fit\./);
});

test('an empty take-down time removes the value instead of writing empty text', async () => {
  const { page, client } = await opened();
  control(page.tree(), 'alert.until').props.onBlur({ target: { value: '2026-10-17T18:00' } });
  await page.settle();
  const set = client.calls.filter(call => call.patch).pop().set;
  assert.match(set.alert.until, /^2026-10-1\dT/);
  control(page.tree(), 'alert.until').props.onBlur({ target: { value: '' } });
  await page.settle();
  assert.equal(client.calls.filter(call => call.patch).pop().set.alert.until, undefined);
});

test('a new announcement is made as a draft with its own id and the text typed', async () => {
  const { page, client } = await opened();
  const box = nodesWhere(page.tree(), node => node.props && node.props.id === 'plate-text')[0];
  box.props.onChange({ target: { value: 'Early dismissal at 2' } });
  await page.settle();
  const add = nodesWhere(page.tree(), node => node.type === 'button' && wordsIn(node) === parts.words.newPlate)[0];
  add.props.onClick();
  await page.settle();

  const created = client.calls.filter(call => call.create);
  assert.equal(created.length, 1);
  assert.equal(created[0].create._type, 'announcement');
  assert.match(created[0].create._id, /^drafts\.announcement-/);
  assert.equal(created[0].create.text, 'Early dismissal at 2');
  assert.equal(created[0].create.level, 'notice');
  assert.equal(client.calls.filter(call => call.publish).length, 0);
  assert.match(wordsIn(page.tree()), /Early dismissal at 2/);
});

test('an empty announcement is not made', async () => {
  const { page, client } = await opened();
  nodesWhere(page.tree(), node => node.type === 'button' && wordsIn(node) === parts.words.newPlate)[0].props.onClick();
  await page.settle();
  assert.equal(client.calls.filter(call => call.create).length, 0);
  assert.match(wordsIn(page.tree()), /Write the text\./);
});

test('a card writes one field to the draft of that announcement, and the team is a reference or removed', async () => {
  const { page, client } = await opened();
  control(page.tree(), 'card-a1-text').props.onBlur({ target: { value: 'Pizza at 6:30' } });
  await page.settle();
  let patch = client.calls.filter(call => call.patch).pop();
  assert.equal(patch.patch, 'drafts.a1');
  assert.deepEqual(patch.set, { text: 'Pizza at 6:30' });
  assert.equal(client.stored.a1.text, 'Pizza at 6', 'the published announcement is untouched');

  const select = nodesWhere(page.tree(), node => node.type === 'select' && node.props.id === 'team-a1')[0];
  select.props.onChange({ target: { value: 'team-nova' } });
  await page.settle();
  patch = client.calls.filter(call => call.patch).pop();
  assert.deepEqual(patch.set, { team: { _type: 'reference', _ref: 'team-nova' } });
  nodesWhere(page.tree(), node => node.type === 'select' && node.props.id === 'team-a1')[0].props.onChange({ target: { value: '' } });
  await page.settle();
  patch = client.calls.filter(call => call.patch).pop();
  assert.deepEqual(patch.unset, ['team']);
});

test('an end before the start is refused', async () => {
  const { page, client } = await opened();
  control(page.tree(), 'card-a1-end').props.onBlur({ target: { value: '2020-01-01T10:00' } });
  await page.settle();
  assert.equal(client.calls.filter(call => call.patch).length, 0);
  assert.match(wordsIn(field(page.tree(), 'card-a1-end')), /The end must be after the start\./);
});

test('the days of a message can be ticked, and the last one cannot be cleared', async () => {
  const { page, client } = await opened();
  const days = nodesWhere(page.tree(), node => node.props && node.props['data-card'] === 'k1')[0];
  const boxes = nodesWhere(days, node => node.type === 'input' && node.props.type === 'checkbox' && node.props.onChange).filter(node => node.props.onChange.length === 1);
  assert.ok(boxes.length >= 8, 'seven days and the show switch');
  const saturday = nodesWhere(days, node => node.type === 'label').filter(node => wordsIn(node) === 'Saturday')[0];
  nodesWhere(saturday, node => node.type === 'input')[0].props.onChange({ target: { checked: true } });
  await page.settle();
  const patch = client.calls.filter(call => call.patch).pop();
  assert.deepEqual(Object.keys(patch.set), ['announcements']);
  assert.deepEqual(patch.set.announcements[0].days, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(patch.set.announcements[1], timed[1], 'the other message is kept exactly');
  assert.equal(patch.set.announcements[0]._key, 'k1', 'the key stays');
});

test('a new message needs a time and a first line, then it is added to the list', async () => {
  const { page, client } = await opened();
  const form = nodesWhere(page.tree(), node => node.props && node.props['data-form'] === 'timed')[0];
  nodesWhere(form, node => node.type === 'button')[0].props.onClick();
  await page.settle();
  assert.equal(client.calls.filter(call => call.patch).length, 0);
  assert.match(wordsIn(page.tree()), /Enter the time, such as 14:30\./);

  control(page.tree(), 'new-timed-time').props.onBlur({ target: { value: '15:45' } });
  control(page.tree(), 'new-timed-title').props.onBlur({ target: { value: 'CLEAN UP' } });
  await page.settle();
  nodesWhere(nodesWhere(page.tree(), node => node.props && node.props['data-form'] === 'timed')[0], node => node.type === 'button')[0].props.onClick();
  await page.settle();
  const patch = client.calls.filter(call => call.patch).pop();
  assert.equal(patch.set.announcements.length, 3);
  const added = patch.set.announcements[2];
  assert.equal(added.time, '15:45');
  assert.equal(added.title, 'CLEAN UP');
  assert.equal(added.show, true);
  assert.deepEqual(added.days, [0, 1, 2, 3, 4, 5, 6]);
});

test('a message can be removed, and nothing else changes', async () => {
  const { page, client } = await opened();
  const card = nodesWhere(page.tree(), node => node.props && node.props['data-card'] === 'k2')[0];
  nodesWhere(card, node => node.type === 'button' && wordsIn(node) === parts.words.removeTimed)[0].props.onClick();
  await page.settle();
  const patch = client.calls.filter(call => call.patch).pop();
  assert.deepEqual(patch.set.announcements.map(row => row._key), ['k1']);
});

test('without Dashboard Settings the page says to publish it once and still lists the announcements', async () => {
  globalThis.studioClient = fakeClient(documents().filter(doc => doc._id !== 'dashboardSettings'));
  const page = studio.mount(view.TodayView);
  await page.settle();
  assert.match(wordsIn(page.tree()), /Open it, click Publish once, and come back\./);
  assert.match(wordsIn(page.tree()), /Pizza at 6/);
});

test('the page keeps a 16 pixel gutter, wraps its text and has no box wider than a phone', () => {
  const styles = studio.source('inputs/page-styles.js');
  assert.match(styles, /page: \{[^}]*padding: '24px 16px'/);
  ['today-view.js', 'today-parts.js', 'field-editor.js', 'page-styles.js'].forEach(file => {
    const text = studio.source('inputs/' + file);
    (text.match(/minHeight: \d+/g) || []).forEach(found => assert.ok(Number(found.replace(/\D/g, '')) >= 44, file + ' ' + found));
    assert.ok(!/\bwidth: [3-9]\d\d\b/.test(text), file + ' has a fixed width');
  });
});

let failed = 0;
for (const item of tests) {
  try {
    await item.run();
    console.log('PASS  ' + item.name);
  } catch (error) {
    failed += 1;
    console.log('FAIL  ' + item.name + '\n      ' + String(error && error.stack ? error.stack : error).split('\n').slice(0, 6).join('\n      '));
  }
}
studio.close();
console.log(failed === 0 ? tests.length + ' of ' + tests.length + ' checks passed.' : failed + ' of ' + tests.length + ' checks failed.');
process.exit(failed === 0 ? 0 : 1);
