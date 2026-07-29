const STORAGE_KEY = "eliteDeux.v1";
const LOCALE = "ro-RO";
const COLOR_ORDER = ["none", "yellow", "blue", "green", "pink", "orange"];
const APP_CONFIG = window.ELITE_DEUX_CONFIG || {};
const SERVER_STATE_URL = typeof APP_CONFIG.stateUrl === "string" ? APP_CONFIG.stateUrl : "";
const CSRF_TOKEN = typeof APP_CONFIG.csrfToken === "string" ? APP_CONFIG.csrfToken : "";
const HAS_REMOTE_STORAGE = Boolean(SERVER_STATE_URL);

const THEME_PALETTE = {
  pink: { theme: "#d91f7f", soft: "rgba(217, 31, 127, 0.14)" },
  red: { theme: "#d32525", soft: "rgba(211, 37, 37, 0.14)" },
  green: { theme: "#1f8e4d", soft: "rgba(31, 142, 77, 0.14)" },
  blue: { theme: "#1269ff", soft: "rgba(18, 105, 255, 0.14)" },
  black: { theme: "#111111", soft: "rgba(17, 17, 17, 0.15)" },
};

const SETTINGS_DEFAULTS = {
  hideCompleted: false,
  theme: "pink",
  columns: 5,
  textSize: "m",
  spacing: "m",
  bulletStyle: "circle",
  startOn: "today",
  showLines: true,
  display: "light",
  celebrations: true,
  listsCollapsed: false,
  listsHeight: 0, // 0 = auto (20vh); >0 = înălțime setată manual (px)
  activeListId: null, // tabul de listă deschis
};

const TEXT_SIZE_MAP = {
  s: "14px",
  m: "16px",
  l: "18px",
};

const SPACING_MAP = {
  s: { gap: "3px", paddingY: "5px" },
  m: { gap: "6px", paddingY: "8px" },
  l: { gap: "10px", paddingY: "11px" },
};

const state = {
  dayOffset: 0,
  tasksByDate: {},
  lists: [], // liste permanente (nu se rulează zilnic): [{id, name, items:[{id,text,done}]}]
  settings: { ...SETTINGS_DEFAULTS },
  ui: {
    prefsOpen: false,
  },
  lastSeenDate: formatDateKey(new Date()),
};

const weekGrid = document.getElementById("weekGrid");
const taskTemplate = document.getElementById("taskTemplate");

const prevWeekBtn = document.getElementById("prevWeek");
const nextWeekBtn = document.getElementById("nextWeek");
const todayBtn = document.getElementById("todayBtn");
const prefsToggleBtn = document.getElementById("prefsToggle");
const prefsPanel = document.getElementById("prefsPanel");
const prefsCloseBtn = document.getElementById("prefsClose");
const prefsOverlay = document.getElementById("prefsOverlay");
const hideCompletedInput = document.getElementById("hideCompleted");
const showLinesInput = document.getElementById("showLines");
const celebrationsInput = document.getElementById("celebrations");
const segmentedGroups = Array.from(document.querySelectorAll(".segmented[data-setting]"));
const themeSwatches = Array.from(document.querySelectorAll(".swatch[data-theme]"));
const storageStatus = document.getElementById("storageStatus");
const exportDataBtn = document.getElementById("exportData");
const importDataBtn = document.getElementById("importData");
const importFileInput = document.getElementById("importFile");
const trashZone = document.getElementById("trashZone");
const listsSection = document.getElementById("listsSection");
const listsBody = document.getElementById("listsBody");
const listsGrid = document.getElementById("listsGrid");
const listsToggle = document.getElementById("listsToggle");
const listsTabs = document.getElementById("listsTabs");
const addListBtn = document.getElementById("addListBtn");
const listsResize = document.getElementById("listsResize");
let remoteSaveTimer = null;
let remoteInitSucceeded = false;
// Ultima versiune (updated_at) cunoscută de pe server — poll-ul o compară ca să
// evite descărcarea stării complete când nu s-a schimbat nimic.
let remoteVersion = null;

listsToggle?.addEventListener("click", () => {
  state.settings.listsCollapsed = !state.settings.listsCollapsed;
  applyListsCollapsed();
  saveState();
});

addListBtn?.addEventListener("click", () => addList());

// Mâner de redimensionare: tragi în jos → secțiune mai înaltă, în sus → mai scundă.
// Reglează --lists-h (înălțimea minimă a coloanelor de listă); se salvează.
const LISTS_MIN_H = 60;
const listsMaxH = () => Math.round(window.innerHeight * 0.8); // lasă loc zilelor
const listsDefaultH = () => Math.round(window.innerHeight * 0.3); // 30vh, fallback-ul CSS
const listsCurrentH = () =>
  listsSection ? Math.round(listsSection.getBoundingClientRect().height) : listsDefaultH();
if (listsResize) {
  let dragging = false;
  let startY = 0;
  let startH = 0;
  let curH = 0;

  const onMove = (event) => {
    if (!dragging) return;
    // Mânerul e în capul secțiunii: tragi în SUS → mai înaltă, în JOS → mai scundă.
    curH = Math.max(LISTS_MIN_H, Math.min(listsMaxH(), startH + (startY - event.clientY)));
    document.documentElement.style.setProperty("--lists-h", curH + "px");
    event.preventDefault();
  };

  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("lists-resizing");
    // Ascultătorii pe window (nu pe mâner): drag-ul merge oriunde ai duce
    // cursorul, fără să depindă de pointer capture.
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onEnd);
    window.removeEventListener("pointercancel", onEnd);
    state.settings.listsHeight = curH;
    saveState();
  };

  listsResize.addEventListener("pointerdown", (event) => {
    dragging = true;
    startY = event.clientY;
    startH = listsCurrentH(); // înălțimea reală a secțiunii acum
    curH = startH;
    document.body.classList.add("lists-resizing");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    event.preventDefault();
  });

  // Accesibilitate: săgeți sus/jos (Shift = pas mai mare).
  listsResize.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const cur = listsCurrentH();
    const step = (event.shiftKey ? 40 : 16) * (event.key === "ArrowUp" ? 1 : -1);
    state.settings.listsHeight = Math.max(LISTS_MIN_H, Math.min(listsMaxH(), cur + step));
    applyListsHeight();
    saveState();
  });
}

prevWeekBtn.addEventListener("click", () => {
  state.dayOffset -= 1;
  renderWeek();
});

nextWeekBtn.addEventListener("click", () => {
  state.dayOffset += 1;
  renderWeek();
});

