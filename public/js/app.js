/* ============================================================
   app.js — núcleo do site: layout, API, catálogo, carrinho, checkout
   Páginas extras (login, conta, admin) se registram em AQ.pages.
   ============================================================ */
(function () {
  const S = window.STORE;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const brl = (n) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const brlCents = (c) => brl((c || 0) / 100);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
  const STATUS = {
    pendente: "Aguardando pagamento", pago: "Pago", em_separacao: "Em separação",
    enviado: "Enviado", entregue: "Entregue", cancelado: "Cancelado",
  };

  const I = {
    search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    bag: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    user: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>',
    insta: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    chev: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>',
    menu: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 6h11v10H2zM13 9h4l4 4v3h-8"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>',
    headset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/></svg>',
    lock: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    arrow: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M8 7h9v9"/></svg>',
  };

  /* ---------- API ---------- */
  async function api(path, { method = "GET", body } = {}) {
    let r;
    try {
      r = await fetch("/api" + path, {
        method, credentials: "same-origin",
        headers: body !== undefined ? { "Content-Type": "application/json" } : {},
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw Object.assign(new Error("Sem conexão com o servidor."), { status: 0 });
    }
    let data = null;
    try { data = await r.json(); } catch { /* sem corpo */ }
    if (!r.ok) throw Object.assign(new Error((data && data.error) || "Erro inesperado."), { status: r.status });
    return data;
  }

  // só aceita voltar para páginas do próprio site (evita redirecionamento malicioso)
  const safeNext = (n) => (/^[a-z0-9_-]+\.html(\?[^#\s]*)?$/i.test(n || "") ? n : "");

  const AQ = (window.AQ = { S, $, $$, brl, brlCents, esc, norm, fmtDate, STATUS, api, safeNext, I, user: null, products: [], productsError: false, pages: {} });

  /* ---------- Catálogo ---------- */
  const byId = (id) => AQ.products.find((p) => p.id === id);
  async function loadProducts() {
    try { AQ.products = (await api("/products")).products; AQ.productsError = false; }
    catch { AQ.products = []; AQ.productsError = true; }
  }
  async function loadMe() {
    try { AQ.user = (await api("/auth/me")).user; } catch { AQ.user = null; }
  }

  function placeholder(p) {
    if (p.image) return p.image;
    const c = /^#[0-9a-f]{6}$/i.test(p.color || "") ? p.color : "#333";
    const label = esc((p.brand || S.name).slice(0, 18));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#0d0d0d"/></linearGradient></defs><rect width="600" height="600" fill="url(#g)"/><text x="300" y="310" fill="rgba(255,255,255,.35)" font-family="Arial" font-size="28" letter-spacing="8" text-anchor="middle">${label}</text></svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }
  AQ.placeholder = placeholder;

  /* ---------- Carrinho (localStorage; preços sempre conferidos no servidor) ---------- */
  const KEY = "aq_cart_v1";
  const cart = {
    get() { try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v : []; } catch { return []; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* modo privado */ } render(); },
    add(id, size, qty = 1) {
      const c = this.get();
      const it = c.find((i) => i.id === id && i.size === size);
      it ? (it.qty = Math.min(it.qty + qty, 20)) : c.push({ id, size, qty });
      this.set(c);
    },
    change(id, size, d) {
      const c = this.get();
      const it = c.find((i) => i.id === id && i.size === size);
      if (!it) return;
      it.qty = Math.min(it.qty + d, 20);
      this.set(c.filter((i) => i.qty > 0));
    },
    remove(id, size) { this.set(this.get().filter((i) => !(i.id === id && i.size === size))); },
    clear() { this.set([]); },
  };
  AQ.cart = cart;

  function render() {
    const c = cart.get();
    const n = c.reduce((a, i) => a + i.qty, 0);
    $$(".cart-badge").forEach((b) => { b.textContent = n || ""; b.dataset.n = n; });
    const box = $("#cart-items");
    if (!box) return;
    let total = 0;
    const html = c.map((i) => {
      const p = byId(i.id);
      if (!p) return "";
      total += p.price * i.qty;
      return `<div class="line">
        <img src="${esc(placeholder(p))}" alt="">
        <div><div class="n">${esc(p.name)}</div><div class="s">Tamanho: ${esc(i.size)}</div>
          <div class="qty"><button data-a="dec" data-id="${esc(i.id)}" data-s="${esc(i.size)}" aria-label="Diminuir">−</button><span>${i.qty}</span><button data-a="inc" data-id="${esc(i.id)}" data-s="${esc(i.size)}" aria-label="Aumentar">+</button></div></div>
        <div><div class="p">${brl(p.price * i.qty)}</div><button class="rm" data-a="rm" data-id="${esc(i.id)}" data-s="${esc(i.size)}">remover</button></div>
      </div>`;
    }).join("");
    box.innerHTML = html || '<div class="empty-cart">Seu carrinho está vazio.</div>';
    $("#cart-total").textContent = brl(total);
    // pronta entrega x encomenda: não misturam; encomenda pede CEP e oferece WhatsApp
    const lines = c.map((i) => ({ i, p: byId(i.id) })).filter((x) => x.p);
    const hasEnc = lines.some((x) => x.p.fulfillment === "encomenda");
    const mixed = hasEnc && lines.some((x) => x.p.fulfillment !== "encomenda");
    $("#cart-enc").hidden = !(hasEnc && !mixed);
    $("#cart-mixed").hidden = !mixed;
    $("#checkout-btn").disabled = !html || mixed;
    if (hasEnc && !mixed) {
      const msg = `${S.encomenda.whatsappText}\n` + lines.map((x) => `• ${x.p.name} (tam. ${x.i.size}) x${x.i.qty}`).join("\n") + `\nTotal: ${brl(total)}`;
      $("#cart-wa").href = `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(msg)}`;
    }
  }

  function toast(msg) {
    const t = $(".toast");
    if (!t) return;
    t.textContent = msg; t.classList.add("on");
    setTimeout(() => t.classList.remove("on"), 2400);
  }
  AQ.toast = toast;
  const openCart = () => { $("#drawer").classList.add("on"); $("#overlay").classList.add("on"); };
  const closeCart = () => { $("#drawer").classList.remove("on"); $("#overlay").classList.remove("on"); };

  async function checkout() {
    const btn = $("#checkout-btn"), err = $("#cart-err");
    err.textContent = "";
    if (!AQ.user) {
      const here = location.pathname.split("/").pop() || "index.html";
      location.href = "login.html?next=" + encodeURIComponent(safeNext(here + location.search) || "loja.html");
      return;
    }
    const encOpen = !$("#cart-enc").hidden;
    const cep = encOpen ? $("#cart-cep").value.replace(/\D/g, "") : "";
    if (encOpen && cep.length !== 8) { err.textContent = "Informe o CEP de entrega (8 dígitos)."; return; }
    btn.disabled = true; btn.textContent = "Redirecionando...";
    try {
      const data = await api("/checkout", { method: "POST", body: { items: cart.get(), cep } });
      location.href = data.url;
    } catch (e) {
      if (e.status === 401) { AQ.user = null; location.href = "login.html?next=loja.html"; return; }
      err.textContent = e.message;
      btn.disabled = false; btn.textContent = "Finalizar compra";
    }
  }

  /* ---------- Layout ---------- */
  const logoHTML = () => (S.logoImage ? `<img src="${esc(S.logoImage)}" alt="${esc(S.name)}">` : esc(S.name));

  function navHTML() {
    const here = location.pathname.split("/").pop() || "index.html";
    return S.nav.map((n) => {
      const active = n.href === here ? "active" : "";
      const dd = n.children ? `<div class="dd">${n.children.map((c) => `<a href="${esc(c.href)}">${esc(c.label)}</a>`).join("")}</div>` : "";
      return `<li><a class="link ${active}" href="${esc(n.href)}">${esc(n.label)}${n.children ? I.chev : ""}</a>${dd}</li>`;
    }).join("");
  }

  function renderAcct() {
    const el = $("#acct");
    if (!el) return;
    if (!AQ.user) { el.innerHTML = `<a class="acct" href="login.html">${I.user}<span>Entrar</span></a>`; return; }
    const first = esc((AQ.user.name || "").split(" ")[0]);
    el.innerHTML = (AQ.user.role === "admin" ? `<a class="acct admin" href="admin.html">Painel</a>` : "") +
      `<a class="acct" href="conta.html">${I.user}<span>${first}</span></a>`;
  }

  function mountLayout() {
    const a = S.announcementLink;
    $("#announce").innerHTML = `${esc(S.announcement)}<span class="sep">•</span><a href="${esc(a.href)}" target="_blank" rel="noopener">${esc(a.text)}</a>`;
    $("#header").innerHTML = `
      <div class="container header-top">
        <div class="left">
          <button class="icon-btn menu-toggle" aria-label="Menu" id="menu-toggle">${I.menu}</button>
          <a class="search-btn" href="loja.html?focus=1">${I.search}<span>Buscar</span></a>
        </div>
        <a class="logo" href="index.html" aria-label="${esc(S.name)} — início">${logoHTML()}</a>
        <div class="right">
          <span id="acct" style="display:flex;gap:18px;align-items:center"></span>
          <button class="icon-btn" id="open-cart" aria-label="Carrinho">${I.bag}<span class="badge cart-badge"></span></button>
          <a class="icon-btn" href="${esc(S.instagram)}" target="_blank" rel="noopener" aria-label="Instagram">${I.insta}</a>
        </div>
      </div>
      <nav class="nav" id="nav"><ul>${navHTML()}</ul></nav>`;
    renderAcct();

    $("#footer").innerHTML = `
      <div class="container">
        <div class="ornament">✦</div>
        <div class="brand-foot"><img src="${esc(S.logoImage)}" alt="${esc(S.name)}"></div>
        <div class="cols">
          <div><h4>Informações</h4><ul>${S.footerLinks.map((l) => `<li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`).join("")}</ul></div>
          <div><h4>Formas de pagamento</h4><div class="pay">${S.payments.map((p) => `<span>${esc(p)}</span>`).join("")}</div></div>
          <div><h4>Compra segura</h4><div class="secure">${I.lock}<div>Pagamento processado pela Stripe.<br>Seus dados protegidos.</div></div></div>
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
          <div class="enc-box warn" id="cart-mixed" hidden>Produtos por encomenda precisam ser comprados separadamente dos de pronta entrega. Remova um dos tipos para continuar.</div>
          <div class="enc-box" id="cart-enc" hidden>
            <p>${esc(S.encomenda.note)}</p>
            <label for="cart-cep">CEP de entrega</label>
            <input id="cart-cep" type="text" inputmode="numeric" autocomplete="postal-code" maxlength="9" placeholder="00000-000">
            <a class="btn-outline" id="cart-wa" target="_blank" rel="noopener">Concluir pelo WhatsApp</a>
          </div>
          <button class="btn-primary" id="checkout-btn">Finalizar compra</button>
          <div class="err" id="cart-err"></div>
        </footer>
      </aside>
      <div class="toast" role="status"></div>`);

    $("#open-cart").onclick = openCart;
    $("#close-cart").onclick = closeCart;
    $("#overlay").onclick = closeCart;
    $("#checkout-btn").onclick = checkout;
    const cepEl = $("#cart-cep");
    try { cepEl.value = localStorage.getItem("aq_cep") || ""; } catch { /* sem storage */ }
    cepEl.oninput = () => {
      const d = cepEl.value.replace(/\D/g, "").slice(0, 8);
      cepEl.value = d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d;
      try { localStorage.setItem("aq_cep", cepEl.value); } catch { /* sem storage */ }
    };
    $("#menu-toggle").onclick = () => $("#nav").classList.toggle("open");
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCart(); });
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
    const tag = p.soldOut ? '<span class="tag out">Esgotado</span>' : p.fulfillment === "encomenda" ? '<span class="tag enc">Por encomenda</span>' : p.new ? '<span class="tag">Novo</span>' : "";
    return `<a class="card ${p.soldOut ? "sold" : ""}" href="produto.html?id=${encodeURIComponent(p.id)}">
      <div class="thumb"><img src="${esc(placeholder(p))}" alt="${esc(p.name)}" loading="lazy">${tag}</div>
      <div class="brand">${esc(p.brand)}</div>
      <div class="name">${esc(p.name)}</div>
      <div class="price">${brl(p.price)}</div>
      <div class="inst">Até ${S.maxInstallments}x de ${brl(p.price / S.maxInstallments)}</div>
    </a>`;
  }
  const gridOrMsg = (list, msg) => (list.length ? list.map(cardHTML).join("") : `<div class="empty">${AQ.productsError ? "Não foi possível carregar os produtos agora. Atualize a página em instantes." : msg}</div>`);

  /* ---------- Páginas ---------- */
  AQ.pages.home = function () {
    const slides = S.hero;
    const track = $("#hero-track");
    track.innerHTML = slides.map((s) => `
      <div class="slide ${s.dark ? "light" : ""} ${s.art ? "has-art" : ""}" style="background:${s.image ? `url('${esc(s.image)}') center/cover` : s.bg}">
        ${s.art ? `<img class="art" src="${esc(s.art)}" alt="">` : ""}
        <div class="inner"><h2>${esc(s.title)}</h2><p>${esc(s.subtitle)}</p><a class="btn-dark" href="${esc(s.href)}">${esc(s.cta)}</a></div>
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

    $("#benefits").innerHTML = `<div class="container">${S.benefits.map((b) => `<div class="benefit">${I[b.icon] || I.search}<span>${esc(b.text)}</span></div>`).join("")}</div>`;

    const pb = S.promoBanner, pe = $("#promo");
    pe.style.background = pb.image ? `url('${pb.image}') center/cover` : pb.bg;
    pe.innerHTML = `<div class="box"><div class="eyebrow">${esc(pb.eyebrow)}</div><h2>${esc(pb.title)}</h2><p>${esc(pb.subtitle)}</p><a class="btn-outline" href="${esc(pb.href)}">${esc(pb.cta)} →</a></div>`;

    $("#collections").innerHTML = S.collections.map((c, i) => {
      const bg = c.image ? `background-image:url('${esc(c.image)}')` : `background:linear-gradient(${120 + i * 25}deg,#0b2a57,#050505)`;
      return `<a class="tile" href="${esc(c.href)}" style="${bg}"><span>${esc(c.label)}</span></a>`;
    }).join("");

    const ps = S.personalShopper;
    $("#ps").innerHTML = `<div class="container">
      <div><div class="eyebrow">${esc(ps.eyebrow)}</div><h2>${esc(ps.title)}</h2><p>${esc(ps.text)}</p>
        <a class="btn-primary" href="https://wa.me/${esc(S.whatsapp)}?text=${encodeURIComponent("Olá! Quero encomendar uma peça.")}" target="_blank" rel="noopener">${esc(ps.cta)} ${I.arrow}</a></div>
      <div class="media">${ps.video ? `<video controls playsinline ${ps.poster ? `poster="${esc(ps.poster)}"` : ""} src="${esc(ps.video)}"></video>` : `<img src="${esc(S.logoImage)}" alt="" style="height:80%;width:auto">`}</div>
    </div>`;

    $("#best").innerHTML = gridOrMsg(AQ.products.filter((p) => p.bestseller).slice(0, 4), "Em breve.");
    $("#news").innerHTML = gridOrMsg(AQ.products.filter((p) => p.new).slice(0, 4), "Em breve.");
  };

  AQ.pages.shop = function () {
    const q = new URLSearchParams(location.search);
    const state = { cat: q.get("cat") || "", q: q.get("q") || "", sort: "relevancia" };
    const cats = [{ slug: "", label: "Tudo" }, ...S.categories];
    $("#chips").innerHTML = cats.map((c) => `<button class="chip" data-v="${esc(c.slug)}">${esc(c.label)}</button>`).join("");
    const search = $("#search");
    search.value = state.q;
    if (q.get("focus")) search.focus();
    const draw = () => {
      $$(".chip").forEach((c) => c.classList.toggle("on", c.dataset.v === state.cat));
      const term = norm(state.q.trim());
      const list = AQ.products.filter((p) =>
        (!state.cat || p.category === state.cat) &&
        (!term || norm([p.name, p.brand, ...(p.tags || [])].join(" ")).includes(term)));
      if (state.sort === "menor") list.sort((a, b) => a.price - b.price);
      if (state.sort === "maior") list.sort((a, b) => b.price - a.price);
      $("#count").textContent = `${list.length} produto${list.length === 1 ? "" : "s"}`;
      $("#list").innerHTML = gridOrMsg(list, 'Nenhum produto encontrado. <a href="index.html#personal-shopper" style="text-decoration:underline">Peça uma encomenda</a>.');
    };
    $("#chips").onclick = (e) => { const c = e.target.closest(".chip"); if (c) { state.cat = c.dataset.v; draw(); } };
    search.oninput = () => { state.q = search.value; draw(); };
    $("#sort").onchange = (e) => { state.sort = e.target.value; draw(); };
    draw();
  };

  AQ.pages.product = function () {
    const id = new URLSearchParams(location.search).get("id");
    const p = byId(id);
    const box = $("#product");
    if (!p) {
      box.innerHTML = `<div class="empty">${AQ.productsError ? "Não foi possível carregar o produto agora." : 'Produto não encontrado. <a href="loja.html" style="text-decoration:underline">Voltar para a loja</a>.'}</div>`;
      $("#related-wrap").hidden = true;
      return;
    }
    document.title = `${p.name} — ${S.name}`;
    let size = p.sizes.length === 1 ? p.sizes[0] : "";
    box.innerHTML = `
      <div class="photo"><img src="${esc(placeholder(p))}" alt="${esc(p.name)}"></div>
      <div>
        <div class="brand">${esc(p.brand)}</div>
        <h1>${esc(p.name)}</h1>
        <div class="price">${brl(p.price)}</div>
        <div class="inst">Até ${S.maxInstallments}x de ${brl(p.price / S.maxInstallments)}</div>
        ${p.fulfillment === "encomenda" ? `<div class="enc-box">${esc(S.encomenda.note)}</div>` : ""}
        <div class="label">Tamanho</div>
        <div class="sizes" id="sizes">${p.sizes.map((s) => `<button class="size ${s === size ? "on" : ""}" data-s="${esc(s)}">${esc(s)}</button>`).join("")}</div>
        <button class="btn-primary" id="add" ${p.soldOut ? "disabled" : ""}>${p.soldOut ? "Esgotado" : "Adicionar ao carrinho"}</button>
        <div class="err" id="perr"></div>
        ${p.fulfillment === "encomenda" ? '<a class="btn-outline" id="wa" target="_blank" rel="noopener">Pedir pelo WhatsApp</a>' : ""}
        <p class="desc">${esc(p.description || "")}</p>
      </div>`;
    const updateWa = () => {
      const w = $("#wa"); if (!w) return;
      const msg = `${S.encomenda.whatsappText}\n• ${p.name} (tam. ${size || "a definir"}) — ${brl(p.price)}`;
      w.href = `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(msg)}`;
    };
    updateWa();
    $("#sizes").onclick = (e) => {
      const b = e.target.closest(".size"); if (!b) return;
      size = b.dataset.s;
      $$(".size").forEach((x) => x.classList.toggle("on", x === b));
      updateWa();
    };
    $("#add").onclick = () => {
      if (!size) { $("#perr").textContent = "Selecione um tamanho."; return; }
      $("#perr").textContent = "";
      cart.add(p.id, size);
      openCart();
    };
    const rel = AQ.products.filter((x) => x.category === p.category && x.id !== p.id).slice(0, 4);
    $("#related").innerHTML = rel.map(cardHTML).join("");
    if (!rel.length) $("#related-wrap").hidden = true;
  };

  AQ.pages.success = async function () {
    const sid = new URLSearchParams(location.search).get("session_id");
    const box = $("#result");
    if (!sid) { box.innerHTML = ""; return; }
    if (!AQ.user) { box.innerHTML = '<a class="btn-primary" href="login.html?next=conta.html">Entrar para ver o pedido</a>'; return; }
    try {
      const { order } = (await api("/checkout/verify?session_id=" + encodeURIComponent(sid)));
      cart.clear();
      box.innerHTML = `<p><strong>Pedido #${order.number}</strong> · <span class="pill ${esc(order.status)}">${esc(STATUS[order.status] || order.status)}</span></p>
        <p style="margin:10px 0 24px">${order.status === "pendente" ? "Estamos aguardando a confirmação do pagamento (Pix pode levar alguns instantes)." : "Pagamento confirmado. Você pode acompanhar cada etapa na sua conta."}</p>
        <a class="btn-primary" href="conta.html">Acompanhar pedido</a>`;
    } catch (e) {
      box.innerHTML = `<p>${esc(e.message)}</p><br><a class="btn-primary" href="conta.html">Ver meus pedidos</a>`;
    }
  };

  /* ---------- Boot ---------- */
  document.addEventListener("DOMContentLoaded", async () => {
    const page = document.body.dataset.page;
    document.title = document.title.replace("{{NAME}}", S.name);
    if ($("#header")) mountLayout();
    await Promise.all([page === "admin" ? null : loadProducts(), loadMe()]);
    renderAcct();
    if ($("#cart-items")) {
      if (!AQ.productsError && AQ.products.length) { const c = cart.get(), ok = c.filter((i) => byId(i.id)); if (ok.length !== c.length) cart.set(ok); }
      render();
    }
    if (AQ.pages[page]) AQ.pages[page]();
  });
})();
