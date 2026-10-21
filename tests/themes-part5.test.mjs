// Tests for the four theme folders (original, cybertron, retro, foundry) and the background setting of the Original
// theme: the folders and their files, no placeholder left, the lists in step with the Studio, the backgrounds and
// what each one draws, calm and no motion, motion by transform and opacity only, and colors written in tokens only.
//
//   node tests/themes-part5.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dash = root + 'dashboard/';
const read = file => fs.readFileSync(root + file, 'utf8');
const noComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
const load = file => import(pathToFileURL(dash + file).href);

const ids = ['original', 'cybertron', 'retro', 'foundry'];
const files = ['theme.css', 'frame.css', 'tokens.css', 'transitions.js', 'background.js'];

const config = await load('config.js');
const art = await load('core/theme-art.js');
const bg = await load('core/theme-bg.js');
const content = await load('core/content.js');
const plate = await load('core/plate.js');

const studioIds = await import(pathToFileURL(root + 'studio/inputs/theme-ids.js').href);
const studioStyles = await import(pathToFileURL(root + 'studio/inputs/theme-styles.js').href);
const studioBackgrounds = await import(pathToFileURL(root + 'studio/inputs/background-ids.js').href);

let passed = 0;
async function test(name, run) {
  try { await run(); passed += 1; console.log('ok    ' + name); } catch (error) { console.log('FAIL  ' + name + '\n' + error.stack); process.exitCode = 1; }
}

const css = id => ['theme.css', 'frame.css'].map(name => noComments(read('dashboard/styles/' + id + '/' + name))).join('\n');

await test('there are four themes and each folder has its five files, linked from index.html', () => {
  assert.deepEqual(config.themeIds, ids);
  assert.deepEqual(fs.readdirSync(dash + 'styles').sort(), ids.slice().sort());
  const page = read('dashboard/index.html');
  ids.forEach(id => {
    files.forEach(name => assert.ok(fs.existsSync(dash + 'styles/' + id + '/' + name), id + '/' + name));
    ['tokens.css', 'theme.css', 'frame.css'].forEach(name => assert.ok(page.includes('href="styles/' + id + '/' + name + '?v=0"'), id + '/' + name));
  });
});

await test('no theme is a placeholder: no marker file, no word, no note in the Studio', () => {
  ids.forEach(id => {
    assert.equal(fs.existsSync(dash + 'styles/' + id + '/PLACEHOLDER'), false, id);
    files.forEach(name => assert.equal(/PLACEHOLDER/.test(read('dashboard/styles/' + id + '/' + name)), false, id + '/' + name));
  });
  assert.equal(studioIds.themeChoices.some(theme => theme.placeholder), false);
  assert.equal(studioStyles.themeStyles.some(theme => theme.note), false);
  assert.equal(/not designed yet/.test(read('studio/inputs/theme-ids.js') + read('studio/inputs/theme-styles.js')), false);
});

await test('the Studio lists, the weekday schedule and the settings accept Foundry, and the starting week does not use it', () => {
  assert.deepEqual(studioIds.themeIds, ids);
  assert.deepEqual(studioStyles.themeStyles.map(theme => theme.value), ids);
  assert.deepEqual(config.scheduledThemeIds, ids);
  assert.equal(Object.values(config.defaultThemeByWeekday).includes('foundry'), false);
  assert.equal(studioIds.tidyThemeByWeekday({ friday: 'foundry' }).friday, 'foundry');
  const settings = content.withDefaults({ settings: { themeByWeekday: { monday: 'foundry' } } }).settings;
  assert.equal(settings.themeByWeekday.monday, 'foundry');
});

await test('every theme exports its swap and a kit with its id and its drawing of the hardware', async () => {
  for (const id of ids) {
    const module = await load('styles/' + id + '/transitions.js');
    assert.equal(module.swapVariant.name, 'pull-apart');
    assert.equal(module.kit.id, id);
    assert.equal(typeof module.kit.draw, 'function', id + ' draws its hardware, or plays the Original kit');
    assert.ok(module.kit.draw('screw').includes('<svg'), id + ' draws a screw');
  }
});

await test('the background setting has the five words, the Studio has the same, and a bad word is the sweep', () => {
  assert.deepEqual(config.backgrounds, ['sweep', 'blueprint', 'rays', 'spotlight', 'embers']);
  assert.deepEqual(studioBackgrounds.backgroundIds, config.backgrounds);
  assert.equal(config.defaultSettings.background, 'sweep');
  assert.equal(content.withDefaults({ settings: { background: 'nope' } }).settings.background, 'sweep');
  assert.equal(content.withDefaults({ settings: { background: 'rays' } }).settings.background, 'rays');
  assert.equal(bg.backgroundFor({ background: 'embers' }, null), 'embers');
  assert.equal(bg.backgroundFor({ background: 'embers' }, 'rays'), 'rays', 'the address wins');
  assert.equal(bg.backgroundFor({ background: 'x' }, 'y'), 'sweep');
});

