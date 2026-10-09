// Tests for the mouse in presentation mode: what each button does (dashboard/core/presentation.js),
// the second click of a double click, a click on the card that says the slides are not ready, the
// context menu, the cursor, and the rotation that starts again from its first panel
// (dashboard/core/schedule.js). Nothing is drawn and no clock runs. A test gives the functions a
// time and reads the state that comes back. The screen that reads the mouse is tested in
// tools/test-effects.mjs, and the keys in tools/test-presentation.mjs.
//
//   node tools/test-presentation-mouse.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-presentation-mouse-'));
fs.mkdirSync(path.join(workFolder, 'dashboard', 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'core/presentation.js', 'core/time.js'].forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(workFolder, 'dashboard', file));
});
const presentation = await import(pathToFileURL(path.join(workFolder, 'dashboard/core/presentation.js')).href);

const {
  blocksContextMenu, clickAction, clickActions, doubleClickMs, holdsScreen, idleState, mouseButton, nextState, pictureOf,
  pressKey, pressMouse, rememberEnded, readSkipped, restartsRotation, secondOfDoubleClick, thanksSeconds,
} = presentation;

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const second = 1000;
const minute = 60 * second;
const start = new Date('2026-10-08T19:00:00Z'); // 3:00 PM in New York

// The moment this many milliseconds after the start of the talk
const at = offset => new Date(start.getTime() + offset);

// Dashboard Settings as the Studio starts them
const settings = { presentationsEnabled: true, noShowMinutes: 5, graceMinutes: 5 };

// A talk as core/sanity.js hands it over
function booked(extra) {
  return Object.assign({ id: 'presentation-a1', name: 'Alex', subteam: 'Programming', topic: '[Swerve drive]', start: start, minutes: 15, status: 'scheduled' }, extra);
}

// The manifest.json of a deck with five slides
const manifest = { ok: true, pages: ['001.jpg', '002.jpg', '003.jpg', '004.jpg', '005.jpg'], fetchedAt: '2026-10-08T18:00:00Z', refreshed: false };

function memoryStorage() {
  const items = {};
  return {
    items: items,
    getItem: key => (key in items ? items[key] : null),
    setItem: (key, value) => { items[key] = value; },
  };
}

// The loop of the screen (core/presentation-run.js): one state, the skipped set that lives in
// the storage, a look once a second, a press for each key and a click for each button. A state
// that is skipped or over is remembered as soon as it comes.
function makeScreen(parts) {
  const screen = {
    state: idleState(),
    storage: memoryStorage(),
    talks: [booked()],
    settings: settings,
    slides: manifest,
  };
  Object.assign(screen, parts);
  screen.skipped = readSkipped(screen.storage);

  function move(next) {
    if (next === screen.state) return next;
    screen.state = next;
    rememberEnded(screen.storage, screen.skipped, next);
    return next;
  }

  screen.look = now => move(nextState(screen.state, {
    now: now, talks: screen.talks, settings: screen.settings, skipped: screen.skipped, announcing: false, slides: screen.slides,
  }));
  screen.press = (key, now) => move(pressKey(screen.state, key, now));
  screen.click = (button, now) => move(pressMouse(screen.state, button, now));
  return screen;
}

// A screen with the title card up and the slides counted
function waitingOnTitle() {
  const screen = makeScreen({});
  screen.look(at(0));
  screen.look(at(second));
  assert.equal(screen.state.name, 'title');
  assert.equal(screen.state.count, 5);
  return screen;
}

// A screen with the talk on its first slide, started with the forward key two seconds in
function presenting() {
  const screen = waitingOnTitle();
  screen.press(' ', at(2 * second));
  assert.equal(screen.state.name, 'presenting');
  return screen;
}

// A screen with the card that says the slides are not ready up
function notReady(missing) {
  const screen = makeScreen({ slides: missing });
  screen.look(at(0));
  screen.look(at(second));
  assert.equal(pictureOf(screen.state), 'not-ready');
  return screen;
}

