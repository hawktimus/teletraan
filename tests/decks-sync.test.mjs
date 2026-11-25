// Tests for computer/scripts/decks-sync.sh and install-decks.sh.
// curl, pdftoppm, flock, timeout, id and systemctl are replaced with small fake ones in a temporary folder, so
// nothing touches the network or the machine. jq is the real one, so this test needs jq installed. The key in
// the test is made up.
//
//   node tests/decks-sync.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const scripts = ['decks-sync.sh', 'install-decks.sh', 'lib.sh'];
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-decks-'));

const ordinaryTools = ['base64', 'sed', 'tail', 'head', 'grep', 'find', 'mktemp', 'mv', 'rm', 'mkdir', 'date', 'dirname', 'basename', 'cat', 'cp', 'ls', 'stat', 'install'];
const key = 'FAKEKEY_abcdefghijklmnopqrstuvwxyz0123';
const folderId = '1AbCdEfGhIjKlMnOpQrStUvWxYz';
const secret = 'FAKESECRET_abcdefghijklmnopqrstuvwxyz';
const scriptUrl = 'https://script.google.com/macros/s/AKfycbxFAKEdeployment123/exec';
const folderLink = 'https://drive.google.com/drive/folders/' + folderId + '?usp=sharing';
const slidesType = 'application/vnd.google-apps.presentation';
const powerpointType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const deckA = '1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const deckB = '1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

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
    echo "config-url $from_config" | sed "s/$STUB_KEY/<key>/g; s/$STUB_SECRET/<secret>/g" >> "$STUB_LOG"
    address=$(printf '%s' "$from_config" | sed 's/&key=.*$//; s/&secret=.*$//')
  fi
