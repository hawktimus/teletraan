// Tests for the lists of content documents on the Control page (control/routes/collection-doc.js, control/support/collection-doc.js):
// listing the ticker lines and the roster with their drafts, making a new draft, saving with the revision check, refusing a field or
// a limit, publishing, and deleting only after a confirm. A fake Sanity that remembers; nothing leaves the process.
//
//   node tests/control-collection-doc.test.mjs

import assert from 'node:assert/strict';
import * as route from '../control/routes/collection-doc.js';
import { makeWorld } from './helpers/control-world.mjs';
import { makeFakeSanity } from './helpers/fake-sanity.mjs';

let passed = 0;
async function check(name, test) {
  await test();
  passed += 1;
  console.log('PASS  ' + name);
}

const docs = () => [
  { _id: 'team-prime', _type: 'team', name: 'HAWKTIMUS PRIME', code: 'prime', active: true },
  { _id: 'team-nova', _type: 'team', name: 'HAWKTIMUS NOVA', code: 'nova', active: true },
  { _id: 'tip-1', _type: 'tipOrNews', kind: 'tip', text: 'Wear safety glasses.', order: 10, show: true },
  { _id: 'tip-2', _type: 'tipOrNews', kind: 'news', text: 'Kickoff is soon.', order: 20, show: false, expires: '2027-01-10T00:00:00.000Z' },
  { _id: 'drafts.tip-2', _type: 'tipOrNews', kind: 'news', text: 'Kickoff is very soon.', order: 20, show: true },
  { _id: 'person-1', _type: 'rosterPerson', firstName: 'Sam', role: 'student', team: { _type: 'reference', _ref: 'team-nova' }, show: true, portrait: { _type: 'image', asset: { _type: 'reference', _ref: 'image-abc123-400x400-jpg' } } },
  { _id: 'other-1', _type: 'person', name: 'Jo', role: 'Coach', title: 'Coach', show: true, photo: { _type: 'image', asset: { _type: 'reference', _ref: 'image-def456-300x300-png' } } },
  { _id: 'lead-1', _type: 'subteam', name: 'Build', lead: 'Dee', members: ['Ed', 'Flo'], show: true, team: { _type: 'reference', _ref: 'team-prime' }, photo: { _type: 'image', asset: { _type: 'reference', _ref: 'image-ghi789-200x200-jpg' } } },
];

async function worldWith(documents = docs(), options = {}) {
  const world = await makeWorld([route], options);
  const sanity = makeFakeSanity(documents);
  world.ctx.fetch = sanity.fetch;
  world.sanity = sanity;
  return world;
}

const call = (world, method, url, body) => world.router.call(method, url, body === undefined ? {} : { body });
const mutationsOf = world => world.sanity.log;

await check('a list has every document of the type once, the draft when there is one, with the teams and a picture address', async () => {
  const world = await worldWith();
  const tips = await call(world, 'GET', '/docs/tipOrNews');
  assert.equal(tips.status, 200);
  assert.deepEqual(tips.json.items.map(item => item.id).sort(), ['tip-1', 'tip-2']);
  const two = tips.json.items.filter(item => item.id === 'tip-2')[0];
  assert.equal(two.document.text, 'Kickoff is very soon.', 'the draft shows, not the published copy');
  assert.equal(two.isDraft, true);
  assert.equal(two.published, true);
  assert.equal(tips.json.items.filter(item => item.id === 'tip-1')[0].isDraft, false);
  assert.equal(tips.json.canWrite, true);
  assert.deepEqual(tips.json.teams.map(team => team.code), ['prime', 'nova']);

  const roster = await call(world, 'GET', '/docs/rosterPerson');
  assert.equal(roster.json.items.length, 1, 'a person of the Leadership type is not in the roster');
  assert.match(roster.json.items[0].picture, /^https:\/\/cdn\.sanity\.io\/images\/[a-z0-9]+\/[A-Za-z0-9_-]+\/abc123-400x400\.jpg\?/);
  assert.ok(!roster.text.includes('skFAKEtoken'));
});

