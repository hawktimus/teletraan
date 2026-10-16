// Tests for the colors, the metal and the glow of a team (docs/layouts.md, "Team colors, metal and glow"). Both teams
// of the sample content are put on a fake page by core/teams.js, and a small cascade reads the stylesheets that
// index.html links, in their order, for an element of that page: the html element and an area. What it works out
// is what a browser would: the edge gradient the frames use, the body color of a panel, the neon, the screws and the
// lines of the glow. Prime is held to the values Original has always had. Nothing touches the network or a browser.
//
//   node tests/team-colors.test.mjs
//
// The cascade knows the selectors the stylesheets use for these properties (tag, id, class, attribute, :root and
// :not, with spaces between), and it leaves out @media, @keyframes and the pseudo-elements, which none of them is in.
// What it looks like is checked by looking at the screen (docs/layouts.md, "Looking at a layout").

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dashboardFolder = path.join(root, 'dashboard');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-colors-'));

function copyInto(folder, from, to) {
  fs.mkdirSync(path.dirname(path.join(folder, to)), { recursive: true });
  copyModule(path.join(root, from), path.join(folder, to));
}

function makeTree(name, files) {
  const folder = path.join(workFolder, name);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'package.json'), '{ "type": "module" }\n');
  files.forEach(file => copyInto(folder, file, file));
  return folder;
}

const urlOf = (folder, file) => pathToFileURL(path.join(folder, file)).href;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const baseFiles = ['dashboard/config.js', 'dashboard/frame.js', 'dashboard/registry.js', 'dashboard/themes/registry.js', 'dashboard/themes/overlays/registry.js']
  .concat(fs.readdirSync(path.join(dashboardFolder, 'core')).filter(name => name.endsWith('.js')).map(name => 'dashboard/core/' + name));

const mainTree = makeTree('main', baseFiles);
const config = await import(urlOf(mainTree, 'dashboard/config.js'));
const sanity = await import(urlOf(mainTree, 'dashboard/core/sanity.js'));
const teams = await import(urlOf(mainTree, 'dashboard/core/teams.js'));

const tests = [];

function test(name, run) {
  tests.push({ name: name, run: run });
}


// The cascade

const withoutComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '');

// Splits at a character that is not inside parentheses or square brackets
function splitOutside(text, separator) {
  const parts = [];
  let depth = 0;
  let from = 0;
  for (let at = 0; at < text.length; at += 1) {
    if (text[at] === '(' || text[at] === '[') depth += 1;
    if (text[at] === ')' || text[at] === ']') depth -= 1;
    if (text[at] === separator && depth === 0) {
      parts.push(text.slice(from, at));
      from = at + 1;
    }
  }
  parts.push(text.slice(from));
  return parts.map(part => part.trim()).filter(part => part !== '');
}

// The rules of a stylesheet, at the top level only: { selectors, declarations: [[name, value]] }
function rulesOf(css) {
  const rules = [];
  const text = withoutComments(css);
  let at = 0;
  while (at < text.length) {
    const open = text.indexOf('{', at);
    if (open === -1) break;

    let depth = 0;
    let close = open;
    for (; close < text.length; close += 1) {
      if (text[close] === '{') depth += 1;
      if (text[close] === '}') depth -= 1;
      if (depth === 0) break;
    }

    const prelude = text.slice(at, open).trim();
    if (!prelude.startsWith('@')) {
      const declarations = splitOutside(text.slice(open + 1, close), ';')
        .map(line => [line.slice(0, line.indexOf(':')).trim(), line.slice(line.indexOf(':') + 1).trim()])
        .filter(pair => pair[0] !== '');
      rules.push({ selectors: splitOutside(prelude, ','), declarations: declarations });
    }
    at = close + 1;
  }
  return rules;
}

