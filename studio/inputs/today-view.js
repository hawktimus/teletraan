// The Today page, in the sidebar. It is a page of its own, not a document. It holds everything that puts a message on
// the TV today: the alert, the announcements on the bar under the banner, and the full screen messages that play at
// set times. Under them are links to the agenda, the booked talks and the meeting days.
//
// It writes only what it shows, and only to drafts: the alert and the full screen messages to the draft of
// Dashboard Settings, and an announcement to the draft of that announcement. Publish all in the top bar puts a
// change on the screen. Nothing stored is renamed.
//
// The words that need no Studio are in today-parts.js. It is written without JSX, so it reads as plain JavaScript:
// h(tag, props, ...children) is React's createElement.

import { createElement, useEffect, useState } from 'react';
import { useClient } from 'sanity';
import { usePaneRouter } from 'sanity/structure';
import dashboardSettings from '../schemas/dashboardSettings.js';
import announcementType from '../schemas/announcement.js';
import { styles } from './page-styles.js';
import { useDraftDocument, saveDraftFields, apiVersion, words as draftWords } from './draft-fields.js';
import { fieldRows, saveLine, choiceButtons } from './field-editor.js';
import { specsOf, specOf, problemWith, changeFor } from './field-editor-parts.js';
import {
  sections,
  words,
  links,
  weekdays,
  cardsFrom,
  newAnnouncementFields,
  applyToDocuments,
  timedRowsFrom,
  blankTimedRow,
  withRow,
  withoutRow,
  withDay,
  rowTitle,
  announcementChildPrefix,
} from './today-parts.js';

const h = createElement;

const settingsId = 'dashboardSettings';

// The rows come from the fields of the schema, so a title, a description and a limit are written once
const settingsFields = dashboardSettings.fields;
const timedFields = settingsFields.filter(field => field.name === 'announcements')[0].of[0].fields;
const alertSpecs = specsOf(settingsFields, ['alert.on', 'alert.headline', 'alert.message', 'alert.until']);
const timedNames = ['time', 'title', 'followUp', 'titleSeconds', 'followUpSeconds'];
const cardNames = ['text', 'start', 'end'];

const levelSpec = specOf(announcementType.fields, 'level');

// The text of a new announcement is checked as the field checks it
const textSpec = specOf(announcementType.fields, 'text', 'new-');

function section(title, says, children, name) {
  return h('div', { 'data-block': name, key: name }, h('h2', { style: styles.subheading }, title), h('p', { style: styles.muted }, says), children);
}

// A text box and a button that make something new
function addForm(name, label, button, value, onType, onAdd, problem) {
  return h(
    'div',
    { style: styles.card, 'data-form': name },
    h('label', { htmlFor: name + '-text', style: styles.label }, label),
    h('input', { id: name + '-text', type: 'text', value: value, style: styles.input, onChange: event => onType(event.target.value), onKeyDown: event => { if (event.key === 'Enter') onAdd(); } }),
    problem ? h('p', { role: 'alert', style: styles.failed }, problem) : null,
    h('p', null, h('button', { type: 'button', style: styles.button, onClick: onAdd }, button))
  );
}

function teamChoice(card, teams, onTeam) {
  return h(
    'div',
    { style: styles.field, 'data-field': 'team' },
    h('label', { htmlFor: 'team-' + card.id, style: styles.label }, words.teamLabel),
    h(
      'select',
      { id: 'team-' + card.id, value: card.team, style: styles.select, onChange: event => onTeam(card, event.target.value) },
      h('option', { value: '' }, words.noTeam),
      teams.map(team => h('option', { key: team._id, value: team._id }, team.name || 'Team with no name'))
    )
  );
}

function card(item, model, handlers) {
  const document = item.document;
  const specs = specsOf(announcementType.fields, cardNames, 'card-' + item.id + '-');
  const level = Object.assign({}, levelSpec, { id: 'card-' + item.id + '-level' });
  const link = model.ChildLink ? h(model.ChildLink, { childId: announcementChildPrefix + item.id }, words.openForm) : null;

  return h(
    'div',
    { key: item.id, style: styles.card, 'data-card': item.id },
    h('p', { style: styles.label }, item.text || 'Announcement with no text', item.standing ? ' (' + item.standing + ')' : ''),
    fieldRows(specs, document, (spec, value) => handlers.saveCard(item, spec, value), model.plate.busy, model.plate.problems),
    teamChoice(item, model.plate.teams, handlers.saveTeam),
    fieldRows([level], document, (spec, value) => handlers.saveCard(item, spec, value), model.plate.busy, model.plate.problems),
    link ? h('p', null, link) : null
  );
}

