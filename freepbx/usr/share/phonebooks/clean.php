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

$phonebookdb = new PDO(
        'mysql:host='.getenv('PHONEBOOK_DB_HOST').';port='.getenv('PHONEBOOK_DB_PORT').';dbname='.getenv('PHONEBOOK_DB_NAME'),
        getenv('PHONEBOOK_DB_USER'),
        getenv('PHONEBOOK_DB_PASS'));

$sth = $phonebookdb->prepare('DELETE FROM phonebook WHERE sid_imported IS NULL');
$sth->execute([]);

