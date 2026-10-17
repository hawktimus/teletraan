// Tests for computer/scripts/backup-dataset.sh, its unit files and its installer.
// curl is a fake that logs its arguments and its standard input and answers like the
// export address, and status-write.sh is a fake that logs its call, so nothing touches Sanity. The token in the test is made up.
//
//   node tests/backup-dataset.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-backup-'));
const scriptFile = path.join(repo, 'computer/scripts/backup-dataset.sh');
const ordinaryTools = ['sed', 'head', 'tail', 'grep', 'date', 'dirname', 'cat', 'mkdir', 'rm', 'mv', 'ls', 'sort', 'gzip', 'basename', 'wc', 'tr'];
const token = 'skTESTtoken0123456789abcdef';
const config = fs.readFileSync(path.join(repo, 'dashboard/config.js'), 'utf8');
const dataset = config.match(/dataset: '([^']*)'/)[1];

function findTool(name) {
  const found = spawnSync('/bin/sh', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
  assert.ok(found, 'this computer has no ' + name);
  return found;
}

function writeTool(folder, name, text) {
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, name), text, { mode: 0o755 });
}

// The fake curl: it logs its arguments (argv) and the config it reads from standard
// input (stdin), writes the headers file named by -D, and prints documents (or what
// the flags in STUB_DIR ask for) on standard output.
const fakeCurl = `#!/bin/sh
echo "argv $*" >> "$STUB_LOG"
while IFS= read -r line; do echo "stdin $line" >> "$STUB_LOG"; done
headers=""
while [ "$#" -gt 0 ]; do
  [ "$1" = "-D" ] && headers="$2"
  shift
done
[ -f "$STUB_DIR/curl.exit" ] && exit "$(cat "$STUB_DIR/curl.exit")"
status=200
[ -f "$STUB_DIR/status" ] && status="$(cat "$STUB_DIR/status")"
printf 'HTTP/2 %s\\r\\ncontent-type: application/x-ndjson\\r\\n\\r\\n' "$status" > "$headers"
if [ -f "$STUB_DIR/junk" ]; then echo "not a gzip" | gzip -dc 2> /dev/null; echo "not ndjson"; exit 0; fi
if [ -f "$STUB_DIR/empty" ]; then exit 0; fi
echo '{"_id":"a1","_type":"tip"}'
echo '{"_id":"a2","_type":"tip"}'
`;
const fakeStatusWrite = `#!/bin/sh
echo "status-write $*" >> "$STUB_LOG"
`;

let counter = 0;
function setup(options = {}) {
  counter += 1;
  const root = path.join(work, 'place' + counter);
  const bin = path.join(root, 'bin');
  const stub = path.join(root, 'stub');
  const backups = path.join(root, 'backups');
  fs.mkdirSync(path.join(root, 'computer/scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dashboard'), { recursive: true });
  fs.mkdirSync(bin);
  fs.mkdirSync(stub);
  fs.mkdirSync(backups);

  fs.copyFileSync(scriptFile, path.join(root, 'computer/scripts/backup-dataset.sh'));
  fs.copyFileSync(path.join(repo, 'computer/scripts/lib.sh'), path.join(root, 'computer/scripts/lib.sh'));
  fs.copyFileSync(path.join(repo, 'dashboard/config.js'), path.join(root, 'dashboard/config.js'));
  writeTool(path.join(root, 'computer/scripts'), 'status-write.sh', fakeStatusWrite);
  if (!options.noCurl) writeTool(bin, 'curl', fakeCurl);
  const env = options.env === undefined ? "SANITY_WRITE_TOKEN='" + token + "'\n" : options.env;
  fs.writeFileSync(path.join(root, 'computer/local.env'), "TELETRAAN_BACKUP_DIR='" + backups + "'\n" + env);

  ordinaryTools.forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));
  // jq is optional for the script; with it, the first line must be a document
  const jq = spawnSync('/bin/sh', ['-c', 'command -v jq'], { encoding: 'utf8' }).stdout.trim();
  if (jq && !options.noJq) fs.symlinkSync(jq, path.join(bin, 'jq'));
  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');

  return {
    root: root,
    backups: backups,
    flag(name, text = '1') {
      fs.writeFileSync(path.join(stub, name), text);
    },
    // Files as earlier nights left them, named by day
    nights(days) {
      days.forEach((day, index) => fs.writeFileSync(path.join(backups, dataset + '-' + day + (index % 2 ? '.tar.gz' : '.ndjson.gz')), 'old'));
    },
    files() {
      return fs.readdirSync(backups).sort();
    },
    run() {
      const result = spawnSync('/bin/sh', [path.join(root, 'computer/scripts/backup-dataset.sh')], {
        env: { PATH: bin, STUB_LOG: log, STUB_DIR: stub },
        encoding: 'utf8',
        input: '',
      });
      return { status: result.status, text: result.stdout, errors: result.stderr, calls: fs.readFileSync(log, 'utf8').split('\n').filter(Boolean) };
    },
  };
}

