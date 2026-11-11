# Artigos de Quebra — loja virtual

E-commerce com contas de clientes, acompanhamento de pedidos, painel administrativo e pagamento via Stripe. Pronto para a Vercel.

```
public/            site (HTML/CSS/JS) — só isto é público
  js/config.js     textos, menu, banners, coleções, WhatsApp/Instagram (sem segredos)
  css/styles.css   cores no bloco :root (--accent = azul da marca)
  admin.html       painel do administrador (exige login de admin)
api/index.js       única função serverless (todas as rotas /api/*)
lib/               backend: banco, login, rotas, Stripe (NUNCA é servido ao navegador)
tests/             testes automáticos da API
```

## Onde ficam os segredos

Tudo que é sensível fica em **variáveis de ambiente da Vercel** (Settings → Environment Variables), nunca no código nem no navegador:

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | banco Postgres (Neon) — vem sozinha ao conectar o Neon ao projeto |
| `SESSION_SECRET` | assina o cookie de login. Gere: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | sua conta de administrador (criada na 1ª requisição) |
| `STRIPE_SECRET_KEY` | chave secreta da Stripe (`sk_test_…` / `sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | segredo do webhook (`whsec_…`) |
| `SITE_URL` | (recomendado) `https://seudominio.com.br` |
| `SHIPPING_CENTS` | (opcional) frete fixo em centavos; padrão `0` = frete grátis |
| `STRIPE_INSTALLMENTS` | (opcional) `0` desliga parcelamento no cartão |

Senhas de clientes e do admin ficam no banco **apenas como hash (scrypt)**. A senha que você põe em `ADMIN_PASSWORD` é usada uma vez para criar a conta; depois troque-a em *Minha conta → Alterar senha* (e pode até remover a variável).

## Publicar (passo a passo)

1. Suba esta pasta para um repositório no GitHub e importe em vercel.com/new (Framework: **Other**).
2. Na Vercel: **Storage → Create → Neon (Postgres)** e conecte ao projeto → `DATABASE_URL` é criada automaticamente. As tabelas e os 12 produtos de exemplo são criados no primeiro acesso.
3. Adicione as demais variáveis da tabela acima e faça **Redeploy**.
4. Stripe → Developers → **Webhooks** → endpoint `https://SEU-DOMINIO/api/stripe/webhook` com os eventos
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`. Copie o `whsec_…` para `STRIPE_WEBHOOK_SECRET`.
5. Stripe → Settings → Payment methods: ative **Cartão** e **Pix**. Teste com `sk_test_…` e o cartão `4242 4242 4242 4242`; depois troque para as chaves `live`.
6. Entre em `/login.html` com `ADMIN_EMAIL`/`ADMIN_PASSWORD` → você será levado ao `/admin.html`.

## O que cada perfil faz

**Cliente** (`/login.html` → cadastro): compra (login obrigatório no checkout), acompanha pedidos em `/conta.html` com linha do tempo, código de rastreio e endereço; edita dados e senha.

**Admin** (`/admin.html`): *Dashboard* (receita 30 dias, ticket médio, gráfico diário, status, mais vendidos, estoque baixo) · *Pedidos* (ver, mudar status, rastreio e observação) · *Produtos* (ver, adicionar, editar, ativar/desativar, estoque, upload de foto) · *Clientes* (lista somente leitura com total gasto). O admin **não** apaga produtos nem clientes.

## Regras de entrega

- **Pronta entrega:** enviado para todo o Brasil (endereço coletado no pagamento). Se o endereço for da Grande Florianópolis, o painel marca **"Enviar por Uber Flash"**; fora dela, "Envio nacional".
- **Por encomenda** (compra na China, prazo longo): entregue somente por **Uber Flash** em Florianópolis, São José, Palhoça e Biguaçu. O cliente pode pagar no site ou concluir pelo WhatsApp.
- Pronta entrega e encomenda **não se misturam** no mesmo carrinho (o site avisa).
- No carrinho de encomenda o cliente informa o **CEP**; o servidor recusa CEPs fora da área. Depois do pagamento, o endereço digitado na Stripe é conferido de novo: se estiver fora da área, o pedido aparece no painel com o aviso "⚠ endereço fora da área" (e um card "Verificar endereço" no dashboard) para você falar com o cliente ou reembolsar.
- O tipo é definido em cada produto (*Tipo de entrega* no painel). As cidades e faixas de CEP ficam em `lib/shop-rules.js`.

## Segurança já incluída

- Preço, estoque e tamanhos são **sempre** conferidos no servidor; o navegador não decide valores.
- Cookie de sessão `HttpOnly` + `Secure` + `SameSite=Lax`, assinado (HMAC); trocar a senha invalida sessões antigas.
- Bloqueio de 15 min após 5 senhas erradas; tempo de resposta igual para e-mail inexistente.
- Rotas `/api/admin/*` revalidam o papel de administrador **no servidor** a cada chamada.
- Proteção CSRF (checagem de origem), webhook com assinatura verificada, SQL parametrizado, saída HTML escapada.
- Cabeçalhos: CSP, HSTS, X-Frame-Options, etc. (`vercel.json`).

## Rodar no seu computador

```bash
npm install
npm run dev        # http://localhost:3000 — banco em memória, admin temporário impresso no terminal
npm test           # testes da API
```
Sem `DATABASE_URL` o modo local usa memória (dados somem ao reiniciar). Para testar pagamentos localmente defina `STRIPE_SECRET_KEY` (teste).

## Para ajustar depois

- **Logo/cores/textos:** `public/img/logo.png`, `public/css/styles.css`, `public/js/config.js`. Links do rodapé (trocas, privacidade…) ainda apontam para `#`.
- **Frete:** fixo (`SHIPPING_CENTS`); para tabela por região, altere `lib/routes.js` (`/checkout`).
- **Ainda não existe:** "esqueci minha senha" (precisa de serviço de e-mail, ex.: Resend), e-mails de status do pedido, e limite de requisições por IP (ative o *Vercel Firewall → Rate limiting* em `/api/auth/*`).
- Estoque é baixado ao confirmar o pagamento; ao cancelar um pedido pago, ajuste o estoque manualmente no produto.