await check('only the kinds of content the plan names are listed', async () => {
  const world = await worldWith();
  assert.equal((await call(world, 'GET', '/docs/dashboardSettings')).status, 404, 'a singleton is not a list');
  assert.equal((await call(world, 'GET', '/docs/sponsor')).status, 404);
  assert.equal((await call(world, 'GET', '/docs/..x')).status, 400);
  assert.equal((await call(world, 'POST', '/docs/team', { set: { name: 'x' } })).status, 404);
  assert.equal((await call(world, 'GET', '/docs/tipOrNews/person-1')).status, 404, 'an item of another type is not found through this type');
});

await check('a new item is a draft with a made-up id, the starting values of the schema, and the checks of the Studio', async () => {
  const world = await worldWith();
  const made = await call(world, 'POST', '/docs/rosterPerson', { set: { firstName: 'Ana', role: 'mentor', jobTitle: 'Lead mentor', department: 'build', team: { _type: 'reference', _ref: 'team-prime' } } });
  assert.equal(made.status, 200);
  assert.ok(made.json.id.length > 10);
  const stored = world.sanity.stored['drafts.' + made.json.id];
  assert.equal(stored._type, 'rosterPerson');
  assert.equal(stored.show, true, 'Show on screen starts on, as in the Studio');
  assert.equal(stored.firstName, 'Ana');
  assert.equal(world.sanity.stored[made.json.id], undefined, 'nothing is published by making it');

  const tip = await call(world, 'POST', '/docs/tipOrNews', { set: { text: 'Clean up.' } });
  assert.equal(tip.status, 200);
  assert.equal(world.sanity.stored['drafts.' + tip.json.id].kind, 'tip', 'the kind starts as tip');
});

await check('a new item without a needed field, over a limit, with an unknown name or a bad team is refused with the field named', async () => {
  const world = await worldWith();
  const noName = await call(world, 'POST', '/docs/rosterPerson', { set: { role: 'student' } });
  assert.equal(noName.status, 400);
  assert.equal(noName.json.field, 'firstName');
  const longName = await call(world, 'POST', '/docs/rosterPerson', { set: { firstName: 'A'.repeat(25), role: 'student' } });
  assert.equal(longName.status, 400);
  assert.match(longName.json.error, /Up to 24/);
  const noRole = await call(world, 'POST', '/docs/rosterPerson', { set: { firstName: 'Ana' } });
  assert.equal(noRole.json.field, 'role');
  const wrongRole = await call(world, 'POST', '/docs/rosterPerson', { set: { firstName: 'Ana', role: 'boss' } });
  assert.equal(wrongRole.status, 400);
  const email = await call(world, 'POST', '/docs/rosterPerson', { set: { firstName: 'Ana', role: 'student', email: 'a@b.org' } });
  assert.equal(email.status, 400, 'there is no email field to store');
  const tall = await call(world, 'POST', '/docs/tipOrNews', { set: { text: 'x'.repeat(53) } });
  assert.equal(tall.status, 400);
  const team = await call(world, 'POST', '/docs/rosterPerson', { set: { firstName: 'Ana', role: 'student', team: { _type: 'reference', _ref: 'nobody' } } });
  assert.equal(team.status, 400);
  assert.equal(mutationsOf(world).length, 0, 'nothing was written');
});

await check('a save writes the changed fields to the draft, makes the draft from the published copy first, and keeps the other fields', async () => {
  const world = await worldWith();
  const item = (await call(world, 'GET', '/docs/tipOrNews/tip-1')).json;
  const saved = await call(world, 'POST', '/docs/tipOrNews/tip-1/save', { baseRev: item.rev, set: { show: false } });
  assert.equal(saved.status, 200);
  const draft = world.sanity.stored['drafts.tip-1'];
  assert.equal(draft.show, false);
  assert.equal(draft.text, 'Wear safety glasses.');
  assert.equal(world.sanity.stored['tip-1'].show, true, 'the published copy is not touched');
  assert.equal(saved.json.isDraft, true);

  const cleared = await call(world, 'POST', '/docs/tipOrNews/tip-1/save', { baseRev: saved.json.rev, unset: ['order'] });
  assert.equal(cleared.status, 200);
  assert.equal(world.sanity.stored['drafts.tip-1'].order, undefined);
});

