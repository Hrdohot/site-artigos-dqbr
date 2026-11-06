# Loja — template de e-commerce (Vercel + Stripe)

Site estático (HTML/CSS/JS puro) + 2 funções serverless (`/api`) para pagamento com Stripe Checkout.

## Estrutura

```
index.html · loja.html · produto.html · sucesso.html
css/styles.css      ← cores e fontes no bloco :root
js/config.js        ← nome, menu, banners, coleções, rodapé, WhatsApp, Instagram
js/app.js           ← layout, catálogo, carrinho, checkout
data/products.json  ← catálogo (fonte única de preços, usada também pelo servidor)
api/checkout.js     ← cria a sessão do Stripe Checkout
api/webhook.js      ← recebe confirmação de pagamento
```

## Adaptar a identidade

1. **Cores/fontes:** `css/styles.css` → `:root` (`--accent`, `--bg`, `--font-*`).
2. **Textos, logo, menu, banners:** `js/config.js` (use `logoImage` e `image` nos slides/coleções para colocar suas fotos em `img/`).
3. **Produtos:** `data/products.json` (`image` aceita caminho, ex.: `img/tenis-1.jpg`). Sem imagem, aparece um placeholder.

## Rodar local

```bash
npm install
npx vercel dev     # precisa do .env (copie de .env.example)
```

## Deploy na Vercel

1. Suba a pasta para um repositório Git e importe em vercel.com/new (Framework: *Other*).
2. Em **Settings → Environment Variables** adicione `STRIPE_SECRET_KEY` (e `STRIPE_WEBHOOK_SECRET`, `SITE_URL` se quiser).
3. Deploy.

## Stripe

1. Crie a conta e ative **Cartão** e **Pix** em Dashboard → Settings → Payment methods.
2. Use chaves `sk_test_...` para testar (cartão `4242 4242 4242 4242`); troque para `sk_live_...` em produção.
3. Webhook: Developers → Webhooks → endpoint `https://SEU-DOMINIO/api/webhook`, eventos
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`.
4. Parcelamento no cartão exige conta Stripe do Brasil com parcelamento habilitado.

## Pontos para ajustar depois

- **Frete:** hoje é grátis fixo (`shipping_options` em `api/checkout.js`). Altere para tabela por região/valor.
- **Estoque/pedidos:** não há banco de dados; no webhook (`TODO`) conecte seu e-mail, planilha ou ERP.
- **Páginas legais:** links do rodapé apontam para `#`.
- **Segurança:** preços são validados no servidor a partir de `data/products.json`; nunca confie no valor vindo do navegador.
