// The parts of the Competition page that need no Studio (competition-view.js draws them): the sentence about the TV
// and the fields it shows. The names are the stored names of Dashboard Settings (schemas/settingsCompetition.js);
// the page renames nothing. tests/studio-competition.test.mjs reads this with node.

export const settingsId = 'dashboardSettings';

export const words = {
  title: 'Competition',
  intro: 'The competition cards show the season, the next match, the rank and the results, from two days before a team event. Change them here, then click Publish all in the top bar.',
  connection: 'Competition data',
  connectionSays: 'When the Teletraan computer last read the public competition data.',
  cards: 'Cards',
  cardsSays: 'Auto shows the cards from two days before a team event. Always shows every card that is on. Off shows none.',
  noSettings: 'Dashboard Settings has not been published yet. Open it, click Publish once, and come back.',
  reading: 'Reading the settings.',
};

// The mode, then one switch for each card, in the order of dashboard/core/competition.js
export const cardNames = ['competitionTimeline', 'competitionLastSeason', 'competitionRank', 'competitionNextMatch', 'competitionResults', 'competitionAlliance', 'competitionDistrict'];
export const fieldNames = ['competitionMode'].concat(cardNames);

// Every field of Dashboard Settings that the page shows. Dashboard Settings hides each of them (dashboardSettings.js).
export const settingsNames = ['frcConnection'].concat(fieldNames);
