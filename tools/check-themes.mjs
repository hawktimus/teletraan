// Checks every theme and holiday overlay in dashboard/themes/ without a
// browser. It fails when
//   - a theme is missing a required variable, or sets one that is not listed
//   - an overlay sets a variable that is not an accent colour
//   - a theme or overlay file holds anything but CSS variables
//   - a registry entry has no file, or a file has no registry entry
//   - any text and background pair on the screen is under 7:1 contrast, for
//     any theme, alone and with any overlay on top of it
//   - Neon Prime's three files (its colours, its decor and its kit) write a
//     green: any colour with a hue from 65 to 175 degrees that is not a grey
//   - a keyframe is anywhere but frame.css, seasons/motion.css or neon-kit.css,
//     or neon-kit.css animates anything but transform, opacity and
//     stroke-dashoffset, uses a filter, blur, glow, shadow or blend mode, or
//     plays an animation outside full motion and the kit being on
//
//   node tools/check-themes.mjs
//
// The names a theme must set are in dashboard/themes/required.js. What each is
// for is written at the top of dashboard/themes/hawktimus.css.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const themeFolder = path.join(dashboardFolder, 'themes');
const overlayFolder = path.join(themeFolder, 'overlays');

const minimumContrast = 7;

// The text and background pairs that are on the screen. Each is a text colour
// on a background colour, both named by their variable. "where" says where the
// pair is seen, so a failure says what would be hard to read.
const pairs = [
  { text: '--white', background: '--plate', where: 'main text on a plate' },
  { text: '--yellow', background: '--plate', where: 'headings and labels on a plate' },
  { text: '--lilac', background: '--plate', where: 'quiet text on a plate' },
  { text: '--white', background: '--card', where: 'text on a card' },
  { text: '--yellow', background: '--card', where: 'headings on a card' },
  { text: '--lilac', background: '--card', where: 'quiet text on a card' },
  { text: '--white', background: '--purple', where: 'TEAM on the team plate and header tabs' },
  { text: '--yellow', background: '--purple', where: 'the team number on the team plate' },
  { text: '--white', background: '--ground', where: 'the clock, and the second line of an announcement' },
  { text: '--yellow', background: '--ground', where: 'the date, and the title of an announcement' },
  { text: '--lilac', background: '--ground', where: 'quiet text on the banner' },
  { text: '--ground', background: '--yellow', where: 'SAMPLE CONTENT in the banner' },
  { text: '--white', background: '--danger-plate', where: 'a blocked task, the countdown, and the lines of the connection status text while Sanity cannot be reached' },
  { text: '--yellow', background: '--danger-plate', where: 'the countdown label and date, and the ssh line of the connection status text' },
  { text: '--danger-bright', background: '--danger-plate', where: 'the countdown in its last month, and the first line of the connection status text' },
  { text: '--lilac', background: '--danger-plate', where: 'the subteam of a blocked task' },
  { text: '--status-blocked', background: '--danger-plate', where: 'the label of a blocked task' },
  { text: '--white', background: '--danger-hot', where: 'the alert, and the countdown in its last week' },
  { text: '--yellow', background: '--danger-hot', where: 'the alert message' },
  { text: '--status-progress', background: '--plate', where: 'an in progress task' },
  { text: '--status-next', background: '--plate', where: 'an up next task' },
  { text: '--status-done', background: '--plate', where: 'a done task' },
  { text: '--status-blocked', background: '--plate', where: 'a blocked task in the task counts' },
];

// Pairs of the current Hawktimus look that are under 7:1. Its colours were
// chosen before this check existed and are not changed here, so these three
// are the known exceptions, and the owner decides later whether to change
// them. A pair listed here must stay at or above its floor (the ratio it has
// today, rounded down to one decimal), so an overlay cannot make it worse.
// If Hawktimus ever reaches 7:1 on a pair, the check fails until the pair is
// taken off this list. Only Hawktimus has exceptions. Every other theme must
// reach 7:1 on every pair.
const knownBelowSeven = [
  { theme: 'hawktimus', text: '--yellow', background: '--purple', floor: 5.5 }, // 5.54:1
  { theme: 'hawktimus', text: '--status-blocked', background: '--plate', floor: 5.5 }, // 5.53:1
  { theme: 'hawktimus', text: '--status-blocked', background: '--danger-plate', floor: 6.1 }, // 6.14:1
];

