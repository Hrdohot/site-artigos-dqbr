'use strict';
const { HttpError } = require('./http');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function str(v, max, field) {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string') throw new HttpError(400, `Campo inválido: ${field}.`);
  const s = v.trim();
  if (s.length > max) throw new HttpError(400, `${field} muito longo.`);
  return s;
}

function email(v) {
  const e = str(v, 254, 'E-mail').toLowerCase();
  if (!EMAIL_RE.test(e)) throw new HttpError(400, 'Informe um e-mail válido.');
  return e;
}

function name(v) {
  const n = str(v, 80, 'Nome');
  if (n.length < 2) throw new HttpError(400, 'Informe seu nome.');
  return n;
}

function phone(v) {
  const p = str(v, 30, 'Telefone');
  if (!p) return '';
  const digits = p.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) throw new HttpError(400, 'Telefone inválido (use DDD + número).');
  return digits;
}

function password(v) {
  if (typeof v !== 'string' || v.length < 8) throw new HttpError(400, 'A senha deve ter pelo menos 8 caracteres.');
  if (v.length > 128) throw new HttpError(400, 'Senha muito longa.');
  return v;
}

const slugify = (s) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'produto';

module.exports = { str, email, name, phone, password, slugify };
