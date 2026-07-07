// EliteMail — content script Gmail (vanilla, self-contained).
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

  // Alerte notificabile (redeschidere după o săptămână / 5+ deschideri). Dedup persistent
  // în chrome.storage.local, ca să nu re-notifice aceeași alertă la fiecare reload.
  let shownAlerts = new Set();
  let alertsReady = false;
  let firstAlertsRun = false;
  chrome.storage.local.get({ mtShownAlerts: null }, (v) => {
    if (v.mtShownAlerts === null) {
      firstAlertsRun = true; // prima instalare: seed fără notificări (fără burst istoric)
    } else {
      shownAlerts = new Set(v.mtShownAlerts);
    }
    alertsReady = true;
  });
  function persistAlerts() {
    // păstrăm ultimele ~300 id-uri ca să nu crească la infinit
    const arr = [...shownAlerts].slice(-300);
    shownAlerts = new Set(arr);
    chrome.storage.local.set({ mtShownAlerts: arr });
  }

  async function poll() {
    if (!CONFIG.secret) return;
    try {
      const r = await fetch(`${CONFIG.baseUrl}/api/track/status`, { headers: { "x-track-secret": CONFIG.secret } });
      if (!r.ok) return;
      const d = await r.json();
      STATUS = d.emails || [];
      detectNewOpens();
      detectAlerts(d.alerts || []);
      scheduleRender();
      updatePanel(); // dacă panoul e deschis, reîmprospătează conținutul (fără a recrea footer-ul)
    } catch {
      /* offline / backend jos — reîncercăm la următorul tick */
    }
  }

  function detectAlerts(alerts) {
    if (!alertsReady) return; // așteptăm încărcarea din storage
    if (firstAlertsRun) {
      alerts.forEach((a) => shownAlerts.add(a.id));
      firstAlertsRun = false;
      persistAlerts();
      return;
    }
    let changed = false;
    for (const a of alerts) {
      if (shownAlerts.has(a.id)) continue;
      shownAlerts.add(a.id);
      changed = true;
      alertToast(a);
    }
    if (changed) persistAlerts();
  }

  function alertToast(a) {
    const subj = a.subject || "(fără subiect)";
    if (a.alert === "reopen_week") {
      toast("Redeschis după o săptămână", subj);
    } else if (a.alert === "high_count") {
      const em = STATUS.find((e) => e.id === a.emailId);
      const n = em ? em.opens : 5;
      toast("Deschis de multe ori", `${subj} — ${n} deschideri`);
    }
  }

  function detectNewOpens() {
    for (const e of STATUS) {
      const prev = seenOpens.get(e.id);
      seenOpens.set(e.id, e.opens);
      if (!firstPoll && prev !== undefined && e.opens > prev) {
        toast("Email citit", e.subject);
      }
    }
    firstPoll = false;
  }

  function findStatus(subject, recipientHint) {
    const ns = normSubject(subject);
    if (!ns) return null;
    const matches = STATUS.filter((e) => normSubject(e.subject) === ns);
    if (!matches.length) return null;
    const pick = (arr) => arr.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    if (recipientHint) {
      const rh = recipientHint.toLowerCase();
      const narrowed = matches.filter((e) => (e.recipient || "").toLowerCase().includes(rh));
      if (narrowed.length) return pick(narrowed);
      // Hint prezent, dar niciun match pe destinatar. Dacă vreun email cu subiectul ăsta
      // ARE destinatar înregistrat (și tot nu se potrivește) → nu e al nostru, fără bifă.
      if (matches.some((e) => (e.recipient || "").trim())) return null;
      // Altfel (destinatar necunoscut la reply-uri) → cădem pe potrivire doar după subiect.
    }
    return pick(matches);
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
        // Coloană la stânga: înaintea expeditorului/destinatarului („To:…"), nu lângă subiect.
        const cell = (row.querySelector(".yW") || subjEl).closest("td") || subjEl.parentElement;
        cell.insertBefore(badge, cell.firstChild);
      }
      const opened = st.opens > 0;
      badge.textContent = "✓✓";
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
        injectTopWidget();
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

  // ── Buton + card în bara de sus Gmail (ca MailSuite) ──────────────────────
  function headerGear() {
    return document.querySelector(
      '[role="button"][aria-label*="Settings" i], [role="button"][aria-label*="Setări" i], [aria-label*="Settings" i][data-tooltip], [aria-label*="Setări" i][data-tooltip]',
    );
  }

  // Rândul flex care ține iconițele din header (ca butonul să fie centrat vertical ca ele).
  function iconRowFor(el) {
    let n = el;
    for (let i = 0; i < 6 && n; i++) {
      if (getComputedStyle(n).display.includes("flex")) return n;
      n = n.parentElement;
    }
    return el.parentElement;
  }

  function injectTopWidget() {
    let btn = document.getElementById("mt-top");
    if (!btn) {
      const gear = headerGear();
      if (!gear || !gear.parentElement) return;
      const row = iconRowFor(gear);
      // ramura directă din rând care conține rotița — inserăm butonul înaintea ei
      let branch = gear;
      while (branch.parentElement && branch.parentElement !== row) branch = branch.parentElement;
      btn = document.createElement("div");
      btn.id = "mt-top";
      btn.setAttribute("role", "button");
      btn.title = "EliteMail";
      btn.innerHTML = `<span class="mt-top-ck">✓✓</span><span class="mt-top-dot"></span>`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePanel(btn);
      });
      row.insertBefore(btn, branch);
    }
    // starea butonului: punct roșu dacă lipsește secretul
    const dot = btn.querySelector(".mt-top-dot");
    if (dot) dot.classList.toggle("mt-bad", !CONFIG.secret);
  }

  function togglePanel(btn) {
    const existing = document.getElementById("mt-panel");
    if (existing) {
      existing.remove();
      return;
    }
    const panel = document.createElement("div");
    panel.id = "mt-panel";
    const rect = btn.getBoundingClientRect();
    panel.style.top = `${Math.round(rect.bottom + 8)}px`;
    panel.style.right = `${Math.round(window.innerWidth - rect.right)}px`;
    document.body.appendChild(panel);
    updatePanel();
    poll();
    setTimeout(() => {
      document.addEventListener("click", closePanelOnce, { once: true });
    }, 0);
  }
  function closePanelOnce(e) {
    const panel = document.getElementById("mt-panel");
    if (panel && !panel.contains(e.target) && e.target.id !== "mt-top") panel.remove();
    else if (panel) document.addEventListener("click", closePanelOnce, { once: true });
  }

  // Scheletul se construiește O SINGURĂ dată; nodul footer NU se recreează la refresh,
  // ca să nu se piardă click-ul pe „deschide dashboard" când Gmail agită DOM-ul.
  function buildPanelSkeleton(panel) {
    panel.innerHTML =
      `<div class="mt-phead"><b>EliteMail</b><span class="mt-pstat"></span></div>` +
      `<div class="mt-pkpi"></div>` +
      `<div class="mt-plist"></div>` +
      `<a class="mt-pfoot" href="#" target="_blank" rel="noopener">Deschide dashboard-ul complet →</a>`;
    // Click-urile din panou nu îl închid (doar cele din afară).
    panel.addEventListener("click", (e) => e.stopPropagation());
    const foot = panel.querySelector(".mt-pfoot");
    foot.addEventListener("click", (e) => {
      e.preventDefault();
      window.open(`${CONFIG.baseUrl}/admin/mail`, "_blank", "noopener");
    });
    panel.dataset.built = "1";
  }

  function updatePanel() {
    const panel = document.getElementById("mt-panel");
    if (!panel) return;
    if (!panel.dataset.built) buildPanelSkeleton(panel);

    const tracked = STATUS.length;
    const read = STATUS.filter((e) => e.opens > 0).length;
    const recent = [...STATUS]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8);

    panel.querySelector(".mt-pstat").innerHTML = CONFIG.secret
      ? `<span class="mt-ok">●</span> Conectat la ${esc(CONFIG.baseUrl.replace(/^https?:\/\//, ""))}`
      : `<span class="mt-err">●</span> Secret lipsă — deschide Opțiuni`;

    panel.querySelector(".mt-pkpi").innerHTML =
      `<div><b>${tracked}</b> urmărite</div><div><b>${read}</b> citite</div>`;

    panel.querySelector(".mt-plist").innerHTML = recent.length
      ? recent
          .map((e) => {
            const opened = e.opens > 0;
            return (
              `<div class="mt-prow">` +
              `<span class="mt-badge ${opened ? "mt-open" : ""}">✓✓</span>` +
              `<span class="mt-pcol">` +
              `<span class="mt-psubj">${esc(e.subject || "(fără subiect)")}</span>` +
              `<span class="mt-pto">${esc(e.recipient || "—")}</span>` +
              `</span>` +
              `<span class="mt-pmeta">${opened ? timeAgo(e.lastOpenAt) : "necitit"}</span>` +
              `</div>`
            );
          })
          .join("")
      : `<div class="mt-empty">Niciun email urmărit încă.<br>Trimite unul din Gmail.</div>`;

    panel.querySelector(".mt-pfoot").href = `${CONFIG.baseUrl}/admin/mail`;
  }

  // ── Toast „citit" (notificare în pagină) ──────────────────────────────────
  function toast(title, body) {
    const t = document.createElement("div");
    t.className = "mt-toast";
    t.innerHTML =
      `<div class="mt-toast-ck">✓✓</div>` +
      `<div class="mt-toast-body"><b>${esc(title)}</b><div>${esc(body || "")}</div></div>`;
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
  // Corpul e uneori într-un <form> îngust care NU conține subiectul/destinatarii.
  // Urcăm la dialogul de compose complet ca să-i citim corect.
  function composeRoot(scope) {
    return scope.closest('[role="dialog"]') || scope;
  }
  function readSubject(scope) {
    const root = composeRoot(scope);
    const s = root.querySelector(
      'input[name="subjectbox"], input[aria-label*="Subject" i], input[aria-label*="Subiect" i]',
    );
    const v = s && s.value ? s.value.trim() : "";
    if (v) return v;
    // Reply/forward inline: nu există câmp de subiect → luăm subiectul conversației deschise.
    const h = document.querySelector("h2.hP, h2[data-thread-perm-id], .hP");
    return h ? (h.textContent || "").trim() : "";
  }
  function readRecipients(scope) {
    const root = composeRoot(scope);
    const emails = new Set();
    root.querySelectorAll("[email]").forEach((n) => {
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

    // Imaginile care NU sunt deja link → le facem clickabile (wrap într-un <a> către
    // imaginea însăși), ca să prindem și clickul pe imagini, nu doar pe linkuri/butoane.
    body.querySelectorAll("img").forEach((img) => {
      if (img.hasAttribute("data-mt-pixel")) return; // pixelul nostru de open
      if (img.closest("a")) return; // deja e link → deja trackat de bucla de mai jos
      const src = img.getAttribute("src") || "";
      if (!/^https?:\/\//i.test(src)) return; // inline/data: nu poate fi redirectat
      const a = document.createElement("a");
      a.setAttribute("href", src);
      a.dataset.mtHref = src;
      a.dataset.mtImg = "1";
      img.parentNode.insertBefore(a, img);
      a.appendChild(img);
    });

    // Rescrie TOATE linkurile: text, butoane, imagini-link și imaginile wrap-uite mai sus.
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
    .mt-badge{display:inline-block;min-width:22px;margin-right:6px;font-size:12px;font-weight:700;
      letter-spacing:-1px;color:#9aa0a6;vertical-align:middle;text-align:center;cursor:default}
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
    #mt-top{position:relative;display:inline-flex;align-items:center;justify-content:center;
      align-self:center;flex:0 0 auto;box-sizing:border-box;width:36px;height:36px;margin:0 4px;
      border-radius:50%;cursor:pointer;vertical-align:middle;background:rgba(26,157,75,.14)}
    #mt-top:hover{background:rgba(26,157,75,.24)}
    #mt-top .mt-top-ck{font:800 14px/1 system-ui,sans-serif;letter-spacing:-2px;color:#1a9d4b}
    #mt-top .mt-top-dot{position:absolute;top:6px;right:6px;width:7px;height:7px;border-radius:50%;
      border:1.5px solid #15161a;background:transparent}
    #mt-top .mt-top-dot.mt-bad{background:#ea4335}
    #mt-panel{position:fixed;z-index:99999;width:340px;max-height:70vh;overflow:auto;
      background:#15161a;color:#ededf0;border:1px solid rgba(255,255,255,.1);border-radius:14px;
      box-shadow:0 12px 40px rgba(0,0,0,.45);font:400 13px/1.4 system-ui,sans-serif}
    #mt-panel .mt-phead{display:flex;align-items:center;justify-content:space-between;gap:10px;
      padding:14px 16px 10px}
    #mt-panel .mt-phead b{font-size:15px}
    #mt-panel .mt-pstat{font-size:11px;color:#b7bbc2}
    #mt-panel .mt-ok{color:#4ade80}
    #mt-panel .mt-err{color:#ea4335}
    #mt-panel .mt-pkpi{display:flex;gap:20px;padding:0 16px 12px;color:#8b8f98;font-size:12px;
      border-bottom:1px solid rgba(255,255,255,.06)}
    #mt-panel .mt-pkpi b{color:#ededf0;font-size:15px;margin-right:3px}
    #mt-panel .mt-plist{padding:6px 8px}
    #mt-panel .mt-prow{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:8px}
    #mt-panel .mt-prow:hover{background:#1d1f25}
    #mt-panel .mt-pcol{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.25}
    #mt-panel .mt-psubj{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #mt-panel .mt-pto{font-size:11px;color:#8b8f98;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #mt-panel .mt-pmeta{color:#8b8f98;font-size:11px;white-space:nowrap}
    #mt-panel .mt-empty{padding:20px 16px;text-align:center;color:#8b8f98;font-size:12px}
    #mt-panel .mt-pfoot{display:block;padding:12px 16px;border-top:1px solid rgba(255,255,255,.06);
      color:#6ab0ff;text-decoration:none;font-size:12px}
    #mt-panel .mt-pfoot:hover{background:#1d1f25}
    #mt-panel .mt-badge{margin:0}
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
