// Tests for tools/mac/ship.sh, the window that checks the code, commits, pushes,
// deploys the Studio and updates the Mini. git, node, npm, ssh, scp, rsync, sudo
// and systemctl are small fake ones in a temporary folder, and the PATH holds
// nothing else that could reach a real one, so no test can touch GitHub, Sanity
// or a Mini. The repository is a temporary copy, and the keys are made up.
//
//   node tests/ship.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { copyParts } from './helpers/script-parts.mjs';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const shipSource = path.join(repoRoot, 'tools/mac/ship.sh');
const commandSource = path.join(repoRoot, 'tools/mac/Ship Teletraan.command');
const makeAppSource = path.join(repoRoot, 'tools/mac/make-app.sh');
const toolSource = path.join(repoRoot, 'tools/mini/teletraan-mini');
const cliSource = path.join(repoRoot, 'studio/sanity.cli.js');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-ship-'));

const miniAddress = 'hawktimus@teletraan.test';
const appId = 'aaojtrzg572ce88nb5jgpbmp';

// Made-up secrets. None may appear in anything the script prints or runs.
const secrets = {
  sanity: 'skFAKEshiptoken0123456789abcdef',
  calendar: 'https://api.band.us/ical?token=FAKESHIPLINK0123456789',
};
const hiddenParts = Object.values(secrets).flatMap(value => [value, value.slice(4)]);

// The few programs the scripts use besides the fakes. They are linked into one
// folder so the PATH of a run holds these and the fakes, and nothing else.
const utilityNames = ['awk', 'basename', 'cat', 'chmod', 'cp', 'cut', 'date', 'dirname', 'env', 'grep', 'head', 'ls', 'mkdir', 'mv', 'rm', 'sed', 'sort', 'stty', 'tail', 'tr', 'uniq', 'wc'];
const utilities = path.join(work, 'utilities');
fs.mkdirSync(utilities);
utilityNames.forEach(name => {
  const found = ['/usr/bin/' + name, '/bin/' + name].find(file => fs.existsSync(file));
  assert.ok(found, 'this test needs the program ' + name);
  fs.symlinkSync(found, path.join(utilities, name));
});

// Each fake writes the call it gets to calls.log. A file in the stub folder
// sets what it answers or makes it fail.
const fakes = {
  git: `#!/bin/sh
echo "git $*" >> "$STUB_LOG"
if [ "$1" = -C ]; then shift 2; fi
case "$1" in
  branch) cat "$STUB_DIR/branch.txt" 2> /dev/null || echo main ;;
  status) cat "$STUB_DIR/changes.txt" 2> /dev/null ;;
  diff) cat "$STUB_DIR/diff-names.txt" 2> /dev/null ;;
  ls-files) cat "$STUB_DIR/untracked.txt" 2> /dev/null ;;
  rev-list)
    case "$*" in
      *HEAD..@*) cat "$STUB_DIR/behind.txt" 2> /dev/null || echo 0 ;;
      *) cat "$STUB_DIR/waiting.txt" 2> /dev/null || echo 0 ;;
    esac
    ;;
  config)
    case "$2" in
      user.name) cat "$STUB_DIR/user-name.txt" 2> /dev/null || echo Test Person ;;
      user.email) cat "$STUB_DIR/user-email.txt" 2> /dev/null || echo test@example.test ;;
    esac
    ;;
  add|commit|push|fetch) [ -f "$STUB_DIR/git-$1.exit" ] && exit "$(cat "$STUB_DIR/git-$1.exit")" ;;
esac
exit 0
`,
  node: `#!/bin/sh
echo "node $*" >> "$STUB_LOG"
if [ "$1" = --version ]; then
  cat "$STUB_DIR/node-version.txt" 2> /dev/null || echo v22.12.0
  exit 0
fi
name=$(basename "$1")
[ -f "$STUB_DIR/node-$name.exit" ] && exit "$(cat "$STUB_DIR/node-$name.exit")"
exit 0
`,
  // The real deploy asks for a hostname unless sanity.cli.js names the Studio
  npm: `#!/bin/sh
echo "npm $* (in $(basename "$PWD"))" >> "$STUB_LOG"
if [ "$1 $2" = 'run deploy' ]; then
  if ! grep -q "appId: '${appId}'" sanity.cli.js; then
    echo '? Select existing studio hostname, or create a new one'
    exit 1
  fi
  [ -f "$STUB_DIR/npm.exit" ] && exit "$(cat "$STUB_DIR/npm.exit")"
  echo 'Success! Studio deployed.'
fi
exit 0
`,
  ssh: `#!/bin/sh
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
[ -f "$STUB_DIR/ssh.exit" ] && exit "$(cat "$STUB_DIR/ssh.exit")"
case $command in
  true) exit 0 ;;
  'systemctl is-active teletraan-pull.timer')
    cat "$STUB_DIR/pull-timer.txt" 2> /dev/null || echo inactive
    exit 3
    ;;
  *status-write.sh*) cat "$STUB_DIR/status-output.txt"; exit 0 ;;
  *check-calendars.sh*) cat "$STUB_DIR/check-output.txt"; exit 0 ;;
  *) PATH="$STUB_FAKES:$PATH" /bin/sh -c "$command" ;;
esac
`,
  scp: `#!/bin/sh
echo "scp $*" >> "$STUB_LOG"
exit 0
`,
  rsync: `#!/bin/sh
echo "rsync $*" >> "$STUB_LOG"
[ -f "$STUB_DIR/rsync.exit" ] && exit "$(cat "$STUB_DIR/rsync.exit")"
exit 0
`,
  sudo: `#!/bin/sh
echo "sudo $*" >> "$STUB_LOG"
# The installer on the Mini is not run here
case "$*" in *install.sh*) [ -f "$STUB_DIR/install.exit" ] && exit "$(cat "$STUB_DIR/install.exit")"; exit 0 ;; esac
exec "$@"
`,
  systemctl: `#!/bin/sh
echo "systemctl $*" >> "$STUB_LOG"
[ -f "$STUB_DIR/systemctl.exit" ] && exit "$(cat "$STUB_DIR/systemctl.exit")"
exit 0
`,
};

