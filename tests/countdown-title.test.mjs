// Tests for the title of the countdown on its own line: how wide a title is in the display font and
// where it breaks (core/countdown-title.js), what the three clocks that never cut it off write for it
// (the red countdown of Original, the wide war clock of Cybertron and the narrow war clock of Minimal), the
// room the stylesheet gives it, and the Studio field that warns above 28 characters. Nothing touches
// the network or a browser.
//
//   node tests/countdown-title.test.mjs
//
// What it looks like is checked by looking at the screen (docs/layouts.md, "Looking at a layout").

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dashboardFolder = path.join(root, 'dashboard');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-countdown-title-'));

function makeTree(name, files) {
  const folder = path.join(workFolder, name);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'package.json'), '{ "type": "module" }\n');
  files.forEach(file => {
    fs.mkdirSync(path.dirname(path.join(folder, file)), { recursive: true });
    fs.copyFileSync(path.join(root, file), path.join(folder, file));
  });
  return folder;
}

const urlOf = (folder, file) => pathToFileURL(path.join(folder, file)).href;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const withoutComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '');

const panelFiles = ['dashboard/config.js', 'dashboard/frame.js', 'dashboard/registry.js', 'dashboard/themes/registry.js', 'dashboard/themes/overlays/registry.js',
  'dashboard/panels/countdown/panel.js', 'dashboard/panels/bar-banner/panel.js', 'dashboard/panels/side/panel.js']
  .concat(fs.readdirSync(path.join(dashboardFolder, 'core')).filter(name => name.endsWith('.js')).map(name => 'dashboard/core/' + name));

const mainTree = makeTree('main', panelFiles);
const { titleLines, titleRooms, titleSpacing, titleSize } = await import(urlOf(mainTree, 'dashboard/core/countdown-title.js'));
const { textWidth } = await import(urlOf(mainTree, 'dashboard/core/text-width.js'));

const tests = [];

function test(name, run) {
  tests.push({ name: name, run: run });
}

// Runs something with a fake global, and puts the real one back
async function withGlobals(values, run) {
  const kept = {};
  Object.keys(values).forEach(name => {
    kept[name] = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value: values[name], configurable: true, writable: true });
  });
  try {
    return await run();
  } finally {
    Object.keys(values).forEach(name => {
      if (kept[name]) Object.defineProperty(globalThis, name, kept[name]);
      else delete globalThis[name];
    });
  }
}

// The three clocks: the room of a line of the title that the date shares, and the letter spacing in em
const clocks = ['original', 'wide', 'narrow'];
const spacingOf = name => titleSpacing[name];

// How wide a line is on the screen at a size, from the font's advance widths and the letter spacing
const lineWidth = (text, size, spacing) => textWidth(text, 700, size) + spacing * size * Array.from(text).length;

// The widest date: MAR 29 (and APR, MAY and so on are narrower), at 36 px
const dates = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].reduce((all, month) => all.concat([9, 10, 29, 30].map(day => month + ' ' + day)), []);
const widestDate = Math.max.apply(null, dates.map(date => lineWidth(date, titleSize, 0.06)));

// Titles of ordinary words, not more than 28 characters, and not more than 40
const ordinary28 = ['GAMEDROP', 'KICKOFF IN', 'SEASON KICKOFF', 'REGIONAL COMPETITION LOAD IN', 'CHAMPIONSHIP SEASON BEGINS', 'DISTRICT EVENT LOAD IN DAY', 'SEASON KICKOFF COUNTDOWN', 'OFFSEASON SCRIMMAGE DAY', 'BUILD SEASON MEETING', 'MATCH SCHEDULE POSTED'];
const ordinary40 = ['WORLD CHAMPIONSHIP COUNTDOWN CLOCK', 'MATCH SCHEDULE PRACTICE DAY BEGINS', 'ROBOT RELEASE FOR INSPECTION COUNTDOWN', 'SEASON KICKOFF COUNTDOWN CLOCK', 'FIRST ROBOTICS SEASON KICKOFF CLOCK'];


