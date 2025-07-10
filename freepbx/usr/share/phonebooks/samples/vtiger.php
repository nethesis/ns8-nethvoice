#!/usr/bin/php -q
<?php

#
# Copyright (C) 2022 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

$DEBUG = isset(getenv('DEBUG')) ? getenv('DEBUG') : false;
$source_name = 'vtiger';

$sourcedb = new PDO(
        'mysql:host=SOURCE.DB.HOSTNAME;port=PORT;dbname=DBNAME',
        'USERNAME',
        'PASSWORD');

$phonebookdb = new PDO(
        'mysql:host='.getenv('PHONEBOOK_DB_HOST').';port='.getenv('PHONEBOOK_DB_PORT').';dbname='.getenv('PHONEBOOK_DB_NAME'),
        getenv('PHONEBOOK_DB_USER'),
        getenv('PHONEBOOK_DB_PASS'));


// Remove NethCTI contacts from centralized phonebook
$sth = $phonebookdb->prepare('DELETE FROM phonebook WHERE sid_imported = "vtiger"');
$sth->execute([]);

$sth = $sourcedb->prepare("
		SELECT 
			accountname AS company,
			'' AS contact,
			phone AS workphone,
			fax,
			otherphone AS homephone,
			'' AS mobile,
			bill_city AS city,
			bill_code AS code,
			bill_country AS country,
			bill_state AS state,
			bill_street AS street,
			email1 AS email 
		FROM vtiger_account JOIN vtiger_accountbillads ON vtiger_account.accountid=vtiger_accountbillads.accountaddressid
	UNION 
		SELECT
			accountname AS company,
			concat(firstname,' ',lastname) AS contact,
			vtiger_contactdetails.phone AS workphone,
			vtiger_contactdetails.fax, '' AS homephone,
			mobile,
			mailingcity AS city,
			mailingzip AS code,
			mailingcountry AS country,
			mailingstate AS state,
			mailingstreet AS street,
			email
		FROM vtiger_contactdetails LEFT JOIN vtiger_account ON vtiger_account.accountid=vtiger_contactdetails.accountid LEFT JOIN vtiger_contactaddress ON vtiger_contactdetails.contactid=vtiger_contactaddress.contactaddressid");
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
                                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "vtiger")';
	$sth = $phonebookdb->prepare($query);
        $sth->execute(array(
                'admin',                #owner_id
                $source_name,           #type
                $row['email'],          #homeemail
                '',                     #workemail
                '',                     #homephone
                preg_replace("/^00/","+",preg_replace("/[^0-9+]/","",$row['workphone'])),             #workphone
                preg_replace("/^00/","+",preg_replace("/[^0-9+]/","",$row['mobile'])),            #cellphone
                preg_replace("/^00/","+",preg_replace("/[^0-9+]/","",$row['fax'])),             #fax,
                '',                     #title
                $row['company'],        #company
                '',                     #notes
                (empty($row['contact']) ? $row['company'] : $row['contact']),        #name
                '',                     #homestreet
                '',                     #homepob
                '',                     #homecity            
                '',                     #homeprovince
                '',                     #homepostalcode
                '',                     #homecountry
                $row['street'],            #workstreet
                '',                     #workpob
                $row['city'],          #workcity
                $row['state'],           #workprovince
                $row['code'],            #workpostalcode
                '',                     #workcountry
                '',                     #url
                $source_name            #sid_imported
        ));
}
