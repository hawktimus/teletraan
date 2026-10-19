// The Update tab waits for the control service to come back after the switch, and does not call the restart a failure

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { waitUntilBack, restartWords } from '../control/static/update-lib.js';

let failed = 0;
function test(name, body) {
  Promise.resolve().then(body).then(() => console.log('ok   ' + name), error => { failed++; console.log('FAIL ' + name + '\n' + error.stack); process.exitCode = 1; });
}
const noWait = () => Promise.resolve();

test('it waits until the service answers, then stops asking', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; if (calls < 4) throw new TypeError('Load failed'); return { ok: true, status: 200 }; };
  assert.equal(await waitUntilBack(fetcher, noWait, 45), true);
  assert.equal(calls, 4);
});

test('a sign-in answer (401) also means the service is back', async () => {
  assert.equal(await waitUntilBack(async () => ({ ok: false, status: 401 }), noWait, 45), true);
});

test('it gives up after the tries, and says so plainly', async () => {
  let calls = 0;
  assert.equal(await waitUntilBack(async () => { calls++; throw new TypeError('Load failed'); }, noWait, 5), false);
  assert.equal(calls, 5);
  assert.match(restartWords, /restarting/);
  assert.match(restartWords, /expected/);
});

test('both update paths use the wait only after the switch step is done', () => {
  ['control/static/github-card.js', 'control/static/tab-update.js'].forEach(file => {
    const code = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    assert.ok(code.includes("event.step === 'switch' && event.state === 'done'"), file + ' notes the switch');
    assert.ok(code.includes('waitUntilBack()') && code.includes('if (switched)'), file + ' waits only when the switch is done');
  });
});