function plateSection(model, handlers) {
  const cards = model.plate.cards;
  const body = [];
  body.push(addForm('plate', 'Text of a new announcement. Up to 90 characters.', words.newPlate, model.plate.typed, handlers.typePlate, handlers.addPlate, model.plate.problems[textSpec.id]));
  if (!model.plate.read) body.push(h('p', { key: 'reading', style: styles.muted }, words.reading));
  else if (cards.current.length === 0) body.push(h('p', { key: 'none', style: styles.muted }, words.noPlate));
  body.push(cards.current.map(item => card(item, model, handlers)));
  if (cards.past.length > 0) {
    body.push(h('details', { key: 'past', style: styles.details, 'data-block': 'past' }, h('summary', { style: styles.summary }, words.pastTitle + ' (' + cards.past.length + ')'), cards.past.map(item => card(item, model, handlers))));
  }
  return section(sections.plate.title, sections.plate.says, body, 'plate');
}

function daysRow(row, onDay, busy, problem) {
  return h(
    'fieldset',
    { style: styles.fieldset, 'data-field': 'days' },
    h('legend', { style: styles.label }, words.daysLabel),
    h('span', { style: styles.help }, words.daysHelp),
    choiceButtons({
      name: 'days',
      label: words.daysLabel,
      multiple: true,
      disabled: busy,
      items: weekdays.map(day => ({ key: String(day.value), label: day.title, checked: (row.days || []).indexOf(day.value) !== -1, onPick: checked => onDay(row, day.value, checked) })),
    }),
    problem ? h('span', { role: 'alert', style: styles.failed }, problem) : null
  );
}

function timedCard(row, model, handlers) {
  const specs = specsOf(timedFields, timedNames, 'row-' + row._key + '-');
  const show = specOf(timedFields, 'show', 'row-' + row._key + '-');
  const busy = model.settings.busy;

  return h(
    'div',
    { key: row._key, style: styles.card, 'data-card': row._key },
    h('p', { style: styles.label }, rowTitle(row), row.show === false ? ' (off)' : ''),
    fieldRows(specs, row, (spec, value) => handlers.saveTimed(row, spec, value), busy, model.timedProblems),
    daysRow(row, handlers.tickDay, busy, model.timedProblems['days-' + row._key]),
    fieldRows([show], row, (spec, value) => handlers.saveTimed(row, spec, value), busy, model.timedProblems),
    h('p', null, h('button', { type: 'button', style: styles.button, disabled: busy, onClick: () => handlers.removeTimed(row) }, words.removeTimed))
  );
}

function newTimedForm(model, handlers) {
  const draft = model.newTimed;
  const specs = specsOf(timedFields, ['time', 'title', 'followUp'], 'new-timed-');
  return h(
    'div',
    { style: styles.card, 'data-form': 'timed' },
    h('p', { style: styles.label }, words.newTimed),
    fieldRows(specs, draft, handlers.typeTimed, false, model.timedProblems),
    h('p', null, h('button', { type: 'button', style: styles.button, onClick: handlers.addTimed }, words.newTimed))
  );
}

function timedSection(model, handlers) {
  let body;
  if (!model.settings.read) body = h('p', { style: styles.muted }, draftWords.reading);
  else if (!model.settings.doc) body = h('p', { role: 'alert', style: styles.failed }, words.noSettings);
  else {
    const rows = timedRowsFrom(model.settings.doc);
    body = [newTimedForm(model, handlers)].concat(rows.length === 0 ? [h('p', { key: 'none', style: styles.muted }, words.noTimed)] : rows.map(row => timedCard(row, model, handlers)));
  }
  return section(sections.timed.title, sections.timed.says, body, 'timed');
}

function alertSection(model, handlers) {
  let body;
  if (!model.settings.read) body = h('p', { style: styles.muted }, draftWords.reading);
  else if (!model.settings.doc) body = h('p', { role: 'alert', style: styles.failed }, words.noSettings);
  else body = fieldRows(alertSpecs, model.settings.doc, handlers.saveAlert, model.settings.busy, model.problems);
  return section(sections.alert.title, sections.alert.says, body, 'alert');
}

function linksSection(model) {
  const items = links.map(link =>
    h('li', { key: link.id }, model.ChildLink ? h(model.ChildLink, { childId: link.id }, link.label) : link.label, ' ' + link.says)
  );
  return section(sections.links.title, sections.links.says, h('ul', { style: styles.list, 'data-list': 'links' }, items), 'links');
}

// The page for what it knows. model.ChildLink is the link that opens a list in the next pane.
export function pageOf(model, handlers) {
  return h(
    'div',
    { style: styles.page },
    h(
      'div',
      { style: styles.column },
      h('h1', { style: styles.heading }, 'Today'),
      h('p', { style: styles.text }, 'Everything that puts a message on the TV today. Change it here, then click Publish all in the top bar.'),
      alertSection(model, handlers),
      plateSection(model, handlers),
      timedSection(model, handlers),
      linksSection(model),
      saveLine(model.settings),
      saveLine(model.plate)
    )
  );
}

