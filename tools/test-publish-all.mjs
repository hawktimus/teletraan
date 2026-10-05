// Tests for the logic of the Publish all tool (studio/publish-all.js): which
// drafts are listed and how they are named, the transaction that publishes one,
// the order, the reasons a document is skipped, and the summary. The plain
// functions are run for real, with a stand-in for Studio's validation and for
// the write to Sanity. The screen (studio/publish-all-tool.js) needs the
// Studio, so it is checked only by reading the source. Nothing is sent to Sanity.
//
//   node tools/test-publish-all.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const studioFolder = fileURLToPath(new URL('../studio/', import.meta.url));
const logic = await import(pathToFileURL(path.join(studioFolder, 'publish-all.js')).href);

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

// A stand-in for the Studio's schema: the title and preview of each type
const types = {
  task: {
    name: 'task',
    title: 'Tasks',
    fields: [{ name: 'title', title: 'Task name' }, { name: 'rows', title: 'Rows' }],
    preview: {
      select: { title: 'title', place: 'location.name' },
      prepare: item => ({ title: item.title || 'Task with no name', subtitle: item.place }),
    },
  },
  place: {
    name: 'place',
    title: 'Places',
    preview: { select: { title: 'name' }, prepare: item => ({ title: item.title || 'Place with no name' }) },
  },
  extraEvent: {
    name: 'extraEvent',
    title: 'Events Calendar',
    preview: { select: { title: 'title' }, prepare: item => ({ title: item.title || 'Event with no name' }) },
  },
  dashboardSettings: { name: 'dashboardSettings', title: 'Dashboard Settings', preview: { prepare: () => ({ title: 'Dashboard Settings' }) } },
  theme: { name: 'theme', title: 'Theme' },
  note: { name: 'note', title: 'Notes' },
  broken: {
    name: 'broken',
    title: 'Broken',
    preview: {
      select: { title: 'name' },
      prepare: () => {
        throw new Error('this preview cannot read the document');
      },
    },
  },
};
const schema = { get: name => types[name] };
const singletonIds = { dashboardSettings: 'dashboardSettings', theme: 'theme' };

function draft(type, id, fields) {
  return Object.assign({ _id: 'drafts.' + id, _type: type, _rev: 'rev-' + id, _createdAt: '2026-01-01T00:00:00Z', _updatedAt: '2026-02-02T00:00:00Z' }, fields);
}

function listFor(documents) {
  return logic.chooseDrafts(documents, schema, singletonIds);
}

function itemFor(document) {
  return listFor([document])[0];
}

// Stand-ins for what the tool gives publishSelected. The check says 'error' for
// the ids it is told to fail, and every write is written down.
function makeHelpers(options) {
  const settings = options || {};
  const calls = { validated: [], committed: [], progress: [] };
  const helpers = {
    validate: async item => {
      calls.validated.push(item.id);
      if (settings.validationThrows === item.id) throw new Error('the check could not run');
      return (settings.markers || {})[item.id] || [];
    },
    commit: async mutations => {
      calls.committed.push(mutations);
      const id = mutations[mutations.length - 1].delete.id;
      if (settings.commitFails === id) throw new Error('Mutation failed: not allowed');
    },
    onProgress: (number, total, item) => calls.progress.push([number, total, item.id]),
  };
  return { helpers: helpers, calls: calls };
}

// Ids

test('a draft id starts with drafts. and the published id is the same without it', () => {
  assert.equal(logic.isDraftId('drafts.abc'), true);
  assert.equal(logic.isDraftId('abc'), false);
  assert.equal(logic.isDraftId('versions.r1.abc'), false);
  assert.equal(logic.isDraftId(undefined), false);
  assert.equal(logic.publishedIdOf('drafts.abc'), 'abc');
  assert.equal(logic.publishedIdOf('drafts.dashboardSettings'), 'dashboardSettings');
  assert.equal(logic.publishedIdOf('abc'), 'abc');
});

