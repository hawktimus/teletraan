// Tests for computer/scripts/match13-sync.sh and install-match13.sh. curl and flock are replaced with small fake ones in
// a folder on PATH, so no test asks Match13 or Sanity anything. The answers are trimmed copies of real ones, in
// tests/data/match13. The key in these tests is a made-up value.
//
//   node tests/match13-sync.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const dataFolder = path.join(repo, 'tests/data/match13');
const key = 'm13_live_FAKEFAKEFAKE0123456789';
const otherKey = 'm13_live_OTHEROTHEROTHER98765432';

const fakeCurl = `#!/bin/bash
echo "curl $*" >> "$STUB_LOG"
out=''; dump=''; fmt=''; inm=''; url=''; cfg=''
while [ $# -gt 0 ]; do
  case $1 in
    --output) out=$2; shift 2 ;;
    --dump-header) dump=$2; shift 2 ;;
    --write-out) fmt=$2; shift 2 ;;
    --config) cfg=$2; shift 2 ;;
    --header) case $2 in If-None-Match:*) inm=\${2#If-None-Match: } ;; esac; shift 2 ;;
    --max-time|--connect-timeout|--max-filesize|--proto|--user-agent|--data-urlencode) shift 2 ;;
    https://*) url=$1; shift ;;
    *) shift ;;
  esac
done
if [ "$cfg" = - ]; then cat >> "$STUB_DIR/configs.txt"; fi
case $url in
  */data/query/*) cat "$STUB_DIR/sanity.json" > "$out"; [ -z "$fmt" ] || printf 200; exit 0 ;;
esac
path=\${url#https://actions.match13.com}
slug=$(printf '%s' "$path" | tr '/' '_')
base="$STUB_DIR/m13/$slug"
if [ -f "$base.exit" ]; then exit "$(cat "$base.exit")"; fi
code=404
[ -f "$base.json" ] && code=200
[ -f "$base.code" ] && code=$(cat "$base.code")
etag=''
[ -f "$base.etag" ] && etag=$(cat "$base.etag")
if [ "$code" = 200 ] && [ -n "$etag" ] && [ "$inm" = "$etag" ]; then code=304; fi
if [ -n "$dump" ]; then
  { printf 'HTTP/2 %s\\r\\n' "$code"; [ -z "$etag" ] || printf 'etag: %s\\r\\n' "$etag"; [ ! -f "$base.retry" ] || printf 'retry-after: %s\\r\\n' "$(cat "$base.retry")"; } > "$dump"
fi
if [ "$code" = 200 ]; then cat "$base.json" > "$out"; elif [ "$code" != 304 ]; then echo '{"title":"problem"}' > "$out"; fi
[ -z "$fmt" ] || printf '%s' "$code"
`;

const fakeStatusWrite = '#!/bin/sh\necho "status-write $*" >> "$STUB_LOG"\n';

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(dataFolder, name), 'utf8'));
}

function placeToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function addDays(date, days) {
  const moved = new Date(Date.parse(date + 'T12:00:00Z') + days * 86400000);
  return moved.toISOString().slice(0, 10);
}

