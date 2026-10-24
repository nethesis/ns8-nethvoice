<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;

/** Narrow native metadata and CDR views. No credentials, names or recordings. */
final class RecentCallerViews
{
    public static function install(\PDO $db): void
    {
        $tables=$db->query("SELECT table_name FROM information_schema.tables WHERE table_schema='asterisk'")->fetchAll(\PDO::FETCH_COLUMN);
        $view=function(string $name,string $sql) use ($db): void {
            $db->exec("CREATE OR REPLACE SQL SECURITY DEFINER VIEW asterisk.$name AS $sql");
        };
        $devices="SELECT CAST(NULL AS CHAR(20) CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci device_id,CAST(NULL AS CHAR(10) CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci tech,CAST(NULL AS CHAR(64) CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci destination_id WHERE 0";
        if (in_array('devices',$tables,true) && in_array('users',$tables,true)) {
            $devices="SELECT d.id device_id,UPPER(d.tech) tech,CONCAT('extension:',u.extension) destination_id FROM asterisk.devices d JOIN asterisk.users u ON BINARY d.user=BINARY u.extension WHERE d.tech IN ('pjsip','sip','iax2') AND d.id REGEXP '^[0-9]{1,20}$' AND u.extension REGEXP '^[0-9]{1,20}$'";
        }
        $view('voice_agent_callback_devices',$devices);
        $trunks="SELECT CAST(NULL AS CHAR(10) CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci tech,CAST(NULL AS CHAR(190) CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci peer WHERE 0";
        $patterns="SELECT CAST(NULL AS CHAR(50) CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci prefix,CAST(NULL AS CHAR(50) CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci pattern,CAST(NULL AS CHAR(255) CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci prepend,CAST(NULL AS CHAR(10) CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci tech,CAST(NULL AS CHAR(190) CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci peer WHERE 0";
        if (in_array('trunks',$tables,true)) {
            $where="t.tech IN ('pjsip','sip','iax2') AND t.disabled='off' AND t.channelid REGEXP '^[A-Za-z0-9_.-]+$'";
            $trunks="SELECT UPPER(t.tech) tech,t.channelid peer FROM asterisk.trunks t WHERE ".$where;
            $patterns.=" UNION ALL SELECT '', 'X.',t.dialoutprefix,UPPER(t.tech),t.channelid FROM asterisk.trunks t WHERE ".$where;
            if (in_array('trunk_dialpatterns',$tables,true)) {
                $patterns.=" UNION ALL SELECT p.match_pattern_prefix,p.match_pattern_pass,p.prepend_digits,UPPER(t.tech),t.channelid FROM asterisk.trunk_dialpatterns p JOIN asterisk.trunks t ON t.trunkid=p.trunkid WHERE ".$where;
            }
        }
        if (in_array('outbound_route_patterns',$tables,true)) {
            $patterns.=" UNION ALL SELECT match_pattern_prefix,match_pattern_pass,prepend_digits,'','' FROM asterisk.outbound_route_patterns WHERE match_cid=''";
        }
        $view('voice_agent_callback_trunks',$trunks);
        $view('voice_agent_callback_patterns',$patterns);
        $cdr=$db->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='asteriskcdrdb' AND table_name='cdr'")->fetchColumn();
        $columns=['calldate'=>'DATETIME','dst'=>'CHAR(80)','channel'=>'CHAR(80)','dstchannel'=>'CHAR(80)',
            'lastapp'=>'CHAR(80)','lastdata'=>'CHAR(80)','disposition'=>'CHAR(45)','linkedid'=>'CHAR(32)','uniqueid'=>'CHAR(32)','sequence'=>'SIGNED'];
        $empty=implode(',',array_map(fn($name,$type)=>"CAST(NULL AS $type) $name",array_keys($columns),$columns));
        // Custom Dial strings can contain credentials. Expose only recognized
        // native number/peer forms, without options or arbitrary URIs.
        $safeDial="CASE WHEN lastapp='Dial' AND SUBSTRING_INDEX(lastdata,',',1) REGEXP '^(PJSIP|SIP|IAX2)/([+]?[0-9]+@[A-Za-z0-9_.-]+|[A-Za-z0-9_.-]+/[+]?[0-9]+)$' THEN SUBSTRING_INDEX(lastdata,',',1) ELSE '' END AS lastdata";
        $projection=array_map(fn($column)=>$column==='lastdata'?$safeDial:$column,array_keys($columns));
        $view('voice_agent_recent_cdr',$cdr?'SELECT '.implode(',',$projection).' FROM asteriskcdrdb.cdr':"SELECT $empty WHERE 0");
    }
}