fi
case $address in
  https://*.api.sanity.io/*|https://*.apicdn.sanity.io/*)
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
  https://script.google.com/*)
    [ -f "$STUB_DIR/script.exit" ] && exit "$(cat "$STUB_DIR/script.exit")"
    case $address in
      *action=list*)
        cp "$STUB_DIR/script-list.json" "$output"
        printf 200
        ;;
      *action=pdf*)
        id=\${address#*&id=}
        id=\${id%%&*}
        if [ -f "$STUB_DIR/$id.b64" ]; then cp "$STUB_DIR/$id.b64" "$output"; else echo '{"error":"not-found"}' > "$output"; fi
        ;;
      *action=skipped*)
        id=\${address#*&id=}
        id=\${id%%&*}
        # a script that was not updated does not know the word and says bad-action
        if [ -f "$STUB_DIR/$id.skipped.json" ]; then cp "$STUB_DIR/$id.skipped.json" "$output"; else echo '{"error":"bad-action"}' > "$output"; fi
        printf 200
        ;;
    esac
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
  fs.copyFileSync(path.join(repo, 'computer/systemd/teletraan-decks.service'), path.join(root, 'computer/systemd/teletraan-decks.service'));
  fs.copyFileSync(path.join(repo, 'dashboard/config.js'), path.join(root, 'dashboard/config.js'));

  const env = ["TELETRAAN_DATA='" + data + "'"];
  if (!options.noKey && !options.script) env.push("GOOGLE_API_KEY='" + key + "'");
  if (options.script) {
    env.push("DECKS_SCRIPT_URL='" + (options.scriptUrl || scriptUrl) + "'");
    if (!options.noSecret) env.push("DECKS_SCRIPT_SECRET='" + secret + "'");
  }
  fs.writeFileSync(path.join(root, 'computer/local.env'), env.join('\n') + '\n');

  ordinaryTools.forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));
  fs.symlinkSync(findTool('jq'), path.join(bin, 'jq'));
  writeTool(bin, 'curl', fakeCurl);
  writeTool(bin, 'pdftoppm', fakePdftoppm);
  writeTool(bin, 'timeout', '#!/bin/sh\nshift\nexec "$@"\n');
  writeTool(bin, 'flock', '#!/bin/sh\n[ "$STUB_LOCKED" != yes ]\n');
  writeTool(bin, 'id', '#!/bin/sh\n[ "$1" = -u ] && echo "$STUB_UID"\nexit 0\n');
  writeTool(bin, 'systemctl', '#!/bin/sh\necho "systemctl $*" >> "$STUB_LOG"\n');

  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');
  const decks = path.join(data, 'decks');

  return {
    root, decks, log, stub,
    run(script, args = [], extra = {}) {
      const env = Object.assign({ PATH: bin, STUB_LOG: log, STUB_DIR: stub, STUB_KEY: key, STUB_SECRET: secret, TMPDIR: temp, STUB_UID: '1000' }, extra);
      const result = spawnSync('/bin/bash', [path.join(root, 'computer/scripts', script)].concat(args), { env, encoding: 'utf8', input: '\n', cwd: root });
      return { text: result.stdout, errors: result.stderr, status: result.status, calls: fs.readFileSync(log, 'utf8') };
    },
    sync(extra) {
      return this.run('decks-sync.sh', [], extra);
    },
    // Sanity is asked again only when the answer it kept is old, so a test that changes the folder takes the kept one away
    folder(link) {
      fs.writeFileSync(path.join(stub, 'sanity.json'), JSON.stringify({ result: link === undefined ? null : { presentationDriveFolder: link } }));
      fs.rmSync(path.join(stub, 'sanity.exit'), { force: true });
      fs.rmSync(path.join(decks, '.folder'), { force: true });
    },
    list(files, code) {
      fs.writeFileSync(path.join(stub, 'list.json'), JSON.stringify(typeof files === 'string' ? JSON.parse(files) : { files }));
      fs.writeFileSync(path.join(stub, 'list.code'), String(code || 200));
      fs.rmSync(path.join(stub, 'list.exit'), { force: true });
    },
    pdf(id, pages) {
      fs.writeFileSync(path.join(stub, id + '.pdf'), '%PDF pages=' + pages + '\n');
    },
    // What the Apps Script answers to a list: the same shape the Drive API uses. A string is sent as it is.
    scriptList(files) {
      fs.writeFileSync(path.join(stub, 'script-list.json'), typeof files === 'string' ? files : JSON.stringify({ files }));
      fs.rmSync(path.join(stub, 'script.exit'), { force: true });
    },
    // The PDF of a deck as the Apps Script sends it: in base64
    scriptPdf(id, pages) {
      fs.writeFileSync(path.join(stub, id + '.b64'), Buffer.from('%PDF pages=' + pages + '\n').toString('base64'));
    },
    // What the Apps Script says of a deck: how many slides it has and which are hidden, counted from 1
    scriptSkipped(id, count, skipped) {
      fs.writeFileSync(path.join(stub, id + '.skipped.json'), JSON.stringify({ count, skipped }));
    },
    // The text of picture number $number of a deck, which the fake pdftoppm sets to the page it came from
    picture(id, number) {
      return fs.readFileSync(path.join(decks, id, String(number).padStart(3, '0') + '.jpg'), 'utf8');
    },
    manifest() {
      return JSON.parse(fs.readFileSync(path.join(decks, 'manifest.json'), 'utf8'));
    },
    deck(id) {
      return JSON.parse(fs.readFileSync(path.join(decks, id, 'manifest.json'), 'utf8'));
    },
    folders() {
      return fs.readdirSync(decks, { withFileTypes: true }).filter(entry => entry.isDirectory() && !entry.name.startsWith('.')).map(entry => entry.name).sort();
    },
    exports() {
      return (fs.readFileSync(log, 'utf8').match(/presentation\/d\/[A-Za-z0-9_-]+\/export\/pdf|^config-url .*action=pdf/gm) || []).length;
    },
  };
}

function drive(id, name, extra = {}) {
  return Object.assign({ id, name, mimeType: slidesType, modifiedTime: '2027-03-01T10:00:00.000Z' }, extra);
}

