// Tests for the Hawktimus icon: that it is the usual mark at rest for both teams, that the logo changes into the
// flying hawk once every 5 minutes and a swap does not start the count again, and what the icon does in a swap
// (dashboard/core/swap-plan.js, hawkMotionFor): it flutters slightly when a team or a style changes, it is only
// carried when a Monday card is on either side, and calm and no motion have no icon at all. The effect scheduler
// of dashboard/frame.js runs on a fake page and a clock that the test moves, so a test of 10 minutes takes no
// time. Nothing touches the network or a browser. tests/swap.test.mjs plays the swap itself.
//
//   node tests/hawk-cadence.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';
import { importFresh } from './helpers/fresh-module.mjs';
import { readModule } from './helpers/read-module.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dashboardFolder = path.join(root, 'dashboard');
const read = file => readModule(path.join(root, file), 'utf8');
const withoutComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(line => !line.trim().startsWith('//')).join('\n');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-hawk-cadence-'));
fs.mkdirSync(path.join(workFolder, 'dashboard', 'core'), { recursive: true });
fs.mkdirSync(path.join(workFolder, 'dashboard', 'themes', 'overlays'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'frame.js', 'registry.js', 'themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  copyModule(path.join(dashboardFolder, file), path.join(workFolder, 'dashboard', file));
});
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  copyModule(path.join(dashboardFolder, 'core', file), path.join(workFolder, 'dashboard/core', file));
});
const base = pathToFileURL(path.join(workFolder, 'dashboard')).href + '/';
const config = await import(base + 'config.js');
const screens = await import(base + 'core/screens.js');
const swapPlan = await import(base + 'core/swap-plan.js');
const { normalizeContent, normalizeSample } = await import(base + 'core/sanity.js');
const teams = await import(base + 'core/teams.js');

const realSetImmediate = globalThis.setImmediate;
const second = 1000;
const tests = [];
let instance = 0;

function test(name, run) {
  tests.push({ name: name, run: run });
}


// The cadence

test('the flying hawk comes every 5 minutes to start with, from 1 to 240, and a Screen that stores a number keeps it', () => {
  assert.deepEqual(config.defaultScreen, { nameEffectEveryMinutes: 10, hawkEveryMinutes: 5, swapSeconds: 1.25 });
  assert.deepEqual(config.screenLimits.hawkEveryMinutes, { min: 1, max: 240 });

  const empty = screens.tidyScreen(null, 'original', 'minimal');
  assert.equal(empty.hawkEveryMinutes, 5);
  assert.equal(screens.cadenceOf(empty).hawkEverySeconds, 300);
  assert.equal(screens.tidyScreen({ hawkEveryMinutes: 15 }, 'original', 'minimal').hawkEveryMinutes, 15, 'a Screen that stored the old starting value keeps it');
  assert.equal(screens.cadenceOf(screens.tidyScreen({ hawkEveryMinutes: 15 }, 'original', 'minimal')).hawkEverySeconds, 900);
  assert.equal(screens.tidyScreen({ hawkEveryMinutes: 0 }, 'original', 'minimal').hawkEveryMinutes, 1);
  assert.equal(screens.tidyScreen({ hawkEveryMinutes: 500 }, 'original', 'minimal').hawkEveryMinutes, 240);
});

test('the Studio starts the Screen at 5 minutes and says so, and so do the Screens of the sample content', () => {
  const field = /name: 'hawkEveryMinutes',[\s\S]*?\}\),/.exec(read('studio/schemas/screen.js'))[0];
  assert.ok(field.includes('initialValue: 5,'), 'the field starts at 5');
  assert.ok(field.includes('Starts at 5.'), 'and the description says so');
  assert.ok(!field.includes('15'), 'nothing in it says 15 any more');

  const sample = JSON.parse(read('dashboard/data/sample/content.json'));
  assert.equal(sample.screens.length, 3);
  sample.screens.forEach(screen => assert.equal(screen.hawkEveryMinutes, 5, screen.style || screen._id));
});

