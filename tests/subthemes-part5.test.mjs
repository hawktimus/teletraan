// Tests for the three shipped subthemes, halloween, winter and kickoff: the frame anchors on every theme and
// layout, that they draw on frames only and never inside a content box, the element counts, calm motion, the
// colors, the choice of subtheme and the Studio lists.
//
//   node tests/subthemes-part5.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { anchorsByTheme, contentPolygons, frameAnchorBox, frameAnchorNames, frameAnchors, pointInPolygon, screenBox } from '../dashboard/core/anchors.js';
import { chooseShipped, tidySubthemes } from '../dashboard/core/subthemes.js';
import { countPieces, isPreset, packSubthemes, presetAnchors, presetChoices, presetIds, presetMarkup, presetPieces } from '../dashboard/core/subtheme-presets.js';
import { tidyTheme } from '../dashboard/core/theme.js';
import { readModule } from './helpers/read-module.mjs';

let passed = 0;
function check(name, test) {
  test();
  passed += 1;
  console.log('PASS  ' + name);
}

const read = file => readModule(new URL('../' + file, import.meta.url), 'utf8');
const themes = Object.keys(anchorsByTheme);
const layouts = ['standard', 'bar'];
const flagSets = [{}, { flipped: true }, { mirrored: true }, { mirrored: true, flipped: true }];
const noBarAnchors = ['side-bar-top', 'panel-b-bar-top'];

check('every theme has the frame anchors on both layouts, with the same names, and the sidebar layout has none', () => {
  assert.equal(themes.join(), 'original,cybertron,retro,foundry');
  themes.forEach(theme => layouts.forEach(layout => flagSets.forEach(flags => {
    const names = frameAnchorNames.filter(name => frameAnchorBox(theme, layout, name, flags) !== null);
    const expected = layout === 'bar' ? frameAnchorNames.filter(name => !noBarAnchors.includes(name)) : frameAnchorNames;
    assert.deepEqual(names, expected, theme + ' ' + layout + ' ' + JSON.stringify(flags));
  })));
  assert.equal(frameAnchors('sidebar'), null);
  assert.equal(frameAnchorBox('original', 'sidebar', 'banner-bar-top'), null);
  assert.equal(frameAnchorBox('original', 'standard', 'nowhere'), null);
  ['banner-bar-top', 'banner-bar-bottom', 'corner-bolt', 'corner-cut-main-a', 'corner-cut-main-b', 'corner-cut-aux-a', 'corner-cut-aux-b', 'ticker-bar-top', 'ticker-bar-bottom', 'gap-column']
    .forEach(name => assert.ok(frameAnchorNames.includes(name), name));
});

check('every frame anchor is a box on the screen with a kind, and a cut says its corner', () => {
  layouts.forEach(layout => flagSets.forEach(flags => {
    const all = frameAnchors(layout, flags);
    Object.keys(all).forEach(name => {
      const found = all[name];
      const label = layout + ' ' + JSON.stringify(flags) + ' ' + name;
      assert.ok(found.width > 0 && found.height > 0, label + ' has a size');
      assert.ok(found.x >= screenBox.x && found.y >= screenBox.y && found.x + found.width <= screenBox.width && found.y + found.height <= screenBox.height, label + ' is on the screen');
      assert.ok(['bar', 'cut', 'bolt', 'column'].includes(found.kind), label + ' has a kind');
      if (found.kind === 'cut') assert.ok(['tl', 'tr', 'bl', 'br'].includes(found.corner), label + ' says its corner');
    });
  }));
});

