// Tests for deploy/scripts/check-calendars.sh and the Node file beside it. curl
// is replaced with a small fake one in a temporary folder, so nothing touches
// the network, and the calendar addresses in the test are made up. Node is the
// real one, because the script depends on the dashboard's own calendar code.
//
//   node tools/test-calendars-script.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const scriptFile = path.join(repo, 'deploy/scripts/check-calendars.sh');
const helperFile = path.join(repo, 'deploy/scripts/check-calendars.mjs');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-calendars-'));

// The tools the script needs that are not the ones being faked
const ordinaryTools = ['sed', 'tail', 'tr', 'grep', 'mktemp', 'rm', 'dirname', 'cat', 'cp'];

function findTool(name) {
  const found = spawnSync('/bin/sh', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
  assert.ok(found, 'this computer has no ' + name);
  return found;
}

// A fake curl. It writes each call it gets to calls.log, but never an address
// of a calendar: those arrive on standard input, and only the start of one
// (https) is logged. Sanity is answered from sanity.json in the stub folder. A
// calendar address ends in SECRET-<id>. The answer is <id>.ics, or, when
// <id>.exit exists, a failure that prints the address on standard error the
// way a real curl can.
const fakeCurl = `#!/bin/sh
echo "curl $*" >> "$STUB_LOG"
output=""
previous=""
for argument in "$@"; do
  [ "$previous" = --output ] && output=$argument
  previous=$argument
done

case $argument in
  https://*.api.sanity.io/*)
    [ -f "$STUB_DIR/sanity.exit" ] && exit "$(cat "$STUB_DIR/sanity.exit")"
    cp "$STUB_DIR/sanity.json" "$output"
    exit 0
    ;;
esac

address=$(sed -n 's/^url = "\\(.*\\)"$/\\1/p')
echo "calendar address starts with \${address%%:*}" >> "$STUB_LOG"
id=\${address##*SECRET-}
if [ -f "$STUB_DIR/$id.exit" ]; then
  echo "curl: (22) The requested URL returned error: 404 $address" >&2
  exit "$(cat "$STUB_DIR/$id.exit")"
fi
cp "$STUB_DIR/$id.ics" "$output"
`;

// Makes a copy of the deploy scripts to run in, with the dashboard folder
// linked in beside it (the Node file reads the dashboard's code), a folder of
// tools to run with, and returns how to run the script.
function setup(name, options) {
  const root = path.join(work, name);
  const bin = path.join(root, 'bin');
  const stub = path.join(root, 'stub');
  fs.mkdirSync(path.join(root, 'deploy/scripts'), { recursive: true });
  fs.mkdirSync(bin);
  fs.mkdirSync(stub);

  fs.copyFileSync(scriptFile, path.join(root, 'deploy/scripts/check-calendars.sh'));
  fs.copyFileSync(helperFile, path.join(root, 'deploy/scripts/check-calendars.mjs'));
  fs.symlinkSync(path.join(repo, 'dashboard'), path.join(root, 'dashboard'));
  if (options.localEnv) fs.writeFileSync(path.join(root, 'deploy/local.env'), options.localEnv);

  ordinaryTools.forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));
  if (options.node !== false) fs.symlinkSync(process.execPath, path.join(bin, 'node'));
  if (options.curl !== false) fs.writeFileSync(path.join(bin, 'curl'), fakeCurl, { mode: 0o755 });

  Object.keys(options.files || {}).forEach(file => {
    fs.writeFileSync(path.join(stub, file), options.files[file]);
  });

  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');

  return {
    log: log,
    run() {
      const env = { PATH: bin, STUB_LOG: log, STUB_DIR: stub };
      const result = spawnSync('/bin/sh', [path.join(root, 'deploy/scripts/check-calendars.sh')], { env: env, encoding: 'utf8', input: '' });
      const text = result.stdout + result.stderr;
      return {
        lines: result.stdout.split('\n').filter(line => line !== ''),
        text: text,
        status: result.status,
        calls: fs.readFileSync(log, 'utf8'),
      };
    },
  };
}

