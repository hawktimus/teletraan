// Checks what Sanity sent before it becomes content.json, and says what it found. Nothing here drops a row: a value that
// can be repaired is repaired (a date and time with no zone gets the zone of the Look page), and a value that cannot is left as
// it is and listed. The list is written to data/live/data-problems.json by the sync service, read by the control page (Update,
// under each source) and counted in the Studio status document. The TV never shows it (docs/OPERATIONS.md).
//
// Pure functions, so tests/ingest-validate.test.mjs can run them.

export const listKeys = ['tasks', 'people', 'subteams', 'sponsors', 'tipsAndNews', 'plans', 'presentations', 'photos', 'teams', 'customPanels', 'calendarFilters', 'subthemes', 'screens', 'views', 'milestones', 'notices'];
// Most rows listed for one source; the count is always the whole number
export const mostListed = 200;

const departments = ['build', 'electrical', 'programming', 'design', 'cnc', 'strategy', 'operations', 'business', 'marketing'];
const plainDate = /^\d{4}-\d{2}-\d{2}$/;
const withZone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;
const noZone = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

// The offset of a zone at an instant, in minutes east of UTC
function offsetMinutes(zone, instant) {
  const parts = {};
  new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(instant).forEach(part => { parts[part.type] = Number(part.value); });
  return Math.round((Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - instant.getTime()) / 60000);
}

// "2026-11-17T18:00" in a zone as an ISO text with Z, or null when the zone is unknown
export function isoInZone(text, zone) {
  const found = noZone.exec(text);
  if (!found) return null;
  const clock = Date.UTC(Number(found[1]), Number(found[2]) - 1, Number(found[3]), Number(found[4]), Number(found[5]), Number(found[6] || 0));
  try {
    // Two passes, so the offset is the one at the moment itself and not at the same instant read as UTC
    let guess = clock - offsetMinutes(zone, new Date(clock)) * 60000;
    guess = clock - offsetMinutes(zone, new Date(guess)) * 60000;
    return new Date(guess).toISOString();
  } catch (error) {
    return null;
  }
}

// Fields that hold a date and time, by kind of row
const dateTimeFields = { presentation: ['start'], notice: ['start', 'end'], task: ['finishedOn', 'expires'], photo: ['expires'] };
const listToKind = { presentations: 'presentation', notices: 'notice', tasks: 'task', photos: 'photo' };
// Fields that hold a plain date
const plainDateFields = { tasks: ['startDate', 'dueDate', 'completedOn'], plans: ['date'] };

function nameOf(row) {
  const text = row && (row.title || row.name || row.heading || row.text || row._id || row.id);
  return String(text || 'a row').replace(/\s+/g, ' ').slice(0, 40);
}

// result is the answer of Sanity. Gives { ok, reason, result, problems }: ok is false when the answer must not become
// content.json (reason says why), result is the answer with the repairs made, problems is a list of { source, where, what, action }.
//   previous   the content of the last good read, or null
export function checkContent(result, previous) {
  const problems = [];
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return { ok: false, reason: 'Sanity sent no content', result: result, problems: problems };
  }

  // A list the answer should have is a list. A missing one would let a panel draw its default in place of what the editors typed.
  const missing = listKeys.filter(key => key in result && !Array.isArray(result[key]) && result[key] !== null);
  if (missing.length > 0) return { ok: false, reason: 'Sanity sent ' + missing.join(', ') + ' as something other than a list', result: result, problems: problems };

  // The settings document is the one the whole screen is drawn from. An answer with none, after one that had it, is an empty answer.
  const had = previous && typeof previous === 'object' && previous.settings && typeof previous.settings === 'object';
  if (had && (!result.settings || typeof result.settings !== 'object')) {
    return { ok: false, reason: 'Sanity sent no settings document, and the last read had one', result: result, problems: problems };
  }
  // An answer that has nothing in any list, after one that had rows, is an empty answer too
  const rowsNow = listKeys.reduce((sum, key) => sum + (Array.isArray(result[key]) ? result[key].length : 0), 0);
  const rowsBefore = previous ? listKeys.reduce((sum, key) => sum + (Array.isArray(previous[key]) ? previous[key].length : 0), 0) : 0;
  if (rowsBefore >= 5 && rowsNow === 0) return { ok: false, reason: 'Sanity sent an empty answer, and the last read had ' + rowsBefore + ' rows', result: result, problems: problems };

  const zone = result.theme && typeof result.theme.timeZone === 'string' && result.theme.timeZone !== '' ? result.theme.timeZone : 'America/New_York';
  const repaired = Object.assign({}, result);

  Object.keys(listToKind).forEach(key => {
    if (!Array.isArray(result[key])) return;
    const fields = dateTimeFields[listToKind[key]];
    repaired[key] = result[key].map(row => {
      if (!row || typeof row !== 'object') return row;
      let next = row;
      fields.forEach(field => {
        const value = row[field];
        if (typeof value !== 'string' || value === '') return;
        if (withZone.test(value) || plainDate.test(value)) return;
        const fixed = isoInZone(value, zone);
        if (fixed) {
          next = Object.assign({}, next, { [field]: fixed });
          problems.push({ source: 'sanity', where: key + ': ' + nameOf(row) + ', ' + field, what: 'a date and time with no zone: "' + value + '"', action: 'repaired as ' + zone + ' time, ' + fixed });
        } else {
          problems.push({ source: 'sanity', where: key + ': ' + nameOf(row) + ', ' + field, what: 'not a date and time: "' + String(value).slice(0, 30) + '"', action: 'left as it is' });
        }
      });
      return next;
    });
  });

  Object.keys(plainDateFields).forEach(key => {
    (Array.isArray(result[key]) ? result[key] : []).forEach(row => {
      (plainDateFields[key]).forEach(field => {
        const value = row && row[field];
        if (typeof value === 'string' && value !== '' && !plainDate.test(value) && !withZone.test(value)) {
          problems.push({ source: 'sanity', where: key + ': ' + nameOf(row) + ', ' + field, what: 'not a date: "' + value.slice(0, 30) + '"', action: 'left as it is' });
        }
      });
    });
  });

  // A task of the board with a department that is not one of the nine is on no Monday panel
  (Array.isArray(result.tasks) ? result.tasks : []).forEach(task => {
    if (!task || task.source !== 'monday' || task.show === false || task.showOnBoard === false) return;
    if (!departments.includes(String(task.department || '').toLowerCase())) {
      problems.push({ source: 'monday', where: 'task: ' + nameOf(task), what: 'department "' + String(task.department || '').slice(0, 24) + '" is not one of the nine', action: 'no Monday panel shows it' });
    }
  });

  return { ok: true, reason: '', result: repaired, problems: problems };
}

// The file the control page and the status document read: the count of every source, and the first rows of each
export function problemsFile(problems, stamp) {
  const sources = {};
  problems.forEach(problem => {
    const group = sources[problem.source] || { count: 0, items: [] };
    group.count += 1;
    if (group.items.length < mostListed) group.items.push({ where: problem.where, what: problem.what, action: problem.action });
    sources[problem.source] = group;
  });
  return { generatedAt: stamp, count: problems.length, sources: sources };
}
