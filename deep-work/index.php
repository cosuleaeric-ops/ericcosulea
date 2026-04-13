<?php
declare(strict_types=1);
require __DIR__ . '/../admin/auth.php';
header('X-Robots-Tag: noindex, nofollow');

if (!is_logged_in()) {
    header('Location: /admin/login.php?redirect=' . urlencode('/deep-work/'));
    exit;
}
?>
<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>elite deep work</title>
  <link rel="icon" type="image/png" href="/assets/Logo3.png">
  <link rel="stylesheet" href="./styles.css" />
</head>
<body data-app="elite-deep-work">
  <header class="header">
    <h1 class="title">elite deep work</h1>
    <div class="header-actions">
      <button type="button" class="btn btn-ghost" id="btn-istoric" aria-label="Istoric">istoric</button>
      <button type="button" class="btn btn-ghost" id="btn-settings" aria-label="Setari">settings</button>
      <div class="user-badge" id="user-badge">eric cosulea</div>
    </div>
  </header>

  <main class="main">
    <section class="timer-panel">
      <div class="mode-tabs">
        <button type="button" class="tab active" data-mode="work">work</button>
        <button type="button" class="tab" data-mode="rest">rest</button>
      </div>
      <div class="timer-display" id="timer-display">60:00</div>
      <button type="button" class="btn btn-start" id="btn-start">start</button>
    </section>

    <section class="deep-work-section">
      <h2 class="section-title">time spent deep.</h2>
      <div class="calendar-grid" id="calendar-grid" role="img" aria-label="Calendar deep work pe zile"></div>
      <div class="legend">
        <span class="legend-label">Less</span>
        <div class="legend-squares" id="legend-squares"></div>
        <span class="legend-label">More</span>
      </div>
    </section>
  </main>

  <dialog class="modal" id="istoric-modal">
    <div class="modal-content">
      <h3>Istoric sesiuni</h3>
      <ul class="istoric-list" id="istoric-list"></ul>
      <button type="button" class="btn btn-ghost" id="istoric-close">Inchide</button>
    </div>
  </dialog>

  <dialog class="modal" id="settings-modal">
    <div class="modal-content">
      <h3>Setari</h3>
      <div class="setting-row">
        <label for="work-duration">Work (minute):</label>
        <input type="number" id="work-duration" min="1" max="120" value="60" />
      </div>
      <div class="setting-row">
        <label for="rest-duration">Rest (minute):</label>
        <input type="number" id="rest-duration" min="1" max="60" value="5" />
      </div>
      <div class="setting-row">
        <label for="user-name">Nume (afisat):</label>
        <input type="text" id="user-name" value="eric cosulea" />
      </div>
      <div class="setting-row">
        <label for="wip-api-key">WIP API key (optional - posteaza pe wip.co la fiecare sesiune):</label>
        <input type="password" id="wip-api-key" placeholder="lasat gol = fara postare WIP" autocomplete="off" />
      </div>
      <div class="setting-row setting-row-actions">
        <button type="button" class="btn btn-ghost" id="btn-export">Export date</button>
        <button type="button" class="btn btn-ghost" id="btn-import">Import date</button>
        <input type="file" id="input-import" accept=".json,application/json" hidden />
      </div>
      <div class="setting-row setting-row-actions">
        <button type="button" class="btn" id="modal-close">Inchide</button>
        <button type="button" class="btn" id="btn-save-settings">Save</button>
      </div>
    </div>
  </dialog>

  <button type="button" class="btn-reset" id="btn-reset" aria-label="Reset timer">reset</button>

  <script>
    window.ELITE_DEEP_WORK_CONFIG = {
      dataEndpoint: "./data.php",
      wipEndpoint: "./wip-post.php"
    };
  </script>
  <script src="./app.js?v=7"></script>
</body>
</html>