// Dates are made from today, so the tests do not go out of date. Noon in UTC
// is the early morning in New York, on the same date.
function noon(daysFromToday) {
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + daysFromToday, 12));
}

function weekday(daysFromToday) {
  return noon(daysFromToday).getUTCDay();
}

function stamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace('.000', '');
}

function calendarText(events) {
  const parts = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Teletraan test//EN'];
  events.forEach((event, index) => {
    parts.push('BEGIN:VEVENT', 'UID:event-' + index, 'DTSTART:' + stamp(noon(event.day)), 'DTEND:' + stamp(new Date(noon(event.day).getTime() + 3600000)));
    if (event.rule) parts.push('RRULE:' + event.rule);
    parts.push('SUMMARY:' + event.title, 'END:VEVENT');
  });
  parts.push('END:VCALENDAR');
  return parts.join('\r\n') + '\r\n';
}

const groupCalendar = calendarText([
  { day: 2, title: 'Team meeting' },
  { day: 1, title: 'Pre-Season Meeting', rule: 'FREQ=DAILY;COUNT=4' },
  { day: 1, title: 'Pre-Season Kickoff' },
  { day: 5, title: 'Food drive' },
  { day: 45, title: 'Far away' },
]);

const outreachCalendar = calendarText([
  { day: 5, title: 'Food drive' },
  { day: 2, title: 'Pre-Season Meeting' },
]);

// The rules, as Sanity sends them. Pre-Season is hidden on the weekdays of
// tomorrow and the day after, so two of the four daily meetings go. The
// Kickoff rule shows the one that is tomorrow's.
const rules = [
  { name: 'Hide Pre-Season', action: 'hide', words: ['pre-season'], days: [weekday(1), weekday(2)] },
  { name: 'Always show Kickoff', action: 'show', words: ['Kickoff'] },
  { name: 'Hide Food drive in group', action: 'hide', words: ['food drive'], calendar: 'group' },
  { name: 'Hide Team meeting', action: 'hide', words: ['Team meeting'], show: false },
];

const sanityAnswer = JSON.stringify({
  query: 'the content query',
  result: {
    calendarFilters: rules,
    settings: {
      calendars: [
        { id: 'group', name: 'Group', show: true },
        { id: 'outreach', name: 'Outreach', show: false },
      ],
    },
  },
});

const goodFiles = { 'sanity.json': sanityAnswer, 'group.ics': groupCalendar, 'outreach.ics': outreachCalendar, 'gears.ics': calendarText([]) };

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

function linesFor(result, word, id) {
  return result.lines.filter(line => line.startsWith(word.padEnd(8) + id + '  '));
}

test('every event of the next 30 days is SHOWN or HIDDEN with the rule that hid it, and each calendar ends with its counts', () => {
  const place = setup('good', {
    localEnv: [
      "TELETRAAN_PORT='8080'",
      "CALENDAR_GROUP_URL='webcal://band.example/ical?token=SECRET-group'",
      "CALENDAR_OUTREACH_URL='https://band.example/ical?token=SECRET-outreach'",
      "CALENDAR_GEARS_URL='https://band.example/ical?token=SECRET-gears'",
      '',
    ].join('\n'),
    files: goodFiles,
  });
  const result = place.run();

  assert.equal(result.status, 0, result.text);

  const hidden = linesFor(result, 'HIDDEN', 'group');
  assert.equal(hidden.length, 3, result.text);
  assert.equal(hidden.filter(line => line.endsWith('Pre-Season Meeting  (hidden by Hide Pre-Season)')).length, 2, 'words are matched in any case');
  assert.equal(hidden.filter(line => line.endsWith('Food drive  (hidden by Hide Food drive in group)')).length, 1);

  const shown = linesFor(result, 'SHOWN', 'group');
  assert.equal(shown.length, 4, result.text);
  assert.ok(shown.some(line => line.endsWith('Pre-Season Kickoff')), 'an Always show rule wins');
  assert.ok(shown.some(line => line.endsWith('Team meeting')), 'a rule that is off does nothing');
  assert.ok(!result.text.includes('Far away'), 'an event after 30 days is not listed');

  assert.deepEqual(linesFor(result, 'TOTAL', 'group'), ['TOTAL   group  4 shown, 3 hidden']);

  assert.equal(linesFor(result, 'SHOWN', 'outreach').length, 1, 'the Food drive rule is only for the group calendar');
  assert.equal(linesFor(result, 'HIDDEN', 'outreach').length, 1);
  assert.deepEqual(linesFor(result, 'TOTAL', 'outreach'), ['TOTAL   outreach  1 shown, 1 hidden']);
  assert.ok(linesFor(result, 'NOTE', 'outreach')[0].includes('switched off'));

  assert.deepEqual(linesFor(result, 'TOTAL', 'gears'), ['TOTAL   gears  0 shown, 0 hidden']);
  assert.ok(linesFor(result, 'NOTE', 'gears')[0].includes('no row'));
});

