// Tests for computer/scripts/photos-drive-sync.sh, its status job in status-write.sh and install-photos-drive.sh.
// curl, flock, id and systemctl are replaced with small fake ones in a temporary folder, so nothing touches the
// network or the machine. jq is the real one, so this test needs jq installed. The key in the test is made up.
//
//   node tests/photos-drive.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const scripts = ['photos-drive-sync.sh', 'install-photos-drive.sh', 'status-write.sh', 'lib.sh'];
const unitFiles = ['teletraan-photos-drive.service', 'teletraan-photos-drive.timer'];
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-photos-drive-'));

const ordinaryTools = ['sed', 'tail', 'head', 'grep', 'find', 'mktemp', 'mv', 'rm', 'mkdir', 'date', 'dirname', 'basename', 'cat', 'cp', 'wc', 'tr', 'ls', 'awk'];
const key = 'FAKEKEY_abcdefghijklmnopqrstuvwxyz0123';
const token = 'FAKE-WRITE-TOKEN-0123456789';
const folderId = '1AbCdEfGhIjKlMnOpQrStUvWxYz';
const folderLink = 'https://drive.google.com/drive/folders/' + folderId + '?usp=sharing';

function findTool(name) {
  const found = spawnSync('/bin/sh', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
  assert.ok(found, 'this computer has no ' + name);
  return found;
}

// A fake curl. It logs its arguments, and the address from the settings on standard input with the key
// taken out (the key must never be in the log). Sanity answers from sanity.json. The list of files comes from
// list.json, with the status in list.code. A download comes from <id>.body, with <id>.code. A write to Sanity
// is logged with its body.
const fakeCurl = `#!/bin/sh
echo "curl $*" >> "$STUB_LOG"
output=""
config=""
previous=""
for argument in "$@"; do
  [ "$previous" = --output ] && output=$argument
  [ "$previous" = --config ] && config=$argument
  previous=$argument
done
address=$argument
if [ "$config" = - ]; then
  from_config=$(sed -n 's/^url = "\\(.*\\)"$/\\1/p')
  if [ -n "$from_config" ]; then
    echo "config-url $from_config" | sed "s/$STUB_KEY/<key>/g" >> "$STUB_LOG"
    address=$(printf '%s' "$from_config" | sed 's/&key=.*$//')
  fi
fi
case $address in
  https://*.api.sanity.io/*/data/mutate/*) exit 0 ;;
  https://*.api.sanity.io/*)
    [ -f "$STUB_DIR/sanity.exit" ] && exit "$(cat "$STUB_DIR/sanity.exit")"
    cp "$STUB_DIR/sanity.json" "$output"
    ;;
  https://www.googleapis.com/drive/v3/files\\?*)
    cp "$STUB_DIR/list.json" "$output"
    cat "$STUB_DIR/list.code" 2> /dev/null || printf 200
    ;;
  https://www.googleapis.com/drive/v3/files/*)
    id=\${address#https://www.googleapis.com/drive/v3/files/}
    id=\${id%%\\?*}
    if [ -f "$STUB_DIR/$id.body" ]; then cp "$STUB_DIR/$id.body" "$output"; else : > "$output"; fi
    cat "$STUB_DIR/$id.code" 2> /dev/null || printf 200
    ;;
  *) exit 6 ;;
esac
`;

function writeTool(folder, name, text) {
  fs.writeFileSync(path.join(folder, name), text, { mode: 0o755 });
}

function setup(name, options = {}) {
  const root = path.join(work, name);
  const bin = path.join(root, 'bin');
  const stub = path.join(root, 'stub');
  const data = path.join(root, 'data');
  const temp = path.join(root, 'tmp');
  fs.mkdirSync(path.join(root, 'computer/scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'computer/systemd'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dashboard'), { recursive: true });
  [bin, stub, temp, data].forEach(folder => fs.mkdirSync(folder));

  scripts.forEach(file => {
    const source = path.join(repo, 'computer/scripts', file);
    const copy = path.join(root, 'computer/scripts', file);
    fs.copyFileSync(source, copy);
    fs.chmodSync(copy, fs.statSync(source).mode);
  });
  unitFiles.forEach(unit => fs.copyFileSync(path.join(repo, 'computer/systemd', unit), path.join(root, 'computer/systemd', unit)));
  fs.copyFileSync(path.join(repo, 'dashboard/config.js'), path.join(root, 'dashboard/config.js'));

  const env = ["TELETRAAN_DATA='" + data + "'", "SANITY_WRITE_TOKEN='" + token + "'"];
  if (!options.noKey) env.push("GOOGLE_API_KEY='" + (options.key || key) + "'");
  fs.writeFileSync(path.join(root, 'computer/local.env'), env.join('\n') + '\n');

  ordinaryTools.forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));
  fs.symlinkSync(findTool('jq'), path.join(bin, 'jq'));
  writeTool(bin, 'curl', fakeCurl);
  writeTool(bin, 'flock', '#!/bin/sh\n[ "$STUB_LOCKED" != yes ]\n');
  writeTool(bin, 'id', '#!/bin/sh\n[ "$1" = -u ] && echo "$STUB_UID"\nexit 0\n');
  writeTool(bin, 'systemctl', '#!/bin/sh\necho "systemctl $*" >> "$STUB_LOG"\n');

  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');
  const photos = path.join(data, 'photos');

  const place = {
    root, photos, log, stub,
    run(script, args = [], extra = {}) {
      const env = Object.assign({ PATH: bin, STUB_LOG: log, STUB_DIR: stub, STUB_KEY: key, TMPDIR: temp, STUB_UID: '1000' }, extra);
      const result = spawnSync('/bin/bash', [path.join(root, 'computer/scripts', script)].concat(args), { env, encoding: 'utf8', input: '\n', cwd: root });
      return { text: result.stdout, errors: result.stderr, status: result.status, calls: fs.readFileSync(log, 'utf8') };
    },
    sync(extra) {
      return this.run('photos-drive-sync.sh', [], extra);
    },
    settings(source, folder) {
      const result = { photoSource: source };
      if (folder !== undefined) result.photoDriveFolder = folder;
      fs.writeFileSync(path.join(stub, 'sanity.json'), JSON.stringify({ result }));
      fs.rmSync(path.join(stub, 'sanity.exit'), { force: true });
    },
    list(files, code) {
      fs.writeFileSync(path.join(stub, 'list.json'), JSON.stringify(typeof files === 'string' ? JSON.parse(files) : { files }));
      fs.writeFileSync(path.join(stub, 'list.code'), String(code || 200));
    },
    body(id, text, code) {
      fs.writeFileSync(path.join(stub, id + '.body'), text);
      if (code) fs.writeFileSync(path.join(stub, id + '.code'), String(code));
      else fs.rmSync(path.join(stub, id + '.code'), { force: true });
    },
    manifest() {
      return JSON.parse(fs.readFileSync(path.join(photos, 'manifest.json'), 'utf8'));
    },
    status() {
      return JSON.parse(fs.readFileSync(path.join(photos, 'status.json'), 'utf8'));
    },
    files() {
      return fs.existsSync(photos) ? fs.readdirSync(photos).filter(name => !name.startsWith('.')).sort() : [];
    },
    downloads() {
      return (fs.readFileSync(log, 'utf8').match(/drive\/v3\/files\/[A-Za-z0-9_-]+\?alt=media/g) || []).length;
    },
  };
  return place;
}