function load(file) {
  return import(pathToFileURL(file).href);
}

// CSS reading. Comments are dropped, then every "selectors { declarations }".

function blocksIn(cssText) {
  const text = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  let match = pattern.exec(text);

  while (match) {
    blocks.push({
      selectors: match[1].split(',').map(selector => selector.trim()),
      declarations: match[2].split(';').map(item => item.trim()).filter(Boolean).map(item => {
        const colon = item.indexOf(':');
        return { name: item.slice(0, colon).trim(), value: item.slice(colon + 1).trim() };
      }),
    });
    match = pattern.exec(text);
  }
  return blocks;
}

// Reads a theme or overlay file. allowedSelectors are the only selectors it may use.
// Returns the variables it sets (later ones win) and anything wrong with the file.
function readVariables(file, allowedSelectors, problems, label) {
  const variables = {};
  if (!fs.existsSync(file)) {
    problems.push(label + ': the file ' + path.relative(dashboardFolder, file) + ' does not exist');
    return variables;
  }

  const blocks = blocksIn(fs.readFileSync(file, 'utf8'));
  if (blocks.length === 0) problems.push(label + ': the file has no CSS rule in it');

  blocks.forEach(block => {
    block.selectors.forEach(selector => {
      if (allowedSelectors.indexOf(selector) === -1) problems.push(label + ': the selector "' + selector + '" is not allowed here. Use ' + allowedSelectors.join(' or '));
    });
    block.declarations.forEach(declaration => {
      if (declaration.name.slice(0, 2) !== '--') problems.push(label + ': "' + declaration.name + '" is not a variable. A theme file holds variables only');
      else variables[declaration.name] = declaration.value;
    });
  });
  return variables;
}

// Colours

// #rgb, #rrggbb, rgb() and rgba(). Gives { r, g, b, a }, or null if it is anything else.
function parseColor(text) {
  const value = text.trim().toLowerCase();
  let match = /^#([0-9a-f]{3})$/.exec(value);
  if (match) {
    const parts = match[1].split('').map(digit => parseInt(digit + digit, 16));
    return { r: parts[0], g: parts[1], b: parts[2], a: 1 };
  }

  match = /^#([0-9a-f]{6})$/.exec(value);
  if (match) {
    const number = parseInt(match[1], 16);
    return { r: number >> 16, g: (number >> 8) & 255, b: number & 255, a: 1 };
  }

  match = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(value);
  if (match) {
    const alpha = match[4] === undefined ? 1 : Number(match[4]);
    const color = { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: alpha };
    return color.r > 255 || color.g > 255 || color.b > 255 || alpha > 1 ? null : color;
  }
  return null;
}

