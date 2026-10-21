// Adds one photo from the Control page (the Photos block of the Content tab).
//
//   POST /control/api/photo-upload    the picture as the raw body; headers: Content-Type (image/jpeg, image/png or image/webp),
//                                     X-Caption and X-Credit (each written with encodeURIComponent, both optional)
//
// The picture goes to the asset store of Sanity with the write key of the Teletraan computer, then a Photo draft that points at it
// is made, switched on, with the caption and the credit. Nothing reaches the wall before Publish, as in the Studio. The key is
// read at the moment of the write and is never in an answer. Anything that is not a picture of those three kinds, or is over 15 MB,
// is refused with a plain sentence before anything is sent to Sanity.

import { Refusal, mount, readBytes, send } from '../support/http.js';
import { makeSanity } from '../support/sanity.js';
import { getSpec } from '../support/settings-doc.js';
import { collectionOf, newDraft } from '../support/collection-doc.js';

export const mostBytes = 15 * 1024 * 1024;
export const kinds = ['image/jpeg', 'image/png', 'image/webp'];

// Whether the first bytes are those of the kind the browser claimed. A file renamed to .jpg is not a picture.
export function looksLike(kind, bytes) {
  const starts = (list, at = 0) => list.every((value, index) => bytes[at + index] === value);
  if (kind === 'image/jpeg') return bytes.length > 3 && starts([0xff, 0xd8, 0xff]);
  if (kind === 'image/png') return bytes.length > 8 && starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (kind === 'image/webp') return bytes.length > 12 && starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8);
  return false;
}

function headerText(req, name) {
  const raw = req.headers && req.headers[name];
  if (typeof raw !== 'string' || raw === '') return '';
  try {
    return decodeURIComponent(raw).trim();
  } catch (error) {
    throw new Refusal(400, 'The caption or the credit could not be read. Type it again.');
  }
}

// The dataset is public: no email address or phone number in a caption or a credit
function noContact(text, what) {
  if (/@/.test(text) || /\d{3}[\s.-]?\d{3}[\s.-]?\d{4}/.test(text)) throw new Refusal(400, 'The ' + what + ' has an email address or a phone number. The screen is public, so take it out.');
}

export function register(router, ctx) {
  mount(router, ctx, 'POST', '/photo-upload', async (req, res) => {
    const kind = String((req.headers && req.headers['content-type']) || '').split(';')[0].trim().toLowerCase();
    if (!kinds.includes(kind)) throw new Refusal(415, 'Only JPEG, PNG or WebP pictures can be added. Pick a different file.');
    const sanity = makeSanity(ctx);
    if (!sanity.hasToken()) throw new Refusal(503, 'SANITY_WRITE_TOKEN is not set on the Teletraan computer. Add it in Settings, Keys.');

    const caption = headerText(req, 'x-caption');
    const credit = headerText(req, 'x-credit');
    noContact(caption, 'caption');
    noContact(credit, 'credit');
    const set = {};
    if (caption) set.caption = caption;
    if (credit) set.credit = credit;
    // Checked against the Studio limits before the picture is sent anywhere
    const made = newDraft(collectionOf(await getSpec(ctx), 'photo'), { set: set }, []);

    const bytes = await readBytes(req, mostBytes);
    if (bytes.length === 0) throw new Refusal(400, 'The file was empty. Pick a different one.');
    if (!looksLike(kind, bytes)) throw new Refusal(415, 'That file is not really a ' + kind.replace('image/', '').toUpperCase() + ' picture. Pick a different file.');

    const assetId = await sanity.uploadImage(bytes, kind);
    made.mutations[0].create.image = { _type: 'image', asset: { _type: 'reference', _ref: assetId } };
    await sanity.mutate(made.mutations);
    ctx.log('photo added on the Control page: ' + made.id);
    send(res, 200, { ok: true, id: made.id });
  });
}