todayBtn?.addEventListener("click", () => {
  if (state.dayOffset === 0) {
    return;
  }

  state.dayOffset = 0;
  renderWeek();
});

prefsToggleBtn.addEventListener("click", () => {
  setPreferencesPanel(!state.ui.prefsOpen);
});

prefsCloseBtn.addEventListener("click", () => {
  setPreferencesPanel(false);
});

prefsOverlay.addEventListener("click", () => {
  setPreferencesPanel(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.ui.prefsOpen) {
    setPreferencesPanel(false);
    return;
  }

  if (
    event.key.toLowerCase() === "n" &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !state.ui.prefsOpen &&
    !isTypingTarget(event.target)
  ) {
    event.preventDefault();
    focusTodayComposer();
  }
});

hideCompletedInput.addEventListener("change", (event) => {
  state.settings.hideCompleted = event.target.checked;
  persistAndRender(true);
});

showLinesInput.addEventListener("change", (event) => {
  state.settings.showLines = event.target.checked;
  persistAndRender();
});

celebrationsInput.addEventListener("change", (event) => {
  state.settings.celebrations = event.target.checked;
  saveState();
});

segmentedGroups.forEach((group) => {
  const key = group.dataset.setting;

  group.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (!button || !key) {
      return;
    }

    const value = button.dataset.value;
    updateSegmentedSetting(key, value);
  });
});

themeSwatches.forEach((swatch) => {
  swatch.addEventListener("click", () => {
    const theme = swatch.dataset.theme;
    if (!theme || !THEME_PALETTE[theme]) {
      return;
    }

    state.settings.theme = theme;
    applyVisualSettings();
    saveState();
  });
});

exportDataBtn?.addEventListener("click", exportStateToFile);
importDataBtn?.addEventListener("click", () => {
  importFileInput?.click();
});

importFileInput?.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  await importStateFromFile(file);
  event.target.value = "";
});

void init();

async function init() {
  // Paint imediat din localStorage — nu aștepta serverul.
  const localSnapshot = readLocalSnapshot();
  if (localSnapshot) {
    applyStateSnapshot(localSnapshot);
    runDailyRollover({ save: false });
    normalizeAllLists({ save: false });
  }
  syncSettingsUI();
  applyVisualSettings();
  renderWeek();
  renderLists();

  document.addEventListener("dragover", onGlobalDragOver);
  document.addEventListener("drop", onGlobalDrop);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && HAS_REMOTE_STORAGE && remoteInitSucceeded) {
      if (remoteSaveTimer) {
        window.clearTimeout(remoteSaveTimer);
        remoteSaveTimer = null;
      }
      pushStateToRemote(buildStateSnapshot(), { keepalive: true }).catch(() => {});
    }
  });

  await reconcileWithServer();
  startRemotePolling();
}

// Preia modificările făcute în altă parte (ex: butonul Done din topbar-ul macOS).
// Poll-ul cere ÎNTÂI doar versiunea (zeci de octeți) și descarcă starea completă
// (~24 kB) doar dacă s-a schimbat ceva — altfel un tab lăsat deschis consuma
// singur ~0,7 GB de egress pe zi.
function startRemotePolling() {
  if (!HAS_REMOTE_STORAGE) {
    return;
  }

  window.setInterval(async () => {
    if (document.visibilityState !== "visible" || !remoteInitSucceeded || remoteSaveTimer) {
      return;
    }

    // Nu suprascrie cât timp userul scrie sau trage un task.
    const active = document.activeElement;
    if (active && (active.isContentEditable || active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
      return;
    }
    if (document.querySelector(".task-item.dragging")) {
      return;
    }

    // Verificare ieftină: dacă versiunea de pe server e aceeași, nu descărcăm nimic.
    try {
      const version = await fetchRemoteVersion();
      if (remoteVersion !== null && version === remoteVersion) {
        return;
      }
    } catch {
      return;
    }

    const before = JSON.stringify(state.tasksByDate);
    let remote;
    try {
      remote = await fetchRemoteSnapshot();
    } catch {
      return;
    }

    // Dacă între timp s-a schimbat ceva local, câștigă localul.
    if (!remote || remoteSaveTimer || JSON.stringify(state.tasksByDate) !== before) {
      return;
    }

    if (JSON.stringify(remote.tasksByDate) === before) {
      return;
    }

    state.tasksByDate = remote.tasksByDate;
    persistLocalSnapshot();
    renderWeek();
  }, 3000);
}

function countTasksInSnapshot(snapshot) {
  if (!snapshot) return 0;
  let n = 0;
  // format nou: tasksByDate
  if (snapshot.tasksByDate) {
    for (const tasks of Object.values(snapshot.tasksByDate))
      n += Array.isArray(tasks) ? tasks.length : 0;
  }
  // format vechi: columns
  for (const col of snapshot.columns ?? [])
    for (const day of col?.days ?? [])
      n += (day?.tasks ?? []).length;
  return n;
}

async function reconcileWithServer() {
  setStorageStatus(HAS_REMOTE_STORAGE ? "Connecting to server..." : "Storage: local only");

  if (!HAS_REMOTE_STORAGE) {
    persistLocalSnapshot();
    return;
  }

  try {
    const remoteSnapshot = await fetchRemoteSnapshot();
    // Recitim localul ACUM: poate userul a editat cât timp am așteptat serverul.
    const localSnapshot = readLocalSnapshot();
    const remoteTasks = countTasksInSnapshot(remoteSnapshot);
    const localTasks  = countTasksInSnapshot(localSnapshot);

    if (remoteTasks > 0 && localTasks > 0) {
      // Ambele au date → câștigă cel mai recent după savedAt
      if ((localSnapshot.savedAt || 0) > (remoteSnapshot.savedAt || 0)) {
        // Localul e mai nou (ex: salvarea pe server a eșuat ieri) → pushăm localul
        await pushStateToRemote(buildStateSnapshot());
      } else {
        applyRemoteAndRender(remoteSnapshot);
      }
    } else if (remoteTasks > 0) {
      // Doar serverul are date → aplicăm serverul
      applyRemoteAndRender(remoteSnapshot);
    } else if (localTasks > 0) {
      // Serverul e gol dar localul are date → pushăm localul pe server
      await pushStateToRemote(buildStateSnapshot());
    } else {
      // Ambele goale → nimic de făcut
    }

    persistLocalSnapshot();
    remoteInitSucceeded = true;
    setStorageStatus("Storage: synced with server");
  } catch (error) {
    console.warn("EliteDeux remote sync unavailable", error);
    persistLocalSnapshot();
    setStorageStatus("Server unavailable. Working from local backup.");
  }
}

function applyRemoteAndRender(snapshot) {
  applyStateSnapshot(snapshot);
  runDailyRollover({ save: false });
  normalizeAllLists({ save: false });
  syncSettingsUI();
  applyVisualSettings();
  renderWeek();
  renderLists();
}

function readLocalSnapshot() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return sanitizeStateSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}

