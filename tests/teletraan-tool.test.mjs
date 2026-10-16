// Tests for tools/teletraan/teletraan-tool, the Mac tool that updates the Teletraan computer and
// keeps its keys and calendars, and for tools/teletraan/merge-env.sh, the script it
// runs on the Teletraan computer. ssh, scp, rsync, sudo and systemctl are replaced with small
// fake ones in a temporary folder, so nothing touches the network or a real
// computer, and the computer is a folder. The keys and links in the test are made up.
//
//   node tests/teletraan-tool.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { textOf, copyParts } from './helpers/script-parts.mjs';
import { fakeSudo } from './helpers/tool-fakes.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const toolFile = path.join(repo, 'tools/teletraan/teletraan-tool');
const mergeFile = path.join(repo, 'tools/teletraan/merge-env.sh');
const commandFile = path.join(repo, 'tools/teletraan/Teletraan Tool.command');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-tool-'));

const computerAddress = 'hawktimus@teletraan.test';
const systemPath = '/usr/bin:/bin:/usr/sbin:/sbin';

// Every secret in the test. The tool may show the first 4 characters of one, and
// nothing more, anywhere: not on the screen, not in a command line.
const secrets = {
  oldSanity: 'skOLDtoken0123456789abcdef',
  oldMonday: 'mondayOLD.token-value-0123456789',
  oldGroup: 'https://api.band.us/ical?token=OLDGROUPLINK0123456789',
  oldBuild: 'https://api.band.us/ical?token=OLDBUILDLINK0123456789',
  newSanity: 'skNEWtoken9876543210fedcba',
  newTba: 'TBAnewkey9876543210fedcba9876',
  newGroup: 'https://api.band.us/ical?token=NEWGROUPLINK9876543210',
  webcal: 'webcal://api.band.us/ical?token=WEBCALLINK9876543210',
  stored: 'https://api.band.us/ical?token=WEBCALLINK9876543210',
};
const hiddenParts = Object.values(secrets).filter(value => !value.startsWith('webcal://')).flatMap(value => [value, value.slice(4)]).concat(['WEBCALLINK9876543210']);

// Fake tools. Each writes the call it gets to calls.log. The tool never puts a
// secret on a command line, so nothing secret should ever reach that log.
const fakeSsh = `#!/bin/sh
# Closing the shared connection is not a call worth logging
case " $* " in *" -O "*) exit 0 ;; esac
echo "ssh $*" >> "$STUB_LOG"
# The stdin of a call is saved so a test can see that a password never reached a command line
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

const fakeScp = `#!/bin/sh
echo "scp $*" >> "$STUB_LOG"
[ -f "$STUB_DIR/scp.exit" ] && exit "$(cat "$STUB_DIR/scp.exit")"
while [ "$#" -gt 0 ]; do
  case $1 in
    -o) shift 2 ;;
    -*) shift ;;
    *) break ;;
  esac
done
count=$#
index=0
for argument in "$@"; do
  index=$((index + 1))
  [ "$index" -lt "$count" ] && cp "$argument" "$COMPUTER_HOME/$(basename "$argument")"
