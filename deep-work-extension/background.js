const BLOCK_RULE_IDS = [1001, 1002, 1003, 1004, 1005, 1006];
const BLOCKED_SITES = [
  { id: 1001, site: "facebook", regex: "^https?://([^.]+\\.)?facebook\\.com/.*" },
  { id: 1002, site: "instagram", regex: "^https?://([^.]+\\.)?instagram\\.com/.*" },
  { id: 1003, site: "x", regex: "^https?://([^.]+\\.)?x\\.com/.*" },
  { id: 1004, site: "twitter", regex: "^https?://([^.]+\\.)?twitter\\.com/.*" },
  { id: 1005, site: "reddit", regex: "^https?://([^.]+\\.)?reddit\\.com/.*" },
  { id: 1006, site: "tiktok", regex: "^https?://([^.]+\\.)?tiktok\\.com/.*" }
];

function getBlockedPage(site) {
  return chrome.runtime.getURL(`blocked.html?site=${encodeURIComponent(site)}`);
}

async function applyBlockingState(state) {
  const shouldBlock = Boolean(state?.active) && state?.mode === "work";
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: BLOCK_RULE_IDS,
    addRules: shouldBlock
      ? BLOCKED_SITES.map(({ id, site, regex }) => ({
          id,
          priority: 1,
          action: {
            type: "redirect",
            redirect: { url: getBlockedPage(site) }
          },
          condition: {
            regexFilter: regex,
            resourceTypes: ["main_frame"]
          }
        }))
      : []
  });
}

async function syncFromStorage() {
  const result = await chrome.storage.local.get("deepWorkBlockState");
  await applyBlockingState(result.deepWorkBlockState || { active: false, mode: null });
}

chrome.runtime.onInstalled.addListener(syncFromStorage);
chrome.runtime.onStartup.addListener(syncFromStorage);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.deepWorkBlockState) return;
  applyBlockingState(changes.deepWorkBlockState.newValue || { active: false, mode: null });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "DEEP_WORK_BLOCK_STATE") return;
  chrome.storage.local
    .set({
      deepWorkBlockState: {
        active: Boolean(message.active),
        mode: message.active ? message.mode || "work" : null,
        updatedAt: Date.now()
      }
    })
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: String(error) }));
  return true;
});
