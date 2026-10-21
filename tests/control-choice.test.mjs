// The shared choice buttons and switches of the control page (control/static/choice.js and choice.css): the markup, the state shown
// by the CSS, and that no page draws a plain radio or checkbox of its own.
//
//   node tests/control-choice.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import { choiceHtml, switchHtml, switchWord } from '../control/static/choice.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const read = name => fs.readFileSync(repo + name, 'utf8');

function walk(folder, found = []) {
  for (const entry of fs.readdirSync(repo + folder, { withFileTypes: true })) {
    if (entry.isDirectory()) { if (!['vendor', 'fonts'].includes(entry.name)) walk(folder + '/' + entry.name, found); } else if (entry.name.endsWith('.js')) found.push(folder + '/' + entry.name);
  }
  return found;
}

test('a choice is a radio group of buttons, one of them checked, with a name for a screen reader', () => {
  const html = choiceHtml({ name: 'fit', label: 'Fit', items: [{ value: 'a', label: 'Auto', checked: true, attrs: 'data-fit' }, { value: 'b', label: 'Fill' }] });
  assert.match(html, /role="radiogroup" aria-label="Fit"/);
  assert.equal((html.match(/type="radio"/g) || []).length, 2);
  assert.equal((html.match(/ checked/g) || []).length, 1);
  assert.match(html, /value="a" checked data-fit>/);
  assert.equal((html.match(/name="fit"/g) || []).length, 2);
});

test('a choice that allows several is a group of checkboxes', () => {
  const html = choiceHtml({ multiple: true, label: 'Days', items: [{ value: '1', label: 'Mon', checked: true }, { value: '2', label: 'Tue', checked: true }] });
  assert.match(html, /role="group"/);
  assert.equal((html.match(/type="checkbox"/g) || []).length, 2);
  assert.ok(!html.includes('type="radio"'));
});

test('a switch is a checkbox with the role switch, its words and an optional name for a screen reader', () => {
  const on = switchHtml({ checked: true, label: 'Reboot on a schedule', attrs: 'data-enabled' });
  assert.match(on, /type="checkbox" role="switch" checked data-enabled>/);
  assert.ok(on.includes('Reboot on a schedule'));
  assert.ok(!switchHtml({}).includes(' checked'));
  assert.match(switchHtml({ ariaLabel: 'Show on screen' }), /aria-label="Show on screen"/);
  assert.equal(switchWord(true), 'On');
  assert.equal(switchWord(false), 'Off');
});

test('every value is escaped', () => {
  const html = choiceHtml({ name: '"><b>', label: '<i>', items: [{ value: '"><img>', label: '<script>x</script>' }] }) + switchHtml({ label: '<u>', ariaLabel: '"><b>' });
  assert.ok(!/<(b|i|u|img|script)>/.test(html), html);
});

test('the CSS fills the chosen button with a check mark, makes a switch a pill with On or Off, and keeps 44px targets and a focus ring', () => {
  const css = read('control/static/choice.css');
  assert.match(css, /label\.choice > input:checked \+ \.choice-face \{[^}]*background: var\(--choice-on\)/);
  assert.match(css, /input:checked \+ \.choice-face \.choice-mark::before \{ content: "\\2713"/);
  assert.match(css, /\.switch-word::before \{ content: "Off"/);
  assert.match(css, /input:checked ~ \.switch-word::before \{ content: "On"/);
  assert.match(css, /\.choice-face \{[^}]*min-height: 44px/);
  assert.match(css, /\.switch \{[^}]*min-height: 44px/);
  assert.match(css, /input:focus-visible \+ \.choice-face/);
  assert.match(css, /input:focus-visible \+ \.switch-track/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.ok(!/font-size: ([0-9]|1[0-5])px/.test(css), 'no text under 16px');
});

test('the stylesheet is loaded by the page and by every tab', () => {
  assert.ok(read('control/static/index.html').includes('<link id="choice-css" rel="stylesheet" href="choice.css">'));
  assert.ok(read('control/static/tabs/api.js').includes("addStyle('choice-css', '../choice.css')"));
});

test('no page draws a plain radio or checkbox of its own: they all come from choice.js', () => {
  walk('control/static').filter(file => !file.endsWith('/choice.js')).forEach(file => {
    const text = read(file);
    assert.ok(!/type="(radio|checkbox)"|type: '(radio|checkbox)'|type = '(radio|checkbox)'/.test(text), file + ' draws its own radio or checkbox');
  });
});

test('the pages that had plain boxes use the helper', () => {
  ['control/static/tabs/settings-reboot.js', 'control/static/tabs/settings-cleanup.js', 'control/static/tabs/settings-sync.js', 'control/static/tabs/settings-log.js', 'control/static/tabs/settings-screen.js',
    'control/static/tabs/display-parts.js', 'control/static/tabs/display-preview-parts.js', 'control/static/tabs/render.js', 'control/static/settings-all-fields.js'].forEach(file => {
    assert.ok(read(file).includes("from '../choice.js'") || read(file).includes("from './choice.js'"), file);
  });
});

await finish();
