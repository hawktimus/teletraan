// Tests for the words of tools/mini/teletraan-mini: update, status and restart,
// with --yes and --mini NAME, the way tools/mac/ship.sh runs them. ssh, scp,
// rsync, sudo and systemctl are small fake ones in a temporary folder, so nothing
// touches the network or a real Mini. The keys and links in the test are made up.
// The menu itself is tested in tests/teletraan-mini.test.mjs.
//
//   node tests/teletraan-mini-commands.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const toolFile = path.join(repo, 'tools/mini/teletraan-mini');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-mini-words-'));

const miniAddress = 'hawktimus@teletraan.test';
const spareAddress = 'hawktimus@teletraan-2.test';
const systemPath = '/usr/bin:/bin:/usr/sbin:/sbin';

// The tool may show the first 4 characters of a secret and nothing more, in its
// output and in any command line
const secrets = {
  sanity: 'skFAKEtoken0123456789abcdef',
  group: 'https://api.band.us/ical?token=FAKEGROUPLINK0123456789',
  stray: 'strayFAKEkey-9876543210-typed-by-mistake',
};
const hiddenParts = Object.values(secrets).flatMap(value => [value, value.slice(4)]);

// Each fake writes the call it gets to calls.log
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
[ -f "$STUB_DIR/ssh.exit" ] && exit "$(cat "$STUB_DIR/ssh.exit")"
case $command in
  true) exit 0 ;;
  'systemctl is-active teletraan-pull.timer')
    cat "$STUB_DIR/pull-timer.txt" 2> /dev/null || echo inactive
    exit 3
    ;;
  *status-write.sh*)
    cat "$STUB_DIR/status-output.txt"
    [ -f "$STUB_DIR/status.exit" ] && exit "$(cat "$STUB_DIR/status.exit")"
    exit 0
    ;;
  *check-calendars.sh*) cat "$STUB_DIR/check-output.txt"; exit 0 ;;
  *) cd "$MINI_HOME" && PATH="$STUB_FAKES:$PATH" HOME="$MINI_HOME" sh -c "$command" ;;
