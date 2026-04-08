<?php
declare(strict_types=1);

require __DIR__ . '/../admin/auth.php';

if (!is_logged_in()) {
    header('Location: /admin/login.php?redirect=/dogu/');
    exit;
}

header('X-Robots-Tag: noindex, nofollow');
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DOGU — Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:     #FFFDF7;
      --card:   #FFFFFF;
      --border: #E8E3D8;
      --text:   #1C1C1A;
      --muted:  #888880;
      --shadow: 0 1px 4px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04);
      --radius: 14px;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 20px;
    }

    .hub {
      width: 100%;
      max-width: 480px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
    }

    /* Logo / title */
    .hub-header { text-align: center; }
    .hub-logo   { font-size: 48px; margin-bottom: 12px; }
    .hub-title  {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.6px;
      margin-bottom: 6px;
    }
    .hub-sub { font-size: 14px; color: var(--muted); }

    /* Nav buttons */
    .hub-nav {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .hub-btn {
      display: flex;
      align-items: center;
      gap: 18px;
      background: var(--card);
      border: 1.5px solid var(--border);
      border-radius: var(--radius);
      padding: 20px 24px;
      text-decoration: none;
      color: var(--text);
      box-shadow: var(--shadow);
      transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
    }
    .hub-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 24px rgba(0,0,0,0.10);
      border-color: #ccc;
    }
    .hub-btn:active { transform: translateY(0); }

    .btn-icon {
      font-size: 32px;
      flex-shrink: 0;
      width: 52px;
      height: 52px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      background: var(--btn-bg);
    }
    .btn-body   { flex: 1; }
    .btn-label  { font-size: 16px; font-weight: 700; margin-bottom: 3px; }
    .btn-desc   { font-size: 12px; color: var(--muted); line-height: 1.4; }
    .btn-arrow  { font-size: 20px; color: var(--muted); flex-shrink: 0; }

    /* Logout */
    .hub-footer { text-align: center; }
    .logout-link {
      font-size: 12px;
      color: var(--muted);
      text-decoration: none;
      padding: 6px 14px;
      border: 1px solid var(--border);
      border-radius: 999px;
      transition: all 0.15s;
    }
    .logout-link:hover { color: var(--text); border-color: #ccc; }
  </style>
</head>
<body>

<div class="hub">

  <div class="hub-header">
    <div class="hub-logo">🍔</div>
    <h1 class="hub-title">DOGU</h1>
    <p class="hub-sub">Dashboard intern</p>
  </div>

  <nav class="hub-nav">

    <a href="/reviewsdogu/" class="hub-btn" style="--btn-bg:#FFF3E0">
      <div class="btn-icon">⭐</div>
      <div class="btn-body">
        <div class="btn-label">Reviews & Comenzi</div>
        <div class="btn-desc">Rapoarte Bolt &amp; Glovo — comenzi, reviews, taxe, rambursări</div>
      </div>
      <span class="btn-arrow">→</span>
    </a>

    <a href="/vanzaridogu/" class="hub-btn" style="--btn-bg:#E8F5E9">
      <div class="btn-icon">📊</div>
      <div class="btn-body">
        <div class="btn-label">Vânzări Restaurant</div>
        <div class="btn-desc">Rapoarte Breeze — vânzări per restaurant din secțiunea Restaurant</div>
      </div>
      <span class="btn-arrow">→</span>
    </a>

  </nav>

  <div class="hub-footer">
    <a href="/admin/logout.php" class="logout-link">Ieși din cont</a>
  </div>

</div>

</body>
</html>
