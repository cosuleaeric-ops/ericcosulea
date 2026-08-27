// Rulează script.js de producție într-un DOM fals și verifică EXACT ce trimite:
// pageview, praguri de scroll, click-uri. Fără rețea, fără browser.
//   node scripts/test-tracking.mjs
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cod = readFileSync(resolve(here, "../public/js/script.js"), "utf8");

function mediu({ total = 4000, ecran = 800, cookie = "" } = {}) {
  const trimise = [];
  const storage = new Map();
  const timere = [];
  let acum = 1_787_829_600_000;
  const ascultatori = { window: {}, document: {} };
  const adauga = (tinta) => (tip, fn) => ((ascultatori[tinta][tip] ??= []).push(fn));

  const doc = {
    readyState: "complete",
    hidden: false,
    visibilityState: "visible",
    cookie,
    currentScript: {
      src: "https://www.ericcosulea.ro/js/script.js",
      getAttribute: (a) => (a === "data-website-id" ? "dfid_test" : null),
    },
    documentElement: { scrollHeight: total, clientHeight: ecran, scrollTop: 0 },
    body: { scrollHeight: total },
    querySelector: () => null,
    addEventListener: adauga("document"),
    dispatchEvent: () => {},
  };

  const win = {
    innerHeight: ecran,
    pageYOffset: 0,
    location: { hostname: "exemplu.ro", href: "https://exemplu.ro/articol", pathname: "/articol", search: "" },
    document: doc,
    navigator: {
      sendBeacon: (url, blob) => { trimise.push(JSON.parse(blob.text)); return true; },
      webdriver: false,
    },
    history: { pushState() {}, replaceState() {} },
    onpagehide: null,
    addEventListener: adauga("window"),
    requestAnimationFrame: (fn) => fn(),
    setTimeout: (fn) => { timere.push(fn); },
    localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
    URL,
    ResizeObserver: null,
  };

  // Blob-ul din script primeste un string; îl pastram ca sa-l putem citi.
  const Blob = class { constructor(parts) { this.text = parts[0]; } };
  const FakeDate = { now: () => acum };

  const f = new Function(
    "window", "document", "navigator", "location", "history", "localStorage",
    "requestAnimationFrame", "setTimeout", "Blob", "URL", "self", "Date",
    cod,
  );
  f(win, doc, win.navigator, win.location, win.history, win.localStorage,
    win.requestAnimationFrame, win.setTimeout, Blob, URL, win, FakeDate);

  return {
    trimise,
    deruleazaLa(px) {
      win.pageYOffset = px;
      doc.documentElement.scrollTop = px;
      (ascultatori.window.scroll || []).forEach((fn) => fn());
    },
    apasa(el) {
      (ascultatori.document.click || []).forEach((fn) => fn({ target: el }));
    },
    schimba(el) {
      (ascultatori.document.change || []).forEach((fn) => fn({ target: el }));
    },
    trimite(el) {
      (ascultatori.document.submit || []).forEach((fn) => fn({ target: el }));
    },
    paraseste() {
      (ascultatori.window.pagehide || []).forEach((fn) => fn());
    },
    avanseaza(ms) { acum += ms; },
    ruleazaTimere() { timere.splice(0).forEach((fn) => fn()); },
  };
}

function element({ tag = "A", text = "", atribute = {} }) {
  const el = {
    tagName: tag,
    innerText: text,
    textContent: text,
    getAttribute: (a) => atribute[a] ?? null,
    closest: (sel) => {
      if (sel === "[elite-data-goal]") return atribute["elite-data-goal"] ? el : null;
      if (sel.includes("ph-no-")) return null;
      if (sel === "form") return tag === "FORM" ? el : null;
      if (sel === "input,select,textarea") return /^(INPUT|SELECT|TEXTAREA)$/.test(tag) ? el : null;
      return /^(A|BUTTON|INPUT|SELECT|TEXTAREA|LABEL)$/.test(tag) ? el : null;
    },
    parentElement: null,
  };
  return el;
}

let rele = 0;
function verifica(nume, real, astept) {
  const ok = JSON.stringify(real) === JSON.stringify(astept);
  if (!ok) rele++;
  console.log(`${ok ? "ok  " : "PICA"} ${nume}`);
  if (!ok) console.log(`      primit:  ${JSON.stringify(real)}\n      astept: ${JSON.stringify(astept)}`);
}

// 1. Articol lung: pageview la incarcare, praguri pe masura ce se deruleaza.
{
  const m = mediu({ total: 4000, ecran: 800 });
  verifica("pageview la incarcare", m.trimise.map((e) => e.type), ["pageview"]);
  verifica("session id este UUIDv7", /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(m.trimise[0].session_id), true);

  m.deruleazaLa(1200); // 50%
  verifica(
    "pragurile pana la 50 la jumatatea articolului",
    m.trimise.filter((e) => e.type === "scroll").map((e) => e.name),
    ["10", "20", "30", "40", "50"],
  );

  m.deruleazaLa(3200); // fundul paginii
  verifica(
    "pragurile pana la 100 la fund",
    m.trimise.filter((e) => e.type === "scroll").map((e) => e.name),
    ["10", "20", "30", "40", "50", "60", "70", "80", "90", "100"],
  );

  m.deruleazaLa(1200); // inapoi sus
  verifica(
    "nu se retrimite nimic la derulare inapoi",
    m.trimise.filter((e) => e.type === "scroll").length,
    10,
  );
}

// 2. Click-uri.
{
  const m = mediu({ total: 4000, ecran: 800 });
  m.apasa(element({ text: "  Vezi cursurile\n " }));
  verifica("textul clickului e normalizat", m.trimise.at(-1).name, "Vezi cursurile");
  verifica("toate evenimentele au aceeasi sesiune", m.trimise.at(-1).session_id, m.trimise[0].session_id);

  m.apasa(element({ tag: "BUTTON", text: "", atribute: { "aria-label": "Inchide" } }));
  verifica("buton fara text cade pe aria-label", m.trimise.at(-1).name, "Inchide");

  // PostHog păstrează autocapture chiar dacă aplicația trimite și goal explicit.
  const inainte = m.trimise.length;
  m.apasa(element({ text: "Cumpara", atribute: { "elite-data-goal": "checkout" } }));
  verifica("goal-ul trimite custom plus autocapture", m.trimise.slice(inainte).map((e) => e.type), ["custom", "click"]);

  m.apasa(element({ text: "x".repeat(200) }));
  verifica("textul lung e taiat la 120", m.trimise.at(-1).name.length, 120);

  m.schimba(element({ tag: "INPUT", atribute: { name: "email" } }));
  m.trimite(element({ tag: "FORM", atribute: { name: "contact" } }));
  verifica("change si submit sunt autocapturate", m.trimise.slice(-2).map((e) => e.type), ["change", "submit"]);

  const sesiuneVeche = m.trimise.at(-1).session_id;
  m.avanseaza(30 * 60 * 1000 + 1);
  m.apasa(element({ text: "Dupa pauza" }));
  verifica("30 minute idle rotesc sesiunea", m.trimise.at(-1).session_id !== sesiuneVeche, true);

  m.paraseste();
  verifica("pagehide trimite leave", m.trimise.at(-1).type, "leave");
}

// 3. Adminul nu trimite nimic, nici măcar pageview-ul inițial.
{
  const m = mediu({ cookie: "ericcosulea_admin_hint=1" });
  verifica("adminul este exclus complet", m.trimise.length, 0);
}

console.log(rele === 0 ? "\nToate verificarile trec." : `\n${rele} verificari pica.`);
process.exit(rele === 0 ? 0 : 1);