// How bright a colour looks, from 0 to 1, as WCAG defines it
function luminance(color) {
  const channel = value => {
    const part = value / 255;
    return part <= 0.03928 ? part / 12.92 : Math.pow((part + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

// WCAG contrast ratio, from 1 (none) to 21 (black on white)
function contrast(first, second) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// A variable's colour. A value like var(--lilac) is looked up in the same set
// of variables. Gives { color } or { problem }.
function colorOf(name, variables, seen) {
  const chain = seen || [];
  if (!(name in variables)) return { problem: name + ' is not set' };
  if (chain.indexOf(name) !== -1) return { problem: name + ' refers to itself' };

  const reference = /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(variables[name]);
  if (reference) return colorOf(reference[1], variables, chain.concat(name));

  const color = parseColor(variables[name]);
  return color ? { color: color } : { problem: name + ' is "' + variables[name] + '", which is not a colour written as #rrggbb, rgb() or rgba()' };
}

function round(number) {
  return Math.round(number * 100) / 100;
}

// The checks

const world = {};

function checkRegistry(kind, list, problems) {
  const seen = [];
  list.forEach(entry => {
    const label = kind + ' "' + entry.id + '"';
    if (!/^[a-z][a-z0-9-]*$/.test(entry.id || '')) problems.push(label + ': the id should be lowercase letters, digits and dashes, starting with a letter');
    if (seen.indexOf(entry.id) !== -1) problems.push(label + ': the id is listed twice');
    seen.push(entry.id);

    if (!/^[A-Z]/.test(entry.name || '') || entry.name.indexOf('-') !== -1) problems.push(label + ': the name should start with a capital letter and have no dash');
    if (!entry.description || /[\n\r]/.test(entry.description) || entry.description.length > 120) problems.push(label + ': the description should be one line of up to 120 characters');
  });
}

function checkFilesMatchRegistry(folder, list, kind, problems) {
  const files = fs.readdirSync(folder).filter(name => name.endsWith('.css')).map(name => name.slice(0, -4));
  files.filter(id => !list.some(entry => entry.id === id)).forEach(id => problems.push(id + '.css is in ' + path.relative(dashboardFolder, folder) + ' but no ' + kind + ' with the id "' + id + '" is in its registry.js'));
  list.filter(entry => files.indexOf(entry.id) === -1).forEach(entry => problems.push(kind + ' "' + entry.id + '" is in the registry but ' + entry.id + '.css is missing'));
}

function checkRegistries() {
  const problems = [];
  checkRegistry('theme', world.themes, problems);
  checkRegistry('overlay', world.overlays, problems);
  checkFilesMatchRegistry(themeFolder, world.themes, 'theme', problems);
  checkFilesMatchRegistry(overlayFolder, world.overlays, 'overlay', problems);

  const defaultId = world.config.defaultThemeSettings.defaultTheme;
  if (!world.themes.some(entry => entry.id === defaultId)) problems.push('defaultThemeSettings.defaultTheme in config.js is "' + defaultId + '", which is not in the theme registry');

  const index = fs.readFileSync(path.join(dashboardFolder, 'index.html'), 'utf8');
  if (index.indexOf('href="themes/' + defaultId + '.css"') === -1) problems.push('index.html should link themes/' + defaultId + '.css, the default theme, because the screen needs it before anything is drawn');
  return problems;
}

function checkThemeFiles() {
  const problems = [];
  const required = world.required.requiredVariables;
  const known = required.concat(world.required.optionalVariables);
  const defaultId = world.config.defaultThemeSettings.defaultTheme;

  world.themes.forEach(entry => {
    const label = 'theme "' + entry.id + '"';
    const selectors = ['html.theme-' + entry.id].concat(entry.id === defaultId ? [':root'] : []);
    const variables = readVariables(path.join(themeFolder, entry.id + '.css'), selectors, problems, label);
    world.variables[entry.id] = variables;

    required.filter(name => !(name in variables)).forEach(name => problems.push(label + ' is missing the required variable ' + name));
    Object.keys(variables).filter(name => known.indexOf(name) === -1).forEach(name => problems.push(label + ' sets ' + name + ', which is not a theme variable. Check the spelling, or add it to required.js'));
    Object.keys(variables).forEach(name => {
      const found = colorOf(name, variables);
      if (found.problem) problems.push(label + ': ' + found.problem);
    });
  });

  // tokens.css is for sizes, times and the metal. A colour set there as well would fight the theme.
  const tokens = fs.readFileSync(path.join(dashboardFolder, 'tokens.css'), 'utf8');
  const inTokens = blocksIn(tokens).reduce((names, block) => names.concat(block.declarations.map(item => item.name)), []);
  required.concat(['--logo-purple', '--logo-tail', '--logo-far']).filter(name => inTokens.indexOf(name) !== -1).forEach(name => {
    problems.push('tokens.css sets ' + name + '. Theme colours belong in the theme files only');
  });
  return problems;
}

function checkOverlayFiles() {
  const problems = [];
  const allowed = world.required.overlayVariables;

  world.overlays.forEach(entry => {
    const label = 'overlay "' + entry.id + '"';
    const variables = readVariables(path.join(overlayFolder, entry.id + '.css'), ['html.overlay-' + entry.id], problems, label);
    world.variables['overlay:' + entry.id] = variables;

    world.required.requiredOverlayVariables.filter(name => !(name in variables)).forEach(name => problems.push(label + ' is missing the required variable ' + name));
    Object.keys(variables).forEach(name => {
      if (allowed.indexOf(name) === -1) problems.push(label + ' sets ' + name + '. An overlay may only set accent colours: ' + allowed.join(', '));

      const color = parseColor(variables[name]);
      if (!color) problems.push(label + ': ' + name + ' is "' + variables[name] + '", which is not a colour written as #rrggbb, rgb() or rgba()');
    });
  });
  return problems;
}

// Every theme alone, and with each overlay on top of it
function checkContrast(problems, notes) {
  const combinations = [];
  world.themes.forEach(theme => {
    combinations.push({ theme: theme.id, overlay: '' });
    world.overlays.forEach(overlay => combinations.push({ theme: theme.id, overlay: overlay.id }));
  });

  const exceptionsUsed = [];
  combinations.forEach(combination => {
    const variables = Object.assign({}, world.variables[combination.theme], combination.overlay ? world.variables['overlay:' + combination.overlay] : {});
    const label = 'theme "' + combination.theme + '"' + (combination.overlay ? ' with overlay "' + combination.overlay + '"' : '');

    pairs.forEach(pair => {
      const text = colorOf(pair.text, variables);
      const background = colorOf(pair.background, variables);
      if (text.problem || background.problem) return problems.push(label + ': ' + (text.problem || background.problem));
      if (text.color.a !== 1 || background.color.a !== 1) return problems.push(label + ': ' + pair.text + ' and ' + pair.background + ' must be solid colours, not see-through ones');

      const ratio = contrast(text.color, background.color);
      if (ratio >= minimumContrast) return;

      const known = knownBelowSeven.filter(item => item.theme === combination.theme && item.text === pair.text && item.background === pair.background)[0];
      const words = pair.text + ' on ' + pair.background + ' (' + pair.where + ') is ' + round(ratio) + ':1';
      if (!known) return problems.push(label + ': ' + words + ', under ' + minimumContrast + ':1');
      if (ratio < known.floor) return problems.push(label + ': ' + words + ', under the ' + known.floor + ':1 it has in the current look');

      if (!combination.overlay) exceptionsUsed.push(known);
      if (!combination.overlay) notes.push('known exception: ' + label + ': ' + words + ' (listed in check-themes.mjs)');
    });
  });

  // An exception that is no longer needed would hide a future problem
  knownBelowSeven.filter(item => exceptionsUsed.indexOf(item) === -1).forEach(item => {
    problems.push('knownBelowSeven lists ' + item.text + ' on ' + item.background + ' for "' + item.theme + '", but that pair now passes ' + minimumContrast + ':1 or no longer exists. Take it off the list');
  });
  return problems;
}

function checkPairsExist() {
  const problems = [];
  const names = world.required.requiredVariables;
  pairs.forEach(pair => {
    [pair.text, pair.background].forEach(name => {
      if (names.indexOf(name) === -1) problems.push('the pair ' + pair.text + ' on ' + pair.background + ' uses ' + name + ', which is not a required variable');
    });
  });
  return problems;
}

// Neon Prime has no green. It is dark purple and gunmetal with cyan, magenta and
// amber, and the owner asked for the green to go. A colour written in any of
// these three files, as #hex, rgb(), rgba(), hsl(), hsla() or a colour word, fails
// when its hue is in this range (yellow green, through green, to teal green) and
// it is not a grey. The seasonal packs are not these files: a pack recolours
// the accent on purpose, and Christmas is green.
const noGreenFiles = ['themes/neon-prime.css', 'themes/decor/neon-prime-decor.css', 'neon-kit.css'];
const greenFrom = 65;
const greenTo = 175;

// A grey, or so nearly one that it has no hue to speak of: under 15 percent
// saturation, or all three channels within 15 of each other (nearly black or white)
const greyBelowSaturation = 0.15;
const greyChannelSpread = 15;

// The colour words that are greens. The other colour words are not checked.
const greenWords = [
  'green', 'lime', 'limegreen', 'lawngreen', 'chartreuse', 'greenyellow', 'yellowgreen',
  'springgreen', 'mediumspringgreen', 'lightgreen', 'palegreen', 'darkgreen', 'forestgreen',
  'seagreen', 'mediumseagreen', 'darkseagreen', 'olivedrab', 'darkolivegreen',
  'aquamarine', 'mediumaquamarine',
];

// Hue in degrees (0 to 360) and saturation (0 to 1) of { r, g, b }, as HSL defines them
function hueAndSaturation(color) {
  const red = color.r / 255;
  const green = color.g / 255;
  const blue = color.b / 255;
  const top = Math.max(red, green, blue);
  const bottom = Math.min(red, green, blue);
  const spread = top - bottom;
  const lightness = (top + bottom) / 2;
  if (spread === 0) return { hue: 0, saturation: 0 };

  const saturation = lightness > 0.5 ? spread / (2 - top - bottom) : spread / (top + bottom);
  let hue;
  if (top === red) hue = (green - blue) / spread + (green < blue ? 6 : 0);
  else if (top === green) hue = (blue - red) / spread + 2;
  else hue = (red - green) / spread + 4;
  return { hue: hue * 60, saturation: saturation };
}

// The standard conversion from hsl() to red, green and blue (0 to 255)
function hslToRgb(hue, saturation, lightness) {
  const reach = saturation * Math.min(lightness, 1 - lightness);
  const channel = offset => {
    const position = (((offset + hue / 30) % 12) + 12) % 12;
    return 255 * (lightness - reach * Math.max(-1, Math.min(position - 3, 9 - position, 1)));
  };
  return { r: channel(0), g: channel(8), b: channel(4) };
}

// What a hue is called, for the message
function hueName(hue) {
  if (hue < 95) return 'yellow green';
  if (hue < 150) return 'green';
  return 'teal green';
}

// Every colour written in some CSS text, in the order it is written, as { text,
// color or word, place, line }. The comments are blanked first (not removed, so
// the line numbers stay right), and only what is after a colon inside a rule is
// read, so a selector such as #screen is never taken for a colour. A colour
// that needs a variable to be known is left out.
function coloursWritten(cssText) {
  const text = cssText.replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\n]/g, ' '));
  const found = [];
  const lineOf = place => text.slice(0, place).split('\n').length;
  const inValue = place => {
    const before = text.slice(0, place);
    const start = Math.max(before.lastIndexOf('{'), before.lastIndexOf(';'), before.lastIndexOf('}'));
    return before.slice(start + 1).indexOf(':') !== -1;
  };

  const hexPattern = /#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?![0-9a-z-])/gi;
  let match = hexPattern.exec(text);
  while (match) {
    if (inValue(match.index)) {
      const digits = match[1].length <= 4 ? match[1].split('').map(digit => digit + digit).join('') : match[1];
      const number = parseInt(digits.slice(0, 6), 16);
      found.push({ text: match[0], color: { r: number >> 16, g: (number >> 8) & 255, b: number & 255 }, place: match.index, line: lineOf(match.index) });
    }
    match = hexPattern.exec(text);
  }

  const functionPattern = /\b(rgba?|hsla?)\(([^()]*)\)/gi;
  match = functionPattern.exec(text);
  while (match) {
    const numbers = match[2].split(/[\s,/]+/).filter(Boolean).map(part => parseFloat(part));
    if (numbers.length >= 3 && numbers.every(number => !isNaN(number))) {
      const parts = match[2].split(/[\s,/]+/).filter(Boolean);
      const percent = index => parts[index].indexOf('%') !== -1;
      const color = match[1].toLowerCase().slice(0, 3) === 'hsl'
        ? hslToRgb(numbers[0], numbers[1] / 100, numbers[2] / 100)
        : { r: percent(0) ? numbers[0] * 2.55 : numbers[0], g: percent(1) ? numbers[1] * 2.55 : numbers[1], b: percent(2) ? numbers[2] * 2.55 : numbers[2] };
      found.push({ text: match[0], color: color, place: match.index, line: lineOf(match.index) });
    }
    match = functionPattern.exec(text);
  }

  const wordPattern = new RegExp('(?<![\\w.#-])(' + greenWords.join('|') + ')(?![\\w-])', 'gi');
  match = wordPattern.exec(text);
  while (match) {
    if (inValue(match.index)) found.push({ text: match[0], word: match[1].toLowerCase(), place: match.index, line: lineOf(match.index) });
    match = wordPattern.exec(text);
  }
  return found.sort((first, second) => first.place - second.place);
}

// The problems with greens in one file's text. "name" is what the message calls the file.
function greensIn(name, cssText) {
  const problems = [];
  coloursWritten(cssText).forEach(found => {
    const where = name + ' line ' + found.line + ': ';
    if (found.word) return problems.push(where + 'the colour word "' + found.word + '" is a green. Neon Prime has no green: use cyan, magenta, violet, white or amber');

    const color = found.color;
    const spread = Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b);
    const measured = hueAndSaturation(color);
    if (spread <= greyChannelSpread || measured.saturation < greyBelowSaturation) return;

    const hue = Math.round(measured.hue); // whole degrees, as the message says them
    if (hue >= greenFrom && hue <= greenTo) {
      problems.push(where + found.text + ' is a green (hue ' + hue + ' degrees, ' + hueName(hue) + '). Neon Prime uses no hue from ' + greenFrom + ' to ' + greenTo + ' degrees: use cyan, magenta, violet, white or amber');
    }
  });
  return problems;
}

