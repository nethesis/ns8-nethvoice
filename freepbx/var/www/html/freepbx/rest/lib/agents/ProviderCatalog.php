<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;

/** Public provider metadata only. Keys and upstream response bodies never leave PHP. */
final class ProviderCatalog
{
    private $fetchModels;
    public function __construct(?callable $fetchModels = null) { $this->fetchModels=$fetchModels; }
    public static function capabilities(string $provider): array
    {
        $catalog=json_decode(file_get_contents(__DIR__.'/contracts/provider-models-v2.json'),true,512,JSON_THROW_ON_ERROR);
        if (!isset($catalog[$provider])) throw new \RuntimeException('invalid_provider',422);
        return $catalog[$provider];
    }
    public static function validateModel(string $provider, $model): string
    {
        if (!is_string($model) || !in_array($model,array_column(self::capabilities($provider)['models'],'id'),true)) {
            throw new \RuntimeException('invalid_provider_model',422);
        }
        return $model;
    }
    public static function validateConversation(string $provider, array $conversation): void
    {
        $id=self::validateModel($provider,$conversation['model']??null);
        $models=array_column(self::capabilities($provider)['models'],null,'id');
        $model=$models[$id];
        if (!array_key_exists('options',$conversation) || !PublishedContract::matches($conversation['options'],$model['options_schema'])) {
            throw new \RuntimeException('invalid_model_options',422);
        }
        $voice=$conversation['voice']??'';
        if (!is_string($voice) || !preg_match('/^[a-z0-9_-]{1,128}$/D',$voice) ||
            ($model['voices'] && !in_array($voice,array_column($model['voices'],'id'),true))) {
            throw new \RuntimeException('invalid_voice',422);
        }
        if ($id==='gpt-live-1' && trim($conversation['options']['backend_instructions'])==='') throw new \RuntimeException('invalid_model_options',422);
    }
    /** Model availability and adapter compatibility are separate requirements. */
    public function models(string $provider, string $key): array
    {
        $capabilities=self::capabilities($provider);
        $base=['selection'=>$capabilities['selection'],'default_model'=>$capabilities['default'],'capability_version'=>2];
        // xAI explicitly ignores the model query parameter for SIP call_id sessions.
        if ($capabilities['selection']==='provider_managed') return $base+['items'=>$capabilities['models'],'backend_models'=>[],'source'=>'provider_managed'];
        if ($key==='' || preg_match('/[\r\n\x00]/',$key)) throw new \RuntimeException('provider_credentials_unavailable',422);
        $cacheKey='voice_agent_models_v2_'.hash('sha256',$provider.$key);
        if (!$this->fetchModels && function_exists('apcu_fetch')) {
            $cached=apcu_fetch($cacheKey);
            if (is_array($cached)) return $base+$cached+['source'=>'cached_provider_api'];
        }
        try {
            $response=$this->fetchModels ? ($this->fetchModels)($provider,$key) : self::fetchModels($key);
            if (!is_array($response['data']??null) || !array_is_list($response['data']) || count($response['data'])>5000) {
                throw new \RuntimeException('provider_catalog_unavailable',503);
            }
            $available=[];
            foreach ($response['data'] as $row) {
                if (!is_array($row) || !is_string($row['id']??null)) throw new \RuntimeException('provider_catalog_unavailable',503);
                $available[$row['id']]=true;
            }
            $items=array_values(array_filter($capabilities['models'],fn($model)=>isset($available[$model['id']])));
            $result=['items'=>$items,'backend_models'=>array_values(array_filter($capabilities['backend_models'],fn($model)=>isset($available[$model['id']])))];
            if (!$this->fetchModels && function_exists('apcu_store')) apcu_store($cacheKey,$result,300);
            return $base+$result+['source'=>'provider_api'];
        } catch (\Throwable $error) {
            if ($error instanceof \RuntimeException && $error->getMessage()==='provider_credentials_rejected') throw $error;
            return $base+['items'=>$capabilities['models'],'backend_models'=>$capabilities['backend_models'],'source'=>'adapter_catalog','discovery_error'=>'provider_catalog_unavailable'];
        }
    }
    private static function fetchModels(string $key): array
    {
        $body='';$curl=curl_init('https://api.openai.com/v1/models');
        curl_setopt_array($curl,[CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$key,'Accept: application/json'],
            CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>5,CURLOPT_FOLLOWLOCATION=>false,
            CURLOPT_WRITEFUNCTION=>function($handle,$chunk) use (&$body) {
                if (strlen($body)+strlen($chunk)>524288) return 0;
                $body.=$chunk;return strlen($chunk);
            }]);
        $ok=curl_exec($curl);$status=curl_getinfo($curl,CURLINFO_HTTP_CODE);curl_close($curl);
        if (in_array($status,[401,403],true)) throw new \RuntimeException('provider_credentials_rejected',422);
        if (!$ok || $status!==200) throw new \RuntimeException('provider_catalog_unavailable',503);
        return json_decode($body,true,32,JSON_THROW_ON_ERROR);
    }
    public static function environmentKey(string $provider): string
    {
        $names=$provider==='openai'?['OPENAI_API_KEY']:($provider==='grok'?['XAI_API_KEY','GROK_API_KEY']:[]);
        foreach ($names as $name) {
            $value=getenv($name);
            if (is_string($value) && $value!=='' && !preg_match('/[\r\n\x00]/',$value)) return $value;
        }
        return '';
    }
    public static function languages(): array
    {
        return array_map(fn($id,$name)=>['id'=>$id,'label'=>$name.' ('.$id.')'],
            ['it','en','es','fr','de','pt','ar','bn','zh','hi','id','ja','ko','ru','tr','vi','nl','pl','uk','sv'],
            ['Italiano','English','Español','Français','Deutsch','Português','العربية','বাংলা','中文','हिन्दी','Bahasa Indonesia','日本語','한국어','Русский','Türkçe','Tiếng Việt','Nederlands','Polski','Українська','Svenska']);
    }
    public static function voices(string $provider,string $key): array
    {
        // OpenAI documents a Realtime enumeration, not a builtin voice-list endpoint.
        if ($provider==='openai') return ['items'=>array_map(fn($id)=>['id'=>$id,'label'=>$id],
            ['alloy','ash','ballad','coral','echo','sage','shimmer','verse','marin','cedar']), 'source'=>'provider_documentation'];
        if ($provider!=='grok' || $key==='') throw new \RuntimeException('provider_credentials_unavailable',422);
        $cacheKey='voice_agent_voices_'.hash('sha256',$provider.$key);
        if (function_exists('apcu_fetch')) { $cached=apcu_fetch($cacheKey); if (is_array($cached)) return $cached; }
        $body=''; $curl=curl_init('https://api.x.ai/v1/tts/voices');
        curl_setopt_array($curl,[CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$key,'Accept: application/json'],
            CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>5,CURLOPT_FOLLOWLOCATION=>false,
            CURLOPT_WRITEFUNCTION=>function($handle,$chunk) use (&$body) {
                if (strlen($body)+strlen($chunk)>65536) return 0;
                $body.=$chunk;return strlen($chunk);
            }]);
        $ok=curl_exec($curl);$status=curl_getinfo($curl,CURLINFO_HTTP_CODE);curl_close($curl);
        $rows=json_decode($body,true)['voices']??null;
        if (!$ok || $status!==200 || !is_array($rows) || count($rows)>200) throw new \RuntimeException('provider_catalog_unavailable',503);
        $items=[];
        foreach ($rows as $row) {
            $id=$row['voice_id']??null;$label=$row['name']??$id;
            if (!is_string($id) || !preg_match('/^[a-z0-9_-]{1,128}$/D',$id) || !is_string($label) || mb_strlen($label)>100) continue;
            $items[$id]=['id'=>$id,'label'=>$label];
        }
        if (!$items) throw new \RuntimeException('provider_catalog_unavailable',503);
        $result=['items'=>array_values($items),'source'=>'provider_api'];
        if (function_exists('apcu_store')) apcu_store($cacheKey,$result,300);
        return $result;
    }
}
