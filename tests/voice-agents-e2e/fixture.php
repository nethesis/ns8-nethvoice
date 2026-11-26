<?php
// Test-only adapter. Requests and responses can contain synthetic SIP passwords.
use NethVoice\Agents\Monitoring;
use NethVoice\Agents\ProviderCatalog;
use NethVoice\Agents\Service;
use NethVoice\Agents\VisualPlan;
ini_set('display_errors', '0');
error_reporting(E_ERROR);
ob_start();

function demand($ok, string $code): void {
    if (!$ok) throw new RuntimeException($code);
}

function internalDirectory(): int {
    foreach (FreePBX::Userman()->getAllDirectories() as $dir) {
        if ($dir['driver'] === 'Freepbx' && $dir['active'] && !$dir['locked']) return (int)$dir['id'];
    }
    throw new RuntimeException('missing_local_userman_directory');
}

function ownedAgent(Service $service, string $name): ?array {
    $found = array_values(array_filter($service->all(), fn($a) => $a['name'] === $name));
    demand(count($found) <= 1, 'ambiguous_fixture_agent');
    return $found[0] ?? null;
}

function checkSyncScope(array $r): void {
    $db=FreePBX::Database();
    foreach ($db->query("SELECT id,freepbx_trunk_id,provider,settings_json,removed,sync_status FROM voice_agent_bindings")->fetchAll(PDO::FETCH_ASSOC) as $binding) {
        demand($binding['sync_status']==='synced', 'unrelated_trunk_pending_sync');
        if (!$binding['removed']) demand(FreePBX::Satellite()->agentTrunkReady($binding),'unrelated_trunk_not_ready');
    }
    $allowed=array_map(fn($suffix)=>$r['owner'].'-'.$suffix,['realtime','live','assistant-realtime','assistant-live']);
    foreach ($db->query("SELECT name FROM voice_agent_agents WHERE sync_status<>'synced' AND (enabled=1 OR active_workflow_version IS NOT NULL OR removed=1)")->fetchAll(PDO::FETCH_COLUMN) as $name) {
        demand(in_array($name,$allowed,true),'unrelated_agent_pending_sync');
    }
}

/** Identity anchors for the run-owned CTI projection, checked before any retirement. */
function fixtureColleague(array $r): ?array {
    $username=$r['owner'].'-colleague';
    $person=FreePBX::Userman()->getUserByUsername($username, internalDirectory());
    if (!$person) return null;
    demand($person['username']===$username && $person['description']===$r['owner']
        && (string)$person['default_extension']===$r['extensions']['colleague'],'cti_identity_mismatch');
    return $person;
}

