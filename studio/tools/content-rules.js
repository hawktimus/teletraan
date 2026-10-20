// Small rules about what an editor types, shared by the schemas (as warnings while typing) and by the Check the screen
// report (tools/content-check.js). Plain functions only: they import nothing from the Studio, so node can run them.
// A rule gives back an empty text or true when the value is fine, and a plain sentence that says what to do when it is not.

import { contrast, photoPanel } from '../schemas/limits.js';

// The dataset is public. A web address, an email address or a phone number typed into any text can be read by anyone.
const emailPattern = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const addressPattern = /\b(?:https?:\/\/|www\.)\S+/i;
const domainPattern = /\b[a-z0-9][a-z0-9-]*\.(?:com|org|net|edu|gov|io|us|co|app|dev|me|ly|tv|info)\b/i;
const phonePattern = /(?:\+?\d{1,2}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}/;

// What kind of contact detail the text holds: 'an email address', 'a web address', 'a phone number', or '' for none
export function contactIn(text) {
  if (typeof text !== 'string') return '';
  if (emailPattern.test(text)) return 'an email address';
  if (addressPattern.test(text) || domainPattern.test(text)) return 'a web address';
  if (phonePattern.test(text)) return 'a phone number';
  return '';
}

// true, or a sentence for a validation warning
export function noContact(text) {
  const found = contactIn(text);
  return found === '' ? true : 'This has ' + found + '. The screen is public, so take it out.';
}

