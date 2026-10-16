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

// Calendar files and sample content live in one of these folders. The sample
// folder is kept in git. The live folder is filled in
// by the Mini and is never committed.
export const sampleFolder = 'data/sample/';
export const liveFolder = 'data/live/';

// The countdown looks more serious as the date gets closer
export const threat = {
  tenseDays: 30,
  criticalDays: 7,
};

// The Speed setting in Dashboard Settings. Each name is how much longer
// (more than 1) or shorter (less than 1) everything takes: how long a move
// lasts, and how long a panel stays on screen.
export const speeds = { 'very-slow': 2, 'slow': 1.5, 'normal': 1, 'fast': 0.75 };

// The Frame metal setting in Dashboard Settings: the metal on the permanent
// edges (the banner, the countdown, the logo). Each page frame has a finish of
// its own that is chosen at every page change, see frameFinishes below.
export const metals = ['gold', 'silver'];

// The Polish setting in Dashboard Settings: how much polish the frames have.
// core/look.js turns it into the page switches the stylesheets read
// (data-finish, data-glint and data-look). The Studio copies this list.
//   polished  the normal look: worn metal edges, screws with shading, the glint
//             that runs round the frames, and the // in the panel headers
//   flat      plain colour edges and plain screws, and no glint. The // stays
//   plain     flat, and no screws on the frames and no // in the panel headers
export const looks = ['polished', 'flat', 'plain'];

// The themes (docs/layouts.md, "Themes"): the look of the frames, the textures and the type. Each one is a
// folder in styles/ with theme.css, frame.css, tokens.css and transitions.js, and core/style-loader.js finds
// the folder from the id. The id goes on the page as data-style (core/style.js). The Studio copies this list.
//   original   the screen as it has always been
//   cybertron  the sharp theme: gunmetal plates with a steel edge and neon
//   retro      a placeholder that looks like Original until its folder loses the file PLACEHOLDER
export const themeIds = ['original', 'cybertron', 'retro'];

// Minimal is not a theme any more: the bar layout draws as Minimal drew, in every theme (layouts/bar-minimal.css).
// The word stays as a name a Screen or a preview may still hold. It means the Original theme in the bar layout,
// until the Views (docs/layouts.md) have the layout of their own.
export const barStyle = 'minimal';

// The names a Screen, a preview and Style in Dashboard Settings hold. Retro is not in the list yet: ?style= and the weekday
// schedule of themes reach it through themeIds (core/style.js, isStyle), and the Studio lists follow when it is designed.
export const styles = ['original', 'cybertron', barStyle];

// The Screens (core/screens.js): three documents in the Studio, one for each style. The id of a document says its
// style, so no field does. Dashboard Settings (Look tab) names the Screen that plays on each day of the week. Original
// plays on Monday, Wednesday, Friday and Sunday and Cybertron on the other three. Minimal is not scheduled: it plays
// while a Monday row does.
export const screenIds = { original: 'screen-original', cybertron: 'screen-cybertron', minimal: 'screen-minimal' };
export const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
export const defaultSchedule = {
  monday: 'original',
  tuesday: 'cybertron',
  wednesday: 'original',
  thursday: 'cybertron',
  friday: 'original',
  saturday: 'cybertron',
  sunday: 'original',
};

// What a Screen has when its document does not say, or there is no document yet. The Studio starts at the same values
// and has the same limits (studio/schemas/screen.js), and tests/schemas.test.mjs compares them.
//   nameEffectEveryMinutes  minutes between plays of the team name effect in the banner
//   hawkEveryMinutes        minutes between changes of the logo into the flying hawk
//   swapSeconds             how long a swap takes. 1.25 is the length the swap was built for (core/swap-plan.js), and every
//                           time of the swap is scaled by swapSeconds / standardSwapSeconds
//   mondayStyle             not here: a Screen with none uses mondayStyle in defaultSettings below
export const standardSwapSeconds = 1.25;
export const defaultScreen = { nameEffectEveryMinutes: 10, hawkEveryMinutes: 5, swapSeconds: standardSwapSeconds };

// The large panels whose content follows the team on the screen, because the items they draw carry the Team field
// and core/content.js filters them (visibleItems). A row of one of these can name a team. Every other large panel
// (events, photo, the competition cards) is the same for both teams, and a row of it has no team. The Studio
// copies this list for the Team field of a row.
export const teamPanels = ['tasks', 'tonight', 'spotlight', 'team-leads', 'roster', 'leadership', 'sponsor-feature', 'custom'];

