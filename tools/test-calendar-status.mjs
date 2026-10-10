// Tests for what the Mini writes for the Calendars page in Studio: the sync file that
// deploy/scripts/fetch-calendars.sh leaves, the document that calendar-status.sh and
// calendar-status.mjs make from it, and status-write.sh calendar-status, which sends it. curl
// is replaced with a small fake one in a temporary folder, so nothing touches the network, and
// the calendar addresses, the token and the project in the test are made up. Node is the real
// one, because the events are listed by the dashboard's own calendar code.
//
//   node tools/test-calendar-status.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const scripts = ['fetch-calendars.sh', 'calendar-status.sh', 'calendar-status.mjs', 'status-write.sh'];
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-calendar-status-'));

// The tools the scripts need that are not the ones being faked
const ordinaryTools = ['sed', 'tail', 'head', 'tr', 'grep', 'mktemp', 'rm', 'mv', 'cp', 'cat', 'chmod', 'find', 'mkdir', 'dirname', 'date', 'awk', 'wc'];

function findTool(name) {
  const found = spawnSync('/bin/sh', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
  assert.ok(found, 'this computer has no ' + name);
  return found;
}

// A fake curl. It writes each call it gets to calls.log, but never what comes in on standard
// input: that is a calendar address or the token. A calendar address ends in SECRET-<id>. The
// answer is <id>.ics, or, when <id>.exit exists, a failure that prints the address on standard
// error the way a real curl can. Sanity is answered from sanity.json, or fails with the code in
// sanity.exit. A write saves its body in last-body.json and fails with the code in mutate.exit.
const fakeCurl = `#!/bin/sh
echo "curl $*" >> "$STUB_LOG"
output=""
body=""
address=""
previous=""
for argument in "$@"; do
  [ "$previous" = --output ] && output=$argument
  [ "$previous" = --data ] && body=$argument
  case $argument in https://*) address=$argument ;; esac
  previous=$argument
done

case $address in
  */data/mutate/*)
    case " $* " in *" --config - "*) cat > "$STUB_DIR/last-config.txt" ;; esac
    printf '%s' "$body" > "$STUB_DIR/last-body.json"
    [ -f "$STUB_DIR/mutate.exit" ] && exit "$(cat "$STUB_DIR/mutate.exit")"
    exit 0
    ;;
  https://*.api.sanity.io/*)
    [ -f "$STUB_DIR/sanity.exit" ] && exit "$(cat "$STUB_DIR/sanity.exit")"
    cp "$STUB_DIR/sanity.json" "$output"
    exit 0
    ;;
esac

address=$(sed -n 's/^url = "\\(.*\\)"$/\\1/p')
id=\${address##*SECRET-}
if [ -f "$STUB_DIR/$id.exit" ]; then
  echo "curl: (22) The requested URL returned error: 404 $address" >&2
  exit "$(cat "$STUB_DIR/$id.exit")"
fi
cp "$STUB_DIR/$id.ics" "$output"
`;

const token = 'skTESTtoken0123456789abcdef';

// Makes a copy of the scripts to run in, with the dashboard folder linked in beside it (the Node
// file reads the dashboard's code), a data folder, a folder of tools to run with, and returns how
// to run each script.
function setup(name, options) {
  const root = path.join(work, name);
  const bin = path.join(root, 'bin');
  const stub = path.join(root, 'stub');
  const data = path.join(root, 'data');
  fs.mkdirSync(path.join(root, 'deploy/scripts'), { recursive: true });
  fs.mkdirSync(bin);
  fs.mkdirSync(stub);
  fs.mkdirSync(data);

  scripts.forEach(file => {
    fs.copyFileSync(path.join(repo, 'deploy/scripts', file), path.join(root, 'deploy/scripts', file));
    fs.chmodSync(path.join(root, 'deploy/scripts', file), fs.statSync(path.join(repo, 'deploy/scripts', file)).mode);
  });
  fs.symlinkSync(path.join(repo, 'dashboard'), path.join(root, 'dashboard'));

  const lines = ["TELETRAAN_DATA='" + data + "'"].concat(options.localEnv || [], options.token === false ? [] : ["SANITY_WRITE_TOKEN='" + token + "'"]);
  fs.writeFileSync(path.join(root, 'deploy/local.env'), lines.join('\n') + '\n');

  ordinaryTools.forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));
  if (options.oldNode !== undefined) fs.writeFileSync(path.join(bin, 'node'), '#!/bin/sh\necho "node $*" >> "$STUB_LOG"\n[ "$1" = --version ] && echo ' + options.oldNode + '\nexit 0\n', { mode: 0o755 });
  else if (options.node !== false) fs.symlinkSync(process.execPath, path.join(bin, 'node'));
  fs.writeFileSync(path.join(bin, 'curl'), fakeCurl, { mode: 0o755 });

  Object.keys(options.files || {}).forEach(file => {
    fs.writeFileSync(path.join(stub, file), options.files[file]);
  });
  Object.keys(options.calendars || {}).forEach(file => {
    fs.mkdirSync(path.join(data, 'calendars'), { recursive: true });
    fs.writeFileSync(path.join(data, 'calendars', file), options.calendars[file]);
  });
  if (options.sync !== undefined) fs.writeFileSync(path.join(data, 'calendar-sync.txt'), options.sync);

  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');

  return {
    root: root,
    data: data,
    stub: stub,
    run(script, args) {
      const env = { PATH: bin, STUB_LOG: log, STUB_DIR: stub, TZ: 'America/New_York' };
      const result = spawnSync('/bin/sh', [path.join(root, 'deploy/scripts', script)].concat(args || []), { env: env, encoding: 'utf8', input: '' });
      return { text: result.stdout, errors: result.stderr, status: result.status, calls: fs.readFileSync(log, 'utf8') };
    },
    read(file) {
      return fs.readFileSync(path.join(data, file), 'utf8');
    },
    has(file) {
      return fs.existsSync(path.join(data, file));
    },
    document() {
      return JSON.parse(fs.readFileSync(path.join(data, 'calendar-status.json'), 'utf8'));
    },
    sent() {
      return JSON.parse(fs.readFileSync(path.join(stub, 'last-body.json'), 'utf8'));
    },
    sentAny() {
      return fs.existsSync(path.join(stub, 'last-body.json'));
    },
  };
}

