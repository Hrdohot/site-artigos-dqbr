/* Painel admin — todas as ações passam pela API, que revalida o login de administrador no servidor */
(function () {
  const { $, $$, api, esc, norm, brl, brlCents, fmtDate, STATUS, S } = AQ;
  const view = () => $("#view");
  const loading = () => (view().innerHTML = '<p class="empty-s">Carregando…</p>');
  const fail = (e) => (view().innerHTML = `<p class="form-msg err">${esc(e.message)}</p>`);

  const modal = {
    open(html) { $("#modal-body").innerHTML = html; $("#modal").hidden = false; },
    close() { $("#modal").hidden = true; $("#modal-body").innerHTML = ""; },
  };

  /* ---------------- Dashboard ---------------- */
  const kpi = (l, v, d) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="d">${d}</div></div>`;
  const short = (c) => (c >= 100000 ? `R$ ${(c / 100000).toFixed(1).replace(".", ",").replace(",0", "")} mil` : `R$ ${Math.round(c / 100)}`);
  const niceMax = (v) => { if (v <= 0) return 10000; const p = 10 ** Math.floor(Math.log10(v)), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
  const dm = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

  function barChart(daily) {
    const W = 760, H = 240, ml = 58, mr = 8, mt = 10, mb = 26;
    const pw = W - ml - mr, ph = H - mt - mb, base = mt + ph;
    const max = niceMax(Math.max(...daily.map((d) => d.cents)));
    const band = pw / daily.length, bw = Math.max(6, band * 0.6);
    const ticks = [0, max / 2, max];
    let g = ticks.map((t) => { const y = base - (t / max) * ph; return `<line class="grid-l" x1="${ml}" x2="${W - mr}" y1="${y}" y2="${y}"/><text class="ax" x="${ml - 8}" y="${y + 4}" text-anchor="end">${short(t)}</text>`; }).join("");
    daily.forEach((d, i) => {
      const x = ml + i * band + (band - bw) / 2, h = (d.cents / max) * ph, y = base - h, r = Math.min(4, h, bw / 2);
      g += `<g class="col">${h > 0 ? `<path class="bar" d="M${x},${y + r} a${r},${r} 0 0 1 ${r},-${r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} V${base} H${x} Z"/>` : ""}<rect class="hit" data-i="${i}" x="${ml + i * band}" y="${mt}" width="${band}" height="${ph}"/></g>`;
    });
    [0, 7, 14, 21, 29].forEach((i) => { g += `<text class="ax" x="${ml + i * band + band / 2}" y="${H - 6}" text-anchor="middle">${dm(daily[i].date)}</text>`; });
    const empty = daily.every((d) => d.cents === 0);
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Receita por dia nos últimos 30 dias">${g}</svg>${empty ? '<div class="chart-empty">Sem vendas pagas nos últimos 30 dias</div>' : ""}<div class="tip" hidden></div>`;
  }

  function wireChart(box, daily) {
    const tip = $(".tip", box), svg = $("svg", box);
    box.addEventListener("mousemove", (e) => {
      const hit = e.target.closest(".hit");
      if (!hit) { tip.hidden = true; return; }
      const d = daily[+hit.dataset.i];
      const hr = hit.getBoundingClientRect(), br = box.getBoundingClientRect(), sc = svg.getBoundingClientRect().width / 760;
      const max = niceMax(Math.max(...daily.map((x) => x.cents)));
      tip.innerHTML = `<b>${dm(d.date)}</b>${brlCents(d.cents)} · ${d.orders} pedido${d.orders === 1 ? "" : "s"}`;
      tip.style.left = hr.left - br.left + hr.width / 2 + "px";
      tip.style.top = hr.bottom - br.top - (d.cents / max) * (hr.height) + "px";
      tip.hidden = false;
    });
    box.addEventListener("mouseleave", () => (tip.hidden = true));
  }

  const pill = (s) => `<span class="pill ${esc(s)}">${esc(STATUS[s] || s)}</span>`;

  async function dashboard() {
    loading();
    let d;
    try { d = await api("/admin/dashboard"); } catch (e) { return fail(e); }
    const k = d.kpis;
    const statuses = Object.keys(STATUS).map((s) => `<div class="list-row"><span>${pill(s)}</span><span>${d.statusCounts[s] || 0}</span></div>`).join("");
    view().innerHTML = `
      <div class="adm-head"><h1>DASHBOARD</h1></div>
      <div class="kpis">
        ${kpi("Receita · 30 dias", brlCents(k.revenue30Cents), `${k.orders30} pedido${k.orders30 === 1 ? "" : "s"} pago${k.orders30 === 1 ? "" : "s"}`)}
        ${kpi("Ticket médio", brlCents(k.avgTicket30Cents), "últimos 30 dias")}
        ${kpi("Clientes", k.customersTotal, `+${k.customersNew30} nos últimos 30 dias`)}
        ${kpi("A enviar", k.toShip, "pagos ou em separação")}
        ${kpi("Aguardando pagamento", k.awaitingPayment, "pedidos pendentes")}
      </div>
      <div class="grid2">
        <div class="pc"><h2>Receita por dia · 30 dias</h2><div class="chart" id="chart">${barChart(d.daily)}</div>
          <details class="tview"><summary>Ver como tabela</summary><div class="table-wrap" style="margin-top:8px;max-height:260px;overflow:auto"><table class="t" style="min-width:0"><thead><tr><th>Dia</th><th class="num">Pedidos</th><th class="num">Receita</th></tr></thead><tbody>${d.daily.map((x) => `<tr><td>${dm(x.date)}</td><td class="num">${x.orders}</td><td class="num">${brlCents(x.cents)}</td></tr>`).join("")}</tbody></table></div></details></div>
        <div class="pc"><h2>Pedidos por status</h2>${statuses}</div>
      </div>
      <div class="grid2">
        <div class="pc"><h2>Últimos pedidos <button data-go="pedidos">ver todos</button></h2>
          ${d.recentOrders.length ? `<div class="table-wrap" style="border:0"><table class="t" style="min-width:0"><tbody>${d.recentOrders.map((o) => `<tr><td><button class="link-b" data-order="${esc(o.id)}">#${o.number}</button></td><td>${esc(o.customer || "")}<div class="sub">${fmtDate(o.createdAt)}</div></td><td>${pill(o.status)}</td><td class="num">${brlCents(o.totalCents)}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty-s">Nenhum pedido ainda.</div>'}</div>
        <div>
          <div class="pc"><h2>Mais vendidos · 30 dias</h2>${d.topProducts.length ? d.topProducts.map((p) => `<div class="list-row"><span>${esc(p.name)}</span><span class="mut">${p.qty} un · ${brlCents(p.cents)}</span></div>`).join("") : '<div class="empty-s">Sem vendas no período.</div>'}</div>
          <div class="pc" style="margin-top:14px"><h2>Estoque baixo</h2>${d.lowStock.length ? d.lowStock.map((p) => `<div class="list-row"><span>${esc(p.name)}</span><span class="${p.stock === 0 ? "" : "mut"}">${p.stock === 0 ? "esgotado" : p.stock + " un"}</span></div>`).join("") : '<div class="empty-s">Nenhum produto com estoque baixo.</div>'}</div>
        </div>
      </div>`;
    wireChart($("#chart"), d.daily);
  }

  /* ---------------- Pedidos ---------------- */
  let ordersCache = [];
  const ordersState = { status: "", q: "" };

  function ordersTable() {
    const q = norm(ordersState.q.trim());
    const rows = ordersCache.filter((o) => !q || norm(`${o.number} ${o.userName} ${o.userEmail} ${o.customerName}`).includes(q));
    $("#orders-body").innerHTML = rows.length
      ? rows.map((o) => `<tr><td><b>#${o.number}</b></td><td>${fmtDate(o.createdAt)}</td><td>${esc(o.userName || o.customerName)}<div class="sub">${esc(o.userEmail || "")}</div></td><td>${o.items.reduce((a, i) => a + i.qty, 0)}</td><td class="num">${brlCents(o.totalCents)}</td><td>${pill(o.status)}${o.trackingCode ? `<div class="sub">${esc(o.trackingCode)}</div>` : ""}</td><td class="num"><button class="link-b" data-order="${esc(o.id)}">Abrir</button></td></tr>`).join("")
      : '<tr><td colspan="7" class="empty-s">Nenhum pedido encontrado.</td></tr>';
  }

  async function orders() {
    loading();
    try { ordersCache = (await api("/admin/orders" + (ordersState.status ? "?status=" + ordersState.status : ""))).orders; } catch (e) { return fail(e); }
    view().innerHTML = `
      <div class="adm-head"><h1>PEDIDOS</h1><div class="tools">
        <input type="search" id="o-q" placeholder="Buscar nº, nome ou e-mail" value="${esc(ordersState.q)}" aria-label="Buscar pedidos">
        <select id="o-status" aria-label="Filtrar por status"><option value="">Todos os status</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${ordersState.status === k ? "selected" : ""}>${v}</option>`).join("")}</select>
      </div></div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Pedido</th><th>Data</th><th>Cliente</th><th>Itens</th><th class="num">Total</th><th>Status</th><th></th></tr></thead><tbody id="orders-body"></tbody></table></div>`;
    ordersTable();
    $("#o-q").oninput = (e) => { ordersState.q = e.target.value; ordersTable(); };
    $("#o-status").onchange = (e) => { ordersState.status = e.target.value; orders(); };
  }

  async function openOrder(id) {
    let o = ordersCache.find((x) => x.id === id);
    if (!o) { try { o = (await api("/admin/orders")).orders.find((x) => x.id === id); } catch (e) { return AQ.toast(e.message); } }
    if (!o) return AQ.toast("Pedido não encontrado.");
    const a = o.shippingAddress;
    modal.open(`
      <h2>PEDIDO #${o.number}</h2>
      <dl class="dl">
        <dt>Cliente</dt><dd>${esc(o.userName || o.customerName)}</dd>
        <dt>E-mail</dt><dd>${esc(o.customerEmail || o.userEmail)}</dd>
        <dt>Telefone</dt><dd>${esc(o.customerPhone || "—")}</dd>
        <dt>Data</dt><dd>${fmtDate(o.createdAt)}</dd>
        <dt>Pagamento</dt><dd>${o.paidAt ? "Confirmado em " + fmtDate(o.paidAt) : "Não confirmado"}</dd>
        <dt>Entrega</dt><dd>${a ? `${esc(a.name || "")}<br>${esc([a.line1, a.line2].filter(Boolean).join(", "))}<br>${esc([a.city, a.state].filter(Boolean).join(" - "))} · CEP ${esc(a.postal_code || "")}` : "— (endereço é coletado no pagamento)"}</dd>
      </dl>
      <div class="sec-t">Itens</div>
      ${o.items.map((i) => `<div class="list-row"><span>${esc(i.name)} <span class="mut">· tam. ${esc(i.size)} · ${i.qty}x</span></span><span>${brlCents(i.priceCents * i.qty)}</span></div>`).join("")}
      ${o.shippingCents ? `<div class="list-row"><span class="mut">Frete</span><span>${brlCents(o.shippingCents)}</span></div>` : ""}
      <div class="list-row"><b>Total</b><b>${brlCents(o.totalCents)}</b></div>
      <div class="sec-t">Atualizar andamento</div>
      <form class="form" id="order-form" novalidate>
        <div class="f2">
          <div class="field"><label for="of-status">Status</label><select id="of-status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${o.status === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
          <div class="field"><label for="of-track">Código de rastreio</label><input id="of-track" type="text" maxlength="60" value="${esc(o.trackingCode || "")}"></div>
        </div>
        <div class="field"><label for="of-note">Observação (o cliente vê no histórico)</label><input id="of-note" type="text" maxlength="300" placeholder="Ex.: Postado nos Correios"></div>
        <div class="form-msg" id="of-msg"></div>
        <div class="row-end"><button type="button" class="btn-outline" id="of-cancel">Fechar</button><button class="btn-primary" type="submit">Salvar</button></div>
      </form>
      <div class="sec-t">Histórico</div>
      <ul class="tl">${[...o.timeline].reverse().map((e) => `<li><b>${esc(STATUS[e.status] || e.status)}</b> · ${fmtDate(e.at)}${e.note ? ` — ${esc(e.note)}` : ""}</li>`).join("")}</ul>`);
    $("#of-cancel").onclick = modal.close;
    $("#order-form").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api("/admin/orders/" + o.id, { method: "PATCH", body: { status: $("#of-status").value, trackingCode: $("#of-track").value, note: $("#of-note").value } });
        modal.close(); AQ.toast("Pedido atualizado"); route();
      } catch (err) { $("#of-msg").textContent = err.message; $("#of-msg").className = "form-msg err"; }
    };
  }

  /* ---------------- Produtos ---------------- */
  let productsCache = [];
  const prodState = { q: "" };

  function productStatus(p) { return !p.active ? ["inativo", "Inativo"] : p.stock !== null && p.stock <= 0 ? ["esgotado", "Esgotado"] : ["ativo", "Ativo"]; }
  function productsTable() {
    const q = norm(prodState.q.trim());
    const rows = productsCache.filter((p) => !q || norm(`${p.name} ${p.brand} ${p.category}`).includes(q)).reverse();
    $("#prod-body").innerHTML = rows.length ? rows.map((p) => {
      const [c, l] = productStatus(p);
      return `<tr><td><img class="th" src="${esc(AQ.placeholder(p))}" alt=""></td><td><b>${esc(p.name)}</b><div class="sub">${esc(p.brand)}</div></td><td>${esc((S.categories.find((x) => x.slug === p.category) || { label: p.category }).label)}</td><td class="num">${brl(p.price)}</td><td class="num">${p.stock === null ? "∞" : p.stock}</td><td><span class="pill ${c}">${l}</span></td><td class="num"><button class="link-b" data-product="${esc(p.id)}">Editar</button></td></tr>`;
    }).join("") : '<tr><td colspan="7" class="empty-s">Nenhum produto.</td></tr>';
  }

  async function products() {
    loading();
    try { productsCache = (await api("/admin/products")).products; } catch (e) { return fail(e); }
    view().innerHTML = `
      <div class="adm-head"><h1>PRODUTOS</h1><div class="tools">
        <input type="search" id="p-q" placeholder="Buscar produto" value="${esc(prodState.q)}" aria-label="Buscar produtos">
        <button class="btn-primary" id="p-new">+ Novo produto</button>
      </div></div>
      <div class="table-wrap"><table class="t"><thead><tr><th></th><th>Produto</th><th>Categoria</th><th class="num">Preço</th><th class="num">Estoque</th><th>Status</th><th></th></tr></thead><tbody id="prod-body"></tbody></table></div>
      <p class="sub" style="margin-top:12px;color:var(--muted);font-size:12px">Produtos não são apagados: use “Inativo” para tirar da loja sem perder o histórico de pedidos. Estoque vazio = ilimitado.</p>`;
    productsTable();
    $("#p-q").oninput = (e) => { prodState.q = e.target.value; productsTable(); };
    $("#p-new").onclick = () => openProduct(null);
  }

  function readFileAsJpeg(file, max = 900) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
      fr.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Arquivo de imagem inválido."));
        img.onload = () => {
          const sc = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
          const g = c.getContext("2d");
          g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
          let q = 0.85, out = c.toDataURL("image/jpeg", q);
          while (out.length > 600000 && q > 0.4) { q -= 0.1; out = c.toDataURL("image/jpeg", q); }
          resolve(out);
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  function openProduct(id) {
    const p = id ? productsCache.find((x) => x.id === id) : null;
    const v = p || { name: "", brand: "", category: S.categories[0].slug, price: "", stock: null, sizes: [], tags: [], description: "", color: "#333333", image: "", bestseller: false, isNew: true, active: true };
    let image = v.image || "";
    modal.open(`
      <h2>${p ? "EDITAR PRODUTO" : "NOVO PRODUTO"}</h2>
      <form class="form" id="prod-form" novalidate>
        <div class="f2">
          <div class="field"><label for="pf-name">Nome</label><input id="pf-name" type="text" maxlength="120" value="${esc(v.name)}" required></div>
          <div class="field"><label for="pf-brand">Marca</label><input id="pf-brand" type="text" maxlength="60" value="${esc(v.brand)}"></div>
          <div class="field"><label for="pf-cat">Categoria</label><select id="pf-cat">${S.categories.map((c) => `<option value="${esc(c.slug)}" ${v.category === c.slug ? "selected" : ""}>${esc(c.label)}</option>`).join("")}</select></div>
          <div class="field"><label for="pf-price">Preço (R$)</label><input id="pf-price" type="number" step="0.01" min="0.01" value="${v.price}" required></div>
          <div class="field"><label for="pf-sizes">Tamanhos</label><input id="pf-sizes" type="text" value="${esc(v.sizes.join(", "))}" placeholder="P, M, G  ou  38, 39, 40  ou  Único" required><small>Separe por vírgula.</small></div>
          <div class="field"><label for="pf-stock">Estoque</label><input id="pf-stock" type="number" min="0" step="1" value="${v.stock === null ? "" : v.stock}" placeholder="vazio = ilimitado"></div>
        </div>
        <div class="field"><label for="pf-tags">Etiquetas de busca</label><input id="pf-tags" type="text" value="${esc(v.tags.join(", "))}" placeholder="camiseta, casaco, sandalia, lifestyle"><small>Usadas nos filtros do menu (ex.: <i>camiseta</i>, <i>casaco</i>, <i>sandalia</i>, <i>lifestyle</i>).</small></div>
        <div class="field"><label for="pf-desc">Descrição</label><textarea id="pf-desc" rows="4" maxlength="3000">${esc(v.description)}</textarea></div>
        <div class="field"><label>Imagem</label>
          <div class="imgbox"><img id="pf-prev" src="" alt="">
            <div style="flex:1;min-width:220px;display:grid;gap:8px">
              <input type="file" id="pf-file" accept="image/png,image/jpeg,image/webp">
              <input type="text" id="pf-url" placeholder="ou cole um link https://…" value="${esc(image.startsWith("http") ? image : "")}">
              <button type="button" class="link-b" id="pf-clear" style="text-align:left">Remover imagem</button>
            </div></div></div>
        <div class="field"><label for="pf-color">Cor do placeholder (sem imagem)</label><input id="pf-color" type="color" value="${esc(v.color)}" style="padding:2px;height:40px;width:80px"></div>
        <div class="checks">
          <label><input type="checkbox" id="pf-active" ${v.active ? "checked" : ""}> Ativo na loja</label>
          <label><input type="checkbox" id="pf-best" ${v.bestseller ? "checked" : ""}> Mais vendido</label>
          <label><input type="checkbox" id="pf-new" ${v.isNew ? "checked" : ""}> Novidade</label>
        </div>
        <div class="form-msg" id="pf-msg" role="alert"></div>
        <div class="row-end"><button type="button" class="btn-outline" id="pf-cancel">Cancelar</button><button class="btn-primary" type="submit">Salvar</button></div>
      </form>`);

    const prev = () => { $("#pf-prev").src = AQ.placeholder({ image, brand: $("#pf-brand").value, color: $("#pf-color").value }); };
    prev();
    $("#pf-color").oninput = prev; $("#pf-brand").oninput = prev;
    $("#pf-file").onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { image = await readFileAsJpeg(f); $("#pf-url").value = ""; prev(); } catch (err) { $("#pf-msg").textContent = err.message; $("#pf-msg").className = "form-msg err"; }
    };
    $("#pf-url").oninput = (e) => { image = e.target.value.trim(); prev(); };
    $("#pf-clear").onclick = () => { image = ""; $("#pf-url").value = ""; $("#pf-file").value = ""; prev(); };
    $("#pf-cancel").onclick = modal.close;

    $("#prod-form").onsubmit = async (e) => {
      e.preventDefault();
      const btn = $("button[type=submit]", e.target); btn.disabled = true;
      const body = {
        name: $("#pf-name").value, brand: $("#pf-brand").value, category: $("#pf-cat").value, price: $("#pf-price").value,
        sizes: $("#pf-sizes").value, tags: $("#pf-tags").value, stock: $("#pf-stock").value, description: $("#pf-desc").value,
        color: $("#pf-color").value, image, active: $("#pf-active").checked, bestseller: $("#pf-best").checked, isNew: $("#pf-new").checked,
      };
      try {
        await api(p ? "/admin/products/" + encodeURIComponent(p.id) : "/admin/products", { method: p ? "PUT" : "POST", body });
        modal.close(); AQ.toast(p ? "Produto atualizado" : "Produto criado"); products();
      } catch (err) { $("#pf-msg").textContent = err.message; $("#pf-msg").className = "form-msg err"; btn.disabled = false; }
    };
  }

  /* ---------------- Clientes (somente leitura) ---------------- */
  async function customers() {
    loading();
    let list;
    try { list = (await api("/admin/customers")).customers; } catch (e) { return fail(e); }
    view().innerHTML = `
      <div class="adm-head"><h1>CLIENTES <span style="font-size:18px;color:var(--muted)">(${list.length})</span></h1><div class="tools"><input type="search" id="c-q" placeholder="Buscar nome ou e-mail" aria-label="Buscar clientes"></div></div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Cliente</th><th>Telefone</th><th>Cadastro</th><th class="num">Pedidos pagos</th><th class="num">Total gasto</th><th>Último pedido</th></tr></thead><tbody id="c-body"></tbody></table></div>`;
    const draw = () => {
      const q = norm($("#c-q").value.trim());
      const rows = list.filter((c) => !q || norm(`${c.name} ${c.email}`).includes(q));
      $("#c-body").innerHTML = rows.length ? rows.map((c) => `<tr><td><b>${esc(c.name)}</b><div class="sub">${esc(c.email)}</div></td><td>${esc(c.phone || "—")}</td><td>${fmtDate(c.createdAt)}</td><td class="num">${c.ordersCount}</td><td class="num">${brlCents(c.spentCents)}</td><td>${c.lastOrderAt ? fmtDate(c.lastOrderAt) : "—"}</td></tr>`).join("") : '<tr><td colspan="6" class="empty-s">Nenhum cliente encontrado.</td></tr>';
    };
    $("#c-q").oninput = draw; draw();
  }

  /* ---------------- Navegação ---------------- */
  const views = { dashboard, pedidos: orders, produtos: products, clientes: customers };
  function route() {
    const name = (location.hash || "#dashboard").slice(1);
    const key = views[name] ? name : "dashboard";
    $$(".nav-i").forEach((b) => b.classList.toggle("on", b.dataset.view === key));
    views[key]();
  }

  AQ.pages.admin = function () {
    const gate = $("#gate");
    if (!AQ.user || AQ.user.role !== "admin") {
      gate.hidden = false;
      gate.innerHTML = `<img src="img/logo.png" alt=""><h1 class="section-title" style="font-size:34px">ÁREA RESTRITA</h1><p>${AQ.user ? "Esta conta não tem permissão de administrador." : "Entre com a conta de administrador para continuar."}</p><a class="btn-primary" href="${AQ.user ? "index.html" : "login.html?next=admin.html"}">${AQ.user ? "Voltar à loja" : "Entrar"}</a>`;
      return;
    }
    $("#app").hidden = false;
    $("#adm-user").textContent = AQ.user.email;
    $("#adm-nav").onclick = (e) => { const b = e.target.closest("[data-view]"); if (b) location.hash = b.dataset.view; };
    $("#adm-logout").onclick = async () => { try { await api("/auth/logout", { method: "POST", body: {} }); } catch {} location.href = "index.html"; };
    $("#modal-x").onclick = modal.close;
    $("#modal").addEventListener("mousedown", (e) => { if (e.target.id === "modal") modal.close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") modal.close(); });
    // delegação: abrir pedido / editar produto / ir para outra aba
    view().addEventListener("click", (e) => {
      const o = e.target.closest("[data-order]"), p = e.target.closest("[data-product]"), g = e.target.closest("[data-go]");
      if (o) openOrder(o.dataset.order);
      if (p) openProduct(p.dataset.product);
      if (g) location.hash = g.dataset.go;
    });
    window.addEventListener("hashchange", route);
    route();
  };
})();