const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

function ready(name) {
  const place = setup(name);
  place.folder(folderLink);
  place.list([drive(deckA, 'Drive train basics'), drive(deckB, 'Safety week.PPTX', { mimeType: powerpointType, modifiedTime: '2027-03-02T10:00:00.000Z' })]);
  place.pdf(deckA, 3);
  place.pdf(deckB, 12);
  return place;
}

test('a run lists the folder, makes the pictures of each deck and writes a manifest of the right shape', () => {
  const place = ready('listing');
  const result = place.sync();
  assert.equal(result.status, 0, result.errors + result.text);
  assert.deepEqual(place.folders(), [deckA, deckB].sort());

  const manifest = place.manifest();
  assert.equal(manifest.ok, true);
  assert.equal(manifest.state, 'ok');
  assert.equal(manifest.folder, folderId);
  assert.ok(!isNaN(Date.parse(manifest.checkedAt)));
  // Newest first, and the name on the screen has no .pptx
  assert.deepEqual(manifest.decks, [
    { id: deckB, name: 'Safety week', kind: 'powerpoint', modified: '2027-03-02T10:00:00.000Z', state: 'ready', pages: 12 },
    { id: deckA, name: 'Drive train basics', kind: 'slides', modified: '2027-03-01T10:00:00.000Z', state: 'ready', pages: 3 },
  ]);

  const deck = place.deck(deckA);
  assert.equal(deck.ok, true);
  assert.deepEqual(deck.pages, ['001.jpg', '002.jpg', '003.jpg']);
  assert.equal(deck.modified, '2027-03-01T10:00:00.000Z');
  assert.deepEqual(fs.readdirSync(path.join(place.decks, deckA)).sort(), ['001.jpg', '002.jpg', '003.jpg', 'manifest.json']);
  assert.ok(result.calls.includes('-f 1 -l 120 '), 'pdftoppm is told the last page');
});

test('the list asks for Google Slides and PowerPoint files of the folder only, and the key is never in the process list', () => {
  const place = ready('asking');
  const result = place.sync();
  const asked = decodeURIComponent(result.calls.split('\n').find(line => line.startsWith('config-url ')));
  assert.ok(asked.includes("'" + folderId + "' in parents and trashed = false"), asked);
  assert.ok(asked.includes("mimeType = '" + slidesType + "' or mimeType = '" + powerpointType + "'"), asked);
  assert.ok(asked.endsWith('&key=<key>'), asked);
  result.calls.split('\n').filter(line => line.startsWith('curl ')).forEach(line => assert.ok(!line.includes(key), line));
  assert.ok(!result.text.includes(key) && !result.errors.includes(key));
});

test('a second run downloads nothing, and a deck that changed is made again', () => {
  const place = ready('again');
  place.sync();
  assert.equal(place.exports(), 2);

  place.sync();
  assert.equal(place.exports(), 2, 'nothing changed, so nothing is downloaded');

  place.list([drive(deckA, 'Drive train basics', { modifiedTime: '2027-03-05T10:00:00.000Z' }), drive(deckB, 'Safety week.pptx', { mimeType: powerpointType, modifiedTime: '2027-03-02T10:00:00.000Z' })]);
  place.pdf(deckA, 5);
  place.sync();
  assert.equal(place.exports(), 3);
  assert.equal(place.deck(deckA).pages.length, 5);
  assert.equal(place.manifest().decks[0].id, deckA, 'the deck that changed last is first');
  assert.equal(place.manifest().decks[0].pages, 5);
});

test('a deck that left the folder loses its pictures, and other kinds of file are never listed', () => {
  const place = ready('leaving');
  place.sync();
  place.list([drive(deckA, 'Drive train basics'), drive('1CCCCCCCCCCCCCCCCCCCC', 'Budget.xlsx', { mimeType: 'application/vnd.google-apps.spreadsheet' }), drive('../../etc', 'Bad id')]);
  const result = place.sync();
  assert.equal(result.status, 0, result.errors + result.text);
  assert.deepEqual(place.folders(), [deckA]);
  assert.deepEqual(place.manifest().decks.map(deck => deck.id), [deckA]);
});

