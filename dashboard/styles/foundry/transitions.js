// The swap of the foundry theme: the pull apart and re-form of core/swap-plan.js. A theme that moves
// differently exports its own numbers under the same names. core/style-loader.js loads this file by the
// id of the theme.

import { swapReform, swapShape, swapTimes } from '../../core/swap-plan.js';
import { kit as originalKit } from '../original/transitions.js';

export const swapVariant = { name: 'pull-apart', times: swapTimes, reform: swapReform, shape: swapShape };

// The kit of the theme for the panel and view transitions. Until this theme has its own, it plays the Original kit under
// its own id, so every theme already plays a working transition.
export const kit = Object.assign({}, originalKit, { id: 'foundry' });