check('the trim that cuts the other corners, and the mirror, move the anchors that follow them', () => {
  const plain = frameAnchors('bar', {});
  const flipped = frameAnchors('bar', { flipped: true });
  const mirrored = frameAnchors('bar', { mirrored: true });
  assert.equal(plain['corner-cut-main-a'].corner, 'tl');
  assert.equal(flipped['corner-cut-main-a'].corner, 'tr');
  assert.equal(plain['corner-cut-main-b'].corner, 'br');
  assert.equal(flipped['corner-cut-main-b'].corner, 'bl');
  assert.ok(mirrored['gap-column'].x > plain['gap-column'].x, 'the gap column goes to the other side of the main panel');
  assert.ok(mirrored['side-corner'].x > plain['side-corner'].x, 'the side corner is the margin of the column');
  assert.ok(mirrored['corner-bolt'].x < plain['corner-bolt'].x, 'the banner bolt that has the main panel under it moves');
});

check('the three subthemes, in this order, are the ones the Studio offers', () => {
  assert.deepEqual(presetIds, ['halloween', 'winter', 'kickoff']);
  assert.deepEqual(presetChoices.map(choice => choice.id), presetIds);
  presetIds.forEach(id => assert.ok(isPreset(id)));
  assert.equal(isPreset('none'), false);
  const studio = read('studio/inputs/themes.js');
  const listed = (studio.match(/export const subthemePresets = \[([^]*?)\];/)[1].match(/id: '([^']*)'/g) || []).map(text => text.slice(5, -1));
  assert.deepEqual(listed, presetIds);
  assert.ok(read('studio/schemas/theme.js').includes("name: 'subtheme'"), 'a schedule rule can name a subtheme');
  assert.ok(read('studio/schemas/subtheme.js').includes("name: 'preset'"), 'a Subtheme document can name a preset');
});

check('each subtheme draws on every theme and both layouts, in frame anchors only', () => {
  presetIds.forEach(id => {
    presetAnchors(id).forEach(name => assert.ok(frameAnchorNames.includes(name), id + ' uses ' + name + ', which is not a frame anchor'));
    themes.forEach(theme => layouts.forEach(layout => flagSets.forEach(flags => {
      const pieces = presetPieces(id, theme, layout, flags);
      const wanted = presetAnchors(id).filter(name => layout === 'standard' || !noBarAnchors.includes(name));
      assert.deepEqual(pieces.map(piece => piece.anchor), wanted, id + ' ' + theme + ' ' + layout + ' ' + JSON.stringify(flags));
      pieces.forEach(piece => {
        const place = frameAnchorBox(theme, layout, piece.anchor, flags);
        assert.deepEqual([piece.box.x, piece.box.y, piece.box.width, piece.box.height], [place.x, place.y, place.width, place.height]);
        assert.ok(piece.markup.includes('style="left:' + place.x + 'px;top:' + place.y + 'px"'), id + ' ' + piece.anchor + ' is placed by its anchor');
        assert.ok(piece.markup.includes('viewBox="0 0 ' + place.width + ' ' + place.height + '"'), id + ' ' + piece.anchor + ' is as big as its anchor, and the svg clips what is past it');
      });
    })));
  });
  assert.equal(presetPieces('winter', 'original', 'sidebar', {}).length, 0);
  assert.equal(presetPieces('nothing', 'original', 'standard', {}).length, 0);
});

// Points of an anchor on a grid, kept to the places the anchor can draw: all of a strip, a column or a bolt,
// and the triangle of a cut
function pointsOf(found) {
  const found_ = [];
  for (let x = found.x + 2; x < found.x + found.width; x += 4) {
    for (let y = found.y + 2; y < found.y + found.height; y += 4) {
      if (found.kind === 'cut') {
        const across = (found.corner === 'tl' || found.corner === 'bl') ? x - found.x : found.x + found.width - x;
        const down = (found.corner === 'tl' || found.corner === 'tr') ? y - found.y : found.y + found.height - y;
        if (across / found.width + down / found.height >= 1) continue;
      }
      found_.push([x, y]);
    }
  }
  return found_;
}

