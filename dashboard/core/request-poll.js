// The requests the control page and the Studio buttons write into Dashboard Settings (Run presentation test, Play
// announcements, Next look now, Hold this panel and the others) are answered only while they are new: a button
// press counts for a minute. The full read of the content happens every 5 minutes and when Sanity's change stream
// says something changed, and if that stream is not working a press is missed. So these fields alone are asked
// for every 10 seconds, which is cheap, and the screen takes them in when they differ from what it has.

export const requestPollSeconds = 10;

export const requestFields = [
  'announceRequest', 'presentationTestRequest', 'nextLookRequest', 'competitionPreviewRequest', 'previewRequest', 'hiddenRequest',
  'holdPanel', 'holdRow', 'showView', 'previewTheme', 'pauseRotation',
];

export const requestsQuery = '*[_id == "dashboardSettings"][0] { ' + requestFields.join(', ') + ' }';

// The request fields of a settings object (or an answer), each one present, a missing one as null
export function pickRequests(source) {
  const from = source && typeof source === 'object' ? source : {};
  const picked = {};
  requestFields.forEach(name => {
    picked[name] = from[name] === undefined ? null : from[name];
  });
  return picked;
}

export function sameRequests(first, second) {
  return JSON.stringify(pickRequests(first)) === JSON.stringify(pickRequests(second));
}
