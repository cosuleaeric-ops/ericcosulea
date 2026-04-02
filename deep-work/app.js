/**
 * elite deep work – timer + calendar deep work (local, fără login)
 * Când rulează în site: datele se salvează pe server prin endpoint-ul PHP.
 * Când deschizi direct fișierul: datele rămân în localStorage.
 */

const STORAGE_DAYS = "eliteDeepWork_days";   // { "YYYY-MM-DD": nr sesiuni }
const STORAGE_SETTINGS = "eliteDeepWork_settings";
const STORAGE_ACTIVE_TIMER = "eliteDeepWork_activeTimer"; // { endTimestamp, mode }
const STORAGE_PAUSED_TIMER = "eliteDeepWork_pausedTimer"; // { remainingSeconds, mode }
const EXTENSION_BLOCK_FLAG = "eliteDeepWork_timerActive"; // pentru extensia Chrome
const EXTENSION_BLOCK_MODE = "eliteDeepWork_timerMode";   // "work" = blochează social, "rest" = permite

const DEFAULT_WORK_MIN = 60;
const DEFAULT_REST_MIN = 5;
const APP_CONFIG = window.ELITE_DEEP_WORK_CONFIG || {};
const DATA_ENDPOINT = APP_CONFIG.dataEndpoint || "/api/data";
const WIP_ENDPOINT = APP_CONFIG.wipEndpoint || "/api/wip-post";

let useFileStorage = false;
let memory = { days: {}, settings: {}, activeTimer: null, pausedTimer: null };

// --- State
let mode = "work";
let remainingSeconds = 60 * 60;
let intervalId = null;
let workDurationMin = DEFAULT_WORK_MIN;
let restDurationMin = DEFAULT_REST_MIN;

// --- DOM
const timerDisplay = document.getElementById("timer-display");
const btnStart = document.getElementById("btn-start");
const tabs = document.querySelectorAll(".tab");
const calendarGrid = document.getElementById("calendar-grid");
const legendSquares = document.getElementById("legend-squares");
const userBadge = document.getElementById("user-badge");
const istoricModal = document.getElementById("istoric-modal");
const istoricList = document.getElementById("istoric-list");
const btnIstoric = document.getElementById("btn-istoric");
const istoricClose = document.getElementById("istoric-close");
const settingsModal = document.getElementById("settings-modal");
const btnSettings = document.getElementById("btn-settings");
const modalClose = document.getElementById("modal-close");
const workDurationInput = document.getElementById("work-duration");
const restDurationInput = document.getElementById("rest-duration");
const userNameInput = document.getElementById("user-name");
const wipApiKeyInput = document.getElementById("wip-api-key");
const btnReset = document.getElementById("btn-reset");
const btnExport = document.getElementById("btn-export");
const btnImport = document.getElementById("btn-import");
const inputImport = document.getElementById("input-import");

// --- Helpers
function pad(n) {
  return n < 10 ? "0" + n : String(n);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return pad(m) + ":" + pad(s);
}

function todayKey() {
  const d = new Date();
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

function loadDays() {
  if (useFileStorage) return memory.days || {};
  try {
    const raw = localStorage.getItem(STORAGE_DAYS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDays(days) {
  if (useFileStorage) {
    memory.days = days;
    try {
      localStorage.setItem(STORAGE_DAYS, JSON.stringify(days));
    } catch (_) {}
    postData();
    return;
  }
  try {
    localStorage.setItem(STORAGE_DAYS, JSON.stringify(days));
  } catch (_) {}
}

function postData() {
  if (!useFileStorage) return Promise.resolve();
  return fetch(DATA_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ days: memory.days, settings: memory.settings, activeTimer: memory.activeTimer, pausedTimer: memory.pausedTimer }),
  }).catch(() => {});
}

const LUNI_RO = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];
function formatDataRo(date) {
  return date.getDate() + " " + LUNI_RO[date.getMonth()] + " " + date.getFullYear();
}

function applySettings(s) {
  if (!s) return;
  workDurationMin = s.workMin ?? DEFAULT_WORK_MIN;
  restDurationMin = s.restMin ?? DEFAULT_REST_MIN;
  workDurationInput.value = workDurationMin;
  restDurationInput.value = restDurationMin;
  userNameInput.value = s.userName ?? "eric cosulea";
  userBadge.textContent = s.userName ?? "eric cosulea";
  wipApiKeyInput.value = s.wipApiKey ?? "";
}

function loadSettings() {
  if (useFileStorage) {
    applySettings(memory.settings);
    return;
  }
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS);
    if (!raw) return;
    const s = JSON.parse(raw);
    applySettings(s);
  } catch (_) {}
}

