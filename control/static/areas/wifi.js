// Wi-Fi and the network repairs of the Computer area. The Wi-Fi card lists the networks the computer can see, takes the
// password and asks the computer to join. The computer changes network while this page is talking to it, so the page loses
// its connection on purpose: the switch runs on its own on the computer, goes back to the old network when the new one does not
// work, and leaves its result in a file that this card reads (the helper word wifi-status). The password is sent once, in
// the body of one request, and the field is emptied at once. It is never kept in this browser, shown, or put in Details.

import { el, esc } from '../dom.js';
import { api } from '../tabs/api.js';
import { actionButton, helperRun } from '../action-run.js';
import { parseInfo } from './computer.js';
import { clockWords } from '../words.js';
import { choiceElement, switchElement } from '../choice.js';

// "network: 72|yes|1|School Guest" lines from the scan, strongest first
export function parseNetworks(text) {
  return String(text || '').split('\n').map(line => /^network: (\d{1,3})\|(yes|no|enterprise)\|([01])\|(.+)$/.exec(line.trim())).filter(Boolean)
    .map(found => ({ signal: Number(found[1]), lock: found[2], inUse: found[3] === '1', name: found[4] }));
}

export function signalWords(percent) {
  if (percent >= 70) return 'Strong signal';
  if (percent >= 45) return 'Good signal';
  if (percent >= 25) return 'Weak signal';
  return 'Very weak signal';
}

export function lockWords(lock) {
  if (lock === 'no') return 'Open, no password';
  if (lock === 'enterprise') return 'Needs a user name. Set it at the computer.';
  return 'Password needed';
}

// What the last switch did, in a sentence for a person (the file holds state, network, previous, at and reason)
export function switchWords(info) {
  if (!info || !info.state || info.state === 'none') return '';
  const when = info.at ? ' (' + clockWords(info.at) + ')' : '';
  if (info.state === 'working') return 'The computer is joining ' + (info.network || 'the network') + '.';
  if (info.state === 'done') return 'Joined ' + (info.network || 'the network') + when + '.';
  if (info.state === 'reverted') return (info.reason || 'The new network did not work.') + when;
  return (info.reason || 'The switch did not finish.') + when;
}

