<?php
$crons = \FreePBX::Cron()->getAll();
foreach($crons as $c) {
	if(preg_match('/fwconsole calendar sync/',$c,$matches)) {
		\FreePBX::Cron()->remove($c);
	}
	if(preg_match('/fwconsole calendar --sync/',$c,$matches)) {
		\FreePBX::Cron()->remove($c);
	}
}

$ampbin = \FreePBX::Config()->get('AMPSBIN');
\FreePBX::Cron()->add(array(
	'minute' => '*/1',
	"command" => $ampbin.'/fwconsole calendar --sync 2>&1 > /dev/null')
);
