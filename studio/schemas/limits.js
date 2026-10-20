// How many characters fit on the screen for each text an editor types. The schemas refuse more than this, and the
// Check the screen page (tools/content-check.js) reads the same numbers, so a limit is changed in this one place.
// Measure the panel again before changing a number, and keep the "Up to N characters fit" sentence of the field in step.
// Only plain values live here: this file imports nothing, so node can load it without the Studio.

export const limits = {
  tickerLine: 52,
  announcementText: 90,
  photoCaption: 36,
  photoCredit: 14,
  personName: 17,
  personRole: 22,
  personLine: 48,
  leadDepartment: 11,
  leadName: 17,
  leadLine: 48,
  leadMember: 12,
  leadMembers: 24,
  spotlightHeadline: 40,
  spotlightText: 100,
  sponsorName: 19,
  sponsorTier: 12,
  sponsorBlurb: 80,
  sponsorThanks: 54,
  planHeading: 26,
  planLocation: 30,
  planRows: 5,
  planRowTime: 9,
  planRowText: 18,
  planRowLead: 10,
  teamName: 20,
  teamNumber: 6,
};

// The Photo panel in the standard layout is 1152 by 708 pixels (main panel in dashboard/base.css) and the screen asks
// Sanity for a photo no wider than 1920 (photoMaxWidth in dashboard/core/images.js). tests/content-check.test.mjs
// compares both with the dashboard.
export const photoPanel = { width: 1152, height: 708, askedWidth: 1920 };

// Text on the screen is read from 20 feet. 4.5 is the usual level for text. Thin lines and big digits need 3. Below 2 a color
// is nearly invisible on the other.
export const contrast = { text: 4.5, large: 3, invisible: 2 };
