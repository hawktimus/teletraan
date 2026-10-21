// Tests for the Clean up expired items card of the control page: the route (control/routes/cleanup.js), what it checks and writes
// (control/support/cleanup.js), the helper words and the markup of the card (control/static/tabs/settings-cleanup.js). A fake
// Sanity and a fake helper; nothing leaves the process and nothing is deleted.
//
//   node tests/control-cleanup.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as cleanup from '../control/routes/cleanup.js';
import * as helperRoute from '../control/routes/helper.js';
import * as logic from '../control/support/cleanup.js';
import { cleanupHtml, deleteQuestion, listHtml, publishQuestion, statusWords } from '../control/static/tabs/settings-cleanup.js';
import { defaults } from '../computer/scripts/cleanup-plan.mjs';
import { makeWorld, repo } from './helpers/control-world.mjs';

let passed = 0;
async function check(name, test) {
  await test();
  passed += 1;
  console.log('PASS  ' + name);
}

const settingsKey = '"drafts.dashboardSettings"]';
const published = { _id: 'dashboardSettings', _type: 'dashboardSettings', _rev: 'rev-pub', _updatedAt: '2026-10-18T10:00:00Z', pageSeconds: 25, cleanupEnabled: true, cleanupDeleteAfterDays: 21, cleanupMode: 'delete' };
const draft = Object.assign({}, published, { _id: 'drafts.dashboardSettings', _rev: 'rev-draft', _updatedAt: '2026-10-18T11:00:00Z', cleanupMode: 'list' });
const miniStatus = { result: { status: { lastCleanupAt: '2026-10-21T07:40:00Z', cleanupWouldDelete: 4, cleanupDeleted: 3, cleanupError: 'One could not be deleted (status 409).' } } };

async function worldWith(docs, options = {}) {
  return makeWorld([cleanup], { answers: { [settingsKey]: { result: docs }, 'status-mini': miniStatus }, ...options });
}

const mutationsOf = world => world.fetched.filter(call => call.url.includes('/data/mutate/')).map(call => JSON.parse(call.init.body).mutations);

// What the helper prints: one tab separated line for each thing
const listOutput = [
  'item\tTip or news\tOld tip\t2026-08-01\t81',
  'item\tAnnouncement\tOld notice\t2026-09-01\t50',
  'note\tKept "Odd one" (Tip or news): the date in expires cannot be read.',
].join('\n') + '\n';

function helperSays(world, outputs) {
  world.ctx.helper = async (word, args) => {
    world.helped.push({ word, args });
    const output = outputs[word];
    if (output instanceof Error) throw output;
    return output === undefined ? '' : output;
  };
}

// ----- reading -----

await check('GET gives the setting of the draft, the published one and what the last run did', async () => {
  const world = await worldWith([published, draft]);
  const answer = await world.router.call('GET', '/cleanup');
  assert.equal(answer.status, 200);
  assert.equal(answer.json.setting.cleanupMode, 'list');
  assert.equal(answer.json.published.cleanupMode, 'delete');
  assert.equal(answer.json.setting.cleanupDeleteAfterDays, 21);
  assert.equal(answer.json.rev, 'rev-draft');
  assert.equal(answer.json.canWrite, true);
  assert.deepEqual(answer.json.status, { lastAt: '2026-10-21T07:40:00Z', wouldDelete: 4, deleted: 3, error: 'One could not be deleted (status 409).' });
  assert.deepEqual(mutationsOf(world), []);
});

await check('a Dashboard Settings with no cleanup fields shows the starting values: off, 14 days, list only', async () => {
  const world = await worldWith([Object.assign({}, published, { cleanupEnabled: undefined, cleanupDeleteAfterDays: undefined, cleanupMode: undefined })]);
  const answer = await world.router.call('GET', '/cleanup');
  assert.deepEqual(answer.json.setting, defaults);
  assert.deepEqual(defaults, { cleanupEnabled: false, cleanupDeleteAfterDays: 14, cleanupMode: 'list' });
});

await check('when the status cannot be read the card still opens, and when Dashboard Settings cannot, it gets a sentence', async () => {
  const world = await worldWith([published]);
  const plain = world.ctx.fetch;
  world.ctx.fetch = async (url, init) => {
    if (decodeURIComponent(String(url)).includes('status-mini')) throw new Error('the network is down');
    return plain(url, init);
  };
  const answer = await world.router.call('GET', '/cleanup');
  assert.equal(answer.status, 200);
  assert.equal(answer.json.status.unreadable, true);
  const offline = await (await worldWith([published], { offline: true })).router.call('GET', '/cleanup');
  assert.equal(offline.status, 502);
  assert.match(offline.json.error, /could not read Dashboard Settings/);
});