function checkNoGreen() {
  const problems = [];
  noGreenFiles.forEach(file => {
    const full = path.join(dashboardFolder, file);
    if (!fs.existsSync(full)) return problems.push(file + ' does not exist, so it cannot be checked for green');
    problems.push.apply(problems, greensIn(file, fs.readFileSync(full, 'utf8')));
  });
  return problems;
}

// The Neon Prime kit (docs/layouts.md, "The kit"). Things move in three
// stylesheets and nowhere else: frame.css, seasons/motion.css and neon-kit.css.
// A keyframe anywhere else fails, and so does a panel's stylesheet that has
// one. The kit's own file may animate only transform, opacity and
// stroke-dashoffset, uses no filter, blur, glow, shadow or blend mode, and plays
// an animation only in full motion and only while frame.js says the kit is on
// (data-kit="on"), so calm and none motion, the night screen, an alert and a
// hidden transition never see it move. The check for the other two files is in
// tools/test-tick.mjs and tools/check-seasons.mjs.
const motionFiles = ['frame.css', 'seasons/motion.css', 'neon-kit.css'];
const kitFile = 'neon-kit.css';
const kitMayAnimate = ['transform', 'opacity', 'stroke-dashoffset'];
const kitGate = 'html[data-kit="on"][data-motion="full"]';
const kitForbidden = [
  { pattern: /filter|blur|glow|shadow/i, words: 'a filter, blur, glow or shadow' },
  { pattern: /blend/i, words: 'a blend mode' },
  { pattern: /backdrop/i, words: 'a backdrop' },
  { pattern: /will-change/i, words: 'will-change' },
  { pattern: /transition\s*:|transition-/i, words: 'a transition' },
];
const keyframesPattern = /@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g;