function drive(id, name, extra = {}) {
  return Object.assign({ id, name, mimeType: 'image/jpeg', modifiedTime: '2027-03-01T10:00:00.000Z', size: '2048', imageMediaMetadata: { width: 1600, height: 900 } }, extra);
}

const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

function ready(name, files) {
  const place = setup(name);
  place.settings('both', folderLink);
  place.list(files || [drive('idA', 'Maria - Pit crew at work.jpg'), drive('idB', 'robot.png', { mimeType: 'image/png', modifiedTime: '2027-02-01T10:00:00.000Z' })]);
  place.body('idA', 'JPEG-A');
  place.body('idB', 'PNG-B');
  return place;
}

test('a run lists the folder, downloads the pictures and writes a manifest of the right shape', () => {
  const place = ready('listing');
  const result = place.sync();
  assert.equal(result.status, 0, result.errors + result.text);
  assert.deepEqual(place.files(), ['idA.jpg', 'idB.png', 'manifest.json', 'status.json']);
  assert.equal(fs.readFileSync(path.join(place.photos, 'idA.jpg'), 'utf8'), 'JPEG-A');

  const manifest = place.manifest();
  assert.equal(manifest.ok, true);
  assert.equal(manifest.folder, folderId);
  assert.match(manifest.fetchedAt, /^\d{4}-\d{2}-\d{2}T[\d:]+Z$/);
  assert.deepEqual(manifest.photos.map(photo => photo.id), ['idA', 'idB'], 'newest first');
  assert.deepEqual(manifest.photos[0], { id: 'idA', name: 'Maria - Pit crew at work.jpg', file: 'idA.jpg', modified: '2027-03-01T10:00:00.000Z', width: 1600, height: 900, credit: 'Maria', caption: 'Pit crew at work' });
  assert.equal(manifest.photos[1].credit, '');
  assert.equal(manifest.photos[1].caption, '', 'a name that is not like Firstname - caption gives no text');
  assert.equal(manifest.photos[1].file, 'idB.png');

  assert.ok(result.calls.includes('%27' + folderId + '%27%20in%20parents'), 'the folder id is in the question');
  assert.ok(result.calls.includes('mimeType%20contains%20%27image%2F%27'), 'only pictures are asked for');
  assert.ok(result.calls.includes('imageMediaMetadata'), 'the sizes are asked for');
});

