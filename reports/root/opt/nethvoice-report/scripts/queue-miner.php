#!/usr/bin/env php
<?php
/*
 * This scripts consolidates queue statistics
 */

# Test lock
$fp = fopen( "/var/run/nethvoice/queuereport-update-lock", "a" );
if ( !$fp || !flock($fp,LOCK_EX|LOCK_NB,$eWouldBlock) || $eWouldBlock ) {
  fputs( STDERR, "Failed to acquire lock!\n" );
  exit(1);
}

# Read and set timezone
$timezone = "Europe/Rome";
$config_file = "/var/lib/tancredi/data/scopes/defaults.ini";
if (file_exists($config_file)) {
    $sections = parse_ini_file("/var/lib/tancredi/data/scopes/defaults.ini", true);

    if (isset($sections['data']['timezone'])) {
        $timezone = $sections['data']['timezone'];
    }
}
ini_set("date.timezone", $timezone);
$now = time();


# Connect to db
$conf = json_decode(file_get_contents("/opt/nethvoice-report/api/conf.json"), true);
if (!$conf) {
    fputs(STDERR, "Can't read configuration file");
    exit(1);
}
$conf = $conf['cdr_database'];

try {
    $cdrdb = new PDO("mysql:dbname={$conf['name']};host={$conf['host']};port={$conf['port']}", $conf['user'], $conf['password']);
} catch  (PDOException $e) {
    fputs(STDERR, 'Connection failed: ' . $e->getMessage());
    exit(1);
}


# Copy queue_log content into queue_log_history
$sqls = array();
$sqls[] = "INSERT IGNORE INTO queue_log_history (time,callid,queuename,agent,event,data,data1,data2,data3,data4,data5) SELECT time,callid,queuename,agent,event,data,data1,data2,data3,data4,data5 FROM queue_log WHERE UNIX_TIMESTAMP(time) < ?";

# Delete queue_log
$sqls[] = "DELETE FROM queue_log WHERE UNIX_TIMESTAMP(time) < ?";

$sqls[] = "DROP TABLE IF EXISTS agent_extensions";

$sqls[] = "CREATE TABLE agent_extensions AS SELECT DISTINCT extension,name FROM asterisk.users WHERE name IN ( SELECT DISTINCT agent FROM asteriskcdrdb.queue_log_history WHERE agent NOT LIKE 'Local%' and agent != 'NONE'  and agent != '')";

if (!empty($sqls)) {
    foreach ($sqls as $sql) {
        try {
           $stmt = $cdrdb->prepare($sql);
           $stmt->execute([$now]);
           $cdrdb->query($sql);
        } catch (Exception $e) {
            error_log($e->getMessage());
        }
    }
}
// get last saved time as start_ts
$last_saved_ts = get_newer_saved();
// Do not more than last week. Older will be eventualy made backward day by day
if ($last_saved_ts < ($now - 7 * 24 * 60 * 60)) {
    $start_ts = ($now - 7 * 24 * 60 * 60);
} else {
    $start_ts = $last_saved_ts;
}
$end_ts = $now;

# Execute queries
do_time_queries($start_ts,$end_ts);

// save older log reports backward if it is needed
$first_queue_log_history_ts = get_older_in_history();

if ($first_queue_log_history_ts != FALSE) {
    $older = get_older_saved();
    while ($first_queue_log_history_ts < $older) {
        $end_ts = $older;
        if ($first_queue_log_history_ts < $older - 86400) {
            $start_ts = $older - 86400;
        } else {
            $start_ts = $first_queue_log_history_ts;
        }
        do_time_queries($start_ts,$end_ts);
        $older = $older - 86400;
    }
}
do_static_queries();

# Release lock
fclose( $fp );
unlink( "/var/run/nethvoice/queuereport-update-lock" );

# get older saved timestamp #
function get_older_saved() {
    // find empty older rows
    global $cdrdb;
    global $now;
    # Get first saved timestamp #
    $sql = "SELECT `timestamp_out` FROM `report_queue` ORDER BY `timestamp_out` ASC LIMIT 1";
    $stmt = $cdrdb->prepare($sql);
    $stmt->execute();
    $results = $stmt->fetchAll(\PDO::FETCH_ASSOC);
    if (isset($results[0]['timestamp_out'])) {
        return $results[0]['timestamp_out'];
    }
    return $now;
}

