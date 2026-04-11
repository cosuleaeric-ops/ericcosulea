<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
require __DIR__ . '/webauthn-helpers.php';
require_login();

function h(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

$needsAuth     = !webauthn_has_credentials();
$isVerified    = !empty($_SESSION['journal_verified']);
$showJournal   = !$needsAuth && $isVerified;

// ── DB setup ─────────────────────────────────────────────────────────────────
$dbPath = __DIR__ . '/../data/blog.sqlite';
$db = new SQLite3($dbPath);
$db->exec('CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_number INTEGER NOT NULL,
    year INTEGER NOT NULL,
    week_start TEXT NOT NULL,
    week_end TEXT NOT NULL,
    rezumat TEXT DEFAULT \'\',
    wins TEXT DEFAULT \'\',
    challenges TEXT DEFAULT \'\',
    lessons TEXT DEFAULT \'\',
    completed INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(week_number, year)
);');

// ── Handle POST (save / complete) ────────────────────────────────────────────
$saveMsg = '';
if ($showJournal && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf($_POST['csrf_token'] ?? '')) {
        http_response_code(400);
        exit('CSRF invalid');
    }

    $entryId    = (int)($_POST['entry_id'] ?? 0);
    $rezumat    = $_POST['rezumat'] ?? '';
    $wins       = $_POST['wins'] ?? '';
    $challenges = $_POST['challenges'] ?? '';
    $lessons    = $_POST['lessons'] ?? '';
    $complete   = isset($_POST['complete']);

    if ($entryId > 0) {
        // Check if trying to complete — all fields must be non-empty
        if ($complete) {
            if (trim($rezumat) === '' || trim($wins) === '' || trim($challenges) === '' || trim($lessons) === '') {
                $saveMsg = 'err:Completează toate cele 4 secțiuni înainte de a finaliza săptămâna.';
            } else {
                $stmt = $db->prepare('UPDATE journal_entries SET rezumat=:r, wins=:w, challenges=:c, lessons=:l, completed=1, updated_at=:u WHERE id=:id');
                $stmt->bindValue(':r', $rezumat, SQLITE3_TEXT);
                $stmt->bindValue(':w', $wins, SQLITE3_TEXT);
                $stmt->bindValue(':c', $challenges, SQLITE3_TEXT);
                $stmt->bindValue(':l', $lessons, SQLITE3_TEXT);
                $stmt->bindValue(':u', date('c'), SQLITE3_TEXT);
                $stmt->bindValue(':id', $entryId, SQLITE3_INTEGER);
                $stmt->execute();
                $saveMsg = 'ok:Săptămâna a fost finalizată!';
            }
        } else {
            $stmt = $db->prepare('UPDATE journal_entries SET rezumat=:r, wins=:w, challenges=:c, lessons=:l, updated_at=:u WHERE id=:id');
            $stmt->bindValue(':r', $rezumat, SQLITE3_TEXT);
            $stmt->bindValue(':w', $wins, SQLITE3_TEXT);
            $stmt->bindValue(':c', $challenges, SQLITE3_TEXT);
            $stmt->bindValue(':l', $lessons, SQLITE3_TEXT);
            $stmt->bindValue(':u', date('c'), SQLITE3_TEXT);
            $stmt->bindValue(':id', $entryId, SQLITE3_INTEGER);
            $stmt->execute();
            $saveMsg = 'ok:Salvat!';
        }
    }
}

// ── Auto-create weeks ────────────────────────────────────────────────────────
if ($showJournal) {
    // Seed W15 2026 if no entries exist
    $count = (int)$db->querySingle('SELECT COUNT(*) FROM journal_entries');
    if ($count === 0) {
        $stmt = $db->prepare('INSERT INTO journal_entries (week_number, year, week_start, week_end, created_at, updated_at) VALUES (15, 2026, \'2026-04-06\', \'2026-04-12\', :now, :now)');
        $stmt->bindValue(':now', date('c'), SQLITE3_TEXT);
        $stmt->execute();
    }

    // Check if we should create a new week (Saturday check)
    $today    = new DateTime('now', new DateTimeZone('Europe/Bucharest'));
    $dayOfWeek = (int)$today->format('N'); // 1=Mon, 6=Sat, 7=Sun

    if ($dayOfWeek >= 6) { // Saturday or Sunday
        // Get the Monday of the current week
        $monday = clone $today;
        $monday->modify('monday this week');
        $currentWeekNum  = (int)$monday->format('W');
        $currentWeekYear = (int)$monday->format('o');

        // Check if this week's entry already exists
        $stmt = $db->prepare('SELECT id FROM journal_entries WHERE week_number=:w AND year=:y');
        $stmt->bindValue(':w', $currentWeekNum, SQLITE3_INTEGER);
        $stmt->bindValue(':y', $currentWeekYear, SQLITE3_INTEGER);
        $existing = $stmt->execute()->fetchArray();

        if (!$existing) {
            // Check if the latest entry is completed
            $latest = $db->querySingle('SELECT completed FROM journal_entries ORDER BY year DESC, week_number DESC LIMIT 1');
            if ((int)$latest === 1) {
                $sunday = clone $monday;
                $sunday->modify('+6 days');
                $stmt = $db->prepare('INSERT INTO journal_entries (week_number, year, week_start, week_end, created_at, updated_at) VALUES (:w, :y, :ws, :we, :now, :now)');
                $stmt->bindValue(':w', $currentWeekNum, SQLITE3_INTEGER);
                $stmt->bindValue(':y', $currentWeekYear, SQLITE3_INTEGER);
                $stmt->bindValue(':ws', $monday->format('Y-m-d'), SQLITE3_TEXT);
                $stmt->bindValue(':we', $sunday->format('Y-m-d'), SQLITE3_TEXT);
                $stmt->bindValue(':now', date('c'), SQLITE3_TEXT);
                $stmt->execute();
            }
        }
    }
}

