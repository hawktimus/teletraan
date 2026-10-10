// Tests for the trim of a team (docs/layouts.md, "Team trim"): the eight fields of the Team document, the classes
// that core/teams.js puts on the page for them, the frames that core/plate.js draws for the corners and the header
// tab, and the rules of dashboard/trim.css. Both teams of the sample content are put on a fake page, and what
// differs between them is checked field by field. Prime is the starting point: the tests hold the stylesheet and
// the frames to rules that cannot change how it looks. Nothing touches the network or a browser.
//
//   node tools/test-team-trim.mjs
//
// What it looks like is checked by looking at the screen (docs/layouts.md, "Looking at a layout").

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dashboardFolder = path.join(root, 'dashboard');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-trim-'));

function copyInto(folder, from, to) {
  fs.mkdirSync(path.dirname(path.join(folder, to)), { recursive: true });
  fs.copyFileSync(path.join(root, from), path.join(folder, to));
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
const withoutComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '');

// The files every tree has: the configuration, the registries and everything in core/
const baseFiles = ['dashboard/config.js', 'dashboard/frame.js', 'dashboard/registry.js', 'dashboard/themes/registry.js', 'dashboard/themes/overlays/registry.js']
  .concat(fs.readdirSync(path.join(dashboardFolder, 'core')).filter(name => name.endsWith('.js')).map(name => 'dashboard/core/' + name));

const mainTree = makeTree('main', baseFiles);
const config = await import(urlOf(mainTree, 'dashboard/config.js'));
const plate = await import(urlOf(mainTree, 'dashboard/core/plate.js'));
const sanity = await import(urlOf(mainTree, 'dashboard/core/sanity.js'));
const teams = await import(urlOf(mainTree, 'dashboard/core/teams.js'));

const tests = [];

function test(name, run) {
  tests.push({ name: name, run: run });
}

// Runs something with a fake global, and puts the real one back
async function withGlobals(values, run) {
  const kept = {};
  Object.keys(values).forEach(name => {
    kept[name] = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value: values[name], configurable: true, writable: true });
  });
  try {
    return await run();
  } finally {
    Object.keys(values).forEach(name => {
      if (kept[name]) Object.defineProperty(globalThis, name, kept[name]);
      else delete globalThis[name];
    });
  }
}

