import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { projectId, dataset } from './project.js';
import { schemaTypes } from './schemas/index.js';
import { publishAllTool } from './publish-all-tool.js';
import { structure, settingsType, singletonTypes } from './structure.js';
import { addTemplates } from './add-templates.js';
import { playHiddenActions, usePlayAnnouncementsAction, useRunPresentationTestAction, previewActions } from './actions.js';

// Dashboard Settings, Look and Demo each exist once (singletonTypes in
// structure.js). Their pages are made the long-standing way, by removing the
// actions that would copy them or take them away, because Sanity's newer
// singleton option is still in beta. Dashboard Settings also gets a Play button
// for each hidden transition, Play announcements, Run presentation test and a
// Preview button for each look (actions.js).
const removedFromSingletons = ['delete', 'duplicate', 'unpublish'];

const buttonsOf = {
  [settingsType]: playHiddenActions.concat([usePlayAnnouncementsAction, useRunPresentationTestAction], previewActions),
};

function actionsFor(actions, context) {
  if (singletonTypes.indexOf(context.schemaType) === -1) return actions;

  const kept = actions.filter(item => removedFromSingletons.indexOf(item.action) === -1);
  return kept.concat(buttonsOf[context.schemaType] || []);
}

// Types with no line in the sidebar are left out of the New menu in the top bar. The screen no
// longer reads Events Calendar entries, so they are not offered anywhere. The Mini writes the
// status documents (schemas/status.js, calendarStatus.js, frcStatus.js and mondayStatus.js), so nobody adds one by hand.
// A place is offered only while a document is open, which is where the Location field of a task
// offers Create new, and that is how a place is added now. A template of add-templates.js, such
// as Pin a task, is offered by the folder or list that names it, and by nothing else.
const notOffered = ['extraEvent', 'status', 'calendarStatus', 'frcStatus', 'mondayStatus'].concat(addTemplates.map(template => template.id));
const offeredInDocuments = ['place'];

function newDocumentChoices(templates, context) {
  const inDocument = Boolean(context && context.creationContext && context.creationContext.type === 'document');

  return templates.filter(template => {
    const type = template.templateId;
    if (singletonTypes.indexOf(type) !== -1 || notOffered.indexOf(type) !== -1) return false;
    return inDocument || offeredInDocuments.indexOf(type) === -1;
  });
}

export default defineConfig({
  name: 'default',
  title: 'Teletraan I',
  projectId: projectId,
  dataset: dataset,
  plugins: [structureTool({ structure: structure })],
  // Publish all is a page of its own in the top bar, next to the editing screen (docs/publish-all.md)
  tools: [publishAllTool],
  schema: { types: schemaTypes, templates: previous => previous.concat(addTemplates) },
  document: {
    actions: actionsFor,
    newDocumentOptions: newDocumentChoices,
  },
});
