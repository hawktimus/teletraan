// The checks that came out of the security review (docs/security-review.md): the lockout survives a restart, a
// call from another site is refused, a calendar file served to the Wi-Fi holds no notes or guest lists, and the
// secret scan of tools/sweep.sh finds a key-shaped string without printing it.
//
//   node tests/security-review.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import { createAuth, sameOrigin, triesAllowed } from '../control/lib/auth.js';
import { createService } from '../control/server.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-security-'));

test('six wrong tries stay counted after a restart, and the block lasts through it', () => {
  let clock = 1_800_000_000_000;
  const options = { secretFile: path.join(work, 'secret'), stateFile: path.join(work, 'lockout.json'), now: () => clock };
  const first = createAuth(options);
  for (let i = 0; i < triesAllowed - 2; i++) first.attempt('9.9.9.9', '000000');
  const restarted = createAuth(options);
  assert.equal(restarted.attempt('9.9.9.9', '000000').triesLeft, 1, 'the four earlier tries still count');
  assert.ok(restarted.attempt('9.9.9.9', '000000').blockedSeconds > 0);
  const again = createAuth(options);
  assert.ok(again.blockedFor('9.9.9.9') > 0, 'the block is still there after another restart');
  assert.equal(again.attempt('9.9.9.9', '3229').ok, false, 'even the right PIN waits');
  assert.equal(fs.statSync(options.stateFile).mode & 0o777, 0o600);
  clock += 61 * 60 * 1000;
  assert.equal(createAuth(options).blockedFor('9.9.9.9'), 0, 'free after the hour');
});

test('a damaged lockout file is a clean start, not an error', () => {
  const stateFile = path.join(work, 'broken.json');
  fs.writeFileSync(stateFile, '{not json');
  const auth = createAuth({ secretFile: path.join(work, 'secret'), stateFile: stateFile });
  assert.equal(auth.attempt('8.8.8.8', '3229').ok, true);
});

test('only a call from the page itself passes: another site, the word null and a wrong address are refused', () => {
  assert.equal(sameOrigin({ headers: { host: 'teletraan.local:3229', origin: 'http://teletraan.local:3229' } }), true);
  assert.equal(sameOrigin({ headers: { host: 'teletraan.local:3229' } }), true, 'no Origin: not a web page');
  assert.equal(sameOrigin({ headers: { host: 'teletraan.local:3229', origin: 'http://teletraan.local:3426' } }), false, 'the Studio port is another origin');
  assert.equal(sameOrigin({ headers: { host: 'teletraan.local:3229', origin: 'https://evil.example' } }), false);
  assert.equal(sameOrigin({ headers: { host: 'teletraan.local:3229', origin: 'null' } }), false);
  assert.equal(sameOrigin({ headers: { host: 'teletraan.local:3229', 'sec-fetch-site': 'cross-site' } }), false);
});