await check('a field that is not in the spec, a limit and a needed field are refused on a save', async () => {
  const world = await worldWith();
  const rev = (await call(world, 'GET', '/docs/tipOrNews/tip-1')).json.rev;
  assert.equal((await call(world, 'POST', '/docs/tipOrNews/tip-1/save', { baseRev: rev, set: { colour: 'red' } })).status, 400);
  assert.equal((await call(world, 'POST', '/docs/tipOrNews/tip-1/save', { baseRev: rev, set: { text: 'x'.repeat(60) } })).status, 400);
  assert.equal((await call(world, 'POST', '/docs/tipOrNews/tip-1/save', { baseRev: rev, unset: ['text'] })).status, 400);
  assert.equal((await call(world, 'POST', '/docs/tipOrNews/tip-1/save', { baseRev: rev, set: {} })).status, 400);
  assert.equal((await call(world, 'POST', '/docs/rosterPerson/person-1/save', { baseRev: 'x', set: { portrait: { asset: { _ref: 'image-zzz-1x1-png' } } } })).status, 400, 'the portrait is read only here');
  assert.equal(mutationsOf(world).length, 0);
});

await check('a change made in the Studio meanwhile is a conflict, and Replace with force writes it', async () => {
  const world = await worldWith();
  const rev = (await call(world, 'GET', '/docs/tipOrNews/tip-2')).json.rev;
  world.sanity.touch('tip-2', { text: 'Changed in the Studio.' });
  const refused = await call(world, 'POST', '/docs/tipOrNews/tip-2/save', { baseRev: rev, set: { order: 5 } });
  assert.equal(refused.status, 409);
  assert.equal(refused.json.conflict, true);
  assert.equal(world.sanity.stored['drafts.tip-2'].order, 20);
  const forced = await call(world, 'POST', '/docs/tipOrNews/tip-2/save', { baseRev: rev, force: true, set: { order: 5 } });
  assert.equal(forced.status, 200);
  assert.equal(world.sanity.stored['drafts.tip-2'].order, 5);
  assert.equal(world.sanity.stored['drafts.tip-2'].text, 'Changed in the Studio.', 'only the changed field is replaced');
});

await check('publish needs a confirm and the draft revision, then the draft becomes the published document', async () => {
  const world = await worldWith();
  const item = (await call(world, 'GET', '/docs/tipOrNews/tip-2')).json;
  assert.equal((await call(world, 'POST', '/docs/tipOrNews/tip-2/publish', { rev: item.rev })).status, 400);
  world.sanity.touch('tip-2', { order: 7 });
  assert.equal((await call(world, 'POST', '/docs/tipOrNews/tip-2/publish', { confirm: true, rev: item.rev })).status, 409, 'the draft changed after it was read');
  const fresh = (await call(world, 'GET', '/docs/tipOrNews/tip-2')).json;
  const done = await call(world, 'POST', '/docs/tipOrNews/tip-2/publish', { confirm: true, rev: fresh.rev });
  assert.equal(done.status, 200);
  assert.equal(world.sanity.stored['tip-2'].text, 'Kickoff is very soon.');
  assert.equal(world.sanity.stored['drafts.tip-2'], undefined);
  assert.equal((await call(world, 'POST', '/docs/tipOrNews/tip-1/publish', { confirm: true, rev: 'x' })).status, 409, 'nothing waits to be published');
});

