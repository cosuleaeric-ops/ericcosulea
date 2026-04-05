<?php
echo 'pas1 - PHP merge<br>';
require __DIR__ . '/../../admin/auth.php';
echo 'pas2 - auth ok<br>';
require __DIR__ . '/db.php';
echo 'pas3 - db.php ok<br>';
$db = get_clp_db();
echo 'pas4 - SQLite ok<br>';