// A fresh frame.js with a fake page, a fake clock and a log of every act of the logo. A logo is { dataset, style, isConnected }
// and writes its acts to world.acts, with the time. world.hawkStarts() is when the logo started to fold into the flying hawk.
async function inPage(run) {
  const world = { now: 0, timers: [], nextTimer: 1, areas: [], acts: [], pageData: {}, pageStyle: { setProperty() {} } };

  world.makeLogo = () => {
    let act = 'rest';
    return {
      dataset: {
        get act() { return act; },
        set act(value) { act = value; world.acts.push({ act: value, at: world.now }); },
      },
      style: { setProperty() {}, removeProperty() {} },
      isConnected: true,
      getAnimations: () => [],
    };
  };
  world.logo = world.makeLogo();

  globalThis.document = {
    documentElement: { dataset: world.pageData, style: world.pageStyle },
    getElementById: () => null,
    querySelector: () => null,
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
    world.frame = await importFresh(path.join(workFolder, 'dashboard/frame.js'));
    world.frame.start({ motion: 'full', speed: 'normal' });
    world.advance = ms => advance(world, ms);
    world.hawkStarts = () => world.acts.filter(item => item.act === 'robot').map(item => item.at);
    await run(world);
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

// Runs the fake timers in order for ms of fake time, letting promises settle after each one
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

// Only the hawk moves: the name effect, the glitch, the spin and the entrance are off
function onlyTheHawk(world, everySeconds) {
  world.frame.setNameEffect(false, 0, 1.43);
  world.frame.setCrt(false, 0, 2.7);
  world.frame.setSpin(false, 0, 1.6);
  world.frame.setHawk(true, everySeconds, 11);
  world.frame.setLogoAnimations(true, false);
}

test('with 5 minutes the logo folds into the flying hawk 13 seconds in, and then 300 seconds after each start', async () => {
  await inPage(async world => {
    onlyTheHawk(world, config.defaultScreen.hawkEveryMinutes * 60);
    world.frame.startLogo(world.logo);

    await world.advance(700 * second);
    assert.deepEqual(world.hawkStarts(), [13000, 313000, 613000]);
    const flights = world.acts.filter(item => ['robot', 'hawk-in', 'flight', 'hawk-out'].includes(item.act));
    assert.equal(flights.length, 12, 'four acts each time: it is the same flying hawk as before');
  });
});

test('a swap does not start the count again: the banner is drawn for the new style, and the hawk still comes at 13, 313 and 613 seconds', async () => {
  await inPage(async world => {
    onlyTheHawk(world, 300);
    world.frame.startLogo(world.logo);

    // a swap every 20 seconds, as in a loop of short pages: the screen is held for 2 seconds, and in the middle of it
    // the banner is drawn again with a new logo, which shell.js hands to startLogo
    for (let at = 20; at < 700; at += 20) {
      await world.advance(at * second - world.now);
      world.frame.setSwapPlaying(true);
      await world.advance(second);
      world.frame.startLogo(world.makeLogo());
      await world.advance(second);
      world.frame.setSwapPlaying(false);
    }
    assert.deepEqual(world.hawkStarts(), [13000, 313000, 613000], 'every 300 seconds, however many swaps there were');
  });

  // The way it was: every new logo counted 13 seconds to its first play, so the hawk came after nearly every swap
  const frame = read('dashboard/frame.js');
  assert.ok(/const replaced = frameState\.showLogo !== null;/.test(frame) && /if \(!replaced\) \{/.test(frame), 'startLogo keeps the counts of a logo that is replaced');
});

test('a logo that was stopped and is started again counts from the start, and one that is replaced does not', async () => {
  await inPage(async world => {
    onlyTheHawk(world, 300);
    world.frame.startLogo(world.logo);
    await world.advance(15 * second);
    assert.deepEqual(world.hawkStarts(), [13000]);

    const replacement = world.makeLogo();
    world.frame.startLogo(replacement);
    await world.advance(300 * second);
    assert.deepEqual(world.hawkStarts(), [13000, 313000], 'replaced: the next one is 300 seconds after the last');

    world.frame.stopLogo(replacement);
    const again = world.now;
    world.frame.startLogo(world.makeLogo());
    await world.advance(15 * second);
    assert.deepEqual(world.hawkStarts(), [13000, 313000, again + 13000], 'stopped and started: a new show counts from the start (tools/logo.html)');
  });
});

test('nothing in the logo starts while a swap has the screen, and the hawk that was due goes when it is over, once', async () => {
  await inPage(async world => {
    onlyTheHawk(world, 300);
    world.frame.startLogo(world.logo);
    world.frame.setSwapPlaying(true);

    await world.advance(30 * second);
    assert.deepEqual(world.hawkStarts(), [], 'it was due at 13 seconds');
    world.frame.setSwapPlaying(false);
    await world.advance(second);
    assert.deepEqual(world.hawkStarts(), [30250]);
    await world.advance(299 * second);
    assert.deepEqual(world.hawkStarts(), [30250], 'and the next one is 300 seconds after it, not after it came due');
    await world.advance(second);
    assert.deepEqual(world.hawkStarts(), [30250, 330250]);
  });
});

test('calm and no motion never fold the logo into the hawk', async () => {
  for (const motion of ['calm', 'none']) {
    await inPage(async world => {
      onlyTheHawk(world, 300);
      world.frame.setMotion(motion);
      world.frame.startLogo(world.logo);

      await world.advance(900 * second);
      assert.deepEqual(world.hawkStarts(), [], motion);
      assert.ok(world.acts.every(item => item.act === 'rest'), motion + ': the logo stays the emblem');
    });
  }
});


// The icon at rest

test('Nova stores auto in the seed and in the sample, and a team that stores flight is read as auto, with no class', () => {
  const seeded = read('docs/seed/teams.ndjson').split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));
  assert.deepEqual(seeded.map(team => [team.code, team.logoPose]), [['prime', 'auto'], ['nova', 'auto']]);

  const sample = JSON.parse(read('dashboard/data/sample/content.json'));
  assert.deepEqual(sample.teams.map(team => [team.code, team.logoPose]), [['prime', 'auto'], ['nova', 'auto']]);
  assert.deepEqual(normalizeSample(sample).teams.map(team => team.logoPose), ['auto', 'auto']);

  const stored = normalizeContent({ teams: [Object.assign({}, seeded[1], { _id: 'team-nova', _type: 'team', logoPose: 'flight' })] }, new Date(0)).teams[0];
  assert.equal(stored.code, 'nova');
  assert.equal(stored.logoPose, 'auto', 'the owner\'s Nova document says flight today, and the screen ignores it');
  assert.deepEqual(teams.trimClassesOf(stored), ['bolts-round', 'corner-cut-tr', 'header-slant', 'grid-dots', 'ticker-bar', 'accent-neon']);
  assert.equal(teams.trimClasses.includes('pose-flight'), false);
  assert.equal(config.teamTrim.logoPose.flight, '', 'flight has no class');
  assert.equal(config.primeTeam.logoPose, 'auto');
});

test('no stylesheet holds the logo at rest as the hawk, and the Studio hides the field that said so', () => {
  ['dashboard/trim.css', 'dashboard/frame.css', 'dashboard/base.css', 'dashboard/index.html'].forEach(file => {
    assert.ok(!read(file).includes('pose-flight'), file + ' does not name the class');
  });

  const field = /trimField\('logoPose'[^\n]*\n/.exec(read('studio/schemas/team.js'))[0];
  assert.ok(field.includes("'Not used any more."), 'the description begins Not used any more');
  assert.ok(/, true\),\n$/.test(field), 'and the field is hidden');
  assert.ok(read('studio/schemas/team.js').includes("logoPose: [{ title: 'Auto', value: 'auto' }, { title: 'Flight', value: 'flight' }],"), 'a stored flight stays a value the field knows');
});


// The icon in a swap

test('the icon flutters slightly when a team or a style changes, is only carried when a Monday card is on either side, and calm and no motion have none', () => {
  const swap = fields => swapPlan.hawkMotionFor(Object.assign({ motion: 'full', team: false, fromMonday: false, intoMonday: false }, fields));

  assert.equal(swap({ team: true }), 'slight', 'Prime to Nova, and Nova to Prime');
  assert.equal(swap({}), 'slight', 'a style that changes alone, such as Original to Cybertron');
  assert.equal(swap({ intoMonday: true }), 'carry', 'into a Monday card, where the icon goes lower');
  assert.equal(swap({ fromMonday: true, intoMonday: true }), 'carry', 'from one Monday card to the next');
  assert.equal(swap({ fromMonday: true }), 'carry', 'out of a Monday card, with the team staying');
  assert.equal(swap({ intoMonday: true, team: true }), 'carry', 'into a Monday card of the other team: the icon only goes lower');
  assert.equal(swap({ fromMonday: true, team: true }), 'slight', 'out of the Monday cards of Prime into Nova: it is the Prime to Nova swap');
  ['calm', 'none'].forEach(motion => {
    assert.equal(swap({ motion: motion, team: true }), 'none', motion + ' with a team');
    assert.equal(swap({ motion: motion, intoMonday: true }), 'none', motion + ' with a Monday card');
    assert.equal(swap({ motion: motion }), 'none', motion);
  });
  assert.equal(swapPlan.hawkMotionFor({ motion: 'full' }), 'slight', 'a swap that says nothing else is a style change');
});

test('the slight version is short and small: about 600 ms at most, a hop of 40 px, and no arc of 300 px', () => {
  const shape = swapPlan.hawkShape;

  assert.ok(shape.birdMs <= 600, 'it is a hawk for 600 ms at most');
  assert.ok(shape.birdMs < swapPlan.swapTimes.reformEndMs - swapPlan.swapTimes.switchMs, 'and it is over before the pieces are home');
  assert.equal(shape.hopHeight, 40);
  assert.equal(shape.arcHeight, undefined, 'there is no large arc any more');
  assert.equal(swapPlan.swapTimes.hawkMs, undefined, 'the hawk does not fly on to 2000 ms');
  assert.ok(swapPlan.swapMs(true) <= 1400, 'the swap is no longer than the pieces and the landing');
});

test('swap-run.js asks hawkMotionFor for the swap it offers, from the team that is waiting and the Monday cards on either side', () => {
  const run = withoutComments(read('dashboard/core/swap-run.js'));

  assert.ok(run.includes("hawkMotionFor({ motion: frame.motionNow(), team: teamPending(), fromMonday: isMondayCard(old.id), intoMonday: isMondayCard(next.id) })"));
  assert.ok(run.includes('play(swapPage, icon)'), 'the answer goes to the swap that plays');
  assert.ok(!/dataset\.act = 'swap'/.test(run), 'the copy of the logo has no act of its own');
  assert.ok(!/Infinity/.test(run), 'and no wing beats for ever');
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
process.exit(failures === 0 ? 0 : 1);
