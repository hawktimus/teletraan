// Tests for the effect scheduler in dashboard/frame.js: when the team name
// effect and the screen glitch may start. A fake page and a clock the test
// moves stand in for the browser, so a test of 10 minutes takes no time.
//
//   node tools/test-effects.mjs
//
// The motion itself (frame.css) is not tested here, only when it starts and
// stops, and the numbers frame.js hands to the stylesheet.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-effects-'));
fs.mkdirSync(path.join(workFolder, 'dashboard'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'frame.js'].forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(workFolder, 'dashboard', file));
});
const frameUrl = pathToFileURL(path.join(workFolder, 'dashboard/frame.js')).href;

const realSetImmediate = globalThis.setImmediate;
const second = 1000;
const tests = [];
let instance = 0;

function test(name, run) {
  tests.push({ name: name, run: run });
}

function makeClassList(onChange) {
  const names = new Set();
  return {
    add: name => { if (!names.has(name)) { names.add(name); onChange(name, true); } },
    remove: name => { if (names.delete(name)) onChange(name, false); },
    contains: name => names.has(name),
  };
}

function makeStyle() {
  const values = {};
  return { values: values, setProperty: (name, value) => { values[name] = value; } };
}

// A fresh frame.js with a fake page, a fake clock and a log of every start and
// end of an effect. log entries are { effect, event, at } with at in ms.
async function inPage(run) {
  const world = { now: 0, timers: [], nextTimer: 1, log: [], areas: [], pageStyle: makeStyle() };

  function record(effect) {
    return (name, added) => {
      if (name === 'playing' || name === 'splitting') world.log.push({ effect: effect, event: added ? 'start' : 'end', at: world.now });
    };
  }

  world.crt = { classList: makeClassList(record('glitch')) };
  world.worldElement = { classList: makeClassList(() => {}) };

  // The name element ends its animations after the length frame.css would
  // give them: 1.43 s times --name-scale, and 15 letters.
  world.name = {
    classList: makeClassList(record('name')),
    style: makeStyle(),
    querySelectorAll: () => new Array(15),
    getAnimations() {
      const scale = Number(this.style.values['--name-scale'] || 1);
      const finished = new Promise(resolve => setTimeout(resolve, 1430 * scale));
      return [{ effect: { getComputedTiming: () => ({ endTime: 1 }) }, finished: finished }];
    },
  };

  world.logo = { dataset: { show: '1', act: 'rest' }, isConnected: true, getAnimations: () => [], getBoundingClientRect: () => ({}) };

  globalThis.document = {
    documentElement: { dataset: {}, style: world.pageStyle },
    getElementById: id => ({ crt: world.crt, world: world.worldElement })[id] || null,
    querySelector: selector => ({ '[data-name-effect]': world.name, '.logo[data-show]': world.logo })[selector] || null,
    querySelectorAll: selector => (selector === '.area' ? world.areas : selector === '.logo[data-show]' && world.logo ? [world.logo] : []),
  };

  const real = { setTimeout: globalThis.setTimeout, setInterval: globalThis.setInterval, performance: globalThis.performance };
  globalThis.setTimeout = (fn, ms) => {
    world.timers.push({ at: world.now + (ms || 0), id: world.nextTimer++, fn: fn, every: 0 });
  };
  globalThis.setInterval = (fn, ms) => {
    world.timers.push({ at: world.now + ms, id: world.nextTimer++, fn: fn, every: ms });
  };
  Object.defineProperty(globalThis, 'performance', { value: { now: () => world.now }, configurable: true, writable: true });

  try {
    instance += 1;
    world.frame = await import(frameUrl + '?test=' + instance);
    world.timersAtImport = world.timers.length;
    world.frame.start({ motion: 'full', speed: 'normal' }); // starts the clock and the look every 250 ms
    world.advance = ms => advance(world, ms);
    world.starts = effect => world.log.filter(item => item.effect === effect && item.event === 'start').map(item => item.at);
    world.ends = effect => world.log.filter(item => item.effect === effect && item.event === 'end').map(item => item.at);
    world.addArea = state => {
      const area = { dataset: { state: state }, getAnimations: () => [] };
      world.areas.push(area);
      return area;
    };
    await run(world);
    assertNeverTogether(world);
  } finally {
    globalThis.setTimeout = real.setTimeout;
    globalThis.setInterval = real.setInterval;
    Object.defineProperty(globalThis, 'performance', { value: real.performance, configurable: true, writable: true });
    delete globalThis.document;
  }
}

