// The requests the screen answers: Play announcement, Run presentation test, Next look
// now, Preview competition, the Play buttons of the hidden transitions and the Preview
// buttons. Each one is a hidden field of Dashboard Settings that holds the time it was
// asked for. The screen plays a request that is a minute old at most and that it has not
// played before (docs/hidden-transitions.md).
//
// Two places send them, so the work is written once, here:
//   actions.js     the buttons in the menu beside Publish on Dashboard Settings
//   start-here.js  the buttons on the Start here page
// tests/schemas.test.mjs fails if the two stop writing the same fields.

// The one Dashboard Settings page. These are the same type and id as settingsType and
// settingsId in structure.js. This file cannot import them, because structure.js imports
// the Start here page and the page imports this file. tests/schemas.test.mjs fails if they differ.
export const settingsDocument = { type: 'dashboardSettings', id: 'dashboardSettings' };

// The fields to set for each request. The kind is the id of a hidden transition in
// hidden-transitions.js, or of a preview in previews.js.

export function announceRequest() {
  return { announceRequest: { requestedAt: new Date().toISOString() } };
}

export function presentationTestRequest() {
  return { presentationTestRequest: { requestedAt: new Date().toISOString() } };
}

export function nextLookRequest() {
  return { nextLookRequest: { requestedAt: new Date().toISOString() } };
}

export function competitionPreviewRequest() {
  return { competitionPreviewRequest: { requestedAt: new Date().toISOString() } };
}

export function hiddenRequest(kind) {
  return { hiddenRequest: { kind: kind, requestedAt: new Date().toISOString() } };
}

export function previewRequest(kind) {
  return { previewRequest: { kind: kind, requestedAt: new Date().toISOString() } };
}

// The previews of a theme or a view are the same fields, in the same shape, as the control page writes
// (control/support/requests.js): an id and the time it ends, which a request that is forgotten ends on its own.
// The screen reads them through one function (dashboard/core/screen-requests.js, activeRequests).
function endsAt(now, minutes) {
  return new Date(now.getTime() + minutes * 60000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function previewThemeRequest(theme, minutes, now = new Date()) {
  return { previewTheme: { theme: theme, until: endsAt(now, minutes) } };
}

export function showViewRequest(key, minutes, now = new Date()) {
  return { showView: { key: key, until: endsAt(now, minutes) } };
}

// Back to the schedule: every hold and preview of the control page is cleared
export function backToScheduleRequest() {
  return { holdPanel: { panel: '', until: '' }, showView: { key: '', until: '' }, previewTheme: { theme: '', until: '' }, pauseRotation: { until: '' } };
}

// For an action. patch and publish are the document operations Studio gives it
// (useDocumentOperation). The fields go on the page, then the page is published, which
// also publishes anything else on it that was not published yet.
export function sendWithOperations(patch, publish, fields) {
  patch.execute([{ set: fields }]);
  publish.execute();
}

// For the Start here page. The client is the Studio's own (useClient). The fields go on
// the published page, and nothing else on it is published. It gives back a promise. A page
// that has never been published has nothing to set the fields on, and the promise fails.
export function sendWithClient(client, fields) {
  return client.patch(settingsDocument.id).set(fields).commit();
}
