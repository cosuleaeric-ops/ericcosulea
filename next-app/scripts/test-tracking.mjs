// Rulează script.js de producție într-un DOM fals și verifică EXACT ce trimite:
// pageview, praguri de scroll, click-uri. Fără rețea, fără browser.
//   node scripts/test-tracking.mjs
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cod = readFileSync(resolve(here, "../public/js/script.js"), "utf8");

function mediu({ total = 4000, ecran = 800 } = {}) {
  const trimise = [];
  const ascultatori = { window: {}, document: {} };
  const adauga = (tinta) => (tip, fn) => ((ascultatori[tinta][tip] ??= []).push(fn));

  const doc = {
    readyState: "complete",
    hidden: false,
    visibilityState: "visible",
    cookie: "",
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
    addEventListener: adauga("window"),
    requestAnimationFrame: (fn) => fn(),
    setTimeout: (fn) => fn(),
    localStorage: { getItem: () => null, setItem: () => {} },
    URL,
    ResizeObserver: null,
  };

  // Blob-ul din script primeste un string; îl pastram ca sa-l putem citi.
  const Blob = class { constructor(parts) { this.text = parts[0]; } };

  const f = new Function(
    "window", "document", "navigator", "location", "history", "localStorage",
    "requestAnimationFrame", "setTimeout", "Blob", "URL", "self",
    cod,
  );
  f(win, doc, win.navigator, win.location, win.history, win.localStorage,
    win.requestAnimationFrame, win.setTimeout, Blob, URL, win);

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
      return el;
    },
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

  m.deruleazaLa(1200); // 50%
  verifica(
    "pragurile 25 si 50 la jumatatea articolului",
    m.trimise.filter((e) => e.type === "scroll").map((e) => e.name),
    ["25", "50"],
  );

  m.deruleazaLa(3200); // fundul paginii
  verifica(
    "pragurile 75 si 100 la fund",
    m.trimise.filter((e) => e.type === "scroll").map((e) => e.name),
    ["25", "50", "75", "100"],
  );

  m.deruleazaLa(1200); // inapoi sus
  verifica(
    "nu se retrimite nimic la derulare inapoi",
    m.trimise.filter((e) => e.type === "scroll").length,
    4,
  );
}

// 2. Click-uri.
{
  const m = mediu({ total: 4000, ecran: 800 });
  m.apasa(element({ text: "  Vezi cursurile\n " }));
  verifica("textul clickului e normalizat", m.trimise.at(-1), {
    id: "dfid_test", type: "click", name: "Vezi cursurile",
    url: "https://exemplu.ro/articol", referrer: "", visitor_id: m.trimise.at(-1).visitor_id,
  });

  m.apasa(element({ tag: "BUTTON", text: "", atribute: { "aria-label": "Inchide" } }));
  verifica("buton fara text cade pe aria-label", m.trimise.at(-1).name, "Inchide");

  // Elementul marcat ca goal trimite goal-ul (custom), nu si un click peste el.
  const inainte = m.trimise.length;
  m.apasa(element({ text: "Cumpara", atribute: { "elite-data-goal": "checkout" } }));
  verifica("elementul cu goal trimite doar goal-ul", m.trimise.slice(inainte), [
    {
      id: "dfid_test", type: "custom", name: "checkout",
      url: "https://exemplu.ro/articol", referrer: "", visitor_id: m.trimise.at(-1).visitor_id,
    },
  ]);

  m.apasa(element({ text: "x".repeat(200) }));
  verifica("textul lung e taiat la 120", m.trimise.at(-1).name.length, 120);
}

console.log(rele === 0 ? "\nToate verificarile trec." : `\n${rele} verificari pica.`);
process.exit(rele === 0 ? 0 : 1);
