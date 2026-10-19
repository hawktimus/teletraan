// Tests for the field strength and the schedule that computer/scripts/frc-sync.sh reads in the 14 days before an event
// (docs/frc-feed.md, "Field strength and our matches"). curl, date and flock are the same small fakes as in
// tests/frc-sync.test.mjs, so nothing touches the network. The answers of The Blue Alliance and of Statbotics are made
// up from the shape their documentation gives: they were not taken from the live services. The team numbers, the key and
// the token are made up too.
//
//   node tests/frc-field.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { copyWithEdits } from './helpers/script-parts.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const syncFile = path.join(repo, 'computer/scripts/frc-sync.sh');
const installFile = path.join(repo, 'computer/scripts/install-frc.sh');
const unitFiles = ['teletraan-frc.service', 'teletraan-frc.timer'];
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-frc-field-'));

const ordinaryTools = ['sed', 'tail', 'head', 'grep', 'mktemp', 'mv', 'rm', 'mkdir', 'dirname', 'basename', 'cat', 'cp', 'cmp', 'tr', 'stat', 'sleep'];

function findTool(name) {
  const found = spawnSync('/bin/sh', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
  assert.ok(found, 'this computer has no ' + name);
  return found;
}

// A fake curl. It writes each call it gets to calls.log, but never what comes in
// on standard input: that is the key or the token, and it goes to configs.txt in
// the stub folder, which the tests look at. The address is the https:// argument.
// Sanity answers a question from sanity.json and keeps what is written in
// mutations/<number>.json. For the two services the answer is
// <service>/<address with _ for />.json, with an ETag from the .etag file when
// there is one, and the .code file gives another status and the .exit file makes
// curl fail with that exit code. A request that sends the ETag it was given gets
// 304.
const fakeCurl = `#!/bin/sh
printf '%s\\n' "$(printf 'curl %s' "$*" | tr '\\n' ' ')" >> "$STUB_LOG"
output=""
headers=""
body=""
write_out=""
etag=""
address=""
previous=""
for argument in "$@"; do
  case $previous in
    --output) output=$argument ;;
    --dump-header) headers=$argument ;;
    --data-binary) body=\${argument#@} ;;
    --write-out) write_out=$argument ;;
  esac
  case $argument in
    "If-None-Match: "*) etag=\${argument#If-None-Match: } ;;
    https://*) address=$argument ;;
  esac
  previous=$argument
done
case " $* " in
  *" --config - "*)
    cat >> "$STUB_DIR/configs.txt"
    echo "--" >> "$STUB_DIR/configs.txt"
    ;;
esac

case $address in
  https://*.api.sanity.io/*/data/query/*)
    [ -f "$STUB_DIR/sanity.exit" ] && exit "$(cat "$STUB_DIR/sanity.exit")"
    cp "$STUB_DIR/sanity.json" "$output"
    exit 0
    ;;
  https://*.api.sanity.io/*/data/mutate/*)
    count=$(cat "$STUB_DIR/mutations.count" 2> /dev/null || echo 0)
    count=$((count + 1))
    echo "$count" > "$STUB_DIR/mutations.count"
    mkdir -p "$STUB_DIR/mutations"
    cp "$body" "$STUB_DIR/mutations/$count.json"
    echo "$address" >> "$STUB_DIR/addresses.txt"
    [ -f "$STUB_DIR/mutate.exit" ] && exit "$(cat "$STUB_DIR/mutate.exit")"
    exit 0
    ;;
  https://www.thebluealliance.com/api/v3/*)
    service=tba
    path=\${address#https://www.thebluealliance.com/api/v3/}
    ;;
  https://api.statbotics.io/v3/*)
    service=sb
    path=\${address#https://api.statbotics.io/v3/}
    ;;
  *) exit 6 ;;
esac

slug=$(printf '%s' "$path" | tr '/' '_')
base="$STUB_DIR/$service/$slug"
[ -f "$base.exit" ] && exit "$(cat "$base.exit")"
code=200
[ -f "$base.code" ] && code=$(cat "$base.code")
[ "$code" = 200 ] && [ ! -f "$base.json" ] && code=404
version=""
[ -f "$base.etag" ] && version=$(cat "$base.etag")
[ "$code" = 200 ] && [ -n "$version" ] && [ "$etag" = "$version" ] && code=304

printf 'HTTP/2 %s\\r\\n' "$code" > "$headers"
[ "$code" = 200 ] && [ -n "$version" ] && printf 'etag: %s\\r\\n' "$version" >> "$headers"
case $code in
  200) cp "$base.json" "$output" ;;
  304) : > "$output" ;;
  *) echo '{"Error":"stub"}' > "$output" ;;
esac
[ -n "$write_out" ] && printf '%s' "$code"
exit 0
`;

// A fake date. The script asks for four things, and each is answered from the
// clock the test has set. The time zone the script asks in is written to the log.
const fakeDate = `#!/bin/sh
echo "date TZ=\${TZ:-none} $*" >> "$STUB_LOG"
for argument in "$@"; do
  format=$argument
done
case $format in
  +%s) echo "$STUB_EPOCH" ;;
  +%Y-%m-%d) echo "$STUB_TODAY" ;;
  +%Y) echo "\${STUB_TODAY%%-*}" ;;
  +%Y-%m-%dT%H:%M:%SZ) echo "$STUB_UTC" ;;
  *) exit 1 ;;
esac
`;

// status-write.sh is tested in status-write.test.mjs. Here it only has to say it
// was called.
const fakeStatusWrite = `#!/bin/sh
echo "status-write.sh $*" >> "$STUB_LOG"
exit 0
`;

function writeTool(folder, name, text) {
  fs.writeFileSync(path.join(folder, name), text, { mode: 0o755 });
}

const key = 'tbaTESTkey0123456789abcdef0123456789';
const token = 'skTESTtoken0123456789abcdef';
const secret = 'https://band.example/SECRET-FEED-TOKEN';

function slugOf(address) {
  return address.replace(/^\//, '').replace(/\//g, '_');
}

// Makes a copy of the computer folder and config.js to run in, a folder of tools
// to run with, and returns how to run the scripts.
function setup(name, options) {
  const root = path.join(work, name);
  const bin = path.join(root, 'bin');
  const stub = path.join(root, 'stub');
  const data = path.join(root, 'data');
  const temp = path.join(root, 'tmp');
  fs.mkdirSync(path.join(root, 'computer/scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'computer/systemd'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dashboard'), { recursive: true });
  [bin, stub, temp, path.join(stub, 'tba'), path.join(stub, 'sb')].forEach(folder => fs.mkdirSync(folder));
  if (!options.noData) fs.mkdirSync(data);

  const scriptCopy = path.join(root, 'computer/scripts/frc-sync.sh');
  copyWithEdits(syncFile, path.join(root, 'computer/scripts'), options.edits);
  const installCopy = path.join(root, 'computer/scripts/install-frc.sh');
  fs.copyFileSync(installFile, installCopy);
  fs.chmodSync(installCopy, fs.statSync(installFile).mode);
  writeTool(path.join(root, 'computer/scripts'), 'status-write.sh', fakeStatusWrite);
  fs.copyFileSync(path.join(repo, 'computer/scripts/lib.sh'), path.join(root, 'computer/scripts/lib.sh'));
  unitFiles.forEach(unit => fs.copyFileSync(path.join(repo, 'computer/systemd', unit), path.join(root, 'computer/systemd', unit)));
  fs.copyFileSync(path.join(repo, 'dashboard/config.js'), path.join(root, 'dashboard/config.js'));

  if (!options.noEnv) {
    const env = options.env !== undefined ? options.env : "TELETRAAN_DATA='" + data + "'\nTBA_AUTH_KEY='" + key + "'\nSANITY_WRITE_TOKEN='" + token + "'\nCALENDAR_TEAM_URL='" + secret + "'\n";
    fs.writeFileSync(path.join(root, 'computer/local.env'), env.replace('<data>', data));
  }

  ordinaryTools.forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));

  if (options.tools) {
    fs.symlinkSync(findTool('jq'), path.join(bin, 'jq'));
    writeTool(bin, 'curl', fakeCurl);
    writeTool(bin, 'date', fakeDate);
    writeTool(bin, 'flock', '#!/bin/sh\necho "flock $*" >> "$STUB_LOG"\n[ "$STUB_LOCKED" != yes ]\n');
  }
  if (options.install) {
    writeTool(bin, 'id', '#!/bin/sh\n[ "$1" = -u ] && echo "$STUB_UID"\nexit 0\n');
    writeTool(bin, 'systemctl', '#!/bin/sh\necho "systemctl $*" >> "$STUB_LOG"\n');
    writeTool(bin, 'apt', '#!/bin/sh\necho "apt $*" >> "$STUB_LOG"\n');
    writeTool(bin, 'apt-get', '#!/bin/sh\necho "apt-get $*" >> "$STUB_LOG"\n');
  }

  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');
  const frc = path.join(data, 'frc');

  const place = {
    root: root,
    data: data,
    frc: frc,
    temp: temp,
    log: log,
    stub: stub,
    clock: {},
    // The time the fake date tells: a moment in UTC, and the date it is in the
    // time zone of the screen
    at(utc, today) {
      this.clock = { STUB_EPOCH: String(Math.floor(Date.parse(utc) / 1000)), STUB_UTC: utc, STUB_TODAY: today || utc.slice(0, 10) };
    },
    run(args, extra, shell) {
      fs.writeFileSync(log, '');
      const env = Object.assign({ PATH: bin, STUB_LOG: log, STUB_DIR: stub, TMPDIR: temp, STUB_UID: '1000' }, this.clock, extra || {});
      const result = spawnSync(shell || '/bin/sh', [scriptCopy].concat(args || []), { env: env, encoding: 'utf8', input: '', cwd: root });
      return { text: result.stdout, errors: result.stderr, status: result.status, calls: fs.readFileSync(log, 'utf8') };
    },
    install(extra) {
      fs.writeFileSync(log, '');
      const env = Object.assign({ PATH: bin, STUB_LOG: log, STUB_DIR: stub, TMPDIR: temp, STUB_UID: '1000' }, extra || {});
      const result = spawnSync('/bin/sh', [installCopy], { env: env, encoding: 'utf8', input: '\n', cwd: root });
      return { text: result.stdout, errors: result.stderr, status: result.status, calls: fs.readFileSync(log, 'utf8') };
    },
    // What Sanity answers to the one question the script asks
    sanity(answer) {
      fs.writeFileSync(path.join(stub, 'sanity.json'), JSON.stringify({ ms: 1, query: 'stub', result: answer }));
    },
    // The answer of one address of a service. options.etag is the ETag it
    // sends (none for Statbotics), options.code another status, options.exit
    // a curl failure.
    answer(service, address, body, options) {
      const base = path.join(stub, service, slugOf(address));
      const given = options || {};
      ['.json', '.etag', '.code', '.exit'].forEach(ending => fs.rmSync(base + ending, { force: true }));
      if (body !== undefined) fs.writeFileSync(base + '.json', JSON.stringify(body));
      if (given.etag) fs.writeFileSync(base + '.etag', given.etag);
      if (given.code) fs.writeFileSync(base + '.code', String(given.code));
      if (given.exit) fs.writeFileSync(base + '.exit', String(given.exit));
    },
    tba(address, body, options) {
      const given = Object.assign({ etag: '"' + slugOf(address) + '-1"' }, options || {});
      this.answer('tba', address, body, given);
    },
    statbotics(address, body, options) {
      this.answer('sb', address, body, options);
    },
    mutations() {
      const folder = path.join(stub, 'mutations');
      return fs.existsSync(folder) ? fs.readdirSync(folder).length : 0;
    },
    // The status document of the nth write
    document(number) {
      const body = JSON.parse(fs.readFileSync(path.join(stub, 'mutations', (number || this.mutations()) + '.json'), 'utf8'));
      return body.mutations[0].createOrReplace;
    },
    state() {
      return JSON.parse(fs.readFileSync(path.join(frc, 'state.json'), 'utf8'));
    },
    configs() {
      const file = path.join(stub, 'configs.txt');
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    },
  };
  return place;
}


