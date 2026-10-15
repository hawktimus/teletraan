// The announcement bar: which announcements are live and which one is up. These are
// the Announcement documents of Studio (TASKS, Announcements). They are not the
// full-screen announcements of Dashboard Settings that "Play announcements" plays
// (core/announce.js and core/takeover.js). Nothing here touches the page, so the
// tests can run it. core/notice-run.js draws the bar.
//
// An announcement is live from its start up to, but not including, its end. The
// times are saved as exact moments by Studio, so the kiosk time zone only matters
// when the editor picks them.

import { textWidth } from './text-width.js';

// How long each of two live announcements stays up before the other takes its place, how tall the bar is, the
// gap it keeps from the banner and the panels, and how long the panels take to make room for it.
export const noticeSeconds = 12;
export const noticeHeight = 80;
export const noticeGap = 12;
export const noticeShrinkMs = 300;

export const noticeLevels = ['notice', 'important'];
export const noticeLongest = 90;

// A time as milliseconds: text from Sanity, or the milliseconds an earlier tidy left
function momentOf(value) {
  return typeof value === 'number' ? value : Date.parse(value);
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// The announcements from the query, always complete: { id, text, start, end, team, level, sample }.
// start and end are milliseconds. One with no text, or with times that are not times, or
// that ends before it starts, is left out. A level that is not known is a notice.
export function tidyNotices(list) {
  return (Array.isArray(list) ? list : [])
    .filter(isRecord)
    .map(raw => ({
      id: typeof raw._id === 'string' ? raw._id : typeof raw.id === 'string' ? raw.id : '',
      text: typeof raw.text === 'string' ? raw.text.trim().slice(0, noticeLongest) : '',
      start: momentOf(raw.start),
      end: momentOf(raw.end),
      team: typeof raw.team === 'string' ? raw.team : '',
      level: noticeLevels.includes(raw.level) ? raw.level : 'notice',
      sample: raw.sample === true,
    }))
    .filter(item => item.text !== '' && isFinite(item.start) && isFinite(item.end) && item.end > item.start);
}

// True from the start up to, not including, the end. now is a Date or milliseconds.
export function isLive(item, now) {
  const time = typeof now === 'number' ? now : now.getTime();
  return time >= item.start && time < item.end;
}

// The announcements that are live now and are for the team on the banner: its team is
// empty (both teams) or the same. The oldest start first, so the order does not
// change while they are up. A sample announcement (the sample content has one, for the
// screenshots) is live only when withSample is true, which is the address ?notice=1.
export function liveNotices(list, now, teamCode, withSample = false) {
  return tidyNotices(list)
    .filter(item => (withSample || !item.sample) && isLive(item, now) && (item.team === '' || item.team === teamCode))
    .sort((a, b) => a.start - b.start || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// The one that is up: with two or more live, each takes its turn for noticeSeconds, and the
// turns follow the clock, so a page that reloads shows the same one as before. Nothing live
// gives null.
export function noticeUp(live, now) {
  if (live.length === 0) return null;

  const time = typeof now === 'number' ? now : now.getTime();
  const turn = Math.floor(time / (noticeSeconds * 1000));
  return live[turn % live.length];
}

// The size of the text in pixels: 52, or 44 (the smallest text on the screen) when the line would not fit the
// room in capitals. A line that does not fit at 44 is cut with an ellipsis by the style.
const sizes = [52, 44];

export function sizeFor(text, room) {
  const fit = sizes.find(size => textWidth(String(text).toUpperCase(), 700, size) <= room);
  return fit || sizes[sizes.length - 1];
}
