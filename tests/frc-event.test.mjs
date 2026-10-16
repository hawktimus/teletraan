// Tests for the competition preview (B5): ?competition=1&event=<key> in the dashboard
// (core/competition-address.js), mini/scripts/frc-sync.sh --event <key> --to <file> with a fake curl, and
// tools/frc-fixture.mjs. The answer of The Blue Alliance is made up (tests/data/frc-event-answer.json),
// in the shape of the public v3 answers. The key is made up. Nothing touches the network. Needs jq.
//
//   node tests/frc-event.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const load = file => import(pathToFileURL(path.join(root, file)).href);
const address = await load('dashboard/core/competition-address.js');
const { buildFixture, chooseTeams } = await load('tools/frc-fixture.mjs');
const { tidyFrc } = await load('dashboard/core/frc.js');
const competition = await load('dashboard/core/competition.js');
const answer = JSON.parse(fs.readFileSync(path.join(root, 'tests/data/frc-event-answer.json'), 'utf8'));

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

test('the address asks for the cards only with competition=1, and a bad event key is ignored', () => {
  assert.equal(address.readCompetitionAsk('?sample=1'), null);
  assert.equal(address.readCompetitionAsk('?competition=0'), null);
  assert.deepEqual(address.readCompetitionAsk('?competition=1'), { event: '' });
  assert.deepEqual(address.readCompetitionAsk('?competition=1&event=2026ncdemo'), { event: '2026ncdemo' });
  assert.deepEqual(address.readCompetitionAsk('?competition=1&event=../x'), { event: '' });
});

test('the fixture is made from an answer and keeps the team numbers and names as they are', () => {
  const fixture = buildFixture(answer);
  const prime = fixture.frc.teams[0];

  assert.equal(fixture.event, '2026ncdemo');
  assert.equal(prime.team, 'prime');
  assert.equal(prime.number, 9001);
  assert.equal(prime.ranking.rank, 1);
  assert.deepEqual(prime.ranking.record, { wins: 8, losses: 0, ties: 0 });
  assert.equal(prime.alliance.number, 1);
  assert.deepEqual(prime.alliance.picks.map(pick => pick.number), [9001, 9002, 9003]);
  assert.equal(prime.alliance.picks[1].nickname, '[Nickname B]');
  assert.equal(prime.results.length, 8);
  assert.equal(prime.results[7].label, 'F1-1');
  assert.equal(prime.results[7].won, true);
  assert.deepEqual(prime.awards, [{ name: '[Award name]', event: '2026ncdemo' }]);
  assert.deepEqual(prime.districtPoints, { total: 47, rank: 5, cutoff: null });
  assert.equal(prime.nextMatch.label, 'F1-1');
  assert.equal(prime.lastSeason.season, 2026);
});

test('the fixture holds no person and no long team name', () => {
  const text = JSON.stringify(buildFixture(answer));
  assert.ok(!text.includes('[Person name]'));
  assert.ok(!text.includes('Long sponsor names'));
});

test('--prime and --nova choose the two teams, and the best ranked are the default', () => {
  assert.deepEqual(chooseTeams(answer), { prime: 9001, nova: 9002 });
  assert.deepEqual(chooseTeams(answer, { prime: 9005, nova: 9007 }), { prime: 9005, nova: 9007 });
  const fixture = buildFixture(answer, { prime: 9005, nova: 9007 });
  assert.equal(fixture.frc.teams[1].number, 9007);
  assert.equal(fixture.frc.teams[1].alliance, null, 'a team that was not picked into the made up alliances has none');
});

test('a file that is not from frc-sync.sh is refused in plain words', () => {
  assert.throws(() => buildFixture({}), /no event/);
  assert.throws(() => buildFixture({ event: { key: '2026ncdemo' }, teams: [{ team_number: 1 }] }), /fewer than two teams/);
});

test('the fixture goes through the cleaning of core/frc.js unchanged, and every card has data', () => {
  const fixture = buildFixture(answer);
  const frc = tidyFrc(fixture.frc);
  const content = { frc: frc, settings: { competitionMode: 'off' }, theme: { timeZone: 'America/New_York' } };

  assert.equal(frc.teams.length, 2);
  competition.previewCompetition(frc, Date.now() + 100000);
  try {
    const entry = frc.teams[0];
    assert.ok(entry.nextMatch && entry.ranking && entry.results.length > 0 && entry.alliance && entry.districtPoints && entry.lastSeason, 'next match, rank, results, alliance, district and last season are filled');
    assert.equal(competition.frcOf(content), frc, 'while the hold is on the cards draw the fixture whatever the Mode says');
    assert.equal(competition.withCompetition([], content).length, competition.cards.length, 'and every card is in the rotation');
  } finally {
    competition.previewCompetition(null, 0);
  }
});