const clickerButtons = { left: 'forward', right: 'back', middle: null };

test('every button of the mouse has its action, and no other name has one', () => {
  assert.deepEqual(clickActions, clickerButtons);
  Object.keys(clickerButtons).forEach(button => assert.equal(clickAction(button), clickerButtons[button], button));

  ['double', 'Left', 'toString', 'constructor', '__proto__', '', undefined, null, 0, {}].forEach(button => {
    assert.equal(clickAction(button), null, JSON.stringify(button));
  });
});

test('the browser numbers the buttons 0, 1 and 2, and any other button is left alone', () => {
  assert.equal(mouseButton(0), 'left');
  assert.equal(mouseButton(1), 'middle');
  assert.equal(mouseButton(2), 'right');
  [3, 4, -1, 1.5, 'x', '', 'toString', '__proto__', undefined, null, {}].forEach(number => {
    assert.equal(mouseButton(number), null, JSON.stringify(number));
  });
});

test('on the title card a left click starts the talk once the slides are counted, as the forward key does, and no other button does', () => {
  const early = makeScreen({ slides: undefined });
  early.look(at(0));
  const nothingYet = early.state;
  assert.equal(early.click('left', at(second)), nothingYet, 'the manifest has not been read, so there is nothing to show');

  const screen = waitingOnTitle();
  const title = screen.state;
  const byKey = pressKey(title, ' ', at(3 * second));
  const started = screen.click('left', at(3 * second));

  assert.equal(started.name, 'presenting');
  assert.deepEqual([started.slide, started.count, started.black, started.keyAt, started.clickedAt], [0, 5, false, at(3 * second).getTime(), at(3 * second).getTime()]);
  assert.equal(started.talk, title.talk);
  assert.deepEqual(Object.assign({}, started, { clickedAt: null }), byKey, 'the same state as the key gives');

  const other = waitingOnTitle();
  const waiting = other.state;
  ['right', 'middle'].forEach(button => assert.equal(other.click(button, at(3 * second)), waiting, button));
});

test('on the slides a left click goes on and a right click goes back, none goes past the first or the last, and a left click on the last slide gives the thanks card', () => {
  const screen = presenting();
  let seconds = 2;
  const click = button => screen.click(button, at(++seconds * second));
  const slide = () => screen.state.slide;

  assert.equal(slide(), 0);
  click('left');
  click('left');
  assert.equal(slide(), 2);
  click('right');
  assert.equal(slide(), 1);
  click('right');
  click('right');
  click('right');
  assert.equal(slide(), 0, 'back stops at the first slide');
  assert.equal(screen.state.keyAt, at(seconds * second).getTime(), 'every click counts as a press, for the chip');

  for (let times = 0; times < 4; times++) click('left');
  assert.equal(slide(), 4);
  click('right');
  assert.equal(slide(), 3);
  click('left');
  assert.equal(slide(), 4);

  const done = click('left');
  assert.equal(done.name, 'thanks', 'a left click on the last slide gives the thanks card');
  assert.equal(done.since, at(seconds * second).getTime());
  assert.equal(screen.skipped.size, 1);
});

test('a left click does what the forward key does, and a right click what the back key does, in every state of a talk', () => {
  const onSlide = (slide, black) => Object.assign({}, presenting().state, { slide: slide, black: black });
  const states = [waitingOnTitle().state, onSlide(0, false), onSlide(2, false), onSlide(2, true), onSlide(4, false), onSlide(4, true)];
  const without = state => (state.name === 'presenting' ? Object.assign({}, state, { clickedAt: null }) : state);

  states.forEach((state, place) => {
    const time = at(10 * second);
    assert.deepEqual(without(pressMouse(state, 'left', time)), pressKey(state, 'PageDown', time), 'forward, state ' + place);
    assert.deepEqual(without(pressMouse(state, 'right', time)), pressKey(state, 'PageUp', time), 'back, state ' + place);
  });

  const last = onSlide(4, true);
  assert.equal(pressMouse(last, 'left', at(10 * second)).name, 'thanks', 'forward from a black last slide still ends the talk');
  assert.equal(pressMouse(onSlide(2, true), 'right', at(10 * second)).black, false, 'back ends the black screen');
});

