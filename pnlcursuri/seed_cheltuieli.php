<?php
declare(strict_types=1);

require __DIR__ . '/../admin/auth.php';

if (!is_logged_in()) {
    header('Location: /admin/login.php?redirect=/pnlcursuri/seed_cheltuieli.php');
    exit;
}

$db_dir = __DIR__ . '/data';
if (!is_dir($db_dir)) mkdir($db_dir, 0750, true);

$db = new SQLite3($db_dir . '/pnl.sqlite');
$db->enableExceptions(true);
$db->exec('PRAGMA journal_mode=WAL');

$db->exec("CREATE TABLE IF NOT EXISTS cheltuieli (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    descriere TEXT NOT NULL,
    categorie TEXT NOT NULL,
    suma REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)");

// [data, descriere, categorie, suma]
$cheltuieli = [
    ['2026-01-28', 'Service fee',       'Service fee',      40.00  ],
    ['2026-02-01', 'Contabilitate',     'Contabilitate',     1.19  ],
    ['2026-02-03', 'Echipament Altex',  'Echipament',       27.90  ],
    ['2026-02-03', 'Decont Eric',       'Decont personal',  12.37  ],
    ['2026-02-03', 'Service fee',       'Service fee',       0.45  ],
    ['2026-02-03', 'Decont Eric',       'Decont personal', 899.27  ],
    ['2026-02-03', 'Service fee',       'Service fee',       0.45  ],
    ['2026-02-03', 'Google Workspace',  'Google Workspace',  2.21  ],
    ['2026-02-04', 'Onorariu curs',     'Onorariu curs',   350.00  ],
    ['2026-02-04', 'Service fee',       'Service fee',       0.45  ],
    ['2026-02-05', 'Host',              'Hosting',          69.05  ],
    ['2026-02-06', 'Onorariu curs',     'Onorariu curs',   400.00  ],
    ['2026-02-06', 'Service fee',       'Service fee',       0.45  ],
    ['2026-02-08', 'Echipament',        'Echipament',       68.10  ],
    ['2026-02-12', 'Impozit',           'Impozit',          64.00  ],
    ['2026-02-12', 'Service fee',       'Service fee',       0.51  ],
    ['2026-02-18', 'Impozit',           'Impozit',          35.00  ],
    ['2026-02-18', 'Service fee',       'Service fee',       5.00  ],
    ['2026-02-18', 'Service fee',       'Service fee',       5.00  ],
    ['2026-02-20', 'Onorariu curs',     'Onorariu curs',   376.00  ],
    ['2026-02-20', 'Service fee',       'Service fee',       5.00  ],
    ['2026-02-20', 'Onorariu curs',     'Onorariu curs',   700.00  ],
    ['2026-02-20', 'Service fee',       'Service fee',       5.00  ],
    ['2026-02-23', 'Avans Eric',        'Avans',          1000.00  ],
    ['2026-02-23', 'Avans Sara',        'Avans',           500.00  ],
    ['2026-02-23', 'Service fee',       'Service fee',       5.00  ],
    ['2026-02-27', 'Avans Eric',        'Avans',          1000.00  ],
    ['2026-02-28', 'Service fee',       'Service fee',      40.00  ],
    ['2026-03-03', 'Google Workspace',  'Google Workspace', 48.85  ],
];

$stmt = $db->prepare("INSERT INTO cheltuieli (data, descriere, categorie, suma) VALUES (:data, :descriere, :categorie, :suma)");
foreach ($cheltuieli as [$data, $descriere, $categorie, $suma]) {
    $stmt->bindValue(':data', $data);
    $stmt->bindValue(':descriere', $descriere);
    $stmt->bindValue(':categorie', $categorie);
    $stmt->bindValue(':suma', $suma);
    $stmt->execute();
}

unlink(__FILE__);

header('Location: /pnlcursuri/');
exit;
