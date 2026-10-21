// Tests for the logo of a team and the header ink: logoMarkup(team) draws Prime as it always did and Nova with every
// pair of colors swapped, hawkPieces(team) gives the four plates for the swap, and --team-header-ink is set with the
// other team colors and read by the titles, the team plate and the ticker label. Nothing touches a browser.
//
//   node tests/logo-team.test.mjs

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dashboard = path.join(root, 'dashboard');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const withoutComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '');
const load = file => import(pathToFileURL(path.join(dashboard, file)).href);

const logo = await load('core/logo.js');
const teams = await load('core/teams.js');
const config = await load('config.js');
const sanity = await load('core/sanity.js');

const tests = [];
const test = (name, run) => tests.push({ name: name, run: run });

// The value of a custom property in a stylesheet, from its own rule
function tokenIn(css, name) {
  const found = new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{6})').exec(withoutComments(css));
  return found ? found[1].toLowerCase() : '';
}

test('the logo of Prime is the drawing it was before there was a team: the same markup, byte for byte', () => {
  const markup = logo.logoMarkup();
  assert.equal(logo.logoMarkup('prime'), markup, 'no argument is Prime');
  assert.equal(logo.logoMarkup('anything else'), markup, 'a name that is not nova is Prime');
  assert.equal(markup.length, 3104);
  assert.equal(crypto.createHash('sha256').update(markup).digest('hex'), '163941a1ebdff8941689cce7993bab354187ea78a518baf091c75b14abdcc2aa');
  assert.ok(!markup.includes('logo-nova'));
});

