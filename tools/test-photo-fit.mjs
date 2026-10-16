// Tests for how the Photo panel fits a photo to its body (dashboard/core/photos.js,
// core/images.js, core/sanity.js, core/content.js and panels/photo): the Photo fit setting, the Fit
// of one photo, the photo that fills the body of the panel, cut to the frame on screen, and the
// caption and credit on their plate. The plain functions are run for real. The panel is run against a
// fake page that records what it draws. The stylesheets are checked by reading them, because the
// picture needs a browser to be seen. How many photos a turn shows is in tools/test-photo-pages.mjs.
//
//   node tools/test-photo-fit.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const sampleFile = path.join(dashboardFolder, 'data/sample/content.json');
const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-photo-fit-'));
const root = path.join(workFolder, 'dashboard');
fs.mkdirSync(path.join(root, 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
fs.copyFileSync(path.join(dashboardFolder, 'config.js'), path.join(root, 'config.js'));
fs.copyFileSync(path.join(dashboardFolder, 'registry.js'), path.join(root, 'registry.js'));
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, 'core', file), path.join(root, 'core', file));
});
['themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(root, file));
});
fs.mkdirSync(path.join(root, 'panels/photo'), { recursive: true });
fs.copyFileSync(path.join(dashboardFolder, 'panels/photo/panel.js'), path.join(root, 'panels/photo/panel.js'));

const base = pathToFileURL(root).href + '/';
const config = await import(base + 'config.js');
const content = await import(base + 'core/content.js');
const images = await import(base + 'core/images.js');
const photos = await import(base + 'core/photos.js');
const plate = await import(base + 'core/plate.js');
const sanity = await import(base + 'core/sanity.js');
const photoPanel = await import(base + 'panels/photo/panel.js');

const { fitOf } = photos;

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

// plate.js draws each frame's shapes once into a hidden group of the page. This
// stands in for the page, so a frame can be drawn to read its body from the markup.
function withFakePage(run) {
  globalThis.document = {
    getElementById: () => ({ insertAdjacentHTML: () => {} }),
  };

  try {
    return run();
  } finally {
    delete globalThis.document;
  }
}

// The panel draws into a host, finds the pictures in it to listen for the ones that fail, and starts
// loading the first photo of the next turn with an image
function fakeHost() {
  return { innerHTML: '', querySelectorAll: () => [] };
}

function mountAll(settings, list) {
  const host = fakeHost();
  globalThis.Image = class {};
  try {
    photoPanel.mount(host, { photos: list, settings: settings });
  } finally {
    delete globalThis.Image;
  }
  return host.innerHTML;
}

function mount(settings, photo) {
  return mountAll(settings, [photo]);
}

const photoBase = 'https://cdn.sanity.io/images/abc123/production/0123abcd-800x600.jpg';
const photoRecord = changes => Object.assign({
  url: photoBase,
  width: 800,
  height: 600,
  crop: { left: 0, right: 0, top: 0, bottom: 0 },
  hotspot: { x: 0.5, y: 0.5 },
}, changes);

// The rule of a selector in a stylesheet, or '' when there is none
function ruleOf(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = new RegExp('(?:^|[}\\s])' + escaped + '\\s*\\{([^}]*)\\}').exec(css);
  return found ? found[1] : '';
}

// The setting and the choices

test('photoFits and the starting value: fill, as the panel always drew a photo', () => {
  assert.deepEqual(config.photoFits, ['fill', 'whole']);
  assert.equal(config.defaultSettings.photoFit, 'fill');
});

test('the Photo fit setting keeps fill and whole, and anything else is fill', () => {
  ['fill', 'whole'].forEach(name => {
    const settings = { photoFit: name };
    content.fixSettingValues(settings);
    assert.equal(settings.photoFit, name);
    assert.equal(content.withDefaults({ settings: { photoFit: name } }).settings.photoFit, name);
    assert.equal(sanity.normalizeContent({ settings: { photoFit: name } }).settings.photoFit, name);
  });

  [undefined, null, '', 'Whole', 'setting', 'cover', 1, true, {}, []].forEach(value => {
    const settings = { photoFit: value };
    content.fixSettingValues(settings);
    assert.equal(settings.photoFit, 'fill', JSON.stringify(value));
  });
  assert.equal(content.withDefaults({}).settings.photoFit, 'fill');
  assert.equal(sanity.normalizeContent({}).settings.photoFit, 'fill');
});