// Dates are made from today, so the tests do not go out of date. Noon in UTC is the early
// morning in New York, on the same date.
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
    parts.push('BEGIN:VEVENT', 'UID:event-' + index);
    if (event.allDay) {
      parts.push('DTSTART;VALUE=DATE:' + stamp(noon(event.day)).slice(0, 8));
    } else {
      parts.push('DTSTART:' + stamp(noon(event.day)), 'DTEND:' + stamp(new Date(noon(event.day).getTime() + 3600000)));
    }
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
  { day: 3, title: 'Open house', allDay: true },
]);

// The rules, as Sanity sends them. Pre-Season is hidden on the weekdays of tomorrow and the day
// after, so two of the four daily meetings go. The Kickoff rule shows the one that is tomorrow's.
const rules = [
  { name: 'Hide Pre-Season', action: 'hide', words: ['pre-season'], days: [weekday(1), weekday(2)] },
  { name: 'Always show Kickoff', action: 'show', words: ['Kickoff'] },
  { name: 'Hide Food drive in group', action: 'hide', words: ['food drive'], calendar: 'group' },
  { name: 'Hide Team meeting', action: 'hide', words: ['Team meeting'], show: false },
];

const sanityAnswer = JSON.stringify({ query: 'the content query', result: { calendarFilters: rules, settings: { calendars: [{ id: 'group', name: 'Group', show: true }] } } });

const secretEnv = [
  "CALENDAR_GROUP_URL='webcal://band.example/ical?token=SECRET-group'",
  "CALENDAR_OUTREACH_URL='https://band.example/ical?token=SECRET-outreach'",
];

const goodFiles = { 'sanity.json': sanityAnswer, 'group.ics': groupCalendar, 'outreach.ics': outreachCalendar };

const time = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

