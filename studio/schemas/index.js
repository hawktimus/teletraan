import task from './task.js';
import plan from './plan.js';
import sponsor from './sponsor.js';
import tipOrNews from './tipOrNews.js';
import subteam from './subteam.js';
import person from './person.js';
import customPanel from './customPanel.js';
import dashboardSettings from './dashboardSettings.js';
import { customPanelBlocks } from './customPanelBlocks.js';

export const schemaTypes = [
  task,
  plan,
  sponsor,
  tipOrNews,
  subteam,
  person,
  customPanel,
  dashboardSettings,
].concat(customPanelBlocks);
