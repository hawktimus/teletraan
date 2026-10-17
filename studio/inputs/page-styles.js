// The plain styles that the pages of the Studio share (Today, Look, Competition, Kept data). The colors are the
// Studio's own variables, so a page follows the Studio's light and dark themes, and each has a fallback.
// A page has a 16 pixel gutter, text that wraps, and buttons and pickers at least 44 pixels high, so it works on a phone.

const border = '1px solid var(--card-border-color, rgba(128, 128, 128, 0.4))';
const muted = 'var(--card-muted-fg-color, inherit)';
const primaryBackground = 'var(--card-badge-primary-bg-color, #dbeafe)';
const primaryText = 'var(--card-badge-primary-fg-color, #1e40af)';

export const styles = {
  page: { boxSizing: 'border-box', height: '100%', overflowY: 'auto', padding: '24px 16px' },
  column: { maxWidth: 760, margin: '0 auto' },
  heading: { fontSize: 24, fontWeight: 600, margin: '0 0 8px' },
  subheading: { fontSize: 18, fontWeight: 600, margin: '32px 0 8px' },
  text: { lineHeight: 1.5, margin: '0 0 16px', overflowWrap: 'anywhere' },
  muted: { color: muted, lineHeight: 1.5, margin: '0 0 16px', overflowWrap: 'anywhere' },
  help: { display: 'block', color: muted, fontSize: 14, lineHeight: 1.4, overflowWrap: 'anywhere' },
  failed: { color: 'var(--card-badge-critical-fg-color, #b91c1c)', lineHeight: 1.5, margin: '0 0 16px', overflowWrap: 'anywhere' },
  list: { margin: '0 0 16px', paddingLeft: 24, lineHeight: 1.5 },
  card: { boxSizing: 'border-box', border: border, borderRadius: 4, padding: 16, margin: '0 0 16px' },
  field: { margin: '0 0 16px', minWidth: 0 },
  fieldset: { border: 'none', padding: 0, margin: '0 0 16px', minWidth: 0 },
  label: { display: 'block', fontWeight: 600, margin: '0 0 4px' },
  choice: { display: 'flex', alignItems: 'flex-start', gap: 12, minHeight: 44, margin: '0 0 8px', cursor: 'pointer' },
  box: { width: 24, height: 24, flex: '0 0 24px', margin: '10px 0 0' },
  input: { boxSizing: 'border-box', width: '100%', maxWidth: '100%', minHeight: 44, padding: '4px 12px', fontFamily: 'inherit', fontSize: 16, border: border, borderRadius: 4 },
  area: { boxSizing: 'border-box', width: '100%', maxWidth: '100%', minHeight: 88, padding: '8px 12px', fontFamily: 'inherit', fontSize: 16, border: border, borderRadius: 4 },
  select: { boxSizing: 'border-box', minHeight: 44, maxWidth: '100%', padding: '4px 12px', fontFamily: 'inherit', fontSize: 16, border: border, borderRadius: 4 },
  button: { boxSizing: 'border-box', minHeight: 44, padding: '8px 16px', fontFamily: 'inherit', fontSize: 16, fontWeight: 600, border: border, borderRadius: 4, background: primaryBackground, color: primaryText, cursor: 'pointer' },
  link: { display: 'inline-flex', alignItems: 'center', minHeight: 44, textDecoration: 'underline', color: primaryText },
  row: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 16px', margin: '0 0 8px' },
  details: { margin: '32px 0 8px' },
  summary: { fontSize: 18, fontWeight: 600, minHeight: 44, cursor: 'pointer' },
};