test('the rules are read from Sanity without a login, at the project, dataset and version in config.js', () => {
  const place = setup('sanity', {
    localEnv: "CALENDAR_GROUP_URL='https://band.example/ical?token=SECRET-group'\n",
    files: goodFiles,
  });
  const result = place.run();
  const config = fs.readFileSync(path.join(repo, 'dashboard/config.js'), 'utf8');
  const project = config.match(/projectId: '([^']*)'/)[1];
  const dataset = config.match(/dataset: '([^']*)'/)[1];
  const version = config.match(/apiVersion: '([^']*)'/)[1];

  assert.equal(result.status, 0, result.text);
  assert.ok(result.calls.includes('https://' + project + '.api.sanity.io/v' + version + '/data/query/' + dataset + '?query='), result.calls);
  assert.ok(result.calls.includes('perspective=published'));
  assert.ok(!/authorization|bearer|token/i.test(result.calls.replace(/SECRET/g, '')), 'no login is sent');
});

test('a calendar address is never printed or put on a command line, even when its download fails', () => {
  const place = setup('secret', {
    localEnv: [
      "CALENDAR_GROUP_URL='webcal://band.example/ical?token=SECRET-group'",
      "CALENDAR_BOOSTERS_URL='https://band.example/ical?token=SECRET-boosters'",
      "CALENDAR_DEADLINES_URL='https://band.example/ical?token=SECRET-deadlines'",
      "CALENDAR_OLD_URL='http://band.example/ical?token=SECRET-old'",
      '',
    ].join('\n'),
    files: Object.assign({ 'boosters.exit': '22', 'deadlines.exit': '6' }, goodFiles),
  });
  const result = place.run();

  assert.equal(result.status, 1);
  assert.deepEqual(linesFor(result, 'FAIL', 'boosters'), ['FAIL    boosters  download failed, the server said no, so the address may be wrong or expired']);
  assert.deepEqual(linesFor(result, 'FAIL', 'deadlines'), ['FAIL    deadlines  download failed, could not find the server, so the network may be down']);
  assert.equal(linesFor(result, 'FAIL', 'old').length, 1, 'an http:// address is refused');
  assert.equal(linesFor(result, 'TOTAL', 'group').length, 1, 'a failed calendar does not stop the others');

  assert.ok(!/SECRET|band\.example|token/i.test(result.text), 'no address in the output\n' + result.text);
  assert.ok(!/SECRET|band\.example|token/i.test(result.calls), 'no address on any command line\n' + result.calls);
});

test('a webcal:// address is turned into https:// and an http:// address is not downloaded at all', () => {
  const place = setup('schemes', {
    localEnv: [
      "CALENDAR_GROUP_URL='webcal://band.example/ical?token=SECRET-group'",
      "CALENDAR_OLD_URL='http://band.example/ical?token=SECRET-old'",
      '',
    ].join('\n'),
    files: goodFiles,
  });
  const result = place.run();

  assert.equal(result.calls.match(/calendar address starts with/g).length, 1, 'only one address was sent to curl');
  assert.ok(result.calls.includes('calendar address starts with https'));
  assert.ok(!result.calls.includes('starts with webcal') && !result.calls.includes('starts with http\n'));
  assert.ok(result.calls.includes('--proto =https'), 'curl is limited to https');
});