// The fields of the Studio schema, read from the file, so a field the Mini writes and the Studio
// does not have is caught here
function schemaNames() {
  const text = fs.readFileSync(path.join(repo, 'studio/schemas/calendarStatus.js'), 'utf8');
  const names = Array.from(text.matchAll(/defineField\(\{ name: '(\w+)'/g)).map(match => match[1]);
  return new Set(names);
}

function assertNoAddress(text, label) {
  assert.ok(!/SECRET|band\.example|token=/i.test(text), 'an address is in ' + label + '\n' + text);
}

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

test('fetch-calendars.sh leaves a line for each calendar: its code, when it was last downloaded, and why the last try failed', () => {
  const place = setup('sync', { localEnv: secretEnv, files: goodFiles });
  const before = Date.now() - 2000;
  const result = place.run('fetch-calendars.sh');

  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(result.text.trim().split('\n'), ['calendar group: updated', 'calendar outreach: updated']);

  const lines = place.read('calendar-sync.txt').trim().split('\n');
  assert.equal(lines.length, 2);
  lines.forEach((line, index) => {
    const parts = line.split('|');
    assert.equal(parts.length, 3, line);
    assert.equal(parts[0], ['group', 'outreach'][index]);
    assert.match(parts[1], time);
    assert.ok(Date.parse(parts[1]) >= before - 1000 && Date.parse(parts[1]) <= Date.now() + 2000, 'the time is now: ' + parts[1]);
    assert.equal(parts[2], '', 'no reason when the download worked');
  });
  assertNoAddress(place.read('calendar-sync.txt'), 'the sync file');
});

test('a failed download keeps the time of the last good one and says why, and the old calendar file stays', () => {
  const place = setup('failed', {
    localEnv: secretEnv.concat("CALENDAR_BOOSTERS_URL='https://band.example/ical?token=SECRET-boosters'", "CALENDAR_OLD_URL='http://band.example/ical?token=SECRET-old'", "CALENDAR_PAGE_URL='https://band.example/ical?token=SECRET-page'"),
    files: Object.assign({ 'boosters.exit': '22', 'page.ics': '<html>Sign in</html>\n' }, goodFiles),
    calendars: { 'group.ics': 'BEGIN:VCALENDAR\nEND:VCALENDAR\n' },
    sync: ['group|2026-10-01T10:00:00Z|', 'boosters|2026-10-02T11:30:00Z|', 'page||', ''].join('\n'),
  });
  fs.writeFileSync(path.join(place.stub, 'group.exit'), '28');
  const result = place.run('fetch-calendars.sh');

  assert.equal(result.status, 1, 'a failing exit shows up in systemctl status');
  const lines = place.read('calendar-sync.txt').trim().split('\n');
  assert.deepEqual(lines, [
    'group|2026-10-01T10:00:00Z|download failed, the server took too long to answer',
    lines[1],
    'boosters|2026-10-02T11:30:00Z|download failed, the server said no, so the address may be wrong or expired',
    'old||the address starts with http://, which is not secure. Use the https:// address',
    'page||the download is not a complete calendar',
  ]);
  assert.match(lines[1], /^outreach\|\d{4}-.*Z\|$/, 'a calendar that worked is not marked as failed');
  assert.ok(place.read('calendars/group.ics').includes('BEGIN:VCALENDAR\nEND:VCALENDAR'), 'a failed download leaves the old file alone');

  assert.ok(result.errors.includes('calendar boosters: download failed, the server said no, so the address may be wrong or expired. Keeping the old file.'), result.errors);
  assert.ok(result.errors.includes('calendar old: the address starts with http://, which is not secure. Use the https:// address.'), result.errors);
  assert.ok(result.errors.includes('calendar page: the download is not a complete calendar. Keeping the old file.'), result.errors);
  assertNoAddress(place.read('calendar-sync.txt'), 'the sync file');
  assertNoAddress(result.text + result.errors, 'what the script printed');
  assertNoAddress(result.calls, 'the command lines of curl');
});

test('a line that still holds a placeholder says there is no address yet, and no CALENDAR lines at all leave an empty sync file', () => {
  const place = setup('placeholder', {
    localEnv: ["CALENDAR_GEARS_URL='[paste the iCal address of the gears calendar here]'"],
    files: goodFiles,
    sync: 'gears|2026-10-03T09:00:00Z|\n',
  });
  const result = place.run('fetch-calendars.sh');
  assert.equal(result.status, 0, result.errors);
  assert.ok(result.text.includes('calendar gears: no address set yet, skipped'));
  assert.equal(place.read('calendar-sync.txt'), 'gears|2026-10-03T09:00:00Z|no address set yet\n', 'the earlier good time is kept');

  const none = setup('no-lines', { localEnv: [], files: goodFiles, sync: 'group|2026-10-03T09:00:00Z|\n' });
  const second = none.run('fetch-calendars.sh');
  assert.equal(second.status, 0, second.errors);
  assert.ok(second.text.includes('nothing to download'));
  assert.equal(none.read('calendar-sync.txt'), '', 'a calendar that was taken out of local.env is taken out of the file');
});

test('the sync file is made like a download and nothing is left behind, even when every download fails', () => {
  const place = setup('leftovers', { localEnv: secretEnv, files: Object.assign({ 'group.exit': '6', 'outreach.exit': '7' }, goodFiles) });
  const result = place.run('fetch-calendars.sh');

  assert.equal(result.status, 1);
  assert.equal(fs.readdirSync(path.join(place.data, 'calendars')).filter(name => name.startsWith('.download')).length, 0, 'no temporary file is left');
  assert.deepEqual(place.read('calendar-sync.txt').trim().split('\n'), [
    'group||download failed, could not find the server, so the network may be down',
    'outreach||download failed, could not connect to the server',
  ]);
});

test('with Node the document lists the next events of each calendar, SHOWN or HIDDEN, with the name of the rule that hid each one', () => {
  const place = setup('with-node', {
    localEnv: secretEnv,
    files: { 'sanity.json': sanityAnswer },
    calendars: { 'group.ics': groupCalendar, 'outreach.ics': outreachCalendar },
    sync: 'group|2026-10-09T15:00:02Z|\noutreach|2026-10-09T15:00:03Z|\n',
  });
  const result = place.run('calendar-status.sh');
  assert.equal(result.status, 0, result.errors);
  assert.ok(result.text.includes('wrote calendar-status.json'));

  const document = place.document();
  assert.deepEqual(Object.keys(document).slice(0, 2), ['_id', '_type'], 'status-write.sh checks the start of the file');
  assert.equal(document._id, 'calendar-status');
  assert.equal(document._type, 'calendarStatus');
  assert.match(document.updatedAt, time);
  assert.equal(document.eventsNote, undefined, 'no note when the events are listed');
  assert.deepEqual(document.calendars.map(calendar => calendar.code), ['group', 'outreach']);

  const group = document.calendars[0];
  assert.equal(group._key, 'group');
  assert.equal(group.fetchedAt, '2026-10-09T15:00:02Z');
  assert.equal(group.error, undefined);
  assert.equal(group.eventCount, 7, 'an event after 30 days is not counted');
  assert.equal(group.hiddenCount, 3);
  assert.equal(group.occurrences.length, 7);
  assert.deepEqual(group.occurrences.map(event => event._key), ['o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7']);
  assert.deepEqual(group.occurrences.map(event => event.title), ['Pre-Season Kickoff', 'Pre-Season Meeting', 'Pre-Season Meeting', 'Team meeting', 'Pre-Season Meeting', 'Pre-Season Meeting', 'Food drive']);

  const hidden = group.occurrences.filter(event => !event.shown);
  assert.deepEqual(hidden.map(event => event.rule), ['Hide Pre-Season', 'Hide Pre-Season', 'Hide Food drive in group']);
  assert.ok(group.occurrences.filter(event => event.shown).every(event => event.rule === ''), 'a shown event has no rule');
  assert.ok(group.occurrences.find(event => event.title === 'Pre-Season Kickoff').shown, 'an Always show rule wins');
  assert.ok(group.occurrences.find(event => event.title === 'Team meeting').shown, 'a rule that is off does nothing');
  group.occurrences.forEach(event => {
    assert.match(event.date, /^[A-Z]{3} [A-Z]{3} \d{1,2}$/, 'the date as the screen writes it');
    assert.match(event.time, /^\d{1,2}:\d{2} [AP]M$/, 'the time as the screen writes it');
  });

  const outreach = document.calendars[1];
  assert.equal(outreach.eventCount, 2);
  assert.equal(outreach.hiddenCount, 0, 'the Food drive rule is only for the group calendar');
  assert.equal(outreach.occurrences.find(event => event.title === 'Open house').time, '', 'an event that lasts all day has no time');
});

test('the document has only fields the Studio schema has, and a key on every calendar and every event', () => {
  const place = setup('schema', { localEnv: secretEnv, files: goodFiles, calendars: { 'group.ics': groupCalendar }, sync: 'group|2026-10-09T15:00:02Z|download failed, the server took too long to answer\nnew||no address set yet\n' });
  assert.equal(place.run('calendar-status.sh').status, 0);

  const names = schemaNames();
  const document = place.document();
  Object.keys(document).filter(key => !key.startsWith('_')).forEach(key => assert.ok(names.has(key), 'the schema has no field ' + key));
  document.calendars.forEach(calendar => {
    Object.keys(calendar).filter(key => !key.startsWith('_')).forEach(key => assert.ok(names.has(key), 'the schema has no field ' + key));
    (calendar.occurrences || []).forEach(event => Object.keys(event).filter(key => !key.startsWith('_')).forEach(key => assert.ok(names.has(key), 'the schema has no field ' + key)));
  });
  assert.ok(document.calendars.every(calendar => typeof calendar._key === 'string' && calendar._key !== ''), 'every calendar has a key, as an array in Sanity needs');
  assert.ok(document.calendars[0].occurrences.every(event => typeof event._key === 'string'), 'every event has a key');
});

test('a failed download keeps listing the events of the old file, a calendar with no file lists none, and the reason is in the document', () => {
  const place = setup('errors', {
    localEnv: secretEnv,
    files: { 'sanity.json': sanityAnswer },
    calendars: { 'group.ics': groupCalendar },
    sync: 'group|2026-10-08T15:00:02Z|download failed, the server said no, so the address may be wrong or expired\nnofile||download failed, could not connect to the server\n',
  });
  assert.equal(place.run('calendar-status.sh').status, 0);

  const [group, nofile] = place.document().calendars;
  assert.equal(group.error, 'download failed, the server said no, so the address may be wrong or expired');
  assert.equal(group.fetchedAt, '2026-10-08T15:00:02Z', 'the time of the last good download');
  assert.equal(group.eventCount, 7, 'the screen keeps using the old file, so the page lists it');

  assert.equal(nofile.error, 'download failed, could not connect to the server');
  assert.equal(nofile.fetchedAt, undefined);
  assert.equal(nofile.eventCount, undefined, 'events that were never read are not counted as none');
  assert.equal(nofile.occurrences, undefined);
});

test('twelve events are listed, in date order, and the count is of every event in the next 30 days', () => {
  const daily = calendarText([{ day: 1, title: 'Daily check', rule: 'FREQ=DAILY;COUNT=40' }]);
  const place = setup('twelve', { localEnv: secretEnv, files: { 'sanity.json': sanityAnswer }, calendars: { 'daily.ics': daily }, sync: 'daily|2026-10-09T15:00:02Z|\n' });
  assert.equal(place.run('calendar-status.sh').status, 0);

  const [calendar] = place.document().calendars;
  assert.equal(calendar.occurrences.length, 12);
  assert.ok(calendar.eventCount >= 29 && calendar.eventCount <= 30, 'the days from tomorrow to day 30: ' + calendar.eventCount);
  assert.deepEqual(calendar.occurrences.map(event => event._key), Array.from({ length: 12 }, (value, index) => 'o' + (index + 1)));
  assert.equal(new Set(calendar.occurrences.map(event => event.date)).size, 12, 'one for each day, in order');
});

test('a long title is cut, a title with line breaks or quotes stays one safe line, and an untitled event says so', () => {
  const long = 'A'.repeat(100);
  const text = calendarText([{ day: 1, title: long }, { day: 2, title: 'Say "hello" now' }, { day: 3, title: '' }, { day: 4, title: 'Two\\nlines' }]);
  const place = setup('titles', { localEnv: secretEnv, files: { 'sanity.json': sanityAnswer }, calendars: { 'odd.ics': text }, sync: 'odd|2026-10-09T15:00:02Z|\n' });
  assert.equal(place.run('calendar-status.sh').status, 0);

  const titles = place.document().calendars[0].occurrences.map(event => event.title);
  assert.equal(titles[0], 'A'.repeat(60) + '...');
  assert.equal(titles[1], 'Say "hello" now');
  assert.equal(titles[2], 'No title');
  assert.equal(titles[3], 'Two lines');
  assert.ok(!place.read('calendar-status.json').includes('\n\n'), 'one document');
});

test('no calendar address is in the document, the output or any command line, even when downloads fail', () => {
  const fetchPlace = setup('secret-fetch', { localEnv: secretEnv.concat("CALENDAR_BOOSTERS_URL='https://band.example/ical?token=SECRET-boosters'"), files: Object.assign({ 'boosters.exit': '22' }, goodFiles) });
  const fetched = fetchPlace.run('fetch-calendars.sh');
  assertNoAddress(fetched.text + fetched.errors, 'the output of fetch-calendars.sh');

  const place = setup('secret', {
    localEnv: secretEnv,
    files: { 'sanity.json': sanityAnswer },
    calendars: { 'group.ics': groupCalendar },
    sync: fetchPlace.read('calendar-sync.txt'),
  });
  const result = place.run('calendar-status.sh');
  assert.equal(result.status, 0, result.errors);
  assertNoAddress(place.read('calendar-status.json'), 'calendar-status.json');
  assertNoAddress(result.text + result.errors, 'the output of calendar-status.sh');
  assertNoAddress(result.calls, 'the command lines of curl');

  const sent = setup('secret-sent', { localEnv: secretEnv, calendars: {}, sync: '' });
  fs.writeFileSync(path.join(sent.data, 'calendar-status.json'), place.read('calendar-status.json'));
  const written = sent.run('status-write.sh', ['calendar-status']);
  assert.equal(written.status, 0, written.errors);
  assertNoAddress(JSON.stringify(sent.sent()) + written.calls, 'what was sent to Sanity');
});

test('without Node the document still has every calendar and says why it lists no events', () => {
  const place = setup('no-node', {
    localEnv: secretEnv,
    node: false,
    files: { 'sanity.json': sanityAnswer },
    calendars: { 'group.ics': groupCalendar },
    sync: 'group|2026-10-09T15:00:02Z|\noutreach||download failed, the server said no, so the address may be wrong or expired\n',
  });
  const result = place.run('calendar-status.sh');
  assert.equal(result.status, 0, result.errors);
  assert.equal(result.calls, '', 'Sanity is not asked when there is no Node to use the answer');

  const document = place.document();
  assert.equal(document._id, 'calendar-status');
  assert.equal(document._type, 'calendarStatus');
  assert.equal(document.eventsNote, 'Node is not installed on the Mini, so it does not list the coming events');
  assert.deepEqual(document.calendars, [
    { _key: 'group', code: 'group', fetchedAt: '2026-10-09T15:00:02Z' },
    { _key: 'outreach', code: 'outreach', error: 'download failed, the server said no, so the address may be wrong or expired' },
  ]);
});

test('a Node that is too old to read the dashboard files is not used, and the document says so', () => {
  ['v18.19.0', 'v20.18.3', 'v21.7.3', 'v22.6.0', 'garbage', ''].forEach((version, index) => {
    const place = setup('old-node-' + index, { localEnv: secretEnv, oldNode: version, files: { 'sanity.json': sanityAnswer }, calendars: { 'group.ics': groupCalendar }, sync: 'group|2026-10-09T15:00:02Z|\n' });
    const result = place.run('calendar-status.sh');

    assert.equal(result.status, 0, result.errors);
    assert.equal(place.document().eventsNote, 'Node on the Mini is too old to read the dashboard code, so it does not list the coming events. It needs version 20.19 or newer', version);
    assert.equal(place.document().calendars[0].eventCount, undefined, version);
    assert.ok(!result.calls.includes('calendar-status.mjs'), 'the Node file was not run for ' + version + ': ' + result.calls);
    assert.ok(!result.calls.includes('curl'), 'Sanity was not asked for ' + version);
  });

  ['v20.19.0', 'v20.20.1', 'v22.7.0', 'v22.12.0', 'v23.0.0', 'v26.4.0'].forEach((version, index) => {
    const place = setup('new-node-' + index, { localEnv: secretEnv, files: { 'sanity.json': sanityAnswer }, calendars: { 'group.ics': groupCalendar }, sync: 'group|2026-10-09T15:00:02Z|\n' });
    const original = fs.readFileSync(path.join(place.root, 'deploy/scripts/calendar-status.sh'), 'utf8');
    const script = original.replace('version=$(node --version 2> /dev/null) || return 1', 'version=' + version);
    assert.notEqual(script, original, 'the line that reads the version of Node is where this test expects it');
    fs.writeFileSync(path.join(place.root, 'deploy/scripts/calendar-status.sh'), script);

    const result = place.run('calendar-status.sh');
    assert.equal(result.status, 0, result.errors);
    assert.equal(place.document().eventsNote, undefined, 'a Node of version ' + version + ' is new enough');
    assert.equal(place.document().calendars[0].eventCount, 7, version);
  });
});

test('when Sanity cannot be read the document has the calendars and says the filters could not be read', () => {
  [{ 'sanity.exit': '6' }, { 'sanity.json': '<html>Not the content</html>' }, { 'sanity.json': JSON.stringify({ error: { description: 'no' } }) }].forEach((files, index) => {
    const place = setup('no-sanity-' + index, {
      localEnv: secretEnv,
      files: Object.assign({}, goodFiles, files),
      calendars: { 'group.ics': groupCalendar },
      sync: 'group|2026-10-09T15:00:02Z|\n',
    });
    const result = place.run('calendar-status.sh');

    assert.equal(result.status, 0, result.errors);
    const document = place.document();
    assert.equal(document.eventsNote, 'The Mini could not read the Calendar filters from Sanity, so it did not list the coming events', JSON.stringify(files));
    assert.equal(document.calendars[0].eventCount, undefined, 'without the filters every event would look SHOWN, so none is listed');
    assert.equal(document.calendars[0].fetchedAt, '2026-10-09T15:00:02Z');
  });
});

test('when Node fails the document has the calendars and says Node could not list the events, and the other calendars are not lost', () => {
  const place = setup('node-fails', {
    localEnv: secretEnv,
    files: { 'sanity.json': JSON.stringify({ result: 'not the content' }) },
    calendars: { 'group.ics': groupCalendar },
    sync: 'group|2026-10-09T15:00:02Z|\noutreach|2026-10-09T15:00:03Z|\n',
  });
  const result = place.run('calendar-status.sh');

  assert.equal(result.status, 0, result.errors);
  const document = place.document();
  assert.equal(document.eventsNote, 'Node could not list the coming events, and the log of the calendar service says why');
  assert.deepEqual(document.calendars.map(calendar => calendar.code), ['group', 'outreach']);
  assert.equal(document.calendars[0].eventCount, undefined);
  assert.ok(result.errors.includes('Sanity did not send the content'), 'what Node said is left for the log: ' + result.errors);
});

test('with no sync file there is nothing to report: no document is made, and an old one is left alone', () => {
  const place = setup('no-sync', { localEnv: secretEnv, files: goodFiles });
  const result = place.run('calendar-status.sh');

  assert.equal(result.status, 0, result.errors);
  assert.ok(result.text.includes('fetch-calendars.sh has not run yet'));
  assert.equal(place.has('calendar-status.json'), false);
  assert.equal(result.calls, '');
});

test('odd lines in the sync file never break the document: a bad code is dropped, a bad time or reason is replaced', () => {
  const sync = [
    'good|2026-10-09T15:00:02Z|',
    'Bad Code|2026-10-09T15:00:02Z|',
    'quote"|2026-10-09T15:00:02Z|',
    'time|yesterday|',
    'reason|2026-10-09T15:00:02Z|it said "no" \\ and {oops}',
    'long|2026-10-09T15:00:02Z|' + 'x'.repeat(300),
    'good|2026-10-09T15:00:02Z|a second line for the same code',
    '|2026-10-09T15:00:02Z|',
    '',
  ].join('\n');

  [true, false].forEach(withNode => {
    const place = setup('odd-' + withNode, { localEnv: secretEnv, node: withNode, files: { 'sanity.json': sanityAnswer }, sync: sync });
    const result = place.run('calendar-status.sh');
    assert.equal(result.status, 0, result.errors);

    const calendars = place.document().calendars;
    assert.deepEqual(calendars.map(calendar => calendar.code), ['good', 'time', 'reason', 'long'], 'a code is listed once, with Node: ' + withNode);
    assert.equal(calendars[1].fetchedAt, undefined, 'a time that is not a time is dropped');
    assert.equal(calendars[2].error, 'the download failed', 'a reason with odd signs is replaced by a plain one');
    assert.equal(calendars[3].error, 'the download failed', 'a reason that long is not a reason');
  });
});

test('the file is written whole or not at all: no temporary file is left in the data folder', () => {
  const place = setup('atomic', { localEnv: secretEnv, files: { 'sanity.json': sanityAnswer }, calendars: { 'group.ics': groupCalendar }, sync: 'group|2026-10-09T15:00:02Z|\n' });
  place.run('calendar-status.sh');
  place.run('calendar-status.sh');

  assert.deepEqual(fs.readdirSync(place.data).sort(), ['calendar-status.json', 'calendar-sync.txt', 'calendars']);
});

test('status-write.sh calendar-status sends the document with createOrReplace, to the dataset in config.js, with the token on standard input', () => {
  const made = setup('made', { localEnv: secretEnv, files: { 'sanity.json': sanityAnswer }, calendars: { 'group.ics': groupCalendar }, sync: 'group|2026-10-09T15:00:02Z|\n' });
  assert.equal(made.run('calendar-status.sh').status, 0);

  const place = setup('send', { localEnv: secretEnv });
  fs.writeFileSync(path.join(place.data, 'calendar-status.json'), made.read('calendar-status.json'));
  const result = place.run('status-write.sh', ['calendar-status']);

  assert.equal(result.status, 0, result.errors);
  assert.equal(result.text.trim(), 'status: wrote calendar-status');
  const body = place.sent();
  assert.deepEqual(Object.keys(body), ['mutations']);
  assert.equal(body.mutations.length, 1);
  assert.deepEqual(Object.keys(body.mutations[0]), ['createOrReplace'], 'the whole document is replaced, so a calendar taken out of local.env goes');
  assert.deepEqual(body.mutations[0].createOrReplace, made.document());

  const config = fs.readFileSync(path.join(repo, 'dashboard/config.js'), 'utf8');
  const project = config.match(/projectId: '([^']*)'/)[1];
  const dataset = config.match(/dataset: '([^']*)'/)[1];
  const version = config.match(/apiVersion: '([^']*)'/)[1];
  assert.ok(result.calls.includes('https://' + project + '.api.sanity.io/v' + version + '/data/mutate/' + dataset), result.calls);
  assert.ok(result.calls.includes('--request POST') && result.calls.includes('--fail') && result.calls.includes('--config -'), result.calls);
  assert.ok(!result.calls.includes(token) && !result.errors.includes(token) && !result.text.includes(token), 'the token is not in the arguments or the output');
  assert.equal(fs.readFileSync(path.join(place.stub, 'last-config.txt'), 'utf8').trim(), 'header = "Authorization: Bearer ' + token + '"');
});