function writeExecutable(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, { mode: 0o755 });
}

// A repository, a home, the fake programs and the stub folder for one run.
// options.without lists fake programs to leave out, options.noMini leaves the
// saved Mini out, options.noModules leaves studio/node_modules out, and
// options.cli replaces studio/sanity.cli.js.
function makePlace(name, options = {}) {
  const root = path.join(work, name);
  const place = {
    root: root,
    repo: path.join(root, 'repo'),
    home: path.join(root, 'home'),
    stub: path.join(root, 'stub'),
    bin: path.join(root, 'bin'),
    log: path.join(root, 'calls.log'),
    stubFile: (file, text) => fs.writeFileSync(path.join(place.stub, file), text),
    calls: () => fs.readFileSync(place.log, 'utf8'),
    run(args, run = {}) {
      const env = {
        HOME: place.home,
        PATH: place.bin + ':' + utilities,
        TERM: 'dumb',
        STUB_LOG: place.log,
        STUB_DIR: place.stub,
        STUB_FAKES: place.bin,
        MINI_REPO: '/opt/teletraan-test',
      };
      if (run.message) env.SHIP_MESSAGE = run.message;
      const input = run.input && run.input.length ? run.input.join('\n') + '\n' : '';
      const result = spawnSync('/bin/bash', [path.join(place.repo, 'tools/mac/ship.sh')].concat(args), { env: env, input: input, encoding: 'utf8' });
      return { text: result.stdout, errors: result.stderr, status: result.status, calls: place.calls() };
    },
  };

  [place.home, place.stub, place.bin].forEach(folder => fs.mkdirSync(folder, { recursive: true }));
  Object.keys(fakes).filter(program => !(options.without || []).includes(program)).forEach(program => writeExecutable(path.join(place.bin, program), fakes[program]));
  fs.writeFileSync(place.log, '');

  writeExecutable(path.join(place.repo, 'tools/mac/ship.sh'), fs.readFileSync(shipSource, 'utf8'));
  writeExecutable(path.join(place.repo, 'tools/mini/teletraan-mini'), fs.readFileSync(toolSource, 'utf8'));
  copyParts(toolSource, path.join(place.repo, 'tools/mini'));
  fs.mkdirSync(path.join(place.repo, 'mini/scripts'), { recursive: true });
  fs.mkdirSync(path.join(place.repo, 'dashboard'), { recursive: true });
  fs.writeFileSync(path.join(place.repo, 'dashboard/index.html'), '');
  fs.writeFileSync(path.join(place.repo, 'mini/scripts/pull.sh'), '');
  fs.writeFileSync(path.join(place.repo, 'mini/install.sh'), '');
  fs.mkdirSync(path.join(place.repo, 'control'), { recursive: true });
  fs.writeFileSync(path.join(place.repo, 'control/server.js'), '');
  ['tests/run.mjs'].forEach(file => {
    fs.mkdirSync(path.dirname(path.join(place.repo, file)), { recursive: true });
    fs.writeFileSync(path.join(place.repo, file), '');
  });
  fs.mkdirSync(path.join(place.repo, 'studio'), { recursive: true });
  fs.writeFileSync(path.join(place.repo, 'studio/sanity.cli.js'), options.cli || fs.readFileSync(cliSource, 'utf8'));
  if (!options.noModules) fs.mkdirSync(path.join(place.repo, 'studio/node_modules'));
  fs.writeFileSync(path.join(place.repo, 'mini/local.env'), "SANITY_WRITE_TOKEN='" + secrets.sanity + "'\nCALENDAR_TEAM_URL='" + secrets.calendar + "'\n", { mode: 0o600 });

  const stateFolder = path.join(place.home, '.teletraan');
  fs.mkdirSync(stateFolder, { recursive: true, mode: 0o700 });
  if (!options.noMini) fs.writeFileSync(path.join(stateFolder, 'config'), 'current=main\nmini.main=' + miniAddress + '\n');
  fs.writeFileSync(path.join(stateFolder, 'secrets.env'), "SANITY_WRITE_TOKEN='" + secrets.sanity + "'\nCALENDAR_TEAM_URL='" + secrets.calendar + "'\n", { mode: 0o600 });

  place.stubFile('status-output.txt', 'Last calendar sync        3 minutes ago (2026-10-10 13:50 UTC)\n');
  place.stubFile('check-output.txt', 'SHOWN   team  Robotics meeting\n');
  return place;
}

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

function lines(text) {
  return text.split('\n').filter(line => line !== '');
}

