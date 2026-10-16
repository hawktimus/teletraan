// Starts the dashboard. The order matters: fonts, panels, content, then the
// fixed panels, then everything that comes and goes. Each step that can
// fail is wrapped so the screen carries on with what it has.
//
// Switches you can add to the address, for example index.html?motion=calm
//   motion=full|calm|none             how much things move
//   speed=very-slow|slow|normal|fast  how fast things move and how long panels stay
//   style=original|cybertron|minimal  the style of the whole screen (Style in Dashboard Settings), for this page only. minimal
//                                     has the bar layout (core/layout.js) whatever the theme says, and the other two keep the
//                                     layout of the theme. The Screens (core/screens.js) hold no look while it is there
//   team=prime|nova|alternate         the team on the screen (Team mode in Dashboard Settings), for this page only. A team that
//                                     the Studio has no document for is the built-in Prime. The Screens hold no look while it
//                                     is there too, and prime or nova leave out the rows of the other team
//   look=polished|flat|plain          how much polish the frames have (Look in Dashboard Settings). flat is
//                                     the flat finish with no glint, plain also has no screws and no // in the
//                                     panel headers. finish= and glint= below win over it
//   finish=metal|flat                 polished metal edges, or one plain colour (to test speed)
//   metal=gold|silver                 the metal of the permanent frame edges (the banner, the countdown, the logo)
//   change=alternate|slat|mechanical  how the large and small panels change page
//   frames=mostly-gold|alternate|gold|silver   the metal of the large and small page frames
//   glint=on|off                      the bright dash that runs round the big frames
//   draw=stroke|fade                  draw lines, or fade them in (to find out which is slower)
//   stress                            show Grid 1, Grid 2 and the ticker together, changing together
//   only=tasks                        show only the Tasks panel: no banner, countdown, small panels or ticker
//   perf                              show the frame timing readout
//   show=<panel id>                   show only that panel, for example show=events
//   demo=announcement|alert|crt       play one of the special effects now
//   theme=<id>                        show a theme from themes/registry.js, whatever the Theme settings say. A theme with
//                                     another layout (core/layout.js) brings its layout with it
//   overlay=<id>|none                 show an overlay from themes/overlays/registry.js, or none
//   night=on|off                      show the night screen (the screensaver) now, or never, whatever the time
//   seasonover=on|off                 show or hide the seasonal pieces over the panels, whatever the Look page says
//   hidden=desktop|redEyes|off        play that hidden transition at the next page change of the large panel, or never play any
//   debug                             show the build in the bottom left corner, at 20 px (core/build-stamp.js)
//   kit=off                           switch the neon kit (Neon Prime's moving neon, docs/layouts.md) off, to see what it costs

import * as frame from './frame.js';
import { panels } from './registry.js';
import { defaultSettings, metals } from './config.js';
import { savedStyle, savedTheme, startContent, withDefaults } from './core/content.js';
import { askForSample } from './core/source.js';
import { makeSilverGradients } from './core/plate.js';
import { defineHawk } from './core/logo.js';
import { holdLooksFor, showThemeNow, startThemes } from './core/theme-apply.js';
import { holdForLayout, startLayout } from './core/layout-apply.js';
import { layoutNow } from './core/layout.js';
import { ensureThemeSheets } from './core/style-loader.js';
import { recordShapes, startStyle, themeOf } from './core/style.js';
import { currentScreen, onScreenChange } from './core/screens.js';
import { loadPanel } from './core/panels.js';
import { askForTeam, changeTeamNow, currentTeam, onTeamChange } from './core/teams.js';
import { startTakeovers, takeoverRunning } from './core/takeover.js';
import { getContent, holdSavedScreen, rebuild, resumeSavedPreview, setBase, startWhatComesAndGoes, startWhatStays, useLogoSettings, useLookSetting, useTrim } from './shell-content.js';
import { fitToScreen, showDecorations, showFatal, startDemo, startExtras, startOptional, startPerf, waitForFonts } from './shell-extras.js';
import { params, stillAsk, competitionAsk, stress, onlyTasks, shellState } from './shell-state.js';

window.teletraanStarted = true; // index.html reloads the page if this never happens

// The frames follow the trim of the team on the page, and then the banner, the sidebar and the events follow its name
onTeamChange(useTrim);
onTeamChange(() => {
  if (shellState.content && !shellState.choosingTeam) rebuild();
});
// The Screen on the screen says how often the name effect and the hawk play, so they follow it when it changes
onScreenChange(() => {
  if (shellState.content) useLogoSettings(shellState.content.settings, currentScreen(shellState.content));
});
run();

