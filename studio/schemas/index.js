import task from './task.js';
import plan from './plan.js';
import presentationDay from './presentationDay.js';
import presentation from './presentation.js';
import extraEvent from './extraEvent.js';
import calendarFilter from './calendarFilter.js';
import sponsor from './sponsor.js';
import tipOrNews from './tipOrNews.js';
import subteam from './subteam.js';
import place from './place.js';
import person from './person.js';
import team from './team.js';
import photo from './photo.js';
import customPanel from './customPanel.js';
import dashboardSettings from './dashboardSettings.js';
import theme from './theme.js';
import demo from './demo.js';
import status from './status.js';
import { customPanelBlocks } from './customPanelBlocks.js';

export const schemaTypes = [
  task,
  plan,
  presentationDay,
  presentation,
  extraEvent,
  calendarFilter,
  sponsor,
  tipOrNews,
  subteam,
  place,
  person,
  team,
  photo,
  customPanel,
  dashboardSettings,
  theme,
  demo,
  status,
].concat(customPanelBlocks);