// The widths and the breaks, with the font's advance table

test('a title that fits beside the date stays on one line at 36 px in every clock: GAMEDROP, KICKOFF and ROLLOUT with the widest date, and the end states alone', () => {
  clocks.forEach(name => {
    ['GAMEDROP', 'KICKOFF', 'ROLLOUT', 'KICKOFF IN'].forEach(title => {
      assert.deepEqual(titleLines(title, 'MAR 29', titleRooms[name], spacingOf(name)), { lines: [title], size: 36 }, name + ': ' + title);
    });
    ['COUNTDOWN OVER', 'DATE NOT SET'].forEach(title => {
      assert.deepEqual(titleLines(title, '', titleRooms[name], spacingOf(name)), { lines: [title], size: 36 }, name + ': ' + title + ' has the line to itself');
    });
  });

  // by the numbers: the wide clock holds GAMEDROP and the widest date in 494, with 77 to spare
  const room = titleRooms.wide;
  assert.ok(lineWidth('GAMEDROP', 36, 0.06) + 24 + widestDate <= room);
  assert.ok(room - (lineWidth('GAMEDROP', 36, 0.06) + 24 + widestDate) > 70);
  assert.deepEqual([titleSize, titleRooms.original, titleRooms.wide, titleRooms.narrow], [36, 528, 494, 660]);
});

test('a title that does not fit beside the date goes to two lines: as many words on the first as fit beside the date, the rest on the second, and no line wider than its room', () => {
  const title = 'REGIONAL COMPETITION LOAD IN';

  clocks.forEach(name => {
    const room = titleRooms[name];
    const spacing = spacingOf(name);
    const found = titleLines(title, 'JAN 9', room, spacing);
    assert.equal(found.lines.length, 2, name + ': two lines');
    assert.equal(found.size, 36, name + ': at 36 px');
    assert.equal(found.lines.join(' '), title, name + ': every word is there, once');
    assert.ok(lineWidth(found.lines[0], 36, spacing) + 24 + lineWidth('JAN 9', 36, 0.06) <= room, name + ': the first line leaves the date its room');
    assert.ok(lineWidth(found.lines[1], 36, spacing) <= room, name + ': the second line has the whole room');
    assert.ok(lineWidth(title, 36, spacing) + 24 + lineWidth('JAN 9', 36, 0.06) > room, name + ': it did not fit on one');
  });

  // as many words on the first line as fit
  const narrow = titleLines('SEASON KICKOFF COUNTDOWN', 'JAN 9', titleRooms.narrow, spacingOf('narrow'));
  assert.deepEqual(narrow.lines, ['SEASON KICKOFF', 'COUNTDOWN']);
  const original = titleLines('SEASON KICKOFF COUNTDOWN CLOCK', 'JAN 9', titleRooms.original, 0);
  assert.deepEqual(original.lines, ['SEASON KICKOFF', 'COUNTDOWN CLOCK']);

  // the date takes room from the first line, so a wider date can move a word down
  const wideDate = titleLines('BUILD SEASON MEETING', 'MAR 29', titleRooms.wide, spacingOf('wide'));
  const narrowDate = titleLines('BUILD SEASON MEETING', 'NOW', titleRooms.wide, spacingOf('wide'));
  assert.ok(wideDate.lines[0].length <= narrowDate.lines[0].length, 'the first line is no longer with a wider date');
});