// 20 days before a day in 2020, so none is today and all are older than the new file
const oldDays = Array.from({ length: 20 }, (item, index) => '2020-01-' + String(index + 1).padStart(2, '0'));
const todayName = () => dataset + '-' + spawnSync('date', ['+%F'], { encoding: 'utf8' }).stdout.trim() + '.ndjson.gz';
const projectId = config.match(/projectId: '([^']*)'/)[1];
const nameOf = (day, index) => dataset + '-' + day + (index % 2 ? '.tar.gz' : '.ndjson.gz');

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

test('it downloads the documents to <dataset>-<date>.ndjson.gz, with the token only in the curl config on stdin', () => {
  const place = setup();
  const result = place.run();
  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(place.files(), [todayName()]);
  const file = path.join(place.backups, todayName());
  assert.ok(gunzipOk(file));
  assert.ok(spawnSync('gzip', ['-dc', file], { encoding: 'utf8' }).stdout.includes('"_id":"a1"'));
  const argv = result.calls.find(line => line.startsWith('argv '));
  assert.ok(argv.includes('https://' + projectId + '.api.sanity.io/v2025-02-19/data/export/' + dataset), argv);
  assert.ok(argv.includes('-K -'), 'the config comes from stdin');
  const all = result.calls.join('\n');
  assert.ok(!argv.includes(token), 'the token is not in the arguments');
  assert.ok(result.calls.some(line => line.startsWith('stdin ') && line.includes('Bearer ' + token)), 'the token is in the stdin config');
  assert.ok(!result.text.includes(token) && !result.errors.includes(token), 'the token is never printed');
  assert.ok(all.split('\n').filter(line => line.includes(token)).every(line => line.startsWith('stdin ')));
  assert.deepEqual(result.calls.filter(line => line.startsWith('status-write')), ['status-write backup']);
});

test('the dataset in dashboard/config.js is production, as the file names say', () => {
  assert.equal(dataset, 'production');
});

test('the rotation keeps the newest 14, counting the new file, and leaves other files alone', () => {
  const place = setup();
  place.nights(oldDays);
  fs.writeFileSync(path.join(place.backups, 'notes.txt'), 'mine');
  fs.writeFileSync(path.join(place.backups, 'other-2020-01-01.tar.gz'), 'another dataset');
  const result = place.run();
  assert.equal(result.status, 0, result.errors);
  const kept = place.files().filter(name => name.startsWith(dataset + '-'));
  assert.equal(kept.length, 14);
  assert.ok(kept.includes(todayName()), 'the new file is kept');
  assert.ok(kept.includes(nameOf('2020-01-20', 19)) && !kept.includes(nameOf('2020-01-07', 6)) && kept.includes(nameOf('2020-01-08', 7)), 'the newest old ones stay: ' + kept.join());
  assert.ok(place.files().includes('notes.txt') && place.files().includes('other-2020-01-01.tar.gz'));
});

test('fewer than 14 files are all kept, and running twice in a day keeps one file for the day', () => {
  const place = setup();
  place.nights(oldDays.slice(0, 5));
  place.run();
  place.run();
  assert.equal(place.files().length, 6);
});

test('a failed download keeps every old backup, leaves no half file, names the cause and does not tell Studio', () => {
  const cases = [
    ['401', 'status', '401', 'cannot read the dataset'],
    ['403', 'status', '403', 'cannot read the dataset'],
    ['500', 'status', '500', 'Check the network'],
    ['network error', 'curl.exit', '6', 'Check the network'],
  ];
  cases.forEach(([name, flag, value, words]) => {
    const place = setup();
    place.nights(oldDays.slice(0, 14));
    place.flag(flag, value);
    const result = place.run();
    assert.notEqual(result.status, 0, name);
    assert.ok(result.errors.includes('The old backups were kept') && result.errors.includes(words), name + ': ' + result.errors);
    assert.equal(place.files().length, 14, name);
    assert.ok(!place.files().some(file => file.includes('partial')), name);
    assert.equal(result.calls.filter(line => line.startsWith('status-write')).length, 0, name);
    assert.ok(!result.errors.includes(token), name);
  });
});

