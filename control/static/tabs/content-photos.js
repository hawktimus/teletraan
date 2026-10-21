// Photos, a block of the Content tab: the Photo documents of the Studio as a grid of small pictures, newest first, each with its
// caption, credit, Show or Hide switch, expiry and fit, and Edit, Publish and Delete. Add photo sends the picture to
// POST /control/api/photo-upload, which stores it in Sanity and makes the Photo draft. The grid asks Sanity for each picture no wider
// than 480 pixels, never the original. The source of the Photo panel (upload or a Google Drive folder) is shown here and changed in
// Settings, All settings.

import { api as realApi } from './api.js';
import { h } from '../settings-all-fields.js';
import { button, mountList } from './content-list.js';
import { creditProblem, fitWords, photoFileProblem, sortPhotos } from './content-items.js';

const sourceWords = { upload: 'Upload photos', drive: 'Google Drive folder', both: 'Both uploaded photos and the Google Drive folder' };
const day = iso => (iso && !isNaN(Date.parse(iso)) ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const captionLongest = 36;
const creditLongest = 14;

function card(item) {
  const doc = item.document;
  return h('div', { class: 'ct-photo' },
    item.picture
      ? h('img', { class: 'ct-thumb', src: item.picture, alt: doc.caption || 'Photo with no caption', loading: 'lazy', decoding: 'async' })
      : h('div', { class: 'ct-thumb ct-nothumb', text: 'No picture' }),
    h('div', { class: 'ct-row' },
      h('p', { class: 'ct-title', text: doc.caption || 'No caption' }),
      h('p', { class: 'ct-sub', text: [doc.credit ? 'Photo: ' + doc.credit : 'No credit', fitWords[doc.fit] || fitWords.setting, doc.expires ? 'Hides after ' + day(doc.expires) : ''].filter(Boolean).join(' · ') })));
}

async function mountSource(host, ctx) {
  const call = ctx.api || realApi;
  const answer = await call('GET', '/content/photo-source');
  if (!answer.ok) {
    host.replaceChildren(h('p', { class: 'bad', text: answer.error }));
    return;
  }
  const data = answer.data;
  const parts = ['The Photo panel plays: ' + (sourceWords[data.source] || data.source) + '.'];
  if (data.source !== 'upload') {
    parts.push(data.folderEnd ? 'The Drive folder ends in ' + data.folderEnd + '.' : 'No Drive folder is named yet.');
    parts.push(data.read ? 'Last read ' + day(data.read.at) + ', ' + data.read.count + (data.read.count === 1 ? ' photo' : ' photos') + (data.read.state && data.read.state !== 'ok' ? ' (' + data.read.state + ')' : '') + '.' : 'The folder has not been read yet.');
  }
  host.replaceChildren(h('div', { class: 'ct-source', 'data-source': data.source },
    h('p', { class: 'word', text: parts.join(' ') }),
    data.source === 'drive' ? h('p', { class: 'word', text: 'Photos added here do not play while the source is the Google Drive folder.' }) : null,
    h('p', {}, h('a', { class: 'act quiet ct-link', href: '#settings/all', text: 'Settings, All settings, Photos' }))));
}

// Reads the file as it is, with its type and the caption and credit in headers, so the service can hold it to the limits
function uploadForm(host, ctx, list, tools) {
  const send = tools.send;
  const state = { working: false };
  const flash = h('p', { class: 'ct-flash', role: 'status' });
  const file = h('input', { id: 'ct-up-file', type: 'file', accept: 'image/jpeg,image/png,image/webp' });
  const caption = h('input', { id: 'ct-up-caption', type: 'text', autocomplete: 'off', maxlength: String(captionLongest) });
  const credit = h('input', { id: 'ct-up-credit', type: 'text', autocomplete: 'off', maxlength: String(creditLongest) });
  const captionCount = h('p', { class: 'ct-sub' });
  const creditWarn = h('p', { class: 'ct-sub', 'data-warn': 'credit', role: 'status' });
  const go = button('Upload photo', { 'data-act': 'upload', class: 'act' }, upload);

  function refresh() {
    captionCount.textContent = caption.value.length + ' of ' + captionLongest + ' characters. Optional. No last names.';
    creditWarn.textContent = creditProblem(credit.value) || 'Optional. The first name of the person who took it, up to ' + creditLongest + ' characters.';
    creditWarn.dataset.state = creditProblem(credit.value) ? 'bad' : '';
    go.disabled = state.working || !list.canWrite();
  }

  async function upload() {
    const picked = file.files && file.files[0];
    const problem = photoFileProblem(picked) || creditProblem(credit.value);
    flash.dataset.state = 'bad';
    if (problem) { flash.textContent = problem; return; }
    state.working = true;
    refresh();
    flash.dataset.state = 'wait';
    flash.textContent = 'Uploading ' + Math.max(1, Math.round(picked.size / 1024)) + ' KB. Wait for the line to change.';
    const answer = await send(picked, caption.value.trim(), credit.value.trim());
    state.working = false;
    if (answer.ok) {
      file.value = '';
      caption.value = '';
      credit.value = '';
      refresh();
      return list.reload('done', 'Added as a draft. It is not on the wall until you press Publish.');
    }
    flash.dataset.state = 'bad';
    flash.textContent = answer.error;
    refresh();
  }

  [caption, credit].forEach(control => control.addEventListener('input', refresh));
  host.replaceChildren(h('section', { class: 'ct-post', 'aria-label': 'Add photo' },
    h('h3', { class: 'ct-group', text: 'Add photo' }),
    h('p', { class: 'word', text: 'A JPEG, PNG or WebP picture up to 15 MB. The file name is not kept. It is saved as a draft, switched on, and reaches the wall when you press Publish.' }),
    h('label', { for: 'ct-up-file', text: 'Picture' }), file,
    h('label', { for: 'ct-up-caption', text: 'Caption' }), caption, captionCount,
    h('label', { for: 'ct-up-credit', text: 'Credit' }), credit, creditWarn,
    h('div', { class: 'buttons' }, go),
    flash));
  refresh();
  return refresh;
}

// The upload is not JSON, so it does not go through the shared call
async function sendPicture(file, caption, credit) {
  const headers = { 'Content-Type': file.type };
  if (caption) headers['X-Caption'] = encodeURIComponent(caption);
  if (credit) headers['X-Credit'] = encodeURIComponent(credit);
  try {
    const response = await fetch('/control/api/photo-upload', { method: 'POST', headers: headers, body: file, credentials: 'same-origin', cache: 'no-store' });
    let data = null;
    try { data = await response.json(); } catch (error) { data = null; }
    if (response.ok) return { ok: true, data: data, error: '' };
    return { ok: false, data: data, error: response.status === 401 ? 'Enter the PIN first. Reload the page.' : (data && data.error) || 'The Teletraan computer answered with a problem (' + response.status + ').' };
  } catch (error) {
    return { ok: false, data: null, error: 'The Teletraan computer could not be reached. Check the WiFi, or use the Tailscale name.' };
  }
}

export async function mountPhotos(body, ctx = {}) {
  const sourceHost = h('div', { 'data-part': 'source' });
  const uploadHost = h('div', { 'data-part': 'upload' });
  const listHost = h('div', { 'data-part': 'photos' });
  body.replaceChildren(
    h('p', { class: 'word', text: 'The pictures of the Photo panel, newest first. Hide a photo to keep it without showing it, or set a date after which it hides itself. Deleting one removes it from the wall and the Studio.' }),
    sourceHost, uploadHost, listHost);
  const list = await mountList(listHost, {
    type: 'photo',
    noun: 'photo',
    empty: 'No photos yet. Use Add photo above.',
    addButton: false,
    grid: true,
    nameOf: doc => doc.caption || 'Photo with no caption',
    row: card,
    sort: sortPhotos,
  }, ctx);
  uploadForm(uploadHost, ctx, list, { send: ctx.upload || sendPicture });
  await mountSource(sourceHost, ctx);
}
