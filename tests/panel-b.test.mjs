// Tests for Panel B, the small frame under the countdown: it is always filled in the standard
// layout. The list it follows (core/panel-order.js, withStandIns), the order it chooses in
// (core/schedule.js, run for real with stand-ins for the page), and the panel it falls back on
// (panels/team-tile). The sidebar and bar layouts have no small frame, and that is checked too.
// Nothing is drawn and nothing touches the network.
//
//   node tests/panel-b.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-panel-b-'));

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

// The registry and the list builder, with the files they read
const mainTree = makeTree('main', ['dashboard/config.js', 'dashboard/registry.js', 'dashboard/core/panel-order.js']);
const config = await import(urlOf(mainTree, 'dashboard/config.js'));
const { panels } = await import(urlOf(mainTree, 'dashboard/registry.js'));
const order = await import(urlOf(mainTree, 'dashboard/core/panel-order.js'));
const { withPages, withStandIns, playlistOf } = order;

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const idsOf = steps => steps.map(step => step.panel);
const smallPanels = ['task-counts', 'next-event', 'forecast', 'safety-days', 'sponsor-logo'];


// The panel that is always there

test('team-tile is a small panel marked as the last resort, and no other panel is', () => {
  const marked = panels.filter(panel => panel.lastResort);
  assert.deepEqual(marked.map(panel => panel.id), ['team-tile']);

  const tile = marked[0];
  assert.equal(tile.region, 'grid2');
  assert.equal(tile.topic, undefined, 'it has no topic, so it never shares one with the large frame');
  assert.equal(tile.testOnly, undefined);
  assert.equal(tile.layout, undefined);
  assert.equal(tile.pages, undefined);
  assert.equal(tile.script, './panels/team-tile/panel.js');
  assert.equal(tile.style, 'panels/team-tile/panel.css');
  assert.ok(fs.existsSync(path.join(root, 'dashboard', tile.script)));
  assert.ok(fs.existsSync(path.join(root, 'dashboard', tile.style)));
});

test('the editors are never offered team-tile: it is in no list of config.js', () => {
  ['grid1', 'grid2'].forEach(area => {
    config.defaultSettings.rotation[area].forEach(step => assert.notEqual(step.panel, 'team-tile', area));
  });
  assert.deepEqual(idsOf(config.defaultSettings.rotation.grid2), smallPanels);
});

test('team-tile always has content: it has no hasContent', () => {
  const script = read('dashboard/panels/team-tile/panel.js');
  assert.ok(!/export (function|const) hasContent/.test(script));
  assert.ok(/export function mount\(host, content\)/.test(script));
});

