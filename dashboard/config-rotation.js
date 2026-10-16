// The one ordered list of the rotation, and the Robotics view (part of config.js, docs/views.md).
//
// rotationViews are the three views a row of the list can name. The stored view document keeps the key general, so
// robotics is its other name and rotationAliases says so. An old address or a stored value that says general still works.
export const rotationViews = ['robotics', 'prime', 'nova'];
export const rotationAliases = { general: 'robotics', family: 'robotics' };
export const rotationKeyOfView = { robotics: 'general', prime: 'prime', nova: 'nova' };

// The words the Robotics banner and team plate carry. There is no team number on the view.
export const roboticsTitle = 'HAWKTIMUS ROBOTICS';
export const roboticsPlate = ['TWO TEAMS', 'ONE FAMILY'];
// The title the General view had before Robotics. A stored title that is still this one reads as the new title.
export const olderGeneralTitle = 'Hawktimus Dashboard';

// transitionSeconds scales the whole panel and view transition (core/rotation.js, transitionSecondsOf)
export const transitionSecondsRange = { min: 2, max: 4, start: 3 };

// The panels that are drawn as a title and a dashed inner frame, so they can be placed in the list before they are designed
export const placeholderPanels = { robotStatus: 'ROBOT STATUS', wireframe: '3D VIEW' };

// Design and CNC are one department on the screen. Business, Operations and Marketing are for both teams.
export const designDepartment = 'DESIGN · CNC';
export const bothTeamDepartments = ['business', 'operations', 'marketing'];

// Rosters come from the Monday board and page at this many rows
export const rosterPageRows = 6;

// The Robotics view has two layouts, chosen for each row by its panel. wide is the bar layout (the countdown in the banner,
// the side column at the left) and every other panel is split (the main panel at the left, the countdown at the top right and
// Panel B at the bottom right, which is the standard layout).
export const roboticsWidePanels = [
  'monday-tasks', 'monday-done', 'monday-status-depts', 'monday-overall', 'monday-timeline', 'monday-board', 'roster',
  'robotStatus', 'wireframe',
];
