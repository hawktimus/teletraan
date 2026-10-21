// The plain half of the Screen section of Settings (settings-screen.js): what the wall reports about its window, the fit that
// fills it, the presets, and the little picture of the canvas in the window. Nothing here touches the page, so
// tests/control-screen.test.mjs can try it with node.

// Not imported from render.js, which imports this file for the Now on the wall card
function esc(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const canvasWidth = 1920;
export const canvasHeight = 1080;

// The stored names and their words. tests/control-screen.test.mjs compares them with dashboard/config-lists.js.
export const fitWords = { auto: 'Auto', fill: 'Fill the window', contain: 'Fit inside', exact: 'No scaling' };
export const limits = { screenScale: { min: 50, max: 200 }, screenOffsetX: { min: -400, max: 400 }, screenOffsetY: { min: -400, max: 400 } };

// The same arithmetic as fitFor in dashboard/core/screen-fit.js; the test runs both over many windows and settings
export function fitFor({ width, height, fit = 'auto', scale = 100, offsetX = 0, offsetY = 0 }) {
  const across = width / canvasWidth;
  const down = height / canvasHeight;
  let base = Math.min(across, down);
  if (fit === 'fill') base = Math.max(across, down);
  if (fit === 'exact') base = 1;
  if (fit === 'auto' && Math.abs(base - 1) < 0.01) base = 1;

  const drawn = base * (scale / 100);
  const left = (width - canvasWidth * drawn) / 2 + offsetX;
  const top = (height - canvasHeight * drawn) / 2 + offsetY;
  const seenWidth = Math.max(0, Math.min(width, left + canvasWidth * drawn) - Math.max(0, left));
  const seenHeight = Math.max(0, Math.min(height, top + canvasHeight * drawn) - Math.max(0, top));
  const unused = width > 0 && height > 0 ? 100 * (1 - (seenWidth * seenHeight) / (width * height)) : 0;
  return { scale: drawn, left: left, top: top, unusedPercent: Math.round(unused * 10) / 10 };
}

// The share of the canvas that falls outside the window, in percent
export function croppedPercent({ width, height, fit, scale, offsetX, offsetY }) {
  const placed = fitFor({ width, height, fit, scale, offsetX, offsetY });
  const whole = canvasWidth * placed.scale * canvasHeight * placed.scale;
  const seenWidth = Math.max(0, Math.min(width, placed.left + canvasWidth * placed.scale) - Math.max(0, placed.left));
  const seenHeight = Math.max(0, Math.min(height, placed.top + canvasHeight * placed.scale) - Math.max(0, placed.top));
  return whole > 0 ? Math.round(1000 * (1 - (seenWidth * seenHeight) / whole)) / 10 : 0;
}

export const autoSettings = { screenFit: 'auto', screenScale: 100, screenOffsetX: 0, screenOffsetY: 0 };

// The choices of the preset box. A preset is a full set of the four stored values.
export const presets = [
  { id: 'auto', title: 'Auto', says: 'Fits the whole picture inside the window.', set: autoSettings },
  { id: 'tv1080', title: '1080p TV', says: 'A 1920 by 1080 window drawn at its own size, with no scaling.', set: { screenFit: 'exact', screenScale: 100, screenOffsetX: 0, screenOffsetY: 0 } },
  { id: 'tv4k', title: '4K TV', says: 'A 3840 by 2160 window: the picture is made twice as big to fill it.', set: autoSettings },
  { id: 'overscanSmall', title: 'Overscan, small', says: 'The TV cuts off a little at the edges: the picture is drawn at 98 percent.', set: { screenFit: 'auto', screenScale: 98, screenOffsetX: 0, screenOffsetY: 0 } },
  { id: 'overscanMedium', title: 'Overscan, medium', says: 'The TV cuts off some of the edges: the picture is drawn at 95 percent.', set: { screenFit: 'auto', screenScale: 95, screenOffsetX: 0, screenOffsetY: 0 } },
  { id: 'overscanLarge', title: 'Overscan, large', says: 'The TV cuts off a lot of the edges: the picture is drawn at 90 percent.', set: { screenFit: 'auto', screenScale: 90, screenOffsetX: 0, screenOffsetY: 0 } },
];

function whole(value) {
  return typeof value === 'number' && isFinite(value) ? Math.round(value) : null;
}

// One line about the window, for the Now on the wall card and the Screen section. "Not reported" when the wall sent none.
export function screenWords(screen) {
  if (!screen || !whole(screen.windowWidth)) return 'Not reported yet';
  const parts = ['Window ' + whole(screen.windowWidth) + ' by ' + whole(screen.windowHeight)];
  if (screen.pixelRatio !== null && screen.pixelRatio !== undefined) parts.push('pixel ratio ' + screen.pixelRatio);
  if (whole(screen.displayWidth)) parts.push('display ' + whole(screen.displayWidth) + ' by ' + whole(screen.displayHeight));
  parts.push('fit ' + (fitWords[screen.fit] || 'Auto').toLowerCase() + (screen.percent && screen.percent !== 100 ? ' at ' + screen.percent + ' percent' : ''));
  parts.push('scale ' + screen.scale);
  parts.push(screen.unusedPercent === null || screen.unusedPercent === undefined ? 'unused not known' : screen.unusedPercent + ' percent unused');
  return parts.join(', ');
}

// What the helper word display-info printed, as lines: the output, the mode in use (marked with a star) and what was logged
export function displayWords(output) {
  const lines = String(output || '').split('\n').map(line => line.trim()).filter(line => line !== '');
  const found = { output: '', modes: [], logged: '', setting: '', unreachable: false };
  lines.forEach(line => {
    if (line.startsWith('output: ')) found.output = line.slice(8);
    else if (line.startsWith('mode: ')) found.modes.push(line.slice(6));
    else if (line.startsWith('display: ')) found.logged = line.slice(9);
    else if (line.startsWith('resolutionSetting: ')) found.setting = line.slice(19);
    else if (line.startsWith('xrandr: ')) found.unreachable = true;
  });
  const inUse = found.modes.filter(mode => mode.includes('*'))[0] || '';
  const words = [];
  if (found.unreachable) words.push('The connected screen could not be read from here.');
  if (found.output) words.push('Output ' + found.output.replace(/\+0\+0$/, ''));
  if (inUse) words.push('mode in use ' + inUse.replace(/\s+/g, ' '));
  if (found.modes.length > 0) words.push('the TV lists ' + found.modes.map(mode => mode.split(' ')[0]).filter((name, index, all) => all.indexOf(name) === index).join(', '));
  if (found.logged) words.push('at start: ' + found.logged);
  if (found.setting && found.setting !== '') words.push('KIOSK_RESOLUTION is ' + found.setting);
  return { text: words.join('. '), found: found };
}

// The settings that make the canvas fill the window, from the report. Returns { settings, words, problem }:
//   problem  a sentence when this page cannot fix it (no report, or the window is smaller than the screen)
//   settings the four stored values to save, with cropping only when it is small
//   words    what the change does, for the question before it is published
export function fillPlan(screen) {
  if (!screen || !whole(screen.windowWidth) || !whole(screen.windowHeight)) {
    return { settings: null, words: '', problem: 'The wall has not reported its window size yet. Wait a few seconds and press the button again.' };
  }
  const width = screen.windowWidth;
  const height = screen.windowHeight;

  const smaller = whole(screen.displayWidth) && whole(screen.displayHeight) && (screen.displayWidth > width * 1.01 || screen.displayHeight > height * 1.01);
  if (smaller) {
    return {
      settings: null,
      words: '',
      problem: 'The browser window is ' + width + ' by ' + height + ' but the screen is ' + screen.displayWidth + ' by ' + screen.displayHeight +
        '. Press Restart screen in Sync and restart so the Teletraan computer sets the screen again. If it stays small, put KIOSK_RESOLUTION=' +
        screen.displayWidth + 'x' + screen.displayHeight + ' in Keys and restart the screen.',
    };
  }

  const aspect = width / height;
  const sixteenNine = Math.abs(aspect / (16 / 9) - 1) < 0.01;
  if (sixteenNine) {
    return { settings: Object.assign({}, autoSettings), words: 'The window is ' + width + ' by ' + height + ', the same shape as the picture. Auto fits it exactly. The size and move settings go back to 100 percent and 0.', problem: '' };
  }
  const cut = croppedPercent({ width, height, fit: 'fill', scale: 100, offsetX: 0, offsetY: 0 });
  if (cut <= 10) {
    return { settings: { screenFit: 'fill', screenScale: 100, screenOffsetX: 0, screenOffsetY: 0 }, words: 'The window is ' + width + ' by ' + height + ', a little different from the picture. Fill covers all of it and cuts off ' + cut + ' percent of the picture at the edges.', problem: '' };
  }
  return {
    settings: Object.assign({}, autoSettings),
    words: 'The window is ' + width + ' by ' + height + ', much wider or taller than the picture. Filling it would cut off ' + cut + ' percent, so the picture stays whole with bars at the sides or the top. Choose Fill the window by hand if you want it cropped.',
    problem: '',
  };
}

// A value in its limits, or null when it is not a whole number there
export function cleanValue(name, text) {
  const trimmed = String(text).trim();
  if (!/^-?[0-9]{1,4}$/.test(trimmed)) return null;
  const number = Number(trimmed);
  const limit = limits[name];
  return number >= limit.min && number <= limit.max ? number : null;
}

// The four stored values from the fields of the manual box, or { problem }
export function readManual(fields) {
  const settings = { screenFit: Object.keys(fitWords).includes(fields.fit) ? fields.fit : 'auto' };
  const names = { screenScale: 'Size', screenOffsetX: 'Move right', screenOffsetY: 'Move down' };
  const sources = { screenScale: fields.scale, screenOffsetX: fields.offsetX, screenOffsetY: fields.offsetY };
  for (const name of Object.keys(names)) {
    const value = cleanValue(name, sources[name]);
    if (value === null) return { problem: names[name] + ' should be a whole number from ' + limits[name].min + ' to ' + limits[name].max + '.' };
    settings[name] = value;
  }
  return { settings: settings };
}

// The picture of the canvas (blue) in the window (grey), 300 pixels wide at most, from the same arithmetic as the wall
export function previewSvg(size, settings) {
  const width = whole(size && size.width) || canvasWidth;
  const height = whole(size && size.height) || canvasHeight;
  const placed = fitFor({ width, height, fit: settings.screenFit, scale: settings.screenScale, offsetX: settings.screenOffsetX, offsetY: settings.screenOffsetY });
  const unit = 300 / width;
  const box = (x, y, w, h) => 'x="' + Math.round(x * unit * 10) / 10 + '" y="' + Math.round(y * unit * 10) / 10 + '" width="' + Math.round(w * unit * 10) / 10 + '" height="' + Math.round(h * unit * 10) / 10 + '"';
  const high = Math.round(height * unit * 10) / 10;
  return '<svg class="fit-picture" viewBox="0 0 300 ' + high + '" role="img" aria-label="' + esc('The picture in the window: ' + placed.unusedPercent + ' percent of the window is unused') + '">' +
    '<rect ' + box(0, 0, width, height) + ' fill="none" stroke="currentColor" stroke-width="1"></rect>' +
    '<rect ' + box(placed.left, placed.top, canvasWidth * placed.scale, canvasHeight * placed.scale) + ' fill="currentColor" fill-opacity="0.25" stroke="currentColor" stroke-width="1" stroke-dasharray="4 3"></rect></svg>' +
    '<p class="note" data-fit-numbers>Unused part of the window: ' + placed.unusedPercent + ' percent. Scale ' + Math.round(placed.scale * 1000) / 1000 + '.</p>';
}
