// The log section of Settings: the redactor that takes keys and calendar links out of everything that is shared, the
// last lines of the two logs, and the download of the bundle.
//
//   node tests/control-log.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test, finish } from './helpers/runner.mjs';
import { makeWorld } from './helpers/control-world.mjs';
import { hidden, redactLine, redactText } from '../control/lib/redact.js';
import * as logRoute from '../control/routes/log.js';
import { words as clientWords } from '../control/lib/helper-client.js';

// built from three pieces so that the sweep does not take it for a real token
const jwt = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', 'dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk'].join('.');
const long = 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v2';

test('every key name of local.env loses its value and keeps its name', () => {
  ['SANITY_WRITE_TOKEN', 'MONDAY_API_TOKEN', 'TBA_AUTH_KEY', 'GOOGLE_API_KEY', 'CONTROL_PIN', 'CALENDAR_TEAM_URL', 'CALENDAR_OUTREACH_URL'].forEach(name => {
    assert.equal(redactLine(name + '=abc123secret'), name + '=' + hidden, name);
    assert.equal(redactLine(name + "='abc 123 secret'"), name + '=' + hidden, name + ' quoted');
    assert.equal(redactLine('export ' + name + '="x y"'), 'export ' + name + '=' + hidden, name + ' export');
  });
  assert.equal(redactLine('2026-10-18 saved SANITY_WRITE_TOKEN=skAbC123 for the page'), '2026-10-18 saved SANITY_WRITE_TOKEN=' + hidden + ' for the page');
});

test('Bearer tokens, JWTs, long token-like strings and calendar links are hidden', () => {
  assert.equal(redactLine('Authorization: Bearer abc.def-ghi_123'), 'Authorization: Bearer ' + hidden);
  assert.ok(!redactLine('sent ' + jwt + ' to sanity').includes('eyJ'));
  assert.equal(redactLine('sent ' + jwt + ' to sanity'), 'sent ' + hidden + ' to sanity');
  assert.equal(redactLine('key ' + long + ' end'), 'key ' + hidden + ' end');
  assert.equal(redactLine('fetch webcal://band.us/cal/xyz123/feed'), 'fetch ' + hidden);
  assert.equal(redactLine('fetch https://calendar.band.us/feed/abc?x=1 done'), 'fetch ' + hidden + ' done');
  assert.equal(redactLine('get https://example.org/team.ics now'), 'get ' + hidden + ' now');
  assert.equal(redactLine('call https://api.example.org/x?token=abc123&a=1'), 'call https://api.example.org/x?token=' + hidden + '&a=1');
});

test('plain lines are left alone', () => {
  ['2026-10-18T10:00:00Z restart-kiosk', 'git push teletraan main', '/opt/teletraan/releases/14/dashboard/index.html', 'disk 23.0 GB free of 460.0 GB', 'SANITY_WRITE_TOKEN is not set'].forEach(line => assert.equal(redactLine(line), line));
  assert.equal(redactText('a\nb=1\nc'), 'a\nb=1\nc');
});

test('the helper accepts the log-bundle word and the shell script runs it without sudo', () => {
  assert.ok(clientWords.includes('log-bundle'));
  const script = fs.readFileSync(new URL('../computer/scripts/control-helper.sh', import.meta.url), 'utf8');
  const part = script.slice(script.indexOf('  log-bundle)\n'), script.indexOf('  monday-check)\n    code=0'));
  assert.ok(part.includes('journalctl -u "$unit" -n 300 --no-pager') && part.includes('docker_bin" ps'));
  assert.ok(!/\bsudo\b/.test(part.replace(/uses sudo|without sudo/g, '')), 'no sudo in the bundle part');
  assert.ok(script.includes('mirror-status|log-bundle)'));
});

