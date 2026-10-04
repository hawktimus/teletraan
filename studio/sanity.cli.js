import { defineCliConfig } from 'sanity/cli';
import { projectId, dataset } from './project.js';

export default defineCliConfig({
  api: {
    projectId: projectId,
    dataset: dataset,
  },
});
