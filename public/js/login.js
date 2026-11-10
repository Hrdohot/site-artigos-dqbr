/* Login e cadastro */
(function () {
  const { $, $$, api, safeNext } = AQ;

  AQ.pages.login = function () {
    const next = safeNext(new URLSearchParams(location.search).get("next"));
    const dest = (u) => next || (u.role === "admin" ? "admin.html" : "conta.html");
    if (AQ.user) { location.replace(dest(AQ.user)); return; }

    const show = (tab) => {
      $$(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
      $("#form-login").hidden = tab !== "login";
      $("#form-register").hidden = tab !== "register";
      $(tab === "login" ? "#l-email" : "#r-name").focus();
    };
    $$(".tabs button").forEach((b) => (b.onclick = () => show(b.dataset.tab)));
    $$("[data-go]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); show(a.dataset.go); }));
    if (location.hash === "#cadastro") show("register");

    async function submit(form, msgEl, path, body) {
      const btn = $("button[type=submit]", form);
      msgEl.textContent = "";
      btn.disabled = true;
      try {
        const { user } = await api(path, { method: "POST", body });
        location.href = dest(user);
      } catch (e) {
        msgEl.textContent = e.message;
        btn.disabled = false;
      }
    }

    $("#form-login").onsubmit = (e) => {
      e.preventDefault();
      submit(e.target, $("#l-msg"), "/auth/login", { email: $("#l-email").value, password: $("#l-pass").value });
    };
    $("#form-register").onsubmit = (e) => {
      e.preventDefault();
      if ($("#r-pass").value.length < 8) { $("#r-msg").textContent = "A senha deve ter pelo menos 8 caracteres."; return; }
      submit(e.target, $("#r-msg"), "/auth/register", {
        name: $("#r-name").value, email: $("#r-email").value, phone: $("#r-phone").value, password: $("#r-pass").value,
      });
    };
  };
})();
