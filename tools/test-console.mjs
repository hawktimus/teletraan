// Tests for the boot and shutdown screens: the two drawings in deploy/console,
// deploy/scripts/install-console.sh and deploy/systemd/teletraan-console.service.
// The script is run in a temporary folder that stands for the Mini's root, and
// the tools it uses on the Mini (id, systemctl) are replaced with small fake
// ones, so nothing touches the machine.
//
//   node tools/test-console.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const consoleFolder = path.join(repo, 'deploy/console');
const installFile = path.join(repo, 'deploy/scripts/install-console.sh');
const unitFile = path.join(repo, 'deploy/systemd/teletraan-console.service');
const sampleFile = path.join(repo, 'dashboard/data/sample/content.json');
const work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-console-')));

const maxColumns = 100;
const maxRows = 56;
// The drawing is centred on column 49 of its own 99 columns
const middle = 49;
const margin = 70;
const debianIssue = 'Debian GNU/Linux 12 \\n \\l\n\n';

// The tools the script needs that are not the ones being faked
const ordinaryTools = ['pr', 'cmp', 'cp', 'install', 'mkdir', 'tail', 'grep', 'mktemp', 'rm', 'dirname', 'cat'];

function findTool(name) {
  const found = spawnSync('/bin/sh', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
  assert.ok(found, 'this computer has no ' + name);
  return found;
}

function writeTool(folder, name, text) {
  fs.writeFileSync(path.join(folder, name), text, { mode: 0o755 });
}

function lines(file) {
  const text = fs.readFileSync(path.join(consoleFolder, file), 'utf8');
  assert.ok(text.endsWith('\n') && !text.endsWith('\n\n'), file + ' ends with one newline');
  return text.slice(0, -1).split('\n');
}

// Makes a copy of the deploy folder inside a fake root, with an /etc/issue like
// Debian's, and returns how to run the script and what it left behind.
function setup(name, options) {
  const settings = Object.assign({ place: 'opt/teletraan', issue: debianIssue, fakePr: false }, options || {});
  const root = path.join(work, name);
  const home = path.join(root, settings.place);
  const bin = path.join(root, 'bin');
  ['deploy/scripts', 'deploy/systemd', 'deploy/console'].forEach(folder => fs.mkdirSync(path.join(home, folder), { recursive: true }));
  fs.mkdirSync(path.join(root, 'etc/systemd/system'), { recursive: true });
  fs.mkdirSync(bin);

  fs.copyFileSync(installFile, path.join(home, 'deploy/scripts/install-console.sh'));
  fs.chmodSync(path.join(home, 'deploy/scripts/install-console.sh'), fs.statSync(installFile).mode);
  fs.copyFileSync(unitFile, path.join(home, 'deploy/systemd/teletraan-console.service'));
  ['startup.txt', 'shutdown.txt'].forEach(file => fs.copyFileSync(path.join(consoleFolder, file), path.join(home, 'deploy/console', file)));
  if (settings.issue !== null) fs.writeFileSync(path.join(root, 'etc/issue'), settings.issue);

  ordinaryTools.filter(tool => !(settings.fakePr && tool === 'pr')).forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));
  if (settings.fakePr) writeTool(bin, 'pr', '#!/bin/sh\nexit 0\n');
  writeTool(bin, 'id', '#!/bin/sh\n[ "$1" = -u ] && echo "$STUB_UID"\nexit 0\n');
  writeTool(bin, 'systemctl', '#!/bin/sh\necho "systemctl $*" >> "$STUB_LOG"\n');

  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');

  return {
    root: root,
    home: home,
    issue: path.join(root, 'etc/issue'),
    saved: path.join(root, 'etc/issue.before-teletraan'),
    unit: path.join(root, 'etc/systemd/system/teletraan-console.service'),
    install(extra) {
      const env = Object.assign({ PATH: bin, CONSOLE_ROOT: root, STUB_LOG: log, STUB_UID: '0' }, extra || {});
      const result = spawnSync('/bin/sh', [path.join(home, 'deploy/scripts/install-console.sh')], { env: env, encoding: 'utf8', input: '\n', cwd: root });
      return { text: result.stdout, errors: result.stderr, status: result.status, calls: fs.readFileSync(log, 'utf8') };
    },
    // Every file under etc, with its text, so a run that must change nothing can be compared
    snapshot() {
      const found = {};
      const walk = folder => fs.readdirSync(folder, { withFileTypes: true }).forEach(entry => {
        const full = path.join(folder, entry.name);
        if (entry.isDirectory()) walk(full);
        else found[path.relative(root, full)] = fs.readFileSync(full, 'utf8');
      });
      walk(path.join(root, 'etc'));
      return found;
    },
  };
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