test('status-write.sh calendar-status sends nothing without a token or a document, and refuses a file that is not the document', () => {
  const document = '{"_id":"calendar-status","_type":"calendarStatus","calendars":[]}';

  const noToken = setup('send-no-token', { localEnv: [], token: false });
  fs.writeFileSync(path.join(noToken.data, 'calendar-status.json'), document);
  const first = noToken.run('status-write.sh', ['calendar-status']);
  assert.equal(first.status, 0);
  assert.equal(first.text + first.errors + first.calls, '', 'quiet, and curl is never called');

  const noFile = setup('send-no-file', { localEnv: [] });
  const second = noFile.run('status-write.sh', ['calendar-status']);
  assert.equal(second.status, 0);
  assert.equal(second.text + second.errors + second.calls, '', 'there was no calendar run to report');

  const wrong = {
    'another document': '{"_id":"status-mini","_type":"status"}',
    'another type': '{"_id":"calendar-status","_type":"task"}',
    'text that is not a document': 'not json at all',
    'an empty file': '',
    'a document that is too big': document.slice(0, -2) + ',"x":"' + 'y'.repeat(100000) + '"}',
  };
  Object.keys(wrong).forEach(name => {
    const place = setup('send-' + name.replace(/\W+/g, '-'), { localEnv: [] });
    fs.writeFileSync(path.join(place.data, 'calendar-status.json'), wrong[name]);
    const result = place.run('status-write.sh', ['calendar-status']);

    assert.equal(result.status, 1, name);
    assert.ok(/nothing was written/.test(result.errors), name + ': ' + result.errors);
    assert.equal(place.sentAny(), false, name + ' was sent anyway');
    assert.ok(!result.errors.includes(token) && !result.calls.includes(token), name);
  });

  const failing = setup('send-fails', { localEnv: [] });
  fs.writeFileSync(path.join(failing.data, 'calendar-status.json'), document);
  fs.writeFileSync(path.join(failing.stub, 'mutate.exit'), '22');
  const refused = failing.run('status-write.sh', ['calendar-status']);
  assert.equal(refused.status, 1);
  assert.ok(refused.errors.includes('could not write calendar-status, Sanity refused it'), refused.errors);
  assert.ok(!refused.errors.includes(token) && !refused.calls.includes(token));
});