test('a deck that is not shared is listed as failed with the reason, and the others still work', () => {
  const place = ready('not-shared');
  fs.rmSync(path.join(place.stub, deckB + '.pdf'));
  const result = place.sync();
  assert.equal(result.status, 1, 'a failed deck shows in the exit code');

  const decks = place.manifest().decks;
  assert.deepEqual(decks.map(deck => deck.state), ['failed', 'ready']);
  assert.equal(decks[0].error, 'not shared');
  assert.equal(place.deck(deckB).ok, false);

  // It is not tried again at once: a failed deck waits two minutes
  place.sync();
  assert.equal(place.exports(), 2);
});

test('a deck that worked stays when its new version cannot be made', () => {
  const place = ready('keeps');
  place.sync();
  place.list([drive(deckA, 'Drive train basics', { modifiedTime: '2027-03-09T10:00:00.000Z' })]);
  fs.writeFileSync(path.join(place.stub, deckA + '.pdf'), '%PDF pages=fail\n');
  const result = place.sync();
  assert.ok(result.text.includes('Keeping the one from before'), result.text);

  const deck = place.manifest().decks[0];
  assert.equal(deck.state, 'ready');
  assert.equal(deck.updating, true);
  assert.equal(deck.pages, 3);
  assert.equal(place.deck(deckA).pages.length, 3);
});

test('with no folder named the list is empty, and with no key or a refusal the decks from before stay', () => {
  const place = ready('states');
  place.sync();

  place.list('{"error":{"errors":[{"reason":"notFound"}]}}', 404);
  place.sync();
  assert.equal(place.manifest().state, 'not-shared');
  assert.equal(place.manifest().ok, false);
  assert.equal(place.manifest().decks.length, 2);

  place.list('{"error":{"status":"SERVICE_DISABLED"}}', 403);
  place.sync();
  assert.equal(place.manifest().state, 'api-off');

  place.list('{"error":{"errors":[{"reason":"keyInvalid"}]}}', 400);
  place.sync();
  assert.equal(place.manifest().state, 'bad-key');
  assert.deepEqual(place.folders(), [deckA, deckB].sort());

  place.folder('');
  const none = place.sync();
  assert.ok(none.text.includes('no Google Drive folder is named'), none.text);
  assert.equal(place.manifest().state, 'no-folder');
  assert.deepEqual(place.manifest().decks, []);
  assert.deepEqual(place.folders(), []);

  const keyless = setup('keyless', { noKey: true });
  keyless.folder(folderLink);
  const result = keyless.sync();
  assert.equal(keyless.manifest().state, 'no-key');
  assert.ok(result.text.includes('GOOGLE_API_KEY'), result.text);
  assert.ok(!result.calls.includes('googleapis'));
});

test('when Google or Sanity cannot be reached the decks from before stay and can be played', () => {
  const place = ready('offline');
  place.sync();

  fs.writeFileSync(path.join(place.stub, 'list.exit'), '6');
  const result = place.sync();
  assert.equal(result.status, 0, result.errors + result.text);
  assert.equal(place.manifest().state, 'offline');
  assert.equal(place.manifest().decks.filter(deck => deck.state === 'ready').length, 2);

  // Sanity down: the folder kept from before is used, even when it is old
  fs.rmSync(path.join(place.stub, 'list.exit'));
  fs.writeFileSync(path.join(place.stub, 'sanity.exit'), '6');
  const old = new Date(Date.now() - 3600 * 1000);
  fs.utimesSync(path.join(place.decks, '.folder'), old, old);
  place.sync();
  assert.equal(place.manifest().state, 'ok');

  // Sanity down on the first run ever: nothing is known, and nothing is asked of Google
  const fresh = setup('offline-fresh');
  fs.writeFileSync(path.join(fresh.stub, 'sanity.exit'), '6');
  const first = fresh.sync();
  assert.equal(first.status, 0, first.errors + first.text);
  assert.equal(fresh.manifest().state, 'offline');
  assert.ok(!first.calls.includes('googleapis'));
});

