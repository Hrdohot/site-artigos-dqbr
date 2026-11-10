'use strict';
// Único ponto de entrada da API (1 função serverless). Rotas em lib/routes.js
const { HttpError, send, readRaw, parseJson, parseCookies } = require('../lib/http');
const A = require('../lib/auth');

async function currentUser(req) {
  const tok = A.verifyToken(parseCookies(req)[A.COOKIE]);
  if (!tok) return null;
  const u = await require('../lib/store').getUserById(tok.uid);
  return u && u.tokenVersion === tok.tv ? u : null;
}

async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = url.pathname.replace(/\/+$/, '');
    if (path === '/api/index' || path === '/api') path = '/api/' + (url.searchParams.get('p') || ''); // fallback de rewrite
    path = path.replace(/^\/api/, '') || '/';

    const method = req.method;
    const isWebhook = path === '/stripe/webhook';

    // proteção CSRF: requisições que alteram dados precisam vir do mesmo site
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !isWebhook) {
      const origin = req.headers.origin;
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      if (origin) { let ok = false; try { ok = new URL(origin).host === host; } catch {} if (!ok) throw new HttpError(403, 'Origem não permitida.'); }
      if (req.headers['content-length'] !== '0' && req.headers['content-type'] && !/application\/json/i.test(req.headers['content-type'])) throw new HttpError(415, 'Tipo de conteúdo inválido.');
    }

    const raw = ['GET', 'HEAD'].includes(method) ? Buffer.alloc(0) : await readRaw(req);
    const body = isWebhook ? {} : parseJson(raw);
    const user = path === '/stripe/webhook' ? null : await currentUser(req);

    await require('../lib/routes').dispatch({ req, res, path, query: url.searchParams, body, raw, user });
  } catch (e) {
    if (res.headersSent) return;
    if (e instanceof HttpError) return send(res, e.status, { error: e.message });
    console.error('Erro interno:', e);
    send(res, 500, { error: 'Erro interno. Tente novamente.' });
  }
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
