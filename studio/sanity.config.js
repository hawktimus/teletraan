import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { projectId, dataset } from './project.js';
import { schemaTypes } from './schemas/index.js';
import { structure, settingsType, demoType, singletonTypes } from './structure.js';
import { useSampleContentAction, useProductionContentAction, useRunDemoAction, useStopDemoAction, playHiddenActions } from './actions.js';

// Dashboard Settings, Theme and Demo each exist once (singletonTypes in
// structure.js). Their pages are made the long-standing way, by removing the
// actions that would copy them or take them away, because Sanity's newer
// singleton option is still in beta. Dashboard Settings also gets the two
// buttons that switch the screen between sample and production content, and a
// Play button for each hidden transition. Demo gets Run demo and Stop demo
// (actions.js).
const removedFromSingletons = ['delete', 'duplicate', 'unpublish'];

const buttonsOf = {
  [settingsType]: [useSampleContentAction, useProductionContentAction].concat(playHiddenActions),
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
  schema: { types: schemaTypes },
  document: {
    actions: actionsFor,
    newDocumentOptions: newDocumentChoices,
  },
});