test('an event key cuts the frc-status data down to that event', () => {
  const fixture = buildFixture(answer);
  const frc = fixture.frc;
  frc.teams[0].events.push({ key: '2026ncother', name: 'Other', startDate: '2026-04-01', endDate: '2026-04-03' });

  const cut = address.frcForEvent(frc, '2026ncdemo');
  assert.deepEqual(cut.teams[0].events.map(event => event.key), ['2026ncdemo']);
  assert.ok(cut.teams[0].ranking);

  const other = address.frcForEvent(frc, '2026ncother');
  assert.equal(other.teams[0].ranking, null, 'a ranking of another event is left out');
  assert.equal(other.teams[0].nextMatch, null);
  assert.deepEqual(other.teams[0].results, []);

  assert.equal(address.frcForEvent(frc, '2026ncnone'), frc, 'a key nobody has leaves the data as it was');
  assert.equal(address.frcForEvent(frc, ''), frc);
  assert.equal(address.frcForEvent(null, '2026ncdemo'), null);
});

test('a fixture file is used for its own event, or for any event when none is asked for', () => {
  const fixture = buildFixture(answer);
  assert.equal(address.fixtureFrc(fixture, '2026ncdemo'), fixture.frc);
  assert.equal(address.fixtureFrc(fixture, ''), fixture.frc);
  assert.equal(address.fixtureFrc(fixture, '2026ncother'), null);
  assert.equal(address.fixtureFrc({}, ''), null);
});

test('the placeholder fixture in the sample content says it is a placeholder and fills every card', () => {
  const file = JSON.parse(fs.readFileSync(path.join(root, 'dashboard/data/sample/frc-event.json'), 'utf8'));
  assert.equal(file.placeholder, true);
  assert.match(file.note, /PLACEHOLDER/);
  assert.match(file.note, /frc-sync\.sh --event/);

  const frc = tidyFrc(address.fixtureFrc(file, ''));
  assert.equal(frc.teams.length, 2);
  frc.teams.forEach(entry => {
    assert.ok(entry.nextMatch && entry.ranking && entry.results.length > 0 && entry.alliance && entry.districtPoints && entry.lastSeason, entry.team + ' has data for every card');
    assert.ok(String(entry.number).startsWith('['), 'the made up numbers are in brackets');
  });
});

// The script, with a fake curl

function setUpScript(work) {
  const scripts = path.join(work, 'tree', 'mini', 'scripts');
  fs.mkdirSync(scripts, { recursive: true });
  fs.copyFileSync(path.join(root, 'mini/scripts/frc-sync.sh'), path.join(scripts, 'frc-sync.sh'));
  fs.writeFileSync(path.join(work, 'tree', 'mini', 'local.env'), 'TBA_AUTH_KEY=fakekeyforthetest123\nSANITY_WRITE_TOKEN=faketokenforthetest\n');

  // The fake curl: the address decides the file, the key comes in on standard input and goes to configs.txt
  const stub = path.join(work, 'stub');
  fs.mkdirSync(path.join(stub, 'tba'), { recursive: true });
  fs.writeFileSync(path.join(stub, 'curl'), `#!/bin/sh
printf 'curl %s\\n' "$*" >> "$STUB_DIR/calls.log"
output=""; write_out=""; address=""; previous=""
for argument in "$@"; do
  case $previous in
    --output) output=$argument ;;
    --write-out) write_out=$argument ;;
  esac
  case $argument in https://*) address=$argument ;; esac
  previous=$argument
done
case " $* " in *" --config - "*) cat >> "$STUB_DIR/configs.txt" ;; esac
path=\${address#https://www.thebluealliance.com/api/v3/}
slug=$(printf '%s' "$path" | tr '/' '_')
code=200
[ -f "$STUB_DIR/tba/$slug.code" ] && code=$(cat "$STUB_DIR/tba/$slug.code")
[ ! -f "$STUB_DIR/tba/$slug.json" ] && code=404
[ "$code" = 200 ] && cp "$STUB_DIR/tba/$slug.json" "$output" || echo '{}' > "$output"
[ -n "$write_out" ] && printf '%s' "$code"
exit 0
`, { mode: 0o755 });

  const parts = {
    'event_2026ncdemo': answer.event,
    'event_2026ncdemo_matches': answer.matches,
    'event_2026ncdemo_rankings': answer.rankings,
    'event_2026ncdemo_alliances': answer.alliances,
    'event_2026ncdemo_teams_simple': answer.teams,
    'event_2026ncdemo_awards': answer.awards,
    'district_2026nc_rankings': answer.districtRankings,
  };
  Object.keys(parts).forEach(name => fs.writeFileSync(path.join(stub, 'tba', name + '.json'), JSON.stringify(parts[name])));
  return { script: path.join(scripts, 'frc-sync.sh'), stub: stub };
}

