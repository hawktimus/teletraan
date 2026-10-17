import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { projectId, dataset, studioBasePath } from './project.js';
import { schemaTypes } from './schemas/index.js';
import { publishAllTool } from './tools/publish-all-tool.js';
import { structure, settingsType, singletonTypes, viewType } from './structure.js';
import { addTemplates } from './tools/add-templates.js';
import { screenType } from './inputs/screen-ids.js';
import { useStandardColorsAction } from './tools/team-actions.js';
import { playHiddenActions, usePlayAnnouncementsAction, useRunPresentationTestAction, previewActions } from './tools/actions.js';

// Dashboard Settings, Look and Demo each exist once (singletonTypes in
// structure.js), and so does each of the three Screens, which are three pages of the type screen, and each of
// the four Views, which are four pages of the type view.
// Their pages are made the long-standing way, by removing the
// actions that would copy them or take them away, because Sanity's newer
// singleton option is still in beta. Dashboard Settings also gets a Play button
// for each hidden transition, Play announcements, Run presentation test and a
// Preview button for each look (actions.js).
const removedFromSingletons = ['delete', 'duplicate', 'unpublish'];
const pageTypes = singletonTypes.concat([screenType, viewType]);

const buttonsOf = {
  [settingsType]: playHiddenActions.concat([usePlayAnnouncementsAction, useRunPresentationTestAction], previewActions),
};

function actionsFor(actions, context) {
  if (context.schemaType === 'team') return actions.concat([useStandardColorsAction]);
  if (pageTypes.indexOf(context.schemaType) === -1) return actions;

  const kept = actions.filter(item => removedFromSingletons.indexOf(item.action) === -1);
  return kept.concat(buttonsOf[context.schemaType] || []);
}

// Types with no line in the sidebar are left out of the New menu in the top bar. The screen no
// longer reads Events Calendar entries, so they are not offered anywhere. The Teletraan computer writes the
// status documents (schemas/status.js, calendarStatus.js, frcStatus.js and mondayStatus.js), so nobody adds one by hand.
// Nobody adds a task by hand either: the Teletraan computer makes them from the team's Monday boards, and the
// task documents that exist stay in the dataset under Monday, Items, Old manual tasks.
// A place is offered only while a document is open, which is where the Location field of a task
// offers Create new, and that is how a place is added now. A template of add-templates.js, such
// as Agenda item, is offered by the folder or list that names it, and by nothing else.
const notOffered = ['extraEvent', 'status', 'calendarStatus', 'frcStatus', 'mondayStatus', 'task', 'milestone'].concat(addTemplates.map(template => template.id));
const offeredInDocuments = ['place'];

function newDocumentChoices(templates, context) {
  const inDocument = Boolean(context && context.creationContext && context.creationContext.type === 'document');

  return templates.filter(template => {
    const type = template.templateId;
    if (pageTypes.indexOf(type) !== -1 || notOffered.indexOf(type) !== -1) return false;
    return inDocument || offeredInDocuments.indexOf(type) === -1;
  });
}

export default defineConfig({
  name: 'default',
  title: 'Teletraan I',
  projectId: projectId,
  dataset: dataset,
  ...(studioBasePath ? { basePath: studioBasePath } : {}),
  plugins: [structureTool({ structure: structure })],
  // Publish all is a page of its own in the top bar, next to the editing screen (docs/publish-all.md)
  tools: [publishAllTool],
  schema: { types: schemaTypes, templates: previous => previous.concat(addTemplates) },
  document: {
    actions: actionsFor,
    newDocumentOptions: newDocumentChoices,
  },
});
