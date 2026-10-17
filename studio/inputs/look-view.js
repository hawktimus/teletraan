// The Look page, in the sidebar. It is a page of its own, not a document. It is the one place for how the screen
// looks: the theme of each day of the week, the background, the seasonal decorations, motion, frame polish, the logo
// and name effects, and an Advanced fold for what is rarely touched. Dashboard Settings hides the fields it shows.
//
// It writes only what it shows, and only to drafts: the fields of Dashboard Settings to its draft, and the
// switch for the pieces over the panels to the draft of the Look document. Publish all in the top bar puts a change
// on the screen. No stored name changes. The dated rules and the subthemes are lists, and the page links to them.
//
// The theme list, the weekday pickers and the background choices are the ones of themes-view.js. The words that need
// no Studio are in look-parts.js. It is written without JSX: h(tag, props, ...children) is React's createElement.

import { createElement, useState } from 'react';
import { useClient } from 'sanity';
import { usePaneRouter } from 'sanity/structure';
import dashboardSettings from '../schemas/dashboardSettings.js';
import lookDocument from '../schemas/theme.js';
import { styles } from './page-styles.js';
import { useDraftDocument, apiVersion } from './draft-fields.js';
import { fieldRows, saveLine } from './field-editor.js';
import { specsOf, problemWith, changeFor } from './field-editor-parts.js';
import { themeList, dayRow, backgroundBlock } from './themes-view.js';
import { themeWeekdays, tidyThemeByWeekday } from './theme-ids.js';
import { backgroundIds } from './background-ids.js';
import { sections, words, links, settingsId, lookId } from './look-parts.js';

const h = createElement;

function specsFor(section, fields) {
  return specsOf(fields, section.fields || section.lookFields);
}

function sectionBlock(section, children, extra) {
  return h(
    'div',
    { key: section.id, 'data-block': section.id },
    h('h2', { style: styles.subheading }, section.title),
    h('p', { style: styles.muted }, section.says),
    children,
    extra
  );
}

function linkList(model, ids) {
  if (!model.ChildLink) return null;
  return h(
    'ul',
    { style: styles.list, 'data-list': 'links' },
    links.filter(link => ids.indexOf(link.id) !== -1).map(link => h('li', { key: link.id }, h(model.ChildLink, { childId: link.id }, link.label), ' ' + link.says))
  );
}

// The page for what it knows. model.settings and model.look are the states of the two documents.
export function pageOf(model, handlers) {
  const settings = model.settings;
  const busy = settings.busy;
  let body;

  if (!settings.read) body = h('p', { style: styles.muted }, words.reading);
  else if (!settings.doc) body = h('p', { role: 'alert', style: styles.failed }, words.noSettings);
  else {
    const doc = settings.doc;
    const schedule = tidyThemeByWeekday(doc.themeByWeekday);
    const background = backgroundIds.indexOf(doc.background) !== -1 ? doc.background : 'sweep';
    const rows = section => fieldRows(specsFor(section, dashboardSettings.fields), doc, handlers.saveSetting, busy, model.problems);
    const byId = id => sections.filter(section => section.id === id)[0];

    const seasonal = byId('seasonal');
    const seasonRows = model.look.doc
      ? fieldRows(specsFor(seasonal, lookDocument.fields), model.look.doc, handlers.saveLook, model.look.busy, model.problems)
      : [h('p', { key: 'nolook', style: styles.muted }, model.look.read ? words.noLook : words.reading)];

    body = [
      sectionBlock(byId('theme'), h('div', null, h('p', { style: styles.muted }, words.schedule), themeList(), themeWeekdays.map(day => dayRow(day, schedule, handlers.changeDay, busy)))),
      sectionBlock(byId('background'), backgroundBlock({ background: background, busy: busy }, handlers.changeBackground)),
      sectionBlock(seasonal, seasonRows, linkList(model, ['rules', 'subthemes'])),
      sectionBlock(byId('motion'), rows(byId('motion'))),
      sectionBlock(byId('polish'), rows(byId('polish'))),
      sectionBlock(byId('logo'), rows(byId('logo'))),
      h(
        'details',
        { key: 'advanced', style: styles.details, 'data-block': 'advanced' },
        h('summary', { style: styles.summary }, byId('advanced').title),
        h('p', { style: styles.muted }, byId('advanced').says),
        rows(byId('advanced')),
        linkList(model, ['rules'])
      ),
    ];
  }

  return h(
    'div',
    { style: styles.page },
    h('div', { style: styles.column }, h('h1', { style: styles.heading }, 'Look'), h('p', { style: styles.text }, words.intro), body, saveLine(settings), saveLine(model.look))
  );
}

export function LookView() {
  const client = useClient({ apiVersion: apiVersion });
  const paneRouter = usePaneRouter();
  const settings = useDraftDocument(client, settingsId);
  const look = useDraftDocument(client, lookId, words.noLook);
  const [problems, setProblems] = useState({});

  const handlers = {
    saveSetting(spec, value) {
      const problem = problemWith(spec, value);
      setProblems({ [spec.id]: problem });
      if (problem) return;
      const change = changeFor(spec, settings.state.doc, value);
      settings.save(change.set, change.unset);
    },

    saveLook(spec, value) {
      const problem = problemWith(spec, value);
      setProblems({ [spec.id]: problem });
      if (problem) return;
      const change = changeFor(spec, look.state.doc, value);
      look.save(change.set, change.unset);
    },

    changeDay(day, theme) {
      const schedule = Object.assign({}, tidyThemeByWeekday(settings.state.doc && settings.state.doc.themeByWeekday), { [day]: theme });
      settings.save({ themeByWeekday: schedule });
    },

    changeBackground(background) {
      settings.save({ background: background });
    },
  };

  const model = { settings: settings.state, look: look.state, problems: problems, ChildLink: paneRouter && paneRouter.ChildLink };
  return pageOf(model, handlers);
}

