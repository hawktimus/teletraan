// The "From GitHub" card at the top of the Update tab: what is newest on GitHub, what is on the wall, and one
// button that installs it. The steps are shown the same way as for a folder.

import { api } from './api.js';
import { versionLabel, restartWords, waitUntilBack } from './update-lib.js';

function element(tag, text, className) {
  const made = document.createElement(tag);
  if (text) made.textContent = text;
  if (className) made.className = className;
  return made;
}

// stepNames: the plain words for each install step. reload: called when an install is over.
export function githubCard(stepNames, reload) {
  const card = element('section', '', 'card');
  const github = element('p', 'Asking GitHub...');
  const wall = element('p', '');
  const button = element('button', 'Update from GitHub', 'action');
  button.type = 'button';
  button.disabled = true;
  const again = element('button', 'Check again', 'link');
  again.type = 'button';
  const row = element('div', '', 'row');
  row.append(button, again);
  const problem = element('p', '', 'bad');
  const steps = element('ol', '', 'steps');
  card.append(element('h2', 'From GitHub'), github, wall, row, problem, steps);

  let found = null;
  let switched = false;
  let busy = false;

  async function check() {
    problem.textContent = '';
    github.textContent = 'Asking GitHub...';
    button.disabled = true;
    found = null;
    try {
      found = await api('github/latest');
      github.textContent = 'On GitHub: ' + found.short + ' ' + found.message;
      wall.textContent = 'On the wall: ' + versionLabel(found.wall.version, found.wall.short);
      button.textContent = found.onWall ? 'Already on the wall' : 'Update from GitHub';
      button.disabled = found.onWall || busy;
    } catch (error) {
      github.textContent = 'On GitHub: not known';
      problem.textContent = error.message;
    }
  }

  function show(event) {
    if (event.step === 'finish') {
      steps.append(element('li', event.message, event.state));
      return;
    }
    let line = steps.querySelector('[data-step="' + event.step + '"]');
    if (!line) {
      line = element('li');
      line.dataset.step = event.step;
      steps.append(line);
    }
    line.className = event.state;
    line.textContent = event.state === 'start' ? stepNames[event.step] || event.message : event.message;
    if (event.step === 'switch' && event.state === 'done') switched = true;
  }

  async function run() {
    const response = await fetch('/control/api/github/update', { method: 'POST' });
    if (response.status === 401) location.reload();
    if (!response.ok) {
      const answer = await response.json().catch(() => ({}));
      throw new Error(answer.error || 'The update failed (' + response.status + ').');
    }
    // one JSON line per step; a line that has not fully arrived waits for the next read
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    for (;;) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = pending.split('\n');
      pending = done ? '' : lines.pop();
      lines.forEach(line => { if (line.trim()) show(JSON.parse(line)); });
      if (done) break;
    }
  }

  button.addEventListener('click', async () => {
    if (!found || !window.confirm('Update the wall to ' + found.short + ' from GitHub? The screen restarts and is black for about ten seconds.')) return;
    busy = true;
    button.disabled = true;
    problem.textContent = '';
    steps.replaceChildren();
    switched = false;
    try {
      await run();
    } catch (error) {
      if (switched) {
        // the wall is already on the new version: the stream broke because the service restarted
        problem.textContent = restartWords;
        problem.className = 'note';
        const back = await waitUntilBack();
        problem.className = 'bad';
        problem.textContent = back ? '' : 'The control service has not answered for 90 seconds. Reload this page. If it stays down, use the Mac tool update.';
      } else {
        problem.textContent = error.message;
      }
    }
    busy = false;
    await reload();
    await check();
  });
  again.addEventListener('click', check);

  check();
  return card;
}