test('fitOf: the fit of a photo is its own when it is fill or whole, and otherwise the setting', () => {
  assert.equal(fitOf({ fit: 'whole' }, 'fill'), 'whole');
  assert.equal(fitOf({ fit: 'fill' }, 'whole'), 'fill');
  assert.equal(fitOf({ fit: 'whole' }, 'whole'), 'whole');
  assert.equal(fitOf({ fit: 'fill' }, 'fill'), 'fill');

  // no fit, setting, or something that is neither: the setting
  [undefined, null, '', 'setting', 'cover', 'WHOLE', 3, {}].forEach(value => {
    assert.equal(fitOf({ fit: value }, 'whole'), 'whole', JSON.stringify(value));
    assert.equal(fitOf({ fit: value }, 'fill'), 'fill', JSON.stringify(value));
  });
  assert.equal(fitOf({}, 'whole'), 'whole');
  assert.equal(fitOf(null, 'whole'), 'whole');

  // no setting, or one that is not a fit: the starting value
  [undefined, null, '', 'cover', 7].forEach(value => assert.equal(fitOf({}, value), 'fill', JSON.stringify(value)));
  assert.equal(fitOf({ fit: 'whole' }, 'cover'), 'whole');
});

// The panel

test('the panel draws the photo in the body, with the hotspot when it is cut and the fit it is shown with', () => {
  const photo = { address: 'data/sample/photo-1.svg', caption: '[Caption]', credit: '[Name]', focus: { x: 30, y: 40 } };
  const html = mount({ photoOrder: 'random', photoFit: 'fill' }, photo);

  assert.ok(html.includes('<div class="photo-body" data-slat="item" style="--hold: 16s">'));
  assert.ok(html.includes('<figure class="shot" data-fit="fill" style="--shot: 0">'));
  assert.ok(html.includes('<img src="data/sample/photo-1.svg" style="object-position: 30% 40%" alt="">'));
  assert.equal(html.includes('PHOTOS'), false, 'the panel has no title');
  assert.equal(html.includes('class="header"'), false, 'and no header, so no mark either');

  // shown whole, nothing is cut, so the hotspot is not used
  const whole = mount({ photoFit: 'whole' }, photo);
  assert.ok(whole.includes('<figure class="shot" data-fit="whole" style="--shot: 0">'));
  assert.ok(whole.includes('<img src="data/sample/photo-1.svg" alt="">'));
  assert.equal(whole.includes('object-position'), false);

  // a photo with no hotspot (the sample photos) is centred
  const centred = mount({}, Object.assign({}, photo, { focus: undefined }));
  assert.equal(centred.includes('object-position'), false);
  assert.ok(centred.includes('data-fit="fill"'));

  // the starting settings and the Photo size, which is not used any more, change nothing
  assert.equal(mount(undefined, photo), mount({}, photo));
  assert.equal(mount({ photoScale: 60 }, photo), mount({ photoScale: 100 }, photo));
  assert.equal(mount({ portraitScale: 60 }, photo), mount({}, photo));
});

test('which fit the panel uses: the photo\'s own fit, otherwise the setting, and fill when neither says', () => {
  const photo = changes => Object.assign({ address: 'data/sample/photo-2.svg', caption: '[Caption]', focus: { x: 30, y: 40 } }, changes);
  const isWhole = html => html.includes('data-fit="whole"');

  assert.equal(isWhole(mount({ photoFit: 'whole' }, photo())), true);
  assert.equal(isWhole(mount({ photoFit: 'fill' }, photo())), false);
  assert.equal(isWhole(mount({}, photo())), false, 'no setting is fill');
  assert.equal(isWhole(mount(undefined, photo())), false, 'no settings at all is fill');

  // a photo's own fit wins over the setting
  assert.equal(isWhole(mount({ photoFit: 'fill' }, photo({ fit: 'whole' }))), true);
  assert.equal(isWhole(mount({ photoFit: 'whole' }, photo({ fit: 'fill' }))), false);
  // setting, or something that is not a fit, follows the setting
  ['setting', 'cover', ''].forEach(fit => {
    assert.equal(isWhole(mount({ photoFit: 'whole' }, photo({ fit: fit }))), true, fit);
    assert.equal(isWhole(mount({ photoFit: 'fill' }, photo({ fit: fit }))), false, fit);
  });
});

