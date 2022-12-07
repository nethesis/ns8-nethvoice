<?php
#
# Copyright (C) 2022 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

include_once '/etc/freepbx_db.conf';

if (!isset($_ENV['NETHVOICE_LDAP_HOST'])
	|| !isset($_ENV['NETHVOICE_LDAP_PORT'])
	|| !isset($_ENV['NETHVOICE_LDAP_USER'])
	|| !isset($_ENV['NETHVOICE_LDAP_PASS'])
	|| !isset($_ENV['NETHVOICE_LDAP_SCHEMA'])
	|| !isset($_ENV['NETHVOICE_LDAP_BASE'])
) {
	exit(0);
}

// Get list of directories
$sql = 'SELECT * FROM userman_directories';
$result = $db->sql($sql,"getAll",\PDO::FETCH_ASSOC);

//TODO Select NethServer Directory
//TODO Update configuration
//TODO launch user synchronization
