# Reading the screen from 20 feet

The TV is read from across a room, so the rules here are stricter than a web page. This file says what was measured, what failed and was fixed, what is left, and the rules for new work. The tests are in `tests/accessibility.test.mjs`.

## What was measured

All of it comes from the real screen with the sample content, not from the token files.

| Check | How |
|-------|-----|
| Contrast | `node tools/contrast-probe.mjs` opens 984 pages at 1920 x 1080: every panel in every theme (Original, Cybertron, Retro, Foundry) with Prime and Nova, standard and bar layout, with each seasonal pack, each color theme (Alternate, Neon Prime) and each subtheme, the four views with the ticker and the small frame, the alert, the announcement plate and the stale chip. It lists every text with its computed color, hides all text, takes a picture, and compares the color with the pixels behind each line (the worst 5 percent of them). About 44,000 texts. |
| Color vision | `node tools/color-vision.mjs` turns the colors that carry meaning into what protanopia, deuteranopia and tritanopia see (Machado 2009) and prints every pair under 11 apart (CIEDE2000). |
| Size, weight, spacing | The same probe records font size, weight, letter spacing and line height of every text. |
| Flashing | `node tools/flash-probe.mjs` lists every running animation in full and calm motion, with its repeat rate and the share of the screen it covers. |
| Distance | A 1920 x 1080 picture shrunk to 480 x 270 is about what the eye gets at 20 feet. |

The limit is 4.5:1, and 3:1 for text of 96px and more. The line box of a text is taller than its letters, so only the middle 40 percent of each line is read.

## What failed and was fixed

Before is the worst pixel pair found, after is the same pair on the fixed screen. Nova is the inverted palette.

| Pair | Before | After | Fix |
|------|--------|-------|-----|
| Retro, Nova: accent, label, lilac, cyan and red text on the cel (the plate color, a light gold brown) | 2.1 to 4.1 | 5.7 to 8.9 | In Retro the Nova cel is the body color (`styles/retro/tokens.css`). |
| Retro, Prime: High priority red and "1 blocked" on the cel | 3.1 and 3.7 | 4.5 | Both use `--danger-bright`. |
| Retro, Prime: label of a small panel, white on the yellow plate | 1.6 | 12.7 | The label is ink, as the title is. |
| Original, Nova: label of a small panel, white on the gold plate | 2.4 | 7.8 | The label follows the header ink of the team (`base.css`). |
| Neon Prime and Alternate, Nova: title and TEAM plate, the dark header ink of Nova on the dark purple and blue of the theme | 1.2 and 1.7 | 11 | Only Hawktimus paints its plates in the team's main color. The other two set `--head-ink` to the theme white. |
| Neon Prime or Foundry with the sidebar, Nova: TEAM and the number on the gold plate | 1.3 and 2.1 | 7.8 | The side plate takes the header ink in Retro and Foundry. |
| Bar layout, Nova: war clock digits, labels and date in neon purple on the armor | 1.9 to 3.5 | 5.4 to 9.6 | The inverted palette reads them in the label color. |
| Bar layout, Nova: location, number and TEAM number in the accent on the plate color | 2.6 | 4.6 | The cards and the TEAM plate use the dark shade of the plate. |
| War clock date and labels of Prime, Original and Cybertron, at .75 of the amber | 4.1 | 5.0 | `--war-dim` is .88. |
| Status chart: In Progress and To Do are the same color to a person with protanopia (1 apart; 11 is the limit) | color only | outline | To Do is an outline with its number in the same color. |

Contrast of the ticker, the alert, the announcement plate and the stale chip passed in every theme and for both teams. Foundry paints its header plates in steel, so it keeps the team text for the small label (white), and the rule for the other themes does not reach it.

## Color vision

The status colors of every theme are 6 to 11 apart in some kind of color blindness: Done and In Progress (tritanopia), In Progress and To Do (protanopia and deuteranopia), Blocked and Stale, and the gold of In Review and Stale. None of them is carried by color alone:

