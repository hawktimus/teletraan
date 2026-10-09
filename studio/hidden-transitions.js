// The hidden transitions the Dashboard Settings page can play now. This is a copy
// of the ids, names and hours and chance fields in dashboard/core/hidden-transitions.js. The
// Studio is built on its own and cannot read files from the dashboard folder, so
// the list is written out here too. check-schemas.mjs fails if they differ, so
// change both when you add one (docs/hidden-transitions.md).
//
// id          what is stored in hiddenRequest.kind
// name        the words on the Play button: "Play " and the name in lower case
// hoursField  the Dashboard Settings field that holds how many hours of screen time it comes about once in, in the Advanced tab
// chanceField the older field that holds its chance as a percent. It is hidden, and a page saved before the hours existed still uses it

export const hiddenTransitions = [
  { id: 'desktop', name: 'Desktop reveal', hoursField: 'desktopEveryHours', chanceField: 'desktopChance' },
  { id: 'redEyes', name: 'Red eyes', hoursField: 'redEyesEveryHours', chanceField: 'redEyesChance' },
];