async function run() {
  defineHawk(); // the shapes of the hawk go into the hidden defs before any logo points at them
  // The style and the layout go on first of all, so that no region, area or panel is ever
  // drawn in the wrong place. The layout is the one the last saved content chose: the
  // theme's, or the one the style forces (Minimal), or ?theme= and ?style=.
  // A theme or style with another layout is put on the running page later, in a swap (useLayout below).
  // A preview that was on when the page reloaded goes on first, so the style and the layout are the ones it holds.
  resumeSavedPreview();
  askForSample(params.get('sample'));
  askForTeam(params.get('team'));
  holdSavedScreen();
  const style = startStyle(params.get('style'), savedStyle);
  ensureThemeSheets(themeOf(style));
  startLayout(params.get('theme'), savedTheme, document.documentElement, style);
  recordShapes(style, document.documentElement, layoutNow()); // the frames of the bar layout are Minimal's in every theme

  try {
    makeSilverGradients(); // before any frame is drawn, so a silver frame has its gradients
  } catch (error) {
    console.error('The silver gradients could not be made. Silver frames will have no metal.', error);
  }
  fitToScreen();
  window.addEventListener('resize', fitToScreen);
  // The look, the finish and the glint. index.html has the polished ones. The
  // address wins, then rebuild() applies Look and Glint from Dashboard Settings.
  useLookSetting(defaultSettings);

  // The metal of the frame edges. The address wins, then rebuild() applies
  // Frame metal from Dashboard Settings to the same attribute.
  const metal = params.get('metal');
  if (metals.includes(metal)) document.documentElement.dataset.metal = metal;

  try {
    frame.start({ motion: params.get('motion') || 'full', speed: params.get('speed') || 'normal', draw: params.get('draw'), still: Boolean(stillAsk && stillAsk.still) });

    // A font problem should not stop the screen, so only wait a few seconds
    await Promise.race([waitForFonts(), frame.wait(4000)]);
    await Promise.all(panels.filter(panel => stress || !panel.testOnly).map(loadPanel));

    const loading = startContent(change => setBase(change.content, change.status));

    // With nothing saved on this computer and Sanity slow to answer, the
    // content can take 15 seconds. The screen does not wait that long: it
    // starts with the defaults and swaps in the content when it arrives.
    const early = await Promise.race([loading, frame.wait(2000).then(() => null)]);
    if (early) {
      setBase(early.content, early.status);
    } else {
      setBase(withDefaults(null), { source: 'sanity', updated: null, offline: false });
    }

    // The theme goes on before the first panel is drawn, so nothing flashes in the wrong colours.
    // A look with another layout than the page has waits for a swap to have the screen, which changes the layout in the page.
    // Before anything is drawn there is nothing to wait for.
    try {
      holdLooksFor((look, waitedMs) => holdForLayout(look, takeoverRunning, waitedMs, () => !shellState.stayStarted || shellState.swapIsPlaying()));
      await startThemes(getContent, { theme: params.get('theme'), overlay: params.get('overlay'), style: params.get('style') }, showDecorations);
    } catch (error) {
      console.error('The theme could not be started. The screen keeps the default look.', error);
    }

    // The night screen goes up before the panels are drawn, so a Mini that
    // restarts in the middle of the night does not show the dashboard first.
    // It is left out of the test views (?show and ?stress) unless asked for.
    if (params.has('night') || (!params.get('show') && !stress)) {
      await startOptional('./core/night-screen.js', module => module.startNight(getContent, params.get('night')));
    }

    if (competitionAsk) await startOptional('./core/competition-address-run.js', module => module.startCompetitionAddress(competitionAsk, getContent, shellState.showingSample));
    startWhatStays();

    // Alerts and announcements do not need the weather or events, so they
    // start looking at the clock at once. An announcement must never be
    // missed because the screen was still loading.
    // The announcement bar can be asked for on a held panel (?panel=tasks&notice=1), which is how the screenshot tool draws it
    if (params.get('show') && params.has('notice')) startOptional('./core/notice-run.js', module => module.startNoticeRunner(getContent));

    if (!params.get('show') && !stress) {
      startTakeovers(getContent);

      // The Demo page in the Studio. After the takeovers, so that an alert that
      // comes due on the same second has the screen before the demo looks.
      startOptional('./core/demo-runner.js', module => module.startDemoRunner(getContent));

      // The hidden transitions. After the demo runner and the night screen, which they ask about
      startOptional('./core/hidden-run.js', module => module.startHidden(getContent, params.get('hidden')));

      // The Play announcements button in the Studio. Last, because it asks the ones above whether they have the screen
      startOptional('./core/announce-run.js', module => module.startAnnounceRunner(getContent));
      startOptional('./core/notice-run.js', module => module.startNoticeRunner(getContent));
      startOptional('./core/subthemes-layer.js', module => module.startSubthemes(getContent));

      // A booked talk takes the whole screen when its time comes. After the takeovers, so that an announcement
      // that comes due on the same second plays first, and the title card waits for it
      startOptional('./core/presentation-run.js', module => module.startPresentations(getContent));

      // The Run presentation test button in the Studio. After the talk screen, which it starts the sample talk on
      startOptional('./core/presentation-test-run.js', module => module.startPresentationTestRunner(getContent));

      // The Preview buttons in the Studio. After the ones it asks about
      startOptional('./core/preview-run.js', module => module.startPreviewRunner(getContent));

      // The Preview competition button on the Start here page. After the ones it asks about
      startOptional('./core/competition-preview-run.js', module => module.startCompetitionPreviewRunner(getContent));

      // The team on the screen, which in Alternate mode changes with the clock (core/teams.js)
      startOptional('./core/team-run.js', module => module.startTeams(getContent));

      // The three dots and the report to the control page. The report asks the team of the page
      startOptional('./core/dots-run.js', module => module.startDots(getContent, shellState.showingSample));
      startOptional('./core/now-report.js', module => module.startNowReport(getContent, currentTeam));

      // The views: the look of each step of the large panel, the swaps, and the Next look now button in the Studio.
      // After the ones they ask about. ?style= and ?team= in the address win over them, so then they do nothing
      if (!onlyTasks) {
        startOptional('./core/swap-run.js', module => { shellState.swapIsPlaying = module.swapRunning; });
        startOptional('./core/views-run.js', module => module.startViews(getContent, params.has('style') || params.has('team')));
      }
    }

    if (!early) {
      const first = await loading;
      setBase(first.content, first.status);
      showThemeNow(); // the first real content, so its theme goes on at once, not at a page change
      changeTeamNow(); // and its team
    }

    await startExtras();
    startWhatComesAndGoes();
    await startPerf();
    startDemo();
  } catch (error) {
    showFatal(error);
  }
}
