// The sections of an area: a row of links under the area title and the body of the one that is open. The links are real
// links to #area/section, so a reload, a bookmark and the Back button all land in the same place. Only the open section is
// drawn, the first time it is opened, and its stop function is called when the area is left.
//
//   mountSections(box, { area: 'show', title, lead, sections: [{ id, title, mount(body) }] }, wanted)
//
// mount may return a function (or a promise of one) that is called when the area is left. A section that fails to draw says so
// in its own body and the rest of the page still works.

import { el, esc } from '../dom.js';
import { lead as leadHtml } from '../guide.js';

export function mountSections(box, setup, wanted) {
  const chosen = setup.sections.find(item => item.id === wanted) || setup.sections[0];
  const head = el('header', 'area-head');
  head.innerHTML = '<h2 id="area-title">' + esc(setup.title) + '</h2>' + leadHtml(setup.area);
  const nav = el('nav', 'subnav');
  nav.setAttribute('aria-label', 'Sections of ' + setup.title);
  setup.sections.forEach((item, at) => {
    const link = el('a', 'subnav-link', item.title);
    link.href = '#' + setup.area + (at === 0 ? '' : '/' + item.id);
    if (item.id === chosen.id) link.setAttribute('aria-current', 'page');
    nav.append(link);
  });
  // Legacy cards are drawn for a wrapper of class tab, which gives them their layout
  const body = el('section', 'tab section-body');
  body.dataset.section = chosen.id;
  body.setAttribute('aria-label', chosen.title);
  box.append(head, nav, body);
  if (chosen.lead) body.append(el('p', 'lead', chosen.lead));
  const holder = el('div', 'section-content');
  body.append(holder);

  let stop = null;
  let gone = false;
  Promise.resolve()
    .then(() => chosen.mount(holder))
    .then(found => { if (gone && typeof found === 'function') found(); else stop = found; })
    .catch(error => {
      holder.append(el('p', 'bad', chosen.title + ' could not load: ' + error.message + ' Reload the page. Details has the log.'));
    });
  return () => {
    gone = true;
    if (typeof stop === 'function') stop();
  };
}
