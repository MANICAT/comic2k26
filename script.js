/* ═══════════════════════════════════════════════════════════
   COMIC 2026 — THE ROYAL CODEX
   Infinite Falling Codex Leaves 🍃 · Quill Cursor 🪶
   Menu · Countdown · Reveal · Card Tilt · Parallax
   ═══════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  /* ─────────── ELEMENT REFERENCES ─────────── */
  const sideMenu     = document.getElementById("sideMenu");
  const hamburger    = document.getElementById("hamburger");
  const overlay      = document.getElementById("sideOverlay");
  const closeBtn     = document.getElementById("closeMenu");
  const progressBar  = document.getElementById("scroll-progress");
  const quill        = document.getElementById("quillCursor");
  const topbar       = document.getElementById("topbar");
  const sound        = document.getElementById("clickSound");
  const leafLayer    = document.getElementById("leaf-layer");

  /* ═══════════════════════════════════════════════════════════
     FALLING CODEX LEAVES 🍃
     -----------------------------------------------------------------
     Strategi "unlimited":
     - Setiap frame, kita panggil spawnLeaf() dengan probabilitas yang
       bergantung pada jumlah leaf aktif, sehingga aliran terasa tak
       berhenti.
     - Setiap leaf menghapus dirinya sendiri saat animationend.
     - Concurrent cap MAX_LEAVES menjaga RAM tetap stabil.
     - Kecepatan spawn menyesuaikan lebar viewport (mobile = lebih sedikit).
     ═══════════════════════════════════════════════════════════ */
  const LEAF_SYMBOLS = [
    "π","λ","Σ","α"
  ];

  // Warna tinta codex (sepia, brass, moss, patina, parchment)
  const LEAF_TINTS = [
    "#c4a878",  // brass
    "#a89070",  // sepia glow
    "#9c7e50",  // brass
    "#8a7a4a",  // leaf
    "#6b7a4a",  // moss
    "#5a7a6a",  // patina
    "#d4c4a8",  // parchment
    "#b8a582",  // warm parchment
    "#7a8a7a"   // muted green
  ];

  // Emoji khusus (⚛ ⚗ ⚙) diberi sedikit glow
  const GLOW_SYMBOLS = new Set(["⚛","⚗","⚙"]);

  const MAX_LEAVES       = 42;      // concurrent cap (dijaga stabil)
  const SPAWN_RATE_BASE  = 0.055;   // peluang spawn per frame @60fps
  const SPAWN_RATE_MOB   = 0.030;

  let activeLeaves = 0;
  let isReducedMotion = false;

  try {
    isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (_) { isReducedMotion = false; }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }
  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }
  function chance(p) {
    return Math.random() < p;
  }

  function spawnLeaf() {
    if (!leafLayer) return;
    if (activeLeaves >= MAX_LEAVES) return;

    const leaf = document.createElement("span");
    leaf.className = "codex-leaf";

    // Simbol
    const symbol = pick(LEAF_SYMBOLS);
    leaf.textContent = symbol;

    // Depth — dekat / sedang / jauh
    const depthRoll = Math.random();
    let depthClass, sizeMin, sizeMax, blurIsFar;
    if (depthRoll < 0.35) {
      depthClass = "depth-near";
      sizeMin = 22; sizeMax = 34;
      blurIsFar = false;
    } else if (depthRoll < 0.75) {
      depthClass = "depth-mid";
      sizeMin = 16; sizeMax = 24;
      blurIsFar = false;
    } else {
      depthClass = "depth-far";
      sizeMin = 12; sizeMax = 18;
      blurIsFar = true;
    }
    leaf.classList.add(depthClass);

    if (GLOW_SYMBOLS.has(symbol)) leaf.classList.add("symbol-glow");

    // Ukuran
    const size = rand(sizeMin, sizeMax);
    leaf.style.fontSize = size.toFixed(2) + "px";

    // Posisi awal — sedikit di luar tepi agar tidak "pop in"
    const startX = rand(-4, 104);
    leaf.style.setProperty("--start-x", startX.toFixed(2) + "vw");

    // Warna — variasi
    const tint = pick(LEAF_TINTS);
    leaf.style.color = tint;

    // Durasi jatuh (semakin besar = semakin lambat; jauh = lambat)
    let dur = rand(12, 22);
    if (depthClass === "depth-near") dur = rand(9, 14);
    if (depthClass === "depth-far")  dur = rand(18, 26);
    leaf.style.setProperty("--dur", dur.toFixed(2) + "s");

    // Delay 0 (spawn sudah tersebar lewat loop)
    leaf.style.setProperty("--delay", "0s");

    // Sway (geser horizontal) — jauh = lebih besar sway karena "angin jauh"
    const sway = rand(30, 90) + (blurIsFar ? 20 : 0);
    leaf.style.setProperty("--sway", sway.toFixed(1) + "px");

    // Durasi sway (lebih pendek = lebih "gelisah")
    const swayDur = rand(3.2, 6.5);
    leaf.style.setProperty("--sway-dur", swayDur.toFixed(2) + "s");

    // Spin — arah acak (positif/negatif)
    const rotDir = chance(0.5) ? 1 : -1;
    const rotAmount = rotDir * rand(180, 720);
    leaf.style.setProperty("--rot", rotAmount.toFixed(0) + "deg");
    const spinDur = rand(7, 14);
    leaf.style.setProperty("--spin-dur", spinDur.toFixed(2) + "s");

    // Opacity maksimum
    let maxOp = 0.9;
    if (depthClass === "depth-mid") maxOp = 0.72;
    if (depthClass === "depth-far") maxOp = 0.5;
    leaf.style.setProperty("--max-op", maxOp.toFixed(2));

    // Cleanup saat jatuh selesai
    leaf.addEventListener("animationend", function onEnd(e) {
      if (e.animationName !== "leafFall") return;
      leaf.removeEventListener("animationend", onEnd);
      if (leaf.parentNode) leaf.parentNode.removeChild(leaf);
      activeLeaves = Math.max(0, activeLeaves - 1);
    });

    leafLayer.appendChild(leaf);
    activeLeaves++;
  }

  function initFallingLeaves() {
    if (!leafLayer) return;
    if (isReducedMotion) return;

    const isMobile = window.matchMedia("(pointer: coarse)").matches
                  || window.innerWidth < 720;
    const rate = isMobile ? SPAWN_RATE_MOB : SPAWN_RATE_BASE;

    // Pre-fill beberapa leaf agar layar tidak kosong di awal
    const prefill = isMobile ? 6 : 12;
    for (let i = 0; i < prefill; i++) {
      setTimeout(spawnLeaf, i * 220);
    }

    // Loop spawn berbasis rAF — terasa "unlimited" tanpa setInterval berat
    let rafId = null;
    function loop() {
      // Bila tab tidak aktif, jangan spawn (browser otomatis throttle rAF)
      if (!document.hidden) {
        // Bila jumlah aktif rendah, naikkan peluang spawn
        let p = rate;
        if (activeLeaves < 10) p = rate * 2.2;
        else if (activeLeaves < 20) p = rate * 1.4;

        if (chance(p)) spawnLeaf();
        // Kadang spawn 2 sekaligus untuk variasi "angin kencang"
        if (chance(p * 0.25)) spawnLeaf();
      }
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    // Saat resize, sesuaikan rate (mobile ↔ desktop)
    let resizeTO = null;
    window.addEventListener("resize", () => {
      if (resizeTO) clearTimeout(resizeTO);
      resizeTO = setTimeout(() => {
        // Tidak perlu restart loop — hanya sesuaikan MAX bila perlu
        const nowMobile = window.innerWidth < 720;
        // Bersihkan bila terlalu banyak di mobile
        if (nowMobile && activeLeaves > 30 && leafLayer.firstChild) {
          // Biarkan natural — leaf baru akan tetap spawn lewat loop
        }
      }, 250);
    }, { passive: true });
  }

  /* ═══════════════════════════════════════════════════════════
     QUILL CURSOR 
     ═══════════════════════════════════════════════════════════ */
  function initQuillCursor() {
    if (!quill) return;

    // Skip di device sentuh
    if (window.matchMedia("(pointer: coarse)").matches) {
      quill.style.display = "none";
      document.body.style.cursor = "auto";
      document.querySelectorAll("a, button, .hamburger, .close-btn")
        .forEach(el => { el.style.cursor = "pointer"; });
      return;
    }

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let rafId = null;

    function tick() {
      currentX += (targetX - currentX) * 0.32;
      currentY += (targetY - currentY) * 0.32;
      quill.style.left = currentX + "px";
      quill.style.top  = currentY + "px";
      rafId = requestAnimationFrame(tick);
    }

    document.addEventListener("mousemove", (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!rafId) rafId = requestAnimationFrame(tick);
    }, { passive: true });

    document.addEventListener("mouseleave", () => { quill.style.opacity = "0"; });
    document.addEventListener("mouseenter", () => {
      quill.style.opacity = "1";
      if (!rafId) rafId = requestAnimationFrame(tick);
    });

    const HOVER_SELECTOR = "a, button, .hamburger, .close-btn, .btn, .box, .kategori-card, .aside-card, .contact-card, .social-icons a, .footer-links a";

    document.querySelectorAll(HOVER_SELECTOR).forEach(el => {
      el.addEventListener("mouseenter", () => quill.classList.add("is-hover"));
      el.addEventListener("mouseleave", () => quill.classList.remove("is-hover"));
    });

    document.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      quill.classList.add("is-click");
    });
    document.addEventListener("mouseup", () => {
      quill.classList.remove("is-click");
    });
  }

  /* ═══════════════════════════════════════════════════════════
     SIDE MENU
     ═══════════════════════════════════════════════════════════ */
  function openMenu() {
    if (!sideMenu || !overlay || !hamburger) return;
    sideMenu.classList.add("active");
    overlay.classList.add("active");
    hamburger.classList.add("open");
  }
  function closeMenu() {
    if (!sideMenu || !overlay || !hamburger) return;
    sideMenu.classList.remove("active");
    overlay.classList.remove("active");
    hamburger.classList.remove("open");
  }
  function initMenu() {
    if (hamburger) {
      hamburger.addEventListener("click", () => {
        if (sideMenu && sideMenu.classList.contains("active")) closeMenu();
        else openMenu();
      });
    }
    if (overlay) overlay.addEventListener("click", closeMenu);
    if (closeBtn) closeBtn.addEventListener("click", closeMenu);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });
  }

  /* ═══════════════════════════════════════════════════════════
     SMOOTH SCROLL
     ═══════════════════════════════════════════════════════════ */
  function initSmoothScroll() {
    document.querySelectorAll('.side-menu a[href^="#"], .footer-links a[href^="#"]')
      .forEach(link => {
        link.addEventListener("click", (e) => {
          const href = link.getAttribute("href");
          if (!href || href === "#") return;
          const target = document.querySelector(href);
          if (!target) return;
          e.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          closeMenu();
        });
      });
  }

  /* ═══════════════════════════════════════════════════════════
     LOADING
     ═══════════════════════════════════════════════════════════ */
  function initLoading() {
    const loader = document.getElementById("loading");
    if (!loader) return;
    const hide = () => {
      loader.classList.add("fade-out");
      setTimeout(() => { loader.style.display = "none"; }, 950);
    };
    window.addEventListener("load", () => setTimeout(hide, 2600));
    setTimeout(() => {
      if (loader && loader.style.display !== "none") hide();
    }, 6000);
  }

  /* ═══════════════════════════════════════════════════════════
     REVEAL ON SCROLL
     ═══════════════════════════════════════════════════════════ */
  function initReveal() {
    const reveals = document.querySelectorAll(".reveal");
    if (!reveals.length) return;
    if (!("IntersectionObserver" in window)) {
      reveals.forEach(el => el.classList.add("active"));
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("active");
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -60px 0px" });
    reveals.forEach(el => obs.observe(el));
  }

  /* ═══════════════════════════════════════════════════════════
     SCROLL PROGRESS + TOPBAR SHRINK
     ═══════════════════════════════════════════════════════════ */
  function initScrollEffects() {
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
        const max = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const pct = max > 0 ? (scrollTop / max) * 100 : 0;
        if (progressBar) progressBar.style.width = pct + "%";

        if (topbar) {
          if (scrollTop > 100) {
            topbar.style.height = "60px";
            topbar.style.background = "rgba(22,29,36,0.88)";
            topbar.style.boxShadow = "0 14px 44px rgba(0,0,0,0.7), 0 0 44px rgba(156,126,80,0.18)";
          } else {
            topbar.style.height = "68px";
            topbar.style.background = "rgba(22,29,36,0.78)";
            topbar.style.boxShadow = "0 10px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(232,220,196,0.03) inset, 0 0 30px rgba(156,126,80,0.08)";
          }
        }
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ═══════════════════════════════════════════════════════════
     COUNTDOWN
     ═══════════════════════════════════════════════════════════ */
  function initCountdown() {
    const targetDate = new Date("November 10, 2026 00:00:00").getTime();
    const daysEl    = document.getElementById("days");
    const hoursEl   = document.getElementById("hours");
    const minutesEl = document.getElementById("minutes");
    const secondsEl = document.getElementById("seconds");
    if (!daysEl || !hoursEl || !minutesEl || !secondsEl) return;

    const prev = { days: -1, hours: -1, minutes: -1, seconds: -1 };

    function paint(el, val, key) {
      if (!el) return;
      const str = String(val).padStart(2, "0");
      el.textContent = str;
      if (prev[key] !== -1 && val !== prev[key]) {
        el.classList.remove("pop");
        void el.offsetWidth;
        el.classList.add("pop");
        setTimeout(() => el.classList.remove("pop"), 240);
      }
      prev[key] = val;
    }

    function update() {
      const dist = targetDate - Date.now();
      const d = Math.max(0, Math.floor(dist / 86400000));
      const h = Math.max(0, Math.floor((dist % 86400000) / 3600000));
      const m = Math.max(0, Math.floor((dist % 3600000) / 60000));
      const s = Math.max(0, Math.floor((dist % 60000) / 1000));
      paint(daysEl, d, "days");
      paint(hoursEl, h, "hours");
      paint(minutesEl, m, "minutes");
      paint(secondsEl, s, "seconds");
    }
    update();
    setInterval(update, 1000);
  }

  /* ═══════════════════════════════════════════════════════════
     CLICK SOUND + RIPPLE
     ═══════════════════════════════════════════════════════════ */
  function initClickFeedback() {
    const targets = document.querySelectorAll(
      "a.btn, button, .hamburger, .close-btn, .kategori-card, .aside-card, .contact-card, .social-icons a"
    );
    if (!targets.length) return;

    targets.forEach(el => {
      el.addEventListener("click", (e) => {
        if (sound) {
          try {
            sound.currentTime = 0;
            sound.volume = 0.3;
            const p = sound.play();
            if (p && typeof p.catch === "function") p.catch(() => {});
          } catch (_) { /* noop */ }
        }

        const rect = el.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const clickX = (typeof e.clientX === "number" && e.clientX > 0)
          ? e.clientX : (rect.left + rect.width / 2);
        const clickY = (typeof e.clientY === "number" && e.clientY > 0)
          ? e.clientY : (rect.top + rect.height / 2);

        const ripple = document.createElement("span");
        ripple.className = "ripple";
        ripple.style.width = size + "px";
        ripple.style.height = size + "px";
        ripple.style.left = (clickX - rect.left - size / 2) + "px";
        ripple.style.top = (clickY - rect.top - size / 2) + "px";

        const computed = window.getComputedStyle(el);
        if (computed.position === "static") el.style.position = "relative";
        if (computed.overflow === "visible") el.style.overflow = "hidden";

        el.appendChild(ripple);
        setTimeout(() => {
          if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
        }, 750);
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     KATEGORI CARD 3D TILT
     ═══════════════════════════════════════════════════════════ */
  function initCardTilt() {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    document.querySelectorAll(".kategori-card").forEach(card => {
      card.addEventListener("mousemove", (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const rotX = ((y - cy) / cy) * -3;
        const rotY = ((x - cx) / cx) * 3;
        card.style.transform =
          `perspective(950px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateY(-12px) scale(1.03)`;
        card.style.setProperty("--mx", x + "px");
        card.style.setProperty("--my", y + "px");
      });
      card.addEventListener("mouseleave", () => {
        card.style.transform = "perspective(950px) rotateX(0deg) rotateY(0deg) translateY(0) scale(1)";
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     BACKGROUND PARALLAX
     ═══════════════════════════════════════════════════════════ */
  function initParallax() {
    const bgAtom = document.querySelector(".bg-atom");
    const bgGears = document.querySelectorAll(".bg-gear");
    if (!bgAtom && !bgGears.length) return;

    let ticking = false;
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.pageYOffset || 0;
        if (bgAtom) {
          bgAtom.style.transform =
            `translate(-50%, calc(-50% + ${(y * 0.03).toFixed(2)}px)) rotate(${(y * 0.01).toFixed(2)}deg)`;
        }
        bgGears.forEach((g, i) => {
          g.style.transform = `translateY(${(y * (0.02 + i * 0.01)).toFixed(2)}px)`;
        });
        ticking = false;
      });
    }, { passive: true });
  }

  /* ═══════════════════════════════════════════════════════════
     HERO MOUSE PARALLAX
     ═══════════════════════════════════════════════════════════ */
  function initHeroParallax() {
    const heroVisual = document.querySelector(".hero-visual");
    if (!heroVisual) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let ticking = false;
    let mx = 0, my = 0;
    document.addEventListener("mousemove", (e) => {
      mx = (window.innerWidth / 2 - e.clientX) / 90;
      my = (window.innerHeight / 2 - e.clientY) / 90;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        heroVisual.style.transform = `translate(${mx.toFixed(2)}px, ${my.toFixed(2)}px)`;
        ticking = false;
      });
    }, { passive: true });
  }

  /* ═══════════════════════════════════════════════════════════
     BOOT
     ═══════════════════════════════════════════════════════════ */
  function boot() {
    initQuillCursor();
    initMenu();
    initSmoothScroll();
    initLoading();
    initReveal();
    initScrollEffects();
    initCountdown();
    initClickFeedback();
    initCardTilt();
    initParallax();
    initHeroParallax();
    initFallingLeaves();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})();