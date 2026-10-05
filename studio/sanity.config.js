import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { projectId, dataset } from './project.js';
import { schemaTypes } from './schemas/index.js';
import { structure, settingsType, singletonTypes } from './structure.js';
import { useSampleContentAction, useProductionContentAction } from './actions.js';

// Dashboard Settings and Theme each exist once (singletonTypes in structure.js).
// Their pages are made the long-standing way, by removing the actions that
// would copy them or take them away, because Sanity's newer singleton option
// is still in beta. Dashboard Settings also gets the two buttons that switch
// the screen between sample and production content (actions.js).
const removedFromSingletons = ['delete', 'duplicate', 'unpublish'];

function actionsFor(actions, context) {
  if (singletonTypes.indexOf(context.schemaType) === -1) return actions;

  const kept = actions.filter(item => removedFromSingletons.indexOf(item.action) === -1);
  if (context.schemaType !== settingsType) return kept;
  return kept.concat([useSampleContentAction, useProductionContentAction]);
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
