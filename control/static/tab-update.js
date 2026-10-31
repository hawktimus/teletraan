// The Update area: sync the sources and publish a new version (areas/update.js).

import { registerTab, tabOrder } from './tabs.js';
import { mountUpdateArea } from './areas/update.js';

registerTab({ id: 'update', title: 'Update', icon: 'upload', order: tabOrder.update, render: mountUpdateArea });
