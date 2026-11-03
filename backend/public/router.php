<?php
declare(strict_types=1);

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if (is_string($requestPath) && $requestPath !== '/api' && !str_starts_with($requestPath, '/api/')) {
    $staticFile = __DIR__ . DIRECTORY_SEPARATOR . ltrim($requestPath, DIRECTORY_SEPARATOR);
    if (is_file($staticFile)) {
        return false;
    }
}

require __DIR__ . DIRECTORY_SEPARATOR . 'index.php';
