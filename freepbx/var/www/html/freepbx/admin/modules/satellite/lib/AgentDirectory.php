<?php
// SPDX-License-Identifier: GPL-3.0-or-later
/** Native inventory adapted from the former AgentContextSource. No agent settings. */
final class AgentDirectory
{
    private object $pbx;
    private ?array $extensions = null;
    public function __construct(object $pbx) { $this->pbx=$pbx; }
    public function extensions(): array
    {
        if ($this->extensions !== null) return $this->extensions;
        return $this->extensions = $this->pbx->Database->query(
            "SELECT CONCAT('extension:',u.extension) AS id, u.name FROM users u
             WHERE u.extension REGEXP '^[0-9]{1,20}$'
             AND EXISTS (SELECT 1 FROM userman_users m WHERE m.default_extension=u.extension)
             ORDER BY u.extension"
        )->fetchAll(\PDO::FETCH_ASSOC);
    }
    public function inventory(): array
    {
        $rows=[]; $modules=['extension'=>true,'queue'=>true];
        foreach ($this->extensions() as $user) {
            $row=$this->resource('extension',substr($user['id'],10),$user['name']);
            if ($row) $rows[$row['id']]=$row;
        }
        try {
            foreach ($this->pbx->Queues->listQueues(true) as $queue) {
                $row=$this->resource('queue',(string)$queue[0],(string)($queue[1]??$queue[0]));
                if ($row) $rows[$row['id']]=$row;
            }
        } catch (\Throwable $error) { $modules['queue']=false; }
        ksort($rows,SORT_STRING);
        return ['items'=>array_values($rows),'modules'=>$modules];
    }
    public static function nativeTarget(string $id): string
    {
        if (!preg_match('/^(extension|queue):([0-9]{1,20})$/D',$id,$m)) throw new \InvalidArgumentException('invalid_destination');
        return match($m[1]) { 'extension'=>'from-did-direct,'.$m[2].',1','queue'=>'ext-queues,'.$m[2].',1' };
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
}
