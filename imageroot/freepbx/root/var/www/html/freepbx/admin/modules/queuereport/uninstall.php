<?php

if (!defined('FREEPBX_IS_AUTH')) {
    die('No direct script access allowed');
}

$db_name = FreePBX::Config()->get('CDRDBNAME');
$db_host = FreePBX::Config()->get('CDRDBHOST');
$db_port = FreePBX::Config()->get('CDRDBPORT');
$db_user = FreePBX::Config()->get('CDRDBUSER');
$db_pass = FreePBX::Config()->get('CDRDBPASS');
$db_table = FreePBX::Config()->get('CDRDBTABLENAME');
$dbt = FreePBX::Config()->get('CDRDBTYPE');

$db_hash = array('mysql' => 'mysql', 'postgres' => 'pgsql');
$dbt = !empty($dbt) ? $dbt : 'mysql';
$db_type = $db_hash[$dbt];
$db_table_name = !empty($db_table) ? $db_table : "cdr";
$db_name = !empty($db_name) ? $db_name : "asteriskcdrdb";
$db_host = !empty($db_host) ? $db_host : "localhost";
$db_port = empty($db_port) ? '' :  ';port=' . $db_port;
$db_user = empty($db_user) ? $amp_conf['AMPDBUSER'] : $db_user;
$db_pass = empty($db_pass) ? $amp_conf['AMPDBPASS'] : $db_pass;
$pdo = new \Database($db_type.':host='.$db_host.$db_port.';dbname='.$db_name,$db_user,$db_pass);


$sqls[] = "drop table if exists view_report_queue";
$sqls[] = "drop table if exists view_report_queue_full";
$sqls[] = "drop table if exists view_agentsessions";
$sqls[] = "drop table if exists view_report_queue_agents";
$sqls[] = "drop table if exists view_report_queue_callers";
$sqls[] = "drop view if exists view_report_queue";
$sqls[] = "drop view if exists view_report_queue_full";
$sqls[] = "drop view if exists view_agentsessions";
$sqls[] = "drop view if exists view_report_queue_agents";
$sqls[] = "drop view if exists view_report_queue_callers";

$sqls[] = "drop table if exists tmp_view_agentsessions";
$sqls[] = "drop table if exists tmp_view_report_queue_callers";

$sqls[] = "drop table if exists agentsessions";
$sqls[] = "drop table if exists report_queue_callers";
$sqls[] = "drop table if exists report_queue_agents";
$sqls[] = "drop table if exists report_queue";

$sqls[] = "drop index callid_idx on queue_log";
$sqls[] = "drop index event_idx on queue_log";
$sqls[] = "create index callid_idx on queue_log (callid)";
$sqls[] = "create index callid_idx on queue_log (event)";

foreach ($sqls as $sql) {
   try {
       $pdo->query($sql, DB_FETCHMODE_ASSOC);
   } catch (Exception $e) {
       error_log($e->getMessage());
   }
}