test('the other jobs of status-write.sh are written as they were, and the usage lists the new one', () => {
  const place = setup('usage', { localEnv: [] });
  const result = place.run('status-write.sh', ['tv']);
  assert.equal(result.status, 2);
  assert.ok(result.errors.includes('Usage: status-write.sh content|calendar|slides|monday|frc|kiosk|calendar-status'), result.errors);

  const job = setup('job', { localEnv: [] });
  assert.equal(job.run('status-write.sh', ['calendar']).status, 0);
  const body = job.sent();
  assert.deepEqual(body.mutations[0], { createIfNotExists: { _id: 'status-mini', _type: 'status' } });
  assert.deepEqual(Object.keys(body.mutations[1].patch.set), ['lastCalendarSyncAt']);
});

test('the calendar service runs the status steps after every run, failed or not, and each step is allowed to fail', () => {
  const text = fs.readFileSync(path.join(repo, 'deploy/systemd/teletraan-calendars.service'), 'utf8');
  const lines = text.split('\n');
  const stops = lines.filter(line => line.startsWith('ExecStopPost='));

  assert.deepEqual(stops, [
    'ExecStopPost=-/opt/teletraan/deploy/scripts/calendar-status.sh',
    'ExecStopPost=-/opt/teletraan/deploy/scripts/status-write.sh calendar-status',
  ], 'the file is made before it is sent, and a leading minus ignores a failure');
  assert.equal(lines.filter(line => line.startsWith('ExecStart=')).length, 1);
  assert.equal(lines.filter(line => line.startsWith('ExecStart=/opt/teletraan/deploy/scripts/fetch-calendars.sh')).length, 1);
  assert.ok(!lines.some(line => line.startsWith('ExecStartPost=') && /calendar-status/.test(line)), 'systemd skips ExecStartPost after a failed download, and that is when the page is needed');
  assert.deepEqual(text.match(/^User=.*$/gm), ['User=ACCOUNT']);
  assert.ok(lines.indexOf(stops[0]) > lines.indexOf('ExecStartPost=-/opt/teletraan/deploy/scripts/status-write.sh content'), 'the older steps come first');
});

