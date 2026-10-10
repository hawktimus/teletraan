// Tests for deploy/scripts/frc-sync.sh and deploy/scripts/install-frc.sh. The
// tools they use on the Mini (curl, date, flock, id, systemctl) are replaced with
// small fake ones in a temporary folder, so nothing touches the network or the
// machine. jq is the real one, because the scripts depend on what it does, so
// this test needs jq installed. The answers of The Blue Alliance and Statbotics
// are made up here, from the shape their public documentation gives. The team
// numbers, the key and the token are made up too.
//
//   node tools/test-frc-script.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const syncFile = path.join(repo, 'deploy/scripts/frc-sync.sh');
const installFile = path.join(repo, 'deploy/scripts/install-frc.sh');
const unitFiles = ['teletraan-frc.service', 'teletraan-frc.timer'];
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-frc-'));

// The tools the scripts need that are not the ones being faked
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

// status-write.sh is tested in test-status-write.mjs. Here it only has to say it
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

// Makes a copy of the deploy folder and config.js to run in, a folder of tools
// to run with, and returns how to run the scripts.
function setup(name, options) {
  const root = path.join(work, name);
  const bin = path.join(root, 'bin');
  const stub = path.join(root, 'stub');
  const data = path.join(root, 'data');
  const temp = path.join(root, 'tmp');
  fs.mkdirSync(path.join(root, 'deploy/scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'deploy/systemd'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dashboard'), { recursive: true });
  [bin, stub, temp, path.join(stub, 'tba'), path.join(stub, 'sb')].forEach(folder => fs.mkdirSync(folder));
  if (!options.noData) fs.mkdirSync(data);

  const scriptCopy = path.join(root, 'deploy/scripts/frc-sync.sh');
  let text = fs.readFileSync(syncFile, 'utf8');
  (options.edits || []).forEach(edit => {
    assert.ok(text.includes(edit[0]), 'the script has no ' + edit[0]);
    text = text.replace(edit[0], edit[1]);
  });
  fs.writeFileSync(scriptCopy, text, { mode: fs.statSync(syncFile).mode });
  const installCopy = path.join(root, 'deploy/scripts/install-frc.sh');
  fs.copyFileSync(installFile, installCopy);
  fs.chmodSync(installCopy, fs.statSync(installFile).mode);
  writeTool(path.join(root, 'deploy/scripts'), 'status-write.sh', fakeStatusWrite);
  unitFiles.forEach(unit => fs.copyFileSync(path.join(repo, 'deploy/systemd', unit), path.join(root, 'deploy/systemd', unit)));
  fs.copyFileSync(path.join(repo, 'dashboard/config.js'), path.join(root, 'dashboard/config.js'));

  if (!options.noEnv) {
    const env = options.env !== undefined ? options.env : "TELETRAAN_DATA='" + data + "'\nTBA_AUTH_KEY='" + key + "'\nSANITY_WRITE_TOKEN='" + token + "'\nCALENDAR_TEAM_URL='" + secret + "'\n";
    fs.writeFileSync(path.join(root, 'deploy/local.env'), env.replace('<data>', data));
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

// Every request the fake curl got, as 'sanity-query', 'sanity-write', 'tba <address>' or 'sb <address>'
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

function serviceRequests(calls) {
  return requestsOf(calls).filter(request => request.startsWith('tba ') || request.startsWith('sb '));
}

function filesUnder(folder) {
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder, { withFileTypes: true }).reduce((files, entry) => {
    const full = path.join(folder, entry.name);
    return entry.isDirectory() ? files.concat(filesUnder(full)) : files.concat(full);
  }, []);
}

// The made-up world of one event. The team plays 14 matches in the qualifying
// rounds and has played the first 10. The odd matches it is on the red alliance
// and the even ones on the blue. Red scores 40 plus 3 for each match number and
// blue 60 minus 2, so blue wins the first three, the fourth is a tie and red wins
// the rest.
const eventKey = '2027ncwak';
const firstMatchTime = Date.parse('2027-03-13T09:00:00Z') / 1000;
const redOthers = ['frc9001', 'frc9002'];
const blueOthers = ['frc9003', 'frc9004', 'frc9005'];
const partners = ['frc3229'].concat(redOthers);

function nickname(number) {
  return '[Nickname ' + number + ']';
}

// The ratings of the other teams in the next match, as the service gives them and as the status keeps them (two decimals)
const ratingsGiven = { 9001: 30.456, 9002: 28.1, 9003: 25, 9004: 33.337, 9005: 22 };
const ratingOf = { 3229: 55.12, 9001: 30.46, 9002: 28.1, 9003: 25, 9004: 33.34, 9005: 22 };

function matchOf(number, played) {
  const ours = number % 2 === 1;
  const redScore = 40 + 3 * number;
  const blueScore = 60 - 2 * number;
  const red = ours ? partners : ['frc9006', 'frc9007', 'frc9008'];
  const blue = ours ? blueOthers : ['frc3229', 'frc9004', 'frc9005'];
  return {
    key: eventKey + '_qm' + number,
    comp_level: 'qm',
    set_number: 1,
    match_number: number,
    time: firstMatchTime + number * 480,
    predicted_time: firstMatchTime + number * 480 + 60,
    winning_alliance: played ? (redScore > blueScore ? 'red' : redScore < blueScore ? 'blue' : '') : '',
    alliances: {
      red: { score: played ? redScore : -1, team_keys: red },
      blue: { score: played ? blueScore : -1, team_keys: blue },
    },
  };
}

function isoOf(seconds) {
  return new Date(seconds * 1000).toISOString().replace('.000Z', 'Z');
}

// Puts the answers of one team at one event into the stub folder, and Sanity's
// answer with the team. options.played is how many of the 14 matches are over.
function world(place, options) {
  const given = options || {};
  const played = given.played === undefined ? 10 : given.played;
  place.at('2027-03-13T15:00:00Z');
  place.sanity({
    zone: given.zone || 'America/New_York',
    teams: given.teams || [{ code: 'prime', number: '3229' }],
    previous: given.previous || null,
  });

  place.tba('/team/frc3229/events/2027/simple', [
    { key: eventKey, name: '[Sample Regional]', city: '[City]', state_prov: 'NC', start_date: '2027-03-12', end_date: '2027-03-14', event_type: 1 },
  ]);
  const matches = [];
  for (let number = 1; number <= 14; number += 1) matches.push(matchOf(number, number <= played));
  place.tba('/team/frc3229/event/' + eventKey + '/matches', matches);
  place.tba('/event/' + eventKey + '/rankings', {
    rankings: [
      { rank: 1, team_key: 'frc9001', record: { wins: 8, losses: 2, ties: 0 }, matches_played: 10, sort_orders: [2.8, 0, 0] },
      { rank: 4, team_key: 'frc3229', record: { wins: 5, losses: 4, ties: 1 }, matches_played: 10, sort_orders: [1.9, 3, 4] },
      { rank: 8, team_key: 'frc9003', record: { wins: 3, losses: 7, ties: 0 }, matches_played: 10, sort_orders: [1.1, 0, 0] },
    ],
    sort_order_info: [{ name: 'Ranking Score', precision: 2 }],
  });
  place.tba('/event/' + eventKey + '/alliances', given.alliances === undefined ? null : given.alliances);
  const roster = [3229, 9001, 9002, 9003, 9004, 9005, 9006, 9007, 9008].map(number => ({
    key: 'frc' + number, team_number: number, nickname: nickname(number), name: '[Long sponsor names ' + number + ']', city: '[City]',
  }));
  place.tba('/event/' + eventKey + '/teams/simple', roster);
  place.tba('/team/frc3229/awards/2027', [
    { name: '[Sample Award]', award_type: 1, event_key: eventKey, year: 2027, recipient_list: [{ team_key: 'frc3229', awardee: '[Person Name]' }] },
  ]);
  place.statbotics('/team_year/3229/2027', { team: '3229', year: 2027, epa: { total_points: { mean: 55.1234, sd: 5 } } });
  Object.keys(ratingsGiven).forEach(number => place.statbotics('/team_year/' + number + '/2027', { team: number, year: 2027, epa: { total_points: { mean: ratingsGiven[number] } } }));
  for (let number = 11; number <= 14; number += 1) {
    place.statbotics('/match/' + eventKey + '_qm' + number, { key: eventKey + '_qm' + number, pred: { winner: 'red', red_win_prob: 0.6 + number / 1000 } });
  }
  place.tba('/district/2027nc/events/simple', [
    { key: '2027nccmp', name: '[Sample District Championship]', city: '[City]', start_date: '2027-04-09', end_date: '2027-04-10', event_type: 2 },
    { key: eventKey, name: '[Sample Regional]', city: '[City]', start_date: '2027-03-12', end_date: '2027-03-14', event_type: 1 },
  ]);
  place.tba('/district/2027nc/rankings', [
    { team_key: 'frc9001', rank: 1, point_total: 80 },
    { team_key: 'frc9002', rank: 2, point_total: 70 },
    { team_key: 'frc9003', rank: 3, point_total: 60 },
    { team_key: 'frc3229', rank: 5, point_total: 47 },
  ]);
}

const firstSequence = [
  'sanity-query',
  'tba /team/frc3229/events/2027/simple',
  'tba /team/frc3229/event/' + eventKey + '/matches',
  'tba /event/' + eventKey + '/rankings',
  'tba /event/' + eventKey + '/alliances',
  'tba /event/' + eventKey + '/teams/simple',
  'tba /team/frc3229/awards/2027',
  'sb /team_year/3229/2027',
  'sb /match/' + eventKey + '_qm11',
  'sb /match/' + eventKey + '_qm12',
  'sb /match/' + eventKey + '_qm13',
  'sb /team_year/9001/2027',
  'sb /team_year/9002/2027',
  'sb /team_year/9003/2027',
  'sb /team_year/9004/2027',
  'sb /team_year/9005/2027',
  'tba /district/2027nc/events/simple',
  'tba /district/2027nc/rankings',
  'sanity-write',
];

test('one team with one event on: the requests go in the order of the work, and the status is written last', () => {
  const place = setup('sequence', { tools: true });
  world(place);
  const result = place.run();

  assert.equal(result.status, 0, result.errors);
  assert.equal(result.errors, '');
  assert.deepEqual(requestsOf(result.calls), firstSequence);

  const lines = result.calls.trim().split('\n');
  assert.equal(lines[lines.length - 1], 'status-write.sh frc', 'the time goes to status-mini after the status was written');
  assert.equal(place.mutations(), 1);
  assert.ok(result.text.includes('frc: status written'), result.text);
  assert.ok(result.text.includes('team prime: 1 event(s) this season, 1 not over'), result.text);
});

test('the requests are sent to the hosts and addresses of the block at the top, https only, with a time limit', () => {
  const place = setup('flags', { tools: true });
  world(place);
  const result = place.run();
  const lines = result.calls.split('\n').filter(line => line.startsWith('curl '));

  lines.forEach(line => {
    assert.ok(line.startsWith('curl --disable '), 'curl ignores the settings file of the account: ' + line);
    assert.ok(line.includes('--proto =https'), line);
    assert.ok(line.includes('--max-time '), line);
    assert.ok(!line.includes('--location'), 'no redirect is followed: ' + line);
  });
  lines.filter(line => line.includes('thebluealliance.com')).forEach(line => {
    assert.ok(line.includes('https://www.thebluealliance.com/api/v3/'), line);
    assert.ok(line.includes('--config -'), 'the key comes in on standard input: ' + line);
  });
  lines.filter(line => line.includes('statbotics.io')).forEach(line => {
    assert.ok(line.includes('https://api.statbotics.io/v3/'), line);
  });
});

test('Sanity is asked for the teams, the time zone and the last status without a login, and the write goes to the project in config.js', () => {
  const place = setup('sanity', { tools: true });
  world(place);
  const result = place.run();
  const config = fs.readFileSync(path.join(repo, 'dashboard/config.js'), 'utf8');
  const project = config.match(/projectId: '([^']*)'/)[1];
  const dataset = config.match(/dataset: '([^']*)'/)[1];
  const version = config.match(/apiVersion: '([^']*)'/)[1];

  const question = result.calls.split('\n').filter(line => line.includes('/data/query/'))[0];
  assert.ok(question.includes('https://' + project + '.api.sanity.io/v' + version + '/data/query/' + dataset), 'the ordinary host, not the cached one: ' + question);
  assert.ok(question.includes('perspective=published'));
  assert.ok(question.includes('_type == "team"') && question.includes('active != false'), 'only active teams: ' + question);
  assert.ok(question.includes('*[_id == "theme"][0].timeZone') && question.includes('_id == "frc-status"'), question);
  assert.ok(!question.includes('--config'), 'the dataset is public, so the question sends no login');

  const write = result.calls.split('\n').filter(line => line.includes('/data/mutate/'))[0];
  assert.ok(write.includes('--request POST') && write.includes('Content-Type: application/json') && write.includes('--fail'), write);
  assert.ok(write.includes('--config -'), 'the token comes in on standard input: ' + write);
  assert.equal(fs.readFileSync(path.join(place.stub, 'addresses.txt'), 'utf8').trim(), 'https://' + project + '.api.sanity.io/v' + version + '/data/mutate/' + dataset);

  const script = fs.readFileSync(syncFile, 'utf8');
  [project, dataset, version].forEach(value => assert.ok(!script.includes(value), 'the script should not contain ' + value));
});

