/* analytics — tracking script (DataFast clone). Fără dependențe. */
(function () {
  "use strict";

  var script =
    document.currentScript ||
    document.querySelector('script[data-website-id][src*="/js/script.js"]') ||
    document.querySelector("script[data-website-id]");
  if (!script) return;

  var websiteId = script.getAttribute("data-website-id");
  if (!websiteId) return;

  // API base = originea scriptului (merge pe orice domeniu unde e instalat).
  var apiBase = "";
  try {
    apiBase = new URL(script.src).origin;
  } catch (e) {}

  // Exclude localhost by default (override cu data-include-localhost="true").
  var includeLocalhost = script.getAttribute("data-include-localhost") === "true";
  var host = location.hostname;
  var isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "" ||
    /^192\.168\./.test(host) ||
    /\.local$/.test(host);
  if (isLocal && !includeLocalhost) return;

  // ── Opt-out propriu (ca DataFast): localStorage.datafast_ignore=true ──
  try {
    if (localStorage.getItem("datafast_ignore") === "true") return;
  } catch (e) {}

  // ── Visitor id persistent (localStorage, fallback cookie) ──
  var VKEY = "dfa_visitor_id";
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }
  var visitorId;
  try {
    visitorId = localStorage.getItem(VKEY);
    if (!visitorId) {
      visitorId = uuid();
      localStorage.setItem(VKEY, visitorId);
    }
  } catch (e) {
    var m = document.cookie.match(/(?:^|;\s*)dfa_visitor_id=([^;]+)/);
    if (m) {
      visitorId = decodeURIComponent(m[1]);
    } else {
      visitorId = uuid();
      document.cookie =
        "dfa_visitor_id=" + visitorId + ";max-age=63072000;path=/;SameSite=Lax";
    }
  }

  function send(type, name) {
    var payload = {
      id: websiteId,
      type: type,
      name: name || undefined,
      url: location.href,
      referrer: document.referrer || "",
      visitor_id: visitorId,
    };
    var body = JSON.stringify(payload);
    var url = apiBase + "/api/event";
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }));
      } else {
        fetch(url, {
          method: "POST",
          body: body,
          keepalive: true,
          headers: { "Content-Type": "text/plain" },
        });
      }
    } catch (e) {}
  }

  // ── Pageviews (inclusiv SPA / History API) ──
  var lastUrl = null;
  function pageview() {
    var current = location.pathname + location.search;
    if (current === lastUrl) return;
    lastUrl = current;
    send("pageview");
  }

  var _push = history.pushState;
  history.pushState = function () {
    _push.apply(this, arguments);
    pageview();
  };
  var _replace = history.replaceState;
  history.replaceState = function () {
    _replace.apply(this, arguments);
    pageview();
  };
  window.addEventListener("popstate", pageview);

  // ── Custom events: window.datafast("nume_event") ──
  window.datafast = function (name) {
    if (name) send("custom", String(name));
  };

  // Pageview inițial
  pageview();
})();
