// Tests for the All settings routes of the control service (control/routes/settings-doc.js, control/support/settings-doc.js): the
// spec, the list of documents, reading a document, saving changed fields to the draft with the revision check, refusing a field that
// is not in the spec, and publishing one document. A fake Sanity and a temporary data folder; nothing leaves the process.
//
//   node tests/control-settings-doc.test.mjs

import assert from 'node:assert/strict';
import * as route from '../control/routes/settings-doc.js';
import { makeWorld } from './helpers/control-world.mjs';

let passed = 0;
async function check(name, test) {
  await test();
  passed += 1;
  console.log('PASS  ' + name);
}

const published = { _id: 'dashboardSettings', _type: 'dashboardSettings', _rev: 'rev-pub', _updatedAt: '2026-10-18T10:00:00Z', pageSeconds: 25, glint: true, rotationRows: [{ _key: 'a1', view: 'prime', panel: 'tasks' }], crt: { on: true, everySeconds: 240, durationSeconds: 2.7, extra: 'kept' } };
const draft = Object.assign({}, published, { _id: 'drafts.dashboardSettings', _rev: 'rev-draft', _updatedAt: '2026-10-18T11:00:00Z', pageSeconds: 30 });
const teamPrime = { _id: 'team-prime', _type: 'team', _rev: 'rev-team', _updatedAt: '2026-10-18T10:00:00Z', name: 'HAWKTIMUS PRIME', code: 'prime', colors: { primary: '#6C18B6', plate: '#3B2A7A', unknownColor: '#000000' }, glow: false };

const teams = [{ _id: 'team-prime', name: 'HAWKTIMUS PRIME', code: 'prime', active: true }, { _id: 'team-nova', name: 'NOVA', code: 'nova', active: true }];
const settingsKey = '"drafts.dashboardSettings"]';
const teamKey = '"drafts.team-prime"]';
const teamsKey = '_type == "team"';
const listKey = '_type in [';

async function worldWith(docs, options = {}) {
  const answers = { [settingsKey]: { result: docs }, [teamKey]: { result: [teamPrime] }, [teamsKey]: { result: teams }, [listKey]: { result: [teamPrime, { _id: 'drafts.team-prime', _type: 'team', name: 'HAWKTIMUS PRIME' }, { _id: 'team-nova', _type: 'team', name: 'NOVA' }] } };
  return makeWorld([route], { ...options, answers: Object.assign(answers, options.answers) });
}

const mutationsOf = world => world.fetched.filter(call => call.url.includes('/data/mutate/')).map(call => JSON.parse(call.init.body).mutations);
const call = (world, method, url, body) => world.router.call(method, url, body === undefined ? {} : { body });

await check('the spec comes from the Studio schemas, and the write key is not in it', async () => {
  const world = await worldWith([published]);
  const answer = await call(world, 'GET', '/spec');
  assert.equal(answer.status, 200);
  assert.deepEqual(answer.json.documents.map(doc => doc.type), ['dashboardSettings', 'theme', 'view', 'team', 'customPanel', 'subtheme']);
  assert.ok(answer.json.skipped.length > 30);
  assert.ok(!answer.text.includes('skFAKEtoken'));
  assert.ok(!answer.text.includes('customs'));
  const again = await call(world, 'GET', '/spec');
  assert.equal(again.text, answer.text);
  assert.ok(world.ctx.state.settingsSpec, 'the spec is kept in memory for the next call');
});

await check('the list of documents has the singletons, the four views and the teams once each', async () => {
  const world = await worldWith([published]);
  const answer = await call(world, 'GET', '/docs');
  assert.equal(answer.status, 200);
  const ids = answer.json.documents.map(doc => doc.id);
  assert.deepEqual(ids.filter(id => id.startsWith('view-')), ['view-general', 'view-prime', 'view-nova', 'view-family']);
  assert.ok(ids.includes('dashboardSettings') && ids.includes('theme'));
  assert.equal(ids.filter(id => id === 'team-prime').length, 1, 'a draft and its published document are one entry');
  assert.ok(ids.includes('team-nova'));
});

await check('a document is read whole, the draft when there is one, with its revision and the teams', async () => {
  const withDraft = await call(await worldWith([published, draft]), 'GET', '/doc/dashboardSettings');
  assert.equal(withDraft.status, 200);
  assert.equal(withDraft.json.rev, 'rev-draft');
  assert.equal(withDraft.json.isDraft, true);
  assert.equal(withDraft.json.studioNewer, true);
  assert.equal(withDraft.json.document.pageSeconds, 30);
  assert.equal(withDraft.json.document.rotationRows.length, 1, 'the whole document comes, not only the settings the form draws');
  assert.deepEqual(withDraft.json.teams.map(team => team.code), ['prime', 'nova']);
  assert.equal(withDraft.json.canWrite, true);

  const only = await call(await worldWith([published]), 'GET', '/doc/dashboardSettings');
  assert.equal(only.json.rev, 'rev-pub');
  assert.equal(only.json.isDraft, false);
  assert.ok(!only.text.includes('skFAKEtoken'));
});