function applyStateSnapshot(snapshot) {
  state.dayOffset = 0;
  state.tasksByDate = snapshot.tasksByDate;
  state.lists = snapshot.lists;
  state.settings = snapshot.settings;
  state.lastSeenDate = snapshot.lastSeenDate;
}

function sanitizeListItem(item) {
  return {
    id: item?.id || uid(),
    text: String(item?.text || ""),
    done: Boolean(item?.done),
  };
}

function sanitizeList(list) {
  return {
    id: list?.id || uid(),
    name: String(list?.name || "Listă"),
    items: (Array.isArray(list?.items) ? list.items : []).map(sanitizeListItem),
  };
}

function sanitizeLists(source) {
  return Array.isArray(source) ? source.map(sanitizeList) : [];
}

function sanitizeStateSnapshot(source = {}) {
  const nextByDate = {};
  Object.entries(source.tasksByDate || {}).forEach(([dateKey, tasks]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return;
    }

    const cleanTasks = (Array.isArray(tasks) ? tasks : []).map((task) => sanitizeTask(task));
    nextByDate[dateKey] = reorderCompletedToBottom(cleanTasks);
  });

  return {
    tasksByDate: nextByDate,
    lists: sanitizeLists(source.lists),
    settings: sanitizeSettings(source.settings || {}),
    lastSeenDate: parseDateKey(source.lastSeenDate) ? source.lastSeenDate : formatDateKey(new Date()),
    savedAt: typeof source.savedAt === "number" ? source.savedAt : 0,
  };
}

function buildStateSnapshot() {
  return {
    tasksByDate: state.tasksByDate,
    lists: state.lists,
    settings: state.settings,
    lastSeenDate: state.lastSeenDate,
    savedAt: Date.now(),
  };
}

function sanitizeSettings(source) {
  const columns = Number(source.columns);
  const settings = {
    ...SETTINGS_DEFAULTS,
    ...source,
    columns: [1, 3, 5, 7].includes(columns) ? columns : SETTINGS_DEFAULTS.columns,
  };

  if (!TEXT_SIZE_MAP[settings.textSize]) {
    settings.textSize = SETTINGS_DEFAULTS.textSize;
  }

  if (!SPACING_MAP[settings.spacing]) {
    settings.spacing = SETTINGS_DEFAULTS.spacing;
  }

  if (!["circle", "square", "none"].includes(settings.bulletStyle)) {
    settings.bulletStyle = SETTINGS_DEFAULTS.bulletStyle;
  }

  if (!["today", "yesterday"].includes(settings.startOn)) {
    settings.startOn = SETTINGS_DEFAULTS.startOn;
  }

  if (!["light", "dark"].includes(settings.display)) {
    settings.display = SETTINGS_DEFAULTS.display;
  }

  if (!THEME_PALETTE[settings.theme]) {
    settings.theme = SETTINGS_DEFAULTS.theme;
  }

  settings.hideCompleted = Boolean(settings.hideCompleted);
  settings.showLines = Boolean(settings.showLines);
  settings.celebrations = Boolean(settings.celebrations);
  settings.listsCollapsed = Boolean(settings.listsCollapsed);

  const lh = Number(settings.listsHeight);
  settings.listsHeight = Number.isFinite(lh) && lh > 0 ? Math.round(lh) : 0;

  settings.activeListId = typeof settings.activeListId === "string" ? settings.activeListId : null;

  return settings;
}

function persistLocalSnapshot() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(buildStateSnapshot()),
  );
}

function saveState(options = {}) {
  persistLocalSnapshot();

  if (!HAS_REMOTE_STORAGE || options.skipRemote) {
    setStorageStatus("Storage: local only");
    return;
  }

  scheduleRemoteSave();
}

function scheduleRemoteSave() {
  if (remoteSaveTimer) {
    window.clearTimeout(remoteSaveTimer);
  }

  setStorageStatus("Saving to server...");
  remoteSaveTimer = window.setTimeout(async () => {
    remoteSaveTimer = null;
    try {
      await pushStateToRemote(buildStateSnapshot());
      setStorageStatus("Storage: synced with server");
    } catch (error) {
      console.warn("EliteDeux remote save failed", error);
      setStorageStatus("Server unavailable. Local backup preserved.");
    }
  }, 250);
}

// Doar marcajul de timp al stării de pe server (zeci de octeți).
async function fetchRemoteVersion() {
  const response = await fetch(`${SERVER_STATE_URL}?only=version`, {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Remote version failed (${response.status})`);
  }

  const payload = await response.json();
  return typeof payload?.version === "number" ? payload.version : 0;
}

async function fetchRemoteSnapshot() {
  const response = await fetch(SERVER_STATE_URL, {
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Remote load failed (${response.status})`);
  }

  const payload = await response.json();
  if (typeof payload?.version === "number") {
    remoteVersion = payload.version;
  }
  if (!payload?.state) {
    return null;
  }

  return sanitizeStateSnapshot(payload.state);
}

async function pushStateToRemote(snapshot, fetchOptions = {}) {
  const response = await fetch(SERVER_STATE_URL, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-CSRF-Token": CSRF_TOKEN,
    },
    body: JSON.stringify({ state: snapshot }),
    ...fetchOptions,
  });

  if (!response.ok) {
    throw new Error(`Remote save failed (${response.status})`);
  }

  // Reținem versiunea rezultată, ca poll-ul să nu creadă că e o schimbare străină
  // și să descarce inutil starea completă înapoi.
  try {
    const payload = await response.json();
    if (typeof payload?.version === "number") {
      remoteVersion = payload.version;
    }
  } catch {
    /* raspuns fara JSON (ex. keepalive) — ignoram */
  }
}

function setStorageStatus(message) {
  if (storageStatus) {
    storageStatus.textContent = message;
  }
}

