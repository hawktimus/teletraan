// Update, Publish: putting a new version of the dashboard on the wall, as four steps, with the release that is on the wall and the
// one before it shown first. The two ways to get a version (GitHub, or a folder on this computer), the push and the rollback are
// the cards of the old Updates section (tabs/settings-update.js, github-card.js); this file adds the four steps and the two
// release cards around them, and follows each step of an install so the list says which step is running.

import { el, esc } from '../dom.js';
import { api, shortDate } from '../api.js';
import { versionLabel } from '../update-lib.js';
import { mountUpdate } from '../tabs/settings-update.js';

const steps = [
  { id: 'upload', title: 'Upload', says: 'Pick the new version: from GitHub, or from the folder on this computer.' },
  { id: 'check', title: 'Check', says: 'The computer checks the files and the Studio before anything changes.' },
  { id: 'publish', title: 'Publish', says: 'The wall switches to the new version and the screen restarts.' },
  { id: 'rollback', title: 'Roll back', says: 'If something is wrong, switch back to the previous version below.' },
];

// Which of the four steps an install step belongs to
export function flowStepOf(step) {
  if (['download', 'unpack', 'upload'].includes(step)) return 'upload';
  if (['files', 'schemas', 'studio', 'release'].includes(step)) return 'check';
  if (['switch', 'restart', 'wait'].includes(step)) return 'publish';
  return '';
}

function releaseCard(title, release, empty) {
  const card = el('section', 'card release');
  const label = release ? versionLabel(release.version, release.commit) : '';
  card.innerHTML = '<h3>' + esc(title) + '</h3>' + (release
    ? '<p class="release-name">' + esc(label) + '</p><p class="muted">' + esc(release.date ? shortDate(release.date) : 'date not known') + (release.note ? ' · ' + esc(release.note) : '') + '</p>'
    : '<p class="muted">' + esc(empty) + '</p>');
  return card;
}

export function mountPublish(box) {
  const root = el('div', 'update-publish');
  root.innerHTML = '<div class="release-pair" data-releases><section class="card release"><h3>On the wall now</h3><p class="muted">Loading the releases...</p></section><section class="card release"><h3>Previous release</h3><p class="muted">Loading the releases...</p></section></div>' +
    '<ol class="flow" data-flow>' + steps.map((step, at) => '<li data-step="' + step.id + '" data-state="waiting"><span class="flow-number" aria-hidden="true">' + (at + 1) + '</span><span><strong>' + esc(step.title) + '</strong><span class="flow-says">' + esc(step.says) + '</span><span class="flow-state" data-flow-state>Waiting</span></span></li>').join('') + '</ol>' +
    '<div class="tab-cards" data-cards></div>';
  box.append(root);

  const flow = root.querySelector('[data-flow]');
  const mark = (id, state, words) => {
    const item = flow.querySelector('[data-step="' + id + '"]');
    if (!item) return;
    item.dataset.state = state;
    item.querySelector('[data-flow-state]').textContent = words;
  };
  const reset = () => steps.forEach(step => mark(step.id, 'waiting', 'Waiting'));

  let running = '';
  const onEvent = event => {
    if (event.step === 'begin') {
      reset();
      running = 'upload';
      mark('upload', 'working', 'Working');
      return;
    }
    if (event.step === 'end') {
      if (event.state === 'fail') mark(running || 'upload', 'bad', 'Did not finish. The wall still runs the version above.');
      else {
        steps.slice(0, 3).forEach(step => mark(step.id, 'done', 'Done'));
        mark('rollback', 'waiting', 'Available if you need it');
      }
      running = '';
      return;
    }
    const id = flowStepOf(event.step);
    if (!id) return;
    // A step that starts closes the ones before it
    const order = steps.map(step => step.id);
    order.slice(0, order.indexOf(id)).forEach(before => mark(before, 'done', 'Done'));
    running = id;
    mark(id, event.state === 'fail' ? 'bad' : 'working', event.state === 'fail' ? 'Did not finish' : 'Working');
  };

  mountUpdate(root.querySelector('[data-cards]'), onEvent);

  let gone = false;
  async function showReleases() {
    try {
      const answer = await api('releases');
      if (gone) return;
      const live = answer.releases.find(release => release.current);
      const before = answer.releases.filter(release => !release.current && !release.legacy && (!live || release.version < live.version))[0] || null;
      const pair = root.querySelector('[data-releases]');
      pair.replaceChildren(releaseCard('On the wall now', live, 'No release is on the wall yet.'), releaseCard('Previous release', before, 'No earlier release is kept yet.'));
    } catch (error) {
      root.querySelector('[data-releases]').replaceChildren(el('p', 'bad', 'The releases could not be read: ' + error.message));
    }
  }
  showReleases();
  const timer = setInterval(showReleases, 30000);
  return () => { gone = true; clearInterval(timer); };
}
