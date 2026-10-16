// The Update tab: pick the repository folder on this computer, see how it compares with the wall, push it, and roll back.

import { registerTab } from './tabs.js';
import { api, shortDate } from './api.js';
import { treeHashOfFiles } from './tree-hash.js';
import { githubCard } from './github-card.js';
import { describeFolder, folderFiles, folderName, readCommit, shortCommit, versionLabel, zipCandidates, zipLimit } from './update-lib.js';

const stepNames = {
  download: 'Download from GitHub',
  unpack: 'Unpack the files',
  files: 'Check the files',
  schemas: 'Check the schemas',
  studio: 'Build the Studio',
  release: 'Write the release files',
  switch: 'Switch the wall',
  restart: 'Restart the screen',
  wait: 'Wait for the screen to report',
};

function element(tag, text, className) {
  const made = document.createElement(tag);
  if (text) made.textContent = text;
  if (className) made.className = className;
  return made;
}

// The zip of the folder, built in memory with the same exclusions the Teletraan computer uses
async function makeZip(files) {
  let fflate;
  try {
    fflate = await import('./vendor/fflate.js');
  } catch (error) {
    throw new Error('The zip library is missing.');
  }
  const entries = {};
  let total = 0;
  for (const item of zipCandidates(files)) {
    const bytes = new Uint8Array(await item.file.arrayBuffer());
    total += bytes.length;
    if (total > zipLimit) throw new Error('The folder is larger than 100 MB. Take out what is not part of the repository.');
    entries[item.path] = bytes;
  }
  return new Blob([fflate.zipSync(entries, { level: 6 })], { type: 'application/zip' });
}

function upload(blob, note, commit, onUpload, onEvent) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('note', note);
    form.append('commit', commit);
    form.append('zip', blob, 'teletraan.zip');
    const request = new XMLHttpRequest();
    let read = 0;
    const take = () => {
      // only whole lines are read; the end of a line that has not arrived yet waits for the next call
      const end = request.responseText.lastIndexOf('\n') + 1;
      request.responseText.slice(read, end).split('\n').forEach(line => {
        if (line.trim()) onEvent(JSON.parse(line));
      });
      read = end;
    };
    request.open('POST', '/control/api/releases');
    request.upload.onprogress = event => onUpload(event.loaded, event.total);
    request.onprogress = take;
    request.onload = () => {
      if (request.status === 401) location.reload();
      if (request.status !== 200) {
        let message = 'The upload failed (' + request.status + ').';
        try { message = JSON.parse(request.responseText).error || message; } catch (error) { /* keep the status text */ }
        reject(new Error(message));
        return;
      }
      take();
      resolve();
    };
    request.onerror = () => reject(new Error('The Teletraan computer could not be reached. Check the WiFi, or use the Tailscale name, then try again.'));
    request.send(form);
  });
}

