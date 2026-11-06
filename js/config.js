/* ==========================================================
   CONFIGURAÇÃO DA LOJA — edite aqui para adaptar a identidade
   (cores ficam em css/styles.css, no bloco :root)
   ========================================================== */
window.STORE = {
  name: "SUA LOJA",
  logoText: "SL",            // texto do logo (usado se logoImage estiver vazio)
  logoImage: "",             // ex.: "img/logo.png"
  announcement: "Frete grátis para todo o Brasil",
  announcementLink: { text: "Não encontrou? Envie a referência pelo Instagram ↗", href: "https://instagram.com/sualoja" },
  instagram: "https://instagram.com/sualoja",
  whatsapp: "5548999999999",  // DDI+DDD+número, só dígitos
  maxInstallments: 12,

  nav: [
    { label: "Início", href: "index.html" },
    { label: "Loja", href: "loja.html" },
    { label: "Roupas", href: "loja.html?cat=roupas", children: [
      { label: "Camisetas", href: "loja.html?cat=roupas&q=camiseta" },
      { label: "Casacos", href: "loja.html?cat=roupas&q=casaco" },
    ]},
    { label: "Sneakers", href: "loja.html?cat=sneakers", children: [
      { label: "Lifestyle", href: "loja.html?cat=sneakers&q=lifestyle" },
      { label: "Sandálias", href: "loja.html?cat=sneakers&q=sandalia" },
    ]},
    { label: "Acessórios", href: "loja.html?cat=acessorios" },
    { label: "Bolsas", href: "loja.html?cat=bolsas" },
    { label: "Conjuntos", href: "loja.html?cat=conjuntos" },
    { label: "Personal Shopper", href: "index.html#personal-shopper" },
  ],

  benefits: [
    { icon: "globe", text: "Produtos importados" },
    { icon: "search", text: "Busca personalizada" },
    { icon: "truck", text: "Envio para todo o Brasil" },
    { icon: "headset", text: "Atendimento humano" },
  ],

  // Slides do banner principal. "image" opcional (ex.: "img/hero1.jpg"); sem imagem usa o gradiente em "bg".
  hero: [
    { title: "NOVA COLEÇÃO", subtitle: "Clássicos que nunca saem de moda", cta: "Confira a coleção", href: "loja.html",
      image: "", bg: "linear-gradient(120deg,#e9dcc4,#b9a07a)", dark: true },
    { title: "SNEAKERS", subtitle: "Edições limitadas e lançamentos", cta: "Ver sneakers", href: "loja.html?cat=sneakers",
      image: "", bg: "linear-gradient(120deg,#1d2a24,#0b0f0d)", dark: false },
    { title: "ACESSÓRIOS", subtitle: "Detalhes que fazem a diferença", cta: "Ver acessórios", href: "loja.html?cat=acessorios",
      image: "", bg: "linear-gradient(120deg,#3b2a20,#14100d)", dark: false },
  ],

  // Banner largo entre as seções
  promoBanner: { eyebrow: "SUA MARCA", title: "ELEGÂNCIA EM CADA PASSO", subtitle: "Ícones contemporâneos. Design atemporal.",
    cta: "Confira a coleção", href: "loja.html?cat=sneakers", image: "", bg: "linear-gradient(110deg,#c0653b 0%,#e8d9c1 45%,#efe3cf 100%)" },

  // Coleções (1 grande + 3 pequenas)
  collections: [
    { label: "Casacos", href: "loja.html?cat=roupas&q=casaco", image: "" },
    { label: "Tênis", href: "loja.html?cat=sneakers", image: "" },
    { label: "Sandálias", href: "loja.html?cat=sneakers&q=sandalia", image: "" },
    { label: "Relógios sob encomenda", href: "loja.html?cat=acessorios", image: "" },
  ],

  personalShopper: {
    eyebrow: "PERSONAL SHOPPER",
    title: "NÃO ENCONTROU? NÓS ENCONTRAMOS.",
    text: "Envie a referência da peça que procura. Nossa equipe faz a busca e prepara sua cotação.",
    cta: "Pedir uma encomenda",
    video: "",   // ex.: "img/personal-shopper.mp4"
    poster: "",
  },

  footerLinks: [
    { label: "Política de Trocas e Devoluções", href: "#" },
    { label: "Política de Frete e Entrega", href: "#" },
    { label: "Rastrear Pedido", href: "#" },
    { label: "Termos de Uso", href: "#" },
    { label: "Política de Privacidade e Cookies", href: "#" },
    { label: "FAQ", href: "#" },
    { label: "Fale Conosco", href: "#" },
  ],
  payments: ["PIX", "MASTER", "VISA", "ELO", "HIPER", "AMEX"],
};