// ── Fetch entries ────────────────────────────────────────────────────────────
$entries = [];
if ($showJournal) {
    $result = $db->query('SELECT * FROM journal_entries ORDER BY year DESC, week_number DESC');
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) $entries[] = $row;
}

$csrfToken = csrf_token();
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Journal — Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div class="admin-bar">
    <div class="admin-bar-inner">
      <a class="btn" href="/admin/">Admin</a>
      <a class="btn" href="/">Website</a>
      <a class="btn" href="/admin/logout.php" style="margin-left:auto">Logout</a>
    </div>
  </div>

  <div class="journal-wrap">

<?php if ($needsAuth): ?>
    <!-- ── SETUP: Register Touch ID ── -->
    <div class="journal-auth-box">
      <h1>journal</h1>
      <p>Configurează Touch ID pentru a accesa jurnalul.</p>
      <button class="btn journal-auth-btn" id="btn-register">Activează Touch ID</button>
      <p id="auth-status" class="journal-auth-status"></p>
    </div>

    <script>
    (function() {
      const btn = document.getElementById('btn-register');
      const status = document.getElementById('auth-status');
      const csrf = <?php echo json_encode($csrfToken); ?>;

      btn.addEventListener('click', async () => {
        status.textContent = 'Se pregătește...';
        try {
          // 1. Get challenge from server
          const res = await fetch('/admin/journal-auth.php?action=register-challenge');
          const data = await res.json();
          if (!data.ok) throw new Error(data.error);

          // 2. Create credential via WebAuthn
          const challengeBytes = Uint8Array.from(atob(data.challenge), c => c.charCodeAt(0));
          const userIdBytes = Uint8Array.from(atob(data.user.id), c => c.charCodeAt(0));

          const credential = await navigator.credentials.create({
            publicKey: {
              challenge: challengeBytes,
              rp: { name: data.rp.name, id: data.rp.id },
              user: {
                id: userIdBytes,
                name: data.user.name,
                displayName: data.user.displayName,
              },
              pubKeyCredParams: [{ alg: -7, type: 'public-key' }], // ES256
              authenticatorSelection: {
                authenticatorAttachment: 'platform', // Touch ID only
                userVerification: 'required',
              },
              timeout: 60000,
            }
          });

          // 3. Send attestation to server
          const attResponse = credential.response;
          const verifyRes = await fetch('/admin/journal-auth.php?action=register-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              csrf_token: csrf,
              attestationObject: btoa(String.fromCharCode(...new Uint8Array(attResponse.attestationObject))),
              clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(attResponse.clientDataJSON))),
            }),
          });
          const verifyData = await verifyRes.json();

          if (verifyData.ok) {
            status.textContent = 'Touch ID activat!';
            status.classList.add('success');
            setTimeout(() => location.reload(), 800);
          } else {
            throw new Error(verifyData.error);
          }
        } catch (e) {
          status.textContent = 'Eroare: ' + e.message;
          status.classList.add('err');
        }
      });
    })();
    </script>