const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

function requestsOf(calls) {
  return calls.split('\n').filter(line => line.startsWith('curl ')).map(line => {
    const address = (line.match(/(https:\/\/\S+)$/) || [])[1] || '';
    if (address.includes('/data/query/')) return 'sanity-query';
    if (address.includes('/data/mutate/')) return 'sanity-write';
    if (address.includes('thebluealliance.com')) return 'tba ' + address.replace(/^.*\/api\/v3/, '');
    if (address.includes('statbotics.io')) return 'sb ' + address.replace(/^.*\/v3/, '');
    return 'other ' + address;
  });
}

function filesUnder(folder) {
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder, { withFileTypes: true }).reduce((files, entry) => {
    const full = path.join(folder, entry.name);
    return entry.isDirectory() ? files.concat(filesUnder(full)) : files.concat(full);
  }, []);
}

// The made-up world of an event that has not started. The team has 6 qualification matches still to play, the roster has
// 9 teams, and each has a rating. Odd matches the team is red, even ones blue.
const eventKey = '2027ncwak';
const firstMatchTime = Date.parse('2027-03-12T14:00:00Z') / 1000;
const others = [9001, 9002, 9003, 9004, 9005, 9006, 9007, 9008];
const ratings = { 3229: 31.2, 9001: 52.4, 9002: 28.1, 9003: 25, 9004: 33.337, 9005: 22, 9006: 40.5, 9007: 18.25, 9008: 36 };

