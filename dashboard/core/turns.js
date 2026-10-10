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

// The same for a panel that shows a page of items at a time:
// const nextPage = makePages(3); then nextPage(list) gives
//   items     the people or things on this page, at most 3
//   upcoming  the ones on the page after it, so their pictures can be loaded
//             early. It is empty when there is only one page.
//   number    this page, counting from 1
//   count     how many pages there are
// The first page comes round again after the last.
//
// A panel whose page size can change, because a setting changes it, gives the size
// it wants at each turn: nextPage(list, 2). The size in makePages(4) is the one used
// when a turn gives none. After a change the next page starts at the first item
// that has not been shown yet, so nobody is skipped.

export function makePages(size) {
  let position = 0;
  let shownSize = size;

  function pageOf(list, index, perPage) {
    return list.slice(index * perPage, index * perPage + perPage);
  }

  return function next(list, perPage = size) {
    // A new size starts at the first item not shown yet. Rounding down repeats an item rather than
    // skipping one, and when every item has been shown the first page comes next.
    if (perPage !== shownSize) {
      const unseen = position * shownSize;
      position = unseen >= list.length ? 0 : Math.floor(unseen / perPage);
      shownSize = perPage;
    }
    const count = Math.max(1, Math.ceil(list.length / perPage));

    // The list can be shorter than last time, so count round the pages as they are now
    const index = position % count;
    position = index + 1;

    return {
      items: pageOf(list, index, perPage),
      upcoming: count > 1 ? pageOf(list, (index + 1) % count, perPage) : [],
      number: index + 1,
      count: count,
    };
  };
}
