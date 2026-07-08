// EliteMail — service worker: blochează fetch-urile PROPRIILOR pixeli de tracking.
//
// Content script-ul trimite URL-urile pixelilor văzuți în DOM-ul threadurilor DESCHISE
// (proxy googleusercontent, fără fragment). Le blocăm cu declarativeNetRequest, la nivel
// de rețea: browserul TĂU nu mai cere pixelul deloc → orice hit care totuși ajunge la
// server prin proxy e al destinatarului, nu al tău. Destinatarul nu e afectat — proxy-ul
// lui folosește alt URL (token googleusercontent per cont).
//
// Reguli de SESIUNE (se șterg la restart browser) — DOM-ul le re-trimite oricum la
// următoarea deschidere a threadului, deci nu acumulăm nimic persistent.

const blocked = new Map(); // urlFilter -> ruleId
let nextId = 1;

// SW-ul MV3 se oprește/repornește des: re-citim regulile existente ca să nu refolosim id-uri.
let ready = chrome.declarativeNetRequest
  .getSessionRules()
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
    if (!fresh.length || blocked.size > 4000) return; // limita session rules e 5000
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
    return chrome.declarativeNetRequest.updateSessionRules({ addRules: rules }).catch(() => {});
  });
});
