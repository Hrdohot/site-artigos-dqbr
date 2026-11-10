'use strict';
const crypto = require('crypto');
const { HttpError, send } = require('./http');
const A = require('./auth');
const V = require('./validate');
const store = require('./store');
const P = require('./products');
const { stripe, siteUrl, sessionDetails } = require('./stripe');
const { buildDashboard } = require('./stats');

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
const DAY = 86400000;

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role });

function customerOrder(o) {
  return {
    id: o.id, number: o.number, status: o.status, totalCents: o.totalCents, shippingCents: o.shippingCents,
    items: o.items, shippingAddress: o.shippingAddress, trackingCode: o.trackingCode, timeline: o.timeline,
    createdAt: o.createdAt, paidAt: o.paidAt,
  };
}
const adminOrder = (o) => ({
  ...customerOrder(o), customerName: o.customerName, customerEmail: o.customerEmail, customerPhone: o.customerPhone,
  userName: o.userName, userEmail: o.userEmail, updatedAt: o.updatedAt,
});

function login(res, user) {
  return { 'Set-Cookie': A.sessionCookie(A.signToken(user)) };
}

/* Confirma pagamento (usado pelo webhook e pela página de sucesso). Idempotente. */
async function settleSession(session) {
  const orderId = session.metadata && session.metadata.order_id;
  let order = (orderId && (await store.getOrderById(orderId))) || (await store.getOrderBySession(session.id));
  if (!order) return null;
  if (order.status === 'pendente') {
    if (session.payment_status === 'paid') {
      const updated = await store.markOrderPaid(order.id, sessionDetails(session));
      if (updated) for (const it of order.items) await store.decrementStock(it.id, it.qty);
    } else if (session.status === 'expired') {
      await store.markOrderCancelled(order.id, 'Pagamento não concluído (sessão expirada)');
    }
    order = await store.getOrderById(order.id);
  }
  return order;
}

