// Tests that the TV never runs old code after an update: index.html asks for every script and stylesheet with
// ?v=<build>, the build falls back to the time when dashboard/build.js is missing, kiosk.sh writes build.js and clears
// the browser cache (and nothing else in the profile), and the web server settings tell the browser to check .html,
// .js and .css again each time while images and fonts are kept for a week. The browser tools are fakes in a
// temporary folder, so nothing touches a real browser, screen or service.
//
//   node tests/no-old-code.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { textOf } from './helpers/script-parts.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-old-code-'));
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');

const tests = [];
function test(name, body) {
  tests.push({ name: name, body: body });
}

// index.html

const html = read('dashboard/index.html');

test('every stylesheet link in index.html carries the version query', () => {
  const links = html.match(/<link [^>]*rel="stylesheet"[^>]*>/g) || [];
  assert.ok(links.length > 10, 'found the stylesheet links');
  links.forEach(link => assert.ok(/href="[^"?]+\?v=[^"]+"/.test(link), link));
});

// The loader is the classic script that asks for build.js. import() is swapped for a function the test controls,
// because a plain script run here has no module loader.
function runLoader(importBuild) {
  const loader = html.match(/<script>\s*\(function \(\) \{\s*function start[\s\S]*?<\/script>/);
  assert.ok(loader, 'index.html has the loader');
  const code = loader[0].replace(/^<script>/, '').replace(/<\/script>$/, '').replace("import('./build.js')", 'fakeImport()');

  const links = (html.match(/<link [^>]*rel="stylesheet"[^>]*>/g) || []).map(link => {
    const attributes = { rel: 'stylesheet', href: /href="([^"]+)"/.exec(link)[1] };
    return { getAttribute: name => attributes[name], setAttribute: (name, value) => { attributes[name] = value; }, attributes: attributes };
  });
  const added = [];
  const sandbox = {
    window: {},
    Date: Date,
    String: String,
    fakeImport: importBuild,
    document: {
      querySelectorAll: () => links,
      createElement: () => ({}),
      body: { appendChild: element => added.push(element) },
    },
  };
  vm.runInNewContext(code, sandbox);
  return { links: links, added: added, window: sandbox.window };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 5));

test('with a build, the entry script and every stylesheet are asked for with it', async () => {
  const loaded = runLoader(() => Promise.resolve({ build: 'abc1234' }));
  await settle();
  assert.equal(loaded.added.length, 1);
  assert.equal(loaded.added[0].src, 'shell.js?v=abc1234');
  assert.equal(loaded.added[0].type, 'module');
  assert.equal(loaded.window.teletraanBuild, 'abc1234');
  loaded.links.forEach(link => assert.ok(link.attributes.href.endsWith('?v=abc1234'), link.attributes.href));
});

test('with no build.js, the page still starts and uses the time', async () => {
  const before = Date.now();
  const loaded = runLoader(() => Promise.reject(new Error('404')));
  await settle();
  assert.equal(loaded.added.length, 1);
  const stamp = /^shell\.js\?v=(\d+)$/.exec(loaded.added[0].src);
  assert.ok(stamp, loaded.added[0].src);
  assert.ok(Number(stamp[1]) >= before);
  assert.equal(loaded.window.teletraanBuild, stamp[1]);
  loaded.links.forEach(link => assert.ok(link.attributes.href.endsWith('?v=' + stamp[1]), link.attributes.href));
});

test('no script is loaded without the loader, build.js is ignored by git and its shape is committed', () => {
  assert.ok(!/<script[^>]*\ssrc=/.test(html), 'index.html has no script with a src of its own');
  assert.ok(/^dashboard\/build\.js$/m.test(read('.gitignore')));
  assert.ok(/export const build = "[^"]*";/.test(read('dashboard/build.example.js')));
  assert.ok(!fs.existsSync(path.join(repo, 'dashboard/build.js')), 'no build.js is committed');
});

