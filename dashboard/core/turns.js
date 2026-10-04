// For a panel that shows a different item from a list each time it comes
// round: const nextSponsor = makeTurns(); then nextSponsor(list) gives the
// next item, and the first one again after the last.

export function makeTurns() {
  let position = 0;

  return function next(list) {
    if (list.length === 0) return null;

    // The list can be shorter than last time, so count round the list as it is now
    const index = position % list.length;
    position = index + 1;
    return list[index];
  };
}