// Calls that only look at things. Everything else changes or sends something.
const readOnly = /^(git (-C \S+ )?(branch|status|diff|ls-files|rev-list|config|fetch)\b|node --version)/;
function changes(calls) {
  return lines(calls).filter(line => !readOnly.test(line));
}

function indexOfCall(calls, start) {
  return lines(calls).findIndex(line => line.startsWith(start));
}

function hasCall(calls, start) {
  return indexOfCall(calls, start) !== -1;
}

function assertNoLeak(result, label) {
  const everything = result.text + '\n' + result.errors + '\n' + result.calls;
  hiddenParts.forEach(part => assert.ok(!everything.includes(part), label + ': the output or a command line holds ' + part.slice(0, 6) + '...'));
}

const changed = ' M dashboard/config.js\n?? docs/new-page.md\n';

test('all checks, commits, pushes, deploys the Studio, then updates the Mini and restarts the screen, in that order', () => {
  const place = makePlace('all');
  place.stubFile('changes.txt', changed);
  const result = place.run(['all'], { message: 'Change the agenda header' });
  assert.equal(result.status, 0, result.errors);

  const calls = lines(result.calls);
  const find = start => calls.findIndex(line => line.startsWith(start));
  const fetched = find('git -C ' + place.repo + ' fetch');
  const lastCheck = find('node ' + path.join(place.repo, 'tests/run.mjs'));
  const add = find('git add -A');
  const commit = find('git commit -q -m Change the agenda header');
  const push = find('git push');
  const deploy = find('npm run deploy (in studio)');
  const copy = find('rsync ');
  const restart = find('ssh -t -o ConnectTimeout=10 ' + miniAddress + ' sudo bash');
  [fetched, lastCheck, add, commit, push, deploy, copy, restart].forEach((index, position) => assert.ok(index !== -1, 'step ' + position + ' ran: ' + calls.join(' / ')));
  assert.ok(fetched < Math.min(find('node ' + path.join(place.repo, 'tests/run.mjs')), add), 'GitHub is looked at before anything else');
  assert.ok(lastCheck < add && add < commit && commit < push && push < deploy && deploy < copy && copy < restart, 'the order is check, commit, push, Studio, Mini: ' + calls.join(' / '));
  assert.equal(calls.filter(line => line.startsWith('node ' + path.join(place.repo, 'tests'))).length, 1, 'the tests ran once');

  assert.ok(result.text.includes('Done: checks, commit and push, Studio, Mini update and restart'), result.text);
  assert.ok(result.text.includes('The screen was restarted'), result.text);
  assert.ok(calls[copy].endsWith(' ' + place.repo + '/ ' + miniAddress + ':teletraan-staging/'), 'the Mac tool copies this repository: ' + calls[copy]);
  assert.ok(!result.calls.includes('pull.sh') && !result.calls.includes('ls-remote'), 'the Mini is no longer asked to pull');
  assert.ok(!result.text.includes('Go ahead?'), 'the Mini step asks no question');
  assertNoLeak(result, 'all');
});

test('the old word all-restart does the same as all', () => {
  const first = makePlace('all-word');
  first.stubFile('changes.txt', changed);
  const second = makePlace('all-restart-word');
  second.stubFile('changes.txt', changed);
  const a = first.run(['all'], { message: 'x' });
  const b = second.run(['all-restart'], { message: 'x' });
  assert.equal(b.status, 0, b.errors);
  const kinds = (calls, place) => lines(calls).map(line => line.split(place.root).join('PLACE').replace(/t\d{14}/g, 'TIME'));
  assert.deepEqual(kinds(b.calls, second), kinds(a.calls, first));
});

test('the commit has the description and nothing else on its line, and nothing is committed when nothing changed', () => {
  const place = makePlace('commit-line');
  place.stubFile('changes.txt', changed);
  const result = place.run(['push'], { input: ['Add the sponsor row'] });
  assert.equal(result.status, 0, result.errors);
  assert.ok(result.calls.includes('git commit -q -m Add the sponsor row\n'), result.calls);
  assert.ok(!new RegExp('Co-' + 'Authored|--trailer|--author').test(result.calls));

  const quiet = makePlace('commit-nothing');
  const quietResult = quiet.run(['push']);
  assert.equal(quietResult.status, 0, quietResult.errors);
  assert.ok(quietResult.text.includes('Nothing new to commit.') && quietResult.text.includes('GitHub already has everything.'), quietResult.text);
  assert.ok(!hasCall(quietResult.calls, 'git add') && !hasCall(quietResult.calls, 'git commit') && !hasCall(quietResult.calls, 'git push'));

  const waiting = makePlace('commit-waiting');
  waiting.stubFile('waiting.txt', '2\n');
  const waitingResult = waiting.run(['push']);
  assert.ok(hasCall(waitingResult.calls, 'git push') && !hasCall(waitingResult.calls, 'git commit'), 'earlier commits are pushed');
});