test('the caption and the credit are on one plate, and there is no plate when both are empty', () => {
  const photo = changes => Object.assign({ address: 'data/sample/photo-1.svg' }, changes);

  const both = mount({}, photo({ caption: '[Caption]', credit: '[Name]' }));
  assert.ok(both.includes('<div class="note"><div class="caption">[Caption]</div><div class="credit">Photo: [Name]</div></div>'));

  const captionOnly = mount({}, photo({ caption: '[Caption]' }));
  assert.ok(captionOnly.includes('<div class="note"><div class="caption">[Caption]</div></div>'));
  assert.equal(captionOnly.includes('class="credit"'), false);

  const creditOnly = mount({}, photo({ credit: '[Name]' }));
  assert.ok(creditOnly.includes('<div class="note"><div class="credit">Photo: [Name]</div></div>'));
  assert.equal(creditOnly.includes('class="caption"'), false);

  ['', '   ', undefined].forEach(empty => {
    const neither = mount({}, photo({ caption: empty, credit: empty }));
    assert.equal(neither.includes('class="note"'), false, JSON.stringify(empty));
  });

  // the credit is a first name even when a last name got in, and the text is made safe
  assert.ok(mount({}, photo({ credit: 'Sam Smith' })).includes('Photo: Sam</div>'));
  assert.ok(mount({}, photo({ caption: '<b>[Caption]</b>' })).includes('&lt;b&gt;[Caption]&lt;/b&gt;'));
});

test('a photo that cannot be loaded is taken out and the others move up, and the panel says so when none is left', () => {
  const shots = [];
  const body = { innerHTML: '', querySelectorAll: () => shots.slice() };
  const makeShot = place => {
    const shot = { place: place, values: {}, parentNode: body, listeners: {} };
    shot.style = { setProperty: (name, value) => { shot.values[name] = value; } };
    shot.remove = () => { shots.splice(shots.indexOf(shot), 1); };
    shot.image = { addEventListener: (type, listener) => { shot.listeners[type] = listener; }, closest: () => shot };
    return shot;
  };
  [0, 1, 2].forEach(place => shots.push(makeShot(place)));
  const all = shots.slice();

  const host = { innerHTML: '', querySelectorAll: selector => (selector === '.shot img' ? all.map(shot => shot.image) : []) };
  globalThis.Image = class {};
  try {
    photoPanel.mount(host, { photos: [1, 2, 3].map(number => ({ address: 'data/sample/photo-' + number + '.svg' })), settings: { photoSeconds: 30 } });
  } finally {
    delete globalThis.Image;
  }
  all.forEach(shot => assert.equal(typeof shot.listeners.error, 'function', 'every picture is listened to'));

  // the second one fails: the third becomes the second, and the first stays where it is
  all[1].listeners.error();
  assert.deepEqual(shots.map(shot => shot.place), [0, 2]);
  assert.deepEqual(shots.map(shot => shot.values['--shot']), [0, 1]);
  assert.equal(body.innerHTML, '');

  // the first fails: the last one is the first
  all[0].listeners.error();
  assert.deepEqual(shots.map(shot => shot.values['--shot']), [0]);

  all[2].listeners.error();
  assert.equal(shots.length, 0);
  assert.equal(body.innerHTML, '<div class="missing">[Photo not available]</div>');
});

test('the first photo of the next turn starts loading while this turn is up, and one that is in this turn does not', () => {
  const loaded = [];
  const mountLoading = (list, settings) => {
    globalThis.Image = class {
      set src(address) { loaded.push(address); }
    };
    try {
      photoPanel.mount(fakeHost(), { photos: list, settings: settings });
    } finally {
      delete globalThis.Image;
    }
  };

  // newest first: d, c, b, a. 16 seconds is two photos of 8, so the first turn is d and c and the next opens with b
  const list = ['a', 'b', 'c', 'd'].map((name, index) => ({ id: name, address: 'data/sample/' + name + '.svg', createdAt: '2026-09-0' + (index + 1) + 'T10:00:00Z' }));
  const settings = { photoOrder: 'newest-first', photoSeconds: 16 };

  mountLoading(list, settings);
  assert.deepEqual(loaded, ['data/sample/b.svg']);
  mountLoading(list, settings);
  assert.deepEqual(loaded, ['data/sample/b.svg', 'data/sample/d.svg']);

  // with one photo there is nothing to load ahead: it is the one on screen
  loaded.length = 0;
  mountLoading([{ address: 'data/sample/only.svg' }], {});
  assert.deepEqual(loaded, []);
});