function makePlace(label, options = {}) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-m13-' + label + '-'));
  const root = path.join(temp, 'opt');
  const data = path.join(temp, 'data');
  const bin = path.join(temp, 'bin');
  const stub = path.join(temp, 'stub');
  ['computer/scripts', 'computer/systemd', 'dashboard'].forEach(folder => fs.mkdirSync(path.join(root, folder), { recursive: true }));
  [data, bin, path.join(stub, 'm13')].forEach(folder => fs.mkdirSync(folder, { recursive: true }));
  const script = path.join(root, 'computer/scripts/match13-sync.sh');
  fs.copyFileSync(path.join(repo, 'computer/scripts/match13-sync.sh'), script);
  fs.chmodSync(script, 0o755);
  fs.copyFileSync(path.join(repo, 'computer/scripts/lib.sh'), path.join(root, 'computer/scripts/lib.sh'));
  fs.copyFileSync(path.join(repo, 'dashboard/config.js'), path.join(root, 'dashboard/config.js'));
  const status = path.join(root, 'computer/scripts/status-write.sh');
  fs.writeFileSync(status, fakeStatusWrite);
  fs.chmodSync(status, 0o755);
  for (const [name, text] of [['curl', fakeCurl], ['flock', '#!/bin/sh\necho "flock $*" >> "$STUB_LOG"\n[ "$STUB_LOCKED" != yes ]\n']]) {
    fs.writeFileSync(path.join(bin, name), text);
    fs.chmodSync(path.join(bin, name), 0o755);
  }
  const env = options.env !== undefined ? options.env : "TELETRAAN_DATA='" + data + "'\nMATCH13_API_KEY='" + key + "'\n";
  fs.writeFileSync(path.join(root, 'computer/local.env'), env);
  const log = path.join(temp, 'calls.log');
  fs.writeFileSync(log, '');

  const today = placeToday();
  const place = {
    temp, root, data, log, stub, script,
    folder: path.join(data, 'match13'),
    // What Sanity answers: our teams, and the events of the competition feed
    sanity(teams, events) {
      const result = {
        zone: 'America/New_York',
        teams: teams.map(number => ({ code: number === 3229 ? 'prime' : 'nova', number: String(number) })),
        frc: { season: 2026, teams: teams.map(number => ({ team: number === 3229 ? 'prime' : 'nova', number, focusEvent: events.length ? events[0].key : '', events })) },
      };
      fs.writeFileSync(path.join(stub, 'sanity.json'), JSON.stringify({ ms: 1, query: 'stub', result }));
    },
    answer(address, body, extra = {}) {
      const base = path.join(stub, 'm13', address.replace(/\//g, '_'));
      ['.json', '.etag', '.code', '.exit', '.retry'].forEach(ending => fs.rmSync(base + ending, { force: true }));
      if (body !== undefined) fs.writeFileSync(base + '.json', JSON.stringify(body));
      if (extra.etag) fs.writeFileSync(base + '.etag', extra.etag);
      if (extra.code) fs.writeFileSync(base + '.code', String(extra.code));
      if (extra.retry) fs.writeFileSync(base + '.retry', String(extra.retry));
      if (extra.exit) fs.writeFileSync(base + '.exit', String(extra.exit));
    },
    // The usual world: one event on now, the answers of the trimmed copies
    world(teams = [3229, 3426]) {
      this.sanity(teams, [{ key: '2026ncash', startDate: addDays(today, -1), endDate: addDays(today, 1) }]);
      this.answer('/v1/events/2026ncash/sim', fixture('sim-2026ncash.json'), { etag: '"sim-1"' });
      this.answer('/v1/events/2026ncash/matches', fixture('matches-2026ncash.json'), { etag: '"matches-1"' });
      this.answer('/v1/events/2026ncash/teams', fixture('event-teams-2026ncash.json'), { etag: '"teams-1"' });
      this.answer('/v1/districts/fnc/2026/teams', fixture('district-fnc-2026.json'), { etag: '"district-1"' });
      this.answer('/v1/teams/3229/years/2026', fixture('team-3229-2026.json'), { etag: '"team-1"' });
      this.answer('/v1/teams/3229/years/2026/events', fixture('team-events-3229-2026.json'), { etag: '"history-1"' });
    },
    run(args = [], extra = {}) {
      fs.writeFileSync(log, '');
      const env = Object.assign({ PATH: bin + ':/usr/bin:/bin:/usr/sbin:/sbin', STUB_LOG: log, STUB_DIR: stub, TMPDIR: temp }, extra);
      const result = spawnSync('/bin/bash', [script].concat(args), { env, encoding: 'utf8', input: '', cwd: root });
      return { text: result.stdout, errors: result.stderr, status: result.status, calls: fs.readFileSync(log, 'utf8') };
    },
    file() {
      return JSON.parse(fs.readFileSync(path.join(data, 'match13.json'), 'utf8'));
    },
    statusLine() {
      return JSON.parse(fs.readFileSync(path.join(data, 'match13-status.json'), 'utf8'));
    },
    configs() {
      const file = path.join(stub, 'configs.txt');
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    },
    state() {
      return JSON.parse(fs.readFileSync(path.join(data, 'match13/state.json'), 'utf8'));
    },
    setState(change) {
      fs.writeFileSync(path.join(data, 'match13/state.json'), JSON.stringify(Object.assign(this.state(), change)));
    },
  };
  return place;
}

function match13Requests(calls) {
  return calls.split('\n').filter(line => line.startsWith('curl ')).map(line => (line.match(/(https:\/\/actions\.match13\.com\S+)$/) || [])[1]).filter(Boolean).map(url => url.replace('https://actions.match13.com', ''));
}

const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

function cleanUp(place) {
  fs.rmSync(place.temp, { recursive: true, force: true });
}

function withPlace(label, options, run) {
  const place = makePlace(label, options);
  try {
    run(place);
  } finally {
    cleanUp(place);
  }
}

test('with no key the run says so in one line, asks nobody, ends without an error and leaves a no-key state', () => {
  for (const env of ['', "MATCH13_API_KEY=''\n", "MATCH13_API_KEY='[paste the Match13 key here]'\n"]) {
    withPlace('nokey', { env: env === '' ? "TELETRAAN_DATA='<data>'\n" : "TELETRAAN_DATA='<data>'\n" + env }, place => {
      fs.writeFileSync(path.join(place.root, 'computer/local.env'), fs.readFileSync(path.join(place.root, 'computer/local.env'), 'utf8').replace('<data>', place.data));
      place.world();
      const result = place.run();
      assert.equal(result.status, 0, result.errors);
      assert.equal(result.text.trim().split('\n').length, 1, result.text);
      assert.ok(result.text.includes('MATCH13_API_KEY') && result.text.includes('docs/match13.md'));
      assert.equal(match13Requests(result.calls).length, 0);
      assert.ok(!fs.existsSync(path.join(place.data, 'match13.json')));
      assert.equal(place.statusLine().state, 'no-key');
      assert.ok(result.calls.includes('status-write match13'));
    });
  }
});

test('a full run asks for the events, the district and each team, and writes one small file of numbers', () => {
  withPlace('full', {}, place => {
    place.world();
    const result = place.run();
    assert.equal(result.status, 0, result.errors);
    const asked = match13Requests(result.calls);
    assert.deepEqual(asked.slice().sort(), [
      '/v1/districts/fnc/2026/teams',
      '/v1/events/2026ncash/matches',
      '/v1/events/2026ncash/sim',
      '/v1/events/2026ncash/teams',
      '/v1/teams/3229/years/2026',
      '/v1/teams/3229/years/2026/events',
      '/v1/teams/3426/years/2026',
      '/v1/teams/3426/years/2026/events',
    ]);
    assert.ok(asked.length <= 20);

    const file = place.file();
    assert.equal(file.season, 2026);
    assert.match(file.generatedAt, /^\d{4}-\d{2}-\d{2}T[\d:]+Z$/);
    assert.equal(file.teams['3229'].xp, 61.17);
    assert.equal(file.teams['3229'].normXp, 1618);
    assert.equal(file.teams['3229'].history.length, 3);
    assert.deepEqual(Object.keys(file.teams['3229'].history[0]).sort(), ['districtPoints', 'eventKey', 'sos', 'xpEnd', 'xpMax', 'xpMean', 'xpStart']);
    assert.deepEqual(file.teams['3426'], { history: [] });

    const event = file.events['2026ncash'];
    assert.equal(event.sim.iterations, 25000);
    assert.ok(event.sim.teams.some(team => team.teamNumber === 3229));
    assert.ok(event.sim.teams.length <= 11);
    assert.deepEqual(event.sim.teams.map(team => team.meanRank), event.sim.teams.map(team => team.meanRank).slice().sort((a, b) => a - b));
    assert.equal(event.field.teamCount, 16);
    assert.ok(event.field.top.some(team => team.teamNumber === 3229 && typeof team.rank === 'number'));
    assert.deepEqual(event.matches.map(match => match.key), ['2026ncash_qm4', '2026ncash_qm7', '2026ncash_qm12', '2026ncash_sf4m1']);
    assert.deepEqual(Object.keys(event.matches[0].teams).sort(), ['10077', '1533', '3229', '6639', '6932', '9605']);
    assert.equal(typeof event.matches[0].pred.winProb, 'number');
    assert.ok(event.notes.length === 0);

    assert.equal(file.district.code, 'fnc');
    assert.equal(file.district.cmpSlots, 15);
    assert.deepEqual(file.district.ourTeams.map(team => team.teamNumber), [3229]);
    assert.equal(file.district.ourTeams[0].pDcmp, 1);
    assert.ok(fs.statSync(path.join(place.data, 'match13.json')).size < 200000);
    assert.deepEqual(place.statusLine().state, 'ok');
    assert.equal(place.statusLine().count, 2);
    assert.ok(result.calls.includes('status-write match13'));
    assert.ok(!/nickname|teamName|"name":"[A-Z]/.test(JSON.stringify(file)), 'no team names in the file');
  });
});

test('the key goes to curl on standard input only, with a user agent, and is never printed or written', () => {
  withPlace('secret', {}, place => {
    place.world();
    const result = place.run();
    assert.equal(result.status, 0, result.errors);
    assert.ok(!result.calls.includes('FAKEFAKE') && !result.calls.includes('Bearer'), 'not on a command line');
    assert.ok(!result.text.includes('FAKEFAKE') && !result.errors.includes('FAKEFAKE'), 'not printed');
    assert.ok(place.configs().includes('header = "Authorization: Bearer ' + key + '"'), 'handed over on standard input');
    assert.ok(result.calls.includes('--user-agent Teletraan I'), 'a user agent that names the screen');
    assert.ok(result.calls.includes("--config -") && result.calls.includes("--proto =https"));
    const written = [];
    const walk = folder => fs.readdirSync(folder, { withFileTypes: true }).forEach(entry => (entry.isDirectory() ? walk(path.join(folder, entry.name)) : written.push(path.join(folder, entry.name))));
    walk(place.data);
    written.forEach(file => assert.ok(!fs.readFileSync(file, 'utf8').includes('FAKEFAKE'), file));
    const script = fs.readFileSync(path.join(repo, 'computer/scripts/match13-sync.sh'), 'utf8');
    assert.ok(!/echo[^\n]*\$key/.test(script) && !/printf[^\n]*\$key[^\n]*>&2/.test(script), 'the script does not echo the key');
  });
});

test('a second run in the timer mode waits for its gap, and by hand it asks again with the ETags and gets 304', () => {
  withPlace('etag', {}, place => {
    place.world();
    assert.equal(place.run().status, 0);
    const before = fs.readFileSync(path.join(place.data, 'match13.json'), 'utf8');
    const quick = place.run();
    assert.equal(match13Requests(quick.calls).length, 0, 'inside the gap nothing is asked');
    const byHand = place.run(['--now']);
    assert.equal(byHand.status, 0, byHand.errors);
    const asked = match13Requests(byHand.calls);
    assert.ok(asked.length >= 6);
    const sent = byHand.calls.split('\n').filter(line => line.includes('If-None-Match: "'));
    assert.ok(sent.length >= 6, 'each repeat sends its ETag: ' + sent.length);
    const after = place.file();
    assert.deepEqual(after.events, JSON.parse(before).events);
    assert.deepEqual(after.teams, JSON.parse(before).teams);
  });
});

test('an event on now reads every 30 minutes and no event reads every 6 hours', () => {
  withPlace('gap', {}, place => {
    place.world();
    place.run();
    assert.equal(place.state().gap, 1800);
    place.sanity([3229], [{ key: '2026ncash', startDate: addDays(placeToday(), 60), endDate: addDays(placeToday(), 62) }]);
    fs.rmSync(path.join(place.data, 'match13/state.json'));
    place.run();
    assert.equal(place.state().gap, 21600);
    // 3 hours later in the quiet season is still inside the gap, 7 hours is not
    place.setState({ lastRunAt: Math.floor(Date.now() / 1000) - 3 * 3600 });
    assert.equal(match13Requests(place.run().calls).length, 0);
    place.setState({ lastRunAt: Math.floor(Date.now() / 1000) - 7 * 3600 });
    assert.ok(match13Requests(place.run().calls).length > 0);
  });
});

test('a 404 is a plain note and not an error: the event has not been simulated yet', () => {
  withPlace('missing', {}, place => {
    place.world();
    place.answer('/v1/events/2026ncash/sim', undefined);
    place.answer('/v1/teams/3426/years/2026', undefined);
    const result = place.run();
    assert.equal(result.status, 0, result.errors);
    assert.equal(result.errors.trim(), '');
    const file = place.file();
    assert.equal(file.events['2026ncash'].sim, null);
    assert.deepEqual(file.events['2026ncash'].notes, ['Match13 has not simulated 2026ncash yet.']);
    assert.equal(place.statusLine().state, 'ok');
  });
});

test('a 429 stops the run, keeps what was read, and waits out the Retry-After', () => {
  withPlace('limit', {}, place => {
    place.world();
    place.answer('/v1/events/2026ncash/matches', undefined, { code: 429, retry: 120 });
    const result = place.run();
    assert.equal(result.status, 0, result.errors);
    const asked = match13Requests(result.calls);
    assert.equal(asked.length, 2, 'the sim, then the matches that were refused: ' + asked.join(' '));
    assert.equal(place.statusLine().state, 'limit');
    const wait = place.state().notBefore - Math.floor(Date.now() / 1000);
    assert.ok(wait > 100 && wait <= 130, 'waits about the 120 seconds that were asked: ' + wait);
    assert.equal(match13Requests(place.run().calls).length, 0, 'the timer does not ask during the wait');
    assert.equal(match13Requests(place.run(['--now']).calls).length, 0, 'nor does a run by hand');
  });
});

test('a refused key writes a plain state, asks nothing more, and a new key starts over', () => {
  withPlace('refused', {}, place => {
    place.world();
    place.answer('/v1/events/2026ncash/sim', undefined, { code: 401 });
    const result = place.run();
    assert.equal(result.status, 0, result.errors);
    assert.equal(match13Requests(result.calls).length, 1);
    assert.ok(result.errors.includes('Match13 did not accept the key'), result.errors);
    assert.equal(place.statusLine().state, 'bad-key');
    assert.ok(!fs.existsSync(path.join(place.data, 'match13.json')));
    assert.equal(match13Requests(place.run().calls).length, 0, 'it does not keep trying a refused key');
    fs.writeFileSync(path.join(place.root, 'computer/local.env'), "TELETRAAN_DATA='" + place.data + "'\nMATCH13_API_KEY='" + otherKey + "'\n");
    place.answer('/v1/events/2026ncash/sim', fixture('sim-2026ncash.json'));
    assert.ok(match13Requests(place.run().calls).length > 1, 'a different key is tried');
    assert.equal(place.statusLine().state, 'ok');
  });
});

test('two server errors in a row stop the run and wait an hour', () => {
  withPlace('down', {}, place => {
    place.world();
    ['sim', 'matches', 'teams'].forEach(name => place.answer('/v1/events/2026ncash/' + name, undefined, { code: 503 }));
    const result = place.run();
    assert.equal(result.status, 0, result.errors);
    assert.equal(match13Requests(result.calls).length, 2);
    assert.equal(place.statusLine().state, 'down');
    const wait = place.state().notBefore - Math.floor(Date.now() / 1000);
    assert.ok(wait > 3500 && wait <= 3600, String(wait));
  });
});

test('a run makes at most 20 requests, however many events and teams there are', () => {
  withPlace('cap', {}, place => {
    const today = placeToday();
    const events = ['2026ncaaa', '2026ncbbb', '2026nccc', '2026ncddd'].map((eventKey, index) => ({ key: eventKey, startDate: addDays(today, index), endDate: addDays(today, index + 1) }));
    place.sanity([3229, 3426, 1111, 2222], events);
    const result = place.run();
    assert.equal(result.status, 0, result.errors);
    const asked = match13Requests(result.calls);
    assert.ok(asked.length <= 20, String(asked.length));
    assert.equal(asked.filter(address => address.endsWith('/sim')).length, 3, 'three events at most');
    assert.equal(new Set(asked).size, asked.length, 'nothing is asked twice');
  });
});

test('--check asks one question, reports in words and writes nothing', () => {
  withPlace('check', {}, place => {
    place.answer('/v1/years', fixture('team-3229-2026.json'));
    const good = place.run(['--check']);
    assert.equal(good.status, 0, good.errors);
    assert.ok(good.text.startsWith('OK'), good.text);
    assert.deepEqual(match13Requests(good.calls), ['/v1/years']);
    assert.deepEqual(fs.readdirSync(place.data), []);
    place.answer('/v1/years', undefined, { code: 401 });
    const bad = place.run(['--check']);
    assert.equal(bad.status, 1);
    assert.ok(bad.text.includes('did not accept the key'));
    assert.ok(!bad.text.includes('FAKEFAKE'));
  });
});

test('a key with odd characters is refused without being printed, and a locked run stops at once', () => {
  withPlace('odd', { env: "TELETRAAN_DATA='<data>'\nMATCH13_API_KEY='bad key \"x\"'\n" }, place => {
    fs.writeFileSync(path.join(place.root, 'computer/local.env'), "TELETRAAN_DATA='" + place.data + "'\nMATCH13_API_KEY='bad key \"x\"'\n");
    place.world();
    const result = place.run();
    assert.equal(result.status, 1);
    assert.ok(result.errors.includes('does not look like a key'));
    assert.ok(!result.errors.includes('bad key'));
    assert.equal(match13Requests(result.calls).length, 0);
  });
  withPlace('locked', {}, place => {
    place.world();
    const result = place.run([], { STUB_LOCKED: 'yes' });
    assert.equal(result.status, 0);
    assert.ok(result.text.includes('still going'));
    assert.equal(match13Requests(result.calls).length, 0);
  });
});

test('the script only needs curl and jq, installs nothing and has the usage line and the safety line', () => {
  const script = fs.readFileSync(path.join(repo, 'computer/scripts/match13-sync.sh'), 'utf8');
  assert.ok(script.includes('set -euo pipefail'));
  assert.ok(script.includes('# Usage: match13-sync.sh [--now | --check]'));
  assert.ok(!/\bapt(-get)?\s+install\b(?!.*echo)/.test(script.split('\n').filter(line => !line.trim().startsWith('echo') && !line.trim().startsWith('#')).join('\n')));
  assert.equal(spawnSync('bash', ['-n', path.join(repo, 'computer/scripts/match13-sync.sh')]).status, 0);
  assert.ok(!script.includes('—') && !script.includes('–'));
});

test('the install script copies the three units with ACCOUNT filled in, needs sudo and installs no package', () => {
  const text = fs.readFileSync(path.join(repo, 'computer/scripts/install-match13.sh'), 'utf8');
  ['teletraan-match13.service', 'teletraan-match13-timer.service', 'teletraan-match13.timer', 'sudo apt install curl jq', 'enable --now teletraan-match13.timer'].forEach(word => assert.ok(text.includes(word), word));
  assert.ok(!/^\s*apt(-get)? install/m.test(text));
  assert.equal(spawnSync('bash', ['-n', path.join(repo, 'computer/scripts/install-match13.sh')]).status, 0);
  const service = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-match13.service'), 'utf8');
  const wake = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-match13-timer.service'), 'utf8');
  const timer = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-match13.timer'), 'utf8');
  assert.ok(service.includes('User=ACCOUNT') && service.includes('match13-sync.sh --now'));
  assert.ok(wake.includes('User=ACCOUNT') && /ExecStart=\S+match13-sync\.sh$/m.test(wake));
  assert.ok(timer.includes('OnUnitActiveSec=30min') && timer.includes('Unit=teletraan-match13-timer.service'));
});

test('the Mac tool and the installer notes list the Match13 timer', () => {
  assert.ok(fs.readFileSync(path.join(repo, 'tools/teletraan/teletraan-tool-deploy.sh'), 'utf8').includes('frc news match13 console'));
  assert.ok(fs.readFileSync(path.join(repo, 'computer/README.md'), 'utf8').includes('install-match13.sh'));
  assert.ok(fs.readFileSync(path.join(repo, 'docs/updating-the-computer.md'), 'utf8').includes('install-match13.sh'));
});

let failures = 0;
for (const entry of tests) {
  try {
    await entry.run();
    console.log('ok    ' + entry.name);
  } catch (error) {
    failures += 1;
    console.log('FAIL  ' + entry.name + '\n      ' + String(error && error.stack).split('\n').slice(0, 8).join('\n      '));
  }
}
console.log(failures === 0 ? 'all ' + tests.length + ' passed' : failures + ' of ' + tests.length + ' failed');
process.exit(failures === 0 ? 0 : 1);
