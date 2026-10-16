import { defineCliConfig } from 'sanity/cli';
import { projectId, dataset, studioBasePath } from './project.js';

export default defineCliConfig({
  api: {
    projectId: projectId,
    dataset: dataset,
  },
  // The public id of the hosted Studio (teletraan). With it, sanity deploy
  // updates that Studio and asks nothing about a hostname.
  ...(studioBasePath ? { project: { basePath: studioBasePath } } : {}),
  deployment: {
    appId: 'aaojtrzg572ce88nb5jgpbmp',
  },
});
