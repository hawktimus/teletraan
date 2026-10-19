// Takes keys and calendar links out of text that is going to be shared (the log bundle). Every line of the bundle goes
// through redactLine, so a value that was logged by mistake still never leaves the Teletraan computer. Each rule
// replaces the secret with <hidden> and keeps the words around it, so the line still reads.

export const hidden = '<hidden>';

// The names of the keys in local.env, and any other setting whose name says it holds a secret
const named = /\b((?:export\s+)?(?:SANITY_WRITE_TOKEN|MONDAY_API_TOKEN|TBA_AUTH_KEY|GOOGLE_API_KEY|MATCH13_API_KEY|CONTROL_PIN|CALENDAR_[A-Za-z0-9_]*_URL|[A-Za-z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY)[A-Za-z0-9_]*))\s*[=:]\s*("[^"]*"|'[^']*'|\S*)/g;
const bearer = /\bBearer\s+[^\s"']+/gi;
// A JWT: three base64url parts joined by dots
const jwt = /\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
// Calendar links: webcal, an .ics file, or an address with calendar in it
const calendarLink = /\b(?:webcal:\/\/\S+|https?:\/\/\S*(?:\.ics|calendar|band\.us)\S*)/gi;
// A secret in the query of a link
const queryKey = /([?&](?:token|key|api_key|apikey|secret|auth|sig|signature|password)=)[^&\s"']+/gi;
// Any long run of letters, digits, dashes and underscores looks like a token
const longToken = /\b[A-Za-z0-9_-]{40,}\b/g;

export function redactLine(line) {
  return String(line)
    .replace(named, (all, name) => name + '=' + hidden)
    .replace(bearer, 'Bearer ' + hidden)
    .replace(calendarLink, hidden)
    .replace(queryKey, '$1' + hidden)
    .replace(jwt, hidden)
    .replace(longToken, hidden);
}

export function redactText(text) {
  return String(text).split('\n').map(redactLine).join('\n');
}
