<?php

$uri = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/');
$repoRoot = dirname(__DIR__);

if (PHP_SAPI === 'cli-server') {
    $staticFile = $repoRoot . $uri;
    if ($uri !== '/' && is_file($staticFile)) {
        return false;
    }
}

if (str_starts_with($uri, '/tancredi/api/v1')) {
    require $repoRoot . '/public/api-v1.php';
    return true;
}

if (str_starts_with($uri, '/provisioning')) {
    require $repoRoot . '/public/provisioning.php';
    return true;
}

http_response_code(404);
header('Content-Type: text/plain; charset=UTF-8');
echo "Not found\n";

return true;