// Tests for the lines of the lists in Studio (the preview of each type in studio/schemas/):
// every row shows what the TV shows, and an item the TV is not showing starts with Hidden or
// Expired. Each preview is run on a made-up document, with its select read the way Studio
// reads it. Nothing is installed and nothing touches the network.
//
//   node tools/test-previews.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const schemaFolder = path.join(root, 'studio', 'schemas');
const { loadSchemas } = await import(pathToFileURL(path.join(root, 'studio', 'scripts', 'make-templates.mjs')).href);
const { types } = await loadSchemas();

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const past = '2000-01-01T15:00:00.000Z';
const future = '2999-01-01T15:00:00.000Z';

// The line a list shows for a document: select is read from it by path, as Studio does,
// then prepare makes the title and the subtitle
function lineOf(typeName, document) {
  const preview = types.filter(type => type.name === typeName)[0].preview;
  const picked = {};
  Object.keys(preview.select).forEach(alias => {
    picked[alias] = preview.select[alias].split('.').reduce((value, key) => (value === undefined || value === null ? undefined : value[key]), document);
  });
  return preview.prepare(picked);
}

// One or more documents for each type, with the title and the subtitle the list shows
const lines = {
  task: [
    {
      document: { title: 'Wire the robot', subteam: { name: 'Build' }, status: 'in-progress', priority: 'high', source: 'monday', contact: 'Sam', location: { name: 'Classroom' } },
      title: 'Wire the robot',
      subtitle: 'Build · In progress · High priority · Board · Sam · Classroom',
    },
    { document: { title: 'Wire the robot', subteam: { name: 'Build' }, status: 'up-next' }, title: 'Wire the robot', subtitle: 'Build · Up next · Pinned' },
    { document: { title: 'Wire the robot', status: 'done', source: 'manual' }, title: 'Wire the robot', subtitle: 'Done · Pinned' },
  ],
  plan: [
    { document: { heading: 'Build meeting', date: '2026-10-08', location: 'Room 12' }, title: 'Build meeting', subtitle: 'Thu Oct 8 · Room 12' },
    { document: { heading: 'Build meeting', date: '2027-01-02' }, title: 'Build meeting', subtitle: 'Sat Jan 2' },
    { document: { heading: 'Build meeting', location: 'Room 12' }, title: 'Build meeting', subtitle: 'Room 12' },
  ],
  calendarFilter: [
    { document: { name: 'Standup rule', action: 'hide', words: ['Standup', 'Practice'] }, title: 'Standup rule', subtitle: 'Hide · Standup or Practice' },
    { document: { name: 'Kickoff rule', action: 'show', words: ['Kickoff'], days: [1, 4] }, title: 'Kickoff rule', subtitle: 'Always show · Kickoff · Mon, Thu' },
  ],
  presentation: [
    {
      document: { topic: '[Talk title]', start: '2026-10-08T18:45:00.000Z', name: 'Alex', subteam: 'Build' },
      title: '[Talk title]',
      subtitle: 'Thu Oct 8, 2:45 PM · Alex · Build',
    },
    { document: { topic: '[Talk title]', start: '2026-10-08T04:05:00.000Z', name: 'Alex' }, title: '[Talk title]', subtitle: 'Thu Oct 8, 12:05 AM · Alex' },
  ],
  presentationDay: [
    { document: { firstSlotAt: '2026-10-08T18:45:00.000Z', lastSlotAt: '2026-10-08T20:45:00.000Z' }, title: 'Thu Oct 8', subtitle: '2:45 PM to 4:45 PM' },
    { document: { firstSlotAt: '2026-10-08T18:45:00.000Z', lastSlotAt: '2026-10-08T18:45:00.000Z' }, title: 'Thu Oct 8', subtitle: '2:45 PM' },
  ],
  subteam: [
    { document: { name: 'Build', lead: 'Sam', members: ['Alex', 'Jo', 'Kim'] }, title: 'Sam', subtitle: 'Build lead · 3 members' },
    { document: { name: 'Build', lead: 'Sam', members: ['Alex'], spotlight: true }, title: 'Sam', subtitle: 'Build lead · 1 member · In the spotlight' },
    { document: { name: 'Build' }, title: 'Build', subtitle: '[lead]' },
  ],
  person: [
    { document: { name: 'Sam', role: 'Coach' }, title: 'Sam', subtitle: 'Coach' },
    { document: { name: 'Jo', role: 'Captain', title: 'President' }, title: 'Jo', subtitle: 'President' },
  ],
  sponsor: [
    { document: { name: 'Acme', tier: 'Gold' }, title: 'Acme', subtitle: 'Gold' },
    { document: { name: 'Acme' }, title: 'Acme', subtitle: '' },
  ],
  tipOrNews: [
    { document: { text: 'Charge the batteries.', kind: 'tip' }, title: 'Charge the batteries.', subtitle: 'Tip' },
    { document: { text: 'We won the award.', kind: 'news', expires: future }, title: 'We won the award.', subtitle: 'News · Until Jan 1, 10:00 AM' },
  ],
  customPanel: [
    { document: { title: 'SAFETY', blocks: [{}, {}, {}] }, title: 'SAFETY', subtitle: '3 blocks' },
    { document: { title: 'SAFETY', blocks: [{}] }, title: 'SAFETY', subtitle: '1 block' },
  ],
  team: [
    { document: { name: 'Hawktimus Prime', number: '3229', mirror: false }, title: 'Hawktimus Prime', subtitle: '3229 · Mirror off' },
    { document: { name: 'Hawktimus Nova', number: '3230', mirror: true }, title: 'Hawktimus Nova', subtitle: '3230 · Mirror on' },
    { document: { name: 'Hawktimus Nova', active: true }, title: 'Hawktimus Nova', subtitle: 'Mirror off' },
  ],
};