test('the corner stamp shows the build: a hash cut to seven characters, or a time stamp as it is', async () => {
  const stamp = await import(path.join(repo, 'dashboard/core/build-stamp.js').replace(/^/, 'file://'));
  assert.equal(stamp.stampText('abc1234'), 'abc1234');
  assert.equal(stamp.stampText('0123456789abcdef'), '0123456');
  assert.equal(stamp.stampText('t20261015120000'), 't20261015120000');
  assert.equal(stamp.stampText('<b>'), '');
  assert.ok(/showStamp\([^;]*window\.teletraanBuild/.test(read('dashboard/shell.js')));
});

// kiosk.sh

const ordinaryTools = ['sed', 'head', 'tail', 'grep', 'date', 'dirname', 'cat', 'mv', 'rm', 'chmod', 'awk', 'sleep', 'hostname'];

function findTool(name) {
  const found = spawnSync('/bin/sh', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
  assert.ok(found, 'this computer has no ' + name);
  return found;
}

function writeTool(folder, name, text) {
  fs.writeFileSync(path.join(folder, name), text, { mode: 0o755 });
}

let counter = 0;

// A copy of mini/ and a dashboard folder to run kiosk.sh in, with fake curl, xset, xrandr, chromium, and git.
// Options: stamp (the text of mini/build.txt), git (what git prints for the short hash, or nothing).
function setup(options) {
  counter += 1;
  const root = path.join(work, 'run' + counter);
  const bin = path.join(root, 'bin');
  const home = path.join(root, 'home');
  fs.mkdirSync(path.join(root, 'mini/scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dashboard'));
  fs.mkdirSync(bin);
  fs.mkdirSync(home);
  ['kiosk.sh', 'display.sh', 'lib.sh'].forEach(file => fs.copyFileSync(path.join(repo, 'mini/scripts', file), path.join(root, 'mini/scripts', file)));
  writeTool(path.join(root, 'mini/scripts'), 'status-write.sh', `#!/bin/sh
echo "status-write $* build=$(cat "$(dirname "$0")/../../dashboard/build.js" 2> /dev/null)" >> "$STUB_LOG"
`);
  if (options.stamp) fs.writeFileSync(path.join(root, 'mini/build.txt'), options.stamp);

  ordinaryTools.forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));
  writeTool(bin, 'curl', '#!/bin/sh\nexit 0\n');
  writeTool(bin, 'xset', '#!/bin/sh\nexit 0\n');
  writeTool(bin, 'xrandr', '#!/bin/sh\nexit 0\n');
  writeTool(bin, 'chromium', '#!/bin/sh\necho "chromium $*" >> "$STUB_LOG"\n');
  writeTool(bin, 'git', options.git ? `#!/bin/sh\necho ${options.git}\n` : '#!/bin/sh\nexit 128\n');

  const profile = path.join(home, '.config/teletraan-kiosk');
  fs.mkdirSync(path.join(profile, 'Default/Local Storage/leveldb'), { recursive: true });
  fs.mkdirSync(path.join(profile, 'Default/Cache'), { recursive: true });
  fs.mkdirSync(path.join(profile, 'Default/Code Cache/js'), { recursive: true });
  fs.mkdirSync(path.join(profile, 'Default/Service Worker/CacheStorage'), { recursive: true });
  fs.writeFileSync(path.join(profile, 'Default/Cache/old_0'), 'old');
  fs.writeFileSync(path.join(profile, 'Default/Code Cache/js/old_0'), 'old');
  fs.writeFileSync(path.join(profile, 'Default/Service Worker/CacheStorage/old_0'), 'old');
  fs.writeFileSync(path.join(profile, 'Default/Local Storage/leveldb/000003.log'), 'last content');
  fs.writeFileSync(path.join(profile, 'Default/Cookies'), 'cookies');

  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');
  const result = spawnSync('/bin/sh', [path.join(root, 'mini/scripts/kiosk.sh')], {
    env: { PATH: bin, HOME: home, STUB_LOG: log, DISPLAY_POLL_INTERVAL: '0', DISPLAY_POLL_LIMIT: '0' },
    encoding: 'utf8',
    input: '',
  });
  assert.equal(result.status, 0, result.stderr);
  return {
    root: root,
    profile: profile,
    log: fs.readFileSync(log, 'utf8'),
    buildFile: () => fs.existsSync(path.join(root, 'dashboard/build.js')) ? fs.readFileSync(path.join(root, 'dashboard/build.js'), 'utf8') : null,
    leftovers: () => fs.readdirSync(path.join(root, 'dashboard')),
  };
}

test('kiosk.sh writes build.js from the stamp the Mac tool leaves', () => {
  const run = setup({ stamp: 'commit=abc1234\ndate=2026-10-15\nbranch=main\n', git: 'ffffff0' });
  assert.equal(run.buildFile(), 'export const build = "abc1234";\n' + 'export const version = 0;\nexport const commit = "";\nexport const date = "";\n');
  assert.deepEqual(run.leftovers(), ['build.js'], 'no temporary file is left');
});

test('kiosk.sh asks git when there is no stamp', () => {
  const run = setup({ git: 'deadbee' });
  assert.equal(run.buildFile(), 'export const build = "deadbee";\n' + 'export const version = 0;\nexport const commit = "";\nexport const date = "";\n');
});

test('kiosk.sh uses the time when there is neither', () => {
  const run = setup({});
  assert.ok(/^export const build = "t\d{14}";\n/.test(run.buildFile()), run.buildFile());
});

