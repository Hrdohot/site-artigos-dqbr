// POST /api/checkout — cria uma sessão do Stripe Checkout.
// Os preços vêm SEMPRE de data/products.json (nunca do navegador).
const Stripe = require("stripe");
const fs = require("fs");
const path = require("path");

const products = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data", "products.json"), "utf8")
);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido" });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: "STRIPE_SECRET_KEY não configurada." });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return res.status(400).json({ error: "Carrinho vazio." });

    const line_items = [];
    for (const it of items) {
      const p = products.find((x) => x.id === it.id);
      const qty = Math.floor(Number(it.qty));
      if (!p || !(qty >= 1 && qty <= 20)) {
        return res.status(400).json({ error: "Item inválido no carrinho." });
      }
      if (!p.sizes.includes(it.size)) {
        return res.status(400).json({ error: `Tamanho inválido para ${p.name}.` });
      }
      line_items.push({
        quantity: qty,
        price_data: {
          currency: "brl",
          unit_amount: Math.round(p.price * 100),
          product_data: {
            name: p.name,
            description: `Tamanho: ${it.size}`,
            metadata: { product_id: p.id, size: it.size },
          },
        },
      });
    }

    const origin =
      process.env.SITE_URL ||
      (req.headers["x-forwarded-host"]
        ? `https://${req.headers["x-forwarded-host"]}`
        : `https://${req.headers.host}`);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      locale: "pt-BR",
      // Sem payment_method_types: usa os métodos ativados no Dashboard (cartão, Pix, etc.)
      payment_method_options: {
        card: { installments: { enabled: true } }, // parcelamento no cartão (Brasil)
      },
      shipping_address_collection: { allowed_countries: ["BR"] },
      phone_number_collection: { enabled: true },
      billing_address_collection: "auto",
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: "Frete grátis",
            fixed_amount: { amount: 0, currency: "brl" },
            delivery_estimate: {
              minimum: { unit: "business_day", value: 5 },
              maximum: { unit: "business_day", value: 15 },
            },
          },
        },
      ],
      success_url: `${origin}/sucesso.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/loja.html`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("checkout error:", err);
    return res.status(500).json({ error: "Não foi possível iniciar o pagamento." });
  }
};
