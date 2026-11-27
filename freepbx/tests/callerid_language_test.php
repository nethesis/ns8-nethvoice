<?php
// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: GPL-3.0-or-later

require $argv[2] . '/amp_conf/htdocs/admin/libraries/extensions.class.php';
require $argv[1] . '/Dialplan/macroUserCallerid.php';

$amp_conf = ['NOOPTRACE' => false];
$ext = new extensions();
\FreePBX\modules\Core\Dialplan\macroUserCallerid::add($ext);
preg_match_all('/^exten => s,[^,]+,(.*)$/m', $ext->generateConf(), $steps);

$language = array_search('Set(CHANNEL(language)=${MASTER_CHANNEL(CHANNEL(language))})', $steps[1], true);
$return = array_search('Return()', $steps[1], true);
if ($language === false || $return === false || $language >= $return) {
    throw new RuntimeException('The caller ID subroutine must copy the master channel language before returning');
}

echo "PASS: caller ID copies the master channel language before returning\n";