test('Sanity is asked for the folder once and the answer is kept for five minutes', () => {
  const place = ready('kept');
  place.sync();
  place.sync();
  assert.equal((fs.readFileSync(place.log, 'utf8').match(/sanity\.io/g) || []).length, 1);

  const old = new Date(Date.now() - 6 * 60 * 1000);
  fs.utimesSync(path.join(place.decks, '.folder'), old, old);
  place.sync();
  assert.equal((fs.readFileSync(place.log, 'utf8').match(/sanity\.io/g) || []).length, 2);
});

test('a run that starts while another is looking stops at once, and a wrong argument prints the usage', () => {
  const place = ready('locked');
  const result = place.sync({ STUB_LOCKED: 'yes' });
  assert.equal(result.status, 0);
  assert.ok(result.text.includes('Another decks-sync is looking'), result.text);
  assert.ok(!result.calls.includes('curl'));

  const wrong = place.run('decks-sync.sh', ['--often']);
  assert.equal(wrong.status, 1);
  assert.ok(wrong.errors.includes('Usage:'), wrong.errors);
});

function scriptReady(name, options = {}) {
  const place = setup(name, Object.assign({ script: true }, options));
  place.folder(folderLink);
  place.scriptList([drive(deckA, 'Drive train basics'), drive(deckB, 'Safety week', { modifiedTime: '2027-03-02T10:00:00.000Z' })]);
  place.scriptPdf(deckA, 3);
  place.scriptPdf(deckB, 12);
  place.scriptSkipped(deckA, 3, []);
  place.scriptSkipped(deckB, 12, []);
  return place;
}

test('with a script address and secret the decks come through the Apps Script, with no Google key and no call to Drive', () => {
  const place = scriptReady('script-listing');
  const result = place.sync();
  assert.equal(result.status, 0, result.errors + result.text);
  assert.equal(place.manifest().state, 'ok');
  assert.deepEqual(place.manifest().decks.map(deck => [deck.id, deck.state, deck.pages]), [[deckB, 'ready', 12], [deckA, 'ready', 3]]);
  assert.deepEqual(place.deck(deckA).pages, ['001.jpg', '002.jpg', '003.jpg']);
  assert.ok(!result.calls.includes('googleapis') && !result.calls.includes('docs.google.com'), result.calls);

  const asked = result.calls.split('\n').filter(line => line.startsWith('config-url '));
  assert.ok(asked[0].includes(scriptUrl + '?action=list&folder=' + folderId + '&secret=<secret>'), asked[0]);
  assert.ok(asked.some(line => line.includes('?action=pdf&id=' + deckA + '&folder=' + folderId + '&secret=<secret>')), asked.join('\n'));
  assert.ok(!result.calls.includes(secret) && !result.text.includes(secret) && !result.errors.includes(secret), 'the secret is never in the log or the output');

  place.sync();
  assert.equal(place.exports(), 2, 'a second run downloads nothing');
});

test('a deck the script cannot send is failed with a reason, and the other decks still work', () => {
  const place = scriptReady('script-deck-fails');
  fs.rmSync(path.join(place.stub, deckB + '.b64'));
  const result = place.sync();
  assert.equal(result.status, 1);
  assert.deepEqual(place.manifest().decks.map(deck => deck.state), ['failed', 'ready']);
  assert.equal(place.manifest().decks[0].error, 'the script could not read the deck');
});

