<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;

/** Public provider metadata only. Keys and upstream response bodies never leave PHP. */
final class ProviderCatalog
{
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