// The types whose items have a Show on screen switch and a Hide after time
const withFlags = ['task', 'plan', 'subteam', 'person', 'sponsor', 'tipOrNews', 'customPanel'];

// Title and subtitle

Object.keys(lines).forEach(typeName => {
  test('the ' + typeName + ' list shows the title and the subtitle of each made-up document', () => {
    lines[typeName].forEach(entry => {
      const shown = lineOf(typeName, entry.document);
      assert.equal(shown.title, entry.title, JSON.stringify(entry.document));
      assert.equal(shown.subtitle, entry.subtitle, JSON.stringify(entry.document));
    });
  });
});

test('a document with nothing in it still has a title and never says undefined or null', () => {
  Object.keys(lines).forEach(typeName => {
    const shown = lineOf(typeName, {});
    assert.ok(shown.title, typeName + ' has no title for an empty document');
    [shown.title, shown.subtitle].forEach(text => assert.ok(!/\b(undefined|null)\b/.test(text || ''), typeName + ': ' + text));
  });
});

// Hidden and Expired

withFlags.forEach(typeName => {
  test('the ' + typeName + ' list starts with Hidden or Expired when the TV is not showing the item', () => {
    lines[typeName].forEach(entry => {
      const document = Object.assign({}, entry.document);
      delete document.expires;
      const plain = lineOf(typeName, document).subtitle;
      const firstWord = fields => lineOf(typeName, Object.assign({}, document, fields)).subtitle.split(' · ')[0];

      assert.equal(lineOf(typeName, Object.assign({}, document, { show: true })).subtitle, plain, 'switched on');
      assert.equal(lineOf(typeName, Object.assign({}, document, { show: false })).subtitle, plain === '' ? 'Hidden' : 'Hidden · ' + plain, 'switched off');
      assert.equal(firstWord({ expires: past }), 'Expired', 'expired');
      assert.notEqual(firstWord({ expires: future }), 'Expired', 'not expired yet');
      assert.equal(firstWord({ show: false, expires: past }), 'Hidden', 'hidden wins over expired');
    });
  });
});

test('a task kept off the TV with Show on TV starts with Hidden', () => {
  const document = lines.task[1].document;
  assert.equal(lineOf('task', Object.assign({}, document, { showOnTv: false })).subtitle, 'Hidden · Build · Up next · Pinned');
  assert.equal(lineOf('task', Object.assign({}, document, { showOnTv: true })).subtitle, 'Build · Up next · Pinned');
});

test('a calendar filter that is switched off starts with Off, and one that has run out starts with Expired', () => {
  const document = lines.calendarFilter[0].document;
  assert.equal(lineOf('calendarFilter', Object.assign({}, document, { show: false })).subtitle, 'Off · Hide · Standup or Practice');
  assert.equal(lineOf('calendarFilter', Object.assign({}, document, { expires: past })).subtitle, 'Expired · Hide · Standup or Practice');
  assert.equal(lineOf('calendarFilter', Object.assign({}, document, { expires: future })).subtitle, 'Hide · Standup or Practice');
});

test('a team that is not active starts with Hidden', () => {
  const document = lines.team[0].document;
  assert.equal(lineOf('team', Object.assign({}, document, { active: false })).subtitle, 'Hidden · 3229 · Mirror off');
  assert.equal(lineOf('team', Object.assign({}, document, { active: true })).subtitle, '3229 · Mirror off');
});

test('a talk that is not scheduled and a meeting day that is closed say so first', () => {
  const talk = lines.presentation[0].document;
  assert.equal(lineOf('presentation', Object.assign({}, talk, { status: 'cancelled' })).subtitle, 'Cancelled · Thu Oct 8, 2:45 PM · Alex · Build');
  assert.equal(lineOf('presentation', Object.assign({}, talk, { status: 'scheduled' })).subtitle, 'Thu Oct 8, 2:45 PM · Alex · Build');

  const day = lines.presentationDay[0].document;
  assert.equal(lineOf('presentationDay', Object.assign({}, day, { open: false })).subtitle, 'Closed for booking · 2:45 PM to 4:45 PM');
  assert.equal(lineOf('presentationDay', Object.assign({}, day, { open: true })).subtitle, '2:45 PM to 4:45 PM');
});

// One place for the rule

test('the schemas of these lists do not write the words Hidden and Expired themselves', () => {
  const quoted = /['"](Hidden|Expired)['"]/;
  const outside = Object.keys(lines).filter(typeName => quoted.test(fs.readFileSync(path.join(schemaFolder, typeName + '.js'), 'utf8')));
  assert.deepEqual(outside, [], 'these schemas should call subtitleFor from fields.js instead');
  assert.ok(quoted.test(fs.readFileSync(path.join(schemaFolder, 'fields.js'), 'utf8')), 'fields.js holds the rule');
});

// Run them

let failures = 0;
for (const entry of tests) {
  try {
    await entry.run();
    console.log('ok    ' + entry.name);
  } catch (error) {
    failures += 1;
    console.log('FAIL  ' + entry.name);
    console.log(error);
  }
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
