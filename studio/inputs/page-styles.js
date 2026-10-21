// The plain styles that the pages of the Studio share (Today, Look, Competition, Kept data). The colors are the
// Studio's own variables, so a page follows the Studio's light and dark themes, and each has a fallback.
// A page has a 16 pixel gutter, text that wraps, and buttons and pickers at least 44 pixels high, so it works on a phone.

const border = '1px solid var(--card-border-color, rgba(128, 128, 128, 0.4))';
const boxBorder = '2px solid #7d828b';
const muted = 'var(--card-muted-fg-color, inherit)';
const primaryBackground = 'var(--card-badge-primary-bg-color, #dbeafe)';
const primaryText = 'var(--card-badge-primary-fg-color, #1e40af)';

// The choices and switches use fixed colors, not the Studio's, because the Studio's own radio and checkbox marks
// vanish on its dark theme. A mid blue with white text, and a mid grey outline, keep 3:1 or more against both
// #101112 and white (the blue is 3.7:1 and 5.2:1, the grey 4.9:1 and 3.9:1, white on the blue 5.2:1).
export const accent = '#2563eb';
export const outline = '#7d828b';

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
  // colorScheme light makes the browser draw a white box with a dark mark, which shows on the dark Studio and on the light one
  box: { width: 24, height: 24, flex: '0 0 24px', margin: '10px 0 0', colorScheme: 'light', accentColor: '#2276fc' },
  state: { marginLeft: 8, fontWeight: 600 },
  // A group of buttons: wraps on a phone. The real radio or checkbox lies over the button, invisible, so a tap,
  // the keyboard and a screen reader all reach it.
  buttons: { display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0 0', minWidth: 0 },
  button1: { position: 'relative', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, minWidth: 44, maxWidth: '100%', padding: '8px 16px', borderRadius: 6, fontSize: 16, lineHeight: 1.3, fontWeight: 600, textAlign: 'center', overflowWrap: 'anywhere', cursor: 'pointer', userSelect: 'none' },
  mark: { flex: '0 0 auto', width: 16, textAlign: 'center' },
  overlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', margin: 0, opacity: 0, cursor: 'pointer' },
  toggle: { position: 'relative', display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, margin: '0 0 8px', cursor: 'pointer' },
  track: { position: 'relative', boxSizing: 'border-box', flex: '0 0 52px', width: 52, height: 30, borderRadius: 15 },
  knob: { position: 'absolute', top: 3, left: 3, width: 20, height: 20, borderRadius: 10, background: '#ffffff' },
  word: { flex: '0 0 auto', minWidth: 28, fontWeight: 700 },
  input: { boxSizing: 'border-box', width: '100%', maxWidth: '100%', minHeight: 44, padding: '4px 12px', fontFamily: 'inherit', fontSize: 16, border: boxBorder, borderRadius: 4 },
  area: { boxSizing: 'border-box', width: '100%', maxWidth: '100%', minHeight: 88, padding: '8px 12px', fontFamily: 'inherit', fontSize: 16, border: boxBorder, borderRadius: 4 },
  select: { boxSizing: 'border-box', minHeight: 44, maxWidth: '100%', padding: '4px 12px', fontFamily: 'inherit', fontSize: 16, border: boxBorder, borderRadius: 4 },
  button: { boxSizing: 'border-box', minHeight: 44, padding: '8px 16px', fontFamily: 'inherit', fontSize: 16, fontWeight: 600, border: border, borderRadius: 4, background: primaryBackground, color: primaryText, cursor: 'pointer' },
  link: { display: 'inline-flex', alignItems: 'center', minHeight: 44, textDecoration: 'underline', color: primaryText },
  row: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 16px', margin: '0 0 8px' },
  details: { margin: '32px 0 8px' },
  summary: { fontSize: 18, fontWeight: 600, minHeight: 44, cursor: 'pointer' },
};

// The rules a style attribute cannot hold: the focus ring (white inside, blue outside, so it shows on dark and
// light) and the dimmed look of a control that is busy.
export const controlCss = `
.tt-pick:focus-within, .tt-toggle:focus-within .tt-track { box-shadow: 0 0 0 2px #ffffff, 0 0 0 5px ${accent}; }
.tt-field:focus { outline: none; box-shadow: 0 0 0 2px #ffffff, 0 0 0 5px #2563eb; }
.tt-busy { opacity: 0.55; cursor: default; }
.tt-busy input { cursor: default; }
`;
