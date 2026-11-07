// The Debug section of Details: the diagnostic reports.
//
// One button writes a report on the computer with everything needed to work out why the screen is wrong: the build, the
// display and what the kernel said about it, a picture of the screen, every heartbeat, the services and their journals,
// the network, each source, what the supervisor has tried, and what the computer has left. It can then be read here,
// copied or downloaded, so nobody has to log in over ssh to find out what happened.
//
// Reports are also written by the computer itself, before it restarts or reboots anything (computer/scripts/diag.sh,
// called by the supervisor). Those are the incidents, and they are the ones worth reading after the wall went wrong
// while nobody was watching.
//
// Every line of a report has been through the same rules the log download uses, so a report carries no key, no
// password and no calendar link, and is safe to send to a coach (tests/diag-redaction.test.mjs).

import { el, esc } from '../dom.js';
import { actionButton, helperRun } from '../action-run.js';
import { whenWords } from '../words.js';
import { subscribe } from '../poll.js';

// The list the helper prints: one report a line, name, when it was written, and where it is
export function parseReports(text) {
  return String(text || '').split('\n').map(line => {
    const parts = line.split('\t');
    if (parts.length < 2 || !parts[0].startsWith('report-')) return null;
    const name = parts[0].trim();
    // An incident report carries why it was written on the end of its name
    const why = (name.match(/^report-[0-9TZ-]+-(.+?)(\.txt)?$/) || [])[1] || '';
    return {
      name: name,
      at: parts[1].trim(),
      incident: (parts[2] || '').includes('/incidents/'),
      why: why.replace(/-/g, ' '),
    };
  }).filter(Boolean);
}

// Newest first, and the incidents are the interesting ones so they keep their reason
export function sortReports(reports) {
  return reports.slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

export function mountDebug(box) {
  const root = el('div', 'debug');
  box.append(root);
  root.innerHTML =
    '<section class="card"><h3>Create a diagnostic report</h3>' +
    '<p class="muted">Everything needed to work out why the screen is wrong, in one file. It holds no keys, no passwords and no calendar links, so it is safe to send to a coach.</p>' +
    '<div class="buttons" data-make></div>' +
    '<p class="muted" data-made></p></section>' +
    '<section class="card"><h3>Reports on the computer</h3>' +
    '<p class="muted">The last 20 written by hand, and the last 20 the computer wrote by itself before it restarted or rebooted something.</p>' +
    '<div class="buttons" data-refresh></div>' +
    '<div data-list><p class="empty">Press Look again to see what is there.</p></div></section>' +
    '<section class="card" data-reading hidden><h3 data-reading-title>Report</h3>' +
    '<div class="buttons" data-reading-buttons></div>' +
    '<pre class="raw" data-reading-text></pre></section>';

  const q = name => root.querySelector('[' + name + ']');
  let reports = [];

  function paintList() {
    const list = q('data-list');
    if (reports.length === 0) {
      list.innerHTML = '<p class="empty">No reports yet. Press Create a report, or wait until the computer writes one by itself.</p>';
      return;
    }
    list.innerHTML = '<ul class="entries">' + reports.map(report =>
      '<li><button type="button" class="btn btn-secondary" data-open="' + esc(report.name) + '">' +
      (report.incident ? '<span class="entry-state" data-ok="false">By itself</span> ' : '<span class="entry-state" data-ok="true">By hand</span> ') +
      esc(whenWords(report.at) || report.at) +
      (report.incident && report.why ? ' <span class="muted">before it did: ' + esc(report.why) + '</span>' : '') +
      '</button></li>').join('') + '</ul>';

    list.querySelectorAll('[data-open]').forEach(button => {
      button.addEventListener('click', () => readReport(button.dataset.open));
    });
  }

  async function readReport(name) {
    const text = q('data-reading-text');
    q('data-reading').hidden = false;
    q('data-reading-title').textContent = 'Report written ' + (whenWords((reports.find(item => item.name === name) || {}).at) || name);
    text.textContent = 'Reading...';

    const result = await helperRun('diag-read', { report: name })();
    text.textContent = result.ok ? (result.raw || 'The report is empty.') : 'The report could not be read: ' + result.words;

    const buttons = q('data-reading-buttons');
    buttons.replaceChildren();
    if (!result.ok) return;

    const copy = el('button', 'btn btn-secondary');
    copy.type = 'button';
    copy.textContent = 'Copy the report';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(result.raw);
        copy.textContent = 'Copied';
        setTimeout(() => { copy.textContent = 'Copy the report'; }, 2000);
      } catch (error) {
        copy.textContent = 'This browser would not copy it. Select the text instead.';
      }
    });

    // Saved by the browser out of the text it already has, so the report never crosses the network a second time
    const save = el('a', 'btn btn-secondary');
    save.textContent = 'Download the report';
    save.download = name.endsWith('.txt') ? name : name + '.txt';
    save.href = URL.createObjectURL(new Blob([result.raw], { type: 'text/plain' }));
    buttons.append(copy, save);
  }

  async function refreshList() {
    const result = await helperRun('diag-list', {})();
    if (!result.ok) {
      reports = [];
      q('data-list').innerHTML = '<p>' + esc(result.words) + '</p>';
      return result;
    }
    reports = sortReports(parseReports(result.raw));
    paintList();
    return result;
  }

  const make = actionButton({
    id: 'diag-create',
    label: 'Create a report',
    doing: 'Writing the report',
    variant: 'primary',
    icon: 'clock',
    run: helperRun('diag-create', {}),
    after: result => {
      q('data-made').textContent = result.ok
        ? 'Report ready (' + new Date().toLocaleTimeString() + '). It is in the list below.'
        : 'The report could not be written.';
      if (result.ok) refreshList();
    },
  });
  q('data-make').append(make.root);

  const again = actionButton({
    id: 'diag-list',
    label: 'Look again',
    doing: 'Looking',
    variant: 'secondary',
    icon: 'sync',
    run: async () => {
      const result = await refreshList();
      return result.ok ? { ok: true, words: reports.length + ' reports', raw: result.raw } : result;
    },
  });
  q('data-refresh').append(again.root);

  // The build this computer runs, so a report can be matched to a version without opening it
  subscribe(store => {
    const version = store.overview && store.overview.buildVersion;
    const line = q('data-made');
    if (version && line.textContent === '') line.textContent = 'This computer runs Teletraan I ' + version + '.';
  });

  refreshList();
  return () => {};
}
