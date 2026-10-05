// Decides which content the screen shows: what the editors published
// ("production") or the sample in data/sample. Dashboard Settings has the
// say, through two settings: Content source, and Switch back to production at.
//
// This file asks Sanity for just those two (a tiny request), remembers the
// last answer on this computer, and keeps asking, so a change takes effect on
// a running screen with no reload. content.js starts the matching reader.
//
// If Sanity cannot be asked (no network, a bad answer, no answer in 5
// seconds) the saved answer is used. With no saved answer either,
// useSampleContent in config.js decides. A good answer that says there is no
// Dashboard Settings document yet means the defaults, which is production.

import { contentSources, defaultSettings, sanity, useSampleContent } from '../config.js';
import { fetchSourceSettings } from './sanity.js';
import { parseLocalDateTime } from './time.js';

const storageKey = 'teletraan-source';
const askEvery = 30 * 1000;
const lookAtClockEvery = 5 * 1000;

// The two settings, with anything unusable replaced by its default
export function tidySourceSettings(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};

  return {
    contentSource: contentSources.includes(data.contentSource) ? data.contentSource : defaultSettings.contentSource,
    switchBackAt: typeof data.switchBackAt === 'string' ? data.switchBackAt : defaultSettings.switchBackAt,
  };
}

// Returns 'sample' or 'production'. Sample only lasts until the switch back
// time. A time that cannot be read is ignored, so the sample stays on.
export function pickSource(settings, now) {
  const tidy = tidySourceSettings(settings);
  if (tidy.contentSource !== 'sample') return 'production';

  const switchBack = parseLocalDateTime(tidy.switchBackAt);
  return switchBack && switchBack <= now ? 'production' : 'sample';
}

// The answer from the last good read, kept so the screen can still decide
// when the network is down
function readSavedSettings() {
  try {
    const text = localStorage.getItem(storageKey);
    if (!text) return null;

    const saved = JSON.parse(text);
    const usable = saved && saved.settings && typeof saved.settings.contentSource === 'string';
    return usable ? tidySourceSettings(saved.settings) : null;
  } catch (error) {
    console.error('Could not read the saved content source', error);
    return null;
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), settings: settings }));
  } catch (error) {
    console.error('Could not save the content source', error);
  }
}

// Reads Dashboard Settings once and resolves with
//   { source: 'sample' or 'production', keepWatching(onChange) }
// The screen starts the matching reader and then calls keepWatching. From
// then on onChange('sample') or onChange('production') is called each time
// the answer changes.
export async function chooseSource() {
  // With no project there is nothing to ask, so it is always the sample
  if (sanity.projectId === '') return { source: 'sample', keepWatching: () => {} };

  let known = null; // the last good answer: from Sanity, or the saved one

  async function ask() {
    try {
      known = tidySourceSettings(await fetchSourceSettings(sanity));
      saveSettings(known);
    } catch (error) {
      console.error('Could not read Dashboard Settings', error);
    }
  }

  // Date.now() so a test can move the clock
  function decide() {
    if (known) return pickSource(known, new Date(Date.now()));
    return useSampleContent ? 'sample' : 'production';
  }

  await ask();
  if (!known) known = readSavedSettings();
  let source = decide();

  return {
    source: source,
    keepWatching(onChange) {
      function check() {
        const next = decide();
        if (next === source) return;

        source = next;
        try {
          onChange(next);
        } catch (error) {
          console.error('Could not switch the content source', error);
        }
      }

      // Asking Sanity picks up a new Content source. Looking at the clock
      // picks up the Switch back time when it arrives, to the second or so.
      setInterval(async () => {
        await ask();
        check();
      }, askEvery);
      setInterval(check, lookAtClockEvery);
    },
  };
}
