// Tests for the Nova palette: gold as the main color and purple as the accent, the inverse of Prime, in gold
// metal, with a dark header ink for text on the main color. The seed file and the sample content hold the same values, and the pairs of colors that are read from
// the other side of the room have enough contrast: 4.5 for text and 3 for large labels and lines (WCAG).
//
//   node tests/nova-palette.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => fs.readFileSync(root + file, 'utf8');

const seeded = read('docs/seed/teams.ndjson').split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));
const sample = JSON.parse(read('dashboard/data/sample/content.json')).teams;
const wanted = {
  primary: '#D4A017', plate: '#6B4C08', body: '#241A04', accent: '#C86BFF', neon: '#8C44DC',
  pink: '#D4A017', background: '#17110A', label: '#D9A6FF', text: '#FFFFFF',
  headerInk: '#1A1200', dark: '#3D2A05', retro: '#E0A400',
};

function luminance(hex) {
  const [red, green, blue] = [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255)
    .map(value => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function ratio(first, second) {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

const nova = {
  seed: seeded.find(team => team.code === 'nova'),
  sample: sample.find(team => team.code === 'nova'),
};

test_each();

function test_each() {
  Object.keys(nova).forEach(where => {
    const team = nova[where];

    assert.equal(team.number, '3426', where + ': the number');
    assert.equal(team.metal, 'purple', where + ': the metal is purple');
    assert.equal(team.glow, true, where + ': the glow is on');
    Object.keys(wanted).forEach(name => assert.equal(team.colors[name].toUpperCase(), wanted[name], where + ': ' + name));
  });

  const prime = seeded.find(team => team.code === 'prime').colors;
  assert.equal(prime.headerInk, '#FFFFFF', 'the header ink of Prime is white');
  assert.equal(wanted.headerInk, '#1A1200', 'the header ink of Nova is dark');
  assert.equal(wanted.pink, wanted.primary, 'the conduit of Nova is its main color, gold, where Prime has purple');

  const pairs = [
    ['header ink on the main color (titles)', wanted.headerInk, wanted.primary, 7.8],
    ['white text on the dark (body text)', wanted.text, wanted.dark, 13.7],
    ['accent on the dark', wanted.accent, wanted.dark, 4.5],
    ['label on the dark', wanted.label, wanted.dark, 7],
    ['header ink on the retro color', wanted.headerInk, wanted.retro, 7],
    ['white text on the plate', wanted.text, wanted.plate, 4.5],
    ['white text on the body', wanted.text, wanted.body, 4.5],
    ['white text on the background', wanted.text, wanted.background, 4.5],
    ['accent on the body', wanted.accent, wanted.body, 4.5],
    ['label on the body', wanted.label, wanted.body, 4.5],
    ['label on the background', wanted.label, wanted.background, 4.5],
    ['main color on the background', wanted.primary, wanted.background, 4.5],
    ['main color on the body', wanted.primary, wanted.body, 4.5],
    ['neon on the body', wanted.neon, wanted.body, 3],
    ['neon on the background', wanted.neon, wanted.background, 3],
  ];
  pairs.forEach(([name, front, back, least]) => {
    const found = ratio(front, back);
    console.log('  ' + name + ': ' + found.toFixed(2));
    assert.ok(found >= least, name + ' is ' + found.toFixed(2) + ', it needs ' + least);
  });
  // Purple text on gold: the outline does not count towards contrast, so the pairs are chosen on their own. The accent is
  // too faint on the plate color itself (2.6) and on the main color (1.3), so it is only drawn on the dark shade
  // (4.5, the TEAM plate of Cybertron and the bar layout), where the dark stroke of teams.css gives the letters an edge.
  // The label color is the readable purple where the plate color is the ground (4.1).
  assert.ok(ratio(wanted.accent, wanted.plate) < 3, 'the accent on the plate color is below 3, which is why it is not drawn there');
  assert.ok(ratio(wanted.accent, wanted.primary) < 3, 'purple text on the main gold is below 3 and is never drawn');
  assert.ok(ratio(wanted.label, wanted.plate) >= 4, 'the label color on the plate color');
  assert.ok(ratio(wanted.headerInk, wanted.primary) >= 7, 'on the main gold the outline ink is 7 to 1');
  assert.ok(ratio('#FFFFFF', wanted.primary) < 3, 'white on the main color fails at a distance, which is why Nova has a header ink');
  console.log('ok nova palette');
}
