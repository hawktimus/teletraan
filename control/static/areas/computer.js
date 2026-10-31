// The Computer area: the Teletraan computer itself. Restart the dashboard (the screen only), Restart services, Reboot the
// computer, what the network looks like (connection, address, uptime), the network check, the scheduled reboot, the screen fit,
// the clean up of expired items and the guided steps to copy the project to another device. The three restarts are the only
// buttons here that ask first: each says what will happen and how long the TV may go dark.

import { el, esc } from '../dom.js';
import { api } from '../tabs/api.js';
import { uptimeText } from '../tabs/render-health.js';
import { subscribe } from '../poll.js';
import { actionButton, helperRun, latestResult } from '../action-run.js';
import { clockWords } from '../words.js';
import { remoteWords } from '../overview.js';
import { make } from './actions.js';
import { mountSections } from './sections.js';
import { mountReboot } from '../tabs/settings-reboot.js';
import { mountScreen } from '../tabs/settings-screen.js';
import { mountCleanup } from '../tabs/settings-cleanup.js';
import { sentences } from '../guide.js';

// The "label: value" lines that network-info prints, as an object (the first of each label wins)
export function parseInfo(text) {
  const found = {};
  String(text || '').split('\n').forEach(line => {
    const at = line.indexOf(': ');
    if (at > 0 && /^[A-Za-z]+$/.test(line.slice(0, at)) && !(line.slice(0, at) in found)) found[line.slice(0, at)] = line.slice(at + 2).trim();
  });
  return found;
}

// The facts of the computer for a person: what it is connected with, its address, its signal. Nothing technical.
export function networkFacts(info) {
  const rows = [];
  if (info.type) rows.push(['Connection', info.type + (info.interface && info.interface !== 'none found' ? ' (' + info.interface + ')' : '')]);
  if (info.link) rows.push(['Link', /^up/.test(info.link) ? 'Up' : /^down/.test(info.link) ? 'Down' : 'Not known']);
  if (info.signal) rows.push(['Signal', info.signal]);
  if (info.ip) rows.push(['Address', info.ip]);
  if (info.gateway) rows.push(['Router', info.gateway]);
  return rows;
}

function factsList(rows) {
  return '<dl class="facts">' + rows.map(row => '<div><dt>' + esc(row[0]) + '</dt><dd>' + esc(row[1]) + '</dd></div>').join('') + '</dl>';
}

// Restart and reboot
function mountRestart(box) {
  const root = el('div', 'computer-restart');
  root.innerHTML = '<section class="card" aria-labelledby="this-computer"><h3 id="this-computer">This computer</h3><div data-facts><p class="muted">Reading the computer...</p></div><dl class="facts" data-last></dl></section>' +
    '<section class="card" aria-labelledby="restart-title"><h3 id="restart-title">Restart</h3><p class="muted">Each of these asks before it runs and says how long the TV may go dark. Start with the smallest.</p><div class="action-list" data-actions></div></section>';
  box.append(root);
  ['restartDashboard', 'restartServices', 'reboot'].forEach(name => root.querySelector('[data-actions]').append(make(name).root));

  let overview = null;
  const paintLast = () => {
    const latest = latestResult();
    root.querySelector('[data-last]').innerHTML = '<div><dt>Last remote action</dt><dd>' + esc(remoteWords(overview && overview.remoteLast) || 'None yet. Actions from the Studio show here.') + '</dd></div>' +
      '<div><dt>Last action on this page</dt><dd>' + esc(latest ? latest.label + ': ' + latest.words + ' (' + clockWords(latest.at) + ')' : 'None yet.') + '</dd></div>';
  };
  paintLast();
  const stop = subscribe(store => { overview = store.overview; paintLast(); });
  let gone = false;
  (async () => {
    const [status, info] = await Promise.all([api('GET', '/status'), api('POST', '/helper/network-info', {})]);
    if (gone) return;
    const rows = [];
    if (status.ok) {
      rows.push(['Up for', uptimeText(status.data.uptimeSeconds)]);
      if (status.data.kiosk) rows.push(['Screen service', status.data.kiosk]);
    }
    if (info.ok) rows.push(...networkFacts(parseInfo(info.data && info.data.output)));
    root.querySelector('[data-facts]').innerHTML = rows.length ? factsList(rows) : '<p class="muted">The computer did not tell. Check that it is on and on the WiFi, then reload this page.</p>';
  })();
  return () => { gone = true; stop(); };
}