test('the logo of Nova is the same drawing with one more class, so every pose and finish works for both', () => {
  const prime = logo.logoMarkup('prime');
  const nova = logo.logoMarkup('nova');
  assert.equal(nova, prime.replace('<div class="drawing">', '<div class="drawing logo-nova">'));
  assert.equal((nova.match(/logo-nova/g) || []).length, 1);

  // the acts and poses of frame.css name no team, and the Nova rules change colors only
  const frame = withoutComments(read('dashboard/frame.css'));
  const novaRules = frame.split('}').filter(rule => rule.includes('.logo-nova'));
  assert.ok(novaRules.length >= 3, 'the Nova colors are in frame.css');
  novaRules.forEach(rule => {
    const body = rule.slice(rule.indexOf('{') + 1);
    body.split(';').map(line => line.trim()).filter(Boolean).forEach(line => {
      assert.ok(/^(--logo-[a-z]+|fill|stroke):/.test(line), 'a Nova rule sets only a color: ' + line);
    });
  });
  assert.ok(!/data-act[^{]*logo-nova|logo-nova[^{]*data-act/.test(frame), 'no act has a rule for Nova');
});

test('every color of Nova is the pair of the Prime one, and the colors are tokens', () => {
  const tokens = read('dashboard/tokens.css');
  const hawktimus = read('dashboard/themes/hawktimus.css');
  const prime = { plate: tokenIn(hawktimus, 'logo-purple'), tail: tokenIn(hawktimus, 'logo-tail'), far: tokenIn(hawktimus, 'logo-far') };

  assert.deepEqual(prime, { plate: '#6c18b6', tail: '#53048f', far: '#3d036d' });
  assert.equal(tokenIn(tokens, 'logo-nova-plate'), '#faca2a', '#6C18B6 and #FACA2A');
  assert.equal(tokenIn(tokens, 'logo-nova-tail'), '#c18c07', '#53048F and #C18C07');
  assert.equal(tokenIn(tokens, 'logo-nova-far'), '#9b6c06', '#3D036D and #9B6C06');
  assert.equal(tokenIn(tokens, 'logo-nova-edge-1'), '#c8a7ff', '#FFF5CE and #C8A7FF');
  assert.equal(tokenIn(tokens, 'logo-nova-edge-2'), '#a56ae8', 'the light mid tone of the brushed purple metal');
  assert.equal(tokenIn(tokens, 'logo-nova-edge-3'), '#8c44dc', '#FFDD77 and #8C44DC');
  assert.equal(tokenIn(tokens, 'logo-nova-edge-4'), '#53048f', '#C18C07 and #53048F');
  assert.equal(tokenIn(tokens, 'logo-nova-edge-5'), '#2a1245', 'the darkest pit of the brushed purple metal');
  assert.equal(tokenIn(tokens, 'logo-nova-shadow'), '#1a0530', '#2E2000 and #1A0530');
  assert.equal(tokenIn(tokens, 'logo-nova-flat'), '#6c18b6', 'the flat finish takes the purple');

  const page = read('dashboard/index.html');
  const gradient = /<linearGradient id="logo-metal-nova"[\s\S]*?<\/linearGradient>/.exec(page);
  assert.ok(gradient, 'the page has the Nova edge gradient');
  ['edge-1', 'edge-2', 'edge-3', 'edge-4', 'edge-5'].forEach(name => assert.ok(gradient[0].includes('var(--logo-nova-' + name + ')'), name));
  // The purple metal has more bands than the gold one (nine stops, with a dark pit before the hard band of light at .56),
  // because one lilac line read as flat paint. The direction and the band of light are the Prime edge's.
  const prime2 = /<linearGradient id="logo-metal"[\s\S]*?<\/linearGradient>/.exec(page)[0];
  assert.equal(gradient[0].match(/<stop /g).length, 9, 'nine stops');
  assert.ok(gradient[0].match(/<stop /g).length > prime2.match(/<stop /g).length, 'more bands than the Prime edge');
  assert.ok(gradient[0].includes('offset=".56"') && prime2.includes('offset=".56"'), 'the hard band of light is where the Prime edge has it');
  assert.equal(gradient[0].match(/x1="[^"]+" y1="[^"]+" x2="[^"]+" y2="[^"]+"/)[0], prime2.match(/x1="[^"]+" y1="[^"]+" x2="[^"]+" y2="[^"]+"/)[0], 'the same direction of light');
});

test('which team draws which logo: Nova gets the Nova logo, Prime and every other team and the Robotics view get Prime', () => {
  assert.equal(logo.logoTeamOf('nova', 'nova'), 'nova');
  assert.equal(logo.logoTeamOf('nova', ''), 'nova');
  assert.equal(logo.logoTeamOf('nova', 'general'), 'prime');
  assert.equal(logo.logoTeamOf('nova', 'robotics'), 'prime');
  assert.equal(logo.logoTeamOf('prime', 'prime'), 'prime');
  assert.equal(logo.logoTeamOf('other', 'nova'), 'prime');

  const names = new Set();
  const drawing = { classList: { toggle: (name, on) => { if (on) names.add(name); else names.delete(name); } } };
  const box = { querySelector: selector => (selector === '.drawing' ? drawing : null) };
  logo.showLogoTeam(box, 'nova');
  assert.deepEqual([...names], ['logo-nova']);
  logo.showLogoTeam(box, 'prime');
  assert.deepEqual([...names], []);
  logo.showLogoTeam(null, 'nova');
  logo.showLogoTeam({}, 'nova');

  ['banner', 'side', 'bar-column', 'team-tile', 'announcement'].forEach(name => {
    const code = read('dashboard/panels/' + name + '/panel.js');
    assert.ok(code.includes('logoTeamOf(team.code, viewNow())'), name + ' picks the logo of its team');
  });
});

test('hawkPieces gives the four plates on the 1100 by 884 grid, with the pivots and robot poses of frame.css and the colors of both teams', () => {
  const frame = withoutComments(read('dashboard/frame.css'));
  const pivotOf = name => {
    const found = new RegExp('\\.logo \\.' + name + ' \\{\\s*transform-origin: (\\d+)px (\\d+)px;').exec(frame);
    return { x: Number(found[1]), y: Number(found[2]) };
  };
  const robotOf = name => {
    const found = new RegExp('\\.logo\\[data-act="robot"\\] \\.' + name + ',\\s*\\.logo\\[data-act="hawk-in"\\] \\.' + name + ' \\{\\s*transform: var\\(--lens\\) (.*?) rotate3d').exec(frame);
    return found[1].replace(/ rotate\(0deg\)/, '').replace(/ scale\(1\)/, '').trim();
  };

  const prime = logo.hawkPieces('prime');
  const nova = logo.hawkPieces('nova');
  assert.deepEqual([prime.team, nova.team, prime.width, prime.height], ['prime', 'nova', 1100, 884]);
  assert.deepEqual(prime.plates.map(plate => plate.name), ['wing-left', 'wing-right', 'body', 'head']);
  assert.deepEqual(logo.hawkPieces().plates, prime.plates, 'no argument is Prime');

  prime.plates.forEach((plate, index) => {
    const points = plate.shapes.concat(plate.stripes).join(' ').split(/[ ,]/).map(Number);
    assert.ok(points.length >= 14 && points.every(number => Number.isFinite(number)), plate.name + ' has its points');
    for (let at = 0; at < points.length; at += 2) {
      assert.ok(points[at] >= 0 && points[at] <= 1100 && points[at + 1] >= 0 && points[at + 1] <= 884, plate.name + ' is inside the grid');
    }
    assert.deepEqual(plate.pivot, pivotOf(plate.name), plate.name + ' turns about the point frame.css names');
    assert.equal(plate.robot, robotOf(plate.name), plate.name + ' takes the robot pose of frame.css');

    // the back of a plate is the other team's front, and Nova's plate has the same shapes
    assert.deepEqual(plate.back, nova.plates[index].front);
    assert.deepEqual(nova.plates[index].back, plate.front);
    assert.deepEqual(nova.plates[index].shapes, plate.shapes);
    assert.notDeepEqual(plate.front, plate.back);
  });
  assert.equal(prime.plates[0].front.fill, 'var(--logo-purple)');
  assert.equal(nova.plates[0].front.fill, 'var(--logo-nova-plate)');
  assert.equal(nova.plates[0].front.edge, 'url(#logo-metal-nova)');
  assert.equal(nova.plates[0].front.shadow, 'var(--logo-nova-shadow)');
});

test('the header ink is set with the other team colors: white for Prime and Nova dark, and Nova is the only one that needs it', () => {
  const sample = sanity.normalizeSample(JSON.parse(read('dashboard/data/sample/content.json'))).teams;
  const byCode = code => sample.filter(team => team.code === code)[0];
  assert.equal(teams.colorProperties.headerInk, '--team-header-ink');
  assert.equal(teams.teamProperties(byCode('prime'))['--team-header-ink'], '#FFFFFF');
  assert.equal(teams.teamProperties(byCode('nova'))['--team-header-ink'], '#1A1200');
  assert.equal(teams.teamProperties(config.primeTeam)['--team-header-ink'], '#FFFFFF');
  assert.equal(tokenIn(read('dashboard/tokens.css'), 'team-header-ink'), '#ffffff', 'tokens.css starts at the Prime ink');

  // a Nova document made before the field existed gets the dark ink, and a Prime one white
  const old = code => sanity.normalizeContent({ teams: [{ _id: 'a', _type: 'team', code: code, palette: code === 'nova' ? 'inverted' : 'standard', colors: { primary: '#D4A017' } }] }, new Date(0)).teams[0];
  assert.equal(old('nova').colors.headerInk, '#1A1200');
  assert.equal(old('prime').colors.headerInk, '#FFFFFF');
  const typed = sanity.normalizeContent({ teams: [{ _id: 'a', _type: 'team', code: 'nova', palette: 'inverted', colors: { headerInk: '#102030' } }] }, new Date(0)).teams[0];
  assert.equal(typed.colors.headerInk, '#102030', 'a color typed in the Studio wins');
});

test('panel titles, the team plate and the ticker label read the header ink where the plate is the main color, and only there', () => {
  const css = withoutComments(read('dashboard/base.css'));
  const rule = /(\.header \.title,[^{]*)\{([^}]*)\}/.exec(css);
  assert.ok(rule, 'the rule is in base.css');
  assert.ok(rule[1].includes('.banner .team-plate span') && rule[1].includes('.ticker .tag span'));
  assert.ok(/color: var\(--head-ink, var\(--team-header-ink\)\);/.test(rule[2]));
  assert.ok(/html\.palette-inverted \.banner \.team-plate b \{\s*color: var\(--head-number, var\(--team-header-ink\)\);/.test(css), 'the number follows the ink for the inverted palette only');

  // Cybertron and the bar layout put the text and the accent back, because their plates are not the main color
  const back = /\{\s*--head-ink: var\(--white\);\s*--head-number: var\(--yellow\);\s*\}/;
  assert.ok(back.test(withoutComments(read('dashboard/styles/cybertron/theme.css'))), 'Cybertron');
  assert.ok(back.test(withoutComments(read('dashboard/layouts/bar.css'))), 'the bar layout');

  // the plates are the main color in Original and Retro, and the team plate color and armor in Cybertron and the bar layout
  assert.ok(/\.plate \.header-left \{ fill: var\(--purple\); \}/.test(css));
  assert.ok(/--style-header-ink: var\(--team-text\)/.test(withoutComments(read('dashboard/styles/cybertron/tokens.css'))), 'Cybertron keeps the text color on its accent wedge');
  assert.ok(/--style-header-ink: var\(--team-header-ink, #ffffff\)/.test(withoutComments(read('dashboard/styles/retro/tokens.css'))), 'the Retro theme takes the header ink of the team');
  assert.ok(/data-layout="bar"\] \.area \.plate \.header-left \{ fill: url\(#armor-face\); \}/.test(withoutComments(read('dashboard/layouts/bar-minimal.css'))));
});

test('the Team document has the optional header ink, dark and retro colors, and the seed and the sample carry them for both teams', () => {
  const schema = read('studio/schemas/team.js');
  assert.ok(/colorField\('headerInk', 'Header text color',[^\n]*'#FFFFFF', true\)/.test(schema));
  assert.ok(/colorField\('dark', 'Dark color',[^\n]*true\)/.test(schema));
  assert.ok(/colorField\('retro', 'Retro color',[^\n]*true\)/.test(schema));

  const seeded = read('docs/seed/teams.ndjson').split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
  const sample = JSON.parse(read('dashboard/data/sample/content.json')).teams;
  [seeded, sample].forEach(list => {
    const [prime, nova] = [list.find(team => team.code === 'prime'), list.find(team => team.code === 'nova')];
    assert.deepEqual([prime.colors.headerInk, prime.colors.dark, prime.colors.retro], ['#FFFFFF', '#29054A', '#FACA2A']);
    assert.deepEqual([nova.colors.headerInk, nova.colors.dark, nova.colors.retro], ['#1A1200', '#3D2A05', '#E0A400']);
  });
});

let failures = 0;
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
test('the Nova hawk keeps its purple metal in Cybertron and the bar layout, and purple numbers on the TEAM plate have an outline for Nova only', () => {
  const cybertron = withoutComments(read('dashboard/styles/cybertron/theme.css'));
  const bar = withoutComments(read('dashboard/layouts/bar-minimal.css'));
  assert.ok(cybertron.includes('.banner .logo .drawing:not(.logo-nova)') && cybertron.includes('.side-logo .drawing:not(.logo-nova)'), 'Cybertron does not flatten the Nova edge to the accent');
  assert.ok(bar.includes('.bar-logo .drawing:not(.logo-nova)'), 'the bar layout does not either');

  const teams = withoutComments(read('dashboard/teams.css'));
  assert.ok(/:root \{\s*--team-text-outline: 0px;\s*--team-text-outline-ink: transparent;\s*\}/.test(teams), 'no outline for any team by default');
  assert.ok(/html\.palette-inverted\.metal-purple \{\s*--team-text-outline: 3px;\s*--team-text-outline-ink: var\(--team-header-ink\);\s*\}/.test(teams), 'the width and the dark ink are set for the Nova palette only');
  const rule = /(html\[data-style="cybertron"\] \.team-number,[^{]*)\{([^}]*)\}/.exec(teams);
  assert.ok(rule, 'the outline rule');
  assert.ok(rule[1].includes('html[data-layout="bar"] .team-number'), 'the bar layout');
  assert.ok(!/retro|foundry/.test(rule[1]), 'Retro and Foundry draw the number in the header ink and take no outline');
  assert.ok(/-webkit-text-stroke: var\(--team-text-outline\) var\(--team-text-outline-ink\);/.test(rule[2]) && /paint-order: stroke fill;/.test(rule[2]), 'the stroke is behind the fill');
  assert.ok(!/html\.name-outline|\.team-name|\.bar-name/.test(rule[1]), 'the name has its own switch and is not touched');
});

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