// The shape of the body, for every frame the large panel can have

// The body polygon of a frame, read from the markup the frame is drawn with
function bodyOf(kind) {
  return withFakePage(() => {
    const found = /<polygon class="body"[^>]*points="([^"]+)"/.exec(plate.areaMarkup(kind));
    assert.ok(found, kind + ' has no body');
    return found[1].split(' ').map(pair => pair.split(',').map(Number));
  });
}

const tenth = number => String(Math.round(number * 10) / 10);

// What panels/photo/panel.css says for a frame: the body cut in by inset from the line of the frame, the corner of
// the body box (4, 120) taken off, and a point near the right measured from the right side of the box
function expectedCut(kind, inset, areaWidth) {
  const inner = plate.offsetOutline(bodyOf(kind), inset);
  const right = areaWidth - 4;
  const point = ([x, y]) => (x < 300 ? tenth(x - 4) + 'px' : 'calc(100% - ' + tenth(right - x) + 'px)') + ' ' + tenth(y - 120) + 'px';
  return 'polygon(' + inner.map(point).join(', ') + ')';
}

// The rules of a stylesheet, as [{ selectors, body }], with the comments taken out
function rulesOfSheet(css) {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return Array.from(plain.matchAll(/([^{}]+)\{([^{}]*)\}/g)).map(match => ({
    selectors: match[1].split(',').map(selector => selector.trim()),
    body: match[2],
  }));
}

// The frames the large panel gets: every layout, style and trim the page can have
function framesOfTheLargePanel() {
  const kinds = new Set();
  ['standard', 'sidebar', 'bar'].forEach(layout => {
    ['', 'cybertron', 'minimal'].forEach(shapes => {
      ['tl', 'tr'].forEach(corner => {
        ['step', 'slant'].forEach(notch => {
          kinds.add(plate.frameKind('grid1', layout, shapes, { corner: corner, notch: notch }));
        });
      });
    });
  });
  return Array.from(kinds);
}

const widthOf = kind => (kind.startsWith('bar-main') ? 1427 : 1152);
const insetOf = kind => (kind.startsWith('grid1') ? 7 : 12);

test('panels/photo/panel.css cuts the body of the photo to the body of each frame the large panel can have', () => {
  const css = read('panels/photo/panel.css');
  const rules = rulesOfSheet(css);
  const kinds = framesOfTheLargePanel();

  assert.deepEqual(kinds.sort(), [
    'bar-main', 'bar-main-minimal', 'bar-main-minimal-slant', 'bar-main-minimal-tr', 'bar-main-minimal-tr-slant', 'bar-main-slant', 'bar-main-tr', 'bar-main-tr-slant',
    'cybertron-grid1', 'cybertron-grid1-slant', 'cybertron-grid1-tr', 'cybertron-grid1-tr-slant',
    'grid1', 'grid1-slant', 'grid1-tr', 'grid1-tr-slant',
  ]);

  kinds.forEach(kind => {
    const selector = '.area[data-frame="' + kind + '"] .photo-body';
    const found = rules.filter(rule => rule.selectors.includes(selector));
    assert.equal(found.length, 1, selector + ' should be in one rule');

    const cut = /clip-path:\s*([^;]+);/.exec(found[0].body);
    assert.ok(cut, selector + ' has no clip-path');
    assert.equal(cut[1], expectedCut(kind, insetOf(kind), widthOf(kind)), 'the cut of ' + kind);
  });

  // the other selectors of the stylesheet that name a frame are frames there are
  rules.forEach(rule => rule.selectors.forEach(selector => {
    const named = /^\.area\[data-frame="([^"]+)"\] \.photo-body$/.exec(selector);
    if (named) assert.ok(kinds.includes(named[1]), named[1] + ' is not a frame the large panel can have');
  }));

  // anything else gets a plain rectangle, and the body is all of the panel under the header
  const body = ruleOf(css, '.photo .photo-body');
  assert.ok(body.includes('clip-path: inset(7px);'));
  ['left: 4px;', 'top: 120px;', 'width: calc(100% - 8px);', 'height: calc(100% - 124px);'].forEach(piece => assert.ok(body.includes(piece), piece));
});