check('no frame anchor that a subtheme uses reaches into the text of a frame', () => {
  layouts.forEach(layout => flagSets.forEach(flags => {
    const areas = contentPolygons(layout, flags);
    assert.ok(areas.length >= 5);
    const used = new Set();
    presetIds.forEach(id => presetAnchors(id).forEach(name => used.add(name)));
    used.forEach(name => {
      const found = frameAnchorBox('original', layout, name, flags);
      if (!found) return;
      const inside = pointsOf(found).filter(point => areas.some(area => pointInPolygon(point, area)));
      assert.deepEqual(inside.slice(0, 3), [], layout + ' ' + JSON.stringify(flags) + ' ' + name + ' reaches into the text at ' + JSON.stringify(inside[0]));
    });
  }));
});

check('the element counts stay small, so the Mini holds 30 frames a second', () => {
  const counts = {};
  presetIds.forEach(id => layouts.forEach(layout => {
    const total = countPieces(presetPieces(id, 'original', layout, {}));
    counts[id + ' ' + layout] = total;
    assert.ok(total.pieces <= 20, id + ' ' + layout + ' has ' + total.pieces + ' svgs');
    assert.ok(total.shapes <= 50, id + ' ' + layout + ' has ' + total.shapes + ' shapes');
    assert.ok(total.moving <= 12, id + ' ' + layout + ' has ' + total.moving + ' moving shapes');
  }));
  assert.ok(counts['halloween standard'].shapes <= 14 && counts['kickoff standard'].shapes <= 14);
  assert.ok(counts['winter standard'].moving >= 8, 'the bulbs and the snow move');
  Object.keys(counts).forEach(key => console.log('      ' + key + ': ' + counts[key].pieces + ' svgs, ' + counts[key].shapes + ' shapes, ' + counts[key].moving + ' moving'));
});