function ctiProfileRows(int $uid): array {
    $stmt=FreePBX::Database()->prepare('SELECT id,profile_id,mobile,password FROM rest_users WHERE user_id=?');
    $stmt->execute([$uid]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function ctiSettingRows(array $r): array {
    $username=$r['owner'].'-colleague';
    $stmt=NethCTI::Database()->prepare('SELECT id,username,key_name,value FROM user_settings WHERE username=?');
    $stmt->execute([$username]);
    $rows=$stmt->fetchAll(PDO::FETCH_ASSOC);
    $defaults=['desktop_notifications'=>'true','open_ccard'=>'connected','chat_notifications'=>'true',
        'call_summary_notifications'=>'true','default_extension'=>$r['extensions']['colleague']];
    foreach ($rows as $row) {
        demand($row['username']===$username && array_key_exists($row['key_name'],$defaults)
            && $row['value']===$defaults[$row['key_name']],'unexpected_fixture_cti_settings');
    }
    return $rows;
}

function inspectCtiProjection(array $r): array {
    $uid=$r['cti_user_id'] ?? null;
    $profile=$r['cti_profile_id'] ?? null;
    demand(is_int($uid) && $uid>0 && is_int($profile) && $profile>0,'cti_ownership_receipt_missing');
    $person=fixtureColleague($r);
    if ($person) demand((int)$person['id']===$uid,'cti_identity_mismatch');
    $profiles=ctiProfileRows($uid);
    $settings=ctiSettingRows($r);
    demand($person || (!$profiles && !$settings),'cti_projection_without_owned_identity');
    demand(count($profiles)<=1,'unexpected_fixture_cti_profile');
    foreach ($profiles as $row) {
        demand((int)$row['profile_id']===$profile && $row['mobile']===null && $row['password']===null,
            'unexpected_fixture_cti_profile');
    }
    return [$profiles,$settings];
}

function ensureCtiProfile(array $r): int {
    // Legacy FreePBX uses global $db for PEAR. Keep our PDO local and initialize Userman first.
    $person=fixtureColleague($r);
    demand($person && (int)$person['id']===($r['cti_user_id']??null),'cti_identity_mismatch');
    $uid=(int)$person['id'];
    $dir=internalDirectory();
    $db=FreePBX::Database();
    $lockedTables=$db->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()
        AND TABLE_NAME IN ('rest_users','userman_users') AND ENGINE='InnoDB'")->fetchColumn();
    demand((int)$lockedTables===2,'cti_profile_locking_unavailable');
    $db->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    $db->beginTransaction();
    try {
        $identity=$db->prepare('SELECT id FROM userman_users WHERE id=? AND BINARY username=?
            AND BINARY description=? AND default_extension=? AND auth=? FOR UPDATE');
        $identity->execute([$uid,$r['owner'].'-colleague',$r['owner'],$r['extensions']['colleague'],$dir]);
        demand((int)$identity->fetchColumn()===$uid,'cti_identity_mismatch');
        // Hold the same indexed user_id record or its gap across the native upsert.
        $lock=$db->prepare('SELECT id FROM rest_users FORCE INDEX (user_id) WHERE user_id=? FOR UPDATE');
        $lock->execute([$uid]);
        $lock->fetchAll();
        [$profiles]=inspectCtiProjection($r);
        $profile=$r['cti_profile_id'];
        $stmt=$db->prepare('SELECT name FROM rest_cti_profiles WHERE id=?');
        $stmt->execute([$profile]);
        demand($stmt->fetchColumn()==='Standard','cti_profile_unavailable');
        if (!$profiles) {
            // Reuse only the exact owned defaults already committed by the independent CTI DB.
            demand(FreePBX::Database()===$db,'cti_profile_connection_changed');
            demand(setCTIUserProfile($uid,$profile)===true,'cti_profile_unavailable');
        }
        $db->commit();
    } catch (Throwable $failure) {
        if ($db->inTransaction()) $db->rollBack();
        throw $failure;
    }
    return $uid;
}

function retireCtiProjection(array $r, bool $settingsOnly): void {
    $uid=$r['cti_user_id']??null;
    $profile=$r['cti_profile_id']??null;
    demand(is_int($uid) && $uid>0 && is_int($profile) && $profile>0,'cti_ownership_receipt_missing');
    $name=$r['owner'].'-colleague';
    $directory=internalDirectory();
    $db=FreePBX::Database();
    $db->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    $db->beginTransaction();
    try {
        // Protect the original UID and every directory with the same username, including absent records.
        $ids=$db->prepare('SELECT id FROM userman_users FORCE INDEX (username_UNIQUE) WHERE username=? FOR UPDATE');
        $ids->execute([$name]);
        $matches=$ids->fetchAll(PDO::FETCH_COLUMN);
        $lookup=$db->prepare('SELECT username,description,default_extension,auth FROM userman_users WHERE id=? FOR UPDATE');
        $lookup->execute([$uid]);
        $identity=$lookup->fetch(PDO::FETCH_ASSOC);
        if ($identity) {
            demand(count($matches)===1 && (int)$matches[0]===$uid && $identity['username']===$name
                && $identity['description']===$r['owner'] && (string)$identity['default_extension']===$r['extensions']['colleague']
                && (int)$identity['auth']===$directory,'cti_identity_mismatch');
        } else demand(!$matches,'cti_identity_mismatch');
        $lookup=$db->prepare('SELECT id,profile_id,mobile,password FROM rest_users FORCE INDEX (user_id) WHERE user_id=? FOR UPDATE');
        $lookup->execute([$uid]);
        $profiles=$lookup->fetchAll(PDO::FETCH_ASSOC);
        $settings=ctiSettingRows($r);
        if ($profiles) {
            demand(!$settingsOnly && $identity && count($profiles)===1,'unexpected_fixture_cti_profile');
            $row=$profiles[0];
            demand((int)$row['profile_id']===$profile && $row['mobile']===null && $row['password']===null,'unexpected_fixture_cti_profile');
            $drop=$db->prepare('DELETE r FROM rest_users r JOIN userman_users u ON u.id=r.user_id
                WHERE r.id=? AND r.user_id=? AND r.profile_id=? AND r.mobile IS NULL AND r.password IS NULL
                AND BINARY u.username=? AND BINARY u.description=? AND u.default_extension=? AND u.auth=?');
            $drop->execute([$row['id'],$uid,$profile,$name,$r['owner'],$r['extensions']['colleague'],$directory]);
            demand($drop->rowCount()===1,'fixture_cti_profile_changed');
        }
        if ($settingsOnly) {
            // The durable receipt recorded an empty baseline for this randomized username.
            // For recovery after Userman deletion, the locks above prove no UID or username reuse.
            $drop=NethCTI::Database()->prepare('DELETE FROM user_settings WHERE id=? AND BINARY username=?
                AND BINARY key_name=? AND BINARY value=?');
            foreach ($settings as $row) {
                $drop->execute([$row['id'],$name,$row['key_name'],$row['value']]);
                demand($drop->rowCount()===1,'fixture_cti_setting_changed');
            }
            demand(!ctiSettingRows($r),'fixture_cti_settings_still_present');
        }
        $db->commit();
    } catch (Throwable $failure) {
        if ($db->inTransaction()) $db->rollBack();
        throw $failure;
    }
}

function publishAgent(Service $service, array $r, bool $internal = false): array {
    $transport = $r['transport'];
    demand(in_array($transport, ['realtime', 'live'], true), 'invalid_transport');
    $name = $r['owner'].'-'.($internal ? 'assistant-' : '').$transport;
    $existing = ownedAgent($service, $name);
    $binding = $r['binding'];
    $catalog = $service->models(['provider'=>'openai', 'binding_id'=>$binding]);
    $available = array_column($catalog['items'], 'id');
    $models = array_filter(ProviderCatalog::capabilities('openai')['models'],
        fn($m) => (($m['id'] === 'gpt-live-1') === ($transport === 'live')) && in_array($m['id'], $available, true));
    demand((bool)$models, 'transport_model_unavailable');
    $model = reset($models);
    $opts = $model['defaults'];
    if ($opts && !in_array($opts['backend_model'], array_column($catalog['backend_models'], 'id'), true)) {
        demand(!empty($catalog['backend_models']), 'backend_model_unavailable');
        $opts['backend_model'] = $catalog['backend_models'][0]['id'];
    }
    $draft = $internal ? Service::consultationDraft() : Service::emptyDraft();
    $draft['fallback_destination_id'] = $existing['draft']['fallback_destination_id'] ?? $draft['fallback_destination_id'];
    $draft['provider_binding_id'] = $binding;
    $draft['conversation'] = array_replace($draft['conversation'], [
        'model'=>$model['id'], 'options'=>$opts, 'voice'=>'marin', 'language'=>$r['language'],
        'greeting'=>$internal ? '' : $r['greeting'],
        'instructions'=>$internal ? $draft['conversation']['instructions'] :
            trim($draft['conversation']['instructions']."\n".$r['instructions'])
    ]);
    if ($internal) {
        $draft['chat_model'] = $catalog['backend_models'][0]['id'] ?? null;
    } else {
        $e = $r['extensions'];
        $extensionIds = ['extension:'.$e['colleague'], 'extension:'.$e['alternate']];
        $inventory = FreePBX::Satellite()->agentDirectory()['items'];
        $extensions = array_column(array_filter($inventory, fn($d) => $d['type'] === 'extension'), 'id');
        $allowedCallbacks = $r['exclude_callback'] ? [$extensionIds[1]] : $extensionIds;
        foreach ($draft['tool_bindings'] as &$tool) {
            if ($tool['tool_id'] === 'pbx.transfer') {
                $tool['config'] = array_replace($tool['config'], [
                    'extensions_enabled'=>$r['direct'], 'extension_allowlist'=>$extensionIds,
                    'queues_enabled'=>$r['queues'], 'queue_allowlist'=>['queue:'.$r['queue']],
                    'recent_callers_enabled'=>$r['callbacks'],
                    'recent_caller_denylist'=>array_values(array_diff($extensions, $allowedCallbacks)),
                    'descriptions'=>[
                        ['destination_id'=>$extensionIds[0],'description'=>'Giulia Ferri, referente collaudo e assistenza clienti'],
                        ['destination_id'=>$extensionIds[1],'description'=>'Luca Riva, referente collaudo e assistenza clienti'],
                        ['destination_id'=>'queue:'.$r['queue'],'description'=>'Assistenza Collaudo, supporto tecnico']
                    ]
                ]);
                if ($r['attended']) $tool['tool_version'] = 3;
            }
            if ($tool['tool_id'] === 'telephony.hangup') $tool['enabled'] = $r['hangup'];
        }
        unset($tool);
        if ($r['attended']) {
            $assistant = ownedAgent($service, $r['owner'].'-assistant-'.$transport);
            if (!$assistant || !$assistant['published']) $assistant = publishAgent($service, $r, true);
            $draft['contract_version'] = 9;
            $draft['role'] = 'public';
            $draft['chat_model'] = null;
            $draft['consultation'] = ['mode'=>'attended','phone'=>true,'chat'=>$r['chat'],'assistant_id'=>$assistant['agent_id']];
        }
        $draft['max_call_duration_seconds'] = $r['duration'];
    }
    $agent = $service->save($existing['agent_id'] ?? null, ['name'=>$name,'draft'=>$draft], $existing['revision'] ?? 0, $r['owner']);
    $agent = $service->publish($agent['agent_id'], $agent['revision'], $r['owner']);
    if (!$internal) {
        $fallback = $r['fallback'] ? 'extension:'.$r['extensions']['alternate'] : 'hangup';
        if ($agent['published']['fallback_destination_id'] !== $fallback) {
            $service->setFallbacks([$agent['agent_id']=>['expected_revision'=>$agent['revision'], 'destination_id'=>$fallback]], $r['owner']);
            $agent = $service->get($agent['agent_id']);
        }
        demand($agent['routable'], 'agent_not_routable');
    }
    return $agent;
}

try {
    $r = json_decode(file_get_contents('php://stdin'), true, 48, JSON_THROW_ON_ERROR);
    require '/etc/freepbx.conf';
    require_once '/var/www/html/freepbx/rest/lib/agents/Service.php';
    require_once '/var/www/html/freepbx/rest/lib/agents/VisualPlan.php';
    require_once '/var/www/html/freepbx/rest/lib/libUsers.php';
    require_once '/var/www/html/freepbx/rest/lib/libCTI.php';
    require_once '/var/www/html/freepbx/admin/modules/miscapps/functions.inc.php';
    demand(getenv('NETHVOICE_HOST') === $r['domain'], 'wrong_pbx_domain');
    $service = new Service(FreePBX::Database());
    $core = FreePBX::Core();
    $op = $r['operation'];
    $owner = $r['owner'];
    demand((bool)preg_match('/^nvtest-[0-9a-f]{12}$/D', $owner), 'invalid_owner');
    $exts = $r['extensions'];
    $queues = [$r['queue']=>'Assistenza Collaudo', $r['denied_queue']=>'Amministrazione Riservata'];
    $numbers = array_merge(array_values($exts), array_keys($queues), array_values($r['routes']));
    foreach ($numbers as $num) demand(preg_match('/^8[0-9]{6}$/D', (string)$num), 'invalid_fixture_number');
    demand(count(array_unique($numbers)) === 8, 'duplicate_fixture_number');
    $names = ['caller'=>'Anna Bianchi','colleague'=>'Giulia Ferri','alternate'=>'Luca Riva','denied'=>'Paolo Neri'];
    $result = [];
    if (in_array($op, ['preflight','configure','delete'],true)) checkSyncScope($r);
    if ($op === 'preflight') {
        $bindings = array_filter($service->trunks(), fn($t) => $t['provider'] === 'openai' && $t['sync_status'] === 'synced' && $t['api_key_configured']);
        demand(count($bindings) > 0, 'missing_synced_openai_trunk');
        $result = ['binding'=>array_values($bindings)[0]['binding_id'], 'domain'=>$r['domain'],
            'directory'=>internalDirectory(), 'client_proxy'=>getenv('NETHVOICE_PROXY_FQDN'),
            'endpoint_proxy'=>getenv('PROXY_IP'), 'proxy_port'=>(int)getenv('PROXY_PORT')];
    } elseif ($op === 'create') {
        foreach ($numbers as $number) {
            demand(!framework_check_extension_usage($number) && !$core->getDevice($number) && !queues_get($number) &&
                !FreePBX::Voicemail()->getMailbox($number), 'fixture_number_in_use');
        }
        $spool = $amp_conf['ASTSPOOLDIR'] ?? '';
        demand($spool && !file_exists($spool.'/voicemail/default/'.$exts['colleague']), 'fixture_mailbox_spool_in_use');
        $directory = internalDirectory();
        foreach ($exts as $role => $ext) {
            $username = $owner.'-'.$role;
            demand(!FreePBX::Userman()->getUserByUsername($username), 'fixture_identity_in_use');
            $name = $names[$role].' '.$owner;
            $user = $core->generateDefaultUserSettings($ext, $name);
            foreach (['recording_in_internal','recording_out_internal','recording_in_external','recording_out_external'] as $key) $user[$key]='never';
            $user['ringtimer']=10;
            $user['noanswer_dest']=$user['busy_dest']='app-blackhole,hangup,1';
            if ($role==='colleague') {
                // Core records the voicemail context from the mailbox when adding the extension.
                FreePBX::Voicemail()->addMailbox($ext,['vm'=>'enabled',
                    'vmpwd'=>(string)random_int(10000000,99999999),'name'=>$owner]);
                $mailbox=FreePBX::Voicemail()->getMailbox($ext);
                demand($mailbox && $mailbox['name']===$owner,'fixture_mailbox_creation_failed');
            }
            $core->addUser($ext,$user);
            if ($role==='colleague') {
                demand(($core->getUser($ext)['voicemail']??null)===$mailbox['vmcontext'],
                    'fixture_voicemail_context_missing');
            }
            $device=$core->generateDefaultDeviceSettings('pjsip',$ext,$owner);
            $secret=bin2hex(random_bytes(24));
            foreach (['secret'=>$secret,'transport'=>'0.0.0.0-udp','outbound_proxy'=>$r['endpoint_proxy'],
                      'rewrite_contact'=>'no','force_rport'=>'no','rtp_symmetric'=>'yes','qualifyfreq'=>'0',
                      'disallow'=>'all','allow'=>'ulaw,alaw','max_contacts'=>'1'] as $key=>$value) $device[$key]['value']=$value;
            $core->addDevice($ext,'pjsip',$device);
            $password = "Nv9!".bin2hex(random_bytes(24));
            $status=FreePBX::Userman()->addUserByDirectory($directory,$username,$password,$ext,$owner,['displayname'=>$names[$role]]);
            demand($status['status'], 'fixture_identity_creation_failed');
            $result[$role]=['username'=>$ext,'password'=>$secret];
            if ($role==='colleague') $result['cti']=['host'=>getenv('NETHCTI_UI_HOST'),'username'=>$username,
                'password'=>$password,'extension'=>$ext];
        }
        foreach ($queues as $number=>$title) {
            $_REQUEST = ['action'=>'add','strategy'=>'ringall','timeout'=>6,'retry'=>1,'joinempty'=>'yes','leavewhenempty'=>'no',
                'maxlen'=>'0','wrapuptime'=>'0','announcefreq'=>'0','min-announce'=>'15','announceholdtime'=>'no','announceposition'=>'no','recording'=>'dontcare','autopause'=>'no','cron_schedule'=>'never'];
            queues_add((string)$number,$title.' '.$owner,'','','app-blackhole,hangup,1','',[],'',15,'','2','','0','0',[],'no');
        }
        needreload();
    } elseif ($op === 'verify_links') {
        foreach ($exts as $role=>$number) {
            $device=$core->getDevice($number);
            demand($device && $device['description']===$owner && (string)$device['user']===$number
                && $device['dial']==='PJSIP/'.$number,'fixture_core_device_link_invalid');
            // Match the exact keys used by macro-dial-one/dstring before sending SIP traffic.
            foreach (['AMPUSER '.$number.'/device'=>$number, 'DEVICE '.$number.'/user'=>$number,
                      'DEVICE '.$number.'/dial'=>'PJSIP/'.$number] as $key=>$expected) {
                $resp=$astman->Command('database get '.$key);
                demand(($resp['Response']??null)==='Success'
                    && preg_match('/^Value: '.preg_quote($expected,'/').'\s*$/m',$resp['data']??''),
                    'fixture_asterisk_device_link_invalid');
            }
        }
        $result=['verified'=>true];
    } elseif ($op === 'cti_config') {
        require '/var/www/html/freepbx/rest/config.inc.php';
        $users=json_decode(file_get_contents($config['settings']['cti_config_path'].'/users.json'),true,512,JSON_THROW_ON_ERROR);
        demand(is_array($users),'cti_configuration_unavailable');
        $user=$users[$owner.'-colleague'] ?? null;
        if ($r['present']) {
            demand($user && (int)$user['profile_id']===$r['cti_profile_id']
                && isset($user['endpoints']['mainextension'][$exts['colleague']]),'cti_configuration_missing_identity');
        } else {
            demand(!$user,'cti_configuration_still_present');
        }
        $result=['verified'=>true];
    } elseif ($op === 'cti_prerequisite') {
        $person=fixtureColleague($r);
        demand($person,'cti_identity_mismatch');
        $uid=(int)$person['id'];
        demand(!ctiProfileRows($uid) && !ctiSettingRows($r),'fixture_cti_projection_already_exists');
        // Existing Standard profile, with actual NethVoice CTI chat permission.
        $profile=FreePBX::Database()->query("SELECT p.id FROM rest_cti_profiles p JOIN rest_cti_profiles_macro_permissions pm ON pm.profile_id=p.id
            JOIN rest_cti_macro_permissions m ON m.id=pm.macro_permission_id
            JOIN rest_cti_macro_permissions_permissions mp ON mp.macro_permission_id=m.id
            JOIN rest_cti_permissions c ON c.id=mp.permission_id JOIN rest_cti_profiles_permissions pp ON pp.profile_id=p.id AND pp.permission_id=c.id
            WHERE p.name='Standard' AND m.name='nethvoice_cti' AND c.name='chat' LIMIT 1")->fetchColumn();
        demand($profile,'cti_profile_unavailable');
        $result=['cti_user_id'=>$uid,'cti_profile_id'=>(int)$profile];
    } elseif ($op === 'cti') {
        $uid=ensureCtiProfile($r);
        $permission=getCTIUserPermission($uid,'nethvoice_cti','chat');
        demand($permission && $permission['allowed'],'cti_chat_permission_missing');
    } elseif ($op === 'retire_cti' || $op === 'retire_cti_settings') {
        retireCtiProjection($r,$op==='retire_cti_settings');
    } elseif ($op === 'mailbox_count') {
        $ext=$exts['colleague'];
        $box=FreePBX::Voicemail()->getMailbox($ext);
        demand($box && $box['name']===$owner, 'mailbox_owner_mismatch');
        require_once '/var/www/html/freepbx/rest/lib/libExtensions.php';
        demand(getMainExtensionVoicemailEnabled($ext),'fixture_voicemail_not_enabled');
        $info=$astman->GetVar(null,'VM_INFO('.$ext.'@default,count,INBOX)');
        demand(ctype_digit((string)($info['Value']??'')),'mailbox_count_unavailable');
        $result=['count'=>(int)$info['Value']];
    } elseif ($op === 'queue_inventory') {
        $result = array_values(array_column(array_filter(FreePBX::Satellite()->agentDirectory()['items'], fn($d) => $d['type']==='queue'), 'id'));
    } elseif ($op === 'queue_cursor') {
        $result=['cursor'=>(int)FreePBX::Database()->query('SELECT COALESCE(MAX(id),0) FROM asteriskcdrdb.queue_log')->fetchColumn()];
    } elseif ($op === 'queue_connected') {
        demand(in_array($r['recipient'],$exts,true),'invalid_queue_member');
        $stmt=FreePBX::Database()->prepare("SELECT COUNT(*) FROM asteriskcdrdb.queue_log WHERE id>? AND queuename=? AND agent=? AND event='CONNECT'");
        $stmt->execute([$r['cursor'],$r['queue'],'PJSIP/'.$r['recipient']]);
        $result=['connected'=>(bool)$stmt->fetchColumn()];
    } elseif ($op === 'directory_owner') {
        $ch=curl_init(getUserPortalUrl().'/list-users');
        $token=getToken();
        demand($token,'directory_service_unavailable');
        setUserPortalCurlDefaults($ch,['Content-Type: application/json','Authorization: Bearer '.$token]);
        curl_setopt($ch,CURLOPT_POSTFIELDS,'{}');
        $response=json_decode(curl_exec($ch),true);
        demand(curl_getinfo($ch,CURLINFO_HTTP_CODE)===200 && is_array($response['users']??null), 'directory_service_unavailable');
        $matches=array_filter($response['users'],fn($u)=>$u['user']===$owner.'-colleague');
        demand(count($matches)<2 && (!$matches || reset($matches)['display_name']===$owner),'directory_owner_mismatch');
        $result=['owned'=>(bool)$matches];
    } elseif ($op === 'configure') {
        $a = publishAgent($service,$r);
        $route = $r['routes'][$r['transport']];
        $label = $owner.'-route-'.$r['transport'];
        $dest = VisualPlan::resolve(VisualPlan::widget($a), fn($id) => $service->get($id));
        $match = array_values(array_filter(miscapps_list(true), fn($row) => (string)$row['ext'] === $route));
        if (!$match) {
            demand(!framework_check_extension_usage($route), 'route_collision');
            miscapps_add($label,$route,$dest);
            needreload();
        } else demand(count($match)===1 && $match[0]['description']===$label && $match[0]['dest']===$dest, 'route_owner_mismatch');
        $result = ['agent_id'=>$a['agent_id'],'workflow_version'=>$a['workflow_version'],'new_route'=>!$match];
    } elseif ($op === 'runs' || $op === 'trace' || $op === 'children') {
        $agent = ownedAgent($service, $owner.'-'.$r['transport']);
        demand($agent, 'fixture_agent_missing');
        if ($op==='runs') $result=$service->runs($agent['agent_id'])['items'];
        else {
            $run = (new Monitoring(FreePBX::Database()))->run($r['run_id']);
            demand($run['agent_id'] === $agent['agent_id'], 'run_owner_mismatch');
            if ($op==='trace') {
                $run['events'] = [];
                $query = [];
                for ($page=0; $page<10; $page++) {
                    $trace = $service->trace($r['run_id'], $query);
                    array_push($run['events'], ...$trace['items']);
                    if ($trace['next_cursor'] === null) break;
                    $query = ['cursor'=>$trace['next_cursor']];
                }
                $result = $run;
            } else {
                $assistant=ownedAgent($service,$owner.'-assistant-'.$r['transport']);
                $result=$assistant ? array_values(array_filter($service->runs($assistant['agent_id'])['items'],fn($child)=>$child['parent_run_id']===$r['run_id'])) : [];
            }
        }
    } elseif ($op === 'delete') {
        foreach (miscapps_list(true) as $route) foreach ($r['routes'] as $transport=>$number) {
            if ((string)$route['ext']===$number && $route['description']===$owner.'-route-'.$transport) miscapps_delete($route['miscapps_id']);
        }
        foreach (['realtime','live','assistant-realtime','assistant-live'] as $suffix) {
            $agent=ownedAgent($service,$owner.'-'.$suffix);
            if ($agent) $service->remove($agent['agent_id'],$agent['revision'],$owner);
        }
        foreach ($queues as $num=>$title) {
            $q=queues_get($num);
            if ($q && $q['name']===$title.' '.$owner) queues_del($num);
        }
        $box=FreePBX::Voicemail()->getMailbox($exts['colleague']);
        if ($box && $box['name']===$owner) {
            $mail=FreePBX::Voicemail();
            $number=$exts['colleague'];
            foreach (array_keys($mail->getMessagesByExtension($number)['messages']) as $id) {
                demand($mail->deleteMessageByID($id,$number),'fixture_voicemail_cleanup_failed');
            }
            demand($mail->delMailbox($number),'fixture_mailbox_cleanup_failed');
        }
        foreach ($exts as $role=>$ext) {
            $person=FreePBX::Userman()->getUserByUsername($owner.'-'.$role, internalDirectory());
            if ($person) {
                demand($person['description']===$owner && (string)$person['default_extension']===$ext,'identity_owner_mismatch');
                demand(FreePBX::Userman()->deleteUserByID($person['id'])['status'],'identity_cleanup_failed');
            }
            $device=$core->getDevice($ext);
            if ($device && $device['description']===$owner) $core->delDevice($ext);
            $user=$core->getUser($ext);
            if ($user && $user['name']===$names[$role].' '.$owner) $core->delUser($ext);
        }
        needreload();
    } elseif ($op === 'verify') {
        if (!empty($r['cti_user_id'])) {
            $stmt=FreePBX::Database()->prepare('SELECT COUNT(*) FROM rest_users WHERE user_id=?');
            $stmt->execute([$r['cti_user_id']]);
            demand((int)$stmt->fetchColumn()===0,'fixture_cti_profile_still_present');
            $stmt=NethCTI::Database()->prepare('SELECT COUNT(*) FROM user_settings WHERE username=?');
            $stmt->execute([$owner.'-colleague']);
            demand((int)$stmt->fetchColumn()===0,'fixture_cti_settings_still_present');
        }
        demand(!FreePBX::Voicemail()->getMailbox($exts['colleague']), 'fixture_mailbox_still_present');
        foreach ($numbers as $num) demand(!framework_check_extension_usage($num) && !$core->getDevice($num) && !queues_get($num), 'fixture_number_still_used');
        foreach ($exts as $role=>$ext) demand(!FreePBX::Userman()->getUserByUsername($owner.'-'.$role), 'fixture_identity_still_present');
        foreach (['realtime','live','assistant-realtime','assistant-live'] as $suffix) demand(!ownedAgent($service,$owner.'-'.$suffix),'fixture_agent_still_present');
    } else throw new RuntimeException('unknown_operation');
    ob_end_clean();
    echo json_encode($result, JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    ob_end_clean();
    $reason=$error->getMessage();
    fwrite(STDERR, (preg_match('/^[a-z][a-z0-9_]{1,72}$/D',$reason) ? $reason : ('fixture_error_'.preg_replace('/[^a-z0-9_]/', '_', strtolower(basename($error->getFile()))).'_'.$error->getLine()))."\n");
    exit(1);
}