test('a changed local.env or key file stops the run before anything is committed, without printing a value', () => {
  const place = makePlace('secret-file');
  place.stubFile('changes.txt', ' M mini/local.env\n');
  place.stubFile('diff-names.txt', 'mini/local.env\n');
  const result = place.run(['all'], { message: 'Oops' });
  assert.notEqual(result.status, 0);
  assert.ok(result.text.includes('These look like secrets and will not be committed:') && result.text.includes('mini/local.env'), result.text);
  assert.ok(!hasCall(result.calls, 'git add') && !hasCall(result.calls, 'git commit') && !hasCall(result.calls, 'git push'));
  assert.ok(!hasCall(result.calls, 'npm') && !hasCall(result.calls, 'rsync'));
  assertNoLeak(result, 'secret file');

  const example = makePlace('example-env');
  example.stubFile('changes.txt', ' M mini/local.example.env\n');
  example.stubFile('diff-names.txt', 'mini/local.example.env\n');
  assert.equal(example.run(['push'], { message: 'Change the example' }).status, 0, 'the example file is allowed');
});

const stops = [
  {
    name: 'a check that fails and is not overruled',
    stub: { 'node-run.mjs.exit': '1' },
    input: [''],
    ran: [],
    absent: ['git add', 'git commit', 'git push', 'npm run', 'rsync', 'ssh -t'],
    summary: 'Nothing had been done before it stopped.',
  },
  {
    name: 'the commit',
    stub: { 'git-commit.exit': '1' },
    ran: ['git add -A'],
    absent: ['git push', 'npm run', 'rsync', 'ssh -t'],
    summary: 'Done before it stopped: checks',
    notSummary: 'commit and push',
  },
  {
    name: 'the push',
    stub: { 'git-push.exit': '1' },
    ran: ['git commit'],
    absent: ['npm run', 'rsync', 'ssh -t'],
    summary: 'Done before it stopped: checks',
    notSummary: 'commit and push',
    text: 'The push was refused.',
  },
  {
    name: 'the Studio deploy',
    stub: { 'npm.exit': '1' },
    ran: ['git push', 'npm run deploy'],
    absent: ['rsync', 'ssh -t'],
    summary: 'Done before it stopped: checks, commit and push',
    notSummary: 'Studio',
  },
  {
    name: 'the copy to the Mini',
    stub: { 'rsync.exit': '23' },
    ran: ['npm run deploy', 'rsync '],
    absent: ['ssh -t'],
    summary: 'Done before it stopped: checks, commit and push, Studio',
    notSummary: 'Mini update',
  },
  {
    name: 'the install on the Mini',
    stub: { 'install.exit': '5' },
    ran: ['rsync ', 'ssh -t'],
    absent: [],
    summary: 'Done before it stopped: checks, commit and push, Studio',
    notSummary: 'Mini update',
  },
];

stops.forEach(stop => {
  test('a failing step stops the rest and says what was done: ' + stop.name, () => {
    const place = makePlace('stop-' + stop.name.replace(/\W+/g, '-'));
    place.stubFile('changes.txt', changed);
    Object.keys(stop.stub).forEach(file => place.stubFile(file, stop.stub[file]));
    const result = place.run(['all'], { message: 'A change', input: stop.input });
    assert.notEqual(result.status, 0, 'the exit code is not zero');
    assert.ok(result.errors.includes('Stopped:'), result.errors);
    assert.ok(result.errors.includes(stop.summary), 'the summary: ' + result.errors);
    if (stop.notSummary) assert.ok(!result.errors.split('\n').filter(line => line.startsWith('Done before')).join('').includes(stop.notSummary), 'the failed step is not listed as done: ' + result.errors);
    stop.ran.forEach(start => assert.ok(hasCall(result.calls, start), 'ran ' + start + ': ' + result.calls));
    stop.absent.forEach(start => assert.ok(!hasCall(result.calls, start), 'did not run ' + start + ': ' + result.calls));
    if (stop.text) assert.ok(result.text.includes(stop.text), result.text);
    assert.ok(!result.text.includes('Finished'), 'a stopped run does not say it finished');
    assertNoLeak(result, stop.name);
  });
});

test('a check that fails can be overruled with a yes, and the run goes on', () => {
  const place = makePlace('check-overruled');
  place.stubFile('changes.txt', changed);
  place.stubFile('node-run.mjs.exit', '1');
  const result = place.run(['all'], { message: 'Go on', input: ['y'] });
  assert.equal(result.status, 0, result.errors);
  assert.ok(result.text.includes('FAILED  tests/run.mjs'), result.text);
  assert.ok(hasCall(result.calls, 'rsync '));
});

test('an unreachable Mini stops the run after the Studio, and nothing is copied', () => {
  const down = makePlace('mini-down');
  down.stubFile('changes.txt', changed);
  down.stubFile('ssh.exit', '255');
  const downResult = down.run(['all'], { message: 'A change' });
  assert.notEqual(downResult.status, 0);
  assert.ok(downResult.errors.includes('could not reach ' + miniAddress), downResult.errors);
  assert.ok(downResult.errors.includes('Done before it stopped: checks, commit and push, Studio'), downResult.errors);
  assert.ok(!hasCall(downResult.calls, 'rsync '));
});