function saveSettings() {
  const userName = userNameInput.value.trim() || "eric cosulea";
  const settings = {
    workMin: Number(workDurationInput.value) || DEFAULT_WORK_MIN,
    restMin: Number(restDurationInput.value) || DEFAULT_REST_MIN,
    userName,
    wipApiKey: (wipApiKeyInput && wipApiKeyInput.value) ? wipApiKeyInput.value.trim() : "",
  };
  workDurationMin = settings.workMin;
  restDurationMin = settings.restMin;
  userBadge.textContent = userName;
  if (useFileStorage) {
    memory.settings = settings;
    return postData();
  }
  localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings));
  return Promise.resolve();
}

function getWipApiKey() {
  if (useFileStorage) return (memory.settings && memory.settings.wipApiKey) || "";
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS);
    const s = raw ? JSON.parse(raw) : {};
    return s.wipApiKey || "";
  } catch {
    return "";
  }
}

function exportData() {
  const days = loadDays();
  let settings = {};
  if (useFileStorage) {
    settings = memory.settings || {};
  } else {
    try {
      const raw = localStorage.getItem(STORAGE_SETTINGS);
      settings = raw ? JSON.parse(raw) : {};
    } catch (_) {}
  }
  const data = { days, settings };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "elite-deep-work-backup-" + todayKey() + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const importedDays = data.days || {};
      const importedSettings = data.settings || {};
      const currentDays = loadDays();
      const mergedDays = { ...currentDays };
      for (const key of Object.keys(importedDays)) {
        const a = (currentDays[key] || 0);
        const b = Number(importedDays[key]) || 0;
        mergedDays[key] = Math.max(a, b);
      }
      if (useFileStorage) {
        memory.days = mergedDays;
        memory.settings = importedSettings;
        postData();
      } else {
        localStorage.setItem(STORAGE_DAYS, JSON.stringify(mergedDays));
        if (Object.keys(importedSettings).length) {
          localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(importedSettings));
        }
      }
      if (Object.keys(importedSettings).length) applySettings(importedSettings);
      renderCalendar();
    } catch (_) {}
    if (inputImport) inputImport.value = "";
  };
  reader.readAsText(file);
}

function postToWip(body) {
  const apiKey = getWipApiKey();
  if (!apiKey) return;
  if (useFileStorage) {
    fetch(WIP_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, apiKey }),
    }).catch(() => {});
    return;
  }
  const url = "https://api.wip.co/v1/todos?api_key=" + encodeURIComponent(apiKey);
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  }).catch(() => {});
}

// --- Timer
function getDurationSeconds() {
  return mode === "work" ? workDurationMin * 60 : restDurationMin * 60;
}

function saveActiveTimer() {
  const endTimestamp = Date.now() + remainingSeconds * 1000;
  const payload = { endTimestamp, mode };
  if (useFileStorage) {
    memory.activeTimer = payload;
    postData();
    return;
  }
  try {
    localStorage.setItem(STORAGE_ACTIVE_TIMER, JSON.stringify(payload));
  } catch (_) {}
}

function setExtensionBlockFlag(active, currentMode) {
  try {
    if (active) {
      localStorage.setItem(EXTENSION_BLOCK_FLAG, "1");
      localStorage.setItem(EXTENSION_BLOCK_MODE, currentMode === "rest" ? "rest" : "work");
    } else {
      localStorage.removeItem(EXTENSION_BLOCK_FLAG);
      localStorage.removeItem(EXTENSION_BLOCK_MODE);
    }
    document.dispatchEvent(new CustomEvent("eliteDeepWorkTimerChange", { detail: { active, mode: active ? (currentMode === "rest" ? "rest" : "work") : null } }));
  } catch (_) {}
}

function clearActiveTimer() {
  if (useFileStorage) {
    memory.activeTimer = null;
    postData();
    return;
  }
  try {
    localStorage.removeItem(STORAGE_ACTIVE_TIMER);
  } catch (_) {}
}

function savePausedTimer() {
  const payload = { remainingSeconds, mode };
  if (useFileStorage) {
    memory.pausedTimer = payload;
    postData();
    return;
  }
  try {
    localStorage.setItem(STORAGE_PAUSED_TIMER, JSON.stringify(payload));
  } catch (_) {}
}

function clearPausedTimer() {
  if (useFileStorage) {
    memory.pausedTimer = null;
    postData();
    return;
  }
  try {
    localStorage.removeItem(STORAGE_PAUSED_TIMER);
  } catch (_) {}
}

