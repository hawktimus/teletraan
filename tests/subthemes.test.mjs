// Tests for subthemes: the live window, the priority, the rules by theme and view, the anchor boxes, the layer
// markup and the test star in the sample content.
//
//   node tests/subthemes.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { anchorBox, anchorNames, anchorsByTheme, fitInBox, layoutsWithAnchors, screenBox, textBlocks } from '../dashboard/core/anchors.js';
import { isLive, liveSubtheme, matchingRules, spritesFor, subthemeMotions, tidySubthemes } from '../dashboard/core/subthemes.js';
import { layerMarkup } from '../dashboard/core/subthemes-layer.js';
import { normalizeSample } from '../dashboard/core/sanity.js';

let passed = 0;
function check(name, test) {
  test();
  passed += 1;
  console.log('PASS  ' + name);
}

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const rule = (anchor, extra) => Object.assign({ theme: '', view: '', slot: 'star', anchor: anchor, size: 80, motion: 'none' }, extra);
const make = (name, extra) => tidySubthemes([Object.assign({ name: name, enabled: true, assets: [{ slot: 'star', builtin: 'star' }], rules: [rule('banner-left')] }, extra)])[0];

check('a subtheme is live from its first day to its last day, both included, and only while it is on', () => {
  const item = make('Window', { start: '2026-12-01', end: '2026-12-31' });
  assert.equal(isLive(item, '2026-11-30'), false);
  assert.equal(isLive(item, '2026-12-01'), true);
  assert.equal(isLive(item, '2026-12-31'), true);
  assert.equal(isLive(item, '2027-01-01'), false);
  assert.equal(isLive(make('Off', { enabled: false }), '2026-12-05'), false);
  assert.equal(isLive(make('Open'), '2026-12-05'), true);
  assert.equal(isLive(make('Bad dates', { start: 'soon', end: 'later' }), '2026-12-05'), true);
});

check('the day is the day in the kiosk time zone', () => {
  const item = make('Late', { start: '2026-12-02', end: '2026-12-02' });
  const moment = new Date('2026-12-03T03:00:00Z');
  assert.equal(liveSubtheme([item], moment, 'America/New_York'), item);
  assert.equal(liveSubtheme([item], moment, 'UTC'), null);
});

check('of two live subthemes the higher priority is drawn, and the first in the list wins a tie', () => {
  const low = make('Low', { priority: 1 });
  const high = make('High', { priority: 5 });
  const other = make('Other', { priority: 5 });
  const now = new Date('2026-12-05T12:00:00Z');
  assert.equal(liveSubtheme([low, high], now, 'UTC').name, 'High');
  assert.equal(liveSubtheme([high, low], now, 'UTC').name, 'High');
  assert.equal(liveSubtheme([high, other], now, 'UTC').name, 'High');
  assert.equal(liveSubtheme([make('Empty', { priority: null }), make('Minus', { priority: -2 })], now, 'UTC').name, 'Empty');
  assert.equal(liveSubtheme([], now, 'UTC'), null);
  assert.equal(liveSubtheme([make('Off', { enabled: false })], now, 'UTC'), null);
});

check('a rule fits the theme and the view it names, and any when it names none', () => {
  const item = make('Rules', {
    rules: [rule('banner-left'), rule('banner-right', { theme: 'cybertron' }), rule('ticker-end', { view: 'prime' }), rule('main-corner', { theme: 'original', view: 'general' })],
  });
  const anchors = (theme, view) => matchingRules(item, theme, view).map(found => found.anchor).join();
  assert.equal(anchors('original', 'general'), 'banner-left,main-corner');
  assert.equal(anchors('cybertron', 'general'), 'banner-left,banner-right');
  assert.equal(anchors('cybertron', 'prime'), 'banner-left,banner-right,ticker-end');
  assert.equal(anchors('retro', 'family'), 'banner-left');
});

check('a rule with no slot, an unknown place or a size out of range is cleaned', () => {
  const item = tidySubthemes([{ name: 'Messy', rules: [rule('nowhere'), rule('banner-left', { slot: '' }), rule('banner-left', { size: 9, motion: 'spin', theme: 'neon', view: 'x' }), rule('ticker-end', { size: 999 })] }])[0];
  assert.equal(item.rules.length, 2);
  assert.deepEqual([item.rules[0].size, item.rules[0].motion, item.rules[0].theme, item.rules[0].view], [40, 'none', '', '']);
  assert.equal(item.rules[1].size, 240);
  assert.equal(tidySubthemes(null).length, 0);
});

check('a place is drawn once, with a picture in the slot, and a layout with no anchors draws nothing', () => {
  const item = make('Places', { rules: [rule('banner-left'), rule('banner-left', { size: 40 }), rule('banner-right', { slot: 'missing' }), rule('ticker-end')] });
  assert.equal(spritesFor(item, 'original', 'general', 'standard').map(sprite => sprite.anchor).join(), 'banner-left,ticker-end');
  assert.equal(spritesFor(item, 'original', 'general', 'sidebar').length, 0);
});

