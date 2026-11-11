'use strict';
// Escolhe o driver de dados e prepara (tabelas, produtos iniciais, conta admin) na primeira chamada.
const auth = require('./auth');
const { HttpError, isProd } = require('./http');
const seedRaw = require('./seed-data/products.json');

const seedProducts = seedRaw.map((p) => ({
  id: p.id, name: p.name, brand: p.brand, category: p.category, tags: p.tags || [],
  priceCents: Math.round(p.price * 100), image: p.image || '', color: p.color || '#333333', sizes: p.sizes,
  stock: null, fulfillment: p.fulfillment || 'pronta_entrega', description: p.description || '', bestseller: !!p.bestseller, isNew: !!p.new, active: true,
}));

async function adminSeed() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (email && password) {
    return { name: process.env.ADMIN_NAME || 'Administrador', email, phone: '', passwordHash: await auth.hashPassword(password) };
  }
  return null;
}

let built;
function build() {
  if (built) return built;
  let driver, mode;
  if (process.env.DATABASE_URL) { driver = require('./store-pg').create(); mode = 'postgres'; }
  else if (!isProd()) { driver = require('./store-mem').create(); mode = 'memória'; }
  else throw new HttpError(500, 'Servidor mal configurado (DATABASE_URL).');

  let p;
  const ready = () => p || (p = (async () => {
    let admin = await adminSeed();
    if (!admin && mode === 'memória') {
      const pw = require('crypto').randomBytes(9).toString('base64url');
      console.warn(`[dev] Banco em memória. Admin criado: admin@local.test / ${pw}`);
      admin = { name: 'Admin Local', email: 'admin@local.test', phone: '', passwordHash: await auth.hashPassword(pw) };
    } else if (!admin) {
      console.warn('ADMIN_EMAIL/ADMIN_PASSWORD não definidos: nenhuma conta admin foi criada.');
    }
    await driver.init({ seedProducts, admin });
  })().catch((e) => { p = null; throw e; }));

  const store = {};
  for (const k of Object.keys(driver.impl)) store[k] = async (...a) => { await ready(); return driver.impl[k](...a); };
  store.mode = mode;
  built = store;
  return built;
}

// proxy preguiçoso: nada é conectado até o primeiro uso
module.exports = new Proxy({}, { get: (_, k) => build()[k] });
module.exports.seedProducts = seedProducts;
