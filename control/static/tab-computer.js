// The Computer area: restart, reboot, network, schedule and copying the project (areas/computer.js).

import { registerTab, tabOrder } from './tabs.js';
import { mountComputer } from './areas/computer.js';

registerTab({ id: 'computer', title: 'Computer', icon: 'chip', order: tabOrder.computer, render: mountComputer });
