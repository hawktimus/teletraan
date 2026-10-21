// Screen fit: how the 1920 by 1080 canvas sits in the window (dashboard/core/screen-fit.js), the four settings that tune
// it, the report of the window to the control page, and the plan of the Fit button (control/static/tabs/screen-plan.js).
//
//   node tests/screen-fit.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test, finish } from './helpers/runner.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const load = file => import(pathToFileURL(path.join(root, file)).href);
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const { fitFor } = await load('dashboard/core/screen-fit.js');
const plan = await load('control/static/tabs/screen-plan.js');
const config = await load('dashboard/config.js');
const { withDefaults } = await load('dashboard/core/content-tidy.js');
const { cleanScreen, cleanReport } = await load('dashboard/core/now-report-parts.js');

const near = (actual, wanted, message) => assert.ok(Math.abs(actual - wanted) < 0.001, message + ': ' + actual + ' is not ' + wanted);

test('auto draws the whole canvas, centred, at the scale of the tighter side', () => {
  const same = fitFor({ width: 1920, height: 1080 });
  assert.deepEqual([same.scale, same.left, same.top, same.unusedPercent], [1, 0, 0, 0]);
  const four = fitFor({ width: 3840, height: 2160 });
  assert.deepEqual([four.scale, four.left, four.top, four.unusedPercent], [2, 0, 0, 0]);
  const small = fitFor({ width: 1366, height: 768 });
  near(small.scale, 768 / 1080, 'the height is the tighter side');
  assert.ok(small.unusedPercent < 0.2, 'a 16 by 9 window is filled, ' + small.unusedPercent);
  const wide = fitFor({ width: 2560, height: 1080 });
  assert.equal(wide.scale, 1);
  assert.equal(wide.left, 320, 'centred in a wide window');
  assert.equal(wide.unusedPercent, 25, 'the bars are a quarter of the window');
});

test('a window within one percent of 1920 by 1080 is drawn at exactly 1', () => {
  const near1 = fitFor({ width: 1925, height: 1083 });
  assert.equal(near1.scale, 1);
  assert.equal(fitFor({ width: 1925, height: 1083, fit: 'contain' }).scale, 1083 / 1080 < 1925 / 1920 ? 1083 / 1080 : 1925 / 1920, 'contain does not snap');
});

test('fill covers the window and crops, contain fits inside, exact does not scale', () => {
  const fill = fitFor({ width: 2560, height: 1080, fit: 'fill' });
  near(fill.scale, 2560 / 1920, 'fill takes the larger side');
  assert.equal(fill.unusedPercent, 0);
  assert.ok(fill.top < 0, 'the top is cropped');
  const contain = fitFor({ width: 2560, height: 1080, fit: 'contain' });
  assert.equal(contain.scale, 1);
  const exact = fitFor({ width: 3840, height: 2160, fit: 'exact' });
  assert.equal(exact.scale, 1);
  assert.equal(exact.unusedPercent, 75, 'a 1920 by 1080 canvas in a 4K window leaves three quarters unused');
});

test('size and move work on top of the fit, for a TV that crops its edges', () => {
  const pulled = fitFor({ width: 1920, height: 1080, scale: 95 });
  near(pulled.scale, 0.95, 'size 95');
  near(pulled.left, 48, 'centred');
  near(pulled.top, 27, 'centred');
  assert.ok(pulled.unusedPercent > 9 && pulled.unusedPercent < 10.1, 'the ring of unused window: ' + pulled.unusedPercent);
  const moved = fitFor({ width: 1920, height: 1080, offsetX: -20, offsetY: 30 });
  assert.deepEqual([moved.left, moved.top], [-20, 30]);
  assert.ok(moved.unusedPercent > 0);
  const big = fitFor({ width: 1920, height: 1080, scale: 200 });
  assert.equal(big.unusedPercent, 0, 'a canvas bigger than the window leaves nothing unused');
});

test('the control page draws the same picture as the wall, over many windows and settings', () => {
  const windows = [[1920, 1080], [3840, 2160], [1366, 768], [2560, 1080], [1280, 1024], [1000, 1000], [4096, 2160]];
  const fits = ['auto', 'fill', 'contain', 'exact'];
  let checked = 0;
  windows.forEach(([width, height]) => fits.forEach(fit => [50, 95, 100, 130, 200].forEach(scale => [[0, 0], [-40, 25], [400, -400]].forEach(([offsetX, offsetY]) => {
    const wall = fitFor({ width, height, fit, scale, offsetX, offsetY });
    const page = plan.fitFor({ width, height, fit, scale, offsetX, offsetY });
    assert.deepEqual(page, wall, [width, height, fit, scale, offsetX, offsetY].join());
    checked += 1;
  }))));
  assert.equal(checked, 420);
});

