// The Details area: the technical side. This is the only place raw text appears: the health of the computer, the dots and the last
// reads, the output of every action this browser ran, the logs, and every setting of the Studio. Everything is plain information
// to read or copy; the only buttons that change things are the ones inside All settings, which save to a draft first.

import { el, esc } from '../dom.js';
import { api, useStyles } from '../tabs/api.js';
import { mountHealth } from '../tabs/health.js';
import { dotsHtml, readsHtml } from '../tabs/render-health.js';
import { mountLog } from '../tabs/settings-log.js';
import { mountAll } from '../tabs/settings-all.js';
import { clearOutput, onOutput, outputEntries } from '../output-log.js';
import { whenWords } from '../words.js';
import { mountSections } from './sections.js';
import { sentences } from '../guide.js';

// Health, the three dots of the TV and when each source was last read
async function mountHealthSection(box) {
  useStyles();
  const health = el('div');
  const reads = el('div', 'grid');
  box.append(health, reads);
  const stop = await mountHealth(health);
  let gone = false;
  async function refresh() {
    const answer = await api('GET', '/status');
    if (gone) return;
    reads.innerHTML = answer.ok ? readsHtml(answer.data) + dotsHtml(answer.data) : '<section class="card"><h2>Last reads</h2><p>' + esc(answer.error) + '</p></section>';
  }
  await refresh();
  const timer = setInterval(refresh, 30000);
  return () => { gone = true; clearInterval(timer); if (typeof stop === 'function') stop(); };
}

// What every action printed, newest first, each in a drawer so the list stays short
function mountOutput(box) {
  const root = el('div', 'output');
  box.append(root);
  function paint() {
    const entries = outputEntries();
    root.innerHTML = '<section class="card"><h3>Output of the actions on this page</h3><p class="muted">The technical text behind each result. It is kept in this browser only, the last 40 entries, and holds no keys.</p>' +
      '<div class="buttons"><button type="button" class="btn btn-secondary" data-clear' + (entries.length ? '' : ' disabled') + '>Clear the list</button></div>' +
      (entries.length
        ? '<ul class="entries">' + entries.map(entry => '<li><details class="disclosure"><summary><span class="entry-state" data-ok="' + entry.ok + '">' + (entry.ok ? 'Done' : 'Failed') + '</span> ' + esc(entry.label) + ' <span class="muted">' + esc(whenWords(entry.at)) + '</span></summary><pre class="raw">' + esc(entry.raw || 'No text.') + '</pre></details></li>').join('') + '</ul>'
        : '<p class="empty">Nothing yet. When you press a button, its technical output is kept here.</p>') + '</section>';
    const clear = root.querySelector('[data-clear]');
    if (clear) clear.addEventListener('click', clearOutput);
  }
  paint();
  return onOutput(paint);
}

function mountSettings(box) {
  box.id = 'settings-all';
  return mountAll(box);
}

export const sections = [
  { id: 'health', title: 'Health', lead: sentences['status.health'], mount: mountHealthSection },
  { id: 'output', title: 'Action output', mount: mountOutput },
  { id: 'log', title: 'Logs', lead: sentences['settings.log'], mount: mountLog },
  { id: 'settings', title: 'All settings', lead: sentences['settings.all'], mount: mountSettings },
];

export function mountDetails(box, section) {
  return mountSections(box, { area: 'details', title: 'Details', sections: sections }, section === 'health' ? '' : section);
}