# Get newer saved timestamp #
function get_newer_saved() {
    global $cdrdb;
    $sql = "SELECT `timestamp_out` FROM `report_queue` ORDER BY `timestamp_out` DESC LIMIT 1";
    $stmt = $cdrdb->prepare($sql);
    $stmt->execute();
    $results = $stmt->fetchAll(\PDO::FETCH_ASSOC);
    if (isset($results[0]['timestamp_out'])) {
        return $results[0]['timestamp_out'];
    }
    return 0;
}

# Get older timestamp in queue_log_history
function get_older_in_history() {
    global $cdrdb;
    $sql = "SELECT UNIX_TIMESTAMP(time) as timestamp_out FROM queue_log_history a inner join asterisk.queues_config qc on queuename=qc.extension where event in ('ABANDON','EXITWITHTIMEOUT','EXITWITHKEY','EXITEMPTY','FULL','JOINEMPTY', 'COMPLETEAGENT','COMPLETECALLER') ORDER BY time ASC LIMIT 1";
    $stmt = $cdrdb->prepare($sql);
    $stmt->execute();
    $results = $stmt->fetchAll(\PDO::FETCH_ASSOC);
    if (isset($results[0]['timestamp_out'])) {
        return $results[0]['timestamp_out'];
    }
    return false;
}

