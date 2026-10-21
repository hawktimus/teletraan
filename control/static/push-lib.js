// The plain functions behind the pushes of the Display tab: the words for what is pushed, the countdown, the strip of the
// week, and the row the large picture draws for a push that has not been sent. No page is touched here, so
// tests/control-push.test.mjs can read it with node. The page code is tabs/push.js and the pieces of markup are tabs/push-parts.js.

export const holdChoices = [1, 5, 15, 30, 60];
export const usualHold = 15;

export const dayWords = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday' };
export const dayShort = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
// The view keys the wall uses, and the words a rotation row uses for the same view
export const rowViewOf = { general: 'robotics', prime: 'prime', nova: 'nova', family: 'family' };

export function holdWords(minutes) {
  return minutes + (minutes === 1 ? ' minute' : ' minutes');
}

// How far the clock of the Teletraan computer is from this one, so the countdown follows the computer and not the phone
export function clockOffset(serverTime, localMilliseconds) {
  const server = Date.parse(serverTime);
  return isNaN(server) ? 0 : server - localMilliseconds;
}

// Whole seconds left until a time, or 0 when it has passed or is not a time
export function secondsLeft(until, nowMilliseconds) {
  const end = Date.parse(until);
  if (isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - nowMilliseconds) / 1000));
}

// 12 minutes 5 seconds left, 45 seconds left, ending now
export function leftWords(until, nowMilliseconds) {
  const total = secondsLeft(until, nowMilliseconds);
  if (total <= 0) return 'ending now';
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return seconds + (seconds === 1 ? ' second left' : ' seconds left');
  return minutes + (minutes === 1 ? ' minute ' : ' minutes ') + seconds + (seconds === 1 ? ' second left' : ' seconds left');
}

// names: { themes: {id: title}, views: {key: name}, panels: {id: title}, hidden: {id: title} }
export function pushWords(push, names) {
  const pick = (table, id) => (table && table[id]) || id;
  switch (push.kind) {
    case 'theme': return { title: 'Theme', detail: pick(names.themes, push.id) };
    case 'view': return { title: 'View', detail: pick(names.views, push.id) };
    case 'panel': return { title: 'Panel', detail: pick(names.panels, push.id) };
    case 'pause': return { title: 'Rotation paused', detail: 'The panel on the wall stays where it is.' };
    case 'announcement': return { title: 'Announcement', detail: push.id };
    case 'hidden': return { title: 'Hidden transition', detail: pick(names.hidden, push.id) + ' was sent to the wall.' };
    default: return { title: push.kind, detail: '' };
  }
}

const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayOrder = Object.keys(dayWords);

// The calendar date it is in a time zone, as { year, month (0 to 11), day, weekday (a key of dayWords) }. A zone the browser does
// not know falls back to the clock of this device.
function dateIn(milliseconds, timeZone) {
  const at = new Date(milliseconds);
  const parts = {};
  let format = null;
  try {
    format = new Intl.DateTimeFormat('en-US', { timeZone: timeZone || undefined, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'long' });
  } catch (error) {
    format = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'long' });
  }
  format.formatToParts(at).forEach(part => { parts[part.type] = part.value; });
  return { year: Number(parts.year), month: Number(parts.month) - 1, day: Number(parts.day), weekday: String(parts.weekday).toLowerCase() };
}

// The next date of each weekday, today counting as today: { monday: { date: 'Mon Oct 26', today: false }, ... }. The dates are
// counted in the time zone of the wall, from the clock of the Teletraan computer (serverTime). Without a time, every date is empty.
export function weekDates(serverTime, timeZone) {
  const start = Date.parse(serverTime);
  const result = {};
  if (isNaN(start)) {
    dayOrder.forEach(day => { result[day] = { date: '', today: false }; });
    return result;
  }
  const today = dateIn(start, timeZone);
  const base = Date.UTC(today.year, today.month, today.day);
  const todayAt = Math.max(0, dayOrder.indexOf(today.weekday));
  dayOrder.forEach((day, at) => {
    const ahead = (at - todayAt + 7) % 7;
    const date = new Date(base + ahead * 86400000);
    result[day] = { date: dayShort[day] + ' ' + monthShort[date.getUTCMonth()] + ' ' + date.getUTCDate(), today: ahead === 0 };
  });
  return result;
}

// What plays now: the theme that is pushed, else the theme of today's weekday
export function nowTheme(pushes, week, today) {
  const pushed = pushes.find(push => push.kind === 'theme');
  if (pushed) return { id: pushed.id, pushed: true, until: pushed.until };
  return { id: (week && week[today]) || '', pushed: false, until: '' };
}

// The row and the theme the large picture draws for a push that was chosen but not sent. draft is { theme, view, panel }; an
// empty one gives null, and the picture goes back to the selected row of the rotation. rows is the rotation list.
// A panel takes the settings of its first row in the rotation (department, list, chart, team), as the wall shows it.
export function previewTarget(draft, rows, selectedRow, titles, names) {
  if (!draft || (!draft.theme && !draft.view && !draft.panel)) return null;
  const list = Array.isArray(rows) ? rows : [];
  const keep = ['panel', 'view', 'side', 'department', 'list', 'chart', 'team', 'part', 'photoCount', 'secondsPerPhoto'];
  const copy = row => {
    const picked = {};
    keep.forEach(name => { if (row && row[name] !== undefined && row[name] !== '') picked[name] = row[name]; });
    return picked;
  };

  let row;
  if (draft.panel) row = copy(list.find(item => item.panel === draft.panel) || { panel: draft.panel });
  else row = copy(selectedRow || list.find(item => item.panel) || {});
  row.panel = draft.panel || row.panel || '';
  if (draft.view) row.view = rowViewOf[draft.view] || row.view;

  const parts = [];
  parts.push((titles && titles[row.panel]) || row.panel || 'No panel');
  if (draft.view) parts.push((names && names.views && names.views[draft.view]) || draft.view);
  if (draft.theme) parts.push((names && names.themes && names.themes[draft.theme]) || draft.theme);
  return { row: row, theme: draft.theme || '', words: 'Previewing ' + parts.join(', ') + '. This is not on the wall until you press Push.' };
}
