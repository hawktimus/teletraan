// The Details area: raw messages, logs and technical output (areas/details.js).

import { registerTab, tabOrder } from './tabs.js';
import { mountDetails } from './areas/details.js';

registerTab({ id: 'details', title: 'Details', icon: 'list', order: tabOrder.details, render: mountDetails });
