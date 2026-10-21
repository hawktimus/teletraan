// Tests for the Scheduled reboot card of the control page: the route (control/routes/reboot.js), what it checks and writes
// (control/support/reboot.js) and the markup of the card (control/static/tabs/settings-reboot.js). A fake Sanity and a temporary data
// folder; nothing leaves the process.
//
//   node tests/control-reboot.test.mjs

import assert from 'node:assert/strict';
import * as reboot from '../control/routes/reboot.js';
import * as logic from '../control/support/reboot.js';
import { publishQuestion, rebootHtml, statusWords } from '../control/static/tabs/settings-reboot.js';
import { defaults } from '../computer/scripts/reboot-plan.mjs';
import { makeWorld } from './helpers/control-world.mjs';

let passed = 0;
async function check(name, test) {
  await test();
  passed += 1;
  console.log('PASS  ' + name);
}

const settingsKey = '"drafts.dashboardSettings"]';
const published = { _id: 'dashboardSettings', _type: 'dashboardSettings', _rev: 'rev-pub', _updatedAt: '2026-10-18T10:00:00Z', pageSeconds: 25, rebootEnabled: true, rebootTime: '04:15', rebootDays: [1, 2, 3], rebootSkipBusy: true, rebootWaitMinutes: 20 };
const draft = Object.assign({}, published, { _id: 'drafts.dashboardSettings', _rev: 'rev-draft', _updatedAt: '2026-10-18T11:00:00Z', rebootTime: '05:00' });
const miniStatus = { result: { status: { nextRebootAt: '2026-10-21T08:15:00.000Z', nextRebootText: 'Wed 04:15', lastRebootAt: '2026-10-20T08:15:00Z', lastRebootWhy: 'Tue 04:15, as scheduled' }, zone: 'America/New_York' } };

async function worldWith(docs, options = {}) {
  return makeWorld([reboot], { answers: { [settingsKey]: { result: docs }, 'status-mini': miniStatus }, ...options });
}

const mutationsOf = world => world.fetched.filter(call => call.url.includes('/data/mutate/')).map(call => JSON.parse(call.init.body).mutations);

// ----- reading -----

await check('GET gives the setting of the draft, the published one, and the next and last reboot', async () => {
  const world = await worldWith([published, draft]);
  const answer = await world.router.call('GET', '/reboot');
  assert.equal(answer.status, 200);
  assert.equal(answer.json.setting.rebootTime, '05:00');
  assert.equal(answer.json.published.rebootTime, '04:15');
  assert.deepEqual(answer.json.setting.rebootDays, [1, 2, 3]);
  assert.equal(answer.json.rev, 'rev-draft');
  assert.equal(answer.json.canWrite, true);
  assert.equal(answer.json.status.nextText, 'Wed 04:15');
  assert.equal(answer.json.status.lastWhy, 'Tue 04:15, as scheduled');
  assert.equal(answer.json.status.zone, 'America/New_York');
  assert.deepEqual(mutationsOf(world), []);
});

await check('a Dashboard Settings with no reboot fields shows the starting values: off, 03:30, every day, 30 minutes', async () => {
  const world = await worldWith([Object.assign({}, published, { rebootEnabled: undefined, rebootTime: undefined, rebootDays: undefined, rebootSkipBusy: undefined, rebootWaitMinutes: undefined })]);
  const answer = await world.router.call('GET', '/reboot');
  assert.deepEqual(answer.json.setting, defaults);
});

await check('when the status cannot be read the card still opens, and says so', async () => {
  const world = await worldWith([published]);
  const plain = world.ctx.fetch;
  world.ctx.fetch = async (url, init) => {
    if (decodeURIComponent(String(url)).includes('status-mini')) throw new Error('the network is down');
    return plain(url, init);
  };
  const answer = await world.router.call('GET', '/reboot');
  assert.equal(answer.status, 200);
  assert.equal(answer.json.status.unreadable, true);
  assert.equal(answer.json.status.nextText, '');
});

await check('when Dashboard Settings cannot be read the card gets a sentence, not a code', async () => {
  const world = await worldWith([published], { offline: true });
  const answer = await world.router.call('GET', '/reboot');
  assert.equal(answer.status, 502);
  assert.match(answer.json.error, /could not read Dashboard Settings/);
});

// ----- checking what the page sent -----