// plate.js adds each frame's shapes to a hidden group of the page, once. A page with only that group stands in for
// it, and keeps the markup that was added, so the frames can be read back. run is given the text of the group
function withPlatePage(run) {
  const known = new Set();
  const added = [];
  return withGlobals({
    document: {
      getElementById: id => {
        if (id !== 'metal-shapes') return known.has(id) ? {} : null;
        return { insertAdjacentHTML: (where, markup) => { added.push(markup); (markup.match(/ id="[^"]+"/g) || []).forEach(found => known.add(found.slice(5, -1))); } };
      },
    },
  }, () => run(() => added.join('\n')));
}

// The html element of a page: the classes, the custom properties and the data attributes that are written on it
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

const trimFields = Object.keys(config.teamTrim);
const sample = JSON.parse(read('dashboard/data/sample/content.json'));
const sampleTeams = sanity.normalizeSample(sample).teams;
const byCode = code => sampleTeams.filter(team => team.code === code)[0];
const primeTeam = byCode('prime');
const novaTeam = byCode('nova');
const classOf = (field, value) => config.teamTrim[field][value];

// A team document as Studio sends it
const document = (id, fields) => Object.assign({ _id: id, _type: 'team', code: id }, fields);
const normalized = fields => sanity.normalizeContent({ teams: [document('plain', fields)] }, new Date(0)).teams[0];

// The points of a polygon or a polyline in the defs, as pairs of numbers
function pointsOf(defs, id) {
  const found = new RegExp(' id="' + id + '"[^>]* points="([^"]+)"').exec(defs);
  assert.ok(found, 'the defs have no shape called ' + id);
  return found[1].split(' ').map(pair => pair.split(',').map(Number));
}

const turnedAcross = (points, width) => points.map(point => [width - point[0], point[1]]);

// The two lists have the same points, in any order. Points the frame offsets are rounded to a tenth, so a point may be a
// tenth away from the one that was turned across
function sameSet(points, other) {
  const near = (list, point) => list.some(candidate => Math.abs(candidate[0] - point[0]) < .15 && Math.abs(candidate[1] - point[1]) < .15);

  assert.equal(points.length, other.length, 'the same number of points');
  points.forEach(point => assert.ok(near(other, point), 'the point ' + point + ' is not in the other list'));
  other.forEach(point => assert.ok(near(points, point), 'the point ' + point + ' is not in the first list'));
}


// The eight fields, in the content and in the classes

test('the eight fields are in config.js, in the order of the Studio, and Prime has the first value of each with no class', () => {
  assert.deepEqual(trimFields, ['bolts', 'cornerCut', 'headerNotch', 'grid', 'logoPose', 'nameStyle', 'tickerLabel', 'countAccent']);
  trimFields.forEach(field => {
    const values = Object.keys(config.teamTrim[field]);
    assert.equal(values.length, 2, field + ' has two values');
    assert.equal(config.primeTeam[field], values[0], field + ' is Prime\'s first value');
    assert.equal(classOf(field, values[0]), '', 'Prime\'s value has no class');
    assert.ok(/^[a-z]+(-[a-z]+)+$/.test(classOf(field, values[1])), 'the other value has a class of words and hyphens');
  });
  assert.deepEqual(Object.values(config.teamTrim).map(choices => Object.values(choices)[1]),
    ['bolts-round', 'corner-cut-tr', 'header-slant', 'grid-dots', 'pose-flight', 'name-outline', 'ticker-bar', 'accent-neon']);
  assert.deepEqual(teams.trimClasses, ['bolts-round', 'corner-cut-tr', 'header-slant', 'grid-dots', 'pose-flight', 'name-outline', 'ticker-bar', 'accent-neon']);
});

test('the sample content gives each team all eight, Prime the usual ones and Nova the other of each', () => {
  assert.ok(primeTeam && novaTeam, 'the sample has Prime and Nova');
  trimFields.forEach(field => {
    const values = Object.keys(config.teamTrim[field]);
    assert.equal(primeTeam[field], values[0], 'Prime ' + field);
    assert.equal(novaTeam[field], values[1], 'Nova ' + field);
  });
  assert.deepEqual(trimFields.map(field => novaTeam[field]), ['round', 'tr-bl', 'slant', 'dots', 'flight', 'outline', 'bar', 'neon']);
});

test('rendered in sample mode, the page of Prime and the page of Nova differ in the classes of every field, and in the mirror', async () => {
  const classes = {};

  for (const code of ['prime', 'nova']) {
    const page = makePage();
    await withGlobals({ document: { documentElement: page } }, async () => {
      const instance = await import(urlOf(mainTree, 'dashboard/core/teams.js') + '?sample=' + code);
      instance.useTeams({ teams: sampleTeams, settings: { teamMode: code, alternateMinutes: 5 } }, new Date(0));
      assert.equal(instance.currentTeam().code, code);
    });
    classes[code] = page.classes();
  }

  assert.deepEqual(classes.prime, [], 'Prime has no class on the page');
  trimFields.forEach(field => {
    const own = classes.nova.filter(name => Object.values(config.teamTrim[field]).includes(name));
    assert.deepEqual(own, [classOf(field, novaTeam[field])], field + ': Nova has the class of its value, and Prime has none, so the classes differ');
  });
  assert.deepEqual(classes.nova, ['accent-neon', 'bolts-round', 'corner-cut-tr', 'grid-dots', 'header-slant', 'mirrored', 'name-outline', 'pose-flight', 'ticker-bar']);
});

test('the classes of a team are cleared and replaced when the team changes, together with the mirror', async () => {
  const page = makePage();
  const withNova = () => teams.applyTeamLook(novaTeam, page);
  const withPrime = () => teams.applyTeamLook(primeTeam, page);

  withNova();
  assert.equal(page.classes().length, 9, 'the mirror and the eight');
  withPrime();
  assert.deepEqual(page.classes(), [], 'all of them gone');
  withNova();
  withNova();
  assert.equal(page.classes().length, 9, 'a team that is put on again changes nothing');

  // a team that has some of them: the others come off
  teams.applyTeamLook(Object.assign({}, primeTeam, { bolts: 'round', grid: 'dots' }), page);
  assert.deepEqual(page.classes(), ['bolts-round', 'grid-dots']);
  teams.applyTeamLook(Object.assign({}, novaTeam, { bolts: 'hex' }), page);
  assert.ok(!page.classes().includes('bolts-round') && page.classes().includes('mirrored') && page.classes().includes('accent-neon'));

  // a page that is not given, or has no classes to write on, is left alone
  assert.doesNotThrow(() => teams.applyTeamLook(novaTeam, null));
  assert.doesNotThrow(() => teams.applyTeamLook(novaTeam, { style: { setProperty() {} }, classList: { add() {}, remove() {} } }));
});

test('a team document with no trim fields, or values that are not in the list, is Prime: no class and the usual frames', () => {
  const plain = normalized({});
  trimFields.forEach(field => assert.equal(plain[field], config.primeTeam[field], field));
  assert.deepEqual(teams.trimClassesOf(plain), []);
  assert.deepEqual(teams.frameTrim(plain), { corner: 'tl', notch: 'step' });

  const odd = normalized({ bolts: 'Round', cornerCut: 7, headerNotch: null, grid: ['dots'], logoPose: 'toString', nameStyle: ' outline ', tickerLabel: '', countAccent: 'neon\n' });
  assert.deepEqual(trimFields.map(field => odd[field]), ['hex', 'tl-br', 'step', 'lines', 'auto', 'outline', 'plate', 'neon'], 'a value is the Prime one unless it is exactly one of the two, and spaces at its ends are dropped');

  assert.deepEqual(teams.trimClassesOf(config.primeTeam), []);
  assert.deepEqual(teams.trimClassesOf(null), [], 'no team is Prime');
  assert.deepEqual(teams.trimClassesOf({ bolts: 'round' }), ['bolts-round']);
  assert.equal(teams.trimClassesOf(novaTeam).length, 8);
});

test('the corners and the tab that the frames are drawn for are the team\'s, and the page writes down which frames it has drawn', () => {
  assert.deepEqual(teams.frameTrim(primeTeam), { corner: 'tl', notch: 'step' });
  assert.deepEqual(teams.frameTrim(novaTeam), { corner: 'tr', notch: 'slant' });
  assert.deepEqual(teams.frameTrim(Object.assign({}, novaTeam, { headerNotch: 'step' })), { corner: 'tr', notch: 'step' }, 'each is its own');
  assert.deepEqual(teams.frameTrim(Object.assign({}, novaTeam, { cornerCut: 'tl-br' })), { corner: 'tl', notch: 'slant' });
  assert.deepEqual(teams.frameTrim(null), { corner: 'tl', notch: 'step' });

  const page = makePage();
  assert.deepEqual(teams.trimNow(page), { corner: 'tl', notch: 'step' }, 'a page that has drawn nothing has the usual frames');
  teams.recordTrim({ corner: 'tr', notch: 'slant' }, page);
  assert.deepEqual(page.dataset, { corners: 'tr', notch: 'slant' });
  assert.deepEqual(teams.trimNow(page), { corner: 'tr', notch: 'slant' });
  teams.recordTrim({ corner: 'tl', notch: 'slant' }, page);
  assert.deepEqual(page.dataset, { notch: 'slant' }, 'the usual corners are written as nothing, like the corners of a style');
  teams.recordTrim({ corner: 'tl', notch: 'step' }, page);
  assert.deepEqual(page.dataset, {});
  assert.doesNotThrow(() => teams.recordTrim({ corner: 'tr', notch: 'slant' }, null));
  assert.deepEqual(teams.trimNow(null), { corner: 'tl', notch: 'step' });
});


// The names of the frames

const regions = ['grid1', 'grid2', 'ticker', 'banner', 'countdown'];
const layouts = ['standard', 'sidebar', 'bar'];
const styles = ['', 'cybertron', 'minimal', 'oops'];
const novaTrim = { corner: 'tr', notch: 'slant' };
const primeTrim = { corner: 'tl', notch: 'step' };

// Every frame the page draws, and the ones among them that have a header tab
const framed = ['grid1', 'grid2', 'countdown', 'cybertron-grid1', 'cybertron-grid2', 'cybertron-banner', 'cybertron-ticker', 'bar-main', 'bar-banner', 'bar-ticker', 'bar-main-minimal', 'bar-banner-minimal', 'bar-ticker-minimal'];
const headed = ['grid1', 'grid2', 'cybertron-grid1', 'cybertron-grid2', 'bar-main', 'bar-main-minimal'];

test('with the usual trim, or none, every frame has the name it has always had, and with Nova\'s the frames that exist gain -tr and the ones with a tab -slant', () => {
  const seen = new Set();

  layouts.forEach(layout => styles.forEach(style => regions.forEach(region => {
    const kind = plate.frameKind(region, layout, style);
    seen.add(kind);

    assert.equal(plate.frameKind(region, layout, style, {}), kind);
    assert.equal(plate.frameKind(region, layout, style, primeTrim), kind, 'the usual trim is no change to ' + kind);
    assert.equal(plate.frameKind(region, layout, style, undefined), kind);
    assert.equal(plate.frameKind(region, layout, style, null), kind);

    const expected = framed.includes(kind) ? kind + '-tr' + (headed.includes(kind) ? '-slant' : '') : kind;
    assert.equal(plate.frameKind(region, layout, style, novaTrim), expected, layout + ' ' + style + ' ' + region);
    assert.equal(plate.frameKind(region, layout, style, { corner: 'tr', notch: 'step' }), framed.includes(kind) ? kind + '-tr' : kind);
    assert.equal(plate.frameKind(region, layout, style, { corner: 'tl', notch: 'slant' }), headed.includes(kind) ? kind + '-slant' : kind);
  })));

  framed.forEach(kind => assert.ok(seen.has(kind), 'the table of frames has ' + kind));
  assert.equal(plate.trimmedKind('banner', novaTrim), 'banner', 'a banner with no plate has no frame to turn');
  assert.equal(plate.trimmedKind('oops', novaTrim), 'oops', 'and a name that is no frame is given back');
  assert.equal(plate.trimmedKind('countdown', novaTrim), 'countdown-tr', 'the countdown has no tab');
});


// The frames with the other corners and the slanted tab

// The ten frames of the bar layout and Cybertron, as shapes
const barKinds = framed.filter(kind => kind.startsWith('bar-') || kind.startsWith('cybertron-'));

test('every frame of the bar layout and of Cybertron with the other corners is the Prime frame turned across: the same points, and the bolts, rivets and rust on the points that were turned', async () => {
  await withPlatePage(() => {
    barKinds.forEach(kind => {
      const prime = plate.barShape(kind);
      const turned = plate.barShape(kind + '-tr');

      assert.ok(turned, kind + '-tr is a frame');
      assert.notEqual(turned, prime);
      assert.equal(turned.outline.length, prime.outline.length, kind + ' has the same number of points');
      sameSet(turned.outline, turnedAcross(prime.outline, prime.width));
      assert.deepEqual([turned.width, turned.height], [prime.width, prime.height]);

      // the bolts are on the turned points, the same number in each half
      sameSet(turned.screws.a.concat(turned.screws.b), turnedAcross(prime.screws.a.concat(prime.screws.b), prime.width));
      assert.deepEqual([turned.screws.a.length, turned.screws.b.length], [prime.screws.a.length, prime.screws.b.length], kind + ' shares its bolts between the halves as it did');
      turned.screws.a.concat(turned.screws.b).forEach(point => assert.doesNotThrow(() => plate.offsetPoint(turned.outline, point, 10), kind + ' has a bolt off its outline'));

      // the brackets, the conduit and the slashes are drawn at the turned corners
      sameSet(turned.bracketLines.map(line => line[1]), turnedAcross(prime.bracketLines.map(line => line[1]), prime.width));
      assert.equal(turned.art.hazard, prime.art.hazard, 'the stripe under the header runs the whole width, so it is as it was');
      assert.equal(Boolean(turned.art.conduit), Boolean(prime.art.conduit));
      assert.equal(Boolean(turned.art.slashes), Boolean(prime.art.slashes));
      assert.equal(Boolean(turned.art.brackets), Boolean(prime.art.brackets));

      // the neon line, the weld seam and the rivets are drawn for it
      sameSet(turned.neon.a.concat(turned.neon.b), turnedAcross(prime.neon.a.concat(prime.neon.b), prime.width));
      assert.equal(turned.art.weldDark, prime.art.weldDark);
      assert.equal((turned.rivets ? turned.rivets.a.length + turned.rivets.b.length : 0), (prime.rivets ? prime.rivets.a.length + prime.rivets.b.length : 0), kind + ' has as many rivets');
      assert.equal((turned.wear || []).length, (prime.wear || []).length);
      (turned.wear || []).forEach(item => assert.doesNotThrow(() => plate.offsetPoint(turned.outline, item.anchor, 0), kind + ' has rust off its outline'));

      // and so it reaches as far as the Prime frame does, on the other side: a frame that fits the screen in the layout fits in its mirror
      const reach = plate.frameExtent(kind);
      const reachTurned = plate.frameExtent(kind + '-tr');
      assert.ok(Math.abs(reachTurned.left - (prime.width - reach.right)) < .2 && Math.abs(reachTurned.right - (prime.width - reach.left)) < .2, kind + ' reaches across as far as it did');
      assert.ok(Math.abs(reachTurned.top - reach.top) < .2 && Math.abs(reachTurned.bottom - reach.bottom) < .2, kind + ' reaches up and down as far as it did');
    });
  });
});

test('every frame of the bar layout and of Cybertron with the slanted tab has one line at 60 degrees where the tab ends, and with the usual tab nothing changed', async () => {
  await withPlatePage(() => {
    headed.filter(kind => barKinds.includes(kind)).forEach(kind => {
      const prime = plate.barShape(kind);

      ['', '-tr'].forEach(corner => {
        const slanted = plate.barShape(kind + corner + '-slant');
        const usual = plate.barShape(kind + corner);
        const angleOf = shape => {
          const [foot, top] = shape.headerRight; // the line starts at the foot of the end of the tab and goes up to the top
          return Math.atan2(foot[1] - top[1], top[0] - foot[0]) * 180 / Math.PI;
        };

        assert.ok(Math.abs(angleOf(slanted) - 60) < .3, kind + corner + ' ends its tab at ' + angleOf(slanted) + ' degrees');
        assert.ok(Math.abs(angleOf(usual) - 60) > 5, kind + corner + ' with the usual tab does not');
        assert.deepEqual(angleOf(usual), angleOf(prime), 'the usual tab of ' + kind + corner + ' ends as it did in ' + kind);

        // the tab and the plate beside it end on the same two points
        const end = slanted.headerRight.slice(0, 2);
        assert.deepEqual([slanted.tab[slanted.tab.length - 2], slanted.tab[slanted.tab.length - 3]], end, 'the tab ends on the same line as the plate beside it');
        assert.equal(slanted.tab.length, usual.tab.length);
        assert.equal(slanted.art.hazard, usual.art.hazard);
      });

      assert.deepEqual(plate.barShape(kind + '-slant').outline, prime.outline, 'the outline does not change with the tab');
    });

    // Minimal's ticks start 60 past the end of the tab, wherever that is
    const ticks = plate.barShape('bar-main-minimal-slant').art.ticks;
    assert.ok(ticks && ticks !== plate.barShape('bar-main-minimal').art.ticks, 'the ticks follow the tab');
  });
});

test('every frame of Original with the other corners is the Prime frame turned across, with its screws on the ends of the cut corners, and the glint runs on the turned outline', async () => {
  await withPlatePage(read => {
    ['grid1', 'grid2', 'countdown'].forEach(kind => {
      const area = kind === 'countdown' ? plate.plateMarkup(kind) : plate.areaMarkup(kind);
      const turned = kind === 'countdown' ? plate.plateMarkup(kind + '-tr') : plate.areaMarkup(kind + '-tr');
      const defs = read();
      const width = { grid1: 1152, grid2: 656, countdown: 656 }[kind];
      const height = { grid1: 708, grid2: 372, countdown: 320 }[kind];

      // the outline, and the glint that runs round it
      const outline = pointsOf(defs, kind + '-outline');
      const turnedOutline = pointsOf(defs, kind + '-tr-outline');
      assert.equal(turnedOutline.length, outline.length, kind + ' has the same number of points');
      sameSet(turnedOutline, turnedAcross(outline, width));
      assert.ok(turned.includes('href="#' + kind + '-tr-outline"') && !turned.includes('href="#' + kind + '-outline"'), 'the glint runs on the turned outline');

      // the two halves are drawn from the same points, with the screws on the ends of the cuts
      const halves = ['a', 'b'].map(side => pointsOf(defs, kind + '-tr-' + side));
      sameSet(halves[0].concat(halves[1]).filter((point, index, all) => all.findIndex(other => other[0] === point[0] && other[1] === point[1]) === index), turnedOutline); // where the halves meet is in both
      const screws = (turned.match(/<g transform="translate\([^)]+\)">(?:<use class="screw-shadow"[^>]*>)?<use class="screw"/g) || []).map(text => /translate\(([\d.]+) ([\d.]+)\)/.exec(text).slice(1, 3).map(Number));
      assert.equal(screws.length, (area.match(/<use class="screw"/g) || []).length, 'the same number of screws');
      screws.forEach(point => {
        assert.ok(point[0] < width / 2 !== point[1] < height / 2, 'a screw at ' + point + ' is at the top right or the bottom left');
        assert.ok(turnedOutline.some(corner => corner[0] === point[0] && corner[1] === point[1]), 'on a point of the outline');
      });
      assert.notEqual(turned, area);
    });
  });
});

// The pieces of a frame, as the markup draws them: the name of each, and the screws, rivets and rust it holds
function piecesOf(markup) {
  return markup.split('<svg class="plate piece"').slice(1).map(text => ({
    name: /data-piece="([^"]+)"/.exec(text)[1],
    screws: (text.match(/<use class="(?:screw|screw-shadow)"/g) || []).filter(use => use === '<use class="screw"').length,
    rivets: (text.match(/class="rivets"/g) || []).length,
    markup: text,
  }));
}

test('the frames of the mechanical page change keep the pieces they had, with the same names in the same order, and each screw, rivet and patch of rust is in one piece', async () => {
  await withPlatePage(() => {
    ['grid1', 'grid2', 'cybertron-grid1', 'cybertron-grid2', 'bar-main', 'bar-main-minimal'].forEach(kind => {
      const prime = piecesOf(plate.areaMarkup(kind));
      assert.ok(prime.length >= 12, kind + ' has its pieces');

      ['-tr', '-slant', '-tr-slant'].forEach(suffix => {
        const turned = piecesOf(plate.areaMarkup(kind + suffix));
        assert.deepEqual(turned.map(piece => piece.name), prime.map(piece => piece.name), kind + suffix + ' has the same pieces in the same order');
        assert.equal(turned.reduce((all, piece) => all + piece.screws, 0), prime.reduce((all, piece) => all + piece.screws, 0), kind + suffix + ' has every screw in a piece, once');
        assert.equal(turned.reduce((all, piece) => all + piece.rivets, 0), prime.reduce((all, piece) => all + piece.rivets, 0), kind + suffix + ' has every row of rivets in a piece');

        // frame.css has a line for each name, so every piece moves
        turned.forEach(piece => assert.ok(read('dashboard/frame.css').includes('[data-piece="' + piece.name + '"]'), piece.name + ' has a line in frame.css'));
      });

      // with the other corners the screws are in the pieces for the top right and the bottom left corners
      const holding = piecesOf(plate.areaMarkup(kind + '-tr')).filter(piece => piece.screws > 0).map(piece => piece.name);
      assert.ok(holding.includes('edge-top-right') && holding.includes('edge-bottom-left'), kind + ' has screws in the pieces for the top right and the bottom left: ' + holding);
    });

    // the pieces of a bar frame have every point on the outline, and the line along the notch is the slant
    barKinds.filter(kind => plate.barShape(kind).pieces.length > 0).forEach(kind => ['-tr', '-slant', '-tr-slant'].forEach(suffix => {
      const shape = plate.barShape(kind + suffix);
      shape.pieces.filter(piece => piece.line).forEach(piece => piece.line.forEach(point => assert.doesNotThrow(() => plate.offsetPoint(shape.outline, point, 0), kind + suffix + ' ' + piece.name + ' has a point off the outline')));
    }));
  });
});

test('the large and the small frame with the slanted tab end it on one line at 60 degrees, in the plates, the seam and the pieces, and nothing else about them changes', async () => {
  await withPlatePage(read => {
    ['grid1', 'grid2'].forEach(kind => {
      const usual = plate.areaMarkup(kind);
      const slanted = plate.areaMarkup(kind + '-slant');
      const defs = read();

      // the seam is the line that ends the tab: M x y L x y
      const seam = /<path id="([a-z0-9-]+)-seams"[^>]* d="([^"]+)"/g;
      const found = {};
      defs.replace(seam, (all, id, data) => { found[id] = data.split('M').filter(Boolean).map(part => part.split('L').map(pair => pair.split(' ').map(Number))); return all; });
      const end = found[kind + '-slant'][1];
      assert.equal(end.length, 2, 'the end of the tab is one line');
      assert.ok(Math.abs(Math.atan2(end[1][1] - end[0][1], end[0][0] - end[1][0]) * 180 / Math.PI - 60) < .3, kind + ' ends its tab at 60 degrees');
      assert.deepEqual(found[kind + '-slant'][0], found[kind][0], 'the line under the header is as it was');
      assert.ok(found[kind][1].length >= 2);

      // the plates of the header have the slant, and the body and the outline are as they were
      assert.deepEqual(pointsOf(defs, kind + '-slant-outline'), pointsOf(defs, kind + '-outline'));
      assert.deepEqual(pointsOf(defs, kind + '-slant-a'), pointsOf(defs, kind + '-a'));
      assert.ok(slanted.includes(end[1].join(',')), 'the slant is in the plate of the tab');
      assert.notEqual(slanted, usual);
      assert.deepEqual(piecesOf(slanted).map(piece => piece.name), piecesOf(usual).map(piece => piece.name));
    });
  });
});

