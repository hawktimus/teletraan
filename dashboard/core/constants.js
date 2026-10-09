// Values that have one right answer. Dashboard Settings still keeps a field for
// each of them, hidden, so a page saved earlier opens and publishes as before,
// but the screen never reads what is stored there. To change one, change it
// here and in the doc that names it.

// Night mode (docs/night-mode.md): black from 11:30 pm to 11:30 am, in the time
// zone of the Look page. The screen is left on all night, so it needs a fixed
// quiet time that nobody has to set.
export const nightStart = '23:30';
export const nightEnd = '11:30';

// Presentations (docs/presentations.md): how long the title card waits for the
// first press of the clicker, and how long a talk may run past its slot. The
// same five minutes for every talk, so one talk cannot hold up the next.
export const noShowMinutes = 5;
export const graceMinutes = 5;
