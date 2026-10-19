// Tests for the word of the ticker's label when the team has the bar label (Ticker label: bar, which Nova has). The plate
// is hidden then, so the word sits on the dark ticker and must be the text color. In Retro and Foundry it was the header
// ink, which is dark for the inverted palette, so REMINDER could not be read. Stylesheets are read, not drawn, and the
// rule must beat the two rules of the themes by its selector.
//
//   node tests/ticker-bar-ink.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => fs.readFileSync(root + file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// Specificity as [ids, classes and attributes, elements]
function specificity(selector) {
  const classes = (selector.match(/\.[\w-]+|\[[^\]]+\]/g) || []).length;
  const elements = (selector.replace(/\[[^\]]+\]|\.[\w-]+/g, '').match(/[a-z][\w-]*/gi) || []).length;
  return [0, classes, elements];
}
const beats = (a, b) => (a[0] - b[0] || a[1] - b[1] || a[2] - b[2]) > 0;

let passed = 0;
function test(name, run) {
  run();
  passed += 1;
  console.log('ok ' + name);
}

const trim = read('dashboard/trim.css');
const rule = /(html\[data-style\]\.ticker-bar \.ticker \.tag span)\s*\{\s*color:\s*var\(--team-text\);\s*\}/.exec(trim);

test('trim.css sets the word of the bar label to the team text color for every style', () => {
  assert.ok(rule, 'the rule is there');
  assert.ok(/html\.ticker-bar \.ticker \.tag span,\s*html\[data-style\]\.ticker-bar/.test(trim), 'and a plain one for a page with no style attribute');
});

['retro', 'foundry'].forEach(theme => {
  test('the rule beats the ' + theme + ' ink on the label by its selector', () => {
    const own = /(html\[data-style="[a-z]+"\] \.ticker \.tag span)\s*\{\s*color:\s*var\(--style-header-ink\);/.exec(read('dashboard/styles/' + theme + '/theme.css'));
    assert.ok(own, theme + ' sets the header ink on the label');
    assert.ok(beats(specificity(rule[1]), specificity(own[1])), JSON.stringify([specificity(rule[1]), specificity(own[1])]));
  });
});

test('the team text color is light for both teams, so the word reads on the dark ticker', () => {
  const config = fs.readFileSync(root + 'dashboard/config-more.js', 'utf8');
  assert.ok(/text: '#FFFFFF'/.test(config.slice(config.indexOf('export const invertedColors'))));
  assert.ok(/text: '#FFFFFF'/.test(config.slice(config.indexOf('export const primeTeam'))));
});

console.log(passed + ' passed');
