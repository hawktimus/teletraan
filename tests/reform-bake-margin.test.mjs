// Tests that a baked copy of a heading keeps its margin of 0 (dashboard/core/reform-bake.js). The copy is made of
// plain elements, and the browser gives a heading a margin of its own, so a copy that left the 0 out put the team
// name of the banner 64px low in the first frames of a view transition, over the panel below. Nothing is drawn.
//
//   node tests/reform-bake-margin.test.mjs

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const file = path.join(fileURLToPath(new URL('../dashboard/core/', import.meta.url)), 'reform-bake.js');

function fakeElement(tag, values) {
  const element = {
    tagName: tag, nodeType: 1, namespaceURI: 'http://www.w3.org/1999/xhtml', childNodes: [], children: [], attributes: [], written: {}, values: values,
    matches: () => false,
    appendChild(child) { element.childNodes.push(child); element.children.push(child); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 10, height: 10 }),
    removeAttribute: () => {},
    cloneNode() {
      const copy = fakeElement(tag, values);
      copy.childNodes = [];
      copy.style = { setProperty: (name, value) => { copy.written[name] = value; } };
      return copy;
    },
  };
  element.style = { setProperty: (name, value) => { element.written[name] = value; } };
  return element;
}

globalThis.window = {
  getComputedStyle: element => ({
    display: 'block', transform: 'none',
    getPropertyValue: name => (name in element.values ? element.values[name] : ''),
  }),
};

const { bake } = await import(pathToFileURL(file).href);
const origin = { left: 0, top: 0, scale: 1 };

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

async function copyOf(tag, values) {
  const parent = fakeElement('DIV', {});
  const child = fakeElement(tag, values);
  parent.childNodes = [child];
  const baked = await bake(parent, { origin: origin });
  return baked.root.childNodes[0];
}

test('a heading with no margin is copied with a margin of 0', async () => {
  const copy = await copyOf('H1', { 'margin-top': '0px', 'margin-bottom': '0px', 'margin-left': '0px', 'margin-right': '0px' });
  assert.equal(copy.written['margin-top'], '0px');
  assert.equal(copy.written['margin-bottom'], '0px');
});

test('a heading with a margin is copied with it', async () => {
  const copy = await copyOf('H2', { 'margin-top': '12px', 'margin-bottom': '0px', 'margin-left': '0px', 'margin-right': '0px' });
  assert.equal(copy.written['margin-top'], '12px');
});

test('a plain box with no margin has none written, so the style stays short', async () => {
  const copy = await copyOf('SPAN', { 'margin-top': '0px', 'margin-bottom': '0px', 'margin-left': '0px', 'margin-right': '0px' });
  assert.equal(copy.written['margin-top'], undefined);
});

let failed = 0;
for (const { name, run } of tests) {
  try {
    await run();
    console.log('ok   ' + name);
  } catch (error) {
    failed++;
    console.log('FAIL ' + name + '\n' + error.message);
  }
}
console.log(tests.length - failed + ' of ' + tests.length + ' passed');
process.exit(failed === 0 ? 0 : 1);