// ----- checking what the page sent -----

await check('a value out of range is refused in words and not corrected', () => {
  const bad = (setting, words) => assert.throws(() => logic.cleanSetting(setting), error => error.status === 400 && words.test(error.message), JSON.stringify(setting));
  bad({ cleanupEnabled: 'yes' }, /on or off/);
  bad({ cleanupDeleteAfterDays: 0 }, /1 to 365/);
  bad({ cleanupDeleteAfterDays: 366 }, /1 to 365/);
  bad({ cleanupDeleteAfterDays: 14.5 }, /whole number/);
  bad({ cleanupDeleteAfterDays: '14' }, /whole number/);
  bad({ cleanupMode: 'remove' }, /Only show or Delete/);
  bad({}, /nothing to save/);
  bad('no', /object/);
  bad({ pageSeconds: 30 }, /nothing to save/);
});

await check('a good setting is stored with the Studio field names and nothing else', () => {
  assert.deepEqual(logic.cleanSetting({ cleanupEnabled: true, cleanupDeleteAfterDays: 30, cleanupMode: 'delete', pageSeconds: 99 }), { cleanupEnabled: true, cleanupDeleteAfterDays: 30, cleanupMode: 'delete' });
  assert.deepEqual(logic.cleanSetting({ cleanupDeleteAfterDays: 365 }), { cleanupDeleteAfterDays: 365 });
  assert.deepEqual(logic.cleanupFieldNames, ['cleanupEnabled', 'cleanupDeleteAfterDays', 'cleanupMode']);
});

// ----- saving and publishing -----

await check('Save writes the three fields to the draft only, with the revision it was read at', async () => {
  const world = await worldWith([published, draft]);
  const answer = await world.router.call('POST', '/cleanup/save', { body: { setting: { cleanupEnabled: true, cleanupDeleteAfterDays: 30, cleanupMode: 'list' }, baseRev: 'rev-draft' } });
  assert.equal(answer.status, 200);
  const sent = mutationsOf(world);
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0].patch.id, 'drafts.dashboardSettings');
  assert.equal(sent[0][0].patch.ifRevisionID, 'rev-draft');
  assert.deepEqual(Object.keys(sent[0][0].patch.set).sort(), ['cleanupDeleteAfterDays', 'cleanupEnabled', 'cleanupMode']);
  assert.ok(sent[0].every(mutation => !mutation.createOrReplace && !mutation.delete), 'nothing is published');
});

await check('Save asks before it overwrites a newer Studio edit, and needs the write key', async () => {
  const world = await worldWith([published, draft]);
  const stale = await world.router.call('POST', '/cleanup/save', { body: { setting: { cleanupMode: 'delete' }, baseRev: 'rev-old' } });
  assert.equal(stale.status, 409);
  assert.equal(stale.json.conflict, true);
  assert.deepEqual(mutationsOf(world), []);
  const noKey = await (await worldWith([published], { env: "CONTROL_PIN='123456'\n" })).router.call('POST', '/cleanup/save', { body: { setting: { cleanupMode: 'delete' }, baseRev: 'rev-pub' } });
  assert.equal(noKey.status, 503);
  assert.match(noKey.json.error, /SANITY_WRITE_TOKEN is not set/);
});

await check('Publish does nothing until the owner has confirmed, and then publishes the draft', async () => {
  const world = await worldWith([published, draft]);
  const none = await world.router.call('POST', '/cleanup/publish', { body: { rev: 'rev-draft' } });
  assert.equal(none.status, 400);
  assert.deepEqual(mutationsOf(world), []);
  const done = await world.router.call('POST', '/cleanup/publish', { body: { rev: 'rev-draft', confirm: true } });
  assert.equal(done.status, 200);
  assert.equal(mutationsOf(world)[0][0].createOrReplace.cleanupMode, 'list');
});

await check('the write key is never in an answer or in the log', async () => {
  const world = await worldWith([published, draft]);
  helperSays(world, { 'cleanup-preview': listOutput });
  const answers = [
    await world.router.call('GET', '/cleanup'),
    await world.router.call('POST', '/cleanup/save', { body: { setting: { cleanupMode: 'list' }, baseRev: 'rev-draft' } }),
    await world.router.call('POST', '/cleanup/preview', { body: {} }),
  ];
  answers.forEach(answer => assert.doesNotMatch(answer.text, /skFAKEtoken/));
  assert.doesNotMatch(world.logged.join('\n'), /skFAKEtoken/);
});

// ----- the list, and deleting it -----

