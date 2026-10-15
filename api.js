/* ═══════════════════════════════════════════════════════════
   COMIC 2026 — API CLIENT
   Pembungkus fetch() ke server PHP (api/api.php).
   Selalu mengembalikan objek:  data sukses  ATAU  {error:{code,msg}}
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const ENDPOINT = "api/api.php";

  async function COMIC_API(action, opts) {
    opts = opts || {};
    let url = ENDPOINT + "?action=" + encodeURIComponent(action);
    if (opts.query) url += "&" + new URLSearchParams(opts.query).toString();

    const init = {
      credentials: "same-origin",
      headers: { "X-Requested-With": "XMLHttpRequest" }
    };
    if (opts.form) {                       // upload file (FormData)
      init.method = "POST";
      init.body = opts.form;
    } else if (opts.data) {                // JSON biasa
      init.method = "POST";
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.data);
    }

    try {
      const res = await fetch(url, init);
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        return { error: { code: "BAD_RESPONSE", msg: "Server memberi respons tak terduga (HTTP " + res.status + "). Cek file api/config.php dan database." } };
      }
    } catch (e) {
      return { error: { code: "NETWORK", msg: "Tidak bisa terhubung ke server. Periksa koneksi internet." } };
    }
  }

  COMIC_API.endpoint = ENDPOINT;
  window.COMIC_API = COMIC_API;
})();
