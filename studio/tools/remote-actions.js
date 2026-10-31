// The buttons of the Remote actions page, in the menu beside Publish: Restart dashboard, Restart services, Reboot
// computer, Sync now (all, or one source), Show a view, Show a theme, Pause rotation and Resume rotation.
// Each one writes the action, the time now and the first name of the signed-in user into the page and publishes it.
// The Teletraan computer asks Sanity every 30 seconds and runs the action once, if the request is under 10
// minutes old (computer/scripts/remote-poller.mjs). Reboot and Restart services ask "Are you sure?" first.
// Sync now and the two Show buttons open a short list to choose from.
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

// The fields a click sets. extra is { view } or { theme } for the two Show buttons.
export function requestFields(value, user, now = new Date(), extra = {}) {
  return Object.assign({ action: value, requestedAt: now.toISOString(), requestedBy: firstNameOf(user) }, extra);
}

// The choice of an older show request is removed, so a stale view never rides along with another action
export function staleFields(extra = {}) {
  return ['view', 'theme'].filter(name => !Object.hasOwn(extra, name));
}

const explain = {
  restart_dashboard: 'Restarts the browser that shows the screen. It takes about a minute.',
  restart_services: 'Restarts the services of the Teletraan computer, including the web server. The screen goes blank for a moment.',
  reboot_computer: 'Restarts the whole Teletraan computer. The screen is off for a few minutes.',
  sync_now: 'Reads one source, or all of them, now instead of waiting for the timer. One sync a minute at most.',
  show_view: 'Shows one view on the screen for an hour, or goes back to the schedule.',
  show_theme: 'Shows one theme on the screen for an hour, or goes back to the schedule.',
  pause_rotation: 'Stops the pages changing for an hour, or until Resume rotation.',
  resume_rotation: 'Starts the pages changing again.',
};

const question = {
  reboot_computer: 'Reboot the Teletraan computer? The screen goes off for a few minutes. At most one reboot is done in 10 minutes.',
  restart_services: 'Restart the services of the Teletraan computer? The screen goes blank for a moment.',
};

const footer = ' The computer must be online and reach Sanity. A request older than 10 minutes is ignored.';

export const syncChoices = [
  { title: 'All sources', value: 'sync_all' },
  { title: 'Calendars', value: 'sync_calendars' },
  { title: 'Monday', value: 'sync_monday' },
  { title: 'Competition', value: 'sync_competition' },
  { title: 'News', value: 'sync_news' },
  { title: 'Match13', value: 'sync_match13' },
  { title: 'Photos', value: 'sync_photos' },
];

export const viewChoices = [
  { title: 'General', value: 'general' },
  { title: 'Prime', value: 'prime' },
  { title: 'Nova', value: 'nova' },
  { title: 'Family', value: 'family' },
  { title: 'Back to the schedule', value: 'auto' },
];

export const themeChoices = [
  { title: 'Original', value: 'original' },
  { title: 'Cybertron', value: 'cybertron' },
  { title: 'Retro', value: 'retro' },
  { title: 'Foundry', value: 'foundry' },
  { title: 'Back to the schedule', value: 'auto' },
];

// Studio and tests/schemas.test.mjs tell actions apart by this name, such as restartDashboard
function nameOf(words) {
  return words[0] + words.slice(1).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

// One request: the fields go on the page and the page is published
function senderFor(props, patch, publish, user) {
  return function send(value, extra) {
    patch.execute([{ set: requestFields(value, user, new Date(), extra) }, { unset: staleFields(extra) }]);
    publish.execute();
    props.onComplete();
  };
}

// A button for one action, with an "Are you sure?" for the two that interrupt the screen
function makeRemoteAction(choice) {
  function useRemoteAction(props) {
    const { patch, publish } = useDocumentOperation(props.id, props.type);
    const user = useCurrentUser();
    const [asking, setAsking] = useState(false);
    const send = senderFor(props, patch, publish, user);
    const sure = question[choice.value];

    return {
      label: choice.title,
      title: explain[choice.value] + footer,
      disabled: Boolean(patch.disabled),
      onHandle: () => (sure ? setAsking(true) : send(choice.value, {})),
      dialog: asking && {
        type: 'confirm',
        tone: 'critical',
        message: h('p', null, sure),
        onCancel: () => { setAsking(false); props.onComplete(); },
        onConfirm: () => { setAsking(false); send(choice.value, {}); },
      },
    };
  }
  useRemoteAction.action = nameOf(choice.value.split('_'));
  return useRemoteAction;
}

// A button that opens a short list. pick(item) gives the action and the extra fields for the item clicked.
function makeChooser(name, label, key, items, pick) {
  function useChooser(props) {
    const { patch, publish } = useDocumentOperation(props.id, props.type);
    const user = useCurrentUser();
    const [open, setOpen] = useState(false);
    const send = senderFor(props, patch, publish, user);

    const buttons = items.map(item => h('button', {
      key: item.value,
      type: 'button',
      style: { display: 'block', width: '100%', margin: '0 0 8px', padding: '12px 16px', fontSize: '16px', textAlign: 'left', cursor: 'pointer' },
      onClick: () => {
        setOpen(false);
        const chosen = pick(item);
        send(chosen.action, chosen.extra);
      },
    }, item.title));

    return {
      label: label,
      title: explain[key] + footer,
      disabled: Boolean(patch.disabled),
      onHandle: () => setOpen(true),
      dialog: open && {
        type: 'dialog',
        header: label,
        onClose: () => { setOpen(false); props.onComplete(); },
        content: h('div', { style: { padding: '16px' } }, buttons),
      },
    };
  }
  useChooser.action = name;
  return useChooser;
}

const choiceOf = Object.fromEntries(remoteActions.map(choice => [choice.value, choice]));

export const remoteActionButtons = [
  makeRemoteAction(choiceOf.restart_dashboard),
  makeRemoteAction(choiceOf.restart_services),
  makeRemoteAction(choiceOf.reboot_computer),
  makeChooser('syncNow', 'Sync now', 'sync_now', syncChoices, item => ({ action: item.value, extra: {} })),
  makeChooser('showView', 'Show a view', 'show_view', viewChoices, item => ({ action: 'show_view', extra: { view: item.value } })),
  makeChooser('showTheme', 'Show a theme', 'show_theme', themeChoices, item => ({ action: 'show_theme', extra: { theme: item.value } })),
  makeRemoteAction(choiceOf.pause_rotation),
  makeRemoteAction(choiceOf.resume_rotation),
];
