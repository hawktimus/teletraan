// Loads the panels listed in registry.js and builds their pages. A panel that
// fails to load or to draw is skipped and reported in the console. It never
// stops the rest of the screen.
//
// Putting a page in its area, and taking it out again, is areas.js.

import { panels } from '../registry.js';
import * as frame from '../frame.js';

const modules = {};

function findPanel(id) {
  const panel = panels.find(item => item.id === id);
  if (!panel) throw new Error('No panel called "' + id + '" in registry.js');
  return panel;
}

// Which region a panel belongs in, or null if there is no such panel
export function regionOf(id) {
  const panel = panels.find(item => item.id === id);
  return panel ? panel.region : null;
}

export function topicOf(id) {
  return findPanel(id).topic || null;
}

export function moduleOf(id) {
  return modules[id] || null;
}

// Loads a panel's script and stylesheet. Resolves even if something is
// missing, so one broken panel cannot hold up the others.
export async function loadPanel(panel) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = panel.style;
  const stylesheetDone = new Promise(resolve => {
    link.onload = resolve;
    link.onerror = () => {
      console.error('Could not load ' + panel.style);
      resolve();
    };
  });
  document.head.appendChild(link);

  try {
    // paths in registry.js are relative to the dashboard folder, which is where the page is
    modules[panel.id] = await import(new URL(panel.script, document.baseURI).href);
  } catch (error) {
    console.error('Could not load panel "' + panel.id + '"', error);
  }
  await stylesheetDone;
}

// The element a panel that has no area goes into: the banner, the countdown
// and the full screen panels draw everything themselves
export function hostFor(region) {
  return document.getElementById(region === 'overlay' ? 'overlay' : 'region-' + region);
}

// True if the panel loaded and has something to show right now
export function canShow(id, content) {
  const module = modules[id];
  if (!module) return false;
  if (!module.hasContent) return true;

  try {
    return module.hasContent(content);
  } catch (error) {
    console.error('Panel "' + id + '" could not check its content', error);
    return false;
  }
}

// Builds a panel's page away from the screen and returns
//   { id, region, element }
// element is the panel's own root element, not on the screen yet. If the
// panel fails, this throws and whatever is on screen is left alone.
export function buildPage(id, content) {
  const panel = findPanel(id);
  const module = modules[id];
  if (!module) throw new Error('Panel "' + id + '" is not loaded');

  const workbench = document.createElement('div');
  module.mount(workbench, content);

  const element = workbench.firstElementChild;
  if (!element) throw new Error('Panel "' + id + '" drew nothing');
  element.dataset.panel = id; // updatePanel finds the panel by this

  frame.numberSlats(element); // a panel with no slats, such as the banner, has nothing to number
  return { id: id, region: panel.region, element: element };
}

// Puts a page that has no area into its region, alone
export function placeWholePanel(page) {
  const host = hostFor(page.region);
  host.innerHTML = '';
  host.appendChild(page.element);
}

// Builds a whole panel and puts it on the screen at once, for the banner,
// the countdown and the alerts. Returns the panel's own element.
export function mountPanel(id, content) {
  const page = buildPage(id, content);
  placeWholePanel(page);
  return page.element;
}

// Tells a panel that is on screen (the banner, the countdown) about new
// content. The panel's own update(element, content) does the work.
export function updatePanel(id, content) {
  const module = modules[id];
  const element = document.querySelector('[data-panel="' + id + '"]');
  if (!module || !module.update || !element) return;

  try {
    module.update(element, content);
  } catch (error) {
    console.error('Panel "' + id + '" could not update', error);
  }
}
