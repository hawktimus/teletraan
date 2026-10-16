// Tells the control page what is on the wall, every 10 seconds (control/routes/now.js keeps the
// last report and shows it on the Now showing tab). Only a page opened on the Mini itself reports,
// because the control service answers on this address only through the Mini's own web server. The
// report is { at, view, theme, team, panel, build, page }, plus hold, pause and dots.
//
// The view and the theme are read from the page: the runtime puts them on the root element as
// data-view and data-theme. The panel is the one in the large frame.

import { dotStates } from './dots.js';
import { lastContentRead } from './content.js';
import { activeRequests } from './screen-requests.js';
import { isLocalHost, makeReport, reportAddress, reportSeconds } from './now-report-parts.js';

function readTeam(getTeam) {
  const team = typeof getTeam === 'function' ? getTeam() : null;
  if (team && typeof team === 'object') return team.code || team.name || '';
  return typeof team === 'string' ? team : '';
}

// What the page shows now, read from the page and the content
export function readParts(doc, getContent, getTeam, now = new Date()) {
  const root = doc.documentElement;
  const large = doc.querySelector('#region-grid1 .area');
  const content = (typeof getContent === 'function' ? getContent() : null) || {};
  const mini = content.mini || {};
  const read = lastContentRead();

  return {
    view: root.dataset.view || '',
    theme: root.dataset.theme || '',
    team: readTeam(getTeam),
    panel: large ? large.dataset.page || '' : '',
    page: large ? large.dataset.pageNumber || '' : '',
    build: typeof window !== 'undefined' && window.teletraanBuild ? window.teletraanBuild : '',
    requests: activeRequests(content.settings, now),
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
// on the Mini, is not a problem of the screen.
export function startNowReport(getContent, getTeam, hostname = window.location.hostname) {
  if (!isLocalHost(hostname)) return;

  function send() {
    const body = JSON.stringify(makeReport(readParts(document, getContent, getTeam)));
    fetch(reportAddress, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, cache: 'no-store' }).catch(() => {});
  }

  send();
  setInterval(send, reportSeconds * 1000);
}
