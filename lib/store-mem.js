'use strict';
// Banco em memória: SÓ para desenvolvimento local (npm run dev). Em produção use DATABASE_URL.
const crypto = require('crypto');

function create() {
  const users = new Map();
  const products = new Map();
  const orders = new Map();
  let seq = 1000;
  const now = () => new Date().toISOString();
  const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));

  const withUser = (o) => {
    const u = users.get(o.userId);
    return { ...clone(o), userName: u && u.name, userEmail: u && u.email };
  };
  const byDateDesc = (a, b) => (a.createdAt < b.createdAt ? 1 : -1);

  const impl = {
    async createUser({ name, email, phone, passwordHash, role = 'customer' }) {
      if ([...users.values()].some((u) => u.email === email)) { const e = new Error('EMAIL_TAKEN'); e.code = 'EMAIL_TAKEN'; throw e; }
      const u = { id: crypto.randomUUID(), name, email, phone: phone || '', passwordHash, role, tokenVersion: 0, failedLogins: 0, lockedUntil: null, createdAt: now() };
      users.set(u.id, u);
      return clone(u);
    },
    async getUserByEmail(email) { return clone([...users.values()].find((u) => u.email === email)); },
    async getUserById(id) { return clone(users.get(id)); },
    async updateProfile(id, { name, phone }) { const u = users.get(id); Object.assign(u, { name, phone: phone || '' }); return clone(u); },
    async setPassword(id, hash) { const u = users.get(id); Object.assign(u, { passwordHash: hash, tokenVersion: u.tokenVersion + 1, failedLogins: 0, lockedUntil: null }); return clone(u); },
    async recordLoginFailure(id, maxFails, lockMinutes) {
      const u = users.get(id);
      u.failedLogins += 1;
      if (u.failedLogins >= maxFails) u.lockedUntil = new Date(Date.now() + lockMinutes * 60000).toISOString();
      return { failedLogins: u.failedLogins, lockedUntil: u.lockedUntil };
    },
    async clearLoginFailures(id) { const u = users.get(id); if (u) { u.failedLogins = 0; u.lockedUntil = null; } },
    async countCustomers(sinceIso) {
      const c = [...users.values()].filter((u) => u.role === 'customer');
      return { total: c.length, recent: c.filter((u) => u.createdAt >= sinceIso).length };
    },
    async listCustomers() {
      return [...users.values()].filter((u) => u.role === 'customer').sort(byDateDesc).map((u) => {
        const os = [...orders.values()].filter((o) => o.userId === u.id);
        const paid = os.filter((o) => !['pendente', 'cancelado'].includes(o.status));
        return {
          id: u.id, name: u.name, email: u.email, phone: u.phone, createdAt: u.createdAt,
          ordersCount: paid.length, spentCents: paid.reduce((a, o) => a + o.totalCents, 0),
          lastOrderAt: os.length ? os.map((o) => o.createdAt).sort().pop() : null,
        };
      });
    },

    async listProducts({ activeOnly = false } = {}) {
      return clone([...products.values()].filter((p) => !activeOnly || p.active));
    },
    async getProduct(id) { return clone(products.get(id)); },
    async insertProduct(p) {
      if (products.has(p.id)) return undefined;
      const row = { ...clone(p), createdAt: now(), updatedAt: now() };
      products.set(p.id, row);
      return clone(row);
    },
    async updateProduct(id, p) {
      const cur = products.get(id);
      if (!cur) return undefined;
      const row = { ...cur, ...clone(p), id, createdAt: cur.createdAt, updatedAt: now() };
      products.set(id, row);
      return clone(row);
    },
    async decrementStock(id, qty) { const p = products.get(id); if (p && p.stock !== null) p.stock = Math.max(p.stock - qty, 0); },

    async createOrder(o) {
      const row = {
        id: o.id, number: ++seq, userId: o.userId, sessionId: o.sessionId, status: 'pendente', totalCents: o.totalCents,
        shippingCents: o.shippingCents, items: clone(o.items), shippingAddress: null, customerName: o.customerName,
        customerEmail: o.customerEmail, customerPhone: '', trackingCode: '',
        timeline: [{ status: 'pendente', at: now(), note: 'Pedido criado, aguardando pagamento' }],
        createdAt: now(), paidAt: null, updatedAt: now(),
      };
      orders.set(row.id, row);
      return withUser(row);
    },
    async getOrderById(id) { const o = orders.get(id); return o && withUser(o); },
    async getOrderBySession(sid) { const o = [...orders.values()].find((x) => x.sessionId === sid); return o && withUser(o); },
    async listOrdersByUser(userId) { return [...orders.values()].filter((o) => o.userId === userId).sort(byDateDesc).map(withUser); },
    async listOrders({ status, limit = 500 } = {}) {
      return [...orders.values()].filter((o) => !status || o.status === status).sort(byDateDesc).slice(0, limit).map(withUser);
    },
    async ordersSince(sinceIso, limit = 10000) {
      return [...orders.values()].filter((o) => o.createdAt >= sinceIso).sort(byDateDesc).slice(0, limit).map(withUser);
    },
    async markOrderPaid(id, { shippingAddress, customerName, customerEmail, customerPhone }) {
      const o = orders.get(id);
      if (!o || o.status !== 'pendente') return undefined;
      Object.assign(o, {
        status: 'pago', paidAt: now(), updatedAt: now(), shippingAddress: shippingAddress || null,
        customerName: customerName || o.customerName, customerEmail: customerEmail || o.customerEmail, customerPhone: customerPhone || o.customerPhone,
      });
      o.timeline.push({ status: 'pago', at: now(), note: 'Pagamento confirmado' });
      return withUser(o);
    },
    async markOrderCancelled(id, note) {
      const o = orders.get(id);
      if (!o || o.status !== 'pendente') return undefined;
      Object.assign(o, { status: 'cancelado', updatedAt: now() });
      o.timeline.push({ status: 'cancelado', at: now(), note });
      return withUser(o);
    },
    async updateOrderAdmin(id, { status, trackingCode, note }) {
      const o = orders.get(id);
      if (!o) return undefined;
      Object.assign(o, { status, trackingCode: trackingCode || '', updatedAt: now() });
      if (!o.paidAt && ['pago', 'em_separacao', 'enviado', 'entregue'].includes(status)) o.paidAt = now();
      o.timeline.push({ status, at: now(), note: note || '' });
      return withUser(o);
    },
  };

  async function init({ seedProducts = [], admin } = {}) {
    if (!products.size) for (const p of seedProducts) await impl.insertProduct(p);
    if (admin) { try { await impl.createUser({ ...admin, role: 'admin' }); } catch (e) { if (e.code !== 'EMAIL_TAKEN') throw e; } }
  }
  return { impl, init };
}

module.exports = { create };
