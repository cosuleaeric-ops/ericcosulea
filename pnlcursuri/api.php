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

$db = new SQLite3($db_dir . '/pnl.sqlite');
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
    descriere TEXT NOT NULL,
    categorie TEXT NOT NULL,
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

// Seed default categories
foreach (['Curs', 'Depunere capital social'] as $cat) {
    $s = $db->prepare("INSERT OR IGNORE INTO venit_categorii (nume) VALUES (:n)");
    $s->bindValue(':n', $cat); $s->execute();
}
foreach (['Onorariu curs','Service fee','Impozit curs','Avans','Decont personal','Echipament','Contabilitate','Google Workspace','Hosting','Altele'] as $cat) {
    $s = $db->prepare("INSERT OR IGNORE INTO cheltuiala_categorii (nume) VALUES (:n)");
    $s->bindValue(':n', $cat); $s->execute();
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
            requirePost();
            requireCsrf();
            handleAddCategorie($db, 'venit_categorii');
            break;
        case 'add_categorie_cheltuiala':
            requirePost();
            requireCsrf();
            handleAddCategorie($db, 'cheltuiala_categorii');
            break;
        case 'add_venit':
            requirePost();
            requireCsrf();
            handleAddVenit($db);
            break;
        case 'add_cheltuiala':
            requirePost();
            requireCsrf();
            handleAddCheltuiala($db);
            break;
        case 'edit_venit':
            requirePost();
            requireCsrf();
            handleEditVenit($db);
            break;
        case 'edit_cheltuiala':
            requirePost();
            requireCsrf();
            handleEditCheltuiala($db);
            break;
        case 'delete_venit':
            requirePost();
            requireCsrf();
            handleDelete($db, 'venituri');
            break;
        case 'delete_cheltuiala':
            requirePost();
            requireCsrf();
            handleDelete($db, 'cheltuieli');
            break;
        case 'years':
            handleYears($db);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Acțiune necunoscută']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

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

function handleCategorii(SQLite3 $db, string $table): void
{
    $res  = $db->query("SELECT nume FROM $table ORDER BY id ASC");
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

function handleYears(SQLite3 $db): void
{
    $years = [];
    $res = $db->query("SELECT DISTINCT strftime('%Y', data) as an FROM venituri
        UNION SELECT DISTINCT strftime('%Y', data) as an FROM cheltuieli
        ORDER BY an DESC");
    while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
        $years[] = (int)$row['an'];
    }
    if (empty($years)) {
        $years[] = (int)date('Y');
    }
    echo json_encode($years);
}

function handleStats(SQLite3 $db): void
{
    $year = (string)(int)($_GET['year'] ?? date('Y'));

    $stmt = $db->prepare("SELECT COALESCE(SUM(suma), 0) as total FROM venituri WHERE strftime('%Y', data) = :year");
    $stmt->bindValue(':year', $year);
    $total_v = (float)$stmt->execute()->fetchArray(SQLITE3_ASSOC)['total'];

    $stmt = $db->prepare("SELECT COALESCE(SUM(suma), 0) as total FROM cheltuieli WHERE strftime('%Y', data) = :year");
    $stmt->bindValue(':year', $year);
    $total_c = (float)$stmt->execute()->fetchArray(SQLITE3_ASSOC)['total'];

    $stmt = $db->prepare("SELECT strftime('%Y-%m', data) as luna, COALESCE(SUM(suma), 0) as suma
        FROM venituri WHERE strftime('%Y', data) = :year
        GROUP BY luna ORDER BY luna");
    $stmt->bindValue(':year', $year);
    $res = $stmt->execute();
    $monthly_v = [];
    while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
        $monthly_v[$row['luna']] = (float)$row['suma'];
    }

    $stmt = $db->prepare("SELECT strftime('%Y-%m', data) as luna, COALESCE(SUM(suma), 0) as suma
        FROM cheltuieli WHERE strftime('%Y', data) = :year
        GROUP BY luna ORDER BY luna");
    $stmt->bindValue(':year', $year);
    $res = $stmt->execute();
    $monthly_c = [];
    while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
        $monthly_c[$row['luna']] = (float)$row['suma'];
    }

    $stmt = $db->prepare("SELECT categorie, COALESCE(SUM(suma), 0) as suma
        FROM cheltuieli WHERE strftime('%Y', data) = :year
        GROUP BY categorie ORDER BY suma DESC");
    $stmt->bindValue(':year', $year);
    $res = $stmt->execute();
    $categorii = [];
    while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
        $categorii[] = ['categorie' => $row['categorie'], 'suma' => (float)$row['suma']];
    }

    $all_months = array_unique(array_merge(array_keys($monthly_v), array_keys($monthly_c)));
    sort($all_months);

    $monthly = [];
    $cumulative = 0;
    foreach ($all_months as $luna) {
        $v = $monthly_v[$luna] ?? 0;
        $c = $monthly_c[$luna] ?? 0;
        $profit = $v - $c;
        $cumulative += $profit;
        $monthly[] = [
            'luna' => $luna,
            'venituri' => $v,
            'cheltuieli' => $c,
            'profit' => $profit,
            'cumulative' => $cumulative,
        ];
    }

    echo json_encode([
        'total_venituri' => $total_v,
        'total_cheltuieli' => $total_c,
        'profit_net' => $total_v - $total_c,
        'marja' => $total_v > 0 ? round(($total_v - $total_c) / $total_v * 100, 1) : 0,
        'monthly' => $monthly,
        'categorii_cheltuieli' => $categorii,
        'year' => (int)$year,
    ]);
}

function handleList(SQLite3 $db, string $table): void
{
    $year  = $_GET['year']  ?? null;
    $month = $_GET['month'] ?? null;

    $where  = [];
    $params = [];

    if ($year) {
        $where[]        = "strftime('%Y', data) = :year";
        $params[':year'] = (string)(int)$year;
    }
    if ($month) {
        $where[]         = "strftime('%m', data) = :month";
        $params[':month'] = str_pad((string)(int)$month, 2, '0', STR_PAD_LEFT);
    }

    $sql = "SELECT * FROM $table";
    if ($where) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $sql .= ' ORDER BY data DESC, id DESC';

    $stmt = $db->prepare($sql);
    foreach ($params as $k => $v) {
        $stmt->bindValue($k, $v);
    }
    $res  = $stmt->execute();
    $rows = [];
    while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
        $rows[] = $row;
    }
    echo json_encode($rows);
}

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

    // Store category in the 'descriere' column (backward-compatible)
    $stmt = $db->prepare("INSERT INTO venituri (data, descriere, suma) VALUES (:data, :descriere, :suma)");
    $stmt->bindValue(':data', $data);
    $stmt->bindValue(':descriere', $categorie);
    $stmt->bindValue(':suma', $suma);
    $stmt->execute();

    echo json_encode(['id' => $db->lastInsertRowID(), 'success' => true]);
}

function handleAddCheltuiala(SQLite3 $db): void
{
    $data      = trim($_POST['data']      ?? '');
    $categorie = trim($_POST['categorie'] ?? '');
    $suma      = (float)($_POST['suma']   ?? 0);

    if (!$data || !$categorie || $suma <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Date incomplete sau invalide']);
        return;
    }

    $stmt = $db->prepare("INSERT INTO cheltuieli (data, descriere, categorie, suma) VALUES (:data, :descriere, :categorie, :suma)");
    $stmt->bindValue(':data', $data);
    $stmt->bindValue(':descriere', $categorie);
    $stmt->bindValue(':categorie', $categorie);
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

function handleEditCheltuiala(SQLite3 $db): void
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

    $stmt = $db->prepare("UPDATE cheltuieli SET data=:data, descriere=:descriere, categorie=:categorie, suma=:suma WHERE id=:id");
    $stmt->bindValue(':data', $data);
    $stmt->bindValue(':descriere', $categorie);
    $stmt->bindValue(':categorie', $categorie);
    $stmt->bindValue(':suma', $suma);
    $stmt->bindValue(':id', $id);
    $stmt->execute();

    echo json_encode(['success' => true]);
}

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
