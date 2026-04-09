<?php
declare(strict_types=1);

require __DIR__ . '/../admin/auth.php';

if (!is_logged_in()) {
    header('Location: /admin/login.php?redirect=/clp/');
    exit;
}
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CLP — Cursuri la Pahar</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #FFFDF7;
      --card: #FFFFFF;
      --border: #E8E3D8;
      --text: #1C1C1A;
      --muted: #888880;
      --green: #2A7D4F;
      --green-light: #EAF5EF;
      --shadow: 0 1px 4px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04);
      --radius: 16px;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 64px 24px 24px;
    }

    .header {
      text-align: center;
      margin-bottom: 48px;
    }

    .header h1 {
      font-family: 'Crimson Pro', Georgia, serif;
      font-size: 36px;
      font-weight: 700;
      letter-spacing: -0.5px;
      color: var(--text);
      margin-bottom: 8px;
    }

    .header p {
      font-size: 15px;
      color: var(--muted);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, 260px);
      gap: 16px;
    }

    .tool-card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 28px 26px;
      text-decoration: none;
      color: var(--text);
      box-shadow: var(--shadow);
      transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
    }

    .tool-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 4px 20px rgba(0,0,0,0.10);
      border-color: var(--green);
    }

    .tool-icon {
      font-size: 28px;
      line-height: 1;
      margin-bottom: 4px;
    }

    .tool-name {
      font-family: 'Crimson Pro', Georgia, serif;
      font-size: 22px;
      font-weight: 600;
      color: var(--text);
    }

    .tool-desc {
      font-size: 13px;
      color: var(--muted);
      line-height: 1.4;
    }

    .logout {
      margin-top: 48px;
      font-size: 13px;
      color: var(--muted);
      text-decoration: none;
    }
    .logout:hover { color: var(--text); }

    @media (max-width: 640px) {
      .grid { grid-template-columns: 1fr; width: 100%; max-width: 320px; }
      .header h1 { font-size: 28px; }
    }
  </style>
</head>
<body>

  <div class="header">
    <a href="/admin/" style="font-size:13px;color:var(--muted);text-decoration:none;margin-bottom:16px;display:inline-block">← Dashboard</a>
    <h1>Cursuri la Pahar</h1>
    <p>toolurile tale interne</p>
  </div>

  <div class="grid">
    <a class="tool-card" href="/clp/cursuri/">
      <div class="tool-icon">📋</div>
      <div class="tool-name">Cursuri</div>
      <div class="tool-desc">toate cursurile, participanți, distribuție bilete și viză</div>
    </a>
    <a class="tool-card" href="/clp/participanti/">
      <div class="tool-icon">👥</div>
      <div class="tool-name">Participanți</div>
      <div class="tool-desc">agregat complet — cine a venit și de câte ori revine</div>
    </a>
    <a class="tool-card" href="/clp/pnlcursuri/">
      <div class="tool-icon">📈</div>
      <div class="tool-name">P&amp;L Cursuri</div>
      <div class="tool-desc">venituri, cheltuieli și profit net pe luni și categorii</div>
    </a>
    <a class="tool-card" href="/clp/cursuri/?tab=ditl">
      <div class="tool-icon">🧾</div>
      <div class="tool-name">Rapoarte DITL</div>
      <div class="tool-desc">încasări lunare și taxă DITL (2%) calculată automat</div>
    </a>
  </div>



</body>
</html>
