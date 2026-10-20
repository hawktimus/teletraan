// Tests for the words of tools/teletraan/teletraan-tool: update, status and restart,
// with --yes and --computer NAME, the way tools/mac/ship.sh runs them. ssh, scp,
// rsync, sudo and systemctl are small fake ones in a temporary folder, so nothing
// touches the network or a real Mini. The keys and links in the test are made up.
// The menu itself is tested in tests/teletraan-tool.test.mjs.
//
//   node tests/teletraan-tool-commands.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { copyParts } from './helpers/script-parts.mjs';
import { fakeSudo } from './helpers/tool-fakes.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const toolFile = path.join(repo, 'tools/teletraan/teletraan-tool');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-tool-words-'));

const computerAddress = 'hawktimus@teletraan.test';
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
# Closing the shared connection is not a call worth logging
case " $* " in *" -O "*) exit 0 ;; esac
echo "ssh $*" >> "$STUB_LOG"
while [ "$#" -gt 0 ]; do
  case $1 in
    -O) exit 0 ;;
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
  *) cd "$COMPUTER_HOME" && PATH="$STUB_FAKES:$PATH" HOME="$COMPUTER_HOME" sh -c "$command" ;;
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


const fakeSystemctl = `#!/bin/sh
echo "systemctl $*" >> "$STUB_LOG"
[ -f "$STUB_DIR/systemctl.exit" ] && exit "$(cat "$STUB_DIR/systemctl.exit")"
exit 0
`;

function writeTool(folder, name, text) {
  fs.writeFileSync(path.join(folder, name), text, { mode: 0o755 });
}

// The Mac's home, the fake tools and the folder that stands for the Teletraan computer
function makePlace(name, options = {}) {
  const root = path.join(work, name);
  const place = {
    root: root,
    home: path.join(root, 'home'),
    stub: path.join(root, 'stub'),
    fakes: path.join(root, 'fakes'),
    sessions: path.join(root, 'sessions'),
    computerHome: path.join(root, 'computer-home'),
    computerRepo: path.join(root, 'computer-repo'),
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
        TELETRAAN_SESSION_BASE: place.sessions,
        COMPUTER_HOME: place.computerHome,
        COMPUTER_REPO: place.computerRepo,
      };
      const text = input.length ? input.join('\n') + '\n' : '';
      const result = spawnSync('/bin/bash', [tool].concat(words), { env: env, input: text, encoding: 'utf8' });
      return { text: result.stdout, errors: result.stderr, status: result.status, calls: place.calls() };
    },
  };

  [place.home, place.stub, place.fakes, place.sessions, place.computerHome].forEach(folder => fs.mkdirSync(folder, { recursive: true }));
  writeTool(place.fakes, 'ssh', fakeSsh);
  writeTool(place.fakes, 'scp', fakeScp);
  writeTool(place.fakes, 'rsync', fakeRsync);
  writeTool(place.fakes, 'sudo', fakeSudo);
  writeTool(place.fakes, 'systemctl', fakeSystemctl);
  fs.mkdirSync(path.join(place.computerRepo, 'computer/scripts'), { recursive: true });
  ['calendars', 'slides', 'photos-drive', 'monday', 'frc', 'news', 'match13', 'console', 'watchdog', 'backup', 'nightly', 'reboot'].forEach(entry => writeTool(path.join(place.computerRepo, 'computer/scripts'), 'install-' + entry + '.sh', '#!/bin/sh\necho "ran install-' + entry + '.sh"\n'));
  fs.mkdirSync(path.join(place.computerHome, 'teletraan-staging/computer'), { recursive: true });
  writeTool(path.join(place.computerHome, 'teletraan-staging/computer'), 'install.sh', '#!/bin/sh\necho "install.sh $*" >> "$STUB_LOG"\n[ -f "$STUB_DIR/install.exit" ] && exit "$(cat "$STUB_DIR/install.exit")"\nexit 0\n');
  if (options.sudoPassword) place.stubFile('sudo-password.txt', options.sudoPassword + '\n');
  place.stubFile('status-output.txt', 'Last calendar sync        3 minutes ago (2026-10-10 13:50 UTC)\n');
  place.stubFile('check-output.txt', 'SHOWN   team  Robotics meeting\n');
  fs.writeFileSync(place.log, '');

  const stateFolder = path.join(place.home, '.teletraan');
  if (!options.noConfig) {
    fs.mkdirSync(stateFolder, { recursive: true, mode: 0o700 });
    fs.writeFileSync(place.configFile(), options.config || 'current=main\nmini.main=' + computerAddress + '\n');
  }
  // Saved values on the Mac, so the filter has something to hide
  fs.mkdirSync(stateFolder, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(stateFolder, 'secrets.env'), "SANITY_WRITE_TOKEN='" + secrets.sanity + "'\nCALENDAR_GROUP_URL='" + secrets.group + "'\n", { mode: 0o600 });
  return place;
}

