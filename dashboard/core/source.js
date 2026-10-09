// Decides which content the screen shows: what the editors published
// ("production") or the sample in data/sample. The screen always shows
// production, whatever Dashboard Settings store. The sample is for trying
// things out: add ?sample=1 to the address of the dashboard and that page
// shows it. Nothing saved in Sanity or on this computer can switch it.

import { sanity } from '../config.js';

let asked = false; // ?sample=1 in the address, for this page only

// ?sample=1 in the address, like ?team=. Any other value is ignored.
export function askForSample(value) {
  asked = value === '1';
}

// Returns 'sample' or 'production'. With no Sanity project in config.js there
// is nothing to read, so it is always the sample.
export function chosenSource() {
  if (sanity.projectId === '') return 'sample';
  return asked ? 'sample' : 'production';
}
