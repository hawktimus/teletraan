// Two extra buttons on the Dashboard Settings page, in the menu beside Publish:
// "Use sample content" and "Use production content". Each sets Content source
// and publishes in one click, so the screen follows within about 30 seconds.
// sanity.config.js adds them to the Dashboard Settings page and no other.
//
// A Studio action is a plain function that Studio calls with the document.
// It gives back a label and what to do when it is clicked.

import { useEffect, useState } from 'react';
import { useDocumentOperation } from 'sanity';

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