test('the text of team-tile is 44px or more, and its stylesheet has no animation, shadow, blur or filter', () => {
  const css = read('dashboard/panels/team-tile/panel.css');
  const tokens = read('dashboard/tokens.css');
  const size = name => Number(new RegExp('--' + name + ':\\s*(\\d+)px').exec(tokens)[1]);

  const fonts = css.match(/font:[^;]*;/g) || [];
  assert.equal(fonts.length, 4, 'a font on each of the label, number, name and school');
  fonts.forEach(line => {
    const token = /var\(--size-([a-z-]+)\)/.exec(line);
    const pixels = token ? size('size-' + token[1]) : Number(/(\d+)px\//.exec(line)[1]);
    assert.ok(pixels >= 44, line + ' is ' + pixels + 'px');
  });
  assert.ok(!/animation|transition|shadow|blur|filter|perspective/.test(css));
});


// The list the small frame follows

test('with nothing in Panel order the list is the five small panels and then team-tile', () => {
  const steps = withStandIns(withPages(playlistOf({ order: [{ panel: 'tonight', show: true }] }, 'grid2')));

  assert.deepEqual(idsOf(steps), ['forecast', 'next-event', 'sponsor-logo', 'safety-days', 'task-counts', 'team-tile']);
  assert.deepEqual(steps.map(step => step.standIn), ['spare', 'spare', 'spare', 'spare', 'spare', 'last']);
  steps.forEach(step => assert.equal(step.show, true));
});

test('the rows of Panel order come first, in their order, with their switch, and a panel with a row is never a spare', () => {
  const rows = [{ panel: 'task-counts', show: true, seconds: 9 }, { panel: 'forecast', show: false }];
  const steps = withStandIns(rows);

  assert.deepEqual(idsOf(steps), ['task-counts', 'forecast', 'next-event', 'sponsor-logo', 'safety-days', 'team-tile']);
  assert.deepEqual(steps.slice(0, 2), rows, 'the rows are the rows, with no mark');
  assert.deepEqual(steps.slice(2).map(step => step.standIn), ['spare', 'spare', 'spare', 'last']);
  assert.equal(steps.filter(step => step.panel === 'forecast').length, 1, 'a row that is off does not come back as a spare');
});

test('the list that was given is not changed, and the large panels and the test panel are not in it', () => {
  const rows = [{ panel: 'next-event', show: true }];
  withStandIns(rows);
  assert.deepEqual(rows, [{ panel: 'next-event', show: true }]);

  const ids = idsOf(withStandIns([]));
  assert.ok(!ids.includes('stand-in-tile'), 'the hardware test panel');
  ids.forEach(id => assert.equal(panels.find(panel => panel.id === id).region, 'grid2', id));
});

test('every small panel of the registry that is not the last resort is a spare when it has no row', () => {
  const registered = panels.filter(panel => panel.region === 'grid2' && !panel.testOnly && !panel.lastResort).map(panel => panel.id);
  assert.deepEqual(registered.slice().sort(), smallPanels.slice().sort());
  assert.deepEqual(idsOf(withStandIns([])).slice(0, -1).sort(), registered.slice().sort());
});


// The scheduler, the real file with stand-ins for the page

const schedulerTree = makeTree('scheduler', [
  'dashboard/config.js', 'dashboard/registry.js', 'dashboard/core/schedule.js', 'dashboard/core/layout.js', 'dashboard/core/theme.js', 'dashboard/core/style.js', 'dashboard/core/corner-art.js',
  'dashboard/core/pack-extras.js', 'dashboard/themes/registry.js', 'dashboard/themes/overlays/registry.js',
]);
const standIns = {
  // the waits are held by the test, which lets them go a quarter of a second at a time
  'dashboard/frame.js': [
    'export const pace = () => 1;',
    'export const turnMs = () => 0;',
    'export const isPaused = () => false;',
    'export const wait = () => new Promise(resolve => globalThis.panelBWorld.waits.push(resolve));',
  ],
  'dashboard/core/photos.js': ['export const ownSeconds = () => 0;'],
  'dashboard/core/areas.js': [
    'export async function changePage(region, page) {',
    "  globalThis.panelBWorld.log.push(region + ' ' + (page ? page.id : 'none'));",
    '  return 0;',
    '}',
    'export function clearRegion(region) {',
    "  globalThis.panelBWorld.log.push('clear ' + region);",
    '}',
  ],
  'dashboard/core/panels.js': [
    "import { panels } from '../registry.js';",
    'export const regionOf = id => (panels.filter(panel => panel.id === id)[0] || { region: null }).region;',
    'export const topicOf = id => (panels.filter(panel => panel.id === id)[0] || {}).topic || null;',
    'export const moduleOf = () => null;',
    'export const canShow = id => globalThis.panelBWorld.canShow(id);',
    'export function buildPage(id) {',
    "  if (globalThis.panelBWorld.fail.includes(id)) throw new Error('stand-in: ' + id + ' cannot be drawn');",
    '  return { id: id, region: regionOf(id), element: {} };',
    '}',
  ],
};
Object.keys(standIns).forEach(file => {
  fs.mkdirSync(path.dirname(path.join(schedulerTree, file)), { recursive: true });
  fs.writeFileSync(path.join(schedulerTree, file), standIns[file].join('\n') + '\n');
});

let schedulerRuns = 0;
const pageWith = name => ({ documentElement: { dataset: { layout: name } } });

// Runs a body on a fresh copy of schedule.js, which remembers which topic each region shows, in a page
// with this layout. world.canShow decides which panels have content, world.fail which ones cannot be drawn.
async function inRotation(layoutName, run) {
  const world = { log: [], waits: [], canShow: () => true, fail: [] };

  await withGlobals({ panelBWorld: world, document: pageWith(layoutName) }, async () => {
    schedulerRuns += 1;
    world.module = await import(urlOf(schedulerTree, 'dashboard/core/schedule.js') + '?run=' + schedulerRuns);
    world.content = { settings: { pageSeconds: 20, rotation: {} } };
    world.settle = async () => {
      for (let turn = 0; turn < 8; turn++) await new Promise(resolve => setImmediate(resolve));
    };
    world.pass = async seconds => {
      for (let quarter = 0; quarter < seconds * 4; quarter++) {
        world.waits.splice(0).forEach(resolve => resolve());
        await world.settle();
      }
    };
    world.pagesOf = region => world.log.filter(line => line.startsWith(region + ' ')).map(line => line.slice(region.length + 1));
    // the small frame as shell.js starts it, from the rows of Panel order
    world.startSmall = rows => world.module.startRotation('grid2', () => withStandIns(withPages(playlistOf({ order: rows }, 'grid2'))), () => world.content);
    world.startLarge = ids => world.module.startRotation('grid1', () => ids.map(panel => ({ panel: panel, show: true })), () => world.content);
    // the way shell.js starts it, in a layout that may get the small frame later (core/layout-apply.js changes the layout live)
    world.startSmallLive = rows => world.module.startRotationForLayouts('grid2', () => withStandIns(withPages(playlistOf({ order: rows }, 'grid2'))), () => world.content);
    world.changeLayout = name => { globalThis.document.documentElement.dataset.layout = name; };
    await run(world);
  });
}

async function quietly(run) {
  const real = console.error;
  console.error = () => {};
  try {
    return await run();
  } finally {
    console.error = real;
  }
}

const rows = (ids, hidden = []) => ids.map(panel => ({ panel: panel, show: !hidden.includes(panel) }));
const has = ids => id => ids.includes(id);

test('when no small panel has content the small frame shows team-tile, page after page, and is never emptied', async () => {
  await inRotation('standard', async world => {
    world.canShow = has(['team-tile']);
    world.startSmall([]);
    await world.settle();
    await world.pass(90);

    const pages = world.pagesOf('grid2');
    assert.ok(pages.length >= 5, pages.join(' '));
    pages.forEach(page => assert.equal(page, 'team-tile'));
    assert.ok(!world.log.includes('grid2 none'));
  });
});

test('with only the weather the small frame shows the forecast and never team-tile', async () => {
  await inRotation('standard', async world => {
    world.canShow = has(['forecast', 'team-tile']);
    world.startSmall([]); // a saved Panel order that has no small row, such as one with the Daily Agenda row only
    await world.settle();
    await world.pass(90);

    const pages = world.pagesOf('grid2');
    assert.ok(pages.length >= 5);
    pages.forEach(page => assert.equal(page, 'forecast'));
  });
});

test('the rows of the list are used in their order while one has content, and the spares are not touched', async () => {
  await inRotation('standard', async world => {
    world.startSmall(rows(['safety-days', 'task-counts']));
    await world.settle();
    await world.pass(90);

    assert.deepEqual(world.pagesOf('grid2').slice(0, 6), ['safety-days', 'task-counts', 'safety-days', 'task-counts', 'safety-days', 'task-counts']);
  });
});

test('a row that is switched off stays off while anything else has content, and is never used in place of team-tile', async () => {
  await inRotation('standard', async world => {
    world.canShow = has(['forecast', 'next-event', 'team-tile']);
    world.startSmall(rows(['forecast', 'next-event'], ['forecast']));
    await world.settle();
    await world.pass(90);
    world.pagesOf('grid2').forEach(page => assert.equal(page, 'next-event'));
    assert.ok(world.pagesOf('grid2').length >= 4);
  });

  await inRotation('standard', async world => {
    world.canShow = has(['forecast', 'team-tile']);
    world.startSmall(rows(['forecast'], ['forecast']));
    await world.settle();
    await world.pass(90);
    world.pagesOf('grid2').forEach(page => assert.equal(page, 'team-tile'), 'only the switched off row has content, so the last resort');
  });
});

test('a spare with another topic is used before a row that repeats the topic of the large frame, and that row before team-tile', async () => {
  // the large frame shows Tasks, and the one row of the list is the task counts, which have the same topic
  await inRotation('standard', async world => {
    world.canShow = has(['tasks', 'task-counts', 'forecast', 'team-tile']);
    world.startLarge(['tasks']);
    world.startSmall(rows(['task-counts']));
    await world.settle();
    await world.pass(60);
    assert.deepEqual(world.pagesOf('grid1').slice(0, 1), ['tasks']);
    world.pagesOf('grid2').forEach(page => assert.equal(page, 'forecast'));
  });

  await inRotation('standard', async world => {
    world.canShow = has(['tasks', 'task-counts', 'team-tile']);
    world.startLarge(['tasks']);
    world.startSmall(rows(['task-counts']));
    await world.settle();
    await world.pass(60);
    assert.ok(world.pagesOf('grid2').length >= 2);
    world.pagesOf('grid2').forEach(page => assert.equal(page, 'task-counts'), 'an empty frame and the tile are both worse than a repeat');
  });
});

test('the rule that the two frames never show one topic still holds while a row without that topic has content', async () => {
  await inRotation('standard', async world => {
    world.canShow = has(['tasks', 'task-counts', 'next-event', 'team-tile']);
    world.startLarge(['tasks']);
    world.startSmall(rows(['task-counts', 'next-event']));
    await world.settle();
    await world.pass(60);
    world.pagesOf('grid2').forEach(page => assert.equal(page, 'next-event'));
  });
});

test('the large frame has the first round only: a topic that the small frame holds keeps its page away', async () => {
  await inRotation('standard', async world => {
    world.canShow = has(['tasks', 'task-counts', 'team-tile']);
    world.startSmall(rows(['task-counts'])); // the small frame is on the task counts first
    await world.settle();
    world.startLarge(['tasks']);
    await world.settle();
    await world.pass(5);

    assert.deepEqual(world.pagesOf('grid2').slice(0, 1), ['task-counts']);
    assert.ok(!world.pagesOf('grid1').includes('tasks'), 'Tasks does not take a topic that the small frame has');
  });
});

test('a panel that cannot be drawn is skipped, then the next kind is tried, and at the end team-tile', async () => {
  await quietly(async () => {
    await inRotation('standard', async world => {
      world.fail = ['forecast'];
      world.startSmall([]);
      await world.settle();
      await world.pass(40);
      assert.deepEqual(world.pagesOf('grid2').slice(0, 2), ['next-event', 'sponsor-logo']);
    });

    await inRotation('standard', async world => {
      world.fail = smallPanels.slice();
      world.startSmall(rows(['task-counts']));
      await world.settle();
      await world.pass(40);
      assert.ok(world.pagesOf('grid2').length >= 2);
      world.pagesOf('grid2').forEach(page => assert.equal(page, 'team-tile'), 'every other small panel failed');
    });
  });
});

test('whichever small panels have content, and whatever the list and the large frame hold, the small frame is never empty', async () => {
  const lists = {
    'the list of the Studio': rows(smallPanels),
    'a list with no small panel': [],
    'every row off': rows(smallPanels, smallPanels),
    'one row, off': rows(['forecast'], ['forecast']),
    'one row, on': rows(['safety-days']),
  };
  const topicsOnLeft = [['tasks'], ['events'], ['sponsor-feature']]; // the topics tasks, events and sponsors
  let combinations = 0;

  for (const name of Object.keys(lists)) {
    for (let mask = 0; mask < 32; mask++) {
      const withContent = smallPanels.filter((id, place) => mask & (1 << place));
      const left = topicsOnLeft[mask % topicsOnLeft.length];

      await inRotation('standard', async world => {
        world.canShow = has(withContent.concat(left, ['team-tile']));
        world.startLarge(left);
        world.startSmall(lists[name]);
        await world.settle();
        await world.pass(75);

        const small = world.pagesOf('grid2');
        const where = name + ', with content ' + (withContent.join(' ') || 'nothing') + ', large frame ' + left;
        assert.ok(small.length >= 4, where + ': ' + small.join(' '));
        assert.ok(!small.includes('none'), where);
        assert.ok(!world.log.includes('clear grid2'), where);

        const switchedOff = lists[name].filter(row => row.show === false).map(row => row.panel);
        small.forEach(page => assert.ok(!switchedOff.includes(page), where + ': ' + page + ' is switched off'));
        small.forEach(page => assert.ok(page === 'team-tile' || withContent.includes(page), where + ': ' + page + ' has no content'));
        if (withContent.filter(id => !switchedOff.includes(id)).length === 0) small.forEach(page => assert.equal(page, 'team-tile', where));
      });
      combinations += 1;
    }
  }
  assert.equal(combinations, 160);
});


// The layouts that have no small frame

test('the sidebar and the bar layouts never start the small frame: the list is not read and nothing is built or shown', async () => {
  for (const name of ['sidebar', 'bar']) {
    await inRotation(name, async world => {
      let asked = 0;
      world.module.startRotation('grid2', () => { asked += 1; return withStandIns([]); }, () => world.content);
      await world.settle();
      await world.pass(60);

      assert.equal(asked, 0, name);
      assert.deepEqual(world.log, [], name);
    });
  }
});

test('started for layouts, as shell.js does, the small frame idles in the sidebar and bar layouts: nothing is read, built or shown', async () => {
  for (const name of ['sidebar', 'bar']) {
    await inRotation(name, async world => {
      let asked = 0;
      world.module.startRotationForLayouts('grid2', () => { asked += 1; return withStandIns([]); }, () => world.content);
      await world.settle();
      await world.pass(60);

      assert.equal(asked, 0, name);
      assert.deepEqual(world.log, [], name);
    });
  }
});

test('a live change from the bar or sidebar layout to the standard one starts Panel B with a panel at once', async () => {
  for (const name of ['bar', 'sidebar']) {
    // the swap asks the small frame to move on, and the layout changes while the screen is apart (core/swap-run.js)
    await inRotation(name, async world => {
      world.canShow = has(['team-tile']);
      world.startSmallLive([]);
      await world.settle();
      await world.pass(30);
      assert.deepEqual(world.log, [], name + ': nothing before the swap');

      world.module.moveOn(['grid2']);
      await world.pass(1);
      assert.deepEqual(world.pagesOf('grid2'), ['team-tile'], name + ': the first page is waiting at the gate, and it is the last resort');

      world.changeLayout('standard');
      await world.pass(90);
      const pages = world.pagesOf('grid2');
      assert.ok(pages.length >= 5, name + ': ' + pages.join(' '));
      pages.forEach(page => assert.equal(page, 'team-tile'));
      assert.ok(!world.log.includes('grid2 none') && !world.log.includes('clear grid2'), name);
    });

    // the weather exists, so the first page is the forecast and team-tile is not used
    await inRotation(name, async world => {
      world.canShow = has(['forecast', 'team-tile']);
      world.startSmallLive([]);
      await world.settle();
      world.module.moveOn(['grid2']);
      await world.pass(1);
      world.changeLayout('standard');
      await world.pass(90);
      assert.ok(world.pagesOf('grid2').length >= 5);
      world.pagesOf('grid2').forEach(page => assert.equal(page, 'forecast'), name);
    });

    // with no ask at all the list notices the layout within a second, and a row that is switched off stays off
    await inRotation(name, async world => {
      world.canShow = has(['forecast', 'next-event', 'team-tile']);
      world.startSmallLive(rows(['forecast', 'next-event'], ['forecast']));
      await world.settle();
      await world.pass(10);
      assert.deepEqual(world.log, [], name);

      world.changeLayout('standard');
      await world.pass(1);
      assert.deepEqual(world.pagesOf('grid2'), ['next-event'], name);
    });

    // and the other way: the standard layout gives it up, and the list stops drawing
    await inRotation('standard', async world => {
      world.canShow = has(['team-tile']);
      world.startSmallLive([]);
      await world.settle();
      await world.pass(2);
      assert.deepEqual(world.pagesOf('grid2'), ['team-tile']);

      world.changeLayout(name);
      world.module.moveOn(['grid2']);
      await world.pass(1);
      const drawn = world.pagesOf('grid2').length;
      await world.pass(90);
      assert.equal(world.pagesOf('grid2').length, drawn, name + ': nothing more is chosen in a layout with no small frame');
    });
  }
});

test('the sidebar and the bar layouts still give the large frame its pages, and the standard layout gives both frames pages', async () => {
  for (const name of ['sidebar', 'bar', 'standard']) {
    await inRotation(name, async world => {
      world.canShow = has(['tasks', 'events', 'team-tile']); // no small panel has content, so the frames do not meet on a topic
      world.startLarge(['tasks', 'events']);
      world.startSmall([]);
      await world.settle();
      await world.pass(30);

      assert.deepEqual(world.pagesOf('grid1').slice(0, 2), ['tasks', 'events'], name);
      if (name === 'standard') assert.ok(world.pagesOf('grid2').length >= 1);
      else assert.deepEqual(world.pagesOf('grid2'), [], name);
    });
  }
});


// The way the screen starts it

test('shell.js gives the small frame the list with its spares and its last resort', () => {
  const shell = read('dashboard/shell.js');
  assert.ok(shell.includes("startRotationForLayouts('grid2', () => withStandIns(withPages(viewSidePlaylist(content))), getContent);"));
  assert.ok(shell.includes("withStandIns } from './core/panel-order.js';"));
});

test('only the standard layout has the small frame: the sidebar and bar layouts have the one big pane instead', () => {
  const layoutFile = read('dashboard/core/layout.js');
  assert.ok(/standard: \['banner', 'countdown', 'grid1', 'grid2', 'ticker', 'overlay'\]/.test(layoutFile), 'the standard layout has Panel B');
  assert.ok(/sidebar: \['banner', 'countdown', 'grid1', 'ticker', 'overlay'\]/.test(layoutFile), 'the sidebar layout has no Panel B and its big pane is Panel C');
  assert.ok(/bar: \['banner', 'column', 'grid1', 'ticker', 'overlay'\]/.test(layoutFile), 'the bar layout has no Panel B and its main panel is Panel C');
});


// team-tile, drawn

// A stand-in for the page: the host is the workbench a panel builds on, and the box is the logo's box in it
function standInPage() {
  const box = { dataset: {}, children: [], appendChild(child) { this.children.push(child); } };
  const host = { innerHTML: '', querySelector: selector => (selector === '.tile-logo' ? box : null) };
  const document = {
    createElement: () => {
      const picture = { attributes: {}, setAttribute(name, value) { this.attributes[name] = value; }, getAttribute(name) { return this.attributes[name]; }, remove() {} };
      return picture;
    },
  };
  return { host: host, box: box, document: document };
}

// Each drawing has a copy of the files of its own, because core/teams.js remembers the team that is on the screen
let tileRuns = 0;
const tileFiles = ['dashboard/config.js', 'dashboard/core/teams.js', 'dashboard/core/logo.js', 'dashboard/core/text.js', 'dashboard/panels/team-tile/panel.js'];

async function tileOn(content, setUp) {
  const page = standInPage();
  tileRuns += 1;
  const tree = makeTree('tile-' + tileRuns, tileFiles);

  return withGlobals({ document: page.document }, async () => {
    const teams = await import(urlOf(tree, 'dashboard/core/teams.js'));
    const tile = await import(urlOf(tree, 'dashboard/panels/team-tile/panel.js'));
    if (setUp) setUp(teams);
    tile.mount(page.host, content);
    return Object.assign({ html: page.host.innerHTML }, page);
  });
}

const nova = {
  code: 'nova', name: 'HAWKTIMUS NOVA', shortName: 'NOVA', number: '3426', logo: '', active: true, order: 20,
  colors: config.primeTeam.colors, metal: 'steel', glow: true, mirror: true,
};

test('team-tile draws the logo, the number, the name and the school of the built-in team from the Team box', async () => {
  const content = { team: { name: '[TEAM NAME]', number: '1234', school: '[School]' } };
  const drawn = await tileOn(content, teams => teams.useTeams(content, new Date()));

  assert.ok(drawn.html.includes('<div class="label" data-slat="label">TEAM</div>'));
  assert.ok(drawn.html.includes('<div class="number">1234</div>'));
  assert.ok(drawn.html.includes('<div class="name">[TEAM NAME]</div>'));
  assert.ok(drawn.html.includes('<div class="school">[School]</div>'));
  assert.ok(drawn.html.includes('class="logo tile-logo"') && drawn.html.includes('class="drawing"'), 'the hawk, in the logo box');
  assert.equal(drawn.box.dataset.teamLogo, undefined, 'no picture of its own, so the hawk shows');
});

test('team-tile draws the team that is about to go on the screen, as the items of the other panels do', async () => {
  const content = { team: { name: 'x', number: '0', school: '[School]' }, teams: [config.primeTeam, nova], settings: { teamMode: 'prime' } };
  const drawn = await tileOn(content, teams => {
    teams.useTeams(content, new Date()); // Prime goes on the page
    teams.useTeams(Object.assign({}, content, { settings: { teamMode: 'nova' } }), new Date()); // and Nova is wanted
    assert.equal(teams.teamPending(), true);
    assert.equal(teams.currentTeam().code, 'prime');
  });

  assert.ok(drawn.html.includes('<div class="number">3426</div>'));
  assert.ok(drawn.html.includes('<div class="name">HAWKTIMUS NOVA</div>'));
});

test('team-tile shows the picture of a team that has a logo of its own, and the text that editors typed is not markup', async () => {
  const teamWithLogo = Object.assign({}, nova, { name: '<b>NOVA</b>', logo: 'https://placeholder.invalid/nova-logo.png' });
  const content = { team: { school: 'A & B <i>HS</i>' }, teams: [config.primeTeam, teamWithLogo], settings: { teamMode: 'nova' } };
  const drawn = await tileOn(content, teams => teams.useTeams(content, new Date()));

  assert.equal(drawn.box.dataset.teamLogo, 'on');
  assert.equal(drawn.box.children[0].attributes.src, 'https://placeholder.invalid/nova-logo.png');
  assert.ok(drawn.html.includes('<div class="name">&lt;b&gt;NOVA&lt;/b&gt;</div>'));
  assert.ok(drawn.html.includes('<div class="school">A &amp; B &lt;i&gt;HS&lt;/i&gt;</div>'));
});

test('team-tile still draws when the content has no Team box, and leaves the school empty', async () => {
  const drawn = await tileOn({}, null);
  assert.ok(drawn.html.includes('<div class="school"></div>'));
  assert.ok(drawn.html.includes('<div class="name">' + config.primeTeam.name + '</div>'));
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
