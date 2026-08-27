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
  } catch (e) {}

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
    } catch (e) {}
    if (stored === "true") return true;
    return document.cookie.split(";").some(function (c) {
      return c.trim() === IGNORE_KEY + "=true";
    });
  }

  function writeIgnore(on) {
    try {
      if (on) localStorage.setItem(IGNORE_KEY, "true");
      else localStorage.removeItem(IGNORE_KEY);
    } catch (e) {}
    document.cookie = on
      ? IGNORE_KEY + "=true;max-age=34560000;path=/;SameSite=Lax"
      : IGNORE_KEY + "=;max-age=0;path=/;SameSite=Lax";
  }

  try {
    var ignoreParam = new URLSearchParams(location.search).get(IGNORE_KEY);
    if (ignoreParam !== null) {
      writeIgnore(ignoreParam !== "0" && ignoreParam !== "false");
    }
  } catch (e) {}

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
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }
  var visitorId;
  try {
    visitorId = localStorage.getItem(VKEY);
    if (!visitorId) {
      visitorId = uuid();
      localStorage.setItem(VKEY, visitorId);
    }
  } catch (e) {
    var m = document.cookie.match(/(?:^|;\s*)dfa_visitor_id=([^;]+)/);
    if (m) {
      visitorId = decodeURIComponent(m[1]);
    } else {
      visitorId = uuid();
      document.cookie =
        "dfa_visitor_id=" + visitorId + ";max-age=63072000;path=/;SameSite=Lax";
    }
  }

  function send(type, name) {
    var payload = {
      id: websiteId,
      type: type,
      name: name || undefined,
      url: location.href,
      referrer: document.referrer || "",
      visitor_id: visitorId,
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
    } catch (e) {}
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

  // ── Goal pe click: orice element cu elite-data-goal="nume" ──
  // Delegat pe document, prinde și click pe copiii elementului marcat.
  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest && e.target.closest("[elite-data-goal]");
    var name = el && el.getAttribute("elite-data-goal");
    if (name) send("custom", name);
  });

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

  // ── Click-uri pe elementele acționabile, cu textul lor. Elementul marcat cu
  // elite-data-goal trimite deja un goal, deci pe el nu mai punem și click.
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest("[elite-data-goal]")) return;
    var el = t.closest("a, button, [role='button'], summary");
    if (!el) return;

    var text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) {
      // Buton fără text (iconiță): cade pe eticheta de accesibilitate, apoi pe
      // destinație, ca să nu ajungă în rapoarte un rând gol.
      text =
        el.getAttribute("aria-label") ||
        el.getAttribute("title") ||
        el.getAttribute("href") ||
        "";
    }
    if (!text) return;
    send("click", text.slice(0, 120));
  });

  // Ultimul eveniment închide intervalul de timp măsurat pentru sesiune.
  var leaveSent = false;
  function leave() {
    if (leaveSent) return;
    leaveSent = true;
    send("leave");
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") leave();
    else leaveSent = false;
  });
  window.addEventListener("pagehide", leave);

  // Pageview inițial
  pageview();
})();