test('the middle button does nothing in any state', () => {
  const thanks = { name: 'thanks', talk: booked(), since: 0 };
  const skipped = { name: 'skipped', talk: booked(), reason: 'no-show' };
  const states = [idleState(), waitingOnTitle().state, presenting().state, Object.assign({}, presenting().state, { black: true }), thanks, skipped];

  states.forEach(state => assert.equal(pressMouse(state, 'middle', at(10 * second)), state, state.name));
});

test('the second left click of a double click does nothing, so a double click moves one slide and not two', () => {
  assert.equal(doubleClickMs, 500);
  assert.equal(secondOfDoubleClick(null, 1000), false);
  assert.equal(secondOfDoubleClick(undefined, 1000), false);
  assert.equal(secondOfDoubleClick(1000, 1000), true);
  assert.equal(secondOfDoubleClick(1000, 1500), true, 'five hundred milliseconds exactly');
  assert.equal(secondOfDoubleClick(1000, 1501), false);
  assert.equal(secondOfDoubleClick(1000, 999), false, 'a clock that was put back');

  const title = waitingOnTitle();
  const started = title.click('left', at(3 * second));
  assert.equal(started.name, 'presenting');
  assert.equal(title.click('left', at(3 * second + 100)), started, 'the double click starts the talk and does not skip its first slide');
  assert.equal(title.state.slide, 0);

  const screen = presenting();
  const first = screen.click('left', at(10 * second));
  assert.equal(first.slide, 1);
  assert.equal(screen.click('left', at(10 * second + 200)), first, 'a double click');
  assert.equal(screen.click('left', at(10 * second + 500)), first, 'five hundred milliseconds is still a double click');
  assert.equal(screen.click('left', at(10 * second + 501)).slide, 2, 'a click that was left out does not start the time again');
  assert.equal(screen.click('left', at(10 * second + 3000)).slide, 3, 'a click much later counts');
});

test('a double click on the last slide gives the thanks card once, and a double right click goes back twice', () => {
  const last = presenting();
  last.press('End', at(5 * second));
  const thanks = last.click('left', at(10 * second));
  assert.equal(thanks.name, 'thanks');
  assert.equal(last.click('left', at(10 * second + 100)), thanks);

  const screen = presenting();
  screen.press('End', at(5 * second));
  assert.equal(screen.click('right', at(10 * second)).slide, 3);
  assert.equal(screen.click('right', at(10 * second + 100)).slide, 2, 'only a forward click is left out');
});

test('only a left click that moved the talk starts the double click time, and a key is not a click', () => {
  const screen = presenting();
  screen.click('left', at(10 * second));
  assert.equal(screen.state.slide, 1);
  screen.click('right', at(10 * second + 100));
  assert.equal(screen.state.slide, 0);
  assert.equal(screen.click('left', at(10 * second + 200)), screen.state, 'still inside the time of the first left click');
  assert.equal(screen.state.slide, 0);

  const keys = presenting();
  keys.press('Enter', at(10 * second));
  assert.equal(keys.state.slide, 1);
  assert.equal(keys.click('left', at(10 * second + 100)).slide, 2, 'a click right after a key counts');

  const nothing = presenting();
  nothing.click('middle', at(10 * second));
  assert.equal(nothing.click('left', at(10 * second + 100)).slide, 1, 'the middle button does not start the time');
});

