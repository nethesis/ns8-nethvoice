#!/usr/bin/env php
<?php

#
# Copyright (C) 2022 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

$DEBUG = getenv('DEBUG');
if (empty($DEBUG) || strcasecmp($DEBUG,'false') == 0 || $DEBUG == False) {
        $DEBUG = False;
} elseif (strcasecmp($DEBUG,'true') == 0 || $DEBUG == True)   {
        $DEBUG = True;
}

$nethvoicedb = new PDO(
        'mysql:host='.getenv('AMPDBHOST').';port='.getenv('NETHVOICE_MARIADB_PORT').';dbname='.getenv('AMPDBNAME'),
        getenv('AMPDBUSER'),
        getenv('AMPDBPASS'));

$phonebookdb = new PDO(
        'mysql:host='.getenv('PHONEBOOK_DB_HOST').';port='.getenv('PHONEBOOK_DB_PORT').';dbname='.getenv('PHONEBOOK_DB_NAME'),
        getenv('PHONEBOOK_DB_USER'),
        getenv('PHONEBOOK_DB_PASS'));


// Remove NethVoice extensions from centralized phonebook
$sth = $phonebookdb->prepare('DELETE FROM phonebook WHERE sid_imported = "NethVoice RapidCodes" OR sid_imported = "speeddial"');
$sth->execute([]);

// Import NethVoice Rapidcode
$sth = $nethvoicedb->prepare('SELECT number AS extension, label AS name from `rapidcode` order by name ');
$sth->execute([]);


$query = 'INSERT INTO phonebook.phonebook (
	owner_id,
	type,
	homeemail,
	workemail,
	homephone,
	workphone,
	cellphone,
	fax,
	title,
	company,
	notes,
	name,
	homestreet,
	homepob,
	homecity,
	homeprovince,
	homepostalcode,
	homecountry,
	workstreet,
	workpob,
	workcity,
	workprovince,
	workpostalcode,
	workcountry,
	url,
	sid_imported
) VALUES ';

$qm = [];
$query_values = [];
while($row = $sth->fetch(\PDO::FETCH_ASSOC)) {
    if($DEBUG) {
        print_r($row);
    }

	$query_values[] = '("admin", "rapidcode", "", "", "", ?, "", "", "", "","", ?, "", "", "", "", "", "", "", "", "", "", "", "", "", "NethVoice RapidCodes")';
	$qm[] = $row['extension'];
	$qm[] = $row['name'];
}

if (!empty($qm)) {
	$sth = $phonebookdb->prepare($query.implode(',',$query_values));
    $sth->execute($qm);
}