await check('only the documents the spec names are allowed', async () => {
  const world = await worldWith([published]);
  assert.equal((await call(world, 'GET', '/doc/..%2Fx')).status, 400);
  assert.equal((await call(world, 'GET', '/doc/a%20b')).status, 400);
  assert.equal((await call(world, 'GET', '/doc/status-mini')).status, 404, 'a document of a type the form does not edit');

  const task = await worldWith([], { answers: { '"drafts.some-task"]': { result: [{ _id: 'some-task', _type: 'task', title: 'x' }] } } });
  assert.equal((await call(task, 'GET', '/doc/some-task')).status, 404);
  assert.equal((await call(task, 'POST', '/doc/some-task/save', { set: { title: 'y' } })).status, 404);
  assert.equal((await call(task, 'POST', '/doc/some-task/publish', { confirm: true })).status, 404);
  assert.equal(mutationsOf(task).length, 0);

  const wrongType = await worldWith([{ _id: 'team-prime', _type: 'task' }], { answers: { [settingsKey]: { result: [{ _id: 'dashboardSettings', _type: 'team' }] } } });
  assert.equal((await call(wrongType, 'GET', '/doc/dashboardSettings')).status, 404, 'a fixed id with the wrong stored type is refused');
});

await check('a save writes only the changed fields to the draft with the revision check', async () => {
  const world = await worldWith([published, draft]);
  const answer = await call(world, 'POST', '/doc/dashboardSettings/save', { baseRev: 'rev-draft', set: { pageSeconds: 40, glint: false }, unset: ['partsRequestUrl'] });
  assert.equal(answer.status, 200, answer.text);
  assert.equal(answer.json.ok, true);
  assert.deepEqual(mutationsOf(world), [[{ patch: { id: 'drafts.dashboardSettings', set: { pageSeconds: 40, glint: false }, unset: ['partsRequestUrl'], ifRevisionID: 'rev-draft' } }]]);
  assert.ok(!answer.text.includes('skFAKEtoken'));
  assert.ok(world.logged.some(line => /settings saved to the draft of dashboardSettings: pageSeconds, glint, partsRequestUrl/.test(line)));
});

await check('with no draft yet it is made from the published document, with the type and every field', async () => {
  const world = await worldWith([published]);
  const answer = await call(world, 'POST', '/doc/dashboardSettings/save', { baseRev: 'rev-pub', set: { doneDays: 10 } });
  assert.equal(answer.status, 200, answer.text);
  const [made, patch] = mutationsOf(world)[0];
  assert.equal(made.createIfNotExists._id, 'drafts.dashboardSettings');
  assert.equal(made.createIfNotExists._type, 'dashboardSettings');
  assert.equal(made.createIfNotExists.rotationRows[0]._key, 'a1');
  assert.equal(made.createIfNotExists._rev, undefined);
  assert.deepEqual(patch, { patch: { id: 'drafts.dashboardSettings', set: { doneDays: 10 } } });
});

await check('a group is merged over the stored one, so a sub-field the form does not draw is kept', async () => {
  const world = await worldWith([published, draft]);
  const answer = await call(world, 'POST', '/doc/dashboardSettings/save', { baseRev: 'rev-draft', set: { crt: { everySeconds: 120 } } });
  assert.equal(answer.status, 200, answer.text);
  assert.deepEqual(mutationsOf(world)[0][0].patch.set.crt, { on: true, everySeconds: 120, durationSeconds: 2.7, extra: 'kept' });
});

await check('a change after the page loaded is a conflict, nothing is written, and Replace writes it', async () => {
  const world = await worldWith([published, draft]);
  const late = await call(world, 'POST', '/doc/dashboardSettings/save', { baseRev: 'rev-OLD', set: { pageSeconds: 40 } });
  assert.equal(late.status, 409);
  assert.equal(late.json.conflict, true);
  assert.equal(late.json.current.rev, 'rev-draft');
  assert.match(late.json.error, /changed in the Studio/);
  assert.equal(mutationsOf(world).length, 0);

  const forced = await call(world, 'POST', '/doc/dashboardSettings/save', { baseRev: 'rev-OLD', force: true, set: { pageSeconds: 40 } });
  assert.equal(forced.status, 200);
  assert.equal(mutationsOf(world).length, 1);
});

