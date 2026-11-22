// Extra buttons in the menu beside Publish, for Dashboard Settings.
//
// It has one button for each hidden transition, "Play desktop reveal" and
// "Play red eyes" (docs/hidden-transitions.md). Each writes the kind and the time
// now into Last push (the Advanced tab) and publishes. The screen plays it once, at
// its next page change or within 20 seconds.
//
// Dashboard Settings has one more button after those, "Play announcements". It writes
// the time now into announceRequest and publishes, and the screen plays every
// announcement that is switched on, once, one after another (docs/hidden-transitions.md).
//
// Dashboard Settings ends with the previews: Preview theme (Original, Cybertron, Retro, Foundry), Preview view
// (Robotics, Prime, Nova, Condensed), Preview next season pack and Back to the schedule. A theme or view
// preview writes previewTheme or showView with an end time 10 minutes ahead, the same fields in the same shape
// as the Now showing tab of the control page, so the screen has one way to read both
// (dashboard/core/screen-requests.js). Back to the schedule clears them. The pack preview writes previewRequest
// and the screen holds the pack for 2 minutes (docs/hidden-transitions.md). Each button says in a dialog what
// the wall shows and for how long. The old Preview Prime, Nova, Cybertron and Minimal buttons are gone, because
// a team or a style is not something the screen holds any more. Their fields stay in the document.
//
// sanity.config.js adds them to that page and no other.
//
// The Start here page has a Play announcement button too. What
// these buttons write is in screen-requests.js, which the page uses as well.
//
// A Studio action is a plain function that Studio calls with the document.
// It gives back a label and what to do when it is clicked.

import { useDocumentOperation, useValidationStatus } from 'sanity';
import { useState } from 'react';
import { hiddenTransitions } from '../inputs/hidden-transitions.js';
import { previews } from '../inputs/previews.js';
import { previewMinutes, themePreviews, viewPreviews } from '../inputs/look-previews.js';
import { announceRequest, hiddenRequest, previewRequest, previewThemeRequest, showViewRequest, backToScheduleRequest, sendWithOperations } from './screen-requests.js';

// Every button here sets a field of the settings page and then publishes it, which also publishes anything else on the page
// that was not published yet. A page with an error in it (a rule the Studio refuses, such as a hidden field with a value
// out of range) could not be published, and the button used to do nothing at all and say nothing. Now it is switched off and
// its hint says why: the page cannot be changed just now, or how many errors have to be fixed first.
function usePlayGate(props, patch) {
  const { validation } = useValidationStatus(props.id, props.type);
  const errors = (Array.isArray(validation) ? validation : []).filter(marker => marker && marker.level === 'error').length;

  if (patch.disabled) return { disabled: true, why: 'This button is off because the page cannot be changed just now (' + String(patch.disabled).toLowerCase().replace(/_/g, ' ') + ').' };
  if (errors > 0) return { disabled: true, why: 'This button is off because the settings page has ' + errors + (errors === 1 ? ' error' : ' errors') + ' that stop it from being published, and every button here publishes it. Fix ' + (errors === 1 ? 'it' : 'them') + ' first: they are marked in red on the page.' };
  return { disabled: false, why: '' };
}

// The buttons of the hidden transitions, one for each transition in hidden-transitions.js, so
// adding a transition there adds its button. kind is { id, name, hoursField, chanceField }.
// A button is always allowed, so a second click plays it again. The screen only
// plays a push that is a minute old at most and that it has not played before.
function makePlayHiddenAction(kind) {
  const label = 'Play ' + kind.name.toLowerCase();

  function usePlayHiddenAction(props) {
    const { patch, publish } = useDocumentOperation(props.id, props.type);
    const gate = usePlayGate(props, patch);

    return {
      label: label,
      title: gate.disabled ? gate.why : label + ' on the screen. It plays once, at the next page change or within 20 seconds, and only if Allow hidden transitions is on.',
      disabled: gate.disabled,
      onHandle: () => {
        sendWithOperations(patch, publish, hiddenRequest(kind.id));
        props.onComplete();
      },
    };
  }
  // Studio and tests/schemas.test.mjs tell actions apart by this name: playDesktop, playRedEyes
  usePlayHiddenAction.action = 'play' + kind.id.charAt(0).toUpperCase() + kind.id.slice(1);
  return usePlayHiddenAction;
}

export const playHiddenActions = hiddenTransitions.map(makePlayHiddenAction);

// The Play announcements button. Like the Play buttons above it is always allowed, so a
// second click plays them again. The screen plays a request that is a minute old at most
// and that it has not played before, and ignores the time and days of each announcement.
// What it plays is the announcements list of this same page, so nothing is chosen here.
export function usePlayAnnouncementsAction(props) {
  const { patch, publish } = useDocumentOperation(props.id, props.type);
    const gate = usePlayGate(props, patch);

  return {
    label: 'Play announcements',
    title: gate.disabled ? gate.why : 'Play every announcement that is switched on, one after another, on the screen now. Times and days are ignored. Nothing plays if none is switched on.',
    disabled: gate.disabled,
    onHandle: () => {
      sendWithOperations(patch, publish, announceRequest());
      props.onComplete();
    },
  };
}
// Studio and tests/schemas.test.mjs tell actions apart by this name
usePlayAnnouncementsAction.action = 'playAnnouncements';

