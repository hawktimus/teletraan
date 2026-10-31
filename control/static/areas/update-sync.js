// Update, Sync: Sync everything at the top, then one card for each source with its name, when it last worked ("3:12 PM, 20 min
// ago"), a status chip, a Sync now button and the switch that includes or leaves it out of Sync everything. A failed source says
// why in one plain sentence and what the TV still shows; the raw reason is in a Show details drawer.
//
// The chips and times come from GET overview (poll.js). What each button last did is kept in this browser (action-run.js).

import { el, esc } from '../dom.js';
import { stateIcon } from '../icons.js';
import { subscribe } from '../poll.js';
import { networkDown, sourceFacts, sourceState } from '../overview.js';
import { plainProblem, whenWords } from '../words.js';
import { actionButton } from '../action-run.js';
import { isIncluded, lastSync, onSyncProgress, progress, runSyncOne, setIncluded, sources } from '../sync-run.js';
import { syncLinesHtml } from '../tabs/settings-sync.js';
import { switchHtml } from '../choice.js';
import { make } from './actions.js';
import { stickyBar } from './sticky.js';

const chipWords = { ok: 'OK', failed: 'Failed', never: 'Not run yet', syncing: 'Syncing', skipped: 'Skipped' };
const chipIcons = { ok: 'ok', failed: 'bad', never: 'unknown', syncing: 'working', skipped: 'warn' };
const lineStates = { ok: 'ok', bad: 'failed', skipped: 'skipped' };

// The Ran, Failed or Skipped line for each source, from what Sync everything just did
function linesFor(results) {
  return syncLinesHtml({ results: sources.filter(item => results[item.target]).map(item => ({ label: item.name, state: lineStates[results[item.target].state], words: results[item.target].reason || '' })) });
}

export function mountSync(box) {
  const root = el('div', 'update-sync');
  root.innerHTML = '<section class="card sync-all" aria-labelledby="sync-all-title"><h3 id="sync-all-title">Sync everything</h3>' +
    '<p class="muted">Reads every source now, one after another: calendars, Monday, competition, news, Match13 and Drive photos. One that fails does not stop the others. A source switched off below is skipped.</p>' +
    '<div data-all></div><div class="sync-results" data-results aria-live="polite"></div></section>' +
    '<div class="source-grid" data-sources></div>';
  box.append(root);

  const all = make('syncEverything');
  root.querySelector('[data-all]').append(all.root);
  const unstick = stickyBar(root, all, 'Sync everything', 'sync');
  const results = root.querySelector('[data-results]');
  const cards = {};
  let overview = null;

  sources.forEach(item => {
    const card = el('article', 'source card');
    card.dataset.source = item.target;
    card.innerHTML = '<div class="source-head"><h3>' + esc(item.name) + '</h3><span class="chip" data-chip></span></div>' +
      '<p class="source-when" data-when></p><div class="source-problem" data-problem hidden></div><div class="source-foot"><div data-sync></div>' +
      switchHtml({ checked: isIncluded(item.target), label: 'Include in Sync everything', attrs: 'data-include="' + esc(item.target) + '"' }) + '</div>';
    const own = actionButton({
      id: 'sync-' + item.target, label: 'Sync now', doing: 'Syncing ' + item.name, variant: 'secondary', icon: 'sync',
      run: async () => {
        const outcome = await runSyncOne(item.target);
        return { ok: outcome.state !== 'bad', words: outcome.state === 'ok' ? '' : outcome.reason, raw: outcome.raw };
      },
      after: () => paint(),
    });
    card.querySelector('[data-sync]').append(own.root);
    card.querySelector('[data-include]').addEventListener('change', event => setIncluded(item.target, event.target.checked));
    cards[item.target] = card;
    root.querySelector('[data-sources]').append(card);
  });

  function paintCard(item, now) {
    const card = cards[item.target];
    const state = overview ? sourceState(overview, item.target) : 'never';
    const last = lastSync(item.target);
    const running = progress.current === item.target;
    let chip = running ? 'syncing' : state;
    // A run that was skipped after the last good read is what the card says
    if (!running && last && last.state === 'skipped' && state !== 'failed') chip = 'skipped';
    const chipBox = card.querySelector('[data-chip]');
    chipBox.dataset.state = chip;
    chipBox.innerHTML = stateIcon(chipIcons[chip], 16) + '<span>' + esc(chipWords[chip]) + '</span>';
    const facts = overview ? sourceFacts(overview, item.target) : { lastGoodAt: '', failure: null };
    card.querySelector('[data-when]').textContent = facts.lastGoodAt ? 'Last worked: ' + whenWords(facts.lastGoodAt, now) : overview ? 'No good read yet.' : 'Waiting for the computer.';
    const problem = card.querySelector('[data-problem]');
    if (facts.failure && overview) {
      const said = plainProblem({ source: item.target, reason: facts.failure.reason, lastGoodAt: facts.lastGoodAt, networkDown: networkDown(overview) }, now);
      problem.hidden = false;
      problem.innerHTML = '<p><strong>' + esc(said.message) + '</strong></p><p class="muted">' + esc(said.still) + '</p>' +
        (said.where ? '<p class="muted">Where: ' + esc(said.where) + '. <a class="link" href="#update/keys">Open Keys</a></p>' : '') +
        '<details class="disclosure"><summary>Show details</summary><pre class="raw">' + esc(said.raw) + '</pre></details>';
    } else {
      problem.hidden = true;
      problem.replaceChildren();
    }
  }

  function paint() {
    const now = new Date();
    sources.forEach(item => paintCard(item, now));
  }

  const stopStore = subscribe(store => { overview = store.overview; paint(); });
  const stopProgress = onSyncProgress(() => {
    paint();
    results.innerHTML = Object.keys(progress.results).length ? linesFor(progress.results) : '';
  });
  paint();
  return () => { stopStore(); stopProgress(); unstick(); };
}