test('the choices, the limits and the starting values are the same on the wall, in the Studio and on the control page', () => {
  assert.deepEqual(config.screenFits, ['auto', 'fill', 'contain', 'exact']);
  assert.deepEqual(Object.keys(plan.fitWords), config.screenFits);
  assert.deepEqual(plan.limits, { screenScale: config.limits.screenScale, screenOffsetX: config.limits.screenOffsetX, screenOffsetY: config.limits.screenOffsetY });
  assert.deepEqual([config.defaultSettings.screenFit, config.defaultSettings.screenScale, config.defaultSettings.screenOffsetX, config.defaultSettings.screenOffsetY], ['auto', 100, 0, 0]);
  assert.deepEqual(plan.autoSettings, { screenFit: 'auto', screenScale: 100, screenOffsetX: 0, screenOffsetY: 0 });
  plan.presets.forEach(preset => {
    assert.ok(config.screenFits.includes(preset.set.screenFit), preset.id);
    ['screenScale', 'screenOffsetX', 'screenOffsetY'].forEach(name => assert.ok(preset.set[name] >= plan.limits[name].min && preset.set[name] <= plan.limits[name].max, preset.id + ' ' + name));
  });
});

test('the content normalizer keeps good values and brings odd ones back to the starting values', () => {
  const tidy = settings => withDefaults({ settings }).settings;
  assert.deepEqual([tidy({}).screenFit, tidy({}).screenScale, tidy({}).screenOffsetX, tidy({}).screenOffsetY], ['auto', 100, 0, 0]);
  const set = tidy({ screenFit: 'fill', screenScale: 95.4, screenOffsetX: -30, screenOffsetY: 12 });
  assert.deepEqual([set.screenFit, set.screenScale, set.screenOffsetX, set.screenOffsetY], ['fill', 95, -30, 12]);
  const odd = tidy({ screenFit: 'stretch', screenScale: 'big', screenOffsetX: null, screenOffsetY: NaN });
  assert.deepEqual([odd.screenFit, odd.screenScale, odd.screenOffsetX, odd.screenOffsetY], ['auto', 100, 0, 0]);
  const far = tidy({ screenScale: 5000, screenOffsetX: -9000, screenOffsetY: 9000 });
  assert.deepEqual([far.screenScale, far.screenOffsetX, far.screenOffsetY], [200, -400, 400], 'values are held inside their limits');
});

