<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;

/** Read-only monitoring API. Satellite owns observations and metric projections. */
final class Monitoring
{
    private \PDO $db;
    public const PHASES=['snapshot','binding','admission','origination','webhook_wait','routing_context','provider_accept','provider_sideband','provider_answer','media_bridge','provider_stream','greeting','response','tool','transfer','fallback','cleanup'];
    public const OUTCOMES=['running','completed','fallback','failed','interrupted','transferred'];
    public const TOOLS=['directory.find_destinations','telephony.transfer','pbx.find_destinations','pbx.find_recent_callers','pbx.transfer'];
    public function __construct(\PDO $db) { $this->db=$db; $db->exec("SET time_zone='+00:00'"); }
    public static function retentionDays(): int
    {
        $value=getenv('VOICE_AGENT_MONITORING_RETENTION_DAYS');
        if ($value===false) return 90;
        if (!preg_match('/^[0-9]{1,4}$/D',$value) || (int)$value<1 || (int)$value>3650) {
            error_log('voice_agent_monitoring_retention_invalid'); return 90;
        }
        return (int)$value;
    }
    private static function fail(string $code='invalid_monitoring_filter'): never { throw new \RuntimeException($code,422); }
    private static function date(string $value): \DateTimeImmutable
    {
        if (!preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?Z$/D',$value)) self::fail();
        try { $date=new \DateTimeImmutable($value); } catch (\Exception $e) { self::fail(); }
        $errors=\DateTimeImmutable::getLastErrors();
        if ($errors && ($errors['warning_count'] || $errors['error_count'])) self::fail();
        return $date;
    }
    /** Shared typed filters; hour-aligned windows keep lists and rollups consistent. */
    public static function filters(array $query, bool $summary=false): array
    {
        $allowed=$summary?['from','to','agent_id','provider','adapter']:['from','to','agent_id','provider','adapter','outcome','error_code','tool_id','phase','query','page'];
        if (array_diff(array_keys($query),$allowed)) self::fail();
        foreach ($query as $value) if (!is_string($value) && !is_int($value)) self::fail();
        $now=new \DateTimeImmutable('now',new \DateTimeZone('UTC'));
        $earliest=$now->modify('-'.self::retentionDays().' days')->setTime((int)$now->format('H'),0);
        $from=isset($query['from'])?self::date($query['from']):$earliest;
        $to=isset($query['to'])?self::date($query['to']):$now->modify('+1 hour')->setTime((int)$now->modify('+1 hour')->format('H'),0);
        if ($to<=$earliest || $to>$now->modify('+1 day') || $from>=$to) self::fail();
        if ($from<$earliest) $from=$earliest;
        $from=$from->setTime((int)$from->format('H'),0);
        if ($to->format('i:s.u')!=='00:00.000000') $to=$to->modify('+1 hour')->setTime((int)$to->modify('+1 hour')->format('H'),0);
        $result=['from'=>$from->format('Y-m-d H:i:s'),'to'=>$to->format('Y-m-d H:i:s')];
        foreach (['agent_id','query','error_code'] as $key) {
            if (!isset($query[$key]) || $query[$key]==='') continue;
            if (!is_string($query[$key]) || mb_strlen($query[$key])>($key==='query'?100:64)) self::fail();
            if ($key==='agent_id' && !preg_match('/^[a-z][a-z0-9_-]{0,47}$/D',$query[$key])) self::fail();
            if ($key==='error_code' && !preg_match('/^[a-z0-9_]{1,64}$/D',$query[$key])) self::fail();
            $result[$key]=$query[$key];
        }
        foreach (['provider'=>['openai','grok','unknown'],'adapter'=>['realtime','live','unknown'],'outcome'=>self::OUTCOMES,'tool_id'=>self::TOOLS,'phase'=>self::PHASES] as $key=>$values) {
            if (!isset($query[$key]) || $query[$key]==='') continue;
            if (!in_array($query[$key],$values,true)) self::fail();
            $result[$key]=$query[$key];
        }
        $page=(string)($query['page']??'1');
        if (!preg_match('/^[1-9][0-9]{0,4}$/D',$page) || (int)$page>10000) self::fail('invalid_page');
        $result['page']=(int)$page;
        return $result;
    }
    private function query(string $sql,array $args=[]): \PDOStatement
    {
        $q=$this->db->prepare('SET STATEMENT max_statement_time=2 FOR '.$sql); $q->execute($args); return $q;
    }
    private static function where(array $filters,string $alias='r',bool $metrics=false): array
    {
        $column=$metrics?'hour_start':'started_at';
        $parts=["$alias.$column>=?","$alias.$column<?"]; $args=[$filters['from'],$filters['to']];
        foreach (['agent_id','provider','adapter','outcome'] as $key) {
            if (!isset($filters[$key])) continue;
            if ($filters[$key]==='unknown' && !$metrics && in_array($key,['provider','adapter'],true)) $parts[]="$alias.$key IS NULL";
            else { $parts[]="$alias.$key=?"; $args[]=$filters[$key]; }
        }
        if (isset($filters['error_code'])) {
            $parts[]="($alias.error_code=? OR EXISTS (SELECT 1 FROM asteriskcdrdb.voice_agent_run_events e WHERE e.run_id=$alias.run_id AND (e.error_code=? OR e.provider_code=? OR CONCAT('provider_http_',e.http_status)=?)))";
            array_push($args,...array_fill(0,4,$filters['error_code']));
        }
        foreach (['tool_id','phase'] as $key) if (isset($filters[$key])) {
            $parts[]="EXISTS (SELECT 1 FROM asteriskcdrdb.voice_agent_run_events e WHERE e.run_id=$alias.run_id AND e.$key=?)"; $args[]=$filters[$key];
        }
        if (isset($filters['query'])) {
            // LOCATE treats %, _ and backslashes as literal data.
            $parts[]="(LOCATE(?,r.run_id)>0 OR LOCATE(?,r.agent_id)>0 OR LOCATE(?,a.name)>0)";
            array_push($args,$filters['query'],$filters['query'],$filters['query']);
        }
        return [implode(' AND ',$parts),$args];
    }
    private const RUN_COLUMNS='r.run_id,r.agent_id,a.name AS agent_name,r.workflow_version,r.started_at,r.ended_at,r.outcome,r.error_code,r.monitoring_version,r.provider,r.adapter,r.model,r.duration_ms,r.setup_duration_ms,r.first_output_ms,r.trace_status,r.usage_json,r.usage_complete,(r.outcome=\'running\' AND COALESCE(r.deadline_at,DATE_ADD(r.started_at,INTERVAL 3660 SECOND))<NOW()) AS incomplete';
    private static function row(array $row): array
    {
        $row['usage']=$row['usage_json']!==null?json_decode($row['usage_json'],true):null; unset($row['usage_json']);
        foreach (['workflow_version','monitoring_version','duration_ms','setup_duration_ms','first_output_ms'] as $key) $row[$key]=$row[$key]===null?null:(int)$row[$key];
        $row['usage_complete']=(bool)$row['usage_complete']; $row['incomplete']=(bool)$row['incomplete'];
        return $row;
    }
    public function runs(array $query): array
    {
        $f=self::filters($query); [$where,$args]=self::where($f);
        $rows=$this->query('SELECT '.self::RUN_COLUMNS.' FROM asteriskcdrdb.voice_agent_runs r LEFT JOIN asterisk.voice_agent_agents a ON a.agent_id=r.agent_id WHERE '.$where.' ORDER BY r.started_at DESC,r.run_id DESC LIMIT 26 OFFSET '.(($f['page']-1)*25),$args)->fetchAll(\PDO::FETCH_ASSOC);
        return ['items'=>array_map([self::class,'row'],array_slice($rows,0,25)),'page'=>$f['page'],'has_more'=>count($rows)>25];
    }
    public function run(string $id): array
    {
        if (!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/D',$id)) self::fail('invalid_identifier');
        $row=$this->query('SELECT '.self::RUN_COLUMNS.' FROM asteriskcdrdb.voice_agent_runs r LEFT JOIN asterisk.voice_agent_agents a ON a.agent_id=r.agent_id WHERE r.run_id=? AND r.started_at>=DATE_SUB(NOW(),INTERVAL ? DAY)',[$id,self::retentionDays()])->fetch(\PDO::FETCH_ASSOC);
        if (!$row) throw new \RuntimeException('run_not_found',404);
        return self::row($row);
    }
    public function trace(string $id,array $query): array
    {
        $this->run($id);
        if (array_diff(array_keys($query),['cursor'])) self::fail();
        $args=[$id]; $where='run_id=?';
        if (isset($query['cursor'])) {
            if (!is_string($query['cursor']) || strlen($query['cursor'])>256) self::fail();
            $cursor=json_decode(base64_decode($query['cursor'],true)?:'',true);
            if (!is_array($cursor) || count($cursor)!==2 || !is_string($cursor[0]??null) || !is_string($cursor[1]??null) || !preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}$/D',$cursor[0]) || !preg_match('/^[a-f0-9-]{36}$/D',$cursor[1])) self::fail();
            $where.=' AND (occurred_at,event_id)>(?,?)'; array_push($args,...$cursor);
        }
        $rows=$this->query('SELECT event_id,event_type,occurred_at,error_code,tool_id,destination_id,result_count,span_id,parent_span_id,phase,status,elapsed_ms,duration_ms,http_status,provider_code FROM asteriskcdrdb.voice_agent_run_events WHERE '.$where.' ORDER BY occurred_at,event_id LIMIT 101',$args)->fetchAll(\PDO::FETCH_ASSOC);
        $items=array_slice($rows,0,100); $last=end($items);
        foreach ($items as &$item) foreach (['result_count','elapsed_ms','duration_ms','http_status'] as $key) $item[$key]=$item[$key]===null?null:(int)$item[$key]; unset($item);
        return ['items'=>$items,'next_cursor'=>count($rows)>100?base64_encode(json_encode([$last['occurred_at'],$last['event_id']])):null];
    }
    private static function histogram(array $rows): array
    {
        $count=0; $total=0; $bins=[];
        foreach ($rows as $row) { $count+=(int)$row['samples']; $total+=(float)$row['total']; $bins[(int)$row['bucket']]=($bins[(int)$row['bucket']]??0)+(int)$row['samples']; }
        ksort($bins); $quantile=static function(float $q) use($bins,$count): ?int {
            if (!$count) return null; $seen=0;
            foreach ($bins as $bound=>$number) { $seen+=$number; if ($seen>=ceil($q*$count)) return (int)$bound; }
            return null;
        };
        return ['samples'=>$count,'mean_ms'=>$count?round($total/$count,1):null,'p50_ms'=>$quantile(.5),'p95_ms'=>$quantile(.95),'approximate'=>true];
    }
    public function summary(array $query): array
    {
        $f=self::filters($query,true); [$where,$args]=self::where($f);
        $counts=$this->query("SELECT COUNT(*) total_runs,COALESCE(SUM(r.monitoring_version=1),0) legacy_runs,COALESCE(SUM(r.trace_status='partial'),0) partial_runs,COALESCE(SUM(r.outcome='running' AND COALESCE(r.deadline_at,DATE_ADD(r.started_at,INTERVAL 3660 SECOND))<NOW()),0) incomplete_runs FROM asteriskcdrdb.voice_agent_runs r WHERE ".$where,$args)->fetch(\PDO::FETCH_ASSOC);
        $counts=array_map('intval',$counts); $counts['instrumented_runs']=$counts['total_runs']-$counts['legacy_runs'];
        $outcomes=$this->query('SELECT outcome,COUNT(*) count FROM asteriskcdrdb.voice_agent_runs r WHERE '.$where.' GROUP BY outcome',$args)->fetchAll(\PDO::FETCH_ASSOC);
        $long=(strtotime($f['to'])-strtotime($f['from']))>366*86400;
        $format=$long?'%Y-%m-01':'%Y-%m-%d';
        $trends=$this->query("SELECT DATE_FORMAT(started_at,'$format') day,outcome,COUNT(*) count FROM asteriskcdrdb.voice_agent_runs r WHERE ".$where." GROUP BY day,outcome ORDER BY day",$args)->fetchAll(\PDO::FETCH_ASSOC);
        [$metricWhere,$metricArgs]=self::where($f,'m',true);
        $rows=$this->query('SELECT metric,dimension,result,bucket,SUM(samples) samples,SUM(total) total FROM asteriskcdrdb.voice_agent_metric_hours m WHERE '.$metricWhere.' GROUP BY metric,dimension,result,bucket',$metricArgs)->fetchAll(\PDO::FETCH_ASSOC);
        $groups=[]; $errors=[];
        foreach ($rows as $row) {
            if ($row['metric']==='provider_error') $errors[]=['phase'=>$row['dimension'],'error_code'=>$row['result'],'count'=>(int)$row['samples']];
            else $groups[$row['metric']][$row['dimension']][$row['result']][]=$row;
        }
        $latencies=[]; foreach (['run_duration','setup_duration','first_output'] as $metric) {
            $parts=[]; foreach ($groups[$metric]['']??[] as $rows) array_push($parts,...$rows);
            $latencies[$metric]=self::histogram($parts);
        }
        $performance=[]; foreach (['phase_duration'=>'phases','tool_duration'=>'tools'] as $metric=>$key) {
            $performance[$key]=[];
            foreach ($groups[$metric]??[] as $dimension=>$results) foreach ($results as $status=>$parts) $performance[$key][]=['id'=>$dimension,'status'=>$status]+self::histogram($parts);
        }
        foreach ($groups['tool_invocations']??[] as $id=>$results) foreach ($results as $status=>$parts) {
            $index=null;
            foreach ($performance['tools'] as $i=>$item) if ($item['id']===$id && $item['status']===$status) $index=$i;
            if ($index===null) { $performance['tools'][]=['id'=>$id,'status'=>$status]+self::histogram([]); $index=count($performance['tools'])-1; }
            $performance['tools'][$index]['invocations']=array_sum(array_column($parts,'samples'));
        }
        $daily=$this->query("SELECT DATE_FORMAT(hour_start,'$format') day,metric,bucket,SUM(samples) samples,SUM(total) total FROM asteriskcdrdb.voice_agent_metric_hours m WHERE ".$metricWhere." AND metric IN ('setup_duration','run_duration') GROUP BY day,metric,bucket ORDER BY day",$metricArgs)->fetchAll(\PDO::FETCH_ASSOC);
        $dailyGroups=[]; foreach ($daily as $item) $dailyGroups[$item['day']][$item['metric']][]=$item;
        $latencyTrends=[]; foreach ($dailyGroups as $day=>$metrics) foreach ($metrics as $metric=>$parts) $latencyTrends[]=['day'=>$day,'metric'=>$metric]+self::histogram($parts);
        return ['monitoring_version'=>2,'from'=>$f['from'],'to'=>$f['to'],'resolution'=>$long?'month':'day','latency_trends'=>$latencyTrends,'coverage'=>$counts,'outcomes'=>$outcomes,'trends'=>$trends,'latencies'=>$latencies,'errors'=>$errors]+$performance;
    }
    public function health(): array
    {
        $row=$this->query('SELECT observed_at,ari_connected,active_calls,degraded,spool_writable,queue_depth,pending_bytes,oldest_pending_seconds,dropped,retries,last_write_at FROM asteriskcdrdb.voice_agent_runtime_health WHERE singleton=1')->fetch(\PDO::FETCH_ASSOC);
        if (!$row) return ['stale'=>true,'observed_at'=>null];
        foreach (['active_calls','queue_depth','pending_bytes','oldest_pending_seconds','dropped','retries'] as $key) $row[$key]=(int)$row[$key];
        foreach (['ari_connected','degraded','spool_writable'] as $key) $row[$key]=(bool)$row[$key];
        $row['stale']=(new \DateTimeImmutable('now',new \DateTimeZone('UTC')))->getTimestamp()-(new \DateTimeImmutable($row['observed_at'],new \DateTimeZone('UTC')))->getTimestamp()>60;
        return $row;
    }
}
