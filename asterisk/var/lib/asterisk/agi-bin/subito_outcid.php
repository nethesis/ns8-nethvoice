#!/bin/env php
<?php

include_once '/etc/freepbx_db.conf';
include_once '/var/www/html/freepbx/rest/lib/libExtensions.php';
include_once '/var/www/html/freepbx/rest/lib/libUsers.php';

define("AGIBIN_DIR", "/var/lib/asterisk/agi-bin");
include(AGIBIN_DIR."/phpagi.php");
$agi = new AGI();

// Get caller
$caller_extension = $argv[1];
$dial = $argv[2];

// get caller mainextension
$mainextension = getMainExtension($caller_extension);

// get all CTI groups
$dbh = FreePBX::Database();
$sql = 'SELECT id, name FROM `rest_cti_groups`';
$res = $dbh->sql($sql, 'getAll', \PDO::FETCH_ASSOC);

// get all users
$users = getAllUsers();

// get caller user
$id = null;
foreach ($users as $u) {
	if ($u['default_extension'] === $mainextension) {
		$id = $u['id'];
		break;
	}
}
if (is_null($id)) {
	$agi->verbose("no user has $mainextension as default_extension");
	exit(0);
}

// get caller groups
$sql = 'SELECT rest_cti_groups.id, rest_cti_groups.name'.
            ' FROM rest_cti_groups'.
            ' JOIN rest_cti_users_groups ON rest_cti_users_groups.group_id = rest_cti_groups.id'.
            ' WHERE rest_cti_users_groups.user_id = ?';
$sth = $dbh->prepare($sql);
$sth->execute(array($id));

$data = array();

// list of groups that needs to have number changed
$groups = ["Motori","Real Estate","Market"];

$change_cid = False;
while ($res = $sth->fetchObject()) {
	if (in_array($res->name,$groups)) {
		$change_cid = True;
		break;
	}
}

// exit if caller doesn't belong to groups that needs to have number changed
if (!$change_cid) {
	$agi->verbose("User doesn't belong to ".implode(",",$groups)." groups");
	exit(0);
}

// Get prefix for called number
$dial_length = strlen($dial);
$sql = 'SELECT * FROM zone WHERE ';
for ($i=0; $i<$dial_length; $i++) {
    $prefixes[] = substr($dial, 0, -$i);
    $sql .= 'prefisso = ? OR ';
}
$sql .= '1=2 ORDER BY LENGTH(prefisso) DESC LIMIT 1';
$sth = $cdrdb->prepare($sql);
$sth->execute($prefixes);
$region = $sth->fetchAll(\PDO::FETCH_ASSOC)[0]['regione'];
$agi->verbose("Region = $region");

if ($region === 'Cellulari') {
    # exit if called prefix is a cellphone prefix
    $agi->verbose("Called number prefix ($dial) match with cellphone");
    exit(0);
}

// get adjusted region
switch ($region) {
	case "Valle d'Aosta":
	$region = "Piemonte";
	break;

	case "Trentino Alto Adige":
	case "Friuli Venezia Giulia":
	$region = "Veneto";
	break;

	case "Umbria":
	$region = "Toscana";
	break;

	case "Abruzzo":
	$region = "Marche";
	break;

	case "Molise":
	case "Basilicata":
	$region = "Puglia";
	break;
}

// get number
$regions_numbers = [
	"Piemonte" => ["0110243650","0110243651","0110243652","0110243653","0110243654","0110243655","0110243656","0110243657","0110243658","0110243659"],
	"Lombardia" => ["0289377720","0289377721","0289377722","0289377723","0289377724","0289377725","0289377726","0289377727","0289377728","0289377729"],
	"Veneto" => ["0410988950","0410988951","0410988952","0410988953","0410988954","0410988955","0410988956","0410988957","0410988958","0410988959"],
	"Liguria" => ["0109951150","0109951151","0109951152","0109951153","0109951154","0109951155","0109951156","0109951157","0109951158","0109951159"],
	"Emilia Romagna" => ["0510301700","0510301701","0510301702","0510301703","0510301704","0510301705","0510301706","0510301707","0510301708","0510301709"],
	"Toscana" => ["0559073420","0559073421","0559073422","0559073423","0559073424","0559073425","0559073426","0559073427","0559073428","0559073429"],
	"Marche" => ["0719728460","0719728461","0719728462","0719728463","0719728464","0719728465","0719728466","0719728467","0719728468","0719728469"],
	"Lazio" => ["0699791430","0699791431","0699791432","0699791433","0699791434","0699791435","0699791436","0699791437","0699791438","0699791439"],
	"Puglia" => ["0809958920","0809958921","0809958922","0809958923","0809958924","0809958925","0809958926","0809958927","0809958928","0809958929"],
	"Campania" => ["08119758560","08119758561","08119758562","08119758563","08119758564","08119758565","08119758566","08119758567","08119758568","08119758569"],
	"Calabria" => ["0961038890","0961038891","0961038892","0961038893","0961038894","0961038895","0961038896","0961038897","0961038898","0961038899"],
	"Sicilia" => ["0918488770","0918488771","0918488772","0918488773","0918488774","0918488775","0918488776","0918488777","0918488778","0918488779"],
	"Sardegna" => ["0707050750","0707050751","0707050752","0707050753","0707050754","0707050755","0707050756","0707050757","0707050758","0707050759"]
];

// set OUTCID
if (!empty($regions_numbers[$region])) {
	$numbers_count = count($regions_numbers[$region]);
	$number = $regions_numbers[$region][rand(0,$numbers_count-1)];
	$agi->verbose("Set number $number for $region");
	// set CALLERID(number)
	$agi->set_variable("CALLERID(number)",$number);
}