await test('the Studio field background is in the Look tab, and is hidden when no day plays Original', async () => {
  const source = read('studio/schemas/settingsBackground.js');
  assert.ok(/name: 'background'/.test(source) && /group: 'look'/.test(source) && /initialValue: 'sweep'/.test(source));
  assert.ok(read('studio/schemas/dashboardSettings.js').includes('...backgroundFields()'));
  const all = (value, day) => ({ themeByWeekday: Object.fromEntries(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(name => [name, value])) });
  assert.equal(studioBackgrounds.playsOriginal(all('cybertron')), false);
  assert.equal(studioBackgrounds.playsOriginal(all('foundry')), false);
  assert.equal(studioBackgrounds.playsOriginal(all('original')), true);
  assert.equal(studioBackgrounds.playsOriginal({}), true);
  assert.equal(studioBackgrounds.playsOriginal({ themeByWeekday: { monday: 'retro', friday: 'original' } }), true);
});

await test('the background layers: the Original sweep draws no layer of its own, and the element budgets are small', async () => {
  const count = markup => (markup.match(/<div|<svg/g) || []).length;
  const all = bg.allBackgrounds();
  assert.equal((all.match(/class="bg-group /g) || []).length, 4, 'one group for each theme');
  const original = (await load('styles/original/background.js')).backgroundMarkup();
  assert.ok(count(original) <= 24, 'original ' + count(original));
  assert.equal((original.match(/bg-ember/g) || []).length, 12, 'a dozen sparks');
  assert.equal((original.match(/bg-ray bg-ray-/g) || []).length, 3, 'three bands of light');
  const retro = (await load('styles/retro/background.js')).backgroundMarkup();
  assert.equal((retro.match(/rt-star/g) || []).length, 11, 'eleven stars');
  const foundry = (await load('styles/foundry/background.js')).backgroundMarkup();
  assert.equal((foundry.match(/fy-mote/g) || []).length, 6, 'six specks of dust');
  assert.ok(/fy-hook/.test(foundry) && /fy-rail/.test(foundry));
  [retro, foundry, (await load('styles/cybertron/background.js')).backgroundMarkup()].forEach(markup => assert.ok(count(markup) <= 24));
  assert.equal(count(all) <= 80, true);
  const original_css = css('original');
  ['blueprint', 'rays', 'spotlight', 'embers'].forEach(name => assert.ok(original_css.includes('html[data-background="' + name + '"]'), name));
  assert.equal(original_css.includes('data-background="sweep"'), false, 'sweep draws nothing');
});

await test('the times of the motion are the ones of the order', () => {
  const cy = css('cybertron');
  assert.ok(/cy-drift 16s linear infinite/.test(cy) && /cy-scan 9s linear infinite/.test(cy));
  assert.ok(/--style-grid-size: 64px/.test(read('dashboard/styles/cybertron/tokens.css')));
  assert.ok(/rt-turn 180s linear infinite/.test(css('retro')));
  const fy = css('foundry');
  assert.ok(/fy-lamp 70s/.test(fy) && /fy-creep 9s linear/.test(fy) && /fy-hook 150s linear/.test(fy));
  const original = css('original');
  assert.ok(/bg-drift-fine 40s/.test(original) && /bg-wander 50s/.test(original));
  const rises = [...read('dashboard/styles/original/background.js').matchAll(/\], \[?\d+, \d, \.?\d+, (\d+)\]/g)].map(match => Number(match[1]));
  const markup = art.themeArtMarkup('grid1');
  assert.ok(markup.includes('--gear-turn: 90s') && markup.includes('--gear-turn: 67.5s') && markup.includes('--gear-turn: 120s'), 'gears at 90, 90 over 12 to 9, and 120');
  assert.equal(90 * 9 / 12, 67.5);
  const strokes = [...markup.matchAll(/--stroke: ([\d.]+)s/g)].map(match => Number(match[1]));
  assert.ok(strokes.length >= 2 && strokes.every(seconds => seconds >= 6 && seconds <= 7.5), 'pistons stroke every 6 to 7.5 seconds ' + strokes);
  assert.ok(rises.length === 0 || rises.every(seconds => seconds >= 23 && seconds <= 38));
  assert.equal([...read('dashboard/styles/original/background.js').matchAll(/(\d+)\]/g)].length > 0, true);
});

await test('everything keyframed moves with transform or opacity only', () => {
  ids.forEach(id => {
    const text = noComments(read('dashboard/styles/' + id + '/frame.css'));
    for (const match of text.matchAll(/@keyframes ([\w-]+) \{([\s\S]*?)\n\}/g)) {
      const properties = [...match[2].matchAll(/([a-z-]+):/g)].map(item => item[1]);
      properties.forEach(property => assert.ok(property === 'transform' || property === 'opacity', id + ' ' + match[1] + ' animates ' + property));
    }
  });
});

await test('no filter, blur or shadow is written in the theme folders, the art or the background', () => {
  const sources = ids.flatMap(id => files.map(name => noComments(read('dashboard/styles/' + id + '/' + name)))).concat(noComments(read('dashboard/core/theme-art.js')), noComments(read('dashboard/core/theme-bg.js')));
  sources.forEach(text => {
    assert.equal(/\bfilter\s*:|blur\(|box-shadow|drop-shadow|backdrop-filter/.test(text), false);
  });
  // The one zero blur offset of ink that Retro writes for the letters of the banner is a hard edge and not a blur
  const retro = css('retro');
  retro.match(/text-shadow:[^;]+;/g).forEach(rule => assert.equal(/\d+px \d+px [1-9]\d*px/.test(rule), false, 'every offset has no blur'));
});

await test('calm and no motion draw the backgrounds, the gears and the pistons still', () => {
  assert.ok(read('dashboard/base.css').includes('html:not([data-motion="full"]) #theme-bg *,\nhtml[data-weight="light"] #theme-bg * { animation: none; }'));
  assert.ok(css('foundry').includes('html:not([data-motion="full"]) .art-foundry .fa-gear'));
  assert.ok(css('foundry').includes('.art-foundry .fa-piston-rod { animation: none; }'));
});

await test('a color is written in tokens.css of a theme and nowhere else in the folders, the art and the background', () => {
  const hex = /#[0-9a-fA-F]{3,8}\b/;
  ids.forEach(id => {
    ['theme.css', 'frame.css', 'background.js', 'transitions.js'].forEach(name => {
      const text = noComments(read('dashboard/styles/' + id + '/' + name)).replace(/url\(#[\w-]+\)/g, '');
      assert.equal(hex.test(text), false, id + '/' + name);
    });
    assert.ok(hex.test(read('dashboard/styles/' + id + '/tokens.css')) || id === 'original', id + ' tokens');
  });
  assert.equal(hex.test(noComments(read('dashboard/core/theme-art.js')).replace(/url\(#[\w-]+\)/g, '')), false);
  assert.equal(/<text/.test(read('dashboard/core/theme-art.js')), false, 'no letters in the art: the caution plate and the link mark are line art');
});

await test('the art of the frames: only the standard layout has it, the gears and pistons are elements of their own', () => {
  ['bar-main-minimal', 'bar-banner-minimal', 'cybertron-grid1', 'cybertron-ticker', 'sidebar'].forEach(kind => assert.equal(art.themeArtMarkup(kind), '', kind));
  ['grid1', 'grid1-tr', 'grid2', 'ticker', 'banner'].forEach(kind => assert.ok(art.themeArtMarkup(kind).includes('class="theme-art'), kind));
  const large = art.themeArtMarkup('grid1');
  assert.equal((large.match(/class="fa-gear /g) || []).length, 3);
  assert.equal((large.match(/class="fa-piston"/g) || []).length, 2);
  assert.ok((large.match(/<(svg|rect|path|polygon|circle|div)/g) || []).length < 90, 'a small number of elements');
  assert.ok(art.themeArtMarkup('grid1-tr').includes('fa-gear-big'), 'the other corners are cut');
  assert.notEqual(art.themeArtMarkup('grid1'), art.themeArtMarkup('grid1-tr'));
  assert.equal(/fa-gear/.test(art.themeArtMarkup('ticker')), false);
});

await test('Cybertron draws a ruler, a hex field and, on the tall frame only, the LINK 04 mark as line art', () => {
  const large = plate.barShape('cybertron-grid1');
  const small = plate.barShape('cybertron-grid2');
  assert.ok(large.art.ruler && small.art.ruler && large.art.hex && large.art.link);
  assert.equal(small.art.link, undefined);
  assert.equal(plate.barShape('cybertron-ticker').art.link, undefined);
  const theme = css('cybertron');
  ['.art-ruler', '.art-link', '.art-hex', '.art-brackets'].forEach(name => assert.ok(theme.includes(name), name));
  assert.ok(/art-link \{[^}]*fill: none;/.test(theme), 'the mark is strokes and no text');
  assert.ok(/fill-opacity: var\(--style-panel-opacity\)/.test(theme), 'translucent panels');
  assert.ok(/theme-hair/.test(read('dashboard/index.html')) && /theme-hex/.test(read('dashboard/index.html')));
});

console.log('\n' + passed + ' passed');