function nickname(number) {
  return '[Nickname ' + number + ']';
}

function matchOf(number) {
  const ours = number % 2 === 1;
  const red = ours ? ['frc3229', 'frc9001', 'frc9002'] : ['frc9006', 'frc9007', 'frc9008'];
  const blue = ours ? ['frc9003', 'frc9004', 'frc9005'] : ['frc3229', 'frc9001', 'frc9005'];
  return {
    key: eventKey + '_qm' + number,
    comp_level: 'qm',
    set_number: 1,
    match_number: number,
    time: firstMatchTime + number * 480,
    predicted_time: firstMatchTime + number * 480 + 60,
    winning_alliance: '',
    alliances: { red: { score: -1, team_keys: red }, blue: { score: -1, team_keys: blue } },
  };
}

// today is the date the script thinks it is, and the event starts on 2027-03-12
function world(place, options) {
  const given = options || {};
  place.at(given.utc || '2027-03-05T15:00:00Z');
  place.sanity({ zone: 'America/New_York', teams: [{ code: 'prime', number: '3229' }], previous: null });

  place.tba('/team/frc3229/events/2027', [
    { key: eventKey, name: '[Sample Regional]', city: '[City]', state_prov: 'NC', start_date: given.start || '2027-03-12', end_date: '2027-03-14', event_type: 1 },
  ]);
  const matches = [];
  for (let number = 1; number <= (given.matches === undefined ? 6 : given.matches); number += 1) matches.push(matchOf(number));
  place.tba('/team/frc3229/event/' + eventKey + '/matches', matches);
  place.tba('/event/' + eventKey + '/rankings', { rankings: [], sort_order_info: [] });
  place.tba('/event/' + eventKey + '/alliances', null);
  const roster = [3229].concat(others).map(number => ({ key: 'frc' + number, team_number: number, nickname: nickname(number), name: '[Long sponsor names ' + number + ']', city: '[City]' }));
  place.tba('/event/' + eventKey + '/teams/simple', roster);
  place.tba('/team/frc3229/awards/2027', []);
  Object.keys(ratings).forEach(number => {
    const body = { team: number, year: 2027, epa: { total_points: { mean: ratings[number] }, stats: { start: ratings[number] - (number === '9001' ? 5 : number === '9006' ? -5 : 0) } }, record: { total: { wins: 9, losses: 3, ties: 0 } } };
    place.statbotics('/team_year/' + number + '/2027', given.noRatings ? {} : body);
  });
  for (let number = 1; number <= 6; number += 1) {
    if (number === 4) continue; // no chance for this one: the card works it out
    place.statbotics('/match/' + eventKey + '_qm' + number, { key: eventKey + '_qm' + number, pred: { winner: 'red', red_win_prob: 0.6 } });
  }
  place.tba('/district/2027nc/events', []);
  place.tba('/district/2027nc/rankings', []);
}