const twoComputers = 'current=main\nmini.main=' + computerAddress + '\nmini.spare=' + spareAddress + '\n';

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

test('update --yes copies the files to the staging folder, then runs the installer there, in that order, and asks nothing', () => {
  const place = makePlace('update-yes');
  const result = place.run(['update', '--yes']);
  assert.equal(result.status, 0, result.errors);

  const calls = lines(result.calls);
  const copy = calls.findIndex(line => line.startsWith('rsync '));
  const install = calls.findIndex(line => line.includes('install.sh'));
  assert.ok(copy !== -1 && install > copy, calls.join(' / '));
  assert.ok(calls[copy].includes(' -a --delete '), calls[copy]);
  ['.git', 'local.env', '.env', 'node_modules'].forEach(name => assert.ok(calls[copy].includes('--exclude ' + name + ' '), 'excludes ' + name));
  assert.ok(calls[copy].endsWith(' ' + repo.replace(/\/$/, '') + '/ ' + computerAddress + ':teletraan-staging/'), calls[copy]);
  assert.ok(result.calls.includes("sudo -S -p '' bash -c 'stage=$1;") && result.calls.includes('install.sh" --from "$stage" --yes'), 'the installer runs as root in one remote shell: ' + result.calls);
  assert.ok(result.calls.indexOf('install.sh --from') > result.calls.indexOf('rsync '), 'the stub installer ran after the copy');
  assert.equal(calls.filter(line => line === 'systemctl restart teletraan-kiosk.service').length, 1, 'the screen restarts once, at the end of the same remote shell');

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
  assert.equal(declinedResult.status, 1, 'a script must not think the Teletraan computer was updated');
  assert.ok(declinedResult.text.includes('Nothing was copied.'), declinedResult.text);
  assert.equal(indexOfCall(declinedResult.calls, 'rsync '), -1);
  assert.equal(indexOfCall(declinedResult.calls, 'install.sh'), -1, 'the installer was not run');
});

test('update with nobody to answer counts as no: nothing is copied and the exit code is not zero', () => {
  const place = makePlace('update-no-input');
  const result = place.run(['update']);
  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('none came'), result.errors);
  assert.equal(indexOfCall(result.calls, 'rsync '), -1);
});

test('update asks nothing about the pull timer: the installer turns it off when it moves the Teletraan computer to releases', () => {
  const place = makePlace('update-timer');
  place.stubFile('pull-timer.txt', 'active\n');
  const result = place.run(['update', '--yes']);
  assert.equal(result.status, 0, result.errors);
  assert.ok(!result.text.includes('also pulls from GitHub'), result.text);
  assert.equal(indexOfCall(result.calls, 'is-active'), -1);
});