// One compound selector, such as html[data-layout="bar"]:not(.metal-steel):not(.metal-purple), or null when it uses something that is not known
function compoundOf(text) {
  const compound = { tag: '', id: '', classes: [], attrs: [], not: [], root: false, ids: 0, count: 0, types: 0 };
  let rest = text;
  const tag = /^(\*|[a-zA-Z][\w-]*)/.exec(rest);
  if (tag) {
    rest = rest.slice(tag[0].length);
    if (tag[0] !== '*') {
      compound.tag = tag[0];
      compound.types += 1;
    }
  }

  while (rest !== '') {
    let found;
    if ((found = /^#([\w-]+)/.exec(rest))) {
      compound.id = found[1];
      compound.ids += 1;
    } else if ((found = /^\.([\w-]+)/.exec(rest))) {
      compound.classes.push(found[1]);
      compound.count += 1;
    } else if ((found = /^\[([\w-]+)(?:="([^"]*)")?\]/.exec(rest))) {
      compound.attrs.push([found[1], found[2]]);
      compound.count += 1;
    } else if ((found = /^:root/.exec(rest))) {
      compound.root = true;
      compound.count += 1;
    } else if ((found = /^:not\(([^()]*)\)/.exec(rest))) {
      const inside = compoundOf(found[1]);
      if (inside === null) return null;
      compound.not.push(inside);
      compound.ids += inside.ids;
      compound.count += inside.count;
      compound.types += inside.types;
    } else {
      return null;
    }
    rest = rest.slice(found[0].length);
  }
  return compound;
}

// A selector is a list of compounds with a space between them, or null when it has a combinator or a pseudo-element
function selectorOf(text) {
  const compounds = splitOutside(text, ' ').map(compoundOf);
  if (compounds.length === 0 || compounds.some(compound => compound === null)) return null;

  return {
    compounds: compounds,
    specificity: compounds.reduce((all, compound) => [all[0] + compound.ids, all[1] + compound.count, all[2] + compound.types], [0, 0, 0]),
  };
}

function matches(compound, element) {
  if (compound.tag && compound.tag !== element.tag) return false;
  if (compound.id && compound.id !== element.id) return false;
  if (compound.root && element.parent !== null) return false;
  if (!compound.classes.every(name => element.classes.has(name))) return false;
  if (!compound.attrs.every(([name, value]) => (value === undefined ? element.attrs[name] !== undefined : element.attrs[name] === value))) return false;
  return compound.not.every(inside => !matches(inside, element));
}

function matchesChain(compounds, element) {
  if (!matches(compounds[compounds.length - 1], element)) return false;
  if (compounds.length === 1) return true;

  for (let above = element.parent; above !== null; above = above.parent) {
    if (matchesChain(compounds.slice(0, -1), above)) return true;
  }
  return false;
}

// Every stylesheet index.html links, in order, apart from the fonts. The order is what the cascade breaks a tie with
const sheets = Array.from(read('dashboard/index.html').matchAll(/<link rel="stylesheet" href="([^"?]+)\?v=0">/g)).map(match => match[1]).filter(href => href !== 'fonts/panel.css');
const panelSheets = fs.readdirSync(path.join(dashboardFolder, 'panels'), { withFileTypes: true }).filter(entry => entry.isDirectory())
  .reduce((all, entry) => all.concat(fs.readdirSync(path.join(dashboardFolder, 'panels', entry.name)).filter(file => file.endsWith('.css')).map(file => 'panels/' + entry.name + '/' + file)), []);

const allRules = [];
sheets.concat(panelSheets).forEach(file => rulesOf(read('dashboard/' + file)).forEach(rule => {
  rule.selectors.map(selectorOf).filter(selector => selector !== null).forEach(selector => {
    allRules.push({ file: file, selector: selector, declarations: rule.declarations, order: allRules.length });
  });
}));

// An element of the page: { tag, id, classes, attrs, parent, inline }. inline is the custom properties written on it
function element(tag, details, parent) {
  return {
    tag: tag,
    id: (details && details.id) || '',
    classes: new Set((details && details.classes) || []),
    attrs: (details && details.attrs) || {},
    parent: parent || null,
    inline: (details && details.inline) || {},
  };
}

// The value of a property with its var() replaced from the custom properties of the element, one level at a time
function resolve(value, customs, depth = 0) {
  if (depth > 20) throw new Error('a custom property that refers to itself: ' + value);

  let text = value;
  for (let found = /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/.exec(text); found; found = /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/.exec(text)) {
    const known = customs[found[1]];
    const replacement = known !== undefined ? resolve(known, customs, depth + 1) : (found[2] !== undefined ? resolve(found[2], customs, depth + 1) : '');
    text = text.slice(0, found.index) + replacement + text.slice(found.index + found[0].length);
  }
  return text;
}

// What the element has for each property: the custom ones inherit and are resolved on the element that has them, and the others
// are the winner of the cascade (the strongest selector, then the later rule) with the custom properties of the element put in
function computedFor(target) {
  const chain = [];
  for (let up = target; up !== null; up = up.parent) chain.unshift(up);

  let inherited = {};
  let own = {};
  chain.forEach(item => {
    const winners = {};
    allRules.filter(rule => matchesChain(rule.selector.compounds, item)).forEach(rule => {
      rule.declarations.forEach(([name, value]) => {
        const before = winners[name];
        const stronger = before ? compareSpecificity(rule.selector.specificity, before.specificity) : 1;
        if (stronger > 0 || (stronger === 0 && rule.order >= before.order)) winners[name] = { value: value, specificity: rule.selector.specificity, order: rule.order };
      });
    });

    const customs = Object.assign({}, inherited);
    Object.keys(winners).filter(name => name.startsWith('--')).forEach(name => { customs[name] = winners[name].value; });
    Object.keys(item.inline).forEach(name => { customs[name] = item.inline[name]; });
    const resolved = {};
    Object.keys(customs).forEach(name => { resolved[name] = resolve(customs[name], customs); });

    own = {};
    Object.keys(winners).filter(name => !name.startsWith('--')).forEach(name => { own[name] = resolve(winners[name].value, resolved); });
    inherited = resolved;
    item.computed = Object.assign({}, resolved, own);
  });
  return target.computed;
}

function compareSpecificity(one, other) {
  for (let index = 0; index < 3; index += 1) {
    if (one[index] !== other[index]) return one[index] > other[index] ? 1 : -1;
  }
  return 0;
}

// The fake page: the html element with a team on it by core/teams.js, and under it an area with its own data-metal
function makePage() {
  const names = new Set();
  const properties = {};
  return {
    dataset: {},
    style: { setProperty: (name, value) => { properties[name] = value; } },
    classList: { add: name => names.add(name), remove: name => names.delete(name), contains: name => names.has(name) },
    classes: () => Array.from(names).sort(),
    properties: properties,
  };
}

const sample = JSON.parse(read('dashboard/data/sample/content.json'));
const sampleTeams = sanity.normalizeSample(sample).teams;
const byCode = code => sampleTeams.filter(team => team.code === code)[0];
const layoutOf = { original: 'standard', cybertron: 'standard', minimal: 'bar' };

// What the page works out for a team in a style: the html element, an area with the metal the page change gave it, and a neon line in it.
// finish is data-finish of the html element, metal is the Frame metal setting and areaMetal the metal of the area
// Nova is gold now, like Prime. The steel metal is still a choice of a team, so in this file 'nova' is the sample Nova with
// steel, which the steel tests need, and 'goldnova' is the Nova of the sample as it is
function pageWith(code, style, details = {}) {
  const page = makePage();
  const team = code === 'nova' ? Object.assign({}, byCode('nova'), { metal: 'steel' }) : byCode(code === 'goldnova' ? 'nova' : code);
  teams.applyTeamLook(team, page);

  const html = element('html', {
    classes: page.classes().concat(['theme-hawktimus']),
    attrs: { 'data-style': style, 'data-layout': layoutOf[style], 'data-finish': details.finish || 'metal', 'data-metal': details.metal || 'gold' },
    inline: page.properties,
  });
  const area = element('div', { classes: ['area'], attrs: { 'data-area': 'grid1', 'data-metal': details.areaMetal || 'gold' } }, element('div', { id: 'screen' }, html));
  const svg = element('svg', { classes: ['plate'] }, area);
  return {
    classes: page.classes(),
    html: computedFor(html),
    area: computedFor(area),
    line: computedFor(element('use', { classes: ['edge-neon'] }, svg)),
    wideOne: computedFor(element('use', { classes: ['edge-neon-wide-1'] }, svg)),
    wideTwo: computedFor(element('use', { classes: ['edge-neon-wide-2'] }, svg)),
    headerGlow: computedFor(element('path', { classes: ['art-glow', 'art-glow-header-1'] }, svg)),
    bolt: computedFor(element('polygon', { classes: ['bolt-face'] }, svg)),
  };
}

const gradientOf = value => /^url\(#([\w-]+)\)$/.exec(value)[1];
const lower = value => String(value).toLowerCase();
const styles = ['original', 'cybertron', 'minimal'];
const steelStyles = ['cybertron', 'minimal'];


// The cascade itself, on cases that are known

test('the cascade picks the strongest selector, then the later rule, takes custom properties from the page and resolves var()', () => {
  const rules = rulesOf(':root { --one: red; --two: var(--one); } html[data-x="1"] .a { color: var(--two, blue); } .a { color: green; } .a { color: black; } .b:not(.c) { color: var(--missing, pink); }');
  assert.equal(rules.length, 5);
  assert.deepEqual(rules[0].declarations, [['--one', 'red'], ['--two', 'var(--one)']]);
  assert.deepEqual(selectorOf('html[data-x="1"] .a').specificity, [0, 2, 1]);
  assert.deepEqual(selectorOf('.b:not(.c)').specificity, [0, 2, 0]);
  assert.equal(selectorOf('.a > .b'), null, 'a combinator is not known, and the rule is left out');
  assert.equal(selectorOf('.a::before'), null);
  assert.equal(resolve('var(--missing, pink)', {}), 'pink');
  assert.equal(resolve('var(--two)', { '--two': 'var(--one)', '--one': 'red' }), 'red');
  assert.equal(resolve('linear-gradient(var(--a, #fff), var(--b))', { '--b': 'red' }), 'linear-gradient(#fff, red)');

  const html = element('html', { attrs: { 'data-style': 'minimal' }, classes: ['metal-steel'] });
  assert.ok(matchesChain(selectorOf('html.metal-steel [data-metal]').compounds, element('div', { attrs: { 'data-metal': 'gold' } }, html)));
  assert.ok(!matchesChain(selectorOf('html[data-layout="bar"]:not(.metal-steel):not(.metal-purple) [data-metal]').compounds, element('div', { attrs: { 'data-metal': 'gold' } }, html)));
  assert.ok(matchesChain(selectorOf(':root').compounds, html) && !matchesChain(selectorOf(':root').compounds, element('div', {}, html)));
  assert.ok(allRules.length > 1000, 'the stylesheets were read: ' + allRules.length + ' selectors');
});


// The teams of the sample content, and the table of the order

test('the sample content, the seed file and the built-in team have the colors, the metal and the glow of the order', () => {
  const seeded = read('docs/seed/teams.ndjson').split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));
  const wanted = {
    prime: { primary: '#6C18B6', plate: '#3B2A7A', body: '#1A0F2E', accent: '#FACA2A', neon: '#FACA2A', pink: '#B23CFF', label: '#FACA2A', metal: 'gold', glow: false },
    nova: { primary: '#FACA2A', plate: '#6B4F0C', body: '#2A1F07', accent: '#C58CFF', neon: '#B23CFF', pink: '#FACA2A', label: '#C58CFF', metal: 'gold', glow: true, background: '#130E03' },
  };

  Object.keys(wanted).forEach(code => {
    const want = wanted[code];
    [byCode(code), seeded.filter(doc => doc.code === code)[0]].forEach(team => {
      ['primary', 'plate', 'body', 'accent', 'neon', 'pink', 'label'].forEach(name => assert.equal(team.colors[name], want[name], code + ' ' + name));
      assert.equal(team.metal, want.metal, code + ' metal');
      assert.equal(team.glow, want.glow, code + ' glow');
    });
  });
  assert.equal(byCode('nova').colors.background, wanted.nova.background);

  // Prime keeps the background Original has always had, which is the theme's own and the same as the seed
  assert.equal(byCode('prime').colors.background, '#0B0714');
  assert.equal(seeded[0].colors.background, '#0B0714');
  assert.equal(config.primeTeam.colors.background, '#0B0714');
  assert.ok(/--ground: #0B0714;/.test(read('dashboard/themes/hawktimus.css')));

  // The built-in team is Prime as the sample has it
  assert.deepEqual(config.primeTeam.colors, byCode('prime').colors);
  assert.equal(config.primeTeam.metal, 'gold');
  assert.equal(config.primeTeam.glow, false);

  // No cyan on Prime, anywhere: not in its colors and not in what a style works out for it
  ['primary', 'plate', 'body', 'accent', 'neon', 'pink', 'label', 'background', 'text'].forEach(name => {
    const hex = byCode('prime').colors[name].slice(1);
    assert.ok(!(parseInt(hex.slice(0, 2), 16) < 120 && parseInt(hex.slice(2, 4), 16) > 180 && parseInt(hex.slice(4, 6), 16) > 180), 'Prime ' + name + ' is not cyan');
  });
  steelStyles.forEach(style => {
    const page = pageWith('prime', style);
    Object.keys(page.html).filter(name => name.startsWith('--') && !/^--(hidden|alliance)-/.test(name)).forEach(name => assert.ok(!/#35f0ff|#2fd8ff|#3fd8ff|#9bf0ff|#8ff0ff/i.test(page.html[name]), style + ': ' + name + ' is a cyan: ' + page.html[name]));
  });
  assert.ok(!/#35f0ff/i.test(read('dashboard/teams.css')), 'and the starting colors have none');
});


// Both teams in each style

test('in Cybertron and Minimal the edge gradient and the body color are not the same for the two teams: gold on dark purple for Prime, steel on dark gold for a team with steel', () => {
  steelStyles.forEach(style => {
    const prime = pageWith('prime', style);
    const nova = pageWith('nova', style);

    assert.equal(gradientOf(prime.area['--edge-face']), 'edge-gold', style + ': Prime has gold');
    assert.equal(gradientOf(nova.area['--edge-face']), 'edge-steel', style + ': Nova has steel');
    assert.notEqual(prime.area['--edge-face'], nova.area['--edge-face']);
    assert.equal(gradientOf(prime.area['--edge-ridge']), 'edge-ridge-gold');
    assert.equal(gradientOf(nova.area['--edge-ridge']), 'edge-ridge-steel');
    assert.equal(gradientOf(prime.area['--edge-shade']), 'edge-shade-gold');
    assert.equal(gradientOf(nova.area['--edge-shade']), 'edge-shade-steel');
    assert.equal(lower(prime.area['--metal-3']), '#a98f43', style + ': the gold tokens');
    assert.equal(lower(nova.area['--metal-3']), '#8b94a0', style + ': the steel tokens');

    // the body of a plate is the team's body color, and a plate of the frame reads it
    assert.equal(lower(prime.area['--panel-face']), '#1a0f2e', style + ': the body of Prime');
    assert.equal(lower(nova.area['--panel-face']), '#2a1f07', style + ': the body of Nova');
    assert.notEqual(prime.area['--panel-face'], nova.area['--panel-face']);

    // the neon and the conduit, the page grid, the digits and the label are the team's
    assert.equal(lower(prime.html['--style-neon']), '#faca2a');
    assert.equal(lower(nova.html['--style-neon']), '#b23cff');
    assert.equal(lower(prime.html['--style-pink']), '#b23cff', style + ': a purple conduit for Prime');
    assert.equal(lower(nova.html['--style-pink']), '#faca2a', style + ': a gold conduit for Nova');
    assert.equal(lower(prime.html['--team-label']), '#faca2a');
    assert.equal(lower(nova.html['--team-label']), '#c58cff');
  });

  assert.equal(lower(pageWith('prime', 'minimal').html['--style-digits']), '#faca2a', 'the digits of Minimal are the team\'s neon');
  assert.equal(lower(pageWith('nova', 'minimal').html['--style-digits']), '#b23cff');
  assert.equal(lower(pageWith('prime', 'cybertron').html['--style-grid-opacity']), '.07', 'the page grid is the neon at .07');
});

test('whichever metal the page change gives an area, Cybertron and Minimal keep the metal of the team', () => {
  steelStyles.forEach(style => ['gold', 'silver'].forEach(areaMetal => ['gold', 'silver'].forEach(metal => {
    const prime = pageWith('prime', style, { areaMetal: areaMetal, metal: metal });
    const nova = pageWith('nova', style, { areaMetal: areaMetal, metal: metal });

    assert.equal(gradientOf(prime.area['--edge-face']), 'edge-gold', style + ' ' + areaMetal + ' ' + metal);
    assert.equal(gradientOf(nova.area['--edge-face']), 'edge-steel', style + ' ' + areaMetal + ' ' + metal);
    assert.equal(gradientOf(prime.html['--edge-face']), 'edge-gold', 'the page itself, which has the banner');
    assert.equal(gradientOf(nova.html['--edge-face']), 'edge-steel');
  })));
});

test('the bolts and the rivets of Cybertron and Minimal are the metal of the team, where the screws of Original are silver for both', () => {
  steelStyles.forEach(style => {
    const prime = pageWith('prime', style);
    const nova = pageWith('nova', style);
    assert.equal(lower(prime.html['--screw-light']), '#efe6c4', style + ': the brightest gold');
    assert.equal(lower(nova.html['--screw-light']), '#d6dbe2', style + ': the brightest steel');
    assert.equal(lower(prime.html['--screw-mid']), '#a98f43');
    assert.equal(lower(nova.html['--screw-mid']), '#8b94a0');
    assert.equal(lower(prime.html['--screw-rim']), '#26210e');
    assert.equal(lower(nova.html['--screw-rim']), '#08090c');
    assert.equal(prime.bolt.fill, 'url(#screw-face-silver)', 'the bolt face is the gradient of the screw, which reads these tokens');
  });

  ['prime', 'nova'].forEach(code => {
    const page = pageWith(code, 'original');
    assert.equal(lower(page.html['--screw-light']), '#c3c4c3', code + ' in Original: the silver screws');
    assert.equal(lower(page.html['--screw-mid']), '#85888a');
  });
});

test('Original has gold for Prime, as it always had, and steel for Nova, in place of the gold and the silver the page change gives', () => {
  ['gold', 'silver'].forEach(areaMetal => {
    const prime = pageWith('prime', 'original', { areaMetal: areaMetal });
    const nova = pageWith('nova', 'original', { areaMetal: areaMetal });

    assert.equal(gradientOf(prime.area['--edge-face']), 'edge-' + areaMetal, 'Prime has the metal the page change gave the area');
    assert.equal(gradientOf(nova.area['--edge-face']), 'edge-steel', 'Nova has steel');
    assert.notEqual(prime.area['--edge-face'], nova.area['--edge-face']);
  });
  assert.equal(gradientOf(pageWith('prime', 'original', { metal: 'silver' }).html['--edge-face']), 'edge-silver', 'and Frame metal still decides for Prime');
});

test('Prime in Original is what it has always been: the colors of the theme, the gold, the silver screws, no class on the page and no glow', () => {
  ['original'].forEach(style => {
    const page = pageWith('prime', style);
    assert.deepEqual(page.classes, []);
    assert.equal(lower(page.html['--ground']), '#0b0714');
    assert.equal(lower(page.html['--purple']), '#6c18b6');
    assert.equal(lower(page.html['--yellow']), '#faca2a');
    assert.equal(lower(page.html['--white']), '#ffffff');
    assert.equal(lower(page.html['--metal-1']), '#efe6c4');
    assert.equal(lower(page.area['--metal-3']), '#a98f43');
    assert.equal(page.area['--edge-face'], 'url(#edge-gold)');
    assert.equal(page.area['--edge-ridge'], 'url(#edge-ridge-gold)');
    assert.equal(page.area['--edge-shade'], 'url(#edge-shade-gold)');
    assert.equal(page.area['--panel-face'], page.html['--plate'], 'the plate of a panel is the theme\'s');
    assert.equal(lower(page.html['--screw-light']), '#c3c4c3');
  });

  // Only the page's own colors differ between the teams in Original: Nova has its colors in the four places the theme takes them from
  const nova = pageWith('nova', 'original');
  assert.equal(lower(nova.html['--ground']), '#130e03');
  assert.equal(lower(nova.html['--purple']), '#faca2a');
  assert.equal(lower(nova.html['--yellow']), '#c58cff');
});

test('the Nova of the sample has gold metal: no steel class, and the gold frames in every style, like Prime', () => {
  styles.forEach(style => {
    const gold = pageWith('goldnova', style);
    assert.ok(!gold.classes.includes('metal-steel'), style + ': no steel class');
    assert.equal(gradientOf(gold.area['--edge-face']), 'edge-gold', style + ': gold edge');
    assert.equal(lower(gold.area['--metal-3']), '#a98f43', style + ': the gold tokens');
  });
});

test('the glow: a team with it has a neon line of 5 px and the two wider lines of 12 px at .35 and 26 px at .12, in Cybertron and Minimal, and Prime has none', () => {
  steelStyles.forEach(style => {
    const prime = pageWith('prime', style);
    const nova = pageWith('nova', style);

    assert.ok(nova.classes.includes('neon-glow') && !prime.classes.includes('neon-glow'));
    assert.equal(prime.line['stroke-width'], '4px', style + ': Prime has the thin line');
    assert.equal(prime.wideOne.display, 'none');
    assert.equal(prime.wideTwo.display, 'none');
    assert.equal(prime.headerGlow.display, 'none');

    assert.equal(nova.line['stroke-width'], '5px', style + ': Nova has the line of 5');
    assert.deepEqual([nova.wideOne.display, nova.wideOne['stroke-width'], nova.wideOne['stroke-opacity']], ['inline', '12px', '.35'], style + ': the first wider line');
    assert.deepEqual([nova.wideTwo.display, nova.wideTwo['stroke-width'], nova.wideTwo['stroke-opacity']], ['inline', '26px', '.12'], style + ': the second');
    assert.deepEqual([nova.headerGlow.display, nova.headerGlow['stroke-width'], nova.headerGlow['stroke-opacity']], ['inline', '12px', '.35'], style + ': and the same behind the header line');
    [nova.line, nova.wideOne, nova.wideTwo].forEach(computed => assert.equal(lower(computed.stroke), '#b23cff', 'the same color as the line'));
    assert.equal(prime.line.stroke, '#FACA2A');

    // the flat finish has none of it, whatever the team
    const flat = pageWith('nova', style, { finish: 'flat' });
    assert.equal(flat.line['stroke-width'], '4px');
    assert.equal(flat.wideOne.display, 'none');
    assert.equal(flat.wideTwo.display, 'none');
  });
});

test('the stylesheets that make the glow and the metal draw no filter, no shadow and nothing that moves', () => {
  ['dashboard/tokens.css', 'dashboard/teams.css'].forEach(file => assert.ok(!/animation|transition|@keyframes|filter|box-shadow|text-shadow|blur|drop-shadow/.test(withoutComments(read(file))), file));

  const base = withoutComments(read('dashboard/base.css'));
  const glow = base.slice(base.indexOf('.art-glow {'), base.indexOf('.tab-bevel {'));
  assert.ok(glow.length > 300 && !/animation|transition|filter|shadow|blur|url\(/.test(glow), 'the glow in base.css is strokes');
  (glow.match(/stroke-width: [\d.]+px/g) || []).forEach(text => assert.ok(parseFloat(/[\d.]+px/.exec(text)[0]) >= 3, text));
});

test('the Team document, the dashboard and the stylesheets name the same metals, and a team made before the metal existed is gold', () => {
  assert.deepEqual(Object.keys(config.teamMetals), ['gold', 'steel', 'purple']);
  assert.equal(config.teamMetals.gold, '', 'gold has no class');
  assert.equal(config.teamMetals.steel, 'metal-steel');
  assert.equal(config.teamMetals.purple, 'metal-purple');
  assert.equal(config.glowClass, 'neon-glow');
  assert.deepEqual(teams.metalClasses, ['metal-steel', 'metal-purple']);

  const plain = sanity.normalizeContent({ teams: [{ _id: 'a', _type: 'team', code: 'old', colors: { primary: '#112233' } }] }, new Date(0)).teams[0];
  assert.deepEqual([plain.metal, plain.glow, plain.colors.body, plain.colors.label, plain.colors.neon], ['gold', false, '#1A0F2E', '#FACA2A', '#FACA2A']);

  const page = makePage();
  teams.applyTeamLook(plain, page);
  assert.deepEqual(page.classes(), [], 'an old team has no class on the page');
  assert.equal(page.properties['--team-body'], '#1A0F2E');
  assert.equal(page.properties['--team-label'], '#FACA2A');
});


// Run them

let failures = 0;
try {
  for (const entry of tests) {
    try {
      await entry.run();
      console.log('ok    ' + entry.name);
    } catch (error) {
      failures += 1;
      console.log('FAIL  ' + entry.name);
      console.log(error);
    }
  }
} finally {
  fs.rmSync(workFolder, { recursive: true, force: true });
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
