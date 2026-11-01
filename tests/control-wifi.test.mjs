// The Wi-Fi card of the Computer area: the route that carries the network name and the password to the helper, and the
// words the card shows. The password must travel only as the input of one helper call, never as an argument, in a log line
// or in an answer.
//
//   node tests/control-wifi.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import { makeWorld } from './helpers/control-world.mjs';
import * as helperRoute from '../control/routes/helper.js';
import { parseNetworks, signalWords, lockWords, switchWords } from '../control/static/areas/wifi.js';

const repo = fileURLToPath(new URL('../', import.meta.url));

test('wifi-connect needs the confirmation, then sends the name and the password as input, one line each', async () => {
  const world = await makeWorld([helperRoute]);
  const bare = await world.router.call('POST', '/helper/wifi-connect', { body: { ssid: 'Guest', password: 'hunter2 hunter2' } });
  assert.equal(bare.status, 400);
  assert.equal(world.helped.length, 0, 'the helper was not asked');

  const sent = await world.router.call('POST', '/helper/wifi-connect', { body: { ssid: 'Guest', password: 'hunter2 hunter2', confirmed: true } });
  assert.equal(sent.status, 200);
  assert.deepEqual(world.helped, [{ word: 'wifi-connect', args: [], stdin: 'Guest\nhunter2 hunter2\n' }]);
  assert.ok(!JSON.stringify(sent.json).includes('hunter2') && !world.logged.join('\n').includes('hunter2'), 'not answered, not logged');
});

test('a name or password the tool could not read as one line is refused before the helper is asked', async () => {
  const world = await makeWorld([helperRoute]);
  const cases = [{ ssid: '' }, { ssid: 'x'.repeat(33) }, { ssid: 'Two\nlines' }, { ssid: 'Net', password: 'two\nlines' }, { ssid: 'Net', password: 'x'.repeat(65) }, { ssid: 5 }, { password: 'abcdefgh' }];
  for (const body of cases) {
    const answer = await world.router.call('POST', '/helper/wifi-connect', { body: Object.assign({ confirmed: true }, body) });
    assert.equal(answer.status, 400, JSON.stringify(body));
  }
  assert.equal(world.helped.length, 0);
});

test('a failure from the helper does not put the password in the log line', async () => {
  const world = await makeWorld([helperRoute], { helperFails: ['wifi-connect'] });
  const answer = await world.router.call('POST', '/helper/wifi-connect', { body: { ssid: 'Guest', password: 'hunter2 hunter2', confirmed: true } });
  assert.equal(answer.status, 502);
  assert.ok(!world.logged.join('\n').includes('hunter2'));
});

test('scan, status, restart and the name servers are plain words; only the restart asks first', async () => {
  const world = await makeWorld([helperRoute]);
  for (const word of ['wifi-scan', 'wifi-status', 'dns-public', 'dns-default']) {
    assert.equal((await world.router.call('POST', '/helper/' + word, { body: {} })).status, 200, word);
  }
  assert.equal((await world.router.call('POST', '/helper/restart-network', { body: {} })).status, 400);
  assert.equal((await world.router.call('POST', '/helper/restart-network', { body: { confirmed: true } })).status, 200);
});

test('the card reads the scan lines and says signal and password in words', () => {
  const lines = 'network: 80|yes|1|Old Net\nnetwork: 55|enterprise|0|Staff\nnetwork: 30|no|0|Cafe | Bar\nnoise\n';
  assert.deepEqual(parseNetworks(lines), [
    { signal: 80, lock: 'yes', inUse: true, name: 'Old Net' },
    { signal: 55, lock: 'enterprise', inUse: false, name: 'Staff' },
    { signal: 30, lock: 'no', inUse: false, name: 'Cafe | Bar' },
  ]);
  assert.deepEqual([90, 50, 30, 5].map(signalWords), ['Strong signal', 'Good signal', 'Weak signal', 'Very weak signal']);
  assert.equal(lockWords('no'), 'Open, no password');
  assert.match(lockWords('enterprise'), /user name/);
});

test('the result of a switch is said in a sentence, with the time', () => {
  assert.equal(switchWords({ state: 'none' }), '');
  assert.match(switchWords({ state: 'working', network: 'Guest' }), /joining Guest/);
  assert.match(switchWords({ state: 'done', network: 'Guest', at: '2026-11-01T15:12:00Z' }), /^Joined Guest \(/);
  assert.match(switchWords({ state: 'reverted', reason: 'The network did not accept the connection. Check the name and the password.', at: '2026-11-01T15:12:00Z' }), /did not accept the connection/);
});

test('the page code never stores the password and keeps it out of Details', () => {
  const text = fs.readFileSync(repo + 'control/static/areas/wifi.js', 'utf8').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/remember\(|localStorage|sessionStorage/.test(text), 'the card keeps nothing in the browser');
  assert.ok(!/raw: [^\n]*(phrase|password\.value)/.test(text), 'the password is not in the raw text');
  assert.ok(/password\.value = ''/.test(text), 'the field is emptied before the request');
});

finish();
