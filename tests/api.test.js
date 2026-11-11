'use strict';
// Teste de integração da API. Uso:
//   node tests/api.test.js                      (banco em memória)
//   DATABASE_URL=x node tests/api.test.js       (Postgres local via tests/shims.js)
process.env.SESSION_SECRET = 'x'.repeat(40);
process.env.ADMIN_EMAIL = 'owner@test.com';
process.env.ADMIN_PASSWORD = 'AdminPass123';
process.env.STRIPE_SECRET_KEY = 'sk_test_x';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x';
const { sessions } = require('./shims');
const http = require('http');
const assert = require('assert');
const handler = require('../api/index.js');

const server = http.createServer(handler);
let base;

function client() {
  let cookie = '';
  const call = async (method, path, body, headers = {}) => {
    const r = await fetch(base + path, {
      method, redirect: 'manual',
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.startsWith('aq_session=;') || /Max-Age=0/.test(sc) ? '' : sc.split(';')[0];
    const ct = r.headers.get('content-type') || '';
    return { status: r.status, headers: r.headers, data: ct.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer()), cookie: sc };
  };
  call.cookie = () => cookie;
  call.setCookie = (c) => { cookie = c; };
  return call;
}

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log('  ✓', name); } catch (e) { console.error('  ✗', name, '\n   ', e.message); process.exitCode = 1; } };