test('the full screen frame and the war clock\'s housing have the other corners turned across, and the usual ones are unchanged', async () => {
  await withPlatePage(read => {
    const usual = plate.frameMarkup({ red: true });
    assert.equal(plate.frameMarkup({ red: true, corner: 'tl' }), usual);
    assert.equal(plate.frameMarkup({ red: true, corner: undefined }), usual);
    const turned = plate.frameMarkup({ red: true, corner: 'tr' });
    const defs = read();
    sameSet(pointsOf(defs, 'screen-tr-a').concat(pointsOf(defs, 'screen-tr-b')), turnedAcross(pointsOf(defs, 'screen-a').concat(pointsOf(defs, 'screen-b')), 1920));
    assert.ok(turned.includes('href="#screen-tr-a"') && !turned.includes('href="#screen-a"'));
    assert.deepEqual(turned.match(/class="body" points="([^"]+)"/)[1].split(' ').length, 6);

    ['narrow', 'wide'].forEach(form => {
      const housing = plate.warHousingMarkup(form);
      assert.equal(plate.warHousingMarkup(form, {}), housing);
      assert.equal(plate.warHousingMarkup(form, primeTrim), housing, 'the usual corners are the housing it has always had');
      assert.equal(plate.warHousingMarkup(form, { corner: 'tl', notch: 'slant' }), housing, 'a tab changes nothing here');
      const other = plate.warHousingMarkup(form, novaTrim);
      const size = { narrow: 700, wide: 616 }[form];

      assert.ok(!/NaN|undefined/.test(other));
      const outlineOf = markup => /class="war-housing-fill" points="([^"]+)"/.exec(markup)[1].split(' ').map(pair => pair.split(',').map(Number));
      sameSet(outlineOf(other), turnedAcross(outlineOf(housing), size));
      const rivets = markup => (markup.match(/class="war-rivet" d="([^"]+)"/)[1].match(/M[\d.]+ [\d.]+a/g) || []).map(text => /M([\d.]+) ([\d.]+)a/.exec(text).slice(1).map(Number)).map(point => [point[0] + 5, point[1]]); // the centres
      sameSet(rivets(other), turnedAcross(rivets(housing), size));
      assert.notEqual(other, housing);
    });
  });
});


