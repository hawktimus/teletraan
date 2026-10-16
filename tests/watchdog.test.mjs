// Tests for mini/scripts/watchdog.sh, the unit files and installer of the
// watchdog, the browser flags in kiosk.sh and the heartbeat in the dashboard.
// The browser's page list, pgrep, ps, systemctl and status-write.sh are fakes in
// a temporary folder, so nothing touches a real browser or service.
//
//   node tests/watchdog.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readModule } from './helpers/read-module.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-watchdog-'));
const ordinaryTools = ['sed', 'head', 'tail', 'grep', 'date', 'dirname', 'cat', 'awk', 'tr', 'mv', 'rm'];

function findTool(name) {
  const found = spawnSync('/bin/sh', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
  assert.ok(found, 'this computer has no ' + name);
  return found;
}

function writeTool(folder, name, text) {
  fs.writeFileSync(path.join(folder, name), text, { mode: 0o755 });
}

// The fake browser page list is json.txt in the stub folder, and curl fails with
// the code in curl.exit. pgrep finds a browser unless no-browser exists, and ps
// gives the age in etimes.txt.
const fakeCurl = `#!/bin/sh
echo "curl $*" >> "$STUB_LOG"
[ -f "$STUB_DIR/curl.exit" ] && exit "$(cat "$STUB_DIR/curl.exit")"
cat "$STUB_DIR/json.txt"
`;
const fakePgrep = `#!/bin/sh
echo "pgrep $*" >> "$STUB_LOG"
[ -f "$STUB_DIR/no-browser" ] && exit 1
case " $* " in *" -o "*) echo 4242 ;; esac
exit 0
`;
const fakePs = `#!/bin/sh
cat "$STUB_DIR/etimes.txt"
`;
const fakeSystemctl = `#!/bin/sh
echo "systemctl $*" >> "$STUB_LOG"
`;
const fakeStatusWrite = `#!/bin/sh
echo "status-write $*" >> "$STUB_LOG"
`;

const watchdogFile = path.join(repo, 'mini/scripts/watchdog.sh');
let counter = 0;

// Two digits
const two = number => String(number).padStart(2, '0');

// HH:MM for a time some minutes from now, in UTC, which is the zone the script runs in here
function clockAt(minutesFromNow) {
  const then = new Date(Date.now() + minutesFromNow * 60000);
  return two(then.getUTCHours()) + ':' + two(then.getUTCMinutes());
}

// What the browser answers at /json for a title
function pageList(title) {
  return JSON.stringify([{ description: '', id: 'ABC', title: title, type: 'page', url: 'http://localhost:8080/dashboard/' }], null, 2);
}

const heartbeatTitle = minutes => pageList('Teletraan I · ' + clockAt(minutes));

function setup(options = {}) {
  counter += 1;
  const root = path.join(work, 'place' + counter);
  const bin = path.join(root, 'bin');
  const stub = path.join(root, 'stub');
  const data = path.join(root, 'data');
  fs.mkdirSync(path.join(root, 'mini/scripts'), { recursive: true });
  fs.mkdirSync(bin);
  fs.mkdirSync(stub);
  if (!options.noData) fs.mkdirSync(data);

  fs.copyFileSync(watchdogFile, path.join(root, 'mini/scripts/watchdog.sh'));
  fs.copyFileSync(path.join(repo, 'mini/scripts/lib.sh'), path.join(root, 'mini/scripts/lib.sh'));
  writeTool(path.join(root, 'mini/scripts'), 'status-write.sh', fakeStatusWrite);
  fs.writeFileSync(path.join(root, 'mini/local.env'), "TELETRAAN_DATA='" + data + "'\nSANITY_WRITE_TOKEN='skTESTtoken0123456789abcdef'\n");
  fs.writeFileSync(path.join(root, 'boot-id'), 'boot-one\n');

  ordinaryTools.forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));
  writeTool(bin, 'curl', fakeCurl);
  writeTool(bin, 'pgrep', fakePgrep);
  writeTool(bin, 'ps', fakePs);
  writeTool(bin, 'systemctl', fakeSystemctl);

  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');
  fs.writeFileSync(path.join(stub, 'json.txt'), heartbeatTitle(0));
  fs.writeFileSync(path.join(stub, 'etimes.txt'), '86400\n');

  const place = {
    root: root,
    data: data,
    state: path.join(data, 'watchdog-state'),
    page(text) {
      fs.writeFileSync(path.join(stub, 'json.txt'), text);
    },
    flag(name) {
      fs.writeFileSync(path.join(stub, name), '1');
    },
    age(seconds) {
      fs.writeFileSync(path.join(stub, 'etimes.txt'), seconds + '\n');
    },
    boot(id) {
      fs.writeFileSync(path.join(root, 'boot-id'), id + '\n');
    },
    // A state file as an earlier run would have left it
    writeState(fields, restartsSecondsAgo = []) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const lines = Object.entries(fields).map(([name, value]) => name + '=' + value);
      restartsSecondsAgo.forEach(seconds => lines.push('restart=' + (nowSeconds - seconds)));
      fs.writeFileSync(place.state, lines.join('\n') + '\n');
    },
    stateText() {
      return fs.existsSync(place.state) ? readModule(place.state, 'utf8') : '';
    },
    run() {
      const env = { PATH: bin, TZ: 'UTC', STUB_LOG: log, STUB_DIR: stub, WATCHDOG_BOOT_FILE: path.join(root, 'boot-id') };
      const result = spawnSync('/bin/sh', [path.join(root, 'mini/scripts/watchdog.sh')], { env: env, encoding: 'utf8', input: '' });
      const calls = readModule(log, 'utf8').split('\n').filter(Boolean);
      return {
        status: result.status,
        text: result.stdout,
        errors: result.stderr,
        calls: calls,
        restarted: calls.some(line => line === 'systemctl restart teletraan-kiosk'),
        told: calls.filter(line => line.startsWith('status-write')),
      };
    },
  };
  return place;
}

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

