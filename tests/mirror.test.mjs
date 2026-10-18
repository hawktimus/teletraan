// The mirror: the picture service (computer/scripts/mirror.py) against a small fake DevTools server written here,
// the helper words that start it, the unit, the nginx locations, the control route and the logic of the card.
//
//   node tests/mirror.test.mjs
//
// The Python part is skipped with a plain note when python3 is not on this machine.

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import * as route from '../control/routes/mirror.js';
import { makeWorld } from './helpers/control-world.mjs';
import { framesPerSecond, mirrorLive, mirrorPictureAddress, mirrorWords, previewCardHtml } from '../control/static/tabs/render.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const read = name => fs.readFileSync(repo + name, 'utf8');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-mirror-'));
const havePython = spawnSync('python3', ['--version']).status === 0;
let count = 0;

function wsFrame(opcode, payload, fin = true) {
  const body = Buffer.from(payload);
  const head = body.length < 126 ? Buffer.from([(fin ? 0x80 : 0) | opcode, body.length]) : Buffer.concat([Buffer.from([(fin ? 0x80 : 0) | opcode, 126]), Buffer.from([body.length >> 8, body.length & 255])]);
  return Buffer.concat([head, body]);
}

// Reads the masked frames a client sends and gives each whole one to onFrame(opcode, buffer)
function frameReader(onFrame) {
  let buffer = Buffer.alloc(0);
  return chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      if (buffer.length < 2) return;
      let size = buffer[1] & 0x7f;
      let at = 2;
      if (size === 126) { if (buffer.length < 4) return; size = buffer.readUInt16BE(2); at = 4; }
      if (buffer.length < at + 4 + size) return;
      const mask = buffer.subarray(at, at + 4);
      const data = Buffer.from(buffer.subarray(at + 4, at + 4 + size));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i % 4];
      onFrame(buffer[0] & 0x0f, data, Boolean(buffer[1] & 0x80));
      buffer = buffer.subarray(at + 4 + size);
    }
  };
}

// A fake browser: /json lists one page, and its socket answers Page.startScreencast with the frames in options.pictures
function fakeBrowser(pictures, options = {}) {
  const seen = { messages: [], acks: [], pong: false, unmasked: false, upgraded: false };
  const server = http.createServer((req, res) => {
    if (req.url !== '/json') { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([
      { type: 'service_worker', url: 'http://localhost/sw.js', webSocketDebuggerUrl: 'ws://127.0.0.1:' + server.address().port + '/devtools/page/other' },
      { type: 'page', url: 'http://localhost:8080/dashboard/', webSocketDebuggerUrl: 'ws://127.0.0.1:' + server.address().port + '/devtools/page/ABC' },
    ]));
  });
  server.on('upgrade', (req, socket) => {
    seen.upgraded = req.url === '/devtools/page/ABC';
    const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    socket.on('error', () => {});
    socket.on('data', frameReader((opcode, data, masked) => {
      if (!masked) seen.unmasked = true;
      if (opcode === 10) { seen.pong = true; return; }
      if (opcode !== 1) return;
      const message = JSON.parse(data.toString());
      seen.messages.push(message);
      if (message.method === 'Page.screencastFrameAck') seen.acks.push(message.params.sessionId);
      if (message.method === 'Page.captureScreenshot' && options.shot) {
        socket.write(wsFrame(1, JSON.stringify({ id: message.id, result: { data: options.shot.toString('base64') } })));
        return;
      }
      if (message.method !== 'Page.startScreencast') return;
      socket.write(wsFrame(9, 'hi'));
      pictures.forEach((bytes, index) => {
        const text = JSON.stringify({ method: 'Page.screencastFrame', params: { data: bytes.toString('base64'), sessionId: index + 1, metadata: {} } });
        if (index === 1) {
          // the second message comes in two pieces, as a browser may send a big one
          socket.write(wsFrame(1, text.slice(0, 40), false));
          socket.write(wsFrame(0, text.slice(40), true));
        } else {
          socket.write(wsFrame(1, text));
        }
      });
      if (options.closeAfter) setTimeout(() => socket.end(wsFrame(8, '')), options.closeAfter);
    }));
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, seen, port: server.address().port })));
}

