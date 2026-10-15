/* ═══════════════════════════════════════════════════════════
   AUTH — COMIC 2026 (server: PHP + MySQL, sesi via cookie)
   Butuh api.js dimuat sebelum/sesudah file ini (dipakai saat runtime).
   ═══════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  /* ── SESI (cache dari server) ── */
  let currentUser = null;
  let resolveReady;
  const ready = new Promise((res) => { resolveReady = res; });

  const getSession = () => currentUser;

  async function refreshSession() {
    const r = await COMIC_API("me");
    currentUser = (r && r.user) ? r.user : null;
    return currentUser;
  }

  async function doLogout() {
    await COMIC_API("logout", { data: {} });
    currentUser = null;
  }

  /* ── MODAL ── */
  const overlay = () => document.getElementById("modalOverlay");
  const box     = () => document.getElementById("modalBox");
  const content = () => document.getElementById("modalContent");
  let pendingLomba = null;

  function openModal() {
    const o = overlay(); if (!o) return;
    o.classList.add("active"); o.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    const o = overlay(); if (!o) return;
    o.classList.remove("active"); o.setAttribute("aria-hidden", "true");
    document.body.style.overflow = ""; pendingLomba = null;
  }
  function setContent(html) {
    const c = content(); if (c) c.innerHTML = html;
    const b = box(); if (b) b.scrollTop = 0;
  }

  /* ── VIEWS ── */
  function viewLogin() {
    setContent(`
      <div class="modal-eyebrow">— PORTA CODEX —</div>
      <h3 class="modal-title">Masuk</h3>
      <p class="modal-sub">${pendingLomba ? 'Masuk untuk daftar <em>' + esc(pendingLomba) + '</em>' : 'Masuk ke akun COMIC 2026-mu'}</p>
      <div class="modal-alert" id="modalAlert"></div>
      <form id="modalLoginForm">
        <div class="modal-field"><label>Email</label><input type="email" id="mEmail" required></div>
        <div class="modal-field"><label>Password</label><input type="password" id="mPassword" required></div>
        <button type="submit" class="modal-submit">Masuk</button>
      </form>
      <div class="modal-switch">Belum punya akun? <a href="#" data-view="register">Daftar Sekarang</a></div>
    `);
    bindLoginForm(); bindViewSwitch(); openModal();
  }

  function viewRegister() {
    setContent(`
      <div class="modal-eyebrow">— INSCRIPTIO —</div>
      <h3 class="modal-title">Registrasi</h3>
      <p class="modal-sub">Buat akun untuk mengikuti COMIC 2026</p>
      <div class="modal-alert" id="modalAlert"></div>
      <form id="modalRegisterForm">
        <div class="modal-field"><label>Nama Lengkap</label><input type="text" id="mName" required></div>
        <div class="modal-field"><label>Email</label><input type="email" id="mRegEmail" required></div>
        <div class="modal-field"><label>Password</label><input type="password" id="mRegPassword" minlength="6" required></div>
        <div class="modal-field"><label>Asal Sekolah</label><input type="text" id="mSchool" required></div>
        <div class="modal-field"><label>Jenjang</label>
          <select id="mLevel" required>
            <option value="">-- Pilih Jenjang --</option>
            <option value="TK/RA">TK/RA</option>
            <option value="SD/MI">SD/MI</option>
            <option value="SMP/MTs">SMP/MTs</option>
            <option value="SMA/MA">SMA/MA</option>
            <option value="Umum">Umum</option>
          </select>
        </div>
        <button type="submit" class="modal-submit">Daftar</button>
      </form>
      <div class="modal-switch">Sudah punya akun? <a href="#" data-view="login">Masuk</a></div>
    `);
    bindRegisterForm(); bindViewSwitch(); openModal();
  }

  function viewPanduan() {
    setContent(`
      <div class="modal-eyebrow">— MANUALE —</div>
      <h3 class="modal-title">Panduan COMIC 2026</h3>
      <ul class="modal-panduan-list">
        <li><strong>1. Buat Akun</strong> — Isi data dengan benar.</li>
        <li><strong>2. Pilih Lomba</strong> — Individu atau tim.</li>
        <li><strong>3. Follow IG</strong> — @icacehtimur & @icat.comic.</li>
        <li><strong>4. Bayar</strong> — Transfer ke <strong>1234567890</strong>.</li>
        <li><strong>5. Selesai</strong> — Tunggu konfirmasi panitia.</li>
      </ul>
      <button class="modal-submit" id="panduanDaftarBtn">Daftar Sekarang</button>
    `);
    document.getElementById("panduanDaftarBtn").addEventListener("click", async () => {
      await ready;
      if (getSession()) goToPendaftaran(null); else viewRegister();
    });
    openModal();
  }

  function goToPendaftaran(lombaName) {
    const url = new URL("pendaftaran.html", location.href);
    if (lombaName) url.searchParams.set("lomba", lombaName);
    location.href = url.toString();
  }

  /* ── ALERT ── */
  function showAlert(text, type) {
    const el = document.getElementById("modalAlert");
    if (!el) return;
    el.textContent = text;
    el.className = "modal-alert " + type;
    el.style.display = "block";
  }

  function setBusy(form, busy) {
    const b = form.querySelector('button[type="submit"]');
    if (b) b.disabled = busy;
  }

  /* ── FORM DI MODAL ── */
  function bindLoginForm() {
    const form = document.getElementById("modalLoginForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("mEmail").value.trim().toLowerCase();
      const password = document.getElementById("mPassword").value;
      if (!email || !password) return showAlert("Semua wajib diisi.", "error");

      setBusy(form, true);
      const r = await COMIC_API("login", { data: { email, password } });
      setBusy(form, false);
      if (r.error) return showAlert(r.error.msg, "error");

      currentUser = r.user;
      showAlert("Login berhasil!", "success");
      renderTopbarAuth();
      setTimeout(() => {
        if (pendingLomba) goToPendaftaran(pendingLomba);
        else closeModal();
      }, 600);
    });
  }

  function bindRegisterForm() {
    const form = document.getElementById("modalRegisterForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = {
        name:     document.getElementById("mName").value.trim(),
        email:    document.getElementById("mRegEmail").value.trim().toLowerCase(),
        password: document.getElementById("mRegPassword").value,
        school:   document.getElementById("mSchool").value.trim(),
        level:    document.getElementById("mLevel").value
      };
      if (!data.name || !data.email || !data.password || !data.school || !data.level)
        return showAlert("Semua kolom wajib diisi.", "error");
      if (data.password.length < 6) return showAlert("Password minimal 6 karakter.", "error");

      setBusy(form, true);
      const r = await COMIC_API("register", { data });
      setBusy(form, false);
      if (r.error) return showAlert(r.error.msg, "error");

      currentUser = r.user;
      showAlert("Registrasi berhasil!", "success");
      renderTopbarAuth();
      setTimeout(() => {
        if (pendingLomba) goToPendaftaran(pendingLomba);
        else closeModal();
      }, 700);
    });
  }

  function bindViewSwitch() {
    document.querySelectorAll("[data-view]").forEach(a => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const v = a.getAttribute("data-view");
        if (v === "login") viewLogin();
        else if (v === "register") viewRegister();
      });
    });
  }

  /* ── FORM DI HALAMAN login.html & register.html ── */
  function pageMsg(text, type) {
    const el = document.getElementById("authMessage");
    if (!el) return;
    el.textContent = text;
    el.className = "auth-message " + type;
  }

  function afterAuthRedirect() {
    const want = new URLSearchParams(location.search).get("lomba");
    setTimeout(() => {
      if (want) goToPendaftaran(want);
      else location.href = "index.html";
    }, 700);
  }

  function bindPageForms() {
    const lf = document.getElementById("loginForm");
    if (lf) {
      lf.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("loginEmail").value.trim().toLowerCase();
        const password = document.getElementById("loginPassword").value;
        if (!email || !password) return pageMsg("Email dan password wajib diisi.", "error");
        setBusy(lf, true);
        const r = await COMIC_API("login", { data: { email, password } });
        setBusy(lf, false);
        if (r.error) return pageMsg(r.error.msg, "error");
        currentUser = r.user;
        pageMsg("Login berhasil! Mengalihkan…", "success");
        afterAuthRedirect();
      });
    }

    const rf = document.getElementById("registerForm");
    if (rf) {
      rf.addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = {
          name:     document.getElementById("regName").value.trim(),
          email:    document.getElementById("regEmail").value.trim().toLowerCase(),
          password: document.getElementById("regPassword").value,
          school:   document.getElementById("regSchool").value.trim(),
          level:    document.getElementById("regLevel").value
        };
        if (!data.name || !data.email || !data.password || !data.school || !data.level)
          return pageMsg("Semua kolom wajib diisi.", "error");
        if (data.password.length < 6) return pageMsg("Password minimal 6 karakter.", "error");
        setBusy(rf, true);
        const r = await COMIC_API("register", { data });
        setBusy(rf, false);
        if (r.error) return pageMsg(r.error.msg, "error");
        currentUser = r.user;
        pageMsg("Registrasi berhasil! Mengalihkan…", "success");
        afterAuthRedirect();
      });
    }
  }

  /* ── TOPBAR ── */
  function renderTopbarAuth() {
    const wrap = document.getElementById("authActions");
    if (!wrap) return;
    const s = getSession();
    if (s) {
      wrap.innerHTML = `
        <span class="auth-user-chip">✦ ${esc(s.name.split(" ")[0])}</span>
        <a href="#" class="auth-btn-top ghost" id="topbarLogout">Logout</a>`;
      document.getElementById("topbarLogout").addEventListener("click", async (e) => {
        e.preventDefault();
        await doLogout();
        // Di halaman pendaftaran, keluar berarti kembali ke beranda
        if (/pendaftaran\.html$/i.test(location.pathname)) { location.href = "index.html"; return; }
        renderTopbarAuth();
      });
    } else {
      wrap.innerHTML = `
        <a href="#" class="auth-btn-top ghost" id="topbarLogin">Masuk</a>
        <a href="#" class="auth-btn-top primary" id="topbarRegister">Daftar</a>`;
      document.getElementById("topbarLogin").addEventListener("click", (e) => {
        e.preventDefault(); pendingLomba = null; viewLogin();
      });
      document.getElementById("topbarRegister").addEventListener("click", (e) => {
        e.preventDefault(); pendingLomba = null; viewRegister();
      });
    }
  }

  /* ── CARDS & BUTTONS ── */
  function bindKategoriCards() {
    document.querySelectorAll(".kategori-card").forEach(card => {
      const lomba = card.getAttribute("data-lomba")
                  || (card.querySelector("h3") && card.querySelector("h3").textContent.trim())
                  || "Lomba";
      const handler = async (e) => {
        e.preventDefault();
        pendingLomba = lomba;
        await ready;
        if (getSession()) goToPendaftaran(lomba); else viewLogin();
      };
      card.addEventListener("click", handler);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handler(e); }
      });
    });
  }

  function bindHeroButtons() {
    document.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const a = btn.getAttribute("data-action");
        if (a === "daftar") {
          pendingLomba = null;
          await ready;
          if (getSession()) goToPendaftaran(null); else viewRegister();
        } else if (a === "panduan") viewPanduan();
      });
    });
  }

  function bindModalClose() {
    const o = overlay();
    const btn = document.getElementById("modalClose");
    if (btn) btn.addEventListener("click", closeModal);
    if (o) o.addEventListener("click", (e) => { if (e.target === o) closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  /* ── BOOT ── */
  async function boot() {
    bindModalClose();
    bindHeroButtons();
    bindKategoriCards();
    bindPageForms();
    try { await refreshSession(); } catch (e) { currentUser = null; }
    renderTopbarAuth();
    resolveReady(currentUser);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  /* ── EXPORT ── */
  window.COMIC_AUTH = {
    ready, getSession, refreshSession,
    openModal, closeModal, goToPendaftaran
  };
})();
