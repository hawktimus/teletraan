// What the form of a Screen shares with the inputs inside it (screen-input.js gives it, and
// screen-fields.js reads it): the style of the Screen, the teams for the pickers, the team the
// switch above the map is on, and what was read from Dashboard Settings. Studio draws the fields
// below the map by itself, so this is how they learn what the map and the switch hold.

import { createContext } from 'react';
import { builtInTeams } from './screen-parts.js';

export const startingContext = {
  style: 'original',
  teams: builtInTeams,
  editing: builtInTeams[0].code,
  settings: null,
  read: false,
  unreadable: false,
};

export const ScreenContext = createContext(startingContext);
