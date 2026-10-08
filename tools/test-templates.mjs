// Tests for the CSV templates and the importer: studio/scripts/make-templates.mjs
// writes docs/content-templates/ from the schemas, and studio/scripts/import-csv.mjs
// turns filled-in copies into a file for `sanity dataset import`. Nothing is
// sent to Sanity.
//
//   node tools/test-templates.mjs

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const templateFolder = path.join(root, 'docs', 'content-templates');
const importerFile = path.join(root, 'studio', 'scripts', 'import-csv.mjs');
const { loadSchemas, makeTemplates, csvCell } = await import(pathToFileURL(path.join(root, 'studio', 'scripts', 'make-templates.mjs')).href);

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const knownTypes = ['task', 'plan', 'extraEvent', 'sponsor', 'tipOrNews', 'subteam', 'place', 'person', 'customPanel'];
const { types, singletons } = await loadSchemas();
const templates = makeTemplates(types, singletons);

// The three rows of a template, as lists of cells. A template has no quotes or
// commas inside a cell, so a plain split is enough.
function rowsOf(csvText) {
  return csvText.trim().split('\n').map(line => line.split(','));
}

// A CSV for one type: the header and limits of the real template, then the rows
// given as { column: value }. A column left out of a row is empty.
function csvFor(type, rows) {
  const top = rowsOf(templates[type]);
  const body = rows.map(row => top[0].map(name => row[name] || ''));
  return [top[0], top[1]].concat(body).map(cells => cells.map(csvCell).join(',')).join('\n') + '\n';
}

