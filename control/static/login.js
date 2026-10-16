// The sign-in form.

const message = document.getElementById('message');
const form = document.getElementById('form');

async function start() {
  const session = await (await fetch('/control/api/session')).json();
  if (session.signedIn) {
    location.reload();
    return;
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const response = await fetch('/control/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: document.getElementById('pin').value }),
  });
  const answer = await response.json();
  if (response.ok) {
    location.reload();
    return;
  }
  message.textContent = answer.error || 'That did not work.';
  message.className = 'bad';
});

start();