test('the status document has the fixed id, the team numbers and nicknames, the next match with its win chance, and the last 8 results', () => {
  const place = setup('shape', { tools: true });
  world(place);
  place.run();
  const body = JSON.parse(fs.readFileSync(path.join(place.stub, 'mutations/1.json'), 'utf8'));
  assert.deepEqual(Object.keys(body), ['mutations']);
  assert.equal(body.mutations.length, 1);
  assert.deepEqual(Object.keys(body.mutations[0]), ['createOrReplace']);

  const document = place.document();
  assert.deepEqual(Object.keys(document), ['_id', '_type', 'season', 'lastSyncAt', 'lastError', 'notes', 'districtEvents', 'teams']);
  assert.equal(document._id, 'frc-status');
  assert.equal(document._type, 'frcStatus');
  assert.equal(document.season, 2027);
  assert.equal(document.lastSyncAt, '2027-03-13T15:00:00Z');
  assert.equal(document.lastError, null);
  assert.deepEqual(document.notes, []);
  assert.equal(document.teams.length, 1);

  const team = document.teams[0];
  assert.deepEqual(Object.keys(team), ['team', 'number', 'key', 'events', 'focusEvent', 'nextMatch', 'results', 'ranking', 'alliance', 'awards', 'epa', 'districtPoints', 'snapshots', 'lastSeason', '_key']);
  assert.equal(team.team, 'prime');
  assert.equal(team.number, 3229);
  assert.equal(team.key, 'frc3229');
  assert.equal(team.focusEvent, eventKey);

  assert.deepEqual(team.events, [{
    key: eventKey, name: '[Sample Regional]', city: '[City]', startDate: '2027-03-12', endDate: '2027-03-14',
    rank: 4, teamsRanked: 3, matchesPlayed: 10, record: { wins: 5, losses: 4, ties: 1 }, rankingPoints: 1.9, epa: 55.12, _key: '0',
  }]);

  // Match 11 is the first one not played. The team is on red in the odd ones.
  assert.deepEqual(team.nextMatch, {
    match: eventKey + '_qm11',
    label: 'Q11',
    level: 'qm',
    number: 11,
    time: isoOf(firstMatchTime + 11 * 480),
    alliance: 'red',
    red: [3229, 9001, 9002].map((number, index) => ({ number: number, nickname: nickname(number), epa: ratingOf[number], _key: String(index) })),
    blue: [9003, 9004, 9005].map((number, index) => ({ number: number, nickname: nickname(number), epa: ratingOf[number], _key: String(index) })),
    redWinProbability: 0.611,
  });

  const expected = [];
  for (let number = 3; number <= 10; number += 1) {
    const red = number % 2 === 1;
    const redScore = 40 + 3 * number;
    const blueScore = 60 - 2 * number;
    expected.push({
      match: eventKey + '_qm' + number,
      label: 'Q' + number,
      alliance: red ? 'red' : 'blue',
      scoreFor: red ? redScore : blueScore,
      scoreAgainst: red ? blueScore : redScore,
      won: redScore === blueScore ? null : (redScore > blueScore) === red,
      _key: String(number - 3),
    });
  }
  assert.deepEqual(team.results, expected, 'the last 8 of 10 matches, oldest first, with a tie as null');
  assert.ok(team.results.some(result => result.won === true) && team.results.some(result => result.won === false) && team.results.some(result => result.won === null));

  assert.deepEqual(team.ranking, { event: eventKey, rank: 4, teamsRanked: 3, matchesPlayed: 10, record: { wins: 5, losses: 4, ties: 1 }, rankingPoints: 1.9 });
  assert.equal(team.alliance, null, 'no alliance selection yet');
  assert.deepEqual(team.awards, [{ name: '[Sample Award]', event: eventKey, _key: '0' }]);
  assert.equal(team.epa, 55.12);
  assert.deepEqual(team.districtPoints, { total: 47, rank: 5, cutoff: null });
  assert.deepEqual(team.snapshots, [{ date: '2027-03-13', epa: 55.12, districtPoints: 47, _key: '0' }]);
  assert.equal(team.lastSeason, null);

  assert.deepEqual(document.districtEvents.map(event => [event.key, event.championship]), [[eventKey, false], ['2027nccmp', true]]);
});

test('the status holds team numbers and nicknames only: no person, no award winner, no long team name', () => {
  const place = setup('no-people', { tools: true });
  world(place);
  place.run();
  const text = fs.readFileSync(path.join(place.stub, 'mutations/1.json'), 'utf8');

  ['[Person Name]', 'awardee', 'recipient', '[Long sponsor names', 'sponsor'].forEach(word => {
    assert.ok(!text.includes(word), 'the status should not hold ' + word);
  });
  assert.ok(text.includes('[Nickname 3229]'));
});

test('every object in a list has a _key, so Studio can show the document', () => {
  const place = setup('keys', { tools: true });
  world(place, { alliances: [{ name: 'Alliance 1', picks: ['frc9001', 'frc9002', 'frc9003'] }, { name: 'Alliance 2', picks: ['frc3229', 'frc9004', 'frc9005'] }] });
  place.run();

  function check(value, where) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === 'object') assert.equal(item._key, String(index), where + '[' + index + ']');
        check(item, where + '[' + index + ']');
      });
    } else if (value && typeof value === 'object') {
      Object.keys(value).forEach(name => check(value[name], where + '.' + name));
    }
  }
  check(place.document(), 'document');
});

test('after the alliance selection the team gets its alliance number and partners', () => {
  const place = setup('alliance', { tools: true });
  world(place, {
    alliances: [
      { name: 'Alliance 1', picks: ['frc9001', 'frc9002', 'frc9003'] },
      { name: 'Alliance 2', picks: ['frc9004', 'frc3229', 'frc9005'] },
    ],
  });
  place.run();
  const team = place.document().teams[0];

  assert.deepEqual(team.alliance, {
    event: eventKey,
    number: 2,
    picks: [9004, 3229, 9005].map((number, index) => ({ number: number, nickname: nickname(number), epa: ratingOf[number], _key: String(index) })),
  });

  const left = setup('alliance-left-out', { tools: true });
  world(left, { alliances: [{ name: 'Alliance 1', picks: ['frc9001', 'frc9002', 'frc9003'] }] });
  left.run();
  assert.deepEqual(left.document().teams[0].alliance, { event: eventKey, number: null, picks: [] }, 'made, but this team is not on one');
});