// The Monday rows a team is seeded with, in the order they play: the tasks of its first department, what it finished and its
// board. A Screen that nobody has opened in the Studio plays them (core/screen-seed.js), and the Studio fills an empty Screen with
// the same ones (studio/tools/screen-seed.js).
export const mondayRows = ['monday-tasks', 'monday-done', 'monday-board'];

// The panels of the one task board, in the order the Studio offers them (docs/monday.md), and what a row of each says
// about the team and the department:
//   department  a team and a department (a Team lead): the tasks panel
//   team        a team: done, timeline and board
//   none        neither: the panels for both teams, status by department and overall progress
export const mondayKinds = {
  'monday-tasks': 'department',
  'monday-done': 'team',
  'monday-status-depts': 'none',
  'monday-overall': 'none',
  'monday-timeline': 'team',
  'monday-board': 'team',
};

// The older Monday panels: still in the registry, so that a saved row keeps working, and not in the picker
export const mondayOldPanels = ['monday-milestones', 'monday-progress', 'monday-milestones-both', 'monday-progress-both'];

// The team settings in Dashboard Settings (Look tab): which team the screen shows. The Studio copies this list.
//   prime      the Prime team all the time
//   nova       the Nova team all the time
//   alternate  the two teams take turns, alternateMinutes each
export const teamModes = ['prime', 'nova', 'alternate'];

// How the look changes (lookSwap) in Dashboard Settings used to let the editors pick how the screen changes from one look
// to the next. There is one swap now (core/swap-run.js) and the setting is hidden in the Studio. The field and
// its stored value stay, so that nothing already saved is lost, and the screen ignores the value. The Studio
// copies this list.
//   assemble  everything leaves and comes in again, the way the screen starts
//   slats     the page change of the large panel with the slats turning, and the frames stay
//   cut       at once, at the next page change of the large panel
export const lookSwaps = ['assemble', 'slats', 'cut'];

// The competition cards setting in Dashboard Settings (Competition tab): when the cards of core/competition.js
// are in the rotation. The Studio copies this list.
//   auto    each card comes in its own window: the cards about an event from two days before its first day to its last,
//           with the next match first, the season timeline all season, the look back before the first event, and the
//           district points once the first event has started
//   always  every card that is switched on, whatever the date
//   off     no card
export const competitionModes = ['auto', 'always', 'off'];

// The switches of the cards, one for each card in core/competition.js, in the order of the Studio. All start on.
export const competitionSwitches = [
  'competitionTimeline',
  'competitionLastSeason',
  'competitionRank',
  'competitionNextMatch',
  'competitionResults',
  'competitionAlliance',
  'competitionDistrict',
];

// Auto brings the cards about an event this many days before its first day
export const competitionLeadDays = 2;

// The Preview competition button holds the cards on the screen for this many seconds, each card for an equal share
export const competitionPreviewSeconds = 120;

// The page change settings in Dashboard Settings (Look tab) (core/transitions.js chooses from them)
//   pageChangeStyles  alternate: the slat change and the mechanical change take turns.
//                     slat: the old change only. mechanical: the new one only.
//   frameFinishes     mostly-gold: gold, and silver now and then (silverChance percent of
//                     the changes, picked at random). alternate: gold, silver, gold ...
//                     gold, silver: that one every time.
export const pageChangeStyles = ['alternate', 'slat', 'mechanical'];
export const frameFinishes = ['mostly-gold', 'alternate', 'gold', 'silver'];

// The photo settings in Dashboard Settings (Screen tab) (core/photos.js chooses from them)
//   random        any visible photo, never the same one twice in a row
//   newest-first  from the newest photo to the oldest, then over again
export const photoOrders = ['random', 'newest-first'];

// How the Photo panel fits a photo to its card (core/photos.js). The setting picks one for every photo,
// and a Photo document can pick its own, or say it follows the setting.
//   fill   the card keeps one shape, and the picture is cut to it, around the hotspot
//   whole  the card takes the shape of the photo, so nothing is cut
export const photoFits = ['fill', 'whole'];

// How the portraits of Leadership, Team Leads and the Roster slot are drawn (core/portrait.js). The
// shape and the frame are one setting each, for all three.
//   square   the card as it has always been, with the cut corner of the frame
//   rounded  every corner cut, 24px at most
//   circle   a circle
//   metal    the metal edge of the card, as it has always been
//   line     a thin line in the team accent
//   none     the picture alone
export const portraitShapes = ['square', 'rounded', 'circle'];
export const portraitFrames = ['metal', 'line', 'none'];