// Every .css file under the dashboard folder except the fonts, as a path with slashes, relative to it
function stylesheets(folder) {
  const found = [];
  fs.readdirSync(path.join(dashboardFolder, folder), { withFileTypes: true }).forEach(entry => {
    const relative = folder === '' ? entry.name : folder + '/' + entry.name;
    if (entry.isDirectory() && entry.name !== 'fonts') found.push.apply(found, stylesheets(relative));
    else if (entry.name.endsWith('.css')) found.push(relative);
  });
  return found;
}

function checkKit() {
  const problems = [];
  const withoutComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '');

  stylesheets('').filter(file => motionFiles.indexOf(file) === -1).forEach(file => {
    if (/@keyframes/.test(withoutComments(fs.readFileSync(path.join(dashboardFolder, file), 'utf8')))) {
      problems.push('dashboard/' + file + ' has @keyframes. Every keyframe belongs in ' + motionFiles.join(', ') + ' (a panel holds no animation)');
    }
  });

  const full = path.join(dashboardFolder, kitFile);
  if (!fs.existsSync(full)) return problems.concat(['dashboard/' + kitFile + ' does not exist']);

  const text = withoutComments(fs.readFileSync(full, 'utf8'));
  kitForbidden.filter(rule => rule.pattern.test(text)).forEach(rule => problems.push(kitFile + ' uses ' + rule.words + '. The kit is flat colour and thin lines, and moves only transform, opacity and stroke-dashoffset'));

  const defined = [];
  let match = keyframesPattern.exec(text);
  while (match) {
    const name = match[1];
    defined.push(name);
    if (!/^kit-[a-z0-9-]+$/.test(name)) problems.push('the keyframes "' + name + '" in ' + kitFile + ' should be named kit-<name>');

    const properties = [];
    match[2].replace(/\{([^{}]*)\}/g, (all, body) => {
      body.split(';').map(item => item.trim()).filter(Boolean).forEach(item => properties.push(item.slice(0, item.indexOf(':')).trim()));
      return all;
    });
    properties.filter((property, place) => kitMayAnimate.indexOf(property) === -1 && properties.indexOf(property) === place).forEach(property => {
      problems.push('the keyframes "' + name + '" in ' + kitFile + ' animate ' + property + '. Only ' + kitMayAnimate.join(', ') + ' may be animated');
    });
    match = keyframesPattern.exec(text);
  }
  keyframesPattern.lastIndex = 0;

  const rules = blocksIn(text.replace(keyframesPattern, ''));
  keyframesPattern.lastIndex = 0;
  const played = [];
  rules.filter(rule => rule.declarations.some(item => /^animation/.test(item.name))).forEach(rule => {
    rule.selectors.filter(selector => selector.indexOf(kitGate) !== 0).forEach(selector => {
      problems.push(kitFile + ' plays an animation with the selector "' + selector + '". Start it with ' + kitGate + ', so that calm and none motion stay still, and so does everything while the night screen, an alert or a hidden transition has the screen');
    });
    rule.declarations.filter(item => item.name === 'animation' || item.name === 'animation-name').forEach(item => {
      (item.value.match(/\bkit-[a-z0-9-]+/g) || []).forEach(name => {
        played.push(name);
        if (defined.indexOf(name) === -1) problems.push(kitFile + ' plays ' + name + ', which has no @keyframes ' + name);
      });
    });
  });
  defined.filter(name => played.indexOf(name) === -1).forEach(name => problems.push('the keyframes "' + name + '" in ' + kitFile + ' are never played. Play them with a rule that starts with ' + kitGate + ', or delete them'));

  const index = fs.existsSync(path.join(dashboardFolder, 'index.html')) ? fs.readFileSync(path.join(dashboardFolder, 'index.html'), 'utf8') : '';
  if (index.indexOf('href="' + kitFile + '"') === -1) problems.push('index.html should link ' + kitFile);
  return problems;
}

