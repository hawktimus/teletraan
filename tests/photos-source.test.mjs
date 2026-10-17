// Tests for the photos that come from a Google Drive folder, on the screen side (dashboard/core/photos-drive.js)
// and in the Photo panel's own rules: mixing them with the Studio photos by the Photo source setting, the
// tidy of a manifest that is missing or broken, the sample content and the settings check.
//
//   node tests/photos-source.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { drivePhotosFrom, drivePhotosFolder, mixPhotos, photoSourceOf, readDrivePhotos, usesDrive, usesUpload } from '../dashboard/core/photos-drive.js';
import { photosToShow, makePhotoQueue } from '../dashboard/core/photos.js';
import { photoSources, defaultSettings } from '../dashboard/config.js';
import { fixSettingValues } from '../dashboard/core/content-tidy.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const folder = 'data/live/photos/';

const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

const entry = (file, extra) => Object.assign({ id: file, name: file, file, modified: '2027-03-01T10:00:00.000Z', width: 1600, height: 900, credit: '', caption: '' }, extra || {});
const manifest = photos => ({ ok: true, fetchedAt: '2027-03-01T10:05:00Z', folder: 'x', photos });
const studio = [{ id: 'studio-1', address: 'https://cdn.example/a.jpg', caption: 'From Studio', createdAt: '2027-01-01T00:00:00Z', show: true }];

test('the sources are upload, drive and both, and upload is the starting value', () => {
  assert.deepEqual(photoSources, ['upload', 'drive', 'both']);
  assert.equal(defaultSettings.photoSource, 'upload');
  assert.equal(photoSourceOf({}), 'upload');
  assert.equal(photoSourceOf({ photoSource: 'nonsense' }), 'upload');
  assert.equal(photoSourceOf(undefined), 'upload');
  assert.deepEqual([usesUpload({ photoSource: 'upload' }), usesDrive({ photoSource: 'upload' })], [true, false]);
  assert.deepEqual([usesUpload({ photoSource: 'drive' }), usesDrive({ photoSource: 'drive' })], [false, true]);
  assert.deepEqual([usesUpload({ photoSource: 'both' }), usesDrive({ photoSource: 'both' })], [true, true]);
});

test('settings with an odd photo source are put right', () => {
  const settings = Object.assign({}, defaultSettings, { photoSource: 'cloud' });
  fixSettingValues(settings);
  assert.equal(settings.photoSource, 'upload');
  const good = Object.assign({}, defaultSettings, { photoSource: 'both' });
  fixSettingValues(good);
  assert.equal(good.photoSource, 'both');
});

test('a manifest becomes photos the panel can show, with the change time on the address', () => {
  const photos = drivePhotosFrom(manifest([entry('idA.jpg', { credit: 'Maria', caption: 'Pit crew' }), entry('idB.png')]), folder);
  assert.equal(photos.length, 2);
  assert.deepEqual(photos[0], { id: 'drive-idA.jpg', address: 'data/live/photos/idA.jpg?v=2027-03-01T10%3A00%3A00.000Z', caption: 'Pit crew', credit: 'Maria', createdAt: '2027-03-01T10:00:00.000Z', show: true });
  assert.equal(photosToShow({ photos }).length, 2, 'the panel shows them');
});

test('an entry that is odd is left out and a credit that is not a first name is dropped', () => {
  const photos = drivePhotosFrom(manifest([
    entry('../escape.jpg'),
    entry('a b.jpg'),
    entry('doc.pdf'),
    { id: 'x' },
    null,
    'text',
    entry('ok1.jpg', { credit: 'Mary Smith' }),
    entry('ok2.jpg', { credit: 'Maximilianalexandria' }),
    entry('ok3.jpg', { caption: 'c'.repeat(80) }),
  ]), folder);
  assert.deepEqual(photos.map(photo => photo.id), ['drive-ok1.jpg', 'drive-ok2.jpg', 'drive-ok3.jpg']);
  assert.equal(photos[0].credit, '');
  assert.equal(photos[1].credit, '');
  assert.equal(photos[2].caption.length, 36);
});

test('a manifest that is missing, broken, failed or empty gives no photos and never throws', () => {
  [undefined, null, 5, 'text', [], {}, { ok: false, photos: [entry('a.jpg')] }, { ok: true }, { ok: true, photos: 'no' }, manifest([])].forEach(value => {
    assert.deepEqual(drivePhotosFrom(value, folder), [], JSON.stringify(value));
  });
});

test('no more than 200 photos are used', () => {
  const many = Array.from({ length: 230 }, (item, index) => entry('f' + index + '.jpg'));
  assert.equal(drivePhotosFrom(manifest(many), folder).length, 200);
});

test('the source decides which lists play: upload alone, drive alone or both', () => {
  const drive = drivePhotosFrom(manifest([entry('idA.jpg')]), folder);
  assert.deepEqual(mixPhotos(studio, drive, { photoSource: 'upload' }).map(photo => photo.id), ['studio-1']);
  assert.deepEqual(mixPhotos(studio, drive, { photoSource: 'drive' }).map(photo => photo.id), ['drive-idA.jpg']);
  assert.deepEqual(mixPhotos(studio, drive, { photoSource: 'both' }).map(photo => photo.id), ['studio-1', 'drive-idA.jpg']);
  assert.deepEqual(mixPhotos(studio, drive, {}).map(photo => photo.id), ['studio-1'], 'no setting means upload');
});

