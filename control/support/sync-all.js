// Sync all: asks the helper for each sync in a fixed order, one after another. A sync that is switched off or not
// installed is skipped, and a sync that fails never stops the ones after it. Every sync has a line of its own in the
// answer: ok, skipped or failed, with the reason in plain words.

// The order the syncs run in, and the names the page shows. The targets are the ones the helper accepts for sync-now.
export const syncTargets = [
  { target: 'calendars', label: 'Calendars' },
  { target: 'monday', label: 'Monday' },
  { target: 'frc', label: 'Competition' },
  { target: 'news', label: 'FRC news' },
  { target: 'match13', label: 'Match13' },
  { target: 'photos-drive', label: 'Drive photos' },
];

// systemd says one of these when the service of a sync was never installed
const missingWords = /not found|not loaded|no such file|is masked|does not exist|could not be found/i;

export function isNotInstalled(message) {
  return missingWords.test(String(message || ''));
}

// Every sentence of a failure is short and plain: the helper's own sentence, cut to 200 characters
function reasonOf(error) {
  return String((error && error.message) || 'The helper did not answer.').replace(/\s+/g, ' ').trim().slice(0, 200);
}

// helper(word, args) is ctx.helper. skip lists the targets that are switched off. Returns { results, ok, skipped, failed }.
export async function runSyncAll(helper, skip = [], log = () => {}) {
  const results = [];
  for (const item of syncTargets) {
    if (skip.includes(item.target)) {
      results.push({ target: item.target, label: item.label, state: 'skipped', words: 'Switched off.' });
      continue;
    }
    try {
      await helper('sync-now', [item.target]);
      results.push({ target: item.target, label: item.label, state: 'ok', words: 'The sync ran.' });
    } catch (error) {
      if (isNotInstalled(error && error.message)) {
        results.push({ target: item.target, label: item.label, state: 'skipped', words: 'Not installed on this computer.' });
      } else {
        log('sync all: ' + item.target + ' failed: ' + reasonOf(error));
        results.push({ target: item.target, label: item.label, state: 'failed', words: reasonOf(error) });
      }
    }
  }
  const count = state => results.filter(result => result.state === state).length;
  return { results: results, ok: count('ok'), skipped: count('skipped'), failed: count('failed') };
}

// One line for the foot of the list: "4 ran, 1 skipped, 1 failed."
export function summaryWords(answer) {
  const parts = [answer.ok + ' ran'];
  if (answer.skipped) parts.push(answer.skipped + ' skipped');
  if (answer.failed) parts.push(answer.failed + ' failed');
  return parts.join(', ') + '.';
}
