// Tests for the choices and switches of the custom Studio pages (studio/inputs/field-editor.js): the chosen button
// is told apart at a glance, a switch is a real checkbox with the role switch, no page draws a bare radio or
// checkbox of its own, and the colors keep their contrast on the dark and the light Studio.
//
//   node tests/studio-choices.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStudio, nodesWhere } from './helpers/studio-world.mjs';

const studio = await openStudio();
const editor = await studio.load('inputs/field-editor.js');
const styles = await studio.load('inputs/page-styles.js');
let failed = 0;

function test(name, run) {
  try {
    run();
  } catch (error) {
    failed++;
    console.log('FAIL ' + name + '\n' + error.message);
  }
}

function luminance(hex) {
  const parts = [1, 3, 5].map(at => parseInt(hex.substr(at, 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
}
function ratio(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test('the chosen button is filled and checked, the others outlined, each at least 44 px high', () => {
  const picked = [];
  const tree = editor.choiceButtons({ name: 'speed', label: 'Speed', items: ['Slow', 'Normal'].map(title => ({ key: title, label: title, checked: title === 'Normal', onPick: () => picked.push(title) })) });
  assert.equal(tree.props.role, 'radiogroup');
  const labels = nodesWhere(tree, node => node.type === 'label');
  assert.equal(labels.length, 2);
  assert.equal(labels[1].props.style.background, styles.accent);
  assert.equal(labels[0].props.style.background, 'transparent');
  assert.ok(labels[0].props.style.minHeight >= 44);
  const inputs = nodesWhere(tree, node => node.type === 'input');
  assert.deepEqual(inputs.map(node => node.props.checked), [false, true]);
  assert.ok(inputs.every(node => node.props.type === 'radio' && node.props.name === 'speed'));
  assert.ok(JSON.stringify(labels[1]).includes('✓'), 'a check mark');
  inputs[0].props.onChange();
  assert.deepEqual(picked, ['Slow']);
});

test('a switch is a checkbox with the role switch, the word On or Off and a 44 px target', () => {
  const tree = editor.toggleSwitch({ checked: true, onChange: () => {}, label: 'Glint', ariaLabel: 'Glint' });
  const box = nodesWhere(tree, node => node.type === 'input')[0];
  assert.equal(box.props.type, 'checkbox');
  assert.equal(box.props.role, 'switch');
  assert.equal(box.props.checked, true);
  assert.ok(tree.props.style.minHeight >= 44);
  assert.ok(JSON.stringify(tree).includes('"On"'));
  assert.ok(JSON.stringify(editor.toggleSwitch({ checked: false, onChange: () => {} })).includes('"Off"'));
});

test('the colors keep 3:1 for the control edge and 4.5:1 for the text on #101112 and white', () => {
  ['#101112', '#ffffff'].forEach(ground => {
    assert.ok(ratio(styles.outline, ground) >= 3, 'outline on ' + ground);
    assert.ok(ratio(styles.accent, ground) >= 3, 'accent on ' + ground);
  });
  assert.ok(ratio(styles.accent, '#ffffff') >= 4.5, 'white text on the accent');
});

test('no page of the Studio draws a radio or a checkbox outside field-editor.js, except the table cells of the Rotation board', () => {
  const folder = fileURLToPath(new URL('../studio/inputs/', import.meta.url));
  fs.readdirSync(folder).filter(file => file.endsWith('.js') && file !== 'field-editor.js').forEach(file => {
    const text = fs.readFileSync(path.join(folder, file), 'utf8');
    const bare = (text.match(/type: '(radio|checkbox)'/g) || []).length;
    assert.equal(bare, file === 'rotation-board-parts.js' ? 3 : 0, file + ' has ' + bare + ' bare radios or checkboxes');
  });
});

studio.close();
if (failed) process.exit(1);
console.log('ok  the choices and switches');