test('the shell applies the fit at the start and on every rebuild, with the address on top, and never reloads', () => {
  const shell = read('dashboard/shell.js');
  assert.ok(shell.includes('useScreenFit(defaultSettings, params)') && shell.includes("window.addEventListener('resize', fitToScreen)"));
  assert.ok(read('dashboard/shell-content.js').includes('useScreenFit(shellState.content.settings)'));
  const code = read('dashboard/core/screen-fit.js');
  ['screenfit', 'screenscale', 'screenx', 'screeny'].forEach(word => assert.ok(code.includes("'" + word + "'"), word));
  assert.ok(!/location\.reload|window\.location/.test(code), 'a change of the fit is live');
  assert.ok(!/box-shadow|filter:|blur\(/.test(code));
});

test('the report to the control page carries the window, the pixel ratio, the display, the fit and the unused share', () => {
  const clean = cleanScreen({ windowWidth: 1920, windowHeight: 1080, pixelRatio: 1, displayWidth: 3840, displayHeight: 2160, fit: 'fill', scale: 1.33333333, percent: 100, offsetX: 0, offsetY: 0, unusedPercent: 0, extra: 'x' });
  assert.deepEqual(clean, { windowWidth: 1920, windowHeight: 1080, pixelRatio: 1, displayWidth: 3840, displayHeight: 2160, fit: 'fill', scale: 1.333, percent: 100, offsetX: 0, offsetY: 0, unusedPercent: 0 });
  assert.equal(cleanScreen(null), null);
  assert.equal(cleanScreen('x'), null);
  const odd = cleanScreen({ windowWidth: 'wide', fit: 'stretch', unusedPercent: 900 });
  assert.equal(odd.windowWidth, null);
  assert.equal(odd.fit, '');
  assert.equal(odd.unusedPercent, 100);
  assert.deepEqual(cleanReport({ screen: { windowWidth: 800 } }, new Date(0)).screen.windowWidth, 800);
  assert.equal(cleanReport({}, new Date(0)).screen, null);
  assert.ok(read('dashboard/core/now-report.js').includes('screen: fitReport()'));
});

test('the words about the window and the display are plain', () => {
  assert.equal(plan.screenWords(null), 'Not reported yet');
  const words = plan.screenWords({ windowWidth: 1920, windowHeight: 1080, pixelRatio: 1, displayWidth: 3840, displayHeight: 2160, fit: 'auto', scale: 1, percent: 100, unusedPercent: 0 });
  assert.equal(words, 'Window 1920 by 1080, pixel ratio 1, display 3840 by 2160, fit auto, scale 1, 0 percent unused');
  assert.ok(!/[–—!]/.test(words));
  const shown = plan.displayWords('resolutionSetting: \noutput: HDMI-1 primary 1920x1080+0+0\nmode: 3840x2160 30.00 +\nmode: 1920x1080 60.00*+ 50.00\ndisplay: output HDMI-1, mode 1920x1080, scale 1x1\nok');
  assert.ok(shown.text.includes('Output HDMI-1 primary 1920x1080') && shown.text.includes('mode in use 1920x1080 60.00*+ 50.00') && shown.text.includes('the TV lists 3840x2160, 1920x1080'), shown.text);
  assert.ok(plan.displayWords('xrandr: not reachable from the control helper').text.startsWith('The connected screen could not be read'));
});

test('the Fit button plans auto for a 16 by 9 window, a small crop for a near one and no crop for a very different one', () => {
  const window = (width, height, more = {}) => Object.assign({ windowWidth: width, windowHeight: height, displayWidth: width, displayHeight: height }, more);
  assert.deepEqual(plan.fillPlan(window(1920, 1080)).settings, plan.autoSettings);
  assert.deepEqual(plan.fillPlan(window(3840, 2160)).settings, plan.autoSettings);
  assert.deepEqual(plan.fillPlan(window(1366, 768, { percent: 90, fit: 'auto' })).settings, plan.autoSettings, 'a size of 90 percent that someone left is put back');
  const near1 = plan.fillPlan(window(1920, 1400));
  assert.equal(near1.settings.screenFit, 'auto', 'a 1920 by 1400 window would lose 23 percent, so nothing is cropped without asking');
  const slight = plan.fillPlan(window(1920, 1000));
  assert.equal(slight.settings.screenFit, 'fill');
  assert.match(slight.words, /cuts off [0-9.]+ percent/);
  const wide = plan.fillPlan(window(2560, 1080));
  assert.equal(wide.settings.screenFit, 'auto');
  assert.match(wide.words, /Choose Fill the window by hand/);
  // after the plan is applied, the margins are under one percent whenever the plan fills
  [[1920, 1080], [3840, 2160], [1366, 768], [1920, 1000], [1280, 720]].forEach(([width, height]) => {
    const settings = plan.fillPlan(window(width, height)).settings;
    const placed = plan.fitFor({ width, height, fit: settings.screenFit, scale: settings.screenScale, offsetX: settings.screenOffsetX, offsetY: settings.screenOffsetY });
    assert.ok(placed.unusedPercent < 1, width + 'x' + height + ' leaves ' + placed.unusedPercent);
  });
});

test('the Fit button says what to do when the window is smaller than the screen, or when nothing was reported', () => {
  const smaller = plan.fillPlan({ windowWidth: 1920, windowHeight: 1080, displayWidth: 3840, displayHeight: 2160 });
  assert.equal(smaller.settings, null);
  assert.match(smaller.problem, /Restart screen/);
  assert.match(smaller.problem, /KIOSK_RESOLUTION=3840x2160/);
  assert.match(plan.fillPlan(null).problem, /has not reported/);
  assert.match(plan.fillPlan({ windowWidth: null }).problem, /has not reported/);
});

test('the by hand boxes are read with the limits of the Studio', () => {
  assert.deepEqual(plan.readManual({ fit: 'fill', scale: '95', offsetX: '-10', offsetY: '20' }), { settings: { screenFit: 'fill', screenScale: 95, screenOffsetX: -10, screenOffsetY: 20 } });
  assert.match(plan.readManual({ fit: 'auto', scale: '49', offsetX: '0', offsetY: '0' }).problem, /Size should be a whole number from 50 to 200/);
  assert.match(plan.readManual({ fit: 'auto', scale: '100', offsetX: '401', offsetY: '0' }).problem, /Move right/);
  assert.match(plan.readManual({ fit: 'auto', scale: '100', offsetX: '0', offsetY: '1.5' }).problem, /Move down/);
  assert.equal(plan.readManual({ fit: 'weird', scale: '100', offsetX: '0', offsetY: '0' }).settings.screenFit, 'auto');
  const svg = plan.previewSvg({ width: 2560, height: 1080 }, { screenFit: 'auto', screenScale: 100, screenOffsetX: 0, screenOffsetY: 0 });
  assert.ok(svg.includes('Unused part of the window: 25 percent'), svg);
});

test('the Screen section is in Settings, uses the generic settings routes and the display-info word, and says what it did in plain words', () => {
  const section = read('control/static/tabs/settings-screen.js');
  assert.ok(section.includes("'/doc/' + settingsId + '/save'") && section.includes("'/doc/' + settingsId + '/publish'") && section.includes("'/helper/display-info'"));
  assert.ok(section.includes('The dashboard now fills '), 'it reads the next report and says how much of the screen is filled');
  assert.ok(section.includes('baseRev: doc.rev'), 'the revision check of the settings editor');
  assert.ok(section.includes('window.confirm'), 'nothing is published without a yes');
  const everything = section + read('control/static/tabs/screen-plan.js');
  assert.ok(!/[–—]/.test(everything), 'no em or en dashes');
  assert.ok(!/[A-Za-z]!['"<\s]/.test(everything.replace(/!==|!=/g, '')), 'no exclamation marks in the words');
  assert.ok(read('control/routes/helper.js').includes("'display-info'") && read('control/lib/helper-client.js').includes("'display-info'"));
});

finish();