test('a folder that is behind GitHub stops all and mini before anything is sent, and push does not mind', () => {
  ['all', 'mini'].forEach(action => {
    const place = makePlace('behind-' + action);
    place.stubFile('changes.txt', changed);
    place.stubFile('behind.txt', '2\n');
    const result = place.run([action], { message: 'A change' });
    assert.notEqual(result.status, 0, action);
    assert.ok(result.text.includes('GitHub has 2 newer commit(s) that this folder does not have'), result.text);
    assert.ok(result.text.includes('cd "' + place.repo + '" && git pull --no-rebase'), result.text);
    assert.ok(result.errors.includes('this folder is behind GitHub.') && result.errors.includes('Nothing had been done'), result.errors);
    assert.deepEqual(changes(result.calls), [], action + ' sent nothing: ' + result.calls);
  });

  const push = makePlace('behind-push');
  push.stubFile('behind.txt', '2\n');
  assert.equal(push.run(['push']).status, 0, 'a push is refused by GitHub itself if it needs to be');

  const offline = makePlace('behind-offline');
  offline.stubFile('git-fetch.exit', '128');
  offline.stubFile('behind.txt', '2\n');
  const offlineResult = offline.run(['mini']);
  assert.equal(offlineResult.status, 0, offlineResult.errors);
  assert.ok(offlineResult.text.includes('GitHub could not be reached, so this folder was not compared with it.'), offlineResult.text);

  const fine = makePlace('behind-none');
  const fineResult = fine.run(['mini']);
  assert.ok(fineResult.text.includes('up to date'), fineResult.text);
});

test('--dry-run runs nothing for any action: no commit, push, deploy, copy, restart or check, and no question', () => {
  ['all', 'all-restart', 'push', 'studio', 'mini', 'status', 'restart'].forEach(action => {
    const place = makePlace('dry-' + action);
    place.stubFile('changes.txt', changed);
    const result = place.run([action, '--dry-run']);
    assert.equal(result.status, 0, action + ': ' + result.errors);
    assert.deepEqual(changes(result.calls), [], action + ' changed or sent something: ' + result.calls);
    assert.ok(!/ fetch/.test(result.calls), action + ' did not even look at GitHub: ' + result.calls);
    assert.ok(result.text.includes('Dry run: nothing below is run.') && result.text.includes('[dry run]'), result.text);
    assert.ok(result.text.includes('Dry run: these steps would run:'), result.text);
    assert.ok(!result.text.includes('Done:'), 'a dry run does not say it did anything');
    assertNoLeak(result, 'dry run ' + action);
  });

  const branch = makePlace('dry-branch');
  branch.stubFile('branch.txt', 'work-in-progress\n');
  const branchResult = branch.run(['push', '--dry-run']);
  assert.equal(branchResult.status, 0, 'a dry run asks no question: ' + branchResult.errors);
  assert.ok(branchResult.text.includes("You are on the branch 'work-in-progress'"), branchResult.text);

  const first = makePlace('dry-order');
  first.stubFile('changes.txt', changed);
  const result = first.run(['--dry-run', 'all']);
  assert.equal(result.status, 0, result.errors);
  ['would run the tests with node', 'git add -A', 'git commit', 'git push', 'npm run deploy', 'teletraan-mini update --yes'].forEach(text => assert.ok(result.text.includes(text), 'shows ' + text + ': ' + result.text));
});

test('push only checks, commits and pushes: no Studio, no Mini, no ssh', () => {
  const place = makePlace('push-only');
  place.stubFile('changes.txt', changed);
  const result = place.run(['push'], { message: 'Only the code' });
  assert.equal(result.status, 0, result.errors);
  ['node ' + path.join(place.repo, 'tests/run.mjs'), 'git add -A', 'git commit', 'git push'].forEach(start => assert.ok(hasCall(result.calls, start), start));
  ['npm', 'ssh', 'scp', 'rsync'].forEach(start => assert.ok(!hasCall(result.calls, start), 'did not run ' + start));
  assert.ok(result.text.includes('Done: checks, commit and push'), result.text);
  assert.ok(!result.text.includes('The screen was restarted'));
});

test('studio only deploys the Studio: no git, no checks, no Mini', () => {
  const place = makePlace('studio-only');
  const result = place.run(['studio']);
  assert.equal(result.status, 0, result.errors);
  assert.ok(result.calls.includes('npm run deploy (in studio)\n'), result.calls);
  assert.ok(!hasCall(result.calls, 'git add') && !hasCall(result.calls, 'git push') && !hasCall(result.calls, 'ssh') && !hasCall(result.calls, 'rsync'));
  assert.ok(!lines(result.calls).some(line => line.startsWith('node ') && !line.startsWith('node --version')), 'no check ran');
});

test('a tree that still has deploy/ is refused for every word, before anything is committed or sent', () => {
  ['all', 'push', 'studio', 'mini', 'status', 'restart'].forEach(action => {
    const place = makePlace('old-tree-' + action);
    fs.mkdirSync(path.join(place.repo, 'deploy/scripts'), { recursive: true });
    const result = place.run([action]);
    assert.notEqual(result.status, 0, action);
    assert.ok(result.errors.includes('This copy is older than round 6; update it.'), action + ': ' + result.errors);
    assert.deepEqual(changes(result.calls), [], action + ' changed nothing');
  });
});

test('mini only runs the Mac tool to update the Mini and restart the screen, and nothing else', () => {
  const place = makePlace('mini-only');
  const result = place.run(['mini']);
  assert.equal(result.status, 0, result.errors);
  assert.ok(hasCall(result.calls, 'rsync ') && hasCall(result.calls, 'ssh -t -o ConnectTimeout=10 ' + miniAddress + ' sudo bash'), result.calls);
  assert.ok(!hasCall(result.calls, 'git add') && !hasCall(result.calls, 'git push') && !hasCall(result.calls, 'npm'));
  assert.ok(result.text.includes('Done: Mini update and restart'), result.text);
});

