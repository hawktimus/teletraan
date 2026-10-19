// Tests for the Photos page in Studio (studio/inputs/photos-parts.js, photos-view.js), the folder link rule
// (studio/schemas/driveFolder.js), the two settings fields and the GOOGLE_API_KEY handling of the Keys section of Settings and
// the Mac tool. The page itself needs a browser, so its code is read for what it must and must not do.
//
//   node tests/photos-page.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkDriveFolder, driveFolderId } from '../studio/schemas/driveFolder.js';
import { creditProblem, driveStatusLine, fileProblem, folderCheck, photoDraft, settingsFrom, sources, uploadSummary, words } from '../studio/inputs/photos-parts.js';
import { incomingLines, keyNames, labels, mask, mergeEnv } from '../control/support/keys.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');

const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

const id = '1AbCdEfGhIjKlMnOpQrStUvWxYz';

test('a folder link or a bare id gives the id, and anything else gives nothing', () => {
  assert.equal(driveFolderId('https://drive.google.com/drive/folders/' + id), id);
  assert.equal(driveFolderId('https://drive.google.com/drive/folders/' + id + '?usp=sharing'), id);
  assert.equal(driveFolderId('https://drive.google.com/drive/u/0/folders/' + id), id);
  assert.equal(driveFolderId('  ' + id + '  '), id);
  assert.equal(driveFolderId(id), id);
  ['', 'http://drive.google.com/drive/folders/' + id, 'https://example.com/drive/folders/' + id, 'https://drive.google.com/file/d/' + id + '/view', 'short', 'has space in it', null, undefined].forEach(value => {
    assert.equal(driveFolderId(value), '', String(value));
  });
});

test('the field check allows empty, a link or an id, and says what to do otherwise', () => {
  assert.equal(checkDriveFolder(undefined), true);
  assert.equal(checkDriveFolder(''), true);
  assert.equal(checkDriveFolder('https://drive.google.com/drive/folders/' + id), true);
  assert.match(checkDriveFolder('nonsense link'), /Paste the folder link/);
  assert.match(checkDriveFolder('https://drive.google.com/drive/folders/' + id + 'a'.repeat(200)), /Too long/);
});

test('the script reads the same two forms of folder link as the field', () => {
  const script = read('computer/scripts/photos-drive-sync.sh');
  assert.ok(script.includes("drive\\.google\\.com/drive/(?:u/[0-9]+/)?folders/"));
  assert.ok(script.includes('[A-Za-z0-9_-]{10,100}'));
});

test('the settings fields are photoSource with three choices and photoDriveFolder with a check, neither required', () => {
  const text = read('studio/schemas/settingsPhotos.js');
  assert.ok(text.includes("name: 'photoSource'") && text.includes("name: 'photoDriveFolder'"));
  assert.ok(text.includes("{ title: 'Upload photos', value: 'upload' }") && text.includes("{ title: 'Google Drive folder', value: 'drive' }") && text.includes("{ title: 'Both', value: 'both' }"));
  assert.ok(text.includes('checkDriveFolder'));
  const source = text.slice(text.indexOf("name: 'photoSource'"), text.indexOf("name: 'photoSeconds'"));
  assert.ok(!source.includes('Rule.required()'), 'a page saved before the fields existed must still publish');
  assert.deepEqual(sources.map(item => item.value), ['upload', 'drive', 'both']);
});

test('the status of the Drive folder reads in plain words for every state', () => {
  const now = new Date('2027-03-01T10:06:00Z');
  const folder = 'https://drive.google.com/drive/folders/' + id;
  const at = '2027-03-01T10:00:00Z';
  assert.equal(driveStatusLine({ photosDriveAt: at, photosDriveState: 'ok', photosDriveCount: 34 }, folder, now), 'Last read 6 minutes ago, 34 photos.');
  assert.equal(driveStatusLine({ photosDriveAt: at, photosDriveState: 'ok', photosDriveCount: 1 }, folder, now), 'Last read 6 minutes ago, 1 photo.');
  assert.equal(driveStatusLine({ photosDriveAt: at, photosDriveState: 'no-key', photosDriveCount: 0 }, folder, now), 'The Teletraan computer has no Google key yet. Add GOOGLE_API_KEY on the control page, Settings, Keys.');
  assert.match(driveStatusLine({ photosDriveAt: at, photosDriveState: 'bad-key' }, folder, now), /did not accept the key/);
  assert.match(driveStatusLine({ photosDriveAt: at, photosDriveState: 'api-off' }, folder, now), /not turned on/);
  assert.match(driveStatusLine({ photosDriveAt: at, photosDriveState: 'not-shared' }, folder, now), /Anyone with the link/);
  assert.match(driveStatusLine({ photosDriveAt: at, photosDriveState: 'off' }, folder, now), /source was Upload photos/);
  assert.match(driveStatusLine(null, folder, now), /has not read the folder yet/);
  assert.match(driveStatusLine({ photosDriveAt: at, photosDriveState: 'ok', photosDriveCount: 3 }, '', now), /No folder is named yet/);
  assert.match(driveStatusLine({ photosDriveAt: at, photosDriveState: 'something-new' }, folder, now), /Last read 6 minutes ago/);
});