// Is the point inside the polygon (a ray to the right of it crosses an odd number of edges)
function inside(point, polygon) {
  let crossings = 0;
  polygon.forEach((from, index) => {
    const to = polygon[(index + 1) % polygon.length];
    if ((from[1] > point[1]) !== (to[1] > point[1]) && point[0] < from[0] + (point[1] - from[1]) * (to[0] - from[0]) / (to[1] - from[1])) crossings += 1;
  });
  return crossings % 2 === 1;
}

test('the plate of the caption is clear of the cut corners and the steps of every frame, by at least 8px', () => {
  const css = read('panels/photo/panel.css');
  const note = ruleOf(css, '.photo .note');
  const left = Number(/left: (\d+)px;/.exec(note)[1]);
  const bottom = Number(/bottom: (\d+)px;/.exec(note)[1]);
  const width = Number(/max-width: (\d+)px;/.exec(note)[1]);
  const high = 10 + 52 + 38 + 10; // the padding, the caption's line and the credit's line

  // the box of the body starts at (4, 120) and ends 4px from the bottom of the area
  const corners = [[4 + left, 704 - bottom], [4 + left + width, 704 - bottom], [4 + left, 704 - bottom - high], [4 + left + width, 704 - bottom - high]];

  framesOfTheLargePanel().forEach(kind => {
    const clear = plate.offsetOutline(plate.offsetOutline(bodyOf(kind), insetOf(kind)), 8);
    corners.forEach(corner => assert.ok(inside(corner, clear), 'the plate at ' + corner.join(',') + ' in ' + kind));
  });
});

test('the stylesheet shows the photo with cover, or contain when it is shown whole, and sets the sizes of the text', () => {
  const css = read('panels/photo/panel.css');

  assert.ok(ruleOf(css, '.photo .shot img').includes('object-fit: cover;'));
  assert.ok(ruleOf(css, '.photo .shot[data-fit="whole"] img').includes('object-fit: contain;'));
  // a photo shown whole has the color of the body of the frame round it, and nothing drawn
  assert.ok(ruleOf(css, '.photo .shot').includes('background: var(--panel-face);'));
  assert.equal(/border|outline|box-shadow/.test(ruleOf(css, '.photo .shot')), false);

  // the plate is in the color of the team's plates, the caption is 44px and the credit 30px
  assert.ok(ruleOf(css, '.photo .note').includes('background: var(--team-plate);'));
  assert.ok(/\.photo \.caption\s*\{[^}]*font: 500 var\(--size-label\)\/52px/.test(css), 'the caption is not at 44px');
  assert.ok(/\.photo \.credit\s*\{[^}]*font: 500 30px\/38px/.test(css), 'the credit is not at 30px');
  assert.ok(/\.photo \.caption,\s*\.photo \.credit\s*\{[^}]*white-space: nowrap;[^}]*text-overflow: ellipsis;/.test(css), 'a long caption is not cut with three dots');

  assert.equal(/blur|box-shadow|text-shadow|filter|animation|transition/.test(css), false, 'the photo panel uses an effect that is not allowed, or an animation that belongs in frame.css');
});

test('frame.css fades each photo in over the one below at its turn, with opacity only, and at once with motion off', () => {
  const css = read('frame.css');
  const rule = /\.photo \.shot \{ animation: ([^;]+); \}/.exec(css);

  assert.ok(rule, 'frame.css has no rule for .photo .shot');
  assert.equal(rule[1], 'fade-in var(--time-fade-in) linear calc(var(--hold) * var(--shot)) both');
  assert.ok(css.includes('[data-motion="none"] .photo .shot { animation-duration: 0s; }'));
  assert.ok(/@keyframes fade-in\s*\{ from \{ opacity: 0; \} \}/.test(css), 'fade-in is opacity only');
});

// What comes from Studio

test('the query asks for the fit of each photo', () => {
  const block = sanity.contentQuery.slice(sanity.contentQuery.indexOf('"photos": *[_type == "photo"]'), sanity.contentQuery.indexOf('"presentations"'));
  assert.ok(/\n\s+fit,\n/.test(block), 'the photos part does not ask for fit');
  assert.ok(block.includes('"image": image {'));
});

