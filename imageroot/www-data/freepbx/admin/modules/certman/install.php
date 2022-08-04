<?php

$ampsbin = FreePBX::Config()->get("AMPSBIN");
foreach(FreePBX::Cron()->getAll() as $cron) {
	$str = "fwconsole certificates updateall -q";
	if(preg_match("/".$str."/i",$cron,$matches)) {
		FreePBX::Cron()->remove($cron);
	}
	$str = "fwconsole certificates --updateall -q";
	if(preg_match("/".$str."/i",$cron,$matches)) {
		FreePBX::Cron()->remove($cron);
	}
}
FreePBX::Cron()->add(array(
	"command" => $ampsbin."/fwconsole certificates --updateall -q 2>&1 >/dev/null",
	"hour" => rand(0,3),
	"minute" => rand(0,59),
));
