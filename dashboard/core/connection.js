// What the screen says about its connection to Sanity. A small text at the
// bottom right comes up by itself when Sanity has been out of reach for over
// two minutes, and says why. The Show connection status switch in Dashboard
// Settings keeps it on screen, with the last read, the item counts and the
// calendar time.
//
// The first half of this file is plain functions that take values and give
// back values, so tools/test-content.mjs can try them. The second half puts
// the lines on the page.

import { formatTimeOfDay } from './time.js';

// The four reasons a read from Sanity can fail. status.reason is one of these
// while Sanity cannot be reached, and '' the rest of the time.
//   network  the browser cannot reach the host at all
//   cors     the host answers, but the browser is not allowed to read the answer
//   denied   Sanity answered 401 or 403, so the dataset or the key is wrong
//   other    anything else, such as a server error or an answer that is not usable
export const reasons = ['network', 'cors', 'denied', 'other'];

const reasonWords = {
  network: 'network down',
  cors: 'CORS blocked',
  denied: 'access denied',
  other: 'other error',
};

export function reasonText(reason) {
  return reasonWords[reason] || reasonWords.other;
}

// Works out the reason for one failed read. failure is
//   status        the HTTP status, when Sanity answered and the page could read it. Otherwise 0.
//   timedOut      true when the read was given up after waiting too long
//   hostAnswered  the result of a second, plain request to the same host that the browser
//                 lets through without reading it (sanity.js hostAnswers): true when the
//                 host answered, false when it did not, null when it was not tried
// The browser gives one and the same error for "no network" and for "blocked by CORS", so
// that second request is what tells them apart. A host that answers it is there, so
// only the permission to read is missing. A timeout is not a block, because a block
// answers quickly.
export function classifyFailure(failure) {
  const info = failure || {};
  const status = typeof info.status === 'number' ? info.status : 0;

  if (status === 401 || status === 403) return 'denied';
  if (status > 0) return 'other';
  if (info.hostAnswered === false) return 'network';
  if (info.hostAnswered === true && !info.timedOut) return 'cors';
  return 'other';
}

// How many of each kind of content the screen holds. Hidden and expired items
// are counted too: this is what Sanity sent, not what is on screen. Up Next
// is one document for today, so it is 1 or 0.
export function itemCounts(content) {
  const data = content || {};
  const size = list => (Array.isArray(list) ? list.length : 0);

  return [
    ['Tasks', size(data.tasks)],
    ['Sponsors', size(data.sponsors)],
    ['Tips', size(data.tipsAndNews)],
    ['Subteams', size(data.subteams)],
    ['People', size(data.people)],
    ['Events Calendar', size(data.extraEvents)],
    ['Up Next', data.plan ? 1 : 0],
    ['Custom panels', size(data.customPanels)],
  ];
}

function countLine(pairs) {
  return pairs.map(pair => pair[0] + ' ' + pair[1]).join(' · ');
}

// The lines of text, top to bottom, or none when nothing should show. info is
//   status           { source, updated, offline, reason } from content.js
//   always           the Show connection status switch
//   content          the content on screen, for the counts
//   calendarsReadAt  a Date, or null while the calendars have not been read
//   deviceLines      the Mini's name and ssh line (core/device.js), which only exist while offline
// The text shows when Sanity is out of reach (status.offline) or the switch is on.
// Every time is a time of day, so the text never goes out of date on its own.
export function connectionLines(info) {
  const status = info.status;
  if (!status) return [];

  const offline = Boolean(status.offline);
  if (!offline && !info.always) return [];

  const sample = status.source === 'sample';
  const lastRead = status.updated ? formatTimeOfDay(status.updated) : '';
  const lines = [];

  if (offline && sample) {
    lines.push('SAMPLE CONTENT FILE NOT READ');
  } else if (offline) {
    lines.push('SANITY UNREACHABLE: ' + reasonText(status.reason).toUpperCase());
    lines.push(lastRead ? 'Last good read ' + lastRead : 'No good read yet');
  } else if (sample) {
    lines.push('Sample content, Sanity not read');
  } else if (status.source === 'cache') {
    lines.push(lastRead ? 'Saved copy from ' + lastRead : 'Saved copy, Sanity not read yet');
  } else {
    lines.push(lastRead ? 'Sanity OK · last read ' + lastRead : 'Sanity not read yet');
  }

  if (info.always) {
    const counts = itemCounts(info.content);
    lines.push(countLine(counts.slice(0, 4)));
    lines.push(countLine(counts.slice(4)));
    lines.push(info.calendarsReadAt ? 'Calendars read ' + formatTimeOfDay(info.calendarsReadAt) : 'Calendars not read yet');
  }

  return lines.concat(info.deviceLines || []);
}

// The text on the page is #connection-status in index.html. It is hidden when
// there are no lines. tone is 'warning' while Sanity is out of reach, which
// makes it red, and 'info' for the always-on text. A line that starts with
// ssh is the command someone will type, so it gets its own colour.
export function drawConnection(lines, tone) {
  const box = document.getElementById('connection-status');
  if (!box) return;

  while (box.children.length < lines.length) box.appendChild(document.createElement('div'));

  for (let index = 0; index < box.children.length; index++) {
    const row = box.children[index];
    const text = lines[index] || '';
    if (row.textContent !== text) row.textContent = text;

    const kind = text.indexOf('ssh ') === 0 ? 'command' : '';
    if (row.className !== kind) row.className = kind;
  }

  if (box.dataset.tone !== tone) box.dataset.tone = tone;
  box.hidden = lines.length === 0;
}
