// GET update-info: the lines the Update tab shows for the git path, with the user and host of this Mini.

import { sendJson } from '../lib/router.js';

function field(text, name) {
  const found = new RegExp('^' + name + ': ([A-Za-z0-9._-]+)$', 'm').exec(text);
  return found ? found[1] : '';
}

export function register(router, ctx) {
  router.get('/update-info', async (req, res) => {
    let answer = '';
    try {
      answer = await ctx.helper('status');
    } catch (error) {
      answer = '';
    }
    const user = field(answer, 'user') || '<user>';
    const hostName = String(req.headers.host || '').split(':')[0].replace(/[^A-Za-z0-9.-]/g, '') || field(answer, 'host') || 'teletraan.local';
    const remote = user + '@' + hostName + ':/srv/teletraan.git';
    sendJson(res, 200, {
      user: user,
      host: hostName,
      remoteLine: 'git remote add mini ' + remote,
      pushLine: 'git push mini main',
      cloneLine: 'git clone ' + remote + ' teletraan',
    });
  });
}
