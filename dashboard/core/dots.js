// The four dots at the foot of the screen, left of the ticker: Monday, Band (the calendars),
// Sanity (the content) and the network. Each says only how fresh its last read is, so a person across the room can
// tell that something has stopped. The control page shows the same states with their reasons
// (control/routes/status.js), so the rules are here once.
//
//   green  the last read is inside twice its interval
//   amber  it is older than that, or there has been no read yet for longer than the start-up wait
//   red    the last read ended in an error
//   grey   not known yet: nothing has been read since the service started, and it started less than five minutes ago.
//          A computer that has just come back up reads Monday and the calendars at once, and until they land a stamp
//          from before the restart would be a lie, so the dot says it does not know.
//
// The network dot is the sync service's own word (sync-status.json, network): green when it is ok, red when it is
// not. It has no amber of its own: a short break is below the service's two minute window, and the Sanity dot goes
// amber first. It is left out when the file has no network member (an older file, a laptop).
//
// Sanity is the exception: it is read when something changes and at least every 5 minutes, so
// green means a good read inside 5 minutes (plus a short slack, because a read that is due
// lands a moment after the 5 minutes are up).

import { isRecord } from './text.js';

export const dotNames = ['monday', 'band', 'sanity', 'network'];

// Between 11 pm and 6 am Monday is read every 30 minutes whatever the setting (computer/scripts/monday-contract.sh), so a dot
// or the pill counts it late only after twice that.
export const mondayQuietMinutes = 30;
const bandMinutes = 15;
const sanityMinutes = 5;
const sanitySlackSeconds = 30;
// How long after the service started a source with no read yet counts as not known, and not as late
export const unknownGraceMinutes = 5;

function minutesBetween(then, now) {
  return Math.floor((now.getTime() - then) / 60000);
}

// One dot. input is
//   at          the time of the last read, a string or a Date, or empty when there has been none
//   error       text when the last read ended in an error, else empty
//   limit       how old the last read may be to stay green, in minutes
//   slack       seconds added to the limit, 0 when not given
//   startedAt   when the reading service started, in milliseconds; with it, no read yet is grey for the first minutes
// Gives { color, reason }
export function dotState(input, now = new Date()) {
  const source = isRecord(input) ? input : {};
  const error = typeof source.error === 'string' ? source.error.trim() : '';
  const time = source.at instanceof Date ? source.at.getTime() : Date.parse(source.at);
  const limit = typeof source.limit === 'number' && source.limit > 0 ? source.limit : 1;
  const slack = typeof source.slack === 'number' && source.slack > 0 ? source.slack : 0;

  if (error !== '') return { color: 'red', reason: 'The last read failed: ' + error };
  if (isNaN(time)) {
    const started = typeof source.startedAt === 'number' && isFinite(source.startedAt) ? source.startedAt : null;
    if (started !== null && (now.getTime() - started) / 60000 < unknownGraceMinutes) return { color: 'grey', reason: 'Not known yet: nothing has been read since the service started.' };
    return { color: 'amber', reason: 'There has been no read yet.' };
  }

  const late = (now.getTime() - time) / 1000 > limit * 60 + slack;
  const age = minutesBetween(time, now);
  if (late) return { color: 'amber', reason: 'The last read was ' + age + ' minutes ago. It should be inside ' + limit + '.' };
  return { color: 'green', reason: 'The last read was ' + Math.max(0, age) + ' minutes ago.' };
}

// The time the Monday reads are apart, from Dashboard Settings (5 to 120, 5 when not set)
export function mondayEvery(settings) {
  const value = isRecord(settings) ? settings.mondayEveryMinutes : undefined;
  return typeof value === 'number' && isFinite(value) ? Math.min(120, Math.max(5, Math.round(value))) : 5;
}