test('the win chance is asked for the next 3 matches only, and a match that has been played gets none', () => {
  const place = setup('odds', { tools: true });
  world(place, { played: 12 });
  const result = place.run();
  const odds = serviceRequests(result.calls).filter(request => request.startsWith('sb /match/'));

  assert.deepEqual(odds, ['sb /match/' + eventKey + '_qm13', 'sb /match/' + eventKey + '_qm14']);
  assert.equal(place.document().teams[0].nextMatch.label, 'Q13');

  const over = setup('odds-over', { tools: true });
  world(over, { played: 14 });
  const finished = over.run();
  assert.deepEqual(serviceRequests(finished.calls).filter(request => request.startsWith('sb /match/')), []);
  assert.equal(over.document().teams[0].nextMatch, null);
  assert.equal(over.document().teams[0].results.length, 8);
});

test('the district cutoff is the points of the team at the place the script is told, and nothing while that is not known', () => {
  const place = setup('cutoff', { tools: true, edits: [['district_slots=\n', 'district_slots=3\n']] });
  world(place);
  place.run();
  assert.deepEqual(place.document().teams[0].districtPoints, { total: 47, rank: 5, cutoff: 60 });

  const tooFar = setup('cutoff-far', { tools: true, edits: [['district_slots=\n', 'district_slots=9\n']] });
  world(tooFar);
  tooFar.run();
  assert.equal(tooFar.document().teams[0].districtPoints.cutoff, null, 'fewer teams than places');
});

test('a team that is not in the district list has no district points', () => {
  const place = setup('no-district', { tools: true });
  world(place);
  place.tba('/district/2027nc/rankings', null);
  place.run();
  assert.equal(place.document().teams[0].districtPoints, null);
});

test('a team that The Blue Alliance does not know is skipped without an error, and one with no number is never asked for', () => {
  const place = setup('skipped', {
    tools: true,
  });
  world(place, {
    teams: [
      { code: 'prime', number: '3229' },
      { code: 'nova', number: '3230' },
      { code: 'blank', number: '' },
      { code: 'ghost' },
      { code: 'letters', number: '32x9' },
      { code: 'long', number: '123456' },
    ],
  });
  const result = place.run();

  assert.equal(result.status, 0, result.errors);
  assert.equal(result.errors, '');
  assert.deepEqual(requestsOf(result.calls).filter(request => request.includes('3230') || request.includes('blank') || request.includes('ghost')), ['tba /team/frc3230/events/2027/simple']);
  assert.ok(result.text.includes('team nova: not found on The Blue Alliance, skipped'), result.text);
  ['blank', 'ghost', 'letters', 'long'].forEach(code => assert.ok(result.text.includes('team ' + code + ': no team number, skipped'), code + '\n' + result.text));
  assert.deepEqual(place.document().teams.map(team => team.team), ['prime']);
  assert.equal(place.document().lastError, null);
  assert.ok(result.calls.includes('status-write.sh frc'), 'a skipped team is not a failed run');
});

test('two teams are read one after the other, a number with spaces is trimmed, and an event both attend is read once', () => {
  const place = setup('two-teams', { tools: true });
  world(place, { teams: [{ code: 'prime', number: '3229' }, { code: 'nova', number: ' 3230 ' }] });
  place.tba('/team/frc3230/events/2027/simple', [
    { key: eventKey, name: '[Sample Regional]', city: '[City]', start_date: '2027-03-12', end_date: '2027-03-14', event_type: 1 },
  ]);
  place.tba('/team/frc3230/event/' + eventKey + '/matches', [matchOf(1, true)]);
  place.tba('/team/frc3230/awards/2027', []);
  place.statbotics('/team_year/3230/2027', { team: '3230', epa: { total_points: { mean: 40 } } });
  const result = place.run();
  const requests = requestsOf(result.calls);

  assert.equal(result.status, 0, result.errors);
  assert.equal(requests.filter(request => request === 'tba /event/' + eventKey + '/rankings').length, 1, 'shared answers are read once');
  assert.ok(requests.includes('tba /team/frc3230/event/' + eventKey + '/matches'));
  assert.deepEqual(place.document().teams.map(team => [team.team, team.number, team.epa]), [['prime', 3229, 55.12], ['nova', 3230, 40]]);
});

test('a team listed twice, or inactive teams the query leaves out, are asked for once', () => {
  const place = setup('twice', { tools: true });
  world(place, { teams: [{ code: 'prime', number: '3229' }, { code: 'copy', number: '3229' }] });
  const result = place.run();

  assert.equal(requestsOf(result.calls).filter(request => request === 'tba /team/frc3229/events/2027/simple').length, 1);
  assert.deepEqual(place.document().teams.map(team => team.team), ['prime']);
});

test('a refusal from Statbotics skips Statbotics, notes it in the status, and the run still works', () => {
  [401, 403].forEach(code => {
    const place = setup('statbotics-refused-' + code, { tools: true });
    world(place);
    place.statbotics('/team_year/3229/2027', { detail: 'no' }, { code: code });
    const result = place.run();

    assert.equal(result.status, 0, result.errors);
    assert.equal(serviceRequests(result.calls).filter(request => request.startsWith('sb ')).length, 1, 'after the refusal Statbotics is not asked again');
    const document = place.document();
    assert.deepEqual(document.notes, ['Statbotics refused the request, so ratings and win chances were skipped.']);
    assert.equal(document.lastError, null, 'a note, not an error');
    assert.equal(document.teams[0].epa, null);
    assert.equal(document.teams[0].nextMatch.redWinProbability, null);
    assert.equal(document.teams[0].nextMatch.label, 'Q11', 'The Blue Alliance data is all there');
    assert.ok(result.calls.includes('status-write.sh frc'));
  });
});

test('a missing rating or win chance is null, and the other answers are not touched', () => {
  const place = setup('statbotics-404', { tools: true });
  world(place);
  place.statbotics('/team_year/3229/2027', undefined);
  place.statbotics('/match/' + eventKey + '_qm11', undefined);
  const result = place.run();

  assert.equal(result.status, 0, result.errors);
  const team = place.document().teams[0];
  assert.equal(team.epa, null);
  assert.equal(team.nextMatch.redWinProbability, null);
  assert.equal(team.districtPoints.total, 47);
  assert.deepEqual(place.document().notes, []);
});

test('a run stops after 60 requests, says so, and the next run carries on where it stopped', () => {
  const place = setup('limit', { tools: true });
  place.at('2027-03-13T15:00:00Z');
  place.sanity({ zone: 'America/New_York', teams: [{ code: 'prime', number: '3229' }], previous: null });
  const events = [];
  for (let number = 1; number <= 20; number += 1) {
    events.push({ key: '2027ncx' + String(number).padStart(2, '0'), name: '[Event ' + number + ']', city: '[City]', start_date: '2027-05-01', end_date: '2027-05-02', event_type: 0 });
  }
  place.tba('/team/frc3229/events/2027/simple', events);

  const first = place.run();
  const firstRequests = serviceRequests(first.calls);
  assert.equal(first.status, 0, first.errors);
  assert.equal(firstRequests.length, 60, 'exactly the limit');
  assert.equal(place.state().unfinished, true);
  assert.deepEqual(place.document(1).notes, ['This run stopped after 60 requests and goes on at the next run.']);
  assert.ok(first.calls.includes('status-write.sh frc'), 'what was read is written');

  // 20 events of 4 answers, the events, the awards, the rating and the 2 district answers
  place.at('2027-03-13T15:05:00Z');
  const second = place.run();
  const secondRequests = serviceRequests(second.calls);
  assert.equal(second.status, 0, second.errors);
  assert.equal(firstRequests.length + secondRequests.length, 1 + 80 + 1 + 1 + 2);
  assert.deepEqual(firstRequests.filter(request => secondRequests.includes(request)), [], 'nothing is asked twice');
  assert.equal(place.state().unfinished, false, 'the pass is finished');
  assert.deepEqual(place.document().notes, []);

  place.at('2027-03-13T15:10:00Z');
  const third = place.run();
  assert.equal(third.status, 0);
  assert.deepEqual(requestsOf(third.calls), [], 'with no event on, the next run is an hour away');
});

test('the limit counts the answers that say nothing changed, and the run after a finished pass starts again from the top', () => {
  const place = setup('limit-again', { tools: true });
  world(place);
  place.run();
  place.at('2027-03-13T15:05:00Z');
  const second = place.run();

  assert.deepEqual(serviceRequests(second.calls).length, 17, 'the whole list is asked again, one request each: 12, and the 5 other teams of the next match');
  assert.equal(place.state().unfinished, false);
});