test('an empty body or a first line that is not a document is not a backup and pushes nothing out', () => {
  ['empty', 'junk'].forEach(kind => {
    if (kind === 'junk' && !spawnSync('/bin/sh', ['-c', 'command -v jq']).stdout.length) return;
    const place = setup();
    place.nights(oldDays.slice(0, 14));
    place.flag(kind);
    const result = place.run();
    assert.notEqual(result.status, 0, kind);
    assert.equal(place.files().length, 14, kind);
    assert.ok(!place.files().includes(todayName()), kind);
  });
});

test('no token, an odd token or no curl stops it with a plain line and exports nothing', () => {
  const cases = [
    ['no token', { env: '' }, 'SANITY_WRITE_TOKEN is not in local.env'],
    ['the placeholder', { env: "SANITY_WRITE_TOKEN='[paste it here]'\n" }, 'SANITY_WRITE_TOKEN is not in local.env'],
    ['an odd token', { env: "SANITY_WRITE_TOKEN='sk bad token'\n" }, 'does not look like a token'],
    ['no curl', { noCurl: true }, 'curl is not installed'],
  ];
  cases.forEach(([name, options, words]) => {
    const place = setup(options);
    const result = place.run();
    assert.notEqual(result.status, 0, name);
    assert.ok(result.errors.includes(words), name + ': ' + result.errors);
    assert.equal(result.calls.filter(line => line.startsWith('argv ')).length, 0, name);
    assert.ok(!result.errors.includes('bad token'), 'a bad token is not repeated');
  });
});

test('without jq a body with a first line is accepted', () => {
  const place = setup({ noJq: true });
  place.flag('junk');
  const result = place.run();
  assert.equal(result.status, 0, result.errors);
  assert.ok(place.files().includes(todayName()));
});

test('a failure to tell Studio does not fail the backup', () => {
  const place = setup();
  fs.writeFileSync(path.join(place.root, 'computer/scripts/status-write.sh'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const result = place.run();
  assert.equal(result.status, 0, result.errors);
  assert.ok(place.files().includes(todayName()));
});

test('the script is valid sh, is executable, and writes at 03:15 through the timer with the units and installer in step', () => {
  assert.equal(spawnSync('/bin/sh', ['-n', scriptFile], { encoding: 'utf8' }).status, 0);
  assert.ok(fs.statSync(scriptFile).mode & 0o100);
  const service = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-backup.service'), 'utf8');
  const timer = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-backup.timer'), 'utf8');
  assert.ok(service.includes('ExecStart=/opt/teletraan/computer/scripts/backup-dataset.sh'));
  assert.ok(/^User=ACCOUNT$/m.test(service), 'the account is filled in by the installer');
  assert.ok(/^OnCalendar=\*-\*-\* 03:15:00$/m.test(timer));
  assert.ok(/^WantedBy=timers.target$/m.test(timer));

  const installer = path.join(repo, 'computer/scripts/install-backup.sh');
  const text = fs.readFileSync(installer, 'utf8');
  assert.equal(spawnSync('/bin/sh', ['-n', installer], { encoding: 'utf8' }).status, 0);
  assert.ok(fs.statSync(installer).mode & 0o100);
  assert.ok(text.includes('[ ! -s "$units/$unit" ]') && text.includes('[ ! -s "$tmp" ]'), 'a missing or empty unit stops it');
  assert.ok(text.includes('/var/backups/teletraan'));
  assert.ok(text.includes('User=ACCOUNT') && text.includes('stat -c %U'), 'the account is read from the repository');
  assert.ok(!text.includes(token));
  assert.ok(!text.includes('node_modules') && !text.includes('npm install'), 'the installer does not ask for the Sanity tool');
  assert.ok(text.includes('command -v curl') && text.includes('command -v gzip'));
  // The installer never prints the token line
  assert.ok(!/echo[^\n]*\$token|cat[^\n]*local\.env/.test(text));
});

function gunzipOk(file) {
  return spawnSync('gzip', ['-t', file]).status === 0;
}

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
