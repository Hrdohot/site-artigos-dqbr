'use strict';
// Números do dashboard, calculados em JS a partir dos pedidos (igual para qualquer banco)
const { PAID } = require('./products');
const { orderOutsideArea } = require('./shop-rules');

const TZ = process.env.STORE_TZ || 'America/Sao_Paulo';
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayKey = (d) => dayFmt.format(new Date(d)); // YYYY-MM-DD no fuso da loja

function buildDashboard({ orders, customers, products, now = new Date() }) {
  const DAY = 86400000;
  const since30 = now.getTime() - 30 * DAY;
  const paid = orders.filter((o) => PAID.includes(o.status));
  const paid30 = paid.filter((o) => Date.parse(o.paidAt || o.createdAt) >= since30);

  const revenue30 = paid30.reduce((a, o) => a + o.totalCents, 0);

  // série diária (30 dias, inclusive dias sem venda)
  const days = [];
  for (let i = 29; i >= 0; i--) days.push(dayKey(now.getTime() - i * DAY));
  const byDay = Object.fromEntries(days.map((d) => [d, { date: d, cents: 0, orders: 0 }]));
  for (const o of paid30) {
    const k = dayKey(o.paidAt || o.createdAt);
    if (byDay[k]) { byDay[k].cents += o.totalCents; byDay[k].orders += 1; }
  }

  const statusCounts = {};
  for (const o of orders) statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;

  const top = {};
  for (const o of paid30) for (const it of o.items) {
    const t = (top[it.id] ||= { id: it.id, name: it.name, qty: 0, cents: 0 });
    t.qty += it.qty; t.cents += it.qty * it.priceCents;
  }

  return {
    kpis: {
      revenue30Cents: revenue30,
      orders30: paid30.length,
      avgTicket30Cents: paid30.length ? Math.round(revenue30 / paid30.length) : 0,
      customersTotal: customers.total,
      customersNew30: customers.recent,
      toShip: (statusCounts.pago || 0) + (statusCounts.em_separacao || 0),
      awaitingPayment: statusCounts.pendente || 0,
      checkAddress: orders.filter((o) => ['pago', 'em_separacao'].includes(o.status) && orderOutsideArea(o)).length,
    },
    daily: days.map((d) => byDay[d]),
    statusCounts,
    topProducts: Object.values(top).sort((a, b) => b.cents - a.cents).slice(0, 5),
    lowStock: products.filter((p) => p.active && p.stock !== null && p.stock <= 3)
      .sort((a, b) => a.stock - b.stock).slice(0, 8).map((p) => ({ id: p.id, name: p.name, stock: p.stock })),
    recentOrders: orders.slice(0, 8).map((o) => ({
      id: o.id, number: o.number, status: o.status, totalCents: o.totalCents, createdAt: o.createdAt, customer: o.userName || o.customerName,
    })),
  };
}

module.exports = { buildDashboard, dayKey };
