// MailTracker — content script Gmail (vanilla, self-contained).
//
// La trimitere: rescrie linkurile + injectează pixel + înregistrează emailul.
// În Gmail: bife duble în listă (gri=trimis, verde=citit), badge în compose,
// toast „citit" când cineva deschide. Nu blochează niciodată trimiterea.

(() => {
  "use strict";

  const DEFAULTS = { baseUrl: "https://www.ericcosulea.ro", secret: "" };
  let CONFIG = { ...DEFAULTS };

  chrome.storage.sync.get(DEFAULTS, (v) => {
    CONFIG = { baseUrl: (v.baseUrl || DEFAULTS.baseUrl).replace(/\/+$/, ""), secret: v.secret || "" };
    poll();
  });
  chrome.storage.onChanged.addListener((c) => {
    if (c.baseUrl) CONFIG.baseUrl = (c.baseUrl.newValue || DEFAULTS.baseUrl).replace(/\/+$/, "");
    if (c.secret) CONFIG.secret = c.secret.newValue || "";
    firstPoll = true;
    poll();
  });

  // ── Utils ────────────────────────────────────────────────────────────────
  function newId() {
    const b = new Uint8Array(9);
    crypto.getRandomValues(b);
    return Array.from(b, (x) => x.toString(36).padStart(2, "0")).join("").slice(0, 14);
  }
  function normSubject(s) {
    return (s || "").replace(/^\s*(re|fwd|fw)\s*:\s*/i, "").trim().toLowerCase();
  }
  function timeAgo(iso) {
    if (!iso) return "";
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return `acum ${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `acum ${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `acum ${h}h`;
    return `acum ${Math.floor(h / 24)}z`;
  }
  function esc(s) {
    return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  const SEND_WORD = /\b(send|trimite|enviar|envoyer|senden|invia|verzenden|wy[sś]lij|отправить)\b/i;
  const SHORTCUT = /(ctrl|⌘|cmd)[\s+-]*(enter|↵)/i;

  // ── Starea de la backend ──────────────────────────────────────────────────
  let STATUS = [];
  const seenOpens = new Map();
  let firstPoll = true;

  async function poll() {
    if (!CONFIG.secret) return;
    try {
      const r = await fetch(`${CONFIG.baseUrl}/api/track/status`, { headers: { "x-track-secret": CONFIG.secret } });
      if (!r.ok) return;
      const d = await r.json();
      STATUS = d.emails || [];
      detectNewOpens();
      scheduleRender();
    } catch {
      /* offline / backend jos — reîncercăm la următorul tick */
    }
  }

  function detectNewOpens() {
    for (const e of STATUS) {
      const prev = seenOpens.get(e.id);
      seenOpens.set(e.id, e.opens);
      if (!firstPoll && prev !== undefined && e.opens > prev) {
        toast(e.subject);
      }
    }
    firstPoll = false;
  }

  function findStatus(subject, recipientHint) {
    const ns = normSubject(subject);
    if (!ns) return null;
    let matches = STATUS.filter((e) => normSubject(e.subject) === ns);
    if (recipientHint) {
      const rh = recipientHint.toLowerCase();
      const narrowed = matches.filter((e) => (e.recipient || "").toLowerCase().includes(rh));
      if (narrowed.length) matches = narrowed;
    }
    if (!matches.length) return null;
    matches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return matches[0];
  }

  // ── Bife în lista de emailuri ─────────────────────────────────────────────
  function renderIndicators() {
    document.querySelectorAll("tr.zA").forEach((row) => {
      const subjEl = row.querySelector(".bog");
      if (!subjEl) return;
      const who = row.querySelector("span[email]")?.getAttribute("email") || "";
      const st = findStatus(subjEl.textContent || "", who);
      let badge = row.querySelector(".mt-badge");
      if (!st) {
        if (badge) badge.remove();
        return;
      }
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "mt-badge";
        subjEl.parentElement.insertBefore(badge, subjEl);
      }
      const opened = st.opens > 0;
      badge.textContent = opened ? "✓✓" : "✓✓";
      badge.classList.toggle("mt-open", opened);
      badge.title = opened
        ? `Citit · ${st.opens} deschideri${st.lastOpenAt ? " · ultima " + timeAgo(st.lastOpenAt) : ""}`
        : "Trimis · necitit";
    });
  }

  let renderScheduled = false;
  function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      try {
        renderIndicators();
        decorateComposes();
      } catch {
        /* DOM Gmail schimbat — ignorăm, nu stricăm pagina */
      }
    });
  }

  // ── Badge de tracking în compose ──────────────────────────────────────────
  function composeScopes() {
    return [...document.querySelectorAll('[role="dialog"], .iN, .aoI')].filter((s) =>
      s.querySelector('[contenteditable="true"][role="textbox"], [contenteditable="true"][aria-label]'),
    );
  }
  function findSendButton(scope) {
    return [...scope.querySelectorAll('[role="button"]')].find((b) => {
      const hint = `${b.getAttribute("data-tooltip") || ""} ${b.getAttribute("aria-label") || ""}`;
      return SHORTCUT.test(hint) || SEND_WORD.test(hint);
    });
  }
  function decorateComposes() {
    composeScopes().forEach((scope) => {
      if (scope.querySelector(".mt-pill")) return;
      const send = findSendButton(scope);
      if (!send || !send.parentElement) return;
      const pill = document.createElement("div");
      pill.className = "mt-pill mt-on";
      pill.innerHTML = `<span class="mt-ck">✓✓</span><span class="mt-pill-t">Tracking</span>`;
      pill.title = "Tracking activ — click pentru a-l opri pe acest email";
      pill.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const off = scope.dataset.mtOff === "1";
        scope.dataset.mtOff = off ? "0" : "1";
        pill.classList.toggle("mt-on", off);
        pill.classList.toggle("mt-pill-off", !off);
        pill.querySelector(".mt-ck").textContent = off ? "✓✓" : "○";
        pill.querySelector(".mt-pill-t").textContent = off ? "Tracking" : "Fără tracking";
      });
      send.parentElement.appendChild(pill);
    });
  }

  // ── Toast „citit" (notificare în pagină) ──────────────────────────────────
  function toast(subject) {
    const t = document.createElement("div");
    t.className = "mt-toast";
    t.innerHTML =
      `<div class="mt-toast-ck">✓✓</div>` +
      `<div class="mt-toast-body"><b>Email citit</b><div>${esc(subject || "(fără subiect)")}</div></div>`;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add("mt-show"));
    setTimeout(() => {
      t.classList.remove("mt-show");
      setTimeout(() => t.remove(), 400);
    }, 6000);
  }

  // ── Interceptarea trimiterii (injectare pixel + rescriere linkuri) ─────────
  function isSendButton(el) {
    const btn = el.closest?.('[role="button"]');
    if (!btn) return null;
    const scope = btn.closest('[role="dialog"], form, .iN, .aoI');
    if (!scope) return null;
    const hint = `${btn.getAttribute("data-tooltip") || ""} ${btn.getAttribute("aria-label") || ""}`;
    return SHORTCUT.test(hint) || SEND_WORD.test(hint) ? scope : null;
  }
  function findBody(scope) {
    return scope.querySelector('[contenteditable="true"][role="textbox"], [contenteditable="true"][aria-label]');
  }
  function readSubject(scope) {
    const s = scope.querySelector('input[name="subjectbox"]');
    return s ? s.value.trim() : "";
  }
  function readRecipients(scope) {
    const emails = new Set();
    scope.querySelectorAll("[email]").forEach((n) => {
      const e = n.getAttribute("email");
      if (e && e.includes("@")) emails.add(e);
    });
    return Array.from(emails).join(", ");
  }
  function readAccount() {
    const a = document.querySelector('a[aria-label*="@"], [aria-label*="Google Account"][aria-label*="@"]');
    const m = a?.getAttribute("aria-label")?.match(/[\w.+-]+@[\w.-]+\.\w+/);
    return m ? m[0] : null;
  }

  function processCompose(scope) {
    if (!CONFIG.secret) return;
    if (scope.dataset.mtOff === "1") return; // dezactivat manual din badge
    const body = findBody(scope);
    if (!body) return;

    const id = scope.dataset.mtId || (scope.dataset.mtId = newId());
    const base = CONFIG.baseUrl;

    const links = [];
    body.querySelectorAll("a[href]").forEach((a) => {
      const original = a.dataset.mtHref || a.getAttribute("href") || "";
      if (!/^https?:\/\//i.test(original)) return;
      if (original.startsWith(`${base}/t/c/`)) return;
      const idx = links.length;
      links.push(original);
      a.dataset.mtHref = original;
      a.setAttribute("href", `${base}/t/c/${id}?l=${idx}`);
    });

    if (!body.querySelector("img[data-mt-pixel]")) {
      const img = document.createElement("img");
      img.setAttribute("data-mt-pixel", "1");
      img.src = `${base}/t/o/${id}.gif`;
      img.width = 1;
      img.height = 1;
      img.style.cssText = "width:1px;height:1px;border:0;opacity:0;";
      body.appendChild(img);
    }

    body.dispatchEvent(new InputEvent("input", { bubbles: true }));

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
    // După trimitere, împrospătăm starea în curând ca bifa să apară.
    setTimeout(poll, 2500);
  }

  document.addEventListener("mousedown", (e) => {
    const scope = isSendButton(e.target);
    if (scope) {
      try {
        processCompose(scope);
      } catch {
        /* niciodată nu stricăm trimiterea */
      }
    }
  }, true);

  document.addEventListener("keydown", (e) => {
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
  }, true);

  // ── Stil injectat ─────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    .mt-badge{display:inline-block;margin-right:6px;font-size:12px;font-weight:700;
      letter-spacing:-1px;color:#9aa0a6;vertical-align:middle;cursor:default}
    .mt-badge.mt-open{color:#1a9d4b}
    .mt-pill{display:inline-flex;align-items:center;gap:5px;margin-left:10px;padding:5px 10px;
      border-radius:16px;font:600 12px/1 system-ui,sans-serif;cursor:pointer;user-select:none;
      vertical-align:middle}
    .mt-pill.mt-on{background:#e6f4ea;color:#1a9d4b}
    .mt-pill.mt-pill-off{background:#f1f3f4;color:#80868b}
    .mt-pill .mt-ck{font-weight:800;letter-spacing:-1px}
    .mt-toast{position:fixed;right:20px;bottom:20px;z-index:99999;display:flex;gap:12px;
      align-items:center;max-width:340px;padding:14px 16px;border-radius:12px;
      background:#15161a;color:#ededf0;box-shadow:0 8px 30px rgba(0,0,0,.35);
      border:1px solid rgba(255,255,255,.08);font:400 13px/1.35 system-ui,sans-serif;
      transform:translateY(20px);opacity:0;transition:transform .35s ease,opacity .35s ease}
    .mt-toast.mt-show{transform:translateY(0);opacity:1}
    .mt-toast-ck{font-size:18px;font-weight:800;letter-spacing:-2px;color:#4ade80}
    .mt-toast-body b{display:block;margin-bottom:2px;font-size:13px}
    .mt-toast-body>div{color:#b7bbc2}
  `;
  (document.head || document.documentElement).appendChild(style);

  // ── Loop: poll + re-render la schimbări de DOM ────────────────────────────
  const obs = new MutationObserver(() => scheduleRender());
  obs.observe(document.body, { childList: true, subtree: true });
  setInterval(poll, 20000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) poll();
  });
})();
