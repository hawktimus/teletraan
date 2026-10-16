// Tests for computer/scripts/display.sh, which kiosk.sh calls to find the connected screen and make the framebuffer
// 1920 by 1080. xrandr is a fake in a temporary folder that prints a saved answer, so nothing touches a real screen.
// The wait is made short through the two settings the script reads from the environment.
//
//   node tests/display.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const displayFile = path.join(repo, 'computer/scripts/display.sh');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-display-'));
const ordinaryTools = ['sed', 'head', 'awk', 'sleep', 'cat'];

// --query prints answer.txt, except for the first "empty" calls, which print a screen with nothing connected.
// A call that sets something (--output) is only written to the log.
const fakeXrandr = `#!/bin/sh
echo "xrandr $*" >> "$STUB_LOG"
case "$1" in --output) exit 0 ;; esac
count=$(cat "$STUB_DIR/count" 2> /dev/null || echo 0)
count=$((count + 1))
echo "$count" > "$STUB_DIR/count"
empty=$(cat "$STUB_DIR/empty" 2> /dev/null || echo 0)
if [ "$count" -le "$empty" ]; then
  printf 'Screen 0: minimum 320 x 200, current 1024 x 768, maximum 16384 x 16384\\nHDMI-1 disconnected (normal left inverted right x axis y axis)\\nDP-1 disconnected (normal left inverted right x axis y axis)\\n'
  exit 0
fi
cat "$STUB_DIR/answer.txt"
`;

const head = 'Screen 0: minimum 320 x 200, current 1920 x 1080, maximum 16384 x 16384\n';

const answers = {
  hdmi1: head + `HDMI-1 connected primary 1920x1080+0+0 (normal left inverted right x axis y axis) 1600mm x 900mm
   3840x2160     30.00 +  29.97
   1920x1080     60.00*+  59.94    50.00
   1280x720      60.00    59.94
DP-1 disconnected (normal left inverted right x axis y axis)
`,
  hdmi2Only4k: head + `HDMI-1 disconnected (normal left inverted right x axis y axis)
HDMI-2 connected 3840x2160+0+0 (normal left inverted right x axis y axis) 1600mm x 900mm
   3840x2160     30.00*+  29.97
   1024x768      60.00
`,
  dp1: head + `HDMI-1 disconnected (normal left inverted right x axis y axis)
DP-1 connected 1920x1080+0+0 (normal left inverted right x axis y axis) 520mm x 290mm
   1920x1080     50.00 +  59.94*
   1280x720      30.00
`,
  qhd: head + `HDMI-1 connected 2560x1440+0+0 (normal left inverted right x axis y axis) 600mm x 340mm
   2560x1440     59.95*+
   1024x768      60.00
`,
};

let counter = 0;

// Runs set_display with the fake and returns what it printed and what xrandr was asked
function run(answer, options) {
  const settings = options || {};
  counter += 1;
  const root = path.join(work, 'run' + counter);
  const bin = path.join(root, 'bin');
  const stub = path.join(root, 'stub');
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(stub);
  ordinaryTools.forEach(tool => {
    const file = spawnSync('/bin/sh', ['-c', 'command -v ' + tool], { encoding: 'utf8' }).stdout.trim();
    assert.ok(file.startsWith('/'), 'this computer has no ' + tool);
    fs.symlinkSync(file, path.join(bin, tool));
  });
  fs.writeFileSync(path.join(bin, 'xrandr'), fakeXrandr, { mode: 0o755 });
  fs.writeFileSync(path.join(stub, 'answer.txt'), answer);
  fs.writeFileSync(path.join(stub, 'empty'), String(settings.empty || 0));
  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');

  const started = Date.now();
  const result = spawnSync('/bin/sh', ['-c', '. "$DISPLAY_FILE"; set_display; echo "after:$1"', 'sh', 'the-address'], {
    env: {
      PATH: bin,
      STUB_LOG: log,
      STUB_DIR: stub,
      DISPLAY_FILE: displayFile,
      DISPLAY_POLL_INTERVAL: '0.01',
      DISPLAY_POLL_LIMIT: '0.1',
    },
    encoding: 'utf8',
  });
  const calls = fs.readFileSync(log, 'utf8').split('\n').filter(line => line !== '');
  return {
    status: result.status,
    out: result.stdout.split('\n').filter(line => line !== ''),
    err: result.stderr,
    calls: calls,
    sets: calls.filter(line => line.startsWith('xrandr --output')),
    seconds: (Date.now() - started) / 1000,
  };
}

