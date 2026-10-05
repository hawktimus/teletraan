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

export function makePages(size) {
  let position = 0;

  function pageOf(list, index) {
    return list.slice(index * size, index * size + size);
  }

  return function next(list) {
    const count = Math.max(1, Math.ceil(list.length / size));

    // The list can be shorter than last time, so count round the pages as they are now
    const index = position % count;
    position = index + 1;

    return {
      items: pageOf(list, index),
      upcoming: count > 1 ? pageOf(list, (index + 1) % count) : [],
      number: index + 1,
      count: count,
    };
  };
}