async function exportStateToFile() {
  const json = JSON.stringify(buildStateSnapshot(), null, 2);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(json);
      setStorageStatus("Backup copied to clipboard.");
    }
  } catch (error) {
    console.warn("EliteDeux clipboard export unavailable", error);
  }

  const blob = new Blob([json], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `elite-deux-backup-${formatDateKey(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importStateFromFile(file) {
  const text = await file.text();
  const snapshot = sanitizeStateSnapshot(JSON.parse(text));
  applyStateSnapshot(snapshot);
  persistAndRender();
  setStorageStatus(HAS_REMOTE_STORAGE ? "Imported. Syncing to server..." : "Imported into local storage.");
}

function runDailyRollover(options = {}) {
  const today = startOfDay(new Date());
  const parsedLastSeen = parseDateKey(state.lastSeenDate);
  let cursor = parsedLastSeen && parsedLastSeen < today ? parsedLastSeen : today;

  while (cursor < today) {
    const fromKey = formatDateKey(cursor);
    const toDate = addDays(cursor, 1);
    const toKey = formatDateKey(toDate);

    const tasks = state.tasksByDate[fromKey] || [];
    const incomplete = tasks.filter((task) => !task.completed);

    if (incomplete.length > 0) {
      const existing = state.tasksByDate[toKey] || [];
      const moved = incomplete.map((task) => ({
        ...task,
        id: uid(),
      }));

      state.tasksByDate[toKey] = [...moved, ...existing];
      state.tasksByDate[fromKey] = tasks.filter((task) => task.completed);
    }

    cursor = toDate;
  }

  state.lastSeenDate = formatDateKey(today);
  if (options.save !== false) {
    saveState();
  }
}

function normalizeAllLists(options = {}) {
  let changed = false;
  const nextByDate = {};

  Object.entries(state.tasksByDate).forEach(([dateKey, tasks]) => {
    const cleanTasks = (Array.isArray(tasks) ? tasks : []).map((task) => sanitizeTask(task));
    const normalized = reorderCompletedToBottom(cleanTasks);
    nextByDate[dateKey] = normalized;

    if (!changed && JSON.stringify(normalized) !== JSON.stringify(tasks)) {
      changed = true;
    }
  });

  state.tasksByDate = nextByDate;
  if (changed && options.save !== false) {
    saveState();
  }
}

function renderWeek() {
  weekGrid.innerHTML = "";

  const baseDate = startOfDay(new Date());
  const shiftedBase = state.settings.startOn === "yesterday" ? addDays(baseDate, -1) : baseDate;
  const start = startOfDay(addDays(shiftedBase, state.dayOffset));

  for (let index = 0; index < state.settings.columns; index += 1) {
    const date = addDays(start, index);
    const key = formatDateKey(date);
    const column = renderDayColumn(date, key);
    weekGrid.appendChild(column);
  }

  if (todayBtn) {
    todayBtn.disabled = state.dayOffset === 0;
  }
}

// Re-randează doar coloana afectată — nu tot grid-ul (evită flicker + pierderea inputului).
function renderColumn(dateKey) {
  const column = weekGrid.querySelector(`.day-column[data-date-key="${dateKey}"]`);
  const date = parseDateKey(dateKey);
  if (!column || !date) {
    renderWeek();
    return;
  }

  const existingInput = column.querySelector(".composer-input");
  const draft = existingInput ? existingInput.value : null;
  const hadFocus = existingInput && document.activeElement === existingInput;

  const fresh = renderDayColumn(date, dateKey);
  column.replaceWith(fresh);

  if (draft !== null) {
    const input = openInlineComposer(fresh.querySelector(".task-list"), dateKey, { focus: Boolean(hadFocus) });
    if (input) {
      input.value = draft;
    }
  }
}

function renderDayColumn(date, dateKey) {
  const column = document.createElement("section");
  column.className = "day-column";
  column.dataset.dateKey = dateKey;

  const header = document.createElement("div");
  header.className = "day-header";

  const dateLabel = document.createElement("div");
  dateLabel.className = "day-date";
  dateLabel.textContent = new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);

  const nameLabel = document.createElement("div");
  nameLabel.className = "day-name";
  nameLabel.textContent = new Intl.DateTimeFormat(LOCALE, { weekday: "long" })
    .format(date)
    .toUpperCase();

  if (isSameDate(date, new Date())) {
    nameLabel.classList.add("today");
  }

  header.append(dateLabel, nameLabel);

  const taskList = document.createElement("ul");
  taskList.className = "task-list";

  const tasks = state.tasksByDate[dateKey] || [];
  const visibleTasks = state.settings.hideCompleted ? tasks.filter((task) => !task.completed) : tasks;

  visibleTasks.forEach((task) => {
    const node = renderTask(dateKey, task);
    taskList.appendChild(node);
  });

  taskList.addEventListener("dragenter", () => {
    const dragging = document.querySelector(".task-item.dragging");
    if (dragging) {
      taskList.classList.add("drop-target");
    }
  });

  taskList.addEventListener("dragleave", (event) => {
    if (!taskList.contains(event.relatedTarget)) {
      taskList.classList.remove("drop-target");
    }
  });

  taskList.addEventListener("click", (event) => {
    if (event.target.closest(".task-item")) {
      return;
    }

    if (event.target.closest(".composer-row")) {
      return;
    }

    openInlineComposer(taskList, dateKey);
  });

  column.append(header, taskList);

  return column;
}

function openInlineComposer(taskList, dateKey, options = {}) {
  if (!taskList) {
    return null;
  }

  const existingInput = taskList.querySelector(".composer-input");
  if (existingInput) {
    existingInput.focus();
    return existingInput;
  }

  const row = document.createElement("li");
  row.className = "composer-row";

  const input = document.createElement("input");
  input.className = "add-input composer-input";
  input.placeholder = "Scrie un task...";
  input.setAttribute("aria-label", `Task nou pentru ${dateKey}`);

  let committed = false;

  // keepOpen (Enter): golește inputul și lasă composer-ul deschis pentru următorul task.
  // renderColumn() îl re-creează cu focus pentru că draft-ul (gol) încă există la re-render.
  const commit = (keepOpen) => {
    if (committed) {
      return;
    }

    const text = input.value.trim();

    if (!keepOpen) {
      committed = true;
      row.remove();
      if (text) {
        addTask(dateKey, text);
      }
      return;
    }

    if (!text) {
      committed = true;
      row.remove();
      return;
    }

    input.value = "";
    committed = true;
    addTask(dateKey, text);
  };

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit(true);
      return;
    }

    if (event.key === "Escape") {
      committed = true;
      row.remove();
    }
  });

  input.addEventListener("blur", () => commit(false));
  row.appendChild(input);
  taskList.appendChild(row);

  if (options.focus !== false) {
    input.focus();
  }

  return input;
}

function focusTodayComposer() {
  const todayKey = formatDateKey(new Date());
  let taskList = document.querySelector(`.day-column[data-date-key="${todayKey}"] .task-list`);

  if (!taskList) {
    state.dayOffset = state.settings.startOn === "yesterday" ? 1 : 0;
    renderWeek();
    taskList = document.querySelector(`.day-column[data-date-key="${todayKey}"] .task-list`);
  }

  if (taskList) {
    openInlineComposer(taskList, todayKey);
  }
}

function isTypingTarget(target) {
  if (!target) {
    return false;
  }

  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

function renderTask(dateKey, task) {
  const fragment = taskTemplate.content.cloneNode(true);
  const node = fragment.querySelector(".task-item");
  const checkBtn = fragment.querySelector(".check-btn");
  const content = fragment.querySelector(".task-content");
  const editBtn = fragment.querySelector(".edit-btn");

  node.dataset.taskId = task.id;
  node.dataset.dateKey = dateKey;
  if (task.completed) {
    node.classList.add("completed");
  }
  content.textContent = task.text;

  checkBtn.addEventListener("click", () => {
    const becameCompleted = toggleTaskCompleted(dateKey, task.id);
    if (becameCompleted && state.settings.celebrations) {
      spawnConfettiBurst();
    }
  });

  editBtn.addEventListener("click", () => {
    beginTaskEdit(content, dateKey, task);
  });

  node.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/task-id", task.id);
    event.dataTransfer.setData("text/date-key", dateKey);
    node.classList.add("dragging");
    showTrashZone(true);
  });

  node.addEventListener("dragend", () => {
    node.classList.remove("dragging");
    document.querySelectorAll(".drop-target").forEach((target) => target.classList.remove("drop-target"));
    showTrashZone(false);

    // Drag anulat sau drop nefinalizat: nodul e încă în DOM, posibil re-parentat
    // de dragover în altă coloană — readu ambele coloane la starea reală.
    if (node.isConnected) {
      const currentKey = node.closest(".day-column")?.dataset.dateKey;
      renderColumn(dateKey);
      if (currentKey && currentKey !== dateKey) {
        renderColumn(currentKey);
      }
    }
  });

  return node;
}

function beginTaskEdit(contentNode, dateKey, task) {
  const taskItem = contentNode.closest(".task-item");
  if (taskItem?.querySelector(".edit-input")) {
    return;
  }

  const input = document.createElement("input");
  input.className = "edit-input";
  input.value = task.text;

  let done = false;

  const cancel = () => {
    if (done) {
      return;
    }
    done = true;
    renderColumn(dateKey);
  };

  const save = () => {
    if (done) {
      return;
    }
    done = true;

    const text = input.value.trim();
    if (!text) {
      removeTask(dateKey, task.id);
      return;
    }

    updateTask(dateKey, task.id, (current) => ({
      ...current,
      text,
    }));
  };

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      save();
    }

    if (event.key === "Escape") {
      cancel();
    }
  });

  input.addEventListener("blur", save);
  contentNode.replaceWith(input);
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

function addTask(dateKey, text) {
  const entry = sanitizeTask({
    id: uid(),
    text,
    completed: false,
    createdAt: Date.now(),
  });

  const tasks = state.tasksByDate[dateKey] || [];
  const firstCompletedIndex = tasks.findIndex((task) => task.completed);

  if (firstCompletedIndex === -1) {
    state.tasksByDate[dateKey] = [...tasks, entry];
  } else {
    state.tasksByDate[dateKey] = [
      ...tasks.slice(0, firstCompletedIndex),
      entry,
      ...tasks.slice(firstCompletedIndex),
    ];
  }

  saveState();
  renderColumn(dateKey);
}

function updateTask(dateKey, taskId, updater) {
  const tasks = state.tasksByDate[dateKey] || [];
  state.tasksByDate[dateKey] = tasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }

    return updater(task);
  });

  saveState();
  renderColumn(dateKey);
}

function toggleTaskCompleted(dateKey, taskId) {
  const tasks = state.tasksByDate[dateKey] || [];
  const idx = tasks.findIndex((task) => task.id === taskId);
  if (idx === -1) {
    return false;
  }

  const original = tasks[idx];
  const updatedTask = {
    ...original,
    completed: !original.completed,
  };

  const next = [...tasks];
  next[idx] = updatedTask;

  // Cand un task este bifat, il trimitem la finalul listei.
  if (updatedTask.completed) {
    next.splice(idx, 1);
    next.push(updatedTask);
  }

  state.tasksByDate[dateKey] = reorderCompletedToBottom(next);
  saveState();
  renderColumn(dateKey);

  return updatedTask.completed;
}

function reorderCompletedToBottom(tasks) {
  const active = tasks.filter((task) => !task.completed);
  const done = tasks.filter((task) => task.completed);
  return [...active, ...done];
}

function sanitizeTask(task) {
  return {
    id: task?.id || uid(),
    text: String(task?.text || ""),
    completed: Boolean(task?.completed),
    createdAt: Number(task?.createdAt) || Date.now(),
  };
}

function removeTask(dateKey, taskId) {
  const tasks = state.tasksByDate[dateKey] || [];
  state.tasksByDate[dateKey] = tasks.filter((task) => task.id !== taskId);

  saveState();
  renderColumn(dateKey);
}

function showTrashZone(visible) {
  if (!trashZone) {
    return;
  }

  trashZone.classList.toggle("visible", visible);
  if (!visible) {
    trashZone.classList.remove("over");
  }
}

function onGlobalDragOver(event) {
  if (event.target.closest(".trash-zone")) {
    event.preventDefault();
    trashZone.classList.add("over");
    return;
  }

  trashZone?.classList.remove("over");

  const list = event.target.closest(".task-list");
  if (!list) {
    return;
  }

  event.preventDefault();
  const dragging = document.querySelector(".task-item.dragging");

  if (!dragging) {
    return;
  }

  const afterElement = getDragAfterElement(list, event.clientY);
  if (!afterElement) {
    list.appendChild(dragging);
  } else {
    list.insertBefore(dragging, afterElement);
  }
}

function onGlobalDrop(event) {
  showTrashZone(false);
  document.querySelectorAll(".drop-target").forEach((target) => target.classList.remove("drop-target"));

  if (event.target.closest(".trash-zone")) {
    event.preventDefault();
    const sourceDate = event.dataTransfer.getData("text/date-key");
    const taskId = event.dataTransfer.getData("text/task-id");
    // dragover-ul re-parentează nodul târât în coloanele peste care treci;
    // scoate-l explicit, altfel rămâne o "fantomă" în altă coloană.
    document.querySelector(".task-item.dragging")?.remove();
    if (sourceDate && taskId) {
      removeTask(sourceDate, taskId);
    }
    return;
  }

  const list = event.target.closest(".task-list");
  if (!list) {
    return;
  }

  event.preventDefault();

  const sourceDate = event.dataTransfer.getData("text/date-key");
  const taskId = event.dataTransfer.getData("text/task-id");
  const targetDate = list.closest(".day-column")?.dataset.dateKey;

  if (!sourceDate || !targetDate || !taskId) {
    renderWeek();
    return;
  }

  if (sourceDate === targetDate) {
    const current = state.tasksByDate[sourceDate] || [];
    state.tasksByDate[sourceDate] = reorderByDom(list, current);
    saveState();
    renderColumn(sourceDate);
    return;
  }

  const sourceTasks = state.tasksByDate[sourceDate] || [];
  const movedTask = sourceTasks.find((task) => task.id === taskId);
  if (!movedTask) {
    renderWeek();
    return;
  }

  state.tasksByDate[sourceDate] = sourceTasks.filter((task) => task.id !== taskId);

  const sourceList = document.querySelector(`.day-column[data-date-key="${sourceDate}"] .task-list`);
  if (sourceList) {
    state.tasksByDate[sourceDate] = reorderByDom(sourceList, state.tasksByDate[sourceDate]);
  }

  const targetTasks = [...(state.tasksByDate[targetDate] || []), movedTask];
  state.tasksByDate[targetDate] = reorderByDom(list, targetTasks);

  saveState();
  renderColumn(sourceDate);
  renderColumn(targetDate);
}

function reorderByDom(listElement, tasks) {
  const domIds = Array.from(listElement.querySelectorAll(".task-item")).map((el) => el.dataset.taskId);
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const used = new Set(domIds);
  const inDomOrder = domIds.map((id) => byId.get(id)).filter(Boolean);
  const notRendered = tasks.filter((task) => !used.has(task.id));
  return [...inDomOrder, ...notRendered];
}

function getDragAfterElement(container, y) {
  const elements = [...container.querySelectorAll(".task-item:not(.dragging)")];
  let best = { offset: Number.NEGATIVE_INFINITY, element: null };

  elements.forEach((element) => {
    const box = element.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;

    if (offset < 0 && offset > best.offset) {
      best = { offset, element };
    }
  });

  return best.element;
}

function nextColor(currentColor = "none") {
  const idx = COLOR_ORDER.indexOf(currentColor);
  if (idx === -1) {
    return "yellow";
  }

  return COLOR_ORDER[(idx + 1) % COLOR_ORDER.length];
}

function spawnConfettiBurst() {
  const layer = document.createElement("div");
  layer.className = "confetti-layer";

  const colors = ["#d91f7f", "#1269ff", "#1f8e4d", "#f5b700", "#f05a28", "#ffffff"];
  const pieces = 150;

  for (let index = 0; index < pieces; index += 1) {
    const piece = document.createElement("span");
    const left = Math.random() * 100;
    const size = 6 + Math.random() * 8;
    const duration = 1500 + Math.random() * 1100;
    const delay = Math.random() * 220;
    const drift = -140 + Math.random() * 280;
    const rotation = Math.random() * 1080;
    const color = colors[index % colors.length];

    piece.className = "confetti-piece";
    piece.style.left = `${left}vw`;
    piece.style.width = `${size}px`;
    piece.style.height = `${size * 0.55}px`;
    piece.style.background = color;
    piece.style.setProperty("--fall-duration", `${duration}ms`);
    piece.style.setProperty("--fall-delay", `${delay}ms`);
    piece.style.setProperty("--drift", `${drift}px`);
    piece.style.setProperty("--rotation", `${rotation}deg`);

    layer.appendChild(piece);
  }

  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 2600);
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateKey(key) {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    return null;
  }

  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isSameDate(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function updateSegmentedSetting(key, value) {
  if (key === "columns") {
    const nextColumns = Number(value);
    if (![1, 3, 5, 7].includes(nextColumns)) {
      return;
    }

    state.settings.columns = nextColumns;
    state.dayOffset = 0;
    persistAndRender();
    return;
  }

  if (key === "textSize" && TEXT_SIZE_MAP[value]) {
    state.settings.textSize = value;
    applyVisualSettings();
    saveState();
    return;
  }

  if (key === "spacing" && SPACING_MAP[value]) {
    state.settings.spacing = value;
    applyVisualSettings();
    saveState();
    return;
  }

  if (key === "bulletStyle" && ["circle", "square", "none"].includes(value)) {
    state.settings.bulletStyle = value;
    applyVisualSettings();
    saveState();
    return;
  }

  if (key === "startOn" && ["today", "yesterday"].includes(value)) {
    state.settings.startOn = value;
    state.dayOffset = 0;
    persistAndRender();
    return;
  }

  if (key === "display" && ["light", "dark"].includes(value)) {
    state.settings.display = value;
    applyVisualSettings();
    saveState();
  }
}

function persistAndRender(forceRender = false) {
  saveState();
  syncSettingsUI();
  applyVisualSettings();
  renderWeek();
}

function syncSettingsUI() {
  hideCompletedInput.checked = state.settings.hideCompleted;
  showLinesInput.checked = state.settings.showLines;
  celebrationsInput.checked = state.settings.celebrations;

  segmentedGroups.forEach((group) => {
    const key = group.dataset.setting;
    const value = state.settings[key];

    group.querySelectorAll("button[data-value]").forEach((button) => {
      button.classList.toggle("active", button.dataset.value === String(value));
    });
  });

  themeSwatches.forEach((swatch) => {
    swatch.classList.toggle("active", swatch.dataset.theme === state.settings.theme);
  });
}

function applyVisualSettings() {
  const theme = THEME_PALETTE[state.settings.theme] || THEME_PALETTE.pink;
  const spacing = SPACING_MAP[state.settings.spacing] || SPACING_MAP.m;

  document.documentElement.style.setProperty("--theme", theme.theme);
  document.documentElement.style.setProperty("--theme-soft", theme.soft);
  document.documentElement.style.setProperty("--columns", String(state.settings.columns));
  document.documentElement.style.setProperty("--task-font-size", TEXT_SIZE_MAP[state.settings.textSize]);
  document.documentElement.style.setProperty("--task-gap", spacing.gap);
  document.documentElement.style.setProperty("--task-padding-y", spacing.paddingY);
  document.documentElement.style.setProperty("--row-line-opacity", state.settings.showLines ? "1" : "0");
  document.documentElement.style.setProperty("--check-radius", state.settings.bulletStyle === "square" ? "5px" : "999px");

  document.body.dataset.bullets = state.settings.bulletStyle;
  document.body.classList.toggle("dark", state.settings.display === "dark");

  syncSettingsUI();
}

function setPreferencesPanel(visible) {
  state.ui.prefsOpen = visible;

  prefsPanel.classList.toggle("open", visible);
  prefsPanel.setAttribute("aria-hidden", String(!visible));
  prefsOverlay.hidden = !visible;
  prefsToggleBtn.setAttribute("aria-expanded", String(visible));
}

// ─────────────────────────── Liste permanente ───────────────────────────
// Secțiune separată de task-urile zilnice: NU se rulează la miezul nopții, rămân
// acolo cât vrei (ca partea de jos din TeuxDeux). Pliabilă din bara proprie.

function applyListsCollapsed() {
  const collapsed = Boolean(state.settings.listsCollapsed);
  // Colapsarea o face CSS-ul (animație pe grid-template-rows via clasa .collapsed);
  // `inert` scoate conținutul ascuns din focus/tab, fără a rupe animația.
  listsSection?.classList.toggle("collapsed", collapsed);
  if (listsBody) listsBody.inert = collapsed;
  if (addListBtn) addListBtn.hidden = collapsed;
  listsToggle?.setAttribute("aria-expanded", String(!collapsed));
}

function applyListsHeight() {
  let h = state.settings.listsHeight;
  // Valoare mai mare decât tot ecranul = gunoi (de pe vremea drag-ului nelimitat)
  // → revino la default (30vh). Se auto-vindecă la următorul drag.
  if (h > window.innerHeight) {
    h = 0;
    state.settings.listsHeight = 0;
  }
  if (h > 0) {
    // Clamp la ecran: nu strivim zilele, nu depășim viewport-ul.
    const clamped = Math.max(LISTS_MIN_H, Math.min(listsMaxH(), h));
    document.documentElement.style.setProperty("--lists-h", clamped + "px");
  } else {
    document.documentElement.style.removeProperty("--lists-h");
  }
}

// La redimensionarea ferestrei, re-clampează (altfel o secțiune mare rămâne mai
// înaltă decât noul ecran).
window.addEventListener("resize", () => {
  if (state.settings.listsHeight > 0) applyListsHeight();
});

function renderLists() {
  applyListsCollapsed();
  applyListsHeight();
  renderTabs();
  renderBody();
}

// Id-ul listei active (tabul deschis). Cade pe prima listă dacă cel salvat lipsește.
function getActiveListId() {
  const id = state.settings.activeListId;
  if (id && state.lists.some((l) => l.id === id)) return id;
  return state.lists[0] ? state.lists[0].id : null;
}

function setActiveList(id) {
  state.settings.activeListId = id;
  saveState();
  renderTabs();
  renderBody();
}

// Bara de taburi: fiecare listă = un tab. Click pe alt tab → comută; click pe tabul
// activ → redenumire inline; × → șterge.
function renderTabs() {
  if (!listsTabs) return;
  listsTabs.innerHTML = "";
  const activeId = getActiveListId();

  state.lists.forEach((list) => {
    const tab = document.createElement("div");
    tab.className = "list-tab" + (list.id === activeId ? " is-active" : "");
    tab.dataset.listId = list.id;
    tab.setAttribute("role", "button");
    tab.tabIndex = 0;
    tab.title = list.id === activeId ? "Click pentru a redenumi" : "Comută la această listă";

    const name = document.createElement("span");
    name.className = "list-tab-name";
    name.textContent = list.name;

    const del = document.createElement("span");
    del.className = "list-tab-del";
    del.title = "Șterge lista";
    del.textContent = "×";
    del.addEventListener("click", (event) => {
      event.stopPropagation();
      if (list.items.length === 0 || window.confirm(`Ștergi lista „${list.name}”?`)) {
        deleteList(list.id);
      }
    });

    tab.append(name, del);

    const activate = () => {
      if (list.id === getActiveListId()) beginTabRename(name, list);
      else setActiveList(list.id);
    };
    tab.addEventListener("click", activate);
    tab.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });

    listsTabs.appendChild(tab);
  });
}

function renderBody() {
  if (!listsGrid) return;
  listsGrid.innerHTML = "";
  const list = findList(getActiveListId());
  if (!list) {
    const empty = document.createElement("div");
    empty.className = "lists-empty";
    empty.textContent = "Nicio listă încă. Apasă + ca să creezi una.";
    listsGrid.appendChild(empty);
    return;
  }
  listsGrid.appendChild(renderActiveList(list));
}

// Re-randează corpul listei active, păstrând composer-ul deschis (ca la zile).
function refreshListBody() {
  const list = findList(getActiveListId());
  const wrap = listsGrid?.querySelector(".list-active");
  if (!list || !wrap) {
    renderBody();
    return;
  }

  const input = wrap.querySelector(".list-composer-input");
  const draft = input ? input.value : null;
  const hadFocus = input && document.activeElement === input;

  const fresh = renderActiveList(list);
  wrap.replaceWith(fresh);

  if (draft !== null) {
    const next = openListComposer(fresh.querySelector(".list-items"), list.id, { focus: Boolean(hadFocus) });
    if (next) next.value = draft;
  }
}

// Corpul listei active: elementele pe toată lățimea (un singur tab pe rând).
function renderActiveList(list) {
  const wrap = document.createElement("div");
  wrap.className = "list-active";
  wrap.dataset.listId = list.id;

  const items = document.createElement("ul");
  items.className = "list-items";

  const visible = state.settings.hideCompleted ? list.items.filter((it) => !it.done) : list.items;
  visible.forEach((item) => items.appendChild(renderListItem(list, item)));

  items.addEventListener("click", (event) => {
    if (event.target.closest(".task-item") || event.target.closest(".composer-row")) {
      return;
    }
    openListComposer(items, list.id);
  });

  wrap.appendChild(items);
  return wrap;
}

function renderListItem(list, item) {
  const li = document.createElement("li");
  li.className = "task-item list-item";
  li.dataset.itemId = item.id;
  if (item.done) {
    li.classList.add("completed");
  }

  const check = document.createElement("button");
  check.className = "check-btn";
  check.type = "button";
  check.setAttribute("aria-label", "Marchează completat");
  check.addEventListener("click", () => {
    const became = toggleListItem(list.id, item.id);
    if (became && state.settings.celebrations) {
      spawnConfettiBurst();
    }
  });

  const content = document.createElement("div");
  content.className = "task-content";
  content.textContent = item.text;
  content.addEventListener("click", () => beginListItemEdit(content, list.id, item));

  const actions = document.createElement("div");
  actions.className = "task-actions";
  const edit = document.createElement("button");
  edit.className = "tiny-btn";
  edit.type = "button";
  edit.title = "Editează";
  edit.textContent = "✎";
  edit.addEventListener("click", () => beginListItemEdit(content, list.id, item));

  const del = document.createElement("button");
  del.className = "tiny-btn list-item-del";
  del.type = "button";
  del.title = "Șterge";
  del.textContent = "×";
  del.addEventListener("click", () => removeListItem(list.id, item.id));

  actions.append(edit, del);

  li.append(check, content, actions);
  return li;
}

function openListComposer(itemsEl, listId, options = {}) {
  if (!itemsEl) {
    return null;
  }

  const existing = itemsEl.querySelector(".list-composer-input");
  if (existing) {
    existing.focus();
    return existing;
  }

  const row = document.createElement("li");
  row.className = "composer-row";
  const input = document.createElement("input");
  input.className = "add-input list-composer-input";
  input.placeholder = "Adaugă un element...";

  let committed = false;
  const commit = (keepOpen) => {
    if (committed) {
      return;
    }
    const text = input.value.trim();
    if (!keepOpen) {
      committed = true;
      row.remove();
      if (text) {
        addListItem(listId, text);
      }
      return;
    }
    if (!text) {
      committed = true;
      row.remove();
      return;
    }
    input.value = "";
    committed = true;
    addListItem(listId, text);
  };

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit(true);
    } else if (event.key === "Escape") {
      committed = true;
      row.remove();
    }
  });
  input.addEventListener("blur", () => commit(false));

  row.appendChild(input);
  itemsEl.appendChild(row);
  if (options.focus !== false) {
    input.focus();
  }
  return input;
}

function beginTabRename(nameNode, list) {
  const tab = nameNode.closest(".list-tab");
  if (tab?.querySelector(".list-tab-input")) {
    return;
  }

  const input = document.createElement("input");
  input.className = "add-input list-tab-input";
  input.value = list.name;

  let done = false;
  const finish = (save) => {
    if (done) {
      return;
    }
    done = true;
    if (save) {
      const name = input.value.trim();
      renameList(list.id, name || list.name);
    } else {
      renderTabs();
    }
  };

  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      finish(true);
    } else if (event.key === "Escape") {
      finish(false);
    }
  });
  input.addEventListener("click", (event) => event.stopPropagation());
  input.addEventListener("blur", () => finish(true));
  nameNode.replaceWith(input);
  input.focus();
  input.select();
}

function beginListItemEdit(contentNode, listId, item) {
  const li = contentNode.closest(".task-item");
  if (li?.querySelector(".edit-input")) {
    return;
  }

  const input = document.createElement("input");
  input.className = "edit-input";
  input.value = item.text;

  let done = false;
  const cancel = () => {
    if (done) {
      return;
    }
    done = true;
    refreshListBody();
  };
  const save = () => {
    if (done) {
      return;
    }
    done = true;
    const text = input.value.trim();
    if (!text) {
      removeListItem(listId, item.id);
      return;
    }
    updateListItem(listId, item.id, (current) => ({ ...current, text }));
  };

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      save();
    } else if (event.key === "Escape") {
      cancel();
    }
  });
  input.addEventListener("blur", save);
  contentNode.replaceWith(input);
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

function findList(listId) {
  return state.lists.find((list) => list.id === listId) || null;
}

function addList(name = "Listă nouă") {
  const list = { id: uid(), name, items: [] };
  state.lists.push(list);
  state.settings.activeListId = list.id; // tabul nou devine activ
  if (state.settings.listsCollapsed) {
    state.settings.listsCollapsed = false;
  }
  saveState();
  renderLists();

  // Redenumire imediată a tabului nou.
  const nameNode = listsTabs?.querySelector(`.list-tab[data-list-id="${list.id}"] .list-tab-name`);
  if (nameNode) {
    beginTabRename(nameNode, list);
  }
}

function renameList(listId, name) {
  const list = findList(listId);
  if (!list) {
    return;
  }
  list.name = name;
  saveState();
  renderTabs();
}

function deleteList(listId) {
  state.lists = state.lists.filter((list) => list.id !== listId);
  if (state.settings.activeListId === listId) {
    state.settings.activeListId = state.lists[0] ? state.lists[0].id : null;
  }
  saveState();
  renderLists();
}

function addListItem(listId, text) {
  const list = findList(listId);
  if (!list) {
    return;
  }
  const entry = { id: uid(), text, done: false };
  const firstDone = list.items.findIndex((item) => item.done);
  if (firstDone === -1) {
    list.items.push(entry);
  } else {
    list.items.splice(firstDone, 0, entry);
  }
  saveState();
  refreshListBody();
}

function updateListItem(listId, itemId, updater) {
  const list = findList(listId);
  if (!list) {
    return;
  }
  list.items = list.items.map((item) => (item.id === itemId ? updater(item) : item));
  saveState();
  refreshListBody();
}

function toggleListItem(listId, itemId) {
  const list = findList(listId);
  if (!list) {
    return false;
  }
  const item = list.items.find((entry) => entry.id === itemId);
  if (!item) {
    return false;
  }
  item.done = !item.done;
  // Bifate la fund, ordinea din fiecare grup păstrată.
  const active = list.items.filter((entry) => !entry.done);
  const done = list.items.filter((entry) => entry.done);
  list.items = [...active, ...done];
  saveState();
  refreshListBody();
  return item.done;
}

function removeListItem(listId, itemId) {
  const list = findList(listId);
  if (!list) {
    return;
  }
  list.items = list.items.filter((item) => item.id !== itemId);
  saveState();
  refreshListBody();
}

// Service worker: cache offline pentru shell + assets (deschidere instant ca PWA).
// Scope "/elite-deux" (fără slash) ca să acopere și pagina /elite-deux — cere
// header-ul Service-Worker-Allowed setat în next.config.ts.
if ("serviceWorker" in navigator) {
  const registerServiceWorker = () => {
    navigator.serviceWorker
      .register("/elite-deux/sw.js", { scope: "/elite-deux" })
      .catch(() => {});

    // Curăță înregistrarea veche cu scope "/elite-deux/" (nu controla pagina).
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        if (registration.scope.endsWith("/elite-deux/")) {
          registration.unregister();
        }
      });
    }).catch(() => {});
  };

  // Scriptul e încărcat afterInteractive — "load" poate fi deja trecut.
  if (document.readyState === "complete") {
    registerServiceWorker();
  } else {
    window.addEventListener("load", registerServiceWorker);
  }
}
