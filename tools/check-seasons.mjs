// Checks every seasonal pack in dashboard/seasons/ without a browser. It fails
// when
//   - an overlay says it has decorations and its pack file is missing, or a pack
//     file has no overlay that says so
//   - a pack is not in the data format (docs/seasonal-packs.md): a piece names a
//     shape that is not listed, a motion or a zone that does not exist, or sits
//     outside its zone's rectangle when it rests, or the pack has too many pieces
//     or too many that move
//   - a finished pack has no header mark, or a mark bigger than the box measured
//     for it (markBox in core/marks.js), or fewer than 8 or more than 14 pieces in
//     the over layer, or an over piece that is too big, too solid, too quick or
//     not moving (docs/seasonal-packs.md, "The over layer"). The six packs in
//     stillToDo are not finished yet and are the only ones excused
//   - a pack file, motion.css or season.css uses the words filter, blur, shadow
//     or glow, or draws a gradient, a script, a style, or a picture from a file
//   - a keyframe, a transition or any animation code is anywhere but motion.css
//   - motion.css animates anything but transform, opacity and stroke-dashoffset,
//     or plays a motion outside full motion (so calm and none would move)
//   - the motions in core/season.js and in motion.css are not the same list, or
//     one is not described at the top of motion.css
//   - the zones overlap each other or leave the screen
//
//   node tools/check-seasons.mjs
//
// The checks that look at a pack use the same functions the screen uses
// (dashboard/core/season.js), so a pack that passes here draws.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const seasonsFolder = path.join(dashboardFolder, 'seasons');
const motionFile = path.join(seasonsFolder, 'motion.css');
const layerFile = path.join(seasonsFolder, 'season.css');
const docsFile = path.join(dashboardFolder, '..', 'docs', 'seasonal-packs.md');

// The width of the double slash that a mark replaces (core/marks.js)
const slashWidth = 54;

// The packs that are not finished yet. Only these are excused from having a header
// mark and at least 8 over pieces: every other pack except the placeholder
// "example" must have both. Whoever finishes a pack takes its id out of this list.
// When the list is empty, every pack is held to the rules and nothing is excused.
const stillToDo = [];

// What motion.css may animate
const allowedProperties = ['transform', 'opacity', 'stroke-dashoffset'];

// Words a pack, motion.css and season.css may not use, in code. Comments may say them.
const forbiddenWords = ['filter', 'blur', 'shadow', 'glow'];

// Things a shape's svg may not hold
const forbiddenMarkup = [
  { pattern: /<\s*(script|style|foreignObject|image|animate\w*|set|a)\b/i, words: 'a script, a style, a picture, a link or an svg animation' },
  { pattern: /<\s*(linearGradient|radialGradient|pattern|mask|clipPath)\b/i, words: 'a gradient, a pattern, a mask or a clip. A pack is flat shapes' },
  { pattern: /\son[a-z]+\s*=/i, words: 'an event handler' },
  { pattern: /href\s*=/i, words: 'a link' },
];

