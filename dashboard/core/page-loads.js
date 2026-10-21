// Writes down every time the page loads, and why, so that a flash on the TV can be told apart from a reload:
// if the count here did not change when the screen flashed, the page did not reload.
//
// The list is kept in localStorage (the last 100 loads, 24 hours of them are counted) and the control page reads the
// count and the last reason from the report of core/now-report.js. A code path that reloads the page calls
// noteReload(reason) first, which leaves the reason in sessionStorage for the next load to find. A load with no reason
// left is a browser start, or a reload that came from outside the page.

export const loadsKey = 'teletraan-page-loads';
export const reasonKey = 'teletraan-reload-reason';
const sessionKey = 'teletraan-session';
export const countedHours = 24;
export const keptMost = 100;

function storageOf(kind) {
  try {
    return window[kind];
  } catch (error) {
    return null;
  }
}

// To call just before the page is reloaded. The words say why, for example "a new version was installed".
export function noteReload(reason) {
  const storage = storageOf('sessionStorage');
  if (!storage) return;

  try {
    storage.setItem(reasonKey, String(reason).slice(0, 80));
  } catch (error) {
    // storage may be blocked or full, and the load is then written down without a reason
  }
}

// The words for a load. saved is the reason noteReload left, seen is true when this browser session loaded the page
// before, and type is the navigation type of the browser: navigate, reload or back_forward.
export function reasonFor(saved, seen, type) {
  if (saved) return saved;
  if (!seen) return 'the browser started or opened the page';
  if (type === 'reload') return 'reloaded from outside the page (no reason was written down)';
  return 'the page was opened again (' + (type || 'unknown') + ')';
}

// The loads of the last countedHours hours, newest last, as { at, reason } with at in ISO form
export function recentLoads(loads, now = new Date()) {
  const since = now.getTime() - countedHours * 3600 * 1000;
  return (Array.isArray(loads) ? loads : []).filter(load => load && typeof load.at === 'string' && Date.parse(load.at) >= since);
}

// { count, reason, at } for the report: the loads of the last 24 hours and the newest one
export function summarize(loads, now = new Date()) {
  const recent = recentLoads(loads, now);
  const last = recent[recent.length - 1];
  return { count: recent.length, reason: last ? last.reason : '', at: last ? last.at : '' };
}

function readLoads(storage) {
  try {
    const loads = JSON.parse(storage.getItem(loadsKey) || '[]');
    return Array.isArray(loads) ? loads : [];
  } catch (error) {
    return [];
  }
}

// What this load added up to, for when localStorage cannot be read again
let summary = { count: 0, reason: '', at: '' };

// Called once when the page starts
export function recordPageLoad(now = new Date()) {
  const local = storageOf('localStorage');
  const session = storageOf('sessionStorage');
  let saved = '';
  let seen = false;
  try {
    if (session) {
      saved = session.getItem(reasonKey) || '';
      session.removeItem(reasonKey);
      seen = session.getItem(sessionKey) === '1';
      session.setItem(sessionKey, '1');
    }
  } catch (error) {
    // read as no reason and a new browser
  }

  const entries = performance.getEntriesByType ? performance.getEntriesByType('navigation') : [];
  const type = entries && entries[0] ? entries[0].type : '';
  const loads = recentLoads(local ? readLoads(local) : [], now).slice(-(keptMost - 1));
  loads.push({ at: now.toISOString(), reason: reasonFor(saved, seen, type) });
  try {
    if (local) local.setItem(loadsKey, JSON.stringify(loads));
  } catch (error) {
    // the count then only covers this load
  }
  summary = summarize(loads, now);
  return summary;
}

// Sent with every report
export function pageLoadSummary(now = new Date()) {
  const local = storageOf('localStorage');
  return local ? summarize(readLoads(local), now) : summary;
}