// The rules

test('every rule in trim.css is for one of the eight classes, apart from the bolts, whose fallbacks are the usual shapes: Prime is drawn as it always was', () => {
  const css = withoutComments(read('dashboard/trim.css'));
  const rules = [];
  css.replace(/([^{}]+)\{([^{}]*)\}/g, (all, list, body) => {
    rules.push({ selectors: list.split(',').map(selector => selector.trim()), body: body.replace(/\s+/g, ' ').trim() });
    return all;
  });
  const classes = teams.trimClasses.map(name => '.' + name);
  const usual = [];

  rules.forEach(rule => {
    rule.selectors.forEach(selector => {
      const named = classes.filter(name => new RegExp(name.replace('.', '\\.') + '(?![a-z-])').test(selector));
      if (named.length > 0) return;
      usual.push(selector);
    });
  });

  // the rules that name no class are the shapes of the rivet, and they say what the usual page has: the hex parts are shown, the round ones are not
  assert.deepEqual(usual, ['.screw-rim', '.screw-face', '.screw-ridge', '.screw-slot', '.bolt-rim', '.bolt-face', '.bolt-dot', '.rivet-rim', '.rivet-face', '.rivet-slot', '.rivet-rim', '.rivet-face', '.rivet-slot']);
  const bodyOf = selector => rules.filter(rule => rule.selectors.includes(selector)).map(rule => rule.body).join(' ');
  assert.ok(bodyOf('.bolt-dot').includes('display: var(--hex-part, inline);'), 'the hex parts are shown unless the class says otherwise');
  assert.ok(bodyOf('.rivet-slot').includes('display: var(--rivet-part, none);'), 'the round parts are hidden unless the class says otherwise');
  assert.ok(bodyOf('.rivet-rim').includes('fill: var(--screw-rim);') && bodyOf('.rivet-face').includes('fill: var(--screw-face);') && bodyOf('.rivet-slot').includes('fill: var(--screw-slot);'), 'the rivet has the colors of the screw');

  // the classes are all read, and only these. The tab with one slant is drawn by plate.js and has nothing left to do here
  const drawnByPlate = ['header-slant'];
  const named = new Set((css.match(/html\.[a-z-]+/g) || []).map(text => text.slice(5)));
  assert.deepEqual(Array.from(named).sort(), teams.trimClasses.filter(name => !drawnByPlate.includes(name)).sort(), 'trim.css reads each class that is left, and names no other class of the page');

  // nothing moves, and nothing glows
  assert.ok(!/animation|transition|@keyframes|filter|box-shadow|text-shadow|blur|drop-shadow/.test(css), 'trim.css is still: no animation, shadow or filter');
  assert.deepEqual(css.match(/transform: [^;]+;/g), [
    'transform: scaleX(-1);',
    'transform: var(--lens) var(--view) translate(-30px, -137px) rotate3d(320, -50, 0, 134deg) translate(30px, 137px);',
    'transform: var(--lens) var(--view) translate(140px, -161px) rotate3d(160, -18, 0, -134deg) translate(-140px, 161px);',
  ], 'the card is turned across and the wings are put in their pose, and nothing else is turned');
  assert.ok(!/(^|[^a-z-])font[:-]|font-size|line-height/.test(css), 'and no text is made smaller');
});

