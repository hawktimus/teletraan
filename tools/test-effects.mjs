// Tests for the effect scheduler in dashboard/frame.js: when the logo's
// entrance, spin and flying hawk, the team name effect and the screen glitch
// may start. A fake page and a clock the test moves stand in for the browser,
// so a test of 10 minutes takes no time. It also tests how a page change is
// chosen (dashboard/core/transitions.js): the style and the metal of the
// frame, and the waits frame.js makes for each style. And it tests when a demo
// from the Test the screen page runs (dashboard/core/demo.js): whether a request is recent
// and new, the order and the pauses of the steps, and what stops a demo. And it
// tests when a hidden transition plays (dashboard/core/hidden.js): the chance, the
// master switch, calm motion, what blocks it and a push from the Studio, the
// registry of the transitions, and the parts of frame.css that move them. And it tests
// Play announcements (dashboard/core/announce.js): the guard, the age limit, which
// announcements play, what it waits for, and the Demo step that plays them too. And it
// tests Run presentation test (dashboard/core/presentation-test.js): the same guard, what it
// waits for, and the sample talk it starts. And it tests the Preview buttons
// (dashboard/core/preview.js): the same guard, what each one holds on the screen for 2 minutes,
// and that the saved settings come back. And it
// tests the screen of a booked talk (dashboard/core/presentation-run.js): the title card, the
// slides, the keys, the thanks card, and what each does to the rest of the screen. And it
// tests the frames that dashboard/core/plate.js draws: the pieces, and the rivets and the stamped
// ids that only the Original style shows.
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
fs.mkdirSync(path.join(workFolder, 'dashboard', 'themes', 'overlays'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'frame.js', 'core/transitions.js', 'core/tick.js', 'core/demo.js', 'core/demo-screens.js', 'core/hidden.js', 'core/hidden-transitions.js', 'core/hidden-pictures.js', 'core/images.js', 'core/announce.js', 'core/presentation-test.js', 'core/plate.js',
  'core/preview.js', 'core/style.js', 'core/teams.js', 'core/theme.js', 'core/pack-extras.js', 'core/corner-art.js', 'themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
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
const presentationTest = await import(pathToFileURL(path.join(workFolder, 'dashboard/core/presentation-test.js')).href);
const plateModule = await import(pathToFileURL(path.join(workFolder, 'dashboard/core/plate.js')).href);
const preview = await import(pathToFileURL(path.join(workFolder, 'dashboard/core/preview.js')).href);
const styleModule = await import(pathToFileURL(path.join(workFolder, 'dashboard/core/style.js')).href);
const teamsModule = await import(pathToFileURL(path.join(workFolder, 'dashboard/core/teams.js')).href);
const themeModule = await import(pathToFileURL(path.join(workFolder, 'dashboard/core/theme.js')).href);

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
  const world = { now: 0, timers: [], nextTimer: 1, log: [], kit: [], areas: [], pageStyle: makeStyle(), pageData: {} };

  function record(effect) {
    return (name, added) => {
      if (name === 'playing' || name === 'splitting') world.log.push({ effect: effect, event: added ? 'start' : 'end', at: world.now });
      // The neon kit's two events (frame.js, "The Neon Prime kit") have a log of their own, so the log above stays the effects'
      if (name === 'glitching' || name === 'bursting') world.kit.push({ what: name, event: added ? 'start' : 'end', at: world.now });
    };
  }

  world.crt = { classList: makeClassList(record('glitch')) };
  world.worldElement = { classList: makeClassList(() => {}) };
  world.pane = { classList: makeClassList(record('pane')) }; // the layer of the neon kit's page burst (.kit-pane)

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
    documentElement: { dataset: world.pageData, style: world.pageStyle },
    getElementById: id => ({ crt: world.crt, world: world.worldElement })[id] || null,
    querySelector: selector => ({ '[data-name-effect]': world.name, '.kit-pane': world.pane })[selector] || null,
    querySelectorAll: selector => (selector === '.area' ? world.areas : []),
  };

  const real = { setTimeout: globalThis.setTimeout, setInterval: globalThis.setInterval, clearTimeout: globalThis.clearTimeout, performance: globalThis.performance };
  globalThis.setTimeout = (fn, ms) => {
    const id = world.nextTimer++;
    world.timers.push({ at: world.now + (ms || 0), id: id, fn: fn, every: 0 });
    return id;
  };
  globalThis.clearTimeout = id => {
    world.timers = world.timers.filter(timer => timer.id !== id);
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
    globalThis.clearTimeout = real.clearTimeout;
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

// The pieces of the main panel's frame in the bar layout, made by makeBarShape and not written out in plate.js
const barPieceNames = plateModule.barShape('bar-main').pieces.map(piece => piece.name);

test('every piece has a line in the table in frame.css with all seven numbers, and the screws are in the two corner pieces', () => {
  const found = piecesInPlateJs();
  const names = found.grid1.concat(found.grid2, barPieceNames);

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

test('the screw is drawn once, as one symbol with a slot across the head, in the silver tokens, and the hex bolt is only on the bar frames', () => {
  assert.ok(indexHtml.includes('<g id="screw-shape">') && indexHtml.includes('<polygon id="screw-shadow-shape"'));
  const screw = indexHtml.slice(indexHtml.indexOf('<g id="screw-shape">'), indexHtml.indexOf('</g>', indexHtml.indexOf('<g id="screw-shape">')));
  assert.ok(screw.includes('class="screw-slot"') && screw.includes('class="screw-face"') && screw.includes('class="screw-rim"'));

  // The hex bolt is the bar frames' screw: drawn once, in the same tokens, and the frames of the other layouts never use it
  assert.equal((indexHtml.match(/<g id="bolt-shape">/g) || []).length, 1, 'the bolt is drawn once');
  const bolt = indexHtml.slice(indexHtml.indexOf('<g id="bolt-shape">'), indexHtml.indexOf('</g>', indexHtml.indexOf('<g id="bolt-shape">')));
  assert.ok(bolt.includes('class="bolt-rim"') && bolt.includes('class="bolt-face"') && bolt.includes('class="bolt-dot"'));
  assert.deepEqual(bolt.match(/<polygon class="bolt-rim" points="([^"]*)"/)[1].split(' ').length, 6, 'a hexagon');
  ['bolt-rim { fill: var(--screw-rim)', 'bolt-face { fill: var(--screw-face)', 'bolt-dot { fill: var(--screw-light)'].forEach(text => assert.ok(baseCss.includes('.' + text), text));
  withPlatePage(() => {
    ['grid1', 'grid2'].forEach(kind => assert.ok(!plateModule.areaMarkup(kind).includes('bolt-shape'), kind + ' keeps its screws'));
    assert.ok(!plateModule.plateMarkup('countdown').includes('bolt-shape'), 'and so does the countdown');
    ['bar-main', 'bar-ticker'].forEach(kind => {
      const markup = plateModule.areaMarkup(kind);
      assert.ok(markup.includes('href="#bolt-shape"') && !markup.includes('screw-shape') && !markup.includes('screw-shadow'), kind + ' has bolts and no screw');
    });
    const banner = plateModule.plateMarkup('bar-banner');
    assert.ok(banner.includes('href="#bolt-shape"') && !banner.includes('screw-shape'), 'the banner has bolts too');
  });

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

// The rivets and the stamped ids that only the Original style shows (core/plate.js, base.css)

// plate.js adds each frame's shapes to a hidden group of the page, once. A page with only
// that group stands in for it.
function withPlatePage(run) {
  const real = globalThis.document;
  const known = new Set();

  globalThis.document = {
    getElementById: id => {
      if (id !== 'metal-shapes') return known.has(id) ? {} : null;
      return { insertAdjacentHTML: (where, markup) => (markup.match(/ id="[^"]+"/g) || []).forEach(found => known.add(found.slice(5, -1))) };
    },
  };
  try {
    return run();
  } finally {
    globalThis.document = real;
    if (real === undefined) delete globalThis.document;
  }
}

// The svgs of a frame: its two halves, and its pieces if it has any
function frameParts(markup) {
  const svgs = markup.split('<svg ').slice(1);
  const half = side => svgs.filter(svg => svg.includes('data-part="frame-' + side + '"'))[0];
  return { a: half('a'), b: half('b'), pieces: svgs.filter(svg => svg.includes('class="plate piece"')) };
}

// Every rivet is a circle of radius 5 in a path: the start of each is its left side
function rivetCenters(svg) {
  return Array.from(svg.matchAll(/M(-?[\d.]+) ([\d.]+)a5 5 0 1 0 10 0a5 5 0 1 0 -10 0/g)).map(found => [Math.round((Number(found[1]) + 5) * 10) / 10, Number(found[2])]);
}

function screwCenters(svg) {
  return Array.from(svg.matchAll(/translate\((\d+) (\d+)\)/g)).map(found => [Number(found[1]), Number(found[2])]);
}

// The long straight edges of each frame, as the frame lines run: the line one edge is on, and where it
// starts and ends along it. half is the half of the frame that holds the edge. The top of the countdown
// is a row of teeth and has no long straight edge.
const rivetFrames = {
  grid1: {
    make: () => plateModule.areaMarkup('grid1'),
    number: '01',
    height: 708,
    edges: [
      { name: 'left', x: 4, from: 68, to: 704, half: 'a' },
      { name: 'top', y: 4, from: 84, to: 1148, half: 'a' },
      { name: 'right', x: 1148, from: 4, to: 640, half: 'b' },
      { name: 'bottom', y: 704, from: 4, to: 1068, half: 'b' },
    ],
  },
  countdown: {
    make: () => plateModule.plateMarkup('countdown'),
    number: '02',
    height: 320,
    edges: [
      { name: 'left', x: 4, from: 52, to: 316, half: 'a' },
      { name: 'right', x: 652, from: 4, to: 268, half: 'b' },
      { name: 'bottom', y: 316, from: 4, to: 592, half: 'b' },
    ],
  },
  grid2: {
    make: () => plateModule.areaMarkup('grid2'),
    number: '03',
    height: 372,
    edges: [
      { name: 'left', x: 4, from: 52, to: 368, half: 'a' },
      { name: 'top', y: 4, from: 64, to: 652, half: 'a' },
      { name: 'right', x: 652, from: 4, to: 320, half: 'b' },
      { name: 'bottom', y: 368, from: 4, to: 592, half: 'b' },
    ],
  },
};

// Where along its edge a rivet is, and whether it is on the edge
function onEdge(center, edge) {
  const along = edge.x !== undefined ? center[1] : center[0];
  const across = edge.x !== undefined ? center[0] : center[1];
  return across === (edge.x !== undefined ? edge.x : edge.y) && along > edge.from && along < edge.to;
}

test('a row of rivets is one every 90px along an edge, centred on it, with at least 45px at each end, and an edge under 180px has none', () => {
  const { rivetsAlong } = plateModule;

  assert.deepEqual(rivetsAlong([0, 0], [179, 0]), []);
  assert.deepEqual(rivetsAlong([0, 0], [180, 0]), [[45, 0], [135, 0]]);
  assert.deepEqual(rivetsAlong([10, 20], [10, 920]).map(center => center[1]), [65, 155, 245, 335, 425, 515, 605, 695, 785, 875]);

  for (let length = 180; length <= 1400; length += 37) {
    const row = rivetsAlong([100, 50], [100 + length, 50]);
    const places = row.map(center => center[0] - 100);

    assert.equal(row.length, Math.floor(length / 90), 'the count for an edge ' + length + ' long');
    assert.ok(places[0] >= 45 - 0.05 && places[places.length - 1] <= length - 45 + 0.05, 'inside the edge, with room at each end: ' + length);
    assert.ok(Math.abs((places[0]) - (length - places[places.length - 1])) <= 0.1, 'centred: ' + length);
    places.slice(1).forEach((place, index) => assert.ok(Math.abs(place - places[index] - 90) <= 0.1, 'a gap of 90: ' + length));
    row.forEach(center => assert.equal(center[1], 50, 'on the line'));
  }

  // the same edge from the other end has the same rivets, and any direction works
  const forward = rivetsAlong([0, 0], [1064, 0]).map(center => center[0]);
  const backward = rivetsAlong([1064, 0], [0, 0]).map(center => center[0]).reverse();
  assert.deepEqual(forward, backward);
  assert.deepEqual(rivetsAlong([0, 0], [0, 400]).map(center => center[1]), [65, 155, 245, 335]);
  assert.deepEqual(plateModule.rivetsOf([[0, 0], [100, 0], [100, 400]]).map(center => center.join(',')), ['100,65', '100,155', '100,245', '100,335'], 'the 100px edge has none');
});

test('each frame has a rivet for every 90px of each long edge, on the line, inside the edge, in the half that holds the edge, and none on a cut corner', () => {
  withPlatePage(() => {
    Object.keys(rivetFrames).forEach(name => {
      const frame = rivetFrames[name];
      const parts = frameParts(frame.make());
      const found = { a: rivetCenters(parts.a), b: rivetCenters(parts.b) };
      const all = found.a.concat(found.b);
      let expected = 0;

      frame.edges.forEach(edge => {
        const length = edge.to - edge.from;
        const row = found[edge.half].filter(center => onEdge(center, edge));
        const places = row.map(center => (edge.x !== undefined ? center[1] : center[0])).sort((one, other) => one - other);

        assert.equal(row.length, Math.floor(length / 90), name + ' ' + edge.name + ': one for every 90px of ' + length);
        assert.ok(places[0] >= edge.from + 45 - 0.05 && places[places.length - 1] <= edge.to - 45 + 0.05, name + ' ' + edge.name + ': inside the edge');
        places.slice(1).forEach((place, index) => assert.ok(Math.abs(place - places[index] - 90) <= 0.1, name + ' ' + edge.name + ': 90 apart'));
        expected += row.length;
      });

      assert.equal(all.length, expected, name + ': every rivet is on one of the long edges, and the cut corners and the teeth have none');
      assert.equal(new Set(all.map(center => center.join(','))).size, all.length, name + ': no rivet twice');

      // clear of every screw, whose shadow reaches 29px, and of the frame's other rivets by the width of a rivet
      const screws = screwCenters(parts.a).concat(screwCenters(parts.b));
      assert.ok(screws.length >= 2, name + ' has screws');
      all.forEach(center => screws.forEach(screw => {
        assert.ok(Math.hypot(center[0] - screw[0], center[1] - screw[1]) >= 29 + 5, name + ': a rivet at ' + center + ' is under the screw at ' + screw);
      }));
    });
  });
});

test('the rivets of a frame are one path for each half and one for each bar of its pieces, never one element for each rivet, and every rivet is in exactly one piece', () => {
  withPlatePage(() => {
    ['grid1', 'grid2'].forEach(name => {
      const markup = rivetFrames[name].make();
      const parts = frameParts(markup);
      const whole = rivetCenters(parts.a).concat(rivetCenters(parts.b));
      const inPieces = parts.pieces.reduce((list, svg) => list.concat(rivetCenters(svg)), []);

      assert.ok(whole.length > 0);
      assert.deepEqual(inPieces.map(center => center.join(',')).sort(), whole.map(center => center.join(',')).sort(), name + ': the pieces carry the rivets of the frame, each one once');
      assert.equal((markup.match(/class="rivets"/g) || []).length, 2 + parts.pieces.filter(svg => svg.includes('class="rivets"')).length);
      assert.equal((markup.match(/class="rivets" data-part="rivets"/g) || []).length, 2, name + ': the two halves are labelled, so frame.css can bring them in');
      assert.equal(/<circle|<use class="rivet/.test(markup), false, name + ': not an element for each rivet');
      assert.ok((markup.match(/class="rivets"/g) || []).length <= 9, name + ': a handful of elements');

      // a piece that is a plate has no rivets, and a bar has only the ones on its own line
      parts.pieces.forEach(svg => {
        const place = /left: (-?\d+)px; top: (-?\d+)px;" width="(\d+)" height="(\d+)"/.exec(svg);
        rivetCenters(svg).forEach(center => {
          assert.ok(center[0] >= Number(place[1]) && center[0] <= Number(place[1]) + Number(place[3]) && center[1] >= Number(place[2]) && center[1] <= Number(place[2]) + Number(place[4]), name + ': a rivet outside the piece that has it');
        });
      });
    });

    const countdown = rivetFrames.countdown.make();
    assert.equal((countdown.match(/class="rivets"/g) || []).length, 2, 'the countdown has no pieces: one path for each half');
  });
});

test('the frame of an alert and of an announcement has no rivets and no id', () => {
  withPlatePage(() => {
    [plateModule.frameMarkup(), plateModule.frameMarkup({ red: true })].forEach(markup => {
      assert.equal(markup.includes('rivets'), false);
      assert.equal(markup.includes('plate-id'), false);
    });
  });
});

test('each frame has one stamped id, numbered 01 for the large panel, 02 for the countdown and 03 for the small panel, in the bottom right corner and clear of the screw', () => {
  withPlatePage(() => {
    Object.keys(rivetFrames).forEach(name => {
      const frame = rivetFrames[name];
      const markup = frame.make();
      const spans = markup.match(/<span class="plate-id"[^>]*><\/span>/g) || [];
      assert.equal(spans.length, 1, name + ' has one id');

      const found = /data-part="plate-id" data-number="(\d\d)" style="left: (\d+)px; top: (\d+)px; width: (\d+)px;"/.exec(spans[0]);
      assert.ok(found, name + ': the id has its number and its place');
      assert.equal(found[1], frame.number);
      const box = { left: Number(found[2]), top: Number(found[3]), width: Number(found[4]), height: 20 };

      // the whole box is on the plate, above the bottom line of the frame, which is 8px thick either side of it
      const bottomLine = frame.edges.filter(edge => edge.name === 'bottom')[0].y;
      assert.ok(box.top >= 0 && box.left >= 0, name + ': inside the panel');
      assert.ok(box.top + box.height <= bottomLine - 8, name + ': above the bottom line of the frame');

      // in the bottom right corner: nearer the right end than the left and in the lower part
      const right = frame.edges.filter(edge => edge.name === 'bottom')[0].to;
      assert.ok(box.left + box.width <= right, name + ': left of the foot of the cut corner');
      assert.ok(box.left + box.width > right - 60, name + ': at the right end of the bottom edge');
      assert.ok(bottomLine - (box.top + box.height) < 30, name + ': near the bottom');

      // clear of the screws by their shadow
      const parts = frameParts(markup);
      screwCenters(parts.a).concat(screwCenters(parts.b)).forEach(screw => {
        const nearX = Math.max(box.left, Math.min(screw[0], box.left + box.width));
        const nearY = Math.max(box.top, Math.min(screw[1], box.top + box.height));
        assert.ok(Math.hypot(screw[0] - nearX, screw[1] - nearY) >= 29, name + ': the id is under the screw at ' + screw);
      });
    });
  });
});

test('base.css draws the rivets and the ids only while the style is Original, the id is 20px and dim, and no other stylesheet draws either, apart from the one that shows the rivets on Minimal\'s own frames', () => {
  const css = baseCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = selector => {
    const found = new RegExp('(?:^|\\n)' + selector.replace(/[.\[\]="]/g, '\\$&') + ' \\{([^}]*)\\}').exec(css);
    assert.ok(found, 'base.css has no rule for ' + selector);
    return found[1];
  };

  assert.ok(/display: none;/.test(rule('.rivets')) && /display: none;/.test(rule('.plate-id')), 'hidden unless a style shows them');
  assert.ok(/display: inline;/.test(rule('html[data-style="original"] .rivets')));
  assert.ok(/display: block;/.test(rule('html[data-style="original"] .plate-id')));
  assert.equal((css.match(/\.rivets|\.plate-id/g) || []).length, 5, 'no other rule in base.css names them');
  assert.ok(/stroke-width: 2px;/.test(rule('.rivets')) && /fill: var\(--screw-mid\);/.test(rule('.rivets')) && /stroke: var\(--screw-rim\);/.test(rule('.rivets')), 'steel with a dark rim');

  const id = rule('.plate-id');
  assert.ok(/font: 700 20px\/1 var\(--font-display\);/.test(id), 'the id is 20px');
  assert.ok(/opacity: \.3;/.test(id), 'and dim');
  assert.ok(/position: absolute;/.test(id) && /pointer-events: none;/.test(id));
  assert.ok(css.includes('.plate-id::after { content: var(--team-initials, "HP") "-" attr(data-number); }'), 'the letters are the team\'s, and the number is the frame\'s');
  assert.equal(/animation|transition|filter|shadow|blur/.test(id + rule('.rivets')), false, 'static, with no effect');

  // the other stylesheets leave them alone, apart from frame.css, which brings them in and takes them away with the frame,
  // and styles/minimal.css, which shows the rivets on the frames Minimal draws with them (docs/layouts.md, "Frames")
  const others = [];
  const walk = folder => fs.readdirSync(folder, { withFileTypes: true }).forEach(entry => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) { if (!['fonts', 'data', 'assets'].includes(entry.name)) walk(full); }
    else if (entry.name.endsWith('.css') && !['base.css', 'frame.css'].includes(entry.name) && /rivets|plate-id/.test(fs.readFileSync(full, 'utf8'))) others.push(path.relative(dashboardFolder, full));
  });
  walk(dashboardFolder);
  assert.deepEqual(others, ['styles/minimal.css'], 'a style or theme that draws or hides them');
  const minimalCss = fs.readFileSync(path.join(dashboardFolder, 'styles/minimal.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.deepEqual(minimalCss.match(/[^\n]*(\.rivets|\.plate-id)[^\n]*/g), ['html[data-style="minimal"] .rivets { display: inline; }'], 'Minimal shows the rivets and has no id');
});

test('the rivets and the id come in after the lines are drawn, go with the frame in a page change, and are left out of the mechanical change with the plates', () => {
  const css = frameCss.replace(/\/\*[\s\S]*?\*\//g, '');

  const arrival = /\[data-motion="full"\] \.area\[data-state="in"\] \[data-part="rivets"\],\s*\[data-motion="full"\] \.area\[data-state="in"\] \[data-part="plate-id"\],\s*\[data-motion="full"\] \.area\[data-state="in"\] \[data-part="decor"\] \{\s*animation: fade-in var\(--time-fade-in\) linear calc\(var\(--assemble-draw\) \* var\(--pace\) \+ var\(--time-draw-in\)\) backwards;\s*\}/;
  assert.ok(arrival.test(css), 'a fade, timed after the line drawing');
  assert.ok(css.includes('[data-state="xo"] .plate-id,') && css.includes('[data-state="xi"] .plate-id,'), 'the id is hidden with the plates while the pieces are shown');

  // the countdown brings them in with its other parts, after its outline is drawn
  const sequence = /\n  countdown: \{([^}]*)\},/.exec(fs.readFileSync(path.join(dashboardFolder, 'frame.js'), 'utf8'))[1];
  const line = part => new RegExp("'" + part + "':\\s*\\['fade', (\\d+)\\]").exec(sequence);
  const drawn = /'outline':\s*\['draw', (\d+)\]/.exec(sequence);
  assert.ok(line('rivets') && line('plate-id') && drawn);
  assert.ok(Number(line('rivets')[1]) >= Number(drawn[1]) + 650, 'after the outline is drawn, which takes 650 ms');
  assert.ok(Number(line('plate-id')[1]) >= Number(line('rivets')[1]));
  withPlatePage(() => {
    const markup = plateModule.plateMarkup('countdown');
    assert.ok(markup.includes('data-part="rivets"') && markup.includes('data-part="plate-id"'));
  });
});

// The Test the screen page (dashboard/core/demo.js)

const { shouldRunDemo, readHandled, rememberHandled, handledKey, makeDemoRunner, tidyDemo } = demo;
const demoNow = new Date('2026-10-05T12:00:00.000Z');
const secondsAgo = seconds => new Date(demoNow.getTime() - seconds * 1000).toISOString();

function makeStorage(store) {
  return {
    getItem: key => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: key => { delete store[key]; },
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

  // the page loads again with the same storage and the same request still on the Test the screen page
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

// Run presentation test (dashboard/core/presentation-test.js): the Studio's button that starts the
// sample talk, now, once

const { tidyTestRequest, makePresentationTestRunner, readHandledTest, rememberHandledTest, talkStartingAt } = presentationTest;

// The talk in data/sample/content.json, as the screen reads it
const sampleTalk = {
  id: 'presentation-sample', name: '[First name]', subteam: '[Subteam A]', topic: '[Title of the talk]',
  start: new Date('2027-03-04T00:00:00.000Z'), minutes: 15, status: 'scheduled',
};

// A fake screen for the runner, with a clock the test moves. sample is what reading the sample
// content gives: the talk, null when it has none, or 'fails' when the file cannot be read.
function presentationTestWorld(options) {
  const settings = options || {};
  const world = {
    nowMs: demoNow.getTime(),
    content: { settings: { presentationsEnabled: true, presentationTestRequest: { requestedAt: '' } } },
    started: [],
    takeover: false,
    demo: false,
    night: false,
    hidden: false,
    sample: settings.sample === undefined ? sampleTalk : settings.sample,
    store: settings.store || {},
  };

  world.runner = makePresentationTestRunner({
    getContent: () => world.content,
    storage: settings.storage === undefined ? makeStorage(world.store) : settings.storage,
    takeoverRunning: () => world.takeover,
    demoRunning: () => world.demo,
    nightIsUp: () => world.night,
    hiddenPlaying: () => world.hidden,
    async loadSampleTalk() {
      if (world.sample === 'fails') throw new Error('the sample content cannot be read');
      return world.sample;
    },
    startTalk: talk => world.started.push(talk),
  });

  world.look = () => world.runner.look(new Date(world.nowMs));
  world.requestedSecondsAgo = seconds => { world.content.settings.presentationTestRequest = { requestedAt: new Date(world.nowMs - seconds * 1000).toISOString() }; };
  return world;
}

// Looks once and waits for the talk to be handed to the screen
async function lookAndStart(world) {
  world.look();
  await world.runner.whenStarted();
}

test('a request starts the sample talk once, with its start set to now and the rest as the sample has it', async () => {
  const world = presentationTestWorld();
  world.requestedSecondsAgo(2);

  await lookAndStart(world);
  assert.equal(world.started.length, 1);
  assert.equal(world.started[0].start.getTime(), world.nowMs, 'it starts now');
  assert.deepEqual(Object.assign({}, world.started[0], { start: null }), Object.assign({}, sampleTalk, { start: null }));
  assert.equal(sampleTalk.start.toISOString(), '2027-03-04T00:00:00.000Z', 'the sample talk itself is not changed');

  world.nowMs += 1000;
  await lookAndStart(world);
  world.nowMs += 20 * 1000;
  await lookAndStart(world);
  assert.equal(world.started.length, 1, 'the same request starts it once');
  assert.deepEqual(world.store, { 'teletraan-presentation-test-handled': world.content.settings.presentationTestRequest.requestedAt });
});

test('the sample talk is scheduled whatever the sample file says, and it keeps its id, which is the name of its folder of slides', () => {
  const now = new Date(demoNow.getTime());
  ['cancelled', 'done', 'skipped', undefined].forEach(status => {
    const talk = talkStartingAt(Object.assign({}, sampleTalk, { status: status }), now);
    assert.equal(talk.status, 'scheduled', String(status));
    assert.equal(talk.id, 'presentation-sample');
    assert.equal(talk.start.getTime(), now.getTime());
    assert.notEqual(talk.start, now, 'a copy of the time, not the clock of the screen');
  });
});

test('a request that is more than a minute old, in the future by more than a few seconds, or not a time starts nothing', async () => {
  for (const seconds of [61, 90, 3600, -30]) {
    const world = presentationTestWorld();
    world.requestedSecondsAgo(seconds);
    await lookAndStart(world);
    assert.equal(world.started.length, 0, String(seconds));
  }

  // the clock of the computer that clicked may be a few seconds ahead
  const ahead = presentationTestWorld();
  ahead.requestedSecondsAgo(-3);
  await lookAndStart(ahead);
  assert.equal(ahead.started.length, 1);
});

test('a request that was handled before is not started again when the page loads again, and the demo, the hidden transitions and the announcements keep their own', async () => {
  const request = secondsAgo(5);
  const again = presentationTestWorld({ store: { 'teletraan-presentation-test-handled': request } });
  again.content.settings.presentationTestRequest = { requestedAt: request };
  await lookAndStart(again);
  assert.equal(again.started.length, 0);

  assert.equal(presentationTest.handledKey, 'teletraan-presentation-test-handled');
  assert.notEqual(presentationTest.handledKey, announce.handledKey);
  assert.notEqual(presentationTest.handledKey, hidden.handledKey);
  assert.notEqual(presentationTest.handledKey, demo.handledKey);

  const other = presentationTestWorld({ store: { 'teletraan-demo-handled': request, 'teletraan-hidden-handled': request, 'teletraan-announce-handled': request } });
  other.content.settings.presentationTestRequest = { requestedAt: request };
  await lookAndStart(other);
  assert.equal(other.started.length, 1);

  const store = {};
  const storage = makeStorage(store);
  assert.equal(readHandledTest(storage), '');
  assert.equal(rememberHandledTest(storage, request), true);
  assert.deepEqual(store, { 'teletraan-presentation-test-handled': request });
  assert.equal(readHandledTest(storage), request);
  assert.equal(readHandledTest(brokenStorage), '');
  assert.equal(readHandledTest(null), '');
  assert.equal(rememberHandledTest(brokenStorage, request), false);
  assert.equal(rememberHandledTest(null, request), false);
});

test('storage that cannot be used still stops the same request from starting twice while the page is open', async () => {
  for (const storage of [brokenStorage, null]) {
    const world = presentationTestWorld({ storage: storage });
    world.requestedSecondsAgo(2);
    await lookAndStart(world);
    world.nowMs += 1000;
    await lookAndStart(world);
    assert.equal(world.started.length, 1);
  }
});

test('while an alert, an announcement, a talk, a demo, the night screen or a hidden transition has the screen a request waits, and starts when it is over if it is still a minute old at most', async () => {
  for (const name of ['takeover', 'demo', 'night', 'hidden']) {
    const world = presentationTestWorld();
    world[name] = true;
    world.requestedSecondsAgo(1);

    await lookAndStart(world);
    assert.equal(world.started.length, 0, 'not while ' + name + ' has the screen');

    world.nowMs += 30 * 1000;
    world[name] = false;
    await lookAndStart(world);
    assert.equal(world.started.length, 1, 'half a minute later, after ' + name);

    const late = presentationTestWorld();
    late[name] = true;
    late.requestedSecondsAgo(1);
    await lookAndStart(late);
    late.nowMs += 90 * 1000;
    late[name] = false;
    await lookAndStart(late);
    assert.equal(late.started.length, 0, 'a minute and a half later it is too old, after ' + name);
  }
});

test('with Run presentations off nothing starts and the request is kept, so turning it on within the minute runs the test', async () => {
  const world = presentationTestWorld();
  world.content.settings.presentationsEnabled = false;
  world.requestedSecondsAgo(1);

  await lookAndStart(world);
  assert.equal(world.started.length, 0);
  assert.deepEqual(world.store, {}, 'it is not used up');

  world.nowMs += 20 * 1000;
  world.content.settings.presentationsEnabled = true;
  await lookAndStart(world);
  assert.equal(world.started.length, 1);

  const late = presentationTestWorld();
  late.content.settings.presentationsEnabled = false;
  late.requestedSecondsAgo(1);
  await lookAndStart(late);
  late.nowMs += 90 * 1000;
  late.content.settings.presentationsEnabled = true;
  await lookAndStart(late);
  assert.equal(late.started.length, 0, 'after a minute it is too old');
});

test('a sample that has no talk or cannot be read starts nothing, says so in the console, and the request counts as used', () => withQuietErrors(async heard => {
  for (const sample of [null, 'fails']) {
    const world = presentationTestWorld({ sample: sample });
    world.requestedSecondsAgo(1);

    await lookAndStart(world);
    assert.equal(world.started.length, 0, String(sample));
    assert.equal(heard.length, 1, String(sample));
    assert.match(String(heard[0][0]), /Run presentation test failed/);

    world.nowMs += 1000;
    await lookAndStart(world);
    assert.equal(heard.length, 1, 'it is not tried again');
    heard.length = 0;
  }
}));

test('content with no settings, no request or a request that is not a time starts nothing', async () => {
  const world = presentationTestWorld();
  [null, undefined, {}, { settings: null }, { settings: {} }, { settings: { presentationTestRequest: null } }, { settings: { presentationTestRequest: {} } }].forEach(content => {
    world.content = content;
    world.look();
  });
  [{ requestedAt: '' }, { requestedAt: 'tomorrow' }, { requestedAt: 12345 }, 'now', []].forEach(request => {
    world.content = { settings: { presentationTestRequest: request } };
    world.look();
  });
  await world.runner.whenStarted();
  assert.equal(world.started.length, 0);
});

test('tidyTestRequest always gives a time, empty when it is not usable', () => {
  const when = secondsAgo(3);
  assert.deepEqual(tidyTestRequest({ requestedAt: when }), { requestedAt: when });
  assert.deepEqual(tidyTestRequest({ requestedAt: 'whenever' }), { requestedAt: '' });
  assert.deepEqual(tidyTestRequest({ requestedAt: 12345 }), { requestedAt: '' });
  [undefined, null, when, 4, [], {}].forEach(value => assert.deepEqual(tidyTestRequest(value), { requestedAt: '' }, JSON.stringify(value)));
  assert.deepEqual(Object.keys(tidyTestRequest({ requestedAt: when, kind: 'desktop', extra: 1 })), ['requestedAt']);
  assert.deepEqual(config.defaultSettings.presentationTestRequest, { requestedAt: '' });
});

test('the presentation test functions import only the demo functions and use no page, and the screen code that runs them is started after the talk screen', () => {
  const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');
  const code = text => text.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');

  assert.deepEqual(read('core/presentation-test.js').split('\n').filter(line => /^import /.test(line)), [
    "import { readHandled, rememberHandled, shouldRunDemo } from './demo.js';",
  ]);
  assert.ok(!/\bdocument\b|\bwindow\b|\bimport\(/.test(code(read('core/presentation-test.js'))), 'no page in presentation-test.js');

  // the real screen: it asks what can have the screen, reads the sample file from the sample folder and hands the talk to the talk screen
  const run = read('core/presentation-test-run.js');
  ['demoRunning', 'nightIsUp', 'hiddenPlaying'].forEach(name => assert.ok(run.includes("'" + name + "'"), name));
  assert.ok(run.includes('takeoverRunning: takeoverRunning,') && run.includes('startTalk: startTestTalk,'));
  assert.ok(run.includes("fetch(sampleFolder + 'content.json'"), 'the sample file, and nothing from Sanity or Google');
  assert.ok(!/sanity\.io|google\.com|config\.js'.*\bsanity\b/.test(code(run)), 'no other address');

  const shell = read('shell.js');
  const testing = shell.indexOf("startOptional('./core/presentation-test-run.js', module => module.startPresentationTestRunner(getContent))");
  assert.ok(testing > shell.indexOf("startOptional('./core/presentation-run.js'"), 'after the talk screen');
  assert.ok(testing > shell.indexOf("startOptional('./core/hidden-run.js'"), 'after the hidden transitions');
  assert.ok(testing > shell.indexOf("startOptional('./core/demo-runner.js'"), 'after the demo runner');
  assert.ok(testing > shell.indexOf('startTakeovers(getContent);'), 'after the takeovers');
  assert.ok(shell.lastIndexOf("if (!params.get('show') && !stress) {", testing) > shell.lastIndexOf('startNight', testing) - 2000, 'only when the whole screen runs');
});

// Preview a look (dashboard/core/preview.js): the Studio's buttons that hold a team, a style or a
// seasonal pack on the screen for 2 minutes, without writing the settings

const { tidyPreviewRequest, makePreviewRunner, previewKinds, readHandledPreview, rememberHandledPreview, resumePreview, nextPack, previewPacks, heldBy } = preview;
const previewSeconds = config.previewSeconds;

// The modules keep what a preview holds for the whole run, so each test lets go of it first and last
function letGoOfPreview() {
  styleModule.previewStyle('', 0);
  teamsModule.previewTeam('', 0);
  themeModule.previewPack('', 0);
  teamsModule.askForTeam('');
}

const novaTeam = Object.assign({}, config.primeTeam, { code: 'nova', name: 'HAWKTIMUS NOVA', mirror: true, builtIn: undefined });

// The team the screen asks for at a moment when Team mode in the settings says saved
function teamSeen(saved, now) {
  teamsModule.useTeams({ teams: [config.primeTeam, novaTeam], settings: { teamMode: saved, alternateMinutes: 5 } }, now);
  return teamsModule.wantedTeam().code;
}

// For each button: the value the settings give, the value the preview holds, and how to see which one the screen has.
// The pack on the screen in these tests is Christmas, so the next pack is New Year's.
const previewSeen = {
  prime: { saved: 'nova', forced: 'prime', seen: now => teamSeen('nova', now) },
  nova: { saved: 'prime', forced: 'nova', seen: now => teamSeen('prime', now) },
  cybertron: { saved: 'original', forced: 'cybertron', seen: now => styleModule.chooseStyle('original', null, now) },
  minimal: { saved: 'original', forced: 'minimal', seen: now => styleModule.chooseStyle('original', null, now) },
  'next-pack': { saved: '', forced: 'new-years', seen: now => themeModule.previewedPack(now) },
};

// A fake screen for the runner, with a clock the test moves. asked is what the runner told the page to look at again.
function previewWorld(options) {
  const settings = options || {};
  const world = {
    nowMs: demoNow.getTime(),
    content: { settings: { previewRequest: { kind: '', requestedAt: '' } } },
    takeover: false,
    demo: false,
    night: false,
    hidden: false,
    pack: settings.pack === undefined ? 'christmas' : settings.pack,
    asked: [],
    store: settings.store || {},
  };

  world.runner = makePreviewRunner({
    getContent: () => world.content,
    storage: settings.storage === undefined ? makeStorage(world.store) : settings.storage,
    takeoverRunning: () => world.takeover,
    demoRunning: () => world.demo,
    nightIsUp: () => world.night,
    hiddenPlaying: () => world.hidden,
    packOnScreen: () => world.pack,
    lookAgain: held => world.asked.push(held),
  });

  world.look = () => world.runner.look(new Date(world.nowMs));
  world.later = seconds => { world.nowMs += seconds * 1000; world.look(); };
  world.at = seconds => new Date(world.nowMs + seconds * 1000);
  world.request = (kind, seconds) => { world.content.settings.previewRequest = { kind: kind, requestedAt: new Date(world.nowMs - seconds * 1000).toISOString() }; };
  return world;
}

// What every Preview button does with a request, whatever it holds: the guard of a demo, the wait for
// whatever has the screen, the 2 minutes, and the settings coming back
function checkPreviewButton(kind) {
  const check = previewSeen[kind];
  const holds = world => check.seen(world.at(0)) === check.forced;
  letGoOfPreview();

  // it holds its value for exactly 120 seconds from the moment it starts, and the saved value comes back
  const world = previewWorld();
  world.request(kind, 2);
  assert.equal(check.seen(world.at(0)), check.saved, 'nothing is held before the screen looks');
  world.look();
  assert.equal(world.runner.isActive(), true);
  assert.equal(check.seen(world.at(0)), check.forced, 'held at once');
  assert.equal(previewSeconds, 120);
  assert.equal(check.seen(world.at(119.999)), check.forced, 'held until the 120th second');
  assert.equal(check.seen(world.at(120)), check.saved, 'and given back at the 120th');
  world.later(60);
  world.later(59);
  assert.equal(world.runner.isActive(), true, 'still on at 119 seconds');
  assert.equal(holds(world), true);
  world.later(1);
  assert.equal(world.runner.isActive(), false, 'over at 120 seconds');
  assert.equal(holds(world), false);
  assert.equal(world.asked.length, 2, 'the page is told when it starts and when it ends');
  assert.deepEqual(world.asked[0], world.asked[1]);
  assert.deepEqual(world.asked[0], heldBy(kind, 'christmas'));
  assert.deepEqual(world.store, { 'teletraan-preview-handled': world.content.settings.previewRequest.requestedAt }, 'the request is remembered and the preview is not left behind');

  // the same request is not started again, and a new one starts again from its own moment
  world.look();
  assert.equal(world.runner.isActive(), false, 'the request is still in the settings and is not started again');
  world.request(kind, 0);
  world.look();
  assert.equal(world.runner.isActive(), true, 'a new request starts it');
  world.later(100);
  world.request(kind, 0);
  world.look();
  world.later(100);
  assert.equal(holds(world), true, 'a request in the middle starts the 2 minutes again');
  world.later(20);
  assert.equal(holds(world), false);
  letGoOfPreview();

  // a request starts while it is a minute old at most, and an older one never starts
  for (const age of [0, 1, 30, 59, 60]) {
    letGoOfPreview();
    const young = previewWorld();
    young.request(kind, age);
    young.look();
    assert.equal(holds(young), true, age + ' seconds old');
  }
  for (const age of [61, 90, 3600, 86400, 86400 * 365]) {
    letGoOfPreview();
    const old = previewWorld();
    old.request(kind, age);
    old.look();
    assert.equal(holds(old), false, age + ' seconds old');
    assert.deepEqual(old.store, {});
  }
  // a few seconds ahead counts, because the clock of the computer that clicked may be a little ahead
  for (const [ahead, starts] of [[3, true], [5, true], [6, false], [3600, false]]) {
    letGoOfPreview();
    const early = previewWorld();
    early.request(kind, -ahead);
    early.look();
    assert.equal(holds(early), starts, ahead + ' seconds ahead');
  }

  // a screen that restarts after the click does not start it again, and the other runners' notes do not count
  letGoOfPreview();
  const again = previewWorld({ store: { 'teletraan-preview-handled': secondsAgo(5) } });
  again.content.settings.previewRequest = { kind: kind, requestedAt: secondsAgo(5) };
  again.look();
  assert.equal(holds(again), false);
  letGoOfPreview();
  const other = previewWorld({ store: { 'teletraan-demo-handled': secondsAgo(5), 'teletraan-hidden-handled': secondsAgo(5), 'teletraan-announce-handled': secondsAgo(5), 'teletraan-presentation-test-handled': secondsAgo(5) } });
  other.content.settings.previewRequest = { kind: kind, requestedAt: secondsAgo(5) };
  other.look();
  assert.equal(holds(other), true);

  // storage that cannot be used still starts it once
  for (const storage of [brokenStorage, null]) {
    letGoOfPreview();
    const stored = previewWorld({ storage: storage });
    stored.request(kind, 2);
    stored.look();
    assert.equal(holds(stored), true);
    stored.later(1);
    stored.later(1);
    assert.equal(stored.asked.length, 1, 'the same request is not started twice');
  }

  // while an alert, an announcement, a talk, a demo, the night screen or a hidden transition has the screen it waits,
  // and it starts when it is over if the request is a minute old at most
  for (const name of ['takeover', 'demo', 'night', 'hidden']) {
    letGoOfPreview();
    const waiting = previewWorld();
    waiting[name] = true;
    waiting.request(kind, 1);
    waiting.look();
    assert.equal(holds(waiting), false, 'not while ' + name + ' has the screen');
    assert.deepEqual(waiting.store, {}, 'and the request is not used up');
    waiting.nowMs += 30 * 1000;
    waiting[name] = false;
    waiting.look();
    assert.equal(holds(waiting), true, 'half a minute later, after ' + name);

    letGoOfPreview();
    const late = previewWorld();
    late[name] = true;
    late.request(kind, 1);
    late.look();
    late.nowMs += 90 * 1000;
    late[name] = false;
    late.look();
    assert.equal(holds(late), false, 'a minute and a half later it is too old, after ' + name);
  }

  // a preview that is on goes on when something takes the screen, and ends on time
  letGoOfPreview();
  const covered = previewWorld();
  covered.request(kind, 1);
  covered.look();
  covered.takeover = true;
  covered.later(60);
  assert.equal(holds(covered), true, 'an alert does not end it');
  covered.takeover = false;
  covered.later(60);
  assert.equal(holds(covered), false, 'and does not make it longer');
  letGoOfPreview();
}

test('Preview Prime holds the Prime team for 2 minutes whatever Team mode says, and the guard is the demo\'s', () => {
  checkPreviewButton('prime');
  letGoOfPreview();

  // it is the team mode that is held, and the saved one is not written
  const world = previewWorld();
  world.request('prime', 1);
  world.look();
  assert.deepEqual(heldBy('prime', 'christmas'), { team: 'prime', style: '', pack: '' });
  assert.equal(teamSeen('nova', world.at(0)), 'prime', 'Nova only');
  assert.equal(teamSeen('alternate', world.at(0)), 'prime', 'Alternate');
  assert.equal(world.content.settings.teamMode, undefined, 'the settings are untouched');
  assert.equal(styleModule.chooseStyle('minimal', null, world.at(0)), 'minimal', 'the style is not held');
  assert.equal(themeModule.previewedPack(world.at(0)), '', 'nor the pack');

  // the items follow: the team that is wanted is the one the pages are built for
  assert.equal(teamsModule.showsForTeam({ team: 'nova' }, teamsModule.wantedTeam().code), false);
  assert.equal(teamsModule.showsForTeam({ team: 'prime' }, teamsModule.wantedTeam().code), true);
  letGoOfPreview();
});

test('Preview Nova holds the Nova team for 2 minutes whatever Team mode says, and falls back to Prime when there is no Nova', () => {
  checkPreviewButton('nova');
  letGoOfPreview();

  const world = previewWorld();
  world.request('nova', 1);
  world.look();
  assert.deepEqual(heldBy('nova', ''), { team: 'nova', style: '', pack: '' });
  assert.equal(teamSeen('prime', world.at(0)), 'nova', 'Prime only');
  assert.equal(teamSeen('alternate', world.at(0)), 'nova', 'Alternate');
  assert.equal(teamsModule.showsForTeam({ team: 'nova' }, teamsModule.wantedTeam().code), true);
  assert.equal(teamsModule.showsForTeam({ team: 'prime' }, teamsModule.wantedTeam().code), false);

  // a dataset with no Nova team document keeps the team it has, as Nova only does
  teamsModule.useTeams({ teams: [], settings: { teamMode: 'prime' } }, world.at(0));
  assert.equal(teamsModule.wantedTeam(), config.primeTeam);
  letGoOfPreview();
});

test('Preview Cybertron holds the Cybertron style for 2 minutes over the setting and the address, and the guard is the demo\'s', () => {
  checkPreviewButton('cybertron');
  letGoOfPreview();

  const world = previewWorld();
  world.request('cybertron', 1);
  world.look();
  assert.deepEqual(heldBy('cybertron', 'christmas'), { team: '', style: 'cybertron', pack: '' });
  ['original', 'minimal', 'cybertron', undefined, null, 'oops'].forEach(saved => {
    assert.equal(styleModule.chooseStyle(saved, null, world.at(10)), 'cybertron', 'the setting ' + saved);
    assert.equal(styleModule.chooseStyle(saved, 'minimal', world.at(10)), 'cybertron', 'the address wins over the setting and loses to the preview');
  });
  assert.equal(styleModule.layoutFor(styleModule.chooseStyle('original', null, world.at(10)), 'standard'), 'standard', 'its layout is the one of the theme');
  assert.equal(styleModule.layoutFor('cybertron', 'sidebar'), 'sidebar');
  assert.equal(styleModule.chooseStyle('minimal', 'original', world.at(121)), 'original', 'after the time the address wins again');
  assert.equal(teamSeen('nova', world.at(0)), 'nova', 'the team is not held');
  letGoOfPreview();
});

test('Preview Minimal holds the Minimal style for 2 minutes over the setting and the address, and the guard is the demo\'s', () => {
  checkPreviewButton('minimal');
  letGoOfPreview();

  const world = previewWorld();
  world.request('minimal', 1);
  world.look();
  assert.deepEqual(heldBy('minimal', 'christmas'), { team: '', style: 'minimal', pack: '' });
  ['original', 'cybertron', 'minimal', undefined, null, 'oops'].forEach(saved => {
    assert.equal(styleModule.chooseStyle(saved, null, world.at(10)), 'minimal', 'the setting ' + saved);
    assert.equal(styleModule.chooseStyle(saved, 'cybertron', world.at(10)), 'minimal', 'the address');
  });
  assert.equal(styleModule.shapesFor('minimal'), 'minimal', 'it brings the corners of its frames');
  assert.equal(styleModule.chooseStyle('cybertron', null, world.at(121)), 'cybertron', 'after the time the setting wins again');
  letGoOfPreview();
});

test('Preview next pack holds the pack after the one on the screen for 2 minutes, in the order of the registry, and the guard is the demo\'s', () => {
  checkPreviewButton('next-pack');
  letGoOfPreview();

  const packs = previewPacks();
  assert.deepEqual(packs, ['halloween', 'thanksgiving', 'christmas', 'new-years', 'valentines-day', 'competition-day', 'summer-break']);

  // each click moves on from the pack that is on the screen, a preview that is on included, and the last goes round to the first
  const world = previewWorld({ pack: '' });
  const held = [];
  for (let click = 0; click < packs.length + 1; click++) {
    world.nowMs += 1000;
    world.request('next-pack', 0);
    world.look();
    held.push(themeModule.previewedPack(world.at(0)));
    world.pack = held[held.length - 1];
  }
  assert.deepEqual(held, packs.concat(packs[0]));

  // it is the pack that is held, nothing else, and the Look page is not written
  assert.deepEqual(heldBy('next-pack', 'halloween'), { team: '', style: '', pack: 'thanksgiving' });
  assert.equal(styleModule.chooseStyle('minimal', null, world.at(10)), 'minimal');
  assert.equal(teamSeen('nova', world.at(0)), 'nova');
  assert.equal(world.content.theme, undefined);

  // and it is a known overlay, so the page can draw it, and it wins over the schedule and Use now
  held.forEach(id => assert.equal(themeModule.isKnownOverlay(id), true, id));
  assert.equal(themeModule.resolveTheme({ useNow: { overlay: 'none', until: '' } }, world.at(0)).overlay, '', 'resolveTheme does not know about previews: theme-apply.js puts one over its answer');
  letGoOfPreview();
});

test('the next pack is the one after the current in the order of the registry, the first with none or an unknown one, and never the placeholder', () => {
  const list = [{ id: 'a', decorations: true }, { id: 'b', decorations: true }, { id: 'placeholder', decorations: false }, { id: 'c', decorations: true }];
  assert.deepEqual(previewPacks(list), ['a', 'b', 'c']);
  assert.equal(nextPack('', list), 'a');
  assert.equal(nextPack('a', list), 'b');
  assert.equal(nextPack('b', list), 'c', 'the placeholder is skipped');
  assert.equal(nextPack('c', list), 'a', 'and after the last it is the first');
  [undefined, null, 'oops', 'placeholder', 7].forEach(current => assert.equal(nextPack(current, list), 'a', String(current)));
  assert.equal(nextPack('a', []), '');
  assert.equal(nextPack('a', [{ id: 'x', decorations: false }]), '');
  assert.equal(previewPacks().indexOf('example'), -1, 'the placeholder overlay of the registry is not a pack');
  assert.equal(nextPack('summer-break'), 'halloween');
});

test('a request with a kind the registry does not have, or with no time, starts nothing and is not used up', () => {
  letGoOfPreview();
  [{ kind: 'nope', requestedAt: secondsAgo(1) }, { kind: '', requestedAt: secondsAgo(1) }, { kind: 'prime', requestedAt: '' }, { kind: 'prime', requestedAt: 'whenever' }, { kind: 7, requestedAt: secondsAgo(1) }].forEach(request => {
    const world = previewWorld();
    world.content.settings.previewRequest = request;
    world.look();
    assert.equal(world.runner.isActive(), false, JSON.stringify(request));
    assert.deepEqual(world.store, {}, JSON.stringify(request));
    assert.deepEqual(world.asked, []);
  });

  const world = previewWorld();
  [null, undefined, {}, { settings: null }, { settings: {} }, { settings: { previewRequest: null } }, { settings: { previewRequest: {} } }].forEach(content => {
    world.content = content;
    world.look();
  });
  [{ requestedAt: '' }, { requestedAt: 'tomorrow' }, 'now', [], 4].forEach(request => {
    world.content = { settings: { previewRequest: request } };
    world.look();
  });
  assert.equal(world.runner.isActive(), false);
  letGoOfPreview();
});

test('tidyPreviewRequest always gives a kind and a time, each empty when it is not usable', () => {
  const when = secondsAgo(3);
  assert.deepEqual(tidyPreviewRequest({ kind: 'nova', requestedAt: when }), { kind: 'nova', requestedAt: when });
  assert.deepEqual(tidyPreviewRequest({ kind: 'nope', requestedAt: when }), { kind: '', requestedAt: when });
  assert.deepEqual(tidyPreviewRequest({ kind: 'nova', requestedAt: 'whenever' }), { kind: 'nova', requestedAt: '' });
  assert.deepEqual(tidyPreviewRequest({ kind: 'toString', requestedAt: when }), { kind: '', requestedAt: when }, 'a name every object has is not a kind');
  [undefined, null, when, 4, [], {}].forEach(value => assert.deepEqual(tidyPreviewRequest(value), { kind: '', requestedAt: '' }, JSON.stringify(value)));
  assert.deepEqual(Object.keys(tidyPreviewRequest({ kind: 'nova', requestedAt: when, extra: 1 })), ['kind', 'requestedAt']);
  assert.deepEqual(config.defaultSettings.previewRequest, { kind: '', requestedAt: '' });
});

test('the five kinds are the five buttons, each holds one thing that exists, and the handled and active notes have names of their own', () => {
  assert.deepEqual(Object.keys(previewKinds), ['prime', 'nova', 'cybertron', 'minimal', 'next-pack']);
  assert.deepEqual(Object.keys(previewKinds).map(id => previewKinds[id].name), ['Prime', 'Nova', 'Cybertron', 'Minimal', 'next pack']);
  Object.keys(previewKinds).forEach(id => {
    const entry = previewKinds[id];
    assert.deepEqual(['team', 'style', 'pack'].filter(name => entry[name] !== undefined).length, 1, id);
    assert.ok(entry.team === undefined || config.teamModes.indexOf(entry.team) !== -1, id);
    assert.ok(entry.style === undefined || config.styles.indexOf(entry.style) !== -1, id);
    assert.ok(entry.pack === undefined || entry.pack === 'next', id);
  });
  assert.deepEqual(heldBy('oops', 'christmas'), { team: '', style: '', pack: '' });
  assert.deepEqual(heldBy(undefined, ''), { team: '', style: '', pack: '' });

  assert.equal(preview.handledKey, 'teletraan-preview-handled');
  assert.equal(preview.activeKey, 'teletraan-preview-active');
  [announce.handledKey, presentationTest.handledKey, hidden.handledKey, demo.handledKey, preview.activeKey].forEach(key => assert.notEqual(preview.handledKey, key));

  const store = {};
  const storage = makeStorage(store);
  assert.equal(readHandledPreview(storage), '');
  assert.equal(rememberHandledPreview(storage, secondsAgo(5)), true);
  assert.deepEqual(store, { 'teletraan-preview-handled': secondsAgo(5) });
  assert.equal(readHandledPreview(brokenStorage), '');
  assert.equal(readHandledPreview(null), '');
  assert.equal(rememberHandledPreview(brokenStorage, secondsAgo(5)), false);
  assert.equal(rememberHandledPreview(null, secondsAgo(5)), false);
});

test('a preview that is on when the page reloads goes on for the time it has left, and one that is over, odd or unreadable does not', () => {
  letGoOfPreview();
  const world = previewWorld();
  world.request('cybertron', 1);
  world.look();
  const record = JSON.parse(world.store['teletraan-preview-active']);
  assert.deepEqual(record, { until: world.nowMs + 120 * 1000, held: { team: '', style: 'cybertron', pack: '' } });

  // the page reloads: the modules start empty, and the screen puts the preview back before it chooses the style
  letGoOfPreview();
  assert.equal(styleModule.chooseStyle('original', null, world.at(30)), 'original');
  const resumed = resumePreview(makeStorage(world.store), world.at(30));
  assert.deepEqual(resumed, record);
  assert.equal(styleModule.chooseStyle('original', null, world.at(30)), 'cybertron');
  assert.equal(styleModule.chooseStyle('original', null, world.at(119)), 'cybertron');
  assert.equal(styleModule.chooseStyle('original', null, world.at(120)), 'original', 'it ends when it would have ended');

  // the runner that starts after the reload ends it on time and clears the note
  const after = previewWorld({ store: world.store });
  after.nowMs = world.nowMs + 119 * 1000;
  after.look();
  assert.equal(after.runner.isActive(), true);
  assert.ok('teletraan-preview-active' in after.store);
  after.later(1);
  assert.equal(after.runner.isActive(), false);
  assert.equal('teletraan-preview-active' in after.store, false);
  assert.deepEqual(after.asked, [{ team: '', style: 'cybertron', pack: '' }], 'the page is told to look again');

  // one that is over is dropped, and so is anything that is not a preview
  letGoOfPreview();
  const over = { 'teletraan-preview-active': JSON.stringify(record) };
  assert.equal(resumePreview(makeStorage(over), world.at(121)), null);
  assert.equal('teletraan-preview-active' in over, false, 'and forgotten');
  assert.equal(styleModule.chooseStyle('original', null, world.at(121)), 'original');
  ['', 'oops', '[]', '4', 'null', '{}', JSON.stringify({ until: 'soon', held: {} }), JSON.stringify({ until: record.until }), JSON.stringify({ until: record.until, held: 'cybertron' })].forEach(text => {
    letGoOfPreview();
    assert.equal(resumePreview(makeStorage({ 'teletraan-preview-active': text }), world.at(30)), null, text);
    assert.equal(styleModule.chooseStyle('original', null, world.at(30)), 'original', text);
  });
  assert.equal(resumePreview(brokenStorage, world.at(30)), null);
  assert.equal(resumePreview(null, world.at(30)), null);

  // a held value that is not a mode, a style or an overlay is let go
  const odd = resumePreview(makeStorage({ 'teletraan-preview-active': JSON.stringify({ until: record.until, held: { team: 'both', style: 'neon', pack: 'oops' } }) }), world.at(30));
  assert.deepEqual(odd.held, { team: '', style: '', pack: '' });
  assert.equal(styleModule.chooseStyle('original', null, world.at(30)), 'original');
  assert.equal(themeModule.previewedPack(world.at(30)), '');
  letGoOfPreview();
});

test('a preview that cannot write its note still runs, and ends at its time', () => {
  letGoOfPreview();
  const world = previewWorld({ storage: brokenStorage });
  world.request('minimal', 1);
  world.look();
  assert.equal(styleModule.chooseStyle('original', null, world.at(10)), 'minimal');
  world.later(121);
  assert.equal(world.runner.isActive(), false);
  assert.equal(styleModule.chooseStyle('original', null, world.at(0)), 'original');
  letGoOfPreview();
});

test('previewStyle, previewTeam and previewPack take only a style, a mode and an overlay, a time that is a number, and a new call replaces the one before', () => {
  letGoOfPreview();
  const now = demoNow;
  const until = now.getTime() + 1000;

  ['neon', '', undefined, null, 4].forEach(value => {
    styleModule.previewStyle(value, until);
    assert.equal(styleModule.chooseStyle('minimal', null, now), 'minimal', String(value));
    teamsModule.previewTeam(value, until);
    assert.equal(teamSeen('prime', now), 'prime', String(value));
    themeModule.previewPack(value, until);
    assert.equal(themeModule.previewedPack(now), '', String(value));
  });
  [undefined, null, '5', NaN, Infinity].forEach(time => {
    styleModule.previewStyle('cybertron', time);
    assert.equal(styleModule.chooseStyle('original', null, now), 'original', String(time));
    teamsModule.previewTeam('nova', time);
    assert.equal(teamSeen('prime', now), 'prime', String(time));
    themeModule.previewPack('christmas', time);
    assert.equal(themeModule.previewedPack(now), '', String(time));
  });

  styleModule.previewStyle('cybertron', until);
  styleModule.previewStyle('minimal', until);
  assert.equal(styleModule.chooseStyle('original', null, now), 'minimal');
  styleModule.previewStyle('', 0);
  assert.equal(styleModule.chooseStyle('original', null, now), 'original', 'an empty name lets go');
  assert.equal(styleModule.chooseStyle('original', null), 'original', 'the clock of the page is the default');

  teamsModule.previewTeam('alternate', until);
  assert.equal(teamSeen('nova', now), teamsModule.chooseTeam([config.primeTeam, novaTeam], 'alternate', 5, now).code, 'Alternate can be held too, and the clock decides');
  letGoOfPreview();
});

test('?team= holds a mode for the page like ?style=, a preview wins over it, and a name that is not a mode is ignored', () => {
  letGoOfPreview();
  assert.equal(teamSeen('prime', demoNow), 'prime');
  teamsModule.askForTeam('nova');
  assert.equal(teamSeen('prime', demoNow), 'nova', 'the address wins over Team mode');
  teamsModule.previewTeam('prime', demoNow.getTime() + 1000);
  assert.equal(teamSeen('prime', demoNow), 'prime', 'a preview wins over the address');
  assert.equal(teamSeen('prime', new Date(demoNow.getTime() + 2000)), 'nova', 'and when it is over the address is back');
  ['oops', '', null, undefined, 'both'].forEach(value => {
    teamsModule.previewTeam('', 0);
    teamsModule.askForTeam('nova');
    teamsModule.askForTeam(value);
    assert.equal(teamSeen('prime', demoNow), 'prime', String(value));
  });
  letGoOfPreview();
});

test('the preview functions import only the config, the registry of overlays, the demo functions and the three modules they hold, and use no page, and the screen code that runs them is started after the others', () => {
  const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');
  const code = text => text.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');

  assert.deepEqual(read('core/preview.js').split('\n').filter(line => /^import /.test(line)), [
    "import { previewSeconds, styles, teamModes } from '../config.js';",
    "import { overlays } from '../themes/overlays/registry.js';",
    "import { readHandled, rememberHandled, shouldRunDemo } from './demo.js';",
    "import { previewStyle } from './style.js';",
    "import { previewTeam } from './teams.js';",
    "import { isKnownOverlay, previewPack } from './theme.js';",
  ]);
  assert.ok(!/\bdocument\b|\bwindow\b|\bimport\(/.test(code(read('core/preview.js'))), 'no page in preview.js');
  ['animate(', 'transition', 'requestAnimationFrame', 'keyframes', 'setTimeout', 'setInterval'].forEach(word => assert.ok(!code(read('core/preview.js')).includes(word), 'preview.js does not animate or keep time: ' + word));

  // the real screen: it asks what can have the screen, tells the page to look again and moves the pages on for a style or a pack
  const run = read('core/preview-run.js');
  ['demoRunning', 'nightIsUp', 'hiddenPlaying'].forEach(name => assert.ok(run.includes("'" + name + "'"), name));
  assert.ok(run.includes('takeoverRunning: takeoverRunning,') && run.includes('packOnScreen: overlayShown,') && run.includes('lookAgain: lookAgain,'));
  assert.ok(/if \(held\.style === '' && held\.pack === ''\) return;\s*\n\s*checkTheme\(\);\s*\n\s*moveOn\(\['grid1', 'grid2', 'ticker'\]\);/.test(run), 'a team is followed by core/team-run.js, a style or a pack is asked for here');
  assert.ok(!/localStorage\.setItem|setProperty|dataset|classList/.test(code(run)), 'the runner writes nothing to the page or the settings itself');

  const shell = read('shell.js');
  const previewing = shell.indexOf("startOptional('./core/preview-run.js', module => module.startPreviewRunner(getContent))");
  assert.ok(previewing > shell.indexOf("startOptional('./core/presentation-test-run.js'"), 'after the presentation test');
  assert.ok(previewing > shell.indexOf("startOptional('./core/announce-run.js'"), 'after the announcements');
  assert.ok(previewing > shell.indexOf("startOptional('./core/hidden-run.js'"), 'after the hidden transitions');
  assert.ok(previewing > shell.indexOf("startOptional('./core/demo-runner.js'"), 'after the demo runner');
  assert.ok(previewing > shell.indexOf('startTakeovers(getContent);'), 'after the takeovers');
  assert.ok(shell.lastIndexOf("if (!params.get('show') && !stress) {", previewing) > shell.lastIndexOf('startNight', previewing) - 2000, 'only when the whole screen runs');

  // a preview that reloaded the page goes back on before the style and the layout are chosen
  const resuming = shell.indexOf('resumeSavedPreview();');
  assert.ok(resuming !== -1 && resuming < shell.indexOf("const style = startStyle(params.get('style'), savedStyle);"), 'before the style');
  assert.ok(shell.indexOf("askForTeam(params.get('team'));") > resuming && shell.indexOf("askForTeam(params.get('team'));") < shell.indexOf('const style = startStyle('));
  assert.ok(/\/\/   team=prime\|nova\|alternate /.test(shell), 'the switch is in the list at the top');

  // the style and the team are asked once a second or at every look, so a preview needs nothing more there; the pack is read in theme-apply.js
  assert.ok(read('core/theme-apply.js').includes('look.overlay = previewedPack() || look.overlay;'));
  assert.ok(read('core/content.js').includes('settings.previewRequest = tidyPreviewRequest(settings.previewRequest);'));
});

// The Neon Prime kit (frame.js, "The Neon Prime kit"): the two events that frame.js drives, the name
// glitch and the burst of bars when a new page arrives in the large frame, and the attribute that
// tells neon-kit.css when the rest may move. The shapes and keyframes are not tested here.

// Runs a test body with Math.random replaced. seeded() is the number generator with a fixed seed
// above, so a test of many glitches is the same every time.
async function withRandom(random, run) {
  const real = Math.random;
  Math.random = random;
  try {
    await run();
  } finally {
    Math.random = real;
  }
}

// frame.js with the kit on and nothing else playing: the name effect and the glitch of the screen are off
async function inKitPage(run) {
  await withRandom(seeded(7), async () => {
    await inPage(async world => {
      world.frame.setNameEffect(false, 300, 1.43);
      world.frame.setCrt(false, 240, 2.7);
      world.glitchStarts = () => world.kit.filter(item => item.what === 'glitching' && item.event === 'start').map(item => item.at);
      world.glitchEnds = () => world.kit.filter(item => item.what === 'glitching' && item.event === 'end').map(item => item.at);
      world.burstStarts = () => world.kit.filter(item => item.what === 'bursting' && item.event === 'start').map(item => item.at);
      world.burstEnds = () => world.kit.filter(item => item.what === 'bursting' && item.event === 'end').map(item => item.at);
      world.largeArea = () => ({ dataset: { area: 'grid1', state: 'xo' }, getAnimations: () => [] });
      await run(world);
    });
  });
}

test('the gap between two name glitches is 12 to 25 seconds, a new number each time, and never outside them', () => {
  const frame = new Promise(resolve => resolve());
  return frame.then(async () => {
    await inPage(async world => {
      const gap = world.frame.kitGlitchGap;
      assert.deepEqual(world.frame.kitGlitchGapSeconds, { least: 12, most: 25 });
      assert.equal(gap(() => 0), 12);
      assert.equal(gap(() => 1), 25);
      assert.equal(gap(() => 0.5), 18.5);
      assert.equal(gap(() => -3), 12, 'a number below 0 is the least');
      assert.equal(gap(() => 9), 25, 'a number above 1 is the most');

      const random = seeded(99);
      const gaps = [];
      for (let count = 0; count < 500; count += 1) gaps.push(gap(random));
      assert.ok(gaps.every(seconds => seconds >= 12 && seconds <= 25), 'every gap is 12 to 25 seconds');
      assert.ok(new Set(gaps.map(seconds => Math.round(seconds * 10))).size > 100, 'the gaps are not all alike');
      assert.ok(gaps.some(seconds => seconds < 14) && gaps.some(seconds => seconds > 23), 'both ends of the range are used');
    });
  });
});

test('the kit starts nothing until it is switched on, and switching it on or off starts or ends the series', async () => {
  await inKitPage(async world => {
    await world.advance(300 * second);
    assert.deepEqual(world.kit, [], 'the kit is off by default: nothing plays');
    assert.equal(world.pageData.kit, undefined, 'and data-kit is not on the page');

    world.frame.setKit(true);
    assert.equal(world.pageData.kit, 'on');
    await world.advance(60 * second);
    assert.ok(world.glitchStarts().length >= 2, 'a glitch every 12 to 25 seconds');

    world.frame.setKit(false);
    assert.equal(world.pageData.kit, undefined, 'the page says the kit is off');
    const before = world.kit.length;
    await world.advance(300 * second);
    assert.equal(world.kit.length, before, 'nothing plays once the kit is off');
  });
});

test('a name glitch lasts .4 seconds, comes 12 to 25 seconds after the last one, and no two are alike', async () => {
  await inKitPage(async world => {
    world.frame.setKit(true);
    await world.advance(1200 * second);

    const starts = world.glitchStarts();
    const ends = world.glitchEnds();
    assert.ok(starts.length > 50, 'about 65 glitches in 20 minutes, there were ' + starts.length);
    assert.equal(ends.length, starts.length);
    starts.forEach((start, place) => assert.equal(ends[place] - start, 400, 'each glitch lasts .4 s'));

    assert.ok(starts[0] >= 12000 && starts[0] <= 25000, 'the first one is 12 to 25 seconds after the kit went on, not at once: ' + starts[0]);
    const gaps = starts.slice(1).map((start, place) => start - starts[place]);
    assert.ok(gaps.every(milliseconds => milliseconds >= 12000 && milliseconds <= 25000), 'every gap is 12 to 25 seconds: ' + Math.min.apply(null, gaps) + ' to ' + Math.max.apply(null, gaps));
    assert.ok(new Set(gaps).size > gaps.length / 2, 'the gaps are irregular');
    assert.ok(gaps.some(milliseconds => milliseconds < 15000) && gaps.some(milliseconds => milliseconds > 22000), 'short gaps and long ones');
  });
});

test('the Speed setting stretches the glitch and the burst, and not the gaps', async () => {
  await inKitPage(async world => {
    world.frame.setSpeed('very-slow'); // twice as long
    world.frame.setKit(true);
    await world.advance(100 * second);
    assert.ok(world.glitchStarts().length >= 3);
    world.glitchStarts().forEach((start, place) => assert.equal(world.glitchEnds()[place] - start, 800, 'twice .4 s'));

    world.frame.arrive(world.largeArea(), false);
    const at = world.now;
    await world.advance(2000);
    assert.deepEqual(world.burstStarts(), [at]);
    assert.deepEqual(world.burstEnds(), [at + 600], 'twice .3 s');
  });
});

// What stops the kit, one at a time. Each says how to start it, how to stop it, and whether data-kit
// stays on while it is on: the demo and a page change only hold back the two events
const kitBlocks = [
  ['calm motion', world => world.frame.setMotion('calm'), world => world.frame.setMotion('full'), undefined],
  ['no motion', world => world.frame.setMotion('none'), world => world.frame.setMotion('full'), undefined],
  ['the night screen', world => world.frame.setNightCovers(true), world => world.frame.setNightCovers(false), undefined],
  ['a hidden transition', world => world.frame.setHiddenPlaying(true), world => world.frame.setHiddenPlaying(false), undefined],
  ['a talk', world => world.frame.pause('talk'), world => world.frame.resume('talk'), undefined],
  ['an alert or an announcement', world => world.frame.setTakeoverCovers(true), world => world.frame.setTakeoverCovers(false), undefined],
  ['a demo', world => world.frame.setEffectsPaused(true), world => world.frame.setEffectsPaused(false), 'on'],
];

kitBlocks.forEach(entry => {
  test('the name glitch is silent during ' + entry[0] + ', and is not saved up: the series carries on at its own times after it', async () => {
    await inKitPage(async world => {
      world.frame.setKit(true);
      await world.advance(40 * second);
      const before = world.glitchStarts().length;
      assert.ok(before >= 1);

      entry[1](world);
      assert.equal(world.pageData.kit, entry[3], 'data-kit while ' + entry[0]);
      await world.advance(600 * second);
      assert.equal(world.glitchStarts().length, before, 'no glitch during ' + entry[0]);
      assert.equal(world.name.classList.contains('glitching'), false);

      entry[2](world);
      assert.equal(world.pageData.kit, 'on', 'data-kit is back');
      const resumed = world.now;
      await world.advance(120 * second);
      const starts = world.glitchStarts().slice(before);
      assert.ok(starts.length >= 3 && starts.length <= 10, 'glitches go on at the normal gaps, and no burst of the ones missed: ' + starts.length);
      assert.ok(starts[0] - resumed <= 25000, 'the first one is within the longest gap');
      assert.ok(starts.slice(1).every((start, place) => start - starts[place] >= 12000), 'still 12 seconds apart at least');
    });
  });
});

test('a glitch that is playing ends on the spot when something covers the screen, and the timers are cleared when the kit goes', async () => {
  await inKitPage(async world => {
    world.frame.setKit(true);
    const pending = () => world.timers.filter(timer => timer.at - world.now > 2000 && !timer.every).length;
    assert.equal(pending(), 1, 'one timer waits for the first glitch');

    await world.advance(30 * second);
    let start = world.glitchStarts().length;
    assert.ok(start >= 1);
    assert.equal(pending(), 1, 'one timer waits for the next');

    // wait for the middle of a glitch
    while (!world.name.classList.contains('glitching')) await world.advance(50);
    world.frame.setNightCovers(true);
    assert.equal(world.name.classList.contains('glitching'), false, 'the night screen ends it at once');
    world.frame.setNightCovers(false);

    while (!world.name.classList.contains('glitching')) await world.advance(50);
    world.frame.setKit(false);
    assert.equal(world.name.classList.contains('glitching'), false, 'switching the kit off ends it at once');
    assert.equal(pending(), 0, 'and no timer is left waiting');
    const ends = world.glitchEnds().length;
    await world.advance(100 * second);
    assert.equal(world.glitchEnds().length, ends);
    assert.equal(pending(), 0);

    world.frame.setKit(true);
    assert.equal(pending(), 1, 'switching it on again starts the series again');
    world.frame.setMotion('calm');
    assert.equal(pending(), 0, 'and calm motion clears the timer too');
    world.frame.setMotion('full');
    assert.equal(pending(), 1, 'and full motion sets it again');
    world.frame.setKit(true);
    world.frame.setKit(true);
    assert.equal(pending(), 1, 'asked again and again it is still one timer, because shell.js calls it at every look and every content change');
  });
});

test('the name glitch waits for the name effect and for a page change instead of playing over them', async () => {
  await withRandom(() => 0, async () => { // the shortest gap every time: 12 seconds
    await inPage(async world => {
      world.frame.setCrt(false, 240, 2.7);
      world.frame.setNameEffect(true, 300, 20); // plays from 2 to 22 seconds
      world.frame.setKit(true);

      await world.advance(23 * second);
      const nameStarts = world.starts('name');
      assert.deepEqual(nameStarts, [2000]);
      assert.deepEqual(world.kit.filter(item => item.what === 'glitching'), [], 'the glitch due at 12 seconds was skipped while the name effect played');

      await world.advance(2 * second);
      assert.deepEqual(world.kit.filter(item => item.what === 'glitching' && item.event === 'start').map(item => item.at), [24000], 'the next one, 12 seconds later, plays');

      const area = world.addArea('xo'); // a page is changing
      await world.advance(60 * second);
      assert.equal(world.kit.filter(item => item.what === 'glitching' && item.event === 'start').length, 1, 'none while a page changes');
      area.dataset.state = 'shown';
      await world.advance(13 * second);
      assert.equal(world.kit.filter(item => item.what === 'glitching' && item.event === 'start').length, 2, 'and the next gap after it is over, it plays again');
    });
  });
});

test('the page burst plays for .3 seconds when a new page arrives in the large frame, and for no other arrival', async () => {
  await inKitPage(async world => {
    world.frame.setKit(true);

    const first = world.largeArea();
    world.frame.arrive(first, true); // the first page: the frame is still assembling
    await world.advance(6 * second);
    assert.deepEqual(world.kit.filter(item => item.what === 'bursting'), [], 'not for the first page');

    const ticker = { dataset: { area: 'ticker', state: 'xo' }, getAnimations: () => [] };
    const small = { dataset: { area: 'grid2', state: 'xo' }, getAnimations: () => [] };
    world.frame.arrive(ticker, false);
    world.frame.arrive(small, false);
    await world.advance(6 * second);
    assert.deepEqual(world.kit.filter(item => item.what === 'bursting'), [], 'not for the ticker or the small frame');

    const next = world.largeArea();
    const at = world.now;
    world.frame.arrive(next, false);
    assert.equal(next.dataset.state, 'xi', 'the page still arrives the way it did');
    await world.advance(6 * second);
    assert.deepEqual(world.burstStarts(), [at]);
    assert.deepEqual(world.burstEnds(), [at + 300]);
    assert.equal(next.dataset.state, 'shown', 'and it arrives as before');

    // asked twice while it plays, it is one burst
    world.frame.arrive(world.largeArea(), false);
    world.frame.arrive(world.largeArea(), false);
    await world.advance(second);
    assert.equal(world.burstStarts().length, 2);
  });
});

kitBlocks.forEach(entry => {
  test('the page burst is silent during ' + entry[0], async () => {
    await inKitPage(async world => {
      world.frame.setKit(true);
      entry[1](world);
      world.frame.arrive(world.largeArea(), false);
      await world.advance(2 * second);
      assert.deepEqual(world.burstStarts(), [], 'no burst during ' + entry[0]);

      entry[2](world);
      const at = world.now;
      world.frame.arrive(world.largeArea(), false);
      await world.advance(2 * second);
      assert.deepEqual(world.burstStarts(), [at], 'and one when it is over');
    });
  });
});

test('the page burst is not played while the kit is off, and a burst in the middle ends when the kit goes', async () => {
  await inKitPage(async world => {
    world.frame.arrive(world.largeArea(), false);
    await world.advance(2 * second);
    assert.deepEqual(world.burstStarts(), [], 'the kit is off');

    world.frame.setKit(true);
    world.frame.arrive(world.largeArea(), false);
    assert.equal(world.pane.classList.contains('bursting'), true);
    world.frame.setKit(false);
    assert.equal(world.pane.classList.contains('bursting'), false, 'switching the kit off ends it at once');
    await world.advance(2 * second);
    assert.equal(world.burstEnds().length, 1, 'once, and the timer that was waiting for its end did not end it again');
  });
});

test('a page change goes on arriving when the kit has nothing to find in the page', async () => {
  await inKitPage(async world => {
    world.frame.setKit(true);
    const find = document.querySelector;
    document.querySelector = selector => {
      if (selector === '.kit-pane') throw new Error('the page has no kit');
      return find(selector);
    };
    const area = world.largeArea();
    const logged = [];
    const realError = console.error;
    console.error = (...parts) => logged.push(parts.join(' '));
    let arrived;
    try {
      arrived = world.frame.arrive(area, false);
    } finally {
      console.error = realError;
    }
    await world.advance(6 * second);
    await arrived;
    assert.equal(area.dataset.state, 'shown');
    assert.ok(logged.some(line => /page change burst failed/.test(line)), 'and says what failed');
  });
});

test('the kit is on in frame.js only when told, never from an import, and shell.js tells it for Neon Prime in the sidebar layout', () => {
  const frame = fs.readFileSync(path.join(dashboardFolder, 'frame.js'), 'utf8');
  const kit = frame.slice(frame.indexOf('// The Neon Prime kit\n'));
  assert.ok(kit.length > 1000, 'the kit section is in frame.js');
  assert.ok(!/setInterval/.test(kit), 'one timer at a time, no repeating timer');
  assert.ok(!/requestAnimationFrame|\.animate\(|style\.setProperty|\.style\./.test(kit), 'the kit adds no animation code of its own: a class, and the stylesheet does the rest');
  assert.equal((kit.match(/setTimeout\(/g) || []).length, 3, 'a glitch timer, and the end of a glitch and of a burst');
  assert.equal((kit.match(/clearTimeout\(/g) || []).length, 3, 'each is cleared');

  const shell = fs.readFileSync(path.join(dashboardFolder, 'shell.js'), 'utf8');
  assert.ok(/frame\.setKit\(hasKit\(look\.theme, layoutNow\(\)\) && params\.get\('kit'\) !== 'off'\)/.test(shell), 'shell.js switches the kit with each look, and ?kit=off switches it off');
  const takeover = fs.readFileSync(path.join(dashboardFolder, 'core/takeover.js'), 'utf8');
  assert.ok(/frame\.setTakeoverCovers\(true\)/.test(takeover) && /frame\.setTakeoverCovers\(false\)/.test(takeover), 'an alert and an announcement tell the kit when they start and end');
});

// frame.js: one hold on the whole screen, for a talk

test('while the screen is paused no effect starts and none waits, and the effects that were due play once it is resumed', async () => {
  await inPage(async world => {
    world.frame.setNameEffect(false, 300, 1.43);
    world.frame.setCrt(true, 30, 2.7);

    assert.equal(world.frame.isPaused(), false);
    world.frame.pause('talk');
    world.frame.pause('talk'); // asked again, and nothing changes
    assert.equal(world.frame.isPaused(), true);
    assert.equal(world.pageData.paused, 'on', 'the stylesheets stop the glint and the seasonal pieces');
    await world.advance(100 * second);
    assert.deepEqual(world.log, [], 'the glitch has been due since 30 seconds');

    world.frame.playCrt(); // asked for by hand, which waits too
    await world.advance(10 * second);
    assert.deepEqual(world.log, []);

    world.frame.resume('talk');
    assert.equal(world.frame.isPaused(), false);
    assert.equal(world.pageData.paused, undefined, 'the page is not marked paused any more');
    await world.advance(second);
    assert.equal(world.starts('glitch').length, 1, 'one late play, not a burst');
  });
});

test('the hold is kept by reason: it lasts until every reason is resumed, and a reason that was never paused changes nothing', async () => {
  await inPage(async world => {
    world.frame.setNameEffect(false, 300, 1.43);
    world.frame.setCrt(true, 30, 2.7);

    world.frame.resume('talk');
    assert.equal(world.frame.isPaused(), false);
    assert.equal(world.pageData.paused, undefined);

    world.frame.pause('talk');
    world.frame.pause('test');
    world.frame.resume('talk');
    assert.equal(world.frame.isPaused(), true, 'the other reason still holds the screen');
    assert.equal(world.pageData.paused, 'on');
    await world.advance(100 * second);
    assert.deepEqual(world.log, []);

    world.frame.resume('test');
    world.frame.resume('test'); // resumed again, and nothing changes
    assert.equal(world.frame.isPaused(), false);
    assert.equal(world.pageData.paused, undefined);
    await world.advance(second);
    assert.equal(world.starts('glitch').length, 1);
  });
});

test('a glitch that is playing when the screen is paused ends on the spot, and so does a spin of the logo', async () => {
  await inPage(async world => {
    world.frame.setNameEffect(false, 300, 1.43);
    world.frame.setCrt(true, 30, 2.7);

    await world.advance(30500); // the glitch started at 30 seconds and plays until 32.7
    assert.deepEqual(world.starts('glitch'), [30000]);
    world.frame.pause('talk');
    assert.deepEqual(world.ends('glitch'), [30500], 'ended on the spot');
    await world.advance(10 * second);
    assert.deepEqual(world.ends('glitch'), [30500], 'its clock running out ends nothing twice');
  });

  await inPage(async world => {
    world.frame.setLogoAnimations(true, false);
    world.frame.setSpin(true, 10, 1.6);
    world.frame.setHawk(false, 0, 11);
    world.frame.setNameEffect(false, 300, 1.43);
    world.frame.setCrt(false, 240, 2.7);
    world.frame.startLogo(world.logo);

    await world.advance(11 * second);
    assert.equal(world.starts('spin').length >= 1, true);
    world.frame.pause('talk');
    assert.equal(world.logo.dataset.act, 'rest', 'back to the still emblem');

    const before = world.starts('spin').length;
    await world.advance(100 * second);
    assert.equal(world.starts('spin').length, before, 'and no more while the screen is paused');
  });
});

test('the screen stays paused through a change of motion, and the effects do not start by themselves when it goes back to full', async () => {
  await inPage(async world => {
    world.frame.setNameEffect(false, 300, 1.43);
    world.frame.setCrt(true, 30, 2.7);

    world.frame.pause('talk');
    world.frame.setMotion('calm');
    world.frame.setMotion('full');
    await world.advance(100 * second);
    assert.deepEqual(world.log, []);
    assert.equal(world.frame.isPaused(), true);
  });
});

test('the glint and the seasonal pieces stop while the screen is paused, in the stylesheets', () => {
  const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');

  assert.ok(/\[data-glint="off"\] \.glint-layer,\s*\[data-paused\] \.glint-layer,[^{]*\{ display: none; \}/.test(read('frame.css')), 'the glint is not drawn');
  assert.ok(read('seasons/motion.css').includes('html[data-paused] .season-piece { animation-play-state: paused; }'), 'the pieces stand still');
});

test('only frame.js, schedule.js and takeover.js ask whether the screen is paused, and everything that waits for a cover asks takeoverRunning', () => {
  const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');
  const code = text => text.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');

  // the rotation and the ticker wait, and a page does not use up its stay
  const schedule = code(read('core/schedule.js'));
  assert.ok(/function rotationPaused\(\) \{\s*return pauses > 0 \|\| frame\.isPaused\(\);\s*\}/.test(schedule));
  assert.ok(schedule.includes('if (!rotationPaused()) left -= 250;'));
  assert.ok(schedule.includes('while (rotationPaused()) await frame.wait(250);'));
  assert.equal((schedule.match(/frame\.isPaused\(\)/g) || []).length, 1, 'asked in one place');

  // the others ask this one, so a hold is a cover to all of them
  const takeover = code(read('core/takeover.js'));
  assert.ok(/export function takeoverRunning\(\) \{\s*return running !== null \|\| frame\.isPaused\(\);\s*\}/.test(takeover));
  ['core/hidden-run.js', 'core/night-screen.js', 'core/announce-run.js', 'core/demo-runner.js', 'core/announce.js', 'core/demo.js', 'core/hidden.js', 'core/presentation-test.js', 'core/presentation-test-run.js', 'shell.js'].forEach(file => {
    assert.ok(!/isPaused|frame\.pause|frame\.resume/.test(code(read(file))), file + ' asks takeoverRunning and not the pause');
  });
  ['core/hidden-run.js', 'core/night-screen.js', 'core/announce-run.js', 'core/demo-runner.js', 'core/presentation-test-run.js', 'shell.js'].forEach(file => {
    assert.ok(read(file).includes('takeoverRunning'), file + ' asks takeoverRunning');
  });

  const frame = code(read('frame.js'));
  assert.ok(frame.includes('export function pause(reason)') && frame.includes('export function resume(reason)') && frame.includes('export function isPaused()'));
  assert.ok(frame.includes("if (motion !== 'full' || nightCovers || hiddenPlaying) return;\n  if (isPaused()) return;"), 'no effect comes due while it is paused');
});

// takeover.js on a fake page. The real file runs with stand-ins for frame.js, the panels and the
// rotation: the clock is a function the test calls, and the screen is paused when the test says so.

const takeoverTree = path.join(workFolder, 'takeover-tree');
['core/takeover.js', 'core/text.js', 'core/time.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(takeoverTree, 'dashboard', file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(takeoverTree, 'dashboard', file));
});
fs.writeFileSync(path.join(takeoverTree, 'package.json'), '{ "type": "module" }\n');
fs.writeFileSync(path.join(takeoverTree, 'dashboard/frame.js'), [
  'export const onSecond = listener => { globalThis.takeoverWorld.listener = listener; };',
  'export const isPaused = () => globalThis.takeoverWorld.paused;',
  'export const wait = () => new Promise(resolve => setImmediate(resolve));',
  'export const enter = async () => {};',
  'export const exit = async () => {};',
  'export const setTakeoverCovers = () => {};',
  'export const playCrt = () => {};',
].join('\n') + '\n');
fs.writeFileSync(path.join(takeoverTree, 'dashboard/core/panels.js'), [
  'export function mountPanel(id, content) {',
  "  globalThis.takeoverWorld.shown.push(id + (content.announcement ? ': ' + content.announcement.text : ''));",
  '  return { remove() {} };',
  '}',
].join('\n') + '\n');
fs.writeFileSync(path.join(takeoverTree, 'dashboard/core/schedule.js'), [
  'export const pauseRotation = () => {};',
  'export const resumeRotation = () => {};',
].join('\n') + '\n');
let takeovers = 0;

async function inTakeoverPage(announcements, run) {
  const world = { paused: false, listener: null, shown: [], settings: { alert: { on: false }, announcements: announcements } };
  globalThis.takeoverWorld = world;
  globalThis.document = { getElementById: () => ({ style: {}, innerHTML: '' }) };

  try {
    takeovers += 1;
    world.takeover = await import(pathToFileURL(path.join(takeoverTree, 'dashboard/core/takeover.js')).href + '?run=' + takeovers);
    world.takeover.startTakeovers(() => ({ settings: world.settings }));
    world.tick = (hours, minutes, seconds) => world.listener(new Date(2026, 9, 8, hours, minutes, seconds));
    world.settleAll = async () => {
      for (let turn = 0; turn < 40; turn++) await flush();
    };
    await run(world);
  } finally {
    delete globalThis.document;
    delete globalThis.takeoverWorld;
  }
}

function announcementTitled(title, time) {
  return { show: true, time: time, title: title, followUp: '', titleSeconds: 1, followUpSeconds: 1, days: [0, 1, 2, 3, 4, 5, 6] };
}

test('an announcement plays when it comes due, and once', async () => {
  await inTakeoverPage([announcementTitled('ONE', '14:30')], async world => {
    world.tick(14, 29, 59);
    assert.deepEqual(world.shown, []);

    world.tick(14, 30, 0);
    assert.deepEqual(world.shown, ['announcement: ONE']);
    assert.equal(world.takeover.takeoverRunning(), true);
    await world.settleAll();
    assert.equal(world.takeover.takeoverRunning(), false);

    world.tick(14, 30, 1);
    world.tick(14, 30, 2);
    await world.settleAll();
    assert.deepEqual(world.shown, ['announcement: ONE']);
  });
});

test('takeoverRunning is true while the screen is paused, which holds the hidden transitions, the demo, the night screen and the reloads', async () => {
  await inTakeoverPage([], async world => {
    assert.equal(world.takeover.takeoverRunning(), false);
    world.paused = true;
    assert.equal(world.takeover.takeoverRunning(), true);
    world.paused = false;
    assert.equal(world.takeover.takeoverRunning(), false);
  });
});

test('an announcement that comes due while the screen is paused is kept, and plays once the pause is over', async () => {
  await inTakeoverPage([announcementTitled('ONE', '14:30')], async world => {
    world.paused = true;
    world.tick(14, 30, 0);
    world.tick(14, 30, 1);
    await world.settleAll();
    assert.deepEqual(world.shown, [], 'not while the talk holds the screen');

    world.tick(14, 40, 0);
    assert.deepEqual(world.shown, [], 'still held, ten minutes later');

    world.paused = false;
    world.tick(14, 45, 0);
    assert.deepEqual(world.shown, ['announcement: ONE'], 'it plays at the first look after the pause');
    await world.settleAll();

    world.tick(14, 45, 1);
    world.tick(14, 46, 0);
    await world.settleAll();
    assert.deepEqual(world.shown, ['announcement: ONE'], 'and only once');
  });
});

test('announcements that came due during one pause play one after the other, in the order they came due', async () => {
  await inTakeoverPage([announcementTitled('ONE', '14:30'), announcementTitled('TWO', '14:35')], async world => {
    world.paused = true;
    world.tick(14, 30, 0);
    world.tick(14, 35, 0);
    world.paused = false;

    world.tick(14, 36, 0);
    assert.deepEqual(world.shown, ['announcement: ONE']);
    world.tick(14, 36, 1); // the first is still playing
    assert.deepEqual(world.shown, ['announcement: ONE']);
    await world.settleAll();

    world.tick(14, 36, 2);
    assert.deepEqual(world.shown, ['announcement: ONE', 'announcement: TWO']);
    await world.settleAll();
    world.tick(14, 36, 3);
    assert.deepEqual(world.shown, ['announcement: ONE', 'announcement: TWO']);
  });
});

test('an alert still takes the screen while it is paused, and an announcement due before the pause ended waits for the alert too', async () => {
  await inTakeoverPage([announcementTitled('ONE', '14:30')], async world => {
    world.paused = true;
    world.tick(14, 30, 0);
    world.settings.alert = { on: true, headline: 'H', message: 'M', until: '' };
    world.tick(14, 31, 0);
    assert.deepEqual(world.shown, ['alert'], 'the alert overrides everything, a talk too');

    world.settings.alert = { on: false };
    await world.settleAll();
    world.paused = false;
    world.tick(14, 32, 0);
    assert.deepEqual(world.shown, ['alert', 'announcement: ONE']);
    await world.settleAll();
  });
});

// presentation-run.js on a fake page. The real file runs with stand-ins for frame.js, the panels and
// takeover.js. A card is a plain object with children, so a test can see what is on the screen. The
// clock is a function the test calls, and the keys are pressed by calling the handler the file added.

const talkTree = path.join(workFolder, 'talk-tree');
['config.js', 'core/presentation-run.js', 'core/presentation.js', 'core/time.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(talkTree, 'dashboard', file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(talkTree, 'dashboard', file));
});
fs.writeFileSync(path.join(talkTree, 'package.json'), '{ "type": "module" }\n');
fs.writeFileSync(path.join(talkTree, 'dashboard/frame.js'), [
  'export const onSecond = listener => { globalThis.talkWorld.listener = listener; };',
  "export const pause = reason => { globalThis.talkWorld.holds.add(reason); globalThis.talkWorld.log.push('pause'); };",
  "export const resume = reason => { globalThis.talkWorld.holds.delete(reason); globalThis.talkWorld.log.push('resume'); };",
  'export const wait = milliseconds => new Promise(resolve => globalThis.talkWorld.waits.push({ milliseconds: milliseconds, resolve: resolve }));',
  "export const enter = card => { globalThis.talkWorld.log.push('enter ' + card.kind); card.dataset.state = 'in'; return Promise.resolve(); };",
  "export const exit = card => { globalThis.talkWorld.log.push('exit ' + card.kind); card.dataset.state = 'out'; return new Promise(resolve => setImmediate(resolve)); };",
].join('\n') + '\n');
fs.writeFileSync(path.join(talkTree, 'dashboard/core/takeover.js'), [
  'export const takeoverRunning = () => globalThis.talkWorld.announcing || globalThis.talkWorld.holds.size > 0;',
].join('\n') + '\n');
fs.writeFileSync(path.join(talkTree, 'dashboard/core/panels.js'), [
  'export function buildPage(id, content) {',
  '  const world = globalThis.talkWorld;',
  '  const screen = content.talkScreen;',
  '  const element = world.makeElement(screen.kind);',
  "  if (screen.kind === 'slides') ['slide-host', 'progress-line', 'chip', 'chip-count'].forEach(name => element.add(name));",
  "  world.log.push('build ' + screen.kind);",
  '  return { id: id, region: "overlay", element: element };',
  '}',
].join('\n') + '\n');
let talkPages = 0;

class TalkElement {
  constructor(kind) {
    this.kind = kind;
    this.dataset = {};
    this.style = {};
    this.children = [];
    this.parent = null;
    this.hidden = false;
    this.className = '';
    this.named = {};
  }

  add(name) {
    const child = new TalkElement(name);
    child.className = name;
    child.fixed = true;
    this.named[name] = child;
    this.appendChild(child);
  }

  // Like the real one, setting the text to nothing takes every child away
  set textContent(text) {
    this.text = text;
    if (text === '') this.children = this.children.filter(child => child.fixed);
  }

  get textContent() {
    return this.text || '';
  }

  appendChild(child) {
    child.parent = this;
    this.children.push(child);
  }

  prepend(child) {
    child.parent = this;
    this.children.unshift(child);
  }

  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this);
    this.parent = null;
  }

  querySelector(selector) {
    return this.named[selector.slice(1)] || null;
  }

  focus() {
    globalThis.talkWorld.focused += 1;
    globalThis.document.activeElement = this;
  }
}

function manifestOf(pages) {
  return { ok: true, pages: pages, fetchedAt: '2026-10-08T18:00:00Z', refreshed: false };
}

// options: manifest (what the server sends: an object, null for a 404, 'down' for no network or 'hangs'
// for no answer), talks, start (the time of the talk in ms, so that two pages can have the same one),
// settings, status and store (an object that stands for localStorage, or 'off' when asking for it
// throws). world.tick(ms) is the clock: 1000 is the start of the talk.
let talkRuns = 0;

async function inTalkPage(options, run) {
  const store = options.store && options.store !== 'off' ? options.store : {};
  const world = {
    log: [], holds: new Set(), waits: [], keyHandlers: [], fetched: [], images: [], timeouts: [],
    announcing: false, listener: null, focused: 0, store: store, makeElement: kind => new TalkElement(kind),
    manifest: options.manifest === undefined ? manifestOf(['001.jpg', '002.jpg', '003.jpg']) : options.manifest,
  };
  const layer = new TalkElement('layer');
  layer.hidden = true;
  const page = new TalkElement('html');
  const real = { setTimeout: globalThis.setTimeout };

  globalThis.talkWorld = world;
  globalThis.document = { documentElement: page, activeElement: null, getElementById: id => (id === 'talk' ? layer : null) };
  globalThis.window = {
    addEventListener: (name, handler, capture) => world.keyHandlers.push({ name: name, handler: handler, capture: capture }),
    localStorage: options.store === 'off'
      ? { getItem() { throw new Error('storage is off'); }, setItem() { throw new Error('storage is off'); } }
      : { getItem: key => (key in store ? store[key] : null), setItem: (key, value) => { store[key] = value; } },
  };
  globalThis.Image = class {
    constructor() {
      this.decoded = 0;
      world.images.push(this);
    }

    decode() {
      this.decoded += 1;
      return Promise.resolve();
    }
  };
  globalThis.fetch = (address, init) => {
    world.fetched.push({ address: address, init: init });
    if (world.manifest === 'hangs') return new Promise(() => {});
    if (world.manifest === 'down') return Promise.reject(new Error('no network'));
    if (world.manifest === null) return Promise.resolve({ ok: false });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(world.manifest) });
  };
  globalThis.setTimeout = (action, milliseconds) => {
    world.timeouts.push({ action: action, milliseconds: milliseconds });
    return world.timeouts.length;
  };

  try {
    talkRuns += 1;
    const module = await import(pathToFileURL(path.join(talkTree, 'dashboard/core/presentation-run.js')).href + '?run=' + talkRuns);
    const start = options.start || Date.now() + 1000; // keys are read with the real clock, so the talk starts a second from now
    const content = {
      presentations: options.talks || [{ id: 'presentation-abc', name: 'Alex', subteam: 'Programming', topic: 'Swerve drive', start: new Date(start), minutes: 15, status: 'scheduled' }],
      settings: Object.assign({ presentationsEnabled: true, noShowMinutes: 5, graceMinutes: 5 }, options.settings),
      status: options.status || { source: 'sanity' },
    };
    module.startPresentations(() => content);

    world.module = module;
    world.layer = layer;
    world.page = page;
    world.content = content;
    world.tick = milliseconds => world.listener(new Date(start - 1000 + milliseconds));
    world.settleAll = async () => {
      for (let turn = 0; turn < 20; turn++) await flush();
    };
    world.press = (key, extra) => {
      const event = Object.assign({ key: key, repeat: false, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } }, extra);
      world.keyHandlers.filter(entry => entry.name === 'keydown').forEach(entry => entry.handler(event));
      return event;
    };
    world.view = () => layer.children.find(child => child.kind === 'slides');
    world.cards = kind => layer.children.filter(child => child.kind === kind).length;
    world.slideAddressNow = () => world.view().named['slide-host'].children.map(child => child.src);
    await run(world);
    await world.settleAll();
  } finally {
    globalThis.setTimeout = real.setTimeout;
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.Image;
    delete globalThis.fetch;
    delete globalThis.talkWorld;
  }
}

const talkAddress = 'data/live/slides/presentation-abc/';

test('a talk puts up its title card at its start, holds the screen, and reads the manifest from the server each time', async () => {
  await inTalkPage({}, async world => {
    world.tick(0);
    assert.deepEqual(world.log, [], 'not before the start');
    assert.equal(world.layer.hidden, true);
    assert.equal(world.keyHandlers.some(entry => entry.name === 'keydown' && entry.capture === true), true, 'the keys are read on the window, before anything else');

    world.tick(1000);
    assert.deepEqual(world.log, ['pause', 'build title', 'enter title']);
    assert.equal(world.layer.hidden, false);
    assert.equal(world.cards('title'), 1);
    assert.equal(world.layer.dataset.ground, 'plain');
    assert.equal(world.focused > 0, true, 'the layer has the focus, which the keys need');
    assert.deepEqual(world.fetched.map(item => item.address), [talkAddress + 'manifest.json']);
    assert.deepEqual(world.fetched[0].init, { cache: 'no-store' });

    await world.settleAll();
    assert.equal(world.page.dataset.talk, 'on', 'the dashboard is not drawn under the card once it has come in');
    assert.deepEqual(world.images.map(image => image.src), [talkAddress + '001.jpg', talkAddress + '002.jpg', talkAddress + '003.jpg'], 'the first slides are decoded while the title is up');
    assert.deepEqual(world.images.map(image => image.decoded), [1, 1, 1]);
  });
});

test('the sample content looks for its slides in the sample folder', async () => {
  await inTalkPage({ status: { source: 'sample' } }, async world => {
    world.tick(1000);
    assert.deepEqual(world.fetched.map(item => item.address), ['data/sample/slides/presentation-abc/manifest.json']);
  });
});

test('the sample talk of Run presentation test starts at once, reads the sample folder whatever the content source is, and is not brought back once it is over', async () => {
  const sampleTalkNow = () => ({ id: 'presentation-sample', name: '[First name]', subteam: '[Subteam A]', topic: '[Title of the talk]', start: new Date(), minutes: 15, status: 'scheduled' });
  const sampleAddress = 'data/sample/slides/presentation-sample/';

  await inTalkPage({ talks: [], manifest: manifestOf(['001.svg', '002.svg']) }, async world => {
    world.tick(0);
    assert.deepEqual(world.log, [], 'nothing is booked');

    world.module.startTestTalk(sampleTalkNow());
    assert.deepEqual(world.log, ['pause', 'build title', 'enter title']);
    assert.deepEqual(world.fetched.map(item => item.address), [sampleAddress + 'manifest.json']);

    await world.settleAll();
    world.press(' ');
    assert.deepEqual(world.slideAddressNow(), [sampleAddress + '001.svg']);
    world.press(' ');
    world.press(' ');
    assert.equal(world.cards('thanks'), 1, 'after the last slide');

    world.tick(8000);
    await world.settleAll();
    assert.equal(world.holds.size, 0);
    world.tick(30000);
    assert.equal(world.holds.size, 0, 'a talk that is over does not start again');
  });
});

test('the sample talk waits for an announcement like any talk, and a talk that is already over does not start', async () => {
  await inTalkPage({ talks: [], manifest: manifestOf(['001.jpg']) }, async world => {
    world.announcing = true;
    world.module.startTestTalk({ id: 'presentation-sample', name: '[First name]', topic: '[Title of the talk]', start: new Date(), minutes: 15, status: 'scheduled' });
    assert.deepEqual(world.log, [], 'the title card waits while the announcement plays');

    world.announcing = false;
    world.tick(1000);
    assert.deepEqual(world.log.slice(0, 2), ['pause', 'build title']);
  });

  await inTalkPage({ talks: [], manifest: manifestOf(['001.jpg']) }, async world => {
    world.module.startTestTalk({ id: 'presentation-sample', name: '[First name]', topic: '[Title of the talk]', start: new Date(Date.now() - 3 * 3600 * 1000), minutes: 15, status: 'scheduled' });
    assert.deepEqual(world.log, [], 'a talk that is already over does not start');
  });
});

test('a booked talk reads the live folder, also after the sample talk has been ended on its title card', async () => {
  await inTalkPage({ manifest: manifestOf(['001.jpg']) }, async world => {
    world.module.startTestTalk({ id: 'presentation-sample', name: '[First name]', topic: '[Title of the talk]', start: new Date(), minutes: 15, status: 'scheduled' });
    await world.settleAll();
    world.press('Escape');
    world.press('Escape');
    await world.settleAll();

    world.tick(1000);
    world.tick(2000);
    assert.deepEqual(world.fetched.map(item => item.address), ['data/sample/slides/presentation-sample/manifest.json', talkAddress + 'manifest.json']);
  });
});

test('with Run presentations off the sample talk does not start', async () => {
  await inTalkPage({ talks: [], settings: { presentationsEnabled: false } }, async world => {
    world.module.startTestTalk({ id: 'presentation-sample', name: '[First name]', topic: '[Title of the talk]', start: new Date(), minutes: 15, status: 'scheduled' });
    world.tick(1000);
    assert.deepEqual(world.log, []);
    assert.equal(world.holds.size, 0);
  });
});

test('a forward key starts the talk: the first slide shows at once, the title card fades out over it, and the chip and the progress line show', async () => {
  await inTalkPage({}, async world => {
    world.tick(1000);
    await world.settleAll();

    assert.equal(world.press('PageDown').defaultPrevented, true);
    const view = world.view();
    assert.equal(world.layer.children[0], view, 'the slides are under the title card');
    assert.equal(world.layer.dataset.ground, 'black');
    assert.deepEqual(world.slideAddressNow(), [talkAddress + '001.jpg']);
    assert.equal(view.named['progress-line'].style.transform, 'scaleX(' + 1 / 3 + ')');
    assert.equal(view.named['chip-count'].textContent, '1 / 3');
    assert.equal(view.named.chip.dataset.shown, 'on');
    assert.equal(world.log.includes('exit title'), true);

    await world.settleAll();
    assert.equal(world.cards('title'), 0, 'the title card is gone');
  });
});

test('the keys move through the slides at once, black comes and goes, home and end jump, and no slide is loaded twice', async () => {
  await inTalkPage({}, async world => {
    world.tick(1000);
    await world.settleAll();
    world.press('Enter');
    const view = world.view();

    world.press('ArrowRight');
    assert.deepEqual(world.slideAddressNow(), [talkAddress + '002.jpg'], 'one slide in the view at a time');
    assert.equal(view.named['chip-count'].textContent, '2 / 3');
    world.press('p');
    assert.deepEqual(world.slideAddressNow(), [talkAddress + '001.jpg']);
    world.press('ArrowLeft');
    assert.equal(view.named['chip-count'].textContent, '1 / 3', 'not before the first');

    world.press('b');
    assert.equal(view.dataset.black, 'on');
    world.press('.');
    assert.equal(view.dataset.black, 'off');
    world.press('b');
    world.press('n');
    assert.equal(view.dataset.black, 'off', 'a slide key ends the black screen');
    assert.equal(world.images.length, 3, 'the three slides were made once each');

    world.press('End');
    assert.equal(view.named['chip-count'].textContent, '3 / 3');
    assert.equal(view.named['progress-line'].style.transform, 'scaleX(1)');
    world.press('Home');
    assert.equal(view.named['chip-count'].textContent, '1 / 3');
    assert.deepEqual(world.slideAddressNow(), [talkAddress + '001.jpg']);
  });
});

test('the chip shows for three seconds after a key and then fades out', async () => {
  await inTalkPage({}, async world => {
    world.tick(1000);
    await world.settleAll();
    world.press(' ');
    const chip = world.view().named.chip;
    assert.equal(chip.dataset.shown, 'on');

    world.tick(2000);
    assert.equal(chip.dataset.shown, 'on');
    world.tick(5000);
    assert.equal(chip.dataset.shown, 'out');

    world.press('Escape');
    assert.equal(chip.dataset.shown, 'on', 'any key, Esc too');
    const timer = world.timeouts[world.timeouts.length - 1];
    assert.equal(timer.milliseconds > 3000 && timer.milliseconds < 4000, true, 'and a timer takes it away a little over three seconds later');
  });
});

test('the keys are the talk\'s only while a talk holds the screen, a held key does not repeat, and a key that is not in the map is left alone', async () => {
  await inTalkPage({}, async world => {
    assert.equal(world.press('Enter').defaultPrevented, false, 'idle leaves F5 and the rest alone');

    world.tick(1000);
    await world.settleAll();
    assert.equal(world.press('x').defaultPrevented, false);
    assert.equal(world.press('n', { ctrlKey: true }).defaultPrevented, false);
    assert.equal(world.press('F5', { altKey: true }).defaultPrevented, false);
    assert.equal(world.press('Enter', { repeat: true }).defaultPrevented, true, 'a repeat is stopped too');
    assert.equal(world.view(), undefined, 'but it did not start the talk');

    ['F5', ' ', 'PageUp', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Escape'].forEach(key => assert.equal(world.press(key).defaultPrevented, true, key));
  });
});

test('the last slide and one more forward key give the thanks card, and five seconds later the dashboard is given back', async () => {
  await inTalkPage({}, async world => {
    world.tick(1000);
    await world.settleAll();
    world.press(' ');
    world.press(' ');
    world.press(' ');
    world.log.length = 0;

    world.press(' ');
    assert.deepEqual(world.log, ['build thanks', 'enter thanks']);
    assert.equal(world.view(), undefined, 'the slides are gone');
    assert.equal(world.layer.dataset.ground, 'black', 'the card comes in over black');
    assert.equal(world.holds.size, 1);

    world.tick(4000);
    assert.equal(world.holds.size, 1);
    world.tick(6000);
    await world.settleAll();
    assert.equal(world.layer.hidden, true);
    assert.equal(world.holds.size, 0);
    assert.equal(world.page.dataset.talk, undefined);
    assert.equal(world.layer.children.length, 0);
    assert.equal(world.log[world.log.length - 1], 'resume');

    world.tick(8000);
    world.tick(30000);
    assert.equal(world.holds.size, 0, 'a talk that is over does not start again');
    assert.equal(JSON.parse(world.store['teletraan-talks-skipped']).length, 1);
  });
});

test('Esc once does nothing and twice within two seconds ends the talk, on the slides and on the title card', async () => {
  await inTalkPage({}, async world => {
    world.tick(1000);
    await world.settleAll();
    world.press(' ');
    world.press('Escape');
    assert.equal(world.cards('thanks'), 0);
    world.press('Escape');
    assert.equal(world.cards('thanks'), 1);
  });

  await inTalkPage({}, async world => {
    world.tick(1000);
    await world.settleAll();
    world.press('Escape');
    assert.equal(world.holds.size, 1);
    world.press('Escape');
    assert.equal(world.page.dataset.talk, undefined, 'the dashboard shows again under the card that fades out');
    await world.settleAll();
    world.tick(2000);
    await world.settleAll();
    assert.equal(world.layer.hidden, true);
    assert.equal(world.holds.size, 0);
  });
});

test('slides that are not ready show the card for 60 seconds, the forward key does nothing, and then the dashboard comes back', async () => {
  for (const manifest of [null, 'down', { ok: false, error: 'not shared', fetchedAt: '2026-10-08T18:00:00Z' }, manifestOf([])]) {
    await inTalkPage({ manifest: manifest }, async world => {
      world.tick(1000);
      await world.settleAll();
      world.tick(2000);
      assert.equal(world.log.includes('build not-ready'), true, JSON.stringify(manifest));
      assert.equal(world.cards('not-ready'), 1);
      assert.equal(world.press(' ').defaultPrevented, true);
      assert.equal(world.view(), undefined, 'there is nothing to start');

      world.tick(40000);
      assert.equal(world.holds.size, 1, 'still up');
      world.tick(63000);
      await world.settleAll();
      world.tick(64000);
      await world.settleAll();
      assert.equal(world.holds.size, 0);
      assert.equal(world.layer.hidden, true);
    });
  }
});

test('a manifest that does not come within ten seconds counts as missing', async () => {
  await inTalkPage({ manifest: 'hangs' }, async world => {
    world.tick(1000);
    await world.settleAll();
    world.tick(2000);
    assert.equal(world.cards('not-ready'), 0, 'still waiting');

    const wait = world.waits.find(entry => entry.milliseconds === 10000);
    assert.ok(wait, 'a ten second wait was started');
    wait.resolve();
    await world.settleAll();
    assert.equal(world.cards('not-ready'), 1);
  });
});

test('the title card waits for an announcement or an alert to end', async () => {
  await inTalkPage({}, async world => {
    world.announcing = true;
    world.tick(1000);
    world.tick(5000);
    assert.deepEqual(world.log, []);
    assert.equal(world.holds.size, 0);

    world.announcing = false;
    world.tick(6000);
    assert.equal(world.log.includes('build title'), true);
  });
});

test('a talk that nobody starts is skipped after noShowMinutes, and a page that loads again does not bring it back', async () => {
  const store = {};
  const start = Date.now() + 1000;
  await inTalkPage({ store: store, start: start }, async world => {
    world.tick(1000);
    await world.settleAll();
    world.tick(1000 + 4 * 60000);
    assert.equal(world.holds.size, 1, 'still waiting after four minutes');
    world.tick(1000 + 5 * 60000);
    await world.settleAll();
    world.tick(1000 + 5 * 60000 + 1000);
    await world.settleAll();
    assert.equal(world.holds.size, 0);
    assert.equal(world.layer.hidden, true);
  });
  assert.equal(JSON.parse(store['teletraan-talks-skipped']).length, 1);

  await inTalkPage({ store: store, start: start }, async world => {
    world.tick(1000);
    world.tick(2000);
    assert.deepEqual(world.log, [], 'the same talk at the same start');
  });

  const moved = [{ id: 'presentation-abc', name: 'Alex', subteam: 'Programming', topic: 'Swerve drive', start: new Date(start + 60000), minutes: 15, status: 'scheduled' }];
  await inTalkPage({ store: store, start: start, talks: moved }, async world => {
    world.tick(61000);
    assert.equal(world.log.includes('build title'), true, 'a talk that was moved is a new talk');
  });
});

test('storage that cannot be used still keeps a skipped talk skipped for as long as the page is open', async () => {
  await inTalkPage({ store: 'off' }, async world => {
    world.tick(1000);
    await world.settleAll();
    world.press('Escape');
    world.press('Escape');
    await world.settleAll();
    world.tick(2000);
    await world.settleAll();
    world.tick(3000);
    world.tick(4000);
    assert.equal(world.holds.size, 0);
    assert.equal(world.layer.hidden, true);
  });
});

test('switching Run presentations off ends a talk at once, and a talk that runs over ends at its end plus the grace', async () => {
  await inTalkPage({}, async world => {
    world.tick(1000);
    await world.settleAll();
    world.press(' ');
    world.content.settings.presentationsEnabled = false;
    world.tick(3000);
    await world.settleAll();
    assert.equal(world.holds.size, 0);
    assert.equal(world.layer.hidden, true);
    assert.equal(world.layer.children.length, 0);
  });

  await inTalkPage({}, async world => {
    world.tick(1000);
    await world.settleAll();
    world.press(' ');
    world.tick(1000 + 19 * 60000);
    assert.equal(world.cards('thanks'), 0);
    world.tick(1000 + 20 * 60000 + 1000);
    assert.equal(world.cards('thanks'), 1, 'fifteen minutes and five of grace');
  });
});

test('a card that fails to draw gives the dashboard back, and the talk does not start again', async () => {
  const errors = [];
  const real = console.error;
  console.error = (...details) => errors.push(details);

  try {
    await inTalkPage({}, async world => {
      world.tick(1000);
      await world.settleAll();
      world.press(' ');
      world.makeElement = kind => {
        if (kind === 'thanks') throw new Error('no card');
        return new TalkElement(kind);
      };
      world.press(' ');
      world.press(' ');
      world.press(' ');
      await world.settleAll();

      assert.equal(errors.length, 1);
      assert.equal(world.holds.size, 0);
      assert.equal(world.layer.hidden, true);
      world.tick(5000);
      assert.equal(world.holds.size, 0);
    });
  } finally {
    console.error = real;
  }
});

// The plain functions the screen adds to core/presentation.js

test('pictureOf says what each state puts on the screen, and cardLines gives the words of a card', async () => {
  const presentation = await import(pathToFileURL(path.join(talkTree, 'dashboard/core/presentation.js')).href);
  const talk = { id: 'presentation-abc', name: 'Alex', subteam: 'Programming', topic: 'Swerve drive', start: new Date(), minutes: 15 };

  assert.equal(presentation.pictureOf({ name: 'idle' }), 'none');
  assert.equal(presentation.pictureOf({ name: 'skipped', talk: talk }), 'none');
  assert.equal(presentation.pictureOf({ name: 'title', talk: talk, notReadyAt: null }), 'title');
  assert.equal(presentation.pictureOf({ name: 'title', talk: talk, notReadyAt: 5 }), 'not-ready');
  assert.equal(presentation.pictureOf({ name: 'presenting', talk: talk }), 'slides');
  assert.equal(presentation.pictureOf({ name: 'thanks', talk: talk }), 'thanks');

  assert.deepEqual(presentation.cardLines('title', talk), { label: 'Programming', headline: 'Alex', detail: 'Swerve drive', prompt: 'Press the clicker to begin' });
  assert.deepEqual(presentation.cardLines('title', Object.assign({}, talk, { subteam: undefined })).label, '');
  assert.deepEqual(presentation.cardLines('not-ready', talk), { label: '', headline: 'Slides are not ready.', detail: 'Ask a coach.', prompt: '' });
  assert.deepEqual(presentation.cardLines('thanks', talk), { label: '', headline: 'Thank you', detail: 'Alex', prompt: '' });
});

test('the slide folder and addresses, the slide number and the progress line are worked out in core/presentation.js', async () => {
  const presentation = await import(pathToFileURL(path.join(talkTree, 'dashboard/core/presentation.js')).href);

  assert.equal(presentation.slidesFolder(false, { id: 'presentation-abc' }), 'data/live/slides/presentation-abc/');
  assert.equal(presentation.slidesFolder(true, { id: 'presentation-abc' }), 'data/sample/slides/presentation-abc/');
  assert.equal(presentation.slidesFolder(false, { id: '../x y' }), 'data/live/slides/..%2Fx%20y/', 'an id cannot leave the folder');
  assert.equal(presentation.slideAddress('data/live/slides/a/', '001.jpg'), 'data/live/slides/a/001.jpg');
  assert.equal(presentation.slideAddress('data/live/slides/a/', '../../x.jpg'), 'data/live/slides/a/..%2F..%2Fx.jpg');

  const state = { name: 'presenting', slide: 6, count: 24 };
  assert.equal(presentation.slideNumberText(state), '7 / 24');
  assert.equal(presentation.progressOf(state), 7 / 24);
  assert.equal(presentation.progressOf(Object.assign({}, state, { slide: 23 })), 1);
  assert.equal(presentation.progressOf({ name: 'title', slide: 0, count: 24 }), 0);
});

test('the first Esc on a slide shows the chip too, since it is a key press', async () => {
  const presentation = await import(pathToFileURL(path.join(talkTree, 'dashboard/core/presentation.js')).href);
  const state = { name: 'presenting', talk: { id: 'a' }, count: 5, slide: 2, black: false, keyAt: null, escapedAt: null };

  const after = presentation.pressKey(state, 'Escape', new Date(10000));
  assert.equal(after.name, 'presenting');
  assert.equal(after.slide, 2);
  assert.equal(presentation.chipShown(after, new Date(12000)), true);
  assert.equal(presentation.chipShown(after, new Date(13000)), false);
  assert.equal(presentation.pressKey(after, 'Escape', new Date(11000)).name, 'thanks');
});

// The files around it

test('the talk panel is in the registry, its cards have the parts frame.js moves, and its layer is in index.html under the overlay and over the night screen', async () => {
  const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');

  assert.ok(read('registry.js').includes("{ id: 'talk', region: 'overlay' },"));
  assert.equal(fs.existsSync(path.join(dashboardFolder, 'panels/talk/talk.js')) && fs.existsSync(path.join(dashboardFolder, 'panels/talk/talk.css')), true);

  const html = read('index.html');
  const night = html.indexOf('<div id="night" hidden></div>');
  const talk = html.indexOf('<div id="talk" tabindex="-1" hidden></div>');
  const overlay = html.indexOf('<div id="overlay"></div>');
  assert.ok(night !== -1 && talk > night && overlay > talk, 'night screen, then the talk, then the overlay');

  // frame.js reads the page when it is loaded, so its table is read as text
  const table = /\n  talk: \{([^}]*)\},/.exec(read('frame.js'))[1];
  const lines = Array.from(table.matchAll(/'([a-z-]+)':\s*\['([a-z-]+)'/g));
  const mountSource = read('panels/talk/talk.js');
  const parts = Array.from(mountSource.matchAll(/data-part="([a-z-]+)"/g)).map(match => match[1]);
  assert.deepEqual(parts, lines.map(match => match[1]), 'a line in sequences.talk for every part of a card, in the same order');
  assert.ok(mountSource.includes('data-sequence="talk"'));
  lines.forEach(match => assert.ok(['fade', 'latch-left', 'latch-right'].includes(match[2]), match[1] + ' uses an effect that only fades and slides'));
});

test('the stylesheet of a talk keeps the rules of the screen: text of 44px or more, lines of 3px or more, nothing that moves but the chip', () => {
  const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');
  const css = read('panels/talk/talk.css').replace(/\/\*[\s\S]*?\*\//g, '');

  // every size in a font shorthand is one of the tokens at 44px or more
  const tokens = {};
  Array.from(read('tokens.css').matchAll(/--(size-[a-z-]+): (\d+)px;/g)).forEach(match => { tokens[match[1]] = Number(match[2]); });
  const sizes = Array.from(css.matchAll(/font(?:-size)?:[^;]*?var\(--(size-[a-z-]+)\)/g));
  assert.equal(sizes.length >= 6, true, 'the sizes are tokens');
  sizes.forEach(match => assert.ok(tokens[match[1]] >= 44, match[1] + ' is smaller than 44px'));
  assert.ok(/font:\s*600 var\(--size-label\)\/44px/.test(css), 'the chip is 44px');
  assert.ok(/font:\s*500 var\(--size-body\)\/72px/.test(css), 'the prompt is 56px');

  assert.ok(/\.talk \.progress-line \{[^}]*height: 6px;/.test(css), 'the progress line is 6px');
  assert.ok(/border-top: 4px solid/.test(css));
  assert.equal(/box-shadow|text-shadow|filter|blur|drop-shadow/.test(css), false);

  // the slides do not move, and the only motion rules for a talk are in frame.css
  assert.equal(/@keyframes/.test(css), false);
  assert.equal(/transition:(?!\s*none)/.test(css), false);
  assert.equal(/animation:(?!\s*none)/.test(css), false);
  assert.ok(/\.talk \.slide \{[^}]*transition: none;[^}]*animation: none;/.test(css));
  assert.ok(/object-fit: contain;/.test(css));
  assert.ok(/#talk \{[^}]*cursor: none;/.test(css));

  const motion = read('frame.css');
  assert.ok(motion.includes('.talk .chip[data-shown="on"]  { animation: fade-in var(--time-fade-in) linear backwards; }'));
  assert.ok(motion.includes('@keyframes chip-out { from { opacity: 1; } }'));
  assert.ok(motion.includes('[data-motion="none"] .talk .chip { animation: none; }'));
});

test('shell.js starts the screen of a talk behind startOptional, in the views that have alerts', () => {
  const shell = fs.readFileSync(path.join(dashboardFolder, 'shell.js'), 'utf8');
  const announce = shell.indexOf("startOptional('./core/announce-run.js'");
  const talk = shell.indexOf("startOptional('./core/presentation-run.js', module => module.startPresentations(getContent));");

  assert.ok(talk > announce && announce > shell.indexOf('startTakeovers(getContent);'), 'after the takeovers');
  assert.ok(shell.slice(shell.lastIndexOf('if (', talk), talk).startsWith("if (!params.get('show') && !stress) {"), 'not in the test views');
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
