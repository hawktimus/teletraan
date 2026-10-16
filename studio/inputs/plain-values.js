// Two checks the status pages of the Studio share. Plain functions only, so node can run them.

export function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// The words of a reason as a sentence: a capital letter first and a full stop last
export function sentence(text) {
  const trimmed = String(text).trim();
  const capital = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.?]$/.test(capital) ? capital : capital + '.';
}