test('the ETag of each answer is kept, sent back with the next request, and an answer of 304 changes nothing', () => {
  const place = setup('etags', { tools: true });
  world(place);
  place.run();

  const etags = JSON.parse(fs.readFileSync(path.join(place.frc, 'etags.json'), 'utf8'));
  assert.equal(etags['tba-events-2027-frc3229'], '"team_frc3229_events_2027_simple-1"');
  assert.equal(etags['tba-rankings-' + eventKey], '"event_' + eventKey + '_rankings-1"');
  assert.ok(!Object.keys(etags).some(name => name.startsWith('statbotics-')), 'Statbotics sends none');
  assert.ok(fs.statSync(path.join(place.frc, 'etags.json')).size < 4000, 'a small file');

  place.at('2027-03-13T15:05:00Z');
  const second = place.run();
  const lines = second.calls.split('\n').filter(line => line.startsWith('curl ') && line.includes('thebluealliance.com'));

  assert.equal(second.status, 0, second.errors);
  assert.equal(lines.length, 8);
  lines.forEach(line => {
    const address = line.match(/\/api\/v3(\S+)$/)[1];
    assert.ok(line.includes('--header If-None-Match: "' + slugOf(address) + '-1"'), 'the ETag goes back: ' + line);
  });
  assert.equal(place.mutations(), 1, 'nothing changed, so nothing was written');
  assert.ok(second.text.includes('frc: nothing changed, status not written'), second.text);
  assert.ok(second.calls.includes('status-write.sh frc'), 'the Mini still looked, and says so');
  assert.deepEqual(place.document(1).teams, place.document().teams);
});

test('only an answer that changed is read again: the status is rewritten with it and the rest stays', () => {
  const place = setup('one-changed', { tools: true });
  world(place);
  place.run();

  place.tba('/event/' + eventKey + '/rankings', {
    rankings: [{ rank: 2, team_key: 'frc3229', record: { wins: 6, losses: 4, ties: 0 }, matches_played: 10, sort_orders: [2.1] }],
  }, { etag: '"changed"' });
  place.at('2027-03-13T15:05:00Z');
  const second = place.run();

  assert.equal(second.status, 0, second.errors);
  assert.equal(place.mutations(), 2);
  const team = place.document().teams[0];
  assert.equal(team.ranking.rank, 2);
  assert.equal(team.ranking.rankingPoints, 2.1);
  assert.equal(team.nextMatch.label, 'Q11', 'the matches were not asked for again, and are still there');
  assert.equal(JSON.parse(fs.readFileSync(path.join(place.frc, 'etags.json'), 'utf8'))['tba-rankings-' + eventKey], '"changed"');
});

test('the status is written again after 45 minutes even when nothing changed, so its time shows the Mini is looking', () => {
  const place = setup('refresh', { tools: true });
  world(place);
  place.run();

  place.at('2027-03-13T15:30:00Z');
  place.run();
  assert.equal(place.mutations(), 1, 'after 30 minutes it waits');

  place.at('2027-03-13T15:46:00Z');
  const result = place.run();
  assert.equal(result.status, 0, result.errors);
  assert.equal(place.mutations(), 2);
  assert.equal(place.document().lastSyncAt, '2027-03-13T15:46:00Z');
  assert.deepEqual(place.document(1).teams, place.document(2).teams);
});

test('answers that nothing asked for in the last run are not kept, and the others stay', () => {
  const place = setup('prune', { tools: true });
  world(place);
  place.run();
  const names = fs.readdirSync(path.join(place.frc, 'cache'));
  assert.ok(names.includes('tba-rankings-' + eventKey + '.json'));

  place.at('2027-03-13T15:05:00Z');
  fs.writeFileSync(path.join(place.frc, 'cache/tba-matches-frc1111-2027old.json'), '[]');
  fs.writeFileSync(path.join(place.frc, 'etags.json'), JSON.stringify(Object.assign(JSON.parse(fs.readFileSync(path.join(place.frc, 'etags.json'), 'utf8')), { 'tba-matches-frc1111-2027old': '"old"' })));
  place.run();

  assert.deepEqual(fs.readdirSync(path.join(place.frc, 'cache')).sort(), names.sort());
  assert.ok(!('tba-matches-frc1111-2027old' in JSON.parse(fs.readFileSync(path.join(place.frc, 'etags.json'), 'utf8'))));
});

test('the daily snapshot list keeps the last 120 entries, drops bad ones, and a second run on the same day replaces the day', () => {
  const dates = [];
  for (let day = 0; day < 125; day += 1) dates.push(new Date(Date.UTC(2026, 10, 1 + day)).toISOString().slice(0, 10));
  const previous = {
    season: 2027,
    teams: [{
      team: 'prime',
      snapshots: dates.map((date, index) => ({ date: date, epa: 30 + index / 10, districtPoints: index, _key: String(index) }))
        .concat([{ date: 'yesterday', epa: 1 }, { epa: 2 }, 'text', null]),
    }],
  };
  const place = setup('snapshots', { tools: true });
  world(place, { previous: previous });
  place.run();
  const snapshots = place.document().teams[0].snapshots;

  assert.equal(snapshots.length, 120);
  assert.deepEqual(snapshots[119], { date: '2027-03-13', epa: 55.12, districtPoints: 47, _key: '119' });
  assert.equal(snapshots[0].date, dates[6], 'the oldest 6 were dropped');
  assert.ok(snapshots.every(snapshot => /^\d{4}-\d\d-\d\d$/.test(snapshot.date)));
  assert.deepEqual(snapshots.map(snapshot => snapshot.date), snapshots.map(snapshot => snapshot.date).slice().sort());

  // The next run reads what this one wrote, as Sanity would answer it
  place.sanity({ zone: 'America/New_York', teams: [{ code: 'prime', number: '3229' }], previous: place.document() });
  place.statbotics('/team_year/3229/2027', { epa: { total_points: { mean: 57 } } });
  place.at('2027-03-13T16:00:00Z');
  place.run('--now'.split(' '));
  const again = place.document().teams[0].snapshots;
  assert.equal(again.length, 120, 'the same day is not added twice');
  assert.deepEqual(again.slice(0, 119).map(snapshot => snapshot.date), snapshots.slice(0, 119).map(snapshot => snapshot.date));
  assert.equal(again[119].epa, 57);

  place.sanity({ zone: 'America/New_York', teams: [{ code: 'prime', number: '3229' }], previous: place.document() });
  place.at('2027-03-14T16:00:00Z');
  place.run(['--now']);
  const next = place.document().teams[0].snapshots;
  assert.equal(next.length, 120);
  assert.equal(next[119].date, '2027-03-14');
  assert.equal(next[118].date, '2027-03-13');
});

test('a day with no rating and no district points adds no snapshot', () => {
  const place = setup('snapshot-empty', { tools: true });
  world(place);
  place.statbotics('/team_year/3229/2027', undefined);
  place.tba('/district/2027nc/rankings', []);
  place.run();
  assert.deepEqual(place.document().teams[0].snapshots, []);
});