function flush() {
  return new Promise(resolve => realSetImmediate(resolve));
}

// Runs the fake timers in order for ms of fake time, letting promises settle
// after each one
async function advance(world, ms) {
  const target = world.now + ms;
  for (;;) {
    await flush();
    const due = world.timers.filter(timer => timer.at <= target).sort((a, b) => a.at - b.at || a.id - b.id)[0];
    if (!due) break;

    world.now = due.at;
    if (due.every) due.at += due.every;
    else world.timers.splice(world.timers.indexOf(due), 1);
    due.fn();
  }
  world.now = target;
  await flush();
}

// The two effects never overlap, in any test
function assertNeverTogether(world) {
  let playing = null;
  world.log.forEach(item => {
    if (item.event === 'start') {
      assert.equal(playing, null, item.effect + ' started at ' + item.at + ' while ' + playing + ' was playing');
      playing = item.effect;
    } else {
      playing = null;
    }
  });
}

// Tests

test('importing frame.js starts no timer, and start() starts the look at the effects every 250 ms', async () => {
  await inPage(async world => {
    assert.equal(world.timersAtImport, 0);
    assert.equal(world.timers.filter(timer => timer.every === 250).length, 1);

    world.frame.start({ motion: 'full', speed: 'normal' }); // a second start() does not add a second look
    assert.equal(world.timers.filter(timer => timer.every === 250).length, 1);
  });
});

test('the name effect first plays in the first moment of rest, then every nameEvery seconds counted from its last start', async () => {
  await inPage(async world => {
    world.frame.setNameEffect(true, 300, 1.43);
    world.frame.setCrt(false, 240, 2.7);

    await world.advance(700 * second);
    assert.deepEqual(world.starts('name'), [250, 300250, 600250]);
    assert.deepEqual(world.ends('name'), [250 + 1430, 300250 + 1430, 600250 + 1430]);
    assert.equal(world.name.style.values['--name-scale'], '1');
  });
});

test('the glitch first plays after its seconds, then every so many seconds from its last start', async () => {
  await inPage(async world => {
    world.frame.setNameEffect(false, 300, 1.43);
    world.frame.setCrt(true, 60, 2.7);

    await world.advance(59750);
    assert.deepEqual(world.starts('glitch'), []);
    await world.advance(130 * second - 59750);
    assert.deepEqual(world.starts('glitch'), [60000, 120000]);
    assert.deepEqual(world.ends('glitch'), [62700, 122700]);
    assert.equal(world.pageStyle.values['--crt-scale'], '1');
  });
});

test('0 seconds means never, and a switch that is off means never', async () => {
  await inPage(async world => {
    world.frame.setNameEffect(true, 0, 1.43);
    world.frame.setCrt(true, 0, 2.7);
    await world.advance(2000 * second);
    assert.deepEqual(world.log, []);

    world.frame.setNameEffect(false, 300, 1.43);
    world.frame.setCrt(false, 60, 2.7);
    await world.advance(2000 * second);
    assert.deepEqual(world.log, []);
  });
});

test('nothing starts while an area is leaving, arriving or going out, and it starts at the next look once the change is over', async () => {
  for (const state of ['in', 'xo', 'xi', 'out']) {
    await inPage(async world => {
      world.addArea('shown');
      const changing = world.addArea(state);
      world.frame.setNameEffect(false, 300, 1.43);
      world.frame.setCrt(true, 30, 2.7);

      await world.advance(100 * second);
      assert.deepEqual(world.log, [], 'the glitch has been due since 30 seconds, but an area is in ' + state);

      changing.dataset.state = 'shown';
      await world.advance(second);
      assert.deepEqual(world.starts('glitch'), [100250], 'one look (250 ms) after the change ended');
    });
  }
});

