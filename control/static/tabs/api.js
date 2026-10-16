// Calls to the control API for the tabs. A failed call gives a plain sentence, never a status code alone.

export async function api(method, path, body) {
  try {
    const response = await fetch('/control/api' + path, {
      method: method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      credentials: 'same-origin',
    });
    let data = null;
    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }
    if (response.status === 401) return { ok: false, data: null, error: 'Enter the PIN first. Reload the page.' };
    if ([502, 503, 504].includes(response.status) && !(data && data.error)) return { ok: false, data: data, error: 'The control service on the Teletraan computer is not answering. Wait a minute and press the button again.' };
    if (!response.ok) return { ok: false, data: data, error: (data && data.error) || 'The Teletraan computer answered with a problem (' + response.status + ').' };
    return { ok: true, data: data, error: '' };
  } catch (error) {
    return { ok: false, unreachable: true, data: null, error: 'The Teletraan computer could not be reached. Check the WiFi, or use the Tailscale name.' };
  }
}

// Puts the tab stylesheet in the page once
export function useStyles() {
  if (document.getElementById('tabs-css')) return;
  const link = document.createElement('link');
  link.id = 'tabs-css';
  link.rel = 'stylesheet';
  link.href = new URL('./tabs.css', import.meta.url).href;
  document.head.appendChild(link);
}

// The line right under the buttons that were pressed, so the result is on the screen where the finger is. It is
// made the first time and reused. state is working, done, bad or wait; the CSS gives each a color.
export function showResult(button, state, words) {
  const holder = button.closest('.buttons') || button.parentElement;
  let line = holder.nextElementSibling;
  if (!line || !line.classList.contains('result')) {
    line = document.createElement('p');
    line.className = 'result';
    line.setAttribute('role', 'status');
    holder.after(line);
  }
  line.dataset.state = state;
  line.textContent = words;
}

// A button that needs a confirm. A click opens a line under the button with a countdown; the action
// runs when it reaches 0, or at once with Do it now, and Cancel stops it.
export function confirmed(button, seconds, label, run) {
  button.addEventListener('click', () => {
    if (button.dataset.counting === 'yes') return;
    button.dataset.counting = 'yes';

    const bar = document.createElement('div');
    bar.className = 'countdown';
    const words = document.createElement('span');
    const now = document.createElement('button');
    now.type = 'button';
    now.className = 'act';
    now.textContent = 'Do it now';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'act quiet';
    cancel.textContent = 'Cancel';
    bar.append(words, now, cancel);
    button.after(bar);

    let left = seconds;
    const show = () => { words.textContent = label + ' in ' + left + ' seconds.'; };
    const end = () => { clearInterval(timer); bar.remove(); delete button.dataset.counting; };
    const timer = setInterval(() => {
      left -= 1;
      if (left <= 0) { end(); run(); } else show();
    }, 1000);
    show();
    now.addEventListener('click', () => { end(); run(); });
    cancel.addEventListener('click', end);
  });
}
