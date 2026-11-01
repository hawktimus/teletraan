// The Now area: one banner that says All good or Needs attention, the five status dots, the three primary buttons and the list
// of what needs attention, each problem as one plain sentence with what is still on the TV and a button where a fix is safe.
// Everything is drawn from the answer of GET overview (poll.js), which the page asks every 10 seconds while it is visible.
// Raw reasons are never on this screen except inside a Show details drawer.

import { el, esc } from '../dom.js';
import { icon, stateIcon } from '../icons.js';
import { subscribe } from '../poll.js';
import { buildBanner, buildDots, buildProblems, networkActionWords, remoteWords, sourceFacts } from '../overview.js';
import { clockWords, nameOf, whenWords } from '../words.js';
import { actionButton, helperRun, latestResult } from '../action-run.js';
import { specs, make } from './actions.js';
import { runSyncOne, setIncluded, sources } from '../sync-run.js';
import { stickyBar } from './sticky.js';
import { lead } from '../guide.js';

const stateWords = { ok: 'OK', warn: 'Late', bad: 'Problem', unknown: 'Not known' };

// What a dot's panel says: the facts behind it, in plain words
function dotFacts(id, overview, now) {
  const status = (overview && overview.status) || {};
  const wall = (overview && overview.wall) || {};
  const lines = [];
  if (id === 'sanity') {
    const own = overview.syncStatus && overview.syncStatus.sources && overview.syncStatus.sources.sanity;
    lines.push('Content last read: ' + (whenWords(own && own.lastSuccessAt, now) || 'not known'));
  } else if (id === 'monday') {
    lines.push('Last read: ' + (whenWords(sourceFacts(overview, 'monday').lastGoodAt, now) || 'not known'));
  } else if (id === 'band') {
    lines.push('Calendars last read: ' + (whenWords(sourceFacts(overview, 'calendars').lastGoodAt, now) || 'not known'));
  } else if (id === 'network') {
    const watch = overview.netwatch || {};
    lines.push('Last good check: ' + (whenWords(watch.lastOkAt, now) || 'not known'));
    lines.push('Checks failed in a row: ' + (typeof watch.failures === 'number' ? watch.failures : 'not known'));
    lines.push('Last network repair: ' + (networkActionWords(watch, now) || 'none recorded'));
  } else if (id === 'screen') {
    lines.push(wall.reporting ? 'The screen reported ' + wall.ageSeconds + ' seconds ago.' : 'The screen has not reported yet.');
    if (wall.showing && wall.showing.build) lines.push('Version on the screen: ' + wall.showing.build);
    if (status.kiosk) lines.push('Screen service: ' + status.kiosk);
  }
  return lines;
}

const problemSources = { sanity: ['sanity'], monday: ['monday'], band: ['calendars'], network: ['network'], screen: ['screen'] };

function skeleton() {
  const root = el('div', 'now');
  root.innerHTML = '<header class="area-head"><h2 id="area-title">Now</h2>' + lead('now') + '</header>' +
    '<section class="banner" data-banner data-state="unknown" role="status" aria-live="polite"><span class="banner-icon">' + icon('clock', 28) + '</span><div><p class="banner-words">Checking the computer...</p><p class="banner-time"></p></div></section>' +
    '<section aria-labelledby="dots-title"><h3 id="dots-title" class="visually-hidden">Status of each source</h3><ul class="dots" data-dots></ul><div class="dot-detail card" data-dot-detail hidden></div></section>' +
    '<section class="primary" aria-labelledby="primary-title"><h3 id="primary-title" class="visually-hidden">Main actions</h3><div class="primary-grid" data-primary></div></section>' +
    '<section class="card attention" aria-labelledby="attention-title"><h3 id="attention-title">Attention</h3><div data-attention><p class="muted">Waiting for the first check.</p></div></section>' +
    '<section class="card" aria-labelledby="showing-title"><h3 id="showing-title">On the TV now</h3><p data-showing class="muted">Waiting for the screen.</p><p><a class="link" href="#show">Change what is shown</a></p></section>' +
    '<section class="card" aria-labelledby="last-title"><h3 id="last-title">Last actions</h3><dl class="facts" data-last></dl></section>';
  return root;
}

