<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;

/** Bounded project-key API requests. Never propagate provider bodies or exceptions. */
final class OpenAiWebhook
{
    private $transport;
    public function __construct(?callable $transport = null) { $this->transport=$transport; }
    public static function callbackUrl(): string
    {
        $host=getenv('NETHVOICE_HOST');
        if (!is_string($host) || !str_contains($host,'.') || !filter_var($host,FILTER_VALIDATE_DOMAIN,FILTER_FLAG_HOSTNAME)) {
            throw new \RuntimeException('webhook_url_unavailable',422);
        }
        return 'https://'.strtolower($host).'/satellite-webhooks/openai';
    }
    public static function validSecret($secret): bool
    {
        if (!is_string($secret) || strlen($secret)>4096 || !str_starts_with($secret,'whsec_')) return false;
        $decoded=base64_decode(substr($secret,6),true);
        return $decoded!==false && strlen($decoded)>=16 && !preg_match('/[\r\n\x00]/',$secret);
    }
    private static function endpoint($row): bool
    {
        return is_array($row) && is_string($row['id']??null) && preg_match('/^[A-Za-z0-9_-]{1,128}$/D',$row['id'])
            && is_string($row['name']??null) && strlen($row['name'])<=256
            && is_string($row['url']??null) && strlen($row['url'])<=2048
            && is_array($row['event_types']??null) && array_is_list($row['event_types'])
            && count($row['event_types'])<=100 && !array_filter($row['event_types'],fn($event)=>!is_string($event))
            && (!isset($row['signing_secret_hint']) || is_string($row['signing_secret_hint']))
            && (!isset($row['updated_at']) || is_int($row['updated_at']));
    }
    public function endpoints(string $key): array
    {
        $items=[];$after='';
        // Fail closed if discovery cannot be completed within the request budget.
        for ($page=0;$page<10;$page++) {
            $response=$this->request('GET','?limit=100'.($after!==''?'&after='.rawurlencode($after):''),$key);
            if (!is_array($response['data']??null) || !array_is_list($response['data']) || count($response['data'])>100 || !is_bool($response['has_more']??null)) {
                throw new \RuntimeException('webhook_provider_response_invalid',503);
            }
            foreach ($response['data'] as $row) {
                if (!self::endpoint($row) || isset($items[$row['id']])) throw new \RuntimeException('webhook_provider_response_invalid',503);
                $items[$row['id']]=$row;
            }
            if (!$response['has_more']) return array_values($items);
            $last=$response['last_id']??null;
            if (!is_string($last) || !isset($items[$last]) || $last===$after || !$response['data']) throw new \RuntimeException('webhook_provider_response_invalid',503);
            $after=$last;
        }
        throw new \RuntimeException('webhook_discovery_incomplete',503);
    }
    public function create(string $key,string $name,string $url): array
    {
        $row=$this->request('POST','',$key,['name'=>$name,'url'=>$url,'event_types'=>['realtime.call.incoming']]);
        if (!self::endpoint($row) || $row['name']!==$name || $row['url']!==$url || $row['event_types']!==['realtime.call.incoming'] || !self::validSecret($row['signing_secret']??null)) {
            throw new \RuntimeException('webhook_provider_response_invalid',503);
        }
        return $row;
    }
    private function request(string $method,string $query,string $key,?array $data=null): array
    {
        if ($key==='' || strlen($key)>4096 || preg_match('/[\r\n\x00]/',$key)) throw new \RuntimeException('provider_credentials_unavailable',422);
        try {
            if ($this->transport) $response=($this->transport)($method,$query,$key,$data);
            else {
                $body='';$curl=curl_init('https://api.openai.com/v1/webhook_endpoints'.$query);
                curl_setopt_array($curl,[CURLOPT_CUSTOMREQUEST=>$method,
                    CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$key,'Content-Type: application/json','Accept: application/json'],
                    CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_TIMEOUT=>3,CURLOPT_FOLLOWLOCATION=>false,
                    CURLOPT_WRITEFUNCTION=>function($handle,$chunk) use (&$body) {
                        if (strlen($body)+strlen($chunk)>262144) return 0;
                        $body.=$chunk;return strlen($chunk);
                    }]);
                if ($data!==null) curl_setopt($curl,CURLOPT_POSTFIELDS,json_encode($data,JSON_THROW_ON_ERROR));
                try { $ok=curl_exec($curl);$status=curl_getinfo($curl,CURLINFO_HTTP_CODE); }
                finally { curl_close($curl); }
                $response=['status'=>$ok?$status:0,'body'=>$body];
            }
        } catch (\Throwable $error) { throw new \RuntimeException('webhook_provider_unavailable',503); }
        $status=$response['status']??0;
        if ($status===401) throw new \RuntimeException('provider_credentials_rejected',422);
        if ($status===403) throw new \RuntimeException('webhook_permission_denied',422);
        if (in_array($status,[400,404,422,429],true)) throw new \RuntimeException('webhook_provider_rejected',422);
        if ($status!==200 && $status!==201) throw new \RuntimeException('webhook_provider_unavailable',503);
        try { $decoded=json_decode($response['body']??'',true,32,JSON_THROW_ON_ERROR); }
        catch (\Throwable $error) { throw new \RuntimeException('webhook_provider_response_invalid',503); }
        if (!is_array($decoded) || array_is_list($decoded)) throw new \RuntimeException('webhook_provider_response_invalid',503);
        return $decoded;
    }
}
