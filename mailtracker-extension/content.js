// MailTracker — content script Gmail (vanilla, self-contained).
//
// La trimitere: rescrie linkurile din corpul emailului către /t/c/{id}?l=N,
// injectează un pixel /t/o/{id}.gif, și înregistrează emailul la backend.
// Nu blochează niciodată trimiterea — dacă ceva pică, mailul pleacă oricum.

(() => {
  "use strict";

  const DEFAULTS = { baseUrl: "https://ericcosulea.ro", secret: "" };
  let CONFIG = { ...DEFAULTS };

  chrome.storage.sync.get(DEFAULTS, (v) => {
    CONFIG = { baseUrl: (v.baseUrl || DEFAULTS.baseUrl).replace(/\/+$/, ""), secret: v.secret || "" };
  });
  chrome.storage.onChanged.addListener((c) => {
    if (c.baseUrl) CONFIG.baseUrl = (c.baseUrl.newValue || DEFAULTS.baseUrl).replace(/\/+$/, "");
    if (c.secret) CONFIG.secret = c.secret.newValue || "";
  });

  function newId() {
    const b = new Uint8Array(9);
    crypto.getRandomValues(b);
    return Array.from(b, (x) => x.toString(36).padStart(2, "0")).join("").slice(0, 14);
  }

  // ── Detectarea butonului Send ──────────────────────────────────────────────
  // Fără a ne baza pe text localizat: Send are role=button + data-tooltip care
  // conține scurtătura (Ctrl-Enter / ⌘Enter) în majoritatea locale-lor. Ca plasă
  // de siguranță acceptăm și cuvinte "send" comune, inclusiv „Trimite".
  const SEND_WORD = /\b(send|trimite|enviar|envoyer|senden|invia|verzenden|wy[sś]lij|отправить)\b/i;
  const SHORTCUT = /(ctrl|⌘|cmd)[\s+-]*(enter|↵)/i;

  function isSendButton(el) {
    const btn = el.closest?.('[role="button"]');
    if (!btn) return null;
    if (!btn.closest('[role="dialog"], .aoI, .iN')) {
      // trebuie să fie într-un compose (dialog nou sau reply inline)
      if (!btn.closest('form')) return null;
    }
    const hint = `${btn.getAttribute("data-tooltip") || ""} ${btn.getAttribute("aria-label") || ""}`;
    if (SHORTCUT.test(hint) || SEND_WORD.test(hint)) {
      return btn.closest('[role="dialog"], form, .iN, .aoI') || btn.closest('div');
    }
    return null;
  }

  // ── Extragere corp + metadata din compose ───────────────────────────────────
  function findBody(scope) {
    // Corpul editabil al mesajului.
    return scope.querySelector('[contenteditable="true"][role="textbox"], [contenteditable="true"][aria-label]');
  }

  function readSubject(scope) {
    const s = scope.querySelector('input[name="subjectbox"]');
    return s ? s.value.trim() : "";
  }

  function readRecipients(scope) {
    // Chip-urile de destinatari expun atributul [email]. Excludem eventual corpul.
    const emails = new Set();
    scope.querySelectorAll("[email]").forEach((n) => {
      const e = n.getAttribute("email");
      if (e && e.includes("@")) emails.add(e);
    });
    return Array.from(emails).join(", ");
  }

  function readAccount() {
    // Emailul contului activ apare în aria-label-ul avatarului din colțul dreapta-sus.
    const a = document.querySelector('a[aria-label*="@"], [aria-label*="Google Account"][aria-label*="@"]');
    const m = a?.getAttribute("aria-label")?.match(/[\w.+-]+@[\w.-]+\.\w+/);
    return m ? m[0] : null;
  }

  // ── Procesarea unui compose la trimitere (idempotentă) ───────────────────────
  function processCompose(scope) {
    if (!CONFIG.secret) return; // neconfigurat → nu facem nimic
    const body = findBody(scope);
    if (!body) return;

    const id = scope.dataset.mtId || (scope.dataset.mtId = newId());
    const base = CONFIG.baseUrl;

    // Rescrie toate linkurile http(s). Reconstruim lista de la zero (idempotent).
    const links = [];
    body.querySelectorAll("a[href]").forEach((a) => {
      const original = a.dataset.mtHref || a.getAttribute("href") || "";
      if (!/^https?:\/\//i.test(original)) return;
      if (original.startsWith(`${base}/t/c/`)) return; // deja al nostru
      const idx = links.length;
      links.push(original);
      a.dataset.mtHref = original;
      a.setAttribute("href", `${base}/t/c/${id}?l=${idx}`);
    });

    // Pixel de open (o singură dată per compose).
    if (!body.querySelector("img[data-mt-pixel]")) {
      const img = document.createElement("img");
      img.setAttribute("data-mt-pixel", "1");
      img.src = `${base}/t/o/${id}.gif`;
      img.width = 1;
      img.height = 1;
      img.style.cssText = "width:1px;height:1px;border:0;opacity:0;";
      body.appendChild(img);
    }

    // Gmail re-serializează contenteditable la send; un input event forțează sync-ul modelului.
    body.dispatchEvent(new InputEvent("input", { bubbles: true }));

    // Înregistrează la backend (fire-and-forget; ajunge înainte ca destinatarul să deschidă).
    try {
      fetch(`${base}/api/track/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-track-secret": CONFIG.secret },
        body: JSON.stringify({
          id,
          account: readAccount(),
          recipient: readRecipients(scope),
          subject: readSubject(scope),
          links,
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* ignorăm */
    }
  }

  // ── Hooks: click/mousedown pe Send + Ctrl/⌘+Enter ────────────────────────────
  function onSendTrigger(target) {
    const scope = isSendButton(target);
    if (scope) {
      try {
        processCompose(scope);
      } catch {
        /* niciodată nu stricăm trimiterea */
      }
    }
  }

  // Capture phase: rulăm înaintea handler-elor Gmail, cât DOM-ul e încă al nostru de mutat.
  document.addEventListener("mousedown", (e) => onSendTrigger(e.target), true);

  document.addEventListener(
    "keydown",
    (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        const scope = e.target?.closest?.('[role="dialog"], form, .iN, .aoI');
        if (scope) {
          try {
            processCompose(scope);
          } catch {
            /* ignorăm */
          }
        }
      }
    },
    true,
  );
})();