function loadPausedTimer() {
  let data = null;
  if (useFileStorage) {
    data = memory.pausedTimer || null;
  } else {
    try {
      const raw = localStorage.getItem(STORAGE_PAUSED_TIMER);
      data = raw ? JSON.parse(raw) : null;
    } catch (_) {}
  }
  if (!data || !data.remainingSeconds || !data.mode) return false;
  remainingSeconds = data.remainingSeconds;
  mode = data.mode;
  tabs.forEach((t) => t.classList.remove("active"));
  const activeTab = document.querySelector(`.tab[data-mode="${mode}"]`);
  if (activeTab) activeTab.classList.add("active");
  timerDisplay.textContent = formatTime(remainingSeconds);
  updateTabTitle();
  return true;
}

function loadActiveTimer() {
  let data = null;
  if (useFileStorage) {
    data = memory.activeTimer || null;
  } else {
    try {
      const raw = localStorage.getItem(STORAGE_ACTIVE_TIMER);
      data = raw ? JSON.parse(raw) : null;
    } catch (_) {}
  }
  if (!data || !data.endTimestamp || !data.mode) return false;
  const now = Date.now();
  if (data.endTimestamp <= now) {
    clearActiveTimer();
    return false;
  }
  remainingSeconds = Math.ceil((data.endTimestamp - now) / 1000);
  mode = data.mode;
  tabs.forEach((t) => t.classList.remove("active"));
  const activeTab = document.querySelector(`.tab[data-mode="${mode}"]`);
  if (activeTab) activeTab.classList.add("active");
  timerDisplay.textContent = formatTime(remainingSeconds);
  updateTabTitle();
  btnStart.textContent = "stop";
  intervalId = setInterval(tick, 1000);
  setExtensionBlockFlag(true, mode);
  return true;
}

const TAB_TITLE_BASE = "elite deep work";
function updateTabTitle() {
  document.title = formatTime(remainingSeconds) + " – " + TAB_TITLE_BASE;
}

function resetDisplay() {
  remainingSeconds = getDurationSeconds();
  timerDisplay.textContent = formatTime(remainingSeconds);
  updateTabTitle();
}

function tick() {
  remainingSeconds--;
  timerDisplay.textContent = formatTime(remainingSeconds);
  updateTabTitle();
  if (remainingSeconds <= 0) {
    stopTimer();
    clearActiveTimer();
    if (mode === "work") {
      const days = loadDays();
      const key = todayKey();
      const sesiuni = (days[key] || 0) + 1;
      days[key] = sesiuni;
      saveDays(days);
      renderCalendar();
      const today = new Date();
      const shortMonth = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
      const dateStr = " - " + pad(today.getDate()) + " " + shortMonth[today.getMonth()] + " '" + String(today.getFullYear()).slice(-2);
      const body = workDurationMin + " mins deep work sesh " + sesiuni + dateStr + " #life";
      postToWip(body);
    }
    mode = mode === "work" ? "rest" : "work";
    document.querySelector(".tab.active").classList.remove("active");
    document.querySelector(`.tab[data-mode="${mode}"]`).classList.add("active");
    resetDisplay();
  }
}

function startTimer() {
  if (intervalId) return;
  clearPausedTimer();
  btnStart.textContent = "stop";
  intervalId = setInterval(tick, 1000);
  saveActiveTimer();
  setExtensionBlockFlag(true, mode);
}

function stopTimer() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  setExtensionBlockFlag(false);
  // Update activeTimer and pausedTimer atomically in a single request
  if (useFileStorage) {
    memory.activeTimer = null;
    memory.pausedTimer = { remainingSeconds, mode };
    postData();
  } else {
    try { localStorage.removeItem(STORAGE_ACTIVE_TIMER); } catch (_) {}
    try { localStorage.setItem(STORAGE_PAUSED_TIMER, JSON.stringify({ remainingSeconds, mode })); } catch (_) {}
  }
  btnStart.textContent = "start";
}

