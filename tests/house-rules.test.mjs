// Guards for the house rules that no other test holds. Each failure says what is wrong, in which file
// and on which line, and what to do instead. It reads files and runs nothing, so it takes a moment.
//
//   node tests/house-rules.test.mjs
//
//   1. a panel holds no animation code (timers, animate(), transition, animation, will-change)
//   2. the dashboard folder holds no framework, no build file and no dependency
//   3. no text under 44px in a panel, except the sizes the house rules name
//   4. no shadow, blend mode, 3D or video in the dashboard
//   5. a panel is a folder with panel.js and panel.css and a line in registry.js, and the other way round
//   6. no file that configures a code writing tool is kept in the repository
//
// Where a list below names an exception, the line says why. To add one, add a line with a reason a mentor accepts.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { dashboard, repo, read, relative, filesUnder, withoutComments, lineOf, trackedFiles, makeChecker } from './helpers/house-rules.mjs';

const { check, finish } = makeChecker('tests/house-rules.test.mjs');
const panelsFolder = path.join(dashboard, 'panels');
const isPanelFile = file => file.startsWith(panelsFolder + path.sep);
const dashboardFiles = filesUnder(dashboard, file => /\.(css|js|html)$/.test(file) && !relative(file).startsWith('dashboard/data/'));
const panelFiles = dashboardFiles.filter(isPanelFile);

// Every match of a pattern in a file, without its comments, as problems: { file, line, what }
function hits(files, pattern, describe) {
  const found = [];
  for (const file of files) {
    const text = withoutComments(file, read(file));
    for (const match of text.matchAll(pattern)) {
      const what = describe(match, file);
      if (what) found.push({ file: relative(file), line: lineOf(text, match.index), what: what });
    }
  }
  return found;
}

// 1. Animation code in a panel