test('the query asks for drafts and nothing else', () => {
  assert.equal(logic.draftQuery, '*[_id in path("drafts.**")]');
});

// The list

test('the list has every draft, with its type title and its own title, sorted', () => {
  const list = listFor([
    draft('task', 't2', { title: 'Wire the robot' }),
    draft('extraEvent', 'e1', { title: 'Spring dinner' }),
    draft('task', 't1', { title: 'Charge batteries' }),
    draft('place', 'p1', { name: 'Classroom' }),
  ]);
  assert.deepEqual(
    list.map(item => item.typeTitle + ' / ' + item.title),
    ['Events Calendar / Spring dinner', 'Places / Classroom', 'Tasks / Charge batteries', 'Tasks / Wire the robot']
  );
  assert.deepEqual(list.map(item => item.publishedId), ['e1', 'p1', 't1', 't2']);
  assert.ok(list.every(item => item.problem === ''));
});

test('only drafts are listed', () => {
  const list = listFor([
    { _id: 'published-one', _type: 'task', title: 'Not a draft' },
    draft('task', 'a', { title: 'A draft' }),
    { _id: 'versions.r1.abc', _type: 'task', title: 'A version' },
    { _id: 'drafts.no-type', title: 'No type' },
    null,
  ]);
  assert.deepEqual(list.map(item => item.id), ['drafts.a']);
});

test('no drafts gives an empty list', () => {
  assert.deepEqual(listFor([]), []);
});

test('a title comes from the type preview, so an empty document still has a plain title', () => {
  assert.equal(itemFor(draft('task', 'a', {})).title, 'Task with no name');
  assert.equal(itemFor(draft('task', 'a', { title: '  Wire the robot  ' })).title, 'Wire the robot');
  assert.equal(itemFor(draft('dashboardSettings', 'dashboardSettings', {})).title, 'Dashboard Settings');
  // a select can follow a path, and a reference has no name in it
  assert.equal(itemFor(draft('task', 'a', { title: 'X', location: { _type: 'reference', _ref: 'p1' } })).title, 'X');
});

test('a type with no preview uses the first useful field, then the name of the type', () => {
  assert.equal(itemFor(draft('note', 'a', { text: 'Remember the pizza', name: 'Second' })).title, 'Second');
  assert.equal(itemFor(draft('note', 'a', { headline: 'Big news', text: 'Small' })).title, 'Big news');
  assert.equal(itemFor(draft('note', 'a', {})).title, 'Notes');
  assert.equal(itemFor(draft('theme', 'theme', {})).title, 'Theme');
});

test('a preview that fails does not stop the list', () => {
  assert.equal(itemFor(draft('broken', 'a', { name: 'Fallback name' })).title, 'Fallback name');
});

test('a type this Studio does not have is listed and marked, and the type name stands in for its title', () => {
  const item = itemFor(draft('mystery', 'a', { title: 'Odd one' }));
  assert.equal(item.typeTitle, 'mystery');
  assert.equal(item.title, 'Odd one');
  assert.match(item.problem, /no content type called "mystery"/);
});

test('a page that exists once is published to its fixed id, and a draft with another id is marked', () => {
  const right = itemFor(draft('dashboardSettings', 'dashboardSettings', {}));
  assert.equal(right.id, 'drafts.dashboardSettings');
  assert.equal(right.publishedId, 'dashboardSettings');
  assert.equal(right.problem, '');

  const wrong = itemFor(draft('theme', 'copy-of-theme', {}));
  assert.match(wrong.problem, /exists once, with the id "theme"/);
});

test('a document is named once when its title is its type', () => {
  assert.equal(logic.labelOf({ typeTitle: 'Tasks', title: 'Wire the robot' }), 'Tasks: Wire the robot');
  assert.equal(logic.labelOf({ typeTitle: 'Theme', title: 'Theme' }), 'Theme');
});

