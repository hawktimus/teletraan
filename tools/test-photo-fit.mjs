// Tests for how the Photo panel fits a photo to its card (dashboard/core/photos.js,
// core/images.js, core/sanity.js, core/content.js and panels/photo): the Photo fit setting, the Fit
// of one photo, the card in the shape of a photo that is shown whole, and the caption and credit
// under and in it. The plain functions are run for real. The panel is run against a fake page that
// records what it draws. The stylesheet is checked by reading it, because the picture needs a
// browser to be seen.
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
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, 'core', file), path.join(root, 'core', file));
});
['themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(root, file));
});
fs.mkdirSync(path.join(root, 'panels/photo'), { recursive: true });
fs.copyFileSync(path.join(dashboardFolder, 'panels/photo/photo.js'), path.join(root, 'panels/photo/photo.js'));

const base = pathToFileURL(root).href + '/';
const config = await import(base + 'config.js');
const content = await import(base + 'core/content.js');
const images = await import(base + 'core/images.js');
const photos = await import(base + 'core/photos.js');
const sanity = await import(base + 'core/sanity.js');
const photoPanel = await import(base + 'panels/photo/photo.js');

const { photoLayout, fitOf, wholeShape, hasRoomForCredit } = photos;

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

// plate.js draws each card shape once into a hidden group of the page. This
// stands in for the page, and says which shapes were drawn.
async function withFakePage(run) {
  const drawn = [];
  globalThis.document = {
    getElementById: id => {
      if (id === 'metal-shapes') return { insertAdjacentHTML: (where, markup) => drawn.push(markup.match(/id="([^"]+)"/)[1]) };
      return drawn.includes(id) ? {} : null;
    },
  };

  try {
    await run(drawn);
  } finally {
    delete globalThis.document;
  }
}

// The panel draws into a host, and starts loading the next photo with an image
function mount(settings, photo) {
  const host = { innerHTML: '', querySelector: () => null };
  globalThis.Image = class {};
  try {
    photoPanel.mount(host, { photos: [photo], settings: settings });
  } finally {
    delete globalThis.Image;
  }
  return host.innerHTML;
}

const photoBase = 'https://cdn.sanity.io/images/abc123/production/0123abcd-800x600.jpg';
const photoRecord = changes => Object.assign({
  url: photoBase,
  width: 800,
  height: 600,
  crop: { left: 0, right: 0, top: 0, bottom: 0 },
  hotspot: { x: 0.5, y: 0.5 },
}, changes);

const wide = { width: 1600, height: 900 };
const fourThree = { width: 800, height: 600 };
const square = { width: 1000, height: 1000 };
const tall = { width: 600, height: 800 };
const phoneTall = { width: 900, height: 1600 };
const panorama = { width: 4000, height: 400 };
const sliver = { width: 300, height: 3000 };

// The frame's cut corner runs from (1148, 640) to (1068, 704): the most x a point can have at a height
const frameLimit = y => (y <= 640 ? 1148 : 1148 - (y - 640) * 80 / 64);

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
  assert.deepEqual(config.limits.photoScale, { min: 60, max: 100 });
  assert.equal(config.defaultSettings.photoScale, 100);
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

test('wholeShape: only a photo that is shown whole and has a size gives its shape', () => {
  const sized = { size: { width: 720, height: 960 } };
  assert.deepEqual(wholeShape(Object.assign({ fit: 'whole' }, sized), 'fill'), { width: 720, height: 960 });
  assert.deepEqual(wholeShape(sized, 'whole'), { width: 720, height: 960 });
  assert.equal(wholeShape(sized, 'fill'), null);
  assert.equal(wholeShape(Object.assign({ fit: 'fill' }, sized), 'whole'), null);

  // a photo with no size we can use is cut to the card, whatever its fit
  [undefined, null, {}, { width: 0, height: 5 }, { width: 5, height: -1 }, { width: '5', height: 5 }, { width: NaN, height: 5 }, { width: Infinity, height: 5 }, 'big'].forEach(size => {
    assert.equal(wholeShape({ fit: 'whole', size: size }, 'whole'), null, JSON.stringify(size));
  });
  assert.equal(wholeShape(null, 'whole'), null);
  assert.equal(wholeShape(undefined, 'whole'), null);
});

// The card in the fill mode: the numbers that were there before

test('fill mode: photoLayout gives the numbers it always gave, with no shape or one that cannot be used', () => {
  assert.deepEqual(photoLayout(100, true), { card: { left: 28, top: 142, width: 1096, height: 464 }, caption: { left: 52, top: 622, width: 1004 } });
  assert.deepEqual(photoLayout(100, false), { card: { left: 28, top: 142, width: 1096, height: 514 }, caption: { left: 52, top: 672, width: 1004 } });
  assert.deepEqual(photoLayout(80, true), { card: { left: 138, top: 189, width: 877, height: 371 }, caption: { left: 162, top: 576, width: 894 } });
  assert.deepEqual(photoLayout(80, false).card, { left: 138, top: 194, width: 877, height: 411 });
  assert.deepEqual(photoLayout(60, true), { card: { left: 247, top: 235, width: 658, height: 278 }, caption: { left: 271, top: 529, width: 785 } });
  assert.deepEqual(photoLayout(60, false).card, { left: 247, top: 245, width: 658, height: 308 });

  [undefined, null, {}, { width: 0, height: 10 }, { width: 10 }, { width: 'a', height: 'b' }, { width: NaN, height: 4 }].forEach(shape => {
    [100, 80, 60].forEach(percent => {
      [true, false].forEach(hasCaption => {
        assert.deepEqual(photoLayout(percent, hasCaption, shape), photoLayout(percent, hasCaption), JSON.stringify(shape) + ' at ' + percent);
      });
    });
  });
});

// The card in the whole mode

test('whole mode at 100 percent: the card is the shape of the photo, as big as the card of the fill mode allows', () => {
  const card = (shape, hasCaption) => photoLayout(100, hasCaption, shape).card;

  // with a caption the box is 1096 by 464, and without one 1096 by 514
  assert.deepEqual(card(wide, true), { left: 164, top: 142, width: 825, height: 464 });
  assert.deepEqual(card(wide, false), { left: 119, top: 142, width: 914, height: 514 });
  assert.deepEqual(card(fourThree, true), { left: 267, top: 142, width: 619, height: 464 });
  assert.deepEqual(card(fourThree, false), { left: 234, top: 142, width: 685, height: 514 });
  assert.deepEqual(card(square, true), { left: 344, top: 142, width: 464, height: 464 });
  assert.deepEqual(card(square, false), { left: 319, top: 142, width: 514, height: 514 });
  assert.deepEqual(card(tall, true), { left: 402, top: 142, width: 348, height: 464 });
  assert.deepEqual(card(tall, false), { left: 383, top: 142, width: 386, height: 514 });
  assert.deepEqual(card(phoneTall, true), { left: 446, top: 142, width: 261, height: 464 });

  // a photo as wide as the box is the box, and one that is wider than it is limited by the width
  assert.deepEqual(card({ width: 1096, height: 464 }, true), { left: 28, top: 142, width: 1096, height: 464 });
  assert.deepEqual(card({ width: 2400, height: 1000 }, true), { left: 28, top: 146, width: 1096, height: 457 });
  assert.deepEqual(card({ width: 2400, height: 1000 }, false), { left: 28, top: 171, width: 1096, height: 457 });

  // the size of the photo in pixels does not matter, only its shape: a small photo is not smaller, and a big one is not bigger
  assert.deepEqual(card({ width: 80, height: 60 }, true), card({ width: 8000, height: 6000 }, true));
  assert.deepEqual(card({ width: 80, height: 60 }, true), card(fourThree, true));
});

test('whole mode: an extremely wide or tall photo gets a card with a short side of 240, and the picture keeps its own shape', () => {
  const layout = (shape, hasCaption, percent = 100) => photoLayout(percent, hasCaption, shape);

  assert.deepEqual(layout(panorama, true).card, { left: 28, top: 254, width: 1096, height: 240 });
  assert.deepEqual(layout(panorama, false).card, { left: 28, top: 279, width: 1096, height: 240 });
  assert.deepEqual(layout(sliver, true).card, { left: 456, top: 142, width: 240, height: 464 });
  assert.deepEqual(layout(sliver, false).card, { left: 456, top: 142, width: 240, height: 514 });

  // the widest shape that is kept is 1096 by 240, and the narrowest is 240 by the height of the box
  assert.deepEqual(layout({ width: 1096, height: 240 }, true).card, layout(panorama, true).card);
  assert.deepEqual(layout({ width: 1096, height: 241 }, true).card, { left: 28, top: 254, width: 1096, height: 241 });
  assert.deepEqual(layout({ width: 240, height: 464 }, true).card, layout(sliver, true).card);
  assert.deepEqual(layout({ width: 241, height: 464 }, true).card, { left: 456, top: 142, width: 241, height: 464 });

  // any shape at all gives a sane card: no side under 240, none over the box
  [0.001, 0.05, 0.1, 0.2, 1, 5, 50, 1000, 1e6].forEach(aspect => {
    [true, false].forEach(hasCaption => {
      const card = layout({ width: aspect * 1000, height: 1000 }, hasCaption).card;
      assert.ok(Math.min(card.width, card.height) >= 240, 'the short side at ' + aspect);
      assert.ok(card.width <= 1096 && card.height <= (hasCaption ? 464 : 514), 'inside the box at ' + aspect);
    });
  });

  // at 60 percent it is made smaller in proportion, 144 for the short side
  assert.deepEqual(layout(panorama, true, 60).card, { left: 247, top: 302, width: 658, height: 144 });
  assert.deepEqual(layout(sliver, true, 60).card, { left: 504, top: 235, width: 144, height: 278 });
});

test('whole mode at 60 and 80 percent: the same shape, made smaller, in the middle of the same space', () => {
  assert.deepEqual(photoLayout(60, true, fourThree).card, { left: 391, top: 235, width: 371, height: 278 });
  assert.deepEqual(photoLayout(60, false, fourThree).card, { left: 371, top: 245, width: 411, height: 308 });
  assert.deepEqual(photoLayout(60, true, square).card, { left: 437, top: 235, width: 278, height: 278 });
  assert.deepEqual(photoLayout(60, false, square).card, { left: 422, top: 245, width: 308, height: 308 });
  assert.deepEqual(photoLayout(60, true, tall).card, { left: 472, top: 235, width: 209, height: 278 });
  assert.deepEqual(photoLayout(60, true, wide).card, { left: 329, top: 235, width: 495, height: 278 });

  // the top is the same as the fill mode has at that size: a card that is as high as the box is as high in both
  [60, 70, 80, 90, 100].forEach(percent => {
    [true, false].forEach(hasCaption => {
      assert.equal(photoLayout(percent, hasCaption, tall).card.top, photoLayout(percent, hasCaption).card.top, percent + ' ' + hasCaption);
      assert.equal(photoLayout(percent, hasCaption, tall).card.height, photoLayout(percent, hasCaption).card.height, percent + ' ' + hasCaption);
    });
  });

  // no size, or an odd one, is 100, and the setting stays between 60 and 100
  assert.deepEqual(photoLayout(undefined, true, tall), photoLayout(100, true, tall));
  assert.deepEqual(photoLayout('large', false, tall), photoLayout(100, false, tall));
  assert.deepEqual(photoLayout(59, true, tall), photoLayout(60, true, tall));
  assert.deepEqual(photoLayout(1000, true, tall), photoLayout(100, true, tall));
});

test('whole mode, every size and shape: inside the box, in the shape of the photo, in the middle, and clear of the frame', () => {
  const aspects = [0.2, 0.3, 0.45, 0.5, 0.5625, 2 / 3, 0.75, 1, 1.25, 4 / 3, 1.5, 16 / 9, 2, 2.3, 2.4, 3, 4, 4.5, 5, 6, 10];

  aspects.forEach(aspect => {
    [true, false].forEach(hasCaption => {
      const boxHeight = hasCaption ? 464 : 514;
      const widest = 1096 / 240;
      const narrowest = 240 / boxHeight;
      const kept = Math.min(widest, Math.max(narrowest, aspect));

      for (let percent = 60; percent <= 100; percent++) {
        const layout = photoLayout(percent, hasCaption, { width: aspect * 1000, height: 1000 });
        const card = layout.card;
        const where = aspect.toFixed(3) + ' at ' + percent + (hasCaption ? ' with' : ' without') + ' a caption';

        // never bigger than the box, made smaller by the setting
        assert.ok(card.width <= Math.round(1096 * percent / 100) && card.height <= Math.round(boxHeight * percent / 100), 'inside the box, ' + where);
        // as big as the box allows: one side is the box's
        const touches = card.width === Math.round(1096 * percent / 100) || card.height === Math.round(boxHeight * percent / 100);
        assert.ok(touches, 'as big as it can be, ' + where);
        // the shape of the photo, held to the limits, to the pixel
        assert.ok(Math.abs(card.width - card.height * kept) <= 0.5 + 0.5 * kept + 0.01, 'the shape, ' + where);
        // in the middle of the panel, across and down
        assert.ok(Math.abs(card.left - (1152 - card.width - card.left)) <= 1, 'centred across, ' + where);
        assert.ok(card.top >= 142, 'below the header, ' + where);
        const bottom = hasCaption ? layout.caption.top + 64 : card.top + card.height;
        assert.ok(bottom <= (hasCaption ? 686 : 656), 'inside the space it has at 100, ' + where);
        // the card's own cut corner is clear of the frame's
        assert.ok(card.left + card.width <= frameLimit(card.top + card.height - 34) - 20, 'right of the card, ' + where);
        assert.ok(card.left + card.width - 42 <= frameLimit(card.top + card.height) - 20, 'cut corner, ' + where);
        // no side of a card at 100 is under 240
        if (percent === 100) assert.ok(Math.min(card.width, card.height) >= 240, 'the short side, ' + where);

        if (hasCaption) {
          const caption = layout.caption;
          const middle = card.left + card.width / 2;
          assert.equal(caption.top, card.top + card.height + 16, 'the caption is directly under the card, ' + where);
          // centred under the card, to the pixel
          assert.ok(Math.abs(caption.left + caption.width / 2 - middle) <= 1, 'the caption is centred, ' + where);
          // it stops where it stops in the fill mode, and starts no further left than the caption at full size
          assert.equal(caption.left + caption.width, 1056, 'the caption stops at 1056, ' + where);
          assert.ok(caption.left >= 52, 'the caption starts at 52 or later, ' + where);
          assert.ok(caption.width > 0 && caption.width <= 1004, 'caption width, ' + where);
          assert.ok(caption.left + caption.width <= frameLimit(caption.top + 64) - 30, 'the caption is clear of the cut corner, ' + where);
        }
      }
    });
  });
});

test('whole mode: the caption box is centred under the card, 960 wide, and the same for a narrow card as for a wide one', () => {
  assert.deepEqual(photoLayout(100, true, square).caption, { left: 96, top: 622, width: 960 });
  assert.deepEqual(photoLayout(100, true, tall).caption, { left: 96, top: 622, width: 960 });
  assert.deepEqual(photoLayout(100, true, sliver).caption, { left: 96, top: 622, width: 960 });
  assert.deepEqual(photoLayout(100, true, panorama).caption, { left: 96, top: 510, width: 960 });
  assert.deepEqual(photoLayout(60, true, tall).caption, { left: 97, top: 529, width: 959 });

  // a card of the fill mode keeps its caption at the left, in from the card
  assert.equal(photoLayout(100, true).caption.left, 52);
  assert.equal(photoLayout(60, true).caption.left, 271);
});

// The credit

test('the credit plate needs a card at least 370 wide, and a card of the fill mode always has room', () => {
  assert.equal(hasRoomForCredit(370), true);
  assert.equal(hasRoomForCredit(369), false);
  assert.equal(hasRoomForCredit(1096), true);
  assert.equal(hasRoomForCredit(0), false);
  for (let percent = 60; percent <= 100; percent++) {
    assert.ok(hasRoomForCredit(photoLayout(percent, true).card.width), 'fill at ' + percent);
    assert.ok(hasRoomForCredit(photoLayout(percent, false).card.width), 'fill at ' + percent);
  }
});

// The panel

test('the panel draws a photo shown whole in a card of its shape, with the edge at that size, no hotspot and a centred caption', () => withFakePage(drawn => {
  const photo = { address: 'data/sample/photo-2.svg', caption: '[Caption]', credit: '[Name]', focus: { x: 30, y: 40 }, size: { width: 600, height: 800 }, fit: 'whole' };
  const html = mount({ photoOrder: 'random', photoScale: 100, photoFit: 'fill' }, photo);

  assert.ok(html.includes('<div class="card whole" data-slat="item" style="left: 402px; top: 142px; width: 348px; height: 464px">'));
  assert.ok(html.includes('<div class="caption centred" data-slat="item" style="left: 96px; top: 622px; width: 960px">[Caption]</div>'));
  assert.ok(html.includes('width="348" height="464" viewBox="0 0 348 464"'));
  assert.deepEqual(drawn, ['card-348x464']);
  // the whole photo is not cut, so the hotspot is not used
  assert.ok(html.includes('<img src="data/sample/photo-2.svg" alt="">'));
  assert.equal(html.includes('object-position'), false);
  // this card is 348 wide, which is too narrow for the credit plate
  assert.equal(html.includes('class="credit"'), false);

  // with no caption the box is taller and there is no caption box
  const bare = mount({ photoScale: 100 }, Object.assign({}, photo, { caption: '' }));
  assert.ok(bare.includes('<div class="card whole" data-slat="item" style="left: 383px; top: 142px; width: 386px; height: 514px">'));
  assert.equal(bare.includes('class="caption'), false);
  assert.ok(bare.includes('<div class="credit">Photo: [Name]</div>'));

  // smaller by the Photo size setting
  const small = mount({ photoScale: 60 }, photo);
  assert.ok(small.includes('<div class="card whole" data-slat="item" style="left: 472px; top: 235px; width: 209px; height: 278px">'));
  assert.ok(small.includes('<div class="caption centred" data-slat="item" style="left: 97px; top: 529px; width: 959px">[Caption]</div>'));
}));

test('the panel leaves the credit off a card narrower than 370 and keeps it on a wider one', () => withFakePage(() => {
  const photo = (size, caption = '[Caption]') => ({ address: 'data/sample/photo-2.svg', caption: caption, credit: '[Name]', size: size, fit: 'whole' });
  const hasCredit = html => html.includes('class="credit"');

  // with a caption at 100: 9 by 16 is 261 wide, 3 by 4 is 348 and a square is 464
  assert.equal(hasCredit(mount({}, photo({ width: 900, height: 1600 }))), false);
  assert.equal(hasCredit(mount({}, photo({ width: 600, height: 800 }))), false);
  assert.equal(hasCredit(mount({}, photo({ width: 1000, height: 1000 }))), true);
  // with no caption the box is higher: 3 by 4 is 386 wide
  assert.equal(hasCredit(mount({}, photo({ width: 600, height: 800 }, ''))), true);
  // 3 by 4 at 60 with a caption is 209 wide, and 16 by 9 is 495
  assert.equal(hasCredit(mount({ photoScale: 60 }, photo({ width: 600, height: 800 }))), false);
  assert.equal(hasCredit(mount({ photoScale: 60 }, photo({ width: 1600, height: 900 }))), true);
  // a photo with no credit has no plate on any card
  assert.equal(mount({}, Object.assign(photo({ width: 1600, height: 900 }), { credit: '' })).includes('class="credit"'), false);
}));

test('which mode the panel uses: the photo\'s own fit, otherwise the setting, and fill for a photo with no size', () => withFakePage(() => {
  const photo = changes => Object.assign({ address: 'data/sample/photo-2.svg', caption: '[Caption]', credit: '[Name]', focus: { x: 30, y: 40 }, size: { width: 600, height: 800 } }, changes);
  const isWhole = html => html.includes('class="card whole"');

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

  // a photo with no size we can use is drawn in the fill mode, with the hotspot, whatever it asks for
  const fallback = mount({ photoFit: 'whole' }, photo({ fit: 'whole', size: undefined }));
  assert.equal(isWhole(fallback), false);
  assert.ok(fallback.includes('<div class="card" data-slat="item" style="left: 28px; top: 142px; width: 1096px; height: 464px">'));
  assert.ok(fallback.includes('style="object-position: 30% 40%"'));
  assert.equal(fallback.includes('caption centred'), false);
}));

test('the panel draws the fill mode exactly as it did: the same card, the same caption, the hotspot and the credit', () => withFakePage(drawn => {
  const photo = { address: 'data/sample/photo-1.svg', caption: '[Caption]', credit: '[Name]', focus: { x: 30, y: 40 }, size: { width: 1152, height: 708 } };
  const html = mount({ photoOrder: 'random', photoScale: 100, photoFit: 'fill' }, photo);

  assert.ok(html.includes('<div class="card" data-slat="item" style="left: 28px; top: 142px; width: 1096px; height: 464px">'));
  assert.ok(html.includes('<div class="caption" data-slat="item" style="left: 52px; top: 622px; width: 1004px">[Caption]</div>'));
  assert.ok(html.includes('<img src="data/sample/photo-1.svg" style="object-position: 30% 40%" alt="">'));
  assert.ok(html.includes('<div class="credit">Photo: [Name]</div>'));
  assert.deepEqual(drawn, ['card-1096x464']);

  // the size of the photo changes nothing in this mode
  assert.equal(mount({ photoOrder: 'random', photoScale: 100, photoFit: 'fill' }, Object.assign({}, photo, { size: undefined })), html);
  assert.equal(mount({ photoOrder: 'random', photoScale: 100 }, photo), html);

  const small = mount({ photoScale: 60 }, photo);
  assert.ok(small.includes('style="left: 247px; top: 235px; width: 658px; height: 278px"'));
  assert.ok(small.includes('<div class="caption" data-slat="item" style="left: 271px; top: 529px; width: 785px">[Caption]</div>'));
}));

test('the stylesheet shows the whole picture with contain, keeps cover for the other mode and leaves the places to photo.js', () => {
  const css = read('panels/photo/photo.css');

  assert.ok(ruleOf(css, '.photo .whole .picture img').includes('object-fit: contain;'));
  assert.ok(ruleOf(css, '.photo .picture img').includes('object-fit: cover;'));
  assert.ok(ruleOf(css, '.photo .caption.centred').includes('text-align: center;'));
  assert.equal(ruleOf(css, '.photo .whole'), '', 'the whole card has no place or size of its own');
  assert.equal(/\.photo \.card\s*\{[^}]*(left|top|width|height):/.test(css), false, 'the card has a place or a size in photo.css');
  assert.equal(/\.photo \.caption(\.centred)?\s*\{[^}]*(left|top|width):/.test(css), false, 'the caption has a place or a width in photo.css');
  assert.ok(/\.photo \.caption\s*\{[^}]*height: 64px;[^}]*font: 500 var\(--size-body\)\/64px/.test(css), 'the caption keeps its height and its text size');
  assert.ok(ruleOf(css, '.photo .credit').includes('max-width: min(700px, calc(100% - 88px));'), 'the credit follows the width of the card');
  assert.ok(/\.photo \.credit\s*\{[^}]*font: 500 var\(--size-label\)\/56px/.test(css), 'the credit is not at least 44px');
  assert.equal(/blur|box-shadow|text-shadow|filter/.test(css), false, 'the photo panel uses an effect that is not allowed');
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

test('a photo from Studio shown whole gets a card in the shape of the part that was kept', () => withFakePage(() => {
  const [photo] = sanity.normalizeContent({ photos: [{ id: 'a1', caption: '[Caption]', fit: 'whole', image: photoRecord({ crop: { left: 0.25, right: 0.25, top: 0, bottom: 0 } }) }] }).photos;

  // 400 by 600 is a 2 by 3 card: 464 high and 309 wide
  assert.deepEqual(wholeShape(photo, 'fill'), { width: 400, height: 600 });
  assert.ok(mount({}, photo).includes('<div class="card whole" data-slat="item" style="left: 422px; top: 142px; width: 309px; height: 464px">'));
}));

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

  // the cleaning keeps the fit and the size, and the whole photo gets its own shape on the screen
  assert.deepEqual(shown.photos.map(photo => photo.fit), [undefined, 'whole', undefined]);
  assert.deepEqual(shown.photos.map(photo => photo.size), raw.photos.map(photo => photo.size));
  assert.equal(wholeShape(shown.photos[0], shown.settings.photoFit), null);
  assert.deepEqual(wholeShape(shown.photos[1], shown.settings.photoFit), { width: 720, height: 960 });
  assert.equal(wholeShape(shown.photos[2], shown.settings.photoFit), null);
  assert.equal(wholeShape(shown.photos[2], 'whole') !== null, true, 'with the setting on whole, every sample photo is whole');
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
