#!/usr/bin/env php
<?php

$testFiles = glob(__DIR__ . '/*_test.php');
sort($testFiles);

$passed = 0;
$total = count($testFiles);

foreach ($testFiles as $testFile) {
    fwrite(STDOUT, '== ' . basename($testFile) . " ==\n");
    passthru(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($testFile), $exitCode);
    if ($exitCode === 0) {
        $passed++;
    }
}

fwrite(STDOUT, sprintf("%d/%d satellite transcription tests passed\n", $passed, $total));
exit($passed === $total ? 0 : 1);