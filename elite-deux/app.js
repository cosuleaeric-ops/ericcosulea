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
let remoteSaveTimer = null;
let remoteInitSucceeded = false;

prevWeekBtn.addEventListener("click", () => {
  state.dayOffset -= 1;
  renderWeek();
});

nextWeekBtn.addEventListener("click", () => {
  state.dayOffset += 1;
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
  await initializeState();
  runDailyRollover();
  normalizeAllLists();
  syncSettingsUI();
  applyVisualSettings();
  renderWeek();

  document.addEventListener("dragover", onGlobalDragOver);
  document.addEventListener("drop", onGlobalDrop);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && HAS_REMOTE_STORAGE && remoteInitSucceeded) {
      if (remoteSaveTimer) {
        window.clearTimeout(remoteSaveTimer);
        remoteSaveTimer = null;
      }
      pushStateToRemote(buildStateSnapshot()).catch(() => {});
    }
  });
}

async function initializeState() {
  const localSnapshot = readLocalSnapshot();
  if (localSnapshot) {
    applyStateSnapshot(localSnapshot);
  } else {
    persistLocalSnapshot();
  }

  setStorageStatus(HAS_REMOTE_STORAGE ? "Connecting to server..." : "Storage: local only");

  if (!HAS_REMOTE_STORAGE) {
    return;
  }

  try {
    const remoteSnapshot = await fetchRemoteSnapshot();
    if (remoteSnapshot) {
      const localSavedAt = localSnapshot?.savedAt ?? 0;
      const remoteSavedAt = remoteSnapshot.savedAt ?? 0;
      if (remoteSavedAt > localSavedAt) {
        applyStateSnapshot(remoteSnapshot);
      } else if (localSavedAt > remoteSavedAt) {
        await pushStateToRemote(buildStateSnapshot());
      }
      persistLocalSnapshot();
    } else {
      await pushStateToRemote(buildStateSnapshot());
    }
    remoteInitSucceeded = true;
    setStorageStatus("Storage: synced with server");
  } catch (error) {
    console.warn("EliteDeux remote sync unavailable", error);
    setStorageStatus(localSnapshot ? "Server unavailable. Working from local backup." : "Server unavailable. Data stays local.");
  }
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
  state.settings = snapshot.settings;
  state.lastSeenDate = snapshot.lastSeenDate;
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
    settings: sanitizeSettings(source.settings || {}),
    lastSeenDate: parseDateKey(source.lastSeenDate) ? source.lastSeenDate : formatDateKey(new Date()),
  };
}

function buildStateSnapshot() {
  return {
    tasksByDate: state.tasksByDate,
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
  if (!payload?.state) {
    return null;
  }

  return sanitizeStateSnapshot(payload.state);
}

async function pushStateToRemote(snapshot) {
  const response = await fetch(SERVER_STATE_URL, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-CSRF-Token": CSRF_TOKEN,
    },
    body: JSON.stringify({ state: snapshot }),
  });

  if (!response.ok) {
    throw new Error(`Remote save failed (${response.status})`);
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

function runDailyRollover() {
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
  saveState();
}

function normalizeAllLists() {
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
  if (changed) {
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

function openInlineComposer(taskList, dateKey) {
  const existingInput = taskList.querySelector(".composer-input");
  if (existingInput) {
    existingInput.focus();
    return;
  }

  const row = document.createElement("li");
  row.className = "composer-row";

  const input = document.createElement("input");
  input.className = "add-input composer-input";
  input.placeholder = "Scrie un task...";
  input.setAttribute("aria-label", `Task nou pentru ${dateKey}`);

  let committed = false;

  const commit = () => {
    if (committed) {
      return;
    }

    committed = true;
    const text = input.value.trim();
    if (!text) {
      row.remove();
      return;
    }

    addTask(dateKey, text);
  };

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      return;
    }

    if (event.key === "Escape") {
      committed = true;
      row.remove();
    }
  });

  input.addEventListener("blur", commit);
  row.appendChild(input);
  taskList.appendChild(row);
  input.focus();
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

  const cancel = () => {
    renderWeek();
  };

  const save = () => {
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
  renderWeek();
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
  renderWeek();
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
  renderWeek();

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
  renderWeek();
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

  if (event.target.closest(".trash-zone")) {
    event.preventDefault();
    const sourceDate = event.dataTransfer.getData("text/date-key");
    const taskId = event.dataTransfer.getData("text/task-id");
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
    renderWeek();
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
  renderWeek();
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
