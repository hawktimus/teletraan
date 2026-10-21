// The Photos and Announcements blocks of the Content tab, on the server side: the photo list (a picture address no wider than 480
// pixels, newest first), the upload route (type, size and first-bytes checks, the write key kept out of every answer, a draft that
// points at the stored asset), the Photos source read, and Post now for an announcement. A fake Sanity that remembers and has an
// asset store; nothing leaves the process.
//
//   node tests/control-photos-announcements.test.mjs

import assert from 'node:assert/strict';
import * as collection from '../control/routes/collection-doc.js';
import * as content from '../control/routes/content.js';
import * as upload from '../control/routes/photo-upload.js';
import { makeWorld } from './helpers/control-world.mjs';
import { makeFakeSanity } from './helpers/fake-sanity.mjs';
import { announcementChips, announcementState, liveCount, photoFileProblem, sortAnnouncements, sortPhotos } from '../control/static/tabs/content-items.js';

let passed = 0;
async function check(name, test) {
  await test();
  passed += 1;
  console.log('PASS  ' + name);
}

const docs = () => [
  { _id: 'team-nova', _type: 'team', name: 'HAWKTIMUS NOVA', code: 'nova', active: true },
  { _id: 'photo-old', _type: 'photo', _createdAt: '2026-09-01T10:00:00Z', image: { _type: 'image', asset: { _type: 'reference', _ref: 'image-aaa111-4000x3000-jpg' } }, caption: 'Pit crew', credit: 'Sam', show: true, fit: 'setting' },
  { _id: 'photo-new', _type: 'photo', _createdAt: '2026-10-01T10:00:00Z', image: { _type: 'image', asset: { _type: 'reference', _ref: 'image-bbb222-2000x1500-png' } }, caption: 'Field test', show: false, fit: 'whole' },
  { _id: 'dashboardSettings', _type: 'dashboardSettings', photoSource: 'both', photoDriveFolder: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp?usp=sharing' },
  { _id: 'status-mini', _type: 'status', photosDriveAt: '2026-10-20T10:00:00Z', photosDriveCount: 12, photosDriveState: 'ok' },
];

async function worldWith(documents = docs(), options = {}) {
  const world = await makeWorld([collection, content, upload], options);
  const sanity = makeFakeSanity(documents);
  world.ctx.fetch = sanity.fetch;
  world.sanity = sanity;
  return world;
}

const call = (world, method, url, body, headers) => world.router.call(method, url, { body: body, headers: headers });
const jpeg = size => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(size)]);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(40)]);
const sends = (kind, extra = {}) => Object.assign({ 'content-type': kind }, extra);

await check('the photo list asks Sanity for each picture at 480 pixels at most, never the original, and keeps when it was made', async () => {
  const world = await worldWith();
  const answer = await call(world, 'GET', '/docs/photo');
  assert.equal(answer.status, 200);
  const old = answer.json.items.filter(item => item.id === 'photo-old')[0];
  assert.match(old.picture, /^https:\/\/cdn\.sanity\.io\/images\/[a-z0-9]+\/[A-Za-z0-9_-]+\/aaa111-4000x3000\.jpg\?w=480&fit=max&auto=format$/);
  answer.json.items.forEach(item => assert.ok(/w=480/.test(item.picture) && !/w=(?!480)/.test(item.picture), 'only the small size is asked for'));
  assert.equal(old.createdAt, '2026-09-01T10:00:00Z');
  assert.deepEqual(sortPhotos(answer.json.items).map(item => item.id), ['photo-new', 'photo-old'], 'newest first');
  assert.ok(!answer.text.includes('skFAKEtoken'));
});

await check('a photo is edited with the limits of the Studio: caption 36, credit 14 and a first name, and the picture cannot be replaced', async () => {
  const world = await worldWith();
  const item = (await call(world, 'GET', '/docs/photo')).json.items.filter(one => one.id === 'photo-old')[0];
  const long = await call(world, 'POST', '/docs/photo/photo-old/save', { baseRev: item.rev, set: { caption: 'x'.repeat(37) } });
  assert.equal(long.status, 400);
  assert.match(long.json.error, /36/);
  const name = await call(world, 'POST', '/docs/photo/photo-old/save', { baseRev: item.rev, set: { credit: 'Sam Smith' } });
  assert.equal(name.status, 400);
  const picture = await call(world, 'POST', '/docs/photo/photo-old/save', { baseRev: item.rev, set: { image: { asset: { _ref: 'image-zzz-1x1-jpg' } } } });
  assert.equal(picture.status, 400, 'the picture is not a field of the form');
  const fine = await call(world, 'POST', '/docs/photo/photo-old/save', { baseRev: item.rev, set: { caption: 'Pit crew at work', credit: 'Sam', fit: 'fill', show: false, expires: '2027-01-01T00:00:00.000Z' } });
  assert.equal(fine.status, 200);
  const draft = world.sanity.stored['drafts.photo-old'];
  assert.equal(draft.fit, 'fill');
  assert.equal(draft.show, false);
  assert.equal(draft.image.asset._ref, 'image-aaa111-4000x3000-jpg', 'the picture is as it was');
});

