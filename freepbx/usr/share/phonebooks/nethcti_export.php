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

$nethctidb = new PDO(
	'mysql:host='.getenv('NETHCTI_DB_HOST').';port='.getenv('NETHCTI_DB_PORT').';dbname=nethcti3',
	getenv('NETHCTI_DB_USER'),
	getenv('NETHCTI_DB_PASSWORD'));

$phonebookdb = new PDO(
        'mysql:host='.getenv('PHONEBOOK_DB_HOST').';port='.getenv('PHONEBOOK_DB_PORT').';dbname='.getenv('PHONEBOOK_DB_NAME'),
        getenv('PHONEBOOK_DB_USER'),
        getenv('PHONEBOOK_DB_PASS'));


// Remove NethCTI contacts from centralized phonebook
$sth = $phonebookdb->prepare('DELETE FROM phonebook WHERE sid_imported = "nethcti"');
$sth->execute([]);

$sth = $nethctidb->prepare("SELECT owner_id, homeemail, workemail, homephone, workphone, cellphone, fax, title, company, notes, name,
                                homestreet, homepob, homecity, homeprovince, homepostalcode, homecountry, workstreet, workpob, workcity,
				workprovince, workpostalcode, workcountry, url FROM cti_phonebook WHERE type='public'");
$sth->execute([]);

while($row = $sth->fetch(\PDO::FETCH_ASSOC)) {
	if($DEBUG) {
		print_r($row);
	}
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
			)
			VALUES
				(?, "nethcti", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "nethcti")';
	$sth2 = $phonebookdb->prepare($query);
	$sth2->execute(array_values($row));
}
