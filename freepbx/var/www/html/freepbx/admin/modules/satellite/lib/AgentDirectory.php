<?php
// SPDX-License-Identifier: GPL-3.0-or-later
/** Native inventory adapted from the former AgentContextSource. No agent settings. */
final class AgentDirectory
{
    private object $pbx;
    public function __construct(object $pbx) { $this->pbx=$pbx; }
    public function inventory(): array
    {
        $rows=[]; $menus=[]; $modules=['extension'=>true,'queue'=>true,'ivr'=>true];
        foreach ($this->pbx->Core->listUsers(false) as $user) {
            $row=$this->resource('extension',(string)($user[0]??$user['extension']??''),(string)($user[1]??$user['name']??''));
            if ($row) $rows[$row['id']]=$row;
        }
        try {
            foreach ($this->pbx->Queues->listQueues(true) as $queue) {
                $row=$this->resource('queue',(string)$queue[0],(string)($queue[1]??$queue[0]));
                if ($row) $rows[$row['id']]=$row;
            }
        } catch (\Throwable $error) { $modules['queue']=false; }
        try {
            foreach ($this->pbx->Ivr->getDetails() as $menu) {
                $row=$this->resource('ivr',(string)$menu['id'],(string)($menu['name']??''),(string)($menu['description']??''));
                if ($row) { $rows[$row['id']]=$row; $menus[$row['id']]=$menu; }
            }
        } catch (\Throwable $error) { $modules['ivr']=false; }
        foreach ($menus as $id=>$menu) {
            $branches=[];
            try {
                $query=$this->pbx->Database->prepare('SELECT selection,dest FROM ivr_entries WHERE ivr_id=? ORDER BY selection LIMIT 51');
                $query->execute([$menu['id']]);
                foreach ($query->fetchAll(\PDO::FETCH_ASSOC) as $entry) $branches[]=$this->branch((string)$entry['selection'],(string)$entry['dest'],$rows);
            } catch (\Throwable $error) { $rows[$id]['context_status']='unavailable'; }
            foreach (['invalid','timeout'] as $kind) $branches[]=$this->branch($kind,(string)($menu[$kind.'_destination']??''),$rows);
            $rows[$id]['branches']=array_slice($branches,0,50);
            if (count($branches)>50) $rows[$id]['context_status']='branch_limit';
        }
        ksort($rows,SORT_STRING);
        return ['items'=>array_values($rows),'modules'=>$modules];
    }
    public static function nativeTarget(string $id): string
    {
        if (!preg_match('/^(extension|queue|ivr):([0-9]{1,20})$/D',$id,$m)) throw new \InvalidArgumentException('invalid_destination');
        return match($m[1]) { 'extension'=>'from-did-direct,'.$m[2].',1','queue'=>'ext-queues,'.$m[2].',1','ivr'=>'ivr-'.$m[2].',s,1' };
    }
    private function resource(string $kind,string $id,string $name,string $description=''): ?array
    {
        if (!preg_match('/^[0-9]{1,20}$/D',$id)) return null;
        $native=self::nativeTarget($kind.':'.$id);
        try { $info=$this->pbx->Destinations->getDestination($native); }
        catch (\Throwable $error) { $info=null; }
        return ['id'=>$kind.':'.$id,'type'=>$kind,'name'=>mb_substr(html_entity_decode($name,ENT_QUOTES,'UTF-8'),0,100),
            'description'=>mb_substr(html_entity_decode($description,ENT_QUOTES,'UTF-8'),0,500),'available'=>(bool)$info,
            'native_destination'=>$native];
    }
    private function branch(string $selection,string $destination,array $rows): array
    {
        $id=null;
        foreach ($rows as $row) {
            if ($row['available'] && $row['native_destination']===$destination) { $id=$row['id']; break; }
        }
        return ['selection'=>mb_substr($selection,0,30),'destination_id'=>$id];
    }
}
