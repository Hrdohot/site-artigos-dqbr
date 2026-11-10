'use strict';
// Substitutos para testes locais: @neondatabase/serverless (via psql) e stripe (mock).
const Module = require('module');
const path = require('path');
const { execFileSync } = require('child_process');

const lit = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const neonShim = {
  neon() {
    return {
      query(text, params = []) {
        let sql = text.replace(/\$(\d+)/g, (_, n) => lit(params[n - 1]));
        const returns = /^\s*(select|with)/i.test(sql) || /\breturning\b/i.test(sql);
        if (returns) sql = `WITH t AS (${sql}) SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM t`;
        const out = execFileSync('psql', ['-h', '/var/lib/postgresql', '-p', '54329', '-U', 'postgres', '-d', 'aq', '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        return Promise.resolve(returns ? JSON.parse(out.trim()) : []);
      },
    };
  },
};

const sessions = new Map();
let n = 0;
class StripeMock {
  constructor(key) { this.key = key; }
  get checkout() {
    return {
      sessions: {
        create: async (params) => {
          const id = 'cs_test_' + ++n;
          const s = { id, url: 'https://checkout.stripe.test/' + id, params, metadata: params.metadata, payment_status: 'unpaid', status: 'open',
            customer_details: { email: params.customer_email, name: 'Fulano de Tal', phone: '+5548999990000' },
            shipping_details: { name: 'Fulano de Tal', address: { line1: 'Rua A, 10', city: 'Florianópolis', state: 'SC', postal_code: '88000000', country: 'BR' } } };
          sessions.set(id, s);
          return s;
        },
        retrieve: async (id) => sessions.get(id),
      },
    };
  }
  get webhooks() {
    return { constructEvent: (raw, sig) => { if (sig !== 'valid') throw new Error('bad sig'); return JSON.parse(raw.toString()); } };
  }
}
StripeMock.__sessions = sessions;

const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (req === '@neondatabase/serverless') return path.join(__dirname, 'shims.js');
  if (req === 'stripe') return path.join(__dirname, 'shims.js');
  return orig.call(this, req, ...rest);
};
// um único módulo exporta os dois; stripe usa `.default`-less export => tratamos abaixo
const realLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === '@neondatabase/serverless') return neonShim;
  if (req === 'stripe') return StripeMock;
  return realLoad.call(this, req, ...rest);
};

module.exports = { StripeMock, sessions };
