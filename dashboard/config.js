// Settings that rarely change and are not secret. Secret things, like the
// calendar feed addresses, never go in this file.

// Where the weather is taken from
export const location = {
  name: 'Holly Springs, NC',
  latitude: 35.6513,
  longitude: -78.8336,
};

// The content editor (Sanity). The project ID is public, since it is part of
// every address the screen asks for, so it is fine to keep it in the repository.
export const sanity = {
  projectId: 'ybfqe345',
  dataset: 'production',
  apiVersion: '2025-02-19',
};

// Which content the screen shows, sample or production, is chosen by Content
// source in Dashboard Settings (the Studio has two buttons for it). This flag
// is only the fallback: it is used when Dashboard Settings cannot be read,
// for example the very first start with no internet, and no copy of them was
// saved on this computer. true shows the sample content in data/sample, false
// shows what the editors published. If the project ID above is empty there is
// nothing to read, so the screen always shows the sample.
export const useSampleContent = false;

// Calendar files, photo lists and sample content live in one of these
// folders. The sample folder is kept in git. The live folder is filled in
// by the Mini and is never committed.
export const sampleFolder = 'data/sample/';
export const liveFolder = 'data/live/';

// The countdown looks more serious as the date gets closer
export const threat = {
  tenseDays: 30,
  criticalDays: 7,
};

// The Content source setting in Dashboard Settings
export const contentSources = ['production', 'sample'];

// The Speed setting in Dashboard Settings. Each name is how much longer
// (more than 1) or shorter (less than 1) everything takes: how long a move
// lasts, and how long a panel stays on screen.
export const speeds = { 'very-slow': 2, 'slow': 1.5, 'normal': 1, 'fast': 0.75 };

// The Frame metal setting in Dashboard Settings: the metal on the frame edges
export const metals = ['gold', 'silver'];

// The smallest and largest values the Studio accepts. A number outside them
// is brought back to the nearest end, so one slip cannot break the screen.
//
// For the seconds between plays, 0 means never. Any other number must be at
// least `shortest`, so a smaller one is brought up to it.
export const limits = {
  pageSeconds: { min: 8, max: 120 },
  nameEvery: { min: 0, shortest: 30, max: 900 },
  nameDuration: { min: 0.5, max: 10 },
  crtEvery: { min: 0, shortest: 30, max: 3600 },
  crtDuration: { min: 0.5, max: 10 },
};

// Used for anything the editors have not filled in yet
export const defaultSettings = {
  // production shows the editors' content. sample shows the content in
  // data/sample until switchBackAt, a time like 2027-01-09T12:00 (or empty).
  contentSource: 'production',
  switchBackAt: '',
  motion: 'full',
  speed: 'normal',
  frameMetal: 'gold',
  glint: true,
  // How long a large panel stays. A small panel stays max(6, round(pageSeconds
  // x 0.75)) and a ticker line max(8, round(pageSeconds x 1.5)). A row with
  // seconds of its own, or a ticker with its own, uses those instead. The
  // rows below have none, so they follow this.
  pageSeconds: 20,
  // The name effect and the screen glitch (Logo and effects in the Studio).
  // Each has a switch, the seconds between plays (0 is never) and the
  // seconds one play lasts at normal speed. nameDuration is the length of
  // the effect on HAWKTIMUS PRIME today: .8 s for a letter plus 45 ms for
  // each of the 14 letters after the first. crt is the old television
  // glitch, and 2.7 s is how long frame.js keeps it going today.
  nameTransform: true,
  nameEvery: 300,
  nameDuration: 1.43,
  countdown: {
    kickoffLabel: 'KICKOFF IN',
    kickoff: '2027-01-09T12:00',
    rolloutLabel: 'ROLLOUT IN',
    rollout: '',
  },
  alert: { on: false, headline: '', message: '', until: '' },
  rotation: {
    grid1: [
      { panel: 'tasks', show: true },
      { panel: 'events', show: true },
      { panel: 'tonight', show: true },
      { panel: 'spotlight', show: true },
      { panel: 'sponsor-feature', show: true },
      { panel: 'photo', show: true },
      { panel: 'leadership', show: true },
      { panel: 'team-leads', show: true },
      { panel: 'custom', show: true },
    ],
    grid2: [
      { panel: 'task-counts', show: true },
      { panel: 'next-event', show: true },
      { panel: 'forecast', show: true },
      { panel: 'safety-days', show: true },
      { panel: 'sponsor-logo', show: true },
    ],
  },
  doneDays: 7,
  safetyDaysSince: '',
  crt: { on: true, everySeconds: 240, durationSeconds: 2.7 },
  announcements: [
    {
      show: true,
      time: '14:30',
      title: 'WHAT TIME IS IT?',
      followUp: 'PRIMETIME',
      titleSeconds: 12,
      followUpSeconds: 10,
      days: [0, 1, 2, 3, 4, 5, 6],
    },
    {
      show: true,
      time: '17:00',
      title: 'WHAT TIME IS IT?',
      followUp: 'PRIMETIME',
      titleSeconds: 12,
      followUpSeconds: 10,
      days: [0, 1, 2, 3, 4, 5, 6],
    },
  ],
  calendars: [{ id: 'team', name: 'Team calendar', show: true }],
};

// Used for anything missing from the Theme document in the Studio. The
// Studio starts at the same values, and check-schemas.mjs fails if they differ.
//   defaultTheme  the id of a theme in themes/registry.js
//   useNow        a theme and an overlay to show now, whatever the schedule says. Each is empty
//                 (follow the schedule), an id, or for the overlay 'none'. until is a time, or empty.
//   schedule      rules: { name, kind: 'theme' | 'overlay', theme or overlay, startDate, endDate, repeatsEveryYear }
//   timeZone      the time zone the dates in the schedule are read in. Extra events (core/events.js)
//                 use it too, for their times and for when they are over
export const defaultThemeSettings = {
  defaultTheme: 'hawktimus',
  useNow: { theme: '', overlay: '', until: '' },
  schedule: [],
  timeZone: 'America/New_York',
};

// Used for a person whose "Show photo on screen" switch is missing from the
// saved content, such as a person added before the switch existed. The
// Studio field starts at the same value.
export const defaultPerson = {
  showPhoto: true,
};

export const defaultTeam = {
  name: 'HAWKTIMUS PRIME',
  number: '3229',
  school: 'HOLLY SPRINGS HIGH SCHOOL',
};