test('kiosk.sh calls the version job after build.js is written, and starts the browser', () => {
  const run = setup({ stamp: 'commit=abc1234\ndate=2026-10-15\nbranch=main\n' });
  assert.ok(run.log.includes('status-write version build=export const build = "abc1234";'), run.log);
  assert.ok(run.log.includes('chromium '));
  const text = read('mini/scripts/kiosk.sh');
  assert.ok(text.indexOf('write_build || true') < text.indexOf('status-write.sh" version'));
});

test('kiosk.sh clears the browser cache folders and leaves cookies and Local Storage alone', () => {
  const run = setup({ git: 'deadbee' });
  assert.ok(!fs.existsSync(path.join(run.profile, 'Default/Cache')));
  assert.ok(!fs.existsSync(path.join(run.profile, 'Default/Code Cache')));
  assert.ok(!fs.existsSync(path.join(run.profile, 'Default/Service Worker/CacheStorage')));
  assert.equal(fs.readFileSync(path.join(run.profile, 'Default/Local Storage/leveldb/000003.log'), 'utf8'), 'last content');
  assert.equal(fs.readFileSync(path.join(run.profile, 'Default/Cookies'), 'utf8'), 'cookies');
});

test('kiosk.sh and the Mac tool pass the syntax check', () => {
  assert.equal(spawnSync('/bin/sh', ['-n', path.join(repo, 'mini/scripts/kiosk.sh')], { encoding: 'utf8' }).status, 0);
  assert.equal(spawnSync('bash', ['-n', path.join(repo, 'tools/mini/teletraan-mini')], { encoding: 'utf8' }).status, 0);
  // The release the installer makes writes build.js from RELEASE.json; the Mac tool hands it the commit
  assert.ok(/install\.sh[^\n]*--commit/.test(textOf(path.join(repo, 'tools/mini/teletraan-mini'))), 'the Mac tool gives the installer the commit');
});

// The web server settings

// What nginx would send for an address, from the map in mini/nginx/nginx.conf
function cacheControl(uri) {
  const nginx = read('mini/nginx/nginx.conf');
  const body = /map \$uri \$cache_control \{([\s\S]*?)\n  \}/.exec(nginx);
  assert.ok(body, 'nginx.conf has the map');
  // The first pattern that matches wins, and default is the answer when none does
  let fallback = null;
  const patterns = [];
  body[1].split('\n').map(line => line.trim()).filter(line => line !== '' && !line.startsWith('#')).forEach(line => {
    const pair = /^(default|~\S+)\s+"([^"]+)";$/.exec(line);
    assert.ok(pair, 'a line of the map: ' + line);
    if (pair[1] === 'default') fallback = pair[2];
    else patterns.push([new RegExp(pair[1].slice(1)), pair[2]]);
  });
  const found = patterns.find(pattern => pattern[0].test(uri));
  return found ? found[1] : fallback;
}

test('nginx sends no-cache for html, js and css (build.js and the entry page too)', () => {
  ['/dashboard/', '/dashboard/index.html', '/dashboard/build.js', '/dashboard/shell.js', '/dashboard/core/constants.js', '/dashboard/base.css', '/dashboard/panels/tasks/panel.css'].forEach(uri => {
    assert.equal(cacheControl(uri), 'no-cache', uri);
  });
});

test('nginx sends a week of max-age for images and fonts only', () => {
  ['/dashboard/assets/logo.png', '/dashboard/assets/photo.jpg', '/dashboard/assets/photo.webp', '/dashboard/assets/mark.svg', '/dashboard/fonts/title.woff2', '/dashboard/assets/icon.ico'].forEach(uri => {
    assert.equal(cacheControl(uri), 'max-age=604800', uri);
  });
});

test('nginx keeps the live data out of every cache', () => {
  ['/dashboard/data/live/version.txt', '/dashboard/data/live/team.json', '/dashboard/data/live/calendar.ics'].forEach(uri => {
    assert.equal(cacheControl(uri), 'no-store', uri);
  });
});

test('nginx uses the map for every response, keeps its locations as they were, and explains the choice', () => {
  const nginx = read('mini/nginx/nginx.conf');
  assert.ok(/add_header Cache-Control \$cache_control always;/.test(nginx));
  assert.ok(!/add_header Cache-Control "no-store"/.test(nginx));
  assert.ok(/not a week of max-age/.test(nginx), 'the comment says why .js is not given a long max-age');
});

let failures = 0;
for (const { name, body } of tests) {
  try {
    await body();
    console.log('ok   ' + name);
  } catch (error) {
    failures += 1;
    console.log('FAIL ' + name + '\n' + error.message);
  }
}
fs.rmSync(work, { recursive: true, force: true });
if (failures > 0) {
  console.log(failures + ' failed');
  process.exit(1);
}
console.log('all ' + tests.length + ' passed');