// The night mode settings in Dashboard Settings (Advanced tab) (core/night.js and core/night-screen.js)
//   nightStyles  bounce: the logo drifts round the black screen. black: only black.
//   nightSpeeds  the seconds the logo takes to cross the screen sideways (across) and
//                top to bottom (down), one crossing each way. Both are whole seconds and
//                have no common factor (they are different prime numbers), so the two
//                movements only meet at a corner once in across x down seconds. The
//                arithmetic is in docs/night-mode.md. A corner hit comes about every
//                713 seconds (slow), 391 (normal) or 221 (fast). Change one of these
//                numbers and the docs and tests/night.test.mjs need the new figures.
//   nightFirstHit  the first corner hit comes this many seconds after night mode starts,
//                a whole number picked at random from the range
export const nightStyles = ['bounce', 'black'];
export const nightSpeeds = {
  slow: { across: 31, down: 23 },
  normal: { across: 23, down: 17 },
  fast: { across: 17, down: 13 },
};
export const nightFirstHit = { min: 120, max: 300 };

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
  // The logo settings. The hawk lasts from 6 seconds (quick but clear) to 30.
  logoSpinEvery: { min: 0, shortest: 10, max: 3600 },
  logoSpinDuration: { min: 0.5, max: 10 },
  logoHawkEvery: { min: 0, shortest: 10, max: 3600 },
  logoHawkDuration: { min: 6, max: 30 },
  // The page change settings. The frame breaks apart in this many seconds and
  // rebuilds in the same again: below 0.3 the pieces cannot be followed, above 2
  // the screen spends more time apart than together.
  breakSeconds: { min: 0.3, max: 2 },
  silverChance: { min: 0, max: 100 },
  // The photo settings. Below 6 seconds a photo is gone before it can be looked at.
  photoSeconds: { min: 6, max: 120 },
  // The two size settings of the photo settings, in percent. At 60 a picture is still easy to see from
  // across the room. For the Photo panel 100 is the full size, the largest that fits the frame. The old
  // portraitScale is replaced by the two portrait sizes at the end of this list and stays only to be read.
  portraitScale: { min: 60, max: 200 },
  photoScale: { min: 60, max: 100 },
  // The night mode settings. At 120 pixels the logo is still clear from across the room, and at 800 it
  // still fits the 1080 pixel height with the number under it.
  nightLogoWidth: { min: 120, max: 800 },
  // The Demo page. A step shorter than 5 seconds is gone before it can be seen, and 5 minutes
  // is longer than anyone shows a demo.
  demoSeconds: { min: 5, max: 300 },
  // The hidden transition settings. A chance is a percent of the page changes, and 0 is never.
  // Hours are how often a transition comes about, in hours of screen time.
  desktopChance: { min: 0, max: 100 },
  redEyesChance: { min: 0, max: 100 },
  desktopEveryHours: { min: 1, max: 1000 },
  redEyesEveryHours: { min: 1, max: 1000 },
  // The length of one booked talk, in minutes (the Presentations list in the Studio)
  talkMinutes: { min: 5, max: 30 },
  // The team settings, in minutes: how long each team stays on the screen in Alternate mode
  alternateMinutes: { min: 1, max: 30 },
  // The portrait sizes, in percent of the 120px portrait that fills a row of four. 100 is 120px and 220
  // is 264px, the largest that fits the 576px body with a row to itself.
  leadershipPortrait: { min: 60, max: 220 },
  rosterPortrait: { min: 60, max: 220 },
  // The Screens (core/screens.js): the seconds a row stays, the minutes between the name effect and the flying hawk, and
  // the seconds a swap takes
  rowSeconds: { min: 6, max: 120 },
  nameEffectEveryMinutes: { min: 1, max: 240 },
  hawkEveryMinutes: { min: 1, max: 240 },
  swapSeconds: { min: 0.5, max: 3 },
  // A Photos row of a Screen: how many photos a turn of the row shows and how many seconds each stays
  photoCount: { min: 1, max: 20 },
  secondsPerPhoto: { min: 5, max: 60 },
};

// What a Photos row has until its photoCount and secondsPerPhoto are set: four photos of ten seconds, forty seconds
export const defaultPhotoRow = { photoCount: 4, secondsPerPhoto: 10 };

// The limits of the banner settings of a Screen, the three that sit beside defaultScreen. The Studio uses the same
// numbers (studio/schemas/screen.js), and tests/schemas.test.mjs compares them
export const screenLimits = {
  nameEffectEveryMinutes: limits.nameEffectEveryMinutes,
  hawkEveryMinutes: limits.hawkEveryMinutes,
  swapSeconds: limits.swapSeconds,
};