registerTab({
  id: 'update',
  title: 'Update',
  order: 10,
  render(page) {
    const columns = element('div', '', 'columns');
    const push = element('section', '', 'card');
    const back = element('section', '', 'card');
    columns.append(push, back);
    // The GitHub card is first; the folder upload stays below it
    page.append(githubCard(stepNames, () => loadReleases().catch(() => {})), columns);

    const wall = element('p', 'Loading the releases...');
    const pick = element('label', 'Pick the repository folder', 'action');
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.hidden = true;
    pick.append(input);
    const remembered = element('span', '', 'muted');
    const folderLine = element('p', '');
    const note = document.createElement('input');
    note.type = 'text';
    note.maxLength = 200;
    note.placeholder = 'A note for this version (optional)';
    const button = element('button', 'Push → wall', 'action');
    button.type = 'button';
    button.disabled = true;
    const bar = document.createElement('progress');
    bar.hidden = true;
    bar.max = 1;
    const steps = element('ol', '', 'steps');
    const problem = element('p', '', 'bad');

    push.append(element('h2', 'From a folder on this computer'), wall, pick, remembered, folderLine, note, element('div', '', 'row'), problem, bar, steps);
    push.children[6].append(button);

    let releases = [];
    let files = [];
    let folderHash = '';
    let folderCommit = '';

    try { remembered.textContent = localStorage.getItem('control-folder') ? ' Last folder: ' + localStorage.getItem('control-folder') : ''; } catch (error) { /* no storage */ }

    async function loadReleases() {
      const answer = await api('releases');
      releases = answer.releases;
      const live = releases.find(release => release.current);
      wall.textContent = live ? 'On the wall: ' + versionLabel(live.version, live.commit) + (live.date ? ' · ' + shortDate(live.date) : '') : 'No release is on the wall yet.';
      renderRollback();
      compare();
    }

    function compare() {
      if (!folderHash) return;
      const said = describeFolder(releases, folderHash, folderCommit);
      folderLine.textContent = said.text;
      button.disabled = said.same;
    }

    input.addEventListener('change', async () => {
      problem.textContent = '';
      files = folderFiles(Array.from(input.files));
      if (files.length === 0) return;
      try { localStorage.setItem('control-folder', folderName(Array.from(input.files))); } catch (error) { /* no storage */ }
      folderLine.textContent = 'Reading the folder...';
      try {
        folderCommit = await readCommit(files);
        folderHash = await treeHashOfFiles(files.map(item => ({ path: item.path, read: () => item.file.arrayBuffer() })));
        if (!files.some(item => item.path === 'dashboard/index.html')) {
          problem.textContent = 'This is not the Teletraan repository folder (no dashboard/index.html).';
          button.disabled = true;
          return;
        }
        if (files.some(item => item.path.startsWith('deploy/scripts/'))) {
          problem.textContent = 'This copy is older than round 6; update it.';
          button.disabled = true;
          return;
        }
        compare();
      } catch (error) {
        problem.textContent = error.message;
      }
    });

    button.addEventListener('click', async () => {
      problem.textContent = '';
      steps.replaceChildren();
      button.disabled = true;
      bar.hidden = false;
      bar.value = 0;
      const lines = {};
      const onEvent = event => {
        if (event.step === 'finish') {
          const line = element('li', event.message, event.state);
          steps.append(line);
          return;
        }
        let line = lines[event.step];
        if (!line) {
          line = element('li');
          lines[event.step] = line;
          steps.append(line);
        }
        line.className = event.state;
        line.textContent = event.state === 'start' ? stepNames[event.step] || event.message : event.message;
      };
      try {
        const blob = await makeZip(files);
        await upload(blob, note.value, shortCommit(folderCommit), (loaded, total) => { bar.value = total ? loaded / total : 0; }, onEvent);
      } catch (error) {
        problem.textContent = error.message;
      }
      bar.hidden = true;
      await loadReleases();
    });

    // Rollback
    back.append(element('h2', 'Roll back'));
    const choose = document.createElement('select');
    const go = element('button', 'Switch to this version', 'action quiet');
    go.type = 'button';
    const backNote = element('p', '', 'muted');
    const chosen = element('p', '', 'muted');
    back.append(choose, chosen, element('div', '', 'row'), backNote);
    back.children[3].append(go);
    choose.addEventListener('change', () => { chosen.textContent = choose.selectedOptions.length ? choose.selectedOptions[0].textContent : ''; });

    function renderRollback() {
      choose.replaceChildren();
      releases.forEach(release => {
        const option = document.createElement('option');
        option.value = String(release.version);
        option.disabled = Boolean(release.current || release.legacy);
        option.textContent = versionLabel(release.version, release.commit) + (release.date ? ' · ' + shortDate(release.date) : '') + (release.note ? ' · ' + release.note : '') + (release.current ? ' (on the wall)' : '') + (release.legacy ? ' (old layout, kept as a record)' : '');
        choose.append(option);
      });
      go.disabled = !releases.some(release => !release.current && !release.legacy);
      chosen.textContent = choose.selectedOptions.length ? choose.selectedOptions[0].textContent : '';
    }

    go.addEventListener('click', async () => {
      const picked = releases.find(release => String(release.version) === choose.value);
      if (!picked || !window.confirm('Switch the wall to ' + versionLabel(picked.version, picked.commit) + '? The screen restarts and is black for about ten seconds.')) return;
      backNote.textContent = 'Switching...';
      try {
        const answer = await api('releases/' + picked.version + '/activate', { method: 'POST' });
        backNote.textContent = answer.message || 'The wall is on ' + versionLabel(picked.version, picked.commit) + '.';
      } catch (error) {
        backNote.textContent = error.message;
      }
      await loadReleases();
    });

    // The git path
    const git = element('section', '', 'card');
    git.append(element('h2', 'Push with git (optional)'), element('p', 'No GitHub is needed. The Teletraan computer keeps a bare repository, and a push to it installs the new version the same way.', 'muted'));
    const gitLines = element('pre', 'Loading...');
    git.append(gitLines);
    columns.append(git);
    api('update-info').then(info => {
      gitLines.textContent = info.remoteLine + '\n' + info.pushLine + '\n\nOn a new computer:\n' + info.cloneLine;
    }).catch(error => { gitLines.textContent = error.message; });

    loadReleases().catch(error => { wall.textContent = error.message; });
  },
});