test('a fresh title restarts nothing and writes nothing', () => {
  const place = setup();
  const result = place.run();
  assert.equal(result.status, 0, result.errors);
  assert.equal(result.restarted, false);
  assert.equal(result.told.length, 0);
  assert.equal(place.stateText(), '');
  assert.ok(result.calls.some(line => line.includes('http://127.0.0.1:9222/json')), 'it asks the local page list');
});

test('a title one or two minutes old, or a minute ahead of the clock, is fresh', () => {
  [-1, -2, -3, 1].forEach(minutes => {
    const place = setup();
    place.page(heartbeatTitle(minutes));
    assert.equal(place.run().restarted, false, minutes + ' minutes from now');
  });
});

test('a stale title restarts the kiosk service, keeps the state, and tells Studio the count', () => {
  const place = setup();
  place.page(heartbeatTitle(-6));
  const result = place.run();
  assert.equal(result.status, 0, result.errors);
  assert.equal(result.restarted, true);
  assert.ok(result.text.includes('the page title is 6 minutes old'), result.text);
  assert.deepEqual(result.told, ['status-write restart 1']);
  const state = place.stateText();
  assert.ok(state.includes('boot=boot-one') && state.includes('today=1') && /\nrestart=\d+\n/.test(state), state);
  assert.ok(!state.includes('stopped'));
});

test('a title across midnight is counted across midnight', () => {
  const place = setup();
  const now = new Date();
  // A clock reading 23:58 is stale unless now is within 3 minutes after it
  const minutesNow = now.getUTCHours() * 60 + now.getUTCMinutes();
  const lateEnough = (minutesNow - (23 * 60 + 58) + 1440) % 1440 > 3 && (minutesNow - (23 * 60 + 58) + 1440) % 1440 < 720;
  place.page(pageList('Teletraan I · 23:58'));
  assert.equal(place.run().restarted, lateEnough);
});

