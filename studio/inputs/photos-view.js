// The Photos page, in the sidebar under PEOPLE. It is a page of its own, not a document. It does three things:
//   it picks where the Photo panel gets its pictures (Upload photos, Google Drive folder or Both),
//   it adds many pictures at once, each as a draft photo, and
//   it takes the link of the Google Drive folder and says how the last read of it went.
// The list of photos is one link away (photosChild). The page writes only photoSource and photoDriveFolder to the
// draft of Dashboard Settings and creates draft photos, and Publish all puts them on the screen. It never publishes.
//
// It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useRef, useState } from 'react';
import { useClient } from 'sanity';
import { usePaneRouter } from 'sanity/structure';
import { choiceButtons } from './field-editor.js';
import {
  creditProblem,
  draftId,
  driveStatusLine,
  fileProblem,
  folderCheck,
  photoDraft,
  photosChild,
  settingsFrom,
  settingsId,
  sources,
  uploadSummary,
  words,
} from './photos-parts.js';

const h = createElement;

const apiVersion = '2025-02-19';

const border = '1px solid var(--card-border-color, rgba(128, 128, 128, 0.4))';
const muted = 'var(--card-muted-fg-color, inherit)';
const critical = 'var(--card-badge-critical-fg-color, #b91c1c)';
const primaryBackground = 'var(--card-badge-primary-bg-color, #dbeafe)';
const primaryText = 'var(--card-badge-primary-fg-color, #1e40af)';

const styles = {
  page: { boxSizing: 'border-box', height: '100%', overflowY: 'auto', padding: '24px 16px' },
  column: { maxWidth: 760, margin: '0 auto' },
  heading: { fontSize: 24, fontWeight: 600, margin: '0 0 8px' },
  subheading: { fontSize: 18, fontWeight: 600, margin: '32px 0 8px' },
  text: { lineHeight: 1.5, margin: '0 0 16px', overflowWrap: 'anywhere' },
  muted: { color: muted, fontSize: 14, lineHeight: 1.5, margin: '0 0 16px', overflowWrap: 'anywhere' },
  failed: { color: critical, lineHeight: 1.5, margin: '0 0 16px', overflowWrap: 'anywhere' },
  choices: { display: 'flex', flexWrap: 'wrap', gap: 8, margin: '0 0 8px' },
  choice: {
    boxSizing: 'border-box',
    flex: '1 1 200px',
    minHeight: 44,
    padding: '10px 12px',
    fontFamily: 'inherit',
    fontSize: 16,
    fontWeight: 600,
    textAlign: 'left',
    color: 'inherit',
    background: 'transparent',
    border: border,
    borderRadius: 4,
    cursor: 'pointer',
  },
  choicePicked: { borderColor: primaryText, background: primaryBackground, color: primaryText },
  choiceHelp: { display: 'block', marginTop: 2, fontSize: 14, fontWeight: 400 },
  label: { display: 'block', fontWeight: 600, margin: '0 0 4px' },
  input: { boxSizing: 'border-box', width: '100%', maxWidth: 520, minHeight: 44, padding: '4px 12px', fontFamily: 'inherit', fontSize: 16, border: '2px solid #7d828b', borderRadius: 4 },
  button: { boxSizing: 'border-box', minHeight: 44, fontFamily: 'inherit', fontSize: 16, padding: '4px 16px', color: 'inherit', background: 'transparent', border: border, borderRadius: 4, cursor: 'pointer' },
  buttonBusy: { opacity: 0.5, cursor: 'default' },
  row: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 8, margin: '0 0 8px' },
  block: { margin: '0 0 16px' },
  list: { margin: '0 0 16px', paddingLeft: 24, lineHeight: 1.5 },
};

// Reads the source and the folder (draft first), and the published status of the Teletraan computer. Nothing fails: what
// cannot be read is null.
export async function readPhotos(client) {
  const read = { settings: null, status: null };
  try {
    const found = await client.fetch('*[_id in [$draft, $published]]{ _id, photoSource, photoDriveFolder }', { draft: draftId, published: settingsId }, { perspective: 'raw' });
    read.settings = settingsFrom(found);
  } catch (error) {
    read.settings = null;
  }
  try {
    const found = await client.fetch('*[_id == "status-mini"][0]{ photosDriveAt, photosDriveCount, photosDriveState }', {}, { perspective: 'published' });
    read.status = found && typeof found === 'object' ? found : null;
  } catch (error) {
    read.status = null;
  }
  return read;
}