done
exit 0
`;

const fakeRsync = `#!/bin/sh
echo "rsync $*" >> "$STUB_LOG"
[ -f "$STUB_DIR/rsync.exit" ] && exit "$(cat "$STUB_DIR/rsync.exit")"
exit 0
`;

// A sudo that wants a password when sudo-password.txt exists: -n fails, and -S or -v read one line from the input
// and compare it. Without that file it needs none. Options are dropped and the rest is run as it is.

const fakeSystemctl = `#!/bin/sh
echo "systemctl $*" >> "$STUB_LOG"
[ -f "$STUB_DIR/systemctl.exit" ] && exit "$(cat "$STUB_DIR/systemctl.exit")"
exit 0
`;

function writeTool(folder, name, text) {
  fs.writeFileSync(path.join(folder, name), text, { mode: 0o755 });
}

const installNames = ['calendars', 'slides', 'monday', 'frc', 'console', 'watchdog', 'backup', 'nightly'];

// Makes the Mac's home, the fake tools and the folder that stands for the Teletraan computer,
// and returns how to run the tool in them.
function makePlace(name, options = {}) {
  const root = path.join(work, name);
  const place = {
    root: root,
    home: path.join(root, 'home'),
    stub: path.join(root, 'stub'),
    fakes: path.join(root, 'fakes'),
    computerHome: path.join(root, 'computer-home'),
    computerRepo: path.join(root, 'computer-repo'),
    log: path.join(root, 'calls.log'),
    computerEnvFile: () => path.join(place.computerRepo, 'computer/local.env'),
    secretsFile: () => path.join(place.home, '.teletraan/secrets.env'),
    configFile: () => path.join(place.home, '.teletraan/config'),
    calls: () => fs.readFileSync(place.log, 'utf8'),
    stubFile: (file, text) => fs.writeFileSync(path.join(place.stub, file), text),
    run(input, tool = toolFile) {
      const env = {
        HOME: place.home,
        PATH: place.fakes + ':' + systemPath,
        TERM: 'dumb',
        STUB_LOG: place.log,
        STUB_DIR: place.stub,
        STUB_FAKES: place.fakes,
        COMPUTER_HOME: place.computerHome,
        COMPUTER_REPO: place.computerRepo,
      };
      const result = spawnSync('/bin/bash', [tool], { env: env, input: input.join('\n') + '\n', encoding: 'utf8' });
      return { text: result.stdout, errors: result.stderr, status: result.status, calls: place.calls() };
    },
  };

  [place.home, place.stub, place.fakes, place.computerHome, path.join(place.computerRepo, 'computer/scripts')].forEach(folder => fs.mkdirSync(folder, { recursive: true }));
  writeTool(place.fakes, 'ssh', fakeSsh);
  writeTool(place.fakes, 'scp', fakeScp);
  writeTool(place.fakes, 'rsync', fakeRsync);
  writeTool(place.fakes, 'sudo', fakeSudo);
  writeTool(place.fakes, 'systemctl', fakeSystemctl);
  installNames.forEach(entry => {
    const failing = options.failInstall === entry;
    writeTool(path.join(place.computerRepo, 'computer/scripts'), 'install-' + entry + '.sh', '#!/bin/sh\necho "ran install-' + entry + '.sh"\n' + (failing ? 'exit 1\n' : ''));
  });
  fs.writeFileSync(place.log, '');
  // The installer the staging folder would hold: it logs, and its exit code can be set
  fs.mkdirSync(path.join(place.computerHome, 'teletraan-staging/computer'), { recursive: true });
  writeTool(path.join(place.computerHome, 'teletraan-staging/computer'), 'install.sh', '#!/bin/sh\necho "install.sh $*" >> "$STUB_LOG"\n[ -f "$STUB_DIR/install.exit" ] && exit "$(cat "$STUB_DIR/install.exit")"\nexit 0\n');

  const stateFolder = path.join(place.home, '.teletraan');
  if (!options.noConfig) {
    fs.mkdirSync(stateFolder, { recursive: true, mode: 0o700 });
    fs.writeFileSync(place.configFile(), options.config || 'current=main\nmini.main=' + computerAddress + '\n');
  }
  if (options.secrets !== undefined) {
    fs.mkdirSync(stateFolder, { recursive: true, mode: 0o700 });
    fs.writeFileSync(place.secretsFile(), options.secrets, { mode: 0o600 });
  }
  if (options.computerEnv !== undefined) fs.writeFileSync(place.computerEnvFile(), options.computerEnv, { mode: 0o644 });
  return place;
}

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

function modeOf(file) {
  return fs.statSync(file).mode & 0o777;
}

function lines(text) {
  return text.split('\n');
}

// No secret, and no tail of one, in anything the tool printed or any command line
function assertNoLeak(result, label) {
  const everything = result.text + '\n' + result.errors + '\n' + result.calls;
  hiddenParts.forEach(part => assert.ok(!everything.includes(part), label + ': the output or a command line holds ' + part.slice(0, 6) + '...'));
}

// Runs a piece of bash after loading the functions of the tool
function inTool(snippet) {
  const home = fs.mkdtempSync(path.join(work, 'functions-'));
  const result = spawnSync('/bin/bash', ['-c', 'source "$1"; ' + snippet, 'bash', toolFile], {
    env: { HOME: home, PATH: systemPath },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

const maskedOldMonday = 'mond........';

test('mask shows 4 characters and dots, nothing for a value that is short, empty or a placeholder', () => {
  const out = inTool(`
    for value in '' '[paste the token here]' short 12345678901 123456789012 skTEST0123456789abcdef; do
      printf '%s|' "$(mask "$value")"
    done`);
  assert.equal(out, 'not set|not set|........|........|1234........|skTE........|');
});

test('a webcal link is stored as https, an http link and anything else is refused, and the reason never holds the link', () => {
  const out = inTool(`
    check_link 'webcal://api.band.us/ical?token=SECRETPARTONE' && printf 'a:%s\\n' "$clean_value"
    check_link 'https://api.band.us/ical?token=SECRETPARTONE' && printf 'b:%s\\n' "$clean_value"
    check_link 'http://api.band.us/ical?token=SECRETPARTONE' || printf 'c:%s\\n' "$clean_reason"
    check_link 'ftp://api.band.us/SECRETPARTONE' || printf 'd:%s\\n' "$clean_reason"
    check_link 'https://api.band.us/a b/SECRETPARTONE' || printf 'e:%s\\n' "$clean_reason"
    check_link "https://api.band.us/a'b/SECRETPARTONE" || printf 'f:%s\\n' "$clean_reason"
    check_link 'https://api.band.us/a"b/SECRETPARTONE' || printf 'g:%s\\n' "$clean_reason"
    check_link '' || printf 'h:%s\\n' "$clean_reason"`);
  const found = lines(out);
  assert.equal(found[0], 'a:https://api.band.us/ical?token=SECRETPARTONE');
  assert.equal(found[1], 'b:https://api.band.us/ical?token=SECRETPARTONE');
  assert.ok(found[2].startsWith('c:') && found[2].includes('http://') && found[2].includes('https://'), found[2]);
  assert.ok(found[3].startsWith('d:') && found[3].includes('https:// or webcal://'), found[3]);
  ['e', 'f', 'g'].forEach((letter, index) => assert.ok(found[4 + index].startsWith(letter + ':') && found[4 + index].includes('character'), found[4 + index]));
  assert.ok(found[7].startsWith('h:'), found[7]);
  found.filter(line => /^[cdefgh]:/.test(line)).forEach(line => assert.ok(!line.includes('SECRETPARTONE'), line));
});

test('a key may hold letters, digits, dots, dashes and underscores only, and the reason never holds the key', () => {
  const out = inTool(`
    for value in 'abc-DEF_1.2' 'with space' 'quote"d' "it's" 'semi;colon' ''; do
      if check_key "$value"; then printf 'ok|'; else printf 'no|'; fi
    done
    check_key 'secret value' || printf '%s' "$clean_reason"`);
  assert.ok(out.startsWith('ok|no|no|no|no|no|'), out);
  assert.ok(!out.includes('secret value'), out);
});

test('a calendar name becomes the middle of CALENDAR_<ID>_URL, and the code Studio uses is its lowercase form', () => {
  const out = inTool(`
    calendar_id 'Build season'; printf '|'
    calendar_id '  team  '; printf '|'
    calendar_id 'Outreach & events?'; printf '|'
    calendar_id '???'; printf '|'
    calendar_code CALENDAR_BUILD_SEASON_URL; printf '|'
    calendar_code CALENDAR_Group_URL`);
  assert.equal(out, 'BUILD_SEASON|TEAM|OUTREACH_EVENTS||build_season|group');
});

test('the quotes around a value are taken off the way the scripts on the Teletraan computer take them off', () => {
  const out = inTool(`
    unquote "'abc'"; printf '|'
    unquote '"abc"'; printf '|'
    unquote abc; printf '|'
    unquote "'"; printf '|'
    unquote ""`);
  assert.equal(out, 'abc|abc|abc||');
});

test('the output of the Teletraan computer is cleaned: every saved value and anything that looks like a web address is hidden', () => {
  const place = makePlace('hide', { secrets: `SANITY_WRITE_TOKEN='${secrets.oldSanity}'\nCALENDAR_GROUP_URL='${secrets.oldGroup}'\n` });
  const result = spawnSync('/bin/bash', ['-c', 'source "$1"; hide_secrets', 'bash', toolFile], {
    env: { HOME: place.home, PATH: systemPath },
    input: [
      'plain line stays',
      'token ' + secrets.oldSanity + ' twice ' + secrets.oldSanity,
      'link ' + secrets.oldGroup + ' end',
      'other address https://example.org/path?x=1 and webcal://example.org/a end',
      'a short word like hidden is not a saved value',
    ].join('\n') + '\n',
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(lines(result.stdout).slice(0, 5), [
    'plain line stays',
    'token (hidden) twice (hidden)',
    'link (hidden) end',
    'other address (address hidden) and (address hidden) end',
    'a short word like hidden is not a saved value',
  ]);
});

test('the first run asks for the address, checks that ssh works and saves it with the mode of a private file', () => {
  const place = makePlace('first-run', { noConfig: true });
  const result = place.run([computerAddress, '', 'q']);

  assert.equal(result.status, 0, result.errors);
  assert.ok(result.calls.includes('ssh -n -o ConnectTimeout=10 -o ControlMaster=auto') && result.calls.includes(' ' + computerAddress + ' true'), result.calls);
  assert.equal(fs.readFileSync(place.configFile(), 'utf8').split('\n').filter(line => !line.startsWith('#')).join('\n'), 'current=main\nmini.main=' + computerAddress + '\n');
  assert.equal(modeOf(place.configFile()), 0o600);
  assert.equal(modeOf(path.join(place.home, '.teletraan')), 0o700);
  assert.ok(result.text.includes('Teletraan computer in use: main (' + computerAddress + ')'), result.text);
});

test('the first run saves nothing when the address is not user@host or ssh cannot connect, and says why', () => {
  const wrong = makePlace('first-run-wrong', { noConfig: true });
  const wrongResult = wrong.run(['nonsense', 'n']);
  assert.equal(wrongResult.status, 1);
  assert.ok(wrongResult.errors.includes('not an address like user@host'), wrongResult.errors);
  assert.ok(!fs.existsSync(wrong.configFile()), 'nothing was saved');
  assert.ok(!wrongResult.calls.includes('ssh'), 'ssh was not tried for a wrong address');

  const down = makePlace('first-run-down', { noConfig: true });
  down.stubFile('ssh.exit', '255');
  const downResult = down.run([computerAddress, 'n']);
  assert.equal(downResult.status, 1);
  assert.ok(downResult.errors.includes('could not connect'), downResult.errors);
  assert.ok(!fs.existsSync(down.configFile()), 'nothing was saved');

  const leading = makePlace('first-run-dash', { noConfig: true });
  assert.equal(leading.run(['-oProxyCommand=x@y', 'n']).status, 1, 'an address cannot start like an option');
  assert.ok(!leading.calls().includes('ProxyCommand'));
});

test('the menu lists the six choices and the extras, names the Teletraan computer in use, and stops on q or when the input ends', () => {
  const place = makePlace('menu');
  const result = place.run(['x', '', 'q']);

  assert.equal(result.status, 0, result.errors);
  ['1  Install the files on this Mac', '2  Keys and calendars', '3  Copy the Teletraan computer', '4  Install the services', '5  Status of the Teletraan computer', '6  Restart the screen', '7  Choose another computer', 'q  Quit'].forEach(entry => {
    assert.ok(result.text.includes(entry), 'the menu has: ' + entry);
  });
  assert.ok(result.text.includes('Teletraan computer in use: main (' + computerAddress + ')'));
  assert.ok(result.text.includes('That is not one of the choices.'), 'x is not a choice');
  assert.equal(result.calls, '', 'looking at the menu runs nothing');

  const ended = makePlace('menu-ended');
  const endedResult = ended.run([]);
  assert.equal(endedResult.status, 0, 'the end of the input ends the tool');
});

test('update copies the repository with the same excludes as before to the staging folder, then runs the installer, in that order', () => {
  const place = makePlace('update');
  const result = place.run(['1', '', 'q']);
  assert.equal(result.status, 0, result.errors);

  const calls = lines(result.calls.trim());
  const copy = calls.findIndex(line => line.startsWith('rsync '));
  const install = calls.findIndex(line => line.includes('install.sh'));
  assert.ok(copy !== -1 && install > copy, 'the files are copied, then the installer runs: ' + calls.join(' / '));

  const line = calls[copy];
  assert.ok(line.includes(' -a --delete '), line);
  ['.git', 'local.env', '.env', 'node_modules', '.DS_Store', 'studio/dist', 'studio/.sanity', '_inputs', '_outputs'].forEach(name => {
    assert.ok(line.includes('--exclude ' + name + ' ') || line.includes('--exclude ' + name + ' -e'), 'excludes ' + name + ': ' + line);
  });
  assert.equal((line.match(/--exclude/g) || []).length, 9, 'no other excludes: ' + line);
  assert.ok(line.includes('-e ssh -o ConnectTimeout=10 -o ControlMaster=auto -o ControlPersist=300 -o ControlPath='), 'rsync uses the shared connection: ' + line);
  assert.ok(line.endsWith(' ' + repo.replace(/\/$/, '') + '/ ' + computerAddress + ':teletraan-staging/'), line);
  assert.ok(calls.some(line => line.startsWith('ssh -n ') && line.includes("sudo -S -p '' bash -c")), 'the installer runs as root in one remote shell: ' + calls.join(' / '));
  assertNoLeak(result, 'update');
});

test('update stops before it copies when the Teletraan computer cannot be reached, and when a copy fails it does not run the installer', () => {
  const down = makePlace('update-down');
  down.stubFile('ssh.exit', '255');
  const downResult = down.run(['1', 'q']);
  assert.ok(downResult.errors.includes('could not reach ' + computerAddress), downResult.errors);
  assert.ok(!downResult.calls.includes('rsync'), 'nothing was copied');

  const broken = makePlace('update-rsync-fails');
  broken.stubFile('rsync.exit', '23');
  const brokenResult = broken.run(['1', '', 'q']);
  assert.ok(brokenResult.errors.includes('exit 23'), brokenResult.errors);
  assert.ok(brokenResult.text.includes('Run this again'), brokenResult.text);
  assert.ok(!brokenResult.calls.includes('install.sh'), 'the installer did not run');

  const quiet = makePlace('update-install-fails');
  quiet.stubFile('install.exit', '5');
  const quietResult = quiet.run(['1', '', 'q']);
  assert.ok(quietResult.text.includes('The files are copied.'));
  assert.ok(quietResult.errors.includes('exit 5'), quietResult.errors);
});

test('update refuses to copy from a folder that is not the repository, because --delete would empty the Teletraan computer', () => {
  const place = makePlace('update-wrong-folder');
  const copy = path.join(place.root, 'elsewhere/tools/teletraan');
  fs.mkdirSync(copy, { recursive: true });
  fs.copyFileSync(toolFile, path.join(copy, 'teletraan-tool'));
  copyParts(toolFile, copy);
  fs.copyFileSync(mergeFile, path.join(copy, 'merge-env.sh'));
  fs.chmodSync(path.join(copy, 'teletraan-tool'), 0o755);

  const result = place.run(['1', 'q'], path.join(copy, 'teletraan-tool'));
  assert.ok(result.errors.includes('does not look like the Teletraan repository'), result.errors);
  assert.ok(!result.calls.includes('rsync'), 'nothing was copied');
});

const computerEnv = [
  '# Settings for the Teletraan computer',
  "TELETRAAN_PORT='3229'",
  "TELETRAAN_DATA='/var/lib/teletraan/data'",
  "CALENDAR_TEAM_URL='[paste the iCal address of the team calendar here]'",
  "SANITY_WRITE_TOKEN='" + secrets.oldSanity + "'",
  "MONDAY_API_TOKEN='" + secrets.oldMonday + "'",
  "TBA_AUTH_KEY='[paste the read key here]'",
  "CALENDAR_GROUP_URL='" + secrets.oldGroup + "'",
  "CALENDAR_BUILD_URL='" + secrets.oldBuild + "'",
  '',
  '# kept comment',
  '',
].join('\n');

const macSecrets = [
  "SANITY_WRITE_TOKEN='" + secrets.oldSanity + "'",
  "MONDAY_API_TOKEN='" + secrets.oldMonday + "'",
  "CALENDAR_GROUP_URL='" + secrets.oldGroup + "'",
  "CALENDAR_BUILD_URL='" + secrets.oldBuild + "'",
  '',
].join('\n');

test('the form shows values masked, takes edit, keep and clear, adds, edits and removes calendars, and sends the result to the Teletraan computer', () => {
  const place = makePlace('form', { secrets: macSecrets, computerEnv: computerEnv });
  const result = place.run([
    '2',
    'e', secrets.newSanity,
    'c',
    'e', secrets.newTba,
    'a', 'Build season', secrets.webcal,
    'e', '1', secrets.newGroup,
    'r', '2', 'y',
    '',
    '',
    'q',
  ]);

  assert.equal(result.status, 0, result.errors);
  assertNoLeak(result, 'the form');
  assert.ok(result.text.includes('skOL........'), 'the old token is shown masked: ' + result.text);
  assert.ok(result.text.includes(maskedOldMonday), 'the old Monday token is shown masked');
  assert.ok(result.text.includes('Now: skNE........'), 'the new value is shown masked');
  assert.ok(/1\s+group\s+http\.\.\.\.\.\.\.\./.test(result.text) && /2\s+build\s+http\.\.\.\.\.\.\.\./.test(result.text), 'the calendars are listed by name with masked links');
  ['Sanity write token: new value', 'Monday token: cleared', 'The Blue Alliance key: new value', 'calendar build_season: saved', 'calendar group: new link', 'calendar build: removed'].forEach(note => {
    assert.ok(result.text.includes('  ' + note), 'the list of changes has: ' + note);
  });

  // The Mac keeps the new values, in a private file, and forgets what it cleared and removed
  assert.equal(fs.readFileSync(place.secretsFile(), 'utf8'), [
    "SANITY_WRITE_TOKEN='" + secrets.newSanity + "'",
    "TBA_AUTH_KEY='" + secrets.newTba + "'",
    "CALENDAR_GROUP_URL='" + secrets.newGroup + "'",
    "CALENDAR_BUILD_SEASON_URL='" + secrets.stored + "'",
    '',
  ].join('\n'));
  assert.equal(modeOf(place.secretsFile()), 0o600);
  assert.ok(!fs.existsSync(path.join(place.home, '.teletraan/stage')), 'the staging folder is removed');

  // The Teletraan computer replaces the lines that match, keeps every other line, and is private
  assert.equal(fs.readFileSync(place.computerEnvFile(), 'utf8'), [
    '# Settings for the Teletraan computer',
    "TELETRAAN_PORT='3229'",
    "TELETRAAN_DATA='/var/lib/teletraan/data'",
    "CALENDAR_TEAM_URL='[paste the iCal address of the team calendar here]'",
    "SANITY_WRITE_TOKEN='" + secrets.newSanity + "'",
    "TBA_AUTH_KEY='" + secrets.newTba + "'",
    "CALENDAR_GROUP_URL='" + secrets.newGroup + "'",
    '',
    '# kept comment',
    "CALENDAR_BUILD_SEASON_URL='" + secrets.stored + "'",
    '',
  ].join('\n'));
  assert.equal(modeOf(place.computerEnvFile()), 0o600);
  assert.ok(result.text.includes('replaced SANITY_WRITE_TOKEN') && result.text.includes('removed MONDAY_API_TOKEN') && result.text.includes('added CALENDAR_BUILD_SEASON_URL') && result.text.includes('removed CALENDAR_BUILD_URL'), result.text);
  assert.deepEqual(fs.readdirSync(place.computerHome).filter(name => name !== 'teletraan-staging'), [], 'the merge script and the new values are removed from the Teletraan computer');
  assert.deepEqual(fs.readdirSync(path.join(place.computerRepo, 'computer')).filter(name => name !== 'local.env' && name !== 'scripts'), [], 'no temporary file is left next to local.env');

  // The values travel in a file with scp, and then the calendar service runs once
  const calls = lines(result.calls.trim());
  const copy = calls.findIndex(line => line.startsWith('scp '));
  const merge = calls.findIndex(line => line.startsWith('sh teletraan-merge.sh '));
  const service = calls.findIndex(line => line.startsWith('sudo -S -p ') && line.includes('systemctl start teletraan-calendars.service'));
  assert.ok(copy !== -1 && merge > copy && service > merge, calls.join(' / '));
  assert.ok(calls[copy].endsWith(' ' + computerAddress + ':'), calls[copy]);
  assert.ok(result.text.includes('The calendar service ran once'), result.text);
});

test('a link typed as webcal:// is stored as https:// on the Mac and on the Teletraan computer', () => {
  const place = makePlace('webcal', { secrets: '', computerEnv: "TELETRAAN_PORT='3229'\n" });
  const result = place.run(['2', 'k', 'k', 'k', 'a', 'team', secrets.webcal, '', '', 'q']);
  assert.equal(result.status, 0, result.errors);

  const expected = "CALENDAR_TEAM_URL='" + secrets.stored + "'\n";
  assert.equal(fs.readFileSync(place.secretsFile(), 'utf8'), expected);
  assert.equal(fs.readFileSync(place.computerEnvFile(), 'utf8'), "TELETRAAN_PORT='3229'\n" + expected);
  assert.ok(!fs.readFileSync(place.secretsFile(), 'utf8').includes('webcal'));
  assert.ok(!fs.readFileSync(place.computerEnvFile(), 'utf8').includes('webcal'));
  assertNoLeak(result, 'webcal');
});

test('a key or a link that is not usable is refused with a reason that does not hold it, and the old value is kept', () => {
  const place = makePlace('form-refused', { secrets: macSecrets, computerEnv: computerEnv });
  const result = place.run([
    '2',
    'e', 'has a space ' + secrets.newSanity,
    'k',
    'k',
    'a', 'extra', 'http://api.band.us/ical?token=' + 'HTTPONLY0123456789', '',
    'a', '???',
    '',
    '',
    'q',
  ]);

  assert.equal(result.status, 0, result.errors);
  assert.ok(result.text.includes('Not saved. A key has letters, digits'), result.text);
  assert.ok(result.text.includes('starts with http://, which is not secure'), result.text);
  assert.ok(result.text.includes('A name has letters and digits'), result.text);
  assert.ok(result.text.includes('Nothing changed.'), result.text);
  assert.ok(!result.text.includes('HTTPONLY0123456789') && !result.text.includes(secrets.newSanity.slice(4)), 'the refused values are not shown');
  assert.ok(!result.calls.includes('scp '), 'with nothing changed and the default answer, nothing is sent');
  assert.equal(fs.readFileSync(place.secretsFile(), 'utf8'), macSecrets);
});

test('a name of more than 20 characters is refused, and a name that exists replaces the link of that calendar', () => {
  const place = makePlace('form-names', { secrets: macSecrets, computerEnv: computerEnv });
  const result = place.run([
    '2', 'k', 'k', 'k',
    'a', 'a calendar with a very long name indeed',
    'a', 'GROUP', secrets.newGroup,
    '',
    '',
    'q',
  ]);

  assert.ok(result.text.includes('A name has letters and digits, up to 20 of them.'), result.text);
  assert.ok(result.text.includes('There is a calendar called group already. Its link will be replaced.'), result.text);
  const saved = fs.readFileSync(place.secretsFile(), 'utf8');
  assert.equal(saved.split('\n').filter(line => line.startsWith('CALENDAR_GROUP')).length, 1, 'one line for the group');
  assert.ok(saved.includes("CALENDAR_GROUP_URL='" + secrets.newGroup + "'"));
  assertNoLeak(result, 'names');
});

test('when the values cannot be sent, they stay saved on the Mac with what was cleared, and a second try sends them and tidies the file', () => {
  const place = makePlace('form-retry', { secrets: macSecrets, computerEnv: computerEnv });
  place.stubFile('scp.exit', '1');
  const first = place.run(['2', 'k', 'c', 'k', '', '', 'q']);

  assert.ok(first.errors.includes('could not send the values to ' + computerAddress + ' (exit 1)'), first.errors);
  assert.ok(first.errors.includes('Nothing on the Teletraan computer changed.'));
  assert.ok(fs.readFileSync(place.secretsFile(), 'utf8').includes("MONDAY_API_TOKEN=''\n"), 'the clear waits in the saved file');
  assert.equal(fs.readFileSync(place.computerEnvFile(), 'utf8'), computerEnv, 'the Teletraan computer was not touched');
  assert.ok(!fs.existsSync(path.join(place.home, '.teletraan/stage')));
  assertNoLeak(first, 'first try');

  fs.rmSync(path.join(place.stub, 'scp.exit'));
  const second = place.run(['2', 'k', 'k', 'k', '', 'y', 'q']);
  assert.ok(second.text.includes('Monday token') && second.text.includes('cleared, not sent yet'), second.text);
  assert.ok(second.text.includes('Nothing changed.'));
  assert.ok(!fs.readFileSync(place.computerEnvFile(), 'utf8').includes('MONDAY_API_TOKEN'), 'the Teletraan computer lost the line');
  assert.ok(!fs.readFileSync(place.secretsFile(), 'utf8').includes('MONDAY_API_TOKEN'), 'the Mac forgot it after the Teletraan computer did');
  assertNoLeak(second, 'second try');
});

test('when ssh fails after the copy, the Mac keeps the values and says so, and no temporary file stays on the Mac', () => {
  const place = makePlace('form-ssh-down', { secrets: macSecrets, computerEnv: computerEnv });
  place.stubFile('ssh.exit', '255');
  const result = place.run(['2', 'e', secrets.newSanity, 'k', 'k', '', '', 'q']);

  assert.ok(result.errors.includes('could not reach ' + computerAddress), result.errors);
  assert.ok(result.text.includes('The values are saved on this Mac.'), result.text);
  assert.ok(fs.readFileSync(place.secretsFile(), 'utf8').includes(secrets.newSanity));
  assert.ok(!fs.existsSync(path.join(place.home, '.teletraan/stage')));
  assertNoLeak(result, 'ssh down');
});

test('the calendar service not being installed is said in plain words and the merge still happened', () => {
  const place = makePlace('form-no-service', { secrets: macSecrets, computerEnv: computerEnv });
  place.stubFile('systemctl.exit', '5');
  const result = place.run(['2', 'e', secrets.newSanity, 'k', 'k', '', '', 'q']);

  assert.ok(result.text.includes('The calendar service did not run. If it is not installed on this computer, run the install again (Install everything).'), result.text);
  assert.ok(fs.readFileSync(place.computerEnvFile(), 'utf8').includes(secrets.newSanity));
});

test('copying from the Teletraan computer asks first, replaces the saved values with the ones in local.env, and leaves out placeholders, odd values and other lines', () => {
  const env = [
    "SANITY_WRITE_TOKEN=\"" + secrets.oldSanity + "\"",
    'MONDAY_API_TOKEN=' + secrets.oldMonday,
    "TBA_AUTH_KEY='[paste the read key here]'",
    "CALENDAR_GROUP_URL='" + secrets.webcal + "'",
    "CALENDAR_Build_URL='" + secrets.oldBuild + "'",
    "CALENDAR_BAD_URL='http://insecure.example/ical?token=NOTSECURE0123'",
    "CALENDAR_TEAM_URL='[paste the iCal address of the team calendar here]'",
    "SANITY_WRITE_TOKEN='" + secrets.newSanity + "'",
    "TELETRAAN_PORT='3229'",
    '',
  ].join('\n');
  const place = makePlace('pull', { secrets: "TBA_AUTH_KEY='" + secrets.newTba + "'\n", computerEnv: env });

  const declined = place.run(['3', '', 'q']);
  assert.ok(declined.text.includes('Nothing changed.'));
  assert.equal(fs.readFileSync(place.secretsFile(), 'utf8'), "TBA_AUTH_KEY='" + secrets.newTba + "'\n", 'Return means no');
  assert.ok(!declined.calls.includes('grep'), 'nothing was asked of the Teletraan computer');

  const result = place.run(['3', 'y', 'q']);
  assert.equal(result.status, 0, result.errors);
  assert.equal(fs.readFileSync(place.secretsFile(), 'utf8'), [
    "SANITY_WRITE_TOKEN='" + secrets.newSanity + "'",
    "MONDAY_API_TOKEN='" + secrets.oldMonday + "'",
    "CALENDAR_GROUP_URL='" + secrets.stored + "'",
    "CALENDAR_Build_URL='" + secrets.oldBuild + "'",
    '',
  ].join('\n'));
  assert.equal(modeOf(place.secretsFile()), 0o600);
  assert.ok(result.text.includes('These lines on the Teletraan computer did not look like a key or a link and were left out: CALENDAR_BAD_URL'), result.text);
  assert.ok(!fs.existsSync(path.join(place.home, '.teletraan/pulled.tmp')), 'the temporary copy is removed');
  assert.ok(result.calls.includes("grep -E '^(SANITY_WRITE_TOKEN|MONDAY_API_TOKEN|TBA_AUTH_KEY|CONTROL_PIN|CALENDAR_[A-Za-z0-9_]+_URL)=' '" + place.computerRepo + "/computer/local.env'"), 'only the names it needs are asked for: ' + result.calls);
  assertNoLeak(result, 'pull');
  assert.ok(!result.text.includes('NOTSECURE0123'));
});

test('copying from the Teletraan computer changes nothing when the computer has none of them or cannot be reached', () => {
  const none = makePlace('pull-none', { secrets: macSecrets, computerEnv: "TELETRAAN_PORT='3229'\n" });
  const noneResult = none.run(['3', 'y', 'q']);
  assert.ok(noneResult.text.includes('Nothing changed.'), noneResult.text);
  assert.equal(fs.readFileSync(none.secretsFile(), 'utf8'), macSecrets);

  const down = makePlace('pull-down', { secrets: macSecrets, computerEnv: computerEnv });
  down.stubFile('ssh.exit', '255');
  const downResult = down.run(['3', 'y', 'q']);
  assert.ok(downResult.errors.includes('could not reach'), downResult.errors);
  assert.equal(fs.readFileSync(down.secretsFile(), 'utf8'), macSecrets);
  assert.ok(!fs.existsSync(path.join(down.home, '.teletraan/pulled.tmp')));
});

test('installing the services asks for the mentor\'s yes, then runs the eight install scripts in order and goes on after one stops', () => {
  const place = makePlace('install', { failInstall: 'monday' });
  const declined = place.run(['4', '', 'q']);
  assert.ok(declined.text.includes('Nothing was installed.'));
  assert.equal(declined.calls, '', 'Return means no, and nothing runs');

  const result = place.run(['4', 'y', 'q']);
  assert.equal(result.status, 0, result.errors);
  const ran = lines(result.text).filter(line => line.startsWith('ran ')).map(line => line.slice(4));
  assert.deepEqual(ran, installNames.map(name => 'install-' + name + '.sh'));
  assert.equal(lines(result.calls).filter(line => line.startsWith('sudo -S')).length, 1, 'one remote shell for all eight');
  assert.ok(result.text.includes('install-monday.sh stopped (exit 1).'), result.text);
  installNames.filter(name => name !== 'monday').forEach(name => assert.ok(result.text.includes('ran install-' + name + '.sh'), name));
});

test('status runs status-write.sh --print and check-calendars.sh on the Teletraan computer, and hides any key or address in what comes back', () => {
  const place = makePlace('status', { secrets: macSecrets });
  place.stubFile('status-output.txt', [
    'Last calendar sync        3 minutes ago (2026-10-10 13:50 UTC)',
    'a script that went wrong printed ' + secrets.oldSanity,
    '',
  ].join('\n'));
  place.stubFile('check-output.txt', [
    'SHOWN   team  Robotics meeting',
    'FAIL    group  download failed from ' + secrets.oldGroup + ' today',
    '',
  ].join('\n'));
  const result = place.run(['5', 'q']);

  assert.equal(result.status, 0, result.errors);
  assert.ok(result.calls.includes(place.computerRepo + '/computer/scripts/status-write.sh --print'), result.calls);
  assert.ok(result.calls.includes(place.computerRepo + '/computer/scripts/check-calendars.sh'), result.calls);
  assert.ok(result.text.includes('Last calendar sync        3 minutes ago'));
  assert.ok(result.text.includes('a script that went wrong printed (hidden)'), result.text);
  assert.ok(result.text.includes('download failed from (hidden) today'), result.text);
  assertNoLeak(result, 'status');

  const other = makePlace('status-address', { secrets: '' });
  other.stubFile('status-output.txt', 'No status yet.\n');
  other.stubFile('check-output.txt', 'FAIL    group  see https://api.band.us/ical?token=ANOTHERLINK0123 now\n');
  const otherResult = other.run(['5', 'q']);
  assert.ok(otherResult.text.includes('see (address hidden) now'), otherResult.text);
  assert.ok(!otherResult.text.includes('ANOTHERLINK0123'));
});

test('status points to menu 1 when the Teletraan computer has an older status-write.sh, and says when the computer cannot be reached', () => {
  const old = makePlace('status-old');
  old.stubFile('status-output.txt', 'Usage: status-write.sh content|calendar|slides|monday|frc|kiosk|calendar-status\n');
  old.stubFile('status.exit', '2');
  old.stubFile('check-output.txt', 'Node is not installed.\n');
  const oldResult = old.run(['5', 'q']);
  assert.ok(oldResult.text.includes('The Teletraan computer has an older status-write.sh. Choose 1 to update it.'), oldResult.text);

  const down = makePlace('status-down');
  down.stubFile('ssh.exit', '255');
  const downResult = down.run(['5', 'q']);
  assert.ok(downResult.errors.includes('could not reach'), downResult.errors);
});

test('restart runs the restart of the kiosk service with a terminal for the password, and reports a failure', () => {
  const place = makePlace('restart');
  const result = place.run(['6', 'q']);
  assert.equal(result.status, 0, result.errors);
  assert.ok(result.calls.includes("sudo -S -p '' bash -c 'systemctl restart \"$1\"' bash 'teletraan-kiosk.service'"), result.calls);
  assert.ok(result.text.includes('The screen restarted.'));

  const failing = makePlace('restart-fails');
  failing.stubFile('systemctl.exit', '1');
  assert.ok(failing.run(['6', 'q']).errors.includes('exit 1'));
});

test('a second computer is added from the menu, picked later, and the choice is remembered', () => {
  const place = makePlace('second-computer');
  const added = place.run(['7', 'a', 'hawktimus@teletraan-2.test', '', '7', '1', 'q']);
  assert.equal(added.status, 0, added.errors);
  assert.ok(added.text.includes('The Teletraan computer in use is spare.'), added.text);
  assert.ok(added.text.includes('The Teletraan computer in use is main.'), added.text);
  assert.equal(fs.readFileSync(place.configFile(), 'utf8').split('\n').filter(line => !line.startsWith('#')).join('\n'), 'current=main\nmini.main=' + computerAddress + '\nmini.spare=hawktimus@teletraan-2.test\n');

  place.run(['7', '2', 'q']);
  const later = place.run(['6', 'q']);
  assert.ok(later.text.includes('Teletraan computer in use: spare (hawktimus@teletraan-2.test)'), later.text);
  assert.ok(later.calls.includes(' hawktimus@teletraan-2.test sudo -S -p ') && later.calls.includes('systemctl restart'), later.calls);

  const duplicate = place.run(['7', 'a', 'hawktimus@teletraan-3.test', 'spare', 'q']);
  assert.ok(duplicate.errors.includes('there is a computer called spare already'), duplicate.errors);
});

test('a config file with a line that is not a name and an address is read without running anything in it', () => {
  const place = makePlace('config-odd', { config: 'current=main\nmini.main=' + computerAddress + '\nmini.bad name=x@y\nmini.evil=$(touch ' + path.join(work, 'evil') + ')@y\nsomething=else\n' });
  const result = place.run(['q']);
  assert.equal(result.status, 0, result.errors);
  assert.ok(result.text.includes('Teletraan computer in use: main'));
  assert.ok(!fs.existsSync(path.join(work, 'evil')), 'nothing in the file was run');
});

// The script that runs on the Teletraan computer, on its own
function merge(name, envText, incomingText, options = {}) {
  const root = path.join(work, 'merge-' + name);
  fs.mkdirSync(root, { recursive: true });
  const envFile = path.join(root, 'local.env');
  const incoming = path.join(root, 'incoming.env');
  if (envText !== null) fs.writeFileSync(envFile, envText, { mode: options.mode || 0o644 });
  fs.writeFileSync(incoming, incomingText);
  const result = spawnSync('/bin/sh', [mergeFile, envFile, incoming], { encoding: 'utf8', env: { PATH: systemPath } });
  return { text: result.stdout, errors: result.stderr, status: result.status, envFile: envFile, env: () => fs.readFileSync(envFile, 'utf8') };
}

test('merge-env.sh replaces matching names in place, adds new ones at the end, takes out empty ones and keeps every other line', () => {
  const result = merge('basic', computerEnv, [
    "SANITY_WRITE_TOKEN='NEWTOKENVALUE0123'",
    "MONDAY_API_TOKEN=''",
    "TBA_AUTH_KEY='NEWTBAKEYVALUE0123'",
    "CALENDAR_BUILD_URL=''",
    "CALENDAR_OUTREACH_URL='https://example.org/ical?token=OUTREACH0123'",
    "CALENDAR_NEVER_THERE_URL=''",
    '',
  ].join('\n'));

  assert.equal(result.status, 0, result.errors);
  assert.equal(result.env(), [
    '# Settings for the Teletraan computer',
    "TELETRAAN_PORT='3229'",
    "TELETRAAN_DATA='/var/lib/teletraan/data'",
    "CALENDAR_TEAM_URL='[paste the iCal address of the team calendar here]'",
    "SANITY_WRITE_TOKEN='NEWTOKENVALUE0123'",
    "TBA_AUTH_KEY='NEWTBAKEYVALUE0123'",
    "CALENDAR_GROUP_URL='" + secrets.oldGroup + "'",
    '',
    '# kept comment',
    "CALENDAR_OUTREACH_URL='https://example.org/ical?token=OUTREACH0123'",
    '',
  ].join('\n'));
  assert.deepEqual(lines(result.text.trim()), [
    'replaced SANITY_WRITE_TOKEN',
    'removed MONDAY_API_TOKEN',
    'replaced TBA_AUTH_KEY',
    'removed CALENDAR_BUILD_URL',
    'added CALENDAR_OUTREACH_URL',
    'CALENDAR_NEVER_THERE_URL was not there',
    'local.env is updated.',
  ]);
});

test('merge-env.sh leaves the file with mode 600, whatever mode it had, and prints no value', () => {
  const result = merge('mode', "SANITY_WRITE_TOKEN='OLDVALUEOLDVALUE'\n", "SANITY_WRITE_TOKEN='NEWVALUENEWVALUE'\n", { mode: 0o666 });
  assert.equal(result.status, 0, result.errors);
  assert.equal(modeOf(result.envFile), 0o600);
  assert.equal(fs.readdirSync(path.dirname(result.envFile)).sort().join(' '), 'incoming.env local.env', 'no temporary file is left');
  assert.ok(!result.text.includes('VALUE') && !result.errors.includes('VALUE'));
});

test('merge-env.sh keeps one line for a repeated name, takes the last new line, and handles a file with no final newline', () => {
  const result = merge('repeats', "A_COMMENT=1\nTBA_AUTH_KEY='one'\nSANITY_WRITE_TOKEN='x'\nTBA_AUTH_KEY='two'\nlast_line_without_newline", [
    "TBA_AUTH_KEY='first'",
    "TBA_AUTH_KEY='second'",
    '',
  ].join('\n'));
  assert.equal(result.status, 0, result.errors);
  assert.equal(result.env(), "A_COMMENT=1\nTBA_AUTH_KEY='second'\nSANITY_WRITE_TOKEN='x'\nlast_line_without_newline\n");
  assert.equal(result.text.split('\n').filter(line => line.includes('TBA_AUTH_KEY')).length, 1, 'one report line for the name');
});

test('merge-env.sh takes out a name written with empty quotes, double quotes or nothing after the sign', () => {
  const result = merge('empties', "SANITY_WRITE_TOKEN='a'\nMONDAY_API_TOKEN='b'\nTBA_AUTH_KEY='c'\nCALENDAR_X_URL='d'\n", "SANITY_WRITE_TOKEN=''\nMONDAY_API_TOKEN=\"\"\nTBA_AUTH_KEY=\n");
  assert.equal(result.status, 0, result.errors);
  assert.equal(result.env(), "CALENDAR_X_URL='d'\n");
});

test('merge-env.sh makes local.env when it is missing, and says so', () => {
  const result = merge('missing', null, "SANITY_WRITE_TOKEN='NEWVALUE0123456'\n");
  assert.equal(result.status, 0, result.errors);
  assert.ok(result.text.includes('local.env was not there'));
  assert.equal(result.env(), "SANITY_WRITE_TOKEN='NEWVALUE0123456'\n");
  assert.equal(modeOf(result.envFile), 0o600);
});

test('merge-env.sh refuses a line that is not a key or a calendar, changes nothing, and does not print the line', () => {
  const before = "TELETRAAN_PORT='3229'\nSANITY_WRITE_TOKEN='keepme'\n";
  ['TELETRAAN_PORT=\'1\'', 'SANITY_WRITE_TOKEN', 'export SANITY_WRITE_TOKEN=\'x\'', 'CALENDAR__URL=\'x\'', 'sanity_write_token=\'x\''].forEach((bad, index) => {
    const result = merge('bad-' + index, before, "SANITY_WRITE_TOKEN='fine'\n" + bad + '\n');
    assert.equal(result.status, 1, bad);
    assert.ok(result.errors.includes('Line 2 of the new values is not a key or a calendar'), result.errors);
    assert.ok(!result.errors.includes('fine') && !result.errors.includes('1'.repeat(3)), 'the line is not printed');
    assert.equal(result.env(), before, 'the file is not changed');
  });
});

test('merge-env.sh needs two arguments and a file of new lines', () => {
  const none = spawnSync('/bin/sh', [mergeFile], { encoding: 'utf8', env: { PATH: systemPath } });
  assert.equal(none.status, 2);
  assert.ok(none.stderr.includes('Usage:'));

  const missing = spawnSync('/bin/sh', [mergeFile, path.join(work, 'x.env'), path.join(work, 'does-not-exist')], { encoding: 'utf8', env: { PATH: systemPath } });
  assert.equal(missing.status, 1);
  assert.ok(missing.stderr.includes('did not arrive'));
});

function stripComments(text) {
  return text.split('\n').filter(line => !/^\s*#/.test(line)).join('\n');
}

test('the three files are executable, have valid syntax, and the tool starts with set -u', () => {
  [toolFile, mergeFile, commandFile].forEach(file => {
    assert.ok((fs.statSync(file).mode & 0o111) !== 0, path.basename(file) + ' should be executable');
  });
  assert.equal(spawnSync('/bin/bash', ['-n', toolFile], { encoding: 'utf8' }).status, 0, 'teletraan-tool has valid bash syntax');
  assert.equal(spawnSync('/bin/bash', ['-n', commandFile], { encoding: 'utf8' }).status, 0);
  assert.equal(spawnSync('/bin/sh', ['-n', mergeFile], { encoding: 'utf8' }).status, 0, 'merge-env.sh has valid sh syntax');

  const tool = textOf(toolFile);
  assert.ok(tool.startsWith('#!/bin/bash\n'));
  assert.ok(/^set -u$/m.test(tool), 'set -u');
  assert.ok(fs.readFileSync(mergeFile, 'utf8').startsWith('#!/bin/sh\n'));
  assert.ok(/set -eu/.test(fs.readFileSync(mergeFile, 'utf8')));

  const command = fs.readFileSync(commandFile, 'utf8');
  assert.ok(command.startsWith('#!/bin/bash\n') && command.includes('./teletraan-tool'), 'the .command file runs the tool');
});

test('the tool runs on the bash 3.2 of macOS: none of the newer features are used', () => {
  const code = stripComments(textOf(toolFile));
  [/declare -A/, /\bmapfile\b/, /\breadarray\b/, /\$\{[A-Za-z_]+(,,|\^\^)\}/, /\|&/, /&>>/, /\bcoproc\b/, /\[\[ .* =~ /, /read [^\n]*-i /].forEach(pattern => {
    assert.ok(!pattern.test(code), 'uses ' + pattern);
  });
});

test('the tool never evaluates text, never reads a secrets file on this Mac with the shell, and quotes the values it moves', () => {
  const code = stripComments(textOf(toolFile));
  const here = code.replace(/<<'EOF'\n[\s\S]*?\nEOF\n/g, '').replace(/stty echo/g, '');
  assert.ok(!/\beval\b/.test(code), 'no eval');
  const sourced = code.split('\n').filter(line => /^\s*(source|\.) /.test(line));
  assert.deepEqual(sourced, ['  source "$here/teletraan-tool-$part.sh"'], 'the tool sources only its own parts, never a secrets file');
  assert.ok(!/\becho\b/.test(here), 'only say and printf print on this Mac');
  assert.ok(!/ssh[^\n]*\$\{?(clean_value|key_values|cal_values|answer)/.test(code), 'no value goes on an ssh command line');
  assert.ok(!/scp[^\n]*\$\{?(clean_value|key_values|cal_values|answer)/.test(code), 'no value goes on an scp command line');
  // A value is printed through mask, or piped into grep, or written to the saved file
  const printing = code.split('\n').filter(line => /(say|printf)[^\n]*\$\{?(key_values|cal_values|clean_value)\b/.test(line.replace(/\$\(mask [^)]*\)\)?/g, '')));
  printing.forEach(line => assert.ok(/\| grep -Eq/.test(line) || line.includes('printf "%s=\'%s\'\\n"'), 'a value is printed: ' + line.trim()));
  assert.ok(!/\$HOME\/(?!\.teletraan)/.test(code), 'the tool writes only in ~/.teletraan');
});

test('docs/updating-the-computer.md is written around the tool, and the other docs point to it', () => {
  const doc = fs.readFileSync(path.join(repo, 'docs/updating-the-computer.md'), 'utf8');
  ['Teletraan Tool.command', 'tools/teletraan/teletraan-tool', '~/.teletraan/secrets.env', '~/.teletraan/config', 'SANITY_WRITE_TOKEN', 'MONDAY_API_TOKEN', 'TBA_AUTH_KEY', 'CALENDAR_<ID>_URL', 'status-write.sh --print', 'check-calendars.sh', 'webcal://', 'rsync'].forEach(word => {
    assert.ok(doc.includes(word), 'docs/updating-the-computer.md should mention ' + word);
  });
  ['Update the Teletraan computer', 'Keys and calendars', 'Copy the computer', 'Install the services', 'Status of the Teletraan computer', 'Restart the screen', 'Choose another computer'].forEach(word => {
    assert.ok(doc.includes(word), 'docs/updating-the-computer.md should name the menu choice ' + word);
  });

  const rebuild = fs.readFileSync(path.join(repo, 'docs/rebuilding-the-computer.md'), 'utf8');
  assert.ok(rebuild.includes('docs/updating-the-computer.md'), 'the rebuild doc points to the tool for keys');
  ['README.md', 'computer/README.md', 'docs/shipping-from-the-mac.md', 'docs/try-it-on-the-computer.md'].forEach(file => {
    assert.ok(fs.readFileSync(path.join(repo, file), 'utf8').includes('updating-the-computer.md'), file + ' points to docs/updating-the-computer.md');
  });
});

function markdownFiles(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).reduce((files, entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) return files.concat(markdownFiles(full));
    return entry.name.endsWith('.md') ? files.concat(full) : files;
  }, []);
}

test('no doc or README still names the old update-computer.sh, and the new doc and the tool files have the team\'s plain style', () => {
  const files = markdownFiles(path.join(repo, 'docs')).concat([path.join(repo, 'README.md'), path.join(repo, 'computer/README.md')]);
  files.forEach(file => assert.ok(!fs.readFileSync(file, 'utf8').includes('update-computer'), path.relative(repo, file) + ' names update-computer.sh'));

  const filler = /\b(simply|just|basically|really|very|actually|easily|seamless|robust|leverage|ensure|comprehensive)\b/i;
  const written = ['docs/updating-the-computer.md', 'tools/teletraan/teletraan-tool', 'tools/teletraan/merge-env.sh', 'tools/teletraan/Teletraan Tool.command'];
  written.forEach(file => {
    const text = fs.readFileSync(path.join(repo, file), 'utf8');
    assert.ok(!/[\u2013\u2014]/.test(text), file + ' has an em or en dash');
    assert.ok(!filler.test(text), file + ' has a filler word');
    assert.ok(!/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(text), file + ' has an emoji');
  });
  assert.ok(!fs.readFileSync(path.join(repo, 'docs/updating-the-computer.md'), 'utf8').includes('!'), 'no exclamation mark in the doc');
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
