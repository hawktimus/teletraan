// The Show area: what is on the TV (areas/show.js).

import { registerTab, tabOrder } from './tabs.js';
import { mountShow } from './areas/show.js';

registerTab({ id: 'show', title: 'Show', icon: 'tv', order: tabOrder.show, render: mountShow });