// A name that has a last name in it: a second word of three letters or more, such as Sam Smith. A last initial is fine.
export function looksLikeFullName(text) {
  if (typeof text !== 'string') return false;
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return false;
  return words.slice(1).some(word => /^[A-Z][A-Za-z'-]{2,}$/.test(word.replace(/\.$/, '')));
}

// true, or a sentence for a validation warning
export function firstNameOnlyWarning(text) {
  if (looksLikeFullName(text)) return 'This looks like a full name. The screen is public, so use a first name, or add a last initial.';
  return true;
}

// The first thing wrong with a credit, or ''. A credit is one first name.
export function creditTrouble(text) {
  if (typeof text !== 'string' || text.trim() === '') return '';
  if (contactIn(text) !== '') return 'has ' + contactIn(text);
  if (/\d/.test(text) || /\s/.test(text.trim())) return 'looks like more than a first name';
  return '';
}

// Whether a date and time, or a plain date, is before now. Text that is not a date is not past.
export function isPast(text, now = new Date()) {
  const time = Date.parse(text);
  return isFinite(time) && time < now.getTime();
}

// Text that is empty or only spaces
export function isBlank(value) {
  return typeof value !== 'string' || value.trim() === '';
}

// The same text with the capitals and the extra spaces taken out, to tell if two lines say the same
export function sameness(text) {
  return typeof text === 'string' ? text.trim().toLowerCase().replace(/\s+/g, ' ') : '';
}


// Photos

// Sanity puts the size of a picture in its id: image-<hash>-<width>x<height>-<format>
export function sizeOfAsset(ref) {
  const found = /^image-[A-Za-z0-9]+-(\d+)x(\d+)-[a-z0-9]+$/.exec(String(ref || ''));
  return found ? { width: Number(found[1]), height: Number(found[2]) } : null;
}

// The size in pixels of the part the editor kept after cutting the edges, or null when the size is not known.
// image is the value of an image field: its asset (a reference, or the document with metadata) and its crop.
export function keptPixels(image) {
  const asset = image && image.asset;
  if (!asset) return null;

  const dimensions = asset.metadata && asset.metadata.dimensions;
  const size = dimensions && dimensions.width > 0 && dimensions.height > 0 ? { width: dimensions.width, height: dimensions.height } : sizeOfAsset(asset._ref || asset._id);
  if (!size) return null;

  const crop = image.crop || {};
  const across = Math.max(0.01, 1 - (crop.left || 0) - (crop.right || 0));
  const down = Math.max(0.01, 1 - (crop.top || 0) - (crop.bottom || 0));
  return { width: Math.round(size.width * across), height: Math.round(size.height * down) };
}

// How the TV draws a photo: 'whole' fits all of it in, anything else fills the panel. setting is Photo fit in Dashboard Settings.
export function fitNow(fit, setting) {
  const own = fit === 'fill' || fit === 'whole' ? fit : '';
  return own || (setting === 'whole' ? 'whole' : 'fill');
}

// What is wrong with a photo on the TV, as a list of { level, message }. level is 'problem' or 'warning'.
// An empty list is a photo that fits the panel.
export function photoTrouble(image, fit, setting) {
  const size = keptPixels(image);
  if (!size) return [];

  const how = fitNow(fit, setting);
  const found = [];
  const wide = photoPanel.width;
  const high = photoPanel.height;
  const scale = how === 'whole' ? Math.min(wide / size.width, high / size.height) : Math.max(wide / size.width, high / size.height);
  const sizeWords = size.width + ' by ' + size.height + ' pixels';

  if (scale > 3) found.push({ level: 'problem', message: 'This photo is only ' + sizeWords + '. On the TV it is blown up so far that it looks blocky. Upload a bigger one, at least ' + wide + ' pixels wide.' });
  else if (scale > 1.25) found.push({ level: 'warning', message: 'This photo is ' + sizeWords + '. The panel is ' + wide + ' by ' + high + ', so the TV enlarges it and it looks soft. Upload one at least ' + wide + ' pixels wide.' });

  const aspect = size.width / size.height;
  if (aspect < 1 && how === 'fill') {
    const shown = Math.round((aspect * high / wide) * 100);
    found.push({ level: 'warning', message: 'This photo is taller than it is wide. Fill the frame shows only about ' + shown + ' percent of it. Pick Show the whole photo, or upload a wide one.' });
  }
  return found;
}


// Colors

// '#FF8800' as [red, green, blue] from 0 to 255, or null when it is not a six digit hex color
export function rgbOf(color) {
  const found = /^#?([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/.exec(String(color || '').trim());
  return found ? [parseInt(found[1], 16), parseInt(found[2], 16), parseInt(found[3], 16)] : null;
}

function lightness(color) {
  const parts = rgbOf(color).map(value => {
    const share = value / 255;
    return share <= 0.03928 ? share / 12.92 : Math.pow((share + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
}

// How well one color reads on another, from 1 (the same) to 21 (black on white). null when either is not a color.
export function contrastRatio(first, second) {
  if (!rgbOf(first) || !rgbOf(second)) return null;
  const a = lightness(first);
  const b = lightness(second);
  return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 10) / 10;
}

// The pairs of a team's colors that are drawn on each other: [ink, ground, where it is read]. headerInk is optional and the
// screen uses white without it.
const colorPairs = [
  ['text', 'background', 'the main text on the page', 'text'],
  ['text', 'body', 'the text inside the panels', 'text'],
  ['text', 'plate', 'the text on cards and plates', 'text'],
  ['label', 'body', 'the department names in rows', 'text'],
  ['accent', 'background', 'the key words and small marks', 'large'],
  ['neon', 'background', 'the thin lines and the clock digits', 'large'],
  ['headerInk', 'primary', 'the panel titles and the team plate', 'text'],
];

// What is hard to read in the colors of a team, as a list of { level, field, message }. A color that is missing or is not a
// hex color is left to the field's own rule.
export function colorTrouble(colors) {
  const set = colors && typeof colors === 'object' ? colors : {};
  const found = [];

  colorPairs.forEach(pair => {
    const ink = pair[0] === 'headerInk' && !set.headerInk ? '#FFFFFF' : set[pair[0]];
    const ratio = contrastRatio(ink, set[pair[1]]);
    const needs = contrast[pair[3]];
    if (ratio === null || ratio >= needs) return;

    found.push({
      level: ratio < contrast.invisible ? 'problem' : 'warning',
      field: pair[0],
      message: 'The ' + pair[0] + ' color on the ' + pair[1] + ' color is hard to read (' + ratio + ' to 1) for ' + pair[2] + '. From 20 feet it needs ' + needs + ' or more. Pick a lighter or darker ' + pair[0] + ' color.',
    });
  });
  return found;
}

// The first color problem as a sentence, or true. For a validation warning on the Colors box.
export function colorWarning(colors) {
  const found = colorTrouble(colors);
  return found.length === 0 ? true : found[0].message;
}
