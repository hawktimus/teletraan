import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { projectId, dataset } from './project.js';
import { schemaTypes } from './schemas/index.js';
import { publishAllTool } from './publish-all-tool.js';
import { structure, settingsType, demoType, singletonTypes } from './structure.js';
import { useSampleContentAction, useProductionContentAction, useRunDemoAction, useStopDemoAction, playHiddenActions, usePlayAnnouncementsAction, useRunPresentationTestAction, previewActions } from './actions.js';

// Dashboard Settings, Look and Test the screen each exist once (singletonTypes in
// structure.js). Their pages are made the long-standing way, by removing the
// actions that would copy them or take them away, because Sanity's newer
// singleton option is still in beta. Dashboard Settings also gets the two
// buttons that switch the screen between sample and production content, a
// Play button for each hidden transition, Play announcements, Run
// presentation test and a Preview button for each look. Test the screen gets
// Run demo and Stop demo (actions.js).
const removedFromSingletons = ['delete', 'duplicate', 'unpublish'];

const buttonsOf = {
  [settingsType]: [useSampleContentAction, useProductionContentAction].concat(playHiddenActions, [usePlayAnnouncementsAction, useRunPresentationTestAction], previewActions),
  [demoType]: [useRunDemoAction, useStopDemoAction],
};

function actionsFor(actions, context) {
  if (singletonTypes.indexOf(context.schemaType) === -1) return actions;

  const kept = actions.filter(item => removedFromSingletons.indexOf(item.action) === -1);
  return kept.concat(buttonsOf[context.schemaType] || []);
}

function newDocumentChoices(templates) {
  return templates.filter(template => singletonTypes.indexOf(template.templateId) === -1);
}

export default defineConfig({
  name: 'default',
  title: 'Teletraan I',
  projectId: projectId,
  dataset: dataset,
  plugins: [structureTool({ structure: structure })],
  // Publish all is a page of its own in the top bar, next to the editing screen (docs/publish-all.md)
  tools: [publishAllTool],
  schema: { types: schemaTypes },
  document: {
    actions: actionsFor,
    newDocumentOptions: newDocumentChoices,
  },
});
