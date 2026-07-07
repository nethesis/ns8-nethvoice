<?php namespace upgrade13;

/*
Update firmware template for writable NPX5v2 scopes
*/

$fixes = [
    'nethesis-NPX5v2' => ['tmpl_firmware' => 'nethesis-firmware-v2.tmpl'],
];

foreach ($fixes as $model_id => $variables) {
    $scope_path = $container->get('config')['rw_dir'] . 'scopes/' . $model_id . '.ini';
    if (!file_exists($scope_path)) {
        continue;
    }

    $scope = new \Tancredi\Entity\Scope($model_id, $container->get('storage'), $container->get('logger'));
    if(isset($scope->metadata['version']) && $scope->metadata['version'] >= 13) {
        continue;
    }
    $scope->metadata['version'] = 13;
    $scope->setVariables($variables);
    $container->get('logger')->info(sprintf('Update firmware template for NPX5v2 for model "%s" in script %s', $model_id, basename(__FILE__)));
}