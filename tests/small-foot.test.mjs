// Tests for the pages of the small frame in Cybertron: the frame has neon slashes along its foot,
// and the last line of a page must end above them. The slashes come from core/plate.js
// (cybertron-grid2). The boxes of the pages are in each panel's stylesheet, with the Cybertron
// numbers in styles/cybertron/theme.css, and the rows of a box are added up here the way the page stacks
// them. Nothing touches the network or a browser.
//
//   node tests/small-foot.test.mjs
//
// What it looks like is checked by looking at the screen (docs/layouts.md, "Looking at a layout").

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-small-foot-'));
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
fs.mkdirSync(path.join(workFolder, 'dashboard/core'), { recursive: true });
fs.copyFileSync(path.join(root, 'dashboard/core/plate.js'), path.join(workFolder, 'dashboard/core/plate.js'));

const plate = await import(pathToFileURL(path.join(workFolder, 'dashboard/core/plate.js')).href);
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const withoutComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '');

const tests = [];

function test(name, run) {
  tests.push({ name: name, run: run });
}

// The declarations of the rule with exactly this selector, as { property: value }, or {} when there is none
function rule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = new RegExp('(?:^|\\})\\s*' + escaped + '\\s*\\{([^}]*)\\}').exec(withoutComments(css));
  const out = {};
  if (!found) return out;
  found[1].split(';').forEach(part => {
    const at = part.indexOf(':');
    if (at > 0) out[part.slice(0, at).trim()] = part.slice(at + 1).trim();
  });
  return out;
}

const pixels = value => (String(value).trim() === '0' ? 0 : Number(/(-?\d+(?:\.\d+)?)px/.exec(String(value))[1]));
// the line height of a font shorthand: 600 44px/48px family
const lineOf = font => Number(/\/(\d+)px/.exec(font)[1]);

const cybertron = (read('dashboard/styles/cybertron/tokens.css') + read('dashboard/styles/cybertron/theme.css'));
const own = (panel, selector, property) => rule(cybertron, 'html[data-style="cybertron"] .' + panel + ' ' + selector)[property];
const base = (panel, selector, property) => rule(read('dashboard/panels/' + panel + '/panel.css'), '.' + panel + ' ' + selector)[property];
// the Cybertron value when there is one, the panel's own otherwise
const value = (panel, selector, property) => own(panel, selector, property) || base(panel, selector, property);

const slashTop = Math.min(...plate.barShape('cybertron-grid2').art.slashes.match(/L[\d.]+ ([\d.]+)/g).map(point => Number(point.split(' ')[1])));
const hazardBottom = 84 + 12; // the header's foot and the stripe under it (core/plate.js, cybertron-grid2)

// Each panel's rows, from the numbers of the stylesheets, as the page stacks them: the box that holds them
// and the sum of their heights
const panels = {
  forecast: () => {
    const gap = pixels(value('forecast', '.content', 'gap'));
    return { box: '.content', rows: pixels(base('forecast', '.now', 'height')) + lineOf(base('forecast', '.condition', 'font')) + lineOf(base('forecast', '.range', 'font')) + 2 * gap };
  },
  'sponsor-logo': () => {
    const name = own('sponsor-logo', '.name', 'line-height') ? pixels(own('sponsor-logo', '.name', 'line-height')) : lineOf(base('sponsor-logo', '.name', 'font'));
    return { box: '.content', rows: pixels(base('sponsor-logo', '.logo-card', 'height')) + pixels(value('sponsor-logo', '.content', 'gap')) + name };
  },
  'safety-days': () => ({ box: '.content', rows: pixels(value('safety-days', '.stacked .number', 'line-height')) + pixels(value('safety-days', '.stacked .caption', 'margin-top')) + 2 * pixels(value('safety-days', '.stacked .caption', 'line-height')) }),
  'next-event': () => {
    const margin = pixels(base('next-event', '.bar-slot', 'margin').split(' ')[0]);
    const lines = selector => (own('next-event', selector, 'line-height') ? pixels(own('next-event', selector, 'line-height')) : lineOf(base('next-event', selector, 'font')));
    return { box: '.content', rows: 2 * lines('.title') + pixels(base('next-event', '.bar-slot', 'height')) + 2 * margin + lines('.when') + lines('.location') };
  },
  'team-tile': () => ({ box: '.content', rows: pixels(base('team-tile', '.mark', 'height')) + lineOf(base('team-tile', '.name', 'font')) + 2 * lineOf(base('team-tile', '.school', 'font')) + 2 * pixels(base('team-tile', '.content', 'gap')) }),
};

test('the slashes of the small frame start at 332, and the stripe under its header ends at 96', () => {
  assert.equal(slashTop, 332);
  const hazard = plate.barShape('cybertron-grid2').art.hazard.match(/L[\d.]+ ([\d.]+)/g).map(point => Number(point.split(' ')[1]));
  assert.equal(Math.max(...hazard), hazardBottom);
});

Object.keys(panels).forEach(name => {
  test(name + ': the box of the rows starts under the stripe and ends by 336, so the last line is above the slashes', () => {
    const sums = panels[name]();
    const top = pixels(value(name, sums.box, 'top'));
    const height = pixels(value(name, sums.box, 'height'));

    assert.ok(top >= hazardBottom + 4, name + ' starts at ' + top + ', 4 or more under the stripe');
    assert.ok(top + height <= slashTop + 4, name + ' ends at ' + (top + height) + ', and the letters of its last line end a few above that');
    assert.ok(sums.rows <= height, name + ' stacks ' + sums.rows + ' in a box of ' + height);
  });
});

test('only the pages that reached the slashes have Cybertron numbers, and Original keeps the numbers of the panels', () => {
  ['forecast', 'sponsor-logo', 'safety-days', 'next-event'].forEach(name => {
    assert.ok(Object.keys(rule(cybertron, 'html[data-style="cybertron"] .' + name + ' .content')).length > 0, name + ' has a Cybertron box');
  });
  // The panels' own stylesheets are the ones of Original: the boxes are as they were
  assert.equal(base('forecast', '.content', 'height'), '264px');
  assert.equal(base('sponsor-logo', '.content', 'height'), '264px');
  assert.equal(base('safety-days', '.content', 'height'), '256px');
  assert.equal(base('next-event', '.content', 'height'), '240px');
});

test('the Cybertron rules for the small pages change no size of a letter and use no animation, shadow, blur or filter', () => {
  const start = cybertron.indexOf('The foot of the small frame has the neon slashes');
  const end = cybertron.indexOf('The war clock (panels/countdown)');
  assert.ok(start > 0 && end > start);
  const section = withoutComments(cybertron.slice(start, end));

  assert.ok(!/font-size|font:/.test(section), 'only the boxes, the gaps and the lines move');
  assert.ok(!/animation|transition|shadow|blur|filter|perspective|transform/.test(section));
  (section.match(/line-height:\s*\d+px/g) || []).forEach(line => assert.ok(pixels(line) >= 40, line + ' keeps a 44px line from touching the next'));
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
