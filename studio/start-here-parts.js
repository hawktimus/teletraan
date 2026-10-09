// The parts of the Start here page that need no Studio: the five areas of the picture of the
// screen, where their words sit, the five buttons, and the words for a request that fails.
// start-here.js draws them. check-schemas.mjs reads them with node and fails if the picture,
// the sidebar or the buttons stop agreeing.

import { dashboardAddress } from './dashboard-address.js';
import { announceRequest, presentationTestRequest, nextLookRequest, competitionPreviewRequest } from './screen-requests.js';
import { messageOf } from './publish-all.js';

// The picture is drawn on the screen's own 1920 by 1080, so it has the shape of the screen.
// The boxes are the standard layout in dashboard/base.css: the banner across the top, the
// main panel on the left, the countdown over the side panel on the right, and the ticker
// across the bottom. check-schemas.mjs fails if the numbers differ from base.css.
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
    feeds: [['Tasks', 'Daily Agenda', 'Calendars'], ['Team leads', 'Leadership', 'Sponsors'], ['Photos', 'Extra panels']],
    x: 40,
    y: 256,
    width: 1152,
    height: 708,
  },
  { letter: 'C', name: 'Countdown', feeds: [['Dashboard Settings']], x: 1224, y: 256, width: 656, height: 320 },
  {
    letter: 'D',
    name: 'Side panel',
    feeds: [['Tasks', 'Sponsors'], ['Calendars'], ['Dashboard Settings']],
    x: 1224,
    y: 592,
    width: 656,
    height: 372,
  },
  { letter: 'E', name: 'Ticker', feeds: [['Tips and News', 'Sponsors']], x: 40, y: 984, width: 1840, height: 72 },
];

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

// The row of buttons. A button that sends a request has request, which gives the fields to
// set (screen-requests.js). The one that opens the screen has an address instead.
// says is the line under the button.
export const buttons = [
  {
    id: 'announcement',
    label: 'Play announcement',
    says: 'Plays every announcement that is switched on.',
    request: announceRequest,
  },
  {
    id: 'presentation',
    label: 'Run presentation test',
    says: 'Runs a sample talk with six sample slides.',
    request: presentationTestRequest,
  },
  {
    id: 'next-look',
    label: 'Next look now',
    says: 'Moves the screen on to the next look.',
    request: nextLookRequest,
  },
  {
    id: 'competition',
    label: 'Preview competition',
    says: 'Shows the competition cards for 2 minutes.',
    request: competitionPreviewRequest,
  },
  {
    id: 'preview',
    label: 'Preview the screen',
    says: 'Opens the screen with sample content in a new tab.',
    address: dashboardAddress,
  },
];

// The line under the buttons after a request was sent
export const sentLine = 'Sent. The screen starts it within a few seconds.';

// The line under the buttons when a request could not be sent
export function problemWith(error) {
  const message = messageOf(error);
  if (/not found/i.test(message)) return 'Dashboard Settings has not been published yet. Open it, click Publish once, and try again.';
  return 'The request was not sent. ' + message;
}