test('a failing copy gives an exit code that is not zero, says to run it again and does not run the installer', () => {
  const place = makePlace('update-rsync-fails');
  place.stubFile('rsync.exit', '23');
  const result = place.run(['update', '--yes']);
  assert.notEqual(result.status, 0);
  assert.ok(result.errors.includes('exit 23'), result.errors);
  assert.ok(result.text.includes('Run this again'), result.text);
  assert.equal(indexOfCall(result.calls, 'install.sh'), -1, 'the installer was not run');
  assertNoLeak(result, 'rsync fails');
});

test('a failing installer gives an exit code that is not zero, after the files were copied, and names the word that tries again', () => {
  const place = makePlace('update-install-fails');
  place.stubFile('install.exit', '5');
  const result = place.run(['update', '--yes']);
  assert.notEqual(result.status, 0);
  assert.ok(result.text.includes('The files are copied.'));
  assert.ok(result.errors.includes('exit 5'), result.errors);
  assert.ok(result.text.includes('Run teletraan-tool update to try again.'), result.text);
  assert.ok(!result.text.includes('Choose 1'), 'the hint names a word, not a menu choice');
});

test('update stops before it copies when the Teletraan computer cannot be reached, and when the folder is not the repository', () => {
  const down = makePlace('update-down');
  down.stubFile('ssh.exit', '255');
  const downResult = down.run(['update', '--yes']);
  assert.notEqual(downResult.status, 0);
  assert.ok(downResult.errors.includes('could not reach ' + computerAddress), downResult.errors);
  assert.equal(indexOfCall(downResult.calls, 'rsync '), -1);

  const place = makePlace('update-wrong-folder');
  const copy = path.join(place.root, 'elsewhere/tools/teletraan');
  fs.mkdirSync(copy, { recursive: true });
  fs.copyFileSync(toolFile, path.join(copy, 'teletraan-tool'));
  copyParts(toolFile, copy);
  fs.chmodSync(path.join(copy, 'teletraan-tool'), 0o755);
  const result = place.run(['update', '--yes'], [], path.join(copy, 'teletraan-tool'));
  assert.notEqual(result.status, 0);
  assert.ok(result.errors.includes('does not look like the Teletraan repository'), result.errors);
  assert.equal(indexOfCall(result.calls, 'rsync '), -1, '--yes cannot copy from the wrong folder');
});

test('update refuses a tree that still has deploy/, copies nothing and says to update this copy', () => {
  const place = makePlace('update-old-tree');
  const tree = path.join(place.root, 'old');
  fs.mkdirSync(path.join(tree, 'tools/teletraan'), { recursive: true });
  fs.mkdirSync(path.join(tree, 'deploy/scripts'), { recursive: true });
  fs.mkdirSync(path.join(tree, 'dashboard'), { recursive: true });
  fs.writeFileSync(path.join(tree, 'dashboard/index.html'), '');
  fs.writeFileSync(path.join(tree, 'deploy/scripts/pull.sh'), '');
  fs.copyFileSync(toolFile, path.join(tree, 'tools/teletraan/teletraan-tool'));
  copyParts(toolFile, path.join(tree, 'tools/teletraan'));
  fs.chmodSync(path.join(tree, 'tools/teletraan/teletraan-tool'), 0o755);
  const result = place.run(['update', '--yes'], [], path.join(tree, 'tools/teletraan/teletraan-tool'));
  assert.notEqual(result.status, 0);
  assert.ok(result.errors.includes('This copy is older than round 6; update it.'), result.errors);
  assert.equal(indexOfCall(result.calls, 'rsync '), -1, 'nothing is copied from an old tree');
});

