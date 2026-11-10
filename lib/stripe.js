'use strict';
// Stripe: a chave secreta só existe no servidor (variável de ambiente)
const { HttpError } = require('./http');

let client;
function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new HttpError(500, 'Pagamentos ainda não configurados.');
  if (!client) {
    const Stripe = require('stripe');
    client = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return client;
}

function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || (/^localhost|^127\./.test(host) ? 'http' : 'https');
  return `${proto.split(',')[0]}://${host}`;
}

// Extrai endereço/contato da sessão paga (compatível com versões diferentes da API)
function sessionDetails(s) {
  const ship = (s.collected_information && s.collected_information.shipping_details) || s.shipping_details || null;
  const cd = s.customer_details || {};
  return {
    shippingAddress: ship && ship.address ? { name: ship.name || '', ...ship.address } : null,
    customerName: ship && ship.name ? ship.name : cd.name || null,
    customerEmail: cd.email || s.customer_email || null,
    customerPhone: cd.phone || null,
  };
}

module.exports = { stripe, siteUrl, sessionDetails };