await check('Show what would be deleted asks the helper for cleanup-preview with no argument, deletes nothing and parses the lines', async () => {
  const world = await worldWith([published]);
  helperSays(world, { 'cleanup-preview': listOutput });
  const answer = await world.router.call('POST', '/cleanup/preview', { body: {} });
  assert.equal(answer.status, 200);
  assert.deepEqual(world.helped, [{ word: 'cleanup-preview', args: [] }]);
  assert.deepEqual(answer.json.items, [
    { kind: 'Tip or news', title: 'Old tip', expiredOn: '2026-08-01', ageDays: 81 },
    { kind: 'Announcement', title: 'Old notice', expiredOn: '2026-09-01', ageDays: 50 },
  ]);
  assert.equal(answer.json.notes.length, 1);
  assert.deepEqual(mutationsOf(world), []);
});

await check('a problem line of the helper reaches the page as a sentence, and a helper that fails is a 502', async () => {
  const world = await worldWith([published]);
  helperSays(world, { 'cleanup-preview': 'error\tSANITY_WRITE_TOKEN is not set on the Teletraan computer. Add it in Settings, Keys.\n' });
  const said = await world.router.call('POST', '/cleanup/preview', { body: {} });
  assert.equal(said.status, 502);
  assert.match(said.json.error, /SANITY_WRITE_TOKEN is not set/);
  helperSays(world, { 'cleanup-preview': new Error('The helper did not answer in time.') });
  const failed = await world.router.call('POST', '/cleanup/preview', { body: {} });
  assert.equal(failed.status, 502);
  assert.match(failed.json.error, /did not answer in time/);
});

await check('Delete these now needs the confirm and the number the owner saw', async () => {
  const world = await worldWith([published]);
  helperSays(world, { 'cleanup-preview': listOutput, 'cleanup-delete': 'result\tDeleted 2 of 2 documents. Backup: backup-x.json\n' + listOutput });
  const bare = await world.router.call('POST', '/cleanup/delete', { body: {} });
  assert.equal(bare.status, 400);
  assert.match(bare.json.error, /Confirm first/);
  const noCount = await world.router.call('POST', '/cleanup/delete', { body: { confirmed: true } });
  assert.equal(noCount.status, 400);
  assert.match(noCount.json.error, /Show what would be deleted first/);
  assert.deepEqual(world.helped, []);
});

await check('Delete these now refuses when the published Mode is Only show', async () => {
  const world = await worldWith([Object.assign({}, published, { cleanupMode: 'list' })]);
  helperSays(world, { 'cleanup-preview': listOutput, 'cleanup-delete': 'result\tDeleted\n' });
  const answer = await world.router.call('POST', '/cleanup/delete', { body: { confirmed: true, expected: 2 } });
  assert.equal(answer.status, 409);
  assert.match(answer.json.error, /Mode is Only show/);
  assert.deepEqual(world.helped, []);
});

await check('Delete these now refuses when the list is not the one the owner agreed to, and when it stopped', async () => {
  const world = await worldWith([published]);
  helperSays(world, { 'cleanup-preview': listOutput, 'cleanup-delete': 'result\tDeleted\n' });
  const changed = await world.router.call('POST', '/cleanup/delete', { body: { confirmed: true, expected: 3 } });
  assert.equal(changed.status, 409);
  assert.match(changed.json.error, /it has 2 documents now, not 3/);
  assert.deepEqual(world.helped.map(entry => entry.word), ['cleanup-preview']);
  helperSays(world, { 'cleanup-preview': 'stop\tStopped, nothing is deleted: 5 of 10 sponsor items.\n' + listOutput, 'cleanup-delete': 'result\tDeleted\n' });
  const stopped = await world.router.call('POST', '/cleanup/delete', { body: { confirmed: true, expected: 2 } });
  assert.equal(stopped.status, 409);
  assert.match(stopped.json.error, /Stopped, nothing is deleted/);
});

await check('Delete these now with a matching list asks the helper for cleanup-delete and gives back its result', async () => {
  const world = await worldWith([published]);
  helperSays(world, { 'cleanup-preview': listOutput, 'cleanup-delete': 'result\tDeleted 2 of 2 documents. Backup: backup-20261021T074000Z.json\n' + listOutput });
  const answer = await world.router.call('POST', '/cleanup/delete', { body: { confirmed: true, expected: 2 } });
  assert.equal(answer.status, 200);
  assert.deepEqual(world.helped.map(entry => entry.word), ['cleanup-preview', 'cleanup-delete']);
  assert.deepEqual(world.helped.map(entry => entry.args), [[], []]);
  assert.match(answer.json.result, /Deleted 2 of 2 documents/);
  assert.equal(answer.json.items.length, 2);
});

