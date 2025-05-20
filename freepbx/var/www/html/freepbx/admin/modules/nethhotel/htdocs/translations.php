<?php
include_once('/etc/freepbx.conf');
require_once(__DIR__."/functions.inc.php");
$supported_audio_langs = array('it', 'en', 'es', 'ru', 'de', 'fr');
$supported_langs = array('it', 'en', 'es');
$user_lang = 'en'; // Default
$receptionLang = getReceptionAudioLang();

if (in_array($receptionLang,$supported_langs)) {
    $user_lang = $receptionLang;
}

$user_lang = $user_lang ."_". strtoupper($user_lang);

textdomain('nethhotel');
bindtextdomain('nethhotel',dirname(__FILE__).'/i18n');
bind_textdomain_codeset("nethhotel", 'UTF8');
setlocale( LC_MESSAGES, $user_lang);
putenv("LANG=".$user_lang);
putenv("LANGUAGE=".$user_lang);

