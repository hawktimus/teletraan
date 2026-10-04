import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { projectId, dataset } from './project.js';
import { schemaTypes } from './schemas/index.js';
import { structure, settingsType } from './structure.js';

// Dashboard Settings exists once. Its page is made the long-standing way, by
// removing the actions that would copy it or take it away, because Sanity's
// newer singleton option is still in beta.
const removedFromSettings = ['delete', 'duplicate', 'unpublish'];

function actionsFor(actions, context) {
  if (context.schemaType !== settingsType) return actions;
  return actions.filter(item => removedFromSettings.indexOf(item.action) === -1);
}

function newDocumentChoices(templates) {
  return templates.filter(template => template.templateId !== settingsType);
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