<?php elseif (!$isVerified): ?>
    <!-- ── VERIFY: Touch ID prompt ── -->
    <div class="journal-auth-box">
      <h1>journal</h1>
      <p>Autentifică-te cu Touch ID pentru a accesa jurnalul.</p>
      <button class="btn journal-auth-btn" id="btn-verify">Verifică Touch ID</button>
      <p id="auth-status" class="journal-auth-status"></p>
    </div>

    <script>
    (function() {
      const btn = document.getElementById('btn-verify');
      const status = document.getElementById('auth-status');
      const csrf = <?php echo json_encode($csrfToken); ?>;

      async function doVerify() {
        status.textContent = 'Se verifică...';
        try {
          // 1. Get challenge
          const res = await fetch('/admin/journal-auth.php?action=auth-challenge');
          const data = await res.json();
          if (!data.ok) throw new Error(data.error);

          const challengeBytes = Uint8Array.from(atob(data.challenge), c => c.charCodeAt(0));
          const allowCreds = data.allowCredentials.map(c => ({
            id: Uint8Array.from(atob(c.id), ch => ch.charCodeAt(0)),
            type: c.type,
          }));

          // 2. Verify via WebAuthn
          const assertion = await navigator.credentials.get({
            publicKey: {
              challenge: challengeBytes,
              rpId: data.rpId,
              allowCredentials: allowCreds,
              userVerification: 'required',
              timeout: 60000,
            }
          });

          // 3. Send assertion to server
          const aResponse = assertion.response;
          const verifyRes = await fetch('/admin/journal-auth.php?action=auth-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              csrf_token: csrf,
              credentialId: btoa(String.fromCharCode(...new Uint8Array(assertion.rawId))),
              authenticatorData: btoa(String.fromCharCode(...new Uint8Array(aResponse.authenticatorData))),
              clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(aResponse.clientDataJSON))),
              signature: btoa(String.fromCharCode(...new Uint8Array(aResponse.signature))),
            }),
          });
          const verifyData = await verifyRes.json();

          if (verifyData.ok) {
            status.textContent = 'Verificat!';
            status.classList.add('success');
            setTimeout(() => location.reload(), 500);
          } else {
            throw new Error(verifyData.error);
          }
        } catch (e) {
          status.textContent = 'Eroare: ' + e.message;
          status.classList.add('err');
        }
      }

      btn.addEventListener('click', doVerify);
      // Auto-trigger on page load
      doVerify();
    })();
    </script>

<?php else: ?>
    <!-- ── JOURNAL ENTRIES ── -->
    <h1>journal</h1>

    <?php if ($saveMsg): ?>
      <?php
        $msgParts = explode(':', $saveMsg, 2);
        $msgType  = $msgParts[0];
        $msgText  = $msgParts[1] ?? '';
      ?>
      <div class="journal-msg <?php echo $msgType === 'ok' ? 'success' : 'err'; ?>">
        <?php echo h($msgText); ?>
      </div>
    <?php endif; ?>

    <?php if (empty($entries)): ?>
      <p class="journal-empty">Nicio intrare de jurnal.</p>
    <?php endif; ?>

    <?php foreach ($entries as $i => $entry): ?>
      <?php
        $weekLabel = "Săptămâna {$entry['week_number']}, {$entry['year']}";
        $dateRange = date('j M', strtotime($entry['week_start'])) . ' – ' . date('j M Y', strtotime($entry['week_end']));
        $isOpen    = ($i === 0 && !(int)$entry['completed']);
        $isCompleted = (int)$entry['completed'];
      ?>
      <details class="journal-week <?php echo $isCompleted ? 'journal-week--done' : ''; ?>"<?php echo $isOpen ? ' open' : ''; ?>>
        <summary class="journal-week-toggle">
          <span class="journal-week-label">
            <?php if ($isCompleted): ?><span class="journal-check">&#10003;</span><?php endif; ?>
            <?php echo h($weekLabel); ?>
          </span>
          <span class="journal-week-date"><?php echo h($dateRange); ?></span>
        </summary>

        <form method="post" class="journal-form">
          <input type="hidden" name="csrf_token" value="<?php echo h($csrfToken); ?>">
          <input type="hidden" name="entry_id" value="<?php echo (int)$entry['id']; ?>">

          <label class="journal-label">&#x1F4DD; Rezumat</label>
          <textarea name="rezumat" class="journal-textarea" rows="4"<?php echo $isCompleted ? ' disabled' : ''; ?>><?php echo h($entry['rezumat']); ?></textarea>

          <label class="journal-label">&#x1F3C6; Wins — Ce a mers bine?</label>
          <p class="journal-hint">Enumeră 3 lucruri care au funcționat sau te-au făcut să te simți bine în această săptămână.</p>
          <textarea name="wins" class="journal-textarea" rows="4"<?php echo $isCompleted ? ' disabled' : ''; ?>><?php echo h($entry['wins']); ?></textarea>

          <label class="journal-label">&#x1FAA8; Challenges — Ce n-a mers bine?</label>
          <p class="journal-hint">Unde ai simțit că te-ai împotmolit, ai eșuat sau ai fost nemulțumit? De ce crezi că s-a întâmplat asta?</p>
          <textarea name="challenges" class="journal-textarea" rows="4"<?php echo $isCompleted ? ' disabled' : ''; ?>><?php echo h($entry['challenges']); ?></textarea>

          <label class="journal-label">&#x1F9E0; Lessons — Ce ai învățat?</label>
          <p class="journal-hint">Ai învățat ceva din greșeli? Ai învățat o lecție nouă sau (re)definit un principiu?</p>
          <textarea name="lessons" class="journal-textarea" rows="4"<?php echo $isCompleted ? ' disabled' : ''; ?>><?php echo h($entry['lessons']); ?></textarea>

          <?php if (!$isCompleted): ?>
            <div class="journal-actions">
              <button type="submit" class="btn">Salvează</button>
              <button type="submit" name="complete" value="1" class="btn journal-btn-complete" onclick="return confirm('Finalizezi săptămâna? Nu vei mai putea edita.')">Completează săptămâna</button>
            </div>
          <?php endif; ?>
        </form>
      </details>
    <?php endforeach; ?>

<?php endif; ?>

  </div>
</body>
</html>
