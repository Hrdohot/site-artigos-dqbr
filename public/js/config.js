/* ==========================================================
   CONFIGURAÇÃO DA LOJA — textos, menu, banners e coleções.
   (cores em css/styles.css, bloco :root · produtos pelo painel /admin.html)
   Aqui NÃO entra nenhum segredo: este arquivo é público.
   ========================================================== */
window.STORE = {
  name: "Artigos de Quebra",
  logoImage: "img/logo.png",
  announcement: "Frete grátis para todo o Brasil",
  announcementLink: { text: "Não encontrou? Fale com a gente ↗", href: "https://instagram.com/artigosdequebra" },
  instagram: "https://instagram.com/artigosdequebra",   // ← troque pelo seu @
  whatsapp: "5548999999999",                            // ← DDI+DDD+número, só dígitos
  maxInstallments: 12,

  // Categorias (o painel admin usa esta mesma lista)
  categories: [
    { slug: "roupas", label: "Roupas" },
    { slug: "sneakers", label: "Sneakers" },
    { slug: "acessorios", label: "Acessórios" },
    { slug: "bolsas", label: "Bolsas" },
    { slug: "conjuntos", label: "Conjuntos" },
  ],

  nav: [
    { label: "Início", href: "index.html" },
    { label: "Loja", href: "loja.html" },
    { label: "Roupas", href: "loja.html?cat=roupas", children: [
      { label: "Todas as roupas", href: "loja.html?cat=roupas" },
      { label: "Camisetas", href: "loja.html?cat=roupas&q=camiseta" },
      { label: "Casacos", href: "loja.html?cat=roupas&q=casaco" },
    ]},
    { label: "Sneakers", href: "loja.html?cat=sneakers", children: [
      { label: "Todos os sneakers", href: "loja.html?cat=sneakers" },
      { label: "Tênis", href: "loja.html?cat=sneakers&q=lifestyle" },
      { label: "Sandálias e slides", href: "loja.html?cat=sneakers&q=sandalia" },
    ]},
    { label: "Acessórios", href: "loja.html?cat=acessorios" },
    { label: "Bolsas", href: "loja.html?cat=bolsas" },
    { label: "Conjuntos", href: "loja.html?cat=conjuntos" },
    { label: "Encomendas", href: "index.html#personal-shopper" },
  ],

  benefits: [
    { icon: "globe", text: "Produtos importados" },
    { icon: "search", text: "Busca personalizada" },
    { icon: "truck", text: "Envio para todo o Brasil" },
    { icon: "headset", text: "Atendimento humano" },
  ],

  // Slides do banner. "image" = foto de fundo (ex.: "img/hero1.jpg"); "art" = imagem à direita (ex.: a logo).
  hero: [
    { title: "ARTIGOS DE QUEBRA", subtitle: "Sneakers, streetwear e acessórios", cta: "Ver a loja", href: "loja.html",
      image: "", art: "img/logo.png", bg: "radial-gradient(900px 500px at 80% 40%,#0b3a7a 0%,#04142b 55%,#000 100%)", dark: false },
    { title: "SNEAKERS", subtitle: "Lançamentos e edições que você procura", cta: "Ver sneakers", href: "loja.html?cat=sneakers",
      image: "", art: "", bg: "linear-gradient(120deg,#06214a,#000 70%)", dark: false },
    { title: "STREETWEAR", subtitle: "Camisetas, casacos e conjuntos", cta: "Ver roupas", href: "loja.html?cat=roupas",
      image: "", art: "", bg: "linear-gradient(120deg,#111,#0a3f85 120%)", dark: false },
  ],

  // Banner largo entre as seções
  promoBanner: { eyebrow: "ARTIGOS DE QUEBRA", title: "ESTILO EM CADA PASSO", subtitle: "Sneakers, slides e sandálias selecionados.",
    cta: "Confira a coleção", href: "loja.html?cat=sneakers", image: "", bg: "linear-gradient(110deg,#0b3a7a 0%,#e8eef9 55%,#f6f8fc 100%)" },

  // Coleções (1 grande + 3 pequenas). "image": foto de fundo opcional.
  collections: [
    { label: "Casacos", href: "loja.html?cat=roupas&q=casaco", image: "" },
    { label: "Tênis", href: "loja.html?cat=sneakers&q=lifestyle", image: "" },
    { label: "Sandálias", href: "loja.html?cat=sneakers&q=sandalia", image: "" },
    { label: "Relógios sob encomenda", href: "loja.html?cat=acessorios", image: "" },
  ],

  personalShopper: {
    eyebrow: "ENCOMENDAS",
    title: "NÃO ENCONTROU? A GENTE ENCONTRA.",
    text: "Envie a referência da peça que procura. Nossa equipe faz a busca e prepara sua cotação.",
    cta: "Pedir uma encomenda",
    video: "",   // ex.: "img/encomenda.mp4"
    poster: "",
  },

  // Produtos "Por encomenda": entregues só na Grande Florianópolis (a regra é validada no servidor em lib/shop-rules.js)
  encomenda: {
    note: "Produto por encomenda: entrega somente em Florianópolis, São José, Palhoça e Biguaçu. Você pode pagar aqui no site ou concluir o pedido pelo WhatsApp.",
    whatsappText: "Olá! Quero encomendar:",
  },

  footerLinks: [
    { label: "Política de Trocas e Devoluções", href: "#" },
    { label: "Política de Frete e Entrega", href: "#" },
    { label: "Meus Pedidos", href: "conta.html" },
    { label: "Termos de Uso", href: "#" },
    { label: "Política de Privacidade e Cookies", href: "#" },
    { label: "FAQ", href: "#" },
  ],
  payments: ["PIX", "MASTER", "VISA", "ELO", "HIPER", "AMEX"],
};