test('the warning threshold: a title of up to 28 characters of ordinary words fits two lines at 32 px or more in every clock, and one of up to 40 at 24 px or more', () => {
  ordinary28.forEach(title => {
    assert.ok(title.length <= 28, title + ' is one of the 28');
    clocks.forEach(name => {
      const found = titleLines(title, 'MAR 29', titleRooms[name], spacingOf(name));
      assert.ok(found.lines.length <= 2 && found.size >= 32, name + ': ' + title + ' is ' + found.lines.length + ' lines at ' + found.size);
    });
  });

  ordinary40.forEach(title => {
    assert.ok(title.length > 28 && title.length <= 40, title + ' is between 29 and 40');
    clocks.forEach(name => {
      const found = titleLines(title, 'MAR 29', titleRooms[name], spacingOf(name));
      assert.ok(found.lines.length <= 2 && found.size >= 24, name + ': ' + title + ' is ' + found.lines.length + ' lines at ' + found.size);
    });
  });

  // 28 characters of a middling width take two lines in every clock, so a title over 28 is the one the Studio warns about,
  // and a title that short (up to 10 characters) stays on one line in every clock
  clocks.forEach(name => {
    assert.equal(titleLines('REGIONAL COMPETITION LOAD IN', 'JAN 9', titleRooms[name], spacingOf(name)).lines.length, 2, name);
    assert.equal(titleLines('KICKOFF IN', 'MAR 29', titleRooms[name], spacingOf(name)).lines.length, 1, name);
  });
});

test('nothing is cut off: a title that two lines at 36 px do not hold is set at 32, 28, 24 or 20 px, and every line fits its room at the size it is given', () => {
  const sizes = new Set();

  ordinary28.concat(ordinary40, ['FIRST ROBOTICS COMPETITION SEASON KICKOFF CLOCK', 'WWWWWWW WWWWWWW WWWWWWW WWWWWWW WWWWWWW']).forEach(title => {
    clocks.forEach(name => {
      const room = titleRooms[name];
      const spacing = spacingOf(name);
      const found = titleLines(title, 'MAR 29', room, spacing);
      sizes.add(found.size);

      assert.ok([36, 32, 28, 24, 20].includes(found.size), title + ': a size of the ladder');
      assert.ok(found.lines.length >= 1 && found.lines.length <= 2, title + ': one line or two, never more');
      assert.equal(found.lines.join(' '), title, title + ': nothing dropped');
      found.lines.forEach((line, index) => {
        const dateRoom = index === 0 && found.lines.length === 2 ? 24 + lineWidth('MAR 29', found.size, 0.06) : 0;
        assert.ok(lineWidth(line, found.size, spacing) + dateRoom <= room, name + ': ' + line + ' at ' + found.size + ' fits');
      });
    });
  });
  assert.deepEqual(Array.from(sizes).sort((a, b) => b - a), [36, 32, 28, 24, 20], 'the titles above use every size of the ladder');

  // one word that no line holds is one line at the smallest size, which the stylesheet clips: a title the Studio accepts is never that wide
  const wordless = titleLines('W'.repeat(40), 'JAN 9', titleRooms.wide, 0.06);
  assert.deepEqual([wordless.lines.length, wordless.size], [1, 20]);
  assert.deepEqual(titleLines('', 'JAN 9', 494, 0.06), { lines: [''], size: 36 }, 'an empty title is an empty line');
  assert.deepEqual(titleLines('  SEASON   KICKOFF ', '', 494, 0.06), { lines: ['SEASON KICKOFF'], size: 36 }, 'spaces are one space');
});


// The rooms are the widths in the stylesheet

const css = withoutComments(read('dashboard/panels/countdown/panel.css'));

function ruleOf(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = new RegExp('(?:^|\\})\\s*' + escaped + ' \\{([^{}]*)\\}').exec(css);
  assert.ok(found, 'panels/countdown/panel.css has no rule for ' + selector);
  return found[1];
}
const numberIn = (rule, name) => {
  const found = new RegExp('(?:^|[;\\s])' + name + ': (-?\\d*\\.?\\d+)(?:px)?[;\\s]').exec(rule + ' ');
  return found ? Number(found[1]) : null;
};

