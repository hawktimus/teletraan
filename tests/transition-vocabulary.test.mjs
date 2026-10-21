// Each theme plays its own vocabulary for the panel and view transitions and for the Light transitions (docs/transitions.md,
// "One vocabulary for each theme"). The kits are data and small functions, so the drawing of each runs here without a page. The motion
// tests (tests/motion/light.mjs) read the same rule from a run in a browser.
//
//   node tests/transition-vocabulary.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboard = fileURLToPath(new URL('../dashboard/', import.meta.url));
const read = file => fs.readFileSync(path.join(dashboard, file), 'utf8');
const noComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

globalThis.document = {
  createElement: () => ({ className: '', style: { cssText: '' }, children: [], appendChild(child) { this.children.push(child); return child; } }),
};

const themes = ['original', 'cybertron', 'retro', 'foundry'];
const prefixOf = { original: 'rk-', cybertron: 'ck-', retro: 'rr-', foundry: 'fk-' };
const kits = {};
for (const theme of themes) kits[theme] = (await import(pathToFileURL(path.join(dashboard, 'styles', theme, 'transitions.js')).href)).kit;
const plain = (await import(pathToFileURL(path.join(dashboard, 'core', 'reform-plain.js')).href)).kit;

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

// The drawing classes (the ones with a kit prefix) in some markup
const classesOf = markup => (String(markup).match(/class="[^"]*"/g) || []).flatMap(text => text.slice(7, -1).split(/\s+/)).filter(Boolean);
const roles = ['screw', 'latch', 'brace', 'rivet', 'gear', 'piston', 'tooth', 'pin', 'barrel', 'chassis', 'deadbolt', 'wheel', 'ram', 'gauge', 'needle', 'ring', 'rod', 'cog', 'cogs', 'leaf', 'seam'];
const prefixes = Object.values(prefixOf);

await test('the drawing of every piece of a kit has the classes of its own theme and of no other', () => {
  themes.forEach(theme => {
    const foreign = prefixes.filter(prefix => prefix !== prefixOf[theme]);
    roles.forEach(role => {
      const markup = kits[theme].draw(role);
      classesOf(markup).forEach(name => foreign.forEach(prefix => assert.ok(!name.startsWith(prefix), theme + ' draws ' + role + ' with the class ' + name + ' of another theme')));
    });
  });
});

await test('the Light parts of a kit are drawn with its own classes, in its own markup, and every theme has some of its own', () => {
  themes.forEach(theme => {
    const parts = kits[theme].light(1100, 700, 'main');
    assert.ok(parts.length >= 3, theme + ' has parts on its plates');
    const own = theme === 'original' ? 'rk-light' : prefixOf[theme] + 'light';
    parts.forEach(part => {
      assert.ok(part.cls.startsWith(own), theme + ' part class ' + part.cls);
      classesOf(part.markup || '').forEach(name => prefixes.filter(prefix => prefix !== prefixOf[theme]).forEach(prefix => assert.ok(!name.startsWith(prefix), theme + ' part uses ' + name)));
      assert.ok(Array.isArray(part.close) && Array.isArray(part.open) && part.close.length >= 2 && part.open.length >= 2, theme + ' part has keyframes');
      [part.close, part.open].forEach(frames => frames.forEach(frame => Object.keys(frame).forEach(name => assert.ok(['transform', 'opacity', 'offset', 'easing'].includes(name), theme + ' animates ' + name))));
    });
  });
  // no two themes make the same parts
  const sets = themes.map(theme => kits[theme].light(1100, 700, 'main').map(part => part.cls).join());
  assert.equal(new Set(sets).size, themes.length);
});

await test('a Light run draws a small, fixed number of parts for each kit, on a panel and on the thin strips of a view', () => {
  themes.forEach(theme => {
    ['main', 'side', 'banner', 'ticker'].forEach(role => {
      const rect = role === 'banner' || role === 'ticker' ? [1856, 160] : role === 'side' ? [360, 700] : [1532, 736];
      const parts = kits[theme].light(rect[0], rect[1], role);
      assert.ok(parts.length <= 8, theme + ' ' + role + ' has ' + parts.length + ' parts');
      parts.forEach(part => assert.ok(part.x >= 0 && part.y >= 0 && part.x + part.w <= rect[0] + 1 && part.y + part.h <= rect[1] + 1, theme + ' ' + role + ' part ' + part.cls + ' is outside its region'));
    });
    // four regions, two plates each, and the parts: well under the limit of 40
    const total = ['main', 'side', 'banner', 'ticker'].reduce((sum, role) => sum + 2 + kits[theme].light(1000, role === 'main' ? 700 : 160, role).length, 0);
    assert.ok(total <= 40, theme + ' animates ' + total + ' elements in a view');
  });
});

await test('the Foundry Light transition has the vocabulary of the heavy one: deadbolts that seat and settle, a hand wheel and cogs in mesh, and shutters with a hazard lip', () => {
  const big = kits.foundry.light(1532, 736, 'main');
  const strip = kits.foundry.light(1856, 160, 'banner');
  const classes = list => list.map(part => part.cls);
  assert.deepEqual(classes(big), ['fk-light-bolt', 'fk-light-bolt', 'fk-light-wheel', 'fk-light-gear', 'fk-light-gear']);
  assert.deepEqual(classes(strip), ['fk-light-bolt', 'fk-light-bolt', 'fk-light-gear']);
  big.filter(part => part.cls === 'fk-light-bolt').forEach(part => {
    assert.ok(part.close.some(frame => frame.transform === 'translateX(4px) scaleX(1)'), 'the bolt goes on by 4 pixels when it seats');
    assert.equal(part.close[part.close.length - 1].transform, 'translateX(0px) scaleX(1)', 'and settles');
  });
  const css = noComments(read('styles/foundry/reform-kit.css'));
  assert.ok(/\.reform-light-left[\s\S]*?repeating-linear-gradient\(135deg, var\(--style-hazard\)/.test(css), 'a hazard lip on the plates');
  assert.ok(!/box-shadow:\s*(inset|[1-9-])/.test(css), 'no shadow on the plates');
});

await test('a theme without a kit plays the plain kit, which draws nothing and has no look of any theme', () => {
  roles.forEach(role => assert.equal(plain.draw(role), '', role));
  assert.deepEqual(plain.light(1000, 700, 'main'), []);
  const run = read('core/reform-run.js');
  assert.ok(run.includes("import('./reform-plain.js')"));
  assert.ok(!/styles\/original\/transitions\.js/.test(noComments(run)), 'the fallback is not the Original kit');
  const plainCode = noComments(read('core/reform-plain.js'));
  assert.ok(!/original|cybertron|retro|foundry/i.test(plainCode), 'the plain kit names no theme');
});

await test('the plain stylesheet names no theme and no class of a kit, and every theme file has rules for its own theme only', () => {
  const base = noComments(read('reform-kit.css'));
  assert.ok(!/data-style|\.(rk|ck|rr|fk)-/.test(base), 'reform-kit.css is the plain kit only');
  const own = { original: 'html[data-style="original"]', cybertron: 'html[data-style="cybertron"]', retro: 'html[data-style="retro"]', foundry: 'html[data-style="foundry"]' };
  themes.forEach(theme => {
    const text = noComments(read('styles/' + theme + '/reform-kit.css'));
    prefixes.filter(prefix => prefix !== prefixOf[theme]).forEach(prefix => assert.ok(!text.includes('.' + prefix), theme + ' kit stylesheet mentions the class ' + prefix));
    // a rule that names a theme names its own
    (text.match(/data-style="[a-z]+"/g) || []).forEach(found => assert.equal(found, own[theme].slice(own[theme].indexOf('data-style'), -1), theme + ' stylesheet has a rule for ' + found));
    // a rule of the theme that restyles the engine (the straps, the chassis, the Light plates) starts with the theme
    text.split('}').map(block => block.split('{')[0].trim()).filter(selector => /\.reform-(seg|chassis|chain|light-plate|cover|square)/.test(selector)).forEach(selector => {
      selector.split(',').forEach(part => assert.ok(part.trim().startsWith(own[theme]), theme + ' restyles the engine with "' + part.trim() + '", which any theme would see'));
    });
  });
});

await test('index.html links the plain stylesheet first and then one stylesheet for each theme that has a kit', () => {
  const page = read('index.html');
  const lines = page.split('\n');
  const plainLine = lines.findIndex(line => line.includes('href="reform-kit.css'));
  assert.ok(plainLine > 0);
  themes.forEach(theme => {
    const own = lines.findIndex(line => line.includes('styles/' + theme + '/reform-kit.css'));
    assert.ok(own >= 0, theme);
    if (theme !== 'retro') assert.ok(own > plainLine, theme + ' comes after the plain stylesheet');
  });
});

await test('the Foundry squares turn as steel plates and the other squares are not the Original turn', () => {
  const square = { col: 1, row: 1, x: 100, y: 100, w: 120, h: 100, startMs: 1300, axis: 'y' };
  const move = { dx: 0, dy: 0, sx: 1, sy: 1 };
  const turns = {};
  themes.forEach(theme => { turns[theme] = kits[theme].squares ? JSON.stringify(kits[theme].squares(square, move).transform) : 'default'; });
  assert.equal(turns.original, 'default', 'Original uses the engine turn');
  ['cybertron', 'retro', 'foundry'].forEach(theme => { assert.notEqual(turns[theme], 'default', theme); });
  assert.equal(new Set(Object.values(turns)).size, 4, 'four different turns');
});

console.log('\n' + passed + ' passed');