check({
  name: 'a panel folder holds no animation code',
  why: 'Everything that moves goes through the shared frame module, so one place decides the speed and the calm mode.',
  instead: 'Delete the timer or the animation from the panel. Mark the piece with data-slat="item" (docs/adding-a-panel.md, step 4) so frame.js moves it, or add the effect to frame.js and frame.css.',
}, () => {
  const inScript = /\b(setTimeout|setInterval|requestAnimationFrame|cancelAnimationFrame)\s*\(|\.animate\s*\(|\.getAnimations\s*\(|new Animation\s*\(|\.style\.(animation|transition)\b/g;
  const inStyle = /@keyframes\b|(^|[;{\s])(animation(?:-[a-z-]+)?|transition(?:-[a-z-]+)?|will-change)\s*:\s*([^;}]*)/g;

  const scripts = hits(panelFiles.filter(file => file.endsWith('.js')), inScript, match => 'uses ' + match[0].replace(/\s*\($/, '') + ', which is animation code');
  const styles = hits(panelFiles.filter(file => file.endsWith('.css')), inStyle, match => {
    if (match[0].startsWith('@keyframes')) return 'has ' + match[0] + ', which is animation code';
    return match[3].trim() === 'none' ? '' : 'sets ' + match[2] + ', which is animation code';
  });
  return scripts.concat(styles);
});

// 2. No framework, no build step, no dependency in dashboard/

check({
  name: 'the dashboard folder has no framework, no build step and no dependency',
  why: 'The dashboard is plain HTML, CSS and JavaScript. Edit a file, refresh, see the change.',
  instead: 'Remove the file or the line. Write the few lines yourself, or ask a mentor first: a new dependency needs a yes before it is added.',
}, () => {
  const problems = [];
  const buildNames = /^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|tsconfig.*\.json|\.babelrc.*|babel\.config\..*|webpack\..*|vite\..*|rollup\..*|esbuild.*|parcel.*|gulpfile.*|gruntfile.*|postcss\..*|tailwind\..*|svelte\.config\..*|next\.config\..*|Makefile)$/i;
  const frameworkTypes = /\.(ts|tsx|jsx|vue|svelte|scss|sass|less|styl)$/;

  for (const file of filesUnder(dashboard)) {
    const name = path.basename(file);
    if (buildNames.test(name)) problems.push({ file: relative(file), what: 'is a build or package file (' + name + ')' });
    else if (frameworkTypes.test(name)) problems.push({ file: relative(file), what: 'is a ' + path.extname(name) + ' file, which needs a build step to run' });
  }
  if (fs.existsSync(path.join(dashboard, 'node_modules'))) problems.push({ file: 'dashboard/node_modules', what: 'exists, so something was installed here' });

  // dashboard/package.json only tells Node that the .js files are modules (tests/calendar-node.test.mjs)
  const manifest = path.join(dashboard, 'package.json');
  if (fs.existsSync(manifest)) {
    const keys = Object.keys(JSON.parse(read(manifest)));
    const extra = keys.filter(key => !['private', 'type', 'description'].includes(key));
    if (extra.length > 0) problems.push({ file: 'dashboard/package.json', what: 'has ' + extra.join(', ') + '. It may only hold private, type and description' });
  }

  // a page may not load code or styles from another address, and a script may import only a file of ours
  const page = path.join(dashboard, 'index.html');
  problems.push(...hits([page], /<(script|link)\b[^>]*\b(src|href)\s*=\s*["'](https?:)?\/\/[^"']*/g, match => 'loads ' + match[0].replace(/^[^"']*["']/, '') + ' from another address'));

  const imports = /\b(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;
  problems.push(...hits(dashboardFiles.filter(file => file.endsWith('.js')), imports, match => {
    const where = match[1] || match[2] || match[3];
    return /^(\.{1,2}\/|\/)/.test(where) ? '' : 'imports "' + where + '", which is not a file of ours';
  }));
  problems.push(...hits(dashboardFiles.filter(file => file.endsWith('.css')), /@import\s+(?:url\()?\s*["']?(https?:)?\/\/[^"')\s]*/g, match => 'imports a stylesheet from another address (' + match[0] + ')'));
  return problems;
});

// 3. No text under 44px in a panel

const tokens = read(path.join(dashboard, 'tokens.css'));
const sizeTokens = {};
for (const match of tokens.matchAll(/(--size-[a-z-]+)\s*:\s*([\d.]+)px/g)) sizeTokens[match[1]] = Number(match[2]);
const smallest = 44;

// The sizes under 44px that the house rules name (the house rules, Text), by stylesheet. Each says what the text is.
const allowedSmall = {
  'panels/countdown/panel.css': { 20: 'war clock label of Minimal', 24: 'war clock label of Minimal', 36: 'title and date line of a clock' },
  'panels/bar-banner/panel.css': { 20: 'war clock label of Minimal', 24: 'war clock label of Minimal', 36: 'title and date line of a clock' },
  'panels/bar-column/panel.css': { 36: 'title and date line of a clock' },
  'panels/monday-department/panel.css': { 30: 'Monday card chip', 36: 'label', 40: 'owner names' },
  'panels/monday-charts/panel.css': { 30: 'Monday card chip', 36: 'label', 40: 'owner names' },
  'panels/photo/panel.css': { 30: 'photo credit' },
  'panels/leadership/panel.css': { 36: 'third line of a people row' },
  'panels/team-leads/panel.css': { 36: 'third line of a people row' },
  'panels/roster/panel.css': { 36: 'third line of a people row' },
};

// Sizes under 44px that are in the panels today and are not on the list of the house rules. They are listed so that
// no new one slips in. Each should be raised to 44px or named in the house rules. Do not add to this list.
const knownTooSmall = {
  'panels/competition-forecast/panel.css': { 28: 'to be fixed', 30: 'to be fixed' },
  'panels/competition-matches/panel.css': { 30: 'to be fixed' },
  'panels/competition-preview/panel.css': { 28: 'to be fixed', 30: 'to be fixed' },
  'panels/competition-qualify/panel.css': { 30: 'to be fixed' },
  'panels/competition-recap/panel.css': { 28: 'to be fixed' },
  'panels/competition-timeline/panel.css': { 36: 'to be fixed' },
  'panels/frc-news/panel.css': { 30: 'to be fixed' },
};

check({
  name: 'no text in a panel is smaller than ' + smallest + 'px, except the sizes the house rules name',
  why: 'The screen is read from 20 feet away on a 70 inch TV. The smallest text is 44px (the house rules, Text).',
  instead: 'Use var(--size-label) (44px), var(--size-body) or var(--size-body-large). If the text really is one of the sizes the house rules name, add its size to allowedSmall in tests/house-rules.test.mjs with the reason.',
}, () => {
  const problems = [];
  const sheets = panelFiles.filter(file => file.endsWith('.css'));
  const scripts = panelFiles.filter(file => file.endsWith('.js'));
  const allowed = (file, size) => {
    const key = path.relative(dashboard, file).split(path.sep).join('/');
    return (allowedSmall[key] && allowedSmall[key][size]) || (knownTooSmall[key] && knownTooSmall[key][size]);
  };

  // font-size: 36px, font: 700 36px/32px var(--font-display) and font-size: var(--size-label)
  const declaration = /(^|[;{\s])(font-size|font)\s*:\s*([^;}]*)/g;
  const found = [];
  for (const file of sheets.concat(scripts)) {
    const text = withoutComments(file, read(file));
    for (const match of text.matchAll(declaration)) {
      const value = match[3].replace(/\/\s*[\d.]+(px|%|em)?/g, ' '); // the line height after a slash is not the size
      const first = value.match(/(?:^|\s)([\d.]+)(px|em|rem|%)(?=\s|$)|var\(\s*(--size-[a-z-]+)/);
      if (!first) continue;
      const line = lineOf(text, match.index);

      if (first[3]) {
        const size = sizeTokens[first[3]];
        if (size !== undefined && size < smallest && !allowed(file, size)) found.push({ file: relative(file), line: line, what: first[3] + ' is ' + size + 'px, under ' + smallest + 'px' });
      } else if (first[2] !== 'px') {
        found.push({ file: relative(file), line: line, what: 'sizes the text in ' + first[2] + ' (' + first[0].trim() + '), so the test cannot tell how big it is. Write it in px or use a var(--size-...) token' });
      } else if (Number(first[1]) < smallest && !allowed(file, Number(first[1]))) {
        found.push({ file: relative(file), line: line, what: 'sets text to ' + first[1] + 'px, under ' + smallest + 'px' });
      }
    }
  }
  problems.push(...found);
  return problems;
});

// 4. No shadow, blend mode, 3D or video

// Files that already use 3D, for the slats, the pieces, the hidden transitions, the name effect and the logo
// (docs/adding-a-panel.md, "Do not"). A panel never does. Do not add to this list.
const mayUse3d = [
  'dashboard/reform.css', 'dashboard/frame.css', 'dashboard/core/reform-hawk.js', 'dashboard/core/sanity-query.js',
  'dashboard/core/swap-plan-reform.js', 'dashboard/core/reform-plan.js', 'dashboard/core/reform-draw.js', 'dashboard/core/transitions.js',
  'dashboard/core/swap-plan-hawk.js', 'dashboard/styles/retro/transitions.js', 'dashboard/styles/cybertron/transitions.js',
  'dashboard/styles/cybertron/reform-kit.css',
];

check({
  name: 'the dashboard uses no shadow, blend mode, 3D or video',
  why: 'The 2011 Mac Mini cannot paint them. Animation uses only transform, opacity and line drawing (the house rules, Dashboard code).',
  instead: 'Draw a shadow as a dark copy of the shape moved a few pixels (as the frame does), use a plain color, and keep movement flat. Blur, glow and filters are checked by tests/graphics.test.mjs.',
}, () => {
  const shadows = /(^|[;{\s])(text-shadow|box-shadow|mix-blend-mode|background-blend-mode)\s*:\s*([^;}]*)/g;
  const threeD = /\b(perspective|translateZ|translate3d|rotateX|rotateY|rotate3d|scale3d|matrix3d|preserve-3d)\b/g;
  const video = /<\s*video\b|\.(mp4|webm|mov|m4v)\b|new\s+Video\s*\(/g;

  const problems = hits(dashboardFiles, shadows, match => {
    // a hard shadow (an offset copy with no blur) is a dark copy moved a few pixels, which the frame does too
    if (match[2] === 'text-shadow' || match[2] === 'box-shadow') {
      const parts = match[3].split(/,(?![^(]*\))/).map(part => part.trim());
      const hard = parts.every(part => /^(inset\s+)?-?[\d.]+(px)?\s+-?[\d.]+(px)?\s+0(px)?(\s|$)/.test(part));
      return hard ? '' : 'sets ' + match[2] + ' with a blur: ' + match[3].trim().slice(0, 40);
    }
    return 'sets ' + match[2] + ': ' + match[3].trim().slice(0, 40);
  });
  problems.push(...hits(dashboardFiles, threeD, (match, file) => (isPanelFile(file) || !mayUse3d.includes(relative(file)) ? 'uses ' + match[0] + ' (3D)' : '')));
  problems.push(...hits(dashboardFiles, video, match => 'refers to video (' + match[0].trim() + ')'));
  return problems;
});

// 5. A panel is a folder, a script, a stylesheet and a line in the registry

check({
  name: 'every panel folder has panel.js, panel.css and a line in registry.js, and every line has its folder',
  why: 'The page loads a panel by its id: the folder, the two files and the registry line must agree (docs/adding-a-panel.md).',
  instead: 'Make the missing file or folder, add the line { id: ..., region: ..., topic: ... } to dashboard/registry.js, or delete the leftover. A panel exports a function mount(host, content).',
}, async () => {
  const problems = [];
  const registry = (await import(pathToFileURL(path.join(dashboard, 'registry.js')).href)).panels;
  const ids = registry.map(panel => panel.id);
  const folders = fs.readdirSync(panelsFolder, { withFileTypes: true });

  for (const entry of folders) {
    const where = 'dashboard/panels/' + entry.name;
    // Finder leaves .DS_Store files in folders it has opened; they are not part of the repository
    if (entry.name === '.DS_Store') continue;
    if (!entry.isDirectory()) {
      problems.push({ file: where, what: 'is a file. Panels are folders, one for each panel' });
      continue;
    }
    for (const name of ['panel.js', 'panel.css']) {
      if (!fs.existsSync(path.join(panelsFolder, entry.name, name))) problems.push({ file: where, what: 'has no ' + name });
    }
    for (const other of fs.readdirSync(path.join(panelsFolder, entry.name))) {
      if (other !== 'panel.js' && other !== 'panel.css') problems.push({ file: where + '/' + other, what: 'should not be here. A panel folder holds only panel.js and panel.css' });
    }
    if (!ids.includes(entry.name)) problems.push({ file: where, what: 'is not in dashboard/registry.js, so the screen never loads it' });

    const script = path.join(panelsFolder, entry.name, 'panel.js');
    if (fs.existsSync(script) && !/export\s+(async\s+)?(function|const)\s+mount\b|export\s*\{[^}]*\bmount\b/.test(read(script))) {
      problems.push({ file: relative(script), what: 'does not export mount. Write export function mount(host, content) { ... }' });
    }
  }

  for (const id of ids) {
    if (!fs.existsSync(path.join(panelsFolder, id))) problems.push({ file: 'dashboard/registry.js', what: 'lists the panel "' + id + '" but dashboard/panels/' + id + ' does not exist' });
  }
  ids.filter((id, place) => ids.indexOf(id) !== place).forEach(id => problems.push({ file: 'dashboard/registry.js', what: 'lists the panel "' + id + '" twice' }));
  return problems;
});

// 6. No file that configures a code writing tool in the repository

check({
  name: 'no configuration file of a code writing tool is kept in the repository',
  why: 'The repository holds our own plain code and nothing that names a tool (the house rules, Rules).',
  instead: 'Remove the file from git (git rm --cached <file>) and keep it outside this folder. tools/sweep.sh looks for the words inside files.',
}, () => {
  // built from pieces, so that tools/sweep.sh does not find the tool names in this file
  const tool = ['cla', 'ude'].join('');
  const others = ['cur' + 'sor', 'wind' + 'surf', 'ai' + 'der', 'contin' + 'ue', 'code' + 'ium', 'copi' + 'lot', 'gem' + 'ini'];
  const names = new RegExp('(^|/)(\\.' + tool + '|' + tool + '\\.md|agents\\.md|\\.mcp\\.json|\\.(' + others.join('|') + ')[^/]*|' + others[5] + '-instructions\\.md)(/|$)', 'i');
  return trackedFiles().filter(file => names.test(file)).map(file => ({ file: file, what: 'is the configuration of a code writing tool' }));
});

await finish();
