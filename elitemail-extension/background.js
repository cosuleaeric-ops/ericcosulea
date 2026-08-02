// EliteMail — service worker: blochează fetch-urile PROPRIILOR pixeli de tracking.
//
// Content script-ul trimite URL-urile pixelilor văzuți în DOM-ul threadurilor DESCHISE
// (proxy googleusercontent, fără fragment). Le blocăm cu declarativeNetRequest, la nivel
// de rețea: browserul TĂU nu mai cere pixelul deloc → orice hit care totuși ajunge la
// server prin proxy e al destinatarului, nu al tău. Destinatarul nu e afectat — proxy-ul
// lui folosește alt URL (token googleusercontent per cont).
//
// Reguli DINAMICE (persistă peste restart de browser). Cu reguli de sesiune, fiecare
// repornire de Chrome golea lista, iar prima redeschidere a fiecărui thread pierdea cursa
// pixel-vs-ping → propriile deschideri ajungeau la server. Acum cursa există cel mult
// O DATĂ per email, la prima randare.

const blocked = new Map(); // urlFilter -> ruleId
let nextId = 1;

// SW-ul MV3 se oprește/repornește des: re-citim regulile existente ca să nu refolosim id-uri.
let ready = chrome.declarativeNetRequest
  .getDynamicRules()
  .then((rules) => {
    for (const r of rules) {
      blocked.set(r.condition.urlFilter, r.id);
      if (r.id >= nextId) nextId = r.id + 1;
    }
  })
  .catch(() => {});

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== "mt-block" || !Array.isArray(msg.urls)) return;
  ready = ready.then(() => {
    // urlFilter tratează special doar * | ^ — le refuzăm (URL-urile proxy nu le conțin).
    const fresh = [...new Set(msg.urls)].filter(
      (u) =>
        typeof u === "string" &&
        u.startsWith("https://") &&
        u.length < 2000 &&
        !/[*^|]/.test(u) &&
        !blocked.has("|" + u),
    );
    if (!fresh.length) return;
    // Limita de reguli dinamice e 5000: la depășire scoatem cele mai vechi 1000 id-uri.
    let removeRuleIds = [];
    if (blocked.size + fresh.length > 4500) {
      const oldest = [...blocked.entries()].sort((a, b) => a[1] - b[1]).slice(0, 1000);
      removeRuleIds = oldest.map(([, id]) => id);
      oldest.forEach(([f]) => blocked.delete(f));
    }
    const rules = fresh.map((u) => {
      const id = nextId++;
      blocked.set("|" + u, id);
      return {
        id,
        priority: 1,
        action: { type: "block" },
        // ancorat la stânga = exact acest URL, doar imagini
        condition: { urlFilter: "|" + u, resourceTypes: ["image"] },
      };
    });
    return chrome.declarativeNetRequest
      .updateDynamicRules({ addRules: rules, removeRuleIds })
      .catch(() => {});
  });
});