export function mountNow(box) {
  const root = skeleton();
  box.append(root);
  const q = name => root.querySelector('[' + name + ']');

  // The three primary buttons. They live as long as the area, so a running action is never redrawn.
  const sync = make('syncEverything');
  const refresh = make('refreshScreen');
  const restart = make('restartDashboard');
  [sync, refresh, restart].forEach(action => q('data-primary').append(action.root));
  const unstick = stickyBar(root, sync, 'Sync everything', 'sync');

  let open = '';
  let lastProblems = '';
  let current = null;

  function fixButton(problem, fix) {
    const key = 'fix-' + problem.id + '-' + fix.id;
    if (fix.id === 'sync') {
      const target = problem.source === 'band' ? 'calendars' : problem.source;
      if (!sources.some(item => item.target === target)) return null;
      return actionButton({
        id: key, label: fix.label, doing: 'Syncing ' + nameOf(target), variant: 'secondary', icon: 'sync',
        run: async () => {
          const outcome = await runSyncOne(target);
          return { ok: outcome.state !== 'bad', words: outcome.state === 'ok' ? '' : outcome.reason, raw: outcome.raw };
        },
      }).root;
    }
    if (fix.id === 'network') {
      return actionButton({
        id: key, label: fix.label, doing: 'Checking the network', variant: 'secondary', icon: 'wifi',
        run: async signal => {
          const result = await helperRun('network-info')(signal);
          return result.ok ? { ok: true, words: 'The report is in Details.', raw: result.raw } : result;
        },
      }).root;
    }
    if (fix.id === 'exclude') {
      const wrap = el('div', 'act-box');
      const button = el('button', 'btn btn-secondary');
      button.type = 'button';
      button.textContent = fix.label;
      const line = el('p', 'action-status');
      line.setAttribute('role', 'status');
      line.setAttribute('aria-live', 'polite');
      button.addEventListener('click', () => {
        setIncluded(problem.source === 'band' ? 'calendars' : problem.source, false);
        button.disabled = true;
        line.dataset.state = 'done';
        line.textContent = 'Done. ' + nameOf(problem.source) + ' is switched off for Sync all. Turn it on again in Update.';
      });
      wrap.append(button, line);
      return wrap;
    }
    if (fix.id === 'restart-screen') return make('restartDashboard').root;
    if (fix.id === 'keys') {
      const link = el('a', 'btn btn-secondary', fix.label);
      link.href = '#update/keys';
      return link;
    }
    return null;
  }

  function paintProblems(problems) {
    const sign = JSON.stringify(problems.map(item => [item.id, item.message, item.kind]));
    const target = q('data-attention');
    if (sign === lastProblems) return;
    // A button that is running is never redrawn under the finger
    if (target.querySelector('[aria-busy="true"]')) return;
    lastProblems = sign;
    target.replaceChildren();
    if (problems.length === 0) {
      const none = el('p', 'empty');
      none.innerHTML = icon('check') + '<span>Nothing needs attention.</span>';
      target.append(none);
      return;
    }
    const list = el('ul', 'problems');
    problems.forEach(problem => {
      const item = el('li', 'problem');
      item.dataset.severity = problem.severity;
      item.dataset.problem = problem.id;
      const head = el('p', 'problem-message');
      head.innerHTML = stateIcon(problem.severity === 'bad' ? 'bad' : 'warn', 22) + '<span><strong>' + esc(problem.message) + '</strong></span>';
      const still = el('p', 'muted', problem.still);
      item.append(head, still);
      if (problem.where) item.append(el('p', 'muted', 'Where: ' + problem.where + '.'));
      const buttons = el('div', 'problem-actions');
      problem.fixes.forEach(fix => {
        const made = fixButton(problem, fix);
        if (made) buttons.append(made);
      });
      if (buttons.children.length) item.append(buttons);
      const more = el('details', 'disclosure');
      more.innerHTML = '<summary>Show details</summary><pre class="raw">' + esc(problem.raw || 'No more detail was reported.') + '</pre><p><a class="link" href="#details/health">Open Details</a></p>';
      item.append(more);
      list.append(item);
    });
    target.append(list);
  }

  function paintDots(dots, overview, now) {
    const list = q('data-dots');
    list.replaceChildren();
    dots.forEach(dot => {
      const item = el('li');
      const button = el('button', 'dot-button');
      button.type = 'button';
      button.dataset.dot = dot.id;
      button.dataset.state = dot.state;
      button.setAttribute('aria-expanded', String(open === dot.id));
      button.setAttribute('aria-controls', 'dot-detail');
      button.innerHTML = '<span class="dot" data-state="' + esc(dot.state) + '">' + stateIcon(dot.state, 18) + '</span><span class="dot-name">' + esc(dot.label) + '</span><span class="dot-word">' + esc(stateWords[dot.state]) + '</span>';
      button.addEventListener('click', () => {
        open = open === dot.id ? '' : dot.id;
        paintDots(dots, overview, now);
      });
      item.append(button);
      list.append(item);
    });
    const detail = q('data-dot-detail');
    detail.id = 'dot-detail';
    detail.hidden = open === '';
    if (open) {
      const dot = dots.find(item => item.id === open);
      const mine = buildProblems(overview, now).filter(item => (problemSources[open] || []).includes(item.source));
      detail.innerHTML = '<h3>' + esc(dot.label) + ': ' + esc(stateWords[dot.state]) + '</h3>' +
        '<ul class="facts-list">' + dotFacts(open, overview, now).map(line => '<li>' + esc(line) + '</li>').join('') + '</ul>' +
        (mine.length ? '<p><strong>' + esc(mine[0].message) + '</strong></p><p class="muted">' + esc(mine[0].still) + '</p>' : '<p class="muted">Nothing wrong with ' + esc(dot.label) + '.</p>') +
        (dot.raw ? '<details class="disclosure"><summary>Show details</summary><pre class="raw">' + esc(dot.raw) + '</pre></details>' : '') +
        '<p><a class="link" href="' + (open === 'screen' ? '#computer' : open === 'network' ? '#computer/network' : '#update') + '">' + (open === 'screen' ? 'Open Computer' : open === 'network' ? 'Open the network check' : 'Open Update') + '</a></p>';
    }
  }

  function paintLast(overview, now) {
    const latest = latestResult();
    const remote = remoteWords(overview && overview.remoteLast, now);
    q('data-last').innerHTML =
      '<div><dt>Last remote action</dt><dd>' + esc(remote || 'None yet. Actions from the Studio show here.') + '</dd></div>' +
      '<div><dt>Last network repair</dt><dd>' + esc(networkActionWords(overview && overview.netwatch, now) || 'None recorded.') + '</dd></div>' +
      '<div><dt>Last action on this page</dt><dd>' + esc(latest ? latest.label + ': ' + latest.words + ' (' + clockWords(latest.at) + ')' : 'None yet.') + '</dd></div>';
  }

  const stop = subscribe(store => {
    const now = new Date();
    const overview = store.overview;
    current = overview;
    const banner = buildBanner(overview, now);
    const bannerBox = q('data-banner');
    bannerBox.dataset.state = banner.state;
    bannerBox.dataset.severity = banner.severity || '';
    bannerBox.querySelector('.banner-icon').innerHTML = icon(banner.state === 'good' ? 'check' : banner.state === 'attention' ? 'alert' : 'clock', 28);
    bannerBox.querySelector('.banner-words').textContent = banner.words;
    bannerBox.querySelector('.banner-time').textContent = banner.checked ? 'Last check ' + banner.checked + (store.unreachable ? ' (the computer is not answering now)' : '') : '';
    if (!overview) return;
    paintDots(buildDots(overview, now), overview, now);
    paintProblems(buildProblems(overview, now));
    const showing = overview.wall && overview.wall.showing;
    q('data-showing').textContent = showing
      ? [showing.view && showing.view + ' view', showing.theme && showing.theme + ' theme', showing.panel, showing.paused ? 'rotation paused' : ''].filter(Boolean).join(', ') + '.'
      : 'The screen has not reported yet.';
    paintLast(overview, now);
  });

  // A button that finishes is also the last thing this page did, so the line is read again a moment after any press
  root.addEventListener('click', () => setTimeout(() => { if (current) paintLast(current, new Date()); }, 600));
  return () => { stop(); unstick(); };
}
