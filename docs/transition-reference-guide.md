# The transition reference pages

The design boards in `docs/reference/transitions/` are single web pages. Open one in a browser and it plays its animation over and over. This guide says what each one shows, which theme and which kind of change it is for, and how the live dashboard compares. The pictures that go with it are made by `node tools/anim-strip.mjs` (the live screen) and are in `_outputs/anim/` (not committed): `before/` is the live screen before the fix below, `after/` is the Full transitions after it, `light/` is the Light ones, and `reference/` is the reference pages drawn at the same times.

## The short answer

- The pages named V29 are the **panel change** of each theme: the large panel goes to the next row and the machine takes it apart and builds it again. V30 is the **view change**: every frame of the screen does it at once and the hawk turns into the other team's hawk. There is one page of each for Original, Cybertron, Retro and Foundry.
- V04 is Nova in the Original theme (a still design board). V10 is Prime in the Foundry theme (a still board with its idle motion). V12 is a winter **subtheme**. V19 to V22 are four **backgrounds** of the Original theme.
- The owner's "some of the other themes use animations of other themes" was true. Every theme plays the same machine skeleton, and Foundry also played the Original drawings. The fix is in "Where the themes were mixed" below.

## The panel and view changes (V29 and V30)

All eight pages play the same skeleton of 3 seconds (the page shows it as a loop of 4 seconds that runs forward and then backward): the camera leans in 5 degrees, screws spin out and lift (0 to 0.4 s), the four edges fold in on hinged straps (0.4 to 1.05 s), the content turns over as a wave of squares from the top left (1.1 to 1.9 s), the edges unfold (1.95 to 2.6 s) and everything tightens and locks (2.45 to 3.0 s). That skeleton is the engine (`core/reform-plan.js`, `core/reform-draw.js`). A theme changes what the parts look like and adds parts of its own.

| Page | Theme | Kind | What is its own in it |
|------|-------|------|-----------------------|
| V29 Swap Panel Original | Original | panel change | Gold plates in the metal of the team: screws, latches, braces, rivets, corner gears, pistons and teeth on the straps; squares that drop back and turn over; a lattice of struts for the floor. |
| V29 Swap Panel Cybertron | Cybertron | panel change | Gunmetal straps with a neon line, power cores that spin up where the screws were (twice the turns), brackets that retract, two bolts of light and a conduit along every edge, a scan bar down the window, squares that collapse to a line of light, flip and open, a neon grid floor. The latches, rivets, gears, pistons and teeth are left out. |
| V29 Swap Panel Retro | Retro | panel change | Comic hardware with a thick ink line, joints that swing past the fold and spring back, bursts of action lines at the corners, speed lines at both sides, a spiky star behind the squares, squares that squash, turn on a spring and stretch, sparkles as it locks, a halftone floor. |
| V29 Swap Panel Foundry | Foundry | panel change | Steel and hazard yellow. Ten deadbolts drawn back out of the edges before anything folds and slammed home last, a hand wheel at the top right, four rams on the corner diagonals, two gauges with a sweeping needle, a jolt of the stage when the bolts break and when they lock, and the hazard striped floor. In the reference it keeps the Original screws, rivets, teeth and flip. |
| V30 Swap View Original, Cybertron, Retro, Foundry | each | view change | The same parts as the panel page, on four regions at once (banner, side column, main panel, ticker), with the side column and the main panel swapping sides and four hawk plates turning over on their own hinges. |
| V04 Nova Original | Original | still board | Nova (light blue and gold) in the Original theme. Its only motion is the light band that crosses the frames every 46 s (the glint). |
| V10 Prime Foundry | Foundry | still board with idle motion | The Foundry theme at rest: six dust motes (10 to 15 s), bands of hazard stripes creeping along the top and bottom (9 s), a work light that pans across (70 s), a hook that crosses the rail (150 s), cogs that turn (48, 67.5 and 90 s) and pistons that stroke. The live theme draws the same (`styles/foundry/background.js`, `core/theme-art.js`). |
| V12 Sub Winter | the winter subtheme | subtheme | Snow that falls (11 to 14 s) and turns (6 s), strings of bulbs that twinkle (1.6, 2.0 and 2.4 s). The live screen has the winter preset (`core/subtheme-presets.js`, docs/subthemes.md) with simpler sprites: drift, blink and fall. |
| V19 Bg Blueprint | Original | background | A fine grid and a coarse grid drift diagonally at different speeds (40 s). The live setting Blueprint. |
| V20 Bg Rays | Original | background | Three faint light bands on a slow drift (24, 28 and 36 s). The live setting Rays. |
| V21 Bg Spotlight | Original | background | One pool of team color that wanders behind the panels (50 s). The live setting Spotlight. |
| V22 Bg Embers | Original | background | A dozen gold sparks that rise slowly (23 to 38 s each). The live setting Embers. |

