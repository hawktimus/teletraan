// Finds a date written in a ticker line, such as "by Nov 26th" or "April 2-4", and says
// whether it has passed. A line with no Expires set in Studio would otherwise stay on the
// ticker after its own date. Only a line with no Expires is judged this way (panels/ticker).
//
// A written date has no year, so the nearest one is taken: within six months back it has
// passed, within six months ahead it is still to come. "April 2-4" seen in November is the
// coming April. In a range the last day counts, and in a line with two dates the later one.

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// A month name or its short form, then a day, then maybe a second day after a dash
const datePattern = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*[-–]\s*(\d{1,2})(?:st|nd|rd|th)?)?\b/gi;

const dayMs = 24 * 60 * 60 * 1000;
const halfYearMs = 183 * dayMs;

// The nearest date with this month and day, as the end of that day
function nearest(month, day, now) {
  const options = [-1, 0, 1].map(shift => new Date(now.getFullYear() + shift, month, day, 23, 59, 59));
  return options
    .filter(date => date.getMonth() === month)
    .sort((first, second) => Math.abs(first - now) - Math.abs(second - now))[0] || null;
}

// The dates written in the text, each as the end of its last day
export function datesIn(text, now = new Date()) {
  const found = [];
  String(text || '').replace(datePattern, (match, name, first, last) => {
    const month = months.indexOf(name.slice(0, 3).toLowerCase());
    const day = Number(last || first);
    if (month >= 0 && day >= 1 && day <= 31) {
      const date = nearest(month, day, now);
      if (date) found.push(date);
    }
    return match;
  });
  return found;
}

// True when the text names a date and the latest one it names is over
export function lineDatePassed(text, now = new Date()) {
  const dates = datesIn(text, now);
  if (dates.length === 0) return false;
  const latest = dates.sort((first, second) => second - first)[0];
  return latest < now && now - latest < halfYearMs;
}
