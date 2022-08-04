<?php

$lang = $_SERVER['HTTP_ACCEPT_LANGUAGE'];
preg_match_all('/(\W|^)([a-z]{2})([^a-z]|$)/six', $lang, $m, PREG_PATTERN_ORDER);
$user_langs = $m[2];

$supported_langs = array('it', 'en');
$user_lang = 'en';
foreach ($user_langs as $tmp) {
    if (in_array($tmp, $supported_langs)) {
        $user_lang = $tmp;
        break;
    }
}

$directory = dirname(__FILE__) . '/../../i18n';
$domain = 'queue-report';
$locale = $user_lang;
$user_lang = $user_lang . '_' . strtoupper($user_lang);

setlocale(LC_MESSAGES, $locale);
putenv("LANG=$user_lang");
bindtextdomain($domain, $directory);
textdomain($domain);
bind_textdomain_codeset($domain, 'UTF-8');