await check('deleting a published item needs a confirm and removes it with its draft; a draft alone goes without one; Drop my changes keeps the published copy', async () => {
  const world = await worldWith();
  const rev = (await call(world, 'GET', '/docs/tipOrNews/tip-2')).json.rev;
  const asked = await call(world, 'POST', '/docs/tipOrNews/tip-2/delete', { rev: rev });
  assert.equal(asked.status, 400);
  assert.ok(world.sanity.stored['tip-2'] && world.sanity.stored['drafts.tip-2']);

  const stale = await call(world, 'POST', '/docs/tipOrNews/tip-2/delete', { confirm: true, rev: 'old' });
  assert.equal(stale.status, 409);

  const dropped = await call(world, 'POST', '/docs/tipOrNews/tip-2/delete', { draftOnly: true, rev: rev });
  assert.equal(dropped.status, 200);
  assert.ok(world.sanity.stored['tip-2']);
  assert.equal(world.sanity.stored['drafts.tip-2'], undefined);

  const made = await call(world, 'POST', '/docs/tipOrNews', { set: { text: 'Draft only.' } });
  const gone = await call(world, 'POST', '/docs/tipOrNews/' + made.json.id + '/delete', {});
  assert.equal(gone.status, 200);
  assert.equal(world.sanity.stored['drafts.' + made.json.id], undefined);

  const removed = await call(world, 'POST', '/docs/tipOrNews/tip-1/delete', { confirm: true });
  assert.equal(removed.status, 200);
  assert.equal(world.sanity.stored['tip-1'], undefined);
  assert.equal((await call(world, 'GET', '/docs/tipOrNews/tip-1')).status, 404);
});

await check('every write needs the PIN and the key, and no answer holds the key', async () => {
  const closed = await worldWith(docs(), { pin: false });
  assert.equal((await call(closed, 'GET', '/docs/tipOrNews')).status, 401);
  assert.equal((await call(closed, 'POST', '/docs/tipOrNews', { set: { text: 'x' } })).status, 401);
  assert.equal(closed.sanity.log.length, 0);

  const noKey = await worldWith(docs(), { env: 'CONTROL_PIN=\'123456\'\n' });
  const list = await call(noKey, 'GET', '/docs/tipOrNews');
  assert.equal(list.json.canWrite, false);
  assert.equal((await call(noKey, 'POST', '/docs/tipOrNews', { set: { text: 'x' } })).status, 503);
  assert.equal((await call(noKey, 'POST', '/docs/tipOrNews/tip-1/delete', { confirm: true })).status, 503);
  assert.equal(noKey.sanity.log.length, 0);
  assert.ok(!JSON.stringify(noKey.logged).includes('sk'));
});

await check('Leadership and Team leads are listed with their picture address, each in its own type', async () => {
  const world = await worldWith();
  const leaders = await call(world, 'GET', '/docs/person');
  assert.deepEqual(leaders.json.items.map(item => item.id), ['other-1']);
  assert.match(leaders.json.items[0].picture, /def456-300x300\.png\?/);
  const leads = await call(world, 'GET', '/docs/subteam');
  assert.deepEqual(leads.json.items.map(item => item.document.lead), ['Dee']);
  assert.deepEqual(leads.json.items[0].document.members, ['Ed', 'Flo']);
  assert.match(leads.json.items[0].picture, /ghi789-200x200\.jpg\?/);
  assert.equal((await call(world, 'GET', '/docs/person/lead-1')).status, 404, 'a Team lead is not found through the Leadership type');
  assert.ok(!leaders.text.includes('skFAKEtoken') && !leads.text.includes('skFAKEtoken'));
});