await check('Sanity refusing the write because the draft moved is the same conflict', async () => {
  const world = await worldWith([published, draft]);
  const real = world.ctx.fetch;
  world.ctx.fetch = async (url, init) => (String(url).includes('/data/mutate/') ? { ok: false, status: 409, json: async () => ({}) } : real(url, init));
  const answer = await call(world, 'POST', '/doc/dashboardSettings/save', { baseRev: 'rev-draft', set: { pageSeconds: 40 } });
  assert.equal(answer.status, 409);
  assert.equal(answer.json.conflict, true);
  assert.match(answer.json.error, /Nothing was written/);
});

await check('a field that is not in the spec, a field another tab owns, and a value past a limit are refused with the field named', async () => {
  const world = await worldWith([published, draft]);
  const refused = async (set, field, words, extra = {}) => {
    const answer = await call(world, 'POST', '/doc/dashboardSettings/save', Object.assign({ baseRev: 'rev-draft', set: set }, extra));
    assert.equal(answer.status, 400, JSON.stringify(set) + ' ' + answer.text);
    assert.equal(answer.json.field, field);
    assert.match(answer.json.error, words);
  };
  await refused({ nonsense: 1 }, 'nonsense', /no setting called nonsense/);
  await refused({ rotationRows: [] }, 'rotationRows', /no setting called rotationRows/);
  await refused({ rebootTime: '03:00' }, 'rebootTime', /no setting called/);
  await refused({ _type: 'team' }, '_type', /no setting called/);
  await refused({ pageSeconds: 5 }, 'pageSeconds', /8 to 120/);
  await refused({ pageSeconds: 'ten' }, 'pageSeconds', /number/);
  await refused({ pageSeconds: 20.5 }, 'pageSeconds', /whole number/);
  await refused({ glint: 'yes' }, 'glint', /on or off/);
  await refused({ speed: 'warp' }, 'speed', /Pick very slow/);
  await refused({ partsRequestUrl: 'http://example.com' }, 'partsRequestUrl', /https/);
  await refused({ countdown: { kickoffLabel: 'x'.repeat(41) } }, 'countdown.kickoffLabel', /Too long/);
  await refused({ crt: { everySeconds: 10 } }, 'crt.everySeconds', /Use 0 for never, or 30 or more/);
  await refused({ crt: { surprise: 1 } }, 'crt.surprise', /no setting called/);
  const empty = await call(world, 'POST', '/doc/dashboardSettings/save', { baseRev: 'rev-draft', set: {} });
  assert.equal(empty.status, 400);
  assert.match(empty.json.error, /nothing to save/);
  assert.equal(mutationsOf(world).length, 0, 'a refused save writes nothing');
});

await check('a required setting cannot be cleared, and a list item is checked with its row number', async () => {
  const world = await worldWith([published, draft]);
  const cleared = await call(world, 'POST', '/doc/dashboardSettings/save', { baseRev: 'rev-draft', unset: ['pageSeconds'] });
  assert.equal(cleared.status, 400);
  assert.equal(cleared.json.field, 'pageSeconds');

  const items = await call(world, 'POST', '/doc/dashboardSettings/save', { baseRev: 'rev-draft', set: { calendars: [{ _key: 'k1', id: 'team', name: 'Team', show: true }, { _key: 'k2', id: 'Bad Code', name: 'Other', show: true }] } });
  assert.equal(items.status, 400);
  assert.equal(items.json.field, 'calendars[1].id');
  assert.match(items.json.error, /lowercase/);
  assert.equal(mutationsOf(world).length, 0);
});

await check('a list keeps the sub-fields the form does not draw, by key, and gives a new item a key', async () => {
  const stored = Object.assign({}, draft, { calendars: [{ _key: 'k1', id: 'team', name: 'Team calendar', show: true, legacy: 'kept' }] });
  const world = await worldWith([published, stored]);
  const answer = await call(world, 'POST', '/doc/dashboardSettings/save', { baseRev: 'rev-draft', set: { calendars: [{ _key: 'k1', id: 'team', name: 'Team', show: true, kind: 'meetings' }, { id: 'build', name: 'Build', show: false }] } });
  assert.equal(answer.status, 200, answer.text);
  const list = mutationsOf(world)[0][0].patch.set.calendars;
  assert.deepEqual(list[0], { _key: 'k1', id: 'team', name: 'Team', show: true, kind: 'meetings', legacy: 'kept' });
  assert.match(list[1]._key, /^[0-9a-f]{12}$/);
  assert.equal(list[1].show, false);
});

