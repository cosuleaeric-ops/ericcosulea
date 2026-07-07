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
  function fmtDT(iso) {
    return new Date(iso).toLocaleString("ro-RO", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  function hostOf(url) {
    try {
      return new URL(url).host;
    } catch {
      return url || "";
    }
  }

  const SEND_WORD = /\b(send|trimite|enviar|envoyer|senden|invia|verzenden|wy[sś]lij|отправить)\b/i;
  const SHORTCUT = /(ctrl|⌘|cmd)[\s+-]*(enter|↵)/i;

  // ── Starea de la backend ──────────────────────────────────────────────────
  let STATUS = [];

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

  // Raportează backendului că PROPRIETARUL vede acum emailul (throttle 20s/email),
  // ca deschiderile Gmail declanșate în timp ce te uiți tu să nu se numere ca fiind ale destinatarului.
  const seenPing = new Map();
  function pingOwnerSeen(id) {
    if (!CONFIG.secret || !id) return;
    const now = Date.now();
    if (now - (seenPing.get(id) || 0) < 20000) return;
    seenPing.set(id, now);
    fetch(`${CONFIG.baseUrl}/api/track/seen`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-track-secret": CONFIG.secret },
      body: JSON.stringify({ id }),
      keepalive: true,
    }).catch(() => {});
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

  // Indicator inline în emailul DESCHIS — lângă steluță/emoji/reply/more, pe mesajul nostru.
  const REPLY_WORD = /\b(reply|răspunde|raspunde|responder|répondre|antworten|rispondi)\b/i;
  const FORWARD_WORD = /\b(forward|redirect|înaint|inaint|transfé|weiterleit)/i;
  function decorateOpenMessages() {
    // Potrivire EXACTĂ după thread ID; subiectul e doar rezervă.
    const tid = readThreadId();
    let st = tid ? STATUS.find((e) => e.threadId && e.threadId === tid) : null;
    if (!st) {
      const subjEl = document.querySelector("h2.hP, .hP");
      const subject = subjEl ? (subjEl.textContent || "").trim() : "";
      if (subject) st = findStatus(subject, "");
    }
    if (!st) return;
    const acct = (st.account || "").toLowerCase();
    // Raportăm „proprietarul vede" DOAR când ești în contul EXPEDITOR (propria copie din Sent).
    // Dacă deschizi în alt cont (destinatarul), NU raportăm → deschiderea aia se numără.
    const cur = (readAccount() || "").toLowerCase();
    if (cur && acct && cur === acct) pingOwnerSeen(st.id);

    // Butonul de Reply e un <button> NATIV (fără role="button") — includem ambele.
    document.querySelectorAll('button[aria-label], [role="button"]').forEach((rep) => {
      const label = `${rep.getAttribute("aria-label") || ""} ${rep.getAttribute("data-tooltip") || ""}`;
      if (!REPLY_WORD.test(label)) return;
      const toolbar = rep.parentElement;
      if (!toolbar || toolbar.querySelector(".mt-msg")) return;
      // Excludem bara de acțiuni de jos (are buton Forward alături) — vrem antetul mesajului.
      const near = [...toolbar.querySelectorAll("[aria-label],[data-tooltip]")].map(
        (n) => `${n.getAttribute("aria-label") || ""} ${n.getAttribute("data-tooltip") || ""}`,
      );
      if (near.some((b) => FORWARD_WORD.test(b))) return;

      // Expeditorul acestui mesaj = primul [email] urcând în sus (fără a depinde de clase Gmail).
      let node = rep;
      let senderEmail = "";
      for (let i = 0; i < 12 && node; i++) {
        const em = node.querySelector && node.querySelector("[email]");
        if (em) {
          senderEmail = (em.getAttribute("email") || "").toLowerCase();
          break;
        }
        node = node.parentElement;
      }
      // Mesaj primit (expeditor cunoscut și diferit de contul nostru) → fără indicator.
      if (acct && senderEmail && senderEmail !== acct) return;

      const opened = st.opens > 0;
      const ind = document.createElement("span");
      ind.className = "mt-msg" + (opened ? " mt-open" : "");
      ind.textContent = "✓✓";
      ind.title = opened
        ? `Citit · ${st.opens} deschideri — click pentru detalii`
        : "Trimis · necitit — click pentru detalii";
      ind.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openEventsPopup(st.id, st.subject, ind);
      });
      // Aliniere exactă: copiem înălțimea + vertical-align de la butonul Reply de lângă.
      const h = rep.offsetHeight;
      if (h) {
        ind.style.height = `${h}px`;
        ind.style.verticalAlign = getComputedStyle(rep).verticalAlign;
      }
      toolbar.insertBefore(ind, rep);
    });
  }

  let renderScheduled = false;
  function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      // Fiecare izolat: dacă una aruncă (DOM Gmail schimbat), celelalte tot rulează.
      for (const fn of [injectTopWidget, renderIndicators, decorateComposes, decorateOpenMessages]) {
        try {
          fn();
        } catch {
          /* ignorăm, nu stricăm pagina */
        }
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
    return [...scope.querySelectorAll('button, [role="button"]')].find((b) => {
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
      // Inserăm DUPĂ grupul butonului Send (nu în interiorul lui), altfel hover-ul
      // albastru al butonului Send apare în spatele pill-ului.
      const group = send.parentElement;
      if (group.parentElement) group.parentElement.insertBefore(pill, group.nextSibling);
      else group.appendChild(pill);
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

  // ── Popup cu istoricul deschiderilor/click-urilor (la click pe indicator) ──
  function openEventsPopup(emailId, subject, anchor) {
    document.getElementById("mt-evpop")?.remove();
    const pop = document.createElement("div");
    pop.id = "mt-evpop";
    const rect = anchor.getBoundingClientRect();
    pop.style.top = `${Math.round(rect.bottom + 8)}px`;
    pop.style.left = `${Math.round(Math.min(rect.left, window.innerWidth - 340))}px`;
    pop.innerHTML =
      `<div class="mt-ev-head">${esc(subject || "Detalii")}</div>` +
      `<div class="mt-ev-body">se încarcă…</div>`;
    pop.addEventListener("click", (e) => e.stopPropagation());
    document.body.appendChild(pop);
    setTimeout(() => {
      const close = (e) => {
        if (!pop.isConnected) return;
        if (!pop.contains(e.target)) pop.remove();
        else document.addEventListener("click", close, { once: true });
      };
      document.addEventListener("click", close, { once: true });
    }, 0);

    fetch(`${CONFIG.baseUrl}/api/track/events?id=${encodeURIComponent(emailId)}`, {
      headers: { "x-track-secret": CONFIG.secret },
    })
      .then((r) => r.json())
      .then((d) => {
        const body = pop.querySelector(".mt-ev-body");
        if (!body) return;
        // Doar evenimentele REALE — prefetch-urile și cele proprii nu se afișează deloc.
        const evs = (d.events || []).filter((e) => !e.isBot);
        if (!evs.length) {
          body.innerHTML = `<div class="mt-ev-empty">Încă nicio deschidere reală.</div>`;
          return;
        }
        body.innerHTML = evs
          .map((e) => {
            if (e.type === "click") {
              return `<div class="mt-ev-row"><span class="mt-ev-tag mt-ev-click">click</span><span class="mt-ev-when">${fmtDT(e.createdAt)}</span><span class="mt-ev-link" title="${esc(e.linkUrl || "")}">→ ${esc(hostOf(e.linkUrl))}</span></div>`;
            }
            return `<div class="mt-ev-row"><span class="mt-ev-tag mt-ev-open">deschis</span><span class="mt-ev-when">${fmtDT(e.createdAt)}</span></div>`;
          })
          .join("");
      })
      .catch(() => {
        const body = pop.querySelector(".mt-ev-body");
        if (body) body.textContent = "eroare la încărcare";
      });
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
    // Butonul Send poate fi <div role=button> SAU <button> nativ — le prindem pe ambele.
    const btn = el.closest?.('button, [role="button"]');
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
  // ID-ul threadului Gmail — identificator EXACT (din URL când o conversație e deschisă).
  // Îl folosim ca să potrivim emailul fără să ne bazăm pe subiect.
  function readThreadId() {
    const m = (location.hash || "").match(/[A-Za-z0-9_-]{22,}/);
    if (m) return m[0];
    const el = document.querySelector("[data-thread-perm-id]");
    return el ? el.getAttribute("data-thread-perm-id") : null;
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
          threadId: readThreadId(),
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
    .mt-msg{display:inline-flex;align-items:center;justify-content:center;height:24px;margin:0 4px;
      padding:0 2px;font:800 13px/1 system-ui,sans-serif;letter-spacing:-1px;color:#9aa0a6;
      vertical-align:middle;cursor:pointer;border-radius:6px}
    .mt-msg:hover{background:rgba(0,0,0,.06)}
    .mt-msg.mt-open{color:#1a9d4b}
    #mt-evpop{position:fixed;z-index:100000;width:320px;max-height:60vh;overflow:auto;
      background:#15161a;color:#ededf0;border:1px solid rgba(255,255,255,.12);border-radius:12px;
      box-shadow:0 12px 40px rgba(0,0,0,.5);font:400 12px/1.4 system-ui,sans-serif}
    #mt-evpop .mt-ev-head{padding:12px 14px;font-weight:700;font-size:13px;
      border-bottom:1px solid rgba(255,255,255,.07);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #mt-evpop .mt-ev-body{padding:6px 8px 10px}
    #mt-evpop .mt-ev-row{display:flex;align-items:center;gap:8px;padding:6px;white-space:nowrap}
    #mt-evpop .mt-ev-tag{font-size:10px;font-weight:700;text-transform:uppercase;padding:2px 6px;
      border-radius:5px;flex:0 0 auto}
    #mt-evpop .mt-ev-open{background:rgba(77,159,255,.16);color:#6ab0ff}
    #mt-evpop .mt-ev-click{background:rgba(74,222,128,.16);color:#4ade80}
    #mt-evpop .mt-ev-when{color:#b7bbc2;font-variant-numeric:tabular-nums;flex:0 0 auto}
    #mt-evpop .mt-ev-link{color:#8b8f98;overflow:hidden;text-overflow:ellipsis}
    #mt-evpop .mt-ev-empty{padding:16px;text-align:center;color:#8b8f98}
    .mt-pill{position:relative;z-index:1;display:inline-flex;align-items:center;gap:5px;
      margin-left:10px;padding:5px 10px;border-radius:16px;font:600 12px/1 system-ui,sans-serif;
      cursor:pointer;user-select:none;vertical-align:middle}
    .mt-pill.mt-on{background:#e6f4ea !important;color:#1a9d4b !important}
    .mt-pill.mt-on:hover{background:#d7ecdd !important}
    .mt-pill.mt-pill-off{background:#f1f3f4 !important;color:#80868b !important}
    .mt-pill.mt-pill-off:hover{background:#e6e8ea !important}
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