async function worldWithSecrets() {
  const world = await makeWorld([logRoute]);
  world.ctx.logFile = path.join(world.dataDir, 'control.log');
  const lines = [];
  for (let n = 0; n < 1100; n += 1) lines.push('filler ' + n);
  lines.push('control line one', 'saved CONTROL_PIN=654321', 'used ' + jwt);
  fs.writeFileSync(world.ctx.logFile, lines.join('\n') + '\n');
  fs.writeFileSync(path.join(world.dataDir, 'helper.log'), 'helper one\nwrite-env GOOGLE_API_KEY=AIzaSyFAKEFAKE0123456789\n');
  world.ctx.helper = async word => {
    world.helped.push({ word });
    return 'python3: Python 3.11.2\n---- journal teletraan-monday.service (last 300 lines) ----\nfetching https://x.example.org/a.ics\nBearer abcdef.ghijkl\nCALENDAR_TEAM_URL=webcal://band.us/secret/xyz\n' + long;
  };
  return world;
}

test('the log gives the last 200 lines of both logs, and 1000 when verbose', async () => {
  const world = await worldWithSecrets();
  const normal = (await world.router.call('GET', '/log')).json;
  assert.equal(normal.lines.length, 200);
  assert.equal(normal.count, 200);
  assert.equal(normal.lines[normal.lines.length - 1], 'used ' + hidden);
  assert.deepEqual(normal.helperLines.slice(0, 1), ['helper one']);
  const verbose = (await world.router.call('GET', '/log?verbose=1')).json;
  assert.equal(verbose.lines.length, 1000);
  assert.equal(verbose.verbose, true);
  const small = await makeWorld([logRoute]);
  small.ctx.logFile = path.join(small.dataDir, 'control.log');
  fs.writeFileSync(small.ctx.logFile, 'saved CONTROL_PIN=654321\n');
  assert.deepEqual((await small.router.call('GET', '/log')).json.lines, ['saved CONTROL_PIN=' + hidden], 'even the lines shown on the page are redacted');
});

test('the download is a text attachment with the date, a header, both logs and the journal, and no secret anywhere', async () => {
  const world = await worldWithSecrets();
  const answer = await world.router.call('GET', '/log/download');
  assert.equal(answer.status, 200);
  assert.equal(answer.headers['Content-Type'], 'text/plain; charset=utf-8');
  assert.match(answer.headers['Content-Disposition'], /^attachment; filename="teletraan-log-\d{4}-\d{2}-\d{2}\.txt"$/);
  const text = answer.text;
  ['Teletraan I log bundle', 'Release:', 'Uptime of this computer', 'Disk:', '==== control log', '==== helper log', '==== from the computer', 'python3: Python 3.11.2', 'journal teletraan-monday.service', 'helper one', 'control line one', 'filler 1099'].forEach(part => assert.ok(text.includes(part), part));
  assert.ok(text.includes('Keys and calendar links are hidden in this file. It is safe to send to a coach.'));
  ['654321', 'AIzaSyFAKE', jwt, long, 'webcal://', 'a.ics', 'abcdef.ghijkl', 'band.us'].forEach(secret => assert.ok(!text.includes(secret), 'still has ' + secret));
  assert.ok(text.includes('CONTROL_PIN=' + hidden) && text.includes('GOOGLE_API_KEY=' + hidden) && text.includes('CALENDAR_TEAM_URL=' + hidden));
  assert.equal(world.helped[0].word, 'log-bundle');
});

test('the download needs the PIN, and still works when the helper cannot answer', async () => {
  const world = await worldWithSecrets();
  world.pin = false;
  assert.equal((await world.router.call('GET', '/log/download')).status, 401);
  assert.equal((await world.router.call('GET', '/log')).status, 401);
  world.pin = true;
  world.ctx.helper = async () => { throw new Error('The helper refused that.'); };
  const answer = await world.router.call('GET', '/log/download');
  assert.equal(answer.status, 200);
  assert.ok(answer.text.includes('The computer could not be read: The helper refused that.'));
});

test('the page has the toggle, Refresh and the download with the sentence about hidden keys', () => {
  const log = fs.readFileSync(new URL('../control/static/tabs/log.js', import.meta.url), 'utf8');
  ['Verbose', 'Refresh', 'Download the verbose log', '/log/download', 'Keys and calendar links are hidden in this file. It is safe to send to a coach.'].forEach(part => assert.ok(log.includes(part), part));
});

finish();
