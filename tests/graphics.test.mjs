// Tests for the graphics of the dashboard: the svg files and the svg in the code, and where a color may be written.
//
//   - every svg has a viewBox, no filter or blur, no picture inside it of more than 50 KB, and ids that are
//     unique across the page and start with the word of their file
//   - the hawk, the war clock plate and the shapes of the frames are written once and reused with <use>
//   - a color is written in tokens.css, in the tokens.css of a theme, in a theme file, in a seasonal pack
//     and in the built-in team, and nowhere else
//
//   node tests/graphics.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dashboard = path.join(root, 'dashboard');

function filesUnder(folder, keep) {
  return fs.readdirSync(folder, { withFileTypes: true }).reduce((found, entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) return entry.name === 'fonts' ? found : found.concat(filesUnder(full, keep));
    return keep(full) ? found.concat(full) : found;
  }, []);
}

const relative = file => path.relative(dashboard, file).split(path.sep).join('/');
const read = file => fs.readFileSync(file, 'utf8');
const code = filesUnder(dashboard, file => /\.(css|js|html)$/.test(file));
const svgFiles = filesUnder(dashboard, file => file.endsWith('.svg'));
const isSample = file => relative(file).startsWith('data/');

// Comments say things like "no blur" and name old colors, so they are cut out before a rule is applied
function withoutComments(file, text) {
  if (file.endsWith('.css')) return text.replace(/\/\*[\s\S]*?\*\//g, '');
  if (file.endsWith('.html')) return text.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

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

// The svg files

await test('the dashboard has svg files, and every one has a viewBox', () => {
  assert.ok(svgFiles.length >= 10, 'the search found the svg files');
  svgFiles.forEach(file => assert.ok(/<svg[^>]*\sviewBox="[^"]+"/.test(read(file)), relative(file) + ' has no viewBox'));
});

await test('no svg file and no svg in the code has a filter, a blur or a shadow', () => {
  const pattern = /<\s*filter\b|<\s*fe[A-Z]\w*|\bfilter\s*=\s*["']|(^|[\s;{(])(-webkit-)?(backdrop-)?filter\s*:|\bblur\(|drop-shadow\(|feGaussianBlur/;
  const problems = [];

  svgFiles.concat(code).forEach(file => {
    const text = withoutComments(file, read(file));
    const found = pattern.exec(text);
    if (found) problems.push(relative(file) + ':' + lineOf(text, found.index) + ' has ' + found[0].trim());
  });
  assert.deepEqual(problems, []);
});

await test('no picture of more than 50 KB is written into an svg or into the code', () => {
  const problems = [];
  svgFiles.concat(code).forEach(file => {
    for (const match of read(file).matchAll(/data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)/g)) {
      const bytes = Math.floor(match[1].length * 3 / 4);
      if (bytes > 50 * 1024) problems.push(relative(file) + ' holds a picture of ' + Math.round(bytes / 1024) + ' KB');
    }
  });
  assert.deepEqual(problems, []);
});

// An svg file with many shapes may be lettering drawn as shapes. Live text is used where text can be text; these
// are logos, and each says why it is shapes. The banner puts the wordmark in an img with alt text.
const drawnLettering = {
  'assets/teletraan-wordmark.svg': 'the Teletraan I wordmark: its letters are the shapes of the logo, not a font',
};

test('an svg file with many shapes is on the list of drawn lettering, or it is not lettering', () => {
  const problems = [];
  svgFiles.filter(file => !isSample(file)).forEach(file => {
    const shapes = (read(file).match(/<(path|polygon)\b/g) || []).length;
    if (shapes >= 6 && !drawnLettering[relative(file)]) problems.push(relative(file) + ' has ' + shapes + ' shapes. If they are letters, use live text; if they are a logo, add the file to drawnLettering with the reason');
  });
  assert.deepEqual(problems, []);
  Object.keys(drawnLettering).forEach(name => assert.ok(fs.existsSync(path.join(dashboard, name)), name + ' is listed and gone'));
  assert.ok(/alt="Teletraan I"/.test(read(path.join(dashboard, 'panels/banner/panel.js'))), 'the banner gives the wordmark its text');
});

// An svg that draws has a viewBox. These do not, and each says why.
const withoutViewBox = [
  ['index.html', 'class="metal-defs"', 'only holds shapes for <use>'],
  ['core/season-draw.js', 'class="season-defs"', 'only holds symbols'],
  ['core/season-draw.js', 'size + dim', 'holds one <use> of a symbol, which has its own viewBox'],
  ['core/subthemes-layer.js', 'class="subtheme-defs"', 'only holds symbols'],
  ['core/subthemes-layer.js', 'class="subtheme-sprite"', 'holds one <use> of a symbol, which has its own viewBox'],
  ['panels/monday-timeline/panel.js', 'class="bar bar-', 'sits inside the chart svg, placed with x and y'],
];

await test('every svg in the code has a viewBox, except the ones that only hold shapes or one symbol', () => {
  const problems = [];
  code.forEach(file => {
    const text = read(file);
    for (const match of text.matchAll(/<svg\b[^>]*/g)) {
      if (/viewBox/.test(match[0])) continue;

      const opener = match[0] + text.slice(match.index + match[0].length, match.index + match[0].length + 40);
      const names = withoutViewBox.filter(item => item[0] === relative(file) && opener.includes(item[1]));
      if (names.length === 0) problems.push(relative(file) + ':' + lineOf(text, match.index) + ' has an svg with no viewBox');
    }
  });
  assert.deepEqual(problems, []);
});

// Ids

// The word each family of ids in the hidden defs of index.html starts with
const families = ['edge', 'armor', 'wear', 'screw', 'bolt', 'logo', 'person', 'metal', 'hawk'];

await test('the ids written in index.html and in the svg files are unique, and start with the word of their family or file', () => {
  const page = read(path.join(dashboard, 'index.html'));
  const seen = new Map();
  const problems = [];
  const note = (id, where) => {
    if (seen.has(id)) problems.push('the id "' + id + '" is in ' + seen.get(id) + ' and in ' + where);
    seen.set(id, where);
  };

  const defs = page.slice(page.indexOf('<svg class="metal-defs"'), page.indexOf('</svg>', page.indexOf('<g id="metal-shapes">')));
  for (const match of defs.matchAll(/\sid="([^"]+)"/g)) {
    note(match[1], 'index.html');
    if (!families.includes(match[1].split('-')[0])) problems.push('the id "' + match[1] + '" in index.html starts with no word of the families: ' + families.join(', '));
  }
  for (const match of page.matchAll(/\sid="([^"]+)"/g)) if (!defs.includes(match[0])) note(match[1], 'index.html');

  svgFiles.filter(file => !isSample(file)).forEach(file => {
    const stem = path.basename(file, '.svg');
    for (const match of read(file).matchAll(/\sid="([^"]+)"/g)) {
      note(match[1], relative(file));
      if (!match[1].startsWith(stem + '-')) problems.push('the id "' + match[1] + '" in ' + relative(file) + ' should start with ' + stem + '-');
    }
  });
  svgFiles.filter(isSample).forEach(file => {
    for (const match of read(file).matchAll(/\sid="([^"]+)"/g)) note(match[1], relative(file));
  });
  assert.deepEqual(problems, []);
});

await test('an id written in a script starts with a word of its own, so two scripts never write the same id', () => {
  // The scripts of one family may share a word: the frames are all in the plate scripts
  const ownerOf = file => {
    const name = path.basename(file, '.js');
    return name.startsWith('plate') ? 'plate' : name;
  };
  const words = new Map();
  const problems = [];

  code.filter(file => file.endsWith('.js') && !relative(file).startsWith('seasons/')).forEach(file => {
    const text = withoutComments(file, read(file));
    for (const match of text.matchAll(/\sid="([A-Za-z][\w-]*)/g)) {
      const word = match[1].split('-')[0];
      if (!words.has(word)) words.set(word, new Set());
      words.get(word).add(ownerOf(file));
    }
    for (const match of text.matchAll(/define\(\s*['"`]([A-Za-z][\w-]*)/g)) {
      const word = match[1].split('-')[0];
      if (!words.has(word)) words.set(word, new Set());
      words.get(word).add(ownerOf(file));
    }
  });
  words.forEach((owners, word) => {
    if (owners.size > 1) problems.push('the id word "' + word + '" is written by ' + [...owners].join(' and '));
  });
  assert.deepEqual(problems, []);
});

// Drawn once

await test('a shape of an svg is written once: no list of points is written twice in the code', () => {
  const lists = new Map();
  const problems = [];
  const pattern = /(["'`])((?:-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?\s){3,}-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?)\1/g;

  code.filter(file => !relative(file).startsWith('seasons/') && !relative(file).startsWith('data/')).forEach(file => {
    const text = read(file);
    for (const match of text.matchAll(pattern)) {
      const where = relative(file) + ':' + lineOf(text, match.index);
      if (lists.has(match[2])) problems.push('the points ' + match[2].slice(0, 40) + '... are in ' + lists.get(match[2]) + ' and in ' + where);
      lists.set(match[2], where);
    }
  });
  assert.deepEqual(problems, []);
});

await test('the hawk is written once in the defs, and the logo, the plates of the swap and the night screen point at it', async () => {
  const defined = [];
  const world = {
    getElementById: id => {
      if (id === 'metal-shapes') return { insertAdjacentHTML: (where, markup) => defined.push(markup) };
      return defined.some(markup => markup.includes('id="' + id + '"')) ? {} : null;
    },
  };
  globalThis.document = world;
  try {
    const logo = await import(pathToFileURL(path.join(dashboard, 'core/logo.js')).href);
    logo.defineHawk();
    logo.defineHawk();

    const ids = defined.map(markup => /id="([^"]+)"/.exec(markup)[1]);
    assert.ok(ids.length >= 20, 'the hawk has its shapes');
    assert.equal(new Set(ids).size, ids.length, 'each shape is written once');
    assert.ok(ids.every(id => id.startsWith('hawk-')), 'and starts with hawk-');

    [logo.logoMarkup(), logo.emblemMarkup()].forEach(markup => {
      assert.equal(/<polygon/.test(markup), false, 'the logo draws no polygon of its own');
      const used = [...markup.matchAll(/href="#([^"]+)"/g)].map(match => match[1]);
      assert.ok(used.length > 10, "the logo uses the shapes");
      used.forEach(id => assert.ok(ids.includes(id), id + ' is defined'));
    });
  } finally {
    delete globalThis.document;
  }
});

await test('the cube is drawn once, and the plates of the war clock and the cards point at their shape', () => {
  const page = read(path.join(dashboard, 'index.html'));
  assert.equal((page.match(/class="cube-art"/g) || []).length, 1, 'the cube is in index.html once');
  assert.equal(code.filter(file => file.endsWith('.js') && /cube-art/.test(read(file))).length, 0, 'and nowhere in the scripts');

  const markup = read(path.join(dashboard, 'core/plate-markup.js'));
  assert.ok(markup.includes('<use class="war-housing-fill" href="#${id}"/>'), 'the war clock housing fills the shape it defined');
  assert.equal(/<polygon class="war-housing-fill"/.test(markup), false);

  const draw = read(path.join(dashboard, 'core/plate-draw.js'));
  const edged = draw.slice(draw.indexOf('export function edgedShape('), draw.indexOf('// A straight line of the given length'));
  assert.ok(edged.includes('<use class="${fillClass}" href="#${id}"/>'), 'a tag, a plate and a card fill the shape they defined');
  assert.equal(/points=/.test(edged.slice(edged.indexOf('return `'))), false, 'and write no points again');
});

// Colors

// The places a color may be written: the tokens, the tokens of a theme, a theme file, a seasonal pack (its art is
// data, in hex) and the built-in team, which is the stored Prime team with the same values as the Studio
const mayWriteColors = file => {
  const name = relative(file);
  return name === 'tokens.css' || /^styles\/[a-z]+\/tokens\.css$/.test(name) || name.startsWith('themes/') ||
    name.startsWith('seasons/') || name === 'config-more.js' || name.startsWith('data/') || name.startsWith('assets/');
};

await test('a hex color is written in the tokens, the tokens of a theme, a theme file, a pack or the built-in team, and nowhere else', () => {
  const problems = [];
  code.filter(file => !mayWriteColors(file)).forEach(file => {
    const text = withoutComments(file, read(file));
    for (const match of text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      // a link to an id, such as url(#edge-gold) or href="#screw-shape", is not a color
      const before = text.slice(Math.max(0, match.index - 8), match.index);
      if (/url\(['"]?$|href=["']$|&$/.test(before)) continue;
      problems.push(relative(file) + ':' + lineOf(text, match.index) + ' writes ' + match[0] + '. Add it to tokens.css as a variable');
    }
  });
  assert.deepEqual(problems, []);
});

await test('the places that may write a color all exist, so the rule above checks something', () => {
  assert.ok(fs.existsSync(path.join(dashboard, 'tokens.css')));
  ['original', 'cybertron', 'retro'].forEach(id => assert.ok(fs.existsSync(path.join(dashboard, 'styles', id, 'tokens.css')), id));
  assert.ok(code.filter(file => !mayWriteColors(file)).length > 100, 'most files are held to the rule');
  assert.ok(/--team-primary: #6c18b6;/.test(read(path.join(dashboard, 'tokens.css'))), 'the team colors start in tokens.css');
});

console.log('\n' + passed + ' passed');
