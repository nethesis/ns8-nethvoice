<?php
#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

include_once '/etc/freepbx_db.conf';

function indexExists($db, $schema, $table, $indexName) {
	$sql = 'SELECT 1 FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ? LIMIT 1';
	$stmt = $db->prepare($sql);
	$stmt->execute([$schema, $table, $indexName]);
	$exists = $stmt->fetchColumn();
	$stmt->closeCursor();

	return $exists !== false;
}

$indexes = [
	'idx_cdr_cnum_calldate' => 'ALTER TABLE `asteriskcdrdb`.`cdr` ADD INDEX `idx_cdr_cnum_calldate` (`cnum`, `calldate`)',
	'idx_cdr_dst_calldate' => 'ALTER TABLE `asteriskcdrdb`.`cdr` ADD INDEX `idx_cdr_dst_calldate` (`dst`, `calldate`)',
	'idx_cdr_uniqueid_disposition_linkedid' => 'ALTER TABLE `asteriskcdrdb`.`cdr` ADD INDEX `idx_cdr_uniqueid_disposition_linkedid` (`uniqueid`, `disposition`, `linkedid`)',
	'idx_cdr_uniqueid_linkedid_disposition_channel_dstchannel' => 'ALTER TABLE `asteriskcdrdb`.`cdr` ADD INDEX `idx_cdr_uniqueid_linkedid_disposition_channel_dstchannel` (`uniqueid`, `linkedid`, `disposition`, `channel`, `dstchannel`)',
	'idx_cdr_uniqueid_lastapp_dst' => 'ALTER TABLE `asteriskcdrdb`.`cdr` ADD INDEX `idx_cdr_uniqueid_lastapp_dst` (`uniqueid`, `lastapp`, `dst`)',
	'idx_cdr_uid_lastapp' => 'ALTER TABLE `asteriskcdrdb`.`cdr` ADD INDEX `idx_cdr_uid_lastapp` (`uniqueid`, `lastapp`)',
	'idx_cdr_linkedid' => 'ALTER TABLE `asteriskcdrdb`.`cdr` ADD INDEX `idx_cdr_linkedid` (`linkedid`)',
	'idx_cdr_dst_disp_uid_cnam' => 'ALTER TABLE `asteriskcdrdb`.`cdr` ADD INDEX `idx_cdr_dst_disp_uid_cnam` (`dst`, `disposition`, `uniqueid`, `cnam`)',
	'idx_cdr_linkedid_disp_calldate' => 'ALTER TABLE `asteriskcdrdb`.`cdr` ADD INDEX `idx_cdr_linkedid_disp_calldate` (`linkedid`, `disposition`, `calldate`)',
	'idx_cdr_src' => 'ALTER TABLE `asteriskcdrdb`.`cdr` ADD INDEX `idx_cdr_src` (`src`)',
];

foreach ($indexes as $indexName => $sql) {
	if (indexExists($db, 'asteriskcdrdb', 'cdr', $indexName)) {
		continue;
	}

	try {
		$db->exec($sql);
	} catch (\Throwable $e) {
		error_log('slow_database_updates: failed to create '.$indexName.': '.$e->getMessage());
	}
}