test('an effect that waited gives one late play, never a burst, and its next play is counted from when it started', async () => {
  await inPage(async world => {
    const area = world.addArea('xo');
    world.frame.setNameEffect(false, 300, 1.43);
    world.frame.setCrt(true, 30, 2.7);

    await world.advance(500 * second); // sixteen glitches were due
    area.dataset.state = 'shown';
    await world.advance(100 * second);
    assert.deepEqual(world.starts('glitch'), [500250, 530250, 560250, 590250]);
  });
});

test('only one effect plays at a time: the one that comes due second waits for the first to end', async () => {
  await inPage(async world => {
    const area = world.addArea('xo');
    world.frame.setNameEffect(true, 30, 10);
    world.frame.setCrt(true, 30, 2.7);

    await world.advance(100 * second); // both due, both waiting. The name came due first
    area.dataset.state = 'shown';
    await world.advance(60 * second);

    const nameStart = world.starts('name')[0];
    const nameEnd = world.ends('name')[0];
    const glitchStart = world.starts('glitch')[0];
    assert.equal(nameStart, 100250);
    assert.ok(Math.abs(nameEnd - nameStart - 10000) < 5, 'ten seconds, from the setting of 10');
    assert.ok(glitchStart >= nameEnd && glitchStart - nameEnd <= 250, 'the glitch starts at the look after the name effect ended');
  });
});

test('an effect that comes due while the other plays waits for it to end', async () => {
  await inPage(async world => {
    world.frame.setNameEffect(true, 30, 10); // plays 0.25 to 10.25 seconds, and again at 30.25
    world.frame.setCrt(true, 30, 2.7); // due at 30 seconds, when nothing plays: the name is due at 30.25

    await world.advance(70 * second);
    assert.deepEqual(world.starts('glitch').slice(0, 1), [30000]);
    assert.deepEqual(world.starts('name').slice(0, 2), [250, 32750], 'the second name effect waited for the glitch, which ended at 32700');
  });
});

test('the name effect starts only while the logo rests', async () => {
  await inPage(async world => {
    world.frame.setNameEffect(true, 300, 1.43);
    world.frame.setCrt(false, 240, 2.7);

    for (const act of ['turn', 'robot', 'hawk-in', 'flight', 'hawk-out', 'boot']) {
      world.logo.dataset.act = act;
      await world.advance(5 * second);
      assert.deepEqual(world.log, [], 'the logo is in the act ' + act);
    }

    world.logo.dataset.act = 'name'; // the quiet moment of the show counts as rest
    const before = world.now;
    await world.advance(second);
    assert.equal(world.starts('name').length, 1);
    assert.ok(world.starts('name')[0] > before && world.starts('name')[0] <= before + 250, 'it started at the next look');

    // no show running (tools/logo.html before Show is pressed): the logo counts as at rest
    await world.advance(5 * second);
    world.logo.dataset.act = 'robot';
    world.logo.dataset.show = '';
    world.frame.playNameEffect();
    await world.advance(250);
    assert.equal(world.starts('name').length, 2);
  });
});

test('calm and none motion play neither, and one play after the switch back to full, not a burst', async () => {
  await inPage(async world => {
    world.frame.setNameEffect(true, 300, 1.43);
    world.frame.setCrt(true, 60, 2.7);

    world.frame.setMotion('calm');
    await world.advance(600 * second);
    assert.deepEqual(world.log, []);
    world.frame.playCrt();
    world.frame.playNameEffect();
    await world.advance(second);
    assert.deepEqual(world.log, [], 'asking by hand does nothing in calm either');

    world.frame.setMotion('none');
    await world.advance(600 * second);
    assert.deepEqual(world.log, []);

    world.frame.setMotion('full');
    await world.advance(10 * second);
    assert.equal(world.starts('name').length, 1);
    assert.equal(world.starts('glitch').length, 1);
  });
});

