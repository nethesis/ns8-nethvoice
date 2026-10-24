<?php
require __DIR__ . '/../../var/www/html/freepbx/rest/lib/agents/PublishedContract.php';
try {
    \NethVoice\Agents\PublishedContract::validate(json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR));
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, "invalid_snapshot\n");
    exit(1);
}