test('status runs status-write.sh --print and check-calendars.sh, hides any key or address in what comes back, and exits 0', () => {
  const place = makePlace('status');
  place.stubFile('status-output.txt', 'Last calendar sync        3 minutes ago (2026-10-10 13:50 UTC)\na script that went wrong printed ' + secrets.sanity + '\n');
  place.stubFile('check-output.txt', 'FAIL    group  download failed from ' + secrets.group + ' today\n');
  const result = place.run(['status']);
  assert.equal(result.status, 0, result.errors);

  const calls = lines(result.calls);
  const print = calls.findIndex(line => line.includes(place.computerRepo + '/computer/scripts/status-write.sh --print'));
  const check = calls.findIndex(line => line.includes(place.computerRepo + '/computer/scripts/check-calendars.sh'));
  assert.ok(print !== -1 && check > print, calls.join(' / '));
  assert.ok(result.text.includes('Last calendar sync        3 minutes ago'));
  assert.ok(result.text.includes('printed (hidden)') && result.text.includes('failed from (hidden) today'), result.text);
  assert.ok(!result.calls.includes('rsync') && !result.calls.includes('restart'), 'status changes nothing on the Teletraan computer');
  assertNoLeak(result, 'status');
});

test('status gives an exit code that is not zero when the Teletraan computer cannot be reached, has an older status-write.sh or reports a problem', () => {
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
  assert.ok(oldResult.text.includes('The Teletraan computer has an older status-write.sh. Run teletraan-tool update.'), oldResult.text);
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
  assert.ok(result.calls.includes("sudo -S -p '' bash -c 'systemctl restart \"$1\"' bash 'teletraan-kiosk.service'"), result.calls);
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

test('--computer NAME picks a saved computer for one run and does not change the one in use', () => {
  const place = makePlace('computer-name', { config: twoComputers });
  const before = fs.readFileSync(place.configFile(), 'utf8');

  const spare = place.run(['--computer', 'spare', 'restart']);
  assert.equal(spare.status, 0, spare.errors);
  assert.ok(spare.calls.includes(' ' + spareAddress + " sudo -S -p '' bash -c 'systemctl restart"), spare.calls);

  const joined = place.run(['restart', '--computer=spare']);
  assert.ok(joined.calls.includes(spareAddress), joined.calls);

  const normal = place.run(['restart']);
  assert.ok(normal.calls.includes(computerAddress), 'the Teletraan computer in use is still main: ' + normal.calls);
  assert.equal(fs.readFileSync(place.configFile(), 'utf8'), before, 'the saved file was not rewritten');
});

test('a name that is not saved stops the run with the names that are, and calls nothing', () => {
  const place = makePlace('computer-unknown', { config: twoComputers });
  const result = place.run(['--computer', 'nobody', 'update', '--yes']);
  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('no saved computer has that name. The saved names are: main, spare.'), result.errors);
  assert.ok(!result.errors.includes('nobody'), 'the name typed is not repeated');
  assert.equal(result.calls, '');
});

test('with no computer saved, a word stops the run and says to run the tool once without a word, and saves and calls nothing', () => {
  const place = makePlace('no-computer', { noConfig: true });
  ['update', 'status', 'restart'].forEach(word => {
    const result = place.run([word, '--yes']);
    assert.equal(result.status, 1, word);
    assert.ok(result.errors.includes('no computer is saved on this Mac yet') && result.errors.includes('with no word after it'), result.errors);
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
    ['--computer'],
  ].forEach(words => {
    const result = place.run(words);
    assert.equal(result.status, 2, words.join(' '));
    assert.ok(result.errors.includes('Usage: teletraan-tool [--computer NAME] [--yes] [update | status | restart]'), result.errors);
    ['update     the same as choice 1', 'status     show what', 'restart    restart the screen only'].forEach(entry => assert.ok(result.errors.includes(entry), entry));
    assert.ok(!result.errors.includes(secrets.stray) && !result.text.includes(secrets.stray), 'the word typed is not repeated');
    assert.equal(result.calls, '', words.join(' ') + ' called nothing');
  });

  const help = place.run(['--help']);
  assert.equal(help.status, 0);
  assert.ok(help.text.includes('Usage: teletraan-tool'), help.text);
  assert.equal(help.calls, '');
});

test('with no word the menu still comes up, and --computer picks the Teletraan computer it uses', () => {
  const place = makePlace('menu', { config: twoComputers });
  const result = place.run([], ['q']);
  assert.equal(result.status, 0, result.errors);
  ['1  Install everything', '2  Status of the Teletraan computer', '3  Keys and calendars', 'c  Choose another computer'].forEach(entry => assert.ok(result.text.includes(entry), entry));
  assert.ok(result.text.includes('Teletraan computer in use: main (' + computerAddress + ')'));

  const spare = place.run(['--computer', 'spare'], ['q']);
  assert.ok(spare.text.includes('Teletraan computer in use: spare (' + spareAddress + ')'), spare.text);
  assert.equal(spare.calls, '', 'looking at the menu runs nothing');
});

test('the menu keeps its own wording for the hints, and the end of the input still ends it quietly', () => {
  const place = makePlace('menu-wording');
  place.stubFile('status-output.txt', 'Usage: status-write.sh\n');
  place.stubFile('status.exit', '2');
  const result = place.run([], ['2', 'q']);
  assert.ok(result.text.includes('The Teletraan computer has an older status-write.sh. Choose 1 to update it.'), result.text);

  const ended = place.run([]);
  assert.equal(ended.status, 0, 'the menu ends with the input');
});

test('no command prints a key or a calendar link, whatever the Teletraan computer says', () => {
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

const fakePassword = 'pw-for-the-test-only-4417';

test('the password is asked once for a run, however many steps need it, and it never reaches a command line or the screen', () => {
  const place = makePlace('one-password', { sudoPassword: fakePassword });
  const result = place.run([], ['1', '', fakePassword, '1', '', '1', '', 'q']);
  assert.equal(result.status, 0, result.errors);
  assert.equal((result.text.match(/Password of /g) || []).length, 1, 'one question: ' + result.text);
  assert.equal(result.text.split('Done. The control page is at').length - 1, 3, 'all three installs ran');
  assert.ok(!(result.text + result.errors + result.calls).includes(fakePassword), 'the password is nowhere in the output or in a call');
  assert.equal(lines(result.calls).filter(line => line.startsWith('sudo -S -p  bash -c')).length, 3, 'one remote shell for each install');
});

test('a wrong password says so in one sentence, the step does not run, and the next try asks again', () => {
  const place = makePlace('wrong-password', { sudoPassword: fakePassword });
  const result = place.run([], ['1', '', 'not-the-password', '1', '', fakePassword, 'q']);
  assert.ok(result.text.includes('That password was wrong. Choose the same thing again to try another.'), result.text);
  assert.equal((result.text.match(/Password of /g) || []).length, 2);
  assert.equal(result.text.split('Done. The control page is at').length - 1, 1);
  assert.ok(!(result.text + result.errors + result.calls).includes('not-the-password'));
});

test('an account that needs no password is not asked for one', () => {
  const place = makePlace('no-password');
  const result = place.run(['restart']);
  assert.equal(result.status, 0, result.errors);
  assert.ok(!result.text.includes('Password of'), result.text);
});

test('every step shares one ssh connection from a private folder that is removed at the end', () => {
  const place = makePlace('shared-connection');
  const result = place.run(['update', '--yes']);
  assert.equal(result.status, 0, result.errors);
  const folders = new Set((result.calls.match(/ControlPath=(\S+)\/%C/g) || []).map(text => text.slice(12, -3)));
  assert.equal(folders.size, 1, 'one folder for the whole run');
  const sshLines = lines(result.calls).filter(line => /^(ssh|scp|rsync) /.test(line));
  assert.ok(sshLines.length >= 3 && sshLines.every(line => line.includes('ControlMaster=auto') && line.includes('ControlPersist=')), sshLines.join(' / '));
  assert.ok(lines(result.calls).find(line => line.startsWith('rsync ')).includes('-e ssh -o ConnectTimeout=10 -o ControlMaster=auto'));
  assert.ok(sshLines.every(line => line.includes(place.sessions + '/tt.')), 'the folder is made under the session base');
  assert.deepEqual(fs.readdirSync(place.sessions), [], 'nothing is left behind');
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
