'use strict';
// Senhas (scrypt) e sessões (cookie HttpOnly assinado com HMAC). Nada de segredos no código.
const crypto = require('crypto');
const { promisify } = require('util');
const { HttpError, isProd } = require('./http');

const scrypt = promisify(crypto.scrypt);
const COOKIE = 'aq_session';
const MAX_AGE = 7 * 24 * 3600; // 7 dias
const N = 16384, R = 8, P = 1, KEYLEN = 64;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const dk = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${dk.toString('base64')}`;
}

async function verifyPassword(password, stored) {
  try {
    const [alg, n, r, p, salt, hash] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const expected = Buffer.from(hash, 'base64');
    const dk = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, {
      N: +n, r: +r, p: +p, maxmem: 64 * 1024 * 1024,
    });
    return dk.length === expected.length && crypto.timingSafeEqual(dk, expected);
  } catch {
    return false;
  }
}

let dummyHash;
// Gasta o mesmo tempo quando o e-mail não existe (evita descobrir e-mails pelo tempo de resposta)
async function fakeVerify(password) {
  dummyHash ||= await hashPassword('dummy-password-for-timing');
  await verifyPassword(password, dummyHash);
}

let devSecret;
function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (isProd()) throw new HttpError(500, 'Servidor mal configurado (SESSION_SECRET).');
  if (!devSecret) {
    devSecret = crypto.randomBytes(32).toString('hex');
    console.warn('[dev] SESSION_SECRET ausente: usando segredo temporário (sessões somem ao reiniciar).');
  }
  return devSecret;
}

const b64u = (b) => Buffer.from(b).toString('base64url');

function signToken(user) {
  const payload = b64u(JSON.stringify({ uid: user.id, tv: user.tokenVersion, exp: Math.floor(Date.now() / 1000) + MAX_AGE }));
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const good = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.exp > Date.now() / 1000 ? data : null;
  } catch {
    return null;
  }
}

function sessionCookie(token) {
  return `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}${isProd() ? '; Secure' : ''}`;
}
function clearCookie() {
  return `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${isProd() ? '; Secure' : ''}`;
}

module.exports = { COOKIE, hashPassword, verifyPassword, fakeVerify, signToken, verifyToken, sessionCookie, clearCookie };
