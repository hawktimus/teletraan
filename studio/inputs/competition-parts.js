// The parts of the Competition page that need no Studio (competition-view.js draws them): the sentence about the TV
// and the fields it shows. The names are the stored names of Dashboard Settings (schemas/settingsCompetition.js);
// the page renames nothing. tests/studio-competition.test.mjs reads this with node.

export const settingsId = 'dashboardSettings';

export const words = {
  title: 'Competition',
  intro: 'The competition cards show the season, an event preview, our matches and a recap. Pick when they come, then click Publish all in the top bar.',
  connection: 'Competition data',
  connectionSays: 'When the Teletraan computer last read the public competition data.',
  match13: 'Match13',
  match13Says: 'Match13 gives the Forecast and Chances cards. The Teletraan computer reads it with the Match13 key and keeps the numbers on itself, not in Sanity.',
  cards: 'Cards',
  cardsSays: 'The mode says when the cards come. Each card has a switch of its own.',
  modesTitle: 'The modes',
  modeLines: [
    'Before and after (recommended): a preview for the 14 days before an event, up to the day before it. Nothing while the event is on, because the team is away. A recap for 7 days from the day after it ends.',
    'Auto: the older cards come from two days before an event and take turns with the other panels during it.',
    'Always: every card that is on and has something to show, whatever the date.',
    'Off: no competition card.',
  ],
  noSettings: 'Dashboard Settings has not been published yet. Open it, click Publish once, and come back.',
  reading: 'Reading the settings.',
};

// The mode, then one switch for each card, in the order of dashboard/core/competition.js
export const cardNames = ['competitionTimeline', 'competitionLastSeason', 'competitionRank', 'competitionNextMatch', 'competitionResults', 'competitionAlliance', 'competitionDistrict', 'competitionPreview', 'competitionMatches', 'competitionRecap', 'competitionForecast', 'competitionQualify', 'competitionTeamMetrics', 'competitionCompare'];
export const fieldNames = ['competitionMode'].concat(cardNames);

// Every field of Dashboard Settings that the page shows. Dashboard Settings hides each of them (dashboardSettings.js).
export const settingsNames = ['frcConnection'].concat(fieldNames);
// The four fields of the FRC news section (news-parts.js) are hidden in Dashboard Settings the same way
