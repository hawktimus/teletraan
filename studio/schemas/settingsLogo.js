// The Logo tab of Dashboard Settings: every setting for what the logo does and
// when. The master switch comes first, then the entrance (it plays once, so it
// has only a switch), then one switch, seconds between plays and seconds one
// play lasts for each animation that repeats: the spin, the flying hawk and the
// team name effect. The seconds between plays can be 0, which means never, or
// 10 or more (30 or more for the name effect).
//
// The starting values and limits are the same as defaultSettings and limits in
// dashboard/config.js, and check-schemas.mjs fails if they differ. The name
// effect keeps its old names (nameTransform, nameEvery, nameDuration) so the
// content already published still works. nameDuration is how long the effect
// takes on HAWKTIMUS PRIME today, and the flying hawk lasts 11 seconds today.
//
// To take the whole section out later: delete this file, remove its import and
// the two lines that use logoGroup and logoFields in dashboardSettings.js, and
// remove the same names from check-schemas.mjs and config.js. The dashboard
// uses the starting values for anything missing from the published settings.

import { defineField } from 'sanity';
import { neverOrAtLeast } from './fields.js';

export const logoGroup = { name: 'logo', title: 'Logo' };

function switchField(name, title, description) {
  return defineField({
    name: name,
    title: title,
    type: 'boolean',
    group: 'logo',
    description: description,
    initialValue: true,
  });
}

// Seconds between plays: 0 for never, or from shortest to largest
function everyField(name, title, description, start, shortest, largest) {
  return defineField({
    name: name,
    title: title,
    type: 'number',
    group: 'logo',
    description: description,
    initialValue: start,
    validation: Rule => [
      Rule.required().error('Enter the number of seconds, or 0 for never.'),
      Rule.integer().min(0).max(largest).error('Use 0 for never, or a whole number from ' + shortest + ' to ' + largest + '.'),
      Rule.custom(neverOrAtLeast(shortest)),
    ],
  });
}

// How long one play lasts at Normal speed, with decimals allowed
function durationField(name, title, description, start, shortest, longest) {
  return defineField({
    name: name,
    title: title,
    type: 'number',
    group: 'logo',
    description: description,
    initialValue: start,
    validation: Rule => [
      Rule.required().error('Enter the number of seconds.'),
      Rule.min(shortest).max(longest).error('Use a number from ' + shortest + ' to ' + longest + '.'),
    ],
  });
}

export function logoFields() {
  return [
    switchField('logoAnimations', 'Logo animations',
      'Master switch. Turn it off to stop every logo animation below, the name effect too, and keep the still emblem.'),

    switchField('logoEntrance', 'Entrance',
      'The four plates fly in once, when the screen starts. It plays once, so it has no timing.'),

    switchField('logoSpin', 'Spin',
      'Now and then the logo makes one full turn, drawn flat. Turn it off to stop the spin.'),
    everyField('logoSpinEvery', 'Spin every (seconds)',
      'Seconds between spins, from 10 to 3600. Use 0 to never spin.', 72, 10, 3600),
    durationField('logoSpinDuration', 'Spin duration (seconds)',
      'How long one spin lasts, from 0.5 to 10 seconds, at Normal speed.', 1.6, 0.5, 10),

    switchField('logoHawk', 'Flying hawk',
      'Now and then the logo folds into a robot, changes into a hawk, flies and changes back. Turn it off to stop it.'),
    everyField('logoHawkEvery', 'Flying hawk every (seconds)',
      'Seconds between flights, from 10 to 3600. Use 0 to never fly.', 24, 10, 3600),
    durationField('logoHawkDuration', 'Flying hawk duration (seconds)',
      'How long the whole flight lasts, from 6 to 30 seconds, at Normal speed.', 11, 6, 30),

    switchField('nameTransform', 'Name effect',
      'Now and then each letter of the team name splits apart, turns and locks back together. Turn it off to keep the name still.'),
    everyField('nameEvery', 'Name effect every (seconds)',
      'Seconds between plays of the name effect, from 30 to 900. Use 0 to never play it.', 300, 30, 900),
    durationField('nameDuration', 'Name effect duration (seconds)',
      'How long one play of the name effect lasts, from 0.5 to 10 seconds, at Normal speed.', 1.43, 0.5, 10),
  ];
}