function runScript(setup, args) {
  return spawnSync('/bin/sh', [setup.script].concat(args), {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { PATH: setup.stub + ':' + process.env.PATH, STUB_DIR: setup.stub }),
  });
}

function inTemp(run) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-frc-event-'));
  try {
    return run(work);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

const hasJq = spawnSync('/bin/sh', ['-c', 'command -v jq']).status === 0;

test('frc-sync.sh --event writes the answers of one event to a file and never shows the key', () => inTemp(work => {
  assert.ok(hasJq, 'this computer has no jq');
  const setup = setUpScript(work);
  const file = path.join(work, 'event.json');
  const done = runScript(setup, ['--event', '2026ncdemo', '--to', file]);

  assert.equal(done.status, 0, done.stderr);
  const written = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(written.event.key, '2026ncdemo');
  assert.equal(written.matches.length, answer.matches.length);
  assert.equal(written.teams.length, 8);
  assert.equal(written.districtRankings.length, 2);

  const everything = done.stdout + done.stderr + fs.readFileSync(path.join(setup.stub, 'calls.log'), 'utf8') + fs.readFileSync(file, 'utf8');
  assert.ok(!everything.includes('fakekeyforthetest123'), 'the key is not printed, logged or written');
  assert.ok(fs.readFileSync(path.join(setup.stub, 'configs.txt'), 'utf8').includes('fakekeyforthetest123'), 'the key goes to curl on standard input');
  assert.ok(!fs.readFileSync(path.join(setup.stub, 'calls.log'), 'utf8').includes('sanity'), 'nothing is asked of Sanity');
  assert.match(done.stdout, /frc-fixture\.mjs/);

  const fixture = buildFixture(written);
  assert.equal(fixture.event, '2026ncdemo');
}));

test('frc-sync.sh --event stops with a plain sentence for a bad key of an event, a missing folder or an event that is not there', () => inTemp(work => {
  const setup = setUpScript(work);
  const file = path.join(work, 'event.json');

  const bad = runScript(setup, ['--event', 'Not A Key', '--to', file]);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /looks like 2026ncwak/);

  const folder = runScript(setup, ['--event', '2026ncdemo', '--to', path.join(work, 'nowhere', 'event.json')]);
  assert.equal(folder.status, 1);
  assert.match(folder.stderr, /does not exist/);

  const none = runScript(setup, ['--event', '2026ncgone', '--to', file]);
  assert.equal(none.status, 1);
  assert.match(none.stderr, /no event/);
  assert.ok(!fs.existsSync(file), 'no file is left behind');

  const usage = runScript(setup, ['--event', '2026ncdemo']);
  assert.equal(usage.status, 1);
  assert.match(usage.stderr, /Usage/);
}));

test('a refused key stops frc-sync.sh --event at once', () => inTemp(work => {
  const setup = setUpScript(work);
  fs.writeFileSync(path.join(setup.stub, 'tba', 'event_2026ncdemo.code'), '401');
  const done = runScript(setup, ['--event', '2026ncdemo', '--to', path.join(work, 'event.json')]);

  assert.equal(done.status, 1);
  assert.match(done.stderr, /refused the key/);
}));

let failed = 0;
for (const entry of tests) {
  try {
    await entry.run();
    console.log('PASS  ' + entry.name);
  } catch (error) {
    failed += 1;
    console.log('FAIL  ' + entry.name + '\n        ' + error.message);
  }
}
console.log('\n' + (tests.length - failed) + ' of ' + tests.length + ' checks passed.');
process.exit(failed === 0 ? 0 : 1);