test('the room of a title in each clock is the width of its line in panels/countdown/panel.css, and the letters are spaced as the stylesheet spaces them', () => {
  // the red countdown: the top line is 564 wide, less the lamp (20) and the 16 after it
  const original = 564 - numberIn(ruleOf('.countdown .lamp'), 'width') - numberIn(ruleOf('.countdown .label-group'), 'gap');
  assert.equal(numberIn(ruleOf('.countdown .top-line'), 'width'), 564);
  assert.equal(original, titleRooms.original);
  assert.equal(titleSpacing.original, 0);
  assert.ok(!/letter-spacing/.test(ruleOf('.countdown .top-line') + ruleOf('.countdown .label')), 'the red countdown does not space its letters');

  // the wide and the narrow war clocks: the width of .war-lines, with the date at its right end
  assert.equal(numberIn(ruleOf('.war-clock.war-wide .war-lines'), 'width'), titleRooms.wide);
  assert.equal(numberIn(ruleOf('html[data-layout="bar"] .war-lines'), 'width'), titleRooms.narrow);
  ['.war-clock.war-wide .war-lines span', 'html[data-layout="bar"] .war-lines span'].forEach(selector => {
    assert.ok(/letter-spacing: \.06em;/.test(ruleOf(selector)), selector + ' is spaced by .06 em');
    assert.ok(/font: 700 36px\//.test(ruleOf(selector)), selector + ' is 36 px');
  });
  assert.deepEqual([titleSpacing.wide, titleSpacing.narrow], [0.06, 0.06]);

  // the date is placed at the right end of the first line, over the end of it, so the second line has the whole room
  ['.war-clock.war-wide .war-lines .date', 'html[data-layout="bar"] .war-lines .date', '.countdown[data-title="two"] .date'].forEach(selector => {
    const rule = ruleOf(selector);
    assert.ok(/position: absolute;/.test(rule) && /right: 0;/.test(rule) && /top: 0;/.test(rule), selector + ' is at the top right');
  });

  // the title breaks where the code broke it, and nothing is cut off with an ellipsis
  ['.war-clock.war-wide .war-lines .label', 'html[data-layout="bar"] .war-lines .label', '.countdown[data-title="two"] .label'].forEach(selector => {
    assert.ok(/white-space: pre;/.test(ruleOf(selector)), selector + ' keeps the line break');
  });
  assert.ok(!/text-overflow|line-clamp/.test(css), 'panels/countdown/panel.css cuts nothing off with an ellipsis');
});

test('the red countdown of Original sets a title that does not fit at 44 px at 36, on one line or two, and two lines take the room of the bars so the days stay where they are', () => {
  const top = numberIn(ruleOf('.countdown .top-line'), 'top');
  const days = numberIn(ruleOf('.countdown .days-row'), 'top');
  assert.deepEqual([top, days], [22, 86], 'the top line is 22 from the top and the days are at 86, as they have always been');

  const small = ruleOf('.countdown[data-title="small"] .top-line');
  assert.ok(/font-size: 36px;/.test(small) && !/top:|height:|line-height/.test(small), 'one line at 36 changes only the size, so nothing moves');

  const two = ruleOf('.countdown[data-title="two"] .top-line');
  assert.ok(/font: 700 36px\/32px var\(--font-display\);/.test(two), 'two lines of 32');
  assert.ok(top + 2 * 32 <= days, 'two lines of 32 from the top end at ' + (top + 64) + ', above the days');
  assert.ok(/display: none;/.test(ruleOf('.countdown[data-title="two"] .stripes')), 'the row of bars is not drawn, because the second line is where it was');
  assert.ok(/margin-top: 6px;/.test(ruleOf('.countdown[data-title="two"] .lamp')), 'the lamp is level with the middle of the first line: (32 - 20) / 2');
  assert.ok(/align-items: flex-start;/.test(two) && /align-items: flex-start;/.test(ruleOf('.countdown[data-title="two"] .label-group')));

  // the cap of a first line at 36 px and the teeth of the frame: the first cap is below the tips, which reach 22
  const capTop = top + 32 / 2 - 0.7 * 36 / 2;
  assert.ok(capTop >= 22, 'the first line is clear of the teeth of the frame: ' + capTop);

  // no plate id (the plates have none since the ids were taken away), and the rest of the red countdown is as it was
  ['.countdown .label', '.countdown .date', '.countdown .stripes', '.countdown .days-row', '.countdown .time-row', '.countdown .segments'].forEach(selector => assert.ok(ruleOf(selector).length > 10, selector));
  assert.ok(!/plate-id/.test(read('dashboard/base.css') + read('dashboard/core/plate.js') + css), 'no stamped id');
});


// What the clocks write

const countdownFile = 'dashboard/panels/countdown/panel.js';
const barBannerFile = 'dashboard/panels/bar-banner/panel.js';
const sideFile = 'dashboard/panels/side/panel.js';
let worlds = 0;

function makeNode(log, name) {
  let text = '';
  let html = '';
  const node = {
    isConnected: true,
    dataset: {},
    style: {},
    classList: { toggle: () => {}, add: () => {}, remove: () => {} },
    animate: () => { log.push(name + '.animate'); return {}; },
    parentNode: null,
  };
  Object.defineProperty(node, 'textContent', { get: () => text, set: value => { text = String(value); log.push(name + '.text'); } });
  Object.defineProperty(node, 'innerHTML', { get: () => html, set: value => { html = String(value); } });
  return node;
}

// A box that gives one node for each selector, and 12 segments for .segment
function makeBox(log, prefix) {
  const nodes = {};
  const segments = Array.from({ length: 12 }, () => makeNode(log, prefix + '.segment'));
  const box = makeNode(log, prefix);

  box.nodes = nodes;
  box.querySelector = selector => {
    if (!nodes[selector]) {
      nodes[selector] = makeNode(log, prefix + ' ' + selector);
      if (selector === '.days-number span') nodes[selector].parentNode = makeNode(log, prefix + ' .days-number');
    }
    return nodes[selector];
  };
  box.querySelectorAll = selector => (selector === '.segment' ? segments : []);
  return box;
}

// Runs run(world) with the real panels and frame.js on a fake page whose clock is at 12:59:20 on Wed Oct 28 2026. shapes is the
// corners the page has been drawn with: '' for Original, or 'cybertron'. world.draw(content, file) mounts a panel. world.widthOfOneLetter is
// what the canvas says every letter is, which is what the red countdown measures with
async function onPage(run, shapes) {
  const folder = makeTree('page-' + (worlds += 1), panelFiles);
  const RealDate = Date;
  const world = { now: new RealDate(2026, 9, 28, 12, 59, 20, 250).getTime(), timers: [], nextTimer: 1, measured: [], log: [], widthOfOneLetter: 22 };

  class FakeDate extends RealDate {
    constructor(...parts) {
      if (parts.length === 0) super(world.now);
      else super(...parts);
    }
    static now() { return world.now; }
  }

  world.nextTick = () => {
    world.timers.sort((a, b) => a.at - b.at || a.id - b.id);
    const timer = world.timers.shift();
    world.now = Math.max(world.now, timer.at);
    timer.action();
  };
  world.pen = { font: '', measureText: text => { world.measured.push(text); return { width: text.length * world.widthOfOneLetter }; } };

  world.draw = (content, panelFile) => {
    const element = makeBox(world.log, 'panel');
    const countdown = makeBox(world.log, 'countdown');
    const real = element.querySelector;
    const clockOf = selector => (selector === '.war-clock' || selector === '.side-countdown' ? countdown : null);
    element.querySelector = selector => clockOf(selector) || real(selector);
    const host = { set innerHTML(markup) { world.markup = markup; }, get firstElementChild() { return element; }, querySelector: clockOf };

    world.element = element;
    world.countdown = countdown;
    return import(urlOf(folder, panelFile)).then(module => {
      module.mount(host, content);
      world.module = module;
      return module;
    });
  };

  const dataset = { layout: 'standard' };
  if (shapes) dataset.shapes = shapes;
  await withGlobals({
    Date: FakeDate,
    setTimeout: (action, milliseconds) => { world.timers.push({ at: world.now + (milliseconds || 0), id: world.nextTimer++, action: action }); return world.nextTimer; },
    setInterval: () => 0,
    document: {
      documentElement: { dataset: dataset, style: { setProperty() {} } },
      createElement: () => ({ getContext: () => world.pen }),
      getElementById: id => (id === 'metal-shapes' ? { insertAdjacentHTML() {} } : null),
      querySelector: () => null,
      querySelectorAll: () => [],
    },
  }, async () => {
    world.frame = await import(urlOf(folder, 'dashboard/frame.js'));
    world.frame.start({ motion: 'full', speed: 'normal' });
    world.folder = folder;
    await run(world);
  });
}

const contentFor = (label, kickoff = '2027-01-09T12:00', rollout = '') => ({
  team: { name: 'HAWKTIMUS PRIME', number: '3229', school: 'HOLLY SPRINGS HIGH SCHOOL' },
  weather: { temperature: 104, code: 3, isDay: true },
  status: { source: 'sanity' },
  settings: { countdown: { kickoff: kickoff, kickoffLabel: label, rollout: rollout, rolloutLabel: 'ROLLOUT' } },
});

// What a clock shows for a title: the mode the stylesheet reads, the title as it is written (a line break between two lines), the date,
// and the size written on the title and the date when it is not 36
const shown = world => {
  const box = world.countdown;
  const label = box.nodes['.label'];
  return { mode: box.dataset.title, label: label.textContent, date: box.nodes['.date'].textContent, size: label.style.fontSize, dateSize: box.nodes['.date'].style.fontSize };
};

test('the red countdown of Original keeps its title as it was while it fits at 44 px, with the IN and the date, and the words are not the clock of Cybertron', async () => {
  await onPage(async world => {
    await world.draw(contentFor('GAMEDROP'), countdownFile);
    assert.ok(/<section class="panel countdown" data-sequence="countdown" data-level="calm">/.test(world.markup), 'the red frame, not the war clock');
    assert.ok(!/war-/.test(world.markup), 'and nothing of the war clock');
    world.countdown = world.element; // the red countdown is its own box
    assert.deepEqual(shown(world), { mode: 'normal', label: 'GAMEDROP IN', date: 'JAN 9', size: '', dateSize: '' });
    assert.equal(world.element.dataset.level, 'calm');
  });
});

test('the red countdown sets a title that does not fit at 44 px at 36 on one line when it fits there, and on two lines when it does not, and writes the size when two lines at 36 do not hold it', async () => {
  const stateOf = (label, widthOfOneLetter) => {
    let found;
    return onPage(async world => {
      world.widthOfOneLetter = widthOfOneLetter || 22;
      await world.draw(contentFor(label), countdownFile);
      world.countdown = world.element;
      found = shown(world);
    }).then(() => found);
  };

  // the canvas says every letter is 35 px wide, which is what makes KICKOFF SEASON too wide at 44 px: one line at 36 by the table
  assert.deepEqual(await stateOf('KICKOFF SEASON', 35), { mode: 'small', label: 'KICKOFF SEASON', date: 'JAN 9', size: '', dateSize: '' });
  assert.deepEqual(await stateOf('REGIONAL COMPETITION'), { mode: 'two', label: 'REGIONAL\nCOMPETITION', date: 'JAN 9', size: '', dateSize: '' });
  assert.deepEqual(await stateOf('SEASON KICKOFF COUNTDOWN CLOCK'), { mode: 'two', label: 'SEASON KICKOFF\nCOUNTDOWN CLOCK', date: 'JAN 9', size: '', dateSize: '' });
  assert.deepEqual(await stateOf('FIRST ROBOTICS COMPETITION SEASON KICKOFF CLOCK'), { mode: 'two', label: 'FIRST ROBOTICS COMPETITION\nSEASON KICKOFF CLOCK', date: 'JAN 9', size: '24px', dateSize: '24px' });

  // the date is never dropped, which the red countdown used to do when the label was too wide
  assert.equal((await stateOf('SEASON KICKOFF COUNTDOWN CLOCK')).date, 'JAN 9');
});

test('the end states and NOW have the first line to themselves or the date beside them, in the red countdown and in both war clocks, and a new title from the editors is drawn on the next second and goes back to one line', async () => {
  const over = contentFor('KICKOFF', '2026-09-01T09:00', '2026-10-01T09:00');
  const unset = contentFor('KICKOFF', '', '');
  const now = contentFor('KICKOFF', '2026-10-28T09:00', '');

  for (const [shapes, file] of [['', countdownFile], ['cybertron', countdownFile], ['', barBannerFile]]) {
    const name = file === barBannerFile ? 'narrow' : shapes === 'cybertron' ? 'wide' : 'original';
    await onPage(async world => {
      await world.draw(over, file);
      if (name === 'original') world.countdown = world.element;
      assert.deepEqual([shown(world).label, shown(world).date, shown(world).mode], ['COUNTDOWN OVER', '', 'normal'], name + ': after Rollout');
      assert.equal(world.countdown.dataset.over, 'yes');
    }, shapes);
    await onPage(async world => {
      await world.draw(unset, file);
      if (name === 'original') world.countdown = world.element;
      assert.deepEqual([shown(world).label, shown(world).date, shown(world).mode], ['DATE NOT SET', '', 'normal'], name + ': no date');
    }, shapes);
    await onPage(async world => {
      await world.draw(now, file);
      if (name === 'original') world.countdown = world.element;
      assert.deepEqual([shown(world).date, shown(world).mode], ['NOW', 'normal'], name + ': NOW is the date');
    }, shapes);
  }

  // a new title: two lines, then one again, and the size comes off when it is 36 again
  await onPage(async world => {
    await world.draw(contentFor('GAMEDROP'), barBannerFile);
    assert.deepEqual(shown(world), { mode: 'normal', label: 'GAMEDROP', date: 'JAN 9', size: '', dateSize: '' });

    world.module.update(world.element, contentFor('FIRST ROBOTICS COMPETITION SEASON KICKOFF CLOCK'));
    world.nextTick();
    assert.deepEqual(shown(world), { mode: 'two', label: 'FIRST ROBOTICS COMPETITION\nSEASON KICKOFF CLOCK', date: 'JAN 9', size: '28px', dateSize: '28px' });

    // a closing IN is not part of the title, as it never was (core/countdown.js, cleanLabel)
    world.module.update(world.element, contentFor('REGIONAL COMPETITION LOAD IN'));
    world.nextTick();
    assert.deepEqual(shown(world), { mode: 'two', label: 'REGIONAL\nCOMPETITION LOAD', date: 'JAN 9', size: '', dateSize: '' }, 'the size came off');

    world.module.update(world.element, contentFor('GAMEDROP'));
    world.nextTick();
    assert.deepEqual(shown(world), { mode: 'normal', label: 'GAMEDROP', date: 'JAN 9', size: '', dateSize: '' });
  });
});

test('the war clocks write the title with no IN and nothing measured, on one line or two, in Cybertron\'s wide clock and in Minimal\'s narrow one, and the sidebar\'s countdown is as it was', async () => {
  const titles = [
    ['GAMEDROP', 'normal', 'GAMEDROP'],
    ['SEASON KICKOFF COUNTDOWN CLOCK', 'two', 'SEASON KICKOFF\nCOUNTDOWN CLOCK'],
  ];

  for (const [title, mode, label] of titles) {
    await onPage(async world => {
      await world.draw(contentFor(title + ' IN'), countdownFile); // the closing IN is dropped, as it always was
      assert.deepEqual([shown(world).mode, shown(world).label, shown(world).date], [mode, label, 'JAN 9'], 'wide: ' + title);
      assert.equal(world.measured.length, 0, 'the war clock measures nothing: the table of the font decides');
    }, 'cybertron');
    await onPage(async world => {
      await world.draw(contentFor(title), barBannerFile);
      assert.deepEqual([shown(world).mode, shown(world).label, shown(world).date], [mode, label, 'JAN 9'], 'narrow: ' + title);
    });
  }

  // the wide clock sets a title that the narrow one holds at 36 a little smaller, which the room of 494 against 660 is
  const widestDay = '2027-03-29T12:00'; // MAR 29 is the widest date
  await onPage(async world => {
    await world.draw(contentFor('CHAMPIONSHIP SEASON BEGINS', widestDay), countdownFile);
    assert.deepEqual([shown(world).label, shown(world).date, shown(world).size], ['CHAMPIONSHIP\nSEASON BEGINS', 'MAR 29', '32px'], 'wide: 26 characters, in two lines at 32');
  }, 'cybertron');
  await onPage(async world => {
    await world.draw(contentFor('CHAMPIONSHIP SEASON BEGINS', widestDay), barBannerFile);
    assert.deepEqual([shown(world).mode, shown(world).size], ['two', ''], 'narrow: the same title at 36');
  });

  // the countdown of the sidebar layout does not wrap: it is as it was, and writes no mode
  await onPage(async world => {
    await world.draw(contentFor('KICKOFF'), sideFile);
    assert.equal(world.countdown.dataset.title, undefined);
    assert.equal(world.countdown.nodes['.label'].textContent, 'KICKOFF IN');
    assert.equal(world.countdown.nodes['.label'].style.fontSize, undefined);
  });
});

test('every part of the countdown that writes the title does it through core/countdown-title.js, and the clocks pass the room of their line', () => {
  const panel = read('dashboard/panels/countdown/panel.js');
  assert.ok(panel.includes("{ title: { room: titleRooms.original, spacing: titleSpacing.original, single: 'small' } }"), 'Original asks for 44 px and then 36');
  assert.ok(panel.includes("{ war: true, title: { room: titleRooms[name], spacing: titleSpacing[name], single: 'normal' } }"), 'the war clocks ask for 36');
  assert.ok(panel.includes("startWar(clock, content, 'wide');"), 'and the wide one says it is wide');
  assert.ok(read('dashboard/panels/bar-banner/panel.js').includes("startWar(element.querySelector('.war-clock'), content);"), 'the banner of Minimal starts the narrow form, which is the default');
  assert.ok(!/title/.test(read('dashboard/panels/side/panel.js').replace(/data-title|teletraan-title/g, '')), 'the sidebar countdown does not ask for it');
});


// The Studio field

test('the Kickoff and Rollout labels warn above 28 characters with the words given, refuse more than 40, and keep their stored names and starting values', () => {
  const schema = withoutComments(read('studio/schemas/settingsCountdown.js'));
  assert.ok(schema.includes("const titleWarning = 'Long titles wrap to two lines on the screen.';"));
  assert.equal((schema.match(/Rule\.max\(28\)\.warning\(titleWarning\), tooLong\(Rule, 40\)/g) || []).length, 2, 'both labels');
  assert.ok(schema.includes("name: 'kickoffLabel'") && schema.includes("name: 'rolloutLabel'"), 'the stored names are the same');
  assert.ok(schema.includes("initialValue: 'KICKOFF IN'") && schema.includes("initialValue: 'ROLLOUT IN'"), 'and so are the starting values');
  assert.ok(!/Up to 12 characters fit/.test(schema.slice(schema.indexOf("name: 'kickoffLabel'"), schema.indexOf("name: 'rollout',"))), 'the old limit of 12 is gone');

  // the limit of 40 is the one the clocks can hold at 24 px, for ordinary words
  assert.ok(Math.max.apply(null, ordinary40.map(title => title.length)) <= 40);
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