The backgrounds are set on the Look page and are drawn by `styles/original/background.js` and its stylesheet. They match the boards. Nothing there was changed except that they stand still while a transition plays and in Light.

## How the live screen compared (before the fix)

Live frames at the same times are in `_outputs/anim/before/<theme>-panel.png` and `<theme>-view.png`, next to `_outputs/anim/reference/V29-*.png` and `V30-*.png`.

- **Original**: the same as its page.
- **Cybertron**: close to its page. The squares that collapse to a line of light, the cores, the bolts of light, the conduits and the scan bar are all there.
- **Retro**: close to its page: the star, the squash, the speed lines and the halftone are there.
- **Foundry**: its pieces were there (deadbolts, wheel, rams, gauges, hazard floor) but the rest was the Original machine in steel colors: the screws, latches, braces, rivets, gears, pistons and teeth were the Original drawings, and the squares turned over exactly as the Original ones do. The reference page for Foundry does the same, because it is the Original skeleton with the Foundry parts added. This is what the owner saw: bars and plates built the way the Original screen builds them, with the gears of the theme on top.

## Where the themes were mixed

Each theme has a kit, `styles/<theme>/transitions.js`, and the engine asks it for the drawing of each part. The hooks are these (the first is needed, the rest may be left out):

| Hook | What it does | If a kit has none |
|------|--------------|-------------------|
| `draw(role)` | The drawing of a piece of hardware (screw, latch, brace, rivet, gear, piston, tooth) and of the chassis | Nothing is drawn for that role |
| `hardware(item)` | The moves of a piece, or `null` to leave it out | The piece moves as the skeleton says |
| `squares(square, move)` | How a square turns and its shade | The engine turn of `squareStops` in `core/reform-plan.js` (the Original turn) |
| `extras(region, tracks, strip, behind)` | Parts of the kit's own for a region | None |
| `jolt()` | Shakes the stage | No shake |
| `lockParts: true` | Cells with a lock pin and a hinge barrel on the large panel | No cells |
| `light(width, height, role)` | The parts of the Light transition | Two plain plates |

Before the fix there were four places where a theme played something that was not its own:

1. **Foundry** was written as the Original kit with parts added (`Object.assign({}, originalKit, {...})`), and `draw` fell back to `originalKit.draw(role)`. All seven pieces were the Original drawings (the old test `tests/reform-foundry.test.mjs` asserted it), it had no `squares` hook, so its squares used the Original turn, and it had no `hardware` hook.
2. **The stylesheet** `dashboard/reform-kit.css` held the Original look of the straps, the floor and the hardware with no theme in the selector, so any kit that did not cover a rule showed it.
3. **`kitNow()`** in `core/reform-run.js` played the Original kit when a theme had no kit file or its file failed to load.
4. **The engine** draws the same straps, chassis and squares for every kit and no kit can leave the straps out. That is the skeleton, and the reference pages share it. The look of the straps is now the kit's.

Cybertron leaves five of the seven pieces out and draws its own two, and Retro draws all seven of its own, so they were not borrowing drawings. The engine turn was theirs too (`squares` in each).

## What changed

- Foundry draws every piece itself: hex bolts, hasps, gusset straps, rivets, real cogs, pistons and ratchet teeth, in steel and hazard yellow, with steel plates that slide out of their rack, turn over and are slammed back. It imports nothing from Original.
- The Original look of the straps, the floor and the hardware moved to `styles/original/reform-kit.css` and every rule starts with `html[data-style="original"]`. `dashboard/reform-kit.css` is the plain kit now: grey plates and straps and nothing else.
- A theme with no kit, or one that cannot be loaded, plays the plain kit (`core/reform-plain.js`): no hardware, no floor art, flat squares and grey straps. That is a neutral change and not another theme's drawing.
- Each kit also has a Light transition of its own (see docs/transitions.md): gold plates and screws for Original, gunmetal plates with a neon seam and cores for Cybertron, ink-lined comic panels with a star and speed lines for Retro, hazard striped steel doors with deadbolts and cogs for Foundry.
- `tests/transition-vocabulary.test.mjs` and the rules `vocabulary/...` of `tests/motion/light.mjs` fail when a theme draws a class of another theme (`rk-` Original, `ck-` Cybertron, `rr-` Retro, `fk-` Foundry), when the plain stylesheet names a theme, or when a theme's stylesheet restyles the engine with a rule that is not its own.
