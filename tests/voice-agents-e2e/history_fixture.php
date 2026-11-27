<?php
// Owned peer in 127.88.0.0/16. No outbound route references this trunk.
ini_set('display_errors','0');
error_reporting(E_ERROR);
ob_start();
try {
    require '/etc/freepbx.conf';
    $p=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
    $owner=$p['owner'];
    if (getenv('NETHVOICE_HOST') !== $p['domain'] || !preg_match('/^nvtest-[a-f0-9]{12}$/D',$owner))
        throw new RuntimeException('wrong_history_target');
    $name='nvhist'.substr($owner,7);
    $ip=$p['ip'];
    $port=$p['port'];
    if (!filter_var($ip,FILTER_VALIDATE_IP,FILTER_FLAG_IPV4) || !str_starts_with($ip,'127.88.') ||
        !is_int($port) || $port<10000 || $port>65000) throw new RuntimeException('wrong_history_address');
    $core=FreePBX::Core();
    $match=null;
    foreach ($core->listTrunks() as $t) {
        if ($t['channelid']===$name || $t['name']===$name) {
            if ($t['provider']!==$owner || $t['channelid']!==$name || $t['name']!==$name || $t['tech']!=='pjsip')
                throw new RuntimeException('history_trunk_collision');
            $match=$t;
        }
    }
    $op=$p['op'];
    if ($op==='cdr') {
        $number=$p['number'];
        $ext=$p['extension'];
        if (!preg_match('/^889[0-9]{9}$/D',$number) || !preg_match('/^8[0-9]{6}$/D',$ext) || !$match)
            throw new RuntimeException('invalid_cdr_probe');
        if (!in_array($p['direction'],['outbound','inbound'],true))
            throw new RuntimeException('invalid_cdr_direction');
        $out=$p['direction']==='outbound';
        $sql="SELECT EXISTS(SELECT 1 FROM asterisk.voice_agent_recent_cdr
              WHERE calldate>=NOW()-INTERVAL 10 MINUTE AND lastapp='Dial' AND disposition='ANSWERED'
              AND billsec>0 AND channel LIKE ? AND dstchannel LIKE ? AND ";
        $sql.=$out ? "dst=? AND SUBSTRING_INDEX(lastdata,',',1)=?)" : "src=?)";
        $params=$out ? ["PJSIP/$ext-%","PJSIP/$name-%",$number,"PJSIP/$number@$name"]
                     : ["PJSIP/$name-%","PJSIP/$ext-%",$number];
        $statement=FreePBX::Database()->prepare($sql);
        $statement->execute($params);
        ob_end_clean();
        echo json_encode(['qualified'=>(bool)$statement->fetchColumn()]);
        exit(0);
    }
    if ($op==='create' && !$match) {
        $_POST=['trunk_name'=>$name,'registration'=>'none','authentication'=>'none','transport'=>'0.0.0.0-udp',
            'context'=>$name.'-in','sip_server'=>$ip,'sip_server_port'=>(string)$port,'match'=>$ip.'/32',
            'aor_contact'=>'sip:'.$ip.':'.$port,'qualify_frequency'=>'0','codec'=>['ulaw'=>true,'alaw'=>true],
            'direct_media'=>'no','media_encryption'=>'no','outbound_proxy'=>'','rewrite_contact'=>'no'];
        $base=['channelid'=>$name,'dialoutprefix'=>'','maxchans'=>'','outcid'=>'','peerdetails'=>'',
            'usercontext'=>'','userconfig'=>'','register'=>'','keepcid'=>'off','failtrunk'=>'',
            'disabletrunk'=>'off','provider'=>$owner,'continue'=>'off','dialopts'=>false];
        if (!$core->addTrunk($name,'pjsip',$base)) throw new RuntimeException('history_trunk_create_failed');
    } elseif ($op==='delete' && $match) {
        if ($core->deleteTrunk($match['trunkid'],'pjsip')!==true) throw new RuntimeException('history_trunk_delete_failed');
    } elseif (!in_array($op,['create','delete','inspect'],true)) throw new RuntimeException('wrong_operation');
    ob_end_clean();
    echo json_encode(['existed'=>(bool)$match]);
} catch (Throwable $e) {
    ob_end_clean();
    fwrite(STDERR, preg_match('/^[a-z_]+$/D',$e->getMessage()) ? $e->getMessage()."\n" : "history_adapter_failed\n");
    exit(1);
}
