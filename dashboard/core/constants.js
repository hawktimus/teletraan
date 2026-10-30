// Values that have one right answer. Dashboard Settings still keeps a field for
// each of them, hidden, so a page saved earlier opens and publishes as before,
// but the screen never reads what is stored there. To change one, change it
// here and in the doc that names it.

// Night mode (docs/night-mode.md): black from 11:30 pm to 11:30 am, in the time
// zone of the Look page. The screen is left on all night, so it needs a fixed
// quiet time that nobody has to set.
export const nightStart = '23:30';
export const nightEnd = '11:30';

// Presentations (docs/presentations.md): how long the title card waits for the
// first press of the clicker, and how long a talk may run past its slot. The
// same five minutes for every talk, so one talk cannot hold up the next.
export const noShowMinutes = 5;
export const graceMinutes = 5;

// The status pill at the foot of the screen (core/sync-pill.js, docs/OPERATIONS.md). The sync service writes
// data/live/sync-status.json every 10 seconds. The pill is amber, with the word Offline and the time of the last good read,
// when a source has gone more than syncStaleMinutes without one (a slow source gets twice its own gap if that is longer, see
// syncSourceMinutes), or when the status file itself is older than that. It is red when every source in use has gone more
// than syncDownMinutes (three times the gap of a slow source, if longer). With everything fresh it is not drawn.
export const syncCheckSeconds = 10;
export const syncStaleMinutes = 10;
export const syncDownMinutes = 30;
// How often each source is read, in minutes. Monday is read by its own setting (Dashboard Settings, Monday tab).
export const syncSourceMinutes = { sanity: 5, weather: 15, images: 5, monday: 30, competition: 10, calendars: 15 };
