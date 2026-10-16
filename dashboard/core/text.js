// Text typed by editors must never be treated as page markup, so panels pass
// it through here before putting it into a template. A field the editor left
// empty arrives as undefined or null and becomes nothing.

export function escapeHtml(text) {
  if (text === undefined || text === null) return '';

  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// False for a missing field and for one that holds only spaces
export function hasText(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

// True for a plain object: not null, not a list
export function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// A string without the spaces at its ends, and '' for anything that is not a string
export function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}