await check('a value out of range is refused in words and not corrected', () => {
  const bad = (setting, words) => assert.throws(() => logic.cleanSetting(setting), error => error.status === 400 && words.test(error.message), JSON.stringify(setting));
  bad({ rebootEnabled: 'yes' }, /on or off/);
  bad({ rebootTime: '3:30' }, /24 hour time/);
  bad({ rebootTime: '24:00' }, /24 hour time/);
  bad({ rebootDays: [] }, /at least one day/);
  bad({ rebootDays: [7] }, /at least one day/);
  bad({ rebootDays: [1.5] }, /at least one day/);
  bad({ rebootSkipBusy: 1 }, /on or off/);
  bad({ rebootWaitMinutes: 0 }, /1 to 120/);
  bad({ rebootWaitMinutes: 121 }, /1 to 120/);
  bad({ rebootWaitMinutes: 30.5 }, /whole number/);
  bad({}, /nothing to save/);
  bad('no', /object/);
  bad({ pageSeconds: 30 }, /nothing to save/);
});

await check('a good setting is stored with the Studio field names, days in order once each, and nothing else', () => {
  const out = logic.cleanSetting({ rebootEnabled: true, rebootTime: '03:30', rebootDays: [6, 0, 6, 2], rebootSkipBusy: false, rebootWaitMinutes: 45, pageSeconds: 99 });
  assert.deepEqual(out, { rebootEnabled: true, rebootTime: '03:30', rebootDays: [0, 2, 6], rebootSkipBusy: false, rebootWaitMinutes: 45 });
  assert.deepEqual(logic.cleanSetting({ rebootTime: '23:59' }), { rebootTime: '23:59' });
});

// ----- saving -----

await check('Save writes the five fields to the draft only, with the revision it was read at', async () => {
  const world = await worldWith([published, draft]);
  const answer = await world.router.call('POST', '/reboot/save', { body: { setting: { rebootEnabled: true, rebootTime: '03:30', rebootDays: [1, 2, 3, 4, 5], rebootSkipBusy: true, rebootWaitMinutes: 30 }, baseRev: 'rev-draft' } });
  assert.equal(answer.status, 200);
  const sent = mutationsOf(world);
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0].patch.id, 'drafts.dashboardSettings');
  assert.equal(sent[0][0].patch.ifRevisionID, 'rev-draft');
  assert.deepEqual(Object.keys(sent[0][0].patch.set).sort(), ['rebootDays', 'rebootEnabled', 'rebootSkipBusy', 'rebootTime', 'rebootWaitMinutes']);
  assert.ok(sent[0].every(mutation => !mutation.createOrReplace && !mutation.delete), 'nothing is published');
});

await check('Save with no draft makes one from the published document first', async () => {
  const world = await worldWith([published]);
  const answer = await world.router.call('POST', '/reboot/save', { body: { setting: { rebootTime: '02:00' }, baseRev: 'rev-pub' } });
  assert.equal(answer.status, 200);
  const sent = mutationsOf(world)[0];
  assert.equal(sent[0].createIfNotExists._id, 'drafts.dashboardSettings');
  assert.equal(sent[0].createIfNotExists.pageSeconds, 25);
  assert.deepEqual(sent[1].patch.set, { rebootTime: '02:00' });
});

await check('Save asks before it overwrites a newer Studio edit, and a forced Save writes', async () => {
  const world = await worldWith([published, draft]);
  const stale = await world.router.call('POST', '/reboot/save', { body: { setting: { rebootTime: '02:00' }, baseRev: 'rev-old' } });
  assert.equal(stale.status, 409);
  assert.equal(stale.json.conflict, true);
  assert.deepEqual(mutationsOf(world), []);
  const forced = await world.router.call('POST', '/reboot/save', { body: { setting: { rebootTime: '02:00' }, baseRev: 'rev-old', force: true } });
  assert.equal(forced.status, 200);
  assert.equal(mutationsOf(world).length, 1);
});

await check('Save needs the write key and says where to add it', async () => {
  const world = await worldWith([published], { env: "CONTROL_PIN='123456'\n" });
  const answer = await world.router.call('POST', '/reboot/save', { body: { setting: { rebootTime: '02:00' }, baseRev: 'rev-pub' } });
  assert.equal(answer.status, 503);
  assert.match(answer.json.error, /SANITY_WRITE_TOKEN is not set/);
});

await check('the write key is never in an answer or in the log', async () => {
  const world = await worldWith([published, draft]);
  const answers = [
    await world.router.call('GET', '/reboot'),
    await world.router.call('POST', '/reboot/save', { body: { setting: { rebootTime: '02:00' }, baseRev: 'rev-draft' } }),
    await world.router.call('POST', '/reboot/publish', { body: { rev: 'rev-draft', confirm: true } }),
  ];
  answers.forEach(answer => assert.doesNotMatch(answer.text, /skFAKEtoken/));
  assert.doesNotMatch(world.logged.join('\n'), /skFAKEtoken/);
});