test('the service answers 403 to a POST that names another origin, before the PIN is looked at', async () => {
  const root = path.join(work, 'service');
  fs.mkdirSync(path.join(root, 'releases/1/dashboard'), { recursive: true });
  fs.writeFileSync(path.join(root, 'local.env'), "CONTROL_PIN='424242'\n");
  const { server } = await createService({
    port: 0, host: '127.0.0.1', rootDir: root, releasesDir: path.join(root, 'releases'), dataDir: root, envFile: path.join(root, 'local.env'),
    secretFile: path.join(root, 'control-secret'), lockoutFile: path.join(root, 'control-lockout.json'), socket: path.join(root, 'none.sock'), logFile: path.join(root, 'logs/control.log'),
  }, { helper: async () => '' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const post = origin => fetch(base + '/control/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ pin: '424242' }) });
    assert.equal((await post('https://evil.example')).status, 403);
    assert.equal((await post(base)).status, 200, 'the page itself signs in');
    const wrong = await fetch(base + '/control/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '1111' }) });
    assert.equal(wrong.status, 401);
    assert.ok(fs.existsSync(path.join(root, 'control-lockout.json')), 'a wrong try is written down');
  } finally { server.close(); }
});

// A copy of the script with a curl that hands over a prepared calendar
function fetchCalendar(body) {
  const root = path.join(work, 'fetch' + Math.random().toString(16).slice(2));
  const scripts = path.join(root, 'computer/scripts');
  const bin = path.join(root, 'bin');
  const data = path.join(root, 'data');
  fs.mkdirSync(scripts, { recursive: true });
  fs.mkdirSync(bin);
  fs.mkdirSync(data);
  ['fetch-calendars.sh', 'lib.sh'].forEach(name => fs.copyFileSync(path.join(repo, 'computer/scripts', name), path.join(scripts, name)));
  fs.chmodSync(path.join(scripts, 'fetch-calendars.sh'), 0o755);
  fs.writeFileSync(path.join(root, 'computer/local.env'), "TELETRAAN_DATA='" + data + "'\nCALENDAR_TEAM_URL='https://example.invalid/team'\n");
  fs.writeFileSync(path.join(root, 'feed.ics'), body);
  fs.writeFileSync(path.join(bin, 'curl'), '#!/bin/sh\nout=""\nwhile [ "$#" -gt 0 ]; do [ "$1" = --output ] && out=$2; shift; done\ncat "' + path.join(root, 'feed.ics') + '" > "$out"\n', { mode: 0o755 });
  const result = spawnSync('/bin/bash', [path.join(scripts, 'fetch-calendars.sh')], { encoding: 'utf8', env: { PATH: bin + ':' + process.env.PATH, HOME: root } });
  return { result: result, file: path.join(data, 'calendars/team.ics') };
}

test('a calendar file keeps the title, place and times and loses notes, guests, organizers and links', () => {
  const feed = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:one@example.invalid',
    'SUMMARY:Build meeting', 'LOCATION:Room 12', 'DTSTART:20261020T220000Z', 'DTEND:20261020T233000Z',
    'RRULE:FREQ=WEEKLY', 'DESCRIPTION:Call 555-0100 and use the', ' PRIVATENOTE folded line', 'ORGANIZER;CN=Someone:mailto:someone@example.invalid',
    'ATTENDEE;CN=Another:mailto:another@example.invalid', 'URL:https://example.invalid/private', 'ATTACH:https://example.invalid/file.pdf',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
  const { result, file } = fetchCalendar(feed);
  assert.equal(result.status, 0, result.stderr);
  const kept = fs.readFileSync(file, 'utf8');
  ['SUMMARY:Build meeting', 'LOCATION:Room 12', 'DTSTART:20261020T220000Z', 'DTEND:20261020T233000Z', 'RRULE:FREQ=WEEKLY', 'UID:one@example.invalid', 'END:VCALENDAR'].forEach(line => assert.ok(kept.includes(line), line));
  ['DESCRIPTION', 'PRIVATENOTE', 'ORGANIZER', 'ATTENDEE', 'someone@', 'another@', 'URL:', 'ATTACH', '555-0100'].forEach(word => assert.ok(!kept.includes(word), word));
  assert.equal(fs.statSync(file).mode & 0o777, 0o644);
});

// A copy of the repository's sweep with a tracked file that holds a made-up key
test('the sweep names the file and line of a key-shaped string and never prints the string', () => {
  const root = path.join(work, 'sweep');
  fs.mkdirSync(path.join(root, 'tools'), { recursive: true });
  ['sweep.sh', 'sweep-words.txt'].forEach(name => fs.copyFileSync(path.join(repo, 'tools', name), path.join(root, 'tools', name)));
  const made = 'AIza' + 'Sy' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r';
  fs.writeFileSync(path.join(root, 'config.txt'), 'first line\nkey = ' + made + '\n');
  const git = args => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  git(['init', '-q']);
  git(['add', '.']);
  const run = spawnSync('/bin/sh', [path.join(root, 'tools/sweep.sh')], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.ok((run.stdout + run.stderr).includes('config.txt:2'), run.stdout + run.stderr);
  assert.ok(!(run.stdout + run.stderr).includes(made.slice(0, 12)), 'the value is not printed');
});

test('a clean tree passes the secret scan', () => {
  const run = spawnSync('/bin/sh', [path.join(repo, 'tools/sweep.sh')], { cwd: repo, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
});

test('the log redactor hides a Google key that has no name in front of it, and the control page may not be framed by another site', async () => {
  const { redactLine } = await import('../control/lib/redact.js');
  const google = 'AIza' + 'Sy' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r';
  const hidden = redactLine('the request to drive used ' + google + ' and failed');
  assert.ok(!hidden.includes('A1b2C3d4'), hidden);
  assert.ok(hidden.includes('and failed'), 'the words around it stay');
  const { staticHeaders } = await import('../control/lib/static-files.js');
  const csp = staticHeaders('index.html', Buffer.from('x'))['Content-Security-Policy'];
  assert.ok(csp.includes("frame-ancestors 'self'") && csp.includes("base-uri 'none'") && !csp.includes("script-src 'unsafe-inline'"));
});

await finish();