await check('an upload of each allowed kind is stored, a draft that points at the asset is made, switched on, with the caption and credit', async () => {
  const world = await worldWith();
  for (const [kind, bytes] of [['image/jpeg', jpeg(500)], ['image/png', png], ['image/webp', webp]]) {
    const before = world.sanity.uploads.length;
    const answer = await call(world, 'POST', '/photo-upload', bytes, sends(kind, { 'x-caption': encodeURIComponent('Drive team, round 3'), 'x-credit': encodeURIComponent('Ana') }));
    assert.equal(answer.status, 200, kind);
    assert.equal(world.sanity.uploads.length, before + 1);
    const sent = world.sanity.uploads[world.sanity.uploads.length - 1];
    assert.equal(sent.contentType, kind);
    assert.equal(sent.authorized, true, 'the write key was sent to Sanity');
    assert.ok(/^photo\.(jpg|png|webp)$/.test(sent.filename), 'no file name of the person is sent');
    const made = world.sanity.stored['drafts.' + answer.json.id];
    assert.equal(made._type, 'photo');
    assert.match(made.image.asset._ref, /^image-fake\d+abcdef-800x600-jpg$/);
    assert.equal(made.caption, 'Drive team, round 3');
    assert.equal(made.credit, 'Ana');
    assert.equal(made.show, true);
    assert.equal(made.fit, 'setting');
    assert.equal(world.sanity.stored[answer.json.id], undefined, 'nothing is published');
    assert.ok(!answer.text.includes('skFAKEtoken'));
  }
  assert.ok(!JSON.stringify(world.logged).includes('skFAKEtoken'));
});

await check('an upload with no caption or credit still makes a draft', async () => {
  const world = await worldWith();
  const answer = await call(world, 'POST', '/photo-upload', jpeg(10), sends('image/jpeg'));
  assert.equal(answer.status, 200);
  const made = world.sanity.stored['drafts.' + answer.json.id];
  assert.equal(made.caption, undefined);
  assert.equal(made.credit, undefined);
});

await check('anything that is not a JPEG, PNG or WebP is refused with a plain sentence and nothing is sent to Sanity', async () => {
  const world = await worldWith();
  const mutations = world.sanity.log.length;
  for (const kind of ['image/gif', 'image/svg+xml', 'application/pdf', 'text/html', '']) {
    const answer = await call(world, 'POST', '/photo-upload', jpeg(10), sends(kind));
    assert.equal(answer.status, 415, kind);
    assert.match(answer.json.error, /Only JPEG, PNG or WebP/);
  }
  const noType = await call(world, 'POST', '/photo-upload', jpeg(10), {});
  assert.equal(noType.status, 415);
  assert.equal(world.sanity.uploads.length, 0);
  assert.equal(world.sanity.log.length, mutations);
});