// The boxes

test('every box starts ticked, and tick all and untick all do what they say', () => {
  const list = listFor([draft('task', 'a', { title: 'A' }), draft('task', 'b', { title: 'B' })]);
  const ticked = logic.pickAll(list, true);
  assert.deepEqual(ticked, { 'drafts.a': true, 'drafts.b': true });
  assert.equal(logic.pickedItems(list, ticked).length, 2);
  assert.equal(logic.pickedItems(list, logic.pickAll(list, false)).length, 0);
  assert.equal(logic.pickedItems(list, { 'drafts.a': true, 'drafts.b': false })[0].id, 'drafts.a');
});

test('after the list is loaded again a box keeps its state, a new draft is ticked, and a gone draft is dropped', () => {
  const list = listFor([draft('task', 'a', { title: 'A' }), draft('task', 'c', { title: 'C' })]);
  const picked = logic.pickedAfterReload(list, { 'drafts.a': false, 'drafts.b': true });
  assert.deepEqual(picked, { 'drafts.a': false, 'drafts.c': true });
});

// The transaction

test('publishing a draft is one transaction: lock the draft, write the published copy, delete the draft', () => {
  const item = itemFor(draft('task', 'abc', { title: 'Wire the robot', order: 2 }));
  const mutations = logic.publishMutations(item);

  assert.equal(mutations.length, 3);
  assert.deepEqual(mutations[0], { patch: { id: 'drafts.abc', ifRevisionID: 'rev-abc', unset: ['_revision_lock_pseudo_field_'] } });
  assert.deepEqual(mutations[1], {
    createOrReplace: { _id: 'abc', _type: 'task', _createdAt: '2026-01-01T00:00:00Z', title: 'Wire the robot', order: 2 },
  });
  assert.deepEqual(mutations[2], { delete: { id: 'drafts.abc' } });
});

test('the copy has no revision or updated time of the draft, and the draft is not changed', () => {
  const doc = draft('task', 'abc', { title: 'Wire the robot' });
  const before = JSON.stringify(doc);
  const copy = logic.publishMutations(itemFor(doc))[1].createOrReplace;
  assert.equal('_rev' in copy, false);
  assert.equal('_updatedAt' in copy, false);
  assert.equal(JSON.stringify(doc), before);
});

test('a page that exists once is written to its fixed id', () => {
  const mutations = logic.publishMutations(itemFor(draft('dashboardSettings', 'dashboardSettings', { motion: 'calm' })));
  assert.equal(mutations[1].createOrReplace._id, 'dashboardSettings');
  assert.deepEqual(mutations[2], { delete: { id: 'drafts.dashboardSettings' } });
});

test('the only thing deleted is the draft that is being published', () => {
  ['a', 'b', 'c'].forEach(id => {
    const mutations = logic.publishMutations(itemFor(draft('task', id, { title: id })));
    const deletes = mutations.filter(mutation => 'delete' in mutation);
    assert.deepEqual(deletes, [{ delete: { id: 'drafts.' + id } }]);
    assert.equal(mutations.filter(mutation => 'createOrReplace' in mutation).length, 1);
  });
});

test('something that is not a draft is never published or deleted', () => {
  const published = { id: 'abc', publishedId: 'abc', doc: { _id: 'abc', _type: 'task' } };
  assert.throws(() => logic.publishMutations(published), /not one/);
  const odd = { id: 'drafts.abc', publishedId: 'drafts.abc', doc: { _id: 'drafts.abc', _type: 'task' } };
  assert.throws(() => logic.publishMutations(odd), /not one/);
});