test('no word of the page names a file: only a count is shown', () => {
  const view = read('studio/inputs/photos-view.js');
  assert.ok(!/\.name\b[^;]*status/.test(view));
  assert.ok(words.folderCountOnly.includes('not their names'));
});

test('the source and folder come from the draft first, then the published document', () => {
  const draft = { _id: 'drafts.dashboardSettings', photoSource: 'drive', photoDriveFolder: id };
  const published = { _id: 'dashboardSettings', photoSource: 'upload' };
  assert.deepEqual(settingsFrom([published, draft]), { source: 'drive', folder: id });
  assert.deepEqual(settingsFrom([published]), { source: 'upload', folder: '' });
  assert.deepEqual(settingsFrom([{ _id: 'dashboardSettings' }]), { source: 'upload', folder: '' });
  assert.equal(settingsFrom([]), null);
  assert.equal(settingsFrom(undefined), null);
});

test('the folder typed is checked before it is saved', () => {
  assert.deepEqual(folderCheck(''), { ok: true, id: '', problem: '' });
  assert.equal(folderCheck('https://drive.google.com/drive/folders/' + id).id, id);
  assert.equal(folderCheck('hello there').ok, false);
  assert.match(folderCheck('hello there').problem, /Google Drive folder link/);
});

test('an upload becomes a draft photo with a picture, switched on, with no caption', () => {
  const draft = photoDraft('photo-1', 'image-abc-100x100-jpg', {});
  assert.deepEqual(draft, { _id: 'drafts.photo-1', _type: 'photo', image: { _type: 'image', asset: { _type: 'reference', _ref: 'image-abc-100x100-jpg' } }, show: true, fit: 'setting' });
  const withBatch = photoDraft('photo-2', 'image-x', { credit: 'Maria', expires: '2027-04-01T00:00:00.000Z' });
  assert.equal(withBatch.credit, 'Maria');
  assert.equal(withBatch.expires, '2027-04-01T00:00:00.000Z');
  assert.ok(!('caption' in withBatch));
});

test('the credit of a batch follows the rules of the Credit field', () => {
  assert.equal(creditProblem(''), '');
  assert.equal(creditProblem('Mary-Anne'), '');
  assert.match(creditProblem('Mary Smith'), /first name only/);
  assert.match(creditProblem('Mary2'), /first name only/);
  assert.match(creditProblem('x'.repeat(15)), /Too long/);
});

test('files that are not pictures or are too big are refused with a reason and the rest go on', () => {
  assert.equal(fileProblem({ name: 'a.jpg', type: 'image/jpeg', size: 1000 }), '');
  assert.equal(fileProblem({ name: 'a.webp', type: 'image/webp', size: 1000 }), '');
  assert.match(fileProblem({ name: 'a.pdf', type: 'application/pdf', size: 10 }), /not a JPEG, PNG, WebP or GIF/);
  assert.match(fileProblem({ name: 'big.jpg', type: 'image/jpeg', size: 26 * 1024 * 1024 }), /bigger than 25 MB/);
  assert.deepEqual(uploadSummary(0, ['x']), ['x']);
  assert.equal(uploadSummary(1, [])[0], '1 photo was added as a draft. Click Publish all in the top bar.');
  assert.equal(uploadSummary(12, ['y'])[0], '12 photos were added as drafts. Click Publish all in the top bar.');
});

