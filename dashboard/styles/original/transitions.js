// The swap of the original theme: the pull apart and re-form of core/swap-plan.js. A theme that moves
// differently exports its own numbers under the same names. core/style-loader.js loads this file by the
// id of the theme.

import { swapReform, swapShape, swapTimes } from '../../core/swap-plan.js';

export const swapVariant = { name: 'pull-apart', times: swapTimes, reform: swapReform, shape: swapShape };