test('a reference made with Create new is made an ordinary reference, as the Publish button does', () => {
  const doc = draft('task', 'abc', {
    title: 'Wire the robot',
    location: { _type: 'reference', _ref: 'p1', _weak: true, _strengthenOnPublish: { type: 'place', template: { id: 'place' } } },
    other: { _type: 'reference', _ref: 'p2', _weak: true },
    kept: { _type: 'reference', _ref: 'p3', _weak: true, _strengthenOnPublish: { type: 'place', weak: true } },
  });
  const copy = logic.publishMutations(itemFor(doc))[1].createOrReplace;
  assert.deepEqual(copy.location, { _type: 'reference', _ref: 'p1' });
  assert.deepEqual(copy.other, { _type: 'reference', _ref: 'p2', _weak: true });
  assert.deepEqual(copy.kept, { _type: 'reference', _ref: 'p3', _weak: true });
  // the draft still has what it had
  assert.ok(doc.location._strengthenOnPublish);
});

test('without a revision there is no lock step, and the other two steps stay', () => {
  const doc = draft('task', 'abc', { title: 'X' });
  delete doc._rev;
  const mutations = logic.publishMutations(itemFor(doc));
  assert.deepEqual(mutations.map(mutation => Object.keys(mutation)[0]), ['createOrReplace', 'delete']);
});

// The order

test('a document that others point at is published before them', () => {
  const task = draft('task', 't1', { title: 'Wire', location: { _type: 'reference', _ref: 'p1' } });
  const place = draft('place', 'p1', { name: 'Classroom' });
  const other = draft('extraEvent', 'e1', { title: 'Dinner' });
  const ordered = logic.orderForPublishing(listFor([task, place, other]));
  const ids = ordered.map(item => item.publishedId);
  assert.ok(ids.indexOf('p1') < ids.indexOf('t1'), ids.join());
  assert.equal(ids.length, 3);
});

test('the order of documents that do not point at each other is kept, and a loop does not hang', () => {
  const list = listFor([draft('task', 'b', { title: 'B' }), draft('task', 'a', { title: 'A' })]);
  const names = logic.orderForPublishing(list).map(item => item.title);
  assert.deepEqual(names, list.map(item => item.title));

  const one = draft('task', 'one', { title: 'One', next: { _ref: 'two' } });
  const two = draft('task', 'two', { title: 'Two', next: { _ref: 'one' } });
  assert.equal(logic.orderForPublishing(listFor([one, two])).length, 2);
});

// The reasons

test('only errors stop a document, and each reason says where', () => {
  const doc = draft('task', 'a', { title: 'Far too long a name', rows: [{ _key: 'k1', time: 'x' }, { _key: 'k2', time: 'y' }] });
  const markers = [
    { level: 'error', path: ['title'], message: 'Up to 22 characters fit.' },
    { level: 'error', path: ['rows', { _key: 'k2' }, 'time'], message: 'Too long.' },
    { level: 'error', path: [], message: 'The document is wrong.' },
    { level: 'warning', path: ['title'], message: 'Only a warning.' },
    { level: 'info', path: ['title'], message: 'Only a note.' },
  ];
  assert.deepEqual(logic.reasonsFor(markers, doc, types.task), [
    'Task name: Up to 22 characters fit.',
    'Rows, item 2, time: Too long.',
    'The document is wrong.',
  ]);
  assert.deepEqual(logic.reasonsFor([{ level: 'warning', path: [], message: 'Hm.' }], doc, types.task), []);
  assert.deepEqual(logic.reasonsFor(undefined, doc, types.task), []);
});

// Publishing

test('a document that would fail is skipped with its reasons, and the others are published', async () => {
  const list = listFor([draft('task', 'good', { title: 'Good' }), draft('task', 'bad', { title: 'Bad' }), draft('place', 'fine', { name: 'Classroom' })]);
  const { helpers, calls } = makeHelpers({ markers: { 'drafts.bad': [{ level: 'error', path: ['title'], message: 'Give the task a name.' }] } });

  const results = await logic.publishSelected(list, helpers);
  const byId = {};
  results.forEach(result => {
    byId[result.item.id] = result;
  });

  assert.equal(byId['drafts.good'].status, 'published');
  assert.equal(byId['drafts.fine'].status, 'published');
  assert.equal(byId['drafts.bad'].status, 'skipped');
  assert.deepEqual(byId['drafts.bad'].reasons, ['Task name: Give the task a name.']);

  // everything was checked, and only the two that passed were written
  assert.equal(calls.validated.length, 3);
  assert.equal(calls.committed.length, 2);
  const deleted = calls.committed.map(mutations => mutations[mutations.length - 1].delete.id).sort();
  assert.deepEqual(deleted, ['drafts.fine', 'drafts.good']);
});

