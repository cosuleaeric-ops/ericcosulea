// Extrage procentCitit din script.js si il ruleaza pe scenarii sintetice.
import { readFileSync } from "node:fs";
const src = readFileSync("/Users/ericcosulea/Documents/Proiecte/ericcosulea/next-app/public/js/script.js", "utf8");
const start = src.indexOf("function procentCitit()");
const end = src.indexOf("function verificaScroll()");
const cod = src.slice(start, end);

function ruleaza({ total, ecran, derulat }) {
  const window = { innerHeight: ecran, pageYOffset: derulat };
  const document = {
    documentElement: { scrollHeight: total, clientHeight: ecran, scrollTop: derulat },
    body: { scrollHeight: total },
  };
  const f = new Function("window", "document", cod + "; return procentCitit();");
  return f(window, document);
}

const cazuri = [
  { nume: "fara layout (tab in fundal)",      total: 0,    ecran: 0,   derulat: 0,    astept: -1 },
  { nume: "pagina mai scurta decat ecranul",  total: 600,  ecran: 900, derulat: 0,    astept: 100 },
  { nume: "articol lung, netulburat",         total: 4000, ecran: 800, derulat: 0,    astept: 20 },
  { nume: "articol lung, la jumatate",        total: 4000, ecran: 800, derulat: 1200, astept: 50 },
  { nume: "articol lung, la 75%",             total: 4000, ecran: 800, derulat: 2200, astept: 75 },
  { nume: "fundul paginii, exact",            total: 4000, ecran: 800, derulat: 3200, astept: 100 },
  { nume: "fundul paginii, 1px lipsa",        total: 4000, ecran: 800, derulat: 3199, astept: 100 },
  { nume: "fundul paginii, 10px lipsa",       total: 4000, ecran: 800, derulat: 3190, astept: 99.75 },
];

let rele = 0;
for (const c of cazuri) {
  const r = ruleaza(c);
  const ok = Math.abs(r - c.astept) < 0.01;
  if (!ok) rele++;
  console.log(`${ok ? "ok " : "PICA"}  ${c.nume.padEnd(32)} -> ${typeof r === "number" ? r.toFixed(2) : r} (astept ${c.astept})`);
}
console.log(rele === 0 ? "\nToate cazurile trec." : `\n${rele} cazuri pica.`);
