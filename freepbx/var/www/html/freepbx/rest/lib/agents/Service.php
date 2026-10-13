<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;
require_once __DIR__ . '/Schema.php';
require_once __DIR__ . '/PublishedContract.php';
require_once __DIR__ . '/SecretStore.php';
require_once __DIR__ . '/Native.php';

/** PHP owns drafts, immutable publication, grants and configuration auditing. */
final class Service
{
    private \PDO $db;
    private object $native;
    private SecretStore $crypto;
    public function __construct(\PDO $db, ?object $native = null)
    {
        $this->db = $db;
        $this->native = $native ?? new Native();
        $this->crypto = new SecretStore();
    }
    private function query(string $sql, array $args = []): \PDOStatement
    { $q = $this->db->prepare($sql); $q->execute($args); return $q; }
    private static function fail(string $code, int $status = 422): never
    { throw new \RuntimeException($code, $status); }
    private static function id(string $id): void
    { if (!preg_match('/^[a-z][a-z0-9_-]{0,47}$/D', $id)) self::fail('invalid_identifier'); }
    private static function fields(array $input, array $allowed): void
    { if (array_diff(array_keys($input), $allowed)) self::fail('invalid_fields'); }
    private static function text($value, int $max, bool $required = false): string
    {
        if (!is_string($value) || mb_strlen($value, 'UTF-8') > $max || ($required && trim($value) === '') || str_contains($value, "\0")) self::fail('invalid_field');
        return $value;
    }
    private static function uuid(): string
    { $h = bin2hex(random_bytes(16)); return substr($h,0,8).'-'.substr($h,8,4).'-4'.substr($h,13,3).'-a'.substr($h,17,3).'-'.substr($h,20); }
    private static function encode(array $value): string
    { return json_encode($value,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); }
    private function locked(callable $work)
    {
        if ((int)$this->db->query("SELECT GET_LOCK('voice_agent_configuration', 5)")->fetchColumn() !== 1) self::fail('configuration_busy', 409);
        try { return $work(); }
        finally { if ($this->db->inTransaction()) $this->db->rollBack(); $this->db->query("SELECT RELEASE_LOCK('voice_agent_configuration')"); }
    }
    private static function revision(array $row, int $revision): void
    { if ($revision < 1 || (int)$row['revision'] !== $revision) self::fail('revision_conflict', 409); }
    private function audit(string $id, string $actor, string $action, int $revision, bool $binding = false): void
    {
        $table = $binding ? 'voice_agent_binding_audit' : 'voice_agent_audit';
        $column = $binding ? 'binding_id' : 'agent_id';
        $this->query("INSERT INTO asterisk.$table (audit_id,$column,actor,action,revision) VALUES (?,?,?,?,?)", [self::uuid(),$id,self::text($actor,100,true),$action,$revision]);
    }
    public function catalog(): array
    {
        $tools=array_map(fn($row)=>json_decode($row['manifest_json'],true,512,JSON_THROW_ON_ERROR),$this->query('SELECT manifest_json FROM asterisk.voice_agent_runtime_tools ORDER BY tool_id')->fetchAll(\PDO::FETCH_ASSOC));
        return ['agent_types'=>[['id'=>'basic_voice','name'=>'Basic Voice']],
            'tools'=>$tools,
            'providers'=>['openai','grok'], 'extensions'=>$this->native->extensions()];
    }
    public function all(): array
    {
        return array_map(fn($row) => $this->get($row['agent_id']), $this->query('SELECT agent_id FROM asterisk.voice_agent_agents WHERE removed=0 ORDER BY kind,name,agent_id')->fetchAll(\PDO::FETCH_ASSOC));
    }
    public function get(string $id): array
    {
        self::id($id);
        $row = $this->query('SELECT * FROM asterisk.voice_agent_agents WHERE agent_id=? AND removed=0',[$id])->fetch(\PDO::FETCH_ASSOC);
        if (!$row) self::fail('agent_not_found',404);
        $draft = $this->query('SELECT definition_json FROM asterisk.voice_agent_drafts WHERE agent_id=?',[$id])->fetchColumn();
        $published = $row['active_workflow_version'] ? $this->query('SELECT definition_json FROM asterisk.voice_agent_versions WHERE agent_id=? AND workflow_version=?',[$id,$row['active_workflow_version']])->fetchColumn() : false;
        return ['agent_id'=>$id,'name'=>$row['name'],'kind'=>$row['kind'],'destination_id'=>$row['destination_id'],
            'enabled'=>(bool)$row['enabled'],'revision'=>(int)$row['revision'], 'workflow_version'=>$row['active_workflow_version'] ? (int)$row['active_workflow_version'] : null,
            'sync_status'=>$row['sync_status'],'routable'=>(bool)$row['enabled'] && (bool)$published && $row['sync_status']==='synced' && $this->bindingReady($published),
            'draft'=>$draft ? json_decode($draft,true,512,JSON_THROW_ON_ERROR) : self::emptyDraft(),
            'published'=>$published ? json_decode($published,true,512,JSON_THROW_ON_ERROR) : null];
    }
    private function bindingReady(string $published): bool
    {
        $snapshot=json_decode($published,true,512,JSON_THROW_ON_ERROR);
        $q=$this->query("SELECT COUNT(*) FROM asterisk.voice_agent_bindings WHERE binding_id=? AND removed=0 AND sync_status='synced'",[$snapshot['provider_binding_id']]);
        return (int)$q->fetchColumn()===1;
    }
    private static function emptyDraft(): array
    {
        return ['provider_binding_id'=>null,'conversation'=>['language'=>'en','voice'=>'','greeting'=>'','instructions'=>''],
            'enabled_tools'=>[],'approved_destination_ids'=>[],'fallback_destination_id'=>null,'max_call_duration_seconds'=>600];
    }
    private function validateDraft(array $draft): array
    {
        self::fields($draft,array_keys(self::emptyDraft()));
        if (array_diff(array_keys(self::emptyDraft()),array_keys($draft))) self::fail('invalid_fields');
        // Validate the same contract with placeholders for optional incomplete draft fields.
        $snapshot = $draft + ['contract_version'=>1,'agent_id'=>'validation','destination_id'=>'agent:validation','workflow_version'=>1,'provider'=>'openai'];
        if ($snapshot['provider_binding_id'] === null) $snapshot['provider_binding_id']='unconfigured';
        if ($snapshot['fallback_destination_id'] === null) $snapshot['fallback_destination_id']='extension:0';
        try { PublishedContract::validate($snapshot); }
        catch (\Throwable $error) { self::fail('invalid_configuration'); }
        if ($draft['provider_binding_id'] !== null) $this->binding($draft['provider_binding_id']);
        $available = array_column($this->native->extensions(),'id');
        foreach (array_merge($draft['approved_destination_ids'], $draft['fallback_destination_id'] ? [$draft['fallback_destination_id']] : []) as $target) {
            if (!in_array($target,$available,true)) self::fail('destination_unavailable');
        }
        return $draft;
    }
    public function save(?string $id, array $input, int $revision, string $actor): array
    {
        return $this->locked(function() use ($id,$input,$revision,$actor) {
            self::fields($input,['name','draft']);
            $name=self::text($input['name']??null,100,true);
            if (!is_array($input['draft']??null)) self::fail('invalid_configuration');
            $draft=$this->validateDraft($input['draft']);
            $creating=$id===null;
            if ($creating && $revision!==0) self::fail('revision_conflict',409);
            $id=$id ?? 'agent_'.bin2hex(random_bytes(8));
            if (!$creating) self::revision($this->get($id),$revision);
            $this->db->beginTransaction();
            if ($creating) $this->query('INSERT INTO asterisk.voice_agent_agents (agent_id,name,destination_id) VALUES (?,?,?)',[$id,$name,'agent:'.$id]);
            else $this->query('UPDATE asterisk.voice_agent_agents SET name=?,revision=revision+1 WHERE agent_id=?',[$name,$id]);
            $this->query('INSERT INTO asterisk.voice_agent_drafts (agent_id,revision,definition_json) VALUES (?,?,?) ON DUPLICATE KEY UPDATE revision=VALUES(revision),definition_json=VALUES(definition_json)',[$id,$revision+1,self::encode($draft)]);
            $this->audit($id,$actor,$creating?'created':'draft_saved',$revision+1);
            $this->db->commit();
            return $this->get($id);
        });
    }
    public function publish(string $id, int $revision, string $actor): array
    {
        return $this->locked(function() use ($id,$revision,$actor) {
            $agent=$this->get($id); self::revision($agent,$revision);
            $draft=$this->validateDraft($agent['draft']);
            if (!$draft['provider_binding_id']) self::fail('provider_required');
            $binding=$this->binding($draft['provider_binding_id']);
            if ($binding['sync_status']!=='synced') self::fail('trunk_not_ready',409);
            if (!$draft['fallback_destination_id']) self::fail('fallback_required');
            if (trim($draft['conversation']['voice'])==='' || trim($draft['conversation']['instructions'])==='') self::fail('conversation_required');
            $version=(int)$this->query('SELECT COALESCE(MAX(workflow_version),0)+1 FROM asterisk.voice_agent_versions WHERE agent_id=?',[$id])->fetchColumn();
            $snapshot=$draft+['contract_version'=>1,'agent_id'=>$id,'destination_id'=>'agent:'.$id,'workflow_version'=>$version,'provider'=>$binding['provider']];
            PublishedContract::validate($snapshot);
            $changed=!$agent['published'] || $agent['published']['fallback_destination_id']!==$snapshot['fallback_destination_id'] || $agent['published']['provider_binding_id']!==$snapshot['provider_binding_id'];
            $this->db->beginTransaction();
            $this->query('INSERT INTO asterisk.voice_agent_versions (agent_id,workflow_version,definition_json) VALUES (?,?,?)',[$id,$version,self::encode($snapshot)]);
            $this->query('UPDATE asterisk.voice_agent_agents SET active_workflow_version=?,revision=revision+1,sync_status=? WHERE agent_id=?',[$version,$changed?'pending':$agent['sync_status'],$id]);
            $this->audit($id,$actor,'published',$revision+1);
            $this->db->commit();
            if ($changed) $this->synchronizeUnlocked($actor);
            return $this->get($id);
        });
    }
    public function enable(string $id, bool $enabled, int $revision, string $actor): array
    {
        return $this->locked(function() use ($id,$enabled,$revision,$actor) {
            $agent=$this->get($id); self::revision($agent,$revision);
            if ($enabled) {
                if (!$agent['published']) self::fail('publication_required');
                $snapshot=$agent['published'];
                $this->validateDraft(array_intersect_key($snapshot,self::emptyDraft()));
                if ($this->binding($snapshot['provider_binding_id'])['sync_status']!=='synced') self::fail('trunk_not_ready',409);
            }
            $this->db->beginTransaction();
            $this->query("UPDATE asterisk.voice_agent_agents SET enabled=?,revision=revision+1,sync_status='pending' WHERE agent_id=?",[$enabled?1:0,$id]);
            $this->audit($id,$actor,$enabled?'enabled':'disabled',$revision+1);
            $this->db->commit();
            $this->synchronizeUnlocked($actor); return $this->get($id);
        });
    }
    public function remove(string $id, int $revision, string $actor): array
    {
        return $this->locked(function() use ($id,$revision,$actor) {
            $agent=$this->get($id); self::revision($agent,$revision);
            if ($agent['kind']==='builtin') self::fail('builtin_protected',409);
            if ($this->native->inUse($id)) self::fail('agent_in_use',409);
            $this->db->beginTransaction();
            $this->query("UPDATE asterisk.voice_agent_agents SET removed=1,enabled=0,revision=revision+1,sync_status=? WHERE agent_id=?",[$agent['published']?'pending':'synced',$id]);
            $this->audit($id,$actor,'removed',$revision+1);
            $this->db->commit();
            if ($agent['published']) $this->synchronizeUnlocked($actor);
            return ['removed'=>true];
        });
    }
    public function synchronize(string $actor): array
    { return $this->locked(fn()=>$this->synchronizeUnlocked($actor)); }
    private function synchronizeUnlocked(string $actor): array
    {
        $bindings=[];
        foreach ($this->query("SELECT * FROM asterisk.voice_agent_bindings WHERE removed=0 AND sync_status<>'synced'")->fetchAll(\PDO::FETCH_ASSOC) as $row) {
            $success=false;
            try {
                $nativeId=$this->native->provision(empty($row['freepbx_trunk_id'])?'create':'update',$this->nativeBinding($row),$this->nativeBinding($row));
                if ($nativeId>0) {
                    $this->query('UPDATE asterisk.voice_agent_bindings SET freepbx_trunk_id=? WHERE binding_id=?',[$nativeId,$row['binding_id']]);
                    $success=true;
                }
            } catch (\Throwable $error) { /* Safe persisted status below; no secrets in responses. */ }
            $bindings[]=['row'=>$row,'success'=>$success];
        }
        try { $ok=$this->native->apply(); } catch (\Throwable $error) { $ok=false; }
        $this->db->beginTransaction();
        $allOk=$ok;
        foreach ($bindings as $binding) {
            $synced=$ok && $binding['success']; $row=$binding['row'];
            $allOk=$allOk && $synced;
            $this->query('UPDATE asterisk.voice_agent_bindings SET sync_status=? WHERE binding_id=?',[$synced?'synced':'error',$row['binding_id']]);
            $this->audit($row['binding_id'],$actor,$synced?'native_synced':'native_sync_failed',(int)$row['revision'],true);
        }
        foreach ($this->query("SELECT agent_id,revision FROM asterisk.voice_agent_agents WHERE sync_status<>'synced' AND (active_workflow_version IS NOT NULL OR removed=1)")->fetchAll(\PDO::FETCH_ASSOC) as $row) {
            $this->query('UPDATE asterisk.voice_agent_agents SET sync_status=? WHERE agent_id=?',[$ok?'synced':'error',$row['agent_id']]);
            $this->audit($row['agent_id'],$actor,$ok?'native_synced':'native_sync_failed',(int)$row['revision']);
        }
        foreach ($this->query("SELECT binding_id,revision FROM asterisk.voice_agent_bindings WHERE removed=1 AND sync_status<>'synced'")->fetchAll(\PDO::FETCH_ASSOC) as $row) {
            $this->query('UPDATE asterisk.voice_agent_bindings SET sync_status=? WHERE binding_id=?',[$ok?'synced':'error',$row['binding_id']]);
            $this->audit($row['binding_id'],$actor,$ok?'native_synced':'native_sync_failed',(int)$row['revision'],true);
        }
        $this->db->commit();
        return ['sync_status'=>$allOk?'synced':'error'];
    }