export function TodayView() {
  const client = useClient({ apiVersion: apiVersion });
  const paneRouter = usePaneRouter();
  const settings = useDraftDocument(client, settingsId);
  const [plate, setPlate] = useState({ read: false, documents: [], teams: [], typed: '', busy: false, text: '', failed: false, problems: {} });
  const [problems, setProblems] = useState({});
  const [timedProblems, setTimedProblems] = useState({});
  const [newTimed, setNewTimed] = useState({});

  useEffect(() => {
    let stopped = false;

    Promise.resolve()
      .then(() => Promise.all([
        client.fetch('*[_type == "announcement"] | order(start desc)[0...80]', {}, { perspective: 'raw' }),
        client.fetch('*[_type == "team"] | order(order asc, name asc) { _id, name, active }', {}, { perspective: 'published' }),
      ]))
      .then(found => {
        if (!stopped) setPlate(previous => Object.assign({}, previous, { read: true, documents: found[0] || [], teams: (found[1] || []).filter(team => team.active !== false) }));
      })
      .catch(() => {
        if (!stopped) setPlate(previous => Object.assign({}, previous, { read: true }));
      });
    return () => {
      stopped = true;
    };
  }, []);

  function sayPlate(patch) {
    setPlate(previous => Object.assign({}, previous, patch));
  }

  function writeCard(id, fields, unset) {
    sayPlate({ busy: true, text: '', failed: false, documents: applyToDocuments(plate.documents, id, fields, unset) });
    return saveDraftFields(client, id, fields, words.missing, unset)
      .then(() => sayPlate({ busy: false, text: draftWords.saved }))
      .catch(error => sayPlate({ busy: false, failed: true, text: draftWords.problem + (error && error.message ? error.message : '') }));
  }

  const handlers = {
    saveAlert(spec, value) {
      const problem = problemWith(spec, value);
      setProblems({ [spec.id]: problem });
      if (problem) return;
      const change = changeFor(spec, settings.state.doc, value);
      settings.save(change.set, change.unset);
    },

    saveCard(item, spec, value) {
      const name = spec.path[0];
      let problem = problemWith(spec, value);
      if (!problem && name === 'end' && item.start && value && Date.parse(value) <= Date.parse(item.start)) problem = 'The end must be after the start.';
      if (!problem && name === 'start' && item.end && value && Date.parse(item.end) <= Date.parse(value)) problem = 'The start must be before the end.';
      sayPlate({ problems: { [spec.id]: problem } });
      if (problem) return;
      const change = changeFor(spec, item.document, value);
      writeCard(item.id, change.set, change.unset);
    },

    saveTeam(item, teamId) {
      if (teamId) writeCard(item.id, { team: { _type: 'reference', _ref: teamId } });
      else writeCard(item.id, {}, ['team']);
    },

    typePlate(text) {
      sayPlate({ typed: text });
    },

    addPlate() {
      const problem = problemWith(textSpec, plate.typed);
      sayPlate({ problems: { [textSpec.id]: problem || (plate.typed ? '' : words.textFirst) } });
      if (problem || !plate.typed) return;

      const fields = newAnnouncementFields(Date.now());
      fields.text = plate.typed;
      sayPlate({ busy: true, text: '', failed: false, typed: '' });
      client
        .createIfNotExists(fields)
        .then(() => sayPlate({ busy: false, text: draftWords.saved, documents: [fields].concat(plate.documents.filter(doc => doc._id !== fields._id)) }))
        .catch(error => sayPlate({ busy: false, failed: true, text: draftWords.problem + (error && error.message ? error.message : ''), typed: plate.typed }));
    },

    saveTimed(row, spec, value) {
      const problem = problemWith(spec, value);
      setTimedProblems({ [spec.id]: problem });
      if (problem) return;
      const rows = withRow(timedRowsFrom(settings.state.doc), row._key, changeFor(spec, row, value));
      settings.save({ announcements: rows });
    },

    tickDay(row, day, ticked) {
      const days = withDay(row.days, day, ticked);
      const problem = days.length === 0 ? words.tickADay : '';
      setTimedProblems({ ['days-' + row._key]: problem });
      if (problem) return;
      settings.save({ announcements: withRow(timedRowsFrom(settings.state.doc), row._key, { set: { days: days }, unset: [] }) });
    },

    typeTimed(spec, value) {
      setNewTimed(previous => Object.assign({}, previous, { [spec.path[0]]: value }));
    },

    addTimed() {
      const checks = specsOf(timedFields, ['time', 'title', 'followUp'], 'new-timed-');
      const found = {};
      checks.forEach(spec => {
        const problem = problemWith(spec, newTimed[spec.path[0]]);
        if (problem) found[spec.id] = problem;
      });
      setTimedProblems(found);
      if (Object.keys(found).length > 0) return;

      const row = Object.assign(blankTimedRow(), newTimed);
      settings.save({ announcements: timedRowsFrom(settings.state.doc).concat([row]) });
      setNewTimed({});
    },

    removeTimed(row) {
      settings.save({ announcements: withoutRow(timedRowsFrom(settings.state.doc), row._key) });
    },
  };

  const cards = cardsFrom(plate.documents);
  const model = {
    settings: settings.state,
    plate: Object.assign({}, plate, { cards: cards }),
    problems: problems,
    timedProblems: timedProblems,
    newTimed: newTimed,
    ChildLink: paneRouter && paneRouter.ChildLink,
  };
  return pageOf(model, handlers);
}