// The Views and the theme schedule (Studio: Look tab of Dashboard Settings, and the Themes page). The keys are the four
// Views in the order they take the screen. A day of the week plays one of the scheduled themes; Retro is not scheduled.
export const viewKeys = ['general', 'prime', 'nova', 'family'];
export const scheduledThemeIds = ['original', 'cybertron', 'retro'];
export const defaultThemeByWeekday = {
  monday: 'original',
  tuesday: 'cybertron',
  wednesday: 'original',
  thursday: 'cybertron',
  friday: 'original',
  saturday: 'cybertron',
  sunday: 'original',
};

// Used for anything the editors have not filled in yet
export const defaultSettings = {
  motion: 'full',
  speed: 'normal',
  frameMetal: 'gold',
  glint: true,
  // see looks above. Flat and Plain also switch the glint off, whatever glint says
  look: 'polished',
  // see styles above. Original is the screen as it was before there was a Style
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
  generalViewTitle: 'Hawktimus Dashboard',
  viewOrder: viewKeys,
  themeByWeekday: defaultThemeByWeekday,
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
  // The screen glitch (the Screen tab in the Studio), the old television
  // effect. 2.7 s is how long frame.js keeps it going today.
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
  // The Monday tab in the Studio (docs/monday.md). The Mini reads these (mini/scripts/monday-sync.sh) and writes the
  // tasks and milestones, which carry what the panels need. The screen reads only mondayEveryMinutes (for the stale
  // chip) and mondayShowOwners.
  //   mondayEveryMinutes    how often the Mini reads the boards, 5 to 120 minutes
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

// The Demo page in the Studio (core/demo.js, core/demo-screens.js and core/demo-runner.js).
// "Run demo" writes the time into requestedAt and publishes. The screen plays the steps once when
// it sees a request that is no more than demoWindowSeconds old and is not the one it handled last,
// so a Mini that restarts never plays an old request again. A request up to demoSkewSeconds in
// the future still counts, because the Studio's clock may be a little ahead of the Mini's.
//   steps            the screens to show, one after the other. screen is an id from
//                    demoScreens in core/demo-screens.js. seconds is how long it stays, in
//                    the range limits.demoSeconds. At most demoMaxSteps steps.
//   announcementText the words of the announcement step. Empty means the first announcement in
//                    Dashboard Settings, or demoPlaceholderText when there is none.
export const demoWindowSeconds = 60;
export const demoSkewSeconds = 5;
export const demoMaxSteps = 10;
export const demoDefaultSeconds = 30;
export const demoPlaceholderText = '[DEMO ANNOUNCEMENT]';

// A hidden transition pushed from the Studio waits for the next page change of the large panel. When
// that is more than this many seconds away the screen asks for the page change at once instead.
// A push is only played while it is less than demoWindowSeconds old and is not the one handled
// before, the same guard as the demo (shouldRunDemo in core/demo.js).
export const hiddenAdvanceSeconds = 20;

// After a hidden transition has played, none comes about by chance for this many hours. A push from the Studio
// and the ?hidden= switch ignore it. core/hidden.js keeps the time of the last one.
export const hiddenGapHours = 4;

// How long a preview from the Studio holds a team, a style or a seasonal pack on the screen, in seconds. After that the
// screen goes back to the saved settings.
export const previewSeconds = 120;

export const defaultDemo = {
  requestedAt: '',
  steps: [
    { screen: 'announcement', seconds: demoDefaultSeconds },
    { screen: 'night-mode', seconds: demoDefaultSeconds },
  ],
  announcementText: '',
};

// Used for a person, or a team lead, whose "Show photo on screen" switch is
// missing from the saved content, such as one added before the switch existed.
// The Studio fields start at the same value.
export const defaultPerson = {
  showPhoto: true,
};

// Used for a booked talk that has no length or no status in the saved content. The
// Studio fields start at the same values (studio/schemas/presentation.js), and so
// does the list of statuses. Only a scheduled talk runs on the screen.
export const talkStatuses = ['scheduled', 'cancelled', 'done', 'skipped'];
export const defaultTalk = {
  minutes: 15,
  status: 'scheduled',
};

// A calendar filter rule that has no action, or one that is not in the list,
// hides: the Studio field starts on Hide too (studio/schemas/calendarFilter.js).
export const filterActions = ['hide', 'show'];
export const defaultFilter = {
  action: 'hide',
};

// The kind of a calendar in Dashboard Settings (Calendars tab): what sort of events it holds. The Events
// panel writes it as a small chip before each title (core/event-pages.js). A calendar has no kind until a
// coach picks one, and its events have no chip. A calendar with no kind, one whose kind is not in this list
// and one that was saved as other all count as having no kind: other was the starting value once, so a
// calendar that still says it was never picked. noCalendarKind is the name the code gives to that, and
// when the events are grouped by kind they go with the Meetings and the Deadlines. The Studio copies this list.
export const calendarKinds = ['meetings', 'competitions', 'outreach', 'deadlines', 'other'];
export const noCalendarKind = 'other';

// The trim of a team (Studio: Teams, Trim): eight choices that make a team look like itself beyond its colors and
// the mirror. Each name is a field of the team document. Under it is each value the field can have, and the class
// that core/teams.js puts on the html element while a team that has the value is on the screen, which trim.css
// and the style sheets read. The first value of each is the one Prime has, and the one a team document with no
// value, or one that is not in the list, falls back to, so a team that was made before the trim existed looks
// as it did. It has no class (''), because the screen is drawn for it without one. The Studio copies the values
// (studio/schemas/team.js).
//   bolts        the joint bolts are hex nuts, or round rivets with a slot
//   cornerCut    the corners every panel chamfers: top left and bottom right, or top right and bottom left
//   headerNotch  the header tab ends in the usual notch, or in one slant at 60 degrees
//   grid         the grid on the page behind Cybertron and Minimal is lines or dots
//   logoPose     not used any more: the icon is always the usual mark. A team that still stores flight reads as auto,
//                and flight has no class
//   nameStyle    the team name in the banner is solid letters, or outlined letters over a solid accent line
//   tickerLabel  the label of the ticker is the cut plate, or a thin bar with an accent block before it
//   countAccent  the red parts of the countdown are red, or the team's neon
export const teamTrim = {
  bolts: { hex: '', round: 'bolts-round' },
  cornerCut: { 'tl-br': '', 'tr-bl': 'corner-cut-tr' },
  headerNotch: { step: '', slant: 'header-slant' },
  grid: { lines: '', dots: 'grid-dots' },
  logoPose: { auto: '', flight: '' },
  nameStyle: { solid: '', outline: 'name-outline' },
  tickerLabel: { plate: '', bar: 'ticker-bar' },
  countAccent: { red: '', neon: 'accent-neon' },
};

// The metal of a team's frames (Studio: Teams, Colors, Metal) and the class that core/teams.js puts on the html
// element while a team with that metal is on the screen, which tokens.css reads. Gold is the metal Prime has and
// the one a team document with no metal falls back to, so it has no class. The Studio copies the two names.
export const teamMetals = { gold: '', steel: 'metal-steel', purple: 'metal-purple' };

// The palette of a team (Studio: Teams, hidden) and the class core/teams.js puts on the html element. Standard has no class.
// Inverted is the Nova palette: gold as the main color and purple as the accent, and the chips are purple with white text
// (teams.css, tokens.css). The blue and steel palette stays in the code behind the old values and is not seeded.
export const teamPalettes = { standard: '', inverted: 'palette-inverted' };

// The class for a team with Glow on (Studio: Teams, Colors, Glow): the neon lines of its frames and header lines get two
// wider and fainter lines of the same color outside them (base.css). They are strokes, never a filter.
export const glowClass = 'neon-glow';

export const defaultTeam = {
  name: 'HAWKTIMUS PRIME',
  number: '3229',
  school: 'HOLLY SPRINGS HIGH SCHOOL',
};

// The team the screen shows when the Studio has no Teams, and the colors that a team
// document with a missing or mistyped color falls back to (core/sanity.js). It is Prime
// with the colors the screen has always had in Original: teams.css starts at the same nine.
// The name and number are the ones in defaultTeam, and the Team box in Dashboard Settings
// changes them. The logo is empty, which means the shared hawk.
//   neon, pink   the lines and the conduit of Cybertron and Minimal. Original draws neither
//   background   the same as the theme Hawktimus has for the page (themes/hawktimus.css), because Original
//                takes it from the team, and Prime in Original has to look as it always has
//   body         the inside of the panels in Cybertron and Minimal
//   label        the department names in the rows of the Monday cards and the people panels
//   metal        see teamMetals above
//   glow         see glowClass above
export const primeTeam = {
  code: 'prime',
  name: defaultTeam.name,
  shortName: 'PRIME',
  number: defaultTeam.number,
  logo: '',
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
  },
  metal: 'gold',
  palette: 'standard',
  glow: false,
  mirror: false,
  bolts: 'hex',
  cornerCut: 'tl-br',
  headerNotch: 'step',
  grid: 'lines',
  logoPose: 'auto',
  nameStyle: 'solid',
  tickerLabel: 'plate',
  countAccent: 'red',
  active: true,
  order: 10,
  builtIn: true,
};
