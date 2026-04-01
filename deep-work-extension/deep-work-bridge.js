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

  function pushState() {
    const state = readState();
    chrome.runtime.sendMessage({
      type: "DEEP_WORK_BLOCK_STATE",
      active: state.active,
      mode: state.mode
    });
  }

  pushState();

  document.addEventListener("eliteDeepWorkTimerChange", (event) => {
    const detail = event.detail || {};
    chrome.runtime.sendMessage({
      type: "DEEP_WORK_BLOCK_STATE",
      active: Boolean(detail.active),
      mode: detail.mode || null
    });
  });

  window.addEventListener("storage", (event) => {
    if (event.key === FLAG_KEY || event.key === MODE_KEY) {
      pushState();
    }
  });
})();