function do_time_queries($start_ts,$end_ts) {
    global $cdrdb;
    $sqls = array();

    $sqls[] = "DROP TABLE IF EXISTS tmp_cdr";

    $sqls[] = "CREATE TABLE tmp_cdr LIKE cdr";

    $sqls[] = "INSERT IGNORE INTO tmp_cdr (SELECT * FROM cdr WHERE UNIX_TIMESTAMP(calldate) >= $start_ts AND UNIX_TIMESTAMP(calldate) <= $end_ts)";

    $sqls[] = "INSERT IGNORE INTO report_queue ( id,timestamp_out,timestamp_in,qname,action,position,duration,hold,data4,agent,qdescr,agents)
    select id,UNIX_TIMESTAMP(time) as timestamp_out, callid as timestamp_in, queuename as qname,
         event as action,
         if (event in ('ABANDON','EXITWITHTIMEOUT','EXITEMPTY'), cast(data1 as UNSIGNED), '')  as position,
         cast(data2 as UNSIGNED) as duration,
         cast(data3 as UNSIGNED) as hold,
         cast(data4 as UNSIGNED) as data4,
         agent,qc.descr as qdescr,
         '' as agents
       from queue_log_history a inner join asterisk.queues_config qc on queuename=qc.extension
       where event in ('ABANDON','EXITWITHTIMEOUT','EXITEMPTY','FULL','JOINEMPTY') AND UNIX_TIMESTAMP(time) > $start_ts AND UNIX_TIMESTAMP(time) < $end_ts
     UNION ALL
     select id,UNIX_TIMESTAMP(time) as timestamp_out, callid as timestamp_in, queuename as qname,
         event as action,
         cast(data2 as UNSIGNED) as position,
         cast(data3 as UNSIGNED) as duration,
         cast(data4 as UNSIGNED) as hold,
         0 as data4,
         agent,qc.descr as qdescr,
         '' as agents
       from queue_log_history a inner join asterisk.queues_config qc on queuename=qc.extension
       where event in ('EXITWITHKEY') AND UNIX_TIMESTAMP(time) > $start_ts AND UNIX_TIMESTAMP(time) < $end_ts
       UNION ALL
       select id,UNIX_TIMESTAMP(time) as timestamp_out, callid as timestamp_in, queuename as qname,
         'ANSWER' as action,
         cast(data3 as UNSIGNED) as position,
         cast(data2 as UNSIGNED) as duration,
         cast(data1 as UNSIGNED) as hold,
         cast(data4 as UNSIGNED) as data4,
         agent,qc.descr as qdescr,
         (SELECT GROUP_CONCAT(DISTINCT name SEPARATOR ',') from tmp_cdr LEFT JOIN agent_extensions on SUBSTRING(REPLACE(dstchannel,'PJSIP/',''),1,POSITION('-' IN REPLACE(dstchannel,'PJSIP/',''))-1) = agent_extensions.extension where linkedid != uniqueid and disposition ='ANSWERED' and dstchannel not like 'Local%' AND UNIX_TIMESTAMP(calldate) >  $start_ts AND UNIX_TIMESTAMP(calldate) < $end_ts AND linkedid = callid) as agents
       from queue_log_history a inner join asterisk.queues_config qc on queuename=qc.extension
       where event in ('COMPLETEAGENT','COMPLETECALLER') AND UNIX_TIMESTAMP(time) > $start_ts AND UNIX_TIMESTAMP(time) < $end_ts";

    $sqls[] = "INSERT INTO report_queue_agents ( id,timestamp_out,timestamp_in,qname,action,position,duration,hold,agent,qdescr)
       SELECT id,UNIX_TIMESTAMP(time) AS timestamp_out, callid AS timestamp_in, queuename AS qname,
         event AS action,
         CAST(data3 AS UNSIGNED) AS position,
         CAST(data2 AS UNSIGNED) AS duration,
         ROUND(cast(data1 as UNSIGNED) / 1000) AS hold,
         agent,qc.descr AS qdescr
       FROM queue_log_history a INNER JOIN asterisk.queues_config qc ON queuename=qc.extension
       WHERE event IN ('RINGNOANSWER') AND UNIX_TIMESTAMP(time) > $start_ts AND UNIX_TIMESTAMP(time) < $end_ts
       UNION ALL
       SELECT id,UNIX_TIMESTAMP(time) AS timestamp_out, callid AS timestamp_in, queuename AS qname,
         IF( IF(agent_extensions.name != '',agent_extensions.name,dst_cnam) = agent, 'ANSWER', 'TRANSFER') AS action,
         CAST(data3 AS UNSIGNED) AS position,
         CAST(c.billsec AS UNSIGNED) AS duration,
         CAST(data1 as UNSIGNED) AS hold,
         IF(agent_extensions.name != '',agent_extensions.name,dst_cnam) AS agent,
         qc.descr AS qdescr
       FROM
           queue_log_history a
           INNER JOIN asterisk.queues_config qc ON queuename=qc.extension
	   INNER JOIN (
		SELECT dst_cnam,billsec,dstchannel, zid FROM (
			SELECT dst_cnam,billsec,dstchannel, linkedid AS zid FROM tmp_cdr WHERE linkedid != uniqueid AND disposition ='ANSWERED' AND dstchannel NOT LIKE 'Local%' AND UNIX_TIMESTAMP(calldate) > $start_ts AND UNIX_TIMESTAMP(calldate) < $end_ts
                UNION ALL
		SELECT dst_cnam,billsec,dstchannel, uniqueid AS zid FROM tmp_cdr WHERE linkedid != uniqueid AND disposition ='ANSWERED' AND dstchannel NOT LIKE 'Local%' AND UNIX_TIMESTAMP(calldate) > $start_ts AND UNIX_TIMESTAMP(calldate) < $end_ts
		) temp GROUP BY zid
           ) c ON zid = callid
           LEFT JOIN agent_extensions ON SUBSTRING(REPLACE(dstchannel,'PJSIP/',''),1,POSITION('-' IN REPLACE(dstchannel,'PJSIP/',''))-1) = agent_extensions.extension
       WHERE event IN ('COMPLETEAGENT','COMPLETECALLER') AND UNIX_TIMESTAMP(time) > $start_ts AND UNIX_TIMESTAMP(time) < $end_ts
       ";

    $sqls[] = "INSERT INTO report_queue_callers ( id,timestamp_out,timestamp_in,qname,cid,action,position,qdescr,prefisso,comune,siglaprov,provincia,regione)
       select id,UNIX_TIMESTAMP(time) as timestamp_out, callid as timestamp_in, queuename as qname, data2 as cid, event as action, data3 as position, qc.descr as qdescr, prefisso, comune, siglaprov, provincia, regione
       from queue_log_history a inner join asterisk.queues_config qc on queuename=qc.extension left join zone z on (INSTR(clean_prefix(data2), prefisso) = 1)
       where event = 'ENTERQUEUE' AND UNIX_TIMESTAMP(time) > $start_ts AND UNIX_TIMESTAMP(time) < $end_ts";

    $sqls[] = "INSERT INTO report_queue_callers ( id,timestamp_out,timestamp_in,qname,cid,action,position,qdescr,prefisso,comune,siglaprov,provincia,regione)
       select id,UNIX_TIMESTAMP(time) as timestamp_out, callid as timestamp_in, queuename as qname, data1 as cid, event as action, '0' as position, qc.descr as qdescr, prefisso, comune, siglaprov, provincia, regione
       from queue_log_history a inner join asterisk.queues_config qc on queuename=qc.extension left join zone z on (INSTR(clean_prefix(data2), prefisso) = 1)
       where (event='FULL' or event='JOINEMPTY') AND UNIX_TIMESTAMP(time) > $start_ts AND UNIX_TIMESTAMP(time) < $end_ts";

    $sqls[] = "INSERT INTO agentsessions (qname,agent,action,timestamp_in,reason,timestamp_out,qdescr)
       select queuename,agent,'pause',unix_timestamp(time),data1,(select unix_timestamp(time) from queue_log_history d WHERE (event='UNPAUSE' OR event='AGENTLOGOFF' OR event='REMOVEMEMBER') and agent NOT LIKE 'Local/%@from-queue/n' and d.time>c.time and d.agent = c.agent and d.time<(c.time+86400) and d.queuename=c.queuename order by time limit 1), qc.descr
       from queue_log_history c inner join asterisk.queues_config qc on queuename=qc.extension
       WHERE event='PAUSE' and agent NOT LIKE 'Local/%@from-queue/n' AND UNIX_TIMESTAMP(time) > $start_ts AND UNIX_TIMESTAMP(time) < $end_ts";

    $sqls[] = "INSERT INTO agentsessions (qname,agent,action,timestamp_in,reason,timestamp_out,qdescr)
       select queuename,agent,'logon',unix_timestamp(time),data1,(select unix_timestamp(time) from queue_log_history d WHERE (event='REMOVEMEMBER' or event='AGENTLOGOFF') and agent NOT LIKE 'Local/%@from-queue/n' and d.time>c.time and d.agent = c.agent and d.time<(c.time+86400) and d.queuename=c.queuename order by time limit 1), qc.descr
       from queue_log_history c inner join asterisk.queues_config qc on queuename=qc.extension
       WHERE event='ADDMEMBER' and agent NOT LIKE 'Local/%@from-queue/n' AND UNIX_TIMESTAMP(time) > $start_ts AND UNIX_TIMESTAMP(time) < $end_ts";

    $sqls[] = "INSERT INTO agentsessions (qname,agent,action,timestamp_in,reason,timestamp_out,qdescr)
       select queuename,agent,'agent',unix_timestamp(time),data1,(select unix_timestamp(time) from queue_log_history d WHERE event='AGENTLOGOFF' and agent NOT LIKE 'Local/%@from-queue/n' and d.time>c.time and d.agent = c.agent and d.time<(c.time+86400) and d.queuename=c.queuename order by time limit 1), qc.descr
       from queue_log_history c inner join asterisk.queues_config qc on queuename=qc.extension
       WHERE event='AGENTLOGIN' and agent NOT LIKE 'Local/%@from-queue/n' AND UNIX_TIMESTAMP(time) > $start_ts AND UNIX_TIMESTAMP(time) < $end_ts";

    $sqls[] = "INSERT IGNORE INTO ivr_choice (select a.uniqueid,unix_timestamp(eventtime) as timestamp_in,a.cid_name,a.cid_num,a.context,b.name,a.exten from cel a inner join asterisk.ivr_details b on a.context=concat('ivr-',b.id) where eventtype='IVR_CHOICE' AND unix_timestamp(eventtime) > $start_ts AND UNIX_TIMESTAMP(eventtime) < $end_ts)";

    $sqls[] = "UPDATE report_queue INNER JOIN (SELECT cid,timestamp_in FROM report_queue_callers WHERE timestamp_in > $start_ts AND timestamp_in < $end_ts) t ON t.timestamp_in = report_queue.timestamp_in SET report_queue.cid = t.cid WHERE report_queue.cid IS NULL AND report_queue.timestamp_in > $start_ts AND report_queue.timestamp_in < $end_ts";

    $sqls[] = "UPDATE report_queue SET cid = (SELECT cid FROM tmp_cdr JOIN report_queue_callers ON report_queue_callers.timestamp_in = tmp_cdr.linkedid WHERE tmp_cdr.uniqueid = report_queue.timestamp_in LIMIT 1) WHERE cid IS NULL AND timestamp_in > $start_ts";

    // Not managed calls
    $sqls[] = "
        INSERT INTO `queue_failed` (`cid`,`name`,`company`,`action`,`time`,`direction`,`qname`,`event`)
          SELECT cid, name, company, action, time, direction, queuename, event FROM (
            SELECT
                cid, name, company, action, UNIX_TIMESTAMP(time) as time, direction, queuename,
                IF (event = '', action, event) AS event
            FROM
            (
                SELECT
                    time,
                    queuename,
                    'IN' AS direction,
                    'TIMEOUT' AS action,
                    CAST(data1 AS UNSIGNED) AS position,
                    CAST(data2 AS UNSIGNED) AS duration,
                    CAST(data3 AS UNSIGNED) AS hold,
                    (
                        SELECT DISTINCT(data2)
                        FROM asteriskcdrdb.queue_log_history z
                        WHERE z.event = 'ENTERQUEUE' AND z.callid=a.callid
                    ) AS cid,
                    (
                        SELECT DISTINCT(tmp_cdr.cnam)
                        FROM asteriskcdrdb.tmp_cdr tmp_cdr
                        WHERE tmp_cdr.uniqueid = a.callid GROUP BY tmp_cdr.uniqueid
                    ) AS name,
                    (
                    SELECT DISTINCT(tmp_cdr.ccompany)
                    FROM asteriskcdrdb.tmp_cdr tmp_cdr
                    WHERE tmp_cdr.uniqueid = a.callid GROUP BY tmp_cdr.uniqueid
                    ) AS company,
                    agent,
                    event
                FROM asteriskcdrdb.queue_log_history a
                WHERE event IN ('ABANDON', 'EXITWITHTIMEOUT', 'EXITWITHKEY', 'EXITEMPTY', 'FULL', 'JOINEMPTY', 'JOINUNAVAIL')
                AND UNIX_TIMESTAMP(time) > $start_ts AND UNIX_TIMESTAMP(time) < $end_ts

                UNION ALL

                SELECT time,
                    queuename,
                    'IN' AS direction,
                    'DONE' AS action,
                    CAST(data3 AS UNSIGNED) AS position,
                    CAST(data2 AS UNSIGNED) AS duration,
                    CAST(data1 AS UNSIGNED) AS hold,
                    (
                        SELECT DISTINCT(data2)
                        FROM asteriskcdrdb.queue_log_history z
                        WHERE z.event='ENTERQUEUE' AND z.callid=a.callid
                    ) AS cid,
                    (
                        SELECT DISTINCT(tmp_cdr.cnam)
                        FROM asteriskcdrdb.tmp_cdr tmp_cdr
                        WHERE tmp_cdr.uniqueid = a.callid GROUP BY tmp_cdr.uniqueid
                    ) AS name,
                    (
                        SELECT DISTINCT(tmp_cdr.ccompany)
                        FROM asteriskcdrdb.tmp_cdr tmp_cdr
                        WHERE tmp_cdr.uniqueid = a.callid GROUP BY tmp_cdr.uniqueid
                    ) AS company,
                    agent,
                    event
                FROM asteriskcdrdb.queue_log_history a
                WHERE event IN ('COMPLETEAGENT', 'COMPLETECALLER')
                AND UNIX_TIMESTAMP(time) > $start_ts AND UNIX_TIMESTAMP(time) < $end_ts

                UNION ALL

                SELECT calldate AS time,
                    l.queuename as queuename,
                    'OUT' AS direction,
                    IF (disposition='ANSWERED', 'DONE', disposition) AS action,
                    0 AS position,
                    0 AS duration,
                    0 AS hold,
                    dst AS cid,
                    dst_cnam AS name,
                    dst_ccompany AS company,
                    cnam AS agent,
                    ''
                FROM tmp_cdr c
                INNER JOIN asteriskcdrdb.queue_log_history l ON c.dst=l.data2
                WHERE l.event='ENTERQUEUE'
                AND UNIX_TIMESTAMP(calldate) > $start_ts AND UNIX_TIMESTAMP(calldate) < $end_ts
                AND UNIX_TIMESTAMP(time) > $start_ts AND UNIX_TIMESTAMP(time) < $end_ts
                ORDER BY time DESC
            ) queue_recall
            GROUP BY cid, queuename
            ORDER BY time DESC
          ) queue_recall_ordered
        WHERE action != 'DONE'";

    foreach ($sqls as $sql) {
        try {
           $cdrdb->query($sql);
        } catch (Exception $e) {
           error_log($e->getMessage());
        }
    }

    // Recall
    // Get agents in queues
    $sql = "SELECT DISTINCT queuename,agent FROM queue_log_history
            WHERE queuename != 'NONE'
            AND queuename != 'all'
            AND agent NOT LIKE ''
            AND agent != 'NONE'
            AND agent NOT LIKE 'Local/%@from-queue/n'
            AND UNIX_TIMESTAMP(time) > $start_ts AND UNIX_TIMESTAMP(time) < $end_ts
            ORDER BY queuename, agent";
    $stmt = $cdrdb->prepare($sql);
    $stmt->execute();
    $results = $stmt->fetchAll(\PDO::FETCH_ASSOC);
    $queues_agents = [];
    foreach ($results as $row) {
        if (!isset($queues_agents[$row['queuename']])) {
            $queues_agents[$row['queuename']] = [];
        }
        $queues_agents[$row['queuename']][] = $row['agent'];
    }

    // Get failed calls in queues
    $sql = "SELECT * FROM report_queue WHERE action IN ('ABANDON', 'EXITWITHTIMEOUT', 'EXITWITHKEY', 'EXITEMPTY', 'FULL', 'JOINEMPTY', 'JOINUNAVAIL') AND timestamp_in > $start_ts AND timestamp_in < $end_ts";
    $stmt = $cdrdb->prepare($sql);
    $stmt->execute();
    $results = $stmt->fetchAll(\PDO::FETCH_ASSOC);

    foreach ($results as $row) {
        if (empty($queues_agents[$row['qname']])) {
            continue;
        }
        $agents = $queues_agents[$row['qname']];
        $tmp_qm = [];
        for ($i=0; $i<count($agents); $i++) {
            $tmp_qm[] = '?';
        }
        $agents_qm = implode(',',$tmp_qm);

        $sql = "SELECT MIN(uniqueid),cnam AS agent FROM cdr
        WHERE dst = ?
        AND uniqueid > ?
        AND uniqueid < UNIX_TIMESTAMP(STR_TO_DATE( CONCAT( YEAR(FROM_UNIXTIME(?) + INTERVAL 1 DAY) ,'-', MONTH(FROM_UNIXTIME(?) + INTERVAL 1 DAY) ,'-', DAY(FROM_UNIXTIME(?) + INTERVAL 1 DAY)), '%Y-%m-%d'))
        AND cnam IN ($agents_qm)
        AND disposition = 'ANSWERED'
        AND billsec > 0
        ";
        $stmt = $cdrdb->prepare($sql);
        $stmt->execute(array_merge([$row['cid'], $row['timestamp_in'], $row['timestamp_in'], $row['timestamp_in'], $row['timestamp_in']],$agents));
        $recall = $stmt->fetchAll(\PDO::FETCH_ASSOC);
        if (empty($recall[0]['MIN(uniqueid)'])) {
            continue;
        }

        // Update report_queue to add the recall
        $sql = "UPDATE report_queue SET agent = ?, data4 = ? WHERE timestamp_in = ?";
        $stmt = $cdrdb->prepare($sql);
        $stmt->execute([$recall[0]['agent'],$recall[0]['MIN(uniqueid)']-$row['timestamp_in'],$row['timestamp_in']]);
    }

}

