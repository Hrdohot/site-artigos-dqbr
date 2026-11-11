'use strict';
// Regras de entrega da loja (editáveis aqui).
//  - pronta_entrega: enviado para todo o Brasil; na área abaixo (Grande Florianópolis) pode ir por Uber Flash
//  - encomenda (compra na China, prazo longo): entregue somente na área abaixo, por Uber Flash
const AREA = {
  name: 'Grande Florianópolis',
  cities: ['Florianópolis', 'São José', 'Palhoça', 'Biguaçu'],
  // Faixas de CEP dos municípios acima (Correios). Confira com um CEP de cada cidade.
  cepRanges: [
    [88000000, 88099999], // Florianópolis
    [88100000, 88124999], // São José
    [88130000, 88139999], // Palhoça
    [88160000, 88169999], // Biguaçu
  ],
};

const FULFILLMENTS = ['pronta_entrega', 'encomenda'];

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const CITY_SET = new Set(AREA.cities.map(norm));

const digits = (v) => String(v || '').replace(/\D/g, '');
const cepInArea = (cep) => {
  const d = digits(cep);
  if (d.length !== 8) return false;
  const n = Number(d);
  return AREA.cepRanges.some(([a, b]) => n >= a && n <= b);
};
const cityInArea = (city) => CITY_SET.has(norm(city));

const citiesText = () => AREA.cities.slice(0, -1).join(', ') + ' e ' + AREA.cities[AREA.cities.length - 1];
const AREA_MESSAGE = () => `Produtos por encomenda são entregues somente em ${citiesText()}.`;

// Pedido por encomenda cujo endereço informado no pagamento está fora da área
function orderOutsideArea(o) {
  if (!o || o.fulfillment !== 'encomenda' || !o.shippingAddress) return false;
  const a = o.shippingAddress;
  return !(cityInArea(a.city) || cepInArea(a.postal_code));
}

// Como o pedido deve ser entregue (definido pelo endereço informado no pagamento):
//  - dentro da Grande Florianópolis → Uber Flash (pronta entrega ou encomenda)
//  - fora (só pode ser pronta entrega) → envio nacional (Correios/transportadora)
//  - sem endereço ainda → null
function deliveryMethod(o) {
  if (!o || !o.shippingAddress) return null;
  const a = o.shippingAddress;
  return (cityInArea(a.city) || cepInArea(a.postal_code)) ? 'uber_flash' : 'envio';
}

module.exports = { AREA, FULFILLMENTS, cepInArea, cityInArea, orderOutsideArea, deliveryMethod, AREA_MESSAGE, citiesText, digits };
