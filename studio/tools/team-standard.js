// The standard values of the two starting teams. A Team document in Sanity keeps its own colors, so
// a change to the seed file or to the built-in team on the screen never reaches a document that is
// already stored. The action "Use the standard colors for this team" (team-actions.js) writes these
// values into the draft of the open Team document.
//
// This is the one table. tests/team-standard.test.mjs checks it against primeTeam in
// dashboard/config.js and against docs/seed/teams.ndjson, so the three cannot drift apart.
// The name, number, logo, order and the Active and Mirror switches of a team are not touched.

export const standardTeams = {
  prime: {
    colors: {
      primary: '#6C18B6',
      plate: '#3B2A7A',
      accent: '#FACA2A',
      neon: '#FACA2A',
      pink: '#B23CFF',
      background: '#0B0714',
      text: '#FFFFFF',
      body: '#1A0F2E',
      label: '#FACA2A',
      headerInk: '#FFFFFF',
      dark: '#29054A',
      retro: '#FACA2A',
    },
    metal: 'gold',
    palette: 'standard',
    glow: false,
    bolts: 'hex',
    cornerCut: 'tl-br',
    headerNotch: 'step',
    grid: 'lines',
    outlinedName: false,
    tickerLabel: 'plate',
    countAccent: 'red',
  },
  nova: {
    colors: {
      primary: '#D4A017',
      plate: '#6B4C08',
      accent: '#C86BFF',
      neon: '#8C44DC',
      pink: '#D4A017',
      background: '#17110A',
      text: '#FFFFFF',
      body: '#241A04',
      label: '#D9A6FF',
      headerInk: '#1A1200',
      dark: '#3D2A05',
      retro: '#E0A400',
    },
    metal: 'purple',
    palette: 'inverted',
    glow: true,
    bolts: 'round',
    cornerCut: 'tr-bl',
    headerNotch: 'slant',
    grid: 'dots',
    outlinedName: false,
    tickerLabel: 'bar',
    countAccent: 'neon',
  },
};

// Plain names for the lines of the list that the action shows
const labels = {
  primary: 'Main color', plate: 'Plate color', accent: 'Accent color', neon: 'Neon color',
  pink: 'Second bright color', background: 'Background color', text: 'Text color', body: 'Body color',
  label: 'Label color', headerInk: 'Header text color', dark: 'Dark color', retro: 'Retro color',
  metal: 'Metal', palette: 'Palette', glow: 'Glow', bolts: 'Bolts', cornerCut: 'Cut corners',
  headerNotch: 'Header end', grid: 'Page grid', outlinedName: 'Outlined name', tickerLabel: 'Ticker label',
  countAccent: 'Countdown color',
};

function same(a, b) {
  return String(a === undefined ? '' : a).toUpperCase() === String(b === undefined ? '' : b).toUpperCase();
}

// The standard values for a team code, or null for a team that has none (a team typed in by hand)
export function standardFor(code) {
  return standardTeams[code] || null;
}

// The fields to set on the draft, and the lines to show: [{ label, from, to }] for every value
// that differs. A document with a missing value counts as different.
export function standardChanges(team, code) {
  const standard = standardFor(code);
  if (!standard) return { set: {}, lines: [] };

  const set = {};
  const lines = [];
  const current = team || {};
  const colors = current.colors || {};

  Object.keys(standard.colors).forEach(name => {
    if (same(colors[name], standard.colors[name])) return;
    set.colors = Object.assign({}, colors, set.colors, { [name]: standard.colors[name] });
    lines.push({ label: labels[name], from: colors[name] || 'empty', to: standard.colors[name] });
  });
  Object.keys(standard).forEach(name => {
    if (name === 'colors') return;
    if (current[name] === standard[name]) return;
    set[name] = standard[name];
    lines.push({ label: labels[name], from: current[name] === undefined ? 'empty' : String(current[name]), to: String(standard[name]) });
  });
  return { set: set, lines: lines };
}