test('the flight pose is the pose of a logo asked to fly in calm motion (frame.css), and it is only for the logo at rest, at the start and in the spin', () => {
  const css = withoutComments(read('dashboard/trim.css'));
  const frame = withoutComments(read('dashboard/frame.css'));
  const wings = { near: 'translate(-30px, -137px) rotate3d(320, -50, 0, 134deg) translate(30px, 137px)', far: 'translate(140px, -161px) rotate3d(160, -18, 0, -134deg) translate(-140px, 161px)' };

  assert.ok(frame.includes('.logo[data-act="fly"] .hawk-near-wing { transform: var(--lens) var(--view) ' + wings.near + '; }'), 'the pose of the near wing is the one in frame.css');
  assert.ok(frame.includes('.logo[data-act="fly"] .hawk-far-wing { transform: var(--lens) var(--view) ' + wings.far + '; }'));
  assert.ok(css.includes(wings.near) && css.includes(wings.far));

  const selectors = [];
  css.replace(/([^{}]+)\{[^{}]*\}/g, (all, list) => { list.split(',').map(text => text.trim()).filter(text => text.startsWith('html.pose-flight')).forEach(text => selectors.push(text)); return all; });
  assert.ok(selectors.length > 0);
  selectors.forEach(selector => assert.ok(/^html\.pose-flight \.logo(:not\(\[data-act\]\)|\[data-act="(rest|boot|turn)"\]) \.(emblem|hawk-part|hawk-near-wing|hawk-far-wing)$/.test(selector), selector));
  assert.ok(!/data-act="(robot|hawk-in|flight|hawk-out|fly)"/.test(css), 'the hawk\'s own acts are not touched');
});

