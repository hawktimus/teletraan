// Keeps the team on the screen in step with the Teams settings and the clock (core/teams.js).
// Once a second it asks which team is wanted. When that changes, the three areas are asked to
// move on at once, so the pages built next are the new team's, and the new team itself goes on at
// the next moment the large frame is apart (core/areas.js). A page that is already on the screen
// stays until it leaves, so nothing changes in the middle of a panel.

import * as frame from '../frame.js';
import { moveOn } from './schedule.js';
import { useTeams, wantedTeam } from './teams.js';

let getContent = null;
let lastWanted = null; // the code wanted at the last look, or null before the first one

// getContent() returns the newest content
export function startTeams(contentGetter) {
  getContent = contentGetter;
  frame.onSecond(look);
}

function look(now) {
  const content = getContent();
  if (!content) return;

  useTeams(content, now);

  const code = wantedTeam().code;
  if (lastWanted !== null && code !== lastWanted) moveOn(['grid1', 'grid2', 'ticker']);
  lastWanted = code;
}
