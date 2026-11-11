/* Área do cliente: pedidos com acompanhamento, dados e senha */
(function () {
  const { $, $$, api, esc, brl, brlCents, fmtDate, STATUS } = AQ;
  const FLOW = [["pendente", "Pedido feito"], ["pago", "Pago"], ["em_separacao", "Separação"], ["enviado", "Enviado"], ["entregue", "Entregue"]];

  function stepper(status) {
    if (status === "cancelado") return "";
    const idx = FLOW.findIndex(([s]) => s === status);
    return `<div class="steps">${FLOW.map(([, label], i) => `<div class="step ${i <= idx ? "done" : ""}"><i></i>${esc(label)}</div>`).join("")}</div>`;
  }

  function addressHTML(a) {
    if (!a) return "";
    const line = [a.line1, a.line2].filter(Boolean).join(", ");
    return `<div class="addr"><strong style="color:#fff">Entrega:</strong> ${esc(a.name || "")}<br>${esc(line)}<br>${esc([a.city, a.state].filter(Boolean).join(" - "))} · CEP ${esc(a.postal_code || "")}</div>`;
  }

  function orderHTML(o) {
    const track = o.trackingCode
      ? `<div class="track"><div><div style="font-size:11px;letter-spacing:.14em;color:var(--muted);text-transform:uppercase">Código de rastreio</div><code>${esc(o.trackingCode)}</code></div><button class="btn-outline" style="padding:10px 18px" data-copy="${esc(o.trackingCode)}">Copiar</button></div>`
      : "";
    const via = o.deliveryMethod === "uber_flash" ? "Entrega por Uber Flash" : o.deliveryMethod === "envio" ? "Envio para todo o Brasil" : "";
    const tl = [...o.timeline].reverse().map((e) => `<li><b>${esc(STATUS[e.status] || e.status)}</b> · ${fmtDate(e.at)}${e.note ? ` — ${esc(e.note)}` : ""}</li>`).join("");
    return `<article class="order">
      <div class="order-head">
        <div><div class="num">PEDIDO #${o.number}</div><div class="meta">${fmtDate(o.createdAt)}${o.fulfillment === "encomenda" ? " · Por encomenda" : ""}${via ? " · " + via : ""}</div></div>
        <span class="pill ${esc(o.status)}">${esc(STATUS[o.status] || o.status)}</span>
      </div>
      <div class="order-body">
        ${stepper(o.status)}
        ${o.items.map((i) => `<div class="oi"><img src="${esc(AQ.placeholder({ image: i.image, brand: i.brand, color: "#222" }))}" alt=""><div><div>${esc(i.name)}</div><div class="s">Tamanho ${esc(i.size)} · ${i.qty}x</div></div><div>${brlCents(i.priceCents * i.qty)}</div></div>`).join("")}
        ${o.shippingCents ? `<div class="total-row" style="font-weight:400;color:var(--muted)"><span>Frete</span><span>${brlCents(o.shippingCents)}</span></div>` : ""}
        <div class="total-row"><span>Total</span><span>${brlCents(o.totalCents)}</span></div>
        ${track}${addressHTML(o.shippingAddress)}
        <details style="margin-top:14px"><summary style="cursor:pointer;color:var(--muted);font-size:13px">Histórico do pedido</summary><ul class="tl">${tl}</ul></details>
      </div>
    </article>`;
  }

  async function loadOrders() {
    const box = $("#orders");
    box.innerHTML = '<p style="color:var(--muted)">Carregando…</p>';
    try {
      const { orders } = await api("/orders");
      box.innerHTML = orders.length ? orders.map(orderHTML).join("") : '<p style="color:var(--muted);margin:30px 0">Você ainda não fez nenhum pedido.</p><a class="btn-primary" href="loja.html">Ir para a loja</a>';
    } catch (e) {
      box.innerHTML = `<p class="form-msg err">${esc(e.message)}</p>`;
    }
  }

  function msg(el, text, ok) { el.textContent = text; el.className = "form-msg " + (ok ? "ok" : "err"); }

  AQ.pages.account = function () {
    if (!AQ.user) { location.replace("login.html?next=conta.html"); return; }
    const u = AQ.user;
    $("#hello").textContent = `Olá, ${u.name.split(" ")[0]}! Aqui você acompanha seus pedidos.`;
    $("#p-name").value = u.name; $("#p-email").value = u.email; $("#p-phone").value = u.phone || "";

    $$(".tabs button").forEach((b) => (b.onclick = () => {
      $$(".tabs button").forEach((x) => x.classList.toggle("on", x === b));
      $("#tab-orders").hidden = b.dataset.tab !== "orders";
      $("#tab-profile").hidden = b.dataset.tab !== "profile";
    }));
    $("#orders").addEventListener("click", (e) => {
      const b = e.target.closest("[data-copy]");
      if (b) navigator.clipboard?.writeText(b.dataset.copy).then(() => AQ.toast("Código copiado"));
    });

    $("#form-profile").onsubmit = async (e) => {
      e.preventDefault();
      try {
        const { user } = await api("/account", { method: "PATCH", body: { name: $("#p-name").value, phone: $("#p-phone").value } });
        AQ.user = user; msg($("#p-msg"), "Dados salvos.", true);
      } catch (err) { msg($("#p-msg"), err.message, false); }
    };
    $("#form-pass").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api("/account/password", { method: "POST", body: { current: $("#s-cur").value, next: $("#s-new").value } });
        e.target.reset(); msg($("#s-msg"), "Senha alterada.", true);
      } catch (err) { msg($("#s-msg"), err.message, false); }
    };
    $("#logout").onclick = async () => { try { await api("/auth/logout", { method: "POST", body: {} }); } catch {} location.href = "index.html"; };

    loadOrders();
  };
})();