test('no page, a failed page list, no browser and a title with no time each restart', () => {
  const cases = [
    ['no page', place => place.page('[]'), 'the browser has no page'],
    ['a failed page list', place => place.flag('curl.exit'), 'the browser has no page'],
    ['no browser process', place => place.flag('no-browser'), 'no browser process is running'],
    ['a title with no time', place => place.page(pageList('Teletraan I')), 'the page title has no time'],
    ['another page', place => place.page(pageList('Example')), 'the page title has no time'],
  ];
  cases.forEach(([name, prepare, words]) => {
    const place = setup();
    if (name === 'a failed page list') fs.writeFileSync(path.join(place.root, 'stub/curl.exit'), '7');
    else prepare(place);
    const result = place.run();
    assert.equal(result.restarted, true, name);
    assert.ok(result.text.includes(words), name + ': ' + result.text);
  });
});

test('the escaped middle dot of a page list is read too', () => {
  const place = setup();
  place.page(JSON.stringify([{ title: 'Teletraan I · ' + clockAt(-9), type: 'page' }], null, 2).replace('·', '\\u00b7'));
  assert.equal(place.run().restarted, true);
  const fresh = setup();
  fresh.page(JSON.stringify([{ title: 'Teletraan I · ' + clockAt(0), type: 'page' }], null, 2).replace('·', '\\u00b7'));
  assert.equal(fresh.run().restarted, false);
});

test('a browser that started less than 3 minutes ago is given time', () => {
  const place = setup();
  place.page('[]');
  place.age(90);
  const result = place.run();
  assert.equal(result.restarted, false);
  assert.ok(result.text.includes('given time'), result.text);
  place.age(200);
  assert.equal(place.run().restarted, true);
});

test('a second restart inside 10 minutes waits, and one after 10 minutes goes ahead', () => {
  const place = setup();
  place.page(heartbeatTitle(-10));
  place.writeState({ boot: 'boot-one', day: new Date().toISOString().slice(0, 10), today: 1 }, [120]);
  const waiting = place.run();
  assert.equal(waiting.restarted, false);
  assert.ok(waiting.text.includes('Waiting'), waiting.text);

  const later = setup();
  later.page(heartbeatTitle(-10));
  later.writeState({ boot: 'boot-one', day: new Date().toISOString().slice(0, 10), today: 1 }, [700]);
  const result = later.run();
  assert.equal(result.restarted, true);
  assert.ok(later.stateText().includes('today=2'), later.stateText());
  assert.deepEqual(result.told, ['status-write restart 2']);
});

test('the third restart in an hour is not made: the count goes to Studio and restarting stops until the next boot', () => {
  const place = setup();
  place.page(heartbeatTitle(-10));
  place.writeState({ boot: 'boot-one', day: new Date().toISOString().slice(0, 10), today: 2 }, [1500, 2400]);
  const result = place.run();
  assert.equal(result.status, 0, result.errors);
  assert.equal(result.restarted, false);
  assert.ok(result.text.includes('third restart in an hour'), result.text);
  assert.deepEqual(result.told, ['status-write restart 2']);
  assert.ok(place.stateText().includes('stopped=1'), place.stateText());

  // Later runs, even an hour on, keep out
  place.writeState({ boot: 'boot-one', day: new Date().toISOString().slice(0, 10), today: 2, stopped: 1 }, []);
  const again = place.run();
  assert.equal(again.restarted, false);
  assert.ok(again.text.includes('stopped earlier'), again.text);

  // A new boot clears it
  place.boot('boot-two');
  const afterBoot = place.run();
  assert.equal(afterBoot.restarted, true);
  assert.ok(!place.stateText().includes('stopped'), place.stateText());
  assert.ok(place.stateText().includes('boot=boot-two'));
});

test('restarts older than an hour do not count toward the cap, and a new day starts the count of the day again', () => {
  const place = setup();
  place.page(heartbeatTitle(-10));
  place.writeState({ boot: 'boot-one', day: '2020-01-01', today: 5 }, [3700, 4000]);
  const result = place.run();
  assert.equal(result.restarted, true);
  assert.ok(place.stateText().includes('today=1'), place.stateText());
  assert.equal((place.stateText().match(/restart=/g) || []).length, 1, 'only the new restart is kept');
});

test('a state file that cannot be written means no restart, so the limits can never be skipped', () => {
  const place = setup({ noData: true });
  place.page(heartbeatTitle(-10));
  const result = place.run();
  assert.notEqual(result.status, 0);
  assert.equal(result.restarted, false);
  assert.ok(result.errors.includes('cannot be written'), result.errors);
});