(async () => {
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
  console.log('driver:', process.env.DATABASE_URL ? 'postgres' : 'memória');

  const anon = client(), ana = client(), admin = client(), bob = client();
  let productId, orderSession, orderId, adminProducts;

  await t('catálogo público (sem estoque exposto)', async () => {
    const r = await anon('GET', '/api/products');
    assert.equal(r.status, 200);
    assert.equal(r.data.products.length, 12);
    assert.ok(typeof r.data.products[0].price === 'number');
    assert.ok(!('stock' in r.data.products[0]) && !('active' in r.data.products[0]));
    productId = r.data.products[0].id;
  });

  await t('registro: validações', async () => {
    assert.equal((await anon('POST', '/api/auth/register', { name: 'A', email: 'x', password: '123' })).status, 400);
    assert.equal((await anon('POST', '/api/auth/register', { name: 'Ana', email: 'ana@test.com', password: 'curta' })).status, 400);
  });

  await t('registro + sessão + me', async () => {
    const r = await ana('POST', '/api/auth/register', { name: 'Ana Silva', email: 'Ana@Test.com', phone: '(48) 99999-0000', password: 'senha-forte-1' });
    assert.equal(r.status, 201);
    assert.equal(r.data.user.role, 'customer');
    assert.ok(!JSON.stringify(r.data).includes('passwordHash'));
    assert.match(r.cookie, /HttpOnly/); assert.match(r.cookie, /SameSite=Lax/);
    const me = await ana('GET', '/api/auth/me');
    assert.equal(me.data.user.email, 'ana@test.com');
    assert.equal(me.data.user.phone, '48999990000');
  });

  await t('e-mail duplicado e e-mail do admin não podem ser registrados', async () => {
    assert.equal((await anon('POST', '/api/auth/register', { name: 'Ana 2', email: 'ana@test.com', password: 'senha-forte-1' })).status, 409);
    assert.equal((await anon('POST', '/api/auth/register', { name: 'Intruso', email: 'owner@test.com', password: 'senha-forte-1' })).status, 409);
  });

  await t('login errado, bloqueio após 5 tentativas', async () => {
    await bob('POST', '/api/auth/register', { name: 'Bob', email: 'bob@test.com', password: 'senha-forte-2' });
    const c = client();
    for (let i = 0; i < 4; i++) assert.equal((await c('POST', '/api/auth/login', { email: 'bob@test.com', password: 'errada-123' })).status, 401);
    assert.equal((await c('POST', '/api/auth/login', { email: 'bob@test.com', password: 'errada-123' })).status, 429);
    assert.equal((await c('POST', '/api/auth/login', { email: 'bob@test.com', password: 'senha-forte-2' })).status, 429); // mesmo com a senha certa
    assert.equal((await c('POST', '/api/auth/login', { email: 'ninguem@test.com', password: 'qualquer-123' })).status, 401);
  });

  await t('CSRF: origem diferente é bloqueada', async () => {
    const r = await ana('POST', '/api/auth/logout', {}, { Origin: 'https://evil.example' });
    assert.equal(r.status, 403);
  });

  await t('rotas protegidas: anônimo 401, cliente 403 no admin', async () => {
    assert.equal((await anon('GET', '/api/orders')).status, 401);
    assert.equal((await anon('GET', '/api/admin/dashboard')).status, 401);
    for (const p of ['/api/admin/dashboard', '/api/admin/orders', '/api/admin/products', '/api/admin/customers'])
      assert.equal((await ana('GET', p)).status, 403, p);
    assert.equal((await ana('POST', '/api/admin/products', { name: 'Hack', price: 1, category: 'roupas', sizes: ['M'] })).status, 403);
    assert.equal((await ana('PATCH', '/api/admin/orders/x', { status: 'entregue' })).status, 403);
  });

  await t('admin entra com a senha definida no ambiente', async () => {
    assert.equal((await admin('POST', '/api/auth/login', { email: 'owner@test.com', password: 'errada' })).status, 401);
    const r = await admin('POST', '/api/auth/login', { email: 'owner@test.com', password: 'AdminPass123' });
    assert.equal(r.status, 200); assert.equal(r.data.user.role, 'admin');
  });

  await t('admin cria produto com upload, controla estoque', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    assert.equal((await admin('POST', '/api/admin/products', { name: 'Ruim', price: -5, category: 'roupas', sizes: 'M' })).status, 400);
    assert.equal((await admin('POST', '/api/admin/products', { name: 'Ruim', price: 5, category: 'roupas', sizes: 'M', image: 'javascript:alert(1)' })).status, 400);
    const r = await admin('POST', '/api/admin/products', { name: 'Camiseta Teste Ç', brand: 'AQ', category: 'roupas', price: 100.5, sizes: 'P, M, G', tags: 'camiseta, teste', stock: 5, image: png, isNew: true });
    assert.equal(r.status, 201);
    assert.equal(r.data.product.id, 'camiseta-teste-c');
    assert.equal(r.data.product.price, 100.5);
    assert.match(r.data.product.image, /^\/api\/img\/camiseta-teste-c\?v=/);
    const pub = await anon('GET', '/api/products');
    assert.ok(pub.data.products.find((p) => p.id === 'camiseta-teste-c'));
    const img = await anon('GET', r.data.product.image);
    assert.equal(img.headers.get('content-type'), 'image/png');
    assert.ok(img.data.length > 20);
  });

  await t('checkout exige login e valida itens/estoque no servidor', async () => {
    assert.equal((await anon('POST', '/api/checkout', { items: [{ id: productId, size: '40', qty: 1 }] })).status, 401);
    assert.equal((await ana('POST', '/api/checkout', { items: [] })).status, 400);
    assert.equal((await ana('POST', '/api/checkout', { items: [{ id: 'nao-existe', size: 'M', qty: 1 }] })).status, 400);
    assert.equal((await ana('POST', '/api/checkout', { items: [{ id: 'camiseta-teste-c', size: 'XL', qty: 1 }] })).status, 400);
    assert.equal((await ana('POST', '/api/checkout', { items: [{ id: 'camiseta-teste-c', size: 'M', qty: 6 }] })).status, 409);
  });

  await t('checkout: preço vem do banco, não do navegador', async () => {
    const r = await ana('POST', '/api/checkout', { items: [{ id: 'camiseta-teste-c', size: 'M', qty: 2, price: 0.01, priceCents: 1 }, { id: 'camiseta-teste-c', size: 'M', qty: 1 }] });
    assert.equal(r.status, 200);
    assert.match(r.data.url, /^https:\/\/checkout\.stripe\.test\//);
    const s = [...sessions.values()].pop();
    orderSession = s.id;
    assert.equal(s.params.line_items.length, 1);
    assert.equal(s.params.line_items[0].quantity, 3);
    assert.equal(s.params.line_items[0].price_data.unit_amount, 10050);
    assert.equal(s.params.customer_email, 'ana@test.com');
    const orders = (await ana('GET', '/api/orders')).data.orders;
    assert.equal(orders.length, 1);
    assert.equal(orders[0].status, 'pendente'); assert.equal(orders[0].totalCents, 30150);
    assert.ok(orders[0].number >= 1001);
    orderId = orders[0].id;
    assert.ok(!('sessionId' in orders[0]) && !('userId' in orders[0]));
  });

  await t('pedido de uma pessoa não aparece para outra', async () => {
    assert.equal((await bob('GET', '/api/orders')).data.orders.length, 0);
    assert.equal((await bob('GET', '/api/checkout/verify?session_id=' + orderSession)).status, 404);
  });

  await t('webhook: assinatura inválida 400; pago confirma, baixa estoque e é idempotente', async () => {
    const s = sessions.get(orderSession);
    s.payment_status = 'paid'; s.status = 'complete';
    const ev = JSON.stringify({ type: 'checkout.session.completed', data: { object: s } });
    const post = (sig) => fetch(base + '/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': sig, 'Content-Type': 'application/json' }, body: ev });
    assert.equal((await post('forged')).status, 400);
    assert.equal((await post('valid')).status, 200);
    assert.equal((await post('valid')).status, 200);
    const o = (await ana('GET', '/api/orders')).data.orders[0];
    assert.equal(o.status, 'pago'); assert.equal(o.shippingAddress.city, 'Florianópolis');
    assert.equal(o.timeline.filter((e) => e.status === 'pago').length, 1);
    adminProducts = (await admin('GET', '/api/admin/products')).data.products;
    assert.equal(adminProducts.find((p) => p.id === 'camiseta-teste-c').stock, 2); // 5 - 3, só uma vez
  });

  await t('verify confirma pedido mesmo sem webhook', async () => {
    const r = await ana('POST', '/api/checkout', { items: [{ id: 'camiseta-teste-c', size: 'P', qty: 1 }] });
    assert.equal(r.status, 200);
    const s = [...sessions.values()].pop();
    assert.equal((await ana('GET', '/api/checkout/verify?session_id=' + s.id)).data.order.status, 'pendente');
    s.payment_status = 'paid';
    assert.equal((await ana('GET', '/api/checkout/verify?session_id=' + s.id)).data.order.status, 'pago');
    assert.equal((await admin('GET', '/api/admin/products')).data.products.find((p) => p.id === 'camiseta-teste-c').stock, 1);
  });

  await t('admin acompanha pedidos e atualiza status/rastreio; cliente vê', async () => {
    const list = (await admin('GET', '/api/admin/orders')).data.orders;
    assert.equal(list.length, 2);
    assert.equal(list[0].userEmail, 'ana@test.com');
    assert.equal((await admin('PATCH', '/api/admin/orders/' + orderId, { status: 'inventado' })).status, 400);
    const r = await admin('PATCH', '/api/admin/orders/' + orderId, { status: 'enviado', trackingCode: 'BR123456789XX', note: 'Saiu hoje' });
    assert.equal(r.status, 200);
    const o = (await ana('GET', '/api/orders')).data.orders.find((x) => x.id === orderId);
    assert.equal(o.status, 'enviado'); assert.equal(o.trackingCode, 'BR123456789XX');
    assert.equal(o.timeline.at(-1).note, 'Saiu hoje');
    assert.equal((await admin('GET', '/api/admin/orders?status=enviado')).data.orders.length, 1);
  });

  await t('dashboard e lista de clientes', async () => {
    const d = (await admin('GET', '/api/admin/dashboard')).data;
    assert.equal(d.kpis.orders30, 2);
    assert.equal(d.kpis.revenue30Cents, 30150 + 10050);
    assert.equal(d.kpis.customersTotal, 2);
    assert.equal(d.daily.length, 30);
    assert.equal(d.daily.reduce((a, x) => a + x.cents, 0), 40200);
    assert.equal(d.topProducts[0].id, 'camiseta-teste-c'); assert.equal(d.topProducts[0].qty, 4);
    assert.ok(d.lowStock.find((p) => p.id === 'camiseta-teste-c'));
    const c = (await admin('GET', '/api/admin/customers')).data.customers;
    const ana_ = c.find((x) => x.email === 'ana@test.com');
    assert.equal(c.length, 2); assert.equal(ana_.ordersCount, 2); assert.equal(ana_.spentCents, 40200);
    assert.ok(!c.find((x) => x.email === 'owner@test.com'));
  });

  await t('entrega: encomenda só na Grande Floripa e sem misturar com pronta entrega', async () => {
    const mk = await admin('POST', '/api/admin/products', { name: 'Relógio Sob Encomenda', category: 'acessorios', price: 2000, sizes: 'Único', fulfillment: 'encomenda' });
    assert.equal(mk.status, 201); assert.equal(mk.data.product.fulfillment, 'encomenda');
    assert.equal((await anon('GET', '/api/products')).data.products.find((p) => p.id === 'relogio-sob-encomenda').fulfillment, 'encomenda');
    assert.equal((await anon('GET', '/api/products')).data.products.find((p) => p.id === productId).fulfillment, 'pronta_entrega');
    const enc = { id: 'relogio-sob-encomenda', size: 'Único', qty: 1 };
    assert.equal((await bob('POST', '/api/checkout', { items: [enc, { id: productId, size: '40', qty: 1 }], cep: '88010-400' })).status, 400); // mistura
    assert.equal((await bob('POST', '/api/checkout', { items: [enc] })).status, 422);                       // sem CEP
    assert.equal((await bob('POST', '/api/checkout', { items: [enc], cep: '80010-000' })).status, 422);     // Curitiba
    const bad = await bob('POST', '/api/checkout', { items: [enc], cep: '80010000' });
    assert.match(bad.data.error, /Florianópolis, São José, Palhoça e Biguaçu/);
    for (const cep of ['88010-400', '88101-000', '88131000', '88160-000']) assert.equal((await bob('POST', '/api/checkout', { items: [enc], cep })).status, 200, cep);
    // pronta entrega continua sem exigir CEP
    assert.equal((await bob('POST', '/api/checkout', { items: [{ id: productId, size: '40', qty: 1 }] })).status, 200);
  });

  await t('encomenda paga com endereço fora da área é sinalizada para o admin', async () => {
    const post = (s) => fetch(base + '/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': 'valid', 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'checkout.session.completed', data: { object: s } }) });
    const encSessions = [...sessions.values()].filter((s) => s.params.metadata.fulfillment === 'encomenda');
    assert.equal(encSessions.length, 4);
    assert.match(encSessions[0].params.shipping_options[0].shipping_rate_data.display_name, /Uber Flash.*Grande Florianópolis/);
    assert.equal(encSessions[0].params.metadata.cep, '88010400');
    const [dentro, fora] = [encSessions[0], encSessions[1]];
    dentro.payment_status = 'paid'; dentro.shipping_details.address.city = 'Palhoça'; dentro.shipping_details.address.postal_code = '88131000';
    fora.payment_status = 'paid'; fora.shipping_details.address.city = 'Curitiba'; fora.shipping_details.address.postal_code = '80010000';
    assert.equal((await post(dentro)).status, 200); assert.equal((await post(fora)).status, 200);
    const list = (await admin('GET', '/api/admin/orders')).data.orders.filter((o) => o.fulfillment === 'encomenda' && o.status === 'pago');
    assert.equal(list.length, 2);
    assert.equal(list.filter((o) => o.outsideArea).length, 1);
    assert.deepEqual(list.map((o) => o.deliveryMethod).sort(), ['envio', 'uber_flash']);
    assert.equal((await admin('GET', '/api/admin/dashboard')).data.kpis.checkAddress, 1);
    const mine = (await bob('GET', '/api/orders')).data.orders; assert.ok(mine.every((o) => !('outsideArea' in o)) && mine.some((o) => o.fulfillment === 'encomenda'));
  });

  await t('admin edita e desativa produto (sem apagar); preserva upload', async () => {
    const cur = (await admin('GET', '/api/admin/products')).data.products.find((p) => p.id === 'camiseta-teste-c');
    const r = await admin('PUT', '/api/admin/products/camiseta-teste-c', { ...cur, price: 120, active: false });
    assert.equal(r.status, 200); assert.equal(r.data.product.price, 120);
    assert.equal((await anon('GET', r.data.product.image.split('?')[0])).status, 200);
    assert.ok(!(await anon('GET', '/api/products')).data.products.find((p) => p.id === 'camiseta-teste-c'));
    assert.equal((await ana('POST', '/api/checkout', { items: [{ id: 'camiseta-teste-c', size: 'M', qty: 1 }] })).status, 400);
    assert.equal((await admin('DELETE', '/api/admin/products/camiseta-teste-c')).status, 404); // não existe rota de exclusão
  });

  await t('trocar senha invalida sessões antigas', async () => {
    const old = ana.cookie();
    assert.equal((await ana('POST', '/api/account/password', { current: 'errada', next: 'nova-senha-123' })).status, 400);
    assert.equal((await ana('POST', '/api/account/password', { current: 'senha-forte-1', next: 'nova-senha-123' })).status, 200);
    assert.equal((await ana('GET', '/api/auth/me')).data.user.email, 'ana@test.com'); // cookie novo
    const other = client(); other.setCookie(old);
    assert.equal((await other('GET', '/api/auth/me')).data.user, null);
    assert.equal((await client()('POST', '/api/auth/login', { email: 'ana@test.com', password: 'nova-senha-123' })).status, 200);
  });

  await t('logout limpa o cookie; token adulterado é rejeitado', async () => {
    await ana('POST', '/api/auth/logout', {});
    assert.equal((await ana('GET', '/api/auth/me')).data.user, null);
    const forged = client(); forged.setCookie('aq_session=' + admin.cookie().split('=')[1].split('.')[0] + '.AAAA');
    assert.equal((await forged('GET', '/api/admin/dashboard')).status, 401);
  });

  console.log(`\n${passed} testes ok`);
  server.close();
  process.exit(process.exitCode || 0);
})();
