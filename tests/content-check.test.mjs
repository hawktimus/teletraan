// Tests for the content checks (studio/tools/content-rules.js, content-check.js, content-check-rotation.js), the warnings the
// schemas give while typing, and the Check the screen page (studio/inputs/check-screen-view.js). Each problem is a sample that
// raises its check, and clean content raises none.
//
//   node tests/content-check.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import { openStudio, nodesWhere, wordsIn } from './helpers/studio-world.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');
const load = file => import(pathToFileURL(path.join(repo, file)).href);

const check = await load('studio/tools/content-check.js');
const rules = await load('studio/tools/content-rules.js');
const rotation = await load('studio/tools/content-check-rotation.js');
const { limits, photoPanel } = await load('studio/schemas/limits.js');
const { defaultRotationRows } = await load('studio/tools/default-rotation.js');
const partsOfPage = await load('studio/inputs/check-screen-parts.js');

const now = new Date('2026-10-20T12:00:00Z');
const teams = fs.readFileSync(path.join(repo, 'docs/seed/teams.ndjson'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
const departments = ['build', 'electrical', 'programming', 'design', 'cnc', 'strategy', 'operations', 'business', 'marketing'];

function picture(ref, extra) {
  return Object.assign({ asset: { _ref: ref } }, extra);
}

// Content that has nothing wrong with it, and that the standard rotation can play
function clean() {
  const docs = [
    { _id: 't1', _type: 'tipOrNews', kind: 'tip', text: 'Check your battery before a match' },
    { _id: 't2', _type: 'tipOrNews', kind: 'news', text: 'Practice moves to the lab on Friday', expires: '2026-12-01T00:00:00Z' },
    { _id: 'a1', _type: 'announcement', text: 'Pizza in the lab at 6', start: '2026-10-20T10:00:00Z', end: '2026-10-21T10:00:00Z' },
    { _id: 'pl1', _type: 'plan', heading: 'Build meeting', date: '2026-10-20', location: 'Lab', rows: [{ time: '6:00 PM', text: 'Wiring', lead: 'Sam' }, { time: '7:00 PM', text: 'Cleanup', lead: 'Ana' }] },
    { _id: 'pr1', _type: 'presentation', name: 'Sam', topic: 'Swerve drive', start: '2026-10-25T22:00:00Z', minutes: 10, status: 'scheduled', deckLink: 'https://docs.google.com/presentation/d/abc/edit' },
    { _id: 'p1', _type: 'person', role: 'Coach', name: 'Pat', title: 'Head Coach', photo: picture('image-aaa-800x800-jpg') },
    { _id: 'p2', _type: 'person', role: 'Captain', name: 'Ana', title: 'Co-President', photo: picture('image-bbb-800x800-jpg') },
    { _id: 's1', _type: 'subteam', name: 'Build', lead: 'Sam', photo: picture('image-ccc-800x800-jpg'), members: ['Ana', 'Lee'], spotlight: true, spotlightHeadline: 'New chassis' },
    { _id: 's2', _type: 'subteam', name: 'Wiring', lead: 'Lee', photo: picture('image-ddd-800x800-jpg'), members: [] },
    { _id: 'sp1', _type: 'sponsor', name: 'Acme Tools', tier: 'Gold', blurb: 'Gives us drills', thankYou: 'Thank you to Acme Tools', logoAddress: 'https://example.org/logo.png' },
    { _id: 'ph1', _type: 'photo', image: picture('image-eee-2400x1600-jpg'), caption: 'Pit crew', credit: 'Sam' },
    { _id: 'ph2', _type: 'photo', image: picture('image-fff-2000x1500-jpg'), caption: 'Field test', credit: 'Ana', fit: 'fill' },
    { _id: 'f1', _type: 'calendarFilter', name: 'Hide practice', action: 'hide', words: ['practice'], show: true, scope: 'many' },
    { _id: 'c1', _type: 'customPanel', title: 'Stats', blocks: [{ _type: 'headingBlock', _key: 'k1', text: 'Matches played' }] },
    { _id: 'dashboardSettings', _type: 'dashboardSettings', photoSource: 'upload', countdown: { kickoff: '2027-01-09T17:00:00Z', kickoffLabel: 'KICKOFF IN', rolloutLabel: 'ROLLOUT IN' }, photoFit: 'fill', rotationRows: defaultRotationRows() },
  ];
  teams.forEach(team => docs.push(JSON.parse(JSON.stringify(team))));
  return docs;
}

const cleanTasks = departments.map(department => ({ team: null, department: department, list: 'open', status: 'working', startDate: '2026-10-01', dueDate: '2026-11-01' }));

function run(docs, tasks) {
  return check.checkContent(docs, now, tasks || cleanTasks);
}

function codesOf(found) {
  return found.map(item => item.code);
}

function change(id, fields, docs) {
  return (docs || clean()).map(doc => (doc._id === id ? Object.assign({}, doc, fields) : doc));
}

function without(docs, id) {
  return docs.filter(doc => doc._id !== id);
}

function settingsWith(rows, docs) {
  return change('dashboardSettings', { rotationRows: rows }, docs);
}


// Clean content

test('clean content, with the standard rotation, raises no finding', () => {
  const found = run(clean());
  assert.deepEqual(found.map(item => item.code + ' ' + item.doc.id + ': ' + item.message), []);
});

test('the two starting teams have colors that can be read', () => {
  teams.forEach(team => assert.deepEqual(rules.colorTrouble(team.colors), [], team.code));
});


// The rules

test('a web address, an email address or a phone number is found, and plain text is not', () => {
  assert.equal(rules.contactIn('mail pat@example.com now'), 'an email address');
  assert.equal(rules.contactIn('see https://example.com/page'), 'a web address');
  assert.equal(rules.contactIn('see www.team.org'), 'a web address');
  assert.equal(rules.contactIn('call 919-555-0143'), 'a phone number');
  assert.equal(rules.contactIn('call (919) 555 0143'), 'a phone number');
  ['Check your battery', 'Meet at 6:00 PM in room 204', 'Team 3229 won', 'Kickoff is 2027-01-09', 'Sam K. leads'].forEach(text => assert.equal(rules.contactIn(text), '', text));
  assert.equal(rules.noContact('fine'), true);
  assert.match(rules.noContact('a@b.co'), /email address/);
});

test('a full name is found, a first name and a last initial are not', () => {
  assert.equal(rules.looksLikeFullName('Sam Smith'), true);
  assert.equal(rules.looksLikeFullName('Sam K.'), false);
  assert.equal(rules.looksLikeFullName('Sam'), false);
  assert.equal(rules.looksLikeFullName('Mary-Anne'), false);
  assert.equal(rules.firstNameOnlyWarning('Sam'), true);
  assert.match(rules.firstNameOnlyWarning('Sam Smith'), /full name/);
});

test('the size of a picture comes from its id, the crop and the hotspot of the editor', () => {
  assert.deepEqual(rules.sizeOfAsset('image-abc123-1920x1080-jpg'), { width: 1920, height: 1080 });
  assert.equal(rules.sizeOfAsset('file-abc-pdf'), null);
  assert.deepEqual(rules.keptPixels(picture('image-abc-2000x1000-png', { crop: { left: 0.25, right: 0.25, top: 0, bottom: 0 } })), { width: 1000, height: 1000 });
  assert.equal(rules.keptPixels({}), null);
  const measured = { asset: { _id: 'image-x-100x100-jpg', metadata: { dimensions: { width: 3000, height: 2000 } } } };
  assert.deepEqual(rules.keptPixels(measured), { width: 3000, height: 2000 });
});

test('a photo is judged against the panel and the fit it is drawn with', () => {
  assert.deepEqual(rules.photoTrouble(picture('image-a-2400x1600-jpg'), 'fill', 'fill'), []);
  assert.deepEqual(rules.photoTrouble(picture('image-a-1200x800-jpg'), 'fill', 'fill'), []);
  assert.equal(rules.photoTrouble(picture('image-a-800x500-jpg'), 'fill', 'fill')[0].level, 'warning');
  assert.equal(rules.photoTrouble(picture('image-a-300x200-jpg'), 'fill', 'fill')[0].level, 'problem');
  const tall = rules.photoTrouble(picture('image-a-1800x2400-jpg'), 'setting', 'fill');
  assert.ok(tall.some(item => /taller than it is wide/.test(item.message)));
  assert.deepEqual(rules.photoTrouble(picture('image-a-1800x2400-jpg'), 'setting', 'whole'), [], 'Show the whole photo fits a tall photo');
  assert.deepEqual(rules.photoTrouble(picture('image-a-1800x2400-jpg'), 'whole', 'fill'), [], 'the photo own fit wins');
});

test('contrast is worked out the usual way', () => {
  assert.equal(rules.contrastRatio('#000000', '#FFFFFF'), 21);
  assert.equal(rules.contrastRatio('#777777', '#777777'), 1);
  assert.equal(rules.contrastRatio('nope', '#FFFFFF'), null);
  const bad = rules.colorTrouble({ text: '#777777', background: '#808080', body: '#1A0F2E', plate: '#3B2A7A', label: '#FACA2A', accent: '#FACA2A', neon: '#FACA2A', primary: '#6C18B6' });
  assert.ok(bad.some(item => item.field === 'text' && item.level === 'problem'));
});

test('the limits are the ones the schemas refuse past', async () => {
  const studio = await openStudio();
  try {
    const checks = [['tipOrNews', 'text', limits.tickerLine], ['announcement', 'text', limits.announcementText], ['photo', 'caption', limits.photoCaption], ['photo', 'credit', limits.photoCredit], ['person', 'name', limits.personName], ['person', 'title', limits.personRole], ['subteam', 'lead', limits.leadName], ['sponsor', 'name', limits.sponsorName], ['sponsor', 'thankYou', limits.sponsorThanks], ['plan', 'heading', limits.planHeading], ['team', 'name', limits.teamName]];
    for (const entry of checks) {
      const type = (await studio.load('schemas/' + entry[0] + '.js')).default;
      const field = type.fields.filter(item => item.name === entry[1])[0];
      const found = constraints(field).filter(item => item.name === 'max').map(item => item.args[0]);
      assert.deepEqual(found, [entry[2]], entry[0] + '.' + entry[1]);
    }
    const description = (await studio.load('schemas/tipOrNews.js')).default.fields.filter(item => item.name === 'text')[0].description;
    assert.ok(description.includes('Up to ' + limits.tickerLine + ' characters'), 'the sentence of the field says the limit');
  } finally {
    studio.close();
  }
});

test('the numbers about the dashboard agree with the dashboard', async () => {
  const images = await load('dashboard/core/images.js');
  assert.equal(photoPanel.askedWidth, images.photoMaxWidth);
  const parts = await load('studio/inputs/start-here-parts.js');
  const main = parts.areas.filter(area => area.letter === 'B')[0];
  assert.equal(photoPanel.width, main.width);
  assert.equal(photoPanel.height, main.height);

  const registry = (await load('dashboard/registry.js')).panels;
  Object.keys(rotation.panelTopics).forEach(id => {
    const panel = registry.filter(item => item.id === id)[0];
    assert.ok(panel, id + ' is in the registry');
    assert.deepEqual(rotation.panelTopics[id], [panel.topic, panel.region], id);
  });
  registry.filter(panel => panel.topic && !panel.testOnly && !panel.competition && !panel.lastResort).forEach(panel => {
    assert.ok(rotation.panelTopics[panel.id], panel.id + ' has a topic in content-check-rotation.js');
  });
});


// The checks

test('a ticker line that is too long, private, repeated or expired is found', () => {
  const docs = clean().concat([
    { _id: 't3', _type: 'tipOrNews', kind: 'tip', text: 'This line is far too long to fit on the ticker at the bottom of the screen' },
    { _id: 't4', _type: 'tipOrNews', kind: 'tip', text: 'Mail coach@example.com for help' },
    { _id: 't5', _type: 'tipOrNews', kind: 'tip', text: 'check your battery before a match' },
    { _id: 't6', _type: 'tipOrNews', kind: 'tip', text: 'Old news', expires: '2026-09-01T00:00:00Z' },
    { _id: 't7', _type: 'tipOrNews', kind: 'tip', text: '   ' },
  ]);
  const found = run(docs);
  const has = (id, code) => found.some(item => item.doc.id === id && item.code === code);
  assert.ok(has('t3', 'text-too-long'));
  assert.ok(has('t4', 'public-contact'));
  assert.ok(has('t5', 'duplicate'));
  assert.ok(has('t6', 'expired'));
  assert.ok(has('t7', 'text-empty'));
  assert.equal(found.filter(item => item.area !== 'Ticker').length, 0);
  assert.ok(found.filter(item => item.code === 'public-contact').every(item => item.level === 'problem'));
});

test('a hidden item raises nothing', () => {
  const docs = clean().concat([{ _id: 't9', _type: 'tipOrNews', kind: 'tip', text: 'Mail a@b.com and a very long line that does not fit anywhere', show: false, expires: '2020-01-01T00:00:00Z' }]);
  assert.deepEqual(run(docs), []);
});

test('an announcement that ends before it starts, never starts or is over is found', () => {
  const found = run(clean().concat([
    { _id: 'a2', _type: 'announcement', text: 'Backwards', start: '2026-10-22T10:00:00Z', end: '2026-10-21T10:00:00Z' },
    { _id: 'a3', _type: 'announcement', text: 'No end', start: '2026-10-22T10:00:00Z' },
    { _id: 'a4', _type: 'announcement', text: 'Last week', start: '2026-10-01T10:00:00Z', end: '2026-10-02T10:00:00Z' },
    { _id: 'a5', _type: 'announcement', text: 'Call 919 555 0143', start: '2026-10-20T10:00:00Z', end: '2026-10-21T10:00:00Z' },
  ]));
  const has = (id, code) => found.some(item => item.doc.id === id && item.code === code);
  assert.ok(has('a2', 'end-before-start') && has('a3', 'no-end') && has('a4', 'over') && has('a5', 'public-contact'));
});

test('an agenda item with no date, a date that has passed or too many rows is found', () => {
  const found = run(clean().concat([
    { _id: 'pl2', _type: 'plan', heading: 'Open lab', rows: [{ time: '6 PM', text: 'Work' }] },
    { _id: 'pl3', _type: 'plan', heading: 'Old meeting', date: '2026-09-01', rows: [{ time: '6 PM', text: 'Work' }] },
    { _id: 'pl4', _type: 'plan', heading: 'Busy night', date: '2026-10-21', rows: [1, 2, 3, 4, 5, 6].map(number => ({ time: '6 PM', text: 'Item ' + number })) },
    { _id: 'pl5', _type: 'plan', heading: 'Empty', date: '2026-10-21', rows: [] },
    { _id: 'pl6', _type: 'plan', heading: 'Long text', date: '2026-10-21', rows: [{ time: '6 PM', text: 'A row of text that is far too long' }] },
  ]));
  const has = (id, code) => found.some(item => item.doc.id === id && item.code === code);
  assert.ok(has('pl2', 'no-date') && has('pl3', 'date-past') && has('pl4', 'plan-rows') && has('pl5', 'plan-no-rows') && has('pl6', 'text-too-long'));
});

test('a talk with no start time, no slides or long past is found', () => {
  const found = run(clean().concat([
    { _id: 'pr2', _type: 'presentation', name: 'Lee', topic: 'Wiring', status: 'scheduled', deckLink: 'https://docs.google.com/presentation/d/x/edit' },
    { _id: 'pr3', _type: 'presentation', name: 'Lee Walker', topic: 'Wiring', start: '2026-10-30T22:00:00Z', status: 'scheduled' },
    { _id: 'pr4', _type: 'presentation', name: 'Lee', topic: 'Old talk', start: '2026-09-01T22:00:00Z', minutes: 10, status: 'scheduled', deckLink: 'https://docs.google.com/presentation/d/x/edit' },
  ]));
  const has = (id, code) => found.some(item => item.doc.id === id && item.code === code);
  assert.ok(has('pr2', 'no-start') && has('pr3', 'no-slides') && has('pr3', 'full-name') && has('pr4', 'talk-past'));
});

test('a person with no role, no portrait or a full name is found', () => {
  const found = run(clean().concat([
    { _id: 'p3', _type: 'person', role: 'Mentor', name: 'Robin Banks', title: '', photo: picture('image-ggg-800x800-jpg') },
    { _id: 'p4', _type: 'person', name: 'Kai', photo: picture('image-hhh-800x800-jpg') },
    { _id: 'p5', _type: 'person', role: 'Coach', name: 'Dana', title: 'Coach', line: 'Write dana@example.com' },
    { _id: 'p6', _type: 'person', role: 'Coach', name: 'Pat', title: 'Coach', showPhoto: false },
    { _id: 'p7', _type: 'person', role: 'Wizard', name: 'Wynn', title: 'Wizard', photo: picture('image-iii-800x800-jpg') },
  ]));
  const has = (id, code) => found.some(item => item.doc.id === id && item.code === code);
  assert.ok(has('p3', 'no-role') && has('p3', 'full-name') && has('p4', 'no-role') && has('p5', 'no-portrait') && has('p5', 'public-contact') && has('p6', 'duplicate') && has('p7', 'odd-role'));
  assert.ok(!has('p6', 'no-portrait'), 'a hidden portrait on purpose is not a finding');
  assert.equal(found.filter(item => item.doc.id === 'p4' && item.code === 'no-role')[0].level, 'problem');
  assert.equal(found.filter(item => item.doc.id === 'p3' && item.code === 'no-role')[0].level, 'warning');
});

test('a team lead with no lead, no portrait, a long roster or a repeated name is found', () => {
  const found = run(clean().concat([
    { _id: 's3', _type: 'subteam', name: 'Design', lead: '', members: [] },
    { _id: 's4', _type: 'subteam', name: 'Software', lead: 'Kim', members: ['Ana', 'ana', 'Lee Walker', '', 'A very long member name'] },
    { _id: 's5', _type: 'subteam', name: 'Strategy', lead: 'Rae', photo: picture('image-jjj-800x800-jpg'), spotlight: true, spotlightHeadline: '' },
    { _id: 's6', _type: 'subteam', name: 'Cart', lead: 'Joy', photo: picture('image-kkk-800x800-jpg'), members: Array.from({ length: 25 }, (value, index) => 'Name' + String.fromCharCode(97 + index)) },
  ]));
  const has = (id, code) => found.some(item => item.doc.id === id && item.code === code);
  assert.ok(has('s3', 'no-lead') && has('s4', 'no-portrait') && has('s4', 'duplicate') && has('s4', 'full-name') && has('s4', 'member-empty') && has('s4', 'text-too-long') && has('s5', 'text-empty') && has('s6', 'members-many'));
});

test('a sponsor with no logo, a bad logo or text with a web address is found', () => {
  const found = run(clean().concat([
    { _id: 'sp2', _type: 'sponsor', name: 'No Logo Co' },
    { _id: 'sp3', _type: 'sponsor', name: 'Bad Logo Co', logoAddress: 'logo.png' },
    { _id: 'sp4', _type: 'sponsor', name: 'Link Co', logoAddress: 'https://example.org/a.png', thankYou: 'Visit www.linkco.com today', blurb: 'This sponsor description is much too long to fit in the space on the sponsor feature card' },
    { _id: 'sp5', _type: 'sponsor', name: 'Acme tools', logoAddress: 'https://example.org/a.png' },
  ]));
  const has = (id, code) => found.some(item => item.doc.id === id && item.code === code);
  assert.ok(has('sp2', 'no-logo') && has('sp3', 'bad-logo') && has('sp4', 'public-contact') && has('sp4', 'text-too-long') && has('sp5', 'duplicate'));
});

test('a photo that is small, tall, uncredited, without a picture or repeated is found', () => {
  const found = run(clean().concat([
    { _id: 'ph3', _type: 'photo', image: picture('image-lll-700x450-jpg'), credit: 'Sam' },
    { _id: 'ph4', _type: 'photo', image: picture('image-mmm-250x160-jpg'), credit: 'Sam' },
    { _id: 'ph5', _type: 'photo', image: picture('image-nnn-1500x2000-jpg'), credit: 'Sam' },
    { _id: 'ph6', _type: 'photo', image: picture('image-ooo-2400x1600-jpg') },
    { _id: 'ph7', _type: 'photo', image: picture('image-ppp-2400x1600-jpg'), credit: 'Sam Smith' },
    { _id: 'ph8', _type: 'photo', image: picture('image-qqq-2400x1600-jpg'), credit: 'sam@example.com' },
    { _id: 'ph9', _type: 'photo', credit: 'Sam' },
    { _id: 'ph10', _type: 'photo', image: picture('image-eee-2400x1600-jpg'), credit: 'Sam' },
    { _id: 'ph11', _type: 'photo', image: picture('image-rrr-2400x1600-jpg'), credit: 'Sam', caption: 'Call 919-555-0143 for a ride to the shop' },
  ]));
  const has = (id, code) => found.some(item => item.doc.id === id && item.code === code);
  assert.ok(has('ph3', 'photo-size') && has('ph4', 'photo-tiny') && has('ph5', 'photo-size') && has('ph6', 'no-credit') && has('ph7', 'bad-credit') && has('ph8', 'bad-credit') && has('ph9', 'no-picture') && has('ph10', 'duplicate') && has('ph11', 'public-contact') && has('ph11', 'text-too-long'));
  assert.equal(found.filter(item => item.doc.id === 'ph8')[0].level, 'problem');
  assert.ok(found.filter(item => item.doc.id === 'ph5').some(item => /taller than it is wide/.test(item.message)));
});

test('the photo fit of Dashboard Settings decides whether a tall photo is a problem', () => {
  const tall = { _id: 'ph5', _type: 'photo', image: picture('image-nnn-1500x2000-jpg'), credit: 'Sam' };
  const whole = run(change('dashboardSettings', { photoFit: 'whole' }).concat([tall]));
  assert.ok(!whole.some(item => item.doc.id === 'ph5' && /taller/.test(item.message)));
  const fill = run(clean().concat([tall]));
  assert.ok(fill.some(item => item.doc.id === 'ph5' && /taller/.test(item.message)));
});

test('a team with colors that cannot be read, a repeated code or a color that is not a color is found', () => {
  const grey = JSON.parse(JSON.stringify(teams[0]));
  grey._id = 'team-grey';
  grey.code = 'prime';
  grey.colors = Object.assign({}, grey.colors, { text: '#8A8A8A', background: '#7A7A7A', accent: 'green' });
  const found = run(clean().concat([grey]));
  const has = (id, code) => found.some(item => item.doc.id === id && item.code === code);
  assert.ok(has('team-grey', 'low-contrast') && has('team-grey', 'duplicate') && has('team-grey', 'bad-color'));
  assert.ok(found.some(item => item.code === 'low-contrast' && item.level === 'problem'));
});

test('a calendar filter that matches every event, ended, or repeats another is found', () => {
  const found = run(clean().concat([
    { _id: 'f2', _type: 'calendarFilter', name: 'Hide everything', action: 'hide', scope: 'many', words: [' '] },
    { _id: 'f3', _type: 'calendarFilter', name: 'Old rule', action: 'hide', words: ['bake sale'], toDate: '2026-09-01' },
    { _id: 'f4', _type: 'calendarFilter', name: 'Hide practice again', action: 'hide', words: ['Practice'] },
    { _id: 'f5', _type: 'calendarFilter', name: 'One event', action: 'hide', scope: 'one', eventTitle: 'Dinner' },
    { _id: 'f6', _type: 'calendarFilter', name: 'Backwards', action: 'hide', words: ['x'], fromDate: '2026-11-01', toDate: '2026-10-01' },
  ].concat([1, 2, 3, 4].map(number => ({ _id: 'pin' + number, _type: 'calendarFilter', name: 'Pin ' + number, action: 'show', force: true, words: ['pin' + number] })))));
  const has = (id, code) => found.some(item => item.doc.id === id && item.code === code);
  assert.ok(has('f2', 'rule-matches-all') && has('f3', 'rule-ended') && has('f4', 'duplicate') && has('f5', 'rule-one-event') && has('f6', 'rule-dates') && has('pin4', 'pin-many'));
});

test('an extra panel with no blocks or with a phone number in a block is found', () => {
  const found = run(clean().concat([
    { _id: 'c2', _type: 'customPanel', title: 'Empty', blocks: [] },
    { _id: 'c3', _type: 'customPanel', title: 'Contact', blocks: [{ _type: 'textBlock', _key: 'k', text: 'Call 919-555-0143' }] },
    { _id: 'c4', _type: 'customPanel', title: 'A title too long' },
  ]));
  const has = (id, code) => found.some(item => item.doc.id === id && item.code === code);
  assert.ok(has('c2', 'panel-empty') && has('c3', 'public-contact') && has('c4', 'text-too-long'));
});

test('a countdown that is over and photos from a Drive folder with no folder are found', () => {
  const over = run(change('dashboardSettings', { countdown: { kickoff: '2026-01-09T17:00:00Z', rollout: '2026-02-01T00:00:00Z' } }));
  assert.ok(over.some(item => item.code === 'countdown-over'));
  const drive = run(change('dashboardSettings', { photoSource: 'drive' }));
  assert.ok(drive.some(item => item.code === 'no-drive-folder' && item.level === 'problem'));
  assert.ok(drive.some(item => item.code === 'photos-unused'));
});

test('the draft is the version that is checked, and a draft that fixes a problem clears it', () => {
  const broken = { _id: 'tx', _type: 'tipOrNews', kind: 'tip', text: 'Mail a@b.com' };
  assert.ok(run(clean().concat([broken])).some(item => item.doc.id === 'tx' && item.doc.state === 'published'));
  const fixed = Object.assign({}, broken, { _id: 'drafts.tx', text: 'Ask a coach' });
  assert.deepEqual(run(clean().concat([broken, fixed])).filter(item => item.doc.id === 'tx'), []);
  const worse = Object.assign({}, broken, { _id: 'drafts.tx', text: 'Mail me at c@d.com' });
  assert.equal(run(clean().concat([{ _id: 'tx', _type: 'tipOrNews', text: 'Fine' }, worse])).filter(item => item.doc.id === 'tx')[0].doc.state, 'draft');
});


// The rotation

function rowsOf(rows, docs, tasks) {
  return rotation.rotationTrouble(rows, dataOf(docs || clean(), tasks), now).map(item => item.code);
}

function dataOf(docs, tasks) {
  const live = type => check.currentDocuments(docs).filter(doc => doc._type === type);
  return { people: live('person'), subteams: live('subteam'), sponsors: live('sponsor'), customPanels: live('customPanel'), photos: live('photo').map(photo => ({ expires: photo.expires })), tasks: tasks || cleanTasks, teams: live('team') };
}

test('the standard rotation raises nothing when there is content for every row', () => {
  assert.deepEqual(rowsOf(defaultRotationRows()), []);
});

test('rows the wall always skips are found: no people, no sponsors, no photos, no tasks, no team', () => {
  const row = (panel, extra) => Object.assign({ view: 'robotics', panel: panel, shown: true }, extra);
  assert.deepEqual(rowsOf([row('leadership')], without(clean(), 'p1').filter(doc => doc._id !== 'p2')), ['rotation-nothing-to-show']);
  assert.deepEqual(rowsOf([row('sponsor-feature')], without(clean(), 'sp1')), ['rotation-nothing-to-show']);
  assert.deepEqual(rowsOf([row('photo')], without(without(clean(), 'ph1'), 'ph2')), ['rotation-nothing-to-show']);
  assert.deepEqual(rowsOf([row('spotlight')], change('s1', { spotlight: false })), ['rotation-nothing-to-show']);
  assert.deepEqual(rowsOf([row('custom')], without(clean(), 'c1')), ['rotation-nothing-to-show']);
  assert.deepEqual(rowsOf([row('monday-department', { department: 'build', list: 'open' })], clean(), []), ['rotation-nothing-to-show']);
  assert.deepEqual(rowsOf([row('monday-charts', { chart: 'timeline' })], clean(), [{ team: null, department: 'build', list: 'open', status: 'working' }]), ['rotation-nothing-to-show']);
  assert.deepEqual(rowsOf([row('leadership', { view: 'nova' })], without(without(clean(), 'team-nova'), 'zz')), ['rotation-no-team']);
  assert.deepEqual(rowsOf([row('leadership', { view: 'nova' })], change('p1', { teamCode: 'prime' }).filter(doc => doc._id !== 'p2')), ['rotation-nothing-to-show'], 'a person for Prime only is nothing for the Nova view');
  assert.deepEqual(rowsOf([row('leadership', { side: 'sponsor-logo' })], change('sp1', { logoAddress: '' })), ['rotation-side-empty']);
  assert.deepEqual(rowsOf([row('leadership')], change('p1', { expires: '2026-01-01T00:00:00Z' }).map(doc => (doc._id === 'p2' ? Object.assign({}, doc, { show: false }) : doc))), ['rotation-nothing-to-show'], 'hidden and expired people do not count');
  assert.deepEqual(rowsOf([row('tonight')], []), [], 'the Daily Agenda also fills with talks, so it is not judged');
});

test('two panels with the same topic, a repeated row, a retired panel and an unknown panel are found', () => {
  const row = (panel, extra) => Object.assign({ view: 'robotics', panel: panel, shown: true }, extra);
  assert.deepEqual(rowsOf([row('events', { side: 'next-event' })]), ['rotation-same-topic']);
  assert.deepEqual(rowsOf([row('tasks', { side: 'task-counts' })]), ['rotation-same-topic']);
  assert.deepEqual(rowsOf([row('sponsor-feature', { side: 'sponsor-logo' })]), ['rotation-same-topic']);
  assert.deepEqual(rowsOf([row('events', { side: 'forecast' })]), []);
  assert.deepEqual(rowsOf([row('leadership'), row('leadership')]), ['rotation-repeat']);
  assert.deepEqual(rowsOf([row('leadership'), row('sponsor-feature'), row('leadership')]), [], 'the same row after other rows is the usual loop');
  assert.deepEqual(rowsOf([row('monday-tasks')]), ['rotation-retired']);
  assert.deepEqual(rowsOf([row('no-such-panel')]), ['rotation-unknown-panel']);
  assert.deepEqual(rowsOf([row('roster', { department: 'build', side: 'forecast' })]), ['rotation-side-unused']);
  assert.deepEqual(rowsOf([row('leadership', { seconds: 3 })]), ['rotation-seconds']);
  assert.deepEqual(rowsOf([row('leadership', { shown: false }), row('events', { shown: false })]), ['rotation-all-hidden']);
  assert.deepEqual(rowsOf([row('leadership', { shown: false }), row('events')]), []);
});

test('the findings of the rotation name the row and point at Dashboard Settings', () => {
  const docs = settingsWith([{ view: 'robotics', panel: 'events', side: 'next-event', shown: true }]);
  const found = run(docs).filter(item => item.area === 'Rotation');
  assert.equal(found.length, 1);
  assert.match(found[0].message, /^Row 1 \(Upcoming events\)/);
  assert.equal(found[0].doc.id, 'dashboardSettings');
  assert.equal(found[0].doc.type, 'dashboardSettings');
});


// The report

test('the report groups by area in the order of the sidebar, problems first, and says it in words', () => {
  const found = run(clean().concat([
    { _id: 't3', _type: 'tipOrNews', kind: 'tip', text: 'Old news', expires: '2026-09-01T00:00:00Z' },
    { _id: 't4', _type: 'tipOrNews', kind: 'tip', text: 'Mail a@b.com' },
    { _id: 'sp2', _type: 'sponsor', name: 'No Logo Co' },
  ]));
  const report = check.reportOf(found);
  assert.deepEqual(report.groups.map(group => group.area), ['Ticker', 'Sponsors']);
  assert.equal(report.groups[0].items[0].level, 'problem');
  assert.equal(report.problems, 1);
  assert.equal(report.warnings, 2);
  assert.equal(check.summaryLine(report), '1 problem and 2 warnings.');
  assert.equal(check.summaryLine(check.reportOf([])), 'Nothing to fix. Every check passed.');
  const text = check.reportText(report);
  assert.match(text, /^1 problem and 2 warnings\./);
  assert.match(text, /TICKER\nPROBLEM Mail a@b\.com/);
  assert.match(text, /Fix: /);
  check.areas.forEach(area => assert.ok(typeof area === 'string'));
  found.forEach(item => assert.ok(item.message && item.fix && item.area && item.code && item.doc.id, JSON.stringify(item)));
});

test('checkAnswer takes the answer of contentQuestion', () => {
  const answer = { documents: clean().concat([{ _id: 'drafts.t8', _type: 'tipOrNews', text: 'Mail a@b.com' }]), tasks: cleanTasks };
  assert.deepEqual(codesOf(check.checkAnswer(answer, now)), ['public-contact']);
  assert.deepEqual(check.checkAnswer(null, now), []);
  assert.deepEqual(check.checkAnswer({ documents: [{ nonsense: true }, null], tasks: null }, now), []);
  assert.match(check.contentQuestion, /_type in \[/);
  assert.match(check.contentQuestion, /asset->/);
});


// The warnings while typing

function constraints(field) {
  if (!field.validation) return [];
  const make = list => {
    const rule = { list: list };
    ['required', 'min', 'max', 'length', 'integer', 'positive', 'regex', 'uri', 'email', 'custom', 'unique', 'valid', 'error', 'warning', 'info'].forEach(name => {
      rule[name] = (...args) => make(list.concat([{ name: name, args: args }]));
    });
    return rule;
  };
  const result = field.validation(make([]));
  return (Array.isArray(result) ? result : [result]).reduce((all, rule) => all.concat(rule.list), []);
}

// The function of every custom rule that is marked as a warning, run on the value
function warningsOn(field, value, document) {
  const list = constraints(field);
  const messages = [];
  list.forEach((item, index) => {
    if (item.name !== 'custom' || !list.slice(index + 1).some(next => next.name === 'warning')) return;
    const answer = item.args[0](value, { document: document || {} });
    if (answer !== true) messages.push(typeof answer === 'string' ? answer : answer.message);
  });
  return messages;
}

test('the schemas warn while typing about private text, full names, tall photos and small photos', async () => {
  const studio = await openStudio();
  try {
    const type = async name => (await studio.load('schemas/' + name + '.js')).default;
    const field = (schema, name) => schema.fields.filter(item => item.name === name)[0];
    const tip = await type('tipOrNews');
    assert.equal(warningsOn(field(tip, 'text'), 'Check your battery').length, 0);
    assert.match(warningsOn(field(tip, 'text'), 'Mail pat@example.com')[0], /email address/);
    const announcement = await type('announcement');
    assert.match(warningsOn(field(announcement, 'text'), 'Visit www.team.org')[0], /web address/);
    const photo = await type('photo');
    assert.match(warningsOn(field(photo, 'caption'), 'Call 919-555-0143')[0], /phone number/);
    assert.match(warningsOn(field(photo, 'credit'), 'sam@example.com')[0], /email address/);
    assert.deepEqual(warningsOn(field(photo, 'image'), picture('image-a-2400x1600-jpg'), { fit: 'fill' }), []);
    assert.match(warningsOn(field(photo, 'image'), picture('image-a-700x450-jpg'), { fit: 'fill' })[0], /enlarges it/);
    assert.match(warningsOn(field(photo, 'image'), picture('image-a-1500x2000-jpg'), { fit: 'setting' })[0], /taller than it is wide/);
    assert.deepEqual(warningsOn(field(photo, 'image'), picture('image-a-1500x2000-jpg'), { fit: 'whole' }), []);
    const person = await type('person');
    assert.match(warningsOn(field(person, 'name'), 'Sam Smith')[0], /full name/);
    assert.equal(warningsOn(field(person, 'name'), 'Sam K.').length, 0);
    assert.match(warningsOn(field(person, 'photo'), undefined, {})[0], /silhouette/);
    assert.equal(warningsOn(field(person, 'photo'), undefined, { showPhoto: false }).length, 0);
    const subteam = await type('subteam');
    assert.match(warningsOn(field(subteam, 'lead'), 'Lee Walker')[0], /full name/);
    const sponsor = await type('sponsor');
    assert.match(warningsOn(field(sponsor, 'logoAddress'), undefined, { show: true })[0], /No logo/);
    assert.match(warningsOn(field(sponsor, 'thankYou'), 'See www.acme.com')[0], /web address/);
    const team = await type('team');
    const found = warningsOn({ validation: team.validation }, { colors: { text: '#8A8A8A', background: '#7A7A7A' } });
    assert.match(found[0], /text color on the background color/);
    assert.equal(warningsOn({ validation: team.validation }, { colors: teams[0].colors }).length, 0);
    const fields = await studio.load('schemas/fields.js');
    assert.match(warningsOn(fields.expiresField(), '2020-01-01T00:00:00Z')[0], /has passed/);
    assert.equal(warningsOn(fields.expiresField(), '2099-01-01T00:00:00Z').length, 0);
  } finally {
    studio.close();
  }
});

test('every warning is a plain sentence: no dashes, no emoji, no exclamation marks, short sentences', () => {
  const found = run(clean().concat([
    { _id: 'x1', _type: 'photo', image: picture('image-a-300x200-jpg'), credit: 'Sam Smith' },
    { _id: 'x2', _type: 'tipOrNews', text: 'Mail a@b.com, and a line that is far too long for the ticker to show' },
  ]));
  const messages = found.map(item => item.message).concat(found.map(item => item.fix), rules.colorTrouble({ text: '#8A8A8A', background: '#7A7A7A' }).map(item => item.message), Object.values(partsOfPage.words));
  messages.forEach(message => {
    assert.ok(!/[–—!]/.test(message), message);
    assert.ok(!/\p{Extended_Pictographic}/u.test(message), message);
    message.split(/(?<=[.?])\s+/).forEach(sentence => assert.ok(sentence.trim().split(/\s+/).length <= 26, 'a sentence is too long: ' + sentence));
  });
});


// The page and the sidebar

test('Check the screen is a coaches only line of the sidebar, just before Kept data', async () => {
  const studio = await openStudio();
  try {
    const structure = await studio.load('structure.js');
    const view = await studio.load('inputs/check-screen-view.js');
    const entries = structure.sidebarEntries;
    const titles = entries.map(entry => entry.title);
    const at = titles.indexOf('Check the screen');
    assert.ok(at > titles.indexOf('COACHES ONLY'), 'it is under the heading Coaches only');
    assert.equal(titles[at + 1], 'Kept data');
    assert.equal(entries[at].kind, 'component');
    assert.equal(entries[at].component, view.CheckScreenView);
    assert.equal(entries[at].id, 'checkScreen');
    assert.equal(new Set(entries.filter(entry => entry.icon).map(entry => entry.icon)).size, entries.filter(entry => entry.icon).length, 'no two lines share an icon');
    const parts = await studio.load('inputs/start-here-parts.js');
    parts.areas.forEach(area => area.feeds.forEach(line => line.forEach(title => assert.ok(titles.concat(['Views']).includes(title) || JSON.stringify(entries).includes(title), title + ' is a line of the sidebar'))));
  } finally {
    studio.close();
  }
});

test('the page lists the findings by area with the level, the fix and a link to each document, and writes nothing', async () => {
  const studio = await openStudio();
  try {
    const view = await studio.load('inputs/check-screen-view.js');
    const docs = clean().concat([
      { _id: 'drafts.t3', _type: 'tipOrNews', text: 'Mail a@b.com' },
      { _id: 'sp2', _type: 'sponsor', name: 'No Logo Co' },
    ]);
    const asked = [];
    globalThis.studioClient = {
      fetch: async (question, params, options) => {
        asked.push({ question: question, options: options });
        return { documents: docs, tasks: cleanTasks };
      },
    };
    const page = studio.mount(view.CheckScreenView);
    const tree = await page.settle();
    assert.equal(asked.length, 1);
    assert.equal(asked[0].question, check.contentQuestion);
    assert.deepEqual(asked[0].options, { perspective: 'raw' }, 'drafts are read too');
    assert.deepEqual(Object.keys(globalThis.studioClient), ['fetch'], 'the page has no way to write');

    const text = wordsIn(tree);
    assert.match(text, /Check the screen/);
    assert.match(text, /1 problem and 1 warning\./);
    const blocks = nodesWhere(tree, node => node.props && node.props['data-block']);
    assert.deepEqual(blocks.map(node => node.props['data-block']), ['Ticker', 'Sponsors']);
    assert.match(wordsIn(blocks[0]), /Problem Mail a@b\.com Draft/);
    assert.match(wordsIn(blocks[0]), /Fix: Take it out of the ticker line/);
    assert.match(wordsIn(blocks[1]), /Warning No Logo Co Published/);
    const links = nodesWhere(tree, node => node.props && node.props.intent === 'edit');
    assert.deepEqual(links.map(node => node.props.params), [{ id: 't3', type: 'tipOrNews' }, { id: 'sp2', type: 'sponsor' }]);
    assert.equal(nodesWhere(tree, node => node.type === 'input' || node.type === 'textarea').length, 0, 'the page has no field to type in');
  } finally {
    delete globalThis.studioClient;
    studio.close();
  }
});

test('the page says so when nothing is wrong, and when the content cannot be read', async () => {
  const studio = await openStudio();
  try {
    const view = await studio.load('inputs/check-screen-view.js');
    globalThis.studioClient = { fetch: async () => ({ documents: clean(), tasks: cleanTasks }) };
    let tree = await studio.mount(view.CheckScreenView).settle();
    assert.match(wordsIn(tree), /Nothing to fix\. Every check passed\./);
    assert.equal(nodesWhere(tree, node => node.props && node.props['data-block']).length, 0);

    globalThis.studioClient = { fetch: async () => { throw new Error('offline'); } };
    tree = await studio.mount(view.CheckScreenView).settle();
    assert.match(wordsIn(tree), /could not be read/);
    assert.equal(await view.readReport(globalThis.studioClient), null);
  } finally {
    delete globalThis.studioClient;
    studio.close();
  }
});

test('the page keeps the phone rules: a 16 pixel gutter, no fixed width, buttons of 44 pixels', () => {
  const text = read('studio/inputs/check-screen-view.js') + read('studio/inputs/page-styles.js');
  assert.ok(/padding: '24px 16px'/.test(text));
  (text.match(/minHeight: \d+/g) || []).forEach(found => assert.ok(Number(found.replace(/\D/g, '')) >= 44, found));
  assert.ok(!/\bwidth: [3-9]\d\d\b/.test(read('studio/inputs/check-screen-view.js')), 'no fixed width');
  assert.ok(!/<[A-Za-z]/.test(read('studio/inputs/check-screen-view.js').replace(/\/\/.*$/gm, '').replace(/'[^']*'/g, '')), 'no JSX');
});

test('the checks import nothing from the Studio, so node and the control page can run them', () => {
  ['studio/tools/content-rules.js', 'studio/tools/content-check.js', 'studio/tools/content-check-rotation.js', 'studio/schemas/limits.js'].forEach(file => {
    const imports = (read(file).match(/^import .* from '[^']+';$/gm) || []).map(line => line.match(/from '([^']+)'/)[1]);
    imports.forEach(name => assert.ok(name.startsWith('.'), file + ' imports ' + name));
    assert.ok(!/from '(sanity|react|@sanity)/.test(read(file)), file);
  });
});

test('the docs say where the page is and what the checks cover', () => {
  assert.match(read('docs/editing-content.md'), /Check the screen/);
  assert.match(read('docs/studio-map.md'), /Check the screen/);
  assert.match(read('docs/changelog.md'), /Check the screen/);
  assert.match(read('docs/coaches-guide.md'), /Check the screen/);
});

await finish();