// The network check
function mountNetwork(box) {
  const root = el('div', 'computer-network');
  root.innerHTML = '<section class="card" aria-labelledby="net-title"><h3 id="net-title">Network check</h3>' +
    '<p class="muted">Looks at the connection, the signal, the address and what the network watchdog has done. It changes nothing. The full report is in Details, to copy and send to a coach.</p>' +
    '<div data-check></div><div data-summary></div></section>' +
    '<section class="card"><h3>What the computer does by itself</h3><p class="muted">It checks the network every 2 minutes. After 3 failed checks in a row it restarts the network service, after 6 it resets the connection, and after 15 it reboots, at most once in 2 hours.</p></section>';
  box.append(root);
  const check = actionButton({
    id: 'network-check', label: 'Run network check', doing: 'Checking the network', variant: 'primary', icon: 'wifi',
    run: async signal => {
      const result = await helperRun('network-info')(signal);
      if (!result.ok) return result;
      root.querySelector('[data-summary]').innerHTML = factsList(networkFacts(parseInfo(result.raw)));
      return { ok: true, words: 'The full report is in Details.', raw: result.raw };
    },
  });
  root.querySelector('[data-check]').append(check.root);
}

// Copy the project to another device: the commands come from the computer (GET update-info), so no address is written in the page
function mountCopy(box) {
  const root = el('div', 'computer-copy');
  root.innerHTML = '<section class="card" aria-labelledby="copy-title"><h3 id="copy-title">Copy the project to another device</h3>' +
    '<p class="muted">The computer keeps a copy of the project that any laptop on the same network can copy. Follow the steps in order on the other device.</p>' +
    '<ol class="guided" data-steps><li>Loading the commands from the computer...</li></ol></section>';
  box.append(root);
  api('GET', '/update-info').then(result => {
    const list = root.querySelector('[data-steps]');
    if (!result.ok) {
      list.innerHTML = '<li class="bad">' + esc(result.error) + '</li>';
      return;
    }
    const info = result.data;
    list.innerHTML =
      '<li><strong>Open a terminal</strong> on the other device. It needs git installed.</li>' +
      '<li><strong>Copy the project</strong> with this command:<pre class="raw">' + esc(info.cloneLine) + '</pre></li>' +
      '<li><strong>Link the copy to this computer</strong>, so later pushes reach it:<pre class="raw">' + esc(info.remoteLine) + '</pre></li>' +
      '<li><strong>To publish a change</strong> from the copy, push it:<pre class="raw">' + esc(info.pushLine) + '</pre>The computer installs the new version the same way as an upload.</li>';
  });
}

export const sections = [
  { id: 'restart', title: 'Restart', mount: mountRestart },
  { id: 'network', title: 'Network', mount: mountNetwork },
  { id: 'schedule', title: 'Scheduled reboot', lead: sentences['settings.reboot'], mount: mountReboot },
  { id: 'screen', title: 'Screen fit', lead: sentences['settings.screen'], mount: mountScreen },
  { id: 'cleanup', title: 'Clean up', lead: sentences['settings.cleanup'], mount: mountCleanup },
  { id: 'copy', title: 'Copy project', mount: mountCopy },
];

export function mountComputer(box, section) {
  return mountSections(box, { area: 'computer', title: 'Computer', sections: sections }, section === 'restart' ? '' : section);
}