// Runs the importer on these files in a new folder. Gives the exit code, what it
// said and the documents it wrote (null if it wrote nothing).
function runImporter(files) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-import-'));
  try {
    Object.keys(files).forEach(name => fs.writeFileSync(path.join(folder, name), files[name]));
    const run = spawnSync(process.execPath, [importerFile, folder], { cwd: folder, encoding: 'utf8' });
    const out = path.join(folder, 'import.ndjson');
    const text = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
    return {
      status: run.status,
      message: run.stdout + run.stderr,
      text: text,
      docs: text === null ? null : text.trim().split('\n').map(line => JSON.parse(line)),
    };
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

const subteamRow = { name: 'Alpha', lead: 'Lead', show: 'yes' };
const taskRow = { title: 'Wire the robot', subteam: 'Alpha', status: 'in-progress', order: '2', show: 'yes' };

// Templates

test('the files in docs/content-templates are what the schemas give', () => {
  knownTypes.forEach(type => {
    assert.equal(fs.readFileSync(path.join(templateFolder, type + '.csv'), 'utf8'), templates[type], type + '.csv is out of date: run node scripts/make-templates.mjs in studio');
  });
  const files = fs.readdirSync(templateFolder).filter(name => name.endsWith('.csv')).sort();
  assert.deepEqual(files, Object.keys(templates).map(type => type + '.csv').sort());
});

test('there is a template for every kind of content, and none for photos, meeting days, presentations, calendar filters or the settings pages', () => {
  const noTemplate = ['photo', 'presentationDay', 'presentation', 'calendarFilter'];
  const documents = types.filter(type => type.type === 'document' && singletons.indexOf(type.name) === -1 && noTemplate.indexOf(type.name) === -1);
  assert.deepEqual(Object.keys(templates).sort(), documents.map(type => type.name).sort());
  knownTypes.forEach(type => assert.ok(templates[type], 'no template for ' + type));
  noTemplate.concat(['dashboardSettings', 'theme', 'demo']).forEach(type => assert.equal(templates[type], undefined, type));
});

test('a type named photo and the pages that exist once are skipped', () => {
  const fake = name => ({ name: name, type: 'document', fields: [{ name: 'title', type: 'string' }] });
  const result = makeTemplates([fake('photo'), fake('settingsPage'), types.filter(type => type.name === 'tipOrNews')[0]], ['settingsPage']);
  assert.deepEqual(Object.keys(result), ['tipOrNews']);
});

test('row 1 names the columns, row 2 gives the type and the limits, row 3 is the EXAMPLE row', () => {
  Object.keys(templates).forEach(type => {
    const rows = rowsOf(templates[type]);
    assert.equal(rows.length, 3, type);
    assert.ok(rows.every(row => row.length === rows[0].length), type + ': every row needs the same number of cells');
    assert.equal(rows[0][0], 'example', type);
    assert.equal(rows[1][0], 'type ' + type, type);
    assert.equal(rows[2][0], 'EXAMPLE', type);
  });
  const task = rowsOf(templates.task);
  // contact and location were added later, so they are the last two columns
  assert.deepEqual(task[0], ['example', 'title', 'subteam', 'status', 'finishedOn', 'order', 'show', 'expires', 'contact', 'location']);
  assert.equal(task[1][1], 'text; required; max 22; id 1');
  assert.equal(task[1][2], 'name of subteam');
  assert.equal(task[1][3], 'one of blocked/in-progress/up-next/done; required');
  assert.equal(task[1][5], 'whole number');
  assert.equal(task[1][8], 'text; max 12');
  assert.equal(task[1][9], 'name of place');

  const place = rowsOf(templates.place);
  assert.deepEqual(place[0], ['example', 'name', 'show']);
  assert.equal(place[1][1], 'text; required; max 16; id 1');
});

test('plan rows and custom panel blocks are numbered groups, as many as the schema allows', () => {
  const plan = rowsOf(templates.plan)[0];
  assert.ok(plan.includes('rows.1.time') && plan.includes('rows.5.lead'));
  assert.ok(!plan.includes('rows.6.time'));
  const panel = rowsOf(templates.customPanel);
  assert.ok(panel[0].includes('blocks.6._type') && !panel[0].includes('blocks.7._type'));
  const heading = panel[1][panel[0].indexOf('blocks.1.text')];
  assert.ok(heading.includes('max 30 if headingBlock') && heading.includes('max 100 if textBlock'));
});

test('a picture field is left out of the template', () => {
  assert.ok(!rowsOf(templates.person)[0].includes('photo'));
  assert.ok(rowsOf(templates.person)[0].includes('showPhoto'));
});

test('the sample rows make a document each when the EXAMPLE mark is taken off', () => {
  const files = {};
  Object.keys(templates).forEach(type => { files[type + '.csv'] = templates[type].replace('\nEXAMPLE,', '\nsample,'); });
  const result = runImporter(files);
  assert.equal(result.status, 0, result.message);
  assert.equal(result.docs.length, Object.keys(templates).length);
  const task = result.docs.filter(doc => doc._type === 'task')[0];
  assert.deepEqual(task.subteam, { _type: 'reference', _ref: 'subteam-subteam-a' });
  assert.equal(task.expires, new Date('2027-03-01T18:00').toISOString());
  assert.equal(task.show, true);
  assert.equal(task.order, 1);
  assert.equal(task.contact, '[First name]');
  assert.deepEqual(task.location, { _type: 'reference', _ref: 'place-place-name' });
});

test('the limits in row 2 are kept: every text column takes its limit and refuses one more', () => {
  let checked = 0;
  Object.keys(templates).forEach(type => {
    const rows = rowsOf(templates[type]);
    const example = {};
    rows[0].forEach((name, index) => { if (index > 0 && rows[2][index]) example[name] = rows[2][index]; });

    rows[0].forEach((name, index) => {
      const limit = /^text; (required; )?max (\d+)/.exec(rows[1][index]);
      const group = name.split('.').slice(0, 2).join('.') + '.';
      const groupUsed = !name.includes('.') || rows[0].some((other, at) => other.startsWith(group) && rows[2][at]);
      if (!limit || !groupUsed) return;
      const fits = csvFor(type, [Object.assign({}, example, { [name]: 'x'.repeat(Number(limit[2])) })]);
      const tooLong = csvFor(type, [Object.assign({}, example, { [name]: 'x'.repeat(Number(limit[2]) + 1) })]);
      const other = type === 'task' ? { 'subteam.csv': csvFor('subteam', [{ name: '[Subteam A]', show: 'yes' }]), 'place.csv': csvFor('place', [{ name: '[Place name]', show: 'yes' }]) } : {};

      assert.equal(runImporter(Object.assign({ [type + '.csv']: fits }, other)).status, 0, type + '.' + name + ' at its limit');
      const refused = runImporter(Object.assign({ [type + '.csv']: tooLong }, other));
      assert.equal(refused.status, 1, type + '.' + name + ' over its limit');
      assert.ok(refused.message.includes(type + '.csv, row 3, column ' + name + ':'), refused.message);
      checked += 1;
    });
  });
  assert.ok(checked > 15, 'only ' + checked + ' limits were checked');
});

// The importer

test('a few rows become documents with fixed ids, and a second run gives the same file', () => {
  const files = {
    'subteam.csv': csvFor('subteam', [subteamRow, { name: 'Béta Crew', show: 'no' }]),
    'task.csv': csvFor('task', [taskRow, { title: 'Done: wheels', status: 'done', finishedOn: '2027-02-03 16:30' }]),
  };
  const first = runImporter(files), second = runImporter(files);
  assert.equal(first.status, 0, first.message);
  assert.equal(first.text, second.text);
  assert.deepEqual(first.docs.map(doc => doc._id), ['subteam-alpha', 'subteam-beta-crew', 'task-wire-the-robot', 'task-done-wheels']);
  assert.deepEqual(first.docs[0], { _id: 'subteam-alpha', _type: 'subteam', name: 'Alpha', lead: 'Lead', spotlight: false, show: true });
  assert.equal(first.docs[1].show, false);
  assert.deepEqual(first.docs[2], {
    _id: 'task-wire-the-robot', _type: 'task', title: 'Wire the robot',
    subteam: { _type: 'reference', _ref: 'subteam-alpha' }, status: 'in-progress', order: 2, show: true,
  });
  assert.equal(first.docs[3].finishedOn, new Date('2027-02-03T16:30').toISOString());
});

test('an empty switch gets the value Studio gives a new item, and a needed field never does', () => {
  assert.equal(rowsOf(templates.subteam)[1][8], 'yes/no; default yes');
  const result = runImporter({ 'person.csv': csvFor('person', [{ role: 'Coach', name: 'Pat' }]) });
  assert.equal(result.status, 0, result.message);
  assert.equal(result.docs[0].show, true);
  assert.equal(result.docs[0].showPhoto, true);

  const noStatus = runImporter({ 'task.csv': csvFor('task', [{ title: 'A' }]) });
  assert.ok(noStatus.message.includes('column status: is needed'), noStatus.message);
});

test('plan rows, a list of lines and blocks of different kinds are built from their groups', () => {
  const plan = runImporter({
    'plan.csv': csvFor('plan', [{ heading: 'Build night', date: '2027-01-12', 'rows.1.time': '6:00 PM', 'rows.1.text': 'Set up', 'rows.3.text': 'Clean up' }]),
  });
  assert.equal(plan.status, 0, plan.message);
  assert.equal(plan.docs[0]._id, 'plan-2027-01-12-build-night');
  assert.deepEqual(plan.docs[0].rows.map(row => row.text), ['Set up', 'Clean up']);
  assert.equal(plan.docs[0].rows[0].time, '6:00 PM');

  const panel = runImporter({
    'customPanel.csv': csvFor('customPanel', [{
      title: 'Pit',
      'blocks.1._type': 'listBlock', 'blocks.1.items': 'one | two |  | three',
      'blocks.2._type': 'progressBlock', 'blocks.2.label': 'Bar', 'blocks.2.percent': '75',
    }]),
  });
  assert.equal(panel.status, 0, panel.message);
  assert.deepEqual(panel.docs[0].blocks, [
    { _type: 'listBlock', items: ['one', 'two', 'three'] },
    { _type: 'progressBlock', label: 'Bar', percent: 75 },
  ]);
});

test('subteam members are one cell with the names between | marks, up to 24 names of 12 characters', () => {
  assert.ok(rowsOf(templates.subteam)[0].includes('members'));
  const subteam = runImporter({ 'subteam.csv': csvFor('subteam', [{ name: 'Build', lead: 'Sam', members: 'Alex | Kim |  | Lee' }]) });
  assert.equal(subteam.status, 0, subteam.message);
  assert.deepEqual(subteam.docs[0].members, ['Alex', 'Kim', 'Lee']);

  const tooMany = runImporter({ 'subteam.csv': csvFor('subteam', [{ name: 'Build', members: Array.from({ length: 25 }, (item, index) => 'N' + String.fromCharCode(97 + index)).join('|') }]) });
  assert.ok(tooMany.message.includes('column members: 25 lines, up to 24 fit'), tooMany.message);
  const tooLong = runImporter({ 'subteam.csv': csvFor('subteam', [{ name: 'Build', members: 'Alex|' + 'x'.repeat(13) }]) });
  assert.ok(tooLong.message.includes('column members:'), tooLong.message);
});

test('the EXAMPLE row and empty rows are skipped, and a folder of untouched templates has nothing to import', () => {
  const lines = csvFor('task', [{ title: 'Real task', status: 'up-next' }, {}, { title: 'Another', status: 'up-next' }]).trim().split('\n');
  const exampleRow = templates.task.split('\n')[2];
  const result = runImporter({ 'task.csv': [lines[0], lines[1], exampleRow].concat(lines.slice(2), ['EXAMPLE,Not this one']).join('\n') + '\n' });
  assert.equal(result.status, 0, result.message);
  assert.deepEqual(result.docs.map(doc => doc.title), ['Real task', 'Another']);

  const untouched = runImporter(templates);
  assert.equal(untouched.status, 1);
  assert.equal(untouched.docs, null);
  assert.ok(untouched.message.includes('No rows to import'));
});

test('a row that breaks a limit is named by file, row and column, and nothing is written', () => {
  const result = runImporter({ 'task.csv': csvFor('task', [{ title: 'Fine', status: 'up-next' }, { title: 'This title is much too long', status: 'up-next' }]) });
  assert.equal(result.status, 1);
  assert.equal(result.docs, null);
  assert.ok(result.message.includes('task.csv, row 4, column title: 27 characters, up to 22 fit'), result.message);
  assert.ok(!result.message.includes('row 3'));
});

test('a missing required field, a wrong choice, a wrong date and a number out of range are refused', () => {
  const refuse = (type, row, text, extra) => {
    const result = runImporter(Object.assign({ [type + '.csv']: csvFor(type, [row]) }, extra || {}));
    assert.equal(result.status, 1, text);
    assert.ok(result.message.includes(text), result.message);
  };
  refuse('task', { status: 'up-next' }, 'task.csv, row 3, column title: is needed');
  refuse('task', { title: 'A', status: 'finished' }, 'column status: write one of: blocked, in-progress, up-next, done');
  refuse('task', { title: 'A', status: 'up-next', order: '1.5' }, 'column order: write a whole number');
  refuse('task', { title: 'A', status: 'up-next', expires: '3/4/2027' }, 'column expires: write a date and time such as 2027-03-04 18:30');
  refuse('task', { title: 'A', status: 'up-next', show: 'maybe' }, 'column show: write yes or no');
  refuse('extraEvent', { title: 'A', startDate: '2027-02-31' }, 'column startDate: 2027-02-31 is not a day on the calendar');
  refuse('extraEvent', { title: 'A', startDate: '2019-12-31' }, 'column startDate: 2019-12-31 is below 2020-01-01');
  refuse('extraEvent', { title: 'A', startDate: '2027-03-04', startTime: '6:30' }, 'column startTime: write a 24 hour time such as 18:30');
  refuse('sponsor', { name: 'A', logoAddress: 'logo.png' }, 'column logoAddress: write a web address starting with https://');
  refuse('customPanel', { title: 'A', 'blocks.1._type': 'progressBlock', 'blocks.1.label': 'Bar', 'blocks.1.percent': '101' }, 'column blocks.1.percent: 101 is above 100');
});

test('the rules of a group apply only when the group is used, and a block only takes the cells of its kind', () => {
  const planRow = { heading: 'H', 'rows.2.time': '7:00 PM' };
  const result = runImporter({ 'plan.csv': csvFor('plan', [planRow]) });
  assert.ok(result.message.includes('plan.csv, row 3, column rows.2.text: is needed'), result.message);
  assert.ok(!result.message.includes('rows.1'), result.message);

  const heading = { title: 'A', 'blocks.1._type': 'headingBlock', 'blocks.1.text': 'x'.repeat(31) };
  assert.ok(runImporter({ 'customPanel.csv': csvFor('customPanel', [heading]) }).message.includes('column blocks.1.text: 31 characters, up to 30 fit'));
  const text = Object.assign({}, heading, { 'blocks.1._type': 'textBlock' });
  assert.equal(runImporter({ 'customPanel.csv': csvFor('customPanel', [text]) }).status, 0);

  const stray = { title: 'A', 'blocks.1._type': 'headingBlock', 'blocks.1.text': 'Hi', 'blocks.1.value': '42' };
  assert.ok(runImporter({ 'customPanel.csv': csvFor('customPanel', [stray]) }).message.includes('column blocks.1.value: is not used by a headingBlock'));
  const noKind = { title: 'A', 'blocks.1.text': 'Hi' };
  assert.ok(runImporter({ 'customPanel.csv': csvFor('customPanel', [noKind]) }).message.includes('column blocks.1._type: is needed'));

  const lines = { title: 'A', 'blocks.1._type': 'listBlock', 'blocks.1.items': 'a|b|c|d|e|f' };
  assert.ok(runImporter({ 'customPanel.csv': csvFor('customPanel', [lines]) }).message.includes('6 lines, up to 5 fit'));
});

test('a name that points at nothing, and two rows with one id, are refused', () => {
  const lost = runImporter({ 'task.csv': csvFor('task', [taskRow]) });
  assert.ok(lost.message.includes('task.csv, row 3, column subteam: "Alpha" is not in the subteam CSV given with this one'), lost.message);

  const twice = runImporter({ 'tipOrNews.csv': csvFor('tipOrNews', [{ kind: 'tip', text: 'Same line' }, { kind: 'news', text: 'same  LINE!' }]) });
  assert.ok(twice.message.includes('tipOrNews.csv, row 4, column kind: makes the same id as tipOrNews.csv row 3'), twice.message);

  assert.ok(runImporter({ 'task.csv': 'a,b\n1,2\n' }).message.includes('row 2 should start with the type'));
});

test('a task points at a place by name, capitals ignored: the starting places are known, and so is a place CSV', () => {
  const seeded = runImporter({ 'task.csv': csvFor('task', [{ title: 'Build a frame', status: 'up-next', contact: 'Sam', location: 'programming ROOM' }]) });
  assert.equal(seeded.status, 0, seeded.message);
  assert.equal(seeded.docs[0].contact, 'Sam');
  assert.deepEqual(seeded.docs[0].location, { _type: 'reference', _ref: 'place-programming-room' });

  // the ids in the seed file are the ones the importer makes from the names
  const seedLines = fs.readFileSync(path.join(root, 'docs', 'seed', 'places.ndjson'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(seedLines.map(place => place.name), ['Classroom', 'Programming room', 'Media center']);
  seedLines.forEach(place => {
    const found = runImporter({ 'task.csv': csvFor('task', [{ title: 'A', status: 'up-next', location: place.name.toUpperCase() }]) });
    assert.equal(found.status, 0, found.message);
    assert.equal(found.docs[0].location._ref, place._id);
  });

  const made = runImporter({
    'place.csv': csvFor('place', [{ name: 'Machine shop', show: 'yes' }, { name: 'Hallway' }]),
    'task.csv': csvFor('task', [{ title: 'Drill', status: 'in-progress', location: 'machine SHOP' }, { title: 'Sweep', status: 'up-next', location: 'Classroom' }]),
  });
  assert.equal(made.status, 0, made.message);
  assert.deepEqual(made.docs.filter(doc => doc._type === 'place').map(doc => doc._id), ['place-machine-shop', 'place-hallway']);
  assert.deepEqual(made.docs.filter(doc => doc._type === 'task').map(doc => doc.location._ref), ['place-machine-shop', 'place-classroom']);

  // a task with no contact and no location makes a document with neither
  const plain = runImporter({ 'task.csv': csvFor('task', [{ title: 'Plain', status: 'up-next' }]) });
  assert.equal('contact' in plain.docs[0] || 'location' in plain.docs[0], false);
});

test('a place the script does not know is refused and the row is named', () => {
  const result = runImporter({ 'task.csv': csvFor('task', [{ title: 'Fine', status: 'up-next', location: 'Classroom' }, { title: 'Lost', status: 'up-next', location: 'The gym' }]) });
  assert.equal(result.status, 1);
  assert.equal(result.docs, null);
  assert.ok(result.message.includes('task.csv, row 4, column location: "The gym" is not a place the script knows (Classroom, Programming room, Media center)'), result.message);
  assert.ok(!result.message.includes('row 3'), result.message);

  // a contact over 12 characters is refused too
  const long = runImporter({ 'task.csv': csvFor('task', [{ title: 'A', status: 'up-next', contact: 'x'.repeat(13) }]) });
  assert.ok(long.message.includes('task.csv, row 3, column contact: 13 characters, up to 12 fit'), long.message);
});

test('a task CSV made before contact and location existed still imports', () => {
  // the template as it was, with its eight columns and no contact or location
  const old = [
    'example,title,subteam,status,finishedOn,order,show,expires',
    'type task,text; required; max 22; id 1,name of subteam,one of blocked/in-progress/up-next/done; required,datetime,whole number,yes/no; default yes,datetime',
    'EXAMPLE,[Task name],[Subteam A],in-progress,,1,yes,2027-03-01 18:00',
    ',Wire the robot,Alpha,in-progress,,2,yes,',
    ',Paint the sign,,up-next,,,,',
  ].join('\n') + '\n';
  const result = runImporter({ 'subteam.csv': csvFor('subteam', [subteamRow]), 'task.csv': old });
  assert.equal(result.status, 0, result.message);
  assert.deepEqual(result.docs.map(doc => doc._id), ['subteam-alpha', 'task-wire-the-robot', 'task-paint-the-sign']);
  assert.equal(result.docs[1].subteam._ref, 'subteam-alpha');
  assert.equal(result.docs[2].show, true);
  assert.equal(result.docs.some(doc => 'contact' in doc || 'location' in doc), false);
});

test('quotes, commas, new lines, a byte order mark and Windows line ends are read correctly', () => {
  const awkward = 'Say "hi", then\nleave';
  const sponsor = { name: 'Smith, "Jo" & Co', tier: '', blurb: awkward, show: 'yes' };
  const text = csvFor('sponsor', [sponsor]);
  assert.ok(text.includes('"Smith, ""Jo"" & Co"'));

  const plain = runImporter({ 'sponsor.csv': text });
  assert.equal(plain.status, 0, plain.message);
  assert.equal(plain.docs[0].name, 'Smith, "Jo" & Co');
  assert.equal(plain.docs[0].blurb, awkward);
  assert.equal(plain.docs[0].tier, undefined);

  const excel = runImporter({ 'sponsor.csv': '\uFEFF' + text.replace(/\n/g, '\r\n') });
  assert.equal(excel.status, 0, excel.message);
  assert.deepEqual(excel.docs[0], plain.docs[0]);

  const emptyQuoted = runImporter({ 'sponsor.csv': text.replace(',,', ',"",') });
  assert.equal(emptyQuoted.status, 0, emptyQuoted.message);
});

test('the importer is under 140 lines and uses only what node has', () => {
  const source = fs.readFileSync(importerFile, 'utf8');
  assert.ok(source.trim().split('\n').length < 140, 'import-csv.mjs has ' + source.trim().split('\n').length + ' lines');
  const imports = source.match(/^import .* from '.*';$/gm);
  assert.ok(imports.every(line => line.includes("'node:")), imports.join('\n'));
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