test('hidden slides are left out of the pictures and the rest are numbered again', () => {
  const place = scriptReady('script-hidden');
  place.scriptSkipped(deckA, 3, [2]);
  place.scriptSkipped(deckB, 12, [12, 1, 5, 5, 99, 'x', 0]);
  const result = place.sync();
  assert.equal(result.status, 0, result.errors + result.text);
  assert.deepEqual(place.manifest().decks.map(deck => [deck.id, deck.state, deck.pages]), [[deckB, 'ready', 9], [deckA, 'ready', 2]]);
  assert.deepEqual(place.deck(deckA).pages, ['001.jpg', '002.jpg']);
  assert.deepEqual([place.picture(deckA, 1), place.picture(deckA, 2)], ['picture 1', 'picture 3']);
  assert.deepEqual([1, 2, 3, 4, 5].map(number => place.picture(deckB, number)), ['picture 2', 'picture 3', 'picture 4', 'picture 6', 'picture 7']);
  assert.equal(place.picture(deckB, 9), 'picture 11');
  assert.ok(!fs.existsSync(path.join(place.decks, deckB, '010.jpg')), 'no picture is left over');
  assert.ok(!result.calls.includes(secret), 'the secret is never in the log');
  const asked = result.calls.split('\n').filter(line => line.startsWith('config-url '));
  assert.ok(asked.some(line => line.includes('?action=skipped&id=' + deckA + '&folder=' + folderId + '&secret=<secret>')), asked.join('\n'));
});

test('a PDF that already leaves the hidden slides out is used as it is', () => {
  const place = scriptReady('script-already-left-out');
  place.scriptPdf(deckA, 2);
  place.scriptSkipped(deckA, 3, [2]);
  place.sync();
  assert.deepEqual(place.manifest().decks.map(deck => [deck.id, deck.state, deck.pages]), [[deckB, 'ready', 12], [deckA, 'ready', 2]]);
  assert.deepEqual([place.picture(deckA, 1), place.picture(deckA, 2)], ['picture 1', 'picture 2']);
});