    private function binding(string $id): array
    {
        self::id($id);
        $row=$this->query('SELECT * FROM asterisk.voice_agent_bindings WHERE binding_id=? AND removed=0',[$id])->fetch(\PDO::FETCH_ASSOC);
        if (!$row) self::fail('trunk_not_found',404);
        return $row;
    }
    private function safeBinding(array $row): array
    {
        $settings=json_decode($row['settings_json'],true,512,JSON_THROW_ON_ERROR);
        return $settings+['binding_id'=>$row['binding_id'],'name'=>$row['name'],'provider'=>$row['provider'],'runtime_owner'=>'builtin',
            'revision'=>(int)$row['revision'],'sync_status'=>$row['sync_status'],'freepbx_trunk_id'=>$row['freepbx_trunk_id']?(int)$row['freepbx_trunk_id']:null,
            'api_key_configured'=>true,'webhook_secret_configured'=>true];
    }
    public function trunks(): array
    { return array_map(fn($row)=>$this->safeBinding($row),$this->query('SELECT * FROM asterisk.voice_agent_bindings WHERE removed=0 ORDER BY name')->fetchAll(\PDO::FETCH_ASSOC)); }
    private function nativeBinding(array $row): array
    {
        $settings=json_decode($row['settings_json'],true,512,JSON_THROW_ON_ERROR);
        $secrets=json_decode($this->crypto->decryptSecret($row['secrets_encrypted']),true,512,JSON_THROW_ON_ERROR);
        return $settings+$row+['sip_auth_password_encrypted'=>$this->crypto->encryptSecret($secrets['sip_password']??'')];
    }
    public function saveTrunk(?string $id, array $input, int $revision, string $actor): array
    {
        return $this->locked(function() use ($id,$input,$revision,$actor) {
            self::fields($input,['name','provider','openai_project_id','grok_phone_number','sip_auth_mode','sip_auth_username','sip_password','api_key','webhook_secret']);
            $previous=$id===null?null:$this->binding($id);
            if ($previous) self::revision($previous,$revision);
            elseif ($revision!==0) self::fail('revision_conflict',409);
            $provider=$input['provider']??null;
            if (!in_array($provider,['openai','grok'],true) || ($previous && $previous['provider']!==$provider)) self::fail('invalid_provider');
            $name=self::text($input['name']??null,100,true);
            $settings=['sip_auth_mode'=>$input['sip_auth_mode']??'none'];
            if ($provider==='openai') {
                $settings['openai_project_id']=self::text($input['openai_project_id']??null,128,true);
                if (!preg_match('/^proj_[A-Za-z0-9_-]+$/D',$settings['openai_project_id']) || $settings['sip_auth_mode']!=='none') self::fail('invalid_provider_configuration');
            } else {
                $settings['grok_phone_number']=self::text($input['grok_phone_number']??null,32,true);
                if (!preg_match('/^\+[1-9][0-9]{1,14}$/D',$settings['grok_phone_number']) || !in_array($settings['sip_auth_mode'],['none','digest'],true)) self::fail('invalid_provider_configuration');
                if ($settings['sip_auth_mode']==='digest') {
                    $settings['sip_auth_username']=self::text($input['sip_auth_username']??null,128,true);
                    if (preg_match('/[\x00-\x20\x7F]/',$settings['sip_auth_username'])) self::fail('invalid_provider_configuration');
                }
            }
            $secrets=$previous?json_decode($this->crypto->decryptSecret($previous['secrets_encrypted']),true,512,JSON_THROW_ON_ERROR):[];
            foreach (['api_key','webhook_secret','sip_password'] as $field) {
                if (isset($input[$field]) && $input[$field]!=='') {
                    $secrets[$field]=self::text($input[$field],4096,true);
                    if (preg_match('/[\r\n\x00]/',$secrets[$field])) self::fail('invalid_secret');
                }
            }
            if (empty($secrets['api_key']) || empty($secrets['webhook_secret']) || ($settings['sip_auth_mode']==='digest' && empty($secrets['sip_password']))) self::fail('credentials_required');
            if (!str_starts_with($secrets['webhook_secret'],'whsec_') || base64_decode(substr($secrets['webhook_secret'],6),true) === false || strlen(base64_decode(substr($secrets['webhook_secret'],6),true)) < 16) self::fail('invalid_secret');
            $id=$id??'trunk_'.bin2hex(random_bytes(8));
            $this->db->beginTransaction();
            if (!$previous) $this->query('INSERT INTO asterisk.voice_agent_bindings (binding_id,name,provider,settings_json,secrets_encrypted) VALUES (?,?,?,?,?)',[$id,$name,$provider,json_encode($settings,JSON_THROW_ON_ERROR),$this->crypto->encryptSecret(json_encode($secrets,JSON_THROW_ON_ERROR))]);
            else $this->query("UPDATE asterisk.voice_agent_bindings SET name=?,settings_json=?,secrets_encrypted=?,revision=revision+1,sync_status='pending' WHERE binding_id=?",[$name,json_encode($settings,JSON_THROW_ON_ERROR),$this->crypto->encryptSecret(json_encode($secrets,JSON_THROW_ON_ERROR)),$id]);
            $this->audit($id,$actor,$previous?'updated':'created',$revision+1,true);
            $this->db->commit();
            $row=$this->binding($id);
            try {
                $nativeId=$this->native->provision($previous?'update':'create',$this->nativeBinding($row),$previous?$this->nativeBinding($previous):null);
                $ok=$nativeId>0 && $this->native->apply();
                $this->query('UPDATE asterisk.voice_agent_bindings SET freepbx_trunk_id=?,sync_status=? WHERE binding_id=?',[$nativeId?:null,$ok?'synced':'error',$id]);
            } catch (\Throwable $error) {
                $this->query("UPDATE asterisk.voice_agent_bindings SET sync_status='error' WHERE binding_id=?",[$id]);
            }
            $result=$this->binding($id);
            $this->audit($id,$actor,$result['sync_status']==='synced'?'native_synced':'native_sync_failed',(int)$result['revision'],true);
            return $this->safeBinding($result);
        });
    }
    public function removeTrunk(string $id, int $revision, string $actor): array
    {
        return $this->locked(function() use ($id,$revision,$actor) {
            $row=$this->binding($id); self::revision($row,$revision);
            foreach ($this->all() as $agent) {
                if ($agent['draft']['provider_binding_id']===$id || ($agent['published']['provider_binding_id']??null)===$id) self::fail('trunk_in_use',409);
            }
            try { $this->native->provision('delete',$this->nativeBinding($row),null); }
            catch (\Throwable $error) { self::fail('native_sync_failed',503); }
            $this->db->beginTransaction();
            $this->query("UPDATE asterisk.voice_agent_bindings SET removed=1,revision=revision+1,sync_status='pending' WHERE binding_id=?",[$id]);
            $this->audit($id,$actor,'removed',$revision+1,true); $this->db->commit();
            return ['removed'=>true]+$this->synchronizeUnlocked($actor);
        });
    }
    public function runs(?string $agentId = null, int $page = 1): array
    {
        if ($agentId!==null) self::id($agentId);
        if ($page<1 || $page>10000) self::fail('invalid_page');
        $where=$agentId?' WHERE r.agent_id=?':''; $args=$agentId?[$agentId]:[];
        $offset=($page-1)*25;
        $rows=$this->query('SELECT r.run_id,r.agent_id,a.name AS agent_name,r.workflow_version,r.started_at,r.ended_at,r.outcome,r.error_code FROM asteriskcdrdb.voice_agent_runs r LEFT JOIN asterisk.voice_agent_agents a ON a.agent_id=r.agent_id'.$where.' ORDER BY r.started_at DESC,r.run_id DESC LIMIT 26 OFFSET '.$offset,$args)->fetchAll(\PDO::FETCH_ASSOC);
        return ['items'=>array_slice($rows,0,25),'page'=>$page,'has_more'=>count($rows)>25];
    }
    public function run(string $id): array
    {
        if (!preg_match('/^[a-f0-9-]{36}$/D',$id)) self::fail('invalid_identifier');
        $row=$this->query('SELECT run_id,agent_id,workflow_version,started_at,ended_at,outcome,error_code FROM asteriskcdrdb.voice_agent_runs WHERE run_id=?',[$id])->fetch(\PDO::FETCH_ASSOC);
        if (!$row) self::fail('run_not_found',404);
        $row['events']=$this->query('SELECT event_id,event_type,occurred_at,error_code,tool_id,destination_id FROM asteriskcdrdb.voice_agent_run_events WHERE run_id=? ORDER BY occurred_at,event_id LIMIT 1000',[$id])->fetchAll(\PDO::FETCH_ASSOC);
        return $row;
    }
}