test('on the card that says the slides are not ready, any click ends the talk at once, and the talk is remembered as ended', () => {
  [null, { ok: false, error: 'not shared', fetchedAt: '2026-10-08T18:00:00Z' }, { ok: true, pages: [] }].forEach(missing => {
    ['left', 'right', 'middle'].forEach(button => {
      const screen = notReady(missing);
      const card = screen.state;
      const ended = screen.click(button, at(2 * second));
      const label = button + ' ' + JSON.stringify(missing);

      assert.equal(ended.name, 'skipped', label);
      assert.equal(ended.reason, 'not-ready');
      assert.equal(ended.talk, card.talk);
      assert.equal(restartsRotation(card, ended), true, label);
      assert.equal(screen.skipped.size, 1, 'the talk does not come back');

      assert.equal(screen.look(at(3 * second)).name, 'idle');
      assert.equal(screen.look(at(2 * minute)).name, 'idle', 'it does not start again');
    });
  });

  const screen = notReady(null);
  const card = screen.state;
  screen.click('left', at(2 * second));
  assert.equal(screen.click('left', at(2 * second + 100)).name, 'skipped', 'a double click ends it once');
  assert.equal(screen.skipped.size, 1);
  assert.equal(restartsRotation(card, screen.state), true);
});

test('the rotation starts again only when a click took the talk off the card that says the slides are not ready', () => {
  const title = waitingOnTitle();
  const card = title.state;
  const started = title.click('left', at(3 * second));
  assert.equal(restartsRotation(card, started), false, 'a talk that starts');
  assert.equal(restartsRotation(started, title.click('left', at(5 * second))), false, 'a slide');
  assert.equal(restartsRotation(started, started), false);
  assert.equal(restartsRotation(idleState(), idleState()), false);

  const waiting = waitingOnTitle();
  waiting.press('Escape', at(10 * second));
  const before = waiting.state;
  assert.equal(restartsRotation(before, waiting.press('Escape', at(11 * second))), false, 'two Esc on a title card that has slides');

  const missing = notReady(null).state;
  assert.equal(restartsRotation(missing, missing), false, 'a click that changed nothing');
});

test('a click does nothing when no talk is on its title card or its slides', () => {
  const states = [
    idleState(),
    { name: 'thanks', talk: booked(), since: 0 },
    { name: 'skipped', talk: booked(), reason: 'no-show' },
  ];
  states.forEach(state => {
    Object.keys(clickerButtons).forEach(button => assert.equal(pressMouse(state, button, at(second)), state, state.name + ' ' + button));
  });
});

test('the context menu of the browser is blocked for as long as a talk holds the screen, and not otherwise', () => {
  assert.equal(blocksContextMenu(idleState()), false);
  ['title', 'presenting', 'thanks', 'skipped'].forEach(name => assert.equal(blocksContextMenu({ name: name }), true, name));

  const screen = makeScreen({});
  assert.equal(blocksContextMenu(screen.state), false, 'before the talk');
  screen.look(at(0));
  screen.look(at(second));
  assert.equal(blocksContextMenu(screen.state), true, 'the title card');
  screen.press(' ', at(2 * second));
  assert.equal(blocksContextMenu(screen.state), true, 'the slides');
  screen.press('End', at(3 * second));
  screen.click('left', at(4 * second));
  assert.equal(screen.state.name, 'thanks');
  assert.equal(blocksContextMenu(screen.state), true, 'the thanks card');

  assert.equal(screen.look(at(4 * second + thanksSeconds * second)).name, 'idle');
  assert.equal(blocksContextMenu(screen.state), false, 'after the talk');

  [idleState(), { name: 'title' }, { name: 'presenting' }, { name: 'thanks' }, { name: 'skipped' }].forEach(state => {
    assert.equal(blocksContextMenu(state), holdsScreen(state), 'the menu is blocked exactly when the talk holds the screen');
  });
});