await check('the first bytes must match the kind: a text file or a PNG named as a JPEG is refused', async () => {
  const world = await worldWith();
  const text = await call(world, 'POST', '/photo-upload', Buffer.from('<html>not a picture</html>'), sends('image/jpeg'));
  assert.equal(text.status, 415);
  assert.match(text.json.error, /not really a JPEG/);
  const wrong = await call(world, 'POST', '/photo-upload', png, sends('image/jpeg'));
  assert.equal(wrong.status, 415);
  const wrongWebp = await call(world, 'POST', '/photo-upload', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVEfmt '), Buffer.alloc(20)]), sends('image/webp'));
  assert.equal(wrongWebp.status, 415, 'RIFF alone is not a WebP');
  const empty = await call(world, 'POST', '/photo-upload', undefined, sends('image/png'));
  assert.equal(empty.status, 400);
  assert.equal(world.sanity.uploads.length, 0);
});

await check('a picture over 15 MB is refused, by its declared size before it is read and by its real size when none is declared', async () => {
  const world = await worldWith();
  const declared = await call(world, 'POST', '/photo-upload', jpeg(10), sends('image/jpeg', { 'content-length': String(upload.mostBytes + 1) }));
  assert.equal(declared.status, 413);
  assert.match(declared.json.error, /too big/);
  const real = await call(world, 'POST', '/photo-upload', jpeg(upload.mostBytes), sends('image/jpeg'));
  assert.equal(real.status, 413);
  const exact = await call(world, 'POST', '/photo-upload', Buffer.concat([jpeg(0), Buffer.alloc(upload.mostBytes - 4)]), sends('image/jpeg'));
  assert.equal(exact.status, 200, 'exactly 15 MB is allowed');
  assert.equal(world.sanity.uploads.length, 1);
});

await check('a caption or credit that is too long, has a full name, an email or a phone number is refused before the picture is sent', async () => {
  const world = await worldWith();
  const tries = [
    { 'x-caption': encodeURIComponent('x'.repeat(37)) },
    { 'x-credit': encodeURIComponent('Sam Smith') },
    { 'x-credit': encodeURIComponent('Sam2') },
    { 'x-credit': encodeURIComponent('a'.repeat(15)) },
    { 'x-credit': encodeURIComponent('sam@example.org') },
    { 'x-caption': encodeURIComponent('Call 555-123-4567') },
    { 'x-caption': '%E0%A4%A' },
  ];
  for (const extra of tries) {
    const answer = await call(world, 'POST', '/photo-upload', jpeg(10), sends('image/jpeg', extra));
    assert.equal(answer.status, 400, JSON.stringify(extra));
  }
  assert.equal(world.sanity.uploads.length, 0);
});

await check('without the write key nothing is uploaded, and a key Sanity does not accept is reported without printing it', async () => {
  const none = await worldWith(docs(), { env: "CONTROL_PIN='123456'\n" });
  const refused = await call(none, 'POST', '/photo-upload', jpeg(10), sends('image/jpeg'));
  assert.equal(refused.status, 503);
  assert.match(refused.json.error, /SANITY_WRITE_TOKEN/);
  assert.equal(none.sanity.uploads.length, 0);

  const bad = await worldWith();
  const original = bad.ctx.fetch;
  bad.ctx.fetch = async (url, init) => (String(url).includes('/assets/images/') ? { ok: false, status: 401, json: async () => ({}) } : original(url, init));
  const denied = await call(bad, 'POST', '/photo-upload', jpeg(10), sends('image/jpeg'));
  assert.equal(denied.status, 502);
  assert.ok(!denied.text.includes('skFAKEtoken'));
});

await check('the route is behind the PIN', async () => {
  const world = await worldWith(docs(), { pin: false });
  const answer = await call(world, 'POST', '/photo-upload', jpeg(10), sends('image/jpeg'));
  assert.equal(answer.status, 401);
  assert.equal(world.sanity.uploads.length, 0);
});

await check('the Photos source is read as published: upload, Drive or both, the end of the folder id, and the last read', async () => {
  const world = await worldWith();
  const answer = await call(world, 'GET', '/content/photo-source');
  assert.equal(answer.status, 200);
  assert.deepEqual(answer.json, { source: 'both', folderEnd: '1AbCdEfGhIjKlMnOp'.slice(-6), read: { at: '2026-10-20T10:00:00Z', count: 12, state: 'ok' } });
  const upload = await worldWith([{ _id: 'dashboardSettings', _type: 'dashboardSettings' }]);
  assert.deepEqual((await call(upload, 'GET', '/content/photo-source')).json, { source: 'upload', folderEnd: '', read: null });
});

// ----- announcements -----

const hour = 3600000;
const announcement = (id, start, end, extra = {}) => Object.assign({ _id: id, _type: 'announcement', text: 'Pizza at 6', start: new Date(start).toISOString(), end: new Date(end).toISOString(), level: 'notice' }, extra);

await check('an announcement is Live now, Waiting or Over from its start and end, and an unpublished one is never live', () => {
  const now = new Date();
  const item = (start, end, published = true) => ({ published: published, isDraft: !published, document: announcement('a', start, end) });
  assert.equal(announcementState(item(now - hour, +now + hour), now).words, 'Live now');
  assert.equal(announcementState(item(+now + hour, +now + 2 * hour), now).words, 'Waiting');
  assert.equal(announcementState(item(now - 2 * hour, now - hour), now).words, 'Over');
  assert.equal(announcementState(item(now - hour, +now + hour, false), now).words, 'Waiting', 'a draft is not on the wall');
  assert.equal(announcementState({ published: true, document: { text: 'x' } }, now), null);
  assert.deepEqual(announcementChips(item(now - hour, +now + hour), now).map(chip => chip.id), ['live']);
  assert.deepEqual(announcementChips(item(now - hour, +now + hour, false), now).map(chip => chip.id), ['waiting', 'new']);
  assert.equal(liveCount([item(now - hour, +now + hour), item(now - hour, +now + hour), item(now - 2 * hour, now - hour)], now), 2);
  assert.deepEqual(sortAnnouncements([item(now - 2 * hour, now - hour), item(+now + hour, +now + 2 * hour)]).map(one => one.document.start < new Date().toISOString()), [false, true], 'the latest start is first');
});

await check('the announcements list has the real fields: text up to 90, start, end, team and level, and no Show switch', async () => {
  const now = Date.now();
  const world = await worldWith(docs().concat([announcement('an-1', now - hour, now + hour)]));
  const list = await call(world, 'GET', '/docs/announcement');
  assert.equal(list.status, 200);
  assert.equal(list.json.items.length, 1);
  const item = list.json.items[0];
  const tooLong = await call(world, 'POST', '/docs/announcement/an-1/save', { baseRev: item.rev, set: { text: 'x'.repeat(91) } });
  assert.equal(tooLong.status, 400);
  const made = await call(world, 'POST', '/docs/announcement', { set: { text: 'Pizza at 6', start: new Date(now).toISOString(), end: new Date(now + hour).toISOString(), level: 'important' } });
  assert.equal(made.status, 200);
  const show = await call(world, 'POST', '/docs/announcement/an-1/save', { baseRev: item.rev, set: { show: false } });
  assert.equal(show.status, 400, 'there is no Show field to set');
});

await check('Post now makes a published announcement that starts now, ends in the minutes asked, and never replaces another', async () => {
  const world = await worldWith();
  const before = Date.now();
  const first = await call(world, 'POST', '/content/announcement/post', { text: '  Meeting moved to 5:30  ', level: 'important', minutes: 30 });
  assert.equal(first.status, 200);
  const doc = world.sanity.stored[first.json.id];
  assert.equal(doc._type, 'announcement');
  assert.equal(doc.text, 'Meeting moved to 5:30');
  assert.equal(doc.level, 'important');
  assert.ok(Math.abs(Date.parse(doc.start) - before) < 5000);
  assert.equal(Date.parse(doc.end) - Date.parse(doc.start), 30 * 60000);
  assert.equal(doc.team, undefined);
  assert.notEqual(first.json.id, 'push-notice');
  assert.equal(world.sanity.stored['drafts.' + first.json.id], undefined, 'published at once, no draft');
  const second = await call(world, 'POST', '/content/announcement/post', { text: 'Second', minutes: 5, team: 'team-nova' });
  assert.equal(second.status, 200);
  assert.notEqual(second.json.id, first.json.id);
  assert.equal(world.sanity.stored[second.json.id].team._ref, 'team-nova');
  assert.equal(world.sanity.stored[second.json.id].level, 'notice');
  assert.ok(world.sanity.stored[first.json.id], 'the first one is still there');
});

await check('Post now refuses an empty or long text, minutes out of range, an unknown level or team, and no write key', async () => {
  const world = await worldWith();
  const bad = [{ text: '' }, { text: 'x'.repeat(91) }, { text: 'Hi', minutes: 0 }, { text: 'Hi', minutes: 61 }, { text: 'Hi', minutes: 1.5 }, { text: 'Hi', level: 'red' }, { text: 'Hi', team: 'team-nobody' }];
  for (const body of bad) assert.equal((await call(world, 'POST', '/content/announcement/post', body)).status, 400, JSON.stringify(body));
  assert.equal(Object.values(world.sanity.stored).filter(doc => doc._type === 'announcement').length, 0);
  const none = await worldWith(docs(), { env: "CONTROL_PIN='123456'\n" });
  assert.equal((await call(none, 'POST', '/content/announcement/post', { text: 'Hi' })).status, 503);
});

await check('the file check of the page names the same three kinds and the 15 MB limit', () => {
  assert.equal(photoFileProblem({ type: 'image/jpeg', size: 1000 }), '');
  assert.equal(photoFileProblem({ type: 'image/webp', size: upload.mostBytes }), '');
  assert.match(photoFileProblem({ type: 'image/gif', size: 1000 }), /Only JPEG, PNG or WebP/);
  assert.match(photoFileProblem({ type: 'image/png', size: upload.mostBytes + 1 }), /15 MB/);
  assert.match(photoFileProblem(null), /Pick a picture/);
  assert.deepEqual(upload.kinds, ['image/jpeg', 'image/png', 'image/webp']);
});

console.log('\n' + passed + ' of ' + passed + ' passed');
