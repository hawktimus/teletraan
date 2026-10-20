// Tests for the Parts request panel (panels/qrParts) and the miniIdea1 placeholder: the QR code of partsRequestUrl, the words,
// LINK NOT SET and the skip, the https rule, and the Studio field.
//
//   node tests/qr-parts.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config, contentOf, contentModule, load, read, registry, runTests, test, wordsOf } from './helpers/monday-world.mjs';

const panel = await load('panels/qrParts/panel.js');
const mini = await load('panels/miniIdea1/panel.js');
const qr = await load('core/qr.js');
const tidy = await load('core/content-tidy.js');
const order = await load('core/panel-order.js');

const studio = fileURLToPath(new URL('../studio/', import.meta.url));
const withUrl = url => contentOf([], raw => { raw.settings.partsRequestUrl = url; });
const drawn = content => {
  const host = { innerHTML: '' };
  panel.mount(host, content);
  return host.innerHTML;
};

test('both panels are small panels of the registry that only a row can pair, and neither is a spare for the small frame', () => {
  ['qrParts', 'miniIdea1'].forEach(id => {
    const entry = registry.panels.find(item => item.id === id);
    assert.ok(entry && entry.region === 'grid2' && entry.rotationOnly === true, id);
  });
  assert.equal(registry.panels.find(item => item.id === 'miniIdea1').placeholder, true);
  const spares = order.withStandIns([]).filter(step => step.standIn === 'spare').map(step => step.panel);
  assert.ok(!spares.includes('qrParts') && !spares.includes('miniIdea1'));
  assert.ok(spares.includes('forecast'));
});

test('the address is kept when it is https and up to 200 characters, and is empty otherwise', () => {
  const url = 'https://example.org/parts-placeholder';
  assert.equal(contentOf([]).settings.partsRequestUrl, 'https://example.org/parts-placeholder', 'the sample carries a marked placeholder');
  assert.equal(config.defaultSettings.partsRequestUrl, '', 'empty by default');
  assert.equal(withUrl('  ' + url + '  ').settings.partsRequestUrl, url);
  ['http://example.org/x', 'ftp://example.org', 'javascript:alert(1)', 'https://exa mple.org', 'example.org', 'https://', 'https:///', 42, null, 'https://example.org/' + 'a'.repeat(200)].forEach(bad => {
    assert.equal(withUrl(bad).settings.partsRequestUrl, '', String(bad).slice(0, 30));
  });
  assert.equal(withUrl('https://example.org/' + 'a'.repeat(180)).settings.partsRequestUrl.length, 200);
  assert.equal(tidy.longestPartsUrl, 200);
});

test('with an address the panel draws its title, one path, a light square and the words at 44px or more', () => {
  const html = drawn(withUrl('https://example.org/parts-placeholder'));
  const words = wordsOf(html);

  assert.ok(words.startsWith('PARTS REQUEST'));
  assert.ok(words.includes('SCAN TO REQUEST A PART'));
  assert.ok(!words.includes('LINK NOT SET'));
  assert.equal((html.match(/<path /g) || []).length, 1, 'the dark modules are one path');
  assert.ok(html.includes('class="qr-light"') && html.includes('class="qr-dark"'));
  const matrix = qr.qrMatrix('https://example.org/parts-placeholder');
  assert.ok(html.includes('d="' + qr.qrPath(matrix, 4) + '"'));
  assert.ok(html.includes('viewBox="0 0 ' + (matrix.size + 8) + ' ' + (matrix.size + 8) + '"'));
  assert.equal(panel.hasContent(withUrl('https://example.org/parts-placeholder')), true);
});

test('with no address it shows the title and LINK NOT SET, and the rotation skips it', () => {
  const content = withUrl('');
  const words = wordsOf(drawn(content));

  assert.equal(panel.hasContent(content), false);
  assert.equal(words, 'PARTS REQUEST LINK NOT SET');
  assert.equal(panel.hasContent(withUrl('http://example.org/insecure')), false);
});

test('the stylesheet writes the caption at 44px or more, uses tokens for its colors, and has no motion', () => {
  const css = read('panels/qrParts/panel.css');
  Array.from(css.matchAll(/font:\s*[\d.]+\s+(\d+)px/g)).forEach(match => assert.ok(Number(match[1]) >= 44, match[1]));
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css));
  assert.ok(css.includes('var(--pure-white)') && css.includes('var(--plate-ink)'), 'a light square with dark modules');
  assert.ok(!/animation|transition|@keyframes|filter|blur|box-shadow/.test(css));
});

test('the placeholder draws MINI PANEL IDEA 1 and a dashed inner frame, and has content always', () => {
  const host = { innerHTML: '' };
  mini.mount(host);
  assert.equal(wordsOf(host.innerHTML), 'MINI PANEL IDEA 1');
  assert.ok(host.innerHTML.includes('placeholder-frame'));
  assert.equal(typeof mini.hasContent, 'undefined');
  const css = read('panels/miniIdea1/panel.css');
  assert.ok(css.includes('dashed'));
  Array.from(css.matchAll(/font:\s*[\d.]+\s+(\d+)px/g)).forEach(match => assert.ok(Number(match[1]) >= 44));
});

test('the Studio field is a plain string in the Screen tab with a description, and the pickers offer both small panels', async () => {
  const code = fs.readFileSync(path.join(studio, 'schemas', 'dashboardSettings.js'), 'utf8');
  assert.ok(/name: 'partsRequestUrl'[\s\S]*?type: 'string'[\s\S]*?group: 'screen'[\s\S]*?description: '[^']*https:\/\/[^']*LINK NOT SET/.test(code));
  const picker = await import(pathToFileURL(path.join(studio, 'inputs', 'screen-panels.js')).href);
  // a new panel that only a row can pair may be added to the list, so the two are looked for and the list is not compared whole
  const offered = picker.pairedPanels.map(item => item.value);
  ['miniIdea1', 'qrParts'].forEach(id => assert.ok(offered.includes(id), id + ' is offered as a small panel of a row'));
  assert.ok(contentModule);
});

await runTests();