const results = [];

function check(name, run) {
  const problems = [];
  const notes = [];
  try {
    const found = run(problems, notes);
    if (Array.isArray(found) && found !== problems) problems.push.apply(problems, found);
  } catch (error) {
    problems.push('the check stopped: ' + error.message);
  }
  results.push({ name: name, problems: problems, notes: notes });
}

async function main() {
  world.themes = (await load(path.join(themeFolder, 'registry.js'))).themes;
  world.overlays = (await load(path.join(overlayFolder, 'registry.js'))).overlays;
  world.required = await load(path.join(themeFolder, 'required.js'));
  world.config = await load(path.join(dashboardFolder, 'config.js'));
  world.variables = {};

  check('the registries list a file for every theme and overlay, and no other', checkRegistries);
  check('every theme sets every required variable, and nothing but variables', checkThemeFiles);
  check('every overlay sets accent colours only', checkOverlayFiles);
  check('the text and background pairs are all variables a theme must set', checkPairsExist);
  check('every text and background pair is at least ' + minimumContrast + ':1, for every theme and overlay', checkContrast);
  check('the Neon Prime files have no green (no hue from ' + greenFrom + ' to ' + greenTo + ' degrees)', checkNoGreen);
  check('keyframes are only in the shared motion files, and the kit moves only transform, opacity and line drawing, in full motion', checkKit);

  results.forEach(result => {
    console.log((result.problems.length === 0 ? 'PASS  ' : 'FAIL  ') + result.name);
    result.problems.forEach(problem => console.log('        ' + problem));
    result.notes.forEach(note => console.log('        ' + note));
  });

  const failed = results.filter(result => result.problems.length > 0).length;
  console.log('\n' + (results.length - failed) + ' of ' + results.length + ' checks passed.');
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch(error => {
  console.error('Could not run the theme checks: ' + error.message);
  process.exitCode = 1;
});
