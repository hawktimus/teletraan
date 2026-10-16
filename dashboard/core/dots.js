// The three dots at the foot of the screen, left of the ticker: Monday, Band (the calendars) and
// Sanity (the content). Each says only how fresh its last read is, so a person across the room can
// tell that something has stopped. The control page shows the same states with their reasons
// (control/routes/status.js), so the rules are here once.
//
//   green  the last read is inside twice its interval
//   amber  it is older than that, or there has been no read yet
//   red    the last read ended in an error
//
// Sanity is the exception: it is read when something changes and at least every 5 minutes, so
// green means a good read inside 5 minutes (plus a short slack, because a read that is due
// lands a moment after the 5 minutes are up).

export const dotNames = ['monday', 'band', 'sanity'];

export const bandMinutes = 15;
export const sanityMinutes = 5;
export const sanitySlackSeconds = 30;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function minutesBetween(then, now) {
  return Math.floor((now.getTime() - then) / 60000);
}

// One dot. input is
//   at          the time of the last read, a string or a Date, or empty when there has been none
//   error       text when the last read ended in an error, else empty
//   limit       how old the last read may be to stay green, in minutes
//   slack       seconds added to the limit, 0 when not given
// Gives { color, reason }
export function dotState(input, now = new Date()) {
  const source = isRecord(input) ? input : {};
  const error = typeof source.error === 'string' ? source.error.trim() : '';
  const time = source.at instanceof Date ? source.at.getTime() : Date.parse(source.at);
  const limit = typeof source.limit === 'number' && source.limit > 0 ? source.limit : 1;
  const slack = typeof source.slack === 'number' && source.slack > 0 ? source.slack : 0;

  if (error !== '') return { color: 'red', reason: 'The last read failed: ' + error };
  if (isNaN(time)) return { color: 'amber', reason: 'There has been no read yet.' };

  const late = (now.getTime() - time) / 1000 > limit * 60 + slack;
  const age = minutesBetween(time, now);
  if (late) return { color: 'amber', reason: 'The last read was ' + age + ' minutes ago. It should be inside ' + limit + '.' };
  return { color: 'green', reason: 'The last read was ' + Math.max(0, age) + ' minutes ago.' };
}

// The time the Monday reads are apart, from Dashboard Settings (5 to 120, 30 when not set)
export function mondayEvery(settings) {
  const value = isRecord(settings) ? settings.mondayEveryMinutes : undefined;
  return typeof value === 'number' && isFinite(value) ? Math.min(120, Math.max(5, Math.round(value))) : 30;
}

// The three dots from what the Mini and Sanity say. Each field of facts is optional.
//   monday         { lastSyncAt, lastError } the monday-status document
//   everyMinutes   mondayEveryMinutes
//   calendarAt     when the calendars were last downloaded (status-mini lastCalendarSyncAt)
//   calendarErrors how many calendars ended their last download in an error
//   sanityAt       when the content was last read well (a Date or a string)
//   sanityFailed   true when the latest content read threw
export function dotStates(facts, now = new Date()) {
  const f = isRecord(facts) ? facts : {};
  const monday = isRecord(f.monday) ? f.monday : {};
  const every = mondayEvery({ mondayEveryMinutes: f.everyMinutes });
  const calendarErrors = typeof f.calendarErrors === 'number' ? f.calendarErrors : 0;

  return {
    monday: dotState({ at: monday.lastSyncAt, error: monday.lastError, limit: every * 2 }, now),
    band: dotState({ at: f.calendarAt, error: calendarErrors > 0 ? calendarErrors + ' calendar(s) could not be downloaded' : '', limit: bandMinutes * 2 }, now),
    sanity: dotState({ at: f.sanityAt, error: f.sanityFailed === true ? 'the content could not be read' : '', limit: sanityMinutes, slack: sanitySlackSeconds }, now),
  };
}

// The part of status-mini and calendar-status that the screen asks for (core/sanity.js)
export function tidyMini(raw) {
  if (!isRecord(raw)) return null;

  return {
    lastCalendarSyncAt: typeof raw.lastCalendarSyncAt === 'string' && !isNaN(Date.parse(raw.lastCalendarSyncAt)) ? raw.lastCalendarSyncAt : '',
    calendarErrors: typeof raw.calendarErrors === 'number' && raw.calendarErrors > 0 ? Math.floor(raw.calendarErrors) : 0,
  };
}