- A task row has its status as a word and as a shape: a stop sign for Blocked, slashes for In Progress, and the shapes of marks.js for Up Next and Done.
- The status chip of a Monday row, the priority (High, Medium, No Priority) and the team tag (PRIME, NOVA) are words.
- The kind chip of an event is a word.
- The chart legend names the three parts, the parts always run in the order Done, In Progress, To Do, and To Do is an outline.
- A competition result has a check mark for a win and is dimmer for a loss, and the red and blue alliances are written.
- Done and In Progress stay 9.9 apart in tritanopia. They have the order, the legend and the number. If a chart is ever drawn without numbers, give one of them a pattern.

## Sizes, weight, spacing

- Every text is 44px or more except the exceptions the brief names: the war clock labels (24px), chips (30px), labels and column heads (36px), the month names of the timeline (36px), the photo credit (30px).
- Weights are 500 to 900. No text is lighter. Nothing is set in a thin face.
- The longest line is about 40 characters at 56px, 1040px wide.
- All capitals have no added spacing. The display face is already open, and the war clock labels are tightened by 3 percent.

## What is left

These need a change of layout, which is not this audit's work.

- The team and the age at the end of a Monday header (`PRIME · SAMPLE`, and the STALE chip) run over the slanted end of the title plate in Retro and in Original with Nova. Lilac on the plate is 1.2 to 2:1 for those few letters.
- The text of a seasonal banner line sits on the frame line of the Cybertron banner.
- Competition cards draw some text at 28px (axis numbers of the forecast) and 30px (the estimate note), under the 36px of a label.
- In the Monday table a two-line project name is 44px on a 38px line (0.86). The rows are fixed, so the lines touch.
- The Cybertron grid and scan lines keep drifting in calm motion (slow, transform only, a whole screen of faint lines). Calm mode should stop them, like the other themes.
- The dashboard has no `prefers-reduced-motion` rule. On a wall the setting is Calm in Dashboard Settings.
- The mini panel idea placeholder is dark ink on gold with a dashed frame through the label.
- Text over real photos is not measured: the sample photos are flat. The caption sits on a plate of the team plate color.

## Motion

Nothing flashes more than 3 times a second. The fastest repeat is the small lamp of the alert and of the countdown as its date nears: a 0.7 second cycle (1.4 a second). The glint, the stars, the sprites and the lamps are all slower. Calm mode stops the glint, the sprites and every theme's moving art except the Cybertron drift above.

## Rules for new work

1. Every text is 4.5:1 against what is behind it, 3:1 from 96px. Measure with the probe, not with the token files. Text sits on the body color, the dark shade or the ground, never on the plate color of a team, which can be light (Nova's is a gold brown at 2.6:1 under its accent).
2. Text on a plate that is drawn in the main color of the team takes the header ink of the team. Text on a plate that belongs to a theme takes the theme's white. Only Hawktimus paints in the main color.
3. A color never carries meaning alone: add a word, a shape or an outline. A new status, priority or chart part must say which.
4. A dimmed text is a fade of the ink, so measure the faded result. The war clock labels are .88.
5. Keep the sizes of the brief. Do not add a text under 44px that is not on its list.
6. Do not flash. A new repeating opacity change is slower than 3 a second and small. A new moving layer that covers a large part of the screen stops in calm motion.
7. Look at the picture at 480 x 270 after a change. A 30px chip or a 24px label is about 8 pixels there, which is why chips carry a word and a shape and are never the only place a fact is written.

## Running it

    NODE_PATH=/path/to/node_modules node tools/contrast-probe.mjs --only monday
    node tools/contrast-probe.mjs --list
    node tools/color-vision.mjs
    node tools/flash-probe.mjs
    node tests/accessibility.test.mjs

Playwright is the one the screenshot tool uses (tools/package.json). Without it the test skips the real pixels and runs the rest. The pictures and the JSON of a run are in `_outputs/a11y/`, which git ignores.