test('a photo from Studio keeps fill or whole, and anything else means it follows the setting', () => {
  const fitOfPhoto = fit => sanity.normalizeContent({ photos: [{ id: 'a1', image: photoRecord(), fit: fit }] }).photos[0].fit;

  assert.equal(fitOfPhoto('fill'), 'fill');
  assert.equal(fitOfPhoto('whole'), 'whole');
  [undefined, null, '', 'setting', 'cover', 'Whole', 1, true, {}].forEach(value => {
    assert.equal(fitOfPhoto(value), undefined, JSON.stringify(value));
  });
  const [plain] = sanity.normalizeContent({ photos: [{ id: 'a1', image: photoRecord(), fit: 'setting' }] }).photos;
  assert.equal('fit' in plain, false);
});

test('a photo from Studio carries the size of the part the editor kept', () => {
  const sizeOf = image => sanity.normalizeContent({ photos: [{ id: 'a1', image: image }] }).photos[0].size;

  assert.deepEqual(sizeOf(photoRecord()), { width: 800, height: 600 });
  assert.deepEqual(sizeOf(photoRecord({ width: 600, height: 900 })), { width: 600, height: 900 });
  // 25 percent off the left and the right of 800 is 400 left, and 10 percent off the top is 540
  assert.deepEqual(sizeOf(photoRecord({ crop: { left: 0.25, right: 0.25, top: 0.1, bottom: 0 } })), { width: 400, height: 540 });
  // a crop that cannot be right is no crop
  assert.deepEqual(sizeOf(photoRecord({ crop: { left: 0.6, right: 0.6, top: 0, bottom: 0 } })), { width: 800, height: 600 });
  // a photo with no usable picture is not in the list at all
  assert.deepEqual(sanity.normalizeContent({ photos: [{ id: 'a1', image: photoRecord({ width: 0 }) }] }).photos, []);
});

test('keptSize gives the kept part in pixels, and null for a picture that cannot be used', () => {
  const { keptSize } = images;

  assert.deepEqual(keptSize(photoRecord()), { width: 800, height: 600 });
  assert.deepEqual(keptSize(photoRecord({ crop: { left: 0, right: 0.5, top: 0.5, bottom: 0 } })), { width: 400, height: 300 });
  [null, undefined, 'text', {}, photoRecord({ url: 'http://example.com/a.jpg' }), photoRecord({ width: -1 }), photoRecord({ height: NaN })].forEach(raw => {
    assert.equal(keptSize(raw), null, JSON.stringify(raw));
  });
});

test('a photo from Studio is asked for no wider than the screen, with the hotspot kept for the cut', () => {
  const [photo] = sanity.normalizeContent({ photos: [{ id: 'a1', caption: '[Caption]', fit: 'whole', image: photoRecord({ hotspot: { x: 0.25, y: 0.75 } }) }] }).photos;

  assert.equal(photo.address, photoBase + '?w=1920&fit=max&auto=format');
  assert.deepEqual(photo.focus, { x: 25, y: 75 });
  assert.ok(mount({}, photo).includes('<figure class="shot" data-fit="whole" style="--shot: 0">'));
});

// The sample content

test('the sample content has photos of different shapes and one that is shown whole, and each picture has the shape it says', () => {
  const raw = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  const shown = sanity.normalizeSample(raw);

  assert.equal(raw.settings.photoFit, 'fill');
  assert.equal(shown.settings.photoFit, 'fill');
  assert.equal(raw.photos.length, 3);

  const shapes = raw.photos.map(photo => photo.size.width / photo.size.height);
  assert.equal(new Set(shapes.map(shape => shape.toFixed(3))).size, 3, 'three different shapes');
  assert.deepEqual(raw.photos.map(photo => photo.fit), [undefined, 'whole', undefined]);

  raw.photos.forEach(photo => {
    const picture = read(photo.address);
    const box = /viewBox="0 0 (\d+) (\d+)"/.exec(picture);
    assert.deepEqual([Number(box[1]), Number(box[2])], [photo.size.width, photo.size.height], photo.address);
  });

  // the cleaning keeps the fit and the size, and the whole photo is the one that is not cut
  assert.deepEqual(shown.photos.map(photo => photo.fit), [undefined, 'whole', undefined]);
  assert.deepEqual(shown.photos.map(photo => photo.size), raw.photos.map(photo => photo.size));
  assert.deepEqual(shown.photos.map(photo => fitOf(photo, shown.settings.photoFit)), ['fill', 'whole', 'fill']);
  assert.deepEqual(shown.photos.map(photo => fitOf(photo, 'whole')), ['whole', 'whole', 'whole'], 'with the setting on whole, every sample photo is whole');
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
