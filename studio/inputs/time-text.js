// Times in words, for the Studio pages that show what the Mini did: the status block
// (status-input.js) and the Calendars page (calendars-view-parts.js). Plain functions
// only, so check-schemas.mjs can run them with node.

// How long ago a time was, in words. A time that cannot be read gives nothing.
export function ageText(isoText, now) {
  const then = typeof isoText === 'string' ? Date.parse(isoText) : NaN;
  if (isNaN(then)) return '';

  const minutes = Math.round((now.getTime() - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes + (minutes === 1 ? ' minute ago' : ' minutes ago');

  const hours = Math.round(minutes / 60);
  if (hours < 48) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
  return Math.round(hours / 24) + ' days ago';
}

// The time as the editor's own computer shows it, such as Oct 9, 2026, 2:14 PM
export function clockText(isoText) {
  const date = new Date(isoText);
  if (typeof isoText !== 'string' || isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}
