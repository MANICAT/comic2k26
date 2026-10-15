/* ═══════════════════════════════════════════════════════════
   COMIC 2026 — PENDAFTARAN (IndexedDB storage)
   Limit 15 MB per file. Gambar otomatis dikompres.
   ═══════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const LOMBA_DATA = [
    { name:"Mewarnai",              price:20000,  levels:["TK/RA"],                    team:null },
    { name:"Fashion Show",          price:20000,  levels:["TK/RA"],                    team:null },
    { name:"Cerdas Cermat",         price:75000,  levels:["SD/MI"],                    team:{min:2,max:3} },
    { name:"Hitung Cepat",          price:15000,  levels:["SD/MI"],                    team:null },
    { name:"Olimpiade",             price:20000,  levels:["SD/MI"],                    team:null },
    { name:"Tahfidz",               price:20000,  levels:["SD/MI"],                    team:null },
    { name:"Menggambar/Mendongeng", price:20000,  levels:["SD/MI"],                    team:null },
    { name:"Vocal Solo",            price:50000,  levels:["SMP/MTs"],                  team:null },
    { name:"Story Telling",         price:20000,  levels:["SMP/MTs"],                  team:null },
    { name:"Cerdas Cermat",         price:75000,  levels:["SMP/MTs"],                  team:{min:2,max:3} },
    { name:"Olimpiade",             price:20000,  levels:["SMP/MTs"],                  team:null },
    { name:"Hitung Cepat",          price:15000,  levels:["SMP/MTs"],                  team:null },
    { name:"Ranking 1",             price:15000,  levels:["SMP/MTs"],                  team:null },
    { name:"Volly Ball",            price:150000, levels:["SMA/MA"],                   team:{min:6,max:12} },
    { name:"Badminton",             price:90000,  levels:["SMA/MA"],                   team:{min:1,max:2} },
    { name:"Cerdas Cermat",         price:75000,  levels:["SMA/MA"],                   team:{min:2,max:3} },
    { name:"Syarhil Qur'an",        price:75000,  levels:["SMA/MA"],                   team:{min:2,max:3} },
    { name:"Essay",                 price:30000,  levels:["SMA/MA","Umum"],            team:null },
    { name:"E-Sport",               price:100000, levels:["SMA/MA","Umum"],            team:{min:4,max:6} },
    { name:"Fotografi",             price:30000,  levels:["Umum","SMA/MA","SMP/MTs"],  team:null }
  ];

  const SESSION_KEY = "comic2026_session";
  const MAX_FILE = 15 * 1024 * 1024; // 15 MB

  const state = {
    session: null,
    taken: [],
    lomba: "",
    lombaPrice: 0,
    isTeam: false,
    teamMin: 0, teamMax: 0,
    teamMembers: [],
    files: { surat: null, ig1: null, ig2: null, pay: null }
  };

  /* ═══════════════════════════════════════════════════════
     INDEXEDDB — penyimpanan data + gambar
     ═══════════════════════════════════════════════════════ */
  const DB_NAME = "comic2026";
  const DB_STORE = "registrations";
  const DB_VERSION = 1;

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          const store = db.createObjectStore(DB_STORE, { keyPath: "id", autoIncrement: true });
          store.createIndex("email", "email", { unique: false });
          store.createIndex("reg_code", "reg_code", { unique: true });
          store.createIndex("created_at", "created_at", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbAdd(record) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      const req = tx.objectStore(DB_STORE).add(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbGetAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const req = tx.objectStore(DB_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  /* ═══════════════════════════════════════════════════════
     KOMPRES GAMBAR — resize max 1600px, JPEG q=0.85
     ═══════════════════════════════════════════════════════ */
  async function compressImage(file, maxDim, quality) {
    maxDim = maxDim || 1600;
    quality = quality || 0.85;

    // PDF tidak dikompres
    if (file.type === "application/pdf") return file;
    if (!file.type.startsWith("image/")) return file;

    // Kalau gambar sudah kecil (≤300KB & dimensi wajar), biarkan
    if (file.size <= 300 * 1024) return file;

    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w <= maxDim && h <= maxDim && file.size < 500 * 1024) {
          resolve(file); return;
        }
        const scale = Math.min(maxDim / w, maxDim / h, 1);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          if (blob && blob.size < file.size) {
            const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
            resolve(new File([blob], newName, { type: "image/jpeg" }));
          } else {
            resolve(file);
          }
        }, "image/jpeg", quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  /* ═══════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════ */
  async function init() {
    try {
      const s = localStorage.getItem(SESSION_KEY);
      if (!s) {
        alert("Login dulu untuk mendaftar.");
        location.href = "index.html"; return;
      }
      state.session = JSON.parse(s);
    } catch {
      alert("Sesi tidak valid. Login ulang.");
      location.href = "index.html"; return;
    }

    // Ambil riwayat lomba yang sudah didaftar (dari IndexedDB)
    try {
      const all = await dbGetAll();
      state.taken = all.filter(r => r.email === state.session.email).map(r => r.lomba);
    } catch { state.taken = []; }

    renderDataPeserta();
    fillLombaOptions();
    bindStep1();
    bindUploads();
    bindPayment();
    goStep(1);

    document.getElementById("backTo1").addEventListener("click", () => goStep(1));
    document.getElementById("backTo2").addEventListener("click", () => goStep(2));
    document.getElementById("toStep3").addEventListener("click", () => {
      const need = ["surat","ig1","ig2"];
      if (!need.every(k => state.files[k])) return;
      document.getElementById("payAmount").textContent = "Rp " + state.lombaPrice.toLocaleString("id-ID");
      goStep(3);
    });
  }

  function goStep(n) {
    document.querySelectorAll(".step-panel").forEach(p => p.classList.toggle("active", +p.dataset.panel === n));
    document.querySelectorAll(".stepper li").forEach(li => {
      const i = +li.dataset.step;
      li.classList.toggle("active", i === n);
      li.classList.toggle("done", i < n);
    });
    window.scrollTo({ top: 120, behavior: "smooth" });
  }

  function renderDataPeserta() {
    const s = state.session;
    document.getElementById("dataPeserta").innerHTML = `
      <div class="data-item"><span class="k">Nama</span><span class="v">${esc(s.name)}</span></div>
      <div class="data-item"><span class="k">Email</span><span class="v">${esc(s.email)}</span></div>
      <div class="data-item"><span class="k">Sekolah</span><span class="v">${esc(s.school)}</span></div>
      <div class="data-item"><span class="k">Jenjang</span><span class="v">${esc(s.level)}</span></div>`;
    document.getElementById("levelBadge").textContent = s.level;
  }

  function fillLombaOptions() {
    const sel = document.getElementById("regLomba");
    const eligible = LOMBA_DATA.filter(l => l.levels.includes(state.session.level));
    const takenSet = new Set(state.taken);

    sel.innerHTML = '<option value="">-- Pilih Bidang Lomba --</option>';
    eligible.forEach(l => {
      const opt = document.createElement("option");
      opt.value = l.name;
      const taken = takenSet.has(l.name);
      const tag = l.team ? " [TIM]" : "";
      opt.textContent = l.name + tag + " — Rp " + l.price.toLocaleString("id-ID") + (taken ? " (Sudah terdaftar)" : "");
      opt.dataset.price = l.price;
      if (taken) opt.disabled = true;
      sel.appendChild(opt);
    });

    const hint = document.getElementById("lombaHint");
    hint.textContent = eligible.length === 0
      ? "Tidak ada lomba untuk jenjangmu."
      : eligible.length + " lomba tersedia untuk jenjang " + state.session.level + ".";
  }

  function bindStep1() {
    const sel = document.getElementById("regLomba");
    sel.addEventListener("change", () => onLombaChange(sel.value));

    document.getElementById("toStep2").addEventListener("click", () => {
      const v = sel.value;
      if (!v) return shake(sel);
      const opt = sel.selectedOptions[0];
      if (!opt || opt.disabled) return alert("Lomba tidak tersedia.");

      if (state.isTeam) {
        const tn = document.getElementById("regTeamName").value.trim();
        const ph = document.getElementById("regPhoneTeam").value.trim();
        if (!tn) return shake(document.getElementById("regTeamName"));
        if (state.teamMembers.length < state.teamMin)
          return alert("Tim butuh minimal " + state.teamMin + " anggota (selain ketua).");
        if (state.teamMembers.length > state.teamMax)
          return alert("Maksimal " + state.teamMax + " anggota.");
        if (state.teamMembers.some(n => !n.trim())) return alert("Semua nama anggota wajib diisi.");
        const lower = state.teamMembers.map(n => n.trim().toLowerCase());
        if ([...new Set(lower)].length !== lower.length) return alert("Nama anggota tidak boleh sama.");
        if (lower.includes(state.session.name.trim().toLowerCase()))
          return alert("Nama ketua tidak perlu diulang di daftar anggota.");
        if (!validPhone(ph)) return shake(document.getElementById("regPhoneTeam"));
      } else {
        const nisn = document.getElementById("regNisn").value.trim();
        const ph = document.getElementById("regPhone").value.trim();
        if (!/^\d{10}$/.test(nisn)) return shake(document.getElementById("regNisn"));
        if (!validPhone(ph)) return shake(document.getElementById("regPhone"));
      }
      goStep(2);
    });
  }

  function onLombaChange(v) {
    const opt = document.getElementById("regLomba").selectedOptions[0];
    const fInd = document.getElementById("formIndividu");
    const fTim = document.getElementById("formTim");
    const pp = document.getElementById("pricePreview");
    const pAmt = document.getElementById("pricePreviewAmount");

    if (!v || !opt) {
      state.lomba = ""; state.isTeam = false;
      fInd.hidden = true; fTim.hidden = true; pp.hidden = true; return;
    }
    const l = LOMBA_DATA.find(x => x.name === v && x.levels.includes(state.session.level));
    state.lomba = v; state.lombaPrice = l.price; state.isTeam = !!l.team;

    pAmt.textContent = "Rp " + l.price.toLocaleString("id-ID");
    pp.hidden = false;

    if (state.isTeam) {
      state.teamMin = l.team.min; state.teamMax = l.team.max;
      fInd.hidden = true; fTim.hidden = false;
      document.getElementById("regTeamName").value = "";
      document.getElementById("regPhoneTeam").value = "";
      state.teamMembers = [];
      renderTeamMembers();
      document.getElementById("teamHint").textContent =
        "Butuh " + l.team.min + "–" + l.team.max + " anggota (selain kamu sebagai ketua).";
    } else {
      fInd.hidden = false; fTim.hidden = true;
    }
  }

  function renderTeamMembers() {
    const list = document.getElementById("teamMembersList");
    const addBtn = document.getElementById("addMemberBtn");
    list.innerHTML = "";
    state.teamMembers.forEach((name, i) => {
      const row = document.createElement("div");
      row.className = "team-member-row";
      row.innerHTML =
        '<span class="member-num">' + (i + 1) + '</span>' +
        '<input type="text" placeholder="Nama anggota ' + (i + 1) + '" value="' + esc(name) + '" maxlength="120">' +
        '<button type="button" class="member-remove">✕</button>';
      const inp = row.querySelector("input");
      inp.addEventListener("input", () => state.teamMembers[i] = inp.value);
      row.querySelector(".member-remove").addEventListener("click", () => {
        state.teamMembers.splice(i, 1); renderTeamMembers();
      });
      list.appendChild(row);
    });
    addBtn.disabled = state.teamMembers.length >= state.teamMax;
    addBtn.textContent = state.teamMembers.length >= state.teamMax
      ? "Maksimum " + state.teamMax + " anggota tercapai"
      : "+ Tambah Anggota (" + state.teamMembers.length + "/" + state.teamMax + ")";
  }

  document.addEventListener("click", (e) => {
    if (e.target.id !== "addMemberBtn") return;
    if (state.teamMembers.length >= state.teamMax) return;
    state.teamMembers.push("");
    renderTeamMembers();
    setTimeout(() => {
      const inputs = document.querySelectorAll("#teamMembersList input");
      if (inputs.length) inputs[inputs.length - 1].focus();
    }, 30);
  });

  /* ═══════════════════════════════════════════════════════
     UPLOADS
     ═══════════════════════════════════════════════════════ */
  function bindUploads() {
    document.querySelectorAll(".ig-drop").forEach(drop => {
      const key = drop.dataset.drop;
      const input = drop.querySelector('input[type="file"]');
      const preview = drop.querySelector(".ig-preview");
      const inner = drop.querySelector(".ig-drop-inner");

      drop.addEventListener("click", (e) => {
        if (e.target.closest(".ig-remove")) return;
        if (preview && !preview.hidden) return;
        input.click();
      });
      ["dragenter","dragover"].forEach(evt => drop.addEventListener(evt, (e) => {
        e.preventDefault(); e.stopPropagation(); drop.classList.add("dragover");
      }));
      ["dragleave","drop"].forEach(evt => drop.addEventListener(evt, (e) => {
        e.preventDefault(); e.stopPropagation(); drop.classList.remove("dragover");
      }));
      drop.addEventListener("drop", (e) => {
        const f = e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) pickFile(f, key, drop, preview, inner, input);
      });
      input.addEventListener("change", () => {
        const f = input.files && input.files[0];
        if (f) pickFile(f, key, drop, preview, inner, input);
      });
      drop.querySelector(".ig-remove").addEventListener("click", (e) => {
        e.stopPropagation(); resetDrop(drop, key, input);
      });
    });
  }

  async function pickFile(file, key, drop, preview, inner, input) {
    // Validasi tipe
    if (key === "surat") {
      if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(file.type))
        return flashErr(drop, "Format harus PDF/JPG/PNG.");
    } else {
      if (!file.type.startsWith("image/")) return flashErr(drop, "Harus gambar.");
    }

    // VALIDASI UKURAN — 15 MB
    if (file.size > MAX_FILE) {
      return flashErr(drop, "Maksimal 15 MB. File kamu " + (file.size / 1024 / 1024).toFixed(1) + " MB.");
    }
    if (file.size < 8 * 1024) return flashErr(drop, "File terlalu kecil.");

    // Tampilkan status kompresi
    const oldHint = drop.querySelector(".ig-drop-hint").textContent;
    drop.querySelector(".ig-drop-hint").textContent = "Mengompres gambar…";
    drop.querySelector(".ig-drop-hint").style.color = "#c4a878";

    try {
      // Kompres gambar
      const compressed = await compressImage(file);

      state.files[key] = compressed;

      const slot = preview.querySelector(".preview-slot");
      slot.innerHTML = "";
      if (compressed.type === "application/pdf") {
        slot.textContent = "PDF";
      } else {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(compressed);
        slot.appendChild(img);
      }

      const ratio = file.size > 0 ? Math.round((1 - compressed.size / file.size) * 100) : 0;
      const sizeText = (compressed.size / 1024).toFixed(0) + " KB" + (ratio > 5 ? " (−" + ratio + "%)" : "");
      preview.querySelector(".ig-check-meta").textContent = compressed.name + " · " + sizeText;

      inner.style.display = "none";
      preview.hidden = false;
      updateStep2Button();

      drop.querySelector(".ig-drop-hint").textContent = oldHint;
      drop.querySelector(".ig-drop-hint").style.color = "";
    } catch (err) {
      console.error(err);
      flashErr(drop, "Gagal memproses gambar. Coba file lain.");
      drop.querySelector(".ig-drop-hint").textContent = oldHint;
      drop.querySelector(".ig-drop-hint").style.color = "";
    }
  }

  function resetDrop(drop, key, input) {
    const preview = drop.querySelector(".ig-preview");
    const inner = drop.querySelector(".ig-drop-inner");
    preview.hidden = true;
    preview.querySelector(".preview-slot").innerHTML = "";
    inner.style.display = "";
    input.value = "";
    state.files[key] = null;
    updateStep2Button();
  }

  function updateStep2Button() {
    const btn = document.getElementById("toStep3");
    btn.disabled = !(state.files.surat && state.files.ig1 && state.files.ig2);
  }

  function flashErr(drop, msg) {
    drop.classList.add("error");
    const h = drop.querySelector(".ig-drop-hint");
    const old = h.textContent;
    h.textContent = "✕ " + msg; h.style.color = "#e8a0a0";
    setTimeout(() => { h.textContent = old; h.style.color = ""; drop.classList.remove("error"); }, 3500);
  }

  /* ═══════════════════════════════════════════════════════
     PAYMENT
     ═══════════════════════════════════════════════════════ */
  function bindPayment() {
    document.getElementById("copyRek").addEventListener("click", async function () {
      try { await navigator.clipboard.writeText("1234567890"); this.textContent = "✓"; setTimeout(() => this.textContent = "⧉", 1400); }
      catch { alert("Nomor rekening: 1234567890"); }
    });
    document.getElementById("toStep4").addEventListener("click", function () {
      const sender = document.getElementById("paySender").value.trim();
      const ref = document.getElementById("payRef").value.trim();
      if (!sender || sender.length < 3) return shake(document.getElementById("paySender"));
      if (!ref || ref.length < 6) return shake(document.getElementById("payRef"));
      if (!state.files.pay) return alert("Upload bukti transfer dulu.");
      submitAll(this, sender, ref);
    });
  }

  /* ═══════════════════════════════════════════════════════
     SUBMIT — simpan ke IndexedDB
     ═══════════════════════════════════════════════════════ */
  async function submitAll(btn, sender, ref) {
    btn.disabled = true;
    btn.textContent = "Menyimpan…";

    try {
      const regCode = genRegCode();

      const record = {
        reg_code: regCode,
        email: state.session.email,
        name: state.session.name,
        school: state.session.school,
        level: state.session.level,
        lomba: state.lomba,
        lomba_price: state.lombaPrice,
        is_team: state.isTeam ? 1 : 0,
        nisn: state.isTeam ? "" : document.getElementById("regNisn").value.trim(),
        phone: state.isTeam
          ? document.getElementById("regPhoneTeam").value.trim()
          : document.getElementById("regPhone").value.trim(),
        team_name: state.isTeam ? document.getElementById("regTeamName").value.trim() : "",
        team_members: state.isTeam ? state.teamMembers.map(n => n.trim()) : [],
        team_size: state.isTeam ? state.teamMembers.length : 0,

        // Simpan sebagai Blob (efisien, native)
        surat_blob: state.files.surat,
        surat_name: state.files.surat.name,
        surat_type: state.files.surat.type,

        ig1_blob: state.files.ig1,
        ig1_name: state.files.ig1.name,
        ig1_type: state.files.ig1.type,

        ig2_blob: state.files.ig2,
        ig2_name: state.files.ig2.name,
        ig2_type: state.files.ig2.type,

        pay_blob: state.files.pay,
        pay_name: state.files.pay.name,
        pay_type: state.files.pay.type,

        sender: sender,
        ref: ref,
        status: "pending",
        created_at: new Date().toISOString()
      };

      await dbAdd(record);

      renderReceipt(record);
      goStep(4);
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan: " + (err.message || err));
      btn.disabled = false;
      btn.textContent = "Kirim Pendaftaran →";
    }
  }

  function genRegCode() {
    const c = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
    return "COMIC26-" + s;
  }

  function renderReceipt(r) {
    const lines = [
      ["ID Pendaftaran", r.reg_code],
      ["Nama Ketua", r.name],
      ["Jenjang", r.level],
      ["Lomba", r.lomba],
      ["Tipe", r.is_team ? "TIM" : "INDIVIDU"]
    ];
    if (r.is_team) {
      lines.push(["Nama Tim", r.team_name]);
      lines.push(["Jumlah Anggota", String(r.team_size)]);
    } else {
      lines.push(["NISN", r.nisn]);
    }
    lines.push(["Biaya", "Rp " + r.lomba_price.toLocaleString("id-ID")]);
    lines.push(["Status", "Menunggu Verifikasi Panitia"]);

    document.getElementById("receipt").innerHTML = lines.map(([k, v]) =>
      '<div class="r-line"><span>' + esc(k) + '</span><span>' + esc(v) + '</span></div>'
    ).join("");
  }

  function validPhone(p) {
    const s = String(p).replace(/[\s\-\(\)]/g, "");
    return /^(\+?62|0)8[1-9]\d{6,11}$/.test(s);
  }
  function shake(el) { if (!el) return; el.classList.add("shake"); el.focus(); setTimeout(() => el.classList.remove("shake"), 500); }
  function esc(s) { return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();