// The sign-in form. A wrong PIN says so and how many tries are left. After repeated wrong PINs the service blocks this address for
// a while (lib/auth.js); the form then says how long and keeps the button off until the time is up. The PIN and the cookie are
// exactly what they were: nothing about signing in changed.

import { apiPath } from './base.js';
import { waitWords } from './words.js';

const message = document.getElementById('message');
const form = document.getElementById('form');
const button = document.getElementById('go');
const field = document.getElementById('pin');
let countdown = null;

function say(words, bad) {
  message.textContent = words;
  message.className = bad ? 'notice' : 'muted';
}

function block(seconds) {
  clearInterval(countdown);
  let left = seconds;
  button.disabled = true;
  field.disabled = true;
  const paint = () => say('Too many wrong tries, so sign-in is paused. ' + waitWords(left), true);
  paint();
  countdown = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      clearInterval(countdown);
      button.disabled = false;
      field.disabled = false;
      say('You can try again. Type the PIN.', false);
      field.focus();
    } else if (left % 5 === 0 || left < 90) {
      paint();
    }
  }, 1000);
}

// With no CONTROL_PIN in local.env nothing can sign in, so the form is replaced by the one thing to do
function needPin() {
  form.hidden = true;
  say('Set a PIN in the settings file. Over SSH, add the line CONTROL_PIN=, then 4 to 12 digits, to local.env, then reload this page (docs/control-page.md, First time).', true);
}

async function start() {
  const session = await (await fetch(apiPath('session'))).json();
  if (session.signedIn) location.reload();
  else if (session.pinSet === false) needPin();
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  button.disabled = true;
  say('Checking the PIN...', false);
  let response;
  let answer = {};
  try {
    response = await fetch(apiPath('login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: field.value }),
    });
    answer = await response.json();
  } catch (error) {
    button.disabled = false;
    say('The computer could not be reached. Check the WiFi or the private tunnel, then try again.', true);
    return;
  }
  if (response.ok) {
    location.reload();
    return;
  }
  if (answer.pinNotSet) {
    needPin();
    return;
  }
  if (response.status === 429 && answer.blockedSeconds) {
    block(answer.blockedSeconds);
    return;
  }
  button.disabled = false;
  const left = typeof answer.triesLeft === 'number' ? ' ' + answer.triesLeft + (answer.triesLeft === 1 ? ' try' : ' tries') + ' left.' : '';
  say((answer.error || 'That did not work.') + left, true);
  field.value = '';
  field.focus();
});

start().catch(() => {});