test('the events of the season before are kept for the glance back when the year changes, and the rank of an event that is over stays', () => {
  const lastYear = [{ key: '2026ncwak', name: '[Old Regional]', city: '[City]', startDate: '2026-03-12', endDate: '2026-03-14', rank: 3, teamsRanked: 40, matchesPlayed: 12, record: { wins: 8, losses: 4, ties: 0 }, rankingPoints: 2.2, _key: '0' }];
  const place = setup('last-season', { tools: true });
  world(place, { previous: { season: 2026, teams: [{ team: 'prime', events: lastYear, snapshots: [] }] } });
  place.run();
  const team = place.document().teams[0];

  assert.equal(team.lastSeason.season, 2026);
  assert.equal(team.lastSeason.events.length, 1);
  assert.equal(team.lastSeason.events[0].rank, 3);
  assert.equal(team.lastSeason.events[0].name, '[Old Regional]');

  // Later in the same season it carries on unchanged
  place.sanity({ zone: 'America/New_York', teams: [{ code: 'prime', number: '3229' }], previous: place.document() });
  place.statbotics('/team_year/3229/2027', { epa: { total_points: { mean: 58 } } });
  place.at('2027-03-13T16:00:00Z');
  place.run(['--now']);
  assert.equal(place.document().teams[0].lastSeason.season, 2026);

  // An event that ended keeps the rank it had, and is not asked for again
  const over = setup('event-over', { tools: true });
  world(over);
  over.run();
  over.sanity({ zone: 'America/New_York', teams: [{ code: 'prime', number: '3229' }], previous: over.document() });
  over.at('2027-03-16T12:00:00Z');
  const after = over.run();
  assert.ok(!serviceRequests(after.calls).some(request => /\/event\//.test(request)), 'an event that is over is not asked for: ' + serviceRequests(after.calls));
  const team2 = over.document().teams[0];
  assert.equal(team2.events[0].rank, 4);
  assert.equal(team2.events[0].epa, 55.12, 'and the rating it had');
  assert.equal(team2.focusEvent, null);
  assert.equal(team2.nextMatch, null);
  assert.equal(team2.ranking, null);
  assert.equal(team2.results.length, 0);
});

test('the rating of an event is read while the event is on, kept after it, and empty before it starts', () => {
  const place = setup('event-ratings', { tools: true });
  world(place);
  place.tba('/team/frc3229/events/2027/simple', [
    { key: '2027ncold', name: '[Old Event]', city: '[City]', start_date: '2027-03-05', end_date: '2027-03-07', event_type: 1 },
    { key: eventKey, name: '[Sample Regional]', city: '[City]', start_date: '2027-03-12', end_date: '2027-03-14', event_type: 1 },
    { key: '2027nclate', name: '[Late Event]', city: '[City]', start_date: '2027-04-02', end_date: '2027-04-04', event_type: 1 },
  ]);
  const earlier = [{ key: '2027ncold', startDate: '2027-03-05', endDate: '2027-03-07', rank: 9, epa: 41.5, _key: '0' }];
  place.sanity({ zone: 'America/New_York', teams: [{ code: 'prime', number: '3229' }], previous: { season: 2027, teams: [{ team: 'prime', events: earlier, snapshots: [] }] } });
  const result = place.run();

  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(place.document().teams[0].events.map(event => [event.key, event.epa]), [['2027ncold', 41.5], [eventKey, 55.12], ['2027nclate', null]]);
  assert.equal(place.document().teams[0].events[0].rank, 9, 'the rank of the event that is over stays too');
});

test('the other teams of the next match are asked for their rating once each, and a team the service does not know has none', () => {
  const place = setup('rivals', { tools: true });
  world(place);
  place.statbotics('/team_year/9003/2027', undefined);
  const result = place.run();
  const asked = serviceRequests(result.calls).filter(request => request.startsWith('sb /team_year/'));

  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(asked, ['sb /team_year/3229/2027', 'sb /team_year/9001/2027', 'sb /team_year/9002/2027', 'sb /team_year/9003/2027', 'sb /team_year/9004/2027', 'sb /team_year/9005/2027'], 'ours once, and the five others');
  const match = place.document().teams[0].nextMatch;
  assert.deepEqual(match.red.map(person => person.epa), [55.12, 30.46, 28.1]);
  assert.deepEqual(match.blue.map(person => person.epa), [null, 33.34, 22]);

  // a team that has no match to come asks for no one
  const over = setup('rivals-none', { tools: true });
  world(over, { played: 14 });
  const none = serviceRequests(over.run().calls).filter(request => request.startsWith('sb /team_year/'));
  assert.deepEqual(none, ['sb /team_year/3229/2027']);

  // when the service refuses, no rating is asked for at all, and the match keeps its teams without one
  const refused = setup('rivals-refused', { tools: true });
  world(refused);
  refused.statbotics('/team_year/3229/2027', {}, { code: 403 });
  const skipped = refused.run();
  assert.deepEqual(serviceRequests(skipped.calls).filter(request => request.startsWith('sb ')), ['sb /team_year/3229/2027']);
  assert.deepEqual(refused.document().teams[0].nextMatch.red.map(person => person.epa), [null, null, null]);
});

test('a team key in the next match that is not plain is never asked for', () => {
  const place = setup('rivals-odd', { tools: true });
  world(place);
  const odd = Object.assign(matchOf(11, false), {
    alliances: {
      red: { score: -1, team_keys: ['frc3229', 'frc9001', 'frc9002;touch PWNED', 'frc../1', 'frc012345', 'frc123456', 'frc9002\n', 'frcX', 7, null] },
      blue: { score: -1, team_keys: ['frc9003', 'frc9004', 'frc9005'] },
    },
  });
  const matches = [];
  for (let number = 1; number <= 14; number += 1) matches.push(number === 11 ? odd : matchOf(number, number <= 10));
  place.tba('/team/frc3229/event/' + eventKey + '/matches', matches);
  const result = place.run();

  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(serviceRequests(result.calls).filter(request => request.startsWith('sb /team_year/')), ['sb /team_year/3229/2027', 'sb /team_year/9001/2027', 'sb /team_year/9003/2027', 'sb /team_year/9004/2027', 'sb /team_year/9005/2027']);
  assert.ok(!result.calls.includes('PWNED'));
  assert.ok(!fs.existsSync(path.join(place.root, 'PWNED')) && !fs.existsSync(path.join(place.data, 'PWNED')) && !fs.existsSync(path.join(place.frc, 'PWNED')));
});

test('a refused key stops the run at once, is written as the error, and the time of the run is not sent to status-mini', () => {
  const place = setup('refused', { tools: true });
  world(place);
  place.tba('/team/frc3229/events/2027/simple', { Error: 'no' }, { code: 401 });
  const result = place.run();

  assert.equal(result.status, 1);
  assert.deepEqual(serviceRequests(result.calls), ['tba /team/frc3229/events/2027/simple'], 'the first refusal ends the asking');
  assert.ok(result.errors.includes('frc: The Blue Alliance refused the key. Check TBA_AUTH_KEY in local.env.'), result.errors);
  assert.ok(!result.calls.includes('status-write.sh'));
  const document = place.document();
  assert.equal(document.lastError, 'The Blue Alliance refused the key. Check TBA_AUTH_KEY in local.env.');
  assert.deepEqual(document.teams[0].events, []);
});

test('three failed requests in a row stop the run, and the cause is in the error', () => {
  const place = setup('network', { tools: true });
  world(place);
  ['/team/frc3229/events/2027/simple', '/district/2027nc/events/simple', '/district/2027nc/rankings'].forEach(address => place.tba(address, [], { exit: 6 }));
  const result = place.run();

  assert.equal(result.status, 1);
  assert.equal(serviceRequests(result.calls).length, 3);
  assert.ok(result.errors.includes('The Blue Alliance did not answer, could not find the server, so the network may be down.'), result.errors);
  assert.ok(!result.calls.includes('status-write.sh'));
  assert.ok(place.document().lastError.includes('network may be down'));
  assert.equal(place.state().unfinished, false);
});

test('one answer that fails is an error but does not stop the others', () => {
  const place = setup('one-failed', { tools: true });
  world(place);
  place.tba('/event/' + eventKey + '/rankings', { Error: 'broken' }, { code: 500 });
  const result = place.run();

  assert.equal(result.status, 1, 'the failing exit shows in systemctl status');
  assert.ok(result.errors.includes('The Blue Alliance answered with code 500 (tba-rankings-' + eventKey + ').'), result.errors);
  assert.equal(serviceRequests(result.calls).length, 17, 'the run went on');
  assert.equal(place.document().teams[0].ranking, null);
  assert.equal(place.document().teams[0].nextMatch.label, 'Q11');
  assert.ok(result.calls.includes('status-write.sh frc'), 'most of it worked');

  const bad = setup('not-data', { tools: true });
  world(bad);
  fs.writeFileSync(path.join(bad.stub, 'tba', 'event_' + eventKey + '_alliances.json'), '<html>Sorry</html>');
  const html = bad.run();
  assert.equal(html.status, 1);
  assert.ok(html.errors.includes('sent an answer that is not data'), html.errors);
});

test('too many requests (429) stops the run and it carries on at the next one', () => {
  const place = setup('rate-limit', { tools: true });
  world(place);
  place.tba('/event/' + eventKey + '/rankings', {}, { code: 429 });
  const result = place.run();

  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('too many requests'), result.errors);
  assert.equal(place.state().unfinished, true);
  assert.equal(serviceRequests(result.calls).length, 3);
});

test('a status that cannot be written is reported, status-mini is not told, and the next run writes it again', () => {
  const place = setup('write-fails', { tools: true });
  world(place);
  fs.writeFileSync(path.join(place.stub, 'mutate.exit'), '22');
  const refused = place.run();

  assert.equal(refused.status, 1);
  assert.ok(refused.errors.includes('Sanity refused the status, so the token may be wrong or may not have Editor access.'), refused.errors);
  assert.ok(!refused.calls.includes('status-write.sh'));
  assert.ok(!fs.existsSync(path.join(place.frc, 'written.json')));

  fs.rmSync(path.join(place.stub, 'mutate.exit'));
  place.at('2027-03-13T15:05:00Z');
  const again = place.run();
  assert.equal(again.status, 0, again.errors);
  assert.equal(place.mutations(), 2);
  assert.ok(again.calls.includes('status-write.sh frc'));

  const down = setup('write-down', { tools: true });
  world(down);
  fs.writeFileSync(path.join(down.stub, 'mutate.exit'), '28');
  const slow = down.run();
  assert.ok(slow.errors.includes('could not write the status, the server took too long to answer.'), slow.errors);
});

test('the key and the token are never in the output, the arguments of curl, or any file the script writes, and only standard input carries them', () => {
  const runs = [
    { name: 'good', set: place => place },
    { name: 'refused', set: place => place.tba('/team/frc3229/events/2027/simple', {}, { code: 401 }) },
    { name: 'network', set: place => place.tba('/team/frc3229/events/2027/simple', [], { exit: 28 }) },
    { name: 'server-error', set: place => place.tba('/event/' + eventKey + '/rankings', {}, { code: 500 }) },
    { name: 'write-refused', set: place => fs.writeFileSync(path.join(place.stub, 'mutate.exit'), '22') },
    { name: 'statbotics', set: place => place.statbotics('/team_year/3229/2027', {}, { code: 401 }) },
  ];

  runs.forEach(item => {
    const place = setup('secret-' + item.name, { tools: true });
    world(place);
    item.set(place);
    const result = place.run();

    [key, token, secret, 'SECRET-FEED'].forEach(value => {
      assert.ok(!result.text.includes(value) && !result.errors.includes(value), item.name + ': a secret is in the output');
      assert.ok(!result.calls.includes(value), item.name + ': a secret is in the arguments of curl');
      filesUnder(place.data).concat(filesUnder(place.temp), filesUnder(path.join(place.stub, 'mutations'))).forEach(file => {
        assert.ok(!fs.readFileSync(file, 'utf8').includes(value), item.name + ': a secret is in ' + path.relative(place.root, file));
      });
    });
    assert.ok(!result.calls.includes('SANITY_WRITE_TOKEN') && !result.calls.includes('TBA_AUTH_KEY'));

    // The key reaches curl on standard input for The Blue Alliance only, and the token for the write only
    const configs = place.configs().split('--\n').slice(0, -1);
    assert.ok(configs.some(config => config.trim() === 'header = "X-TBA-Auth-Key: ' + key + '"'), item.name);
    configs.forEach(config => {
      assert.ok(config.trim() === '' || config.trim() === 'header = "X-TBA-Auth-Key: ' + key + '"' || config.trim() === 'header = "Authorization: Bearer ' + token + '"', item.name + ': ' + config);
    });
  });
});

test('the key goes to The Blue Alliance only: Statbotics and Sanity questions carry none', () => {
  const place = setup('key-only-tba', { tools: true });
  world(place);
  place.run();
  const configs = place.configs().split('--\n').slice(0, -1);
  const requests = requestsOf(fs.readFileSync(place.log, 'utf8'));
  const withConfig = requests.filter(request => request !== 'sanity-query');

  assert.equal(configs.length, withConfig.length);
  withConfig.forEach((request, index) => {
    if (request.startsWith('tba ')) assert.ok(configs[index].includes(key), request);
    else if (request.startsWith('sb ')) assert.equal(configs[index].trim(), '', request);
    else assert.ok(configs[index].includes('Bearer ' + token) && !configs[index].includes(key), request);
  });
});

test('text from the services never reaches a shell or an address: an odd event key, match key or team name is inert', () => {
  const place = setup('inert', { tools: true });
  world(place);
  place.tba('/team/frc3229/events/2027/simple', [
    { key: eventKey, name: '$(touch PWNED)', city: '`touch PWNED`', start_date: '2027-03-12', end_date: '2027-03-14', event_type: 1 },
    { key: '2027nc;touch PWNED', name: 'a', start_date: '2027-03-12', end_date: '2027-03-14' },
    { key: '../../evil', name: 'b', start_date: '2027-03-12', end_date: '2027-03-14' },
    { key: '2027 spaced', name: 'c', start_date: '2027-03-12', end_date: '2027-03-14' },
    { key: '2027nc\nline', name: 'd', start_date: '2027-03-12', end_date: '2027-03-14' },
    { key: '2027ncx\n', name: 'f', start_date: '2027-03-12', end_date: '2027-03-14' },
    { key: '2027UPPER', name: 'e', start_date: '2027-03-12', end_date: '2027-03-14' },
  ]);
  const matches = [matchOf(11, false), Object.assign(matchOf(12, false), { key: eventKey + '_qm12;touch PWNED' }), Object.assign(matchOf(13, false), { key: '../x' }), Object.assign(matchOf(14, false), { key: eventKey + '_qm14\n' })];
  place.tba('/team/frc3229/event/' + eventKey + '/matches', matches);
  const result = place.run();

  assert.equal(result.status, 0, result.errors);
  const requests = requestsOf(result.calls);
  assert.ok(!result.calls.includes('PWNED') || result.calls.split('\n').every(line => !line.startsWith('curl ') || !line.includes('PWNED')), 'no unchecked text is an argument');
  assert.ok(!requests.some(request => /PWNED|evil|spaced|line|UPPER|\.\.|2027ncx|\/event\/2027nc\//.test(request)), requests.join('\n'));
  assert.ok(!fs.existsSync(path.join(place.root, 'PWNED')) && !fs.existsSync(path.join(place.data, 'PWNED')) && !fs.existsSync(path.join(place.frc, 'PWNED')));
  assert.deepEqual(requests.filter(request => request.startsWith('sb /match/')), ['sb /match/' + eventKey + '_qm11'], 'a key with a line break is not a key');
  assert.equal(place.document().teams[0].events[0].name, '$(touch PWNED)', 'it is only text in the status');
});

test('a team code or number that is not plain never reaches an address', () => {
  const place = setup('odd-team', { tools: true });
  world(place, { teams: [{ code: 'prime', number: '3229' }, { code: 'bad;code', number: '3230' }, { code: 'ok', number: '3230; touch PWNED' }, { code: 'UPPER', number: '3231' }, { code: 'trail\n', number: '3232' }, { code: 'line', number: '3233\n' }] });
  const result = place.run();

  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(requestsOf(result.calls).filter(request => request.includes('/team/')).filter(request => !request.includes('frc3229')), []);
  assert.deepEqual(requestsOf(result.calls).filter(request => /\/frc(\/|$)|3232|3233/.test(request)), []);
  assert.ok(!result.calls.includes('PWNED'));
});

test('the time zone of the Look page decides the day and the season', () => {
  const place = setup('zone', { tools: true });
  world(place, { zone: 'America/Chicago' });
  place.at('2026-12-31T23:30:00Z', '2026-12-31');
  place.tba('/team/frc3229/events/2026/simple', []);
  place.tba('/district/2026nc/events/simple', []);
  place.tba('/district/2026nc/rankings', []);
  place.tba('/team/frc3229/awards/2026', []);
  place.statbotics('/team_year/3229/2026', undefined);
  const result = place.run();

  assert.ok(result.calls.includes('date TZ=America/Chicago +%Y'), result.calls);
  assert.ok(result.calls.includes('date TZ=America/Chicago +%Y-%m-%d'));
  assert.ok(requestsOf(result.calls).includes('tba /team/frc3229/events/2026/simple'), 'the season is the year where the screen is');
  assert.equal(place.document().season, 2026);

  const odd = setup('zone-odd', { tools: true });
  world(odd, { zone: 'America/New York; touch PWNED' });
  const fallback = odd.run();
  assert.ok(fallback.calls.includes('date TZ=America/New_York +%Y'), 'a zone that is not a plain name is not used');
  assert.ok(!fallback.calls.includes('PWNED'));
});

test('it is only time to run once an hour, every 5 minutes while an event is on, and at once after a run that was cut short', () => {
  const place = setup('timing', { tools: true });
  world(place);
  place.tba('/team/frc3229/events/2027/simple', [{ key: eventKey, name: '[Sample Regional]', city: '[City]', start_date: '2027-04-23', end_date: '2027-04-25', event_type: 1 }]);
  place.at('2027-03-13T15:00:00Z');

  const first = place.run();
  assert.ok(requestsOf(first.calls).length > 0, 'with no earlier run it is time');
  assert.equal(place.state().lastRunAt, Math.floor(Date.parse('2027-03-13T15:00:00Z') / 1000));

  function runAt(utc, args) {
    place.at(utc);
    return place.run(args);
  }

  const soon = runAt('2027-03-13T15:05:00Z');
  assert.equal(soon.status, 0);
  assert.equal(soon.text, '', 'quiet');
  assert.deepEqual(requestsOf(soon.calls.split('\n').filter(line => !line.startsWith('date ')).join('\n')), []);
  assert.equal(requestsOf(runAt('2027-03-13T15:49:00Z').calls).length, 0, 'no event, 49 minutes');
  assert.ok(requestsOf(runAt('2027-03-13T15:51:00Z').calls).length > 0, 'no event, 51 minutes');

  // Now an event is on today
  place.tba('/team/frc3229/events/2027/simple', [{ key: eventKey, name: '[Sample Regional]', city: '[City]', start_date: '2027-03-12', end_date: '2027-03-14', event_type: 1 }], { etag: '"moved"' });
  runAt('2027-03-13T17:00:00Z', ['--now']);
  assert.equal(requestsOf(runAt('2027-03-13T17:03:00Z').calls).length, 0, 'an event is on, 3 minutes');
  assert.ok(requestsOf(runAt('2027-03-13T17:05:00Z').calls).length > 0, 'an event is on, 5 minutes');

  // The first and last day count
  place.at('2027-03-14T22:00:00Z', '2027-03-14');
  place.run(['--now']);
  place.at('2027-03-14T22:05:00Z', '2027-03-14');
  assert.ok(requestsOf(place.run().calls).length > 0, 'the last day is a day of the event');
  place.at('2027-03-14T23:50:00Z', '2027-03-14');
  place.run(['--now']);
  place.at('2027-03-14T23:56:00Z', '2027-03-15');
  assert.equal(requestsOf(place.run().calls).length, 0, 'the day after is not');
});

test('the day of an event is read in the time zone the last run saw, not by the clock of the Mini', () => {
  const place = setup('timing-zone', { tools: true });
  world(place, { zone: 'America/Los_Angeles' });
  place.run();
  place.at('2027-03-13T15:05:00Z');
  const result = place.run();

  assert.ok(result.calls.includes('date TZ=America/Los_Angeles +%Y-%m-%d'), result.calls);
});

test('a run cut short by the limit does not wait for the hour, and a damaged state file means it is time', () => {
  const place = setup('state', { tools: true });
  world(place);
  place.run();
  fs.writeFileSync(path.join(place.frc, 'state.json'), '{"unfinished": true, "lastRunAt": ' + Math.floor(Date.parse('2027-03-13T15:00:00Z') / 1000) + ', "windows": []}');
  place.at('2027-03-13T15:01:00Z');
  assert.ok(requestsOf(place.run().calls).length > 0, 'unfinished');

  fs.writeFileSync(path.join(place.frc, 'state.json'), 'not json at all');
  place.at('2027-03-13T15:02:00Z');
  const damaged = place.run();
  assert.equal(damaged.status, 0, damaged.errors);
  assert.ok(requestsOf(damaged.calls).length > 0, 'a damaged file is replaced');
  assert.equal(place.state().unfinished, false);

  // A clock that went back is not a reason to wait
  place.at('2027-03-13T14:00:00Z');
  assert.ok(requestsOf(place.run().calls).length > 0, 'the clock moved back');
});

test('--now runs whatever the time, and a run that is not due changes nothing at all', () => {
  const place = setup('now', { tools: true });
  world(place);
  place.run();
  const files = () => filesUnder(place.frc).filter(file => !file.endsWith('.lock')).map(file => [file, fs.statSync(file).mtimeMs]);
  const before = JSON.stringify(files());

  place.at('2027-03-13T15:01:00Z');
  const quiet = place.run();
  assert.equal(quiet.status, 0);
  assert.equal(quiet.text + quiet.errors, '');
  assert.equal(requestsOf(quiet.calls).length, 0);
  assert.equal(JSON.stringify(files()), before);

  const forced = place.run(['--now']);
  assert.ok(requestsOf(forced.calls).length > 0);
});

test('without TBA_AUTH_KEY or SANITY_WRITE_TOKEN the timer ends without an error and asks for nothing, and a run by hand fails and says why', () => {
  const cases = {
    'no local.env': { noEnv: true },
    'no key': { env: "TELETRAAN_DATA='<data>'\nSANITY_WRITE_TOKEN='" + token + "'\n" },
    'an empty key': { env: "TELETRAAN_DATA='<data>'\nTBA_AUTH_KEY=''\nSANITY_WRITE_TOKEN='" + token + "'\n" },
    'the placeholder key': { env: "TELETRAAN_DATA='<data>'\nTBA_AUTH_KEY='[paste the read key here]'\nSANITY_WRITE_TOKEN='" + token + "'\n" },
    'no token': { env: "TELETRAAN_DATA='<data>'\nTBA_AUTH_KEY='" + key + "'\n" },
    'the placeholder token': { env: "TELETRAAN_DATA='<data>'\nTBA_AUTH_KEY='" + key + "'\nSANITY_WRITE_TOKEN='[paste the Sanity write token here]'\n" },
  };

  Object.keys(cases).forEach(name => {
    const place = setup('unset-' + name.replace(/\W+/g, '-'), Object.assign({ tools: true }, cases[name]));
    world(place);
    const timer = place.run();
    assert.equal(timer.status, 0, name);
    assert.ok(timer.text.includes('is not in local.env yet, so nothing was read. See docs/frc-feed.md.'), name + ': ' + timer.text);
    assert.equal(requestsOf(timer.calls).length, 0, name);
    assert.ok(!timer.calls.includes('status-write.sh'), name);
    assert.deepEqual(fs.existsSync(path.join(place.frc, 'state.json')), false, name);

    const hand = place.run(['--now']);
    assert.equal(hand.status, 1, name);
    assert.equal(requestsOf(hand.calls).length, 0, name);
  });
});

test('a key or token with odd characters is refused before curl is called, without being printed', () => {
  ['abc"def', 'abc def', 'abc;rm', 'a$(id)b'].forEach((odd, index) => {
    ['TBA_AUTH_KEY', 'SANITY_WRITE_TOKEN'].forEach(name => {
      const env = name === 'TBA_AUTH_KEY'
        ? "TELETRAAN_DATA='<data>'\nTBA_AUTH_KEY=" + odd + "\nSANITY_WRITE_TOKEN='" + token + "'\n"
        : "TELETRAAN_DATA='<data>'\nTBA_AUTH_KEY='" + key + "'\nSANITY_WRITE_TOKEN=" + odd + "\n";
      const place = setup('odd-' + name + '-' + index, { tools: true, env: env });
      world(place);
      const result = place.run();

      assert.equal(result.status, 1, odd + ' in ' + name);
      assert.ok(result.errors.includes(name + ' in local.env does not look like a key'), result.errors);
      assert.equal(requestsOf(result.calls).length, 0);
      assert.ok(!result.errors.includes(odd) && !result.text.includes(odd), 'the odd value was printed');
    });
  });
});

test('quotes around the key in local.env are not part of it, and the last key line wins', () => {
  [`TBA_AUTH_KEY='${key}'\n`, `TBA_AUTH_KEY="${key}"\n`, `TBA_AUTH_KEY=${key}\n`, `TBA_AUTH_KEY='tbaOLDkey'\nTBA_AUTH_KEY='${key}'\n`].forEach((line, index) => {
    const place = setup('quotes-' + index, { tools: true, env: "TELETRAAN_DATA='<data>'\n" + line + "SANITY_WRITE_TOKEN='" + token + "'\n" });
    world(place);
    place.run();
    assert.ok(place.configs().includes('header = "X-TBA-Auth-Key: ' + key + '"'), line);
    assert.ok(!place.configs().includes('tbaOLDkey'), line);
  });
});

test('--check asks one question, says whether the key and the token are there, and writes nothing', () => {
  const place = setup('check', { tools: true, noData: true });
  place.tba('/status', { current_season: 2027, max_season: 2027, is_datafeed_down: false });
  const result = place.run(['--check']);

  assert.equal(result.status, 0, result.errors);
  assert.equal(result.text, 'OK    The Blue Alliance accepts the key (season 2027)\nOK    SANITY_WRITE_TOKEN is in local.env\n');
  assert.deepEqual(requestsOf(result.calls), ['tba /status']);
  assert.ok(!fs.existsSync(path.join(place.root, 'data')), 'no folder is made');
  assert.deepEqual(fs.readdirSync(place.temp), [], 'the temporary folder is gone');
  assert.ok(!result.text.includes(key) && !result.calls.includes(key));

  const refused = setup('check-refused', { tools: true, noData: true });
  refused.tba('/status', { Error: 'no' }, { code: 401 });
  const no = refused.run(['--check']);
  assert.equal(no.status, 1);
  assert.ok(no.text.includes('FAIL  The Blue Alliance refused the key. Check TBA_AUTH_KEY in local.env.'), no.text);

  const slow = setup('check-down', { tools: true, noData: true });
  slow.tba('/status', {}, { exit: 28 });
  const timeout = slow.run(['--check']);
  assert.equal(timeout.status, 1);
  assert.ok(timeout.text.includes('FAIL  The Blue Alliance did not answer, the server took too long to answer'), timeout.text);

  const noToken = setup('check-no-token', { tools: true, noData: true, env: "TBA_AUTH_KEY='" + key + "'\n" });
  noToken.tba('/status', { current_season: 2027 });
  const missing = noToken.run(['--check']);
  assert.equal(missing.status, 1);
  assert.ok(missing.text.includes('FAIL  SANITY_WRITE_TOKEN is not in local.env'), missing.text);
  assert.ok(missing.text.includes('OK    The Blue Alliance accepts the key'));
});

test('with a tool missing the script says which, prints the apt line and asks for nothing', () => {
  const place = setup('bare', { tools: false });
  const result = place.run();

  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('The curl command is missing'), result.errors);
  assert.ok(result.errors.includes('  sudo apt install curl jq\n'));
  assert.ok(!fs.existsSync(place.frc));
});

test('a word the script does not know, or two, prints how to use it and changes nothing', () => {
  const place = setup('usage', { tools: true });
  world(place);
  [['--later'], ['--now', '--check'], ['now']].forEach(args => {
    const result = place.run(args);
    assert.equal(result.status, 1, args.join(' '));
    assert.ok(result.errors.includes('Usage:'), result.errors);
  });
  assert.equal(fs.readFileSync(place.log, 'utf8'), '');
  assert.ok(!fs.existsSync(place.frc));
});

test('with no data folder the script stops with a plain line and asks for nothing', () => {
  const place = setup('no-data', { tools: true, noData: true });
  world(place);
  const result = place.run();

  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('The data folder ' + path.join(place.root, 'data') + ' does not exist'), result.errors);
  assert.equal(requestsOf(result.calls).length, 0);
});

test('a run that finds the lock taken stops at once and changes nothing', () => {
  const place = setup('locked', { tools: true });
  world(place);
  const result = place.run([], { STUB_LOCKED: 'yes' });

  assert.equal(result.status, 0);
  assert.ok(result.text.includes('still going'), result.text);
  assert.ok(result.calls.includes('flock -n 9'), 'the lock is asked for without waiting');
  assert.equal(requestsOf(result.calls).length, 0);
  assert.deepEqual(fs.readdirSync(place.frc).sort(), ['.lock', 'cache']);
});

test('when Sanity cannot be asked or gives no answer the run stops and nothing is changed', () => {
  const answers = {
    'no-network': place => fs.writeFileSync(path.join(place.stub, 'sanity.exit'), '6'),
    'error': place => fs.writeFileSync(path.join(place.stub, 'sanity.json'), JSON.stringify({ error: { description: 'query problem' } })),
    'web-page': place => fs.writeFileSync(path.join(place.stub, 'sanity.json'), '<html>Sorry</html>'),
    'no-result': place => fs.writeFileSync(path.join(place.stub, 'sanity.json'), JSON.stringify({ result: null })),
  };

  Object.keys(answers).forEach(name => {
    const place = setup('sanity-down-' + name, { tools: true });
    world(place);
    answers[name](place);
    const result = place.run();

    assert.equal(result.status, 1, name);
    assert.ok(result.errors.includes('Could not get the teams from Sanity. Nothing was changed.'), name);
    assert.deepEqual(serviceRequests(result.calls), [], name);
    assert.equal(place.mutations(), 0, name);
    assert.ok(!fs.existsSync(path.join(place.frc, 'state.json')), name);
  });
});

test('with no team in Sanity nothing is asked of the services, and the status says there is no team', () => {
  const place = setup('no-teams', { tools: true });
  world(place, { teams: [] });
  const result = place.run();

  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(serviceRequests(result.calls), []);
  assert.deepEqual(place.document().teams, []);
});

test('the work folder is removed after every run, and one a stopped run left behind is cleaned up', () => {
  const place = setup('leftovers', { tools: true });
  world(place);
  fs.mkdirSync(path.join(place.frc, '.work.interrupted'), { recursive: true });
  place.run();
  assert.deepEqual(fs.readdirSync(place.frc).sort(), ['.lock', 'cache', 'cycle.txt', 'etags.json', 'state.json', 'written.json']);
  assert.deepEqual(fs.readdirSync(place.temp), []);
});

test('the script also works under dash, with the same requests and the same status', () => {
  if (!fs.existsSync('/bin/dash')) return;
  const reference = setup('dash-reference', { tools: true });
  world(reference);
  reference.run();

  const place = setup('dash', { tools: true });
  world(place);
  const result = place.run([], {}, '/bin/dash');

  assert.equal(result.status, 0, result.errors);
  assert.deepEqual(requestsOf(result.calls), firstSequence);
  assert.deepEqual(place.document(), reference.document());
});

test('the scripts have valid sh syntax, are executable, and local.env and the secrets are never printed', () => {
  [syncFile, installFile].forEach(file => {
    const syntax = spawnSync('/bin/sh', ['-n', file], { encoding: 'utf8' });
    assert.equal(syntax.status, 0, syntax.stderr);
    if (fs.existsSync('/bin/dash')) {
      const dash = spawnSync('/bin/dash', ['-n', file], { encoding: 'utf8' });
      assert.equal(dash.status, 0, dash.stderr);
    }

    const text = fs.readFileSync(file, 'utf8');
    assert.ok(text.startsWith('#!/bin/sh\n'));
    assert.ok(/^set -eu$/m.test(text), 'the script stops at the first error');
    assert.ok((fs.statSync(file).mode & 0o111) !== 0, path.basename(file) + ' should be executable');
    assert.ok(!/\bcat\b[^\n]*local\.env/.test(text), 'local.env is never printed');
    assert.ok(!/\beval\b/.test(text), 'nothing is run from text');
    assert.ok(!/CALENDAR_|MONDAY_/.test(text), 'the other secrets are not read');
  });

  const text = fs.readFileSync(syncFile, 'utf8');
  assert.ok(!/\becho\b[^\n]*\$(tba_key|write_token)/.test(text), 'a secret is never echoed');
  assert.ok(!/\bprintf\b[^\n]*\$(tba_key|write_token)[^\n]*>&2/.test(text), 'a secret is never printed as an error');
  assert.ok(!/--header[^\n]*(X-TBA-Auth-Key|Authorization)|-H [^\n]*(X-TBA-Auth-Key|Authorization)/.test(text), 'a secret is not an argument of curl');
  text.split('\n').filter(line => line.includes('$tba_key')).forEach(line => {
    const handed = line.includes("printf 'header = \"X-TBA-Auth-Key: %s\"\\n' \"$tba_key\"");
    assert.ok(handed || line.trim() === 'case $tba_key in' || line.trim() === 'looks_like_key TBA_AUTH_KEY "$tba_key"', 'the key is only checked or handed to curl on standard input: ' + line);
  });
});

test('every address and every place in an answer is in the block at the top, and nowhere else', () => {
  const text = fs.readFileSync(syncFile, 'utf8');
  const start = text.indexOf("tba_host='");
  const end = text.indexOf("\n'\n", start) + 3;
  const block = text.slice(start, end);
  const rest = text.slice(0, start) + text.slice(end);

  assert.equal(text.split('thebluealliance.com').length, 2, 'one address in the whole script');
  assert.equal(block.split('thebluealliance.com').length, 2);
  assert.equal(block.split('api.statbotics.io').length, 2);
  assert.ok(!rest.includes('api.statbotics.io') && !rest.includes('thebluealliance.com/api'));
  ['/team/{team}/events/{year}/simple', '/team/{team}/event/{event}/matches', '/event/{event}/rankings', '/event/{event}/alliances', '/event/{event}/teams/simple', '/team/{team}/awards/{year}', '/district/{district}/events/simple', '/district/{district}/rankings', '/team_year/{number}/{year}', '/match/{match}'].forEach(address => {
    assert.equal(text.split("'" + address + "'").length, 2, address + ' appears once, in the block');
    assert.ok(block.includes("'" + address + "'"), address);
  });

  ['.start_date', '.end_date', '.comp_level', '.team_keys', '.sort_orders', '.point_total', '.picks', '.nickname', '.total_points.mean', '.red_win_prob', '.winning_alliance', '.matches_played', '.event_key'].forEach(path => {
    assert.ok(block.includes(path), 'the block has ' + path);
    assert.ok(!rest.includes(path), 'the rest of the script does not have ' + path);
  });
});

test('the unit files name the account ACCOUNT, run the script, and the timer wakes it 2 minutes after boot and every 5 minutes', () => {
  const service = fs.readFileSync(path.join(repo, 'deploy/systemd/teletraan-frc.service'), 'utf8');
  const timer = fs.readFileSync(path.join(repo, 'deploy/systemd/teletraan-frc.timer'), 'utf8');

  assert.deepEqual(service.match(/^User=.*$/gm), ['User=ACCOUNT']);
  assert.ok(/^Type=oneshot$/m.test(service));
  assert.deepEqual(service.match(/^ExecStart=.*$/gm), ['ExecStart=/opt/teletraan/deploy/scripts/frc-sync.sh']);
  assert.ok(!/^ExecStartPost=/m.test(service), 'the script tells status-mini itself, and only after a run that worked');
  assert.ok(fs.existsSync(syncFile), 'the script the unit runs exists');
  assert.ok(/^OnBootSec=2min$/m.test(timer));
  assert.ok(/^OnUnitActiveSec=5min$/m.test(timer));
  assert.ok(/^WantedBy=timers\.target$/m.test(timer));
  assert.ok(!/hawktimus/i.test(service + timer), 'no account name is written in the unit files');
  assert.ok(!/^OnCalendar=/m.test(timer), 'one timer, and the script decides');
});

test('the script tells status-mini through status-write.sh, which knows the job frc', () => {
  const status = fs.readFileSync(path.join(repo, 'deploy/scripts/status-write.sh'), 'utf8');
  assert.ok(status.includes('frc) field=lastFrcSyncAt ;;'));
  assert.ok(fs.readFileSync(syncFile, 'utf8').includes('"$deploy/scripts/status-write.sh" frc || true'));
});

test('install-frc.sh stops, naming the file, when a unit file is missing or empty', () => {
  const missing = setup('install-missing', { tools: true, install: true });
  fs.rmSync(path.join(missing.root, 'deploy/systemd/teletraan-frc.service'));
  const first = missing.install();
  assert.equal(first.status, 1);
  assert.ok(first.errors.includes('teletraan-frc.service is missing or empty'), first.errors);

  const empty = setup('install-empty', { tools: true, install: true });
  fs.writeFileSync(path.join(empty.root, 'deploy/systemd/teletraan-frc.timer'), '');
  const second = empty.install();
  assert.equal(second.status, 1);
  assert.ok(second.errors.includes('teletraan-frc.timer is missing or empty'), second.errors);

  const noScript = setup('install-no-script', { tools: true, install: true });
  fs.chmodSync(path.join(noScript.root, 'deploy/scripts/frc-sync.sh'), 0o644);
  const third = noScript.install();
  assert.equal(third.status, 1);
  assert.ok(third.errors.includes('frc-sync.sh is missing or cannot be run'), third.errors);

  [first, second, third].forEach(result => assert.ok(!result.calls.includes('systemctl'), 'nothing was changed'));
});

test('install-frc.sh prints the apt line when a package is missing, and never runs apt', () => {
  const place = setup('install-packages', { tools: false, install: true });
  const result = place.install();

  assert.equal(result.status, 1);
  assert.ok(result.errors.includes('These packages are not installed: curl jq'), result.errors);
  assert.ok(result.errors.includes('  sudo apt install curl jq\n'));
  assert.ok(!result.calls.includes('apt') && !result.calls.includes('systemctl'), result.calls);
});

test('install-frc.sh with everything in place still needs sudo and the repository at /opt/teletraan before it changes anything', () => {
  const place = setup('install-checks', { tools: true, install: true });
  const plain = place.install({ STUB_UID: '1000' });
  assert.equal(plain.status, 1);
  assert.ok(plain.errors.includes('it has to run with sudo'), plain.errors);

  const root = place.install({ STUB_UID: '0' });
  assert.equal(root.status, 1);
  assert.ok(root.errors.includes('The unit files expect the repository at /opt/teletraan'), root.errors);
  assert.ok(!root.calls.includes('systemctl') && !root.calls.includes('apt'));
});

test('install-frc.sh copies the two frc units only, with ACCOUNT filled in, and writes no account name of its own', () => {
  const text = fs.readFileSync(installFile, 'utf8');
  assert.deepEqual(text.match(/teletraan-[a-z]+\.(service|timer)/g).filter((name, index, all) => all.indexOf(name) === index).sort(), ['teletraan-frc.service', 'teletraan-frc.timer']);
  assert.ok(text.includes('sed "s/^User=ACCOUNT\\$/User=$account/"'));
  assert.ok(!/hawktimus/.test(text.split('\n').filter(line => !line.includes('called hawktimus') && !line.includes('chown')).join('\n')), 'the account name is only in the hint');
  assert.ok(text.includes('systemctl enable --now teletraan-frc.timer') && text.includes('systemctl restart teletraan-frc.timer'));
  assert.ok(!text.includes('slides') && !text.includes('poppler'), 'nothing is left of the slides installer');
});

test('local.example.env has a TBA_AUTH_KEY line with a placeholder, and the docs say where it goes', () => {
  const example = fs.readFileSync(path.join(repo, 'deploy/local.example.env'), 'utf8');
  assert.ok(/^TBA_AUTH_KEY='\[[^\n]*\]'$/m.test(example), 'a placeholder that starts with [');

  const mini = fs.readFileSync(path.join(repo, 'docs/rebuilding-the-mini.md'), 'utf8');
  ['TBA_AUTH_KEY', 'install-frc.sh', 'frc-sync.sh --check', 'frc-sync.sh --now', 'sudo apt install curl jq', 'docs/frc-feed.md', '17. **Turn on the FRC feed.**'].forEach(word => {
    assert.ok(mini.includes(word), 'docs/rebuilding-the-mini.md should mention ' + word);
  });

  const feed = fs.readFileSync(path.join(repo, 'docs/frc-feed.md'), 'utf8');
  ['frc-status', 'TBA_AUTH_KEY', 'SANITY_WRITE_TOKEN', 'ETag', '60 requests', 'public', 'None of it has been tried', 'Statbotics', 'every 5 minutes', 'district_slots', 'If an answer looks different', 'teletraan-frc.timer'].forEach(word => {
    assert.ok(feed.includes(word), 'docs/frc-feed.md should mention ' + word);
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
