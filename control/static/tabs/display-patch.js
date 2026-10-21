// Puts the HTML of the rows (display-parts.js, rowsHtml) into the page without throwing away the card of a row that is
// still there. A frame that is taken out of the page and put back loads its address again, so a card that stays keeps its
// element, and with it the small live picture in it (display-preview.js). A card is matched to its row by data-key.
//
// What is replaced inside a kept card is everything except its picture slot (.thumb), which is the first child.

function fragmentOf(html) {
  const holder = document.createElement('template');
  holder.innerHTML = html;
  return holder.content;
}

// The kept card takes the new words and fields, and keeps its picture slot (whose title may have changed)
function patchCard(card, fresh) {
  ['view', 'shown'].forEach(name => { card.dataset[name] = fresh.dataset[name]; });

  const slot = card.querySelector('.thumb-title');
  const title = fresh.querySelector('.thumb-title');
  if (slot && title && slot.textContent !== title.textContent) slot.textContent = title.textContent;

  const old = Array.from(card.children).filter(child => !child.classList.contains('thumb'));
  const next = Array.from(fresh.children).filter(child => !child.classList.contains('thumb'));
  if (old.length !== next.length) {
    old.forEach(child => child.remove());
    next.forEach(child => card.append(child));
    return;
  }
  old.forEach((child, at) => child.replaceWith(next[at]));
}

// A group keeps its element when it has the same place in the list, and its cards are put in the order of the new rows.
// Cards that are no longer in the list are taken out first, so the cards that stay do not have to move.
function patchGroup(group, fresh, cards) {
  group.dataset.view = fresh.dataset.view;
  group.querySelector('h3').textContent = fresh.querySelector('h3').textContent;

  const wanted = Array.from(fresh.querySelectorAll('.drow'));
  const keys = wanted.map(card => card.dataset.key);
  Array.from(group.querySelectorAll('.drow')).forEach(card => { if (!keys.includes(card.dataset.key)) card.remove(); });

  let cursor = group.querySelector('h3').nextElementSibling;
  wanted.forEach(card => {
    const kept = cards.get(card.dataset.key);
    if (kept) patchCard(kept, card);
    const use = kept || card;
    if (use === cursor) cursor = cursor.nextElementSibling;
    else group.insertBefore(use, cursor);
  });
}

// box is the element that holds the groups of rows
export function patchRows(box, html) {
  const fresh = fragmentOf(html);
  const groups = Array.from(fresh.children);
  const old = Array.from(box.children).filter(child => child.classList.contains('dgroup'));

  // The empty list is a sentence, not groups
  if (groups.length === 0 || groups.some(child => !child.classList.contains('dgroup')) || old.length === 0) {
    box.replaceChildren(fresh);
    return;
  }

  const cards = new Map();
  box.querySelectorAll('.drow').forEach(card => cards.set(card.dataset.key, card));
  groups.forEach((group, at) => {
    if (old[at]) return patchGroup(old[at], group, cards);
    // A group with no place yet: an empty shell with the same heading, filled the same way, so a card that was kept is moved in
    const shell = group.cloneNode(true);
    shell.querySelectorAll('.drow').forEach(card => card.remove());
    box.append(shell);
    patchGroup(shell, group, cards);
  });
  // The cards that moved to another group are already there. The groups that are left over go.
  old.slice(groups.length).forEach(group => group.remove());
}
