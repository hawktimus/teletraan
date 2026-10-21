// The text of the pictures of a row in the Display tab, as HTML strings with every value escaped. The page code is
// display-preview.js in this folder. Nothing here touches the page, so the tests can read it with node.

import { words } from '../display-preview.js';
import { esc } from './render.js';

// The right column: the big picture, its lines and, under them, the Save, Publish, Refresh and Undo bar. The frame itself is made by display-preview.js when a row is selected.
export function largeHtml() {
  return '<aside class="card preview-card" data-preview-card aria-label="Picture of the selected row">' +
    '<h2>Preview</h2>' +
    '<p class="word" data-large-title>Pick a row to see it.</p>' +
    '<div class="large-box" data-large-box><div class="large-stage" data-large-stage></div>' +
    '<p class="large-empty word" data-large-empty></p></div>' +
    '<p class="reason" data-large-reason hidden></p>' +
    '<p class="word" data-large-now></p>' +
    // The one action bar of the page: it acts on the rotation working copy and on the theme settings, which are saved together
    '<div class="action-bar" data-action-bar><div data-save-bar></div><p class="result" role="status" data-save-flash></p><div data-conflict></div></div>' +
    '<p class="note" data-kiosk-note hidden>' + esc(words.kiosk) + '</p>' +
    '<div class="buttons"><button type="button" class="act quiet" data-action="preview-here" hidden>' + esc(words.kioskButton) + '</button></div>' +
    '<div class="buttons"><button type="button" class="act quiet" data-action="clear-target" hidden>Preview the selected row instead</button></div>' +
    '<label class="check thumb-switch"><input type="checkbox" data-thumb-switch> Show thumbnails</label>' +
    '<p class="word" data-thumb-help>A small live picture on each row, at most 6 at a time.</p>' +
    '<p class="word">' + esc(words.note) + '</p>' +
    '</aside>';
}

// The slot of a row where its small picture goes. It shows the title until the picture is made. The page puts the frame in.
export function thumbHtml(title) {
  return '<div class="thumb" data-thumb aria-hidden="true"><span class="thumb-title">' + esc(title) + '</span></div>';
}