test('each document is its own transaction of exactly three steps', async () => {
  const list = listFor([draft('task', 'a', { title: 'A' }), draft('task', 'b', { title: 'B' })]);
  const { helpers, calls } = makeHelpers();
  await logic.publishSelected(list, helpers);
  assert.equal(calls.committed.length, 2);
  calls.committed.forEach(mutations => assert.equal(mutations.length, 3));
});

test('a failed write is reported, and the documents after it are still published', async () => {
  const list = listFor([draft('task', 'a', { title: 'A' }), draft('task', 'b', { title: 'B' }), draft('task', 'c', { title: 'C' })]);
  const { helpers, calls } = makeHelpers({ commitFails: 'drafts.b' });

  const results = await logic.publishSelected(list, helpers);
  assert.deepEqual(results.map(result => result.status), ['published', 'failed', 'published']);
  assert.match(results[1].error, /not allowed/);
  assert.equal(calls.committed.length, 3);
});

test('a check that cannot run is a failure, not a pass, and nothing is written for it', async () => {
  const list = listFor([draft('task', 'a', { title: 'A' }), draft('task', 'b', { title: 'B' })]);
  const { helpers, calls } = makeHelpers({ validationThrows: 'drafts.a' });

  const results = await logic.publishSelected(list, helpers);
  assert.equal(results[0].status, 'failed');
  assert.match(results[0].error, /could not be checked/);
  assert.equal(results[1].status, 'published');
  assert.equal(calls.committed.length, 1);
});

test('a draft changed after the list was loaded gets a plain explanation', async () => {
  const list = listFor([draft('task', 'a', { title: 'A' })]);
  const { helpers } = makeHelpers();
  helpers.commit = async () => {
    throw new Error('Mutation failed: Document revision ID mismatch');
  };
  const results = await logic.publishSelected(list, helpers);
  assert.equal(results[0].status, 'failed');
  assert.match(results[0].error, /changed after this list was loaded/);
  assert.match(results[0].error, /revision ID mismatch/);
});

test('a document marked as impossible is skipped without being checked or written', async () => {
  const list = listFor([draft('mystery', 'a', { title: 'Odd' }), draft('theme', 'copy', {})]);
  const { helpers, calls } = makeHelpers();
  const results = await logic.publishSelected(list, helpers);
  assert.deepEqual(results.map(result => result.status), ['skipped', 'skipped']);
  assert.equal(calls.validated.length, 0);
  assert.equal(calls.committed.length, 0);
});

test('a place that is new is published before the task that uses it, and the task is checked after that', async () => {
  const list = listFor([
    draft('task', 't1', { title: 'Wire', location: { _type: 'reference', _ref: 'p1' } }),
    draft('place', 'p1', { name: 'Classroom' }),
  ]);
  const { helpers, calls } = makeHelpers();
  const order = [];
  const validate = helpers.validate;
  const commit = helpers.commit;
  helpers.validate = item => {
    order.push('check ' + item.publishedId);
    return validate(item);
  };
  helpers.commit = mutations => {
    order.push('write ' + mutations[1].createOrReplace._id);
    return commit(mutations);
  };

  await logic.publishSelected(list, helpers);
  assert.deepEqual(order, ['check p1', 'write p1', 'check t1', 'write t1']);
  assert.deepEqual(calls.progress, [[1, 2, 'drafts.p1'], [2, 2, 'drafts.t1']]);
});

