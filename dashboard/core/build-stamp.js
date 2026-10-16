// The build on the wall, in a corner, for the people who stand in front of the screen with ?debug=1. It
// is the build index.html loaded the files with (dashboard/build.js): the first seven characters of the
// hash that Start here shows as "On the wall", or the time stamp when there was no hash. It
// is 20px, the one text on the screen below the usual smallest size, and it is never drawn without
// ?debug=1.

export const stampLength = 7;

// The text of the stamp for a build, or '' when it is nothing a build could be
export function stampText(version) {
  const text = String(version === undefined || version === null ? '' : version).trim();
  if (/^v[0-9]{1,9}( · [0-9a-f]{7})?$/.test(text)) return text;
  if (/^[0-9a-f]{7,40}$/.test(text)) return text.slice(0, stampLength);
  return /^[0-9A-Za-z._-]{1,20}$/.test(text) ? text : '';
}

// Draws the stamp into the screen element, or changes the one that is there. Only with ?debug=1.
export function showStamp(version, params, screen) {
  if (!params.has('debug') || !screen) return;

  const text = stampText(version);
  let stamp = screen.querySelector('.build-stamp');
  if (text === '') {
    if (stamp) stamp.remove();
    return;
  }
  if (!stamp) {
    stamp = document.createElement('div');
    stamp.className = 'build-stamp';
    screen.appendChild(stamp);
  }
  stamp.textContent = text;
}