// What each button tells the editor once it has sent its request: a plain dialog, so no extra package is needed.
// The dialog is part of the action; closing it ends the action.
function useNote(onComplete) {
  const [text, setText] = useState('');
  return {
    show: setText,
    dialog: text === '' ? null : { type: 'dialog', header: 'Sent', content: text, onClose: () => { setText(''); onComplete(); } },
  };
}

// The pack preview, from previews.js. It is always allowed, so a second click starts it again. The screen only
// starts a request that is a minute old at most and that it has not started before. Nothing is written to the
// settings: the screen holds the pack in memory for 2 minutes.
function makePreviewAction(kind) {
  const label = 'Preview ' + kind.name;

  function usePreviewAction(props) {
    const { patch, publish } = useDocumentOperation(props.id, props.type);
    const gate = usePlayGate(props, patch);
    const note = useNote(props.onComplete);

    return {
      label: label,
      title: gate.disabled ? gate.why : 'Show ' + kind.shows + ' on the screen for 2 minutes, then go back to the saved settings. No setting is changed. It starts within about 20 seconds, and waits for an alert, a talk or night mode to be over.',
      disabled: gate.disabled,
      dialog: note.dialog,
      onHandle: () => {
        sendWithOperations(patch, publish, previewRequest(kind.id));
        note.show('The wall shows ' + kind.shows + ' for 2 minutes');
      },
    };
  }
  // Studio and tests/schemas.test.mjs tell actions apart by this name: previewNextPack
  usePreviewAction.action = 'preview' + kind.id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  return usePreviewAction;
}

export const previewActions = previews.filter(kind => kind.id === 'next-pack').map(kind => makePreviewAction({ id: kind.id, name: 'next season pack', shows: 'the next season pack in the list' }));

// One button for each theme and each view. They write what the control page writes. The write goes the way the
// Play buttons above go: the fields are set on the page and the page is published, so the wall gets them at once
// (it asks for them every 10 seconds). The screen swaps to the theme or the view within about 20 seconds.
function makeLookAction(kind, noun, id, name, fields) {
  const label = 'Preview ' + noun + ': ' + name;

  function useLookAction(props) {
    const { patch, publish } = useDocumentOperation(props.id, props.type);
    const gate = usePlayGate(props, patch);
    const note = useNote(props.onComplete);

    return {
      label: label,
      title: gate.disabled ? gate.why : 'Show the ' + name + ' ' + noun + ' on the screen for ' + previewMinutes + ' minutes, then go back to the schedule. No saved setting is changed. It starts within about 20 seconds, and waits for an alert, a talk or night mode to be over. Back to the schedule ends it at once.' + (noun === 'view' ? ' A view with no data cannot show: Condensed has only Monday cards, so it stays on the schedule while no Monday task is on the TV, and the Now showing tab of the control page says so.' : ''),
      disabled: gate.disabled,
      dialog: note.dialog,
      onHandle: () => {
        sendWithOperations(patch, publish, fields());
        note.show('The wall shows ' + name + ' for ' + previewMinutes + ' minutes');
      },
    };
  }
  // Studio and tests/schemas.test.mjs tell actions apart by this name: previewThemeCybertron, previewViewNova
  useLookAction.action = 'preview' + noun.charAt(0).toUpperCase() + noun.slice(1) + id.charAt(0).toUpperCase() + id.slice(1);
  return useLookAction;
}

export const previewThemeActions = themePreviews.map(theme => makeLookAction(theme, 'theme', theme.id, theme.name, () => previewThemeRequest(theme.id, previewMinutes)));
export const previewViewActions = viewPreviews.map(view => makeLookAction(view, 'view', view.key, view.name, () => showViewRequest(view.key, previewMinutes)));

export function useBackToScheduleAction(props) {
  const { patch, publish } = useDocumentOperation(props.id, props.type);
    const gate = usePlayGate(props, patch);
  const note = useNote(props.onComplete);

  return {
    label: 'Back to the schedule',
    title: gate.disabled ? gate.why : 'End every theme and view preview, and every hold from the control page, now. The screen goes back to its schedule within about 20 seconds.',
    disabled: gate.disabled,
    dialog: note.dialog,
    onHandle: () => {
      sendWithOperations(patch, publish, backToScheduleRequest());
      note.show('The wall goes back to its schedule');
    },
  };
}
// Studio and tests/schemas.test.mjs tell actions apart by this name
useBackToScheduleAction.action = 'backToSchedule';