test('the shapes of the screw and of the bolt hold a round rivet with a slot as well, and the link to trim.css comes after the styles', () => {
  const html = read('dashboard/index.html');
  ['screw-shape', 'bolt-shape'].forEach(id => {
    const start = html.indexOf('<g id="' + id + '">');
    const shape = html.slice(start, html.indexOf('</g>', start));
    ['rivet-rim', 'rivet-face', 'rivet-slot'].forEach(name => assert.equal((shape.match(new RegExp('class="' + name + '"', 'g')) || []).length, 1, id + ' has one ' + name));
  });
  const link = name => html.indexOf('href="' + name + '"');
  assert.ok(link('trim.css') > link('styles/minimal.css') && link('trim.css') > link('base.css') && link('trim.css') > link('teams.css'), 'it reads the team colors, and wins over the styles it is as strong as');
  assert.equal(html.split('href="trim.css"').length - 1, 1);
});


// The page draws the frames for the team

// Elements that remember where they are in the tree: just enough of a page for core/areas.js
function fakeElement(name) {
  const element = {
    name: name,
    dataset: {},
    children: [],
    className: '',
    classList: { contains: token => element.className.split(/\s+/).includes(token) },
    remove() {
      if (element.parent) element.parent.children.splice(element.parent.children.indexOf(element), 1);
      element.parent = null;
    },
    appendChild(child) {
      child.parent = element;
      element.children.push(child);
    },
    insertAdjacentHTML(where, markup) {
      assert.equal(where, 'afterbegin');
      const child = fakeElement('markup');
      child.markup = markup;
      child.parent = element;
      element.children.unshift(child);
    },
    querySelector: selector => (selector === '.page-host' ? element.children.filter(child => child.className === 'page-host')[0] || null : null),
  };
  return element;
}

