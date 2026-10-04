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

// While this is true the screen shows the sample content in data/sample
// instead of asking Sanity. Set it to false once the Studio has content and
// the CORS origin is added, as the studio README describes. Until then Sanity
// would refuse the screen's requests and there would be nothing to show.
export const useSampleContent = true;

export const sampleMode = sanity.projectId === '' || useSampleContent;

// Calendar files, photo lists and sample content live in one of these
// folders. The sample folder is kept in git. The live folder is filled in
// by the Mini and is never committed.
export const sampleFolder = 'data/sample/';
export const liveFolder = 'data/live/';

// where the editors' content comes from
export const dataFolder = sampleMode ? sampleFolder : liveFolder;

// The countdown looks more serious as the date gets closer
export const threat = {
  tenseDays: 30,
  criticalDays: 7,
};

// The Speed setting in Dashboard Settings. Each name is how much longer
// (more than 1) or shorter (less than 1) everything takes: how long a move
// lasts, and how long a panel stays on screen.
export const speeds = { 'very-slow': 2, 'slow': 1.5, 'normal': 1, 'fast': 0.75 };

// Used for anything the editors have not filled in yet
export const defaultSettings = {
  motion: 'full',
  speed: 'normal',
  countdown: {
    kickoffLabel: 'KICKOFF IN',
    kickoff: '2027-01-09T12:00',
    rolloutLabel: 'ROLLOUT IN',
    rollout: '',
  },
  alert: { on: false, headline: '', message: '', until: '' },
  rotation: {
    grid1: [
      { panel: 'tasks', show: true, seconds: 16 },
      { panel: 'events', show: true, seconds: 16 },
      { panel: 'tonight', show: true, seconds: 16 },
      { panel: 'spotlight', show: true, seconds: 16 },
      { panel: 'sponsor-feature', show: true, seconds: 16 },
      { panel: 'photo', show: true, seconds: 16 },
      { panel: 'leadership', show: true, seconds: 16 },
      { panel: 'team-leads', show: true, seconds: 16 },
      { panel: 'custom', show: true, seconds: 16 },
    ],
    grid2: [
      { panel: 'task-counts', show: true, seconds: 12 },
      { panel: 'next-event', show: true, seconds: 12 },
      { panel: 'forecast', show: true, seconds: 12 },
      { panel: 'safety-days', show: true, seconds: 12 },
      { panel: 'sponsor-logo', show: true, seconds: 12 },
    ],
    tickerSeconds: 24,
  },
  doneDays: 7,
  safetyDaysSince: '',
  crt: { on: true, everyMinutes: 4 },
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

export const defaultTeam = {
  name: 'HAWKTIMUS PRIME',
  number: '3229',
  school: 'HOLLY SPRINGS HIGH SCHOOL',
};
