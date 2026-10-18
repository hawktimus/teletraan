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
// Dashboard Settings has "Run presentation test" after those. It writes the time now into
// presentationTestRequest and publishes, and the screen runs the sample talk with its six
// sample slides (docs/hidden-transitions.md).
//
// Dashboard Settings ends with the previews: Preview theme (Original, Cybertron, Retro, Foundry), Preview view
// (Robotics, Prime, Nova, Condensed), Preview next season pack and Back to the schedule. A theme or view
// preview writes previewTheme or showView with an end time 10 minutes ahead, the same fields in the same shape
// as the Now showing tab of the control page, so the screen has one way to read both
// (dashboard/core/screen-requests.js). Back to the schedule clears them. The pack preview writes previewRequest
// and the screen holds the pack for 2 minutes (docs/hidden-transitions.md). Each button says in a toast what
// the wall shows and for how long. The old Preview Prime, Nova, Cybertron and Minimal buttons are gone, because
// a team or a style is not something the screen holds any more. Their fields stay in the document.
//
// sanity.config.js adds them to that page and no other.
//
// The Start here page has Play announcement and Run presentation test buttons too. What
// these buttons write is in screen-requests.js, which the page uses as well.
//
// A Studio action is a plain function that Studio calls with the document.
// It gives back a label and what to do when it is clicked.

import { useDocumentOperation } from 'sanity';
import { useToast } from '@sanity/ui';
import { hiddenTransitions } from '../inputs/hidden-transitions.js';
import { previews } from '../inputs/previews.js';
import { previewMinutes, themePreviews, viewPreviews } from '../inputs/look-previews.js';
import { announceRequest, presentationTestRequest, hiddenRequest, previewRequest, previewThemeRequest, showViewRequest, backToScheduleRequest, sendWithOperations } from './screen-requests.js';

// The buttons of the hidden transitions, one for each transition in hidden-transitions.js, so
// adding a transition there adds its button. kind is { id, name, hoursField, chanceField }.
// A button is always allowed, so a second click plays it again. The screen only
// plays a push that is a minute old at most and that it has not played before.
function makePlayHiddenAction(kind) {
  const label = 'Play ' + kind.name.toLowerCase();

  function usePlayHiddenAction(props) {
    const { patch, publish } = useDocumentOperation(props.id, props.type);

    return {
      label: label,
      title: label + ' on the screen. It plays once, at the next page change or within 20 seconds, and only if Allow hidden transitions is on.',
      disabled: Boolean(patch.disabled),
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

  return {
    label: 'Play announcements',
    title: 'Play every announcement that is switched on, one after another, on the screen now. Times and days are ignored. Nothing plays if none is switched on.',
    disabled: Boolean(patch.disabled),
    onHandle: () => {
      sendWithOperations(patch, publish, announceRequest());
      props.onComplete();
    },
  };
}
// Studio and tests/schemas.test.mjs tell actions apart by this name
usePlayAnnouncementsAction.action = 'playAnnouncements';

// The Run presentation test button. Like Play announcements it is always allowed, so a
// second click runs the test again. The screen runs a request that is a minute old at most
// and that it has not run before. What it runs is the talk in the sample content, so
// nothing is chosen here.
export function useRunPresentationTestAction(props) {
  const { patch, publish } = useDocumentOperation(props.id, props.type);

  return {
    label: 'Run presentation test',
    title: 'Run the sample talk on the screen now, with six sample slides. Press the clicker to begin. It needs no internet and only runs if Run presentations is on.',
    disabled: Boolean(patch.disabled),
    onHandle: () => {
      sendWithOperations(patch, publish, presentationTestRequest());
      props.onComplete();
    },
  };
}
// Studio and tests/schemas.test.mjs tell actions apart by this name
useRunPresentationTestAction.action = 'runPresentationTest';

// The pack preview, from previews.js. It is always allowed, so a second click starts it again. The screen only
// starts a request that is a minute old at most and that it has not started before. Nothing is written to the
// settings: the screen holds the pack in memory for 2 minutes.
function makePreviewAction(kind) {
  const label = 'Preview ' + kind.name;

  function usePreviewAction(props) {
    const { patch, publish } = useDocumentOperation(props.id, props.type);
    const toast = useToast();

    return {
      label: label,
      title: 'Show ' + kind.shows + ' on the screen for 2 minutes, then go back to the saved settings. No setting is changed. It starts within about 20 seconds, and waits for an alert, a talk or night mode to be over.',
      disabled: Boolean(patch.disabled),
      onHandle: () => {
        sendWithOperations(patch, publish, previewRequest(kind.id));
        toast.push({ status: 'success', title: 'The wall shows ' + kind.shows + ' for 2 minutes' });
        props.onComplete();
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
    const toast = useToast();

    return {
      label: label,
      title: 'Show the ' + name + ' ' + noun + ' on the screen for ' + previewMinutes + ' minutes, then go back to the schedule. No saved setting is changed. It starts within about 20 seconds, and waits for an alert, a talk or night mode to be over. Back to the schedule ends it at once.',
      disabled: Boolean(patch.disabled),
      onHandle: () => {
        sendWithOperations(patch, publish, fields());
        toast.push({ status: 'success', title: 'The wall shows ' + name + ' for ' + previewMinutes + ' minutes' });
        props.onComplete();
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
  const toast = useToast();

  return {
    label: 'Back to the schedule',
    title: 'End every theme and view preview, and every hold from the control page, now. The screen goes back to its schedule within about 20 seconds.',
    disabled: Boolean(patch.disabled),
    onHandle: () => {
      sendWithOperations(patch, publish, backToScheduleRequest());
      toast.push({ status: 'success', title: 'The wall goes back to its schedule' });
      props.onComplete();
    },
  };
}
// Studio and tests/schemas.test.mjs tell actions apart by this name
useBackToScheduleAction.action = 'backToSchedule';