// The drawings

test('both drawings are plain 7 bit text with no backslash, tab or trailing space', () => {
  ['startup.txt', 'shutdown.txt'].forEach(file => {
    const bytes = fs.readFileSync(path.join(consoleFolder, file));
    assert.ok(bytes.length > 0, file + ' is not empty');
    bytes.forEach(byte => assert.ok(byte === 10 || (byte >= 32 && byte <= 126), file + ' has the byte ' + byte));
    assert.ok(!bytes.includes(92), file + ' has a backslash, which the login prompt would read as a code');
    lines(file).forEach((line, index) => assert.equal(line, line.replace(/\s+$/, ''), file + ' row ' + (index + 1) + ' ends with a space'));
  });
});

test('both drawings fit in 100 columns and 56 rows, and the title and the words are centred', () => {
  ['startup.txt', 'shutdown.txt'].forEach(file => {
    const rows = lines(file);
    assert.ok(rows.length <= maxRows, file + ' has ' + rows.length + ' rows');
    rows.forEach((row, index) => assert.ok(row.length <= maxColumns, file + ' row ' + (index + 1) + ' is ' + row.length + ' columns'));

    const words = rows[rows.length - 1];
    const first = words.search(/\S/);
    const last = words.length - 1;
    assert.equal(first + last, 2 * middle, file + ' words are not centred');
    assert.equal(words.trim(), file === 'startup.txt' ? 'starting up' : 'shutting down');
  });
});

