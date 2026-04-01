<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
logout_admin();
header('Location: /admin/login.php');
exit;
