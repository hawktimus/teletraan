// The Competition page, in the sidebar. It is a page of its own, not a document. It shows when the Teletraan computer
// last read the competition data, the mode of the competition cards (Auto, Always or Off) and one switch for each card.
// Below them is the FRC news section (news-section.js). Dashboard Settings hides these fields. The page writes only the field that is changed, to the draft of Dashboard
// Settings. Publish all in the top bar puts a change on the screen. No stored name changes.
//
// The words that need no Studio are in competition-parts.js. It is written without JSX:
// h(tag, props, ...children) is React's createElement.

import { createElement, useState } from 'react';
import { useClient } from 'sanity';
import dashboardSettings from '../schemas/dashboardSettings.js';
import { styles } from './page-styles.js';
import { useDraftDocument, apiVersion } from './draft-fields.js';
import { fieldRows, saveLine } from './field-editor.js';
import { specsOf, problemWith, changeFor } from './field-editor-parts.js';
import { FrcStatusInput } from './frc-status-input.js';
import { Match13StatusInput } from './match13-status-input.js';
import { words, fieldNames, settingsId } from './competition-parts.js';
import { newsBlock, useNewsSection } from './news-section.js';

const h = createElement;

const specs = specsOf(dashboardSettings.fields, fieldNames);

export function pageOf(model, handlers, newsHandlers) {
  const settings = model.settings;
  let cards;

  if (!settings.read) cards = h('p', { style: styles.muted }, words.reading);
  else if (!settings.doc) cards = h('p', { role: 'alert', style: styles.failed }, words.noSettings);
  else cards = fieldRows(specs, settings.doc, handlers.save, settings.busy, model.problems);

  return h(
    'div',
    { style: styles.page },
    h(
      'div',
      { style: styles.column },
      h('h1', { style: styles.heading }, words.title),
      h('p', { style: styles.text }, words.intro),
      h('div', { 'data-block': 'connection' }, h('h2', { style: styles.subheading }, words.connection), h('p', { style: styles.muted }, words.connectionSays), h(FrcStatusInput, null)),
      h('div', { 'data-block': 'match13' }, h('h2', { style: styles.subheading }, words.match13), h('p', { style: styles.muted }, words.match13Says), h(Match13StatusInput, null)),
      h('div', { 'data-block': 'cards' }, h('h2', { style: styles.subheading }, words.cards), h('p', { style: styles.muted }, words.cardsSays), cards),
      model.news && newsHandlers ? newsBlock(Object.assign({ settings: settings }, model.news), newsHandlers) : null,
      saveLine(settings)
    )
  );
}

export function CompetitionView() {
  const client = useClient({ apiVersion: apiVersion });
  const settings = useDraftDocument(client, settingsId);
  const [problems, setProblems] = useState({});
  const newsSection = useNewsSection(client, settings);

  const handlers = {
    save(spec, value) {
      const problem = problemWith(spec, value);
      setProblems({ [spec.id]: problem });
      if (problem) return;
      const change = changeFor(spec, settings.state.doc, value);
      settings.save(change.set, change.unset);
    },
  };

  return pageOf({ settings: settings.state, problems: problems, news: newsSection.model }, handlers, newsSection.handlers);
}
