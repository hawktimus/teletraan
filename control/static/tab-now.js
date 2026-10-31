// The Now area: is everything fine, and what needs attention (areas/now.js).

import { registerTab, tabOrder } from './tabs.js';
import { mountNow } from './areas/now.js';

registerTab({ id: 'now', title: 'Now', icon: 'pulse', order: tabOrder.now, render: mountNow });
