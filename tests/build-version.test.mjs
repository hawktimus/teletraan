// Tests for the build on the wall: the job "version" of computer/scripts/status-write.sh (the hash, the date and the
// branch written to status-mini), kiosk.sh calling it at start, the Mac tool calling it after the copy, and the
// places that show it. curl, ssh, rsync, sudo and systemctl are small fake ones in a temporary folder, so nothing
// touches the network or a real Mini. The token and the project are made up.
//
//   node tests/build-version.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { copyParts } from './helpers/script-parts.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-build-version-'));
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

function writeTool(folder, name, text) {
  fs.writeFileSync(path.join(folder, name), text, { mode: 0o755 });
}

function findTool(name) {
  const found = spawnSync('/bin/sh', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
  assert.ok(found, 'this computer has no ' + name);
  return found;
}

const token = 'skTESTtoken0123456789abcdef';

// A fake curl that keeps the body of a write and answers nothing else
const fakeCurl = `#!/bin/sh
echo "curl $*" >> "$STUB_LOG"
body=""
previous=""
for argument in "$@"; do
  [ "$previous" = --data ] && body=$argument
  previous=$argument
done
case " $* " in *" --config - "*) cat > /dev/null ;; esac
printf '%s' "$body" > "$STUB_DIR/last-body.json"
exit 0
`;

// A copy of the Teletraan computer's repository: the script, config.js and, when asked, a git history
function computerPlace(name, options = {}) {
  const root = path.join(work, name);
  const bin = path.join(root, 'bin');
  const stub = path.join(root, 'stub');
  fs.mkdirSync(path.join(root, 'computer/scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dashboard'), { recursive: true });
  fs.mkdirSync(bin);
  fs.mkdirSync(stub);
  fs.copyFileSync(path.join(repo, 'computer/scripts/status-write.sh'), path.join(root, 'computer/scripts/status-write.sh'));
  fs.copyFileSync(path.join(repo, 'computer/scripts/lib.sh'), path.join(root, 'computer/scripts/lib.sh'));
  fs.copyFileSync(path.join(repo, 'dashboard/config.js'), path.join(root, 'dashboard/config.js'));
  fs.writeFileSync(path.join(root, 'computer/local.env'), "SANITY_WRITE_TOKEN='" + (options.noToken ? '' : token) + "'\n");
  ['sed', 'tail', 'head', 'grep', 'date', 'dirname', 'cat', 'awk'].concat(options.git ? ['git'] : []).forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));
  writeTool(bin, 'curl', fakeCurl);
  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');

  if (options.git) {
    const env = Object.assign({}, process.env, {
      GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_AUTHOR_DATE: '2026-10-14T12:00:00Z',
      GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@example.invalid', GIT_COMMITTER_DATE: '2026-10-14T12:00:00Z',
    });
    const git = args => {
      const result = spawnSync('git', ['-C', root].concat(args), { env: env, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    git(['init', '-q', '-b', 'work']);
    git(['add', 'dashboard/config.js']);
    git(['commit', '-q', '-m', 'first']);
    options.commit = git(['rev-parse', '--short', 'HEAD']);
  }

  return {
    root: root,
    commit: options.commit,
    run() {
      const result = spawnSync('/bin/sh', [path.join(root, 'computer/scripts/status-write.sh'), 'version'], {
        env: { PATH: bin, STUB_LOG: log, STUB_DIR: stub }, encoding: 'utf8', input: '',
      });
      return { text: result.stdout, errors: result.stderr, status: result.status, calls: fs.readFileSync(log, 'utf8') };
    },
    body() {
      const file = path.join(stub, 'last-body.json');
      return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    },
  };
}

const setOf = body => body.mutations[1].patch.set;

test('version writes the short hash, the date and the branch of the repository to status-mini', () => {
  const place = computerPlace('git', { git: true });
  const result = place.run();
  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(setOf(place.body()), { buildCommit: place.commit, buildDate: '2026-10-14', buildBranch: 'work' });
  assert.equal(place.body().mutations[0].createIfNotExists._id, 'status-mini');
  assert.ok(!result.text.includes(token) && !result.errors.includes(token) && !result.calls.includes(token), 'the token never shows');
});

test('version reads computer/build.txt when the Mac tool left one, because a copy has no git history of its own', () => {
  const place = computerPlace('stamp', { git: true });
  fs.writeFileSync(path.join(place.root, 'computer/build.txt'), 'commit=abc1234\ndate=2026-10-13\nbranch=main\n');
  assert.equal(place.run().status, 0);
  assert.deepEqual(setOf(place.body()), { buildCommit: 'abc1234', buildDate: '2026-10-13', buildBranch: 'main' });
});

test('version refuses a stamp that does not look like a hash, a date and a branch, and writes nothing', () => {
  ['commit=abc"1234\ndate=2026-10-13\nbranch=main\n', 'commit=abc1234\ndate=yesterday\nbranch=main\n', 'commit=abc1234\ndate=2026-10-13\nbranch=a b;c\n', ''].forEach((text, index) => {
    const place = computerPlace('bad-' + index);
    fs.writeFileSync(path.join(place.root, 'computer/build.txt'), text);
    const result = place.run();
    assert.equal(result.status, 1, text);
    assert.equal(place.body(), null, 'nothing was sent for ' + JSON.stringify(text));
  });
});

test('version does nothing without a token, and without git or a stamp', () => {
  const quiet = computerPlace('no-token', { git: true, noToken: true });
  assert.equal(quiet.run().status, 0);
  assert.equal(quiet.body(), null);
  assert.equal(quiet.run().calls, '');

  const bare = computerPlace('no-git');
  assert.equal(bare.run().status, 0);
  assert.equal(bare.body(), null);
});

test('kiosk.sh starts the version job at the beginning, in the background, with its output thrown away', () => {
  const text = read('computer/scripts/kiosk.sh');
  const call = '"$computer/scripts/status-write.sh" version > /dev/null 2>&1 &';
  assert.equal(text.split(call).length, 2, 'kiosk.sh has the call once');
  assert.ok(text.indexOf(call) < text.indexOf('exec ') || !text.includes('exec '), 'before the browser starts');
});

test('a pull removes the stamp, so git is the truth again', () => {
  assert.ok(read('computer/scripts/pull.sh').includes('rm -f "$computer/build.txt"'));
  assert.ok(/^computer\/build\.txt$/m.test(read('.gitignore')));
});

// The Mac tool, with the Teletraan computer as a folder

const fakeSsh = `#!/bin/sh
echo "ssh $*" >> "$STUB_LOG"
while [ "$#" -gt 0 ]; do
  case $1 in
    -o) shift 2 ;;
    -*) shift ;;
    *) break ;;
  esac
done
shift
command=$*
case $command in
  true) exit 0 ;;
  'systemctl is-active teletraan-pull.timer') echo inactive; exit 3 ;;
  *status-write.sh*) echo "ran status-write" >> "$STUB_LOG"; exit 0 ;;
  *) cd "$COMPUTER_HOME" && PATH="$STUB_FAKES:$PATH" HOME="$COMPUTER_HOME" sh -c "$command" ;;
esac
`;

function toolPlace(name, options = {}) {
  const root = path.join(work, name);
  const place = {
    home: path.join(root, 'home'),
    fakes: path.join(root, 'fakes'),
    computerHome: path.join(root, 'computer-home'),
    computerRepo: path.join(root, 'computer-repo'),
    log: path.join(root, 'calls.log'),
  };
  [place.home, place.fakes, place.miniHome, path.join(place.miniRepo, 'computer/scripts'), path.join(place.home, '.teletraan')].forEach(folder => fs.mkdirSync(folder, { recursive: true }));
  writeTool(place.fakes, 'ssh', fakeSsh);
  writeTool(place.fakes, 'rsync', '#!/bin/sh\necho "rsync $*" >> "$STUB_LOG"\nexit 0\n');
  writeTool(place.fakes, 'sudo', '#!/bin/sh\necho "sudo $*" >> "$STUB_LOG"\nexit 0\n');
  fs.writeFileSync(place.log, '');
  fs.writeFileSync(path.join(place.home, '.teletraan/config'), 'current=main\nmini.main=who@teletraan.test\n');

  const toolFolder = options.tool || path.join(repo, 'tools/teletraan');
  place.run = words => {
    const env = {
      HOME: place.home, PATH: place.fakes + ':/usr/bin:/bin:/usr/sbin:/sbin', TERM: 'dumb',
      STUB_LOG: place.log, STUB_FAKES: place.fakes, COMPUTER_HOME: place.miniHome, COMPUTER_REPO: place.miniRepo,
    };
    const result = spawnSync('/bin/bash', [path.join(toolFolder, 'teletraan-tool')].concat(words), { env: env, encoding: 'utf8', input: '' });
    return { text: result.stdout, errors: result.stderr, status: result.status, calls: fs.readFileSync(place.log, 'utf8').split('\n').filter(Boolean) };
  };
  return place;
}

test('the Mac tool update hands the installer the commit of this repository, after the copy', () => {
  const place = toolPlace('tool');
  const result = place.run(['update', '--yes']);
  assert.equal(result.status, 0, result.errors);

  const copy = result.calls.findIndex(line => line.startsWith('rsync '));
  const install = result.calls.findIndex(line => line.includes('install.sh'));
  assert.ok(copy !== -1 && install > copy, result.calls.join(' / '));
  const git = args => spawnSync('git', ['-C', repo].concat(args), { encoding: 'utf8' }).stdout.trim();
  assert.ok(result.calls[install].includes('--commit ' + git(['rev-parse', '--short', 'HEAD'])), result.calls[install]);
});

test('the Mac tool says so and goes on when the folder has no git history, and the installer still runs', () => {
  const bare = path.join(work, 'bare-repo');
  fs.mkdirSync(path.join(bare, 'tools/teletraan'), { recursive: true });
  fs.mkdirSync(path.join(bare, 'dashboard'), { recursive: true });
  fs.mkdirSync(path.join(bare, 'computer'), { recursive: true });
  fs.mkdirSync(path.join(bare, 'control'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'tools/teletraan/teletraan-tool'), path.join(bare, 'tools/teletraan/teletraan-tool'));
  copyParts(path.join(repo, 'tools/teletraan/teletraan-tool'), path.join(bare, 'tools/teletraan'));
  fs.writeFileSync(path.join(bare, 'dashboard/index.html'), '');
  fs.writeFileSync(path.join(bare, 'computer/install.sh'), '');
  fs.writeFileSync(path.join(bare, 'control/server.js'), '');

  const place = toolPlace('tool-bare', { tool: path.join(bare, 'tools/teletraan') });
  const result = place.run(['update', '--yes']);
  assert.equal(result.status, 0, result.errors);
  assert.ok(result.text.includes('no git history'), result.text);
  const install = result.calls.find(line => line.includes('install.sh'));
  assert.ok(install && !install.includes('--commit'), 'the release has no hash: ' + install);
});

test('the status document and the Studio block carry the three fields and the line On the wall', () => {
  const schema = read('studio/schemas/status.js');
  ['buildCommit', 'buildDate', 'buildBranch'].forEach(name => assert.ok(schema.includes("'" + name + "'"), 'status.js has ' + name));
  assert.ok(/On the wall: /.test(read('studio/inputs/status-input.js')), 'the block says On the wall');
});

test('the corner stamp is the first seven characters of version.txt, 20px, and is drawn only with ?debug=1', async () => {
  const stamp = await import(path.join(repo, 'dashboard/core/build-stamp.js').replace(/^/, 'file://'));
  assert.equal(stamp.stampText('0123456789abcdef0123456789abcdef01234567\n'), '0123456');
  ['', 'not a hash', null, undefined, '<b>'].forEach(value => assert.equal(stamp.stampText(value), ''));

  const made = [];
  const box = { querySelector: () => made[0] || null, appendChild: child => made.push(child) };
  globalThis.document = { createElement: () => ({ className: '', textContent: '', remove() { made.length = 0; } }) };
  try {
    stamp.showStamp('0123456789abcdef', new URLSearchParams(''), box);
    assert.equal(made.length, 0, 'nothing without debug');
    stamp.showStamp('0123456789abcdef', new URLSearchParams('debug=1'), box);
    assert.equal(made.length, 1);
    assert.equal(made[0].textContent, '0123456');
  } finally {
    delete globalThis.document;
  }

  assert.ok(/--size-stamp: 20px;/.test(read('dashboard/tokens.css')));
  assert.ok(/\.build-stamp \{[^}]*font-size: var\(--size-stamp\);/.test(read('dashboard/base.css')));
});

let failures = 0;
try {
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
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
