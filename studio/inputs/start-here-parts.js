// The parts of the Start here page that need no Studio: the five areas of the picture of the
// screen, where their words sit, and the links to the control page, the Studio on the web and the guides.
// start-here.js draws them. tests/schemas.test.mjs reads them with node and fails if the picture,
// the sidebar or the buttons stop agreeing.

import { controlAddress } from './control-address.js';

// The picture is drawn on the screen's own 1920 by 1080, so it has the shape of the screen.
// The boxes are the standard layout in dashboard/base.css: the banner across the top, the
// main panel on the left, the countdown over the side panel on the right, and the ticker
// across the bottom. tests/schemas.test.mjs fails if the numbers differ from base.css.
//
// feeds are the sidebar items that fill the area, one list for each line of words in the
// box. Each name is the title of a line in the sidebar (structure.js). Events come from the
// calendars, which is why Calendars fills the panels that show them.
export const screen = { width: 1920, height: 1080 };

export const areas = [
  { letter: 'A', name: 'Banner', feeds: [['Teams', 'Dashboard Settings']], x: 40, y: 24, width: 1840, height: 212 },
  {
    letter: 'B',
    name: 'Main panel',
    feeds: [['Rotation', 'Daily Agenda'], ['Monday Tasks', 'Calendars'], ['Team leads', 'Leadership', 'Sponsors'], ['Photos', 'Extra panels']],
    x: 40,
    y: 256,
    width: 1152,
    height: 708,
  },
  { letter: 'C', name: 'Countdown', feeds: [['Dashboard Settings']], x: 1224, y: 256, width: 656, height: 320 },
  {
    letter: 'D',
    name: 'Side panel',
    feeds: [['Views', 'Calendars'], ['Monday Tasks'], ['Sponsors']],
    x: 1224,
    y: 592,
    width: 656,
    height: 372,
  },
  { letter: 'E', name: 'Ticker', feeds: [['Tips and News', 'Sponsors']], x: 40, y: 984, width: 1840, height: 72 },
];

// The lines under the picture. The picture has no links. The three dots are the small status dots at the foot of the
// screen, left of the ticker (dashboard/core/dots.js).
export const clickLine = 'Rotation says which panel plays and for how long.';
export const dotsLine = 'Three small dots at the foot of the screen show if Monday, the calendars and Sanity were read lately. Green is good. Amber or red means tell a coach.';

// A wide guess at the width of some text, since the page cannot measure it before it is drawn.
// A letter is about 0.55 of its size wide, so 0.6 leaves room.
export function widthOf(text, size) {
  return Math.ceil(text.length * size * 0.6);
}

const gap = 28;

// Where the words of one area sit in the picture. The tall boxes have a square with the
// letter and the name beside it, and the feeds below. The ticker is too thin for that, so
// it has the square, the name and the feeds in one row. Every x and y is the left end and
// the baseline of the words, except the letter, which is centred on x.
export function labelsOf(area) {
  const row = area.height < 120;
  const badgeSize = row ? 56 : 96;
  const nameSize = row ? 44 : 64;
  const feedSize = row ? 44 : 52;
  const edge = row ? (area.height - badgeSize) / 2 : gap;

  const badge = { x: area.x + edge, y: area.y + edge, size: badgeSize };
  const middle = badge.y + badgeSize / 2;
  const letter = { text: area.letter, x: badge.x + badgeSize / 2, y: Math.round(middle + badgeSize * 0.25), size: Math.round(badgeSize * 0.7) };
  const name = { text: area.name, x: badge.x + badgeSize + gap, y: Math.round(middle + nameSize * 0.35), size: nameSize };

  const lines = area.feeds.map(names => names.join(', '));
  const feeds = lines.map((text, index) => {
    if (row) return { text: text, x: name.x + widthOf(area.name, nameSize) + gap, y: name.y, size: feedSize };
    return { text: text, x: area.x + gap, y: badge.y + badgeSize + feedSize + 4 + index * (feedSize + 12), size: feedSize };
  });
  return { badge: badge, letter: letter, name: name, feeds: feeds };
}

// The links under the status. The control page and the docs are not part of the Studio, so the page only points to them.
// studioAddress is the address of the Studio hosted by Sanity. It is marked as a placeholder until the owner
// types it: a link whose address still holds a bracket is shown as plain words, not as a link.
export const studioAddress = '[address of the hosted Studio]';
export const docsAddress = 'https://github.com/Hawktimus/teletraan/tree/main/docs';

export const links = [
  { id: 'control', label: 'The control page', says: 'Updates the screen, shows what is on the wall and restarts things. It works on the WiFi of the shop.', address: controlAddress },
  { id: 'studio', label: 'The Studio on the web', says: 'The same Studio, for when the one on the Teletraan computer is not reachable.', address: studioAddress },
  { id: 'docs', label: 'The guides', says: 'Short pages on how each part works.', address: docsAddress },
];

// A link is real when its address has no bracket in it
export function isReal(link) {
  return link.address.indexOf('[') === -1;
}
