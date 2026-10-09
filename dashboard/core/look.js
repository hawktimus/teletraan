// The Polish setting of Dashboard Settings (the names are in `looks` in config.js).
// A look is one word that picks values for the page switches the stylesheets
// read: data-finish and data-glint, which already existed, and data-look, which
// only the rules for Plain in base.css read. Nothing else reads the setting.
// To add a look: add its name to `looks` in config.js, a line to `switchesOf`
// below, and a title to the list in studio/schemas/dashboardSettings.js.

import { defaultSettings, looks } from '../config.js';

// What each look sets. For glint, 'setting' means the Glint switch in Dashboard
// Settings decides, and 'off' means the glint is off whatever that switch says.
// The finish and glint of Polished are what the screen had before there was a Look.
const switchesOf = {
  polished: { finish: 'metal', glint: 'setting' },
  flat: { finish: 'flat', glint: 'off' },
  plain: { finish: 'flat', glint: 'off' },
};

// settings are the cleaned Dashboard Settings. asked is what the page address
// has: asked.look, asked.finish and asked.glint, each null when it is not there.
// The address wins, for this page only: ?look= over the setting, and ?finish=
// and ?glint= over what the look says, so the old test addresses keep their meaning.
// Returns the three values to put on the html element: look, finish and glint.
export function pageSwitchesFor(settings, asked) {
  let look = defaultSettings.look;
  if (looks.includes(settings.look)) look = settings.look;
  if (looks.includes(asked.look)) look = asked.look;

  let finish = switchesOf[look].finish;
  if (asked.finish === 'metal' || asked.finish === 'flat') finish = asked.finish;

  let glint = switchesOf[look].glint === 'setting' ? (settings.glint ? 'on' : 'off') : 'off';
  if (asked.glint === 'on' || asked.glint === 'off') glint = asked.glint;

  return { look: look, finish: finish, glint: glint };
}
