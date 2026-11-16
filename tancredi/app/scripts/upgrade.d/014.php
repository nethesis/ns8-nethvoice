<?php namespace upgrade14;

/*
Unify Nethesis NP-X5 scopes
*/

$storage = $container->get('storage');
$logger = $container->get('logger');
$config = $container->get('config');

$source_model_id = 'nethesis-NPX5v2';
$target_model_id = 'nethesis-NPX5';
$source_scope_path = $config['rw_dir'] . 'scopes/' . $source_model_id . '.ini';
$target_scope_path = $config['rw_dir'] . 'scopes/' . $target_model_id . '.ini';

$target_scope = new \Tancredi\Entity\Scope($target_model_id, $storage, $logger);
$target_custom = file_exists($target_scope_path)
    ? $storage->storageRead($target_model_id)
    : ['metadata' => [], 'data' => []];
$target_variables = [];
$needs_target_write = false;

if (file_exists($source_scope_path)) {
    $source_scope = new \Tancredi\Entity\Scope($source_model_id, $storage, $logger);

    foreach ($source_scope->data as $key => $value) {
        $target_key = $key === 'tmpl_firmware' ? 'tmpl_firmware_v2' : $key;

        if (!array_key_exists($target_key, $target_custom['data'])) {
            $target_variables[$target_key] = $value;
            continue;
        }

        if ($target_custom['data'][$target_key] !== $value) {
            $logger->warning(sprintf(
                'Keeping existing value for "%s" while migrating model "%s" into "%s" in script %s',
                $target_key,
                $source_model_id,
                $target_model_id,
                basename(__FILE__)
            ));
        }
    }

    $needs_target_write = true;
}

if (
    !array_key_exists('tmpl_firmware_v2', $target_custom['data'])
    && !array_key_exists('tmpl_firmware_v2', $target_variables)
) {
    $target_variables['tmpl_firmware_v2'] = 'nethesis-firmware-v2.tmpl';
    $needs_target_write = $needs_target_write || file_exists($target_scope_path);
}

if (
    $needs_target_write
    || (file_exists($target_scope_path) && (($target_custom['metadata']['version'] ?? 0) < 14))
) {
    $target_scope->metadata['version'] = 14;
    $target_scope->setVariables($target_variables);
    $logger->info(sprintf('Unified model "%s" into "%s" in script %s', $source_model_id, $target_model_id, basename(__FILE__)));
}

if (file_exists($source_scope_path)) {
    $storage->deleteScope($source_model_id);
    $logger->info(sprintf('Deleted writable scope "%s" in script %s', $source_model_id, basename(__FILE__)));
}

foreach ($storage->listScopes() as $scope_id) {
    if ($scope_id === $source_model_id) {
        continue;
    }

    $scope = new \Tancredi\Entity\Scope($scope_id, $storage, $logger);
    if (($scope->metadata['inheritFrom'] ?? null) !== $source_model_id) {
        continue;
    }

    $scope->metadata['inheritFrom'] = $target_model_id;
    $scope->setVariables();
    $logger->info(sprintf('Updated inheritFrom for scope "%s" in script %s', $scope_id, basename(__FILE__)));
}