// One place for calls to the service. A 401 sends the person back to the sign-in form.

export async function api(path, options) {
  const response = await fetch('/control/api/' + path, options);
  if (response.status === 401) {
    location.reload();
    throw new Error('Sign in again.');
  }
  const answer = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(answer.error || 'The request failed (' + response.status + ').');
  return answer;
}

export function post(path, body) {
  return api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
}

// "Oct 15 8:52 PM" from an ISO date
export function shortDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