test('status asks the Mac tool for the status of the Mini, hides any key in it, and changes nothing', () => {
  const place = makePlace('status');
  place.stubFile('status-output.txt', 'Last calendar sync        3 minutes ago\na script that went wrong printed ' + secrets.sanity + '\n');
  place.stubFile('check-output.txt', 'FAIL    team  failed from ' + secrets.calendar + ' today\n');
  const result = place.run(['status']);
  assert.equal(result.status, 0, result.errors);
  assert.ok(result.text.includes('Last calendar sync        3 minutes ago') && result.text.includes('printed (hidden)'), result.text);
  assert.ok(hasCall(result.calls, 'ssh -n') && !hasCall(result.calls, 'rsync') && !hasCall(result.calls, 'git add'));
  assert.ok(result.text.includes('Done: Mini status'), result.text);
  assertNoLeak(result, 'status');

  const down = makePlace('status-down');
  down.stubFile('ssh.exit', '255');
  assert.notEqual(down.run(['status']).status, 0);
});

test('the old word restart still restarts the screen and copies nothing', () => {
  const place = makePlace('restart-word');
  const result = place.run(['restart']);
  assert.equal(result.status, 0, result.errors);
  assert.ok(result.calls.includes('sudo systemctl restart teletraan-kiosk.service'), result.calls);
  assert.ok(!hasCall(result.calls, 'rsync') && !hasCall(result.calls, 'git'), result.calls);
  const failing = makePlace('restart-word-fails');
  failing.stubFile('systemctl.exit', '1');
  assert.notEqual(failing.run(['restart']).status, 0);
});

test('Studio questions: the hostname is never asked, because sanity.cli.js names the hosted Studio', () => {
  const place = makePlace('no-hostname');
  const result = place.run(['all'], { message: 'A change' });
  assert.equal(result.status, 0, result.errors);
  assert.ok(!result.text.includes('Select existing studio hostname') && !result.text.includes('create a new one'), result.text);
  assert.ok(result.calls.includes('npm run deploy (in studio)\n'), 'npm run deploy gets no flag that could change the target: ' + result.calls);

  const config = fs.readFileSync(cliSource, 'utf8');
  assert.ok(/deployment: \{\s*appId: '[a-z0-9]{24}',?\s*\},/.test(config), 'sanity.cli.js has deployment.appId');
  assert.ok(config.includes("appId: '" + appId + "'"), 'the id of the teletraan Studio');
  assert.ok(config.includes('api: {') && config.includes('projectId: projectId') && config.includes('dataset: dataset'), 'the project is still named');
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'studio/package.json'), 'utf8'));
  assert.equal(manifest.scripts.deploy, 'sanity deploy');

  const without = makePlace('no-app-id', { cli: config.replace(/\s*deployment: \{[^}]*\},/, '') });
  const asked = without.run(['studio']);
  assert.notEqual(asked.status, 0);
  assert.ok(asked.text.includes('has no appId, so Sanity will ask which hostname to use'), asked.text);
});

test('every program the action needs is looked for first, a missing one is named with the way to get it, and nothing has run', () => {
  const advice = { git: 'Install it first', node: 'Install Node first', npm: 'It comes with Node', ssh: 'It comes with macOS', rsync: 'It comes with macOS' };
  Object.keys(advice).forEach(program => {
    const place = makePlace('missing-' + program, { without: [program] });
    place.stubFile('changes.txt', changed);
    const result = place.run(['all'], { message: 'A change' });
    assert.notEqual(result.status, 0, program);
    assert.ok(result.text.includes(program + ' is not installed. ' + advice[program]), program + ': ' + result.text);
    assert.deepEqual(changes(result.calls), [], program + ': nothing ran before the check: ' + result.calls);
    assert.ok(result.errors.includes('Nothing was changed.'), result.errors);
  });

  const several = makePlace('missing-two', { without: ['ssh', 'rsync'] });
  const severalResult = several.run(['all'], { message: 'A change' });
  assert.ok(severalResult.text.includes('ssh is not installed.') && severalResult.text.includes('rsync is not installed.'), 'all the gaps are listed together: ' + severalResult.text);
  assert.deepEqual(changes(severalResult.calls), []);

  // an action only asks for what it uses
  assert.equal(makePlace('push-no-npm', { without: ['npm', 'ssh', 'rsync'] }).run(['push'], { message: 'x' }).status, 0, 'push needs git and node');
  assert.equal(makePlace('studio-no-git', { without: ['git', 'ssh', 'rsync'] }).run(['studio']).status, 0, 'studio needs node and npm');
  assert.equal(makePlace('status-no-git', { without: ['git', 'node', 'npm'] }).run(['status']).status, 0, 'status needs ssh and rsync');
});

test('without studio/node_modules the Studio actions stop first and give the one command that makes it', () => {
  ['all', 'studio'].forEach(action => {
    const place = makePlace('no-modules-' + action, { noModules: true });
    place.stubFile('changes.txt', changed);
    const result = place.run([action], { message: 'A change' });
    assert.notEqual(result.status, 0, action);
    assert.ok(result.text.includes("the Studio's packages are not installed"), result.text);
    assert.ok(result.text.includes('cd "' + path.join(place.repo, 'studio') + '" && npm ci'), result.text);
    assert.deepEqual(changes(result.calls), [], action + ' committed nothing before it found out: ' + result.calls);
  });
  assert.equal(makePlace('no-modules-push', { noModules: true }).run(['push'], { message: 'x' }).status, 0, 'push does not need the packages');
});

