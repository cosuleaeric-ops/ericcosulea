<?php
declare(strict_types=1);

require __DIR__ . '/../admin/auth.php';

if (!is_logged_in()) {
    http_response_code(401);
    echo json_encode(['error' => 'Neautorizat']);
    exit;
}

header('Content-Type: application/json; charset=utf-8');

$db_dir = __DIR__ . '/data';
if (!is_dir($db_dir)) {
    mkdir($db_dir, 0750, true);
}

$db = new SQLite3($db_dir . '/pnlpersonal.sqlite');
$db->enableExceptions(true);
$db->busyTimeout(5000);
$db->exec('PRAGMA journal_mode=WAL');

$db->exec("CREATE TABLE IF NOT EXISTS venituri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    descriere TEXT NOT NULL,
    suma REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)");

$db->exec("CREATE TABLE IF NOT EXISTS cheltuieli (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    categorie TEXT NOT NULL,
    detalii TEXT NOT NULL DEFAULT '',
    suma REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)");

$db->exec("CREATE TABLE IF NOT EXISTS venit_categorii (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nume TEXT NOT NULL UNIQUE
)");

$db->exec("CREATE TABLE IF NOT EXISTS cheltuiala_categorii (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nume TEXT NOT NULL UNIQUE
)");

$db->exec("CREATE TABLE IF NOT EXISTS portofel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    cash REAL NOT NULL DEFAULT 0,
    ing REAL NOT NULL DEFAULT 0,
    revolut REAL NOT NULL DEFAULT 0,
    trading212 REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)");

// Migrations
$db->exec("UPDATE cheltuiala_categorii SET nume = 'Cadou 🎁' WHERE nume = 'Zi de nastere 🎁'");

// Seed default categories
foreach (['Salariu', 'Mama', '2Performant', 'Profitshare', 'Trading212', 'Vinted'] as $cat) {
    $s = $db->prepare("INSERT OR IGNORE INTO venit_categorii (nume) VALUES (:n)");
    $s->bindValue(':n', $cat);
    $s->execute();
}
foreach ([
    'Groceries 🍎', 'Snacks 🍫', 'Fast-food 🍔', 'Cafea ☕', 'Fun 🎳',
    'Igiena 🧼', 'Transport 🚌', 'Abonamente 📺', 'Proiecte 💻', 'Chirie 🏠', 'Altele 📦'
] as $cat) {
    $s = $db->prepare("INSERT OR IGNORE INTO cheltuiala_categorii (nume) VALUES (:n)");
    $s->bindValue(':n', $cat);
    $s->execute();
}

$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'stats':
            handleStats($db);
            break;
        case 'venituri':
            handleList($db, 'venituri');
            break;
        case 'cheltuieli':
            handleList($db, 'cheltuieli');
            break;
        case 'categorii_venituri':
            handleCategorii($db, 'venit_categorii');
            break;
        case 'categorii_cheltuieli':
            handleCategorii($db, 'cheltuiala_categorii');
            break;
        case 'add_categorie_venit':
            requirePost(); requireCsrf();
            handleAddCategorie($db, 'venit_categorii');
            break;
        case 'add_categorie_cheltuiala':
            requirePost(); requireCsrf();
            handleAddCategorie($db, 'cheltuiala_categorii');
            break;
        case 'add_venit':
            requirePost(); requireCsrf();
            handleAddVenit($db);
            break;
        case 'add_cheltuiala':
            requirePost(); requireCsrf();
            handleAddCheltuiala($db);
            break;
        case 'edit_venit':
            requirePost(); requireCsrf();
            handleEditVenit($db);
            break;
        case 'edit_cheltuiala':
            requirePost(); requireCsrf();
            handleEditCheltuiala($db);
            break;
        case 'delete_venit':
            requirePost(); requireCsrf();
            handleDelete($db, 'venituri');
            break;
        case 'delete_cheltuiala':
            requirePost(); requireCsrf();
            handleDelete($db, 'cheltuieli');
            break;
        case 'periods':
            handlePeriods($db);
            break;
        case 'add_portofel':
            requirePost(); requireCsrf();
            handleAddPortofel($db);
            break;
        case 'edit_portofel':
            requirePost(); requireCsrf();
            handleEditPortofel($db);
            break;
        case 'delete_portofel':
            requirePost(); requireCsrf();
            handleDelete($db, 'portofel');
            break;
        case 'latest_portofel':
            handleLatestPortofel($db);
            break;
        case 'last_entry':
            handleLastEntry($db);
            break;
        case 'list_portofel':
            handleListPortofel($db);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Acțiune necunoscută']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