function runMirror(port, data, extra = {}) {
  const child = spawn('python3', ['-I', path.join(repo, 'computer/scripts/mirror.py')], {
    env: Object.assign({ PATH: process.env.PATH, MIRROR_PORT: String(port), MIRROR_DATA: data, MIRROR_ENV: path.join(data, 'none.env') }, extra),
  });
  let said = '';
  child.stderr.on('data', chunk => { said += chunk; });
  const done = new Promise(resolve => child.on('close', code => resolve({ code, said })));
  return { child, done };
}

const until = async (check, milliseconds = 8000) => {
  const end = Date.now() + milliseconds;
  while (Date.now() < end) {
    const found = check();
    if (found) return found;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return null;
};

const first = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
const second = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 9, 8, 7, 6, 5, 4, 0xff, 0xd9]);

if (!havePython) {
  console.log('note python3 is not on this machine, so the picture service is not run here');
} else {
  test('mirror.py writes each frame by renaming a finished file, counts them, answers every frame and the ping', async () => {
    const browser = await fakeBrowser([first, second]);
    const data = path.join(work, 'd' + count++);
    fs.mkdirSync(data);
    const run = runMirror(browser.port, data, { MIRROR_IDLE: '4' });
    const folder = path.join(data, 'mirror');
    const reached = await until(() => fs.existsSync(path.join(folder, 'frame.n')) && fs.readFileSync(path.join(folder, 'frame.n'), 'utf8') === '2');
    assert.ok(reached, 'the counter reached 2');
    assert.deepEqual(fs.readFileSync(path.join(folder, 'frame.jpg')), second, 'the newest frame is the file');
    assert.ok(!fs.existsSync(path.join(folder, 'frame.jpg.tmp')) && !fs.existsSync(path.join(folder, 'frame.n.tmp')), 'no half written file is left');
    const asked = browser.seen.messages.find(message => message.method === 'Page.startScreencast');
    assert.deepEqual(asked.params, { format: 'jpeg', quality: 45, maxWidth: 960, maxHeight: 540, everyNthFrame: 2 });
    await until(() => browser.seen.acks.length === 2);
    assert.deepEqual(browser.seen.acks, [1, 2]);
    assert.ok(browser.seen.upgraded && browser.seen.pong && !browser.seen.unmasked, 'right page, ping answered, every client frame masked');
    const ended = await run.done;
    assert.equal(ended.code, 0);
    assert.match(ended.said, /nobody is watching after [\d.]+ s, 2 frames/);
    assert.ok(!fs.existsSync(path.join(folder, 'frame.jpg')) && !fs.existsSync(path.join(folder, 'frame.n')), 'a stopped mirror leaves no old picture');
    browser.server.close();
  });

  const tiny = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(1500, 1), Buffer.from([0xff, 0xd9])]);
  const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40000, 7), Buffer.from([0xff, 0xd9])]);
  const readState = folder => { try { return JSON.parse(fs.readFileSync(path.join(folder, 'state.json'), 'utf8')); } catch (error) { return null; } };

  test('mirror.py prepares the page, and with good frames it stays on the screencast', async () => {
    const browser = await fakeBrowser([big, big, big, big, big]);
    const data = path.join(work, 'd' + count++);
    fs.mkdirSync(data);
    const run = runMirror(browser.port, data, { MIRROR_IDLE: '3' });
    const folder = path.join(data, 'mirror');
    assert.ok(await until(() => fs.existsSync(path.join(folder, 'frame.n')) && fs.readFileSync(path.join(folder, 'frame.n'), 'utf8') === '5'));
    const state = await until(() => { const found = readState(folder); return found && found.mode === 'screencast' ? found : null; });
    assert.ok(state, 'a state file');
    assert.equal(state.state, 'ok');
    assert.equal(typeof state.fps, 'number');
    const methods = browser.seen.messages.map(message => message.method);
    ['Page.enable', 'Page.bringToFront', 'Emulation.setFocusEmulationEnabled', 'Page.setWebLifecycleState'].forEach(name => assert.ok(methods.includes(name), name));
    assert.ok(methods.indexOf('Page.enable') < methods.indexOf('Page.startScreencast'));
    assert.deepEqual(browser.seen.messages.find(message => message.method === 'Page.setWebLifecycleState').params, { state: 'active' });
    assert.ok(!methods.includes('Page.captureScreenshot') && !methods.includes('Page.stopScreencast'), 'no fallback');
    const ended = await run.done;
    assert.ok(!/was black/.test(ended.said));
    assert.ok(!fs.existsSync(path.join(folder, 'state.json')), 'a stopped mirror leaves no state');
    browser.server.close();
  });

  test('mirror.py falls back to screenshots when three frames in a row are black, and says ok when those are good', async () => {
    const browser = await fakeBrowser([tiny, tiny, tiny, tiny], { shot: big });
    const data = path.join(work, 'd' + count++);
    fs.mkdirSync(data);
    const run = runMirror(browser.port, data, { MIRROR_IDLE: '3' });
    const folder = path.join(data, 'mirror');
    const state = await until(() => { const found = readState(folder); return found && found.mode === 'screenshots' ? found : null; });
    assert.ok(state, 'a state file in screenshot mode');
    assert.equal(state.state, 'ok');
    assert.ok(await until(() => fs.existsSync(path.join(folder, 'frame.jpg')) && fs.readFileSync(path.join(folder, 'frame.jpg')).length === big.length), 'the screenshot is the picture');
    const shot = browser.seen.messages.find(message => message.method === 'Page.captureScreenshot');
    assert.deepEqual(shot.params, { format: 'jpeg', quality: 50, fromSurface: true, captureBeyondViewport: false });
    assert.ok(browser.seen.messages.some(message => message.method === 'Page.stopScreencast'));
    const ended = await run.done;
    assert.match(ended.said, /mirror: screencast was black, using screenshots/);
    browser.server.close();
  });

  test('mirror.py keeps writing and says black when the screenshots are black too', async () => {
    const browser = await fakeBrowser([tiny, tiny, tiny], { shot: tiny });
    const data = path.join(work, 'd' + count++);
    fs.mkdirSync(data);
    const run = runMirror(browser.port, data, { MIRROR_IDLE: '3' });
    const folder = path.join(data, 'mirror');
    const state = await until(() => { const found = readState(folder); return found && found.state === 'black' ? found : null; });
    assert.ok(state, 'the state says black');
    assert.equal(state.mode, 'screenshots');
    assert.ok(fs.existsSync(path.join(folder, 'frame.jpg')), 'the pictures keep coming');
    await run.done;
    browser.server.close();
  });

  test('mirror.py stops by itself when the watch file is old, and keeps going while it is touched', async () => {
    const browser = await fakeBrowser([first]);
    const data = path.join(work, 'd' + count++);
    fs.mkdirSync(path.join(data, 'mirror'), { recursive: true });
    const watch = path.join(data, 'mirror', 'watch');
    fs.writeFileSync(watch, '');
    const run = runMirror(browser.port, data, { MIRROR_IDLE: '2' });
    const began = Date.now();
    let stopped = false;
    run.done.then(() => { stopped = true; });
    for (let i = 0; i < 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      fs.utimesSync(watch, new Date(), new Date());
    }
    assert.equal(stopped, false, 'still running after 3 seconds of touches');
    const ended = await run.done;
    assert.ok(Date.now() - began >= 3000);
    assert.match(ended.said, /nobody is watching/);
    browser.server.close();
  });

  test('mirror.py stops when the browser closes the socket, and when it runs past the longest time', async () => {
    const browser = await fakeBrowser([first], { closeAfter: 300 });
    const data = path.join(work, 'd' + count++);
    fs.mkdirSync(data);
    const ended = await runMirror(browser.port, data).done;
    assert.equal(ended.code, 0);
    assert.match(ended.said, /the browser closed the socket/);
    browser.server.close();

    const other = await fakeBrowser([first]);
    const data2 = path.join(work, 'd' + count++);
    fs.mkdirSync(data2);
    const limited = await runMirror(other.port, data2, { MIRROR_MAX: '1' }).done;
    assert.match(limited.said, /ran for the longest time allowed/);
    other.server.close();
  });

  test('mirror.py with no browser says so on one line and fails', async () => {
    const data = path.join(work, 'd' + count++);
    fs.mkdirSync(data);
    const ended = await runMirror(9, data).done;
    assert.equal(ended.code, 1);
    assert.match(ended.said, /^mirror: could not run: /);
  });
}