check('every anchor of every theme and layout is inside the screen and clear of the text', () => {
  const inside = (a, b) => a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;
  const apart = (a, b) => a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
  assert.deepEqual(layoutsWithAnchors, ['standard', 'bar']);
  Object.keys(anchorsByTheme).forEach(theme => layoutsWithAnchors.forEach(layout => {
    anchorNames.forEach(name => {
      const place = anchorBox(theme, layout, name);
      assert.ok(place, theme + ' ' + layout + ' ' + name + ' has no box');
      assert.ok(inside(place, screenBox), theme + ' ' + layout + ' ' + name + ' leaves the screen');
      textBlocks[layout].forEach(block => assert.ok(apart(place, block), theme + ' ' + layout + ' ' + name + ' is over text'));
    });
  }));
  assert.equal(anchorBox('original', 'sidebar', 'banner-left'), null);
  assert.equal(anchorBox('original', 'standard', 'nowhere'), null);
});

check('Retro has the boxes of Original, and a theme the table does not know gets them too', () => {
  assert.deepEqual(anchorsByTheme.retro, anchorsByTheme.original);
  assert.deepEqual(anchorBox('neon', 'bar', 'ticker-end'), anchorBox('original', 'bar', 'ticker-end'));
});

check('a picture is scaled down to fit its box and centred, and never grows past its size', () => {
  const place = { x: 100, y: 200, width: 300, height: 26 };
  assert.deepEqual(fitInBox(place, 80), { size: 26, x: 237, y: 200 });
  assert.deepEqual(fitInBox({ x: 0, y: 0, width: 400, height: 400 }, 80), { size: 80, x: 160, y: 160 });
  const pictures = spritesFor(make('Fit', { rules: anchorNames.map(name => rule(name, { size: 240 })) }), 'original', 'general', 'bar');
  pictures.forEach(sprite => {
    assert.ok(sprite.size <= Math.min(sprite.box.width, sprite.box.height));
    assert.ok(sprite.x >= sprite.box.x && sprite.x + sprite.size <= sprite.box.x + sprite.box.width);
  });
});

check('the layer makes one symbol for each slot and points at it with use', () => {
  const item = make('Markup', { rules: [rule('banner-left'), rule('banner-right'), rule('ticker-end')] });
  const html = layerMarkup(spritesFor(item, 'original', 'general', 'standard'));
  assert.equal((html.match(/<symbol /g) || []).length, 1);
  assert.equal((html.match(/<use href="#subtheme-star"\/>/g) || []).length, 3);
  assert.ok(html.includes('<path '));
  const uploaded = make('Upload', { assets: [{ slot: 'flag', url: 'https://example.test/flag.svg' }], rules: [rule('banner-left', { slot: 'flag' })] });
  assert.ok(layerMarkup(spritesFor(uploaded, 'original', 'general', 'standard')).includes('<image href="https://example.test/flag.svg"'));
});

check('the stylesheet moves only transform and opacity, and only in full motion', () => {
  const all = read('dashboard/frame.css');
  const css = all.slice(all.indexOf('/* The subtheme layer'));
  subthemeMotions.filter(name => name !== 'none').forEach(name => {
    assert.ok(css.includes('html[data-motion="full"] .subtheme-sprite[data-motion="' + name + '"]'), name + ' should play only in full motion');
    assert.ok(css.includes('@keyframes subtheme-' + name));
  });
  const frames = css.match(/@keyframes[^{]+\{(?:[^{}]|\{[^}]*\})*\}/g) || [];
  assert.equal(frames.length, 3);
  frames.forEach(frame => (frame.match(/\{[^{}]*\}/g) || []).forEach(block => assert.ok(/^\{\s*(transform|opacity):[^;]+;\s*\}$/.test(block), 'a keyframe moves something other than transform or opacity: ' + block)));
  const playing = css.split('\n').filter(line => line.includes('animation:'));
  assert.equal(playing.length, 3);
  playing.forEach(line => assert.ok(line.startsWith('html[data-motion="full"] '), 'an animation outside full motion: ' + line));
  assert.ok(read('dashboard/index.html').includes('subthemes.css') && !read('dashboard/subthemes.css').includes('animation'));
});

check('the Studio type offers the same places, motions and sizes as the dashboard', () => {
  const schema = read('studio/schemas/subtheme.js');
  const values = name => (schema.match(new RegExp('const ' + name + ' = \\[([^]*?)\\];'))[1].match(/value: '([^']*)'/g) || []).map(text => text.slice(8, -1));
  assert.deepEqual(values('anchors'), anchorNames);
  assert.deepEqual(values('motions'), subthemeMotions);
  assert.deepEqual(values('themes').filter(Boolean), Object.keys(anchorsByTheme));
  assert.deepEqual(values('views').filter(Boolean), ['general', 'prime', 'nova', 'family']);
  assert.ok(schema.includes('.min(40).max(240)'));
});

check('the sample content has the test star, live now, with a star in every place, and production content has none', () => {
  const content = normalizeSample(JSON.parse(read('dashboard/data/sample/content.json')));
  assert.equal(content.subthemes.length, 1);
  const live = liveSubtheme(content.subthemes, new Date(), 'America/New_York');
  assert.equal(live.name, 'Test star');
  layoutsWithAnchors.forEach(layout => assert.deepEqual(spritesFor(live, 'cybertron', 'prime', layout).map(sprite => sprite.anchor), anchorNames));
  assert.ok(live.assets.every(asset => asset.builtin === 'star'));
  assert.ok(read('dashboard/core/sanity.js').includes('*[_type == "subtheme"]'));
  assert.ok(!fs.existsSync(new URL('../dashboard/data/live/subthemes.json', import.meta.url)));
});

console.log(passed + ' of ' + passed + ' checks passed.');
