(function () {
  const BLOCK_PAGE = chrome.runtime.getURL("blocked.html?site=x");

  function shouldBlock(state) {
    return Boolean(state?.active) && state?.mode === "work";
  }

  function redirectNow() {
    if (window.location.href.startsWith(chrome.runtime.getURL("blocked.html"))) return;
    window.location.replace(BLOCK_PAGE);
  }

  chrome.storage.local.get("deepWorkBlockState", ({ deepWorkBlockState }) => {
    if (shouldBlock(deepWorkBlockState)) {
      redirectNow();
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.deepWorkBlockState) return;
    if (shouldBlock(changes.deepWorkBlockState.newValue)) {
      redirectNow();
    }
  });
})();
