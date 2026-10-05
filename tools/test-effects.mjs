// Tests for the effect scheduler in dashboard/frame.js: when the logo's
// entrance, spin and flying hawk, the team name effect and the screen glitch
// may start. A fake page and a clock the test moves stand in for the browser,
// so a test of 10 minutes takes no time. It also tests how a page change is
// chosen (dashboard/core/transitions.js): the style and the metal of the
// frame, and the waits frame.js makes for each style. And it tests when a demo
// from the Demo page runs (dashboard/core/demo.js): whether a request is recent
// and new, the order and the pauses of the steps, and what stops a demo. And it
// tests when a hidden transition plays (dashboard/core/hidden.js): the chance, the
// master switch, calm motion, what blocks it and a push from the Studio, the
// registry of the transitions, and the parts of frame.css that move them. And it tests
// Play announcements (dashboard/core/announce.js): the guard, the age limit, which
// announcements play, what it waits for, and the Demo step that plays them too.
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
fs.mkdirSync(path.join(workFolder, 'dashboard', 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'frame.js', 'core/transitions.js', 'core/tick.js', 'core/demo.js', 'core/demo-screens.js', 'core/hidden.js', 'core/hidden-transitions.js', 'core/hidden-pictures.js', 'core/images.js', 'core/announce.js'].forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(workFolder, 'dashboard', file));
});
const frameUrl = pathToFileURL(path.join(workFolder, 'dashboard/frame.js')).href;
const config = await import(pathToFileURL(path.join(workFolder, 'dashboard/config.js')).href);
const { chooseStyle, chooseFinish } = await import(pathToFileURL(path.join(workFolder, 'dashboard/core/transitions.js')).href);
const demo = await import(pathToFileURL(path.join(workFolder, 'dashboard/core/demo.js')).href);
const demoRegistry = await import(pathToFileURL(path.join(workFolder, 'dashboard/core/demo-screens.js')).href);
const hidden = await import(pathToFileURL(path.join(workFolder, 'dashboard/core/hidden.js')).href);
const hiddenRegistry = await import(pathToFileURL(path.join(workFolder, 'dashboard/core/hidden-transitions.js')).href);
const hiddenPictures = await import(pathToFileURL(path.join(workFolder, 'dashboard/core/hidden-pictures.js')).href);
const imagesModule = await import(pathToFileURL(path.join(workFolder, 'dashboard/core/images.js')).href);
const announce = await import(pathToFileURL(path.join(workFolder, 'dashboard/core/announce.js')).href);

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

  // The logo: every change of act is written down in world.acts, and the start
  // and end of the entrance (boot), the spin (turn) and the hawk (robot to
  // hawk-out) go in the log like the other effects
  const hawkActs = ['robot', 'hawk-in', 'flight', 'hawk-out'];
  const startsOf = { boot: 'entrance', turn: 'spin', robot: 'hawk' };
  let act = 'rest';
  world.acts = [];
  world.logoStyle = makeStyle();
  world.logoStyle.removeProperty = name => { delete world.logoStyle.values[name]; };
  world.logo = {
    dataset: {
      get act() { return act; },
      set act(value) {
        const before = act;
        act = value;
        world.acts.push({ act: value, at: world.now });

        if (startsOf[value]) world.log.push({ effect: startsOf[value], event: 'start', at: world.now });
        const ended = before === 'boot' ? 'entrance' : before === 'turn' ? 'spin' : hawkActs.includes(before) ? 'hawk' : null;
        if (ended && value === 'rest') world.log.push({ effect: ended, event: 'end', at: world.now });
      },
    },
    style: world.logoStyle,
    isConnected: true,
    getAnimations: () => [],
    getBoundingClientRect: () => ({}),
  };

  globalThis.document = {
    documentElement: { dataset: {}, style: world.pageStyle },
    getElementById: id => ({ crt: world.crt, world: world.worldElement })[id] || null,
    querySelector: selector => ({ '[data-name-effect]': world.name })[selector] || null,
    querySelectorAll: selector => (selector === '.area' ? world.areas : []),
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

// No two effects overlap, in any test
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

test('the name effect first plays 2 seconds in (the first rest of the old show), then every nameEvery seconds counted from its last start', async () => {
  await inPage(async world => {
    world.frame.setNameEffect(true, 300, 1.43);
    world.frame.setCrt(false, 240, 2.7);

    await world.advance(700 * second);
    assert.deepEqual(world.starts('name'), [2000, 302000, 602000]);
    assert.deepEqual(world.ends('name'), [2000 + 1430, 302000 + 1430, 602000 + 1430]);
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
    world.frame.setSpin(true, 0, 1.6);
    world.frame.setHawk(true, 0, 11);
    world.frame.setLogoAnimations(true, false);
    world.frame.startLogo(world.logo);
    await world.advance(2000 * second);
    assert.deepEqual(world.log, []);

    world.frame.setNameEffect(false, 300, 1.43);
    world.frame.setCrt(false, 60, 2.7);
    world.frame.setSpin(false, 60, 1.6);
    world.frame.setHawk(false, 60, 11);
    await world.advance(2000 * second);
    assert.deepEqual(world.log, []);
    assert.deepEqual(world.acts.filter(item => item.act !== 'rest'), []);
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
    world.frame.setNameEffect(true, 30, 10); // plays 2 to 12 seconds, and again when 30 seconds after its start is 32
    world.frame.setCrt(true, 30, 2.7); // due at 30 seconds, when nothing plays: the name is due at 32

    await world.advance(70 * second);
    assert.deepEqual(world.starts('glitch').slice(0, 1), [30000]);
    assert.deepEqual(world.starts('name').slice(0, 2), [2000, 32750], 'the second name effect waited for the glitch, which ended at 32700');
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

test('while the night screen covers the picture no effect starts or waits, and when it lets go each due effect plays once', async () => {
  await inPage(async world => {
    world.frame.setNameEffect(true, 300, 1.43);
    world.frame.setCrt(true, 60, 2.7);

    world.frame.setNightCovers(true);
    world.frame.setNightCovers(true); // the night screen says so every second, and a repeat changes nothing
    await world.advance(600 * second);
    assert.deepEqual(world.log, []);

    world.frame.playCrt(); // an alert or announcement is not covering, so only a play asked for by hand during the cover is dropped
    await world.advance(second);
    assert.deepEqual(world.log, []);

    world.frame.setNightCovers(false);
    await world.advance(10 * second);
    assert.equal(world.starts('name').length, 1);
    assert.equal(world.starts('glitch').length, 1);
  });
});

test('while a demo pauses the effects none comes due on its own or waits, one asked for by hand still plays, and when they resume the one that was due plays once', async () => {
  await inPage(async world => {
    world.frame.setNameEffect(true, 300, 1.43);
    world.frame.setCrt(true, 60, 2.7);

    world.frame.setEffectsPaused(true);
    world.frame.setEffectsPaused(true); // asked again, and nothing changes
    await world.advance(600 * second);
    assert.deepEqual(world.log, []);

    world.frame.playCrt(); // the announcement a demo plays asks for the glitch between its lines
    await world.advance(5 * second);
    assert.equal(world.starts('glitch').length, 1);

    world.frame.setEffectsPaused(false);
    await world.advance(10 * second);
    assert.equal(world.starts('name').length, 1);
    assert.equal(world.starts('glitch').length, 1, 'the glitch was played by hand a moment ago, so it is not due again');
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

// The logo's own effects

// [act, second it starts] for each act the logo went through, from world.acts
function actsAt(world) {
  return world.acts.map(item => [item.act, item.at / second]);
}

// Every logo play of one kind: the ones in the log
function logoPlays(world, effect) {
  return world.starts(effect).map((start, index) => [start, world.ends(effect)[index]]);
}

// The name effect, the glitch and the entrance are off, so only the spin and the hawk are left
function onlyTheLogoMoves(world) {
  world.frame.setNameEffect(false, 0, 1.43);
  world.frame.setCrt(false, 0, 2.7);
  world.frame.setLogoAnimations(true, false);
}

test('the hawk plays the acts of the old show at the old seconds, 11 seconds in all, and the spin comes every 72 seconds', async () => {
  await inPage(async world => {
    onlyTheLogoMoves(world);
    world.frame.startLogo(world.logo);

    await world.advance(25 * second);
    assert.deepEqual(actsAt(world), [['rest', 0], ['robot', 13], ['hawk-in', 16], ['flight', 18], ['hawk-out', 22], ['rest', 24]]);
  });
});

test('the hawk first plays at 13 seconds, then 24 seconds after its last start, and the spin at 50 and then every 72, with no overlap', async () => {
  await inPage(async world => {
    onlyTheLogoMoves(world);
    world.frame.startLogo(world.logo);

    await world.advance(300 * second);
    const hawkStarts = [];
    for (let at = 13; at < 300; at += 24) hawkStarts.push(at * second);
    assert.deepEqual(world.starts('hawk'), hawkStarts);
    assert.deepEqual(world.ends('hawk'), hawkStarts.map(at => at + 11 * second));
    assert.deepEqual(world.starts('spin'), [50000, 122000, 194000, 266000]);
    assert.deepEqual(world.ends('spin'), [51600, 123600, 195600, 267600]);
  });
});

test('the spin and the hawk first play where the old show did, or sooner when their seconds between plays are fewer', async () => {
  await inPage(async world => {
    onlyTheLogoMoves(world);
    world.frame.setSpin(true, 30, 1.6);
    world.frame.setHawk(true, 10, 6);
    world.frame.startLogo(world.logo);

    await world.advance(31 * second);
    assert.deepEqual(world.starts('hawk').slice(0, 2), [10000, 20000]);
    assert.deepEqual(world.starts('spin'), [30000]);
  });
});

test('the hawk lasts the seconds in the setting and every act is stretched with it, and the scale is gone when it ends', async () => {
  await inPage(async world => {
    onlyTheLogoMoves(world);
    world.frame.setHawk(true, 60, 22); // twice as long as the 11 seconds of today
    world.frame.startLogo(world.logo);

    await world.advance(14 * second);
    assert.equal(world.logoStyle.values['--hawk-scale'], '2');
    await world.advance(30 * second);
    assert.deepEqual(actsAt(world), [['rest', 0], ['robot', 13], ['hawk-in', 19], ['flight', 23], ['hawk-out', 31], ['rest', 35]]);
    assert.equal(world.logoStyle.values['--hawk-scale'], undefined);
  });

  await inPage(async world => {
    onlyTheLogoMoves(world);
    world.frame.setHawk(true, 60, 6);
    world.frame.startLogo(world.logo);
    await world.advance(20 * second);
    const plays = logoPlays(world, 'hawk');
    assert.equal(plays.length, 1);
    assert.equal(plays[0][0], 13000);
    assert.ok(Math.abs(plays[0][1] - 19000) < 1, '6 seconds, the shortest the Studio allows: ' + plays[0][1]);
  });
});

test('the spin lasts the seconds in the setting, and the Speed setting stretches it like every other time', async () => {
  await inPage(async world => {
    onlyTheLogoMoves(world);
    world.frame.setHawk(false, 24, 11);
    world.frame.setSpin(true, 60, 3.2);
    world.frame.startLogo(world.logo);

    await world.advance(51 * second);
    assert.equal(world.logoStyle.values['--spin-scale'], '2');
    await world.advance(5 * second);
    assert.equal(world.logoStyle.values['--spin-scale'], undefined);
    assert.deepEqual(logoPlays(world, 'spin'), [[50000, 53200]]);
  });

  await inPage(async world => {
    onlyTheLogoMoves(world);
    world.frame.setHawk(false, 24, 11);
    world.frame.setSpeed('slow'); // 1.5 times as long
    world.frame.startLogo(world.logo);
    await world.advance(60 * second);
    assert.deepEqual(logoPlays(world, 'spin'), [[50000, 52400]], '1.6 seconds times 1.5');
  });
});

test('the default lengths in config.js are the lengths of the acts in frame.js', async () => {
  await inPage(async world => {
    const total = world.frame.hawkActs.reduce((sum, act) => sum + act[1], 0);
    assert.equal(total, 11);
    assert.equal(total, config.defaultSettings.logoHawkDuration);
    assert.equal(world.frame.spinNormalSeconds, config.defaultSettings.logoSpinDuration);
    assert.deepEqual(world.frame.hawkActs.map(act => act[0]), ['robot', 'hawk-in', 'flight', 'hawk-out']);

    // the starting values of the logo and name settings: the old behaviour
    const settings = config.defaultSettings;
    assert.equal(settings.logoAnimations, true);
    assert.equal(settings.logoEntrance, true);
    assert.deepEqual([settings.logoSpin, settings.logoSpinEvery, settings.logoSpinDuration], [true, 72, 1.6]);
    assert.deepEqual([settings.logoHawk, settings.logoHawkEvery, settings.logoHawkDuration], [true, 24, 11]);
  });
});

test('the entrance plays once when the logo starts, takes 2 seconds, and plays even while a page is arriving', async () => {
  await inPage(async world => {
    world.addArea('in'); // a page is arriving, as it is when the screen starts
    world.frame.setNameEffect(false, 0, 1.43);
    world.frame.setCrt(false, 0, 2.7);
    world.frame.setHawk(false, 24, 11);
    world.frame.setSpin(false, 72, 1.6);
    world.frame.startLogo(world.logo);

    assert.deepEqual(actsAt(world), [['rest', 0], ['boot', 0]]);
    await world.advance(100 * second);
    assert.deepEqual(logoPlays(world, 'entrance'), [[0, 2000]]);
    assert.equal(world.acts.filter(item => item.act === 'boot').length, 1, 'once only');
  });
});

test('the name effect does not start in the entrance: it is due 2 seconds after the logo starts, when the entrance ends', async () => {
  await inPage(async world => {
    world.frame.setNameEffect(true, 300, 1.43);
    world.frame.setCrt(false, 0, 2.7);
    world.frame.setHawk(false, 24, 11);
    world.frame.setSpin(false, 72, 1.6);
    world.frame.startLogo(world.logo);
    await world.advance(6 * second);

    assert.deepEqual(logoPlays(world, 'entrance'), [[0, 2000]]);
    assert.deepEqual(world.starts('name'), [2250], 'the look at 2 seconds comes just before the entrance ends');
  });
});

test('the entrance waits for an effect that is playing, and does not end it', async () => {
  await inPage(async world => {
    world.frame.setNameEffect(false, 0, 1.43);
    world.frame.setCrt(false, 0, 2.7);
    world.frame.setHawk(false, 24, 11);
    world.frame.setSpin(false, 72, 1.6);
    world.frame.playNameEffect(); // plays from 0 to 1.43 seconds
    await world.advance(500);
    world.frame.startLogo(world.logo);
    await world.advance(5 * second);

    assert.deepEqual(world.ends('name'), [1430]);
    assert.ok(world.starts('entrance')[0] >= 1430 && world.starts('entrance')[0] <= 1700, 'it started at ' + world.starts('entrance')[0]);
  });
});

test('the switch of the entrance and the master switch keep the entrance from playing', async () => {
  await inPage(async world => {
    world.frame.setLogoAnimations(true, false);
    world.frame.startLogo(world.logo);
    await world.advance(10 * second);
    assert.equal(world.acts.filter(item => item.act === 'boot').length, 0, 'the entrance switch is off');
  });

  await inPage(async world => {
    world.frame.setLogoAnimations(false, true);
    world.frame.startLogo(world.logo);
    await world.advance(10 * second);
    assert.equal(world.acts.filter(item => item.act === 'boot').length, 0, 'the master switch is off');
  });

  await inPage(async world => {
    world.frame.setLogoAnimations(true, true);
    world.frame.setMotion('calm');
    world.frame.startLogo(world.logo);
    await world.advance(10 * second);
    assert.equal(world.acts.filter(item => item.act === 'boot').length, 0, 'calm motion keeps the still emblem');
  });
});

test('the master switch off plays nothing in the logo, including the name effect, and on again plays them', async () => {
  await inPage(async world => {
    world.frame.setNameEffect(true, 30, 1.43);
    world.frame.setCrt(false, 0, 2.7);
    world.frame.setSpin(true, 10, 1.6);
    world.frame.setHawk(true, 10, 6);
    world.frame.setLogoAnimations(false, true);
    world.frame.startLogo(world.logo);

    await world.advance(600 * second);
    assert.deepEqual(world.log, []);
    assert.deepEqual(world.acts, [{ act: 'rest', at: 0 }]);

    world.frame.setLogoAnimations(true, true);
    await world.advance(60 * second);
    assert.equal(world.starts('name').length > 0, true);
    assert.equal(world.starts('spin').length > 0, true);
    assert.equal(world.starts('hawk').length > 0, true);
  });
});

test('the master switch does not stop the glitch, which is not a logo animation', async () => {
  await inPage(async world => {
    world.frame.setNameEffect(false, 0, 1.43);
    world.frame.setCrt(true, 60, 2.7);
    world.frame.setLogoAnimations(false, false);
    await world.advance(130 * second);
    assert.deepEqual(world.starts('glitch'), [60000, 120000]);
  });
});

test('the master switch turned off in the middle of the hawk ends it at once, leaves the still emblem and frees the line', async () => {
  await inPage(async world => {
    onlyTheLogoMoves(world);
    world.frame.startLogo(world.logo);

    await world.advance(17 * second); // in hawk-in
    assert.equal(world.logo.dataset.act, 'hawk-in');
    world.frame.setLogoAnimations(false, false);
    assert.equal(world.logo.dataset.act, 'rest');
    assert.equal(world.logoStyle.values['--hawk-scale'], undefined);

    await world.advance(30 * second);
    assert.deepEqual(actsAt(world), [['rest', 0], ['robot', 13], ['hawk-in', 16], ['rest', 17]], 'no act after the switch');
    assert.deepEqual(world.ends('hawk'), [17000]);

    // the line is free, so a play asked for by hand starts now
    world.frame.playCrt();
    assert.deepEqual(world.starts('glitch'), [47000]);
  });
});

test('the master switch turned off while the name effect plays ends it', async () => {
  await inPage(async world => {
    world.frame.setCrt(false, 0, 2.7);
    world.frame.setNameEffect(false, 0, 10);
    world.frame.playNameEffect();
    await world.advance(2 * second);
    assert.equal(world.name.classList.contains('splitting'), true);

    world.frame.setLogoAnimations(false, true);
    assert.equal(world.name.classList.contains('splitting'), false);
    world.frame.playCrt();
    assert.deepEqual(world.starts('glitch'), [2000], 'the glitch did not have to wait for the 10 seconds');
  });
});

test('a play asked for by hand ends a spin or a hawk on the spot and takes over: the announcement glitch never waits for the logo', async () => {
  await inPage(async world => {
    onlyTheLogoMoves(world);
    world.frame.startLogo(world.logo);

    await world.advance(15 * second); // in the robot act of the hawk
    assert.equal(world.logo.dataset.act, 'robot');
    world.frame.playCrt();
    assert.deepEqual(world.ends('hawk'), [15000]);
    assert.deepEqual(world.starts('glitch'), [15000]);
    assert.equal(world.logo.dataset.act, 'rest');

    await world.advance(30 * second);
    assert.deepEqual(actsAt(world).filter(item => item[1] > 15 && item[1] < 37), [], 'the hawk did not carry on after it was ended');
    assert.equal(world.starts('hawk')[1], 37000, 'its next play is 24 seconds after it last started');
  });
});

test('nothing in the logo starts while an area is changing page, and it starts at the next look after, once, never a burst', async () => {
  for (const state of ['in', 'xo', 'xi', 'out']) {
    await inPage(async world => {
      onlyTheLogoMoves(world);
      world.frame.setHawk(true, 30, 11);
      world.frame.setSpin(true, 30, 1.6);
      const changing = world.addArea(state);
      world.frame.startLogo(world.logo);

      await world.advance(100 * second);
      assert.deepEqual(world.log, [], 'an area is in ' + state);

      changing.dataset.state = 'shown';
      await world.advance(60 * second);

      // the hawk came due first (13 seconds in), so it goes first, at the next look. The spin
      // (due at 30) goes after it, one play each, and the next hawk is 30 seconds after the
      // start of this one, not after it came due
      assert.deepEqual(world.starts('hawk'), [100250, 130250], 'in ' + state);
      assert.equal(world.starts('spin').length, 2);
      assert.ok(world.starts('spin')[0] >= 111250 && world.starts('spin')[0] <= 111500, 'the spin waited for the hawk: ' + world.starts('spin')[0]);
    });
  }
});

test('the spin and the hawk, the name effect and the glitch all due together play one after the other, never together', async () => {
  await inPage(async world => {
    world.frame.setNameEffect(true, 30, 1.43);
    world.frame.setCrt(true, 30, 2.7);
    world.frame.setSpin(true, 10, 1.6);
    world.frame.setHawk(true, 10, 6);
    world.frame.setLogoAnimations(true, false);
    world.frame.startLogo(world.logo);

    await world.advance(600 * second); // assertNeverTogether looks at the whole log
    ['name', 'spin', 'hawk', 'glitch'].forEach(effect => {
      assert.ok(world.starts(effect).length >= 3, effect + ' kept getting its turn: ' + world.starts(effect).length);
    });
  });
});

test('calm and none motion end a hawk at once and play nothing in the logo', async () => {
  await inPage(async world => {
    onlyTheLogoMoves(world);
    world.frame.startLogo(world.logo);

    await world.advance(17 * second);
    world.frame.setMotion('calm');
    assert.equal(world.logo.dataset.act, 'rest');
    await world.advance(600 * second);
    assert.equal(world.starts('hawk').length, 1);
    assert.equal(world.acts.filter(item => item.act === 'turn').length, 0);
  });
});

test('the logo of an announcement flies, and is the still emblem when the master switch is off', async () => {
  await inPage(async world => {
    const flyer = { dataset: { act: '' } };
    world.frame.flyLogo(flyer);
    assert.equal(flyer.dataset.act, 'fly');

    world.frame.setLogoAnimations(false, true);
    world.frame.flyLogo(flyer);
    assert.equal(flyer.dataset.act, 'rest');
  });
});

test('stopLogo leaves a still emblem and frees the line, and startLogo takes a logo over again', async () => {
  await inPage(async world => {
    onlyTheLogoMoves(world);
    world.frame.startLogo(world.logo);
    await world.advance(15 * second);
    world.frame.stopLogo(world.logo);
    assert.equal(world.logo.dataset.act, 'rest');

    await world.advance(100 * second);
    assert.equal(world.starts('hawk').length, 1, 'with no logo there is nothing to move');

    world.frame.startLogo(world.logo);
    const again = world.now;
    await world.advance(14 * second);
    assert.deepEqual(world.starts('hawk').slice(1), [again + 13000], 'a new show counts from the start again');
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

test('every time in the spin and the hawk acts comes from --spin-pace or --hawk-pace, and the entrance from --pace', () => {
  assert.ok(frameCss.includes('--spin-pace: calc(var(--spin-scale, 1) * var(--pace));'));
  assert.ok(frameCss.includes('--hawk-pace: calc(var(--hawk-scale, 1) * var(--pace));'));

  const rules = frameCss.split('\n').filter(line => /^\.logo\[data-act="[a-z-]+"\][^{]*\{ animation:/.test(line));
  const kinds = { spin: ['turn'], hawk: ['robot', 'hawk-in', 'flight', 'fly', 'hawk-out'], entrance: ['boot'] };
  const wanted = { spin: '--spin-pace', hawk: '--hawk-pace', entrance: '--pace' };
  const seen = { spin: 0, hawk: 0, entrance: 0 };

  rules.forEach(line => {
    const act = line.match(/data-act="([a-z-]+)"/)[1];
    const kind = Object.keys(kinds).filter(name => kinds[name].includes(act))[0];
    assert.ok(kind, 'a rule for the act ' + act + ' that this test does not know: ' + line);
    seen[kind] += 1;

    // every time is calc(<seconds> * var(--something-pace)), apart from a delay of plain 0s
    const withoutCalc = line.replace(/calc\([^)]*\)\)/g, '');
    assert.ok(!/(^|[ (])[0-9.]*[1-9][0-9.]*m?s\b/.test(withoutCalc), 'a plain time in ' + line);
    const calcs = line.match(/calc\([^)]*\)\)/g) || [];
    assert.ok(calcs.length > 0, line);
    calcs.forEach(text => assert.ok(text.includes('var(' + wanted[kind] + ')'), kind + ' times use ' + wanted[kind] + ': ' + line));
  });
  assert.ok(seen.spin === 1 && seen.entrance === 4 && seen.hawk > 20, JSON.stringify(seen));
});

// The page change: which style, which metal

// A random source that gives the same numbers every time, from 0 up to but not including 1
function seeded(seed) {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

// A random source that gives these numbers one after the other
function scripted(numbers) {
  let at = 0;
  return () => numbers[at++];
}

test('chooseStyle gives slat or mechanical for those settings, whatever came last', () => {
  [null, 'slat', 'mechanical'].forEach(last => {
    assert.equal(chooseStyle('slat', last), 'slat');
    assert.equal(chooseStyle('mechanical', last), 'mechanical');
  });
});

test('chooseStyle takes turns for alternate, and the first change is the mechanical one', () => {
  assert.equal(chooseStyle('alternate', null), 'mechanical');
  assert.equal(chooseStyle('alternate', 'mechanical'), 'slat');
  assert.equal(chooseStyle('alternate', 'slat'), 'mechanical');

  let last = null;
  const run = [];
  for (let change = 0; change < 6; change++) {
    last = chooseStyle('alternate', last);
    run.push(last);
  }
  assert.deepEqual(run, ['mechanical', 'slat', 'mechanical', 'slat', 'mechanical', 'slat']);
});

test('chooseStyle treats a setting it does not know like alternate', () => {
  [undefined, null, '', 'Slat', 'both', 3].forEach(setting => {
    assert.equal(chooseStyle(setting, null), 'mechanical', String(setting));
    assert.equal(chooseStyle(setting, 'mechanical'), 'slat', String(setting));
  });
});

test('chooseFinish gives gold or silver for those settings, whatever came last and whatever the luck', () => {
  [null, 'gold', 'silver'].forEach(last => {
    [0, 0.5, 0.999].forEach(luck => {
      assert.equal(chooseFinish('gold', 10, last, () => luck), 'gold');
      assert.equal(chooseFinish('silver', 10, last, () => luck), 'silver');
    });
  });
});

test('chooseFinish takes turns for alternate, starting with gold, and never asks for a random number', () => {
  const never = () => { throw new Error('alternate does not use luck'); };

  assert.equal(chooseFinish('alternate', 10, null, never), 'gold');
  assert.equal(chooseFinish('alternate', 10, 'gold', never), 'silver');
  assert.equal(chooseFinish('alternate', 10, 'silver', never), 'gold');

  let last = null;
  const run = [];
  for (let change = 0; change < 5; change++) {
    last = chooseFinish('alternate', 10, last, never);
    run.push(last);
  }
  assert.deepEqual(run, ['gold', 'silver', 'gold', 'silver', 'gold']);
});

test('chooseFinish with mostly-gold gives silver only when the random number is under the chance', () => {
  // 10 percent: the numbers below 0.1 are silver
  const draws = [0, 0.05, 0.0999, 0.1, 0.1001, 0.5, 0.9, 0.999];
  const result = draws.map(luck => chooseFinish('mostly-gold', 10, 'gold', () => luck));
  assert.deepEqual(result, ['silver', 'silver', 'silver', 'gold', 'gold', 'gold', 'gold', 'gold']);

  // what was last does not matter, and one number is used for each choice
  assert.equal(chooseFinish('mostly-gold', 10, 'silver', scripted([0.5])), 'gold');
  assert.equal(chooseFinish('mostly-gold', 10, null, scripted([0.01])), 'silver');

  // 0 is never silver and 100 is always silver, at the ends of the random range
  [0, 0.5, 0.999999].forEach(luck => {
    assert.equal(chooseFinish('mostly-gold', 0, null, () => luck), 'gold');
    assert.equal(chooseFinish('mostly-gold', 100, null, () => luck), 'silver');
  });
  assert.equal(chooseFinish('mostly-gold', 50, null, () => 0.49), 'silver');
  assert.equal(chooseFinish('mostly-gold', 50, null, () => 0.5), 'gold');
});

test('chooseFinish with mostly-gold gives silver about one change in ten at the default chance, and in proportion to other chances', () => {
  [[10, 1000], [25, 2500], [60, 6000]].forEach(pair => {
    const random = seeded(12345);
    let silver = 0;
    let last = null;
    for (let change = 0; change < 10000; change++) {
      last = chooseFinish('mostly-gold', pair[0], last, random);
      if (last === 'silver') silver++;
    }
    assert.ok(Math.abs(silver - pair[1]) < 300, pair[0] + ' percent gave ' + silver + ' silver changes in 10000');
  });
  assert.equal(config.defaultSettings.silverChance, 10);
  assert.equal(config.defaultSettings.frameFinish, 'mostly-gold');
});

test('chooseFinish treats a mode it does not know, and a chance that is not a number, like the defaults', () => {
  [undefined, null, '', 'Gold', 'mostly gold', 5].forEach(mode => {
    assert.equal(chooseFinish(mode, 10, 'gold', () => 0.05), 'silver', String(mode));
    assert.equal(chooseFinish(mode, 10, 'gold', () => 0.5), 'gold', String(mode));
  });
  [undefined, null, '', 'ten', NaN, Infinity].forEach(chance => {
    assert.equal(chooseFinish('mostly-gold', chance, null, () => 0.05), 'silver', String(chance));
    assert.equal(chooseFinish('mostly-gold', chance, null, () => 0.5), 'gold', String(chance));
  });
});

// An area as frame.js sees it: its attributes, and nothing else the change needs
function fakeArea(name, data) {
  return { dataset: Object.assign({ area: name, state: 'shown' }, data || {}), getAnimations: () => [] };
}

test('planChange gives the style and the metal for an area, from what the area had last, and each area takes its own turns', async () => {
  await inPage(async world => {
    world.frame.setPageChange('alternate', 'alternate', 10, 0.6);
    const grid1 = fakeArea('grid1', { metal: 'gold' }); // as makeArea leaves it after the first assembly
    const grid2 = fakeArea('grid2', { metal: 'silver' });

    // each change is written on the area, which is how the next one knows whose turn it is
    function change(area) {
      const plan = world.frame.planChange(area);
      area.dataset.change = plan.style;
      area.dataset.metal = plan.finish;
      return plan;
    }

    assert.deepEqual(change(grid1), { style: 'mechanical', finish: 'silver' });
    assert.deepEqual(change(grid1), { style: 'slat', finish: 'gold' });
    assert.deepEqual(change(grid2), { style: 'mechanical', finish: 'gold' }); // grid2 has had no change yet
    assert.deepEqual(change(grid1), { style: 'mechanical', finish: 'silver' });
    assert.deepEqual(change(grid2), { style: 'slat', finish: 'silver' });
  });
});

test('planChange follows the settings: one style, one metal, or luck from Math.random', async () => {
  await inPage(async world => {
    const area = fakeArea('grid1', { metal: 'gold', change: 'mechanical' });

    world.frame.setPageChange('slat', 'silver', 10, 0.6);
    assert.deepEqual(world.frame.planChange(area), { style: 'slat', finish: 'silver' });
    world.frame.setPageChange('mechanical', 'gold', 10, 0.6);
    assert.deepEqual(world.frame.planChange(area), { style: 'mechanical', finish: 'gold' });

    const realRandom = Math.random;
    try {
      world.frame.setPageChange('alternate', 'mostly-gold', 10, 0.6);
      Math.random = () => 0.05;
      assert.equal(world.frame.planChange(area).finish, 'silver');
      Math.random = () => 0.5;
      assert.equal(world.frame.planChange(area).finish, 'gold');

      // a new frame gets its metal the same way
      Math.random = () => 0.05;
      assert.equal(world.frame.firstFinish(), 'silver');
      Math.random = () => 0.5;
      assert.equal(world.frame.firstFinish(), 'gold');
    } finally {
      Math.random = realRandom;
    }

    world.frame.setPageChange('alternate', 'alternate', 10, 0.6);
    assert.equal(world.frame.firstFinish(), 'gold');
  });
});

test('the ticker has no frame, so it always changes by the slat change and has no metal', async () => {
  await inPage(async world => {
    world.frame.setPageChange('mechanical', 'silver', 100, 0.6);
    assert.deepEqual(world.frame.planChange(fakeArea('ticker')), { style: 'slat', finish: null });
  });
});

test('the defaults of frame.js are the settings the Studio starts with', async () => {
  await inPage(async world => {
    const area = fakeArea('grid1');
    const realRandom = Math.random;
    try {
      Math.random = () => 0.5; // gold, with mostly-gold
      assert.deepEqual(world.frame.planChange(area), { style: 'mechanical', finish: 'gold' });
      Math.random = () => 0.05; // silver, with a chance of 10
      assert.equal(world.frame.planChange(area).finish, 'silver');
    } finally {
      Math.random = realRandom;
    }
  });
});

test('leave writes the style and whether the metal changes on the area, and waits as long as that style takes', async () => {
  await inPage(async world => {
    world.frame.setPageChange('alternate', 'alternate', 10, 0.6);
    assert.equal(world.pageStyle.values['--break-seconds'], '0.6');

    async function leaveTime(area, change) {
      const started = world.now;
      let finished = null;
      world.frame.leave(area, change).then(() => { finished = world.now; });
      await world.advance(3000);
      return finished - started;
    }

    // mechanical: the break time. slat: one second.
    const mechanical = fakeArea('grid1', { metal: 'gold' });
    assert.equal(await leaveTime(mechanical, { style: 'mechanical', finish: 'silver' }), 600);
    assert.deepEqual(
      [mechanical.dataset.state, mechanical.dataset.change, mechanical.dataset.recolor],
      ['xo', 'mechanical', 'yes']
    );

    const slat = fakeArea('grid1', { metal: 'gold' });
    assert.equal(await leaveTime(slat, { style: 'slat', finish: 'gold' }), 1000);
    assert.deepEqual([slat.dataset.state, slat.dataset.change, slat.dataset.recolor], ['xo', 'slat', 'no']);

    // the ticker has no metal at all
    const ticker = fakeArea('ticker');
    assert.equal(await leaveTime(ticker, { style: 'slat', finish: null }), 1000);
    assert.equal(ticker.dataset.recolor, 'no');

    // a new break time, and the Speed setting, stretch the mechanical wait
    world.frame.setPageChange('alternate', 'alternate', 10, 1.5);
    assert.equal(world.pageStyle.values['--break-seconds'], '1.5');
    assert.equal(await leaveTime(fakeArea('grid2', { metal: 'gold' }), { style: 'mechanical', finish: 'gold' }), 1500);
    world.frame.setSpeed('slow');
    assert.equal(await leaveTime(fakeArea('grid2', { metal: 'gold' }), { style: 'mechanical', finish: 'gold' }), 2250);
    assert.equal(await leaveTime(fakeArea('grid2', { metal: 'gold' }), { style: 'slat', finish: 'gold' }), 1500);
  });
});

test('a break time that is missing or not a positive number leaves the last good one', async () => {
  await inPage(async world => {
    world.frame.setPageChange('alternate', 'alternate', 10, 0.9);
    [undefined, null, 0, -1, NaN, 'abc'].forEach(bad => world.frame.setPageChange('alternate', 'alternate', 10, bad));
    assert.equal(world.pageStyle.values['--break-seconds'], '0.9');
  });
});

test('calm motion takes the slat change time for every style and has nothing to break, and none waits for nothing', async () => {
  await inPage(async world => {
    world.frame.setPageChange('alternate', 'alternate', 10, 0.6);

    async function leaveTime(change) {
      const started = world.now;
      let finished = null;
      world.frame.leave(fakeArea('grid1', { metal: 'gold' }), change).then(() => { finished = world.now; });
      await world.advance(3000);
      return finished - started;
    }

    world.frame.setMotion('calm');
    assert.equal(await leaveTime({ style: 'mechanical', finish: 'silver' }), 1000);
    assert.equal(await leaveTime({ style: 'slat', finish: 'gold' }), 1000);

    world.frame.setMotion('none');
    assert.equal(await leaveTime({ style: 'mechanical', finish: 'silver' }), 0);
    assert.equal(await leaveTime({ style: 'slat', finish: 'gold' }), 0);
  });
});

// What frame.css and plate.js say, read as text

const plateJs = fs.readFileSync(path.join(dashboardFolder, 'core', 'plate.js'), 'utf8');
const baseCss = fs.readFileSync(path.join(dashboardFolder, 'base.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(dashboardFolder, 'index.html'), 'utf8');

// The pieces of each frame in plate.js: { grid1: [name, ...], grid2: [...] }
function piecesInPlateJs() {
  const found = {};
  ['grid1', 'grid2'].forEach(kind => {
    const start = plateJs.indexOf(kind + '.pieces = [');
    const end = plateJs.indexOf('];', start);
    found[kind] = (plateJs.slice(start, end).match(/name: '[a-z-]+'/g) || []).map(text => text.slice(7, -1));
  });
  return found;
}

test('each frame has 10 to 16 pieces, and the two frames name their pieces alike', () => {
  const found = piecesInPlateJs();

  ['grid1', 'grid2'].forEach(kind => {
    assert.ok(found[kind].length >= 10 && found[kind].length <= 16, kind + ' has ' + found[kind].length + ' pieces');
    assert.equal(new Set(found[kind]).size, found[kind].length, kind + ' names a piece twice');
  });

  // grid1 has two body plates and grid2 one: every other piece is in both
  const shared = found.grid1.filter(name => name.indexOf('plate-body') === -1);
  assert.deepEqual(found.grid2.filter(name => name.indexOf('plate-body') === -1), shared);
});

test('every piece has a line in the table in frame.css with all seven numbers, and the screws are in the two corner pieces', () => {
  const found = piecesInPlateJs();
  const names = found.grid1.concat(found.grid2);

  new Set(names).forEach(name => {
    const line = frameCss.split('\n').filter(text => text.indexOf('[data-piece="' + name + '"]') === 0)[0];
    assert.ok(line, 'frame.css has no line for the piece ' + name);
    ['--tx', '--ty', '--tz', '--rx', '--ry', '--rz', '--hold'].forEach(variable => {
      assert.ok(line.indexOf(variable + ':') !== -1, name + ' has no ' + variable);
    });
  });

  // a line in the table for a piece that does not exist is left behind from an old piece
  const tableNames = (frameCss.match(/^\[data-piece="[a-z-]+"\]/gm) || []).map(text => text.slice(13, -2));
  tableNames.forEach(name => assert.ok(names.indexOf(name) !== -1, 'frame.css moves a piece called ' + name + ' that plate.js does not make'));

  assert.equal((plateJs.match(/, screws: '[ab]' \}/g) || []).length, 4, 'the corner pieces of grid1 and grid2 carry the screws');
  assert.ok(plateJs.includes("name: 'corner-top-left'") && plateJs.includes("name: 'corner-bottom-right'"));
});

test('the pieces start inside the break time: no piece starts later than .3, and the break, the rebuild and the screws each end by 1', () => {
  const holds = (frameCss.match(/--hold: [.0-9]+;\s*\}/g) || []).map(text => Number(text.match(/[.0-9]+/)[0]));
  assert.ok(holds.length >= 14);
  const latest = Math.max.apply(null, holds);
  assert.ok(latest <= 0.3 + 1e-9, 'the latest start is ' + latest);

  const breakRule = frameCss.match(/animation: piece-break calc\(var\(--time-break\) \* ([.0-9]+)\) linear calc\(var\(--time-break\) \* var\(--hold\)\) both;/);
  assert.ok(breakRule, 'the break rule is written with --time-break and --hold');
  assert.ok(latest + Number(breakRule[1]) <= 1 + 1e-9, 'the last piece ends at ' + (latest + Number(breakRule[1])) + ' of the break time');

  const buildRule = frameCss.match(/animation: piece-build calc\(var\(--time-break\) \* ([.0-9]+)\) linear calc\(var\(--time-break\) \* var\(--hold\) \* ([.0-9]+)\) both;/);
  assert.ok(buildRule, 'the build rule is written with --time-break and --hold');
  assert.ok(latest * Number(buildRule[2]) + Number(buildRule[1]) <= 1 + 1e-9, 'the last piece is back at ' + (latest * Number(buildRule[2]) + Number(buildRule[1])) + ' of the break time');

  const screwIn = frameCss.match(/--screw-in-delay: calc\(var\(--time-break\) \* ([.0-9]+)\);\s*--screw-in-time: calc\(var\(--time-break\) \* ([.0-9]+)\);/);
  assert.ok(screwIn, 'the mechanical change times the screws from --time-break');
  assert.ok(Number(screwIn[1]) + Number(screwIn[2]) <= 1 + 1e-9);

  // the slats of the mechanical change fit as well: delay (a + n x b) of the break time, n up to 6, and a length
  [['xo', 'slat-out'], ['xi', 'slat-in']].forEach(entry => {
    const rule = frameCss.match(new RegExp('data-change="mechanical"\\]\\[data-state="' + entry[0] + '"\\] \\[data-slat\\] \\{\\s*animation: ' + entry[1] + ' calc\\(var\\(--time-break\\) \\* ([.0-9]+)\\) var\\(--ease-turn\\) calc\\(var\\(--time-break\\) \\* \\(([.0-9]+) \\+ var\\(--n\\) \\* ([.0-9]+)\\)\\) both;'));
    assert.ok(rule, 'the mechanical ' + entry[1] + ' rule is written with --time-break');
    assert.ok(Number(rule[2]) + 6 * Number(rule[3]) + Number(rule[1]) <= 1 + 1e-9, entry[1] + ' ends by the break time');
  });
});

test('every time in the mechanical change comes from --time-break, and the screws and slat change use --pace', () => {
  const rules = frameCss.split('\n').filter(line => /data-change="mechanical"\]\[data-state="x[oi]"\](\.piece| \[data-slat\])? \{ *$/.test(line) === false && /animation: piece-/.test(line) && /var\(--time-break\)/.test(line));
  assert.equal(rules.length, 2, 'the break and the build');
  rules.forEach(line => {
    const withoutCalc = line.replace(/calc\([^;]*\) (linear|both)/g, '$1');
    assert.ok(!/[0-9.]+m?s\b/.test(withoutCalc), 'a plain time in ' + line);
    assert.ok((line.match(/var\(--time-break\)/g) || []).length === 2, line);
  });
  assert.ok(tokensCss.includes('--time-break: calc(var(--break-seconds) * 1s * var(--pace));'));
  assert.ok(/--break-seconds: \.6;/.test(tokensCss) || frameCss.includes('--break-seconds: .6'), 'the break time is .6 s until frame.js sets it');
  assert.equal(config.defaultSettings.breakSeconds, 0.6);
});

test('the pieces and the perspective are there only while a mechanical change runs, in full motion', () => {
  // hidden by default, shown and promoted only in the two states of a mechanical change
  assert.ok(/\.piece \{ display: none; \}/.test(frameCss));
  const shown = frameCss.match(/\[data-motion="full"\] \.area\[data-change="mechanical"\]\[data-state="xo"\] \.piece,\s*\[data-motion="full"\] \.area\[data-change="mechanical"\]\[data-state="xi"\] \.piece \{[^}]*\}/);
  assert.ok(shown && shown[0].includes('display: block;') && shown[0].includes('will-change: transform, opacity;'));
  assert.equal((frameCss.match(/will-change: transform, opacity;/g) || []).length, 2, 'only the pieces and the blocks of the hidden transitions are promoted this way');

  const lens = frameCss.match(/\.area\[data-change="mechanical"\]\[data-state="xi"\] \{[^}]*\}/);
  assert.ok(lens && lens[0].includes('perspective: 1800px;'));
  assert.equal((frameCss.match(/^\s*perspective: /gm) || []).length, 2, 'the perspective on the area, and the one on the stage for the hidden transitions');

  // nothing of the change is written for calm or none motion
  const lines = frameCss.split('\n').filter(line => /piece|time-break/.test(line) && !/^\s*(\/?\*|--)/.test(line));
  lines.forEach(line => assert.ok(!/data-motion="(calm|none)"/.test(line), line));
  assert.ok(!/data-motion="calm"[^{]*\.piece/.test(frameCss) && !/data-motion="none"[^{]*\.piece/.test(frameCss));
});

test('the page change moves only transform, opacity and perspective: no blur, glow, filter or shadow property', () => {
  const css = frameCss.replace(/\/\*[\s\S]*?\*\//g, '');
  ['filter', 'backdrop-filter', 'box-shadow', 'text-shadow', 'blur(', 'drop-shadow', 'mix-blend-mode'].forEach(word => {
    assert.ok(css.indexOf(word) === -1, 'frame.css uses ' + word);
  });

  // the keyframes of the screws and the pieces change nothing but transform and opacity (and the timing function)
  ['unscrew', 'screw-in', 'screw-arrive', 'screw-shadow-out', 'screw-shadow-in', 'screw-shadow-arrive', 'piece-break', 'piece-build', 'lift-away', 'drop-back'].forEach(name => {
    const start = css.indexOf('@keyframes ' + name + ' {');
    assert.ok(start !== -1, 'no keyframes called ' + name);
    let depth = 0;
    let end = css.indexOf('{', start);
    for (let i = end; i < css.length; i++) {
      if (css[i] === '{') depth++;
      if (css[i] === '}') depth--;
      if (depth === 0) { end = i; break; }
    }
    const properties = (css.slice(start, end).match(/[a-z-]+(?=:)/g) || []).filter(word => word !== 'animation-timing-function');
    properties.forEach(word => assert.ok(['transform', 'opacity'].indexOf(word) !== -1, name + ' changes ' + word));
  });
});

test('the screws turn only in full motion, hold still the rest of the time, and calm motion fades a change of metal as a whole', () => {
  const rules = frameCss.split('\n').filter(line => /animation: (unscrew|screw-)/.test(line));
  assert.equal(rules.length, 6, 'the first assembly, the unscrew and the screw in, for a screw and its shadow');
  const blocks = frameCss.match(/[^{}]*\.screw(-shadow)? \{\s*animation:[^}]*\}/g) || [];
  assert.equal(blocks.length, 6);
  blocks.forEach(block => assert.ok(/data-motion="full"/.test(block), 'a screw rule outside full motion: ' + block));

  // the turn is several: more than one full turn anticlockwise, and the way back is the other way
  const turn = frameCss.match(/--screw-turn: (-?\d+)deg;/g).map(text => Number(text.match(/-?\d+/)[0]));
  turn.forEach(degrees => assert.ok(degrees <= -360, 'a turn of ' + degrees + ' degrees'));
  assert.ok(/@keyframes unscrew \{\s*to \{ transform: rotate\(var\(--screw-turn\)\) scale\(1\.22\); opacity: \.5; \}/.test(frameCss), 'the screw turns, grows a little and dips in opacity');
  assert.ok(/@keyframes screw-in \{\s*0%   \{ transform: rotate\(var\(--screw-turn\)\) scale\(1\.22\); opacity: \.5; \}/.test(frameCss), 'it comes back from the same pose');

  assert.ok(/\[data-motion="calm"\] \.area\[data-recolor="yes"\]\[data-state="xo"\] \{\s*animation: fade-out/.test(frameCss));
  assert.ok(/\[data-motion="calm"\] \.area\[data-recolor="yes"\]\[data-state="xi"\] \{\s*animation: fade-in/.test(frameCss));
});

test('the screw is drawn once, as one symbol with a slot across the head, in the silver tokens, and the hex bolt is gone', () => {
  assert.ok(indexHtml.includes('<g id="screw-shape">') && indexHtml.includes('<polygon id="screw-shadow-shape"'));
  const screw = indexHtml.slice(indexHtml.indexOf('<g id="screw-shape">'), indexHtml.indexOf('</g>', indexHtml.indexOf('<g id="screw-shape">')));
  assert.ok(screw.includes('class="screw-slot"') && screw.includes('class="screw-face"') && screw.includes('class="screw-rim"'));
  assert.ok(!/bolt/i.test(indexHtml) && !/bolt/i.test(plateJs) && !/bolt-/.test(baseCss) && !/bolt/i.test(tokensCss), 'no bolt is left');

  ['--screw-light', '--screw-mid', '--screw-dark', '--screw-rim', '--screw-slot', '--screw-ridge', '--screw-flat', '--screw-face'].forEach(name => {
    assert.ok(tokensCss.includes(name + ':'), 'tokens.css has no ' + name);
  });
  assert.ok(/:root\[data-finish="flat"\] \{\s*--screw-face: var\(--screw-flat\);/.test(tokensCss), 'the flat finish gives the screw one plain silver');
  assert.ok(/\[data-finish="flat"\] \.screw-shadow/.test(baseCss));
  ['screw-rim', 'screw-face', 'screw-ridge', 'screw-slot'].forEach(name => assert.ok(baseCss.includes('.' + name + ' {'), name));
});

test('the metal is set by the nearest data-metal, with the colours worked out on that element', () => {
  assert.ok(!/html\[data-metal/.test(tokensCss), 'the metal blocks are not tied to the html element');
  assert.ok(/:root,\s*\[data-metal="gold"\] \{\s*--metal-1:/.test(tokensCss));
  assert.ok(/\[data-metal="silver"\] \{\s*--metal-1:/.test(tokensCss));
  // the variables made from the metal are made on every element that sets one, or an area would keep the page's
  assert.ok(/:root,\s*\[data-metal\] \{\s*--edge-rim: var\(--metal-rim\);\s*--edge-glint: var\(--metal-glint\);\s*--edge-flat: var\(--metal-flat\);/.test(tokensCss));
  assert.ok(/\[data-metal="silver"\] \{\s*--edge-face: url\(#edge-silver\);/.test(tokensCss));
  assert.ok(/:root,\s*\[data-metal="gold"\] \{\s*--edge-face: url\(#edge-gold\);/.test(tokensCss));

  // the gradients the edges use are drawn for gold in index.html and copied for silver by plate.js
  ['edge-gold', 'edge-ridge-gold', 'edge-shade-gold'].forEach(id => {
    assert.ok(new RegExp('<linearGradient id="' + id + '" data-metal="gold"').test(indexHtml), id);
  });
  assert.ok(plateJs.includes("document.querySelectorAll('linearGradient[data-metal=\"gold\"]')") && plateJs.includes("replace('gold', 'silver')"));

  // the banner, the countdown and the logo have no area, so they follow the html element
  assert.ok(/data-metal="gold"/.test(indexHtml.slice(0, 300)));
});

test('makeSilverGradients copies each gold gradient once, with silver names and the silver metal', async () => {
  const made = [];
  const golds = ['edge-gold', 'edge-ridge-gold', 'edge-shade-gold'].map(id => {
    const element = { id: id, parentNode: { appendChild: clone => made.push(clone) } };
    element.cloneNode = () => ({ id: id, attributes: { 'data-metal': 'gold' }, setAttribute(name, value) { this.attributes[name] = value; } });
    return element;
  });

  const real = globalThis.document;
  globalThis.document = {
    querySelectorAll: selector => (selector === 'linearGradient[data-metal="gold"]' ? golds : []),
    getElementById: id => made.filter(item => item.id === id)[0] || null,
  };
  try {
    // plate.js needs nothing else of the page to be imported
    fs.mkdirSync(path.join(workFolder, 'dashboard', 'core'), { recursive: true });
    fs.copyFileSync(path.join(dashboardFolder, 'core', 'plate.js'), path.join(workFolder, 'dashboard', 'core', 'plate.js'));
    const plate = await import(pathToFileURL(path.join(workFolder, 'dashboard/core/plate.js')).href);

    plate.makeSilverGradients();
    assert.deepEqual(made.map(item => item.id), ['edge-silver', 'edge-ridge-silver', 'edge-shade-silver']);
    made.forEach(item => assert.equal(item.attributes['data-metal'], 'silver'));

    plate.makeSilverGradients(); // a second call makes no more
    assert.equal(made.length, 3);
  } finally {
    globalThis.document = real;
    if (real === undefined) delete globalThis.document;
  }
});

// The Demo page (dashboard/core/demo.js)

const { shouldRunDemo, readHandled, rememberHandled, handledKey, makeDemoRunner, tidyDemo } = demo;
const demoNow = new Date('2026-10-05T12:00:00.000Z');
const secondsAgo = seconds => new Date(demoNow.getTime() - seconds * 1000).toISOString();

function makeStorage(store) {
  return {
    getItem: key => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
  };
}

const brokenStorage = {
  getItem() { throw new Error('storage is switched off'); },
  setItem() { throw new Error('storage is switched off'); },
};

test('a request from the last minute that is not the one handled before runs, at any age up to 60 seconds', () => {
  [0, 1, 30, 59, 60].forEach(age => {
    assert.equal(shouldRunDemo(secondsAgo(age), '', demoNow), true, age + ' seconds old');
  });
});

test('a request older than 60 seconds never runs, so a screen that restarts does not play an old demo', () => {
  [61, 90, 3600, 86400, 86400 * 365].forEach(age => {
    assert.equal(shouldRunDemo(secondsAgo(age), '', demoNow), false, age + ' seconds old');
  });
});

test('the request handled before does not run again, and a different recent one does', () => {
  assert.equal(shouldRunDemo(secondsAgo(10), secondsAgo(10), demoNow), false);
  assert.equal(shouldRunDemo(secondsAgo(10), secondsAgo(70), demoNow), true);
  assert.equal(shouldRunDemo(secondsAgo(2), secondsAgo(10), demoNow), true);
});

test('a cleared request, no request, and text that is not a time never run', () => {
  assert.equal(shouldRunDemo('', '', demoNow), false);
  assert.equal(shouldRunDemo('', secondsAgo(10), demoNow), false);
  [undefined, null, 12345, {}, 'tomorrow', '2026-13-45T99:99:99Z'].forEach(value => {
    assert.equal(shouldRunDemo(value, '', demoNow), false, String(value));
  });
});

test('a request a few seconds in the future counts, because the clocks may be a little apart, and one far ahead does not', () => {
  const ahead = seconds => new Date(demoNow.getTime() + seconds * 1000).toISOString();

  assert.equal(config.demoSkewSeconds, 5);
  [1, 3, 5].forEach(seconds => assert.equal(shouldRunDemo(ahead(seconds), '', demoNow), true, seconds + ' seconds ahead'));
  [6, 60, 3600, 86400 * 365 * 70].forEach(seconds => assert.equal(shouldRunDemo(ahead(seconds), '', demoNow), false, seconds + ' seconds ahead'));
});

test('the window is a minute and the other numbers are the ones the Studio shows', () => {
  assert.equal(config.demoWindowSeconds, 60);
  assert.equal(config.demoMaxSteps, 10);
  assert.deepEqual(config.limits.demoSeconds, { min: 5, max: 300 });
  assert.deepEqual(config.defaultDemo.steps, [{ screen: 'announcement', seconds: 30 }, { screen: 'night-mode', seconds: 30 }]);
  assert.equal(config.defaultDemo.requestedAt, '');
  assert.equal(config.defaultDemo.announcementText, '');
});

test('a storage that fails reads as nothing handled and cannot be written, without an error, and a recent request still runs', () => {
  assert.equal(readHandled(brokenStorage), '');
  assert.equal(readHandled(null), '');
  assert.equal(readHandled(undefined), '');
  assert.equal(rememberHandled(brokenStorage, secondsAgo(5)), false);
  assert.equal(rememberHandled(null, secondsAgo(5)), false);
  assert.equal(shouldRunDemo(secondsAgo(5), readHandled(brokenStorage), demoNow), true);
});

test('what is handled is kept under one name in localStorage and read back, and then that request does not run again', () => {
  const store = {};
  const storage = makeStorage(store);
  assert.equal(handledKey, 'teletraan-demo-handled');
  assert.equal(readHandled(storage), '');

  const request = secondsAgo(5);
  assert.equal(rememberHandled(storage, request), true);
  assert.deepEqual(store, { 'teletraan-demo-handled': request });
  assert.equal(readHandled(storage), request);
  assert.equal(shouldRunDemo(request, readHandled(storage), demoNow), false);
});

// A fake screen for the runner: a clock the test moves, fake screens that write
// down what they are told, and the pauses. wait() is the one place time passes.
// Each new second it looks, as the one clock of the screen does, and things the
// test planned for a time (at) happen when that time comes.
function demoWorld(options) {
  const settings = options || {};
  const world = {
    start: demoNow.getTime(),
    nowMs: demoNow.getTime(),
    content: { demo: { requestedAt: '', steps: [], announcementText: '' } },
    log: [],
    alerts: 0,
    takeover: false,
    store: settings.store || {},
    planned: [],
  };

  world.screens = {
    first: {
      name: 'First',
      async run(context) {
        world.log.push('first ' + context.seconds);
        await context.waitSeconds(context.seconds);
        world.log.push(context.cancelled() ? 'first stopped' : 'first done');
      },
    },
    second: {
      name: 'Second',
      run(context) {
        world.log.push('second ' + context.seconds);
        return () => world.log.push('second taken away');
      },
    },
    broken: {
      name: 'Broken',
      run() { throw new Error('this screen fails'); },
    },
  };

  world.runner = makeDemoRunner({
    getContent: () => world.content,
    screens: world.screens,
    storage: settings.storage === undefined ? makeStorage(world.store) : settings.storage,
    pauseRotation: () => world.log.push('rotation paused'),
    resumeRotation: () => world.log.push('rotation resumed'),
    pauseEffects: paused => world.log.push(paused ? 'effects paused' : 'effects resumed'),
    takeoverRunning: () => world.takeover,
    alertsStarted: () => world.alerts,
    wait: async milliseconds => {
      const secondBefore = Math.floor(world.nowMs / 1000);
      world.nowMs += milliseconds;
      world.planned.filter(item => !item.done && item.at <= world.nowMs).forEach(item => {
        item.done = true;
        item.run();
      });
      if (Math.floor(world.nowMs / 1000) !== secondBefore) world.runner.look(new Date(world.nowMs));
    },
  });

  world.look = () => world.runner.look(new Date(world.nowMs));
  world.requestedSecondsAgo = seconds => { world.content.demo.requestedAt = new Date(world.nowMs - seconds * 1000).toISOString(); };
  world.at = (seconds, run) => world.planned.push({ at: world.start + seconds * 1000, run: run, done: false });
  world.elapsed = () => (world.nowMs - world.start) / 1000;
  return world;
}

async function withQuietErrors(run) {
  const real = console.error;
  const heard = [];
  console.error = (...items) => heard.push(items);
  try {
    await run(heard);
  } finally {
    console.error = real;
  }
}

test('a request plays the steps once, in order, each for its seconds, with the rotation and the effects paused from start to end', async () => {
  const world = demoWorld();
  world.content.demo.steps = [{ screen: 'first', seconds: 10 }, { screen: 'second', seconds: 5 }];
  world.requestedSecondsAgo(2);

  world.look();
  assert.equal(world.runner.isRunning(), true);
  await world.runner.whenIdle();

  assert.deepEqual(world.log, [
    'rotation paused', 'effects paused',
    'first 10', 'first done',
    'second 5', 'second taken away',
    'effects resumed', 'rotation resumed',
  ]);
  assert.equal(world.elapsed(), 15, 'ten seconds and then five');
  assert.equal(world.runner.isRunning(), false);
});

test('the same request does not play twice, and a request that comes after the demo is over plays', async () => {
  const world = demoWorld();
  world.content.demo.steps = [{ screen: 'second', seconds: 5 }];
  world.requestedSecondsAgo(1);

  world.look();
  await world.runner.whenIdle();
  const once = world.log.length;
  assert.ok(once > 0);

  world.look();
  world.look();
  await world.runner.whenIdle();
  assert.equal(world.log.length, once, 'the request is still on the page, and is not played again');

  world.requestedSecondsAgo(0);
  world.look();
  await world.runner.whenIdle();
  assert.equal(world.log.length, once * 2, 'a new request is played');
});

test('a screen that restarts a few seconds after a demo does not play it again, and one that restarts after a minute ignores it', async () => {
  const world = demoWorld();
  world.content.demo.steps = [{ screen: 'second', seconds: 5 }];
  world.requestedSecondsAgo(1);
  world.look();
  await world.runner.whenIdle();

  // the page loads again with the same storage and the same request still on the Demo page
  const soon = demoWorld({ store: world.store });
  soon.nowMs = soon.start = world.nowMs + 20 * 1000;
  soon.content.demo = Object.assign({}, world.content.demo);
  soon.look();
  assert.deepEqual(soon.log, [], 'handled before, so not again');

  // a browser with no storage at all, a minute later: the request is too old
  const later = demoWorld({ storage: null });
  later.nowMs = later.start = world.nowMs + 70 * 1000;
  later.content.demo = Object.assign({}, world.content.demo);
  later.look();
  assert.deepEqual(later.log, [], 'older than a minute, so not at all');
});

test('a storage that fails still plays a request once while the page is open', async () => {
  const world = demoWorld({ storage: brokenStorage });
  world.content.demo.steps = [{ screen: 'second', seconds: 5 }];
  world.requestedSecondsAgo(3);

  world.look();
  await world.runner.whenIdle();
  const once = world.log.length;
  assert.ok(once > 0);

  world.look();
  await world.runner.whenIdle();
  assert.equal(world.log.length, once, 'it remembers the request itself');
});

test('Stop demo in the middle of a step ends the demo: the screen is told, the later steps do not play and everything is given back', async () => {
  const world = demoWorld();
  world.content.demo.steps = [{ screen: 'first', seconds: 60 }, { screen: 'second', seconds: 30 }];
  world.requestedSecondsAgo(1);
  world.at(10, () => { world.content.demo.requestedAt = ''; });

  world.look();
  await world.runner.whenIdle();

  assert.deepEqual(world.log, ['rotation paused', 'effects paused', 'first 60', 'first stopped', 'effects resumed', 'rotation resumed']);
  assert.ok(world.elapsed() >= 10 && world.elapsed() <= 11.5, 'it stopped within a second of the request being cleared, not after the 60 seconds: ' + world.elapsed());
  assert.equal(world.runner.isRunning(), false);
});

test('Stop demo while a step that returns a stop function is waiting takes that screen away at once', async () => {
  const world = demoWorld();
  world.content.demo.steps = [{ screen: 'second', seconds: 100 }];
  world.requestedSecondsAgo(1);
  world.at(5, () => { world.content.demo.requestedAt = ''; });

  world.look();
  await world.runner.whenIdle();

  assert.deepEqual(world.log, ['rotation paused', 'effects paused', 'second 100', 'second taken away', 'effects resumed', 'rotation resumed']);
  assert.ok(world.elapsed() <= 6.5, 'not 100 seconds: ' + world.elapsed());
});

test('a new request in the middle of a demo stops it and starts the new one from the first step', async () => {
  const world = demoWorld();
  world.content.demo.steps = [{ screen: 'first', seconds: 60 }, { screen: 'second', seconds: 5 }];
  world.requestedSecondsAgo(1);
  world.at(10, () => world.requestedSecondsAgo(0));

  world.look();
  await world.runner.whenIdle();
  assert.deepEqual(world.log, ['rotation paused', 'effects paused', 'first 60', 'first stopped', 'effects resumed', 'rotation resumed']);

  // the clock of the screen looks again a second later
  world.log.length = 0;
  world.content.demo.steps = [{ screen: 'first', seconds: 5 }, { screen: 'second', seconds: 5 }];
  world.look();
  await world.runner.whenIdle();
  assert.deepEqual(world.log, [
    'rotation paused', 'effects paused', 'first 5', 'first done', 'second 5', 'second taken away', 'effects resumed', 'rotation resumed',
  ]);
});

test('a real alert that starts during a demo ends it, even when the alert is over before the step is', async () => {
  const world = demoWorld();
  world.content.demo.steps = [{ screen: 'first', seconds: 60 }, { screen: 'second', seconds: 30 }];
  world.requestedSecondsAgo(1);
  world.at(10, () => { world.alerts += 1; });

  world.look();
  await world.runner.whenIdle();

  assert.deepEqual(world.log, ['rotation paused', 'effects paused', 'first 60', 'first stopped', 'effects resumed', 'rotation resumed']);
  assert.ok(world.elapsed() <= 10.5, 'it does not wait out the step: ' + world.elapsed());
});

test('an alert or announcement that has the screen between two steps ends the demo', async () => {
  const world = demoWorld();
  world.content.demo.steps = [{ screen: 'first', seconds: 5 }, { screen: 'second', seconds: 5 }];
  world.requestedSecondsAgo(1);
  world.at(2, () => { world.takeover = true; });

  world.look();
  await world.runner.whenIdle();
  assert.deepEqual(world.log, ['rotation paused', 'effects paused', 'first 5', 'first done', 'effects resumed', 'rotation resumed']);
});

test('while an alert or announcement has the screen a request waits, and plays when it is over if it is still recent', async () => {
  const world = demoWorld();
  world.content.demo.steps = [{ screen: 'second', seconds: 5 }];
  world.takeover = true;
  world.requestedSecondsAgo(1);

  world.look();
  assert.deepEqual(world.log, [], 'not while the alert is up');

  world.nowMs += 30 * 1000;
  world.takeover = false;
  world.look();
  await world.runner.whenIdle();
  assert.ok(world.log.includes('second 5'), 'half a minute later it plays');

  const late = demoWorld();
  late.content.demo.steps = [{ screen: 'second', seconds: 5 }];
  late.takeover = true;
  late.requestedSecondsAgo(1);
  late.look();
  late.nowMs += 90 * 1000;
  late.takeover = false;
  late.look();
  assert.deepEqual(late.log, [], 'but a minute and a half later it is too old');
});

test('a screen that fails is skipped and the rest of the demo plays, a screen the dashboard does not have is skipped, and the pauses are given back', () => withQuietErrors(async heard => {
  const world = demoWorld();
  world.content.demo.steps = [{ screen: 'broken', seconds: 5 }, { screen: 'no-such-screen', seconds: 5 }, { screen: 'second', seconds: 5 }];
  world.requestedSecondsAgo(1);

  world.look();
  await world.runner.whenIdle();
  assert.deepEqual(world.log, ['rotation paused', 'effects paused', 'second 5', 'second taken away', 'effects resumed', 'rotation resumed']);
  assert.equal(heard.length, 1, 'the failure is written to the console');
}));

test('a demo with no steps plays nothing and still gives back what it paused', async () => {
  const world = demoWorld();
  world.requestedSecondsAgo(1);

  world.look();
  await world.runner.whenIdle();
  assert.deepEqual(world.log, ['rotation paused', 'effects paused', 'effects resumed', 'rotation resumed']);
});

test('content with no demo in it, or a demo with no request, plays nothing', async () => {
  const world = demoWorld();
  world.content = { settings: {} };
  world.look();
  world.content = null;
  world.look();
  world.content = { demo: { requestedAt: '', steps: [{ screen: 'second', seconds: 5 }] } };
  world.look();
  assert.deepEqual(world.log, []);
  assert.equal(world.runner.isRunning(), false);
});

test('the registry has a name and a run function for each screen, in the plain words the Studio shows', () => {
  const ids = Object.keys(demoRegistry.demoScreens);
  assert.deepEqual(ids, ['announcement', 'all-announcements', 'night-mode']);
  ids.forEach(id => {
    const entry = demoRegistry.demoScreens[id];
    assert.ok(/^[a-z]+(-[a-z]+)*$/.test(id), id + ' is a plain lower case id');
    assert.ok(/^[A-Z][A-Za-z ]+$/.test(entry.name), id + ' has a name in plain words');
    assert.equal(typeof entry.run, 'function', id + ' has a run function');
  });
});

test('the announcement step shows the typed words as one line for all of its seconds', () => {
  const content = { demo: { announcementText: ' LET US BEGIN ' }, settings: { announcements: [{ title: 'ANOTHER', followUp: 'MORE', titleSeconds: 12, followUpSeconds: 10 }] } };
  assert.deepEqual(demoRegistry.demoAnnouncement(content, 30), { title: 'LET US BEGIN', followUp: '', titleSeconds: 30, followUpSeconds: 0 });
});

test('with no words typed the announcement step uses the first announcement, and shares the seconds between its two lines as it does', () => {
  const announcements = [
    { title: 'FIRST LINE', followUp: 'SECOND LINE', titleSeconds: 12, followUpSeconds: 10 },
    { title: 'NOT THIS ONE', followUp: '', titleSeconds: 12, followUpSeconds: 10 },
  ];
  const content = { demo: { announcementText: '' }, settings: { announcements: announcements } };

  const thirty = demoRegistry.demoAnnouncement(content, 30);
  assert.equal(thirty.title, 'FIRST LINE');
  assert.equal(thirty.followUp, 'SECOND LINE');
  assert.equal(thirty.titleSeconds + thirty.followUpSeconds, 30);
  assert.deepEqual([thirty.titleSeconds, thirty.followUpSeconds], [16, 14]);

  const shortest = demoRegistry.demoAnnouncement(content, 5);
  assert.deepEqual([shortest.titleSeconds, shortest.followUpSeconds], [3, 2]);

  // blank words count as none
  const blank = { demo: { announcementText: '   ' }, settings: { announcements: announcements } };
  assert.equal(demoRegistry.demoAnnouncement(blank, 30).title, 'FIRST LINE');

  // a first announcement with no second line is one line for all the seconds
  const single = { demo: { announcementText: '' }, settings: { announcements: [announcements[1]] } };
  assert.deepEqual(demoRegistry.demoAnnouncement(single, 40), { title: 'NOT THIS ONE', followUp: '', titleSeconds: 40, followUpSeconds: 0 });
});

test('with no words typed and no announcement at all the announcement step shows a marked placeholder', () => {
  const none = { demo: { announcementText: '' }, settings: { announcements: [] } };
  assert.deepEqual(demoRegistry.demoAnnouncement(none, 30), { title: '[DEMO ANNOUNCEMENT]', followUp: '', titleSeconds: 30, followUpSeconds: 0 });
  assert.equal(demoRegistry.demoAnnouncement({ demo: { announcementText: '' }, settings: {} }, 30).title, config.demoPlaceholderText);
});

test('tidyDemo always gives a complete demo: the request, the known steps with their seconds in range, and the words', () => {
  assert.deepEqual(tidyDemo(undefined), config.defaultDemo);
  assert.deepEqual(tidyDemo(null), config.defaultDemo);
  assert.deepEqual(tidyDemo('oops'), config.defaultDemo);
  assert.deepEqual(tidyDemo({}), config.defaultDemo);

  const tidy = tidyDemo({
    _id: 'demo',
    _type: 'demo',
    requestedAt: secondsAgo(3),
    steps: [
      { _key: 'a', screen: 'announcement', seconds: 2 },
      { _key: 'b', screen: 'night-mode', seconds: 9000 },
      { _key: 'c', screen: 'a-screen-that-does-not-exist', seconds: 30 },
      { _key: 'd', seconds: 30 },
      { _key: 'e', screen: 'night-mode' },
      'oops',
    ],
    announcementText: '  HELLO  ',
  });
  assert.equal(tidy.requestedAt, secondsAgo(3));
  assert.deepEqual(tidy.steps, [{ screen: 'announcement', seconds: 5 }, { screen: 'night-mode', seconds: 300 }, { screen: 'night-mode', seconds: 30 }]);
  assert.equal(tidy.announcementText, 'HELLO');
  assert.deepEqual(Object.keys(tidy).sort(), ['announcementText', 'requestedAt', 'steps']);
});

test('tidyDemo keeps a list the editors emptied empty, cuts a list at ten steps and drops a request that is not a time', () => {
  assert.deepEqual(tidyDemo({ steps: [] }).steps, []);

  const long = [];
  for (let count = 0; count < 14; count++) long.push({ screen: 'announcement', seconds: 10 });
  assert.equal(tidyDemo({ steps: long }).steps.length, 10);

  assert.equal(tidyDemo({ requestedAt: 'tomorrow' }).requestedAt, '');
  assert.equal(tidyDemo({ requestedAt: 12345 }).requestedAt, '');
  assert.equal(tidyDemo({ steps: 'not a list' }).steps.length, 2, 'not a list is the default list');
});

test('every screen in the registry is accepted as a step, and the default steps are tidy already', () => {
  Object.keys(demoRegistry.demoScreens).forEach(id => {
    assert.deepEqual(tidyDemo({ steps: [{ screen: id, seconds: 20 }] }).steps, [{ screen: id, seconds: 20 }]);
  });
  assert.deepEqual(tidyDemo({ steps: config.defaultDemo.steps }).steps, config.defaultDemo.steps);
});

test('the demo registry and the plain functions import nothing from the page, so they can be read here and by check-schemas.mjs', () => {
  const registry = fs.readFileSync(path.join(dashboardFolder, 'core/demo-screens.js'), 'utf8');
  const imports = registry.split('\n').filter(line => /^import /.test(line));
  assert.deepEqual(imports, ["import { demoPlaceholderText } from '../config.js';"]);
  assert.ok(registry.includes("await import('./takeover.js')") && registry.includes("await import('./night-screen.js')"), 'the page code is loaded when a screen runs');

  const plain = fs.readFileSync(path.join(dashboardFolder, 'core/demo.js'), 'utf8');
  assert.equal(plain.split('\n').filter(line => /^import /.test(line)).length, 2);
  assert.ok(!/\bdocument\b|\bwindow\b/.test(plain.split('\n').filter(line => !line.trim().startsWith('//')).join('\n')), 'no page in demo.js');
});

test('the shell starts the demo runner after the takeovers, and only when the whole screen runs', () => {
  const shell = fs.readFileSync(path.join(dashboardFolder, 'shell.js'), 'utf8');
  const takeovers = shell.indexOf('startTakeovers(getContent);');
  const runner = shell.indexOf("startOptional('./core/demo-runner.js', module => module.startDemoRunner(getContent))");
  assert.ok(takeovers !== -1 && runner > takeovers, 'after startTakeovers');
  assert.ok(shell.lastIndexOf("if (!params.get('show') && !stress) {", takeovers) !== -1);
});

// The hidden transitions (dashboard/core/hidden.js, hidden-transitions.js, hidden-pictures.js,
// and the parts of frame.js, frame.css and the other files that make room for them)

const { chooseHidden, holdReason, pushedKind, tidyHiddenRequest, chanceFields, readHandledRequest, rememberHandledRequest } = hidden;
const hiddenKinds = Object.keys(hiddenRegistry.hiddenTransitions);

// Settings with the starting values, and the state of a free screen
const hiddenSettings = overrides => Object.assign({}, config.defaultSettings, { hiddenRequest: { kind: '', requestedAt: '' } }, overrides);
const freeScreen = overrides => Object.assign({ motion: 'full', takeover: false, demo: false, night: false, playing: false }, overrides);

// Asks chooseHidden what happens at one page change, with the number the random function gives.
// calls counts how many times it was asked for one.
function hiddenAt(roll, settings, state, extra) {
  const calls = { random: 0 };
  const choice = chooseHidden(Object.assign({
    settings: settings || hiddenSettings(),
    state: state || freeScreen(),
    handled: '',
    now: demoNow,
    random: () => { calls.random += 1; return roll; },
    address: '',
  }, extra));
  return { choice: choice, calls: calls.random };
}

test('the chance is a percent of page changes: 1 and 1 give the desktop reveal in the first percent and red eyes in the next', () => {
  assert.deepEqual(hiddenAt(0).choice, { kind: 'desktop', how: 'chance' });
  assert.deepEqual(hiddenAt(0.0099).choice, { kind: 'desktop', how: 'chance' });
  assert.deepEqual(hiddenAt(0.01).choice, { kind: 'redEyes', how: 'chance' });
  assert.deepEqual(hiddenAt(0.0199).choice, { kind: 'redEyes', how: 'chance' });
  assert.equal(hiddenAt(0.02).choice, null);
  assert.equal(hiddenAt(0.5).choice, null);
  assert.equal(hiddenAt(0.9999).choice, null);
});

test('one random number decides a page change, however many transitions there are, and none is drawn when nothing can play', () => {
  assert.equal(hiddenAt(0.5).calls, 1);
  assert.equal(hiddenAt(0).calls, 1);
  assert.equal(hiddenAt(0, hiddenSettings({ hiddenEnabled: false })).calls, 0);
  assert.equal(hiddenAt(0, hiddenSettings(), freeScreen({ motion: 'calm' })).calls, 0);
  assert.equal(hiddenAt(0, hiddenSettings(), freeScreen({ takeover: true })).calls, 0);
  assert.equal(hiddenAt(0, hiddenSettings({ hiddenRequest: { kind: 'desktop', requestedAt: secondsAgo(5) } })).calls, 0, 'a push needs no luck');
});

test('a chance of 0 is never, and 100 is always, for each transition on its own', () => {
  const never = hiddenSettings({ desktopChance: 0, redEyesChance: 0 });
  [0, 0.0001, 0.005, 0.5, 0.9999].forEach(roll => assert.equal(hiddenAt(roll, never).choice, null, 'roll ' + roll));

  const onlyRed = hiddenSettings({ desktopChance: 0, redEyesChance: 100 });
  [0, 0.5, 0.9999].forEach(roll => assert.deepEqual(hiddenAt(roll, onlyRed).choice, { kind: 'redEyes', how: 'chance' }, 'roll ' + roll));

  const onlyDesktop = hiddenSettings({ desktopChance: 100, redEyesChance: 0 });
  [0, 0.5, 0.9999].forEach(roll => assert.deepEqual(hiddenAt(roll, onlyDesktop).choice, { kind: 'desktop', how: 'chance' }, 'roll ' + roll));

  // only red eyes: the first percent is not the desktop reveal's any more
  assert.deepEqual(hiddenAt(0, hiddenSettings({ desktopChance: 0, redEyesChance: 1 })).choice, { kind: 'redEyes', how: 'chance' });
  assert.equal(hiddenAt(0.01, hiddenSettings({ desktopChance: 0, redEyesChance: 1 })).choice, null);
});

test('chances that add up to more than 100 leave the last transition no share, and a chance that is not a number is the starting value', () => {
  const crowded = hiddenSettings({ desktopChance: 80, redEyesChance: 80 });
  assert.deepEqual(hiddenAt(0.79, crowded).choice, { kind: 'desktop', how: 'chance' });
  assert.deepEqual(hiddenAt(0.8, crowded).choice, { kind: 'redEyes', how: 'chance' });
  assert.deepEqual(hiddenAt(0.9999, crowded).choice, { kind: 'redEyes', how: 'chance' });

  [undefined, null, '5', NaN].forEach(value => {
    const settings = hiddenSettings({ desktopChance: value, redEyesChance: value });
    assert.deepEqual(hiddenAt(0.005, settings).choice, { kind: 'desktop', how: 'chance' }, String(value));
    assert.deepEqual(hiddenAt(0.015, settings).choice, { kind: 'redEyes', how: 'chance' }, String(value));
    assert.equal(hiddenAt(0.02, settings).choice, null, String(value));
  });
  assert.deepEqual(hiddenAt(0, hiddenSettings({ desktopChance: 500, redEyesChance: 0 })).choice, { kind: 'desktop', how: 'chance' }, '500 is 100');
  assert.equal(hiddenAt(0, hiddenSettings({ desktopChance: -5, redEyesChance: -5 })).choice, null, 'below 0 is 0');
});

test('over many page changes each transition plays about its percent of them', () => {
  // a plain generator with a fixed start, so the test gives the same answer every time
  let seed = 12345;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const counts = { desktop: 0, redEyes: 0, none: 0 };
  const settings = hiddenSettings({ desktopChance: 10, redEyesChance: 5 });
  const draws = 20000;
  for (let count = 0; count < draws; count++) {
    const choice = chooseHidden({ settings: settings, state: freeScreen(), handled: '', now: demoNow, random: random, address: '' });
    counts[choice ? choice.kind : 'none'] += 1;
  }
  assert.ok(Math.abs(counts.desktop / draws - 0.10) < 0.01, 'desktop ' + counts.desktop / draws);
  assert.ok(Math.abs(counts.redEyes / draws - 0.05) < 0.01, 'red eyes ' + counts.redEyes / draws);
  assert.equal(counts.desktop + counts.redEyes + counts.none, draws);
});

test('the master switch off stops everything: the chance, a push from the Studio and the address', () => {
  const off = hiddenSettings({ hiddenEnabled: false, desktopChance: 100, redEyesChance: 100 });
  assert.equal(hiddenAt(0, off).choice, null);
  const pushed = Object.assign({}, off, { hiddenRequest: { kind: 'desktop', requestedAt: secondsAgo(2) } });
  assert.equal(hiddenAt(0, pushed).choice, null);
  assert.equal(hiddenAt(0, pushed, freeScreen(), { address: 'redEyes' }).choice, null);

  assert.equal(holdReason(off, freeScreen()), 'off');
  assert.equal(holdReason(Object.assign({}, off, { hiddenEnabled: 'yes' }), freeScreen()), 'off', 'only true is on');
  assert.equal(holdReason(hiddenSettings(), freeScreen()), '');
});

test('calm and no motion never play one, not by chance and not when pushed', () => {
  ['calm', 'none', '', undefined].forEach(motion => {
    const full = hiddenSettings({ desktopChance: 100 });
    assert.equal(hiddenAt(0, full, freeScreen({ motion: motion })).choice, null, String(motion));
    const pushed = hiddenSettings({ hiddenRequest: { kind: 'redEyes', requestedAt: secondsAgo(2) } });
    assert.equal(hiddenAt(0, pushed, freeScreen({ motion: motion })).choice, null, String(motion));
    assert.equal(holdReason(full, freeScreen({ motion: motion })), 'motion');
  });
});

test('an alert, an announcement, a demo, the night screen and a hidden transition that is playing each stop one, and say busy', () => {
  const sure = hiddenSettings({ desktopChance: 100 });
  ['takeover', 'demo', 'night', 'playing'].forEach(name => {
    const state = freeScreen({ [name]: true });
    assert.equal(hiddenAt(0, sure, state).choice, null, name);
    assert.equal(holdReason(sure, state), 'busy', name);
  });
  assert.equal(holdReason(sure, freeScreen({ takeover: true, demo: true, night: true, playing: true })), 'busy');
  assert.equal(holdReason(hiddenSettings({ hiddenEnabled: false }), freeScreen({ takeover: true })), 'off', 'off is the first thing said');
});

test('a push from the Studio ignores the chance, and plays once the screen is free again', () => {
  const never = hiddenSettings({ desktopChance: 0, redEyesChance: 0, hiddenRequest: { kind: 'redEyes', requestedAt: secondsAgo(10) } });
  assert.deepEqual(hiddenAt(0.9, never).choice, { kind: 'redEyes', how: 'push' });

  // it waits for whatever has the screen, and plays at the first page change after that
  ['takeover', 'demo', 'night', 'playing'].forEach(name => {
    assert.equal(hiddenAt(0.9, never, freeScreen({ [name]: true })).choice, null, name);
    assert.deepEqual(hiddenAt(0.9, never, freeScreen()).choice, { kind: 'redEyes', how: 'push' }, 'after ' + name);
  });
});

test('a push plays only while it is a minute old at most, only once, and only if its kind is one the screen has', () => {
  const settingsWith = (kind, requestedAt) => hiddenSettings({ desktopChance: 0, redEyesChance: 0, hiddenRequest: { kind: kind, requestedAt: requestedAt } });

  [0, 1, 30, 59, 60].forEach(age => assert.equal(hiddenAt(0.9, settingsWith('desktop', secondsAgo(age))).choice.how, 'push', age + ' seconds old'));
  [61, 120, 3600].forEach(age => assert.equal(hiddenAt(0.9, settingsWith('desktop', secondsAgo(age))).choice, null, age + ' seconds old'));

  // the one handled before does not play again, a newer one does
  const request = secondsAgo(10);
  assert.equal(hiddenAt(0.9, settingsWith('desktop', request), freeScreen(), { handled: request }).choice, null);
  assert.equal(hiddenAt(0.9, settingsWith('desktop', secondsAgo(2)), freeScreen(), { handled: request }).choice.how, 'push');

  // no kind, a kind the registry does not have, no time and a time that is not one are no push
  [['', request], ['megaflash', request], ['desktop', ''], ['desktop', 'tomorrow'], [undefined, undefined]].forEach(pair => {
    assert.equal(hiddenAt(0.9, settingsWith(pair[0], pair[1])).choice, null, JSON.stringify(pair));
  });

  // each kind in the registry can be pushed
  hiddenKinds.forEach(kind => assert.deepEqual(hiddenAt(0.9, settingsWith(kind, secondsAgo(3))).choice, { kind: kind, how: 'push' }));
  assert.equal(pushedKind({ kind: 'desktop', requestedAt: secondsAgo(3) }, '', demoNow), 'desktop');
  assert.equal(pushedKind(null, '', demoNow), '');
  assert.equal(pushedKind('desktop', '', demoNow), '');
});

test('the address switch plays its kind at the next page change, before a push and before the chance, and a kind that is not one is ignored', () => {
  const pushed = hiddenSettings({ hiddenRequest: { kind: 'desktop', requestedAt: secondsAgo(2) } });
  assert.deepEqual(hiddenAt(0, pushed, freeScreen(), { address: 'redEyes' }).choice, { kind: 'redEyes', how: 'address' });
  assert.deepEqual(hiddenAt(0.9, hiddenSettings(), freeScreen(), { address: 'desktop' }).choice, { kind: 'desktop', how: 'address' });
  ['', 'off', 'megaflash', undefined, null, 'toString'].forEach(address => {
    assert.equal(hiddenAt(0.9, hiddenSettings(), freeScreen(), { address: address }).choice, null, String(address));
  });
});

test('a push is kept as handled under a name of its own in localStorage, apart from the demo, and a storage that fails still reads as nothing handled', () => {
  assert.equal(hidden.handledKey, 'teletraan-hidden-handled');
  assert.notEqual(hidden.handledKey, handledKey);

  const store = {};
  const storage = makeStorage(store);
  assert.equal(readHandledRequest(storage), '');
  const request = secondsAgo(5);
  assert.equal(rememberHandledRequest(storage, request), true);
  assert.deepEqual(store, { 'teletraan-hidden-handled': request });
  assert.equal(readHandledRequest(storage), request);
  assert.equal(readHandled(storage), '', 'the demo has not handled anything');

  rememberHandled(storage, secondsAgo(1)); // the demo's own, under its own key
  assert.equal(readHandledRequest(storage), request);
  assert.equal(readHandled(storage), secondsAgo(1));

  // a Mini that restarts after a push does not play it again
  assert.equal(pushedKind({ kind: 'desktop', requestedAt: request }, readHandledRequest(storage), demoNow), '');
  assert.equal(readHandledRequest(brokenStorage), '');
  assert.equal(readHandledRequest(null), '');
  assert.equal(rememberHandledRequest(brokenStorage, request), false);
  assert.equal(rememberHandledRequest(null, request), false);
});

test('tidyHiddenRequest always gives a kind and a time, empty when they are not usable', () => {
  const when = secondsAgo(3);
  assert.deepEqual(tidyHiddenRequest({ kind: 'redEyes', requestedAt: when }), { kind: 'redEyes', requestedAt: when });
  assert.deepEqual(tidyHiddenRequest({ kind: 'desktop', requestedAt: 'whenever' }), { kind: 'desktop', requestedAt: '' });
  assert.deepEqual(tidyHiddenRequest({ kind: 'nothing', requestedAt: when }), { kind: '', requestedAt: when });
  [undefined, null, 'redEyes', 4, [], {}].forEach(value => assert.deepEqual(tidyHiddenRequest(value), { kind: '', requestedAt: '' }, JSON.stringify(value)));
  assert.deepEqual(Object.keys(tidyHiddenRequest({ kind: 'desktop', requestedAt: when, extra: 1 })).sort(), ['kind', 'requestedAt']);
});

test('the registry has a name, a chance field and a run function for each hidden transition, and each chance is a setting with limits and a starting value', () => {
  assert.deepEqual(hiddenKinds, ['desktop', 'redEyes']);
  assert.deepEqual(chanceFields(), ['desktopChance', 'redEyesChance']);

  hiddenKinds.forEach(kind => {
    const entry = hiddenRegistry.hiddenTransitions[kind];
    assert.ok(typeof entry.name === 'string' && /^[A-Z][a-z]+( [a-z]+)*$/.test(entry.name), kind + ' needs a name in plain words: ' + entry.name);
    assert.equal(typeof entry.run, 'function', kind);
    assert.equal(typeof entry.chanceField, 'string', kind);
    assert.deepEqual(config.limits[entry.chanceField], { min: 0, max: 100 }, entry.chanceField + ' is a percent');
    assert.equal(config.defaultSettings[entry.chanceField], 1, entry.chanceField + ' starts at 1');
  });
  assert.equal(config.defaultSettings.hiddenEnabled, true);
  assert.deepEqual(config.defaultSettings.hiddenRequest, { kind: '', requestedAt: '' });
  assert.equal(config.hiddenAdvanceSeconds, 20);
});

// A scene that writes down each step it is asked for. Each step takes no time.
function recordingScene() {
  const steps = [];
  const scene = {};
  ['glitch', 'breakApart', 'wait', 'pictureIn', 'pictureCut', 'pictureOut', 'rebuild'].forEach(name => {
    scene[name] = async (...args) => { steps.push([name].concat(args)); };
  });
  return { scene: scene, steps: steps };
}

test('the desktop reveal glitches blue, breaks apart over a deep blue, glitches blue again, cuts to a blue screen for 3 seconds and rebuilds', async () => {
  const { scene, steps } = recordingScene();
  await hiddenRegistry.hiddenTransitions.desktop.run(scene);
  assert.deepEqual(steps, [
    ['glitch', 2, 'blue'],
    ['breakApart', 'blue'],
    ['glitch', 1, 'blue'],
    ['pictureCut', 'blueScreen', 3],
    ['rebuild'],
  ]);
});

test('red eyes glitch red, break apart to black, fade a red eyes picture in, hold it 2.5 seconds, fade it out and rebuild', async () => {
  const { scene, steps } = recordingScene();
  await hiddenRegistry.hiddenTransitions.redEyes.run(scene);
  assert.deepEqual(steps, [
    ['glitch', 1.5],
    ['breakApart', 'black'],
    ['pictureIn', 'redEyes', 0.6],
    ['wait', 2.5],
    ['pictureOut', 0.6],
    ['rebuild'],
  ]);
  assert.equal(steps[0].length, 2, 'the red glitch is asked for with no tint, which is red');
});

test('the second blue glitch is shorter than the first, and the cut has no fade step before it', async () => {
  const { scene, steps } = recordingScene();
  await hiddenRegistry.hiddenTransitions.desktop.run(scene);
  const glitches = steps.filter(step => step[0] === 'glitch');
  assert.equal(glitches.length, 2);
  assert.ok(glitches[1][1] < glitches[0][1], 'the second glitch is the short one');
  glitches.forEach(step => assert.equal(step[2], 'blue'));

  const names = steps.map(step => step[0]);
  assert.equal(names[names.indexOf('pictureCut') - 1], 'glitch', 'the cut comes straight out of the second glitch');
  assert.ok(!names.includes('pictureIn') && !names.includes('pictureOut'), 'no fade in the desktop reveal');
  assert.equal(names[names.indexOf('pictureCut') + 1], 'rebuild', 'and the blocks come back right after the hold');
  assert.ok(steps[names.indexOf('pictureCut')][2] >= 2.5 && steps[names.indexOf('pictureCut')][2] <= 4, 'held for about 3 seconds');
});

test('every transition ends with rebuild and breaks the screen apart before it, so the screen is never left apart', async () => {
  for (const kind of hiddenKinds) {
    const { scene, steps } = recordingScene();
    await hiddenRegistry.hiddenTransitions[kind].run(scene);
    const names = steps.map(step => step[0]);
    assert.equal(names[names.length - 1], 'rebuild', kind);
    assert.equal(names.filter(name => name === 'rebuild').length, 1, kind);
    assert.equal(names.filter(name => name === 'breakApart').length, 1, kind);
    assert.ok(names.indexOf('breakApart') < names.indexOf('rebuild'), kind);
  }
});

test('the registry and the plain functions import nothing from the page, so they can be read here and by check-schemas.mjs', () => {
  const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');
  const importsOf = text => text.split('\n').filter(line => /^import /.test(line));
  const code = text => text.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');

  assert.deepEqual(importsOf(read('core/hidden-transitions.js')), []);
  assert.deepEqual(importsOf(read('core/hidden.js')), [
    "import { defaultSettings } from '../config.js';",
    "import { readHandled, rememberHandled, shouldRunDemo } from './demo.js';",
    "import { hiddenTransitions } from './hidden-transitions.js';",
  ]);
  assert.deepEqual(importsOf(read('core/hidden-pictures.js')), []);
  ['core/hidden-transitions.js', 'core/hidden.js', 'core/hidden-pictures.js'].forEach(file => {
    assert.ok(!/\bdocument\b|\bwindow\b/.test(code(read(file))), 'no page in ' + file);
  });
  assert.ok(!/\bimport\(/.test(code(read('core/hidden-transitions.js'))), 'the registry only describes the steps');
});

test('the Studio list of hidden transitions says the same as the dashboard registry', async () => {
  const studio = await import(pathToFileURL(path.join(fileURLToPath(new URL('../studio/', import.meta.url)), 'hidden-transitions.js')).href);
  assert.deepEqual(
    studio.hiddenTransitions,
    hiddenKinds.map(kind => ({ id: kind, name: hiddenRegistry.hiddenTransitions[kind].name, chanceField: hiddenRegistry.hiddenTransitions[kind].chanceField }))
  );
});

// The four pictures (dashboard/core/hidden-pictures.js) and the order they play in

const { hiddenPictures: pictureSets, makePictureChooser, allPictures, pictureAddress, pictureAfter, lastPictureKey } = hiddenPictures;

// The size of a PNG or a WebP from the first bytes of the file
function pictureSize(buffer) {
  if (buffer.toString('latin1', 1, 4) === 'PNG') return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };

  assert.equal(buffer.toString('latin1', 0, 4), 'RIFF');
  assert.equal(buffer.toString('latin1', 8, 12), 'WEBP');
  const kind = buffer.toString('latin1', 12, 16);
  if (kind === 'VP8 ') return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  if (kind === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  assert.equal(kind, 'VP8X');
  return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
}

test('there are two sets of two pictures, and each file is in the assets folder at the size the list says', () => {
  assert.deepEqual(Object.keys(pictureSets), ['redEyes', 'blueScreen']);
  Object.keys(pictureSets).forEach(set => assert.equal(pictureSets[set].length, 2, set));
  assert.equal(allPictures().length, 4);
  assert.deepEqual(allPictures().map(picture => picture.set), ['redEyes', 'redEyes', 'blueScreen', 'blueScreen']);

  allPictures().forEach(picture => {
    const file = path.join(dashboardFolder, pictureAddress(picture));
    assert.ok(fs.existsSync(file), picture.file + ' is not in dashboard/assets/hidden');
    assert.deepEqual(pictureSize(fs.readFileSync(file)), { width: picture.width, height: picture.height }, picture.file + ' is not the size the list says');
    assert.ok(/^#[0-9a-f]{6}$/.test(picture.fill), picture.file + ' needs its own background colour');
    assert.ok(picture.fit === 'cover' || picture.fit === 'contain', picture.file);
  });
  assert.equal(hiddenPictures.pictureFolder, 'assets/hidden/');
});

test('a picture is never stretched: the 16:9 ones cover the screen, and the old low resolution one is shown whole, crisp, on its own blue', () => {
  const byFile = {};
  allPictures().forEach(picture => { byFile[picture.file] = picture; });

  // a cover picture is cut at most a sliver, so it has to be 16:9 to within a percent
  ['red-eyes-1.webp', 'red-eyes-2.webp', 'blue-screen-1.png'].forEach(file => {
    const picture = byFile[file];
    assert.equal(picture.fit, 'cover', file);
    assert.ok(Math.abs(picture.width / picture.height / (16 / 9) - 1) < 0.01, file + ' is not 16:9');
    assert.equal(picture.crisp, false, file);
  });

  const old = byFile['blue-screen-2.png'];
  assert.equal(old.fit, 'contain', 'it is 16:10, so cover would cut off its top and bottom');
  assert.equal(old.crisp, true, 'enlarged without smoothing');
  assert.equal(old.fill, '#0000aa', "the picture's own blue, so the rest of the screen has no black bars");
  assert.equal(byFile['blue-screen-1.png'].fill, '#0177d7');

  // the stylesheet says the same: contain and crisp are the exceptions
  const pictureRule = baseCss.match(/#backdrop \.picture \{[^}]*\}/)[0];
  ['object-fit: cover;', 'width: 1920px;', 'height: 1080px;', 'opacity: 0;'].forEach(line => assert.ok(pictureRule.includes(line), 'the picture rule lacks ' + line));
  assert.ok(/#backdrop \.picture\[data-fit="contain"\] \{ object-fit: contain; \}/.test(baseCss));
  assert.ok(/#backdrop \.picture\[data-crisp="on"\] \{\s*image-rendering: crisp-edges;\s*image-rendering: pixelated;\s*\}/.test(baseCss));
  assert.ok(/#backdrop\[data-look="picture"\] \{ background: var\(--picture-fill, #000\); \}/.test(baseCss));
});

test('every set the transitions name is one that has pictures, and the pictures are preloaded in one list of all four', async () => {
  for (const kind of hiddenKinds) {
    const { scene, steps } = recordingScene();
    await hiddenRegistry.hiddenTransitions[kind].run(scene);
    steps.filter(step => step[0] === 'pictureIn' || step[0] === 'pictureCut').forEach(step => {
      assert.ok(Array.isArray(pictureSets[step[1]]) && pictureSets[step[1]].length > 0, kind + ' names the set ' + step[1]);
    });
  }
  const shows = set => hiddenKinds.filter(kind => hiddenRegistry.hiddenTransitions[kind].run.toString().includes("'" + set + "'"));
  assert.deepEqual(shows('blueScreen'), ['desktop']);
  assert.deepEqual(shows('redEyes'), ['redEyes']);

  assert.deepEqual(allPictures().map(pictureAddress), [
    'assets/hidden/red-eyes-1.webp',
    'assets/hidden/red-eyes-2.webp',
    'assets/hidden/blue-screen-1.png',
    'assets/hidden/blue-screen-2.png',
  ]);
  const run = fs.readFileSync(path.join(dashboardFolder, 'core/hidden-run.js'), 'utf8');
  assert.ok(run.includes('preloadImages(pictures.map(pictureAddress))'), 'all four are preloaded');
  assert.ok(run.indexOf('loadPictures();') !== -1 && run.indexOf('loadPictures();') < run.indexOf('setHiddenOffer(offer);'), 'when the hidden transitions start, before any can play');
});

test('each play of a set shows the picture after the last one, and the first again after the last, and the two sets keep their own place', () => {
  const chooser = makePictureChooser(makeStorage({}));
  const any = () => true;
  const files = (set, plays) => Array.from({ length: plays }, () => chooser.next(set, any).file);

  assert.deepEqual(files('blueScreen', 5), ['blue-screen-1.png', 'blue-screen-2.png', 'blue-screen-1.png', 'blue-screen-2.png', 'blue-screen-1.png']);
  assert.deepEqual(files('redEyes', 4), ['red-eyes-1.webp', 'red-eyes-2.webp', 'red-eyes-1.webp', 'red-eyes-2.webp']);
  assert.equal(chooser.next('blueScreen', any).file, 'blue-screen-2.png', 'the red eyes plays did not move the blue screens on');

  const list = pictureSets.blueScreen;
  assert.equal(pictureAfter(list, 'blue-screen-1.png').file, 'blue-screen-2.png');
  assert.equal(pictureAfter(list, 'blue-screen-2.png').file, 'blue-screen-1.png');
  ['', 'something-else.png', undefined, null].forEach(last => assert.equal(pictureAfter(list, last).file, 'blue-screen-1.png', String(last)));
});

test('the last picture of a set is kept in localStorage, so a Mini that restarts carries on with the other one', () => {
  const store = {};
  const first = makePictureChooser(makeStorage(store));
  assert.equal(first.next('blueScreen', () => true).file, 'blue-screen-1.png');
  assert.deepEqual(store, { 'teletraan-hidden-picture-blueScreen': 'blue-screen-1.png' });
  assert.equal(lastPictureKey, 'teletraan-hidden-picture-');

  // the page is reloaded: a new chooser with the same storage
  const second = makePictureChooser(makeStorage(store));
  assert.equal(second.next('blueScreen', () => true).file, 'blue-screen-2.png');
  assert.equal(second.next('redEyes', () => true).file, 'red-eyes-1.webp', 'the red eyes have their own key');
  assert.deepEqual(store, { 'teletraan-hidden-picture-blueScreen': 'blue-screen-2.png', 'teletraan-hidden-picture-redEyes': 'red-eyes-1.webp' });

  const third = makePictureChooser(makeStorage(store));
  assert.equal(third.next('blueScreen', () => true).file, 'blue-screen-1.png');
  assert.equal(third.next('redEyes', () => true).file, 'red-eyes-2.webp');

  // a name that is not in the list any more, or nothing, starts at the first
  [{ 'teletraan-hidden-picture-blueScreen': 'old-name.png' }, { 'teletraan-hidden-picture-blueScreen': '' }].forEach(saved => {
    assert.equal(makePictureChooser(makeStorage(saved)).next('blueScreen', () => true).file, 'blue-screen-1.png');
  });
});

test('a storage that fails still lets the pictures take turns for as long as the page is open', () => {
  const alternates = storage => {
    const chooser = makePictureChooser(storage);
    return [1, 2, 3, 4].map(() => chooser.next('blueScreen', () => true).file);
  };
  const turns = ['blue-screen-1.png', 'blue-screen-2.png', 'blue-screen-1.png', 'blue-screen-2.png'];

  assert.deepEqual(alternates(brokenStorage), turns, 'storage switched off');
  assert.deepEqual(alternates(null), turns, 'no storage at all');
  assert.deepEqual(alternates(undefined), turns);

  // one that can be read but not written would keep saying the old picture, if the page did not remember its own
  const readOnly = { getItem: () => 'blue-screen-2.png', setItem() { throw new Error('storage is full'); } };
  assert.deepEqual(alternates(readOnly), ['blue-screen-1.png', 'blue-screen-2.png', 'blue-screen-1.png', 'blue-screen-2.png']);
  const writeOnly = { getItem() { throw new Error('no reading'); }, setItem() {} };
  assert.deepEqual(alternates(writeOnly), turns);
});

test('a picture that did not load is skipped, and when none of the set can be shown there is no picture and nothing is remembered', () => {
  const store = {};
  const chooser = makePictureChooser(makeStorage(store));

  // the second blue screen failed: the first plays every time
  const onlyFirst = file => file !== 'blue-screen-2.png';
  assert.deepEqual([1, 2, 3].map(() => chooser.next('blueScreen', onlyFirst).file), ['blue-screen-1.png', 'blue-screen-1.png', 'blue-screen-1.png']);
  // and when it is back, the turns go on from the one shown last
  assert.equal(chooser.next('blueScreen', () => true).file, 'blue-screen-2.png');

  // the one that is next failed, so the one after it is shown
  const redChooser = makePictureChooser(makeStorage({}));
  assert.equal(redChooser.next('redEyes', file => file !== 'red-eyes-1.webp').file, 'red-eyes-2.webp');

  // nothing of the set loaded
  const before = JSON.stringify(store);
  assert.equal(chooser.next('blueScreen', () => false), null);
  assert.equal(JSON.stringify(store), before, 'a play with no picture is not a play');
  assert.equal(chooser.next('noSuchSet', () => true), null);
  assert.equal(chooser.next(undefined, () => true), null);
});

test('preloadImages answers when every picture has loaded or failed, in order, and says which failed', async () => {
  const requested = [];
  globalThis.Image = class {
    set src(address) {
      requested.push(address);
      // a picture that cannot be found fails, the rest load, and either answer comes a moment later
      setTimeout(() => (address.includes('red-eyes-2') ? this.onerror() : this.onload()), 1);
    }
  };

  try {
    const addresses = allPictures().map(pictureAddress);
    const results = await imagesModule.preloadImages(addresses.concat(['']));
    assert.deepEqual(requested, addresses, 'one request for each picture and none for the empty address');
    assert.deepEqual(results.map(result => result.address), addresses);
    assert.deepEqual(results.map(result => result.ok), [true, false, true, true]);
    results.forEach(result => assert.equal(typeof result.image, 'object', 'the element that loaded it'));
    assert.deepEqual(await imagesModule.preloadImages([]), []);
  } finally {
    delete globalThis.Image;
  }
});

test('the runner skips a picture that is not loaded, still waits the step, and puts every picture and layer back when it is done', () => {
  const run = fs.readFileSync(path.join(dashboardFolder, 'core/hidden-run.js'), 'utf8');
  const code = run.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');

  // only a picture that loaded has an element, and only those can be chosen
  assert.ok(code.includes('pictureElements[picture.file] = image;'));
  assert.ok(code.includes('if (!result.ok) {'), 'a failure is skipped, with a note in the console');
  assert.ok(code.includes('chooser.next(set, file => pictureElements[file] !== undefined)'));
  assert.ok(/if \(!picture\) return;/.test(code), 'no picture: the backdrop stays as it is');
  assert.ok(/const pictureElements = \{\};/.test(code));

  // the steps wait their seconds whatever was shown, so the transition keeps its time and rebuild comes
  assert.ok(/async pictureIn\(set, seconds\) \{[^}]*showPicture\(set, 'in'\);\s*await sleep\(seconds\);\s*if \(showing\) showing\.dataset\.state = 'on';/.test(code));
  assert.ok(/async pictureCut\(set, seconds\) \{\s*showPicture\(set, 'on'\);\s*await sleep\(seconds\);\s*\}/.test(code), 'the cut shows the picture in its final state in one go, then holds');
  assert.ok(/async pictureOut\(seconds\) \{[^}]*if \(showing\) showing\.dataset\.state = 'out';\s*await sleep\(seconds\);/.test(code));

  // the backdrop is given the picture's own colour in the same step, so the cut is one frame with no black bars
  const show = code.slice(code.indexOf('function showPicture('), code.indexOf('function makeScene('));
  assert.ok(show.indexOf("setProperty('--picture-fill', picture.fill)") < show.indexOf("backdrop.dataset.look = 'picture'"));
  assert.ok(!/await|setTimeout|requestAnimationFrame|frame\.wait/.test(show), 'nothing waits between the colour and the picture');

  // putBack takes everything away, whatever happened
  const putBack = code.slice(code.indexOf('function putBack('));
  ['delete backdrop.dataset.look;', "backdrop.style.removeProperty('--picture-fill');", 'delete pictureElements[file].dataset.state', 'showing = null;', 'clearGlitch();', 'frame.stopGlitch();'].forEach(line => {
    assert.ok(putBack.includes(line), 'putBack lacks ' + line);
  });
  assert.ok(/function clearGlitch\(\) \{\s*redWash\.hidden = true;\s*blueGlitch\.hidden = true;\s*delete world\.dataset\.tint;\s*\}/.test(code));
});

test('scene.glitch takes a tint: red is the default and plays the old television glitch with the red layer, blue shows the blue layers and does not', () => {
  const run = fs.readFileSync(path.join(dashboardFolder, 'core/hidden-run.js'), 'utf8');
  const start = run.indexOf("async glitch(seconds, tint = 'red') {");
  assert.ok(start !== -1, "glitch(seconds, tint = 'red')");
  const glitch = run.slice(start, run.indexOf('// The blocks fly apart', start));

  assert.ok(glitch.includes("const blue = tint === 'blue';"), 'anything but blue is red');
  assert.ok(glitch.includes("world.dataset.tint = blue ? 'blue' : 'red';"));
  assert.ok(glitch.includes('(blue ? blueGlitch : redWash).hidden = false;'));
  assert.ok(glitch.includes('if (!blue) frame.playGlitch(seconds);'), 'only the red glitch is the old television one');
  assert.equal((glitch.match(/frame\.playGlitch/g) || []).length, 1);
  assert.ok(glitch.includes("if (!world.dataset.hidden) world.dataset.hidden = 'glitch';"), 'a glitch while the screen is apart does not bring the blocks back');
  assert.ok(glitch.includes("if (world.dataset.hidden === 'apart') clearGlitch();"), 'and takes its own layers away, as no break follows it');
  assert.ok(glitch.indexOf("world.dataset.tint = ") < glitch.indexOf('await sleep(seconds);'));

  // the break takes the glitch layers away when the blocks are apart, as it took the red wash
  const breakApart = run.slice(run.indexOf('async breakApart(look) {'), run.indexOf('wait: seconds'));
  assert.ok(breakApart.indexOf("world.dataset.hidden = 'apart';") < breakApart.indexOf('clearGlitch();'));
  assert.ok(breakApart.indexOf('clearGlitch();') < breakApart.indexOf('swapPage();'));
});

test('the desktop reveal breaks apart over a deep blue and red eyes over black, and nothing of the drawn wallpaper or face is left', async () => {
  assert.ok(/#backdrop \{ background: #000; \}/.test(baseCss));
  assert.ok(/#backdrop\[data-look="blue"\] \{ background: var\(--hidden-blue-deep\); \}/.test(baseCss));
  assert.ok(/--hidden-blue-deep: #[0-9a-f]{6};/.test(tokensCss));
  const lookOf = async kind => {
    const { scene, steps } = recordingScene();
    await hiddenRegistry.hiddenTransitions[kind].run(scene);
    return steps.find(step => step[0] === 'breakApart')[1];
  };
  assert.equal(await lookOf('desktop'), 'blue');
  assert.equal(await lookOf('redEyes'), 'black');

  const everything = ['dashboard/base.css', 'dashboard/frame.css', 'dashboard/tokens.css', 'dashboard/index.html', 'dashboard/core/hidden-run.js', 'dashboard/core/hidden-transitions.js', 'dashboard/core/hidden-pictures.js'].map(file => fs.readFileSync(fileURLToPath(new URL('../' + file, import.meta.url)), 'utf8')).join('\n');
  ['wallpaper', 'redEyesMarkup', 'wallpaperMarkup', 'backdropMarkup', 'face-plates', 'face-eyes', '--face-', '--eye-', 'eyes-on', 'hidden-art'].forEach(word => {
    assert.ok(!everything.includes(word), 'what is left of ' + word);
  });
  assert.ok(!fs.existsSync(path.join(dashboardFolder, 'core/hidden-art.js')), 'the drawing file is gone');
});

test('the repository never names the character the red eyes look like', () => {
  // written in pieces so that this file does not contain the name it looks for
  const banned = new RegExp(['mega', 'tron'].join(''), 'i');
  const here = relative => fileURLToPath(new URL('../' + relative, import.meta.url));
  const found = [];

  function walk(folder) {
    fs.readdirSync(folder, { withFileTypes: true }).forEach(entry => {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) return;

      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) return walk(full);
      if (!/\.(js|mjs|css|html|md|json|svg|csv|ndjson|sh)$/.test(entry.name)) return;
      if (banned.test(entry.name) || banned.test(fs.readFileSync(full, 'utf8'))) found.push(full);
    });
  }

  ['dashboard/', 'studio/', 'docs/', 'tools/'].forEach(folder => walk(here(folder)));
  assert.deepEqual(found, []);
});

// frame.js: the effects hold still while a hidden transition has the screen

test('while a hidden transition has the screen no effect starts and none waits, and the effects that were due play one at a time once it is over', async () => {
  await inPage(async world => {
    world.frame.setNameEffect(false, 300, 1.43);
    world.frame.setCrt(true, 30, 2.7);

    world.frame.setHiddenPlaying(true);
    await world.advance(100 * second);
    assert.deepEqual(world.log, [], 'the glitch has been due since 30 seconds');

    world.frame.playCrt(); // asked for by hand, which also waits
    await world.advance(10 * second);
    assert.deepEqual(world.log, []);

    world.frame.setHiddenPlaying(false);
    await world.advance(second);
    assert.equal(world.starts('glitch').length, 1, 'one late play, not a burst');
  });
});

test('a glitch that is playing when a hidden transition starts is ended at once, and its clock running out does not cut the red glitches', async () => {
  await inPage(async world => {
    world.frame.setNameEffect(false, 300, 1.43);
    world.frame.setCrt(true, 30, 2.7);

    await world.advance(30500); // the scheduled glitch started at 30 seconds and plays until 32.7
    assert.deepEqual(world.starts('glitch'), [30000]);

    world.frame.setHiddenPlaying(true);
    assert.deepEqual(world.ends('glitch'), [30500], 'ended on the spot');

    await world.advance(500);
    world.frame.playGlitch(3); // the red glitches, here 3 seconds long
    assert.deepEqual(world.starts('glitch'), [30000, 31000]);
    await world.advance(1700); // the scheduled glitch's own clock ran out at 32.7 seconds
    assert.deepEqual(world.ends('glitch'), [30500], 'the red glitches are still going');
    await world.advance(1500);
    assert.deepEqual(world.ends('glitch'), [30500, 34000], 'and end after their own 3 seconds');
    assert.equal(world.pageStyle.values['--crt-scale'], String(Math.round(3 / 2.7 * 1000) / 1000));
  });
});

test('a hidden transition ends a logo effect that is playing, and frame.js says what motion it has', async () => {
  await inPage(async world => {
    world.frame.setLogoAnimations(true, false);
    world.frame.setSpin(true, 10, 1.6);
    world.frame.setHawk(false, 0, 11);
    world.frame.setNameEffect(false, 300, 1.43);
    world.frame.setCrt(false, 240, 2.7);
    world.frame.startLogo(world.logo);

    await world.advance(11 * second);
    assert.equal(world.starts('spin').length >= 1, true);
    world.frame.setHiddenPlaying(true);
    assert.equal(world.logo.dataset.act, 'rest', 'back to the still emblem');

    assert.equal(world.frame.motionNow(), 'full');
    world.frame.setMotion('calm');
    assert.equal(world.frame.motionNow(), 'calm');
  });
});

// The stylesheet

test('the blocks of the hidden transitions: five regions are marked, each has a pose with all seven numbers, and no turn is past 90 degrees', () => {
  const indexHtml = fs.readFileSync(path.join(dashboardFolder, 'index.html'), 'utf8');
  const marked = (indexHtml.match(/<div id="(region-[a-z0-9]+)" data-block><\/div>/g) || []).map(text => text.match(/id="([^"]+)"/)[1]);
  assert.deepEqual(marked, ['region-banner', 'region-grid1', 'region-countdown', 'region-grid2', 'region-ticker']);

  marked.forEach(id => {
    const line = frameCss.split('\n').find(text => text.startsWith('#' + id + ' '));
    assert.ok(line, id + ' has no line in the table');
    ['--tx', '--ty', '--tz', '--rx', '--ry', '--rz', '--hold'].forEach(name => assert.ok(line.includes(name + ':'), id + ' lacks ' + name));
    (line.match(/--r[xyz]: -?\d+deg/g) || []).forEach(turn => assert.ok(Math.abs(parseInt(turn.split(': ')[1], 10)) < 90, id + ' turns past 90 degrees: ' + turn));
    assert.ok(Number(line.match(/--hold: ([0-9.]+)/)[1]) <= 0.3, id + ' starts too late');
    assert.ok(Number(line.match(/--tz: (-?\d+)px/)[1]) < 0, id + ' flies away from the viewer');
  });
});

test('the hidden transition times: the blocks are apart after .9 of the break time and back after .9, as hidden-run.js waits, and the number is one number', () => {
  const run = fs.readFileSync(path.join(dashboardFolder, 'core/hidden-run.js'), 'utf8');
  const fly = Number(run.match(/const flySeconds = ([0-9.]+);/)[1]);
  assert.equal(fly, 1.6);
  assert.ok(tokensCss.includes('--hidden-seconds: ' + fly + ';'), 'tokens.css starts with the same number');
  assert.ok(tokensCss.includes('--time-hidden: calc(var(--hidden-seconds) * 1s * var(--pace));'));
  assert.ok(run.includes("document.documentElement.style.setProperty('--hidden-seconds', String(flySeconds));"), 'set on the html element, where --time-hidden is worked out');

  const apartAfter = Number(run.match(/const apartAfter = ([0-9.]+);/)[1]);
  const togetherAfter = Number(run.match(/const togetherAfter = ([0-9.]+);/)[1]);
  const breakRule = frameCss.match(/#world\[data-hidden="break"\] \[data-block\] \{\s*animation: piece-break calc\(var\(--time-hidden\) \* ([0-9.]+)\) linear calc\(var\(--time-hidden\) \* var\(--hold\)\) both;/);
  const buildRule = frameCss.match(/#world\[data-hidden="build"\] \[data-block\] \{\s*animation: piece-build calc\(var\(--time-hidden\) \* ([0-9.]+)\) linear calc\(var\(--time-hidden\) \* var\(--hold\) \* ([0-9.]+)\) both;/);
  assert.ok(breakRule && buildRule, 'the break and the build rules');
  const latest = Math.max(...frameCss.split('\n').filter(line => /^#region-[a-z0-9]+ +\{/.test(line)).map(line => Number(line.match(/--hold: ([0-9.]+)/)[1])));
  assert.equal(latest, 0.3);

  assert.ok(Math.abs(Number(breakRule[1]) + latest - apartAfter) < 1e-9, 'the last block is apart after ' + apartAfter);
  assert.ok(Number(buildRule[1]) + latest * Number(buildRule[2]) <= togetherAfter, 'the last block is back by ' + togetherAfter);
  const fade = frameCss.match(/#world\[data-hidden="build"\] #backdrop \{\s*animation: fade-out calc\(var\(--time-hidden\) \* ([0-9.]+)\) linear calc\(var\(--time-hidden\) \* ([0-9.]+)\) both;/);
  assert.ok(fade && Math.abs(Number(fade[1]) + Number(fade[2]) - togetherAfter) < 1e-9, 'the backdrop is gone at the end of the build');
});

test('every time in the hidden transitions comes from --time-hidden, --glitch-seconds or --look-seconds, times --pace', () => {
  const start = frameCss.indexOf('/* Hidden transitions.');
  const end = frameCss.indexOf('/* Night mode, the screensaver.');
  assert.ok(start !== -1 && end > start);
  const section = frameCss.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '');

  const timings = section.split('\n').filter(line => /animation: /.test(line));
  assert.equal(timings.length, 15, 'the break, the build, the backdrop twice, the red wash twice, the picture in and out, the three blue washes, the torn pieces, the blue layer fading, the stage and the blocks');
  timings.forEach(line => {
    assert.ok(/var\(--(time-hidden|glitch-seconds|look-seconds)\)/.test(line), line);
    if (/--(glitch|look)-seconds/.test(line)) assert.ok(line.includes('var(--pace)'), 'the Speed setting stretches it: ' + line);
    let bare = line;
    while (/\([^()]*\)/.test(bare)) bare = bare.replace(/\([^()]*\)/g, ''); // every bracket and what is in it, innermost first
    assert.ok(!/[^a-z-]\d+(\.\d+)?m?s\b/.test(bare), 'a plain time in ' + line);
  });

  // the delays of the torn pieces are a share of the glitch, stretched by the Speed setting like the rest
  const delays = section.split('\n').filter(line => /animation-delay: /.test(line));
  assert.equal(delays.length, 2);
  delays.forEach(line => assert.ok(line.includes('var(--glitch-seconds)') && line.includes('var(--pace)'), line));
});

test('the hidden transitions move only transform and opacity: their keyframes, their layers and what is promoted', () => {
  const css = frameCss.replace(/\/\*[\s\S]*?\*\//g, '');
  // the red wash and the three blue washes change opacity and nothing else, the stage and the blocks only transform,
  // and the torn pieces both
  const onlyChanges = {
    'wash-flicker': ['opacity'],
    'blue-wash-old': ['opacity'],
    'blue-wash-new': ['opacity'],
    'blue-wash-pale': ['opacity'],
    'tear-a': ['opacity', 'transform'],
    'tear-b': ['opacity', 'transform'],
    'tear-c': ['opacity', 'transform'],
    'blue-jump': ['transform'],
    'blue-tear-a': ['transform'],
    'blue-tear-b': ['transform'],
  };
  Object.keys(onlyChanges).forEach(name => {
    const startAt = css.indexOf('@keyframes ' + name + ' {');
    assert.ok(startAt !== -1, name);
    const body = css.slice(startAt, css.indexOf('\n}', startAt));
    const properties = (body.match(/[a-z-]+(?=:)/g) || []);
    assert.ok(properties.length > 0, name);
    properties.forEach(word => assert.ok(onlyChanges[name].includes(word), name + ' changes ' + word));
  });
  // nothing in the hidden transitions blurs, glows, shades or filters, or blends one layer into another
  const section = frameCss.slice(frameCss.indexOf('/* Hidden transitions.'), frameCss.indexOf('/* Night mode, the screensaver.')).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(section.includes('@keyframes blue-tear-b'), 'the whole section is looked at');
  assert.ok(!/(filter|box-shadow|text-shadow|drop-shadow|blur\(|blend)/.test(section), 'a filter, blend, shadow or blur');

  // the layers are promoted only while the blocks fly (break and build)
  const promoted = css.match(/[^{}]*\{[^{}]*will-change: transform, opacity;[^{}]*\}/g) || [];
  const mine = promoted.filter(block => /data-hidden/.test(block));
  assert.equal(mine.length, 1);
  assert.ok(/data-hidden="break"\] \[data-block\]/.test(mine[0]) && /data-hidden="build"\] \[data-block\]/.test(mine[0]));
  assert.ok(!/data-hidden="apart"[^{]*\{[^}]*will-change/.test(css), 'nothing is promoted while the blocks are out of sight');
  assert.ok(/data-hidden="apart"\] \[data-block\] \{\s*visibility: hidden;/.test(css));

  // the perspective and the 3D pass-through are only there while they fly, in full motion
  const lens = css.match(/[^{}]*\{[^{}]*perspective: 1800px;[^{}]*\}/g).filter(block => /data-hidden/.test(block));
  assert.equal(lens.length, 1);
  assert.ok(/data-motion="full"\] #world\[data-hidden="break"\] #stage/.test(lens[0]) && /data-hidden="build"\] #stage/.test(lens[0]));
  assert.equal((css.match(/transform-style: preserve-3d/g) || []).length, 1);

  // nothing of the hidden transitions is written for calm or none motion
  css.split('\n').filter(line => /data-hidden/.test(line)).forEach(line => assert.ok(!/data-motion="(calm|none)"/.test(line), line));
  // the blocks use the keyframes of the mechanical change, so the overshoot and settle are the same
  assert.ok(/#world\[data-hidden="break"\] \[data-block\] \{\s*animation: piece-break /.test(css));
  assert.ok(/#world\[data-hidden="build"\] \[data-block\] \{\s*animation: piece-build /.test(css));
});

test('the red wash never flashes more than twice in any second, never brighter than .45, and ends at .3 where the break takes over', () => {
  const css = frameCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const startAt = css.indexOf('@keyframes wash-flicker {');
  const body = css.slice(startAt, css.indexOf('\n}', startAt));
  const steps = (body.match(/\d+%\s*\{\s*opacity: [0-9.]+;/g) || []).map(text => ({ at: Number(text.match(/(\d+)%/)[1]) / 100, opacity: Number(text.match(/opacity: ([0-9.]+)/)[1]) }));
  assert.ok(steps.length >= 6);
  assert.equal(steps[0].opacity, 0);
  assert.equal(steps[steps.length - 1].opacity, 0.3);
  steps.forEach(step => assert.ok(step.opacity <= 0.45, 'too bright at ' + step.at));

  // a flash is a jump up of .2 or more. Count the most in any one second of the 1.5 s the red eyes use.
  const glitchSeconds = 1.5;
  assert.ok(fs.readFileSync(path.join(dashboardFolder, 'core/hidden-transitions.js'), 'utf8').includes('scene.glitch(1.5)'));
  const flashTimes = [];
  steps.forEach((step, index) => { if (index > 0 && step.opacity - steps[index - 1].opacity >= 0.2) flashTimes.push(step.at * glitchSeconds); });
  assert.ok(flashTimes.length >= 2);
  flashTimes.forEach(time => {
    const inThatSecond = flashTimes.filter(other => other >= time && other < time + 1).length;
    assert.ok(inThatSecond <= 2, inThatSecond + ' flashes in the second from ' + time);
  });
});

// The steps of a keyframes block: [{ at, ... }] with at from 0 to 1, and the text inside each step
function keyframeSteps(css, name) {
  const startAt = css.indexOf('@keyframes ' + name + ' {');
  assert.ok(startAt !== -1, name);
  const body = css.slice(startAt, css.indexOf('\n}', startAt));
  return (body.match(/\d+%\s*\{[^}]*\}/g) || []).map(step => ({ at: Number(step.match(/(\d+)%/)[1]) / 100, text: step }));
}

test('the blue glitch is rough and uneven, but never has more than three big flashes, and the washes are three different blues', () => {
  const css = frameCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const washes = ['blue-wash-old', 'blue-wash-new', 'blue-wash-pale'].map(name => keyframeSteps(css, name).map(step => ({ at: step.at, opacity: Number(step.text.match(/opacity: ([0-9.]+)/)[1]) })));
  const opacityAt = (wash, time) => wash.filter(step => step.at <= time).pop().opacity;

  // each wash starts clear, and the old blue ends at .3 for the break to take over, like the red wash
  washes.forEach(wash => { assert.equal(wash[0].opacity, 0); assert.equal(wash[0].at, 0); assert.equal(wash[wash.length - 1].at, 1); });
  assert.equal(washes[0][washes[0].length - 1].opacity, 0.3);
  assert.equal(washes[1][washes[1].length - 1].opacity, 0);
  assert.equal(washes[2][washes[2].length - 1].opacity, 0);
  assert.ok(Math.max(...washes[2].map(step => step.opacity)) <= 0.2, 'the palest blue is never more than a fifth opaque');

  // how much of the screen is blue at each moment, with the layers over each other
  const times = Array.from(new Set([].concat(...washes.map(wash => wash.map(step => step.at))))).sort((a, b) => a - b);
  const covered = times.map(time => 1 - washes.reduce((left, wash) => left * (1 - opacityAt(wash, time)), 1));

  // a big flash is a jump of .4 or more. The glitch has a few in all, so no second can have more than three, however long it is
  const bigJumps = covered.filter((cover, index) => index > 0 && cover - covered[index - 1] >= 0.4).length;
  assert.ok(bigJumps >= 2 && bigJumps <= 3, bigJumps + ' big flashes');
  // and there are moments when the screen is almost solid blue
  const solid = covered.filter((cover, index) => cover >= 0.85 && (index === 0 || covered[index - 1] < 0.85)).length;
  assert.ok(solid >= 2 && solid <= 3, solid + ' almost solid moments');
  assert.ok(Math.max(...covered) <= 0.97, 'never quite solid');
  // the strengths are many: at least eight different amounts
  assert.ok(new Set(covered.map(cover => Math.round(cover * 20))).size >= 8, 'several strengths of blue');

  // the glitch is not a regular beat: the gaps between the moments of change are of many lengths
  const gaps = new Set(times.slice(1).map((time, index) => Math.round((time - times[index]) * 100)));
  assert.ok(gaps.size >= 4, 'the rhythm is irregular');

  // every blue is a token of its own
  ['old', 'new', 'pale'].forEach(name => assert.ok(new RegExp('--hidden-blue-' + name + ': #[0-9a-f]{6};').test(tokensCss), name));
  const tokenOf = name => tokensCss.match(new RegExp('--hidden-blue-' + name + ': (#[0-9a-f]{6});'))[1];
  assert.equal(new Set(['old', 'new', 'pale', 'deep', 'ink'].map(tokenOf)).size, 5, 'five different blues');
  assert.equal(tokenOf('old'), '#0000aa', 'the blue of the old blue screen');
  assert.equal(tokenOf('new'), '#0177d7', 'the blue of the new blue screen');
});

test('the blue glitch jumps the stage, each block and six torn pieces in steps, only while it glitches, and the break makes it rest', () => {
  const css = frameCss.replace(/\/\*[\s\S]*?\*\//g, '');

  // everything that moves is a jump and not a slide
  const blueRules = css.split('\n').filter(line => /(blue-jump|blue-tear-a|blue-wash-|animation: tear-a)/.test(line) && /animation: /.test(line));
  assert.equal(blueRules.length, 6);
  blueRules.forEach(line => assert.ok(line.includes('steps(1)'), line));

  // the stage jumps by up to 100 pixels sideways, the blocks by up to 200, and the blocks are sheared at times
  const jumps = keyframeSteps(css, 'blue-jump').map(step => step.text);
  const reach = texts => Math.max(...texts.map(text => Math.max(...(text.match(/translate(?:X)?\((-?\d+)/g) || ['translate(0']).map(part => Math.abs(Number(part.match(/-?\d+/)[0]))))));
  assert.ok(reach(jumps) >= 60 && reach(jumps) <= 100, 'the stage jumps ' + reach(jumps));
  const tearA = keyframeSteps(css, 'blue-tear-a').map(step => step.text);
  const tearB = keyframeSteps(css, 'blue-tear-b').map(step => step.text);
  assert.ok(reach(tearA) >= 100 && reach(tearA) <= 200 && reach(tearB) >= 100 && reach(tearB) <= 220);
  assert.ok(tearA.some(text => text.includes('skewX(')) && tearB.some(text => text.includes('skewX(')), 'sheared');
  // both ends are at rest, so the stage and the blocks are where they belong when the glitch ends
  [jumps, tearA, tearB].forEach(list => {
    assert.ok(/translate(X)?\(0(px)?(, 0(px)?)?\)/.test(list[0]) && /translate(X)?\(0(px)?(, 0(px)?)?\)/.test(list[list.length - 1]));
  });

  // the three sets of times for the torn pieces are different from each other, and each piece starts clear
  const tears = ['tear-a', 'tear-b', 'tear-c'].map(name => keyframeSteps(css, name));
  tears.forEach(list => {
    assert.ok(list.length >= 15);
    assert.ok(/opacity: 0;/.test(list[0].text) && /opacity: 0;/.test(list[list.length - 1].text), 'invisible at both ends');
    assert.ok(list.some(step => /scaleY\(/.test(step.text)), 'thick and thin for a moment');
  });
  assert.notEqual(tears[0].map(step => step.at).join(), tears[1].map(step => step.at).join());
  assert.notEqual(tears[1].map(step => step.at).join(), tears[2].map(step => step.at).join());
  // the pale blue pieces are thin and the rest can be thick
  ['tear-2', 'tear-6'].forEach(name => assert.ok(Number(baseCss.match(new RegExp('#blue-glitch \\.' + name + ' \\{[^}]*height: (\\d+)px')) [1]) <= 30, name + ' is a thin line'));

  // the stage and the blocks only move while the live screen glitches blue, and every rule needs full motion
  const glitching = css.split('\n').filter(line => /data-hidden="glitch"\]\[data-tint="blue"\]/.test(line));
  assert.ok(glitching.length >= 4);
  css.split('\n').filter(line => /data-tint="blue"/.test(line)).forEach(line => assert.ok(line.includes('[data-motion="full"]'), line));
  assert.ok(!/data-hidden="apart"\]\[data-tint="blue"\] (#stage|\[data-block\])/.test(css), 'while the blocks are apart there is nothing to move');

  // the break: the layer rests where the old blue ended and fades out, and nothing keeps flickering
  assert.ok(/#world\[data-hidden="break"\]\[data-tint="blue"\] #blue-glitch \{\s*animation: fade-out calc\(var\(--time-hidden\) \* \.5\) linear both;/.test(css));
  assert.ok(/#blue-glitch \.wash-old \{\s*animation-name: none;\s*opacity: \.3;/.test(css));
  assert.ok(/#blue-glitch \.wash-new,[^{]*#blue-glitch \.wash-pale,[^{]*#blue-glitch \.tear \{\s*animation-name: none;/.test(css));
  // the red wash is as it was: only while the live screen glitches, and resting at .3 for the break
  assert.ok(/#world\[data-hidden="glitch"\] #red-wash \{\s*animation: wash-flicker calc\(var\(--glitch-seconds\) \* 1s \* var\(--pace\)\) steps\(1\) both;/.test(css));
  assert.ok(/#world\[data-hidden="break"\] #red-wash \{\s*opacity: \.3;/.test(css));
});

test('the pictures show with data-state: in fades, on is there at once with no animation, out fades away', () => {
  const css = frameCss.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(/#backdrop \.picture\[data-state="in"\] \{\s*opacity: 1;\s*animation: fade-in calc\(var\(--look-seconds\) \* 1s \* var\(--pace\)\) linear both;\s*\}/.test(css));
  assert.ok(/#backdrop \.picture\[data-state="on"\] \{ opacity: 1; \}/.test(css), 'the cut: opacity 1 and nothing else');
  assert.ok(/#backdrop \.picture\[data-state="out"\] \{\s*opacity: 1;\s*animation: fade-out calc\(var\(--look-seconds\) \* 1s \* var\(--pace\)\) linear both;\s*\}/.test(css));
  assert.ok(/#backdrop \.picture \{[^}]*opacity: 0;/.test(baseCss), 'a picture with no state is invisible');
});

test('the backdrop and the wash are in index.html in the right order, hidden, and the stage is positioned so they stack by that order', () => {
  const indexHtml = fs.readFileSync(path.join(dashboardFolder, 'index.html'), 'utf8');
  const at = text => indexHtml.indexOf(text);
  assert.ok(at('<div id="world">') !== -1);
  assert.ok(at('<div id="backdrop" hidden></div>') > at('<div id="world">'));
  assert.ok(at('<div id="backdrop" hidden></div>') < at('<div id="stage">'), 'under the stage');
  assert.ok(at('<div id="red-wash" hidden></div>') > at('<div id="region-ticker" data-block></div>'));
  assert.ok(at('<div id="red-wash" hidden></div>') < at('<div id="connection-status" hidden>'), 'over the stage, under the connection text, the night screen and the overlay');
  assert.ok(/#stage \{ position: relative; \}/.test(baseCss));

  // both layers are the size of the screen and let every click and cursor through
  const block = baseCss.match(/#backdrop,\s*#red-wash,\s*#blue-glitch \{[^}]*\}/)[0];
  assert.ok(block.includes('width: 1920px;') && block.includes('height: 1080px;') && block.includes('pointer-events: none;'));
  const colours = tokensCss.match(/--hidden-(red|blue-[a-z]+): #[0-9a-f]{6};/g) || [];
  assert.equal(colours.length, 6, 'the red and the five blues are tokens');
  assert.ok(!/(filter|box-shadow|text-shadow|blur\(|blend)/.test(baseCss.slice(baseCss.indexOf('#backdrop,'), baseCss.indexOf('Full screen panels'))), 'no blur, glow, shadow or blend');

  // the blue glitch layer is over the stage like the red wash, under the connection text, hidden, with three washes and six pieces
  assert.ok(at('<div id="blue-glitch" hidden>') > at('<div id="red-wash" hidden></div>'));
  assert.ok(at('<div id="blue-glitch" hidden>') < at('<div id="connection-status" hidden>'));
  const layer = indexHtml.slice(at('<div id="blue-glitch" hidden>'), at('<div id="connection-status" hidden>'));
  assert.deepEqual(layer.match(/<div class="wash wash-[a-z]+"><\/div>/g).map(text => text.match(/wash-([a-z]+)/)[1]), ['old', 'new', 'pale']);
  assert.equal((layer.match(/<div class="tear tear-\d"><\/div>/g) || []).length, 6);
  ['old', 'new', 'pale'].forEach(name => assert.ok(baseCss.includes('#blue-glitch .wash-' + name + ' { background: var(--hidden-blue-'), 'the ' + name + ' wash has a blue'));
  for (let number = 1; number <= 6; number++) assert.ok(new RegExp('#blue-glitch \\.tear-' + number + ' \\{[^}]*top: \\d+px;[^}]*height: \\d+px;[^}]*background: var\\(--hidden-blue-').test(baseCss), 'torn piece ' + number);
});

test('the shell starts the hidden transitions after the demo runner, with the address switch, and only when the whole screen runs', () => {
  const shell = fs.readFileSync(path.join(dashboardFolder, 'shell.js'), 'utf8');
  const demoRunner = shell.indexOf("startOptional('./core/demo-runner.js'");
  const hiddenRunner = shell.indexOf("startOptional('./core/hidden-run.js', module => module.startHidden(getContent, params.get('hidden')))");
  assert.ok(demoRunner !== -1 && hiddenRunner > demoRunner);
  assert.ok(shell.indexOf('startTakeovers(getContent);') < hiddenRunner);
  assert.ok(shell.lastIndexOf("if (!params.get('show') && !stress) {", hiddenRunner) > shell.lastIndexOf('startNight', hiddenRunner) - 2000);
  assert.ok(/\/\/   hidden=desktop\|redEyes\|off /.test(shell), 'the switch is in the list at the top');
});

test('the large panel asks for a hidden transition before its page change, and the other areas wait at a gate while one plays', () => {
  const areas = fs.readFileSync(path.join(dashboardFolder, 'core/areas.js'), 'utf8');
  assert.ok(areas.includes("const hiddenRegion = 'grid1';"));
  const offer = areas.indexOf('const offered = hiddenOffer();');
  const normal = areas.indexOf('await frame.leave(area, change);');
  assert.ok(offer !== -1 && normal > offer, 'asked first, and the usual change follows if it is not played');
  assert.ok(areas.indexOf('if (gate) {') < offer, 'a region that is not the large panel waits at the gate before anything');
  assert.ok(areas.includes("made.dataset.state = 'shown';"), 'a page swapped while apart is at rest and starts no first assembly');
  assert.ok(/swapUnseen\(region, next\);\s*\n\s*\}\);/.test(areas), 'the large panel swaps its own page when the transition says it is apart');

  const schedule = fs.readFileSync(path.join(dashboardFolder, 'core/schedule.js'), 'utf8');
  assert.ok(/export function moveOn\(regions\)/.test(schedule) && /export function secondsUntilChange\(region\)/.test(schedule));
  ['const since = changeCount(region);', "const since = changeCount('ticker');", 'const since = changeCount(null);'].forEach(call => assert.ok(schedule.includes(call), call));
  assert.ok(!/\bpagesRefreshed === since\b/.test(schedule), 'the hold compares both counts');
  ["since, region);", "since, 'ticker');", 'since, null);'].forEach(call => assert.ok(schedule.includes(call), call));
});

// Play announcements (dashboard/core/announce.js): the Studio's button that plays every
// announcement that is switched on, now, once

const { tidyAnnounceRequest, enabledAnnouncements, playEach, makeAnnounceRunner, readHandledAnnounce, rememberHandledAnnounce } = announce;

// An announcement as Dashboard Settings holds it. The time and the days are what the screen
// ignores when it plays them on request.
const announcementAt = (title, overrides) => Object.assign({
  show: true, time: '14:30', title: title, followUp: '', titleSeconds: 12, followUpSeconds: 10, days: [0, 1, 2, 3, 4, 5, 6],
}, overrides);

// A fake screen for the runner, with a clock the test moves. An announcement takes its two
// lines' seconds, in steps of a quarter second, and ends early when it is told to stop. Each new
// second it looks, as the one clock of the screen does, and things the test planned for a time
// (at) happen when that time comes.
function announceWorld(options) {
  const settings = options || {};
  const world = {
    start: demoNow.getTime(),
    nowMs: demoNow.getTime(),
    content: { settings: { announceRequest: { requestedAt: '' }, announcements: [] } },
    log: [],
    played: [],
    alerts: 0,
    takeover: false,
    demo: false,
    night: false,
    hidden: false,
    store: settings.store || {},
    planned: [],
  };

  async function tick(milliseconds) {
    const secondBefore = Math.floor(world.nowMs / 1000);
    world.nowMs += milliseconds;
    world.planned.filter(item => !item.done && item.at <= world.nowMs).forEach(item => {
      item.done = true;
      item.run();
    });
    if (Math.floor(world.nowMs / 1000) !== secondBefore) world.runner.look(new Date(world.nowMs));
  }

  world.runner = makeAnnounceRunner({
    getContent: () => world.content,
    storage: settings.storage === undefined ? makeStorage(world.store) : settings.storage,
    pauseRotation: () => world.log.push('rotation paused'),
    resumeRotation: () => world.log.push('rotation resumed'),
    takeoverRunning: () => world.takeover,
    demoRunning: () => world.demo,
    nightIsUp: () => world.night,
    hiddenPlaying: () => world.hidden,
    alertsStarted: () => world.alerts,
    async playAnnouncement(config, shouldStop) {
      world.played.push(config);
      world.log.push('play ' + config.title + ' ' + (config.titleSeconds + config.followUpSeconds));
      if (config.title === 'BROKEN') throw new Error('this announcement fails');

      let left = (config.titleSeconds + config.followUpSeconds) * 1000;
      while (left > 0 && !shouldStop()) {
        await tick(250);
        left -= 250;
      }
      world.log.push((shouldStop() ? 'stopped ' : 'done ') + config.title);
    },
  });

  world.look = () => world.runner.look(new Date(world.nowMs));
  world.requestedSecondsAgo = seconds => { world.content.settings.announceRequest = { requestedAt: new Date(world.nowMs - seconds * 1000).toISOString() }; };
  world.requestedSecondsAhead = seconds => { world.content.settings.announceRequest = { requestedAt: new Date(world.nowMs + seconds * 1000).toISOString() }; };
  world.announcements = list => { world.content.settings.announcements = list; };
  world.at = (seconds, run) => world.planned.push({ at: world.start + seconds * 1000, run: run, done: false });
  world.elapsed = () => (world.nowMs - world.start) / 1000;
  return world;
}

// Looks once and waits for whatever started to be over
async function lookAndFinish(world) {
  world.look();
  await world.runner.whenIdle();
}

test('a request plays every announcement that is switched on, once, in order, each at its own length, with the rotation paused from start to end', async () => {
  const world = announceWorld();
  world.announcements([announcementAt('ONE', { followUp: 'SECOND LINE' }), announcementAt('TWO', { titleSeconds: 5, followUpSeconds: 3 })]);
  world.requestedSecondsAgo(2);

  world.look();
  assert.equal(world.runner.isRunning(), true);
  await world.runner.whenIdle();

  assert.deepEqual(world.log, ['rotation paused', 'play ONE 22', 'done ONE', 'play TWO 8', 'done TWO', 'rotation resumed']);
  assert.equal(world.elapsed(), 30, 'twenty-two seconds and then eight');
  assert.equal(world.runner.isRunning(), false);
  assert.deepEqual(world.played, [
    { title: 'ONE', followUp: 'SECOND LINE', titleSeconds: 12, followUpSeconds: 10 },
    { title: 'TWO', followUp: '', titleSeconds: 5, followUpSeconds: 3 },
  ]);
});

test('only the announcements that are switched on play, and a switch that is missing means on', async () => {
  const world = announceWorld();
  world.announcements([
    announcementAt('SHOWN'),
    announcementAt('OFF', { show: false }),
    announcementAt('NO SWITCH', { show: undefined }),
    announcementAt('ALSO OFF', { show: false }),
  ]);
  world.requestedSecondsAgo(1);

  await lookAndFinish(world);
  assert.deepEqual(world.played.map(config => config.title), ['SHOWN', 'NO SWITCH']);
  assert.deepEqual(enabledAnnouncements(world.content.settings).map(config => config.title), ['SHOWN', 'NO SWITCH']);

  const allOff = announceWorld();
  allOff.announcements([announcementAt('OFF', { show: false })]);
  allOff.requestedSecondsAgo(1);
  await lookAndFinish(allOff);
  assert.deepEqual(allOff.log, []);
});

test('the time and the days of an announcement are ignored: it plays whatever the clock says and even when no day is ticked', async () => {
  const world = announceWorld(); // 12:00 UTC on a Monday
  world.announcements([
    announcementAt('NOT TODAY', { time: '03:00', days: [0, 6] }),
    announcementAt('NO DAYS', { time: '12:00', days: [] }),
    announcementAt('NO TIME', { time: undefined, days: undefined }),
  ]);
  world.requestedSecondsAgo(1);

  await lookAndFinish(world);
  assert.deepEqual(world.played.map(config => config.title), ['NOT TODAY', 'NO DAYS', 'NO TIME']);

  // what is handed to the screen is the words and the seconds, and nothing about when
  world.played.forEach(config => assert.deepEqual(Object.keys(config).sort(), ['followUp', 'followUpSeconds', 'title', 'titleSeconds']));
});

test('a request plays while it is a minute old at most, and an older one never plays', async () => {
  for (const age of [0, 1, 30, 59, 60]) {
    const world = announceWorld();
    world.announcements([announcementAt('ONE')]);
    world.requestedSecondsAgo(age);
    await lookAndFinish(world);
    assert.equal(world.played.length, 1, age + ' seconds old');
  }
  for (const age of [61, 90, 3600, 86400, 86400 * 365]) {
    const world = announceWorld();
    world.announcements([announcementAt('ONE')]);
    world.requestedSecondsAgo(age);
    await lookAndFinish(world);
    assert.deepEqual(world.log, [], age + ' seconds old');
  }

  // a few seconds ahead counts, because the clock of the computer that clicked may be a little ahead
  for (const [ahead, plays] of [[3, 1], [5, 1], [6, 0], [3600, 0]]) {
    const world = announceWorld();
    world.announcements([announcementAt('ONE')]);
    world.requestedSecondsAhead(ahead);
    await lookAndFinish(world);
    assert.equal(world.played.length, plays, ahead + ' seconds ahead');
  }
});

test('a request plays once, and a new request plays again', async () => {
  const world = announceWorld();
  world.announcements([announcementAt('ONE')]);
  world.requestedSecondsAgo(1);

  await lookAndFinish(world);
  const once = world.log.length;
  assert.ok(once > 0);

  world.look();
  world.look();
  await world.runner.whenIdle();
  assert.equal(world.log.length, once, 'the request is still in the settings and is not played again');

  world.requestedSecondsAgo(0);
  await lookAndFinish(world);
  assert.equal(world.log.length, once * 2, 'a new request is played');
});

test('a screen that restarts after a push does not play it again, whether it was a few seconds or a minute later', async () => {
  const world = announceWorld();
  world.announcements([announcementAt('ONE')]);
  world.requestedSecondsAgo(1);
  await lookAndFinish(world);
  assert.equal(world.store['teletraan-announce-handled'], world.content.settings.announceRequest.requestedAt);

  // the page loads again with the same storage and the same request still in the settings
  const soon = announceWorld({ store: world.store });
  soon.nowMs = soon.start = world.nowMs + 20 * 1000;
  soon.content.settings = JSON.parse(JSON.stringify(world.content.settings));
  soon.look();
  assert.deepEqual(soon.log, [], 'handled before, so not again');

  // a browser with no storage at all, a minute later: the request is too old
  const later = announceWorld({ storage: null });
  later.nowMs = later.start = world.nowMs + 70 * 1000;
  later.content.settings = JSON.parse(JSON.stringify(world.content.settings));
  later.look();
  assert.deepEqual(later.log, [], 'older than a minute, so not at all');
});

test('a storage that fails still plays a request once while the page is open', async () => {
  const world = announceWorld({ storage: brokenStorage });
  world.announcements([announcementAt('ONE')]);
  world.requestedSecondsAgo(3);

  await lookAndFinish(world);
  const once = world.log.length;
  assert.ok(once > 0);

  await lookAndFinish(world);
  assert.equal(world.log.length, once, 'it remembers the request itself');
});

test('the handled request has a name of its own in localStorage, apart from the demo and the hidden transitions', () => {
  assert.equal(announce.handledKey, 'teletraan-announce-handled');
  assert.notEqual(announce.handledKey, handledKey);
  assert.notEqual(announce.handledKey, hidden.handledKey);

  const store = {};
  const storage = makeStorage(store);
  assert.equal(readHandledAnnounce(storage), '');
  const request = secondsAgo(5);
  assert.equal(rememberHandledAnnounce(storage, request), true);
  assert.deepEqual(store, { 'teletraan-announce-handled': request });
  assert.equal(readHandledAnnounce(storage), request);
  assert.equal(readHandled(storage), '', 'the demo has not handled anything');
  assert.equal(readHandledRequest(storage), '', 'no hidden transition has been pushed');

  assert.equal(readHandledAnnounce(brokenStorage), '');
  assert.equal(readHandledAnnounce(null), '');
  assert.equal(rememberHandledAnnounce(brokenStorage, request), false);
  assert.equal(rememberHandledAnnounce(null, request), false);
});

test('a demo or a hidden push that was handled does not stop an announcement push with the same time from playing', async () => {
  const request = secondsAgo(2);
  const world = announceWorld({ store: { 'teletraan-demo-handled': request, 'teletraan-hidden-handled': request } });
  world.announcements([announcementAt('ONE')]);
  world.content.settings.announceRequest = { requestedAt: request };

  await lookAndFinish(world);
  assert.equal(world.played.length, 1);
});

test('with no announcement switched on nothing plays and nothing is paused, and the request counts as handled', async () => {
  for (const list of [[], [announcementAt('OFF', { show: false })], undefined, null, 'none']) {
    const world = announceWorld();
    world.content.settings.announcements = list;
    world.requestedSecondsAgo(1);

    world.look();
    assert.deepEqual(world.log, [], JSON.stringify(list));
    assert.equal(world.runner.isRunning(), false);
  }

  // switching one on a few seconds later does not bring the same request back
  const world = announceWorld();
  world.requestedSecondsAgo(1);
  world.look();
  world.announcements([announcementAt('ONE')]);
  await lookAndFinish(world);
  assert.deepEqual(world.log, []);
});

test('while an alert, an announcement, a demo, the night screen or a hidden transition has the screen a request waits, and plays when it is over if it is still a minute old at most', async () => {
  for (const name of ['takeover', 'demo', 'night', 'hidden']) {
    const world = announceWorld();
    world.announcements([announcementAt('ONE')]);
    world[name] = true;
    world.requestedSecondsAgo(1);

    world.look();
    assert.deepEqual(world.log, [], 'not while ' + name + ' has the screen');
    assert.equal(world.runner.isRunning(), false);

    world.nowMs += 30 * 1000;
    world[name] = false;
    await lookAndFinish(world);
    assert.deepEqual(world.played.map(config => config.title), ['ONE'], 'half a minute later, after ' + name);

    const late = announceWorld();
    late.announcements([announcementAt('ONE')]);
    late[name] = true;
    late.requestedSecondsAgo(1);
    late.look();
    late.nowMs += 90 * 1000;
    late[name] = false;
    late.look();
    assert.deepEqual(late.log, [], 'a minute and a half later it is too old, after ' + name);
  }
});

test('a real alert that starts while they play ends the rest, and everything is given back', async () => {
  const world = announceWorld();
  world.announcements([announcementAt('ONE'), announcementAt('TWO')]);
  world.requestedSecondsAgo(1);
  world.at(5, () => { world.alerts += 1; });

  await lookAndFinish(world);
  assert.deepEqual(world.log, ['rotation paused', 'play ONE 22', 'stopped ONE', 'rotation resumed']);
  assert.equal(world.runner.isRunning(), false);
  assert.ok(world.elapsed() <= 6, 'the first one did not wait out its seconds: ' + world.elapsed());
});

test('an alert or announcement that has the screen between two announcements ends the rest', async () => {
  const world = announceWorld();
  world.announcements([announcementAt('ONE'), announcementAt('TWO')]);
  world.requestedSecondsAgo(1);
  world.at(10, () => { world.takeover = true; });

  await lookAndFinish(world);
  assert.deepEqual(world.log, ['rotation paused', 'play ONE 22', 'done ONE', 'rotation resumed']);
});

test('a new request in the middle of the announcements stops them and plays them again from the first', async () => {
  const world = announceWorld();
  world.announcements([announcementAt('ONE'), announcementAt('TWO', { titleSeconds: 4, followUpSeconds: 3 })]);
  world.requestedSecondsAgo(1);
  world.at(5, () => { world.content.settings.announceRequest = { requestedAt: new Date(world.nowMs).toISOString() }; });

  await lookAndFinish(world);
  assert.deepEqual(world.log, ['rotation paused', 'play ONE 22', 'stopped ONE', 'rotation resumed']);

  await lookAndFinish(world);
  assert.deepEqual(world.log.slice(4), ['rotation paused', 'play ONE 22', 'done ONE', 'play TWO 7', 'done TWO', 'rotation resumed']);
});

test('the list is taken when the request starts, so a change made while they play does not change what plays', async () => {
  const world = announceWorld();
  world.announcements([announcementAt('ONE'), announcementAt('TWO')]);
  world.requestedSecondsAgo(1);
  world.at(5, () => world.announcements([announcementAt('THREE')]));

  await lookAndFinish(world);
  assert.deepEqual(world.played.map(config => config.title), ['ONE', 'TWO']);
});

test('an announcement that fails ends the rest and the rotation is given back', () => withQuietErrors(async heard => {
  const world = announceWorld();
  world.announcements([announcementAt('BROKEN'), announcementAt('TWO')]);
  world.requestedSecondsAgo(1);

  await lookAndFinish(world);
  assert.deepEqual(world.log, ['rotation paused', 'play BROKEN 22', 'rotation resumed']);
  assert.equal(heard.length, 1, 'the failure is written to the console');
  assert.equal(world.runner.isRunning(), false);
}));

test('content with no settings, no request or a request that is not a time plays nothing', async () => {
  const world = announceWorld();
  world.announcements([announcementAt('ONE')]);
  [null, undefined, {}, { settings: null }, { settings: {} }, { settings: { announceRequest: null } }, { settings: { announceRequest: {} } }].forEach(content => {
    world.content = content;
    world.look();
  });
  [{ requestedAt: '' }, { requestedAt: 'tomorrow' }, { requestedAt: 12345 }, 'now', []].forEach(request => {
    world.content = { settings: { announceRequest: request, announcements: [announcementAt('ONE')] } };
    world.look();
  });
  assert.deepEqual(world.log, []);
  assert.equal(world.runner.isRunning(), false);
});

test('tidyAnnounceRequest always gives a time, empty when it is not usable', () => {
  const when = secondsAgo(3);
  assert.deepEqual(tidyAnnounceRequest({ requestedAt: when }), { requestedAt: when });
  assert.deepEqual(tidyAnnounceRequest({ requestedAt: 'whenever' }), { requestedAt: '' });
  assert.deepEqual(tidyAnnounceRequest({ requestedAt: 12345 }), { requestedAt: '' });
  [undefined, null, when, 4, [], {}].forEach(value => assert.deepEqual(tidyAnnounceRequest(value), { requestedAt: '' }, JSON.stringify(value)));
  assert.deepEqual(Object.keys(tidyAnnounceRequest({ requestedAt: when, kind: 'desktop', extra: 1 })), ['requestedAt']);
  assert.deepEqual(config.defaultSettings.announceRequest, { requestedAt: '' });
});

test('enabledAnnouncements gives words and seconds, and uses the starting seconds for any that cannot be used', () => {
  const [first, second] = enabledAnnouncements({
    announcements: [
      { title: 'A', followUp: 'B', titleSeconds: 7, followUpSeconds: 4, time: '09:00', days: [1] },
      { title: 'C', titleSeconds: 0, followUpSeconds: 'ten' },
    ],
  });
  assert.deepEqual(first, { title: 'A', followUp: 'B', titleSeconds: 7, followUpSeconds: 4 });
  assert.deepEqual(second, { title: 'C', followUp: '', titleSeconds: 12, followUpSeconds: 10 });

  [undefined, null, {}, { announcements: 'none' }, { announcements: {} }, { announcements: [] }, { announcements: [null, 4, 'x', []] }].forEach(settings => {
    assert.deepEqual(enabledAnnouncements(settings), [], JSON.stringify(settings));
  });
  assert.deepEqual(enabledAnnouncements({ announcements: [{ show: true }] }), [{ title: '', followUp: '', titleSeconds: 12, followUpSeconds: 10 }]);
});

test('the starting announcements are both enabled and play as they are', () => {
  assert.deepEqual(enabledAnnouncements(config.defaultSettings).map(item => item.title), ['WHAT TIME IS IT?', 'WHAT TIME IS IT?']);
});

test('playEach asks whether to stop before each announcement, plays them one at a time, and plays none when told to stop at once', async () => {
  const log = [];
  const playOne = async item => {
    log.push('start ' + item);
    await Promise.resolve();
    log.push('end ' + item);
  };

  await playEach(['a', 'b', 'c'], playOne, () => false);
  assert.deepEqual(log, ['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);

  log.length = 0;
  let asked = 0;
  await playEach(['a', 'b', 'c'], playOne, () => { asked += 1; return asked > 1; });
  assert.deepEqual(log, ['start a', 'end a']);

  log.length = 0;
  await playEach(['a', 'b'], playOne, () => true);
  await playEach([], playOne, () => false);
  assert.deepEqual(log, []);
});

test('a Demo step can play the announcements: the registry has it, with its name in plain words, after the single announcement', () => {
  const ids = Object.keys(demoRegistry.demoScreens);
  assert.ok(ids.indexOf('all-announcements') === ids.indexOf('announcement') + 1);
  assert.equal(demoRegistry.demoScreens['all-announcements'].name, 'All announcements');
  assert.equal(typeof demoRegistry.demoScreens['all-announcements'].run, 'function');
  assert.deepEqual(tidyDemo({ steps: [{ screen: 'all-announcements', seconds: 30 }] }).steps, [{ screen: 'all-announcements', seconds: 30 }]);
});

test('the Demo step plays each enabled announcement in order at its own length through runAnnouncement, whatever the time says, and plays none when none is enabled', async () => {
  // takeover.js draws on the page, so a stand-in that writes down what it is asked takes its place here
  fs.writeFileSync(path.join(workFolder, 'dashboard/core/takeover.js'), [
    'export const played = [];',
    'export async function runAnnouncement(config, getContent, shouldStop) {',
    '  played.push({ title: config.title, seconds: [config.titleSeconds, config.followUpSeconds], contentGiven: typeof getContent(), stopAsked: shouldStop() });',
    '}',
  ].join('\n'));
  const stand = await import(pathToFileURL(path.join(workFolder, 'dashboard/core/takeover.js')).href);
  const screen = demoRegistry.demoScreens['all-announcements'];
  const content = { settings: { announcements: [announcementAt('ONE', { time: '03:00', days: [] }), announcementAt('OFF', { show: false }), announcementAt('TWO', { titleSeconds: 5, followUpSeconds: 3 })] } };

  await screen.run({ seconds: 30, getContent: () => content, cancelled: () => false });
  assert.deepEqual(stand.played, [
    { title: 'ONE', seconds: [12, 10], contentGiven: 'object', stopAsked: false },
    { title: 'TWO', seconds: [5, 3], contentGiven: 'object', stopAsked: false },
  ]);

  // a demo that was stopped plays none, and one stopped after the first plays no more
  stand.played.length = 0;
  await screen.run({ seconds: 30, getContent: () => content, cancelled: () => true });
  assert.deepEqual(stand.played, []);

  let asked = 0;
  await screen.run({ seconds: 30, getContent: () => content, cancelled: () => { asked += 1; return asked > 2; } });
  assert.deepEqual(stand.played.map(item => item.title), ['ONE']);

  stand.played.length = 0;
  await screen.run({ seconds: 30, getContent: () => ({ settings: { announcements: [announcementAt('OFF', { show: false })] } }), cancelled: () => false });
  await screen.run({ seconds: 30, getContent: () => ({ settings: { announcements: [] } }), cancelled: () => false });
  assert.deepEqual(stand.played, []);
});

test('the announcement functions import only the config and the demo functions and use no page, and the screen code that runs them is started last', () => {
  const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');
  const code = text => text.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');

  assert.deepEqual(read('core/announce.js').split('\n').filter(line => /^import /.test(line)), [
    "import { defaultSettings } from '../config.js';",
    "import { readHandled, rememberHandled, shouldRunDemo } from './demo.js';",
  ]);
  assert.ok(!/\bdocument\b|\bwindow\b|\bimport\(/.test(code(read('core/announce.js'))), 'no page in announce.js');

  // the real screen: it asks the four things that can have the screen, and hidden-run.js can say when it does
  const run = read('core/announce-run.js');
  ['demoRunning', 'nightIsUp', 'hiddenPlaying'].forEach(name => assert.ok(run.includes("'" + name + "'"), name));
  assert.ok(run.includes('takeoverRunning: takeoverRunning,') && run.includes('alertsStarted: alertsStarted,'));
  assert.ok(/export function hiddenPlaying\(\) \{\s*return playing;\s*\}/.test(read('core/hidden-run.js')));

  const shell = read('shell.js');
  const announcing = shell.indexOf("startOptional('./core/announce-run.js', module => module.startAnnounceRunner(getContent))");
  assert.ok(announcing > shell.indexOf("startOptional('./core/hidden-run.js'"), 'after the hidden transitions');
  assert.ok(announcing > shell.indexOf("startOptional('./core/demo-runner.js'"), 'after the demo runner');
  assert.ok(announcing > shell.indexOf('startTakeovers(getContent);'), 'after the takeovers');
  assert.ok(shell.lastIndexOf("if (!params.get('show') && !stress) {", announcing) > shell.lastIndexOf('startNight', announcing) - 2000, 'only when the whole screen runs');
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
