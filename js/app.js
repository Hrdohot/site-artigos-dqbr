/* ============================================================
   app.js — header/footer, catálogo, carrinho e checkout Stripe
   ============================================================ */
(function () {
  const S = window.STORE;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const brl = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- Ícones ---------- */
  const I = {
    search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    bag: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    insta: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    chev: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>',
    menu: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 6h11v10H2zM13 9h4l4 4v3h-8"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>',
    headset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/></svg>',
    lock: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    arrow: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M8 7h9v9"/></svg>',
  };

  /* ---------- Imagem placeholder (SVG) ---------- */
  function placeholder(p) {
    if (p.image) return p.image;
    const c = p.color || "#333";
    const label = esc((p.brand || S.name).slice(0, 18));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#0d0d0d"/></linearGradient></defs><rect width="600" height="600" fill="url(#g)"/><text x="300" y="310" fill="rgba(255,255,255,.35)" font-family="Arial" font-size="28" letter-spacing="8" text-anchor="middle">${label}</text></svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  /* ---------- Dados ---------- */
  let PRODUCTS = [];
  const loadProducts = async () => {
    if (PRODUCTS.length) return PRODUCTS;
    const r = await fetch("data/products.json");
    PRODUCTS = await r.json();
    return PRODUCTS;
  };
  const byId = (id) => PRODUCTS.find((p) => p.id === id);

  /* ---------- Carrinho ---------- */
  const KEY = "store_cart_v1";
  const cart = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } },
    set(v) { localStorage.setItem(KEY, JSON.stringify(v)); render(); },
    add(id, size, qty = 1) {
      const c = this.get();
      const it = c.find((i) => i.id === id && i.size === size);
      it ? (it.qty += qty) : c.push({ id, size, qty });
      this.set(c);
    },
    change(id, size, d) {
      const c = this.get();
      const it = c.find((i) => i.id === id && i.size === size);
      if (!it) return;
      it.qty += d;
      this.set(c.filter((i) => i.qty > 0));
    },
    remove(id, size) { this.set(this.get().filter((i) => !(i.id === id && i.size === size))); },
    clear() { this.set([]); },
  };

  function render() {
    const c = cart.get();
    const n = c.reduce((a, i) => a + i.qty, 0);
    $$(".cart-badge").forEach((b) => { b.textContent = n || ""; b.dataset.n = n; });
    const box = $("#cart-items");
    if (!box) return;
    if (!c.length) {
      box.innerHTML = '<div class="empty-cart">Seu carrinho está vazio.</div>';
      $("#cart-total").textContent = brl(0);
      $("#checkout-btn").disabled = true;
      return;
    }
    let total = 0;
    box.innerHTML = c.map((i) => {
      const p = byId(i.id);
      if (!p) return "";
      total += p.price * i.qty;
      return `<div class="line">
        <img src="${placeholder(p)}" alt="">
        <div><div class="n">${esc(p.name)}</div><div class="s">Tamanho: ${esc(i.size)}</div>
          <div class="qty"><button data-a="dec" data-id="${i.id}" data-s="${esc(i.size)}">−</button><span>${i.qty}</span><button data-a="inc" data-id="${i.id}" data-s="${esc(i.size)}">+</button></div></div>
        <div><div class="p">${brl(p.price * i.qty)}</div><button class="rm" data-a="rm" data-id="${i.id}" data-s="${esc(i.size)}">remover</button></div>
      </div>`;
    }).join("");
    $("#cart-total").textContent = brl(total);
    $("#checkout-btn").disabled = false;
  }

  function toast(msg) {
    const t = $(".toast");
    t.textContent = msg; t.classList.add("on");
    setTimeout(() => t.classList.remove("on"), 2200);
  }
  const openCart = () => { $("#drawer").classList.add("on"); $("#overlay").classList.add("on"); };
  const closeCart = () => { $("#drawer").classList.remove("on"); $("#overlay").classList.remove("on"); };

  async function checkout() {
    const btn = $("#checkout-btn"), err = $("#cart-err");
    err.textContent = "";
    btn.disabled = true; btn.textContent = "Redirecionando...";
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart.get() }),
      });
      const data = await r.json();
      if (!r.ok || !data.url) throw new Error(data.error || "Falha ao iniciar o pagamento.");
      location.href = data.url;
    } catch (e) {
      err.textContent = e.message;
      btn.disabled = false; btn.textContent = "Finalizar compra";
    }
  }

  /* ---------- Layout (header / footer / drawer) ---------- */
  function logoHTML() {
    return S.logoImage ? `<img src="${S.logoImage}" alt="${esc(S.name)}">` : esc(S.logoText);
  }
  function navHTML() {
    const here = location.pathname.split("/").pop() || "index.html";
    return S.nav.map((n) => {
      const active = n.href.split("?")[0].split("#")[0] === here && !n.href.includes("?") && !n.href.includes("#") ? "active" : "";
      const dd = n.children ? `<div class="dd">${n.children.map((c) => `<a href="${c.href}">${esc(c.label)}</a>`).join("")}</div>` : "";
      return `<li><a class="link ${active}" href="${n.href}">${esc(n.label)}${n.children ? I.chev : ""}</a>${dd}</li>`;
    }).join("");
  }

  function mountLayout() {
    const a = S.announcementLink;
    $("#announce").innerHTML = `${esc(S.announcement)}<span class="sep">•</span><a href="${a.href}" target="_blank" rel="noopener">${esc(a.text)}</a>`;
    $("#header").innerHTML = `
      <div class="container header-top">
        <div class="left">
          <button class="icon-btn menu-toggle" aria-label="Menu" id="menu-toggle">${I.menu}</button>
          <a class="search-btn" href="loja.html?focus=1">${I.search}<span>Buscar</span></a>
        </div>
        <a class="logo" href="index.html">${logoHTML()}</a>
        <div class="right">
          <button class="icon-btn" id="open-cart" aria-label="Carrinho">${I.bag}<span class="badge cart-badge"></span></button>
          <a class="icon-btn" href="${S.instagram}" target="_blank" rel="noopener" aria-label="Instagram">${I.insta}</a>
        </div>
      </div>
      <nav class="nav" id="nav"><ul>${navHTML()}</ul></nav>`;

    const ps = S.personalShopper;
    $("#footer").innerHTML = `
      <div class="container">
        <div class="ornament">✦</div>
        <div class="cols">
          <div><h4>Informações</h4><ul>${S.footerLinks.map((l) => `<li><a href="${l.href}">${esc(l.label)}</a></li>`).join("")}</ul></div>
          <div><h4>Formas de pagamento</h4><div class="pay">${S.payments.map((p) => `<span>${esc(p)}</span>`).join("")}</div></div>
          <div><h4>Compra segura</h4><div class="secure">${I.lock}<div>Seus dados protegidos.<br>Ambiente 100% seguro.</div></div></div>
        </div>
        <p class="copy">© ${new Date().getFullYear()} ${esc(S.name)}. Todos os direitos reservados.</p>
      </div>`;

    document.body.insertAdjacentHTML("beforeend", `
      <div class="overlay" id="overlay"></div>
      <aside class="drawer" id="drawer" aria-label="Carrinho">
        <header><span>Carrinho</span><button id="close-cart" aria-label="Fechar">✕</button></header>
        <div class="items" id="cart-items"></div>
        <footer>
          <div class="sum"><span>Total</span><span id="cart-total">R$ 0,00</span></div>
          <p class="note">Frete e parcelamento calculados no pagamento.</p>
          <button class="btn-primary" id="checkout-btn">Finalizar compra</button>
          <div class="err" id="cart-err"></div>
        </footer>
      </aside>
      <div class="toast"></div>`);

    $("#open-cart").onclick = openCart;
    $("#close-cart").onclick = closeCart;
    $("#overlay").onclick = closeCart;
    $("#checkout-btn").onclick = checkout;
    $("#menu-toggle").onclick = () => $("#nav").classList.toggle("open");
    $("#cart-items").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-a]");
      if (!b) return;
      const { a, id, s } = b.dataset;
      if (a === "inc") cart.change(id, s, 1);
      if (a === "dec") cart.change(id, s, -1);
      if (a === "rm") cart.remove(id, s);
    });
  }

  /* ---------- Cards ---------- */
  function cardHTML(p) {
    const inst = (p.price / S.maxInstallments);
    return `<a class="card" href="produto.html?id=${p.id}">
      <div class="thumb"><img src="${placeholder(p)}" alt="${esc(p.name)}" loading="lazy">${p.new ? '<span class="tag">Novo</span>' : ""}</div>
      <div class="brand">${esc(p.brand)}</div>
      <div class="name">${esc(p.name)}</div>
      <div class="price">${brl(p.price)}</div>
      <div class="inst">Até ${S.maxInstallments}x de ${brl(inst)}</div>
    </a>`;
  }

  /* ---------- Páginas ---------- */
  function pageHome() {
    // Hero
    const slides = S.hero;
    const track = $("#hero-track");
    track.innerHTML = slides.map((s) => `
      <div class="slide ${s.dark ? "light" : ""}" style="background:${s.image ? `url('${s.image}') center/cover` : s.bg}">
        <div class="inner"><h2>${esc(s.title)}</h2><p>${esc(s.subtitle)}</p><a class="btn-dark" href="${s.href}">${esc(s.cta)}</a></div>
      </div>`).join("");
    const dots = $("#hero-dots");
    dots.innerHTML = slides.map((_, i) => `<span class="dot" data-i="${i}"></span>`).join("");
    let cur = 0, timer;
    const go = (i) => {
      cur = (i + slides.length) % slides.length;
      track.style.transform = `translateX(-${cur * 100}%)`;
      $$(".dot", dots).forEach((d, k) => d.classList.toggle("on", k === cur));
    };
    const auto = () => { clearInterval(timer); timer = setInterval(() => go(cur + 1), 6000); };
    $("#hero-prev").onclick = () => { go(cur - 1); auto(); };
    $("#hero-next").onclick = () => { go(cur + 1); auto(); };
    dots.onclick = (e) => { const d = e.target.closest(".dot"); if (d) { go(+d.dataset.i); auto(); } };
    go(0); auto();

    // Benefícios
    $("#benefits").innerHTML = `<div class="container">${S.benefits.map((b) => `<div class="benefit">${I[b.icon] || I.search}<span>${esc(b.text)}</span></div>`).join("")}</div>`;

    // Banner promo
    const pb = S.promoBanner;
    const pe = $("#promo");
    pe.style.background = pb.image ? `url('${pb.image}') center/cover` : pb.bg;
    pe.innerHTML = `<div class="box"><div class="eyebrow">${esc(pb.eyebrow)}</div><h2>${esc(pb.title)}</h2><p>${esc(pb.subtitle)}</p><a class="btn-outline" href="${pb.href}">${esc(pb.cta)} →</a></div>`;

    // Coleções
    $("#collections").innerHTML = S.collections.map((c, i) => {
      const bg = c.image ? `background-image:url('${c.image}')` : `background:linear-gradient(${120 + i * 25}deg,#2a2a2a,#0e0e0e)`;
      return `<a class="tile" href="${c.href}" style="${bg}"><span>${esc(c.label)}</span></a>`;
    }).join("");

    // Personal shopper
    const ps = S.personalShopper;
    $("#ps").innerHTML = `<div class="container">
      <div><div class="eyebrow">${esc(ps.eyebrow)}</div><h2>${esc(ps.title)}</h2><p>${esc(ps.text)}</p>
        <a class="btn-primary" href="https://wa.me/${S.whatsapp}?text=${encodeURIComponent("Olá! Quero encomendar uma peça.")}" target="_blank" rel="noopener">${esc(ps.cta)} ${I.arrow}</a></div>
      <div class="media">${ps.video ? `<video controls playsinline ${ps.poster ? `poster="${ps.poster}"` : ""} src="${ps.video}"></video>` : "Seu vídeo / imagem aqui"}</div>
    </div>`;

    // Vitrines
    $("#best").innerHTML = PRODUCTS.filter((p) => p.bestseller).slice(0, 4).map(cardHTML).join("");
    $("#news").innerHTML = PRODUCTS.filter((p) => p.new).slice(0, 4).map(cardHTML).join("");
  }

  function pageShop() {
    const q = new URLSearchParams(location.search);
    const state = { cat: q.get("cat") || "", q: q.get("q") || "", sort: "relevancia" };
    const cats = [["", "Tudo"], ["roupas", "Roupas"], ["sneakers", "Sneakers"], ["acessorios", "Acessórios"], ["bolsas", "Bolsas"], ["conjuntos", "Conjuntos"]];
    $("#chips").innerHTML = cats.map(([v, l]) => `<button class="chip" data-v="${v}">${l}</button>`).join("");
    const search = $("#search");
    search.value = state.q;
    if (q.get("focus")) search.focus();
    const draw = () => {
      $$(".chip").forEach((c) => c.classList.toggle("on", c.dataset.v === state.cat));
      const term = state.q.trim().toLowerCase();
      let list = PRODUCTS.filter((p) =>
        (!state.cat || p.category === state.cat) &&
        (!term || [p.name, p.brand, ...(p.tags || [])].join(" ").toLowerCase().includes(term)));
      if (state.sort === "menor") list.sort((a, b) => a.price - b.price);
      if (state.sort === "maior") list.sort((a, b) => b.price - a.price);
      $("#count").textContent = `${list.length} produto${list.length === 1 ? "" : "s"}`;
      $("#list").innerHTML = list.length ? list.map(cardHTML).join("") : '<div class="empty">Nenhum produto encontrado. <a href="index.html#personal-shopper" style="text-decoration:underline">Peça uma encomenda</a>.</div>';
    };
    $("#chips").onclick = (e) => { const c = e.target.closest(".chip"); if (c) { state.cat = c.dataset.v; draw(); } };
    search.oninput = () => { state.q = search.value; draw(); };
    $("#sort").onchange = (e) => { state.sort = e.target.value; draw(); };
    draw();
  }

  function pageProduct() {
    const id = new URLSearchParams(location.search).get("id");
    const p = byId(id);
    const box = $("#product");
    if (!p) { box.innerHTML = '<div class="empty">Produto não encontrado.</div>'; return; }
    document.title = `${p.name} — ${S.name}`;
    let size = p.sizes.length === 1 ? p.sizes[0] : "";
    box.innerHTML = `
      <div class="photo"><img src="${placeholder(p)}" alt="${esc(p.name)}"></div>
      <div>
        <div class="brand">${esc(p.brand)}</div>
        <h1>${esc(p.name)}</h1>
        <div class="price">${brl(p.price)}</div>
        <div class="inst">Até ${S.maxInstallments}x de ${brl(p.price / S.maxInstallments)} sem juros</div>
        <div class="label">Tamanho</div>
        <div class="sizes" id="sizes">${p.sizes.map((s) => `<button class="size ${s === size ? "on" : ""}" data-s="${esc(s)}">${esc(s)}</button>`).join("")}</div>
        <button class="btn-primary" id="add">Adicionar ao carrinho</button>
        <div class="err" id="perr"></div>
        <p class="desc">${esc(p.description || "")}</p>
      </div>`;
    $("#sizes").onclick = (e) => {
      const b = e.target.closest(".size"); if (!b) return;
      size = b.dataset.s;
      $$(".size").forEach((x) => x.classList.toggle("on", x === b));
    };
    $("#add").onclick = () => {
      if (!size) { $("#perr").textContent = "Selecione um tamanho."; return; }
      $("#perr").textContent = "";
      cart.add(p.id, size);
      openCart();
    };
    const rel = PRODUCTS.filter((x) => x.category === p.category && x.id !== p.id).slice(0, 4);
    $("#related").innerHTML = rel.map(cardHTML).join("");
  }

  function pageSuccess() {
    cart.clear();
  }

  /* ---------- Boot ---------- */
  document.addEventListener("DOMContentLoaded", async () => {
    document.title = document.title.replace("{{NAME}}", S.name);
    mountLayout();
    await loadProducts();
    render();
    const page = document.body.dataset.page;
    if (page === "home") pageHome();
    if (page === "shop") pageShop();
    if (page === "product") pageProduct();
    if (page === "success") pageSuccess();
  });
})();
