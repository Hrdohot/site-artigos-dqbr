// POST /api/webhook — recebe eventos do Stripe (pagamento confirmado, Pix pago, etc.)
// Configure o endpoint no Dashboard do Stripe e salve o segredo em STRIPE_WEBHOOK_SECRET.
const Stripe = require("stripe");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      raw,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Assinatura inválida: ${err.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object;
      if (s.payment_status === "paid") {
        // TODO: marcar pedido como pago, enviar e-mail, avisar no WhatsApp, etc.
        console.log("Pedido pago:", s.id, s.customer_details?.email);
      }
      break;
    }
    case "checkout.session.async_payment_failed":
      console.log("Pagamento falhou:", event.data.object.id);
      break;
  }
  res.status(200).json({ received: true });
};

module.exports.config = { api: { bodyParser: false } };
