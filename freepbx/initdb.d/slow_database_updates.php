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

function ensureIndex($db, $schema, $table, $indexName, $columns) {
	if (indexExists($db, $schema, $table, $indexName)) {
		return;
	}

	$filesystemPath = '/';
	$totalSpace = disk_total_space($filesystemPath);
	$freeSpace = disk_free_space($filesystemPath);

	if ($totalSpace !== false && $totalSpace > 0 && $freeSpace !== false) {
		$freePercent = ($freeSpace / $totalSpace) * 100;
		if ($freePercent < 20) {
			error_log('slow_database_updates: skipping index '.$indexName.' on '.$schema.'.'.$table.' due to low disk space ('.round($freePercent, 2).'%)');
			return;
		}
	}

	$sql = "ALTER TABLE `{$schema}`.`{$table}` ADD INDEX `{$indexName}` ({$columns})";

	try {
		$db->exec($sql);
		error_log('slow_database_updates: created index '.$indexName.' on '.$schema.'.'.$table);
	} catch (\Throwable $e) {
		error_log('slow_database_updates: failed to create '.$indexName.' on '.$schema.'.'.$table.': '.$e->getMessage());
	}
}

ensureIndex($db, 'asteriskcdrdb', 'cdr', 'idx_cdr_cnum_calldate', '`cnum`, `calldate`');
ensureIndex($db, 'asteriskcdrdb', 'cdr', 'idx_cdr_dst_calldate', '`dst`, `calldate`');
ensureIndex($db, 'asteriskcdrdb', 'cdr', 'idx_cdr_uniqueid_disposition_linkedid', '`uniqueid`, `disposition`, `linkedid`');
ensureIndex($db, 'asteriskcdrdb', 'cdr', 'idx_cdr_uniqueid_linkedid_disposition_channel_dstchannel', '`uniqueid`, `linkedid`, `disposition`, `channel`, `dstchannel`');
ensureIndex($db, 'asteriskcdrdb', 'cdr', 'idx_cdr_uniqueid_lastapp_dst', '`uniqueid`, `lastapp`, `dst`');
ensureIndex($db, 'asteriskcdrdb', 'cdr', 'idx_cdr_uid_lastapp', '`uniqueid`, `lastapp`');
ensureIndex($db, 'asteriskcdrdb', 'cdr', 'idx_cdr_linkedid', '`linkedid`');
ensureIndex($db, 'asteriskcdrdb', 'cdr', 'idx_cdr_dst_disp_uid_cnam', '`dst`, `disposition`, `uniqueid`, `cnam`');
ensureIndex($db, 'asteriskcdrdb', 'cdr', 'idx_cdr_linkedid_disp_calldate', '`linkedid`, `disposition`, `calldate`');
ensureIndex($db, 'asteriskcdrdb', 'cdr', 'idx_cdr_src', '`src`');

ensureIndex($db, 'asteriskcdrdb', 'queue_log', 'idx_queue_log_time', '`time`');

ensureIndex($db, 'asteriskcdrdb', 'queue_log_history', 'idx_qlh_event_time_queue_callid', '`event`, `time`, `queuename`, `callid`');
ensureIndex($db, 'asteriskcdrdb', 'queue_log_history', 'idx_qlh_agent_queue_time_event', '`agent`, `queuename`, `time`, `event`');
ensureIndex($db, 'asteriskcdrdb', 'queue_log_history', 'idx_qlh_event_data1_queue_agent_time', '`event`, `data1`, `queuename`, `agent`, `time`');

ensureIndex($db, 'asteriskcdrdb', 'report_queue', 'idx_rq_action_timestampin_qname', '`action`, `timestamp_in`, `qname`');
ensureIndex($db, 'asteriskcdrdb', 'report_queue', 'idx_rq_timestamp_in', '`timestamp_in`');
ensureIndex($db, 'asteriskcdrdb', 'report_queue', 'idx_rq_timestamp_out', '`timestamp_out`');
ensureIndex($db, 'asteriskcdrdb', 'report_queue', 'idx_rq_cid_timestampin', '`cid`, `timestamp_in`');