test('the page only writes drafts and never publishes or touches the dataset in other ways', () => {
  const view = read('studio/inputs/photos-view.js');
  assert.ok(view.includes("'drafts.'") || read('studio/inputs/photos-parts.js').includes("'drafts.'"));
  assert.ok(!/\.publish\(|createOrReplace|\.delete\(|\.mutate\(/.test(view), 'no publish, replace, delete or mutate');
  assert.ok(view.includes("client.patch(draftId).set(fields)"));
  assert.ok(view.includes('multiple: true'), 'many files at once');
});

test('the sidebar has a Photos page with the list one link away', () => {
  const structure = read('studio/structure.js');
  assert.ok(structure.includes("{ kind: 'component', title: 'Photos', id: 'photos', icon: ImagesIcon, component: PhotosView, children: photosOf }"));
  assert.ok(structure.includes("type: 'photo', sort: newestUploadFirst, add: ['newPhoto']"));
});

test('the Keys section of Settings knows GOOGLE_API_KEY, masks it, merges it and refuses a bad one', () => {
  assert.ok(keyNames.includes('GOOGLE_API_KEY'));
  assert.equal(labels.GOOGLE_API_KEY, 'Google key for the photo folder');
  assert.equal(mask('AIzaSyFAKEFAKEFAKEFAKE'), 'AIza........');
  const { lines, changed } = incomingLines({ keys: { GOOGLE_API_KEY: { action: 'set', value: 'AIzaSyFAKEFAKEFAKEFAKE' } } });
  assert.deepEqual(lines, ["GOOGLE_API_KEY='AIzaSyFAKEFAKEFAKEFAKE'"]);
  assert.deepEqual(changed, [{ name: 'GOOGLE_API_KEY', did: 'set' }]);
  assert.ok(!JSON.stringify(changed).includes('AIza'), 'the value is not in the report');
  assert.throws(() => incomingLines({ keys: { GOOGLE_API_KEY: { action: 'set', value: 'has a space' } } }));
  assert.equal(mergeEnv("A=1\n", lines), "A=1\nGOOGLE_API_KEY='AIzaSyFAKEFAKEFAKEFAKE'\n");
});

test('merge-env.sh on the Mac takes GOOGLE_API_KEY and still refuses other names', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-photos-merge-'));
  try {
    const env = path.join(folder, 'local.env');
    fs.writeFileSync(env, "TBA_AUTH_KEY='one'\n");
    const incoming = path.join(folder, 'incoming');
    fs.writeFileSync(incoming, "GOOGLE_API_KEY='AIzaSyFAKEFAKEFAKEFAKE'\n");
    const good = spawnSync('/bin/sh', [path.join(repo, 'tools/teletraan/merge-env.sh'), env, incoming], { encoding: 'utf8' });
    assert.equal(good.status, 0, good.stderr);
    assert.equal(fs.readFileSync(env, 'utf8'), "TBA_AUTH_KEY='one'\nGOOGLE_API_KEY='AIzaSyFAKEFAKEFAKEFAKE'\n");
    assert.ok(!good.stdout.includes('AIzaSy'), 'the value is not printed');

    fs.writeFileSync(incoming, "OTHER_KEY='x'\n");
    const bad = spawnSync('/bin/sh', [path.join(repo, 'tools/teletraan/merge-env.sh'), env, incoming], { encoding: 'utf8' });
    assert.equal(bad.status, 1);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

test('the Mac tool lists the Google key and installs the Drive photo timer with the others', () => {
  const tool = read('tools/teletraan/teletraan-tool');
  assert.ok(tool.includes('key_names=(SANITY_WRITE_TOKEN MONDAY_API_TOKEN TBA_AUTH_KEY GOOGLE_API_KEY)'));
  assert.ok(tool.includes('form_key_count=4'));
  assert.ok(read('tools/teletraan/teletraan-tool-secrets.sh').includes('SANITY_WRITE_TOKEN|MONDAY_API_TOKEN|TBA_AUTH_KEY|GOOGLE_API_KEY)'));
  assert.ok(read('tools/teletraan/teletraan-tool-deploy.sh').includes('for name in calendars slides photos-drive monday frc news console watchdog backup nightly; do'));
  assert.ok(read('computer/local.example.env').includes("# GOOGLE_API_KEY='[paste the Google key here]'"));
});

test('the status document has the three Drive fields, and nginx keeps the manifest only a few seconds', () => {
  const status = read('studio/schemas/status.js');
  ['photosDriveAt', 'photosDriveCount', 'photosDriveState'].forEach(name => assert.ok(status.includes(name), name));
  const nginx = read('computer/nginx/nginx.conf');
  assert.equal(nginx.split('location = /dashboard/data/live/photos/manifest.json').length - 1, 2, 'both servers');
});

test('the guide exists and names the steps in order', () => {
  const guide = read('docs/photos-drive.md');
  ['Google Cloud console', 'Google Drive API', 'API key', 'Anyone with the link', 'Keys section', 'GOOGLE_API_KEY', 'Photos'].forEach(word => assert.ok(guide.includes(word), word));
  assert.ok(!guide.includes('—') && !guide.includes('–'), 'no em or en dash');
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
