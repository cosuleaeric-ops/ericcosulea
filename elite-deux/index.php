<?php
declare(strict_types=1);

require __DIR__ . '/../admin/auth.php';
require_login();
header('X-Robots-Tag: noindex, nofollow');
?>
<!doctype html>
<html lang="ro">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>EliteDeux</title>
    <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
    <link rel="manifest" href="./manifest.json" />
    <script>if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');</script>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="./styles.css?v=20260408-2" />
    <script>
      window.ELITE_DEUX_CONFIG = {
        stateUrl: "./state.php",
        csrfToken: <?php echo json_encode(csrf_token(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); ?>,
      };
    </script>
<!-- Privacy-friendly analytics by Plausible -->
<script async src="https://plausible.io/js/pa-U3QUedm8aW1g2Ou0qk-1J.js"></script>
<script>
  window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
  plausible.init()
</script>

  </head>
  <body>
    <div class="app-shell">
      <header class="topbar">
        <div class="brand-wrap">
          <span class="brand-mark"></span>
          <h1>EliteDeux</h1>
        </div>

        <div class="week-controls">
          <button id="prevWeek" class="ghost-btn" aria-label="Ziua anterioară">‹</button>
          <button id="nextWeek" class="ghost-btn" aria-label="Ziua următoare">›</button>
        </div>

        <div class="header-spacer" aria-hidden="true"></div>
      </header>

      <main>
        <div id="weekGrid" class="week-grid" aria-live="polite"></div>
      </main>
    </div>

    <button id="prefsToggle" class="prefs-fab" aria-label="Deschide setări" aria-expanded="false">⚙</button>

    <div id="prefsOverlay" class="prefs-overlay" hidden></div>

    <aside id="prefsPanel" class="prefs-panel" aria-hidden="true">
      <div class="prefs-head">
        <h2>Preferences</h2>
        <button id="prefsClose" class="ghost-btn ghost-btn--small" aria-label="Închide meniul">✕</button>
      </div>

      <section class="prefs-section">
        <p class="prefs-label">Theme</p>
        <div class="swatches" id="themeSwatches">
          <button data-theme="pink" class="swatch swatch-pink" title="Roz"></button>
          <button data-theme="red" class="swatch swatch-red" title="Roșu"></button>
          <button data-theme="green" class="swatch swatch-green" title="Verde"></button>
          <button data-theme="blue" class="swatch swatch-blue" title="Albastru"></button>
          <button data-theme="black" class="swatch swatch-black" title="Negru"></button>
        </div>
      </section>

      <section class="prefs-section">
        <div class="prefs-row">
          <span>Columns</span>
          <div class="segmented" data-setting="columns">
            <button data-value="1">1</button>
            <button data-value="3">3</button>
            <button data-value="5">5</button>
            <button data-value="7">7</button>
          </div>
        </div>

        <div class="prefs-row">
          <span>Text size</span>
          <div class="segmented" data-setting="textSize">
            <button data-value="s">S</button>
            <button data-value="m">M</button>
            <button data-value="l">L</button>
          </div>
        </div>

        <div class="prefs-row">
          <span>Spacing</span>
          <div class="segmented" data-setting="spacing">
            <button data-value="s">S</button>
            <button data-value="m">M</button>
            <button data-value="l">L</button>
          </div>
        </div>
      </section>

      <section class="prefs-section">
        <div class="prefs-row">
          <span>Completed to-do's</span>
          <label class="switch"><input id="hideCompleted" type="checkbox" /><span class="slider"></span></label>
        </div>

        <div class="prefs-row">
          <span>Bullet style</span>
          <div class="segmented" data-setting="bulletStyle">
            <button data-value="circle">○</button>
            <button data-value="square">□</button>
            <button data-value="none">∅</button>
          </div>
        </div>

        <div class="prefs-row">
          <span>Start on</span>
          <div class="segmented" data-setting="startOn">
            <button data-value="today">Today</button>
            <button data-value="yesterday">Yesterday</button>
          </div>
        </div>

        <div class="prefs-row">
          <span>Lines</span>
          <label class="switch"><input id="showLines" type="checkbox" /><span class="slider"></span></label>
        </div>

        <div class="prefs-row">
          <span>Display</span>
          <div class="segmented" data-setting="display">
            <button data-value="light">Light</button>
            <button data-value="dark">Dark</button>
          </div>
        </div>

        <div class="prefs-row">
          <span>Celebrations (confetti)</span>
          <label class="switch"><input id="celebrations" type="checkbox" /><span class="slider"></span></label>
        </div>
      </section>

      <section class="prefs-section">
        <p class="prefs-label">Data</p>
        <p id="storageStatus" class="prefs-note">Connecting to server...</p>
        <div class="prefs-actions">
          <button id="exportData" class="ghost-btn" type="button">Export</button>
          <button id="importData" class="ghost-btn" type="button">Import</button>
        </div>
        <input id="importFile" class="visually-hidden" type="file" accept="application/json,.json" />
      </section>
    </aside>

    <template id="taskTemplate">
      <li class="task-item" draggable="true">
        <button class="check-btn" aria-label="Marchează completat"></button>

        <div class="task-content"></div>

        <div class="task-actions">
          <button class="tiny-btn edit-btn" title="Editează">✎</button>
        </div>
      </li>
    </template>

    <div id="trashZone" class="trash-zone" aria-hidden="true">
      <span class="trash-icon">🗑</span>
      <span class="trash-label">Trage aici pentru a șterge</span>
    </div>

    <script defer src="./app.js?v=20260419-3"></script>
  </body>
</html>
