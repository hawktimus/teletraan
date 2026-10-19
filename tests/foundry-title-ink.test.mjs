// The panel titles of Foundry read in the team's text color, so a team with a dark header ink (Nova) is not dark on steel

import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../dashboard/styles/foundry/theme.css', import.meta.url), 'utf8');
const base = fs.readFileSync(new URL('../dashboard/base.css', import.meta.url), 'utf8');

assert.ok(/html\[data-style="foundry"\] \.area \.header \.title \{ color: var\(--team-text\); \}/.test(css), 'Foundry sets the title color to the team text color');
assert.ok(/color: var\(--head-ink, var\(--team-header-ink\)\)/.test(base), 'the base rule still uses the header ink for the plates drawn in the main color');
assert.ok(/--style-header-ink: var\(--team-header-ink/.test(fs.readFileSync(new URL('../dashboard/styles/foundry/tokens.css', import.meta.url), 'utf8')), 'the ticker tag and the team plate of Foundry still use the header ink');
console.log('ok   Foundry titles use the team text color, the main color plates keep the header ink');