check('the markup holds no color, no filter, no gradient, no script and no link', () => {
  const art = read('dashboard/core/subtheme-shapes.js').replace(/\/\/.*$/gm, '');
  assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(art), false, 'a color written in the drawings');
  presetIds.forEach(id => layouts.forEach(layout => {
    const markup = presetMarkup(presetPieces(id, 'foundry', layout, { mirrored: true, flipped: true }));
    assert.equal(/filter|blur|gradient|<script|<image|href=|shadow|#[0-9a-fA-F]{3,8}\b/i.test(markup), false, id + ' ' + layout);
    assert.ok(/class="sb-/.test(markup));
  }));
});

check('every class the drawings use has a rule that takes its color from a --subtheme token that tokens.css defines', () => {
  const css = read('dashboard/subthemes.css');
  const tokens = read('dashboard/tokens.css');
  const used = new Set();
  presetIds.forEach(id => presetPieces(id, 'original', 'standard', {}).forEach(piece => (piece.markup.match(/class="(sb-[a-z-]+)"/g) || []).forEach(text => used.add(text.slice(7, -1)))));
  assert.ok(used.size >= 30, 'a subtheme uses few classes: ' + used.size);
  used.forEach(name => {
    if (name === 'sb-piece') return;
    const rule = new RegExp('\\.' + name + ' \\{([^}]*)\\}').exec(css);
    assert.ok(rule, 'subthemes.css has no rule for .' + name);
    const tokensUsed = rule[1].match(/var\(--subtheme-[a-z-]+\)/g) || [];
    assert.ok(tokensUsed.length > 0 || /fill: none;?\s*$/.test(rule[1].trim()), '.' + name + ' takes no color from a token');
    tokensUsed.forEach(token => assert.ok(tokens.includes(token.slice(4, -1) + ':'), token + ' is not in tokens.css'));
  });
  assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(css.replace(/\/\*[^]*?\*\//g, '')), false, 'a color written in subthemes.css');
});

check('the shipped subthemes move only transform, opacity and line drawing, and only in full motion, so calm and none draw still', () => {
  const frame = read('dashboard/frame.css');
  const start = frame.indexOf('/* The shipped subthemes');
  const end = frame.indexOf('/* The subtheme layer');
  assert.ok(start > 0 && end > start);
  const block = frame.slice(start, end);
  assert.equal((block.match(/@keyframes/g) || []).length, 7);
  (block.match(/\{[^{}]*\}/g) || []).filter(text => /transform|opacity|stroke-dashoffset/.test(text) && !/animation/.test(text)).forEach(text => {
    assert.ok(/^\{\s*(transform|opacity|stroke-dashoffset):[^;]+;\s*\}$/.test(text), 'a keyframe moves something else: ' + text);
  });
  const rules = block.split('\n').filter(line => line.includes('animation:'));
  assert.equal(rules.length, 7);
  rules.forEach(line => assert.ok(line.startsWith('html[data-motion="full"] .sb-piece [data-move='), 'an animation outside full motion: ' + line));
  assert.equal(/filter|blur|box-shadow|text-shadow|will-change/.test(block + read('dashboard/subthemes.css')), false);
  assert.equal(read('dashboard/subthemes.css').includes('animation'), false, 'subthemes.css holds no animation');
  const calm = read('dashboard/subthemes.css');
  assert.ok(calm.includes('#world[data-pieces] .subtheme-frame-layer { visibility: hidden; }'), 'the pieces are hidden while the frames fly apart');
  assert.ok(calm.includes('pointer-events: none'), 'the layer lets every click through');
});

check('the web draws itself once and holds, and the animated shapes are the few that say data-move', () => {
  const winter = presetMarkup(presetPieces('winter', 'original', 'standard', {}));
  assert.equal((winter.match(/data-move="glow"/g) || []).length, 5, 'five colors of bulbs glow in turn');
  assert.equal((winter.match(/data-move="fall"/g) || []).length, 6, 'two groups of flakes in each of three places');
  const halloween = presetMarkup(presetPieces('halloween', 'original', 'standard', {}));
  assert.equal((halloween.match(/data-move="draw"/g) || []).length, 1);
  assert.equal((halloween.match(/data-move="flutter"/g) || []).length, 3);
  assert.ok(halloween.includes('pathLength="1"'));
  const kickoff = presetMarkup(presetPieces('kickoff', 'original', 'standard', {}));
  assert.equal((kickoff.match(/data-move="twinkle"/g) || []).length, 3);
  assert.equal((kickoff.match(/data-move="wave"/g) || []).length, 2);
  assert.equal((kickoff.match(/data-move="spin"/g) || []).length, 1);
});

check('the subtheme comes from the address, then the rule of the pack, then a live Subtheme document, then the pack', () => {
  const now = new Date('2026-12-20T15:00:00Z');
  const rule = (overlay, extra) => Object.assign({ name: 'Rule', kind: 'overlay', overlay: overlay, startDate: '2026-12-01', endDate: '2026-12-31', repeatsEveryYear: false }, extra);
  const content = (rules, docs) => ({ theme: tidyTheme({ timeZone: 'America/New_York', schedule: rules }), subthemes: tidySubthemes(docs || []) });
  const on = overlay => ({ className: 'theme-hawktimus overlay-' + overlay });
  const off = { className: 'theme-hawktimus' };

  assert.equal(chooseShipped(content([rule('christmas')]), '', now, on('christmas')), 'winter');
  assert.equal(chooseShipped(content([rule('halloween')]), '', now, on('halloween')), 'halloween');
  assert.equal(chooseShipped(content([rule('thanksgiving')]), '', now, on('thanksgiving')), '', 'a pack with no subtheme of its own draws none');
  assert.equal(chooseShipped(content([rule('christmas', { subtheme: 'kickoff' })]), '', now, on('christmas')), 'kickoff');
  assert.equal(chooseShipped(content([rule('christmas', { subtheme: 'none' })]), '', now, on('christmas')), '');
  assert.equal(chooseShipped(content([rule('christmas', { subtheme: 'bogus' })]), '', now, on('christmas')), 'winter', 'a name that is not a subtheme is the pack\'s own');
  assert.equal(chooseShipped(content([rule('christmas')]), 'halloween', now, on('christmas')), 'halloween', 'the address wins');
  assert.equal(chooseShipped(content([rule('christmas')]), 'none', now, on('christmas')), '', 'none in the address draws none');
  assert.equal(chooseShipped(content([]), '', now, off), '');
  assert.equal(chooseShipped(null, '', now, off), '');

  const doc = (preset, extra) => Object.assign({ name: 'Kickoff', enabled: true, start: '2026-12-10', end: '2026-12-30', preset: preset }, extra);
  assert.equal(chooseShipped(content([], [doc('kickoff')]), '', now, off), 'kickoff');
  assert.equal(chooseShipped(content([], [doc('kickoff', { end: '2026-12-15' })]), '', now, off), '', 'a document that is over draws none');
  assert.equal(chooseShipped(content([], [doc('kickoff', { enabled: false })]), '', now, off), '');
  assert.equal(chooseShipped(content([], [doc('kickoff', { priority: 1 }), doc('winter', { priority: 5 })]), '', now, off), 'winter', 'the higher priority wins');
  assert.equal(chooseShipped(content([rule('christmas')], [doc('kickoff')]), '', now, on('christmas')), 'kickoff', 'a live document wins over the pack\'s own');
  assert.equal(chooseShipped(content([rule('christmas', { subtheme: 'halloween' })], [doc('kickoff')]), '', now, on('christmas')), 'halloween', 'the rule wins over a document');
  assert.equal(chooseShipped(content([], [doc('')]), '', now, off), '', 'a document with no preset has only its own pictures');
  assert.deepEqual(packSubthemes, { halloween: 'halloween', christmas: 'winter' });
});

check('a Subtheme document and a schedule rule keep the preset, and a rule that names none stays as it was', () => {
  assert.equal(tidySubthemes([{ name: 'A', preset: 'winter' }])[0].preset, 'winter');
  assert.equal(tidySubthemes([{ name: 'A', preset: 'spring' }])[0].preset, '');
  assert.equal(tidySubthemes([{ name: 'A' }])[0].preset, '');
  const base = { name: 'R', kind: 'overlay', overlay: 'christmas', startDate: '2026-12-01', endDate: '2026-12-31' };
  assert.equal(tidyTheme({ schedule: [Object.assign({ subtheme: 'kickoff' }, base)] }).schedule[0].subtheme, 'kickoff');
  assert.equal('subtheme' in tidyTheme({ schedule: [base] }).schedule[0], false);
  assert.equal('subtheme' in tidyTheme({ schedule: [Object.assign({ subtheme: 'x' }, base)] }).schedule[0], false);
});

check('the layer is started by the shell, draws after the stage, and the query reads the preset', () => {
  assert.ok(read('dashboard/shell.js').includes("startOptional('./core/subtheme-preset-layer.js', module => module.startPresetSubthemes(getContent));"));
  const layer = read('dashboard/core/subtheme-preset-layer.js');
  assert.ok(layer.includes("document.getElementById('stage')") && layer.includes('world.insertBefore(layer'));
  assert.ok(layer.includes('MutationObserver'), 'a change of theme, layout or trim redraws it');
  assert.ok(layer.includes("classList.contains('mirrored')") && layer.includes("classList.contains('corner-cut-tr')"));
  assert.ok(read('dashboard/core/sanity-query.js').includes('priority, preset,'));
});

check('docs/subthemes.md says what each subtheme draws, the anchors and the counts', () => {
  const doc = read('docs/subthemes.md');
  presetIds.forEach(id => assert.ok(doc.toLowerCase().includes(id), id));
  frameAnchorNames.forEach(name => assert.ok(doc.includes('`' + name + '`'), 'docs/subthemes.md has no line for ' + name));
  assert.equal(/[–—]/.test(doc), false, 'no em or en dash');
});

console.log('\n' + passed + ' of ' + passed + ' checks passed.');