test('the mouse cursor is hidden in every state: each stylesheet that names a cursor says none, and no script sets one', () => {
  const files = [];
  (function walk(folder) {
    fs.readdirSync(folder, { withFileTypes: true }).forEach(entry => {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'fonts' && entry.name !== 'data') walk(full);
      } else if (/\.(css|js|html)$/.test(entry.name)) {
        files.push(full);
      }
    });
  })(dashboardFolder);

  let named = 0;
  files.forEach(file => {
    const text = fs.readFileSync(file, 'utf8');
    const name = path.relative(dashboardFolder, file);

    if (file.endsWith('.js')) {
      const code = text.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
      assert.equal(/\.cursor\b|\bcursor\s*[:=]/.test(code), false, name + ' sets a cursor');
    } else {
      Array.from(text.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/cursor\s*:\s*([^;}"']*)/g)).forEach(match => {
        named += 1;
        assert.equal(match[1].trim(), 'none', name + ' sets a cursor');
      });
    }
  });

  assert.equal(named >= 2, true, 'base.css and the talk layer both name it');
  assert.ok(/html, body \{[^}]*cursor: none;/.test(fs.readFileSync(path.join(dashboardFolder, 'base.css'), 'utf8')));
  assert.ok(/#talk \{[^}]*cursor: none;/.test(fs.readFileSync(path.join(dashboardFolder, 'panels/talk/talk.css'), 'utf8')));
});

// core/schedule.js with stand-ins for the files it reads. The waits are held by the test, which lets
// them go a quarter of a second at a time, so a page that stays 20 seconds takes no time to pass.

const scheduleTree = path.join(workFolder, 'schedule-tree');
['config.js', 'core/schedule.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(scheduleTree, 'dashboard', file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(scheduleTree, 'dashboard', file));
});
fs.writeFileSync(path.join(scheduleTree, 'package.json'), '{ "type": "module" }\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/frame.js'), [
  'export const pace = () => 1;',
  'export const turnMs = () => 0;',
  'export const isPaused = () => globalThis.scheduleWorld.paused;',
  'export const wait = () => new Promise(resolve => globalThis.scheduleWorld.waits.push(resolve));',
].join('\n') + '\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/panels.js'), [
  'export function buildPage(id, content) {',
  "  globalThis.scheduleWorld.log.push('build ' + (content.tickerLine || id));",
  '  return { id: content.tickerLine || id, element: {} };',
  '}',
  'export const canShow = () => true;',
  "export const moduleOf = id => (id === 'ticker' ? { items: () => ['one', 'two', 'three'] } : null);",
  'export const regionOf = id => globalThis.scheduleWorld.regions[id] || null;',
  'export const topicOf = () => null;',
].join('\n') + '\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/photos.js'), 'export const ownSeconds = () => 0;\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/layout.js'), [
  'export const hasRegion = () => true;',
  "export const layoutNow = () => 'standard';",
].join('\n') + '\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/areas.js'), [
  'export async function changePage(region, page) {',
  '  const world = globalThis.scheduleWorld;',
  "  world.log.push(region + ' ' + (page ? page.id : 'none') + (page && !world.shown[region] ? ' first' : ''));",
  '  world.shown[region] = page;',
  '  return 0;',
  '}',
  'export function clearRegion(region) {',
  "  globalThis.scheduleWorld.log.push('clear ' + region);",
  '  globalThis.scheduleWorld.shown[region] = null;',
  '}',
].join('\n') + '\n');
let scheduleRuns = 0;

async function inRotation(run) {
  const world = { log: [], waits: [], paused: false, shown: {}, regions: { a: 'grid1', b: 'grid1', c: 'grid1' } };
  globalThis.scheduleWorld = world;

  try {
    scheduleRuns += 1;
    world.module = await import(pathToFileURL(path.join(scheduleTree, 'dashboard/core/schedule.js')).href + '?run=' + scheduleRuns);
    world.content = { settings: { pageSeconds: 20, rotation: { tickerSeconds: 10 } } };
    world.settle = async () => {
      for (let turn = 0; turn < 5; turn++) await new Promise(resolve => setImmediate(resolve));
    };
    // lets every wait go, a quarter of a second at a time, until this many seconds have passed
    world.pass = async seconds => {
      for (let quarter = 0; quarter < seconds * 4; quarter++) {
        world.waits.splice(0).forEach(resolve => resolve());
        await world.settle();
      }
    };
    world.pagesOf = region => world.log.filter(line => line.startsWith(region + ' ')).map(line => line.slice(region.length + 1));
    await run(world);
  } finally {
    delete globalThis.scheduleWorld;
  }
}

