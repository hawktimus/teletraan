// Tells the control page what is on the wall, every 10 seconds (control/routes/now.js keeps the
// last report and shows it on the Now showing tab). Only a page opened on the Teletraan computer itself reports,
// because the control service answers on this address only through the Teletraan computer's own web server. The
// report is { at, view, theme, layout, team, panel, build, page }, plus hold, pause and dots.
//
// The view and the theme are read from the page: the runtime puts them on the root element as
// data-view and data-theme. The panel is the one in the large frame.

import { dotStates } from './dots.js';
import { lastContentRead } from './content.js';
import { activeRequests } from './screen-requests.js';
import { heldNoteFor } from './held-note.js';
import { resolveView, viewNameOf, viewSteps } from './views.js';
import { isLocalHost, makeReport, reportAddress, reportSeconds } from './now-report-parts.js';

function readTeam(getTeam) {
  const team = typeof getTeam === 'function' ? getTeam() : null;
  if (team && typeof team === 'object') return team.code || team.name || '';
  return typeof team === 'string' ? team : '';
}

// The words for a held view with nothing to show, or ''
function readHeldNote(content, requests, now) {
  const key = requests.showView;
  if (!key) return '';

  try {
    return heldNoteFor(viewNameOf(content, key), viewSteps(content, key, now), resolveView(content, key).panels);
  } catch (error) {
    return '';
  }
}

// What the page shows now, read from the page and the content
function readParts(doc, getContent, getTeam, now = new Date()) {
  const root = doc.documentElement;
  const large = doc.querySelector('#region-grid1 .area');
  const content = (typeof getContent === 'function' ? getContent() : null) || {};
  const mini = content.mini || {};
  const read = lastContentRead();
  const requests = activeRequests(content.settings, now);

  return {
    view: root.dataset.view || '',
    theme: root.dataset.theme || '',
    layout: root.dataset.layout || '',
    team: readTeam(getTeam),
    panel: large ? large.dataset.page || '' : '',
    page: large ? large.dataset.pageNumber || '' : '',
    build: typeof window !== 'undefined' && window.teletraanBuild ? window.teletraanBuild : '',
    requests: requests,
    heldNote: readHeldNote(content, requests, now),
    dots: dotStates({
      monday: content.monday,
      everyMinutes: content.settings ? content.settings.mondayEveryMinutes : undefined,
      calendarAt: mini.lastCalendarSyncAt,
      calendarErrors: mini.calendarErrors,
      sanityAt: read.at,
      sanityFailed: read.failed,
    }, now),
  };
}

// The report is sent and forgotten. A control service that is not there, or a page that is not
// on the Teletraan computer, is not a problem of the screen.
export function startNowReport(getContent, getTeam, hostname = window.location.hostname) {
  if (!isLocalHost(hostname)) return;

  function send() {
    const body = JSON.stringify(makeReport(readParts(document, getContent, getTeam)));
    fetch(reportAddress, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, cache: 'no-store' }).catch(() => {});
  }

  send();
  setInterval(send, reportSeconds * 1000);
}