const sbOf = requests => requests.filter(request => request.startsWith('sb '));

test('in the 14 days before an event the rating of every team that comes is read, and the status has the field best first', () => {
  const place = setup('field', { tools: true });
  world(place);
  const result = place.run();
  assert.equal(result.status, 0, result.errors);

  const document = place.document();
  const entry = document.teams[0];
  assert.equal(entry.field.event, eventKey);
  assert.deepEqual(entry.field.teams.map(team => team.number), [9001, 9006, 9008, 9004, 3229, 9002, 9003, 9005, 9007]);
  assert.deepEqual(entry.field.teams.map(team => team.epa), [52.4, 40.5, 36, 33.34, 31.2, 28.1, 25, 22, 18.25]);
  assert.equal(entry.field.teams[0].nickname, nickname(9001));
  assert.ok(sbOf(requestsOf(result.calls)).includes('sb /team_year/9007/2027'), 'a team that is not in the next match is read for the field');
  assert.ok(entry.field.teams.every(team => team._key), 'every team has a _key');
});

test('the schedule has the matches still to play with partners, opponents, their rating, record and trend, and the win chance of our alliance', () => {
  const place = setup('schedule', { tools: true });
  world(place);
  const result = place.run();
  assert.equal(result.status, 0, result.errors);

  const schedule = place.document().teams[0].schedule;
  assert.equal(schedule.event, eventKey);
  assert.deepEqual(schedule.matches.map(match => match.label), ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6']);

  const first = schedule.matches[0];
  assert.equal(first.alliance, 'red');
  assert.equal(first.time, new Date((firstMatchTime + 480) * 1000).toISOString().replace('.000Z', 'Z'));
  assert.deepEqual(first.partners.map(person => person.number), [9001, 9002]);
  assert.deepEqual(first.opponents.map(person => person.number), [9003, 9004, 9005]);
  assert.equal(first.partners[0].epa, 52.4);
  assert.equal(first.partners[0].trend, 'rising');
  assert.deepEqual(first.partners[0].record, { wins: 9, losses: 3, ties: 0 });
  assert.equal(first.winProbability, 0.6, 'red wins with 0.6 and we are red');

  const second = schedule.matches[1];
  assert.equal(second.alliance, 'blue');
  assert.equal(second.winProbability, 0.4, 'we are blue, so the chance is the other side of 0.6');
  assert.equal(schedule.matches[3].winProbability, null, 'Statbotics had no chance for Q4');
  assert.equal(second.opponents.find(person => person.number === 9006).trend, 'falling', 'the rating of 9006 is under its start of the season');
});

test('the win chance of every match of the team is asked for, and the limits and the order of the requests hold', () => {
  const place = setup('chances', { tools: true });
  world(place);
  const result = place.run();
  const requests = requestsOf(result.calls);

  for (let number = 1; number <= 6; number += 1) assert.ok(requests.includes('sb /match/' + eventKey + '_qm' + number), 'Q' + number);
  assert.ok(sbOf(requests).length <= 60 + 3, 'at most 60 requests for the field and the chances, and 3 for the next matches');
  assert.equal(requests.filter(request => request === 'sb /team_year/9007/2027').length, 1, 'one rating is asked for once');
});

test('a rating read less than 12 hours ago is not asked for again, and is asked for after 12 hours', () => {
  const place = setup('keep', { tools: true });
  world(place);
  place.run();

  place.at('2027-03-05T17:00:00Z');
  const again = place.run(['--now']);
  const second = requestsOf(again.calls);
  assert.ok(!second.includes('sb /team_year/9007/2027'), 'a field team that is not in the next match is kept');
  assert.ok(second.includes('sb /team_year/9001/2027'), 'a team of the next match is read again, as before');

  place.at('2027-03-06T05:30:00Z');
  const later = requestsOf(place.run(['--now']).calls);
  assert.ok(later.includes('sb /team_year/9007/2027'), 'after 12 hours it is asked for again');
});

test('the limit for the field: a run that reaches it says so in the notes and carries on at the next run', () => {
  const place = setup('capped', { tools: true, edits: [['field_max=60', 'field_max=2']] });
  world(place);
  const first = place.run();
  const document = place.document();

  const fieldOnly = requestsOf(first.calls).filter(request => /^sb \/team_year\/900[678]\/2027$/.test(request));
  assert.equal(fieldOnly.length, 2, 'two ratings for the field, which is the limit');
  assert.ok(document.notes.some(note => note.includes('Field strength') && note.includes('limit')), JSON.stringify(document.notes));
  assert.equal(place.state().unfinished, true, 'the next run is not made to wait');

  // each run reads two more answers, and the note is gone when the last are read
  let runs = 1;
  while (place.document().notes.some(note => note.includes('Field strength')) && runs < 6) {
    place.run();
    runs += 1;
  }
  assert.equal(runs, 3, 'the 3 ratings and 3 chances that were left took two more runs');
  assert.deepEqual(place.document().teams[0].field.teams.map(team => team.epa !== null), new Array(9).fill(true));
  assert.equal(place.document().teams[0].schedule.matches[4].winProbability, 0.6);
});

test('before the 14 days, or after the event starts, no rating is read for the field and the status has none', () => {
  const early = setup('early', { tools: true });
  world(early, { utc: '2027-02-20T15:00:00Z' });
  const first = early.run();
  assert.equal(early.document().teams[0].field, null);
  assert.ok(!requestsOf(first.calls).includes('sb /team_year/9007/2027'));
  assert.ok(early.document().teams[0].schedule.matches.length > 0, 'the schedule is still kept when the matches are posted');

  const on = setup('started', { tools: true });
  world(on, { utc: '2027-03-12T15:00:00Z' });
  const second = on.run();
  assert.equal(on.document().teams[0].field, null);
  assert.ok(!requestsOf(second.calls).includes('sb /team_year/9007/2027'));
});

test('a schedule that is not posted has no matches, and the field is still read', () => {
  const place = setup('unposted', { tools: true });
  world(place, { matches: 0 });
  const result = place.run();
  const entry = place.document().teams[0];

  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(entry.schedule, { event: eventKey, matches: [] });
  assert.ok(entry.field.teams.length > 0);
});

test('a refusal from Statbotics skips the field and the chances, notes it, and the run still works', () => {
  const place = setup('refused', { tools: true });
  world(place);
  place.statbotics('/team_year/3229/2027', {}, { code: 403 });
  const result = place.run();
  const document = place.document();

  assert.equal(result.status, 0, result.errors);
  assert.ok(document.notes.some(note => note.includes('Statbotics refused')));
  assert.ok(document.notes.some(note => note.includes('Field strength')));
  assert.equal(document.teams[0].field, null, 'with fewer than two ratings there is no field');
  assert.equal(document.teams[0].schedule.matches.length, 6, 'the schedule is kept');
});

test('a team Statbotics does not know gets no rating and is not asked for again in the next run', () => {
  const place = setup('unknown', { tools: true });
  world(place);
  place.statbotics('/team_year/9007/2027', undefined);
  const first = place.run();
  const field = place.document().teams[0].field;

  assert.equal(field.teams.find(team => team.number === 9007).epa, null);
  assert.equal(field.teams[field.teams.length - 1].number, 9007, 'a team with no rating comes last');
  assert.equal(requestsOf(first.calls).filter(request => request === 'sb /team_year/9007/2027').length, 1);

  place.at('2027-03-05T16:00:00Z');
  const second = requestsOf(place.run(['--now']).calls);
  assert.ok(!second.includes('sb /team_year/9007/2027'), 'asked for once in 12 hours');
});

test('the key is never in the arguments of curl or in any file, and goes to The Blue Alliance only, on standard input', () => {
  const place = setup('secret', { tools: true });
  world(place);
  const result = place.run();

  [key, token].forEach(value => {
    assert.ok(!result.text.includes(value) && !result.errors.includes(value));
    assert.ok(!result.calls.includes(value), 'a secret is in the arguments of curl');
    filesUnder(place.data).concat(filesUnder(place.temp), filesUnder(path.join(place.stub, 'mutations'))).forEach(file => {
      assert.ok(!fs.readFileSync(file, 'utf8').includes(value), 'a secret is in ' + path.relative(place.root, file));
    });
  });

  const configs = place.configs().split('--\n').slice(0, -1).map(config => config.trim());
  configs.forEach(config => assert.ok(config === '' || config === 'header = "X-TBA-Auth-Key: ' + key + '"' || config === 'header = "Authorization: Bearer ' + token + '"', config));
  assert.ok(configs.filter(config => config === '').length > 10, 'the requests to Statbotics carry nothing on standard input');
});

test('the status keeps team numbers, nicknames and ratings only: no person and no long team name', () => {
  const place = setup('public', { tools: true });
  world(place);
  place.run();

  const text = JSON.stringify(place.document());
  assert.ok(!text.includes('Long sponsor names'));
  assert.ok(!text.includes('Person'));
  const entry = place.document().teams[0];
  assert.deepEqual(Object.keys(entry.field).sort(), ['event', 'teams']);
  assert.deepEqual(Object.keys(entry.schedule.matches[0]).sort(), ['_key', 'alliance', 'label', 'match', 'number', 'opponents', 'partners', 'time', 'winProbability']);
});

// Run them

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