test('a deck whose pictures do not fit what the script says is failed, and so is one with every slide hidden', () => {
  const place = scriptReady('script-no-fit');
  place.scriptPdf(deckA, 5);
  place.scriptSkipped(deckA, 3, [2]);
  place.scriptSkipped(deckB, 12, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const result = place.sync();
  assert.equal(result.status, 1);
  assert.deepEqual(place.manifest().decks.map(deck => [deck.id, deck.state]), [[deckB, 'failed'], [deckA, 'failed']]);
  assert.equal(place.deck(deckB).error, 'every slide of the deck is hidden');
  assert.equal(place.deck(deckA).error, 'the pictures do not match the slides of the deck');
});

test('a script that was not updated cannot name the hidden slides, so no deck is shown from it, and the earlier pictures stay', () => {
  const place = scriptReady('script-old');
  place.sync();
  assert.equal(place.manifest().decks.length, 2);

  place.scriptList([drive(deckA, 'Drive train basics', { modifiedTime: '2027-03-05T10:00:00.000Z' }), drive(deckB, 'Safety week', { modifiedTime: '2027-03-02T10:00:00.000Z' })]);
  fs.rmSync(path.join(place.stub, deckA + '.skipped.json'));
  const result = place.sync();
  assert.ok(result.text.includes('the script cannot name the hidden slides'), result.text);
  assert.equal(place.deck(deckA).ok, true, 'the version from before is kept');
  assert.equal(place.deck(deckA).modified, '2027-03-01T10:00:00.000Z');

  const fresh = scriptReady('script-old-new-deck');
  fs.rmSync(path.join(fresh.stub, deckA + '.skipped.json'));
  fresh.sync();
  assert.equal(fresh.deck(deckA).error, 'the script cannot name the hidden slides, update it (docs/presentations-drive.md)');
});

test('a public folder is read as before, with no question about hidden slides', () => {
  const place = ready('public-no-skipped-question');
  const result = place.sync();
  assert.equal(result.status, 0, result.errors + result.text);
  assert.ok(!result.calls.includes('action=skipped'), result.calls);
});

test('the script says no, or is not the script, and the decks from before stay', () => {
  const place = scriptReady('script-states');
  place.sync();

  place.scriptList('{"error":"denied"}');
  place.sync();
  assert.equal(place.manifest().state, 'bad-secret');
  assert.equal(place.manifest().decks.length, 2);

  place.scriptList('{"error":"wrong-folder"}');
  place.sync();
  assert.equal(place.manifest().state, 'wrong-folder');

  // A page to sign in to is what Google answers when the script is not open to Anyone
  place.scriptList('<html>Sign in</html>');
  place.sync();
  assert.equal(place.manifest().state, 'bad-script');

  fs.writeFileSync(path.join(place.stub, 'script.exit'), '6');
  place.sync();
  assert.equal(place.manifest().state, 'offline');
  assert.deepEqual(place.folders(), [deckA, deckB].sort());

  place.scriptList([drive(deckA, 'Drive train basics')]);
  place.sync();
  assert.equal(place.manifest().state, 'ok');
});

test('a script address that is not a Google Apps Script address, or no secret, asks nobody', () => {
  const wrong = setup('script-wrong-address', { script: true, scriptUrl: 'https://example.com/macros/s/AKfycbx/exec' });
  wrong.folder(folderLink);
  const first = wrong.sync();
  assert.equal(wrong.manifest().state, 'bad-script');
  assert.ok(first.text.includes('DECKS_SCRIPT_URL'), first.text);
  assert.ok(!first.calls.includes('example.com'));

  const keyless = setup('script-no-secret', { script: true, noSecret: true });
  keyless.folder(folderLink);
  const second = keyless.sync();
  assert.equal(keyless.manifest().state, 'bad-secret');
  assert.ok(second.text.includes('DECKS_SCRIPT_SECRET'), second.text);
  assert.ok(!second.calls.includes('script.google.com'));
});

test('with no folder named the script is not asked, and a Google key alone still works the old way', () => {
  const place = setup('script-no-folder', { script: true });
  place.folder('');
  const result = place.sync();
  assert.equal(place.manifest().state, 'no-folder');
  assert.ok(!result.calls.includes('script.google.com'));

  const old = ready('old-way-still-works');
  assert.equal(old.sync().status, 0);
  assert.equal(old.manifest().state, 'ok');
});

test('the unit tests and the local.env example name the script settings', () => {
  const example = fs.readFileSync(path.join(repo, 'computer/local.example.env'), 'utf8');
  assert.ok(example.includes('DECKS_SCRIPT_URL=') && example.includes('DECKS_SCRIPT_SECRET='));
});

test('the installer still needs sudo and the repository at /opt/teletraan before it changes anything', () => {
  const place = setup('install');
  const plain = place.run('install-decks.sh', [], { STUB_UID: '1000' });
  assert.equal(plain.status, 1);
  assert.ok(plain.errors.includes('it has to run with sudo'), plain.errors);

  const root = place.run('install-decks.sh', [], { STUB_UID: '0' });
  assert.equal(root.status, 1);
  assert.ok(root.errors.includes('The unit files expect the repository at /opt/teletraan'), root.errors);
  assert.ok(!root.calls.includes('systemctl'));
});

test('the unit file keeps the watcher running as the account of the repository', () => {
  const service = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-decks.service'), 'utf8');
  assert.ok(service.includes('User=ACCOUNT'));
  assert.ok(service.includes('ExecStart=/opt/teletraan/computer/scripts/decks-sync.sh --watch'));
  assert.ok(service.includes('Restart=always') && service.includes('WantedBy=multi-user.target'));
  assert.ok(fs.readFileSync(path.join(repo, 'tools/teletraan/teletraan-tool-deploy.sh'), 'utf8').includes(' photos-drive decks monday '));
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
