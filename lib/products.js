'use strict';
const { HttpError } = require('./http');
const V = require('./validate');

const CATEGORIES = ['roupas', 'sneakers', 'acessorios', 'bolsas', 'conjuntos'];
const STATUSES = ['pendente', 'pago', 'em_separacao', 'enviado', 'entregue', 'cancelado'];
const PAID = ['pago', 'em_separacao', 'enviado', 'entregue'];

function publicImage(p) {
  if (p.image && p.image.startsWith('data:')) return `/api/img/${encodeURIComponent(p.id)}?v=${Date.parse(p.updatedAt) || 0}`;
  return p.image || '';
}

// Versão pública (loja): não expõe quantidade exata de estoque
function toPublic(p) {
  return {
    id: p.id, name: p.name, brand: p.brand, category: p.category, tags: p.tags, price: p.priceCents / 100,
    image: publicImage(p), color: p.color, sizes: p.sizes, description: p.description,
    bestseller: p.bestseller, new: p.isNew, soldOut: p.stock !== null && p.stock <= 0,
  };
}

// Versão admin: tudo
function toAdmin(p) {
  return { ...toPublic(p), stock: p.stock, active: p.active, isNew: p.isNew, updatedAt: p.updatedAt };
}

const IMG_URL_RE = /^(https:\/\/[^\s"'<>]+|\/img\/[A-Za-z0-9_\-./]+)$/;
const DATA_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

// Valida o corpo enviado pelo admin. `current` = produto existente (para manter upload atual)
function parseProductInput(b, current) {
  const name = V.str(b.name, 120, 'Nome');
  if (name.length < 2) throw new HttpError(400, 'Informe o nome do produto.');
  const price = Number(b.price);
  if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) throw new HttpError(400, 'Preço inválido.');
  const category = V.str(b.category, 40, 'Categoria').toLowerCase();
  if (!CATEGORIES.includes(category)) throw new HttpError(400, 'Categoria inválida.');

  const list = (v, max) => (Array.isArray(v) ? v : String(v || '').split(','))
    .map((x) => String(x).trim()).filter(Boolean).slice(0, max);
  const sizes = list(b.sizes, 30).map((s) => s.slice(0, 12));
  if (!sizes.length) throw new HttpError(400, 'Informe ao menos um tamanho (use "Único" se não houver).');
  const tags = list(b.tags, 20).map((t) => t.toLowerCase().slice(0, 30));

  let stock = null;
  if (b.stock !== null && b.stock !== undefined && b.stock !== '') {
    stock = Math.floor(Number(b.stock));
    if (!Number.isFinite(stock) || stock < 0 || stock > 1_000_000) throw new HttpError(400, 'Estoque inválido.');
  }

  let image = typeof b.image === 'string' ? b.image.trim() : '';
  if (current && image.startsWith('/api/img/')) image = current.image; // upload existente permanece
  else if (image && !DATA_RE.test(image) && !IMG_URL_RE.test(image)) throw new HttpError(400, 'Imagem inválida (use link https:// ou envie um arquivo).');
  if (image.startsWith('data:') && image.length > 700_000) throw new HttpError(413, 'Imagem muito grande.');

  const color = /^#[0-9a-fA-F]{6}$/.test(b.color || '') ? b.color : '#333333';

  return {
    name, brand: V.str(b.brand, 60, 'Marca'), category, tags, priceCents: Math.round(price * 100), image, color, sizes, stock,
    description: V.str(b.description, 3000, 'Descrição'),
    bestseller: !!b.bestseller, isNew: !!b.isNew, active: b.active === undefined ? true : !!b.active,
  };
}

module.exports = { CATEGORIES, STATUSES, PAID, toPublic, toAdmin, parseProductInput, publicImage };