// ── Guards ───────────────────────────────────────────────────────────────────

function requirePost(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }
}

function requireCsrf(): void
{
    $token = $_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if (!verify_csrf($token)) {
        http_response_code(403);
        echo json_encode(['error' => 'Token CSRF invalid']);
        exit;
    }
}

// ── Categories ───────────────────────────────────────────────────────────────

function handleCategorii(SQLite3 $db, string $table): void
{
    $res  = $db->query("SELECT nume FROM $table ORDER BY nume ASC");
    $cats = [];
    while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
        $cats[] = $row['nume'];
    }
    echo json_encode($cats);
}

function handleAddCategorie(SQLite3 $db, string $table): void
{
    $nume = trim($_POST['nume'] ?? '');
    if (!$nume) {
        http_response_code(400);
        echo json_encode(['error' => 'Nume invalid']);
        return;
    }
    $stmt = $db->prepare("INSERT OR IGNORE INTO $table (nume) VALUES (:n)");
    $stmt->bindValue(':n', $nume);
    $stmt->execute();
    echo json_encode(['success' => true, 'nume' => $nume]);
}

// ── Periods ──────────────────────────────────────────────────────────────────

function handlePeriods(SQLite3 $db): void
{
    $month_names = ['', 'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
                    'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];

    $res = $db->query("
        SELECT DISTINCT strftime('%Y', data) as an, strftime('%m', data) as luna
        FROM venituri
        UNION
        SELECT DISTINCT strftime('%Y', data) as an, strftime('%m', data) as luna
        FROM cheltuieli
        ORDER BY an DESC, luna DESC
    ");

    $by_year = [];
    while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
        $by_year[(int)$row['an']][] = (int)$row['luna'];
    }

    if (empty($by_year)) {
        $by_year[(int)date('Y')] = [];
    }

    $periods = [];
    foreach ($by_year as $year => $months) {
        $periods[] = ['value' => (string)$year, 'label' => (string)$year, 'year' => $year, 'month' => null];
        foreach ($months as $m) {
            $periods[] = ['value' => "$year-$m", 'label' => $month_names[$m] . ' ' . $year, 'year' => $year, 'month' => $m];
        }
    }

    echo json_encode($periods);
}

// ── Stats ────────────────────────────────────────────────────────────────────

function handleStats(SQLite3 $db): void
{
    $year  = (string)(int)($_GET['year'] ?? date('Y'));
    $month = isset($_GET['month']) ? str_pad((string)(int)$_GET['month'], 2, '0', STR_PAD_LEFT) : null;

    $date_filter = "strftime('%Y', data) = :year";
    if ($month) $date_filter .= " AND strftime('%m', data) = :month";

    $bind = function ($stmt) use ($year, $month) {
        $stmt->bindValue(':year', $year);
        if ($month) $stmt->bindValue(':month', $month);
        return $stmt;
    };

    $stmt = $bind($db->prepare("SELECT COALESCE(SUM(suma), 0) as total FROM venituri WHERE $date_filter"));
    $total_v = (float)$stmt->execute()->fetchArray(SQLITE3_ASSOC)['total'];

    $stmt = $bind($db->prepare("SELECT COALESCE(SUM(suma), 0) as total FROM cheltuieli WHERE $date_filter"));
    $total_c = (float)$stmt->execute()->fetchArray(SQLITE3_ASSOC)['total'];

    $group_by = $month ? "strftime('%Y-%m-%d', data)" : "strftime('%Y-%m', data)";

    $stmt = $bind($db->prepare("SELECT $group_by as luna, COALESCE(SUM(suma), 0) as suma
        FROM venituri WHERE $date_filter GROUP BY luna ORDER BY luna"));
    $res = $stmt->execute();
    $monthly_v = [];
    while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
        $monthly_v[$row['luna']] = (float)$row['suma'];
    }

    $stmt = $bind($db->prepare("SELECT $group_by as luna, COALESCE(SUM(suma), 0) as suma
        FROM cheltuieli WHERE $date_filter GROUP BY luna ORDER BY luna"));
    $res = $stmt->execute();
    $monthly_c = [];
    while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
        $monthly_c[$row['luna']] = (float)$row['suma'];
    }

    $stmt = $bind($db->prepare("SELECT categorie, COALESCE(SUM(suma), 0) as suma
        FROM cheltuieli WHERE $date_filter GROUP BY categorie ORDER BY suma DESC"));
    $res = $stmt->execute();
    $categorii = [];
    while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
        $categorii[] = ['categorie' => $row['categorie'], 'suma' => (float)$row['suma']];
    }

    $all_months = array_unique(array_merge(array_keys($monthly_v), array_keys($monthly_c)));
    sort($all_months);

    $monthly    = [];
    $cumulative = 0;
    foreach ($all_months as $luna) {
        $v       = $monthly_v[$luna] ?? 0;
        $c       = $monthly_c[$luna] ?? 0;
        $profit  = $v - $c;
        $cumulative += $profit;
        $monthly[] = [
            'luna'        => $luna,
            'venituri'    => $v,
            'cheltuieli'  => $c,
            'profit'      => $profit,
            'cumulative'  => $cumulative,
        ];
    }

    $month_names_short = ['', 'ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    if ($month) {
        $pm = (int)$month - 1;
        $py = (int)$year;
        if ($pm === 0) { $pm = 12; $py--; }
        $pm_pad     = str_pad((string)$pm, 2, '0', STR_PAD_LEFT);
        $prev_filter = "strftime('%Y', data) = '$py' AND strftime('%m', data) = '$pm_pad'";
        $prev_label  = $month_names_short[$pm] . ' ' . $py;
    } else {
        $py          = (int)$year - 1;
        $prev_filter = "strftime('%Y', data) = '$py'";
        $prev_label  = (string)$py;
    }
    $prev_v     = (float)$db->querySingle("SELECT COALESCE(SUM(suma),0) FROM venituri WHERE $prev_filter");
    $prev_c     = (float)$db->querySingle("SELECT COALESCE(SUM(suma),0) FROM cheltuieli WHERE $prev_filter");
    $profit_prev = $prev_v - $prev_c;

    echo json_encode([
        'total_venituri'       => $total_v,
        'total_cheltuieli'     => $total_c,
        'profit_net'           => $total_v - $total_c,
        'marja'                => $total_v > 0 ? round(($total_v - $total_c) / $total_v * 100, 1) : 0,
        'monthly'              => $monthly,
        'categorii_cheltuieli' => $categorii,
        'year'                 => (int)$year,
        'profit_prev'          => $profit_prev,
        'prev_label'           => $prev_label,
        'prev_cheltuieli'      => $prev_c,
    ]);
}

// ── List ─────────────────────────────────────────────────────────────────────

function handleList(SQLite3 $db, string $table): void
{
    $year  = $_GET['year']  ?? null;
    $month = $_GET['month'] ?? null;

    $where  = [];
    $params = [];

    if ($year) {
        $where[]         = "strftime('%Y', data) = :year";
        $params[':year'] = (string)(int)$year;
    }
    if ($month) {
        $where[]          = "strftime('%m', data) = :month";
        $params[':month'] = str_pad((string)(int)$month, 2, '0', STR_PAD_LEFT);
    }

    $sql = "SELECT * FROM $table";
    if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
    $sql .= ' ORDER BY data DESC, id DESC';

    $stmt = $db->prepare($sql);
    foreach ($params as $k => $v) $stmt->bindValue($k, $v);
    $res  = $stmt->execute();
    $rows = [];
    while ($row = $res->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
    echo json_encode($rows);
}

// ── Venituri CRUD ─────────────────────────────────────────────────────────────

function handleAddVenit(SQLite3 $db): void
{
    $data      = trim($_POST['data']      ?? '');
    $categorie = trim($_POST['categorie'] ?? '');
    $suma      = (float)($_POST['suma']   ?? 0);

    if (!$data || !$categorie || $suma <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Date incomplete sau invalide']);
        return;
    }

    $stmt = $db->prepare("INSERT INTO venituri (data, descriere, suma) VALUES (:data, :descriere, :suma)");
    $stmt->bindValue(':data', $data);
    $stmt->bindValue(':descriere', $categorie);
    $stmt->bindValue(':suma', $suma);
    $stmt->execute();
    echo json_encode(['id' => $db->lastInsertRowID(), 'success' => true]);
}

function handleEditVenit(SQLite3 $db): void
{
    $id        = (int)($_POST['id']       ?? 0);
    $data      = trim($_POST['data']      ?? '');
    $categorie = trim($_POST['categorie'] ?? '');
    $suma      = (float)($_POST['suma']   ?? 0);

    if (!$id || !$data || !$categorie || $suma <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Date incomplete sau invalide']);
        return;
    }

    $stmt = $db->prepare("UPDATE venituri SET data=:data, descriere=:descriere, suma=:suma WHERE id=:id");
    $stmt->bindValue(':data', $data);
    $stmt->bindValue(':descriere', $categorie);
    $stmt->bindValue(':suma', $suma);
    $stmt->bindValue(':id', $id);
    $stmt->execute();
    echo json_encode(['success' => true]);
}

// ── Cheltuieli CRUD ───────────────────────────────────────────────────────────

function handleAddCheltuiala(SQLite3 $db): void
{
    $data      = trim($_POST['data']      ?? '');
    $categorie = trim($_POST['categorie'] ?? '');
    $detalii   = trim($_POST['detalii']   ?? '');
    $suma      = (float)($_POST['suma']   ?? 0);

    if (!$data || !$categorie || $suma <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Date incomplete sau invalide']);
        return;
    }

    $stmt = $db->prepare("INSERT INTO cheltuieli (data, categorie, detalii, suma) VALUES (:data, :categorie, :detalii, :suma)");
    $stmt->bindValue(':data', $data);
    $stmt->bindValue(':categorie', $categorie);
    $stmt->bindValue(':detalii', $detalii);
    $stmt->bindValue(':suma', $suma);
    $stmt->execute();
    echo json_encode(['id' => $db->lastInsertRowID(), 'success' => true]);
}

function handleEditCheltuiala(SQLite3 $db): void
{
    $id        = (int)($_POST['id']       ?? 0);
    $data      = trim($_POST['data']      ?? '');
    $categorie = trim($_POST['categorie'] ?? '');
    $detalii   = trim($_POST['detalii']   ?? '');
    $suma      = (float)($_POST['suma']   ?? 0);

    if (!$id || !$data || !$categorie || $suma <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Date incomplete sau invalide']);
        return;
    }

    $stmt = $db->prepare("UPDATE cheltuieli SET data=:data, categorie=:categorie, detalii=:detalii, suma=:suma WHERE id=:id");
    $stmt->bindValue(':data', $data);
    $stmt->bindValue(':categorie', $categorie);
    $stmt->bindValue(':detalii', $detalii);
    $stmt->bindValue(':suma', $suma);
    $stmt->bindValue(':id', $id);
    $stmt->execute();
    echo json_encode(['success' => true]);
}

// ── Delete (generic) ──────────────────────────────────────────────────────────

function handleDelete(SQLite3 $db, string $table): void
{
    $id = (int)($_POST['id'] ?? 0);
    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'ID invalid']);
        return;
    }
    $stmt = $db->prepare("DELETE FROM $table WHERE id = :id");
    $stmt->bindValue(':id', $id);
    $stmt->execute();
    echo json_encode(['success' => true]);
}

// ── Portofel CRUD ─────────────────────────────────────────────────────────────

function handleAddPortofel(SQLite3 $db): void
{
    $data       = trim($_POST['data']        ?? '');
    $cash       = (float)($_POST['cash']     ?? 0);
    $ing        = (float)($_POST['ing']      ?? 0);
    $revolut    = (float)($_POST['revolut']  ?? 0);
    $trading212 = (float)($_POST['trading212'] ?? 0);

    if (!$data) {
        http_response_code(400);
        echo json_encode(['error' => 'Data este necesară']);
        return;
    }

    $stmt = $db->prepare("INSERT INTO portofel (data, cash, ing, revolut, trading212)
        VALUES (:data, :cash, :ing, :revolut, :trading212)");
    $stmt->bindValue(':data', $data);
    $stmt->bindValue(':cash', $cash);
    $stmt->bindValue(':ing', $ing);
    $stmt->bindValue(':revolut', $revolut);
    $stmt->bindValue(':trading212', $trading212);
    $stmt->execute();
    echo json_encode(['id' => $db->lastInsertRowID(), 'success' => true]);
}

function handleEditPortofel(SQLite3 $db): void
{
    $id         = (int)($_POST['id']           ?? 0);
    $data       = trim($_POST['data']          ?? '');
    $cash       = (float)($_POST['cash']       ?? 0);
    $ing        = (float)($_POST['ing']        ?? 0);
    $revolut    = (float)($_POST['revolut']    ?? 0);
    $trading212 = (float)($_POST['trading212'] ?? 0);

    if (!$id || !$data) {
        http_response_code(400);
        echo json_encode(['error' => 'Date incomplete']);
        return;
    }

    $stmt = $db->prepare("UPDATE portofel SET data=:data, cash=:cash, ing=:ing, revolut=:revolut, trading212=:trading212 WHERE id=:id");
    $stmt->bindValue(':data', $data);
    $stmt->bindValue(':cash', $cash);
    $stmt->bindValue(':ing', $ing);
    $stmt->bindValue(':revolut', $revolut);
    $stmt->bindValue(':trading212', $trading212);
    $stmt->bindValue(':id', $id);
    $stmt->execute();
    echo json_encode(['success' => true]);
}

function handleLatestPortofel(SQLite3 $db): void
{
    $row = $db->querySingle("SELECT * FROM portofel ORDER BY data DESC, id DESC LIMIT 1", true);
    echo json_encode($row ?: null);
}

function handleListPortofel(SQLite3 $db): void
{
    $year  = isset($_GET['year'])  ? (int)$_GET['year']  : null;
    $month = isset($_GET['month']) ? (int)$_GET['month'] : null;

    if ($year && $month) {
        $prefix = sprintf('%04d-%02d', $year, $month);
        $stmt = $db->prepare("SELECT * FROM portofel WHERE data LIKE :p ORDER BY data DESC, id DESC");
        $stmt->bindValue(':p', $prefix . '%');
    } elseif ($year) {
        $stmt = $db->prepare("SELECT * FROM portofel WHERE data LIKE :p ORDER BY data DESC, id DESC");
        $stmt->bindValue(':p', $year . '%');
    } else {
        $limit = min((int)($_GET['limit'] ?? 20), 500);
        $stmt  = $db->prepare("SELECT * FROM portofel ORDER BY data DESC, id DESC LIMIT :limit");
        $stmt->bindValue(':limit', $limit);
    }

    $res  = $stmt->execute();
    $rows = [];
    while ($row = $res->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
    echo json_encode($rows);
}

function handleLastEntry(SQLite3 $db): void
{
    $row = $db->querySingle("SELECT data FROM cheltuieli ORDER BY data DESC, id DESC LIMIT 1", true);
    echo json_encode($row ? ['data' => $row['data']] : null);
}