test('the script uses the standard library only and keeps the debug port on 127.0.0.1', () => {
  const text = read('computer/scripts/mirror.py');
  const imports = [...text.matchAll(/^(?:import|from) (\w+)/gm)].map(match => match[1]);
  assert.deepEqual(imports.sort(), ['base64', 'hashlib', 'json', 'os', 'resource', 'socket', 'struct', 'sys', 'time', 'urllib'].sort());
  assert.ok(text.includes("'http://127.0.0.1:%d/json'") && !text.includes('0.0.0.0'));
  assert.ok(text.includes("'quality': 45, 'maxWidth': 960, 'maxHeight': 540, 'everyNthFrame': 2"));
  assert.ok(text.includes('os.replace(temporary, path)'));
});

test('the unit starts only on demand, as the login user', () => {
  const unit = read('computer/systemd/teletraan-mirror.service');
  assert.ok(unit.includes('Type=simple') && unit.includes('User=ACCOUNT') && unit.includes('mirror.py'));
  assert.ok(!unit.includes('[Install]') && !/EnvironmentFile/.test(unit), 'no Install section, and local.env is not loaded');
  const install = read('computer/install.sh');
  assert.ok(install.includes('teletraan-mirror.service') && install.includes('python3 --version'));
});

test('the sudoers rule already allows starting this unit, and only starting', () => {
  const rule = read('computer/sudoers/teletraan-control').split('\n').find(line => line.includes('NOPASSWD:') && line.includes('systemctl start teletraan-*.service'));
  assert.ok(rule);
  const helper = read('computer/scripts/control-helper.sh');
  assert.ok(helper.includes('as_root "$systemctl_bin" start teletraan-mirror.service'));
  assert.ok(!/systemctl_bin" (stop|restart) teletraan-mirror/.test(helper));
});

test('port 3229 serves the picture and its counter, read only, with no store, and nothing else of the folder', () => {
  const nginx = read('computer/nginx/nginx.conf');
  const start = nginx.indexOf('listen 3229;');
  const block = nginx.slice(nginx.lastIndexOf('server {', start), nginx.indexOf('\n  server {', start));
  assert.match(block, /location = \/mirror\/frame\.jpg \{\s+alias \/srv\/web\/dashboard\/data\/live\/mirror\/frame\.jpg;/);
  assert.match(block, /location = \/mirror\/frame\.n \{\s+alias \/srv\/web\/dashboard\/data\/live\/mirror\/frame\.n;/);
  const map = nginx.slice(nginx.indexOf('map $uri $cache_control'), nginx.indexOf('add_header Cache-Control $cache_control'));
  assert.ok(map.indexOf('~^/mirror/ "no-store"') > 0 && map.indexOf('~^/mirror/') < map.indexOf('jpe?g'), 'the map says no-store for the picture before it says a week for jpg');
  assert.ok(!block.includes('mirror/watch') && !/9222/.test(nginx), 'the watch file and the debug port are not served');
  assert.ok(read('computer/docker-compose.yml').includes('read_only: true'));
});

// The helper with fakes for sudo and systemctl. withPython false leaves python3 off the path.
function helperWorld({ python = true, active = true } = {}) {
  const root = path.join(work, 'h' + count++);
  const bin = path.join(root, 'bin');
  const tools = path.join(root, 'tools');
  const data = path.join(root, 'data');
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(tools);
  fs.mkdirSync(path.join(root, 'logs'));
  fs.mkdirSync(path.join(root, 'computer/scripts'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'computer/scripts/lib.sh'), path.join(root, 'computer/scripts/lib.sh'));
  const log = path.join(root, 'calls.log');
  fs.writeFileSync(path.join(bin, 'sudo'), `#!/bin/sh\necho "sudo $*" >> "${log}"\nexit 0\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'systemctl'), `#!/bin/sh\necho "systemctl $*" >> "${log}"\n[ "$1" = is-active ] && exit ${active ? 0 : 3}\nexit 0\n`, { mode: 0o755 });
  if (python) fs.writeFileSync(path.join(bin, 'python3'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  // a path with the plain tools the helper uses and no python3
  for (const tool of ['sh', 'bash', 'date', 'tr', 'cut', 'mkdir', 'touch', 'sed', 'tail', 'head', 'cat', 'dirname', 'basename', 'id', 'hostname', 'printf']) {
    for (const folder of ['/bin', '/usr/bin']) {
      if (fs.existsSync(path.join(folder, tool))) { try { fs.symlinkSync(path.join(folder, tool), path.join(tools, tool)); } catch (error) { /* already linked */ } break; }
    }
  }
  return {
    data,
    ask(word) {
      const dirs = python ? [bin, tools, '/usr/bin', '/bin'] : [bin, tools];
      const result = spawnSync('sh', [path.join(repo, 'computer/scripts/control-helper.sh')], {
        input: word + '\n', encoding: 'utf8',
        env: { PATH: dirs.join(':'), TELETRAAN_ROOT: root, TELETRAAN_SYSTEMCTL: path.join(bin, 'systemctl'), TELETRAAN_DATA_DIR: data },
      });
      const lines = result.stdout.trimEnd().split('\n');
      return { status: lines[lines.length - 1], output: lines.slice(0, -1).join('\n'), calls: fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '' };
    },
  };
}

test('mirror-watch touches the watch file as the login user and starts the unit; starting twice is harmless', () => {
  const h = helperWorld();
  const answer = h.ask('mirror-watch');
  assert.equal(answer.status, 'ok');
  assert.equal(answer.output, 'mirror: running');
  assert.ok(fs.existsSync(path.join(h.data, 'mirror', 'watch')));
  assert.ok(answer.calls.includes('sudo -n') && answer.calls.includes('start teletraan-mirror.service'));
  const again = h.ask('mirror-watch');
  assert.equal(again.status, 'ok');
});

test('mirror-start starts the unit and touches nothing; mirror-status only asks', () => {
  const h = helperWorld({ active: false });
  const start = h.ask('mirror-start');
  assert.equal(start.status, 'ok');
  assert.equal(start.output, 'mirror: stopped');
  assert.ok(start.calls.includes('start teletraan-mirror.service'));
  assert.ok(!fs.existsSync(path.join(h.data, 'mirror')));
  const status = helperWorld({ active: false }).ask('mirror-status');
  assert.equal(status.output, 'mirror: stopped');
  assert.ok(!status.calls.includes('start teletraan-mirror'), 'status never starts it');
  assert.equal(helperWorld().ask('mirror-status').output, 'mirror: running');
});

test('without python3 every mirror word says so and starts nothing', () => {
  ['mirror-start', 'mirror-watch', 'mirror-status'].forEach(word => {
    const h = helperWorld({ python: false });
    const answer = h.ask(word);
    assert.equal(answer.status, 'ok', word);
    assert.equal(answer.output, 'mirror: no python3', word);
    assert.ok(!answer.calls.includes('start'), word);
  });
});

test('the mirror words take no argument, and the client and the route know them', () => {
  const h = helperWorld();
  assert.equal(h.ask('mirror-watch now').status, 'refused');
  assert.equal(h.ask('mirror-stop').status, 'refused');
  ['mirror-start', 'mirror-watch', 'mirror-status'].forEach(word => {
    assert.ok(read('control/lib/helper-client.js').includes("'" + word + "'") && read('control/routes/helper.js').includes("'" + word + "'"), word);
  });
});

test('POST /mirror/watch asks the helper for mirror-watch and gives the state; it needs the PIN', async () => {
  const world = await makeWorld([route]);
  world.ctx.helper = async word => { world.helped.push({ word }); return 'mirror: running'; };
  const answer = await world.router.call('POST', '/mirror/watch', { body: {} });
  assert.equal(answer.status, 200);
  assert.deepEqual(answer.json, { ok: true, state: 'running' });
  assert.deepEqual(world.helped.map(item => item.word), ['mirror-watch']);
  world.pin = false;
  const refused = await world.router.call('POST', '/mirror/watch', { body: {} });
  assert.equal(refused.status, 401);
  assert.equal(world.helped.length, 1, 'no PIN, no helper call');
});

test('the route gives no-python3 and stopped, and a plain sentence when the helper fails', async () => {
  const world = await makeWorld([route]);
  world.ctx.helper = async () => 'mirror: no python3';
  assert.equal((await world.router.call('GET', '/mirror/status')).json.state, 'no-python3');
  world.ctx.helper = async () => 'mirror: stopped';
  assert.equal((await world.router.call('GET', '/mirror/status')).json.state, 'stopped');
  world.ctx.helper = async () => { throw new Error('The helper refused that.'); };
  const failed = await world.router.call('POST', '/mirror/watch', { body: {} });
  assert.equal(failed.status, 502);
  assert.equal(failed.json.error, 'The helper refused that.');
  assert.equal(route.mirrorState('nonsense'), 'unknown');
});

test('the card words: live with a rate, the two fallbacks, the picture address and the rate from the draw times', () => {
  assert.equal(mirrorLive(14.26), 'Live from the TV, 14.3 frames a second');
  assert.equal(mirrorLive(NaN), 'Live from the TV, 0 frames a second');
  assert.equal(mirrorWords.failed, 'The mirror could not start. Showing the copy that follows the screen.');
  assert.ok(mirrorWords.noPython.startsWith('The mirror needs python3 on the computer.'));
  assert.equal(mirrorPictureAddress(' 42 '), '/mirror/frame.jpg?n=42');
  assert.equal(framesPerSecond([1000, 1100, 1200, 1300, 1400], 1500), 10);
  assert.equal(framesPerSecond([1000], 1500), 0);
  assert.equal(framesPerSecond([100, 200], 9000), 0, 'old draws do not count');
  assert.ok(previewCardHtml().includes('data-preview-mode') && !previewCardHtml().includes('<img'));
});

test('the page: one request in flight, renews every 30 seconds, gives up after 10, and stops with the tab', () => {
  const text = read('control/static/tabs/preview.js');
  assert.ok(text.includes('const watchSeconds = 30') && text.includes("api('POST', '/mirror/watch', {})"));
  assert.ok(text.includes("fetch('/mirror/frame.n', { cache: 'no-store' })") && text.includes('mirrorPictureAddress(counter)'));
  assert.equal(text.split("await fetch(").length - 1, 2, 'a counter read and a picture read, each awaited before the next');
  assert.ok(text.includes('mirrorFrameWait') && read('control/static/tabs/render.js').includes('export const mirrorFrameWait = 10000'));
  assert.ok(text.includes('if (!document.hidden)') && text.includes('document.addEventListener(\'visibilitychange\''));
  assert.ok(text.includes('URL.revokeObjectURL'));
  assert.ok(text.includes('let wanted = wide();') && text.includes('if (wanted) load(); else unload();'), 'a phone loads only on the tap');
});

process.on('exit', () => fs.rmSync(work, { recursive: true, force: true }));
await finish();