test('git must know a name and an email before anything is committed, and the lines say how to set them', () => {
  const place = makePlace('no-identity');
  place.stubFile('changes.txt', changed);
  place.stubFile('user-name.txt', '');
  place.stubFile('user-email.txt', '');
  ['all', 'push'].forEach(action => {
    const result = place.run([action], { message: 'A change' });
    assert.notEqual(result.status, 0, action);
    assert.ok(result.text.includes('git config --global user.name "Your Name"') && result.text.includes('git config --global user.email "you@example.com"'), result.text);
    assert.deepEqual(changes(result.calls), [], action + ': ' + result.calls);
  });
  const onlyName = makePlace('no-email');
  onlyName.stubFile('user-email.txt', '');
  const onlyNameResult = onlyName.run(['push']);
  assert.ok(onlyNameResult.text.includes('user.email') && !onlyNameResult.text.includes('user.name'), onlyNameResult.text);
  assert.equal(place.run(['studio']).status, 0, 'the Studio does not need a git name');
});

test('the Mac tool must have a saved Mini before the Mini actions start, and the line says to run it once', () => {
  const place = makePlace('no-mini', { noMini: true });
  place.stubFile('changes.txt', changed);
  ['all', 'mini', 'status', 'restart'].forEach(action => {
    const result = place.run([action], { message: 'A change' });
    assert.notEqual(result.status, 0, action);
    assert.ok(result.text.includes('this Mac has no saved Mini yet. Run once, and give it the Mini\'s address: "' + path.join(place.repo, 'tools/mini/teletraan-mini') + '"'), result.text);
    assert.deepEqual(changes(result.calls), [], action + ' ran nothing: ' + result.calls);
  });
  assert.equal(place.run(['push'], { message: 'x' }).status, 0, 'push does not need a Mini');
  assert.equal(place.run(['studio']).status, 0, 'the Studio does not need a Mini');
});

test('the Studio actions need Node 22.12 or newer, and say which version this Mac has', () => {
  [['v20.11.0', false], ['v22.11.9', false], ['v22.12.0', true], ['v22.20.1', true], ['v24.0.0', true], ['v26.4.0', true]].forEach(([version, fine]) => {
    const place = makePlace('node-' + version);
    place.stubFile('node-version.txt', version + '\n');
    const result = place.run(['studio']);
    if (fine) {
      assert.equal(result.status, 0, version + ': ' + result.errors);
    } else {
      assert.notEqual(result.status, 0, version);
      assert.ok(result.text.includes('needs Node 22.12 or newer, and this Mac has ' + version), result.text);
      assert.ok(!hasCall(result.calls, 'npm'));
    }
  });
  const old = makePlace('node-old-push');
  old.stubFile('node-version.txt', 'v20.11.0\n');
  assert.equal(old.run(['push'], { message: 'x' }).status, 0, 'the checks of push run on an older Node');
});

test('a word the script does not know stops it before anything runs, without repeating the word', () => {
  const place = makePlace('unknown');
  const result = place.run(['frobnicate-' + secrets.sanity]);
  assert.notEqual(result.status, 0);
  assert.ok(result.errors.includes('I do not know that word. Use all, push, studio, mini or status.'), result.errors);
  assert.ok(!result.errors.includes('frobnicate') && !result.errors.includes(secrets.sanity));
  assert.equal(result.calls, '');
});

test('the menu has the five choices, each runs its action, and anything else does nothing', () => {
  const place = makePlace('menu');
  const quit = place.run([], { input: ['q'] });
  assert.equal(quit.status, 0, quit.errors);
  ['1  Ship everything: check the code, commit, push, deploy the Studio,', 'update the Mini and restart the screen', '2  Push only', '3  Studio only', '4  Update the Mini only, and restart the screen', '5  Status of the Mini', 'q  Quit'].forEach(entry => assert.ok(quit.text.includes(entry), 'the menu has: ' + entry));
  assert.ok(quit.text.includes('Nothing done.'));
  assert.equal(quit.calls, '', 'looking at the menu runs nothing');

  assert.equal(place.run([]).status, 0, 'the end of the input does nothing');
  assert.equal(place.run([], { input: ['9'] }).calls, '');

  const choices = { 1: ['rsync ', 'npm run deploy', 'git push'], 2: ['git push'], 3: ['npm run deploy'], 4: ['rsync '], 5: ['ssh -n'] };
  Object.keys(choices).forEach(choice => {
    const run = makePlace('menu-' + choice);
    run.stubFile('changes.txt', changed);
    const result = run.run([], { input: [choice, 'A change'] });
    assert.equal(result.status, 0, choice + ': ' + result.errors);
    choices[choice].forEach(start => assert.ok(hasCall(result.calls, start), choice + ' ran ' + start + ': ' + result.calls));
  });
  const four = makePlace('menu-4-only');
  const fourResult = four.run([], { input: ['4'] });
  assert.ok(!hasCall(fourResult.calls, 'git add') && !hasCall(fourResult.calls, 'npm'), 'choice 4 is the Mini only');
});