test('a play asked for by hand waits in the same line, plays even when the switch is off, and is not asked twice', async () => {
  await inPage(async world => {
    const area = world.addArea('xi');
    world.frame.setNameEffect(false, 0, 1.43);
    world.frame.setCrt(false, 0, 2.7);

    world.frame.playCrt();
    world.frame.playCrt();
    world.frame.playNameEffect();
    await world.advance(5 * second);
    assert.deepEqual(world.log, [], 'a page is arriving');

    area.dataset.state = 'shown';
    await world.advance(10 * second);
    assert.equal(world.starts('name').length, 1);
    assert.equal(world.starts('glitch').length, 1);
    assert.ok(world.starts('name')[0] >= world.ends('glitch')[0], 'one after the other, the one asked for first going first');

    await world.advance(600 * second);
    assert.equal(world.starts('name').length, 1, 'the switch is off, so nothing came due by itself');
    assert.equal(world.starts('glitch').length, 1);
  });
});

test('a switch turned off while an effect waits cancels that play', async () => {
  await inPage(async world => {
    const area = world.addArea('xo');
    world.frame.setNameEffect(false, 300, 1.43);
    world.frame.setCrt(true, 30, 2.7);

    await world.advance(60 * second); // due and waiting
    world.frame.setCrt(false, 30, 2.7);
    area.dataset.state = 'shown';
    await world.advance(60 * second);
    assert.deepEqual(world.log, []);
  });
});

test('a shorter time between plays takes effect at once, counted from the last start', async () => {
  await inPage(async world => {
    world.frame.setNameEffect(false, 300, 1.43);
    world.frame.setCrt(true, 240, 2.7);

    await world.advance(100 * second);
    assert.deepEqual(world.starts('glitch'), []);
    world.frame.setCrt(true, 60, 2.7); // the last start was at 0, so it is already due
    await world.advance(250);
    assert.deepEqual(world.starts('glitch'), [100250]);
  });
});

test('the glitch lasts its seconds at normal speed, stretched by the Speed setting, and all its times scale together', async () => {
  await inPage(async world => {
    world.frame.setNameEffect(false, 0, 1.43);
    world.frame.setCrt(false, 0, 5.4);

    world.frame.playCrt();
    await world.advance(5399);
    assert.equal(world.crt.classList.contains('playing'), true);
    assert.equal(world.worldElement.classList.contains('crt-on'), true);
    assert.equal(world.pageStyle.values['--crt-scale'], '2', '5.4 seconds is twice the normal 2.7');
    await world.advance(2);
    assert.equal(world.crt.classList.contains('playing'), false);
    assert.equal(world.worldElement.classList.contains('crt-on'), false);

    world.frame.setSpeed('slow'); // 1.5 times as long
    world.frame.setCrt(false, 0, 2.7);
    const before = world.now;
    world.frame.playCrt();
    await world.advance(4049);
    assert.equal(world.crt.classList.contains('playing'), true);
    await world.advance(2);
    assert.equal(world.crt.classList.contains('playing'), false);
    assert.equal(world.pageStyle.values['--crt-scale'], '1');
    assert.ok(Math.abs(world.ends('glitch')[1] - before - 4050) < 1, 'about 4.05 seconds');
  });
});

test('the name effect lasts its seconds on a name as long as the default, with every letter time and gap scaled together', async () => {
  await inPage(async world => {
    world.frame.setNameEffect(false, 0, 2);
    world.frame.playNameEffect();
    await world.advance(3 * second);

    const scale = world.name.style.values['--name-scale'];
    assert.equal(scale, '1.399', '2 seconds divided by the 1.43 seconds of today');
    assert.ok(Math.abs(world.ends('name')[0] - world.starts('name')[0] - 2000) < 5, 'it ended after about 2 seconds');
  });

  await inPage(async world => {
    world.frame.setNameEffect(false, 0, 10);
    world.frame.playNameEffect();
    await world.advance(8 * second);
    assert.equal(world.name.classList.contains('splitting'), true, 'ten seconds is not cut off at the usual 5');
    await world.advance(3 * second);
    assert.equal(world.name.classList.contains('splitting'), false);
  });
});