await check('an existing Leadership entry is edited in place: name, role, listed with, line, team, order, hide, with the limits of the Studio', async () => {
  const world = await worldWith();
  const rev = (await call(world, 'GET', '/docs/person/other-1')).json.rev;
  const saved = await call(world, 'POST', '/docs/person/other-1/save', { baseRev: rev, set: { name: 'Joe', title: 'Head coach', role: 'Mentor', line: 'Since 2019', order: 3, team: { _type: 'reference', _ref: 'team-nova' } } });
  assert.equal(saved.status, 200);
  const draft = world.sanity.stored['drafts.other-1'];
  assert.deepEqual([draft.name, draft.title, draft.role, draft.line, draft.order], ['Joe', 'Head coach', 'Mentor', 'Since 2019', 3]);
  assert.equal(draft.team._ref, 'team-nova');
  assert.equal(draft.photo.asset._ref, 'image-def456-300x300-png', 'the picture is carried over untouched');
  assert.equal(world.sanity.stored['other-1'].name, 'Jo', 'the wall copy waits for Publish');

  const hidden = await call(world, 'POST', '/docs/person/other-1/save', { baseRev: saved.json.rev, set: { show: false } });
  assert.equal(hidden.status, 200);
  assert.equal(world.sanity.stored['drafts.other-1'].show, false);

  const fresh = (await call(world, 'GET', '/docs/person/other-1')).json;
  const refused = [
    { name: 'A'.repeat(18) },
    { title: 'T'.repeat(23) },
    { line: 'L'.repeat(49) },
    { role: 'Boss' },
    { order: 1.5 },
    { photo: { asset: { _ref: 'image-zzz-1x1-png' } } },
    { email: 'jo@example.org' },
  ];
  for (const set of refused) assert.equal((await call(world, 'POST', '/docs/person/other-1/save', { baseRev: fresh.rev, set })).status, 400, JSON.stringify(set));
  assert.equal((await call(world, 'POST', '/docs/person/other-1/save', { baseRev: fresh.rev, unset: ['name'] })).status, 400, 'the name is needed');
  const published = await call(world, 'POST', '/docs/person/other-1/publish', { confirm: true, rev: fresh.rev });
  assert.equal(published.status, 200);
  assert.equal(world.sanity.stored['other-1'].name, 'Joe');
  assert.equal(world.sanity.stored['other-1'].show, false);
});

await check('a Team lead keeps its members as a list of first names: add, remove and reorder are saved as the same array of strings', async () => {
  const world = await worldWith();
  const rev = (await call(world, 'GET', '/docs/subteam/lead-1')).json.rev;
  const saved = await call(world, 'POST', '/docs/subteam/lead-1/save', { baseRev: rev, set: { members: ['Flo', 'Gus', 'Ed'], lead: 'Dee M', spotlight: true, spotlightHeadline: 'Frame done', spotlightText: 'The frame is welded.' } });
  assert.equal(saved.status, 200);
  const draft = world.sanity.stored['drafts.lead-1'];
  assert.deepEqual(draft.members, ['Flo', 'Gus', 'Ed']);
  assert.equal(draft.spotlight, true);
  assert.equal(draft.name, 'Build');
  assert.deepEqual(world.sanity.stored['lead-1'].members, ['Ed', 'Flo']);

  const again = (await call(world, 'GET', '/docs/subteam/lead-1')).json;
  assert.equal((await call(world, 'POST', '/docs/subteam/lead-1/save', { baseRev: again.rev, set: { members: [] } })).status, 200);
  assert.deepEqual(world.sanity.stored['drafts.lead-1'].members, []);

  const next = (await call(world, 'GET', '/docs/subteam/lead-1')).json;
  const many = Array.from({ length: 25 }, (value, at) => 'N' + String.fromCharCode(97 + at));
  const refused = [
    { members: many },
    { members: ['Ed', 'ed'] },
    { members: ['Edward Smithson Jr'] },
    { members: ['Ed2'] },
    { members: ['Eeeeeeeeeeeee'] },
    { name: 'Twelve chars!' },
    { lead: 'L'.repeat(18) },
    { photo: { asset: { _ref: 'image-zzz-1x1-png' } } },
  ];
  for (const set of refused) assert.equal((await call(world, 'POST', '/docs/subteam/lead-1/save', { baseRev: next.rev, set })).status, 400, JSON.stringify(set).slice(0, 60));
});