test('with nothing selected nothing is checked or written', async () => {
  const { helpers, calls } = makeHelpers();
  assert.deepEqual(await logic.publishSelected([], helpers), []);
  assert.equal(calls.validated.length + calls.committed.length, 0);
});

// The summary

test('the summary lists what was published, skipped with reasons, and failed with the error', async () => {
  const list = listFor([
    draft('task', 'ok', { title: 'Fine' }),
    draft('task', 'bad', { title: 'Bad' }),
    draft('extraEvent', 'sad', { title: 'Sad' }),
    draft('dashboardSettings', 'dashboardSettings', {}),
  ]);
  const { helpers } = makeHelpers({
    markers: { 'drafts.bad': [{ level: 'error', path: ['title'], message: 'Give the task a name.' }] },
    commitFails: 'drafts.sad',
  });

  const summary = logic.buildSummary(await logic.publishSelected(list, helpers));
  assert.deepEqual(summary.published.map(line => line.label).sort(), ['Dashboard Settings', 'Tasks: Fine']);
  assert.equal(summary.skipped.length, 1);
  assert.equal(summary.skipped[0].label, 'Tasks: Bad');
  assert.deepEqual(summary.skipped[0].reasons, ['Task name: Give the task a name.']);
  assert.equal(summary.failed.length, 1);
  assert.equal(summary.failed[0].label, 'Events Calendar: Sad');
  assert.match(summary.failed[0].error, /not allowed/);
  assert.equal(summary.headline, 'Published 2 of 4 documents. 1 skipped. 1 failed.');
});

test('the headline counts in plain words', () => {
  const item = { id: 'drafts.a', typeTitle: 'Tasks', title: 'A' };
  assert.equal(logic.buildSummary([]).headline, 'Nothing was selected.');
  assert.equal(logic.buildSummary([{ item: item, status: 'published' }]).headline, 'Published 1 of 1 document.');
  assert.equal(logic.buildSummary([{ item: item, status: 'published' }, { item: item, status: 'published' }]).headline, 'Published 2 of 2 documents.');
  assert.equal(logic.buildSummary([{ item: item, status: 'skipped', reasons: ['x'] }]).headline, 'Published 0 of 1 document. 1 skipped.');
});

// The files

test('the logic file imports nothing, so node can run it, and the tool file is plain functions without JSX', () => {
  const logicSource = fs.readFileSync(path.join(studioFolder, 'publish-all.js'), 'utf8');
  assert.equal(/^import /m.test(logicSource), false, 'publish-all.js should not import anything');

  const toolSource = fs.readFileSync(path.join(studioFolder, 'publish-all-tool.js'), 'utf8');
  const imported = (toolSource.match(/^import[\s\S]*?from '([^']+)';$/gm) || []).map(line => line.match(/from '([^']+)'/)[1]);
  assert.deepEqual(imported.sort(), ['./publish-all.js', './structure.js', 'react', 'sanity']);
  const code = toolSource.replace(/\/\/.*$/gm, '').replace(/'[^'\n]*'/g, "''");
  assert.equal(/<\/?[A-Za-z][A-Za-z0-9.]*(\s[^<>]*)?\/?>/.test(code), false, 'publish-all-tool.js should have no JSX');
});

test('the tool uses the Studio validation and one call for each document, and deletes through the logic file only', () => {
  const toolSource = fs.readFileSync(path.join(studioFolder, 'publish-all-tool.js'), 'utf8');
  assert.ok(toolSource.includes('validateDocument('), 'it should call the Studio validation');
  assert.ok(toolSource.includes('client.mutate(mutations)'), 'it should send each list of changes as one transaction');
  assert.equal(/\.delete\(|\.createOrReplace\(|\.transaction\(/.test(toolSource), false, 'writes are built in publish-all.js');
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