test('with Drive alone and no Drive photos the list is empty, so the panel has nothing and is left out', () => {
  assert.deepEqual(mixPhotos(studio, [], { photoSource: 'drive' }), []);
  assert.deepEqual(mixPhotos(studio, undefined, { photoSource: 'drive' }), []);
  assert.equal(photosToShow({ photos: mixPhotos(studio, undefined, { photoSource: 'drive' }) }).length, 0);
});

test('with both and no Drive photos yet the Studio photos still play', () => {
  assert.deepEqual(mixPhotos(studio, undefined, { photoSource: 'both' }).map(photo => photo.id), ['studio-1']);
  assert.deepEqual(mixPhotos(undefined, undefined, { photoSource: 'both' }), []);
});

test('the mixed list plays in the order setting, and no photo comes twice in a row', () => {
  const drive = drivePhotosFrom(manifest([entry('idA.jpg', { modified: '2027-03-05T00:00:00.000Z' }), entry('idB.jpg', { modified: '2027-02-01T00:00:00.000Z' })]), folder);
  const list = photosToShow({ photos: mixPhotos(studio, drive, { photoSource: 'both' }) });
  const queue = makePhotoQueue();
  const order = [];
  for (let step = 0; step < 6; step++) order.push(queue.take(list, 'newest-first').photo.id);
  assert.deepEqual(order, ['drive-idA.jpg', 'drive-idB.jpg', 'studio-1', 'drive-idA.jpg', 'drive-idB.jpg', 'studio-1']);

  const random = makePhotoQueue(() => 0.3);
  let last = '';
  for (let step = 0; step < 12; step++) {
    const id = random.take(list, 'random').photo.id;
    assert.notEqual(id, last);
    last = id;
  }
});

test('the manifest is read from the live folder, or the sample folder', async () => {
  assert.equal(drivePhotosFolder(false), 'data/live/photos/');
  assert.equal(drivePhotosFolder(true), 'data/sample/photos/');

  const asked = [];
  const answer = body => async address => {
    asked.push(address);
    return { ok: true, status: 200, json: async () => body };
  };
  const result = await readDrivePhotos(answer(manifest([entry('idA.jpg')])), false);
  assert.equal(result.photos.length, 1);
  assert.equal(asked[0], 'data/live/photos/manifest.json');
  assert.equal(result.photos[0].address.startsWith('data/live/photos/idA.jpg'), true);
  await readDrivePhotos(answer(manifest([])), true);
  assert.equal(asked[1], 'data/sample/photos/manifest.json');
});

test('a read that finds no manifest or a broken one gives an empty list, and one that fails gives null', async () => {
  const notFound = async () => ({ ok: false, status: 404, json: async () => { throw new Error('no'); } });
  assert.deepEqual(await readDrivePhotos(notFound, false), { photos: [] });

  const broken = async () => ({ ok: true, status: 200, json: async () => { throw new Error('not json'); } });
  assert.deepEqual(await readDrivePhotos(broken, false), { photos: [] });

  const serverError = async () => ({ ok: false, status: 500, json: async () => ({}) });
  assert.equal(await readDrivePhotos(serverError, false), null);

  const offline = async () => { throw new Error('offline'); };
  assert.equal(await readDrivePhotos(offline, false), null);
});

test('the sample content has a Drive manifest whose pictures are there, and its source is both', () => {
  const content = JSON.parse(fs.readFileSync(repo + 'dashboard/data/sample/content.json', 'utf8'));
  assert.equal(content.settings.photoSource, 'both');
  const photos = drivePhotosFrom(JSON.parse(fs.readFileSync(repo + 'dashboard/data/sample/photos/manifest.json', 'utf8')), 'data/sample/photos/');
  assert.equal(photos.length, 2);
  photos.forEach(photo => {
    const file = decodeURIComponent(photo.address.split('?')[0]);
    assert.ok(fs.existsSync(repo + 'dashboard/' + file), file + ' is in the sample folder');
  });
});

test('the shell mixes the lists in rebuild and reads the manifest on a timer, each with a guard', () => {
  const content = fs.readFileSync(repo + 'dashboard/shell-content.js', 'utf8');
  assert.ok(content.includes('mixPhotos(shellState.base.photos, extras.drivePhotos'));
  assert.ok(/try \{[\s\S]*mixPhotos[\s\S]*catch/.test(content), 'a problem in the mix is caught');
  const extras = fs.readFileSync(repo + 'dashboard/shell-extras.js', 'utf8');
  assert.ok(extras.includes("startOptional('./core/photos-drive.js'"), 'the reader starts on its own, so a failure cannot stop the others');
  assert.ok(extras.includes('10 * 60 * 1000'));
});

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