// ----- the helper words -----

await check('the helper route knows the two words, asks for no argument and wants a confirm for the delete', async () => {
  assert.ok(helperRoute.words.includes('cleanup-preview') && helperRoute.words.includes('cleanup-delete'));
  const world = await makeWorld([helperRoute]);
  world.ctx.helper = async (word, args) => { world.helped.push({ word, args }); return 'item\tx\ty\t2026-01-01\t5\n'; };
  const preview = await world.router.call('POST', '/helper/cleanup-preview', { body: {} });
  assert.equal(preview.status, 200);
  const bare = await world.router.call('POST', '/helper/cleanup-delete', { body: {} });
  assert.equal(bare.status, 400);
  assert.match(bare.json.error, /Confirm first/);
  const confirmed = await world.router.call('POST', '/helper/cleanup-delete', { body: { confirmed: true } });
  assert.equal(confirmed.status, 200);
  assert.deepEqual(world.helped.map(entry => entry.args), [[], []]);
});

await check('the helper client and the host script list the same two words', () => {
  const client = fs.readFileSync(repo + 'control/lib/helper-client.js', 'utf8');
  const script = fs.readFileSync(repo + 'computer/scripts/control-helper.sh', 'utf8');
  ['cleanup-preview', 'cleanup-delete'].forEach(word => {
    assert.ok(client.includes("'" + word + "'"), word + ' in the client');
    assert.ok(script.includes(word), word + ' in the script');
  });
});

// ----- the card -----

await check('the card has the last run, the three fields, Save, Publish and the preview, and says the Studio shows the same values', () => {
  const now = new Date('2026-10-21T12:00:00Z');
  const page = { hasDocument: true, canWrite: true, isDraft: false, studioNewer: false, setting: { cleanupEnabled: true, cleanupDeleteAfterDays: 21, cleanupMode: 'delete' }, published: { cleanupMode: 'delete' }, status: { lastAt: '2026-10-21T07:40:00Z', wouldDelete: 4, deleted: 3, error: 'One could not be deleted (status 409).' } };
  const html = cleanupHtml(page, now);
  assert.match(html, /Last run: 4 hours ago, 4 on the list, 3 deleted/);
  assert.match(html, /data-problem>One could not be deleted/);
  assert.match(html, /data-enabled checked/);
  assert.match(html, /data-days[^>]*value="21"/);
  assert.match(html, /data-mode value="delete" checked/);
  assert.match(html, /data-save>Save to draft/);
  assert.match(html, /data-publish>Publish/);
  assert.match(html, /data-preview>Show what would be deleted now/);
  assert.doesNotMatch(html, /data-delete/, 'the delete button is drawn after a list, not before');
  assert.match(html, /Dashboard Settings, Advanced, Clean up expired items/);
});

await check('the list shows each item, the stop and the notes, and a title from the computer is escaped', () => {
  const html = listHtml({ items: [{ kind: 'Tip or news', title: '<img src=x>', expiredOn: '2026-08-01', ageDays: 81 }], notes: ['Kept "x" because <b>'], stop: '' });
  assert.match(html, /1 document<\/strong> would be deleted/);
  assert.doesNotMatch(html, /<img|<b>/);
  assert.match(listHtml({ items: [], notes: [], stop: '' }), /Nothing is old enough to delete/);
  assert.match(listHtml({ items: [], notes: [], stop: 'Stopped, nothing is deleted: 5 of 10.' }), /class="warn">Stopped/);
});

await check('the delete question says how many documents and that a backup is made first', () => {
  assert.match(deleteQuestion(3), /Delete 3 documents from the Studio now\? A backup of them is saved/);
  assert.match(deleteQuestion(1), /Delete 1 document from the Studio now\? A backup of it is saved/);
  assert.match(deleteQuestion(2), /docs\/expired-cleanup\.md/);
  assert.match(publishQuestion, /every waiting change of Dashboard Settings/);
});

await check('with nothing done the status says so in plain words, and an empty page of the computer has a warning', () => {
  assert.deepEqual(statusWords({}, new Date()), { last: 'Last run: not yet', problem: '' });
  const html = cleanupHtml({ hasDocument: false, canWrite: false, setting: defaults, published: defaults, status: { unreadable: true } }, new Date());
  assert.match(html, /has not been published yet/);
  assert.match(html, /SANITY_WRITE_TOKEN is not set/);
  assert.match(html, /so there is no delete button/);
});

console.log('\n' + passed + ' passed');