await check('a change made in the Studio meanwhile is a conflict on a Leadership entry and on a Team lead', async () => {
  const world = await worldWith();
  for (const [type, id, set] of [['person', 'other-1', { title: 'Captain' }], ['subteam', 'lead-1', { members: ['Ed'] }]]) {
    const rev = (await call(world, 'GET', '/docs/' + type + '/' + id)).json.rev;
    world.sanity.touch(id, { order: 9 });
    const refused = await call(world, 'POST', '/docs/' + type + '/' + id + '/save', { baseRev: rev, set });
    assert.equal(refused.status, 409);
    assert.equal(refused.json.conflict, true);
    const key = Object.keys(set)[0];
    assert.notDeepEqual(world.sanity.stored['drafts.' + id][key], set[key], 'nothing was written');
    const forced = await call(world, 'POST', '/docs/' + type + '/' + id + '/save', { baseRev: rev, force: true, set });
    assert.equal(forced.status, 200);
    assert.equal(world.sanity.stored['drafts.' + id].order, 9, 'only the changed field is replaced');
  }
});

await check('deleting a Leadership entry or a Team lead needs a confirm and removes only that document', async () => {
  const world = await worldWith();
  assert.equal((await call(world, 'POST', '/docs/person/other-1/delete', {})).status, 400);
  assert.ok(world.sanity.stored['other-1']);
  assert.equal((await call(world, 'POST', '/docs/person/lead-1/delete', { confirm: true })).status, 404, 'a Team lead cannot be deleted through the Leadership type');
  assert.equal((await call(world, 'POST', '/docs/person/other-1/delete', { confirm: true })).status, 200);
  assert.equal(world.sanity.stored['other-1'], undefined);
  assert.ok(world.sanity.stored['lead-1'] && world.sanity.stored['person-1']);
  assert.equal((await call(world, 'POST', '/docs/subteam/lead-1/delete', { confirm: true })).status, 200);
  assert.equal(world.sanity.stored['lead-1'], undefined);
});

await check('writes to Leadership and Team leads need the key, and no answer holds it', async () => {
  const noKey = await worldWith(docs(), { env: 'CONTROL_PIN=\'123456\'\n' });
  assert.equal((await call(noKey, 'POST', '/docs/person/other-1/save', { baseRev: 'x', set: { name: 'Z' } })).status, 503);
  assert.equal((await call(noKey, 'POST', '/docs/subteam/lead-1/delete', { confirm: true })).status, 503);
  assert.equal(noKey.sanity.log.length, 0);
  const world = await worldWith();
  const made = await call(world, 'POST', '/docs/person/other-1/save', { baseRev: 'x', force: true, set: { name: 'Zed' } });
  assert.ok(!JSON.stringify(made.json).includes('skFAKEtoken') && !JSON.stringify(world.logged).includes('skFAKEtoken'));
});

await check('first-name advice: a full name, an email address, a space or a number is a warning that never stops a save', async () => {
  const world = await worldWith();
  const warned = async (type, set) => (await call(world, 'POST', '/docs/' + type + '/check', { set })).json.warnings;
  assert.match((await warned('person', { name: 'Sam Smith' }))[0].message, /full name/);
  assert.match((await warned('person', { name: 'sam@example.org' }))[0].message, /email address/);
  assert.deepEqual(await warned('person', { name: 'Sam K.' }), [], 'a last initial is fine');
  assert.match((await warned('subteam', { lead: 'Dee Jones' }))[0].message, /full name/);
  assert.match((await warned('subteam', { members: ['Ed', 'Sam Smith'] }))[0].message, /"Sam Smith" in members: .*full name/);
  assert.match((await warned('rosterPerson', { firstName: 'Dana Lee' }))[0].message, /space, an @ or a number/);
  assert.match((await warned('rosterPerson', { firstName: 'Dana2' }))[0].message, /space, an @ or a number/);
  assert.deepEqual(await warned('rosterPerson', { firstName: 'Dana' }), []);
  assert.equal((await call(world, 'POST', '/docs/sponsor/check', { set: {} })).status, 404);
  assert.equal(world.sanity.log.length, 0, 'asking for advice writes nothing');

  const rev = (await call(world, 'GET', '/docs/person/other-1')).json.rev;
  const saved = await call(world, 'POST', '/docs/person/other-1/save', { baseRev: rev, set: { name: 'Sam Smith' } });
  assert.equal(saved.status, 200, 'a warning does not stop the save');
  assert.match(saved.json.warnings[0].message, /full name/);
});

console.log('\n' + passed + ' of ' + passed + ' passed');