test('the logo waits for the name effect to end before it moves again, and the name effect never starts in the middle of a move', async () => {
  await inPage(async world => {
    // Hold the name effect back until 9 seconds, so it is still playing when the
    // logo show wants to start the robot act at 13 seconds
    const area = world.addArea('xo');
    world.frame.setNameEffect(true, 300, 10);
    world.frame.setCrt(false, 240, 2.7);
    world.frame.startLogo(world.logo);

    await world.advance(9 * second);
    area.dataset.state = 'shown';
    await world.advance(5 * second); // 14 seconds
    assert.deepEqual(world.starts('name'), [9250]);
    assert.equal(world.name.classList.contains('splitting'), true);
    assert.notEqual(world.logo.dataset.act, 'robot', 'the robot act is due at 13 seconds but the name effect is still playing');

    await world.advance(6 * second); // 20 seconds, the name effect ended at about 19
    assert.equal(world.name.classList.contains('splitting'), false);
    assert.equal(world.logo.dataset.act, 'robot');
    world.frame.stopLogo(world.logo);
  });
});

// The stylesheets

const frameCss = fs.readFileSync(path.join(dashboardFolder, 'frame.css'), 'utf8');
const tokensCss = fs.readFileSync(path.join(dashboardFolder, 'tokens.css'), 'utf8');

// The names of the properties a @keyframes rule changes
function keyframeProperties(name) {
  const start = frameCss.indexOf('@keyframes ' + name + ' {');
  assert.ok(start !== -1, 'frame.css has no keyframes called ' + name);

  let depth = 0;
  let end = start;
  for (let i = frameCss.indexOf('{', start); i < frameCss.length; i++) {
    if (frameCss[i] === '{') depth++;
    if (frameCss[i] === '}') depth--;
    if (depth === 0) { end = i; break; }
  }

  const body = frameCss.slice(frameCss.indexOf('{', start) + 1, end);
  const names = new Set();
  body.replace(/([a-z-]+)\s*:/g, (match, property) => names.add(property));
  return Array.from(names).sort();
}

test('the glitch and the name effect animate only transform and opacity', () => {
  ['crt-flicker', 'crt-roll', 'crt-jump', 'name-whole', 'name-top', 'name-middle', 'name-bottom'].forEach(name => {
    const properties = keyframeProperties(name).filter(property => property !== 'animation-timing-function');
    assert.ok(properties.length > 0, name);
    properties.forEach(property => assert.ok(['transform', 'opacity'].includes(property), name + ' changes ' + property));
  });
});

test('every time in the glitch comes from --crt-scale, and every letter time and gap in the name effect from --name-scale', () => {
  const crtStart = frameCss.indexOf('#crt.playing {');
  const crtRules = frameCss.slice(crtStart, frameCss.indexOf('@keyframes crt-flicker'));
  const crtTimes = crtRules.match(/animation: [^;]+;/g);
  assert.equal(crtTimes.length, 3);
  crtTimes.forEach(line => assert.ok(/var\(--time-crt(-roll)?\)/.test(line) && !/\d(ms|s)\b/.test(line.replace(/crt-\w+/, '')), line));

  assert.ok(/--time-crt: calc\(2\.6s \* var\(--crt-scale\) \* var\(--pace\)\)/.test(tokensCss));
  assert.ok(/--time-crt-roll: calc\(1\.2s \* var\(--crt-scale\) \* var\(--pace\)\)/.test(tokensCss));
  assert.ok(/--crt-scale: 1;/.test(tokensCss), 'the scale is 1 until frame.js sets it');

  const nameRules = frameCss.match(/animation: name-[^;]+;/g);
  assert.equal(nameRules.length, 4);
  nameRules.forEach(line => assert.ok(line.includes('var(--letter-time)') && line.includes('var(--letter-gap)'), line));
  assert.ok(frameCss.includes('--letter-time: calc(.8s * var(--name-scale, 1) * var(--pace));'));
  assert.ok(frameCss.includes('--letter-gap: calc(45ms * var(--name-scale, 1) * var(--pace));'));
});

// Run them

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
  fs.rmSync(workFolder, { recursive: true, force: true });
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