async function onAreas(run) {
  const folder = makeTree('areas', baseFiles);
  const html = makePage();
  html.dataset.layout = 'standard';
  html.dataset.style = 'original';
  const regions = {};
  const known = new Set();
  const page = {
    documentElement: html,
    getElementById: id => {
      if (id === 'metal-shapes') return { insertAdjacentHTML: (where, markup) => (markup.match(/ id="[^"]+"/g) || []).forEach(found => known.add(found.slice(5, -1))) };
      if (id.startsWith('region-')) {
        if (!regions[id]) regions[id] = fakeElement(id);
        return regions[id];
      }
      return known.has(id) ? {} : null;
    },
    createElement: () => {
      const element = fakeElement('area');
      let markup = '';
      Object.defineProperty(element, 'innerHTML', { get: () => markup, set: value => {
        markup = value;
        element.children.length = 0;
        const frame = fakeElement('frame');
        frame.markup = value.replace('<div class="page-host"></div>', '');
        const host = fakeElement('page-host');
        host.className = 'page-host';
        [frame, host].forEach(child => element.appendChild(child));
      } });
      return element;
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    fonts: null,
  };

  await withGlobals({ document: page, setTimeout: () => 0, setInterval: () => 0 }, async () => {
    const world = { html: html, regions: regions };
    world.frameModule = await import(urlOf(folder, 'dashboard/frame.js'));
    world.areas = await import(urlOf(folder, 'dashboard/core/areas.js'));
    world.style = await import(urlOf(folder, 'dashboard/core/style.js'));
    world.teams = await import(urlOf(folder, 'dashboard/core/teams.js'));
    await run(world);
  });
}

test('redrawFrames puts the frame for the trim of the team on the page round each area, and back again, leaving its page where it is', async () => {
  await onAreas(async world => {
    world.frameModule.start({ motion: 'full', speed: 'normal' });
    const pageOf = text => ({ element: { id: text }, id: text });
    const started = world.areas.changePage('grid1', pageOf('tasks'));
    await Promise.race([started, new Promise(resolve => setImmediate(resolve))]);
    const area = world.regions['region-grid1'].children[0];
    const host = area.children.filter(child => child.className === 'page-host')[0];

    assert.equal(area.dataset.frame, 'grid1');
    world.areas.redrawFrames();
    assert.equal(area.dataset.frame, 'grid1', 'nothing was written, so it is the frame it was');

    // Nova goes on: its classes, and then the corners and the tab the frames are drawn for
    world.teams.applyTeamLook(novaTeam, world.html);
    assert.equal(area.dataset.frame, 'grid1', 'the frame is drawn again when the page says so, not when the classes change');
    world.teams.recordTrim(world.teams.frameTrim(novaTeam), world.html);
    world.areas.redrawFrames();
    assert.equal(area.dataset.frame, 'grid1-tr-slant');
    assert.ok(area.children[0].markup.includes('grid1-tr-slant-a'), 'the frame is the one for the other corners and the slanted tab');
    assert.equal(area.children.filter(child => child.className === 'page-host')[0], host, 'the page host is the same one');
    assert.equal(area.children.length, 2, 'the old frame is gone');

    // with Cybertron and then Minimal's frames the trim goes with them
    world.html.dataset.layout = 'standard';
    world.style.recordShapes('cybertron', world.html);
    world.areas.redrawFrames();
    assert.equal(area.dataset.frame, 'cybertron-grid1-tr-slant');

    // back to Prime: the usual frames
    world.teams.applyTeamLook(primeTeam, world.html);
    world.teams.recordTrim(world.teams.frameTrim(primeTeam), world.html);
    world.areas.redrawFrames();
    assert.equal(area.dataset.frame, 'cybertron-grid1');
    world.style.recordShapes('original', world.html);
    world.areas.redrawFrames();
    assert.equal(area.dataset.frame, 'grid1');
    assert.deepEqual(world.html.classes(), []);
    assert.deepEqual(['shapes', 'corners', 'notch'].filter(name => world.html.dataset[name] !== undefined), [], 'the page is as it was before the team');
  });
});

test('the panels that draw a frame of their own, and the areas, ask for the trim the page was last drawn with, and the page draws them again when the team goes on', () => {
  const readSource = file => read('dashboard/' + file);

  assert.ok(readSource('panels/banner/banner.js').includes("frameKind('banner', layoutNow(), shapesNow(), trimNow())"));
  assert.ok(readSource('panels/bar-banner/bar-banner.js').includes("plateMarkup(frameKind('banner', 'bar', shapesNow(), trimNow()))"));
  const countdown = readSource('panels/countdown/countdown.js');
  assert.ok(countdown.includes("const kind = trimmedKind('countdown', trimNow());") && countdown.includes('${plateMarkup(kind)}') && countdown.includes('${scanMarkup(kind)}'), 'the frame and the sweep of light are for the same corners');
  assert.ok(countdown.includes("warHousingMarkup(wide ? 'wide' : 'narrow', trimNow())"), 'and so is the war clock\'s housing');
  assert.ok(readSource('panels/alert/alert.js').includes('frameMarkup({ red: true, corner: trimNow().corner })'));
  assert.ok(readSource('panels/announcement/announcement.js').includes('frameMarkup({ corner: trimNow().corner })'));
  const areas = readSource('core/areas.js');
  assert.equal(areas.split('frameKind(region, layoutNow(), shapesNow(), trimNow())').length - 1, 2, 'an area is made, and drawn again, for the trim');

  // the page: the frames follow the team in the step that puts it on, before the banner and the events are drawn for it
  const shell = readSource('shell.js');
  assert.ok(shell.indexOf('onTeamChange(useTrim);') !== -1 && shell.indexOf('onTeamChange(useTrim);') < shell.indexOf('onTeamChange(() => {'), 'the frames come first');
  const body = /function useTrim\(\) \{([\s\S]*?)\n\}/.exec(shell)[1];
  assert.ok(body.indexOf('frameTrim(currentTeam())') < body.indexOf('recordTrim(wanted);') && body.indexOf('recordTrim(wanted);') < body.indexOf('redrawFrames();') && body.indexOf('redrawFrames();') < body.indexOf('redrawPlates();'), 'the trim, then the corners the page has, then the areas, then the panels that draw their own');
  assert.ok(body.includes('if (wanted.corner === drawn.corner && wanted.notch === drawn.notch) return;'), 'a team with the trim the page has changes nothing');
  assert.ok(body.includes("console.error('Could not draw the frames for the team', error);"), 'a problem here never stops the team going on');
  const plates = /function redrawPlates\(\) \{([\s\S]*?)\n\}/.exec(shell)[1];
  assert.ok(plates.includes("id === 'countdown' || id === 'bar-banner' || (id === 'banner' && shapesNow() === 'cybertron')"), 'the panels with a plate, which are the countdown, the banner of the bar layout and the banner of Cybertron');
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
