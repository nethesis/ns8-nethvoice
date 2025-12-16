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
$sth = $phonebookdb->prepare('DELETE FROM phonebook WHERE sid_imported = "nethvoice extensions"');
$sth->execute([]);

$sth = $nethvoicedb->prepare('SELECT default_extension as extension,displayname as name,mobile FROM userman_users JOIN rest_users ON rest_users.user_id = userman_users.id WHERE default_extension != "none" AND default_extension NOT IN (SELECT id FROM sip WHERE keyword="context" and data = "hotel")');
$sth->execute([]);

$query = 'INSERT INTO phonebook (
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
	$query_values[] = '("admin", "extension", "", "", "",? ,? , "", "", "","", ?, "", "", "", "", "", "", "", "", "", "", "", "", "", "nethvoice extensions")';
	$qm[] = $row['extension'];
	$qm[] = $row['mobile'];
	$qm[] = $row['name'];
}

if (!empty($qm)) {
	$sth = $phonebookdb->prepare($query.implode(',',$query_values));
	$sth->execute($qm);
}

