// The Competition tab of Dashboard Settings: the competition cards that show the
// season, the next match, the rank and the results (docs/frc-feed.md). It has:
//
//   frcConnection      a read only block that says when the Mini last read the competition
//                      data (../frc-status-input.js). It stores nothing
//   competitionMode    auto (the cards come two days before a team event and take priority
//                      during it), always or off, auto to start with
//   one switch for each card, all on to start with
//
// The mode and the switches are the same names, choices and starting values as the
// competitionModes list, competitionSwitches and defaultSettings in dashboard/config.js.
// check-schemas.mjs fails if they differ.
//
// None of the fields is required. Dashboard Settings published before these fields existed
// has none, and the screen reads that as Auto with every card on. A required field would
// stop that page being published until somebody filled it in.
//
// To take the whole section out later: delete this file, remove its import and the line that
// uses competitionFields in dashboardSettings.js, and remove the same names from
// check-schemas.mjs and config.js. The dashboard uses the starting values for anything
// missing from the published settings.

import { defineField } from 'sanity';
import { FrcStatusInput } from '../frc-status-input.js';

// The values are the names in competitionModes in dashboard/config.js
const modes = [
  { title: 'Auto', value: 'auto' },
  { title: 'Always', value: 'always' },
  { title: 'Off', value: 'off' },
];

// One for each card, in the order the cards are listed in dashboard/core/competition.js
const cards = [
  { name: 'competitionTimeline', title: 'Season timeline', description: 'A line from today to the next dates, each with the days left. In Auto it runs all season.' },
  { name: 'competitionLastSeason', title: 'Last season at a glance', description: 'Record, rank at each event and the EPA line of last season. In Auto it shows until the first event starts.' },
  { name: 'competitionRank', title: 'Live rank', description: 'Rank, record and ranking points. In Auto it shows from two days before an event to its last day.' },
  { name: 'competitionNextMatch', title: 'Next match', description: 'The next match, its partners, opponents and win chance. In Auto it is the first card during an event.' },
  { name: 'competitionResults', title: 'Results strip', description: 'The last 8 matches as red or blue chips with the score. In Auto it shows from two days before an event to its last day.' },
  { name: 'competitionAlliance', title: 'Alliance board', description: 'The alliance number and its partners. In Auto it shows during an event, once the selection is made.' },
  { name: 'competitionDistrict', title: 'District points', description: 'Points against the cutoff for the state championship. In Auto it shows all season once the first event has started.' },
];

export function competitionFields() {
  const fields = [
    defineField({
      name: 'frcConnection',
      title: 'Competition data from the Mini',
      type: 'string',
      group: 'competition',
      readOnly: true,
      description: 'When the Mini last read the competition data. The Mini writes this by itself, so there is nothing to type here.',
      components: { input: FrcStatusInput },
    }),

    defineField({
      name: 'competitionMode',
      title: 'Competition cards',
      type: 'string',
      group: 'competition',
      description: 'Auto shows the cards from two days before a team event and gives them priority during it. Always shows every card that is on and has data. Off shows none.',
      options: { list: modes, layout: 'radio', direction: 'horizontal' },
      initialValue: 'auto',
      validation: Rule => Rule.valid(modes.map(mode => mode.value)).error('Pick Auto, Always or Off.'),
    }),
  ];

  cards.forEach(card => {
    fields.push(defineField({
      name: card.name,
      title: card.title,
      type: 'boolean',
      group: 'competition',
      description: card.description,
      initialValue: true,
    }));
  });
  return fields;
}