test('the status file says ok and how many photos', () => {
  const place = ready('status-file');
  place.sync();
  const status = place.status();
  assert.equal(status.state, 'ok');
  assert.equal(status.count, 2);
  assert.match(status.at, /^\d{4}-\d{2}-\d{2}T[\d:]+Z$/);
});

test('the key is never in a command line, a log or the output, only in the settings on standard input', () => {
  const place = ready('key-hidden');
  const result = place.sync();
  assert.ok(!result.calls.includes(key), 'the key is in the log of calls');
  assert.ok(!result.text.includes(key) && !result.errors.includes(key));
  assert.ok(result.calls.includes('--config -'), 'curl reads its settings from standard input');
  assert.ok(result.calls.includes('config-url https://www.googleapis.com/drive/v3/files'), 'the address came through the settings');
  assert.ok(result.calls.includes('&key=<key>'), 'the key went with the address');
  fs.readdirSync(place.photos).forEach(name => {
    if (fs.statSync(path.join(place.photos, name)).isFile()) assert.ok(!fs.readFileSync(path.join(place.photos, name), 'utf8').includes(key), name);
  });
});

test('a picture that has not changed is not downloaded again, and one that has is', () => {
  const place = ready('unchanged');
  place.sync();
  assert.equal(place.downloads(), 2);
  place.sync();
  assert.equal(place.downloads(), 2, 'nothing new');

  place.list([drive('idA', 'Maria - Pit crew at work.jpg', { modifiedTime: '2027-03-02T10:00:00.000Z' }), drive('idB', 'robot.png', { mimeType: 'image/png', modifiedTime: '2027-02-01T10:00:00.000Z' })]);
  place.body('idA', 'JPEG-A-NEW');
  place.sync();
  assert.equal(place.downloads(), 3, 'only the changed one');
  assert.equal(fs.readFileSync(path.join(place.photos, 'idA.jpg'), 'utf8'), 'JPEG-A-NEW');
  assert.equal(place.manifest().photos[0].modified, '2027-03-02T10:00:00.000Z');
});

test('a picture that left the folder is removed from the disk and the manifest', () => {
  const place = ready('removal');
  place.sync();
  place.list([drive('idA', 'Maria - Pit crew at work.jpg')]);
  const result = place.sync();
  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(place.files(), ['idA.jpg', 'manifest.json', 'status.json']);
  assert.deepEqual(place.manifest().photos.map(photo => photo.id), ['idA']);
  assert.equal(place.status().count, 1);
});

test('a picture over 15 MB is skipped, one at 15 MB is kept', () => {
  const place = ready('size-cap', [drive('big', 'big.jpg', { size: String(15 * 1024 * 1024 + 1) }), drive('edge', 'edge.jpg', { size: String(15 * 1024 * 1024) })]);
  place.body('big', 'BIG');
  place.body('edge', 'EDGE');
  const result = place.sync();
  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(place.manifest().photos.map(photo => photo.id), ['edge']);
  assert.ok(!place.files().includes('big.jpg'));
  assert.ok(!result.calls.includes('files/big?alt=media'), 'it was not even downloaded');
  assert.ok(result.text.includes('1 over 15 MB skipped'), result.text);
});

test('no more than 200 pictures are kept, the newest', () => {
  const files = Array.from({ length: 205 }, (item, index) => drive('f' + String(index).padStart(3, '0'), 'p' + index + '.jpg', { modifiedTime: new Date(Date.UTC(2027, 0, 1, 0, index)).toISOString() }));
  const place = ready('cap-200', files);
  files.forEach(file => place.body(file.id, 'x'));
  const result = place.sync();
  assert.equal(result.status, 0, result.errors);
  const manifest = place.manifest();
  assert.equal(manifest.photos.length, 200);
  assert.equal(manifest.photos[0].id, 'f204');
  assert.ok(!manifest.photos.some(photo => photo.id === 'f000'), 'the oldest are cut');
  assert.equal(place.status().count, 200);
});

