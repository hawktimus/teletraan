// Tests for the accessibility rules of docs/accessibility.md: the pairs of colors that an audit of the real screen found
// too faint, the color cues that do not depend on color, and (where Playwright is installed) the real pixels.
//
//   - the plates under text (the Retro cel, the bar cards, the war clock) keep 4.5:1 for the team text colors, for Prime
//     and for Nova, in each color theme
//   - the simulated color vision of tools/color-vision.mjs: a status pair that comes closer than 11 under any kind of color
//     blindness has a cue that is not a color (a word, an icon or an outline), and the list of those pairs is the one
//     written here
//   - the real screen: tools/contrast-probe.mjs measures the pixels behind every text of a set of pages
//
//   node tests/accessibility.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

let passed = 0;
async function test(name, run) {
  try {
    await run();
    passed += 1;
    console.log('ok    ' + name);
  } catch (error) {
    console.log('FAIL  ' + name + '\n' + error.stack);
    process.exitCode = 1;
  }
}

function luminance(hex) {
  const [red, green, blue] = [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255)
    .map(value => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
function ratio(first, second) {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

// The hex colors a stylesheet gives to custom properties: { '--lilac': '#c7b1ec' }. A value that is var(--other) is looked up.
function variables(file) {
  const found = {};
  for (const match of read(file).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) found[match[1]] = match[2].trim().replace(/\s*\/\*.*$/, '');
  Object.keys(found).forEach(name => {
    const link = /^var\((--[a-z0-9-]+)\)$/.exec(found[name]);
    if (link && found[link[1]]) found[name] = found[link[1]];
  });
  return found;
}

const teams = {};
read('docs/seed/teams.ndjson').split('\n').filter(line => line.trim()).map(line => JSON.parse(line)).forEach(team => {
  teams[team.code] = Object.fromEntries(Object.entries(team.colors).map(([name, value]) => [name, value.toLowerCase()]));
});
const colorThemes = ['hawktimus', 'alternate', 'neon-prime'].map(id => ({ id: id, vars: variables('dashboard/themes/' + id + '.css') }));

function show(value) {
  return Math.round(value * 100) / 100;
}

// The Retro theme paints a panel in its cel: the team plate color, and for the inverted palette (Nova) the body color,
// because Nova's plate is a light brown gold under which its accent was 2.6 to 1 (styles/retro/tokens.css).
await test('the text colors reach 4.5:1 on the Retro cel, for Prime and Nova, in every color theme', () => {
  const retro = read('dashboard/styles/retro/tokens.css');
  assert.ok(/palette-inverted\s*\{\s*--style-cel:\s*var\(--team-body\)/.test(retro), 'Nova panels use the body color in Retro');

  const problems = [];
  colorThemes.forEach(theme => ['prime', 'nova'].forEach(code => {
    const team = teams[code];
    const cel = code === 'nova' ? team.body : team.plate;
    // Hawktimus takes its accent and text from the team, the other themes have their own
    const accent = theme.id === 'hawktimus' ? team.accent : theme.vars['--yellow'];
    const text = {
      white: theme.id === 'hawktimus' ? team.text : theme.vars['--white'],
      accent: accent,
      lilac: theme.vars['--lilac'],
      progress: theme.vars['--status-progress'],
      'bright red': theme.vars['--danger-bright'],
    };
    Object.keys(text).forEach(name => {
      const got = ratio(text[name], cel);
      if (got < 4.5) problems.push(theme.id + ' ' + code + ': ' + name + ' ' + text[name] + ' on the cel ' + cel + ' is ' + show(got) + ':1');
    });
  }));
  assert.deepEqual(problems, []);
});

await test('the High priority and the blocked count use the bright red, which holds 4.5:1 on the Retro cel', () => {
  assert.ok(/\.priority-high\s*\{\s*color:\s*var\(--danger-bright\)/.test(read('dashboard/panels/monday-department/panel.css')));
  assert.ok(/\.line-blocked\s*\{\s*color:\s*var\(--danger-bright\)/.test(read('dashboard/panels/task-counts/panel.css')));
});

await test('Nova in the bar layout: the war clock reads in the label color and the cards and TEAM plate in the dark shade, and both hold 4.5:1', () => {
  const css = read('dashboard/layouts/bar-minimal.css');
  assert.ok(/\[data-layout="bar"\]\.palette-inverted\s*\{\s*--style-digits:\s*var\(--team-label\)/.test(css));
  assert.ok(/\[data-layout="bar"\]\.palette-inverted \.card-fill\s*\{\s*fill:\s*var\(--team-dark\)/.test(css));

  const nova = teams.nova;
  const warPlate = variables('dashboard/tokens.css')['--war-plate'];
  assert.ok(ratio(nova.label, warPlate) >= 7, 'label on the war plate');
  // The labels are drawn at .88 of the ink, so the blend is what is read
  const blend = (ink, ground, alpha) => '#' + [1, 3, 5].map(at => Math.round(parseInt(ink.slice(at, at + 2), 16) * alpha + parseInt(ground.slice(at, at + 2), 16) * (1 - alpha)).toString(16).padStart(2, '0')).join('');
  assert.ok(ratio(blend(nova.label, warPlate, 0.88), warPlate) >= 4.5, 'dim label on the war plate');
  ['accent', 'label', 'text'].forEach(name => assert.ok(ratio(nova[name], nova.dark) >= 4.5, name + ' on the dark shade'));
});

await test('the war clock date and labels are drawn at .88 of the ink, and Prime amber holds 4.5:1 on the armor at that strength', () => {
  const panel = read('dashboard/panels/countdown/panel.css');
  assert.equal((panel.match(/--war-dim: \.88/g) || []).length, 2);
  const blend = (ink, ground, alpha) => '#' + [1, 3, 5].map(at => Math.round(parseInt(ink.slice(at, at + 2), 16) * alpha + parseInt(ground.slice(at, at + 2), 16) * (1 - alpha)).toString(16).padStart(2, '0')).join('');
  const armor = '#3a3a40'; // the lightest part of the armor plate behind the date, from the pixels of the audit
  assert.ok(ratio(blend('#ffb327', armor, 0.88), armor) >= 4.5);
});

await test('the titles and labels of the color themes with their own plates use the theme white, not the team header ink', () => {
  const base = read('dashboard/base.css');
  assert.ok(/html\.theme-neon-prime,\s*html\.theme-alternate\s*\{\s*--head-ink:\s*var\(--white\);\s*--head-number:\s*var\(--yellow\);/.test(base));
  assert.ok(/\.area \.page > \.label\s*\{\s*color:\s*var\(--head-ink, var\(--team-header-ink\)\)/.test(base), 'the label of a small panel follows the title');
  colorThemes.filter(theme => theme.id !== 'hawktimus').forEach(theme => {
    assert.ok(ratio(theme.vars['--white'], theme.vars['--purple']) >= 4.5, theme.id + ' white on its title plate');
    // Nova's dark header ink on those plates is what the audit found at 1.2 to 1
    assert.ok(ratio(teams.nova.headerInk, theme.vars['--purple']) < 4.5, theme.id + ': the rule above is needed');
  });
});

await test('the Retro small panel label is ink on its plate, which is the accent of the team', () => {
  const retro = read('dashboard/styles/retro/theme.css');
  assert.ok(/\.area \.page > \.label \{ color: var\(--style-ink\); \}/.test(retro));
  const ink = variables('dashboard/styles/retro/tokens.css')['--style-ink'];
  ['prime', 'nova'].forEach(code => assert.ok(ratio(ink, teams[code].accent) >= 4.5, code + ' accent plate'));
});

// Color vision

const { simulate, distance, closePairs, limit } = await import(pathToFileURL(path.join(root, 'tools/color-vision.mjs')).href);
const hexToRgb = hex => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16));

await test('the color blindness simulation keeps white and black, and CIEDE2000 gives 100 between them', () => {
  ['protanopia', 'deuteranopia', 'tritanopia'].forEach(kind => {
    assert.ok(simulate([255, 255, 255], kind).every(value => Math.abs(value - 255) < 2), kind + ' keeps white');
    assert.ok(simulate([0, 0, 0], kind).every(value => value < 1), kind + ' keeps black');
  });
  assert.equal(Math.round(distance([255, 255, 255], [0, 0, 0])), 100);
});

await test('In Progress and To Do are the same color to a person with protanopia, so the chart draws To Do as an outline', () => {
  const theme = colorThemes[0].vars;
  const colors = { status: { 'In progress': hexToRgb(theme['--status-progress']), 'To do': hexToRgb(theme['--lilac']) } };
  const close = closePairs(colors);
  assert.ok(close.some(pair => pair.kind === 'protanopia' && pair.gap < 3), 'protanopia cannot tell them apart');
  const css = read('dashboard/panels/monday-charts/panel.css');
  assert.ok(/\.part-todo\s*\{[^}]*border: 4px solid var\(--status-next\)[^}]*background: none/.test(css), 'To Do is an outline');
  assert.ok(/\.segment\.part-todo\s*\{[^}]*color: var\(--status-next\)/.test(css), 'the number in it is drawn in the outline color');
  assert.ok(limit >= 11);
});

await test('every status, priority and tag that carries meaning is also a word, a shape or an outline', () => {
  assert.ok(/priority-\$\{row\.priorityLevel\}">\$\{escapeHtml\(row\.priority\)\}/.test(read('dashboard/panels/monday-department/panel.js')), 'the priority is written');
  assert.ok(/the word is there for anyone who cannot tell the\s+colours apart/.test(read('dashboard/monday.css')), 'the status chip is a word');

  // A task row has its status as a word and as a shape of its own
  const tasks = read('dashboard/panels/tasks/panel.js');
  assert.ok(/statusMark\(/.test(tasks) && /label: 'BLOCKED'/.test(tasks), 'the row has a shape and a word');
  const marks = read('dashboard/core/marks.js');
  ['blocked', 'in-progress', 'up-next', 'done'].forEach(status => assert.ok(marks.includes(status), 'a shape for ' + status));

  // The chart legend names each part, and the three parts are always in the same order
  assert.ok(/\{ id: 'done', word: 'DONE' \}, \{ id: 'progress', word: 'IN PROGRESS' \}, \{ id: 'todo', word: 'TO DO' \}/.test(read('dashboard/panels/monday-charts/panel.js')));
});

// The real screen. These pages are the ones the audit found failing; the whole matrix is `node tools/contrast-probe.mjs`.

async function realScreen() {
  const { loadPlaywright, serveDashboard } = await import(pathToFileURL(path.join(root, 'tools/screenshots.mjs')).href);
  const playwright = await loadPlaywright();
  if (!playwright) {
    console.log('skip  the real pixels: Playwright is not installed here (tests/motion/README.md says how)');
    return;
  }
  const { probePage } = await import(pathToFileURL(path.join(root, 'tools/contrast-probe.mjs')).href);

  const page = (panel, extra) => '/index.html?sample=1&still=1&panel=' + panel + extra;
  const pages = [
    ['retro nova events', page('events', '&screen=retro&team=nova')],
    ['retro nova tasks', page('tasks', '&screen=retro&team=nova')],
    ['retro nova task counts', page('task-counts', '&screen=retro&team=nova')],
    ['retro prime task counts', page('task-counts', '&screen=retro&team=prime')],
    ['retro prime monday', page('monday-department', '&screen=retro&team=prime&dept=build&list=open')],
    ['original nova small panel', page('next-event', '&screen=original&team=nova')],
    ['bar nova agenda', page('tonight', '&screen=original&team=nova&layout=bar')],
    ['bar prime tasks', page('tasks', '&screen=original&team=prime&layout=bar')],
    ['cybertron nova tasks', page('tasks', '&screen=cybertron&team=nova')],
    ['neon prime nova leadership', page('leadership', '&screen=original&team=nova&theme=neon-prime')],
    ['alternate nova leadership', page('leadership', '&screen=original&team=nova&theme=alternate')],
    ['neon prime retro nova tasks', page('tasks', '&screen=retro&team=nova&theme=neon-prime')],
    ['foundry nova tasks', page('tasks', '&screen=foundry&team=nova')],
    ['foundry prime tasks', page('tasks', '&screen=foundry&team=prime')],
  ];

  const server = await serveDashboard(path.join(root, 'dashboard'));
  const browser = await playwright.chromium.launch();
  const failures = [];
  try {
    for (const [name, url] of pages) {
      const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      const tab = await context.newPage();
      const items = await probePage(tab, 'http://127.0.0.1:' + server.port, { name: name, url: url });
      await context.close();

      assert.ok(items.length > 20, name + ': the page has text');
      items.forEach(item => {
        const need = item.fontSize >= 96 ? 3 : 4.5;
        if (item.low < need && !knownFaint(name, item)) failures.push(name + ': "' + item.text + '" (' + item.fontSize + 'px) is ' + item.low + ':1 on ' + item.behind.join(','));
      });
    }
  } finally {
    await browser.close();
    await server.close();
  }
  assert.deepEqual([...new Set(failures)], []);
}

// What the audit left, and why (docs/accessibility.md): each one is on a layout the contrast lane does not change
function knownFaint(name, item) {
  // The sample badge is only on sample pages
  if (/SAMPLE CONTENT/.test(item.text)) return true;
  // A banner line of a pack runs over the frame line of the banner in Cybertron
  if (item.where.includes('banner-line')) return true;
  // The team and the age at the end of a Monday header run over the end of the slanted title plate (layout, not color)
  if (item.where.includes('div.tag > span.ago')) return true;
  return false;
}

await test('the real pixels behind every text of the pages the audit fixed hold 4.5:1 (3:1 at 96px and more)', realScreen);

console.log('\n' + passed + ' passed');
