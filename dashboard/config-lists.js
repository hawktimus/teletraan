// The names, lists and limits the settings choose from, and the starting views (part of config.js).

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

// The lookSwap setting in Dashboard Settings is hidden and the screen ignores it: there is one swap
// (core/swap-run.js). The field and its stored value stay so that nothing saved is lost. The Studio copies this list.
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
//                     slat: the slat change only. mechanical: the mechanical change only.
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

// The Views (core/views.js, docs/views.md): four documents in the Studio, one for each key. The id of a document says its
// key. A view is a layout, a team, the minutes it stays, the rows of the large panel and the rows of the small panel.
// defaultViews is what a view has when its document does not say, and has the shape of studio/tools/view-defaults.js
// (tests/schemas.test.mjs compares them).
//   layout       standard (banner, main panel, countdown and small panels) or bar (banner across the top, a column, one panel)
//   mirror       the column on the other side
//   countdownIn  side or banner
//   viewTag      the name of the view at the far edge of the banner
//   teamChip     the team chip on the cards of the view
//   colors       team or general
export const viewIds = { general: 'view-general', prime: 'view-prime', nova: 'view-nova', family: 'view-family' };
export const viewTeams = { general: '', prime: 'prime', nova: 'nova', family: '' };
export const viewLimits = { minutes: { min: 1, max: 30 } };
export const viewLayoutNames = ['standard', 'bar'];
export const countdownPlaces = ['side', 'banner'];
export const viewColors = ['team', 'general'];

// A tasks row of a team view with no department stands for every Team lead on the Monday board, and is worked out each
// time the view is read, so a new department needs no edit (core/views.js, expandRows)
const mondayRow = (panel, team) => ({ panel: panel, team: team, seconds: 30 });
const teamRows = team => [mondayRow('monday-tasks', team), mondayRow('monday-done', team), mondayRow('monday-timeline', team), mondayRow('monday-board', team)];

export const defaultViews = {
  general: {
    minutes: 6,
    layout: 'standard',
    mirror: false,
    countdownIn: 'side',
    viewTag: true,
    teamChip: false,
    colors: 'general',
    panels: [
      { panel: 'tonight', seconds: 45 },
      { panel: 'events', seconds: 60 },
      { panel: 'leadership', seconds: 20 },
      { panel: 'photo', photoCount: 4, secondsPerPhoto: 10 },
      { panel: 'sponsor-feature', seconds: 15 },
    ],
    sidePanels: [
      { panel: 'next-event', seconds: 30 },
      { panel: 'task-counts', seconds: 20 },
      { panel: 'safety-days', seconds: 20 },
      { panel: 'forecast', seconds: 15 },
      { panel: 'sponsor-logo', seconds: 15 },
    ],
  },
  prime: { minutes: 6, layout: 'bar', mirror: false, countdownIn: 'banner', viewTag: true, teamChip: true, colors: 'team', panels: teamRows('prime'), sidePanels: [] },
  nova: { minutes: 6, layout: 'bar', mirror: true, countdownIn: 'banner', viewTag: true, teamChip: true, colors: 'team', panels: teamRows('nova'), sidePanels: [] },
  family: {
    minutes: 2,
    layout: 'bar',
    mirror: false,
    countdownIn: 'banner',
    viewTag: false,
    teamChip: false,
    colors: 'general',
    panels: [
      { panel: 'monday-overall', seconds: 30 },
      { panel: 'monday-status-depts', seconds: 30 },
    ],
    sidePanels: [],
  },
};

// The panels of the Family view are fixed
export const familyPanels = ['monday-overall', 'monday-status-depts'];