const tests = [];
function test(name, body) {
  tests.push({ name: name, body: body });
}

test('HDMI-1 that lists 1920x1080 is set to it at 60 Hz with no scaling', () => {
  const result = run(answers.hdmi1);
  assert.equal(result.status, 0, result.err);
  assert.deepEqual(result.sets, ['xrandr --output HDMI-1 --mode 1920x1080 --rate 60.00 --scale 1x1']);
  assert.deepEqual(result.out, ['display: output HDMI-1, mode 1920x1080, scale 1x1', 'after:the-address']);
});

test('HDMI-2 that lists only 3840x2160 is set to its mode at half scale on both axes', () => {
  const result = run(answers.hdmi2Only4k);
  assert.equal(result.status, 0, result.err);
  assert.deepEqual(result.sets, ['xrandr --output HDMI-2 --mode 3840x2160 --rate 30.00 --scale 0.5x0.5']);
  assert.deepEqual(result.out, ['display: output HDMI-2, mode 3840x2160, scale 0.5x0.5', 'after:the-address']);
});

test('the scale is computed from the mode, not fixed', () => {
  const result = run(answers.qhd);
  assert.deepEqual(result.sets, ['xrandr --output HDMI-1 --mode 2560x1440 --rate 59.95 --scale 0.75x0.75']);
});

test('an output on DP-1 is found, and 1920x1080 is taken at its listed rate when 60 Hz is not offered', () => {
  const result = run(answers.dp1);
  assert.deepEqual(result.sets, ['xrandr --output DP-1 --mode 1920x1080 --rate 50.00 --scale 1x1']);
  assert.ok(result.out[0].startsWith('display: output DP-1, mode 1920x1080'));
});

test('nothing connected for the first two looks: it waits and then sets the output', () => {
  const result = run(answers.hdmi2Only4k, { empty: 2 });
  assert.equal(result.status, 0, result.err);
  assert.equal(result.sets.length, 1);
  assert.ok(result.sets[0].startsWith('xrandr --output HDMI-2 --mode 3840x2160'));
  assert.ok(result.seconds < 2, 'it did not wait the real 2 seconds');
});

test('nothing ever connected: it gives up after the limit, says so and returns, so the browser starts anyway', () => {
  const result = run(answers.hdmi1, { empty: 1000 });
  assert.equal(result.status, 0, result.err);
  assert.deepEqual(result.sets, []);
  assert.ok(/^display: no connected output after /.test(result.out[0]), result.out[0]);
  assert.equal(result.out[1], 'after:the-address');
  const looks = result.calls.filter(line => line === 'xrandr --query').length;
  assert.ok(looks > 1 && looks <= 12, 'it looked ' + looks + ' times');
});

test('the script never adds a mode and does not replace the address kiosk.sh was given', () => {
  const text = fs.readFileSync(displayFile, 'utf8');
  assert.ok(!/--newmode|--addmode/.test(text));
  assert.ok(!/^\s*set --/m.test(text));
  assert.ok(/DISPLAY_POLL_INTERVAL:-2/.test(text) && /DISPLAY_POLL_LIMIT:-20/.test(text), 'the defaults are 2 and 20');
  const syntax = spawnSync('/bin/sh', ['-n', displayFile], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
});

test('kiosk.sh calls it before the browser starts, and the window follows the 1920 by 1080 framebuffer', () => {
  const text = fs.readFileSync(path.join(repo, 'computer/scripts/kiosk.sh'), 'utf8');
  assert.ok(text.includes('. "$computer/scripts/display.sh"'));
  assert.ok(text.indexOf('set_display') < text.indexOf('exec chromium'));
  assert.ok(text.includes('--window-size=1920,1080'));
  assert.ok(!/xrandr/.test(text), 'the detection lives in display.sh');
});

let failures = 0;
for (const { name, body } of tests) {
  try {
    body();
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
