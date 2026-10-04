// Loads the panels listed in registry.js and draws them onto the screen.
// A panel that fails to load or to draw is skipped and reported in the
// console. It never stops the rest of the screen.

import { panels } from '../registry.js';

const modules = {};

export function findPanel(id) {
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

function hostFor(panel) {
  const id = panel.region === 'overlay' ? 'overlay' : 'region-' + panel.region;
  return document.getElementById(id);
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

// Draws the panel into its area and returns the panel's own element.
// It is built away from the screen first, so if it fails the old panel is
// left alone.
export function mountPanel(id, content) {
  const panel = findPanel(id);
  const module = modules[id];
  if (!module) throw new Error('Panel "' + id + '" is not loaded');

  const workbench = document.createElement('div');
  module.mount(workbench, content);

  const element = workbench.firstElementChild;
  const host = hostFor(panel);
  host.innerHTML = '';
  host.appendChild(element);
  return element;
}

// Tells a panel that stays on screen (banner, countdown) about new content
export function updatePanel(id, content) {
  const module = modules[id];
  const element = hostFor(findPanel(id)).firstElementChild;
  if (!module || !module.update || !element) return;

  try {
    module.update(element, content);
  } catch (error) {
    console.error('Panel "' + id + '" could not update', error);
  }
}