await check('a team link must point at a team that exists, and is stored as a reference', async () => {
  const panel = { _id: 'panel-1', _type: 'customPanel', _rev: 'rev-p', _updatedAt: '2026-10-18T10:00:00Z', title: 'INFO' };
  const world = await worldWith([], { answers: { '"drafts.panel-1"]': { result: [panel] } } });
  const bad = await call(world, 'POST', '/doc/panel-1/save', { baseRev: 'rev-p', set: { team: { _type: 'reference', _ref: 'team-ghost' } } });
  assert.equal(bad.status, 400);
  assert.equal(bad.json.field, 'team');

  const good = await call(world, 'POST', '/doc/panel-1/save', { baseRev: 'rev-p', set: { team: { _type: 'reference', _ref: 'team-nova', _weak: true } } });
  assert.equal(good.status, 200, good.text);
  const [made, patch] = mutationsOf(world)[0];
  assert.equal(made.createIfNotExists._type, 'customPanel');
  assert.deepEqual(patch.patch.set.team, { _type: 'reference', _ref: 'team-nova' }, 'only the reference is stored');
});

await check('a team document: colors are merged and checked as hex', async () => {
  const world = await worldWith([], {});
  const bad = await call(world, 'POST', '/doc/team-prime/save', { baseRev: 'rev-team', set: { colors: { primary: 'purple' } } });
  assert.equal(bad.status, 400);
  assert.equal(bad.json.field, 'colors.primary');
  const good = await call(world, 'POST', '/doc/team-prime/save', { baseRev: 'rev-team', set: { colors: { primary: '#112233' }, glow: true } });
  assert.equal(good.status, 200, good.text);
  const patch = mutationsOf(world)[0][1].patch.set;
  assert.deepEqual(patch.colors, { primary: '#112233', plate: '#3B2A7A', unknownColor: '#000000' });
  assert.equal(patch.glow, true);
});

await check('with no write key the save and publish are refused and nothing is sent', async () => {
  const world = await worldWith([published, draft], { env: "CONTROL_PIN='123456'\n" });
  assert.equal((await call(world, 'POST', '/doc/dashboardSettings/save', { baseRev: 'rev-draft', set: { pageSeconds: 40 } })).status, 503);
  assert.equal((await call(world, 'POST', '/doc/dashboardSettings/publish', { confirm: true })).status, 503);
  assert.equal(mutationsOf(world).length, 0);
  assert.equal((await call(world, 'GET', '/doc/dashboardSettings')).json.canWrite, false);
});

await check('publish needs a confirm, publishes only that document, and the draft is removed', async () => {
  const world = await worldWith([published, draft]);
  const unsure = await call(world, 'POST', '/doc/dashboardSettings/publish', { rev: 'rev-draft' });
  assert.equal(unsure.status, 400);
  assert.match(unsure.json.error, /Confirm/);
  assert.equal(mutationsOf(world).length, 0);

  const done = await call(world, 'POST', '/doc/dashboardSettings/publish', { rev: 'rev-draft', confirm: true });
  assert.equal(done.status, 200, done.text);
  const [replace, remove] = mutationsOf(world)[0];
  assert.equal(replace.createOrReplace._id, 'dashboardSettings');
  assert.equal(replace.createOrReplace._type, 'dashboardSettings');
  assert.equal(replace.createOrReplace.pageSeconds, 30);
  assert.equal(replace.createOrReplace._rev, undefined);
  assert.deepEqual(remove, { delete: { id: 'drafts.dashboardSettings' } });
  assert.equal(mutationsOf(world)[0].length, 2, 'no other document is touched');
});

await check('publish with a draft that moved on is a conflict, and with no draft there is nothing to publish', async () => {
  const world = await worldWith([published, draft]);
  const stale = await call(world, 'POST', '/doc/dashboardSettings/publish', { rev: 'rev-OLD', confirm: true });
  assert.equal(stale.status, 409);
  assert.equal(stale.json.conflict, true);
  assert.equal(mutationsOf(world).length, 0);
  const forced = await call(world, 'POST', '/doc/dashboardSettings/publish', { rev: 'rev-OLD', confirm: true, force: true });
  assert.equal(forced.status, 200);

  const none = await worldWith([published]);
  const nothing = await call(none, 'POST', '/doc/dashboardSettings/publish', { rev: 'x', confirm: true });
  assert.equal(nothing.status, 409);
  assert.match(nothing.json.error, /nothing to publish/);
});

await check('an offline Sanity gives a plain sentence, not a stack', async () => {
  const world = await worldWith([published], { offline: true });
  const answer = await call(world, 'GET', '/doc/dashboardSettings');
  assert.equal(answer.status, 502);
  assert.match(answer.json.error, /could not read the settings from Sanity/);
});

console.log(passed + ' of ' + passed + ' passed');
