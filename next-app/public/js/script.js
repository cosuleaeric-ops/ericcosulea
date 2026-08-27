/* EliteData — tracking script first-party. Fără dependențe. */
(function () {
  "use strict";

  var script =
    document.currentScript ||
    document.querySelector('script[data-website-id][src*="/js/script.js"]') ||
    document.querySelector("script[data-website-id]");
  if (!script) return;

  var websiteId = script.getAttribute("data-website-id");
  if (!websiteId) return;

  // Browsere automatizate nedeghizate (Playwright/Puppeteer/Selenium au
  // navigator.webdriver=true). UA-ul lor e adesea de Chrome normal, deci
  // filtrul de pe server nu-i prinde; îi oprim aici, la sursă.
  if (navigator.webdriver) return;

  // API base = originea scriptului (merge pe orice domeniu unde e instalat).
  var apiBase = "";
  try {
    apiBase = new URL(script.src).origin;
  } catch {}

  // Exclude localhost by default (override cu data-include-localhost="true").
  var includeLocalhost = script.getAttribute("data-include-localhost") === "true";
  var host = location.hostname;
  var isLocal =
    host === "localhost" ||
    /\.localhost$/.test(host) || // subdomenii de dev (ex. app.localhost:3000)
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "" ||
    /^192\.168\./.test(host) ||
    /\.local$/.test(host);
  if (isLocal && !includeLocalhost) return;

  // ── Opt-out prin URL: ?elitedata_ignore=1 marchează ACEST browser ca fiind al
  //    meu (=0 anulează). Un click o dată pe fiecare domeniu — e singura cale de
  //    self-exclude client-side cross-domeniu (cookie-ul de admin e first-party
  //    doar pe ericcosulea.ro, browserele nu-l trimit de pe alte domenii).
  //    Flagul se scrie în DOUĂ locuri, localStorage și un cookie pe 400 de zile
  //    (maximul acceptat de Chrome): dacă una dintre stocări e ștearsă, cealaltă
  //    o rescrie la următoarea vizită, deci un „clear site data" parțial nu
  //    repornește urmărirea. Backup-ul independent de browser e excluderea pe
  //    IP, ținută server-side. ──
  var IGNORE_KEY = "elitedata_ignore";

  function readIgnore() {
    var stored = null;
    try {
      stored = localStorage.getItem(IGNORE_KEY);
    } catch {}
    if (stored === "true") return true;
    return document.cookie.split(";").some(function (c) {
      return c.trim() === IGNORE_KEY + "=true";
    });
  }

  function writeIgnore(on) {
    try {
      if (on) localStorage.setItem(IGNORE_KEY, "true");
      else localStorage.removeItem(IGNORE_KEY);
    } catch {}
    document.cookie = on
      ? IGNORE_KEY + "=true;max-age=34560000;path=/;SameSite=Lax"
      : IGNORE_KEY + "=;max-age=0;path=/;SameSite=Lax";
  }

  try {
    var ignoreParam = new URLSearchParams(location.search).get(IGNORE_KEY);
    if (ignoreParam !== null) {
      writeIgnore(ignoreParam !== "0" && ignoreParam !== "false");
    }
  } catch {}

  if (readIgnore()) {
    writeIgnore(true); // rescrie stocarea care lipsește
    return;
  }

  // ── Exclude admin-ul: dacă e logat, cookie-ul hint e prezent ──
  if (document.cookie.split(";").some(function (c) {
    return c.trim() === "ericcosulea_admin_hint=1";
  })) return;

  // ── Visitor id persistent (localStorage, fallback cookie) ──
  var VKEY = "dfa_visitor_id";
  var SKEY = "dfa_session_id";
  var SESSION_TIMEOUT = 30 * 60 * 1000;
  var SESSION_MAX_LENGTH = 24 * 60 * 60 * 1000;
  var ACTIVITY_WRITE_GRANULARITY = 5000;
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }
  function uuidv7(now) {
    var bytes = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    for (var j = 0; j < 6; j++) bytes[j] = Math.floor(now / Math.pow(256, 5 - j)) & 255;
    bytes[6] = (bytes[6] & 15) | 112;
    bytes[8] = (bytes[8] & 63) | 128;
    var hex = Array.prototype.map.call(bytes, function (b) {
      return (b + 256).toString(16).slice(1);
    }).join("");
    return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" +
      hex.slice(16, 20) + "-" + hex.slice(20);
  }
  function readStored(key) {
    try {
      var stored = localStorage.getItem(key);
      if (stored) return stored;
    } catch {}
    var m = document.cookie.match(new RegExp("(?:^|;\\s*)" + key + "=([^;]+)"));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function writeStored(key, value, maxAge) {
    try { localStorage.setItem(key, value); } catch {}
    document.cookie = key + "=" + encodeURIComponent(value) + ";max-age=" + maxAge + ";path=/;SameSite=Lax";
  }
  var visitorId;
  try {
    visitorId = localStorage.getItem(VKEY);
    if (!visitorId) {
      visitorId = uuid();
      localStorage.setItem(VKEY, visitorId);
    }
  } catch {
    var m = document.cookie.match(/(?:^|;\s*)dfa_visitor_id=([^;]+)/);
    if (m) {
      visitorId = decodeURIComponent(m[1]);
    } else {
      visitorId = uuid();
      document.cookie =
        "dfa_visitor_id=" + visitorId + ";max-age=63072000;path=/;SameSite=Lax";
    }
  }

  function sessionId() {
    var now = Date.now();
    var raw = readStored(SKEY);
    var session = null;
    if (raw) {
      try { session = JSON.parse(raw); } catch {}
    }
    if (
      !session || !session.id || !session.t || !session.s ||
      Math.abs(now - session.t) > SESSION_TIMEOUT ||
      Math.abs(now - session.s) > SESSION_MAX_LENGTH
    ) {
      session = { id: uuidv7(now), t: now, s: now };
      writeStored(SKEY, JSON.stringify(session), 63072000);
      return session.id;
    }
    if (Math.abs(now - session.t) >= ACTIVITY_WRITE_GRANULARITY) {
      session.t = now;
      writeStored(SKEY, JSON.stringify(session), 63072000);
    }
    return session.id;
  }

  function send(type, name) {
    var payload = {
      id: websiteId,
      type: type,
      name: name || undefined,
      url: location.href,
      referrer: document.referrer || "",
      visitor_id: visitorId,
      session_id: sessionId(),
    };
    var body = JSON.stringify(payload);
    var url = apiBase + "/api/event";
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }));
      } else {
        fetch(url, {
          method: "POST",
          body: body,
          keepalive: true,
          credentials: "include", // trimite cookie-ul de admin cross-site (self-exclude)
          headers: { "Content-Type": "text/plain" },
        });
      }
    } catch {}
  }

  // ── Pageviews (inclusiv SPA / History API) ──
  var lastUrl = null;
  function pageview() {
    var current = location.pathname + location.search;
    if (current === lastUrl) return;
    lastUrl = current;
    scrollAtins = {};
    send("pageview");
  }

  var _push = history.pushState;
  history.pushState = function () {
    _push.apply(this, arguments);
    pageview();
  };
  var _replace = history.replaceState;
  history.replaceState = function () {
    _replace.apply(this, arguments);
    pageview();
  };
  window.addEventListener("popstate", pageview);

  // ── Custom events: window.elitedata("nume_event") ──
  window.elitedata = function (name) {
    if (name) send("custom", String(name));
  };

  // ── Adâncimea de scroll: pragurile 10/20/.../100% din pagină, o dată fiecare
  // per pagină. Răspunde la „până unde citește lumea", fără să trimită la
  // fiecare pixel: zece evenimente pe vizită, în cel mai rău caz.
  var PRAGURI = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  var scrollAtins = {};
  var scrollProgramat = false;

  function procentCitit() {
    var doc = document.documentElement;
    var inaltimeTotala = Math.max(
      document.body ? document.body.scrollHeight : 0,
      doc ? doc.scrollHeight : 0,
    );
    var vizibil = window.innerHeight || (doc && doc.clientHeight) || 0;
    // Fără layout încă (tab deschis în fundal, pagină prerandată) toate
    // dimensiunile sunt 0 — iar 0 <= 0 ar însemna „citit integral". Nu măsurăm.
    if (inaltimeTotala <= 0 || vizibil <= 0) return -1;
    // Pagină mai scurtă decât ecranul: e citită integral prin definiție.
    if (inaltimeTotala <= vizibil) return 100;
    var derulat = window.pageYOffset || (doc && doc.scrollTop) || 0;
    // Toleranță de 2px la fundul paginii. Fără ea, pragul de 100 nu se atinge
    // aproape niciodată: înălțimile subpixel, bara de adrese care se retrage pe
    // mobil și footerele sticky lasă mereu o fracțiune necitită.
    if (derulat + vizibil >= inaltimeTotala - 2) return 100;
    return ((derulat + vizibil) / inaltimeTotala) * 100;
  }

  function verificaScroll() {
    scrollProgramat = false;
    // Cât timp pagina încă se încarcă, înălțimea ei e provizorie: imaginile fără
    // dimensiuni și fonturile care abia vin o cresc. O măsurătoare de acum ar
    // raporta „citit integral" pentru un articol pe care omul nici nu l-a văzut.
    if (document.readyState !== "complete") return;
    var p = procentCitit();
    for (var i = 0; i < PRAGURI.length; i++) {
      var prag = PRAGURI[i];
      if (p >= prag && !scrollAtins[prag]) {
        scrollAtins[prag] = true;
        send("scroll", String(prag));
      }
    }
  }

  window.addEventListener(
    "scroll",
    function () {
      if (scrollProgramat) return;
      scrollProgramat = true;
      // requestAnimationFrame, nu un timer: un singur calcul per cadru randat.
      requestAnimationFrame(verificaScroll);
    },
    { passive: true },
  );
  // Prima măsurătoare abia după `load` (pagina scurtă, fără scroll posibil,
  // trebuie totuși să conteze drept citită), apoi la fiecare schimbare de
  // înălțime: conținut lazy, acordeoane deschise, bannere care dispar.
  //
  // Întârzierea nu e cosmetică: serverul leagă scroll-ul de sesiunea deschisă
  // de pageview, iar pe o pagină scurtă ambele ar pleca în aceeași clipă. Dacă
  // scroll-ul ajunge primul, e aruncat — adică am pierde exact paginile citite
  // integral. O secundă e destul pentru dus-întors, și oricum nimeni nu citește
  // o pagină mai repede de atât.
  function primaMasuratoare() {
    setTimeout(verificaScroll, 1000);
  }
  if (document.readyState === "complete") primaMasuratoare();
  else window.addEventListener("load", primaMasuratoare);
  window.addEventListener("resize", verificaScroll, { passive: true });
  if (window.ResizeObserver && document.body) {
    new ResizeObserver(verificaScroll).observe(document.body);
  }

  // Autocapture PostHog: click, change și submit pe elemente acționabile.
  // Un element marcat ca goal trimite atât goal-ul explicit, cât și autocapture.
  function sensitive(el) {
    if (!el || !el.closest) return true;
    if (el.closest(".ph-no-autocapture,[data-ph-no-autocapture],.ph-no-capture,.ph-sensitive")) return true;
    var type = (el.getAttribute("type") || "").toLowerCase();
    if (type === "password" || type === "hidden") return true;
    var name = (el.getAttribute("name") || el.getAttribute("id") || "").replace(/[^a-z0-9]/gi, "");
    return /^(cc|cardnum|ccnum|creditcard|csc|cvc|cvv|exp|pass|pwd|routing|seccode|securitycode|securitynum|socialsec|socsec|ssn)/i.test(name);
  }
  function actionable(target, eventType) {
    if (!target || !target.closest) return null;
    var selector = eventType === "submit" ? "form" :
      eventType === "change" ? "input,select,textarea" :
      "a,button,input,select,textarea,label,[contenteditable='true'],[role='button']";
    var el = target.closest(selector);
    if (!el && eventType === "click") {
      for (var p = target; p && p !== document.body; p = p.parentElement) {
        try { if (getComputedStyle(p).cursor === "pointer") { el = p; break; } } catch {}
      }
    }
    return el && !sensitive(el) ? el : null;
  }
  function labelFor(el, eventType) {
    var text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
    return (text || el.getAttribute("aria-label") || el.getAttribute("title") ||
      el.getAttribute("href") || el.getAttribute("name") || eventType).slice(0, 120);
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var goal = t.closest("[elite-data-goal]");
    if (goal) send("custom", goal.getAttribute("elite-data-goal"));
    var el = actionable(t, "click");
    if (!el) return;
    send("click", labelFor(el, "click"));
  }, true);
  document.addEventListener("change", function (e) {
    var el = actionable(e.target, "change");
    if (el) send("change", labelFor(el, "change"));
  }, true);
  document.addEventListener("submit", function (e) {
    var el = actionable(e.target, "submit");
    if (el) send("submit", labelFor(el, "submit"));
  }, true);

  // Ultimul eveniment închide intervalul de timp măsurat pentru sesiune.
  var leaveSent = false;
  function leave() {
    if (leaveSent) return;
    leaveSent = true;
    send("leave");
  }
  window.addEventListener("onpagehide" in window ? "pagehide" : "unload", leave);

  // Pageview inițial
  pageview();
})();
