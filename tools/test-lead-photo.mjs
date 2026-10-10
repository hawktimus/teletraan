// Tests for the photo of a team lead: the address rule in dashboard/core/portrait.js (leadAddress), the way
// the reader keeps the photo and the switch of a Team lead (core/sanity.js), and the Team Leads and Subteam
// roster panels that draw it and load the next one early. The plain functions are run for real. The panels
// are run against a fake page that records what they draw.
//
//   node tools/test-lead-photo.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const sampleFile = path.join(dashboardFolder, 'data/sample/content.json');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-lead-photo-'));
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
['team-leads/team-leads.js', 'roster/roster.js'].forEach(file => {
  fs.mkdirSync(path.join(root, 'panels', path.dirname(file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, 'panels', file), path.join(root, 'panels', file));
});

const base = pathToFileURL(root).href + '/';
const portrait = await import(base + 'core/portrait.js');
const teamLeads = await import(base + 'core/team-leads.js');
const roster = await import(base + 'core/roster.js');
const sanity = await import(base + 'core/sanity.js');
const images = await import(base + 'core/images.js');

// A panel keeps the page it showed last, so a test that counts visits asks for a copy of its own
let copies = 0;
async function freshPanel(name) {
  copies += 1;
  return import(base + 'panels/' + name + '/' + name + '.js?copy=' + copies);
}

const { leadAddress, photoAddress } = portrait;
const { departmentRows, leadPhotoOf } = teamLeads;
const { rosterPages } = roster;

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const countOf = (text, piece) => text.split(piece).length - 1;

const photoRecord = number => ({
  url: 'https://cdn.sanity.io/images/abc123/production/0123abc' + number + '-800x600.jpg',
  width: 800,
  height: 600,
  crop: { left: 0, right: 0, top: 0, bottom: 0 },
  hotspot: { x: 0.5, y: 0.5 },
});
const photoNumbered = number => images.tidyPhoto(photoRecord(number));
const addressOf = number => photoAddress({ photo: photoNumbered(number), showPhoto: true });

// plate.js draws each card and bar shape once into a hidden group of the page. This
// stands in for the page.
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

// The photos of the page after this one are asked for with an image. The test says which.
async function withFakeImages(run) {
  const asked = [];
  globalThis.Image = class {
    set src(address) {
      asked.push(address);
    }
  };

  try {
    await run(asked);
  } finally {
    delete globalThis.Image;
  }
}

function mount(panel, content) {
  const host = { innerHTML: '', querySelectorAll: () => [] };
  panel.mount(host, content);
  return host.innerHTML;
}

// The addresses of the pictures in a page, as the browser reads them
const picturesIn = html => Array.from(html.matchAll(/<img src="([^"]*)"/g)).map(match => match[1].replace(/&amp;/g, '&'));
const namesIn = html => Array.from(html.matchAll(/<div class="person-name">([^<]*)<\/div>/g)).map(match => match[1]);
const silhouettesIn = html => countOf(html, '<use href="#person-silhouette"');

const person = (name, number, more) => Object.assign({ role: 'Captain', name: name, photo: photoNumbered(number), showPhoto: true }, more);
const department = (name, lead, more) => Object.assign({ name: name, lead: lead, members: [] }, more);

// The address

test('a team lead has its own photo first, the silhouette when its switch is off, and otherwise the photo of the person with the same name', () => {
  const people = [person('[Sam]', 2)];

  // the own photo wins over the person of the same name, and is asked for at 280 like any portrait
  const own = leadAddress({ lead: '[Sam]', photo: photoNumbered(1) }, people);
  assert.equal(own, addressOf(1));
  assert.ok(own.includes('0123abc1-800x600.jpg') && own.includes('&w=280&h=280&fit=crop'), own);
  assert.equal(leadAddress({ lead: '[Sam]', photo: photoNumbered(1), showPhoto: true }, people), addressOf(1));
  assert.equal(leadAddress({ lead: '[Nobody]', photo: photoNumbered(1) }, people), addressOf(1), 'no person of that name is needed');
  assert.equal(leadAddress({ lead: '', photo: photoNumbered(1) }, []), addressOf(1));

  // the switch off is the silhouette, with or without a photo, and a person of the same name does not take its place
  assert.equal(leadAddress({ lead: '[Sam]', photo: photoNumbered(1), showPhoto: false }, people), '');
  assert.equal(leadAddress({ lead: '[Sam]', showPhoto: false }, people), '');

  // with no photo of its own the lead is shown with the photo of the person with the same name, as before there was a field
  assert.equal(leadAddress({ lead: '[Sam]' }, people), addressOf(2));
  assert.equal(leadAddress({ lead: '  [SAM] ' }, people), addressOf(2), 'capitals and spaces at the ends do not matter');
  assert.equal(leadAddress({ lead: '[Sam]', showPhoto: true }, people), addressOf(2));

  // and the silhouette when there is nobody to borrow it from
  assert.equal(leadAddress({ lead: '[Nobody]' }, people), '');
  assert.equal(leadAddress({ lead: '' }, people), '');
  assert.equal(leadAddress({ lead: '[Sam]' }, []), '');
  assert.equal(leadAddress({ lead: '[Sam]' }, undefined), '');
  assert.equal(leadAddress({ lead: '[Sam]' }, [person('[Sam]', 2, { show: false })]), '', 'a hidden person is not borrowed from');
  assert.equal(leadAddress({ lead: '[Sam]' }, [person('[Sam]', 2, { expires: '2020-01-01T00:00:00.000Z' })]), '', 'nor an expired one');
  assert.equal(leadAddress({ lead: '[Sam]' }, [person('[Sam]', 2, { showPhoto: false })]), '', 'the switch of that person is respected');
  assert.equal(leadAddress({ lead: '[Sam]' }, [{ role: 'Captain', name: '[Sam]' }]), '', 'a person with no photo gives none');

  assert.equal(leadAddress(null, people), '');
  assert.equal(leadAddress(undefined, people), '');
});

test('leadPhotoOf passes on the photo, and the switch only when it is off, so a department without them keeps the row it had', () => {
  assert.deepEqual(leadPhotoOf({ name: '[Build]', lead: '[Sam]' }), {});
  assert.deepEqual(leadPhotoOf({ name: '[Build]', lead: '[Sam]', showPhoto: true }), {});
  assert.deepEqual(leadPhotoOf({ lead: '[Sam]', photo: photoNumbered(1) }), { photo: photoNumbered(1) });
  assert.deepEqual(leadPhotoOf({ lead: '[Sam]', photo: photoNumbered(1), showPhoto: false }), { photo: photoNumbered(1), showPhoto: false });
  assert.deepEqual(leadPhotoOf({ lead: '[Sam]', showPhoto: false }), { showPhoto: false });
});

test('a row of the Team Leads panel and a page of the Subteam roster carry the photo of a lead, and a department with no lead never has one', () => {
  const list = [
    department('[Build]', '[Sam]', { photo: photoNumbered(1) }),
    department('[Media]', '[Pat]'),
    department('[Safety]', '[Lee]', { photo: photoNumbered(3), showPhoto: false }),
    department('[Gap]', '', { photo: photoNumbered(4), members: ['[Alex]'] }),
  ];

  assert.deepEqual(departmentRows(list), [
    { name: '[Sam]', role: '[BUILD] LEAD', lead: '[Sam]', photo: photoNumbered(1) },
    { name: '[Pat]', role: '[MEDIA] LEAD', lead: '[Pat]' },
    { name: '[Lee]', role: '[SAFETY] LEAD', lead: '[Lee]', photo: photoNumbered(3), showPhoto: false },
    { name: '[Gap]', role: '[lead]', lead: '' },
  ]);

  const pages = rosterPages(list.concat(department('[Big]', '[Kim]', { photo: photoNumbered(5), members: Array.from({ length: 20 }, (_, index) => '[Member ' + (index + 1) + ']') })));
  assert.deepEqual(pages.map(page => page.lead), ['[Sam]', '[Pat]', '[Lee]', '', '[Kim]', '[Kim]']);
  assert.deepEqual(pages.map(page => page.photo), [photoNumbered(1), undefined, photoNumbered(3), undefined, photoNumbered(5), photoNumbered(5)], 'the second page of a subteam shows the lead again, with the photo');
  assert.deepEqual(pages.map(page => page.showPhoto), [undefined, undefined, false, undefined, undefined, undefined]);
  assert.deepEqual(Object.keys(pages[1]).sort(), ['lead', 'members', 'pageCount', 'pageNumber', 'subteam'], 'a page with no photo has the fields it always had');
});

// The reader

test('the reader keeps the photo of a team lead the way it keeps the photo of a person, and a missing switch is on', () => {
  const content = sanity.normalizeContent({
    subteams: [
      department('[A]', '[Lead A]', { order: 1, photo: photoRecord(1) }),
      department('[B]', '[Lead B]', { order: 2, photo: { url: 'http://cdn.example.test/insecure.jpg', width: 800, height: 600 } }),
      department('[C]', '[Lead C]', { order: 3, photo: { url: 'https://cdn.example.test/flat.jpg', width: 0, height: 600 } }),
      department('[D]', '[Lead D]', { order: 4, photo: null, showPhoto: false }),
      department('[E]', '[Lead E]', { order: 5, showPhoto: 'no' }),
      department('[F]', '[Lead F]', { order: 6, photo: photoRecord(6), showPhoto: false }),
    ],
    people: [],
  });
  const lead = name => content.subteams.find(subteam => subteam.name === name);

  assert.deepEqual(lead('[A]').photo, photoNumbered(1), 'the same clean photo a person gets');
  assert.equal(lead('[A]').showPhoto, true, 'the switch starts on');
  assert.equal('photo' in lead('[B]'), false, 'an address that is not https is no photo');
  assert.equal('photo' in lead('[C]'), false, 'a photo with no size is no photo');
  assert.equal('photo' in lead('[D]'), false);
  assert.equal(lead('[D]').showPhoto, false);
  assert.equal(lead('[E]').showPhoto, true, 'something that is not a switch is the starting value');
  assert.deepEqual([lead('[F]').photo, lead('[F]').showPhoto], [photoNumbered(6), false], 'a photo and a switch that is off are both kept');

  // the copy kept for an outage is cleaned again on the way in, and the sample file the same, without a change
  assert.deepEqual(sanity.normalizeSample({ subteams: content.subteams }).subteams, content.subteams);
  const sample = sanity.normalizeSample({ subteams: [department('[A]', '[Lead A]', { photo: photoRecord(1) }), department('[B]', '[Lead B]')] });
  assert.deepEqual([sample.subteams[0].photo, sample.subteams[1].photo], [photoNumbered(1), undefined]);

  // the person of the same name is cleaned the same way, so the two photos are alike
  const both = sanity.normalizeContent({ subteams: [department('[A]', '[Sam]', { photo: photoRecord(1) })], people: [{ role: 'Captain', name: '[Sam]', photo: photoRecord(1) }] });
  assert.deepEqual(both.subteams[0].photo, both.people[0].photo);
});

test('the content query asks for the photo of a team lead with the same lines as the photo of a person', () => {
  const part = (from, to) => sanity.contentQuery.split(from)[1].split(to)[0];
  const photoLines = text => text.slice(text.indexOf('"photo": photo {'), text.indexOf('}', text.indexOf('"photo": photo {')) + 1);
  const subteams = photoLines(part('"subteams":', '"people":'));
  const people = photoLines(part('"people":', '"photos":'));

  assert.ok(subteams.startsWith('"photo": photo {') && subteams.endsWith('}'), subteams);
  assert.equal(subteams, people);
  ['"url": asset->url', 'asset->metadata.dimensions.width', 'asset->metadata.dimensions.height', 'crop', 'hotspot'].forEach(piece => {
    assert.ok(subteams.includes(piece), 'the query does not ask for ' + piece);
  });
});

// The panels

test('the Team Leads panel draws the own photo of a lead, the silhouette when its switch is off, and the photo from Leadership when it has none', () => withFakePage(async () => {
  const panel = await freshPanel('team-leads');
  const html = mount(panel, {
    subteams: [
      department('[Build]', '[Sam]', { photo: photoNumbered(1) }),
      department('[Media]', '[Pat]', { photo: photoNumbered(2), showPhoto: false }),
      department('[Safety]', '[Lee]'),
      department('[Spirit]', '[Kim]'),
    ],
    people: [person('[Sam]', 7), person('[Pat]', 8), person('[Lee]', 9)],
  });

  assert.deepEqual(namesIn(html), ['[Sam]', '[Pat]', '[Lee]', '[Kim]']);
  assert.deepEqual(picturesIn(html), [addressOf(1), addressOf(9)], 'Sam has her own photo, not the one in Leadership; Lee has the one in Leadership');
  assert.equal(silhouettesIn(html), 2, 'Pat has the switch off, although Leadership has a photo for Pat, and Kim has no photo anywhere');
}));

test('the Team Leads panel with no photo on any lead draws what it always did: the photo of the person with the same name', () => withFakePage(async () => {
  const panel = await freshPanel('team-leads');
  const html = mount(panel, { subteams: [department('[Build]', '[Sam]'), department('[Media]', '[Pat]')], people: [person('[sam]', 7)] });

  assert.deepEqual(picturesIn(html), [addressOf(7)]);
  assert.equal(silhouettesIn(html), 1);
}));

test('the Team Leads panel loads the photos of the next page early: the own photo of a lead, the one from Leadership, and nothing for a switch that is off', () => withFakePage(() => withFakeImages(async asked => {
  const subteams = [
    department('[A]', '[Lead 1]'), department('[B]', '[Lead 2]'), department('[C]', '[Lead 3]'), department('[D]', '[Lead 4]'),
    department('[E]', '[Lead 5]', { photo: photoNumbered(5) }),
    department('[F]', '[Lead 6]', { photo: photoNumbered(6), showPhoto: false }),
    department('[G]', '[Lead 7]'),
    department('[H]', '[Lead 8]', { photo: photoNumbered(8) }),
  ];
  const people = [person('[Lead 7]', 17)];
  const panel = await freshPanel('team-leads');

  mount(panel, { subteams: subteams, people: people, settings: { portraitScale: 100 } });
  assert.deepEqual(asked, [addressOf(5), addressOf(17), addressOf(8)], 'the second page of four');

  asked.length = 0;
  mount(panel, { subteams: subteams, people: people, settings: { portraitScale: 100 } });
  assert.deepEqual(asked, [], 'the first page has no photo to load');

  // at a bigger portrait the next page is the next two
  asked.length = 0;
  const wide = await freshPanel('team-leads');
  mount(wide, { subteams: subteams, people: people, settings: { portraitScale: 200 } });
  assert.deepEqual(asked, [], 'leads 3 and 4 have no photo');
  mount(wide, { subteams: subteams, people: people, settings: { portraitScale: 200 } });
  assert.deepEqual(asked, [addressOf(5)], 'then leads 5 and 6: only the first has a photo to show');
})));

test('the Subteam roster draws the portrait of the lead by the same rule, and loads the photo of the next lead early', () => withFakePage(() => withFakeImages(async asked => {
  const subteams = [
    department('[Build]', '[Sam]', { photo: photoNumbered(1), members: ['[Alex]'] }),
    department('[Media]', '[Pat]', { members: ['[Jo]'] }),
    department('[Safety]', '[Lee]', { photo: photoNumbered(3), showPhoto: false, members: ['[Max]'] }),
  ];
  const people = [person('[Pat]', 8), person('[Lee]', 9)];
  const panel = await freshPanel('roster');
  const visit = () => mount(panel, { subteams: subteams, people: people });

  const first = visit();
  assert.deepEqual(picturesIn(first), [addressOf(1)]);
  assert.deepEqual(asked, [addressOf(8)], 'the lead of the next page is Pat, who has no photo here, so the one from Leadership');

  asked.length = 0;
  const second = visit();
  assert.deepEqual(picturesIn(second), [addressOf(8)]);
  assert.deepEqual(asked, [], 'Lee has the switch off, so nothing is asked for');

  asked.length = 0;
  const third = visit();
  assert.deepEqual(picturesIn(third), [], 'Lee shows the silhouette although Leadership has a photo for Lee');
  assert.equal(silhouettesIn(third), 1);
  assert.deepEqual(asked, [addressOf(1)], 'then back to the first page, whose lead has a photo of their own');
})));

test('the Subteam roster keeps the portrait at 100 for a lead with a photo, whatever the Portrait size says', () => withFakePage(async () => {
  const subteams = [department('[Build]', '[Sam]', { photo: photoNumbered(1), members: ['[Alex]'] })];
  const draw = async settings => mount(await freshPanel('roster'), { subteams: subteams, people: [], settings: settings });

  const at100 = await draw({ portraitScale: 100 });
  assert.equal(await draw({ portraitScale: 200 }), at100);
  assert.ok(at100.includes('--portrait-card: 292px; --portrait-photo: 280px; --portrait-inset: 6px'));
  assert.ok(at100.includes('width="280" height="280"'));
}));

test('the sample content has no photo on any team lead, so the sample screen shows silhouettes', () => withFakePage(async () => {
  const sample = sanity.normalizeSample(JSON.parse(fs.readFileSync(sampleFile, 'utf8')));

  assert.ok(sample.subteams.length > 0);
  assert.ok(sample.subteams.every(subteam => subteam.photo === undefined && subteam.showPhoto === true));
  assert.equal(picturesIn(mount(await freshPanel('team-leads'), sample)).length, 0);
  assert.equal(picturesIn(mount(await freshPanel('roster'), sample)).length, 0);
}));

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