// Writes the fields to the draft of Dashboard Settings, made from the published document first when there is no draft
async function saveFields(client, fields) {
  const published = await client.getDocument(settingsId);
  const draft = await client.getDocument(draftId);
  if (!draft && !published) throw new Error(words.notPublished);
  if (!draft) {
    const copy = Object.assign({}, published, { _id: draftId });
    ['_rev', '_createdAt', '_updatedAt'].forEach(name => delete copy[name]);
    await client.createIfNotExists(copy);
  }
  return client.patch(draftId).set(fields).commit();
}

function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return 'photo-' + crypto.randomUUID();
  return 'photo-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function plainButton(label, onClick, busy) {
  return h('button', { type: 'button', disabled: busy, style: busy ? Object.assign({}, styles.button, styles.buttonBusy) : styles.button, onClick: onClick }, label);
}

function sourceButtons(current, change, busy) {
  return h(
    'div',
    { 'data-block': 'sources' },
    choiceButtons({
      name: 'photos-source',
      label: words.choose,
      disabled: busy,
      items: sources.map(item => ({ key: item.value, label: h('span', null, item.title, h('span', { style: styles.choiceHelp }, item.help)), checked: current === item.value, onPick: () => change(item.value) })),
    })
  );
}

function uploadBlock(state, set, pick, ChildLink) {
  const credit = creditProblem(state.credit);
  return h(
    'div',
    { 'data-block': 'upload' },
    h('h2', { style: styles.subheading }, words.uploadHeading),
    h('p', { style: styles.text }, words.uploadHelp),
    h(
      'div',
      { style: styles.block },
      h('label', { style: styles.label, htmlFor: 'photos-credit' }, words.creditLabel),
      h('input', { id: 'photos-credit', type: 'text', value: state.credit, maxLength: 14, style: styles.input, onChange: event => set({ credit: event.target.value }) }),
      h('p', { style: credit ? styles.failed : styles.muted }, credit || words.creditHelp)
    ),
    h(
      'div',
      { style: styles.block },
      h('label', { style: styles.label, htmlFor: 'photos-expires' }, words.expiresLabel),
      h('input', { id: 'photos-expires', type: 'datetime-local', value: state.expires, style: styles.input, onChange: event => set({ expires: event.target.value }) }),
      h('p', { style: styles.muted }, words.expiresHelp)
    ),
    h(
      'div',
      { style: styles.block },
      h('label', { style: styles.label, htmlFor: 'photos-files' }, words.pickLabel),
      h('input', { id: 'photos-files', type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif', multiple: true, disabled: state.uploading || Boolean(credit), style: Object.assign({}, styles.input, { padding: '8px 12px' }), onChange: pick })
    ),
    state.progress ? h('p', { style: styles.muted, 'aria-live': 'polite' }, state.progress) : null,
    state.lines.length > 0 ? h('ul', { style: styles.list, 'aria-live': 'polite' }, state.lines.map(line => h('li', { key: line }, line))) : null,
    ChildLink ? h('p', { style: styles.text }, h(ChildLink, { childId: photosChild }, words.listLink), ' ' + words.listHelp) : null
  );
}

function driveBlock(state, set, save, busy) {
  const check = folderCheck(state.folder);
  return h(
    'div',
    { 'data-block': 'drive' },
    h('h2', { style: styles.subheading }, words.driveHeading),
    h('p', { style: styles.text }, words.driveHelp),
    h('label', { style: styles.label, htmlFor: 'photos-folder' }, words.folderLabel),
    h(
      'div',
      { style: styles.row },
      h('input', { id: 'photos-folder', type: 'text', value: state.folder, maxLength: 200, style: styles.input, placeholder: 'https://drive.google.com/drive/folders/...', onChange: event => set({ folder: event.target.value }) }),
      plainButton(words.folderSave, save, busy || !check.ok)
    ),
    check.problem ? h('p', { style: styles.failed, role: 'alert' }, check.problem) : null,
    h('p', { style: styles.text, 'data-line': 'drive-status' }, driveStatusLine(state.status, state.savedFolder, new Date())),
    h('p', { style: styles.muted }, words.folderNameHelp),
    h('p', { style: styles.muted }, words.folderCountOnly)
  );
}

export function PhotosView() {
  const client = useClient({ apiVersion: apiVersion });
  const paneRouter = usePaneRouter();
  const ChildLink = paneRouter ? paneRouter.ChildLink : null;
  const [state, setState] = useState({ read: false, source: 'upload', savedFolder: '', folder: '', status: null, hasSettings: false, busy: false, text: '', failed: false, credit: '', expires: '', uploading: false, progress: '', lines: [] });
  const stateRef = useRef(state);
  stateRef.current = state;

  const set = changes => setState(Object.assign({}, stateRef.current, changes));

  useEffect(() => {
    let stopped = false;

    readPhotos(client).then(read => {
      if (stopped) return;
      const settings = read.settings;
      setState(Object.assign({}, stateRef.current, {
        read: true,
        hasSettings: Boolean(settings),
        source: settings ? settings.source : 'upload',
        folder: settings ? settings.folder : '',
        savedFolder: settings ? settings.folder : '',
        status: read.status,
      }));
    });
    return () => {
      stopped = true;
    };
  }, []);

  function save(fields, after) {
    set({ busy: true, text: '', failed: false });
    return saveFields(client, fields)
      .then(() => setState(Object.assign({}, stateRef.current, after, { busy: false, text: words.saved, failed: false })))
      .catch(error => set({ busy: false, text: words.problem + (error && error.message ? error.message : ''), failed: true }));
  }

  const changeSource = source => save({ photoSource: source }, { source: source });
  const saveFolder = () => {
    const check = folderCheck(stateRef.current.folder);
    if (!check.ok) return Promise.resolve();
    const value = stateRef.current.folder.trim();
    return save({ photoDriveFolder: value }, { folder: value, savedFolder: value });
  };

  // One picture after another, so a failure names the file and the rest still go
  async function pick(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;

    const current = stateRef.current;
    if (creditProblem(current.credit)) return;
    const options = { credit: current.credit.trim(), expires: current.expires ? new Date(current.expires).toISOString() : '' };

    set({ uploading: true, progress: '', lines: [] });
    const problems = [];
    let added = 0;

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const problem = fileProblem(file);
      if (problem) {
        problems.push(problem);
        continue;
      }
      set({ progress: 'Adding ' + (index + 1) + ' of ' + files.length + ': ' + file.name });
      try {
        const asset = await client.assets.upload('image', file, { filename: file.name });
        await client.create(photoDraft(newId(), asset._id, options));
        added++;
      } catch (error) {
        problems.push(file.name + ' was not added. Check the connection and add it again.');
      }
    }
    set({ uploading: false, progress: '', lines: uploadSummary(added, problems) });
  }

  let body;
  if (!state.read) body = h('p', { style: styles.muted }, words.reading);
  else if (!state.hasSettings) body = h('p', { style: styles.failed, role: 'alert' }, words.notPublished);
  else {
    body = [
      h('h2', { key: 'choose', style: styles.subheading }, words.choose),
      h('div', { key: 'sources' }, sourceButtons(state.source, changeSource, state.busy)),
      state.text ? h('p', { key: 'text', role: state.failed ? 'alert' : undefined, 'aria-live': 'polite', style: state.failed ? styles.failed : styles.muted }, state.text) : null,
      state.source !== 'drive' ? h('div', { key: 'upload' }, uploadBlock(state, set, pick, ChildLink)) : null,
      state.source !== 'upload' ? h('div', { key: 'drive' }, driveBlock(state, set, saveFolder, state.busy)) : null,
      state.source === 'drive' && ChildLink ? h('p', { key: 'listlink', style: styles.muted }, h(ChildLink, { childId: photosChild }, words.listLink), ' (photos uploaded here do not play while the source is Google Drive folder)') : null,
    ];
  }

  return h('div', { style: styles.page }, h('div', { style: styles.column }, h('h1', { style: styles.heading }, words.heading), h('p', { style: styles.text }, words.help), body));
}