function do_static_queries() {
    global $cdrdb;
    $sqls = array();

    $sqls[] = "UPDATE agentsessions a SET timestamp_out = (select UNIX_TIMESTAMP(time) from queue_log_history d WHERE (event='UNPAUSE' OR event='AGENTLOGOFF' OR event='REMOVEMEMBER') and agent NOT LIKE 'Local/%@from-queue/n' and a.timestamp_in<UNIX_TIMESTAMP(d.time) and a.agent = d.agent and a.qname = d.queuename order by time limit 1) WHERE a.timestamp_out is NULL AND a.action='pause'";

$sqls[] = "UPDATE agentsessions a SET timestamp_out = (select UNIX_TIMESTAMP(time) from queue_log_history d WHERE (event='REMOVEMEMBER' or event='AGENTLOGOFF') and agent NOT LIKE 'Local/%@from-queue/n' and a.timestamp_in<UNIX_TIMESTAMP(d.time) and a.agent = d.agent and a.qname = d.queuename order by time limit 1) WHERE a.timestamp_out is NULL AND a.action='logon'";

$sqls[] = "UPDATE agentsessions a SET timestamp_out = (select UNIX_TIMESTAMP(time) from queue_log_history d WHERE event='AGENTLOGOFF' and agent NOT LIKE 'Local/%@from-queue/n' and a.timestamp_in<UNIX_TIMESTAMP(d.time) and a.agent = d.agent and a.qname = d.queuename order by time limit 1) WHERE a.timestamp_out is NULL AND a.action='agent'";

    foreach ($sqls as $sql) {
        try {
           $cdrdb->query($sql);
        } catch (Exception $e) {
           error_log($e->getMessage());
        }
    }

}
