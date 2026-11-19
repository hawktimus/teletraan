// Tests for computer/pi/meeting-sync.sh, the presentations of the Raspberry Pi: the list is newest added first, the
// folder is the Pi's own, and the pictures are made ahead. curl, pdftoppm, flock, timeout and id are replaced with
// small fake ones in a temporary folder, so nothing touches the network or the machine. jq is the real one. The key in
// the test is made up.
//
//   node tests/pi-meeting-sync.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-meeting-'));

const ordinaryTools = ['sed', 'tail', 'head', 'grep', 'find', 'mktemp', 'mv', 'rm', 'mkdir', 'date', 'dirname', 'basename', 'cat', 'cp', 'ls', 'stat', 'install', 'sleep'];
const key = 'FAKEKEY_abcdefghijklmnopqrstuvwxyz0123';
const folderId = '1AbCdEfGhIjKlMnOpQrStUvWxYz';
const folderLink = 'https://drive.google.com/drive/folders/' + folderId + '?usp=sharing';
const slidesType = 'application/vnd.google-apps.presentation';
const powerpointType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const oldPowerpointType = 'application/vnd.ms-powerpoint';
const deckA = '1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const deckB = '1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const deckC = '1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';

function findTool(name) {
  const found = spawnSync('/bin/sh', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
  assert.ok(found, 'this computer has no ' + name);
  return found;
}

// A fake curl. It logs its arguments, and the address from the settings on standard input with the key taken
// out (the key must never be in the log). Sanity answers from sanity.json, or fails with the code in
// sanity.exit. The list of files comes from list.json, with the status in list.code. The PDF of a deck comes
// from <id>.pdf, and a deck with no such file answers with a web page, as Google does for one that is not shared.
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
  https://*.api.sanity.io/*)
    [ -f "$STUB_DIR/sanity.exit" ] && exit "$(cat "$STUB_DIR/sanity.exit")"
    cp "$STUB_DIR/sanity.json" "$output"
    ;;
  https://www.googleapis.com/drive/v3/files\\?*)
    [ -f "$STUB_DIR/list.exit" ] && exit "$(cat "$STUB_DIR/list.exit")"
    cp "$STUB_DIR/list.json" "$output"
    cat "$STUB_DIR/list.code" 2> /dev/null || printf 200
    ;;
  https://docs.google.com/presentation/d/*/export/pdf)
    id=\${address#https://docs.google.com/presentation/d/}
    id=\${id%%/*}
    if [ -f "$STUB_DIR/$id.pdf" ]; then cp "$STUB_DIR/$id.pdf" "$output"; else echo '<html>Sign in</html>' > "$output"; fi
    ;;
  *) exit 6 ;;
esac
`;

// A fake pdftoppm. It makes as many pictures as the first line of the PDF says, numbered the way the real one does.
const fakePdftoppm = `#!/bin/sh
echo "pdftoppm $*" >> "$STUB_LOG"
previous=""
for argument in "$@"; do
  pdf=$previous
  previous=$argument
done
total=$(sed -n 's/^%PDF pages=//p' "$pdf" | head -n 1)
[ "$total" = fail ] && exit 1
number=1
while [ "$number" -le "\${total:-0}" ]; do
  printf 'picture %s' "$number" > "$argument-$(printf '%02d' "$number").jpg"
  number=$((number + 1))
done
`;

function writeTool(folder, name, text) {
  fs.writeFileSync(path.join(folder, name), text, { mode: 0o755 });
}

function setup(name, options = {}) {
  const root = path.join(work, name);
  const bin = path.join(root, 'bin');
  const stub = path.join(root, 'stub');
  const meeting = path.join(root, 'meeting');
  const temp = path.join(root, 'tmp');
  fs.mkdirSync(path.join(root, 'computer/scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'computer/pi'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dashboard'), { recursive: true });
  [bin, stub, temp].forEach(folder => fs.mkdirSync(folder));

  [['computer/scripts/lib.sh'], ['computer/pi/meeting-sync.sh']].forEach(([file]) => {
    const copy = path.join(root, file);
    fs.copyFileSync(path.join(repo, file), copy);
    fs.chmodSync(copy, fs.statSync(path.join(repo, file)).mode);
  });
  fs.copyFileSync(path.join(repo, 'dashboard/config.js'), path.join(root, 'dashboard/config.js'));

  const env = [];
  if (!options.noKey) env.push("GOOGLE_API_KEY='" + key + "'");
  if (options.folder) env.push("MEETING_DRIVE_FOLDER='" + options.folder + "'");
  fs.writeFileSync(path.join(root, 'computer/local.env'), env.join('\n') + '\n');

  ordinaryTools.forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));
  fs.symlinkSync(findTool('jq'), path.join(bin, 'jq'));
  writeTool(bin, 'curl', fakeCurl);
  writeTool(bin, 'pdftoppm', fakePdftoppm);
  writeTool(bin, 'timeout', '#!/bin/sh\nshift\nexec "$@"\n');
  writeTool(bin, 'flock', '#!/bin/sh\n[ "$STUB_LOCKED" != yes ]\n');
  writeTool(bin, 'id', '#!/bin/sh\n[ "$1" = -u ] && echo 1000\nexit 0\n');

  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');
  fs.writeFileSync(path.join(stub, 'sanity.json'), JSON.stringify({ result: null }));

  return {
    root, meeting, log, stub,
    sync() {
      const env = { PATH: bin, STUB_LOG: log, STUB_DIR: stub, STUB_KEY: key, TMPDIR: temp, TELETRAAN_MEETING: meeting };
      const result = spawnSync('/bin/bash', [path.join(root, 'computer/pi/meeting-sync.sh')], { env, encoding: 'utf8', input: '\n', cwd: root });
      return { text: result.stdout, errors: result.stderr, status: result.status, calls: fs.readFileSync(log, 'utf8') };
    },
    list(files) {
      fs.writeFileSync(path.join(stub, 'list.json'), JSON.stringify({ files }));
    },
    pdf(id, pages) {
      fs.writeFileSync(path.join(stub, id + '.pdf'), '%PDF pages=' + pages + '\n');
    },
    manifest() {
      return JSON.parse(fs.readFileSync(path.join(meeting, 'manifest.json'), 'utf8'));
    },
  };
}

function drive(id, name, extra = {}) {
  return Object.assign({ id, name, mimeType: slidesType, createdTime: '2027-03-01T10:00:00.000Z', modifiedTime: '2027-03-01T10:00:00.000Z' }, extra);
}

test('the list is newest added first, whatever was changed last, and each deck is made ahead', () => {
  const place = setup('order', { folder: folderLink });
  place.list([
    drive(deckA, 'Old but edited today', { createdTime: '2027-01-05T10:00:00.000Z', modifiedTime: '2027-03-09T10:00:00.000Z' }),
    drive(deckB, 'Added last week.pptx', { mimeType: powerpointType, createdTime: '2027-03-02T10:00:00.000Z', modifiedTime: '2027-03-02T10:00:00.000Z' }),
    drive(deckC, 'Newest.ppt', { mimeType: oldPowerpointType, createdTime: '2027-03-08T10:00:00.000Z', modifiedTime: '2027-03-08T10:00:00.000Z' }),
  ]);
  place.pdf(deckA, 3);
  place.pdf(deckB, 12);
  place.pdf(deckC, 2);
  const result = place.sync();
  assert.equal(result.status, 0, result.errors + result.text);

  const manifest = place.manifest();
  assert.equal(manifest.state, 'ok');
  assert.deepEqual(manifest.decks.map(deck => deck.name), ['Newest', 'Added last week', 'Old but edited today']);
  assert.deepEqual(manifest.decks.map(deck => deck.state), ['ready', 'ready', 'ready']);
  assert.deepEqual(manifest.decks.map(deck => deck.pages), [2, 12, 3]);
  assert.equal(manifest.decks[0].created, '2027-03-08T10:00:00.000Z');
  assert.ok(fs.existsSync(path.join(place.meeting, deckB, '012.jpg')), 'the pictures are on the disk');
  // The way Google was asked: only these three kinds, newest added first
  const asked = decodeURIComponent(result.calls.split('\n').filter(line => line.startsWith('config-url')).join(' '));
  assert.ok(asked.includes("mimeType = '" + slidesType + "'") && asked.includes("mimeType = '" + powerpointType + "'") && asked.includes("mimeType = '" + oldPowerpointType + "'"));
  assert.ok(asked.includes('orderBy=createdTime desc'));
  assert.ok(!result.calls.includes(key), 'the key is never in a command line');
});

test('the folder is the one in local.env, and Sanity is not asked for it', () => {
  const place = setup('own-folder', { folder: folderLink });
  place.list([drive(deckA, 'Deck')]);
  place.pdf(deckA, 1);
  const result = place.sync();
  assert.equal(result.status, 0, result.errors);
  assert.equal(place.manifest().folder, folderId);
  assert.ok(!result.calls.includes('api.sanity.io'), 'only Google is asked');
});

test('with no folder in local.env the folder of Dashboard Settings is read, and with neither the list is empty and says so', () => {
  const place = setup('sanity-folder');
  fs.writeFileSync(path.join(place.stub, 'sanity.json'), JSON.stringify({ result: { presentationDriveFolder: folderLink } }));
  place.list([drive(deckA, 'Deck')]);
  place.pdf(deckA, 1);
  place.sync();
  assert.equal(place.manifest().folder, folderId);

  const none = setup('no-folder');
  const result = none.sync();
  assert.equal(none.manifest().state, 'no-folder');
  assert.deepEqual(none.manifest().decks, []);
  assert.ok(result.text.includes('MEETING_DRIVE_FOLDER'), 'it says where to put the folder');
});

test('without the key it says so and keeps the decks it has', () => {
  const place = setup('no-key', { folder: folderLink, noKey: true });
  const result = place.sync();
  assert.equal(place.manifest().state, 'no-key');
  assert.ok(result.text.includes('GOOGLE_API_KEY'));
});

test('the watcher looks every 15 seconds, at once when Meeting opens, and does not touch the Teletraan computer files', () => {
  const script = fs.readFileSync(path.join(repo, 'computer/pi/meeting-sync.sh'), 'utf8');
  assert.ok(script.includes('every=15') && script.includes('! -e "$decks/.wake"') && script.includes('rm -f "$decks/.wake"'));
  assert.ok(script.includes('decks=${TELETRAAN_MEETING:-/var/lib/teletraan/meeting}'), 'its own folder, not data/decks');
  assert.ok(!/\$data\/decks|TELETRAAN_DATA/.test(script), 'not the folder of the dashboard');
});

await finish();