// ----- publishing -----

await check('Publish does nothing until the owner has confirmed', async () => {
  const world = await worldWith([published, draft]);
  const none = await world.router.call('POST', '/reboot/publish', { body: { rev: 'rev-draft' } });
  assert.equal(none.status, 400);
  assert.match(none.json.error, /Confirm the publish first/);
  const no = await world.router.call('POST', '/reboot/publish', { body: { rev: 'rev-draft', confirm: 'yes' } });
  assert.equal(no.status, 400);
  assert.deepEqual(mutationsOf(world), []);
});

await check('a confirmed Publish makes the draft the published document and removes the draft', async () => {
  const world = await worldWith([published, draft]);
  const answer = await world.router.call('POST', '/reboot/publish', { body: { rev: 'rev-draft', confirm: true } });
  assert.equal(answer.status, 200);
  const sent = mutationsOf(world)[0];
  assert.equal(sent[0].createOrReplace._id, 'dashboardSettings');
  assert.equal(sent[0].createOrReplace.rebootTime, '05:00');
  assert.deepEqual(sent[1], { delete: { id: 'drafts.dashboardSettings' } });
});

await check('Publish refuses a draft that moved since it was saved, and publishes when forced', async () => {
  const world = await worldWith([published, draft]);
  const moved = await world.router.call('POST', '/reboot/publish', { body: { rev: 'rev-older', confirm: true } });
  assert.equal(moved.status, 409);
  assert.equal(moved.json.conflict, true);
  assert.deepEqual(mutationsOf(world), []);
  const forced = await world.router.call('POST', '/reboot/publish', { body: { rev: 'rev-older', confirm: true, force: true } });
  assert.equal(forced.status, 200);
});

await check('Publish with no draft says there is nothing to publish', async () => {
  const world = await worldWith([published]);
  const answer = await world.router.call('POST', '/reboot/publish', { body: { rev: 'rev-pub', confirm: true } });
  assert.equal(answer.status, 409);
  assert.match(answer.json.error, /nothing to publish/);
});

// ----- the card -----

await check('the card has the status words, the five fields, Save and Publish, and says the Studio shows the same values', () => {
  const now = new Date('2026-10-20T12:15:00Z');
  const page = { hasDocument: true, canWrite: true, isDraft: false, studioNewer: false, setting: { rebootEnabled: true, rebootTime: '04:15', rebootDays: [1, 2], rebootSkipBusy: true, rebootWaitMinutes: 20 }, status: { nextText: 'Wed 04:15', lastAt: '2026-10-20T08:15:00Z', lastWhy: 'Tue 04:15, as scheduled', zone: 'America/New_York' } };
  const html = rebootHtml(page, now);
  assert.match(html, /Next reboot: Wed 04:15/);
  assert.match(html, /Last reboot: 4 hours ago \(Tue 04:15, as scheduled\)/);
  assert.match(html, /checked data-enabled/);
  assert.match(html, /data-time value="04:15"/);
  assert.equal((html.match(/data-day="/g) || []).length, 7);
  assert.equal((html.match(/checked data-day="[0-6]"/g) || []).length, 2);
  assert.match(html, /data-wait[^>]*value="20"/);
  assert.match(html, /data-draft/, 'the shared bar is drawn into this place');
  assert.match(html, /The Studio shows the same values in Dashboard Settings, Advanced, Scheduled reboot/);
  assert.match(html, /America\/New_York/);
});

await check('with nothing planned and nothing done the status says so in plain words', () => {
  assert.deepEqual(statusWords({}, new Date()), { next: 'Next reboot: none planned', last: 'Last reboot: not yet' });
  assert.equal(statusWords({ nextText: 'Tue 03:30' }, new Date()).next, 'Next reboot: Tue 03:30');
});

await check('words from the computer are escaped in the card, and the publish question says it publishes everything waiting', () => {
  const page = { hasDocument: true, canWrite: false, setting: defaults, status: { lastAt: '2026-10-20T08:15:00Z', lastWhy: '<img src=x>', zone: '<b>' } };
  const html = rebootHtml(page, new Date('2026-10-20T12:15:00Z'));
  assert.doesNotMatch(html, /<img|<b>/);
  assert.match(html, /SANITY_WRITE_TOKEN is not set/);
  assert.match(publishQuestion, /every waiting change of Dashboard Settings/);
});

console.log('\n' + passed + ' passed');
