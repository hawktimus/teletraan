// Every panel the dashboard can load. A panel is a folder under panels/
// holding a script and a stylesheet.
//
//   region    where it appears: banner, countdown, grid1, grid2, ticker or overlay
//   topic     what it is about. Grid 1 and Grid 2 never show the same topic
//             at the same moment, so tasks and task-counts share one.
//   testOnly  only used by the hardware test (?stress)
//
// A panel in grid1, grid2 or ticker draws only its page. The area it is shown
// in supplies the frame and the page change (core/areas.js). The banner, the
// countdown and the overlay panels draw their own frame.
//
// Which of the grid panels are shown, in what order and for how long is set
// in Dashboard Settings (see defaultSettings in config.js). The fixed panels
// (banner, countdown, ticker) are started by shell.js.

export const panels = [
  { id: 'banner', region: 'banner' },
  { id: 'countdown', region: 'countdown' },
  { id: 'ticker', region: 'ticker' },

  { id: 'tasks', region: 'grid1', topic: 'tasks' },
  { id: 'events', region: 'grid1', topic: 'events' },
  { id: 'tonight', region: 'grid1', topic: 'plan' },
  { id: 'spotlight', region: 'grid1', topic: 'subteams' },
  { id: 'sponsor-feature', region: 'grid1', topic: 'sponsors' },
  { id: 'photo', region: 'grid1', topic: 'photo' },
  { id: 'leadership', region: 'grid1', topic: 'people' },
  { id: 'team-leads', region: 'grid1', topic: 'subteams' },
  { id: 'custom', region: 'grid1', topic: 'custom' },

  { id: 'task-counts', region: 'grid2', topic: 'tasks' },
  { id: 'next-event', region: 'grid2', topic: 'events' },
  { id: 'forecast', region: 'grid2', topic: 'weather' },
  { id: 'safety-days', region: 'grid2', topic: 'safety' },
  { id: 'sponsor-logo', region: 'grid2', topic: 'sponsors' },

  { id: 'alert', region: 'overlay' },
  { id: 'announcement', region: 'overlay' },

  { id: 'stand-in-tile', region: 'grid2', testOnly: true },
  { id: 'stand-in-ticker', region: 'ticker', testOnly: true },
].map(panel => Object.assign({
  script: './panels/' + panel.id + '/' + panel.id + '.js',
  style: 'panels/' + panel.id + '/' + panel.id + '.css',
}, panel));
