<?php
#
# Copyright (C) 2017 Nethesis S.r.l.
# http://www.nethesis.it - nethserver@nethesis.it
#
# This script is part of NethServer.
#
# NethServer is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License,
# or any later version.
#
# NethServer is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with NethServer.  If not, see COPYING.
#

if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }

function inboundlookup_hookGet_config($engine) {
    global $ext;
    switch($engine) {
        case "asterisk":
            $dids = core_did_list();
            if (!empty($dids) && !is_null(inboundlookup_get())) {
                $ext->splice('macro-user-callerid', 's','cnum', new ext_gotoif('$["${CDR(cnam)}" != ""]', 'cnum'),"",-2);
                foreach($dids as $did) {
                    $exten = trim($did['extension']);
                    $cidnum = trim($did['cidnum']);
                    if ($cidnum != '' && $exten == '') {
                        $exten = 's';
                        $pricid = ($did['pricid']) ? true:false;
                    } else if (($cidnum != '' && $exten != '') || ($cidnum == '' && $exten == '')) {
                        $pricid = true;
                    } else {
                        $pricid = false;
                    }
                    $context = ($pricid) ? "ext-did-0001":"ext-did-0002";
                    if (function_exists('empty_freepbx')) {
                        $exten = (empty_freepbx($exten)?"s":$exten);
                    } else {
                        $exten = (empty($exten)?"s":$exten);
                    }
                    $exten = $exten.(empty($cidnum)?"":"/".$cidnum); //if a CID num is defined, add it
		    $ext->splice($context, $exten, 'did-cid-hook', new ext_agi('/var/lib/asterisk/agi-bin/inboundlookup.php,${CALLERID(number)}'),"inbound-lookup",1);
                    $ext->splice($context, $exten, 'inbound-lookup', new ext_setvar('__REAL_CNAM','${CDR(cnam)}'),"",1);
                    $ext->splice($context, $exten, 'inbound-lookup', new ext_setvar('__REAL_CCOMPANY','${CDR(ccompany)}'),"",1);
                }
		// ADD lookup for queue agent calls
		if (function_exists('queues_list') and count(queues_list(true)) > 0 ) {
                    $sql = "SELECT LENGTH(extension) as len FROM users GROUP BY len";
                    $sth = FreePBX::Database()->prepare($sql);
                    $sth->execute();
                    $rows = $sth->fetchAll(\PDO::FETCH_ASSOC);
                    foreach($rows as $row) {
                        $ext->splice("from-queue-exten-only", '_'.str_repeat('X',$row['len']), 'checkrecord', new ext_set('CDR(cnum)','${CALLERID(num)}'),"cnum");
                        $ext->splice("from-queue-exten-only", '_'.str_repeat('X',$row['len']), 'checkrecord', new ext_set('CDR(cnam)','${REAL_CNAM}'),"cnam");
                        $ext->splice("from-queue-exten-only", '_'.str_repeat('X',$row['len']), 'checkrecord', new ext_set('CDR(ccompany)','${REAL_CCOMPANY}'),"ccompany");
                    }
		}
            }
        break;
    }
}

function inboundlookup_get(){
        $results = sql("SELECT * FROM inboundlookup ","getRow",DB_FETCHMODE_ASSOC);
        return isset($results)?$results:null;
}

function inboundlookup_del(){
    global $db;
    sql('TRUNCATE inboundlookup');
}

function inboundlookup_add($post){
    global $db;
    $mysql_host = $db->escapeSimple($post['mysql_host']);
    $mysql_dbname = $db->escapeSimple($post['mysql_dbname']);
    $mysql_query = $db->escapeSimple($post['mysql_query']);
    $mysql_username = $db->escapeSimple($post['mysql_username']);
    $mysql_password = $db->escapeSimple($post['mysql_password']);
    $mysql_charset = $db->escapeSimple($post['mysql_charset']);
    sql('TRUNCATE inboundlookup');
    $sql = "INSERT INTO inboundlookup
        (mysql_host, mysql_dbname, mysql_query, mysql_username, mysql_password, mysql_charset)
        VALUES
        ('$mysql_host', '$mysql_dbname', '$mysql_query', '$mysql_username', '$mysql_password', '$mysql_charset')";
    error_log($sql);
    $results = sql($sql);
}

