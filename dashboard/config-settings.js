// The starting values of Dashboard Settings and of the Look page (part of config.js).

import { defaultSchedule, defaultThemeByWeekday, viewKeys } from './config-lists.js';

// Used for anything the editors have not filled in yet
export const defaultSettings = {
  motion: 'full',
  speed: 'normal',
  frameMetal: 'gold',
  glint: true,
  // see looks above. Flat and Plain also switch the glint off, whatever glint says
  look: 'polished',
  // see styles above
  style: 'original',
  // Puts the connection status text on the screen all the time, with the last
  // read from Sanity, how much of each kind of content there is, and when the
  // calendars were read. It comes up by itself, whatever this says, when Sanity
  // has been out of reach for over two minutes (core/connection.js).
  showConnectionStatus: false,
  // How long a large panel stays. A small panel stays max(6, round(pageSeconds
  // x 0.75)) and a ticker line max(8, round(pageSeconds x 1.5)). A row with
  // seconds of its own, or a ticker with its own, uses those instead. The
  // rows below have none, so they follow this.
  pageSeconds: 20,
  // The address the QR code of the Parts request panel opens (panels/qrParts). https only, up to 200 characters. Empty shows
  // LINK NOT SET and the rotation skips the panel.
  partsRequestUrl: '',
  // The logo settings in the Studio (Look tab). logoAnimations is the master switch: off, and
  // nothing in the logo moves (the entrance, the spin, the flying hawk and the
  // name effect), whatever the switches below say. Every animation that plays
  // now and then has a switch, the seconds between plays (0 is never) and the
  // seconds one play lasts at normal speed. The starting values are what the
  // logo did before it had settings:
  //   logoEntrance  the plates fly in once, when the screen starts. No timing.
  //   logoSpin      the flat full turn. It played every third pass of the old
  //                 24 second show, so every 72 seconds, and took 1.6 s.
  //   logoHawk      the robot pose, the change into the hawk, the flight and
  //                 the change back. It played every pass, so every 24 seconds,
  //                 and took 3 + 2 + 4 + 2 = 11 s (hawkActs in frame.js).
  //   name          the team name effect. The stored names are nameTransform,
  //                 nameEvery and nameDuration. nameDuration is the length of
  //                 the effect on HAWKTIMUS PRIME today: .8 s for a letter plus
  //                 45 ms for each of the 14 letters after the first.
  // logoHawkEvery and nameEvery are not read any more: how often the hawk and the name effect play is the
  // minutes of the Screen on the screen (defaultScreen above).
  logoAnimations: true,
  logoEntrance: true,
  logoSpin: true,
  logoSpinEvery: 72,
  logoSpinDuration: 1.6,
  logoHawk: true,
  logoHawkEvery: 24,
  logoHawkDuration: 11,
  nameTransform: true,
  nameEvery: 300,
  nameDuration: 1.43,
  // The page change settings in the Studio (Look tab): how a page change looks.
  //   pageChangeStyle  see pageChangeStyles above. The first change is the mechanical one.
  //   breakSeconds     how long the frame takes to break apart in the mechanical change, and the
  //                    same again to rebuild, at normal speed
  //   frameFinish      the metal of the page frames, see frameFinishes above. frameMetal is
  //                    the metal of everything that stays on the screen, and not this.
  //   silverChance     with mostly-gold, the percent of page changes that bring silver
  pageChangeStyle: 'alternate',
  breakSeconds: 0.6,
  frameFinish: 'mostly-gold',
  silverChance: 10,
  // The photo settings in the Studio (Screen tab). The photos themselves are Photo documents
  // (core/photos.js shows the visible ones).
  //   photoOrder    see photoOrders above
  //   photoSource   see photoSources above. upload is how the panel always got its photos.
  //   photoSeconds  how long the Photo panel stays, when its row in the Panels
  //                 list has no seconds of its own. It is used instead of pageSeconds.
  //   portraitScale the old Portrait size. It is hidden in the Studio and used only when neither of the two
  //                 sizes below has been set: then both take its value (core/content.js, portraitPercentOf)
  //   leadershipPortrait  how big the portraits of the Leadership rows are, as a percent of 120px
  //   rosterPortrait      the same for the Team leads rows and for the Roster slot. 100 is a row of
  //                 four. A bigger portrait gets a taller row, so fewer fit on a page: 3 rows up to
  //                 138, 2 up to 200 and 1 up to 220 (core/portrait.js, rowLayout). The Roster slot stays
  //                 at 100. The names and roles keep their size.
  //   portraitShape see portraitShapes above. Square is how the portraits have always been.
  //   portraitFrame see portraitFrames above. Metal is how the portraits have always been.
  //   photoScale    not used. It was how big the picture in the Photo panel is, and a photo now fills
  //                 the panel. The Studio field is hidden and keeps what was saved in it.
  //   photoFit      see photoFits above. fill is how the panel always drew a photo.
  photoOrder: 'random',
  photoSource: 'upload',
  photoSeconds: 16,
  portraitScale: 100,
  leadershipPortrait: 100,
  rosterPortrait: 100,
  portraitShape: 'square',
  portraitFrame: 'metal',
  photoScale: 100,
  photoFit: 'fill',
  // The night mode settings in the Studio (Advanced tab): the screensaver. The signal is never turned off. From
  // 23:30 to 11:30 (the fixed times in core/constants.js, in the time zone of the Look page) the screen is
  // black with the team logo and the team number under it.
  //   nightEnabled    on, because a wall display left on all night needs it
  //   nightStyle      see nightStyles above
  //   nightLogoWidth  how wide the logo is, in pixels. The number under it is a fixed size.
  //   nightSpeed      see nightSpeeds above
  //   nightPreview    shows night mode now, whatever the time and the switch above say
  nightEnabled: true,
  nightStyle: 'bounce',
  nightLogoWidth: 300,
  nightSpeed: 'normal',
  nightPreview: false,
  // The hidden transition settings in the Studio (Advanced tab): two rare transitions that replace a normal page change of the large
  // panel (core/hidden.js, core/hidden-transitions.js and core/hidden-run.js, docs/hidden-transitions.md).
  //   hiddenEnabled  the master switch. Off, neither plays, not even when it is pushed from the Studio.
  //   desktopEveryHours  about once every this many hours of screen time, the desktop reveal plays.
  //   redEyesEveryHours  the same for red eyes. The Studio starts both at 60. Here they start at 0, which means
  //                      not set: a settings page saved before the hours existed has none, and keeps rolling
  //                      by the two percents below (core/hidden.js).
  //   desktopChance  the percent of page changes that play the desktop reveal. 0 is never. The Studio hides it.
  //   redEyesChance  the percent of page changes that play red eyes. 0 is never. The Studio hides it.
  //   hiddenRequest  the last "Play desktop reveal" or "Play red eyes" pushed from the Studio:
  //                  kind is an id from the registry in core/hidden-transitions.js, and requestedAt is
  //                  the time it was pushed. Both are empty until something has been pushed. The screen
  //                  plays a request once, only while it is less than demoWindowSeconds old (see below).
  hiddenEnabled: true,
  desktopEveryHours: 0,
  redEyesEveryHours: 0,
  desktopChance: 1,
  redEyesChance: 1,
  hiddenRequest: { kind: '', requestedAt: '' },
  // The Presentations tab in the Studio: talks that the screen shows full screen from the clicker.
  //   presentationsEnabled  the switch. Off, the screen never starts a talk. How long the title card waits for the
  //                         speaker and how long a talk may run past its slot are fixed (core/constants.js).
  //   presentationTestRequest  the last click of the "Run presentation test" button (core/presentation-test.js). requestedAt
  //                            is the time it was clicked and is empty until it has been. The screen plays the sample talk
  //                            once, for a request that is less than demoWindowSeconds old and is not the one it handled before.
  presentationsEnabled: true,
  presentationTestRequest: { requestedAt: '' },
  // The team settings in the Studio (Look tab): which team the screen shows.
  //   teamMode          see teamModes above. Prime only to start with, so a screen with no team
  //                     documents looks as it always has.
  //   alternateMinutes  with alternate, how long each team stays before the screen swaps to the other
  teamMode: 'prime',
  alternateMinutes: 5,
  // The Screens (core/screens.js, docs/coaches-guide.md) replaced the look rotation. The Look tab keeps these:
  //   screenSchedule  the Screen that plays on each day of the week, one of the styles above (see defaultSchedule)
  //   mondayStyle     the style while a Monday row plays, for a Screen that has not set its own. It seeds the Screens
  screenSchedule: defaultSchedule,
  mondayStyle: 'minimal',
  // The Studio hides these, and the screen does not read them any more. The stored values stay. nameEvery and
  // logoHawkEvery, in seconds, are not read either: the name effect and the flying hawk follow the minutes of the
  // Screen that is on the screen (defaultScreen above)
  dailyStyles: ['original', 'cybertron'],
  teamOrder: ['prime', 'nova'],
  lookSwap: 'assemble',
  // The Views: the name and the title of the General view, the order the views take the screen, and the theme of
  // each weekday (the Themes page). screenSchedule above is not read any more
  generalViewName: 'General',
  generalViewTitle: 'HAWKTIMUS ROBOTICS',
  viewOrder: viewKeys,
  themeByWeekday: defaultThemeByWeekday,
  // The one ordered rotation list, rows of { view, panel, seconds, shown } (core/rotation.js). Empty plays the default rotation
  // (config-rotation.js). transitionSeconds is the length of a whole transition, 2 to 4.
  rotationRows: [],
  transitionSeconds: 3,
  // The "Play announcements" button in the Studio (core/announce.js, core/announce-run.js, docs/hidden-transitions.md).
  //   announceRequest  the last click of the button. requestedAt is the time it was clicked and is empty until
  //                    it has been. The screen plays every announcement that is switched on, once, for a request
  //                    that is less than demoWindowSeconds old and is not the one it handled before (see below).
  announceRequest: { requestedAt: '' },
  // The "Preview Prime", "Preview Nova", "Preview Cybertron", "Preview Minimal" and "Preview next pack" buttons in the
  // Studio (core/preview.js, core/preview-run.js, docs/hidden-transitions.md).
  //   previewRequest  the last click of one of them. kind is an id from previewKinds in core/preview.js and requestedAt is the
  //                   time it was clicked. Both are empty until a button has been clicked. The screen holds that look for
  //                   previewSeconds, once, for a request that is less than demoWindowSeconds old and is not the one it
  //                   handled before (see below). Nothing is written to the settings.
  previewRequest: { kind: '', requestedAt: '' },
  // The "Next look now" and "Preview competition" buttons on the Start here page in the Studio.
  //   nextLookRequest            the last click of Next look now. requestedAt is the time it was clicked and is empty until it has been.
  //   competitionPreviewRequest  the last click of Preview competition, the same shape.
  nextLookRequest: { requestedAt: '' },
  competitionPreviewRequest: { requestedAt: '' },
  // Requests from the control page (core/screen-requests.js). Each ends at its until time.
  //   holdPanel      keep one panel on the large frame
  //   showView       show one view (general, prime, nova or family)
  //   previewTheme   show one theme (original, cybertron, retro or foundry)
  //   pauseRotation  stop the rotation
  holdPanel: { panel: '', until: '' },
  showView: { key: '', until: '' },
  previewTheme: { theme: '', until: '' },
  pauseRotation: { until: '' },
  countdown: {
    kickoffLabel: 'KICKOFF IN',
    kickoff: '2027-01-09T12:00',
    rolloutLabel: 'ROLLOUT IN',
    rollout: '',
  },
  alert: { on: false, headline: '', message: '', until: '' },
  // The panels that come and go. Dashboard Settings keeps their order as one list, rotation.order, which
  // starts empty. When it is empty the screen builds it from these two lists, the large panels and the
  // small panels (core/panel-order.js). A row with no seconds follows pageSeconds.
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
      { panel: 'roster', show: true },
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
  // The screen glitch (the Screen tab in the Studio), the television effect.
  // 2.7 s is how long frame.js keeps it going.
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
  // The calendars (Calendars tab): a code, a name, the show switch and the kind (see calendarKinds below). A
  // calendar has no kind until a coach picks one, so the starting row has none and its events have no chip.
  // groupEventsByKind off keeps both pages of the Events panel in date order. On, page one has the next
  // four Meetings, Deadlines and events with no kind, and page two the next four Competitions and Outreach events.
  calendars: [{ id: 'team', name: 'Team calendar', show: true }],
  groupEventsByKind: false,
  // The competition cards (the Competition tab in the Studio, core/competition.js, docs/frc-feed.md).
  //   competitionMode  see competitionModes above
  //   the switches     one for each card, see competitionSwitches above
  competitionMode: 'auto',
  competitionTimeline: true,
  competitionLastSeason: true,
  competitionRank: true,
  competitionNextMatch: true,
  competitionResults: true,
  competitionAlliance: true,
  competitionDistrict: true,
  // The Monday tab in the Studio (docs/monday.md). The Teletraan computer reads these (computer/scripts/monday-sync.sh) and writes the
  // tasks and milestones, which carry what the panels need. The screen reads only mondayEveryMinutes (for the stale
  // chip) and mondayShowOwners.
  //   mondayEveryMinutes    how often the Teletraan computer reads the boards, 5 to 120 minutes
  //   mondayTaskBoard       the task board: its number, the column of each field, the label tables (a label is read by its
  //                         index, not its text), and the Hide label text. A team label row names a Team, none meaning both
  //                         teams. A department row names a Team lead, or is matched to the Team lead with the same name
  //   mondayMilestoneBoard  the milestones board, the same way
  //   mondayBoards          not used any more: the rows of the older Monday tab, kept so that nothing typed is lost
  //   mondayShowOwners      keeps the first names of the people in Assigned. Off to start with
  mondayEveryMinutes: 30,
  mondayTaskBoard: {
    boardId: '18435126893',
    departmentColumn: 'color_mm82nvea',
    statusColumn: 'color_mkv6tatz',
    teamColumn: 'color_mm82jgxg',
    priorityColumn: 'color_mm82wfy',
    showColumn: 'color_mm83p12x',
    assignedColumn: 'multiple_person_mm82cqbx',
    pocColumn: 'multiple_person_mm8331h1',
    timelineColumn: 'timerange_mkyp8kx7',
    hoursColumn: 'numeric_mm82pw1a',
    completedColumn: 'date_mm82kn5v',
    milestoneColumn: 'board_relation_mm83phwy',
    teamLabels: [{ index: 1, team: { _type: 'reference', _ref: 'team-prime' } }, { index: 0, team: { _type: 'reference', _ref: 'team-nova' } }, { index: 5 }],
    statusIndexes: { todo: 5, inProgress: 0, inReview: 3, stuck: 2, done: 1 },
    priorityIndexes: { high: 2, medium: 0, low: 1 },
    hideLabel: 'Hide',
    departmentLabels: [
      { index: 0, name: 'Electrical' },
      { index: 1, name: 'Build' },
      { index: 2, name: 'Programming' },
      { index: 3, name: 'Design' },
      { index: 4, name: 'CNC' },
      { index: 5, name: 'Unassigned', neverShown: true },
      { index: 6, name: 'Strategy' },
      { index: 7, name: 'Business' },
      { index: 8, name: 'Marketing' },
      { index: 9, name: 'Operations' },
    ],
  },
  mondayMilestoneBoard: {
    boardId: '18435272887',
    dateColumn: 'date_mm83y6zw',
    teamColumn: 'color_mm83be52',
    departmentColumn: 'color_mm83f77w',
    statusColumn: 'color_mm83ndkf',
    teamLabels: [{ index: 109, team: { _type: 'reference', _ref: 'team-prime' } }, { index: 8, team: { _type: 'reference', _ref: 'team-nova' } }, { index: 5 }],
    statusIndexes: { notStarted: 5, onTrack: 1, atRisk: 2, done: 3 },
    departmentLabels: [
      { index: 107, name: 'Build' },
      { index: 9, name: 'Electrical' },
      { index: 19, name: 'Programming' },
      { index: 1, name: 'Design' },
      { index: 11, name: 'CNC' },
      { index: 104, name: 'Strategy' },
      { index: 0, name: 'Business' },
      { index: 18, name: 'Marketing' },
      { index: 7, name: 'Operations' },
      { index: 5, name: 'All Departments' },
    ],
  },
  mondayBoards: [],
  mondayShowOwners: false,
  // The background behind the panels of the Original theme (see backgrounds in config-lists.js)
  background: 'sweep',
};

// Used for anything missing from the Look document in the Studio. The
// Studio starts at the same values, and tests/schemas.test.mjs fails if they differ.
//   defaultTheme  the id of a theme in themes/registry.js
//   useNow        a theme and an overlay to show now, whatever the schedule says. Each is empty
//                 (follow the schedule), an id, or for the overlay 'none'. until is a time, or empty.
//   schedule      rules: { name, kind: 'theme' | 'overlay', theme or overlay, startDate, endDate, repeatsEveryYear }
//   timeZone      the time zone the dates in the schedule are read in. The events
//                 (core/events.js) use it too, for their dates and for when they are over
//   seasonOverPanels  true lets a seasonal pack draw small pieces (snow, leaves...) drifting over the
//                 panels (core/season.js). false keeps only its header marks and edge decorations
export const defaultThemeSettings = {
  defaultTheme: 'hawktimus',
  useNow: { theme: '', overlay: '', until: '' },
  schedule: [],
  timeZone: 'America/New_York',
  seasonOverPanels: true,
};