function mountWifi(box) {
  const root = el('div', 'computer-wifi');
  const secure = window.location.protocol === 'https:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
  root.innerHTML = '<section class="card" aria-labelledby="wifi-title"><h3 id="wifi-title">Wi-Fi</h3>' +
    '<p class="muted">Pick the network the TV computer should use. If the new network does not work, the computer goes back to the old one by itself.</p>' +
    '<p class="wifi-now" data-now>Press the button to look for networks.</p>' +
    '<div data-scan></div>' +
    '<form class="wifi-form" data-form autocomplete="off" hidden>' +
    '<fieldset class="wifi-list"><legend>Choose a network</legend><div data-list></div></fieldset>' +
    '<div class="wifi-hidden" data-hidden hidden><label for="wifi-name">Network name</label><input id="wifi-name" type="text" maxlength="32" autocomplete="off" autocapitalize="off" spellcheck="false"></div>' +
    '<div class="wifi-secret" data-secret><label for="wifi-password">Password</label><input id="wifi-password" type="password" maxlength="64" autocomplete="off" autocapitalize="off" spellcheck="false">' +
    '<div data-show-box></div></div>' +
    '<div data-connect></div></form>' +
    (secure ? '' : '<p class="muted wifi-warning">This page is not on an encrypted connection, so the password crosses the school network in the open on its way to the computer. Only continue on a network you trust.</p>') +
    '<p class="wifi-result" data-result role="status" aria-live="polite"></p></section>';
  box.append(root);

  const now = root.querySelector('[data-now]');
  const form = root.querySelector('[data-form]');
  const list = root.querySelector('[data-list]');
  const hiddenBox = root.querySelector('[data-hidden]');
  const secret = root.querySelector('[data-secret]');
  const nameInput = root.querySelector('#wifi-name');
  const password = root.querySelector('#wifi-password');
  const result = root.querySelector('[data-result]');
  let chosen = null;
  let gone = false;
  let timer = null;

  const show = switchElement({ label: 'Show the password' });
  root.querySelector('[data-show-box]').append(show);
  show.querySelector('input').addEventListener('change', event => { password.type = event.target.checked ? 'text' : 'password'; });

  const connect = actionButton({
    id: 'wifi-connect', label: 'Connect', doing: 'Starting the switch', variant: 'primary', icon: 'wifi', ownTimeout: false,
    confirm: { title: 'Switch the Wi-Fi?', body: 'The computer leaves its current network and joins the new one. This page loses its connection while it does.', dark: 'The TV keeps its picture. If the new network does not work, the computer goes back by itself within about two minutes.', confirmLabel: 'Switch the Wi-Fi' },
    run: async signal => {
      const name = chosen && chosen.hidden ? nameInput.value : chosen && chosen.name;
      const phrase = password.value;
      password.value = '';
      if (!name) return { ok: false, words: 'Choose a network first.', raw: 'no network chosen' };
      if (chosen.lock !== 'no' && phrase.length < 8) return { ok: false, words: 'A Wi-Fi password is at least 8 characters.', raw: 'password too short' };
      const sent = await api('POST', '/helper/wifi-connect', { ssid: name, password: chosen.lock === 'no' ? '' : phrase, confirmed: true }, signal);
      if (!sent.ok) return { ok: false, words: sent.error, raw: 'wifi-connect: ' + sent.error };
      watch(name);
      return { ok: true, words: 'The computer is joining ' + name + '. This page may lose its connection for a minute.', raw: 'wifi-connect: started for ' + name };
    },
  });
  root.querySelector('[data-connect]').append(connect.root);

  function choose(item) {
    chosen = item;
    hiddenBox.hidden = !item.hidden;
    secret.hidden = item.lock === 'no' || item.lock === 'enterprise';
    connect.button.disabled = item.lock === 'enterprise';
    connect.root.hidden = false;
    password.value = '';
  }

  function showNetworks(networks) {
    list.textContent = '';
    const items = networks.map(network => Object.assign({}, network, { hidden: false })).concat([{ name: '', signal: 0, lock: 'yes', inUse: false, hidden: true }]);
    const group = choiceElement({
      name: 'wifi-network', label: 'Choose a network',
      items: items.map((item, at) => ({
        value: String(at), disabled: item.lock === 'enterprise',
        label: item.hidden ? 'Another network. Type its name, for a network that does not show in the list.'
          : item.name + (item.inUse ? ' (connected now)' : '') + '. ' + signalWords(item.signal) + '. ' + lockWords(item.lock),
      })),
    });
    group.addEventListener('change', event => { if (event.target.value in items) choose(items[event.target.value]); });
    list.append(group);
    const current = items.find(item => item.inUse);
    if (current) now.textContent = 'Connected to ' + current.name + '.';
    form.hidden = false;
    connect.root.hidden = true;
    hiddenBox.hidden = true;
    secret.hidden = true;
  }

  const scan = actionButton({
    id: 'wifi-scan', label: 'Look for networks', doing: 'Looking for networks', variant: 'secondary', icon: 'sync',
    run: async signal => {
      const found = await helperRun('wifi-scan')(signal);
      if (!found.ok) return found;
      const networks = parseNetworks(found.raw);
      if (!networks.length) return { ok: false, words: 'No networks were found. The Wi-Fi adapter may be off, or the computer may not use the Wi-Fi.', raw: found.raw };
      showNetworks(networks);
      return { ok: true, words: networks.length + (networks.length === 1 ? ' network found.' : ' networks found.'), raw: found.raw };
    },
  });
  root.querySelector('[data-scan]').append(scan.root);

  // After a switch starts: ask for the result every 3 seconds for 3 minutes. A call that fails is expected, because the computer
  // is changing network, so the card says so and keeps trying.
  function watch(name) {
    let tries = 0;
    clearTimeout(timer);
    result.textContent = 'The computer is joining ' + name + '...';
    const look = async () => {
      if (gone) return;
      tries += 1;
      const found = await api('POST', '/helper/wifi-status', {});
      if (gone) return;
      if (found.ok) {
        const info = parseInfo(found.data && found.data.output);
        const words = switchWords(info);
        if (words) result.textContent = words;
        if (info.state === 'done' || info.state === 'reverted' || info.state === 'failed') return;
      } else {
        result.textContent = 'This page lost its connection to the computer. That is expected while it changes network. If the computer moved to another network, connect this device to the same one and reload the page. The result shows here.';
      }
      if (tries < 60) timer = setTimeout(look, 3000);
    };
    timer = setTimeout(look, 3000);
  }

  (async () => {
    const found = await api('POST', '/helper/wifi-status', {});
    if (gone || !found.ok) return;
    const info = parseInfo(found.data && found.data.output);
    const words = switchWords(info);
    if (words) result.textContent = 'Last switch: ' + words;
    if (info.state === 'working') watch(info.network || 'the network');
  })();

  return () => { gone = true; clearTimeout(timer); };
}

// Restart the network service and the name servers. The restart asks first; the name servers do not, and each undoes the other.
function mountRepairs(box) {
  const root = el('div', 'computer-repairs');
  root.innerHTML = '<section class="card" aria-labelledby="repair-title"><h3 id="repair-title">Network repairs</h3>' +
    '<p class="muted">Use these when the check says the computer cannot reach the internet. The computer also tries them by itself when the network stays down.</p>' +
    '<div class="action-list" data-actions></div></section>';
  box.append(root);
  const list = root.querySelector('[data-actions]');
  [
    actionButton({
      id: 'restart-network', label: 'Restart the network', doing: 'Restarting the network', variant: 'secondary', icon: 'power',
      hint: 'Restarts the network service and asks the router for an address again.',
      confirm: { title: 'Restart the network?', body: 'The network service restarts. This page loses its connection and comes back by itself.', dark: 'The TV keeps its picture. The computer is offline for up to a minute.', confirmLabel: 'Restart the network' },
      run: async signal => {
        const found = await helperRun('restart-network', {}, true)(signal);
        if (!found.ok && /not answering|could not be reached|stopped waiting/.test(found.words || '')) return { ok: true, words: 'The network is restarting. This page reconnects by itself.', raw: found.raw };
        return found;
      },
    }),
    actionButton({ id: 'dns-public', label: 'Use public name servers', doing: 'Changing the name servers', variant: 'secondary', icon: 'wifi', hint: 'Looks up addresses with 1.1.1.1 and 8.8.8.8 instead of the ones the school network hands out.', run: helperRun('dns-public') }),
    actionButton({ id: 'dns-default', label: "Use the network's name servers", doing: 'Changing the name servers', variant: 'secondary', icon: 'wifi', hint: 'Goes back to the name servers the network hands out.', run: helperRun('dns-default') }),
  ].forEach(item => list.append(item.root));
}

export function mountWifiSection(box) {
  const stop = mountWifi(box);
  mountRepairs(box);
  return stop;
}
