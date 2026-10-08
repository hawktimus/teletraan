import task from './task.js';
import plan from './plan.js';
import presentationDay from './presentationDay.js';
import presentation from './presentation.js';
import extraEvent from './extraEvent.js';
import sponsor from './sponsor.js';
import tipOrNews from './tipOrNews.js';
import subteam from './subteam.js';
import place from './place.js';
import person from './person.js';
import photo from './photo.js';
import customPanel from './customPanel.js';
import dashboardSettings from './dashboardSettings.js';
import theme from './theme.js';
import demo from './demo.js';
import { customPanelBlocks } from './customPanelBlocks.js';

export const schemaTypes = [
  task,
  plan,
  presentationDay,
  presentation,
  extraEvent,
  sponsor,
  tipOrNews,
  subteam,
  place,
  person,
  photo,
  customPanel,
  dashboardSettings,
  theme,
  demo,
].concat(customPanelBlocks);
