// Test the token, on the Monday tab of Dashboard Settings (inputs/monday-token-input.js). It asks the
// control page of the Mini to run the helper word monday-check, which asks Monday who the token belongs
// to. The answer is the name of the account or the reason it failed. The token itself never reaches the
// Studio: the Mini reads it from its own settings file and the answer holds a name only.
//
// Plain functions only, so that tests/schemas.test.mjs can run them with node.

import { helperAddress, controlAddress } from '../inputs/control-address.js';

export const checkWord = 'monday-check';

export const words = {
  asking: 'Asking Monday.',
  unreachable: 'The control page could not be reached. Open ' + controlAddress + ' on the WiFi of the shop and try again.',
  noAnswer: 'The Mini gave no answer.',
};

// What the Mini answered, as a line: { text, failed }. The answer is { ok, account, output, error }; the
// account name is the first line of output when account is missing.
export function answerLine(answer) {
  const source = answer && typeof answer === 'object' ? answer : {};
  const first = text => (typeof text === 'string' ? text.trim().split('\n')[0].trim() : '');

  if (source.ok === false) return { text: first(source.error) || first(source.output) || words.noAnswer, failed: true };
  const account = first(source.account) || first(source.output);
  if (source.ok === true && account) return { text: 'Connected as ' + account + '.', failed: false };
  return { text: first(source.error) || words.noAnswer, failed: true };
}

// Asks the helper. fetcher is fetch, or a stand-in. This never throws: a page that cannot be reached is a line.
export async function checkToken(fetcher) {
  try {
    const response = await fetcher(helperAddress, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: checkWord, args: [] }),
    });
    if (!response || typeof response.json !== 'function') return { text: words.unreachable, failed: true };
    return answerLine(await response.json());
  } catch (error) {
    return { text: words.unreachable, failed: true };
  }
}
