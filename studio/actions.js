// Extra buttons in the menu beside Publish, for two pages.
//
// Dashboard Settings has "Use sample content" and "Use production content".
// Each sets Content source and publishes in one click, so the screen follows
// within about 30 seconds.
//
// Demo has "Run demo" and "Stop demo". Run demo writes the time now into
// Requested at and publishes, and the screen plays the demo within a few
// seconds. Stop demo clears Requested at and publishes.
//
// Dashboard Settings also has one button for each hidden transition, "Play
// desktop reveal" and "Play red eyes" (docs/hidden-transitions.md). Each writes
// the kind and the time now into Last push (the Hidden tab) and publishes. The
// screen plays it once, at its next page change or within 20 seconds.
//
// Dashboard Settings has one more button after those, "Play announcements". It writes
// the time now into announceRequest and publishes, and the screen plays every
// announcement that is switched on, once, one after another (docs/hidden-transitions.md).
//
// sanity.config.js adds each set to its own page and no other.
//
// A Studio action is a plain function that Studio calls with the document.
// It gives back a label and what to do when it is clicked.

import { useEffect, useState } from 'react';
import { useDocumentOperation } from 'sanity';
import { hiddenTransitions } from './hidden-transitions.js';

// What the screen shows for a settings document, by the same rule as
// pickSource in dashboard/core/source.js: sample, until the switch back time
function sourceOnScreen(settings) {
  if (settings.contentSource !== 'sample') return 'production';

  const switchBack = settings.switchBackAt ? new Date(settings.switchBackAt) : null;
  return switchBack && switchBack <= new Date() ? 'production' : 'sample';
}

// Used for both buttons. source is 'sample' or 'production'.
function useSwitchSource(props, source, label) {
  const { patch, publish } = useDocumentOperation(props.id, props.type);
  const [working, setWorking] = useState(false);

  // The draft when there is one, otherwise what is published. A draft means
  // there is something to publish, so the button stays on.
  const current = props.draft || props.published || {};
  const alreadyDone = !props.draft && sourceOnScreen(current) === source;

  // Publishing removes the draft. That is the signal that the job is done.
  useEffect(() => {
    if (working && !props.draft) setWorking(false);
  }, [props.draft, alreadyDone]);

  return {
    label: working ? 'Switching...' : label,
    title: alreadyDone ? 'The screen is already using ' + source + ' content.' : label,
    disabled: working || alreadyDone || Boolean(patch.disabled),
    onHandle: () => {
      setWorking(true);
      patch.execute(patchesFor(source, current));
      publish.execute();
      props.onComplete();
    },
  };
}

// The change to make. A switch back time that has already passed is cleared
// when the sample is switched on. Left in, the screen would show production
// straight away and the button would seem to do nothing.
function patchesFor(source, current) {
  const patches = [{ set: { contentSource: source } }];
  const timeHasPassed = sourceOnScreen({ contentSource: 'sample', switchBackAt: current.switchBackAt }) === 'production';

  if (source === 'sample' && timeHasPassed) patches.push({ unset: ['switchBackAt'] });
  return patches;
}

export function useSampleContentAction(props) {
  return useSwitchSource(props, 'sample', 'Use sample content');
}
// Studio and check-schemas.mjs tell actions apart by this name
useSampleContentAction.action = 'useSampleContent';

export function useProductionContentAction(props) {
  return useSwitchSource(props, 'production', 'Use production content');
}
useProductionContentAction.action = 'useProductionContent';

// The Demo page's two buttons (docs/demo.md). Neither keeps any state: Run demo
// is always allowed, so a second click starts the demo again, and Stop demo is
// off only when there is no request to clear.

export function useRunDemoAction(props) {
  const { patch, publish } = useDocumentOperation(props.id, props.type);

  return {
    label: 'Run demo',
    title: 'Play the demo on the screen now. It plays once, then the screen goes back to normal.',
    disabled: Boolean(patch.disabled),
    onHandle: () => {
      patch.execute([{ set: { requestedAt: new Date().toISOString() } }]);
      publish.execute();
      props.onComplete();
    },
  };
}
useRunDemoAction.action = 'runDemo';

export function useStopDemoAction(props) {
  const { patch, publish } = useDocumentOperation(props.id, props.type);

  // A request that is in the draft or in the published page is something to clear
  const asked = Boolean((props.draft && props.draft.requestedAt) || (props.published && props.published.requestedAt));

  return {
    label: 'Stop demo',
    title: asked ? 'Stop the demo on the screen now.' : 'No demo has been asked for.',
    disabled: !asked || Boolean(patch.disabled),
    onHandle: () => {
      patch.execute([{ unset: ['requestedAt'] }]);
      publish.execute();
      props.onComplete();
    },
  };
}
useStopDemoAction.action = 'stopDemo';

// The Hidden tab's buttons, one for each transition in hidden-transitions.js, so
// adding a transition there adds its button. kind is { id, name, chanceField }.
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
        patch.execute([{ set: { hiddenRequest: { kind: kind.id, requestedAt: new Date().toISOString() } } }]);
        publish.execute();
        props.onComplete();
      },
    };
  }
  // Studio and check-schemas.mjs tell actions apart by this name: playDesktop, playRedEyes
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
      patch.execute([{ set: { announceRequest: { requestedAt: new Date().toISOString() } } }]);
      publish.execute();
      props.onComplete();
    },
  };
}
// Studio and check-schemas.mjs tell actions apart by this name
usePlayAnnouncementsAction.action = 'playAnnouncements';