test('the installers say when Node is missing, and the note does not stop them', () => {
  ['install-calendars.sh', 'install-timers.sh'].forEach(file => {
    const text = fs.readFileSync(path.join(repo, 'deploy/scripts', file), 'utf8');
    assert.ok(text.includes('if ! command -v node > /dev/null 2>&1; then'), file);
    assert.ok(text.includes('docs/calendars-page.md'), file);
    assert.ok(text.indexOf('command -v node') < text.indexOf("printf 'Press Enter"), file + ' says it before it waits for Enter');
    const syntax = spawnSync('/bin/sh', ['-n', path.join(repo, 'deploy/scripts', file)], { encoding: 'utf8' });
    assert.equal(syntax.status, 0, syntax.stderr);
  });
});

test('the docs say the titles are readable by anyone who asks the dataset, even the ones a rule hides, and how to turn the event lists on', () => {
  const page = fs.readFileSync(path.join(repo, 'docs/calendars-page.md'), 'utf8').replace(/\s+/g, ' ');
  ['The dataset is public', 'anyone who knows the project ID', 'titles, dates and times', 'a Calendar filter hides', 'Anyone who asks the dataset', 'no calendar address, no token', 'sudo apt install nodejs', 'ExecStopPost', 'Nothing yet', 'Events not listed'].forEach(words => {
    assert.ok(page.includes(words), 'docs/calendars-page.md should say: ' + words);
  });

  const mini = fs.readFileSync(path.join(repo, 'docs/rebuilding-the-mini.md'), 'utf8').replace(/\s+/g, ' ');
  ['`calendar-status` document is public', 'events that a Calendar filter hides', '`nodejs`, optional', 'calendar-status.sh'].forEach(words => {
    assert.ok(mini.includes(words), 'docs/rebuilding-the-mini.md should say: ' + words);
  });

  ['docs/calendars-page.md', 'docs/calendar-filters.md', 'docs/calendar-links.md', 'docs/rebuilding-the-mini.md', 'deploy/README.md'].forEach(file => {
    const text = fs.readFileSync(path.join(repo, file), 'utf8');
    assert.ok(!/[\u2014\u2013]/.test(text), file + ' has a dash');
    assert.ok(!/\p{Extended_Pictographic}/u.test(text), file + ' has an emoji');
  });
});