test('a download that is not a calendar is reported by its code, and a line that still holds a placeholder is skipped', () => {
  const place = setup('not-a-calendar', {
    localEnv: [
      "CALENDAR_GROUP_URL='https://band.example/ical?token=SECRET-group'",
      "CALENDAR_GEARS_URL='[paste the iCal address of the gears calendar here]'",
      '',
    ].join('\n'),
    files: Object.assign({}, goodFiles, { 'group.ics': '<html>Sign in</html>\n' }),
  });
  const result = place.run();

  assert.equal(result.status, 1);
  assert.deepEqual(linesFor(result, 'FAIL', 'group'), ['FAIL    group  the download is not a complete calendar']);
  assert.deepEqual(linesFor(result, 'SKIP', 'gears'), ['SKIP    gears  no address set yet']);
  assert.ok(!result.text.includes('Sign in'), 'what the server sent is not printed');
});

test('when Sanity cannot be read nothing is checked and the script says so', () => {
  const localEnv = "CALENDAR_GROUP_URL='https://band.example/ical?token=SECRET-group'\n";

  [{ 'sanity.exit': '6' }, { 'sanity.json': '<html>Not the content</html>' }].forEach((files, index) => {
    const place = setup('no-sanity-' + index, { localEnv: localEnv, files: Object.assign({}, goodFiles, files) });
    const result = place.run();

    assert.equal(result.status, 1, result.text);
    assert.ok(result.text.includes('Could not read the Calendar filters from Sanity'), result.text);
    assert.ok(!result.calls.includes('calendar address'), 'no calendar was downloaded');
  });
});

test('a missing local.env, no calendar lines, no curl and no node each end with a plain message', () => {
  const noFile = setup('no-env', { files: goodFiles }).run();
  assert.equal(noFile.status, 1);
  assert.ok(noFile.text.includes('No local.env'));

  const noLines = setup('no-lines', { localEnv: "TELETRAAN_PORT='8080'\n", files: goodFiles }).run();
  assert.equal(noLines.status, 0);
  assert.ok(noLines.text.includes('nothing to check'));

  const localEnv = "CALENDAR_GROUP_URL='https://band.example/ical?token=SECRET-group'\n";
  const noCurl = setup('no-curl', { localEnv: localEnv, curl: false }).run();
  assert.equal(noCurl.status, 1);
  assert.ok(noCurl.text.includes('curl is not installed'));

  const noNode = setup('no-node', { localEnv: localEnv, node: false }).run();
  assert.equal(noNode.status, 1);
  assert.ok(noNode.text.includes('Node is not installed'));
  assert.ok(!/SECRET|band\.example/.test(noNode.text));
});

test('the script has valid sh syntax, is executable, and never prints local.env', () => {
  const syntax = spawnSync('/bin/sh', ['-n', scriptFile], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);

  const text = fs.readFileSync(scriptFile, 'utf8');
  assert.ok(text.startsWith('#!/bin/sh\n'));
  assert.ok((fs.statSync(scriptFile).mode & 0o111) !== 0, 'the script should be executable');
  assert.ok(!/\bcat\b[^\n]*local\.env/.test(text), 'local.env is never printed');
  assert.ok(!/^\s*set -[a-z]*x/m.test(text), 'set -x would print every address');
  const printsUrl = text.split('\n').filter(line => /\b(echo|printf|say)\b/.test(line) && /\$\{?url/.test(line));
  assert.equal(printsUrl.length, 1, 'the address is only given to curl');
  assert.ok(printsUrl[0].trim().endsWith('|'), 'and it goes in on standard input');

  const helper = fs.readFileSync(helperFile, 'utf8');
  assert.ok(!/local\.env|CALENDAR_/.test(helper), 'the Node file never sees an address');
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