test('the two drawings are the same except for the last line, and the title is seven rows of block letters', () => {
  const startup = lines('startup.txt');
  const shutdown = lines('shutdown.txt');
  assert.equal(startup.length, shutdown.length);
  assert.deepEqual(startup.slice(0, -1), shutdown.slice(0, -1));
  assert.notEqual(startup[startup.length - 1], shutdown[shutdown.length - 1]);

  // Seven rows of block letters sit above the words, with a blank row on each side
  const title = startup.slice(-9, -2);
  assert.equal(startup[startup.length - 2], '');
  assert.equal(startup[startup.length - 10], '');
  assert.ok(title.every(row => /^[# ]+$/.test(row)), 'the title is made of # only');
  assert.ok(title.every(row => row.length <= maxColumns));
  assert.equal(title[0].search(/\S/), 0, 'the T of TELETRAAN is at the left edge');
  assert.equal(title[0].length, 2 * middle + 1, 'the I is at the right edge, so the title is centred');
});

test('the figure is symmetric: each row is the same read from either side', () => {
  const rows = lines('startup.txt');
  const figure = rows.slice(0, rows.indexOf(''));
  assert.ok(figure.length >= 40, 'the figure is the rows above the first blank row');
  const swap = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<' };
  figure.forEach((row, index) => {
    const wide = row.padEnd(2 * middle + 1);
    const mirrored = [...wide].reverse().map(character => swap[character] || character).join('');
    assert.equal(mirrored, wide, 'row ' + (index + 1) + ' of the figure is not symmetric');
  });
});

test('the figure has a face and two hands: two eyes with a highlight each, a smile, and two fingertips pointing at each other', () => {
  const rows = lines('startup.txt');
  const figure = rows.slice(0, rows.indexOf(''));

  // Eyes: the rows with the dark iris have the same number of dark cells on each side of the middle
  const eyeRows = figure.filter(row => row.includes('@'));
  assert.ok(eyeRows.length >= 4, 'the eyes are at least four rows tall');
  eyeRows.forEach(row => {
    const left = (row.slice(0, middle).match(/@/g) || []).length;
    const right = (row.slice(middle + 1).match(/@/g) || []).length;
    assert.equal(left, right);
    assert.ok(left >= 5, 'each eye is wide');
  });
  assert.equal(figure.filter(row => row.includes('oo')).length, 2, 'a highlight two rows tall in each eye');

  // A slight smile on the middle column
  const mouth = figure.find(row => row.includes("'.___.'"));
  assert.ok(mouth, 'the mouth is a low curve with the corners up');
  assert.equal(mouth.indexOf("'.___.'") + 3, middle, 'the mouth is on the middle');

  // Hands: the fingertips on the middle, five spaces apart, on two rows
  const tips = figure.filter(row => row[middle - 3] === ')' && row[middle + 3] === '(' && row.slice(middle - 2, middle + 3) === '     ');
  assert.equal(tips.length, 2, 'the two index fingers are two rows thick and point at each other');
  assert.equal(figure.join('\n').split('(_)(_)(_)').length - 1, 2, 'the curled fingers show on both hands');
});

test('the sample content carries both drawings, written as JSON text, equal to the files', () => {
  const sample = JSON.parse(read(sampleFile));
  assert.deepEqual(Object.keys(sample.console), ['startup', 'shutdown']);
  assert.equal(sample.console.startup, read(path.join(consoleFolder, 'startup.txt')));
  assert.equal(sample.console.shutdown, read(path.join(consoleFolder, 'shutdown.txt')));

  // Each is one line of the file with the new lines written as \n
  const file = read(sampleFile);
  assert.equal(file.split('\n').filter(line => line.startsWith('    "startup": "')).length, 1);
  assert.equal(file.split('\n').filter(line => line.startsWith('    "shutdown": "')).length, 1);
});

test('the drawings are not served: the web server shows the dashboard folder and no copy of them is in it', () => {
  const compose = read(path.join(repo, 'deploy/docker-compose.yml'));
  const sources = compose.split('\n')
    .map(line => line.match(/^\s*- ([^:\s]+):\/srv\/web\//) || line.match(/^\s*source: (\S+)/))
    .filter(Boolean)
    .map(match => match[1]);
  assert.deepEqual(sources, ['../dashboard', '${TELETRAAN_DATA:-/var/lib/teletraan/data}']);

  const nginx = read(path.join(repo, 'deploy/nginx.conf'));
  assert.ok(/root \/srv\/web;/.test(nginx));
  assert.ok(!/console/.test(nginx + compose), 'neither file names the console folder');

  const found = [];
  const walk = folder => fs.readdirSync(folder, { withFileTypes: true }).forEach(entry => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name === 'startup.txt' || entry.name === 'shutdown.txt') found.push(full);
  });
  walk(path.join(repo, 'dashboard'));
  assert.deepEqual(found, [], 'no drawing file is inside the dashboard folder');
});

// The unit

test('the unit is ordered before shutdown, counts as running, and clears, switches and prints on tty1 when it stops', () => {
  const text = read(unitFile);
  const values = key => text.split('\n').filter(line => line.startsWith(key + '=')).map(line => line.slice(key.length + 1));

  assert.deepEqual(values('DefaultDependencies'), ['no']);
  assert.deepEqual(values('Conflicts'), ['shutdown.target']);
  assert.ok(values('Before').includes('shutdown.target'));
  assert.deepEqual(values('Type'), ['oneshot']);
  assert.deepEqual(values('RemainAfterExit'), ['yes']);
  assert.deepEqual(values('ExecStart'), ['/usr/bin/true']);
  assert.deepEqual(values('TTYPath'), ['/dev/tty1']);
  assert.deepEqual(values('StandardOutput'), ['tty']);
  assert.deepEqual(values('WantedBy'), ['multi-user.target']);
  assert.deepEqual(values('ExecStop'), [
    '/usr/bin/clear',
    '/usr/bin/chvt 1',
    '/usr/bin/pr -t -o ' + margin + ' /opt/teletraan/deploy/console/shutdown.txt',
  ]);
  assert.ok(fs.existsSync(path.join(repo, 'deploy/console/shutdown.txt')));
});

test('the unit names no account and no user, and the script and the unit use the same margin', () => {
  const unit = read(unitFile);
  assert.ok(!/^User=/m.test(unit), 'the service runs as root and needs no User= line');
  assert.ok(!unit.includes('ACCOUNT'), 'the placeholder the other units use is not needed');
  assert.ok(!/hawktimus/i.test(unit + read(installFile)), 'no account name is written anywhere');
  assert.ok(new RegExp('^margin=' + margin + '$', 'm').test(read(installFile)));
});

// The script

test('it stops, naming the file, when a file it installs is missing or empty, and changes nothing', () => {
  ['deploy/console/startup.txt', 'deploy/console/shutdown.txt', 'deploy/systemd/teletraan-console.service'].forEach(file => {
    const missing = setup('missing-' + path.basename(file));
    const before = missing.snapshot();
    fs.rmSync(path.join(missing.home, file));
    const first = missing.install();
    assert.equal(first.status, 1);
    assert.ok(first.errors.includes(path.basename(file) + ' is missing or empty'), first.errors);

    const empty = setup('empty-' + path.basename(file));
    fs.writeFileSync(path.join(empty.home, file), '');
    const second = empty.install();
    assert.equal(second.status, 1);
    assert.ok(second.errors.includes(path.basename(file) + ' is missing or empty'), second.errors);

    [first, second].forEach(result => assert.ok(!result.calls.includes('systemctl'), 'nothing was changed'));
    assert.deepEqual(missing.snapshot(), before);
    assert.deepEqual(empty.snapshot(), before);
  });
});

test('it stops when the startup drawing has a backslash, which the login prompt would read as a code', () => {
  const place = setup('backslash');
  const before = place.snapshot();
  fs.appendFileSync(path.join(place.home, 'deploy/console/startup.txt'), 'a \\ b\n');
  const result = place.install();
  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('has a backslash in it'), result.errors);
  assert.ok(!result.calls.includes('systemctl'));
  assert.deepEqual(place.snapshot(), before);
});

test('it stops when there is no text in /etc/issue to keep a copy of, and writes nothing', () => {
  [null, ''].forEach(issue => {
    const place = setup('no-issue-' + (issue === null ? 'missing' : 'empty'), { issue: issue });
    const before = place.snapshot();
    const result = place.install();
    assert.equal(result.status, 1);
    assert.ok(result.errors.includes('missing or empty, so there is no text to keep a copy of'), result.errors);
    assert.ok(!result.calls.includes('systemctl'));
    assert.deepEqual(place.snapshot(), before);
    assert.ok(!fs.existsSync(place.saved));
  });
});

test('it needs sudo and the repository at /opt/teletraan before it changes anything', () => {
  const plain = setup('not-root');
  const before = plain.snapshot();
  const first = plain.install({ STUB_UID: '1000' });
  assert.equal(first.status, 1);
  assert.ok(first.errors.includes('it has to run with sudo'), first.errors);

  const elsewhere = setup('elsewhere', { place: 'srv/teletraan' });
  const second = elsewhere.install();
  assert.equal(second.status, 1);
  assert.ok(second.errors.includes('The unit file expects the repository at'), second.errors);

  [first, second].forEach(result => assert.ok(!result.calls.includes('systemctl')));
  assert.deepEqual(plain.snapshot(), before);
  assert.deepEqual(elsewhere.snapshot(), { 'etc/issue': debianIssue });
});

test('it stops without writing when the drawing comes out empty', () => {
  const place = setup('empty-drawing', { fakePr: true });
  const before = place.snapshot();
  const result = place.install();
  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('The drawing came out empty'), result.errors);
  assert.ok(!result.calls.includes('systemctl'));
  assert.deepEqual(place.snapshot(), before);
});

test('a first run keeps a copy of the original text, puts the drawing above it, copies the unit and turns it on', () => {
  const place = setup('first');
  const result = place.install();
  assert.equal(result.status, 0, result.errors);

  assert.equal(read(place.saved), debianIssue, 'the original text is kept as it was');
  assert.equal(read(place.unit), read(unitFile), 'the unit is copied as it is');

  const issue = read(place.issue);
  assert.ok(issue.endsWith('\n\n' + debianIssue), 'the original text follows the drawing and a blank line, so the login prompt still has its codes');
  const drawing = issue.slice(0, issue.length - debianIssue.length - 2).split('\n').map(line => line.replace(/\s+$/, ''));
  assert.deepEqual(drawing, lines('startup.txt').map(line => (line === '' ? '' : ' '.repeat(margin) + line)));
  assert.ok(!drawing.join('\n').includes('\\'), 'the drawing has no backslash');
  assert.equal(issue.split('\\').length, debianIssue.split('\\').length, 'the only backslashes are the original ones');

  [place.issue, place.saved, place.unit].forEach(file => assert.ok(fs.statSync(file).size > 0, file + ' is not empty'));
  assert.deepEqual(result.calls.trim().split('\n'), ['systemctl daemon-reload', 'systemctl enable --now teletraan-console.service']);
  assert.ok(result.text.includes('Saved a copy') && result.text.includes('Wrote') && result.text.includes('Copied') && result.text.includes('is turned on'), result.text);
});

test('running it twice changes nothing the second time, not even the time of the files', () => {
  const place = setup('twice');
  assert.equal(place.install().status, 0);
  const before = place.snapshot();

  const old = new Date('2026-01-01T00:00:00Z');
  [place.issue, place.saved, place.unit].forEach(file => fs.utimesSync(file, old, old));

  const second = place.install();
  assert.equal(second.status, 0, second.errors);
  assert.deepEqual(place.snapshot(), before);
  [place.issue, place.saved, place.unit].forEach(file => assert.equal(fs.statSync(file).mtimeMs, old.getTime(), file + ' was written again'));
  assert.ok(second.text.includes('Kept the copy') && second.text.includes('already shows the drawing') && second.text.includes('already in'), second.text);
  assert.ok(!second.calls.includes('restart') && !second.calls.includes('stop'), 'a running unit is never restarted: stopping it prints the shutdown drawing');
});

test('the saved copy is never overwritten, and the text is built again from it', () => {
  const place = setup('copy-kept');
  place.install();

  // Someone puts the plain text back in /etc/issue by hand
  fs.writeFileSync(place.issue, 'Something else\n');
  assert.equal(place.install().status, 0);
  assert.equal(read(place.saved), debianIssue, 'the copy still has the original text');
  assert.ok(read(place.issue).endsWith('\n\n' + debianIssue));

  // Someone changes the copy on purpose
  fs.writeFileSync(place.saved, 'Our own text \\l\n');
  assert.equal(place.install().status, 0);
  assert.equal(read(place.saved), 'Our own text \\l\n');
  assert.ok(read(place.issue).endsWith('\n\nOur own text \\l\n'));
});

test('it stops when the drawing is already in /etc/issue and the copy is gone, so the drawing is never kept as the original', () => {
  const place = setup('copy-lost');
  place.install();
  fs.rmSync(place.saved);
  const before = place.snapshot();

  const result = place.install();
  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('already shows the drawing, but there is no copy of the original text'), result.errors);
  assert.deepEqual(place.snapshot(), before);
  assert.ok(!fs.existsSync(place.saved));
});

test('it installs and turns on the console unit only, never runs apt, and never restarts or stops anything', () => {
  const text = read(installFile);

  const unitNames = text.match(/teletraan-[a-z]+\.(service|timer)/g);
  assert.deepEqual([...new Set(unitNames)], ['teletraan-console.service']);
  assert.ok(!text.includes('teletraan-*'), 'no pattern that picks up the other units');
  assert.ok(!/^\s*(sudo\s+)?apt(-get)?\s/m.test(text), 'it installs no package');

  const systemctl = text.split('\n').filter(line => /^\s*systemctl /.test(line)).map(line => line.trim());
  assert.deepEqual(systemctl, ['systemctl daemon-reload', 'systemctl enable --now "$unit"']);
});

test('the script has valid sh syntax and is executable', () => {
  const syntax = spawnSync('/bin/sh', ['-n', installFile], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
  assert.ok(read(installFile).startsWith('#!/bin/sh\n'));
  assert.ok((fs.statSync(installFile).mode & 0o111) !== 0, 'the script should be executable');
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
