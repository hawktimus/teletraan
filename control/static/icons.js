// The one icon set of the control page, drawn inline so nothing is fetched. Each is a 24 by 24 line drawing that takes its
// color from the text around it. icon(name) gives the markup of an svg that screen readers skip: the words next to
// an icon always say the same thing, so a status is never only a shape or only a color.

const paths = {
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5"/><path d="M12 17.6v.1"/>',
  stop: '<circle cx="12" cy="12" r="9"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 015 .3c0 1.6-2.5 2-2.5 3.7"/><path d="M12 16.8v.1"/>',
  sync: '<path d="M4 12a8 8 0 0113.7-5.6L20 8.5"/><path d="M20 4v4.5h-4.5"/><path d="M20 12a8 8 0 01-13.7 5.6L4 15.5"/><path d="M4 20v-4.5h4.5"/>',
  refresh: '<path d="M20 12a8 8 0 11-2.4-5.7"/><path d="M20 4v5h-5"/>',
  power: '<path d="M12 3v8"/><path d="M6.3 6.8a8 8 0 1011.4 0"/>',
  tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
  wifi: '<path d="M3 9.5a14 14 0 0118 0"/><path d="M6 13a9.5 9.5 0 0112 0"/><path d="M9 16.4a5 5 0 016 0"/><path d="M12 19.6v.1"/>',
  chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6v.1M3.5 12v.1M3.5 18v.1"/>',
  pulse: '<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>',
  upload: '<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 20h16"/>',
  rollback: '<path d="M9 7L4 12l5 5"/><path d="M4 12h11a5 5 0 010 10h-3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 015 .3c0 1.6-2.5 2-2.5 3.7"/><path d="M12 16.8v.1"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
};

export function icon(name, size = 20) {
  return '<svg class="icon" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (paths[name] || paths.question) + '</svg>';
}

// The icon that goes with a status, so the state is a word, a shape and a color
export const stateIcons = { ok: 'check', good: 'check', warn: 'clock', late: 'clock', bad: 'stop', attention: 'alert', unknown: 'question', never: 'question', failed: 'stop', working: 'sync' };

export function stateIcon(state, size) {
  return icon(stateIcons[state] || 'question', size);
}
