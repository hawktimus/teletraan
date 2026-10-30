// The three buttons of the Remote actions page: Restart dashboard, Restart services and Reboot computer.
// Each one writes the action, the time now and the first name of the signed-in user into the page and publishes it.
// The Teletraan computer asks Sanity every 30 seconds and runs the action once, if the request is under 10
// minutes old (computer/scripts/remote-poller.mjs). Reboot asks "Are you sure?" first.
//
// A Studio action is a plain function that Studio calls with the document. sanity.config.js adds these to the
// Remote actions page and no other.

import { createElement, useState } from 'react';
import { useCurrentUser, useDocumentOperation } from 'sanity';
import { remoteActions } from '../schemas/remoteControl.js';

const h = createElement;

// The first word of the name of the signed-in user, letters only. The dataset is public, so nothing more is stored.
export function firstNameOf(user) {
  const name = user && typeof user.name === 'string' ? user.name.trim() : '';
  return (name.split(/\s+/)[0] || '').replace(/[^\p{L}'-]/gu, '').slice(0, 30);
}

// The fields a click sets
export function requestFields(value, user, now = new Date()) {
  return { action: value, requestedAt: now.toISOString(), requestedBy: firstNameOf(user) };
}

const explain = {
  restart_dashboard: 'Restarts the browser that shows the screen. It takes about a minute.',
  restart_services: 'Restarts the services of the Teletraan computer, including the web server. The screen goes blank for a moment.',
  reboot_computer: 'Restarts the whole Teletraan computer. The screen is off for a few minutes.',
};

function makeRemoteAction(choice) {
  const needsConfirm = choice.value === 'reboot_computer';

  function useRemoteAction(props) {
    const { patch, publish } = useDocumentOperation(props.id, props.type);
    const user = useCurrentUser();
    const [asking, setAsking] = useState(false);

    function send() {
      patch.execute([{ set: requestFields(choice.value, user) }]);
      publish.execute();
      props.onComplete();
    }

    return {
      label: choice.title,
      title: explain[choice.value] + ' The computer must be online and reach Sanity. A request older than 10 minutes is ignored.',
      disabled: Boolean(patch.disabled),
      onHandle: () => (needsConfirm ? setAsking(true) : send()),
      dialog: asking && {
        type: 'confirm',
        tone: 'critical',
        message: h('p', null, 'Reboot the Teletraan computer? The screen goes off for a few minutes. At most one reboot is done in 10 minutes.'),
        onCancel: () => { setAsking(false); props.onComplete(); },
        onConfirm: () => { setAsking(false); send(); },
      },
    };
  }
  // Studio and tests/schemas.test.mjs tell actions apart by this name: restartDashboard, restartServices, rebootComputer
  const words = choice.value.split('_');
  useRemoteAction.action = words[0] + words[1].charAt(0).toUpperCase() + words[1].slice(1);
  return useRemoteAction;
}

export const remoteActionButtons = remoteActions.map(makeRemoteAction);