// --- Calendar: doar luna curentă; nivel = nr sesiuni în zi (0–4)
// 0 = gri, 1-4 = verde din ce in ce mai intens
function getLevel(sesiuni) {
  return Math.min(Number(sesiuni) || 0, 4);
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/** Zilele lunii curente (1 .. lastDay), cu sesiuni. Datele din luni trecute rămân în localStorage. */
function getCurrentMonthDays() {
  const days = loadDays();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = getDaysInMonth(year, month);
  const list = [];
  for (let day = 1; day <= lastDay; day++) {
    const d = new Date(year, month, day);
    const key = year + "-" + pad(month + 1) + "-" + pad(day);
    list.push({ key, sesiuni: days[key] || 0, date: d });
  }
  return list;
}

/** Zile de la 1 ale lunii curente până azi (pentru istoric). */
function getIstoricDays() {
  const days = loadDays();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const list = [];
  for (let d = new Date(first); d <= today; d.setDate(d.getDate() + 1)) {
    const key = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    const sesiuni = days[key] || 0;
    if (sesiuni > 0) {
      list.push({ key, sesiuni, date: new Date(d) });
    }
  }
  return list.reverse();
}

const CALENDAR_ROWS = 3;
function renderCalendar() {
  const list = getCurrentMonthDays();
  const cols = Math.ceil(list.length / CALENDAR_ROWS);
  calendarGrid.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
  calendarGrid.innerHTML = "";
  list.forEach(({ key, sesiuni }) => {
    const level = getLevel(sesiuni);
    const cell = document.createElement("div");
    cell.className = "calendar-cell";
    cell.setAttribute("data-level", level);
    cell.setAttribute("title", key + (sesiuni ? ` – ${sesiuni} sesiuni` : " – 0 sesiuni"));
    calendarGrid.appendChild(cell);
  });
}

function renderIstoric() {
  const list = getIstoricDays();
  istoricList.innerHTML = "";
  if (list.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Nu exista sesiuni inca.";
    istoricList.appendChild(li);
    return;
  }
  list.forEach(({ date, sesiuni }) => {
    const li = document.createElement("li");
    const cuv = sesiuni === 1 ? "sesiune" : "sesiuni";
    li.textContent = formatDataRo(date) + " – " + sesiuni + " " + cuv + " deep work";
    istoricList.appendChild(li);
  });
}

function renderLegend() {
  legendSquares.innerHTML = "";
  const legendLevels = [0, 1, 2, 3, 4];
  for (const level of legendLevels) {
    const cell = document.createElement("div");
    cell.className = "legend-cell";
    cell.setAttribute("data-level", level);
    legendSquares.appendChild(cell);
  }
}

// --- Event listeners
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (intervalId) return;
    mode = tab.getAttribute("data-mode");
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    resetDisplay();
  });
});

btnStart.addEventListener("click", () => {
  if (intervalId) stopTimer();
  else startTimer();
});

if (btnReset) {
  btnReset.addEventListener("click", () => {
    stopTimer();
    clearActiveTimer();
    clearPausedTimer();
    mode = "work";
    tabs.forEach((t) => t.classList.remove("active"));
    const workTab = document.querySelector('.tab[data-mode="work"]');
    if (workTab) workTab.classList.add("active");
    resetDisplay();
  });
}

btnIstoric.addEventListener("click", () => {
  renderIstoric();
  istoricModal.showModal();
});
istoricClose.addEventListener("click", () => istoricModal.close());
istoricModal.addEventListener("cancel", () => istoricModal.close());

btnSettings.addEventListener("click", () => settingsModal.showModal());
modalClose.addEventListener("click", () => {
  Promise.resolve(saveSettings()).then(() => settingsModal.close());
});
settingsModal.addEventListener("cancel", () => {
  Promise.resolve(saveSettings()).then(() => settingsModal.close());
});

if (btnExport) btnExport.addEventListener("click", exportData);
if (btnImport && inputImport) {
  btnImport.addEventListener("click", () => inputImport.click());
  inputImport.addEventListener("change", () => {
    const file = inputImport.files && inputImport.files[0];
    importData(file);
  });
}

// --- Init: server → localStorage fallback
async function init() {
  try {
    const r = await fetch(DATA_ENDPOINT);
    if (r.ok) {
      const data = await r.json();
      memory.days = data.days || {};
      memory.settings = data.settings || {};
      memory.activeTimer = data.activeTimer ?? null;
      memory.pausedTimer = data.pausedTimer ?? null;
      useFileStorage = true;
      // Backup: dacă serverul nu are zile, încarcă din localStorage și sincronizează
      try {
        const raw = localStorage.getItem(STORAGE_DAYS);
        if (raw) {
          const localDays = JSON.parse(raw);
          const merged = { ...memory.days };
          for (const key of Object.keys(localDays)) {
            const a = (merged[key] || 0);
            const b = Number(localDays[key]) || 0;
            merged[key] = Math.max(a, b);
          }
          const hasHigherCount = Object.keys(merged).some(k => (merged[k] || 0) > (memory.days[k] || 0));
          if (hasHigherCount) {
            memory.days = merged;
            postData();
          }
        }
      } catch (_) {}
      try {
        const rawSettings = localStorage.getItem(STORAGE_SETTINGS);
        if (rawSettings && (!memory.settings || Object.keys(memory.settings).length === 0)) {
          const localSettings = JSON.parse(rawSettings);
          if (localSettings && typeof localSettings === "object") {
            memory.settings = localSettings;
            postData();
          }
        }
      } catch (_) {}
    }
  } catch (_) {
    // fallback-ul rămâne localStorage dacă endpoint-ul serverului nu este disponibil
  }
  loadSettings();
  renderLegend();
  renderCalendar();
  if (!loadActiveTimer()) {
    if (!loadPausedTimer()) {
      resetDisplay();
    }
  }
}
init();