test('the script has valid sh syntax, is executable, and reads no key from local.env', () => {
  assert.equal(spawnSync('/bin/sh', ['-n', watchdogFile], { encoding: 'utf8' }).status, 0);
  assert.ok(fs.statSync(watchdogFile).mode & 0o100, 'watchdog.sh should be executable');
  const text = readModule(watchdogFile, 'utf8');
  ['SANITY_WRITE_TOKEN', 'MONDAY_API_TOKEN', 'TBA_AUTH_KEY', 'CALENDAR_'].forEach(name => assert.ok(!text.includes(name), 'watchdog.sh should not name ' + name));
  assert.ok(!/\bcat\b[^\n]*local\.env/.test(text), 'it never prints local.env');
});

test('kiosk.sh opens the debugging port on this machine only', () => {
  const text = readModule(path.join(repo, 'mini/scripts/kiosk.sh'), 'utf8');
  assert.ok(text.includes('--remote-debugging-port=9222'));
  assert.ok(text.includes('--remote-debugging-address=127.0.0.1'));
  assert.ok(!/0\.0\.0\.0/.test(text));
});

test('the watchdog units run the script every 2 minutes, the installer checks them, and none is empty', () => {
  const service = readModule(path.join(repo, 'mini/systemd/teletraan-watchdog.service'), 'utf8');
  const timer = readModule(path.join(repo, 'mini/systemd/teletraan-watchdog.timer'), 'utf8');
  assert.ok(service.includes('ExecStart=/opt/teletraan/mini/scripts/watchdog.sh'));
  assert.ok(!/^User=/m.test(service), 'it runs as root and names no account');
  assert.ok(/^OnUnitActiveSec=2min$/m.test(timer));
  assert.ok(/^WantedBy=timers.target$/m.test(timer));

  const installer = path.join(repo, 'mini/scripts/install-watchdog.sh');
  const text = readModule(installer, 'utf8');
  assert.equal(spawnSync('/bin/sh', ['-n', installer], { encoding: 'utf8' }).status, 0);
  assert.ok(fs.statSync(installer).mode & 0o100);
  assert.ok(text.includes('[ ! -s "$units/$unit" ]'), 'a missing or empty unit stops it');
  assert.ok(text.includes('exit 1'));
  assert.ok(!/hawktimus/.test(text.replace(/If that account is called hawktimus/g, '')), 'no account name written in');
  assert.ok(text.includes('teletraan-watchdog.service') && text.includes('teletraan-watchdog.timer'));
});

test('the heartbeat puts Teletraan I, a middle dot and HH:MM in the title, and keeps the time in localStorage', async () => {
  const stored = {};
  globalThis.document = { title: '' };
  globalThis.window = { localStorage: { setItem: (key, value) => { stored[key] = value; } } };
  const heartbeat = await import(pathToFileURL(path.join(repo, 'dashboard/core/heartbeat.js')).href);

  assert.equal(heartbeat.heartbeatSeconds, 30);
  assert.equal(heartbeat.heartbeatTitle(new Date(2026, 9, 15, 7, 5)), 'Teletraan I · 07:05');
  heartbeat.beat(new Date(2026, 9, 15, 14, 7));
  assert.equal(document.title, 'Teletraan I · 14:07');
  assert.equal(stored['teletraan-heartbeat'], new Date(2026, 9, 15, 14, 7).toISOString());

  // Blocked storage must not stop the title
  globalThis.window = { localStorage: { setItem: () => { throw new Error('blocked'); } } };
  heartbeat.beat(new Date(2026, 9, 15, 14, 8));
  assert.equal(document.title, 'Teletraan I · 14:08');
  delete globalThis.window;
  heartbeat.beat(new Date(2026, 9, 15, 14, 9));
  assert.equal(document.title, 'Teletraan I · 14:09');

  const shell = readModule(path.join(repo, 'dashboard/shell.js'), 'utf8');
  assert.ok(shell.includes("from './core/heartbeat.js'") && shell.includes('startHeartbeat();'), 'shell.js starts the heartbeat');
});

let failures = 0;
try {
  for (const entry of tests) {
    try {
      await entry.run();
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
