// The width word and the folding rules shared by the Status page and the wall controls on the Display tab. A width word on
// the root (wide from 900 px, medium from 600, narrow below) picks the layout in tabs.css. The groups of controls and the
// health block are folded sections. When wide they are always open; when narrow one group is open at a time.

export function widthWord(width) {
  return width >= 900 ? 'wide' : width >= 600 ? 'medium' : 'narrow';
}

// Keeps the width word, the open state of the folds and the one-open-at-a-time rule. Returns { again, stop }.
export function arrange(root) {
  const folds = () => Array.from(root.querySelectorAll('details[data-fold]'));
  let word = '';

  function apply() {
    const next = widthWord(window.innerWidth);
    if (next === word) return;
    const before = word;
    word = next;
    root.dataset.width = word;
    if (word === 'wide') folds().forEach(fold => { fold.open = true; });
    else if (before === 'wide' || before === '') {
      // folding a wide page: the groups close but the one most people want stays
      folds().forEach(fold => { fold.open = fold.dataset.fold === 'open'; });
    }
  }

  // A wide page is not folded: the heading does not close anything
  const onClick = event => {
    if (word === 'wide' && event.target.closest('details[data-fold] > summary')) event.preventDefault();
  };
  // toggle does not bubble, so it is caught on the way down
  const onToggle = event => {
    const fold = event.target;
    if (word === 'wide' || !fold.matches || !fold.matches('details[data-group]') || !fold.open) return;
    folds().forEach(other => { if (other !== fold && other.matches('[data-group]')) other.open = false; });
  };

  root.addEventListener('click', onClick);
  root.addEventListener('toggle', onToggle, true);
  window.addEventListener('resize', apply);
  apply();
  return {
    // groups drawn after the first run are folded or opened by the same rule
    again() { word = ''; apply(); },
    stop() {
      root.removeEventListener('click', onClick);
      root.removeEventListener('toggle', onToggle, true);
      window.removeEventListener('resize', apply);
    },
  };
}