test('a branch other than main asks first, and the answer is no by default', () => {
  const place = makePlace('branch');
  place.stubFile('branch.txt', 'work-in-progress\n');
  place.stubFile('changes.txt', changed);
  const declined = place.run(['push'], { message: 'x', input: [''] });
  assert.notEqual(declined.status, 0);
  assert.ok(declined.errors.includes('switch to main first'), declined.errors);
  assert.ok(!hasCall(declined.calls, 'git push'));
  const agreed = place.run(['push'], { message: 'x', input: ['y'] });
  assert.equal(agreed.status, 0, agreed.errors);
});

test('the script keeps no password and never runs ssh, sudo, rsync or scp itself: the Mac tool does, in this window', () => {
  const code = fs.readFileSync(shipSource, 'utf8').split('\n').filter(line => !/^\s*#/.test(line)).join('\n');
  assert.ok(!/sshpass|read -r?s\b|security add|keychain|PASSWORD|password=/i.test(code), 'no password is read or kept');
  assert.ok(!/^\s*(ssh|scp|rsync|sudo)\b/m.test(code) && !/\|\|?\s*(ssh|sudo)\b/.test(code), 'no direct call to ssh, scp, rsync or sudo');
  assert.ok(!/MINI_ADDRESS|MINI_REPO|MINI_KIOSK|pull\.sh|ls-remote/.test(code), 'the Mini\'s address and the pull step are gone from this script');
  assert.ok(code.includes('"$mini_tool" update --yes') && code.includes('"$mini_tool" status') && code.includes('"$mini_tool" restart'), 'the Mini steps are the Mac tool');
  assert.ok(!/\bgit (push|commit|add)\b.*--force|push -f\b/.test(code), 'a push is never forced');
});

test('the three files of the app are executable and have valid syntax, and the .command file runs ship.sh from its own folder', () => {
  [shipSource, commandSource, makeAppSource].forEach(file => {
    assert.ok((fs.statSync(file).mode & 0o111) !== 0, path.basename(file) + ' is executable');
    assert.equal(spawnSync('/bin/bash', ['-n', file], { encoding: 'utf8' }).status, 0, path.basename(file) + ' has valid bash syntax');
    assert.ok(fs.readFileSync(file, 'utf8').startsWith('#!/bin/bash\n'));
  });
  assert.ok(/^set -u$/m.test(fs.readFileSync(shipSource, 'utf8')));
  const command = fs.readFileSync(commandSource, 'utf8');
  assert.ok(command.includes('cd "$(dirname "$0")"') && command.includes('./ship.sh "$@"'), 'the .command file runs ship.sh');
  assert.ok(command.includes('Press any key to close this window.'), 'the window waits at the end');
});

const macOnly = process.platform === 'darwin' && fs.existsSync('/usr/bin/osacompile') && fs.existsSync('/usr/bin/osadecompile');
const testOnMac = macOnly ? test : name => console.log('skip  ' + name + ' (needs macOS)');
testOnMac('make-app.sh writes an app that holds only the path of the .command file, so a change to ship.sh reaches it without making it again', () => {
  const destination = path.join(work, 'apps');
  fs.mkdirSync(destination);
  const made = spawnSync('/bin/bash', [makeAppSource, destination], { encoding: 'utf8' });
  assert.equal(made.status, 0, made.stderr);
  assert.ok(made.stdout.includes('Made: ' + path.join(destination, 'Ship Teletraan.app')), made.stdout);
  const script = spawnSync('/usr/bin/osadecompile', [path.join(destination, 'Ship Teletraan.app/Contents/Resources/Scripts/main.scpt')], { encoding: 'utf8' });
  assert.equal(script.status, 0, script.stderr);
  assert.ok(script.stdout.includes('open -a Terminal') && script.stdout.includes(commandSource), 'the app opens the .command file: ' + script.stdout);
  assert.ok(!script.stdout.includes('preflight') && !script.stdout.includes('commit'), 'the app holds no copy of ship.sh');
  assert.ok(!spawnSync('/bin/bash', [makeAppSource, path.join(work, 'nowhere')], { encoding: 'utf8' }).stdout.includes('Made:'), 'a folder that does not exist is refused');
});

test('the files are written in the team\'s plain style, and mention no tool', () => {
  const dashes = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
  const emoji = new RegExp('[' + String.fromCharCode(0x2600) + '-' + String.fromCharCode(0x27bf) + ']|[\\uD83C-\\uD83E][\\uDC00-\\uDFFF]');
  const filler = /\b(simply|just|basically|really|very|actually|easily|seamless|robust|leverage|ensure|comprehensive)\b/i;
  // the words are joined from pieces so that this file does not hold them
  const traces = new RegExp('\\b(' + ['cla' + 'ude', 'anthr' + 'opic', 'ope' + 'nai', 'chat' + 'gpt', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'assis' + 'tant'].join('|') + ')\\b|\\bA' + 'I\\b', 'i');
  [shipSource, commandSource, makeAppSource, cliSource, new URL(import.meta.url).pathname].forEach(file => {
    const text = fs.readFileSync(file, 'utf8');
    const name = path.basename(file);
    assert.ok(!dashes.test(text), name + ' has an em or en dash');
    assert.ok(!emoji.test(text), name + ' has an emoji');
    assert.ok(!traces.test(text), name + ' mentions a tool');
    // this file names the filler words it looks for
    if (file.endsWith('ship.test.mjs')) return;
    assert.ok(!filler.test(text), name + ' has a filler word');
  });
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
