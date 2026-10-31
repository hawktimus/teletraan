// Small helpers for building the page: an element with a class and text, a stored value that never throws, and the
// text of a value made safe for markup. Plain functions, no framework.

export function el(tag, className, text) {
  const made = document.createElement(tag);
  if (className) made.className = className;
  if (text !== undefined && text !== null) made.textContent = text;
  return made;
}

export function esc(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const prefix = 'teletraan.control.';

// A browser that will not keep anything (a private window) just forgets: nothing here may stop the page
export function remember(name, value) {
  try {
    if (value === null || value === undefined) window.localStorage.removeItem(prefix + name);
    else window.localStorage.setItem(prefix + name, typeof value === 'string' ? value : JSON.stringify(value));
  } catch (error) { /* forgotten, which is harmless */ }
}

export function recall(name, fallback = null) {
  try {
    const found = window.localStorage.getItem(prefix + name);
    return found === null ? fallback : found;
  } catch (error) {
    return fallback;
  }
}

export function recallJson(name, fallback = null) {
  try {
    return JSON.parse(recall(name, 'null')) ?? fallback;
  } catch (error) {
    return fallback;
  }
}
