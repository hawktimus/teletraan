// Tests for the Keys tab (control/routes/env.js, control/support/keys.js): masking, checks, and a merge that
// gives the same file as tools/mini/merge-env.sh. Fake values only.
//
//   node tests/control-keys.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as env from '../control/routes/env.js';
import { calendarId, incomingLines, mask, mergeEnv } from '../control/support/keys.js';
import { makeWorld, repo } from './helpers/control-world.mjs';

let passed = 0;
async function check(name, test) {
  await test();
  passed += 1;
  console.log('PASS  ' + name);
}

await check('a key shows its first four characters then dots at 12 or more, dots only below, and not set for nothing', () => {
  assert.equal(mask('abcd1234efgh'), 'abcd........');
  assert.equal(mask('abcd1234efg'), '........');
  assert.equal(mask(''), 'not set');
  assert.equal(mask('[placeholder]'), 'not set');
  assert.equal(mask(undefined), 'not set');
});

await check('the merge gives the same file as merge-env.sh: replace in place, drop repeats, remove on empty, add at the end, keep every other line', () => {
  const existing = "# a comment\nTELETRAAN_PORT=8080\nSANITY_WRITE_TOKEN='old1'\nCALENDAR_TEAM_URL='https://x/a'\nSANITY_WRITE_TOKEN='old2'\nMONDAY_API_TOKEN='gone'\n\nCALENDAR_BUILD_URL='https://x/b'\n";
  const lines = ["SANITY_WRITE_TOKEN='new1'", "MONDAY_API_TOKEN=''", "CALENDAR_OUT_URL='https://x/c'", "CONTROL_PIN='123456'", "CALENDAR_TEAM_URL='https://x/z'"];
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-keys-'));
  fs.writeFileSync(path.join(folder, 'local.env'), existing);
  fs.writeFileSync(path.join(folder, 'new'), lines.join('\n') + '\n');
  // merge-env.sh handles only the three keys and calendars, so the PIN line is left out of its run
  fs.writeFileSync(path.join(folder, 'new'), lines.filter(line => !line.startsWith('CONTROL_PIN')).join('\n') + '\n');
  const run = spawnSync('sh', [path.join(repo, 'tools/mini/merge-env.sh'), path.join(folder, 'local.env'), path.join(folder, 'new')], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const expected = fs.readFileSync(path.join(folder, 'local.env'), 'utf8');
  assert.equal(mergeEnv(existing, lines.filter(line => !line.startsWith('CONTROL_PIN'))), expected);
  assert.ok(mergeEnv(existing, ["CONTROL_PIN='123456'"]).endsWith("CONTROL_PIN='123456'\n"));
});

await check('only known names are accepted, keys and the PIN are checked, and the PIN cannot be cleared', () => {
  assert.throws(() => incomingLines({ keys: { TELETRAAN_PORT: { action: 'set', value: '1' } } }), error => error.status === 400);
  assert.throws(() => incomingLines({ keys: { SANITY_WRITE_TOKEN: { action: 'set', value: 'has space' } } }), error => error.status === 400);
  assert.throws(() => incomingLines({ keys: { SANITY_WRITE_TOKEN: { action: 'set', value: "a'b" } } }), error => error.status === 400);
  assert.throws(() => incomingLines({ keys: { CONTROL_PIN: { action: 'set', value: '12345' } } }), error => error.status === 400 && /6 to 12/.test(error.message));
  assert.throws(() => incomingLines({ keys: { CONTROL_PIN: { action: 'clear' } } }), error => error.status === 400);
  assert.deepEqual(incomingLines({ keys: { TBA_AUTH_KEY: { action: 'keep' } } }).lines, []);
});

await check('calendars are named in words, a webcal link becomes https, and http or a space is refused', () => {
  assert.equal(calendarId('Build season'), 'BUILD_SEASON');
  const set = incomingLines({ calendars: [{ name: 'Build season', action: 'set', value: 'webcal://band.us/x?a=1' }, { name: 'CALENDAR_TEAM_URL', action: 'clear' }] });
  assert.deepEqual(set.lines, ["CALENDAR_BUILD_SEASON_URL='https://band.us/x?a=1'", "CALENDAR_TEAM_URL=''"]);
  assert.throws(() => incomingLines({ calendars: [{ name: 'x', action: 'set', value: 'http://a/b' }] }), error => error.status === 400);
  assert.throws(() => incomingLines({ calendars: [{ name: 'x', action: 'set', value: 'https://a b' }] }), error => error.status === 400);
  assert.throws(() => incomingLines({ calendars: [{ name: '', action: 'set', value: 'https://a/b' }] }), error => error.status === 400);
});

await check('GET env shows every key masked, never a value, and lists the calendars by code', async () => {
  const text = "SANITY_WRITE_TOKEN='skFAKEtoken0123456789'\nCONTROL_PIN='123456'\nCALENDAR_TEAM_URL='https://band.us/secretpath'\n";
  const world = await makeWorld([env], { env: text });
  const answer = await world.router.call('GET', '/env');
  const byName = Object.fromEntries(answer.json.keys.map(key => [key.name, key.masked]));
  assert.equal(byName.SANITY_WRITE_TOKEN, 'skFA........');
  assert.equal(byName.CONTROL_PIN, '........');
  assert.equal(byName.MONDAY_API_TOKEN, 'not set');
  assert.deepEqual(answer.json.calendars.map(calendar => calendar.code), ['team']);
  assert.ok(!answer.text.includes('0123456789') && !answer.text.includes('secretpath') && !answer.text.includes('123456\''));
});

await check('POST env sends the merged file to write-env, then runs the calendars, and logs names only', async () => {
  const world = await makeWorld([env]);
  const answer = await world.router.call('POST', '/env', { body: { keys: { MONDAY_API_TOKEN: { action: 'set', value: 'monTOKEN9999aaaa' } } } });
  assert.equal(answer.status, 200);
  assert.deepEqual(world.helped.map(item => item.word), ['write-env', 'sync-now']);
  assert.deepEqual(world.helped[1].args, ['calendars']);
  assert.ok(world.helped[0].stdin.includes("MONDAY_API_TOKEN='monTOKEN9999aaaa'"));
  assert.ok(world.helped[0].stdin.includes("SANITY_WRITE_TOKEN='skFAKEtoken0123456789'"));
  assert.deepEqual(answer.json.changed, [{ name: 'MONDAY_API_TOKEN', did: 'set' }]);
  assert.ok(!answer.text.includes('monTOKEN9999'));
  assert.ok(!world.logged.join('\n').includes('monTOKEN9999'));
  assert.ok(world.logged.join('\n').includes('MONDAY_API_TOKEN set'));
});

await check('a save with nothing to change is refused, and a failed calendar run still saves', async () => {
  const world = await makeWorld([env], { helperFails: ['sync-now'] });
  assert.equal((await world.router.call('POST', '/env', { body: { keys: {} } })).status, 400);
  assert.deepEqual(world.helped, []);
  const saved = await world.router.call('POST', '/env', { body: { keys: { TBA_AUTH_KEY: { action: 'set', value: 'tbakey0000' } } } });
  assert.equal(saved.status, 200);
  assert.equal(saved.json.calendarsRun, false);
});

console.log(passed + ' of ' + passed + ' checks passed.');