// Words that mean animation code. A pack and season.js hold none.
const animationWords = [
  { pattern: /@keyframes/, words: '@keyframes' },
  { pattern: /(^|[^-\w])animation(-[a-z]+)?\s*:/, words: 'an animation property' },
  { pattern: /(^|[^-\w])transition(-[a-z]+)?\s*:/, words: 'a transition' },
  { pattern: /requestAnimationFrame|setInterval|setTimeout|\.animate\s*\(/, words: 'a timer or the animate function' },
];

function load(file) {
  return import(pathToFileURL(file).href);
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function relative(file) {
  return path.relative(path.join(dashboardFolder, '..'), file);
}

// Comments are dropped, so a comment may say what a file does not do
function withoutCssComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

function withoutJsComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
}

// CSS reading

// Every @keyframes with its name and the properties its steps set
function keyframesIn(css) {
  const text = withoutCssComments(css);
  const found = [];
  const start = /@keyframes\s+([\w-]+)\s*\{/g;
  let match = start.exec(text);

  while (match) {
    let depth = 1;
    let index = start.lastIndex;
    while (depth > 0 && index < text.length) {
      if (text[index] === '{') depth += 1;
      if (text[index] === '}') depth -= 1;
      index += 1;
    }

    const body = text.slice(start.lastIndex, index - 1);
    const properties = [];
    const step = /\{([^{}]*)\}/g;
    let inner = step.exec(body);
    while (inner) {
      inner[1].split(';').map(item => item.trim()).filter(Boolean).forEach(item => properties.push(item.slice(0, item.indexOf(':')).trim()));
      inner = step.exec(body);
    }

    found.push({ name: match[1], properties: properties });
    start.lastIndex = index;
    match = start.exec(text);
  }
  return found;
}

// Every ordinary rule, outside the keyframes: its selectors and its declarations
function rulesIn(css) {
  const text = withoutCssComments(css).replace(/@keyframes\s+[\w-]+\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const rules = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  let match = pattern.exec(text);

  while (match) {
    rules.push({
      selectors: match[1].split(',').map(item => item.trim()),
      declarations: match[2].split(';').map(item => item.trim()).filter(Boolean).map(item => {
        const colon = item.indexOf(':');
        return { name: item.slice(0, colon).trim(), value: item.slice(colon + 1).trim() };
      }),
    });
    match = pattern.exec(text);
  }
  return rules;
}

function wordProblems(label, code) {
  const problems = [];
  forbiddenWords.filter(word => new RegExp(word, 'i').test(code)).forEach(word => {
    problems.push(label + ' uses the word "' + word + '". Filters, blur, glow and shadows are not allowed in a pack. If it is a JavaScript .filter(), use a loop instead');
  });
  return problems;
}

// The files

const world = {};

function packFiles() {
  return fs.readdirSync(seasonsFolder).filter(name => name.endsWith('.js')).map(name => name.slice(0, -3));
}

function checkFilesMatchRegistry() {
  const problems = [];
  const decorated = world.overlays.filter(overlay => overlay.decorations === true).map(overlay => overlay.id);
  const files = packFiles();

  decorated.filter(id => files.indexOf(id) === -1).forEach(id => problems.push('the overlay "' + id + '" says decorations: true in its registry entry, but dashboard/seasons/' + id + '.js does not exist'));
  files.filter(id => decorated.indexOf(id) === -1).forEach(id => {
    const entry = world.overlays.filter(overlay => overlay.id === id)[0];
    problems.push('dashboard/seasons/' + id + '.js has no overlay that says decorations: true. ' + (entry ? 'Set decorations: true on "' + id + '" in dashboard/themes/overlays/registry.js (and in studio/themes.js)' : 'Add the overlay to the registry, or delete the file'));
  });
  world.overlays.forEach(overlay => {
    if (typeof overlay.decorations !== 'boolean') problems.push('the overlay "' + overlay.id + '" should say decorations: true or decorations: false in the registry');
  });

  ['motion.css', 'season.css'].filter(name => !fs.existsSync(path.join(seasonsFolder, name))).forEach(name => problems.push('dashboard/seasons/' + name + ' does not exist'));

  const index = read(path.join(dashboardFolder, 'index.html'));
  ['seasons/season.css', 'seasons/motion.css'].filter(href => index.indexOf('href="' + href + '"') === -1).forEach(href => problems.push('index.html should link ' + href));
  return problems;
}

// Each pack is loaded and checked with the screen's own functions
async function checkPacks() {
  const problems = [];
  const decorated = world.overlays.filter(overlay => overlay.decorations === true).map(overlay => overlay.id);

  for (const id of decorated) {
    const file = path.join(seasonsFolder, id + '.js');
    if (!fs.existsSync(file)) continue; // said by the check of the files

    let pack = null;
    try {
      pack = (await load(file)).pack;
    } catch (error) {
      problems.push('dashboard/seasons/' + id + '.js could not be loaded: ' + error.message);
      continue;
    }
    if (!pack) {
      problems.push('dashboard/seasons/' + id + '.js should export a pack: export const pack = { shapes, scene, back, front }');
      continue;
    }

    world.packs[id] = pack;
    world.season.packProblems(pack).forEach(text => problems.push(id + ': ' + text));
    Object.keys(pack.shapes || {}).forEach(name => {
      const list = [].concat(pack.back || [], pack.front || [], pack.over || []);
      if (!list.some(piece => piece && piece.shape === name)) world.notes.push(id + ': the shape "' + name + '" is not used by any piece');
    });
  }
  return problems;
}

// A finished pack has a header mark and 8 to 14 over pieces. packProblems (in
// checkPacks) already holds every pack, finished or not, to the size of the mark
// and to the rules of each over piece and the most pieces; this adds the least.
function checkMarkAndOver() {
  const problems = [];
  const rules = world.season.overRules;

  stillToDo.filter(id => !world.overlays.some(overlay => overlay.id === id && overlay.decorations === true))
    .forEach(id => problems.push('stillToDo lists "' + id + '", which is not a pack. Take it out of the list at the top of tools/check-seasons.mjs'));

  Object.keys(world.packs).forEach(id => {
    const pack = world.packs[id];
    const over = Array.isArray(pack.over) ? pack.over : [];
    const hasMark = pack.mark !== undefined && pack.mark !== null;

    if (stillToDo.indexOf(id) !== -1) {
      if (hasMark && over.length >= rules.leastPieces) world.notes.push(id + ' has a mark and ' + over.length + ' over pieces: take it out of stillToDo at the top of tools/check-seasons.mjs');
      return;
    }

    if (!hasMark) problems.push(id + ': the pack has no mark. Add mark: { viewBox, markup }, the picture that replaces the slashes in every panel header (docs/seasonal-packs.md, "The header mark")');
    if (over.length < rules.leastPieces) problems.push(id + ': the pack has ' + over.length + ' over pieces, and a finished pack has at least ' + rules.leastPieces + ' (docs/seasonal-packs.md, "The over layer")');
  });

  // A mark may be wider than the slashes it replaces, by hanging out to the right
  // over the header's empty padding, so the text beside it stays where it is
  const box = world.marks.markBox;
  const hang = box.width - slashWidth;
  const rule = rulesIn(read(path.join(dashboardFolder, 'base.css'))).filter(item => item.selectors.indexOf('.pack-mark') !== -1)[0];
  const margin = rule ? rule.declarations.filter(item => item.name === 'margin-right')[0] : null;
  if (hang > 0 && (!margin || margin.value !== '-' + hang + 'px')) {
    problems.push('dashboard/base.css: .pack-mark should set margin-right: -' + hang + 'px. The box for a mark is ' + hang + ' px wider than the ' + slashWidth + ' px slashes, and the extra hangs out to the right so that the text beside the mark stays where it is');
  }

  // The box is written in the docs too, so whoever draws a mark can find it
  const docs = fs.existsSync(docsFile) ? read(docsFile) : '';
  if (!docs.includes(box.width + ' x ' + box.height)) problems.push('docs/seasonal-packs.md should say that the box for a mark is ' + box.width + ' x ' + box.height + ' pixels, as markBox in dashboard/core/marks.js does');
  return problems;
}

function checkShapeMarkup() {
  const problems = [];
  Object.keys(world.packs).forEach(id => {
    const pack = world.packs[id];
    const all = Object.keys(pack.shapes || {}).map(name => ({ where: 'the shape "' + name + '"', markup: pack.shapes[name] && pack.shapes[name].markup }));
    if (pack.scene) all.push({ where: 'the scene', markup: pack.scene.markup });
    if (pack.mark) all.push({ where: 'the mark', markup: pack.mark.markup });

    all.filter(item => typeof item.markup === 'string').forEach(item => {
      forbiddenMarkup.filter(rule => rule.pattern.test(item.markup)).forEach(rule => problems.push(id + ': ' + item.where + ' holds ' + rule.words));
      wordProblems(id + ': ' + item.where, item.markup).forEach(text => problems.push(text));
    });
  });
  return problems;
}

function checkPackFilesAreData() {
  const problems = [];
  packFiles().forEach(id => {
    const file = path.join(seasonsFolder, id + '.js');
    const code = withoutJsComments(read(file));

    wordProblems('dashboard/seasons/' + id + '.js', code).forEach(text => problems.push(text));
    animationWords.filter(rule => rule.pattern.test(code)).forEach(rule => problems.push('dashboard/seasons/' + id + '.js has ' + rule.words + '. A pack holds no animation: name a motion from dashboard/seasons/motion.css instead'));
  });

  const season = withoutJsComments(read(path.join(dashboardFolder, 'core', 'season.js')));
  animationWords.filter(rule => rule.pattern.test(season)).forEach(rule => problems.push('dashboard/core/season.js has ' + rule.words + '. All the animation is in dashboard/seasons/motion.css'));

  const layer = withoutCssComments(read(layerFile));
  if (/@keyframes/.test(layer)) problems.push('dashboard/seasons/season.css has @keyframes. Every keyframe belongs in dashboard/seasons/motion.css');
  rulesIn(read(layerFile)).forEach(rule => rule.declarations
    .filter(item => /^(animation|transition)/.test(item.name))
    .forEach(item => problems.push('dashboard/seasons/season.css sets ' + item.name + ' on ' + rule.selectors.join(', ') + '. Animation belongs in dashboard/seasons/motion.css')));
  wordProblems('dashboard/seasons/season.css', layer).forEach(text => problems.push(text));

  // Both layers let every click through
  const layerRule = rulesIn(read(layerFile)).filter(rule => rule.selectors.indexOf('.season-layer') !== -1)[0];
  if (!layerRule || !layerRule.declarations.some(item => item.name === 'pointer-events' && item.value === 'none')) problems.push('dashboard/seasons/season.css: .season-layer should set pointer-events: none');
  if (!layerRule || !layerRule.declarations.some(item => item.name === 'overflow' && item.value === 'hidden')) problems.push('dashboard/seasons/season.css: .season-layer should set overflow: hidden');
  // The over layer is drawn in full motion only: calm and none motion would leave its pieces sitting on words
  const hidden = rulesIn(read(layerFile)).filter(rule => rule.selectors.indexOf('.season-over') !== -1)[0];
  const shownInFull = rulesIn(read(layerFile)).filter(rule => rule.selectors.indexOf('html[data-motion="full"] .season-over') !== -1)[0];
  if (!hidden || !hidden.declarations.some(item => item.name === 'display' && item.value === 'none')) problems.push('dashboard/seasons/season.css: .season-over should set display: none');
  if (!shownInFull || !shownInFull.declarations.some(item => item.name === 'display' && item.value === 'block')) problems.push('dashboard/seasons/season.css: html[data-motion="full"] .season-over should set display: block, so that only full motion draws the over layer');
  const zoneRule = rulesIn(read(layerFile)).filter(rule => rule.selectors.indexOf('.season-zone') !== -1)[0];
  if (!zoneRule || !zoneRule.declarations.some(item => item.name === 'overflow' && item.value === 'hidden')) problems.push('dashboard/seasons/season.css: .season-zone should set overflow: hidden, because a zone is what keeps a piece off the text');
  return problems;
}

function checkMotionCss() {
  const problems = [];
  const css = read(motionFile);
  const text = withoutCssComments(css);

  wordProblems('dashboard/seasons/motion.css', text).forEach(item => problems.push(item));
  if (/transition\s*:|transition-/.test(text)) problems.push('dashboard/seasons/motion.css has a transition. Use keyframes, and only under html[data-motion="full"]');

  const frames = keyframesIn(css);
  frames.forEach(frame => {
    frame.properties.filter(name => allowedProperties.indexOf(name) === -1).forEach(name => {
      problems.push('the keyframes "' + frame.name + '" in motion.css animate ' + name + '. Only ' + allowedProperties.join(', ') + ' may be animated');
    });
    if (!/^season-[a-z]+$/.test(frame.name)) problems.push('the keyframes "' + frame.name + '" in motion.css should be named season-<name>');
  });

  const rules = rulesIn(css);
  const playing = rules.filter(rule => rule.declarations.some(item => /^animation/.test(item.name) && item.name !== 'animation-play-state'));
  if (playing.length === 0) problems.push('motion.css has no rule that plays a motion');

  // Calm and none motion never play any of it
  playing.forEach(rule => rule.selectors.filter(selector => selector.indexOf('html[data-motion="full"]') !== 0).forEach(selector => {
    problems.push('motion.css plays an animation with the selector "' + selector + '". Start it with html[data-motion="full"], so calm and none motion stay still');
  }));

  // The motions: the same list in core/season.js and in motion.css, each described at the top
  const motions = world.season.motions;
  const top = css.slice(0, css.indexOf('*/'));
  motions.forEach(name => {
    if (!frames.some(frame => frame.name === 'season-' + name)) problems.push('the motion "' + name + '" is in core/season.js but motion.css has no @keyframes season-' + name);

    const rule = rules.filter(item => item.selectors.some(selector => selector === 'html[data-motion="full"] .season-piece[data-move="' + name + '"]'))[0];
    const names = rule ? rule.declarations.filter(item => item.name === 'animation-name').map(item => item.value) : [];
    if (names.join() !== 'season-' + name) problems.push('the motion "' + name + '" has no rule in motion.css that sets animation-name: season-' + name);

    if (!new RegExp('\\n\\s+' + name + '\\s{2,}\\S').test(top)) problems.push('the motion "' + name + '" is not described in the list at the top of motion.css. Each motion has one line there');
  });

  const extra = ['out', 'in'];
  frames.filter(frame => motions.indexOf(frame.name.replace(/^season-/, '')) === -1 && extra.indexOf(frame.name.replace(/^season-/, '')) === -1)
    .forEach(frame => problems.push('motion.css has @keyframes ' + frame.name + ', which is not a motion in core/season.js. Add its name to motions there, or delete the keyframes'));
  return problems;
}

function checkZones() {
  const problems = [];
  const zones = world.season.zones;
  const names = Object.keys(zones);

  names.forEach(name => {
    const zone = zones[name];
    if (!/^[a-z][a-z0-9-]*$/.test(name)) problems.push('the zone name "' + name + '" should be lowercase letters, digits and dashes');
    if (![zone.x, zone.y, zone.width, zone.height].every(Number.isFinite) || zone.width <= 0 || zone.height <= 0) return problems.push('the zone "' + name + '" should have a numeric x, y, width and height, with a size above 0');
    if (zone.x < 0 || zone.y < 0 || zone.x + zone.width > 1920 || zone.y + zone.height > 1080) problems.push('the zone "' + name + '" leaves the 1920 by 1080 screen');
  });

  names.forEach((first, index) => names.slice(index + 1).forEach(second => {
    const a = zones[first];
    const b = zones[second];
    const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    if (overlap) problems.push('the zones "' + first + '" and "' + second + '" overlap. Each place on the screen belongs to one zone');
  }));

  if (!zones[world.season.sceneZone]) problems.push('sceneZone is "' + world.season.sceneZone + '", which is not a zone');
  if (world.season.motions.length !== new Set(world.season.motions).size) problems.push('a motion is listed twice in core/season.js');
  return problems;
}

const results = [];

async function check(name, run) {
  const problems = [];
  world.notes = [];
  try {
    const found = await run();
    if (Array.isArray(found)) problems.push.apply(problems, found);
  } catch (error) {
    problems.push('the check stopped: ' + error.message);
  }
  results.push({ name: name, problems: problems, notes: world.notes });
}

async function main() {
  world.overlays = (await load(path.join(dashboardFolder, 'themes', 'overlays', 'registry.js'))).overlays;
  world.season = await load(path.join(dashboardFolder, 'core', 'season.js'));
  world.marks = await load(path.join(dashboardFolder, 'core', 'marks.js'));
  world.packs = {};

  await check('the registry and the pack files agree', checkFilesMatchRegistry);
  await check('the zones are real rectangles of the screen that do not overlap', checkZones);
  await check('every pack is in the data format, and every piece fits its zone at rest', checkPacks);
  await check('every finished pack has a header mark and 8 to 14 over pieces', checkMarkAndOver);
  await check('no shape holds a filter, a gradient, a script or a link', checkShapeMarkup);
  await check('no pack, and not core/season.js, holds any animation', checkPackFilesAreData);
  await check('motion.css animates only transform, opacity and line drawing, and only in full motion', checkMotionCss);

  results.forEach(result => {
    console.log((result.problems.length === 0 ? 'PASS  ' : 'FAIL  ') + result.name);
    result.problems.forEach(problem => console.log('        ' + problem));
    result.notes.forEach(note => console.log('        note: ' + note));
  });

  const failed = results.filter(result => result.problems.length > 0).length;
  console.log('\n' + (results.length - failed) + ' of ' + results.length + ' checks passed.');
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch(error => {
  console.error('Could not run the season checks: ' + error.message);
  process.exitCode = 1;
});
