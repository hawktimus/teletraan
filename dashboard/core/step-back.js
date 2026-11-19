// The step back of the large panel, as a plain function so a node test can run it. core/schedule-run.js uses it
// when backStep() of core/schedule-hold.js is called.

// Where the loop of a list must stand so that the step it chooses next is the one shown before the step at
// position. count is the length of the list. nextFrom(place) is the place the loop would choose from that
// standing place, or -1 for none: it knows which steps are hidden, empty or left out right now, so going back
// lands on a step that can be shown. With no other step to show, the answer plays the same step again.
export function placeBefore(position, count, nextFrom) {
  for (let back = 1; back < count; back++) {
    const wanted = (((position - back) % count) + count) % count;
    if (nextFrom(wanted - 1) === wanted) return wanted - 1;
  }
  return position - 1;
}
