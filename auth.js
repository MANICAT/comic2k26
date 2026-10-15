/* ═══════════════════════════════════════════════════════════
   AUTH — COMIC 2026 (localStorage only)
   ═══════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const USERS_KEY   = "comic2026_users";
  const SESSION_KEY = "comic2026_session";

  /* ── STORAGE ── */
  const getUsers = () => {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
    catch { return []; }
  };
  const saveUsers = (u) => localStorage.setItem(USERS_KEY, JSON.stringify(u));

  const getSession = () => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch { return null; }
  };
  const setSession = (u) => localStorage.setItem(SESSION_KEY, JSON.stringify(u));
  const clearSession = () => localStorage.removeItem(SESSION_KEY);

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
    document.getElementById("panduanDaftarBtn").addEventListener("click", () => {
      if (getSession()) goToPendaftaran(null); else viewRegister();
    });
    openModal();
  }

  function goToPendaftaran(lombaName) {
    const url = new URL("pendaftaran.html", location.href);
    if (lombaName) url.searchParams.set("lomba", lombaName);
    location.href = url.toString();
  }

  /* ── FORM HANDLERS ── */
  function showAlert(text, type) {
    const el = document.getElementById("modalAlert");
    if (!el) return;
    el.textContent = text;
    el.className = "modal-alert " + type;
    el.style.display = "block";
  }

  function bindLoginForm() {
    document.getElementById("modalLoginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("mEmail").value.trim().toLowerCase();
      const pass  = document.getElementById("mPassword").value;
      if (!email || !pass) return showAlert("Semua wajib diisi.", "error");

      const users = getUsers();
      const user = users.find(u => u.email === email);
      if (!user) return showAlert("Akun tidak ditemukan.", "error");
      if (user.password !== pass) return showAlert("Password salah.", "error");

      setSession(user);
      showAlert("Login berhasil!", "success");
      renderTopbarAuth();

      setTimeout(() => {
        if (pendingLomba) goToPendaftaran(pendingLomba);
        else closeModal();
      }, 600);
    });
  }

  function bindRegisterForm() {
    document.getElementById("modalRegisterForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name     = document.getElementById("mName").value.trim();
      const email    = document.getElementById("mRegEmail").value.trim().toLowerCase();
      const password = document.getElementById("mRegPassword").value;
      const school   = document.getElementById("mSchool").value.trim();
      const level    = document.getElementById("mLevel").value;

      if (!name || !email || !password || !school || !level)
        return showAlert("Semua kolom wajib diisi.", "error");
      if (password.length < 6) return showAlert("Password minimal 6 karakter.", "error");

      const users = getUsers();
      if (users.some(u => u.email === email))
        return showAlert("Email sudah terdaftar.", "error");

      const newUser = { name, email, password, school, level, createdAt: Date.now() };
      users.push(newUser);
      saveUsers(users);
      setSession(newUser);

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

  /* ── TOPBAR ── */
  function renderTopbarAuth() {
    const wrap = document.getElementById("authActions");
    if (!wrap) return;
    const s = getSession();
    if (s) {
      wrap.innerHTML = `
        <span class="auth-user-chip">✦ ${esc(s.name.split(" ")[0])}</span>
        <a href="#" class="auth-btn-top ghost" id="topbarLogout">Logout</a>`;
      document.getElementById("topbarLogout").addEventListener("click", (e) => {
        e.preventDefault();
        clearSession(); renderTopbarAuth();
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
      const handler = (e) => {
        e.preventDefault();
        pendingLomba = lomba;
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
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const a = btn.getAttribute("data-action");
        if (a === "daftar") {
          pendingLomba = null;
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
  function boot() {
    renderTopbarAuth();
    bindModalClose();
    bindHeroButtons();
    bindKategoriCards();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  /* ── EXPORT ── */
  window.COMIC_AUTH = {
    getSession, getUsers, saveUsers,
    setSession, clearSession,
    openModal, closeModal, goToPendaftaran
  };
})();