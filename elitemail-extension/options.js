const DEFAULTS = { baseUrl: "https://www.ericcosulea.ro", secret: "" };

const $ = (id) => document.getElementById(id);

chrome.storage.sync.get(DEFAULTS, (v) => {
  $("baseUrl").value = v.baseUrl || DEFAULTS.baseUrl;
  $("secret").value = v.secret || "";
});

$("save").addEventListener("click", () => {
  const baseUrl = $("baseUrl").value.trim().replace(/\/+$/, "") || DEFAULTS.baseUrl;
  const secret = $("secret").value.trim();
  chrome.storage.sync.set({ baseUrl, secret }, () => {
    const s = $("status");
    s.textContent = "✓ salvat";
    setTimeout(() => (s.textContent = ""), 2000);
  });
});
