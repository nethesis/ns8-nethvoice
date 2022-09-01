<?php
namespace FreePBX\modules\Disa;
use FreePBX\modules\Backup as Base;
class Backup Extends Base\BackupBase{
  public function runBackup($id,$transaction){
    $configs = $this->FreePBX->Disa->listAll();
    $this->addDependency('callrecording');
    $this->addConfigs($configs);
  }
}