esac
`;

const fakeRsync = `#!/bin/sh
echo "rsync $*" >> "$STUB_LOG"
[ -f "$STUB_DIR/rsync.exit" ] && exit "$(cat "$STUB_DIR/rsync.exit")"
exit 0
`;

const fakeScp = `#!/bin/sh
echo "scp $*" >> "$STUB_LOG"
exit 0
`;

const fakeSudo = `#!/bin/sh
echo "sudo $*" >> "$STUB_LOG"
exec "$@"
`;

const fakeSystemctl = `#!/bin/sh
echo "systemctl $*" >> "$STUB_LOG"
[ -f "$STUB_DIR/systemctl.exit" ] && exit "$(cat "$STUB_DIR/systemctl.exit")"
exit 0
`;

function writeTool(folder, name, text) {
  fs.writeFileSync(path.join(folder, name), text, { mode: 0o755 });
}

// The Mac's home, the fake tools and the folder that stands for the Mini
function makePlace(name, options = {}) {
  const root = path.join(work, name);
  const place = {
    root: root,
    home: path.join(root, 'home'),
    stub: path.join(root, 'stub'),
    fakes: path.join(root, 'fakes'),
    miniHome: path.join(root, 'mini-home'),
    log: path.join(root, 'calls.log'),
    configFile: () => path.join(place.home, '.teletraan/config'),
    calls: () => fs.readFileSync(place.log, 'utf8'),
    stubFile: (file, text) => fs.writeFileSync(path.join(place.stub, file), text),
    // words are the arguments after the tool's name; input is what is typed
    run(words, input = [], tool = toolFile) {
      const env = {
        HOME: place.home,
        PATH: place.fakes + ':' + systemPath,
        TERM: 'dumb',
        STUB_LOG: place.log,
        STUB_DIR: place.stub,
        STUB_FAKES: place.fakes,
        MINI_HOME: place.miniHome,
        MINI_REPO: '/opt/teletraan-test',
      };
      const text = input.length ? input.join('\n') + '\n' : '';
      const result = spawnSync('/bin/bash', [tool].concat(words), { env: env, input: text, encoding: 'utf8' });
      return { text: result.stdout, errors: result.stderr, status: result.status, calls: place.calls() };
    },
  };

  [place.home, place.stub, place.fakes, place.miniHome].forEach(folder => fs.mkdirSync(folder, { recursive: true }));
  writeTool(place.fakes, 'ssh', fakeSsh);
  writeTool(place.fakes, 'scp', fakeScp);
  writeTool(place.fakes, 'rsync', fakeRsync);
  writeTool(place.fakes, 'sudo', fakeSudo);
  writeTool(place.fakes, 'systemctl', fakeSystemctl);
  place.stubFile('status-output.txt', 'Last calendar sync        3 minutes ago (2026-10-10 13:50 UTC)\n');
  place.stubFile('check-output.txt', 'SHOWN   team  Robotics meeting\n');
  fs.writeFileSync(place.log, '');

  const stateFolder = path.join(place.home, '.teletraan');
  if (!options.noConfig) {
    fs.mkdirSync(stateFolder, { recursive: true, mode: 0o700 });
    fs.writeFileSync(place.configFile(), options.config || 'current=main\nmini.main=' + miniAddress + '\n');
  }
  // Saved values on the Mac, so the filter has something to hide
  fs.mkdirSync(stateFolder, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(stateFolder, 'secrets.env'), "SANITY_WRITE_TOKEN='" + secrets.sanity + "'\nCALENDAR_GROUP_URL='" + secrets.group + "'\n", { mode: 0o600 });
  return place;
}

const twoMinis = 'current=main\nmini.main=' + miniAddress + '\nmini.spare=' + spareAddress + '\n';

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

function lines(text) {
  return text.split('\n').filter(line => line !== '');
}

function assertNoLeak(result, label) {
  const everything = result.text + '\n' + result.errors + '\n' + result.calls;
  hiddenParts.forEach(part => assert.ok(!everything.includes(part), label + ': the output or a command line holds ' + part.slice(0, 6) + '...'));
}

// The index of the first call that starts with this text, or -1
function indexOfCall(calls, start) {
  return lines(calls).findIndex(line => line.startsWith(start));
}

test('update --yes looks at the pull timer, copies the files, then restarts the screen, in that order, and asks nothing', () => {
  const place = makePlace('update-yes');
  const result = place.run(['update', '--yes']);
  assert.equal(result.status, 0, result.errors);

  const calls = lines(result.calls);
  const timer = calls.findIndex(line => line.includes('systemctl is-active teletraan-pull.timer'));
  const copy = calls.findIndex(line => line.startsWith('rsync '));
  const restart = calls.findIndex(line => line.includes('sudo systemctl restart teletraan-kiosk.service'));
  assert.ok(timer !== -1 && copy > timer && restart > copy, calls.join(' / '));
  assert.ok(calls[copy].includes(' -a --delete '), calls[copy]);
  ['.git', 'local.env', '.env', 'node_modules'].forEach(name => assert.ok(calls[copy].includes('--exclude ' + name + ' '), 'excludes ' + name));
  assert.ok(calls[copy].endsWith(' ' + repo.replace(/\/$/, '') + '/ ' + miniAddress + ':/opt/teletraan-test/'), calls[copy]);
  assert.ok(calls[restart].startsWith('ssh -t -o ConnectTimeout=10 ' + miniAddress), 'the restart gets a terminal for the password: ' + calls[restart]);
  assert.ok(calls.some(line => line === 'systemctl restart teletraan-kiosk.service'), 'the restart reached systemctl');

  assert.ok(!result.text.includes('Go ahead?'), 'no question');
  assert.ok(result.text.includes('Going ahead (--yes).'), result.text);
  assert.ok(result.text.includes('The files are copied.'));
  assert.ok(!result.text.includes('Choose:') && !result.text.includes('  q  Quit'), 'no menu');
  assertNoLeak(result, 'update --yes');
});

test('--yes can come before the word, and update copies the same files', () => {
  const place = makePlace('update-yes-first');
  const result = place.run(['--yes', 'update']);
  assert.equal(result.status, 0, result.errors);
  assert.ok(indexOfCall(result.calls, 'rsync ') !== -1);
});

test('update without --yes asks Go ahead, Return means yes, n means nothing was copied and the exit code is not zero', () => {
  const agreed = makePlace('update-ask-yes');
  const agreedResult = agreed.run(['update'], ['']);
  assert.equal(agreedResult.status, 0, agreedResult.errors);
  assert.ok(agreedResult.text.includes('Go ahead? [Y/n]'), agreedResult.text);
  assert.ok(indexOfCall(agreedResult.calls, 'rsync ') !== -1);

  const declined = makePlace('update-ask-no');
  const declinedResult = declined.run(['update'], ['n']);
  assert.equal(declinedResult.status, 1, 'a script must not think the Mini was updated');
  assert.ok(declinedResult.text.includes('Nothing was copied.'), declinedResult.text);
  assert.equal(indexOfCall(declinedResult.calls, 'rsync '), -1);
  assert.equal(indexOfCall(declinedResult.calls, 'ssh -t'), -1, 'the screen was not restarted');
});

test('update with nobody to answer counts as no: nothing is copied and the exit code is not zero', () => {
  const place = makePlace('update-no-input');
  const result = place.run(['update']);
  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('none came'), result.errors);
  assert.equal(indexOfCall(result.calls, 'rsync '), -1);
});

test('when the Mini also pulls by itself, --yes does not answer that question: it is asked, and no is the default', () => {
  const asked = makePlace('update-timer-yes');
  asked.stubFile('pull-timer.txt', 'active\n');
  const copied = asked.run(['update', '--yes'], ['y']);
  assert.equal(copied.status, 0, copied.errors);
  assert.ok(copied.text.includes('also pulls from GitHub by itself') && copied.text.includes('Copy anyway? [y/N]'), copied.text);
  assert.ok(indexOfCall(copied.calls, 'rsync ') !== -1, 'a yes copies');

  const returned = makePlace('update-timer-return');
  returned.stubFile('pull-timer.txt', 'active\n');
  const returnedResult = returned.run(['update', '--yes'], ['']);
  assert.equal(returnedResult.status, 1);
  assert.equal(indexOfCall(returnedResult.calls, 'rsync '), -1, 'Return means no');

  const silent = makePlace('update-timer-silent');
  silent.stubFile('pull-timer.txt', 'active\n');
  const silentResult = silent.run(['update', '--yes']);
  assert.equal(silentResult.status, 1, 'with nobody to answer it is no');
  assert.equal(indexOfCall(silentResult.calls, 'rsync '), -1);
});

test('a failing copy gives an exit code that is not zero, says to run it again and does not restart the screen', () => {
  const place = makePlace('update-rsync-fails');
  place.stubFile('rsync.exit', '23');
  const result = place.run(['update', '--yes']);
  assert.notEqual(result.status, 0);
  assert.ok(result.errors.includes('exit 23'), result.errors);
  assert.ok(result.text.includes('Run this again'), result.text);
  assert.equal(indexOfCall(result.calls, 'ssh -t'), -1, 'the screen was not restarted');
  assert.ok(!result.calls.includes('systemctl restart'));
  assertNoLeak(result, 'rsync fails');
});

test('a failing restart gives an exit code that is not zero, after the files were copied, and names the word that restarts again', () => {
  const place = makePlace('update-restart-fails');
  place.stubFile('systemctl.exit', '5');
  const result = place.run(['update', '--yes']);
  assert.notEqual(result.status, 0);
  assert.ok(result.text.includes('The files are copied.'));
  assert.ok(result.errors.includes('exit 5'), result.errors);
  assert.ok(result.text.includes('Run teletraan-mini restart to restart the screen again.'), result.text);
  assert.ok(!result.text.includes('Choose 6'), 'the hint names a word, not a menu choice');
});

test('update stops before it copies when the Mini cannot be reached, and when the folder is not the repository', () => {
  const down = makePlace('update-down');
  down.stubFile('ssh.exit', '255');
  const downResult = down.run(['update', '--yes']);
  assert.notEqual(downResult.status, 0);
  assert.ok(downResult.errors.includes('could not reach ' + miniAddress), downResult.errors);
  assert.equal(indexOfCall(downResult.calls, 'rsync '), -1);

  const place = makePlace('update-wrong-folder');
  const copy = path.join(place.root, 'elsewhere/tools/mini');
  fs.mkdirSync(copy, { recursive: true });
  fs.copyFileSync(toolFile, path.join(copy, 'teletraan-mini'));
  fs.chmodSync(path.join(copy, 'teletraan-mini'), 0o755);
  const result = place.run(['update', '--yes'], [], path.join(copy, 'teletraan-mini'));
  assert.notEqual(result.status, 0);
  assert.ok(result.errors.includes('does not look like the Teletraan repository'), result.errors);
  assert.equal(indexOfCall(result.calls, 'rsync '), -1, '--yes cannot copy from the wrong folder');
});

test('update refuses a tree that still has deploy/, copies nothing and says to update this copy', () => {
  const place = makePlace('update-old-tree');
  const tree = path.join(place.root, 'old');
  fs.mkdirSync(path.join(tree, 'tools/mini'), { recursive: true });
  fs.mkdirSync(path.join(tree, 'deploy/scripts'), { recursive: true });
  fs.mkdirSync(path.join(tree, 'dashboard'), { recursive: true });
  fs.writeFileSync(path.join(tree, 'dashboard/index.html'), '');
  fs.writeFileSync(path.join(tree, 'deploy/scripts/pull.sh'), '');
  fs.copyFileSync(toolFile, path.join(tree, 'tools/mini/teletraan-mini'));
  fs.chmodSync(path.join(tree, 'tools/mini/teletraan-mini'), 0o755);
  const result = place.run(['update', '--yes'], [], path.join(tree, 'tools/mini/teletraan-mini'));
  assert.notEqual(result.status, 0);
  assert.ok(result.errors.includes('This copy is older than round 6; update it.'), result.errors);
  assert.equal(indexOfCall(result.calls, 'rsync '), -1, 'nothing is copied from an old tree');
});

test('the hint after an update names the menu in words, because there is no menu choice to press', () => {
  const place = makePlace('update-hint');
  const result = place.run(['update', '--yes']);
  assert.ok(result.text.includes('run teletraan-mini with no word after it and choose 4 to install the services again.'), result.text);
});

test('status runs status-write.sh --print and check-calendars.sh, hides any key or address in what comes back, and exits 0', () => {
  const place = makePlace('status');
  place.stubFile('status-output.txt', 'Last calendar sync        3 minutes ago (2026-10-10 13:50 UTC)\na script that went wrong printed ' + secrets.sanity + '\n');
  place.stubFile('check-output.txt', 'FAIL    group  download failed from ' + secrets.group + ' today\n');
  const result = place.run(['status']);
  assert.equal(result.status, 0, result.errors);

  const calls = lines(result.calls);
  const print = calls.findIndex(line => line.includes('/opt/teletraan-test/mini/scripts/status-write.sh --print'));
  const check = calls.findIndex(line => line.includes('/opt/teletraan-test/mini/scripts/check-calendars.sh'));
  assert.ok(print !== -1 && check > print, calls.join(' / '));
  assert.ok(result.text.includes('Last calendar sync        3 minutes ago'));
  assert.ok(result.text.includes('printed (hidden)') && result.text.includes('failed from (hidden) today'), result.text);
  assert.ok(!result.calls.includes('rsync') && !result.calls.includes('restart'), 'status changes nothing on the Mini');
  assertNoLeak(result, 'status');
});

test('status gives an exit code that is not zero when the Mini cannot be reached, has an older status-write.sh or reports a problem', () => {
  const down = makePlace('status-down');
  down.stubFile('ssh.exit', '255');
  const downResult = down.run(['status']);
  assert.notEqual(downResult.status, 0);
  assert.ok(downResult.errors.includes('could not reach'), downResult.errors);

  const old = makePlace('status-old');
  old.stubFile('status-output.txt', 'Usage: status-write.sh content|calendar|slides|monday|frc|kiosk|calendar-status\n');
  old.stubFile('status.exit', '2');
  const oldResult = old.run(['status']);
  assert.notEqual(oldResult.status, 0);
  assert.ok(oldResult.text.includes('The Mini has an older status-write.sh. Run teletraan-mini update.'), oldResult.text);
  assert.ok(oldResult.text.includes('SHOWN   team'), 'the calendars are still shown');

  const broken = makePlace('status-broken');
  broken.stubFile('status-output.txt', 'status: could not read status-mini, no connection.\n');
  broken.stubFile('status.exit', '1');
  const brokenResult = broken.run(['status']);
  assert.notEqual(brokenResult.status, 0);
  assert.ok(brokenResult.text.includes('could not read status-mini'), 'what the script said is shown');
});

test('restart restarts the kiosk service with a terminal for the password, and nothing else', () => {
  const place = makePlace('restart');
  const result = place.run(['restart']);
  assert.equal(result.status, 0, result.errors);
  assert.ok(result.calls.includes('ssh -t -o ConnectTimeout=10 ' + miniAddress + ' sudo systemctl restart teletraan-kiosk.service'), result.calls);
  assert.ok(result.text.includes('The screen restarted.'));
  assert.ok(!result.calls.includes('rsync') && !result.calls.includes('is-active'), 'nothing was copied');
  assertNoLeak(result, 'restart');

  const failing = makePlace('restart-fails');
  failing.stubFile('systemctl.exit', '1');
  const failingResult = failing.run(['restart']);
  assert.notEqual(failingResult.status, 0);
  assert.ok(failingResult.errors.includes('exit 1'), failingResult.errors);

  const down = makePlace('restart-down');
  down.stubFile('ssh.exit', '255');
  assert.notEqual(down.run(['restart']).status, 0);
});

test('--mini NAME picks a saved Mini for one run and does not change the one in use', () => {
  const place = makePlace('mini-name', { config: twoMinis });
  const before = fs.readFileSync(place.configFile(), 'utf8');

  const spare = place.run(['--mini', 'spare', 'restart']);
  assert.equal(spare.status, 0, spare.errors);
  assert.ok(spare.calls.includes('ssh -t -o ConnectTimeout=10 ' + spareAddress + ' sudo systemctl restart'), spare.calls);

  const joined = place.run(['restart', '--mini=spare']);
  assert.ok(joined.calls.includes(spareAddress), joined.calls);

  const normal = place.run(['restart']);
  assert.ok(normal.calls.includes(miniAddress), 'the Mini in use is still main: ' + normal.calls);
  assert.equal(fs.readFileSync(place.configFile(), 'utf8'), before, 'the saved file was not rewritten');
});

test('a name that is not saved stops the run with the names that are, and calls nothing', () => {
  const place = makePlace('mini-unknown', { config: twoMinis });
  const result = place.run(['--mini', 'nobody', 'update', '--yes']);
  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('no saved Mini has that name. The saved names are: main, spare.'), result.errors);
  assert.ok(!result.errors.includes('nobody'), 'the name typed is not repeated');
  assert.equal(result.calls, '');
});

test('with no Mini saved, a word stops the run and says to run the tool once without a word, and saves and calls nothing', () => {
  const place = makePlace('no-mini', { noConfig: true });
  ['update', 'status', 'restart'].forEach(word => {
    const result = place.run([word, '--yes']);
    assert.equal(result.status, 1, word);
    assert.ok(result.errors.includes('no Mini is saved on this Mac yet') && result.errors.includes('with no word after it'), result.errors);
    assert.equal(result.calls, '', word + ' called nothing');
    assert.ok(!fs.existsSync(place.configFile()), word + ' saved nothing');
  });
});

test('a word the tool does not know prints the usage and exits 2, without repeating what was typed and without calling anything', () => {
  const place = makePlace('usage');
  [
    [secrets.stray],
    ['update', secrets.stray],
    ['--delete', 'update'],
    ['update', 'status'],
    ['--yes'],
    ['--mini'],
  ].forEach(words => {
    const result = place.run(words);
    assert.equal(result.status, 2, words.join(' '));
    assert.ok(result.errors.includes('Usage: teletraan-mini [--mini NAME] [--yes] [update | status | restart]'), result.errors);
    ['update     copy the files', 'status     show what', 'restart    restart the screen'].forEach(entry => assert.ok(result.errors.includes(entry), entry));
    assert.ok(!result.errors.includes(secrets.stray) && !result.text.includes(secrets.stray), 'the word typed is not repeated');
    assert.equal(result.calls, '', words.join(' ') + ' called nothing');
  });

  const help = place.run(['--help']);
  assert.equal(help.status, 0);
  assert.ok(help.text.includes('Usage: teletraan-mini'), help.text);
  assert.equal(help.calls, '');
});

test('with no word the menu still comes up, and --mini picks the Mini it uses', () => {
  const place = makePlace('menu', { config: twoMinis });
  const result = place.run([], ['q']);
  assert.equal(result.status, 0, result.errors);
  ['1  Update the Mini', '2  Keys and calendars', '3  Copy the Mini', '4  Install the services', '5  Status of the Mini', '6  Restart the screen', '7  Choose another Mini'].forEach(entry => assert.ok(result.text.includes(entry), entry));
  assert.ok(result.text.includes('Mini in use: main (' + miniAddress + ')'));

  const spare = place.run(['--mini', 'spare'], ['q']);
  assert.ok(spare.text.includes('Mini in use: spare (' + spareAddress + ')'), spare.text);
  assert.equal(spare.calls, '', 'looking at the menu runs nothing');
});

test('the menu keeps its own wording for the hints, and the end of the input still ends it quietly', () => {
  const place = makePlace('menu-wording');
  place.stubFile('status-output.txt', 'Usage: status-write.sh\n');
  place.stubFile('status.exit', '2');
  const result = place.run([], ['5', 'q']);
  assert.ok(result.text.includes('The Mini has an older status-write.sh. Choose 1 to update it.'), result.text);

  const ended = place.run([]);
  assert.equal(ended.status, 0, 'the menu ends with the input');
});

test('no command prints a key or a calendar link, whatever the Mini says', () => {
  const place = makePlace('no-leak');
  place.stubFile('status-output.txt', 'token ' + secrets.sanity + '\nlink ' + secrets.group + '\nany address https://example.org/a?b=c here\n');
  place.stubFile('check-output.txt', 'FAIL group ' + secrets.group + '\n');
  ['status', 'restart', 'update'].forEach(word => {
    const result = place.run([word, '--yes']);
    assertNoLeak(result, word);
  });
  const status = place.run(['status']);
  assert.ok(status.text.includes('(address hidden)'), status.text);
});

test('the tool still has valid bash syntax and starts with set -u', () => {
  assert.equal(spawnSync('/bin/bash', ['-n', toolFile], { encoding: 'utf8' }).status, 0);
  assert.ok(/^set -u$/m.test(fs.readFileSync(toolFile, 'utf8')));
  assert.ok(!/[\u2013\u2014]/.test(fs.readFileSync(new URL(import.meta.url), 'utf8')), 'this test has an em or en dash');
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