const routes = [];
const on = (method, path, guard, handler) => {
  const keys = [];
  const re = new RegExp('^' + path.replace(/:([a-z]+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
  routes.push({ method, re, keys, guard, handler });
};

/* ================= público ================= */
on('GET', '/products', null, async () => {
  const list = await store.listProducts({ activeOnly: true });
  return { status: 200, body: { products: list.map(P.toPublic) }, headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300' } };
});

on('GET', '/img/:id', null, async ({ params, res }) => {
  const p = await store.getProduct(decodeURIComponent(params.id));
  if (!p || !p.image) throw new HttpError(404, 'Imagem não encontrada.');
  if (!p.image.startsWith('data:')) { res.statusCode = 302; res.setHeader('Location', p.image); res.end(); return { handled: true }; }
  const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(p.image);
  if (!m) throw new HttpError(404, 'Imagem não encontrada.');
  res.statusCode = 200;
  res.setHeader('Content-Type', m[1]);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.end(Buffer.from(m[2], 'base64'));
  return { handled: true };
});

/* ================= autenticação ================= */
on('POST', '/auth/register', null, async ({ body }) => {
  const user = {
    name: V.name(body.name), email: V.email(body.email), phone: V.phone(body.phone),
    passwordHash: await A.hashPassword(V.password(body.password)),
  };
  try {
    const u = await store.createUser({ ...user, role: 'customer' });
    return { status: 201, body: { user: publicUser(u) }, headers: login(null, u) };
  } catch (e) {
    if (e.code === 'EMAIL_TAKEN') throw new HttpError(409, 'Este e-mail já está cadastrado. Tente entrar.');
    throw e;
  }
});

on('POST', '/auth/login', null, async ({ body }) => {
  const emailAddr = V.email(body.email);
  const pw = typeof body.password === 'string' ? body.password.slice(0, 128) : '';
  const u = await store.getUserByEmail(emailAddr);
  if (!u) { await A.fakeVerify(pw); throw new HttpError(401, 'E-mail ou senha incorretos.'); }
  if (u.lockedUntil && Date.parse(u.lockedUntil) > Date.now()) {
    const mins = Math.ceil((Date.parse(u.lockedUntil) - Date.now()) / 60000);
    throw new HttpError(429, `Muitas tentativas. Tente novamente em ${mins} min.`);
  }
  if (!(await A.verifyPassword(pw, u.passwordHash))) {
    const r = await store.recordLoginFailure(u.id, MAX_FAILS, LOCK_MINUTES);
    if (r.lockedUntil && Date.parse(r.lockedUntil) > Date.now()) throw new HttpError(429, `Muitas tentativas. Conta bloqueada por ${LOCK_MINUTES} min.`);
    throw new HttpError(401, 'E-mail ou senha incorretos.');
  }
  await store.clearLoginFailures(u.id);
  return { body: { user: publicUser(u) }, headers: login(null, u) };
});

on('POST', '/auth/logout', null, async () => ({ body: { ok: true }, headers: { 'Set-Cookie': A.clearCookie() } }));
on('GET', '/auth/me', null, async ({ user }) => ({ body: { user: user ? publicUser(user) : null } }));

/* ================= cliente ================= */
on('PATCH', '/account', 'user', async ({ body, user }) => {
  const u = await store.updateProfile(user.id, { name: V.name(body.name), phone: V.phone(body.phone) });
  return { body: { user: publicUser(u) } };
});

on('POST', '/account/password', 'user', async ({ body, user }) => {
  if (!(await A.verifyPassword(String(body.current || '').slice(0, 128), user.passwordHash))) throw new HttpError(400, 'Senha atual incorreta.');
  const u = await store.setPassword(user.id, await A.hashPassword(V.password(body.next)));
  return { body: { ok: true }, headers: login(null, u) }; // novo cookie; sessões antigas deixam de valer
});

on('GET', '/orders', 'user', async ({ user }) => ({ body: { orders: (await store.listOrdersByUser(user.id)).map(customerOrder) } }));

on('POST', '/checkout', 'user', async ({ body, req, user }) => {
  const raw = Array.isArray(body.items) ? body.items.slice(0, 40) : [];
  if (!raw.length) throw new HttpError(400, 'Carrinho vazio.');

  const catalog = new Map((await store.listProducts({ activeOnly: true })).map((p) => [p.id, p]));
  const lines = new Map(); // id|tamanho -> linha
  const perProduct = new Map();
  for (const it of raw) {
    const p = catalog.get(String(it.id));
    const qty = Math.floor(Number(it.qty));
    if (!p || !(qty >= 1 && qty <= 20)) throw new HttpError(400, 'Há um item indisponível no carrinho. Atualize a página.');
    if (!p.sizes.includes(it.size)) throw new HttpError(400, `Tamanho inválido para ${p.name}.`);
    const key = `${p.id}|${it.size}`;
    lines.set(key, { p, size: it.size, qty: (lines.get(key)?.qty || 0) + qty });
    perProduct.set(p.id, (perProduct.get(p.id) || 0) + qty);
  }
  for (const [id, qty] of perProduct) {
    const p = catalog.get(id);
    if (p.stock !== null && qty > p.stock) throw new HttpError(409, p.stock > 0 ? `Só restam ${p.stock} unidade(s) de ${p.name}.` : `${p.name} está esgotado.`);
  }

  const items = [...lines.values()].map(({ p, size, qty }) => ({ id: p.id, name: p.name, brand: p.brand, size, qty, priceCents: p.priceCents, image: P.publicImage(p) }));
  const subtotal = items.reduce((a, i) => a + i.priceCents * i.qty, 0);
  const shippingCents = Math.max(0, parseInt(process.env.SHIPPING_CENTS || '0', 10) || 0);
  const orderId = crypto.randomUUID();
  const origin = siteUrl(req);

  const params = {
    mode: 'payment',
    locale: 'pt-BR',
    client_reference_id: orderId,
    customer_email: user.email,
    metadata: { order_id: orderId },
    line_items: items.map((i) => ({
      quantity: i.qty,
      price_data: { currency: 'brl', unit_amount: i.priceCents, product_data: { name: i.name, description: `Tamanho: ${i.size}`, metadata: { product_id: i.id, size: i.size } } },
    })),
    shipping_address_collection: { allowed_countries: ['BR'] },
    phone_number_collection: { enabled: true },
    shipping_options: [{
      shipping_rate_data: {
        type: 'fixed_amount', display_name: shippingCents ? 'Frete' : 'Frete grátis',
        fixed_amount: { amount: shippingCents, currency: 'brl' },
        delivery_estimate: { minimum: { unit: 'business_day', value: 5 }, maximum: { unit: 'business_day', value: 15 } },
      },
    }],
    success_url: `${origin}/sucesso.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/loja.html`,
  };
  if (process.env.STRIPE_INSTALLMENTS !== '0') params.payment_method_options = { card: { installments: { enabled: true } } };

  let session;
  try { session = await stripe().checkout.sessions.create(params); }
  catch (e) { console.error('stripe checkout error:', e.message); throw new HttpError(502, 'Não foi possível iniciar o pagamento. Tente novamente.'); }

  await store.createOrder({
    id: orderId, userId: user.id, sessionId: session.id, totalCents: subtotal + shippingCents, shippingCents,
    items, customerName: user.name, customerEmail: user.email,
  });
  return { body: { url: session.url } };
});

// Chamada pela página de sucesso: confirma na Stripe (caso o webhook demore) e devolve o pedido
on('GET', '/checkout/verify', 'user', async ({ query, user }) => {
  const sid = String(query.get('session_id') || '');
  const order = sid && (await store.getOrderBySession(sid));
  if (!order || (order.userId !== user.id && user.role !== 'admin')) throw new HttpError(404, 'Pedido não encontrado.');
  let fresh = order;
  if (order.status === 'pendente') {
    try { fresh = (await settleSession(await stripe().checkout.sessions.retrieve(sid))) || order; }
    catch (e) { console.error('verify error:', e.message); }
  }
  return { body: { order: customerOrder(fresh) } };
});

/* ================= webhook Stripe ================= */
on('POST', '/stripe/webhook', null, async ({ raw, req }) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) throw new HttpError(500, 'Webhook não configurado.');
  let event;
  try { event = stripe().webhooks.constructEvent(raw, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET); }
  catch { throw new HttpError(400, 'Assinatura inválida.'); }

  const s = event.data.object;
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
    case 'checkout.session.expired':
      await settleSession(s);
      break;
    case 'checkout.session.async_payment_failed': {
      const o = s.metadata && s.metadata.order_id && (await store.getOrderById(s.metadata.order_id));
      if (o) await store.markOrderCancelled(o.id, 'Pagamento recusado');
      break;
    }
  }
  return { body: { received: true } };
});

/* ================= admin ================= */
on('GET', '/admin/dashboard', 'admin', async () => {
  const now = new Date();
  const [orders, customers, products] = await Promise.all([
    store.ordersSince(new Date(now - 365 * DAY).toISOString()),
    store.countCustomers(new Date(now - 30 * DAY).toISOString()),
    store.listProducts(),
  ]);
  return { body: buildDashboard({ orders, customers, products, now }) };
});

on('GET', '/admin/orders', 'admin', async ({ query }) => {
  const status = query.get('status');
  if (status && !P.STATUSES.includes(status)) throw new HttpError(400, 'Status inválido.');
  return { body: { orders: (await store.listOrders({ status })).map(adminOrder) } };
});

on('PATCH', '/admin/orders/:id', 'admin', async ({ params, body }) => {
  if (!P.STATUSES.includes(body.status)) throw new HttpError(400, 'Status inválido.');
  const o = await store.updateOrderAdmin(params.id, {
    status: body.status, trackingCode: V.str(body.trackingCode, 60, 'Código de rastreio'), note: V.str(body.note, 300, 'Observação'),
  });
  if (!o) throw new HttpError(404, 'Pedido não encontrado.');
  return { body: { order: adminOrder(o) } };
});

on('GET', '/admin/products', 'admin', async () => ({ body: { products: (await store.listProducts()).map(P.toAdmin) } }));

on('POST', '/admin/products', 'admin', async ({ body }) => {
  const data = P.parseProductInput(body);
  const base = V.slugify(data.name);
  let created;
  for (let i = 0; i < 5 && !created; i++) {
    const id = i === 0 ? base : `${base}-${crypto.randomBytes(2).toString('hex')}`;
    created = await store.insertProduct({ id, ...data });
  }
  if (!created) throw new HttpError(500, 'Não foi possível gerar o código do produto.');
  return { status: 201, body: { product: P.toAdmin(created) } };
});

on('PUT', '/admin/products/:id', 'admin', async ({ params, body }) => {
  const cur = await store.getProduct(params.id);
  if (!cur) throw new HttpError(404, 'Produto não encontrado.');
  const p = await store.updateProduct(params.id, P.parseProductInput(body, cur));
  return { body: { product: P.toAdmin(p) } };
});

on('GET', '/admin/customers', 'admin', async () => ({ body: { customers: await store.listCustomers() } }));

async function dispatch(ctx) {
  for (const r of routes) {
    if (r.method !== ctx.req.method) continue;
    const m = r.re.exec(ctx.path);
    if (!m) continue;
    if (r.guard === 'user' && !ctx.user) throw new HttpError(401, 'Faça login para continuar.');
    if (r.guard === 'admin') {
      if (!ctx.user) throw new HttpError(401, 'Faça login para continuar.');
      if (ctx.user.role !== 'admin') throw new HttpError(403, 'Acesso restrito.');
    }
    ctx.params = Object.fromEntries(r.keys.map((k, i) => [k, m[i + 1]]));
    const out = await r.handler(ctx);
    if (out && out.handled) return;
    send(ctx.res, out.status || 200, out.body, out.headers);
    return;
  }
  throw new HttpError(404, 'Rota não encontrada.');
}

module.exports = { dispatch, publicUser };
