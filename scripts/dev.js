'use strict';
// Servidor local: arquivos estáticos + /api (mesmo código da Vercel).
// Sem DATABASE_URL usa banco em memória (dados somem ao reiniciar). Uso: npm run dev
const http = require('http');
const fs = require('fs');
const path = require('path');
const api = require('../api/index.js');

const ROOT = path.join(__dirname, '..', 'public');
const PORT = process.env.PORT || 3000;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.ico': 'image/x-icon',
};
const PRIVATE = /^\/\./;

http.createServer((req, res) => {
  const pathname = decodeURIComponent(req.url.split('?')[0]);
  if (pathname.startsWith('/api/')) return api(req, res);
  if (PRIVATE.test(pathname) || pathname.includes('..')) { res.statusCode = 404; return res.end('Not found'); }
  let file = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Loja em http://localhost:${PORT}`));