const gridPlaylist = ['a', 'b', 'c'].map(panel => ({ panel: panel, show: true, seconds: 0 }));

test('without a restart the rotation goes on to the next panel, and the frame is made once', async () => {
  await inRotation(async world => {
    world.module.startRotation('grid1', () => gridPlaylist, () => world.content);
    await world.settle();
    await world.pass(20);
    await world.pass(20);
    await world.pass(20);

    assert.deepEqual(world.pagesOf('grid1'), ['a first', 'b', 'c', 'a']);
  });
});

test('restartRotation clears the frames and starts the large panel again from its first panel, with the first assembly', async () => {
  await inRotation(async world => {
    world.module.startRotation('grid1', () => gridPlaylist, () => world.content);
    await world.settle();
    await world.pass(20);
    assert.deepEqual(world.pagesOf('grid1'), ['a first', 'b']);

    world.paused = true; // a talk holds the screen
    world.module.restartRotation();
    assert.deepEqual(world.log.slice(-3), ['clear grid1', 'clear grid2', 'clear ticker']);
    await world.pass(30);
    assert.deepEqual(world.pagesOf('grid1'), ['a first', 'b'], 'nothing changes while the talk holds the screen');

    world.paused = false;
    await world.pass(1);
    assert.deepEqual(world.pagesOf('grid1'), ['a first', 'b', 'a first'], 'it is the first panel again and not the third');

    await world.pass(20);
    assert.deepEqual(world.pagesOf('grid1'), ['a first', 'b', 'a first', 'b'], 'and the list goes on from there');
  });
});

test('restartRotation also starts the ticker again from its first line', async () => {
  await inRotation(async world => {
    world.module.startTicker(() => world.content);
    await world.settle();
    await world.pass(10);
    assert.deepEqual(world.pagesOf('ticker'), ['one first', 'two']);

    world.paused = true;
    world.module.restartRotation();
    await world.pass(5);
    world.paused = false;
    await world.pass(1);

    assert.deepEqual(world.pagesOf('ticker'), ['one first', 'two', 'one first']);
  });
});

test('a rotation asked to restart twice while a talk holds the screen starts again once', async () => {
  await inRotation(async world => {
    world.module.startRotation('grid1', () => gridPlaylist, () => world.content);
    await world.settle();
    await world.pass(40);
    assert.deepEqual(world.pagesOf('grid1'), ['a first', 'b', 'c']);

    world.paused = true;
    world.module.restartRotation();
    world.module.restartRotation();
    await world.pass(2);
    world.paused = false;
    await world.pass(1);
    assert.deepEqual(world.pagesOf('grid1'), ['a first', 'b', 'c', 'a first']);
  });
});

test('presentation-run.js asks for the restart only through restartsRotation, and schedule.js is the one that restarts', () => {
  const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');
  const run = read('core/presentation-run.js');

  assert.ok(run.includes("import { restartRotation } from './schedule.js';"));
  assert.equal((run.match(/restartRotation\(\)/g) || []).length, 1, 'called in one place');
  assert.ok(run.includes('if (restartsRotation(before, state)) restartRotation();'));
  assert.ok(run.includes("window.addEventListener('mousedown', onMouse, true);"), 'the buttons are read on the window, before anything else');
  assert.ok(run.includes("window.addEventListener('contextmenu', onContextMenu, true);"));
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
  fs.rmSync(workFolder, { recursive: true, force: true });
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