test('files that are not pictures the screen can draw are left out', () => {
  const place = ready('kinds', [drive('idA', 'a.jpg'), drive('idS', 'logo.svg', { mimeType: 'image/svg+xml' }), drive('idH', 'phone.heic', { mimeType: 'image/heic' })]);
  place.sync();
  assert.deepEqual(place.manifest().photos.map(photo => photo.id), ['idA']);
});

test('a caption is cut to 36 characters and a long first name is not a credit', () => {
  const place = ready('names', [drive('idA', 'Maria - ' + 'x'.repeat(50) + '.jpg'), drive('idB', 'Maximilianalexandria - hello.jpg')]);
  place.sync();
  const photos = place.manifest().photos;
  assert.equal(photos.find(photo => photo.id === 'idA').caption.length, 36);
  assert.equal(photos.find(photo => photo.id === 'idB').credit, '');
});

test('a download that fails is left out and the run says so, the others stay', () => {
  const place = ready('failed-download');
  place.body('idB', '', 500);
  const result = place.sync();
  assert.equal(result.status, 1);
  assert.deepEqual(place.manifest().photos.map(photo => photo.id), ['idA']);
  assert.ok(!place.files().includes('idB.png'));
  assert.equal(place.status().state, 'ok');
});

test('with no key it ends well with one plain line, asks Google for nothing and says no-key', () => {
  const place = setup('no-key', { noKey: true });
  place.settings('drive', folderLink);
  const result = place.sync();
  assert.equal(result.status, 0, result.errors);
  assert.ok(result.text.includes('there is no GOOGLE_API_KEY in local.env yet'), result.text);
  assert.ok(!result.calls.includes('googleapis'));
  assert.equal(place.status().state, 'no-key');
});

test('a key that is still the placeholder counts as no key', () => {
  const place = setup('placeholder-key', { key: '[paste the Google key here]' });
  place.settings('drive', folderLink);
  const result = place.sync();
  assert.equal(result.status, 0);
  assert.equal(place.status().state, 'no-key');
});

test('with no folder it ends well and says no-folder', () => {
  const place = setup('no-folder');
  place.settings('both', '');
  const result = place.sync();
  assert.equal(result.status, 0, result.errors);
  assert.ok(result.text.includes('no Google Drive folder is named'), result.text);
  assert.ok(!result.calls.includes('googleapis'));
  assert.equal(place.status().state, 'no-folder');

  place.settings('both', 'https://example.com/not-drive');
  assert.equal(place.sync().status, 0);
  assert.equal(place.status().state, 'no-folder');
});

test('with the source Upload photos it reads nothing from Google and says off', () => {
  const place = setup('off');
  place.settings('upload', folderLink);
  const result = place.sync();
  assert.equal(result.status, 0);
  assert.ok(!result.calls.includes('googleapis'));
  assert.equal(place.status().state, 'off');

  place.settings(undefined, folderLink);
  place.sync();
  assert.equal(place.status().state, 'off', 'a page saved before the setting existed means upload');
});

test('a bare folder id works like a link', () => {
  const place = ready('bare-id');
  place.settings('drive', folderId);
  const result = place.sync();
  assert.equal(result.status, 0, result.errors);
  assert.equal(place.manifest().folder, folderId);
});

test('Google refusing the key, the folder or the API is a state and the photos stay as they were', () => {
  const place = ready('refusals');
  place.sync();
  const before = place.manifest();

  [
    [400, { error: { code: 400, errors: [{ reason: 'keyInvalid' }] } }, 'bad-key'],
    [403, { error: { code: 403, errors: [{ reason: 'accessNotConfigured' }] } }, 'api-off'],
    [403, { error: { code: 403, status: 'PERMISSION_DENIED', errors: [{ reason: 'forbidden' }] } }, 'not-shared'],
    [404, { error: { code: 404, errors: [{ reason: 'notFound' }] } }, 'not-shared'],
  ].forEach(([code, body, state]) => {
    place.list(JSON.stringify(body), code);
    const result = place.sync();
    assert.equal(result.status, 0, state + ' ' + result.errors);
    assert.equal(place.status().state, state);
    assert.deepEqual(place.manifest(), before);
    assert.ok(!result.text.includes(key) && !result.errors.includes(key));
  });
});

test('a key that does not look like a key is not sent anywhere', () => {
  const place = setup('odd-key', { key: 'short' });
  place.settings('drive', folderLink);
  const result = place.sync();
  assert.equal(result.status, 0);
  assert.equal(place.status().state, 'bad-key');
  assert.ok(!result.calls.includes('googleapis'));
});

