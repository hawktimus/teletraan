// Tests for mini/scripts/backup-dataset.sh, its unit files and its installer.
// The Sanity tool is a fake that writes a small gzip file, and status-write.sh is a
// fake that logs its call, so nothing touches Sanity. The token in the test is made up.
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
const scriptFile = path.join(repo, 'mini/scripts/backup-dataset.sh');
const ordinaryTools = ['sed', 'head', 'tail', 'grep', 'date', 'dirname', 'cat', 'mkdir', 'rm', 'mv', 'ls', 'sort', 'gzip', 'basename'];
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

// The fake export: sanity dataset export NAME FILE --overwrite. It writes a gzip
// file, or fails with the code in export.exit, or writes junk when junk exists.
// It logs its arguments, and whether the token came in its environment.
const fakeSanity = `#!/bin/sh
echo "sanity $*" >> "$STUB_LOG"
[ -n "\${SANITY_AUTH_TOKEN:-}" ] && echo "token-in-environment" >> "$STUB_LOG"
echo "directory $(basename "$(pwd)")" >> "$STUB_LOG"
[ -f "$STUB_DIR/export.exit" ] && exit "$(cat "$STUB_DIR/export.exit")"
if [ -f "$STUB_DIR/junk" ]; then echo "not a gzip" > "$4"; exit 0; fi
if [ -f "$STUB_DIR/empty" ]; then : > "$4"; exit 0; fi
echo "export of $3" | gzip > "$4"
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
  fs.mkdirSync(path.join(root, 'mini/scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dashboard'), { recursive: true });
  fs.mkdirSync(bin);
  fs.mkdirSync(stub);
  fs.mkdirSync(backups);

  fs.copyFileSync(scriptFile, path.join(root, 'mini/scripts/backup-dataset.sh'));
  fs.copyFileSync(path.join(repo, 'dashboard/config.js'), path.join(root, 'dashboard/config.js'));
  writeTool(path.join(root, 'mini/scripts'), 'status-write.sh', fakeStatusWrite);
  if (!options.noSanity) writeTool(path.join(root, 'studio/node_modules/.bin'), 'sanity', fakeSanity);
  const env = options.env === undefined ? "SANITY_WRITE_TOKEN='" + token + "'\n" : options.env;
  fs.writeFileSync(path.join(root, 'mini/local.env'), "TELETRAAN_BACKUP_DIR='" + backups + "'\n" + env);

  ordinaryTools.forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));
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
      days.forEach(day => fs.writeFileSync(path.join(backups, dataset + '-' + day + '.tar.gz'), 'old'));
    },
    files() {
      return fs.readdirSync(backups).sort();
    },
    run() {
      const result = spawnSync('/bin/sh', [path.join(root, 'mini/scripts/backup-dataset.sh')], {
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
const todayName = () => dataset + '-' + spawnSync('date', ['+%F'], { encoding: 'utf8' }).stdout.trim() + '.tar.gz';

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

test('it exports the dataset from studio/ to <dataset>-<date>.tar.gz, with the token in the environment and never on a command line', () => {
  const place = setup();
  const result = place.run();
  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(place.files(), [todayName()]);
  assert.ok(gunzipOk(path.join(place.backups, todayName())));
  const call = result.calls.find(line => line.startsWith('sanity '));
  assert.ok(call.startsWith('sanity dataset export ' + dataset + ' ' + path.join(place.backups, todayName())), call);
  assert.ok(result.calls.includes('token-in-environment'));
  assert.ok(result.calls.includes('directory studio'), 'it runs in studio/');
  assert.ok(!result.calls.join('\n').includes(token), 'the token is in no call');
  assert.ok(!result.text.includes(token) && !result.errors.includes(token), 'the token is never printed');
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
  assert.ok(kept.includes(dataset + '-2020-01-20.tar.gz') && !kept.includes(dataset + '-2020-01-07.tar.gz') && kept.includes(dataset + '-2020-01-08.tar.gz'), 'the newest old ones stay: ' + kept.join());
  assert.ok(place.files().includes('notes.txt') && place.files().includes('other-2020-01-01.tar.gz'));
});

test('fewer than 14 files are all kept, and running twice in a day keeps one file for the day', () => {
  const place = setup();
  place.nights(oldDays.slice(0, 5));
  place.run();
  place.run();
  assert.equal(place.files().length, 6);
});

test('a failed export keeps every old backup, leaves no half file, and does not tell Studio', () => {
  const place = setup();
  place.nights(oldDays.slice(0, 14));
  place.flag('export.exit', '1');
  const result = place.run();
  assert.notEqual(result.status, 0);
  assert.ok(result.errors.includes('The old backups were kept'), result.errors);
  assert.equal(place.files().length, 14);
  assert.ok(!place.files().some(name => name.includes('partial')));
  assert.equal(result.calls.filter(line => line.startsWith('status-write')).length, 0);
});

test('an empty export or a file that is not a gzip is not a backup and pushes nothing out', () => {
  ['empty', 'junk'].forEach(kind => {
    const place = setup();
    place.nights(oldDays.slice(0, 14));
    place.flag(kind);
    const result = place.run();
    assert.notEqual(result.status, 0, kind);
    assert.equal(place.files().length, 14, kind);
    assert.ok(!place.files().includes(todayName()), kind);
  });
});

test('no token, an odd token or no Sanity tool stops it with a plain line and exports nothing', () => {
  const cases = [
    ['no token', { env: '' }, 'SANITY_WRITE_TOKEN is not in local.env'],
    ['the placeholder', { env: "SANITY_WRITE_TOKEN='[paste it here]'\n" }, 'SANITY_WRITE_TOKEN is not in local.env'],
    ['an odd token', { env: "SANITY_WRITE_TOKEN='sk bad token'\n" }, 'does not look like a token'],
    ['no tool', { noSanity: true }, 'npm install'],
  ];
  cases.forEach(([name, options, words]) => {
    const place = setup(options);
    const result = place.run();
    assert.notEqual(result.status, 0, name);
    assert.ok(result.errors.includes(words), name + ': ' + result.errors);
    assert.equal(result.calls.filter(line => line.startsWith('sanity ')).length, 0, name);
    assert.ok(!result.errors.includes('bad token'), 'a bad token is not repeated');
  });
});

test('a failure to tell Studio does not fail the backup', () => {
  const place = setup();
  fs.writeFileSync(path.join(place.root, 'mini/scripts/status-write.sh'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const result = place.run();
  assert.equal(result.status, 0, result.errors);
  assert.ok(place.files().includes(todayName()));
});

test('the script is valid sh, is executable, and writes at 03:15 through the timer with the units and installer in step', () => {
  assert.equal(spawnSync('/bin/sh', ['-n', scriptFile], { encoding: 'utf8' }).status, 0);
  assert.ok(fs.statSync(scriptFile).mode & 0o100);
  const service = fs.readFileSync(path.join(repo, 'mini/systemd/teletraan-backup.service'), 'utf8');
  const timer = fs.readFileSync(path.join(repo, 'mini/systemd/teletraan-backup.timer'), 'utf8');
  assert.ok(service.includes('ExecStart=/opt/teletraan/mini/scripts/backup-dataset.sh'));
  assert.ok(/^User=ACCOUNT$/m.test(service), 'the account is filled in by the installer');
  assert.ok(/^OnCalendar=\*-\*-\* 03:15:00$/m.test(timer));
  assert.ok(/^WantedBy=timers.target$/m.test(timer));

  const installer = path.join(repo, 'mini/scripts/install-backup.sh');
  const text = fs.readFileSync(installer, 'utf8');
  assert.equal(spawnSync('/bin/sh', ['-n', installer], { encoding: 'utf8' }).status, 0);
  assert.ok(fs.statSync(installer).mode & 0o100);
  assert.ok(text.includes('[ ! -s "$units/$unit" ]') && text.includes('[ ! -s "$tmp" ]'), 'a missing or empty unit stops it');
  assert.ok(text.includes('/var/backups/teletraan'));
  assert.ok(text.includes('User=ACCOUNT') && text.includes('stat -c %U'), 'the account is read from the repository');
  assert.ok(!text.includes(token));
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