function filesUnder(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).reduce((files, entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) return files.concat(filesUnder(full));
    return /\.(js|mjs|html|css|json|svg|txt|md)$/.test(entry.name) ? files.concat(full) : files;
  }, []);
}

test('the dashboard never reads the calendar status document: its id and its type are nowhere in the dashboard folder', () => {
  const files = filesUnder(path.join(repo, 'dashboard'));
  assert.ok(files.length > 50, 'the scan found the dashboard files');

  files.forEach(file => {
    const found = fs.readFileSync(file, 'utf8');
    ['calendar-status', 'calendarStatus', 'calendar-sync'].forEach(word => assert.ok(!found.includes(word), path.relative(repo, file) + ' mentions ' + word));
  });
});

test('the scripts have valid sh syntax, are executable, never print local.env and never trace', () => {
  ['fetch-calendars.sh', 'calendar-status.sh', 'status-write.sh'].forEach(file => {
    const full = path.join(repo, 'deploy/scripts', file);
    const syntax = spawnSync('/bin/sh', ['-n', full], { encoding: 'utf8' });
    assert.equal(syntax.status, 0, file + ': ' + syntax.stderr);

    const text = fs.readFileSync(full, 'utf8');
    assert.ok(text.startsWith('#!/bin/sh\n'), file);
    assert.ok((fs.statSync(full).mode & 0o111) !== 0, file + ' should be executable');
    assert.ok(!/\bcat\b[^\n]*local\.env/.test(text), file + ': local.env is never printed');
    assert.ok(!/^\s*set -[a-z]*x/m.test(text), file + ': set -x would print every address');
  });

  const status = fs.readFileSync(path.join(repo, 'deploy/scripts/calendar-status.sh'), 'utf8');
  assert.ok(!/CALENDAR_|\burl\b/.test(status.replace(/#[^\n]*/g, '')), 'calendar-status.sh never reads an address');
  const helper = fs.readFileSync(path.join(repo, 'deploy/scripts/calendar-status.mjs'), 'utf8');
  assert.ok(!/local\.env|CALENDAR_|process\.env/.test(helper), 'the Node file never sees an address or the token');
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
