// Every panel the dashboard can load. A panel is a folder under panels/
// holding a script and a stylesheet.
//
//   region    where it appears: banner, countdown, column, grid1, grid2, ticker or overlay
//   topic     what it is about. Grid 1 and Grid 2 never show the same topic
//             at the same moment, so tasks and task-counts share one.
//   testOnly  only used by the hardware test (?stress)
//   layout    only used in that layout (core/layout.js). A panel with no layout
//             is used in every layout. See fixedPanels() below.
//   pages     how many pages the panel shows one after the other each time it comes
//             round, 1 if it does not say. Each page is a step of its own in the
//             rotation (withPages in core/panel-order.js). The panel's hasContent
//             and mount are given the page, counting from 1, and a page with nothing
//             on it is skipped.
//   competition  a competition card (core/competition.js). It is not in Panel order or in the
//             rotation lists of config.js: the Competition tab of Dashboard Settings switches it,
//             and core/competition.js puts the cards that are due in the large panel's rotation.
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
  { id: 'side', region: 'banner', layout: 'sidebar' },
  { id: 'bar-banner', region: 'banner', layout: 'bar' },
  { id: 'bar-column', region: 'column', layout: 'bar' },
  { id: 'ticker', region: 'ticker' },

  { id: 'tasks', region: 'grid1', topic: 'tasks' },
  { id: 'events', region: 'grid1', topic: 'events', pages: 2 },
  { id: 'tonight', region: 'grid1', topic: 'plan' },
  { id: 'spotlight', region: 'grid1', topic: 'subteams' },
  { id: 'sponsor-feature', region: 'grid1', topic: 'sponsors' },
  { id: 'photo', region: 'grid1', topic: 'photo' },
  { id: 'leadership', region: 'grid1', topic: 'people' },
  { id: 'team-leads', region: 'grid1', topic: 'subteams' },
  { id: 'roster', region: 'grid1', topic: 'subteams' },
  { id: 'custom', region: 'grid1', topic: 'custom' },
  { id: 'competition-next-match', region: 'grid1', topic: 'competition', competition: true },
  { id: 'competition-rank', region: 'grid1', topic: 'competition', competition: true },
  { id: 'competition-results', region: 'grid1', topic: 'competition', competition: true },
  { id: 'competition-alliance', region: 'grid1', topic: 'competition', competition: true },
  { id: 'competition-timeline', region: 'grid1', topic: 'competition', competition: true },
  { id: 'competition-district', region: 'grid1', topic: 'competition', competition: true },
  { id: 'competition-last-season', region: 'grid1', topic: 'competition', competition: true },

  { id: 'task-counts', region: 'grid2', topic: 'tasks' },
  { id: 'next-event', region: 'grid2', topic: 'events' },
  { id: 'forecast', region: 'grid2', topic: 'weather' },
  { id: 'safety-days', region: 'grid2', topic: 'safety' },
  { id: 'sponsor-logo', region: 'grid2', topic: 'sponsors' },

  { id: 'alert', region: 'overlay' },
  { id: 'announcement', region: 'overlay' },
  { id: 'talk', region: 'overlay' },

  { id: 'stand-in-tile', region: 'grid2', testOnly: true },
  { id: 'stand-in-ticker', region: 'ticker', testOnly: true },
].map(panel => Object.assign({
  script: './panels/' + panel.id + '/' + panel.id + '.js',
  style: 'panels/' + panel.id + '/' + panel.id + '.css',
}, panel));

// The panels that stay on screen the whole time, in the order shell.js draws
// them. The sidebar layout has one of its own, side, which holds what the
// banner and the countdown hold in the standard layout, and the bar layout has
// two, the banner and the side column, so when a panel names the layout it is the
// one drawn, and the panels with no layout are not.
export function fixedPanels(layout) {
  const stays = panel => panel.region === 'banner' || panel.region === 'countdown' || panel.region === 'column';
  const own = panels.filter(panel => stays(panel) && panel.layout === layout);

  return (own.length > 0 ? own : panels.filter(panel => stays(panel) && !panel.layout)).map(panel => panel.id);
}

