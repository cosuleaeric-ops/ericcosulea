(function () {
  const FLAG_KEY = "eliteDeepWork_timerActive";
  const MODE_KEY = "eliteDeepWork_timerMode";

  function readState() {
    try {
      const active = localStorage.getItem(FLAG_KEY) === "1";
      const mode = localStorage.getItem(MODE_KEY) || null;
      return { active, mode };
    } catch (_) {
      return { active: false, mode: null };
    }
  }

  function sendBlockState(active, mode) {
    chrome.runtime.sendMessage({
      type: "DEEP_WORK_BLOCK_STATE",
      active,
      mode: mode || null
    }).catch(() => {
      // service worker-ul poate fi inactiv la momentul injectării — ignorăm eroarea
    });
  }

  function pushState() {
    const state = readState();
    sendBlockState(state.active, state.mode);
  }

  pushState();

  document.addEventListener("eliteDeepWorkTimerChange", (event) => {
    const detail = event.detail || {};
    sendBlockState(Boolean(detail.active), detail.mode || null);
  });

  window.addEventListener("storage", (event) => {
    if (event.key === FLAG_KEY || event.key === MODE_KEY) {
      pushState();
    }
  });
})();