// The dots from what the Teletraan computer and Sanity say. Each field of facts is optional.
//   monday         { lastSyncAt, lastError } the monday-status document
//   everyMinutes   mondayEveryMinutes
//   calendarAt     when the calendars were last downloaded (status-mini lastCalendarSyncAt)
//   calendarErrors how many calendars ended their last download in an error
//   sanityAt       when the content was last read well (a Date or a string)
//   sanityFailed   true when the latest content read threw
//   network        { ok, since } from the sync service, or nothing: then the result has no network dot
//                  (since is a time in milliseconds or null)
//   startedAt      when the sync service started, in milliseconds, so that a read that has not happened yet is grey
export function dotStates(facts, now = new Date()) {
  const f = isRecord(facts) ? facts : {};
  const monday = isRecord(f.monday) ? f.monday : {};
  const every = mondayEvery({ mondayEveryMinutes: f.everyMinutes });
  const calendarErrors = typeof f.calendarErrors === 'number' ? f.calendarErrors : 0;

  return {
    monday: dotState({ at: monday.lastSyncAt, error: monday.lastError, limit: Math.max(every, mondayQuietMinutes) * 2, startedAt: f.startedAt }, now),
    band: dotState({ at: f.calendarAt, error: calendarErrors > 0 ? calendarErrors + ' calendar(s) could not be downloaded' : '', limit: bandMinutes * 2, startedAt: f.startedAt }, now),
    sanity: dotState({ at: f.sanityAt, error: f.sanityFailed === true ? 'the content could not be read' : '', limit: sanityMinutes, slack: sanitySlackSeconds, startedAt: f.startedAt }, now),
    ...networkDot(f.network, now),
  };
}

// { network: { color, reason } }, or nothing when the sync service did not say
function networkDot(network, now) {
  if (!isRecord(network) || typeof network.ok !== 'boolean') return {};
  if (network.ok) return { network: { color: 'green', reason: 'The network works.' } };

  const since = typeof network.since === 'number' ? minutesBetween(network.since, now) : null;
  return { network: { color: 'red', reason: since === null ? 'The network is down.' : 'The network has been down for ' + Math.max(0, since) + ' minutes.' } };
}

// The facts of dotStates from the sync service's own file (sync-status.json, as parseSyncStatus cleans it): when each
// source was last read well and when it last failed. The TV and the control page both start from this, so the same file
// gives the same four colours on both. A failure counts only when it came after the last good read: an old failure
// that a later read has cured is not a red dot. Returns null when there is no status to start from, and the caller
// falls back to what the Sanity documents say.
export function factsFromSyncStatus(status) {
  if (!isRecord(status) || !isRecord(status.sources)) return null;

  const iso = ms => (typeof ms === 'number' && isFinite(ms) ? new Date(ms).toISOString() : '');
  const failedSince = source => (isRecord(source) && typeof source.failure === 'number' && (typeof source.success !== 'number' || source.failure > source.success));
  const reasonOf = source => (isRecord(source) && typeof source.reason === 'string' && source.reason.trim() !== '' ? source.reason.trim() : 'the last read failed');
  const monday = status.sources.monday || {};
  const calendars = status.sources.calendars || {};
  const sanity = status.sources.sanity || {};

  return {
    monday: { lastSyncAt: iso(monday.success), lastError: failedSince(monday) ? reasonOf(monday) : '' },
    calendarAt: iso(calendars.success),
    calendarErrors: failedSince(calendars) ? 1 : 0,
    sanityAt: iso(sanity.success),
    sanityFailed: failedSince(sanity),
    network: status.network || undefined,
    startedAt: typeof status.startedAt === 'number' ? status.startedAt : undefined,
  };
}

// The part of status-mini and the calendar status document that the screen asks for (core/sanity.js). Empty when there is none.
export function tidyMini(raw) {
  const source = isRecord(raw) ? raw : {};

  return {
    lastCalendarSyncAt: typeof source.lastCalendarSyncAt === 'string' && !isNaN(Date.parse(source.lastCalendarSyncAt)) ? source.lastCalendarSyncAt : '',
    calendarErrors: typeof source.calendarErrors === 'number' && source.calendarErrors > 0 ? Math.floor(source.calendarErrors) : 0,
  };
}