test('when Sanity does not answer nothing is changed and the run fails', () => {
  const place = ready('sanity-down');
  place.sync();
  fs.writeFileSync(path.join(place.stub, 'sanity.exit'), '6');
  const result = place.sync();
  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('Could not get the settings from Sanity'), result.errors);
  assert.equal(place.status().state, 'ok');
  assert.equal(place.manifest().photos.length, 2);
});

test('when Google cannot be reached nothing is changed and the run fails', () => {
  const place = ready('google-down');
  place.sync();
  place.list('{}', 503);
  const result = place.sync();
  assert.equal(result.status, 1);
  assert.equal(place.manifest().photos.length, 2);
  assert.equal(place.files().length, 4);
});

test('a run that starts while another is going stops at once', () => {
  const place = ready('locked');
  const result = place.sync({ STUB_LOCKED: 'yes' });
  assert.equal(result.status, 0);
  assert.ok(result.text.includes('still going'));
  assert.ok(!result.calls.includes('googleapis'));
});

test('status-write.sh photos-drive sends the time, the count and the state, and only those', () => {
  const place = ready('status-job');
  place.sync();
  const result = place.run('status-write.sh', ['photos-drive']);
  assert.equal(result.status, 0, result.errors);
  const write = result.calls.split('\n').find(line => line.includes('data/mutate'));
  assert.ok(write, result.calls);
  assert.ok(write.includes('"photosDriveAt":"') && write.includes('"photosDriveCount":2') && write.includes('"photosDriveState":"ok"'), write);
  assert.ok(write.includes('"_id":"status-mini"') || write.includes('"id":"status-mini"'));
  assert.ok(!result.calls.includes(token) && !result.text.includes(token), 'the token is not in a command line');
  assert.ok(!write.includes('Maria'), 'no file names are sent');
});

test('status-write.sh photos-drive sends nothing when no run has reported, and refuses a damaged line', () => {
  const place = setup('status-none');
  assert.equal(place.run('status-write.sh', ['photos-drive']).status, 0);
  assert.ok(!place.run('status-write.sh', ['photos-drive']).calls.includes('data/mutate'));

  fs.mkdirSync(place.photos);
  fs.writeFileSync(path.join(place.photos, 'status.json'), '{"at":"yesterday","state":"ok","count":2}\n');
  const damaged = place.run('status-write.sh', ['photos-drive']);
  assert.equal(damaged.status, 1);
  assert.ok(!damaged.calls.includes('data/mutate'));
});

test('a state of no-key reaches Studio through the status job', () => {
  const place = setup('status-no-key', { noKey: true });
  place.settings('drive', folderLink);
  place.sync();
  const write = place.run('status-write.sh', ['photos-drive']).calls.split('\n').find(line => line.includes('data/mutate'));
  assert.ok(write.includes('"photosDriveState":"no-key"'), write);
});

test('the installer still needs sudo and the repository at /opt/teletraan before it changes anything, and checks only curl and jq', () => {
  const place = setup('install');
  const plain = place.run('install-photos-drive.sh', [], { STUB_UID: '1000' });
  assert.equal(plain.status, 1);
  assert.ok(plain.errors.includes('it has to run with sudo'), plain.errors);

  const root = place.run('install-photos-drive.sh', [], { STUB_UID: '0' });
  assert.equal(root.status, 1);
  assert.ok(root.errors.includes('The unit files expect the repository at /opt/teletraan'), root.errors);
  assert.ok(!root.calls.includes('systemctl'));

  const text = fs.readFileSync(path.join(repo, 'computer/scripts/install-photos-drive.sh'), 'utf8');
  assert.ok(!text.includes('pdftoppm') && !text.includes('poppler'));
});

test('the unit files run the script every 15 minutes and then the status job', () => {
  const service = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-photos-drive.service'), 'utf8');
  const timer = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-photos-drive.timer'), 'utf8');
  assert.ok(service.includes('User=ACCOUNT'));
  assert.ok(service.includes('ExecStart=/opt/teletraan/computer/scripts/photos-drive-sync.sh'));
  assert.ok(service.includes('ExecStartPost=-/opt/teletraan/computer/scripts/status-write.sh photos-drive'));
  assert.ok(timer.includes('OnUnitActiveSec=15min') && timer.includes('WantedBy=timers.target'));
});

let failures = 0;
try {
  for (const entry of tests) {
    try {
      entry.run();
      console.log('ok    ' + entry.name);
    } catch (error) {
      failures += 1;
      console.log('FAIL  ' + entry.name);
      console.log(error);
    }
  }
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
