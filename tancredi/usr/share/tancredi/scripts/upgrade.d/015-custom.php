<?php namespace upgrade15;

/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * http://www.nethesis.it - nethserver@nethesis.it
 *
 * This script is part of NethServer.
 *
 * NethServer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License,
 * or any later version.
 *
 * NethServer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with NethServer.  If not, see COPYING.
 */

//
// Rewrite writable scopes still inheriting from the legacy NP-X5 v2 model.
// Tancredi 1.7.3 merged nethesis-NPX5v2 into nethesis-NPX5, but writable
// phone and custom-model scopes can still keep the old parent reference.
// Legacy custom models also need tmpl_firmware_v2 explicitly written.
//

$source_model_id = 'nethesis-NPX5v2';
$target_model_id = 'nethesis-NPX5';
$template_key = 'tmpl_firmware_v2';
$template_value = 'nethesis-firmware-v2.tmpl';
$storage = $container->get('storage');
$logger = $container->get('logger');

foreach ($storage->listScopes() as $scope_id) {
    if ($scope_id === $source_model_id || $scope_id === $target_model_id) {
        continue;
    }

    $scope = new \Tancredi\Entity\Scope($scope_id, $storage, $logger);
    $scope_type = $scope->metadata['scopeType'] ?? null;
    $inherits_legacy_model = ($scope->metadata['inheritFrom'] ?? null) === $source_model_id;
    $is_legacy_custom_model = $scope_type === 'model' && strpos($scope_id, $source_model_id . '-') === 0;
    $needs_template_fix = $is_legacy_custom_model && !array_key_exists($template_key, $scope->data);

    if (!$inherits_legacy_model && !$needs_template_fix) {
        continue;
    }

    $scope_updates = [];
    if ($inherits_legacy_model) {
        $scope->metadata['inheritFrom'] = $target_model_id;
        $scope_updates[] = sprintf('inheritFrom changed from %s to %s', $source_model_id, $target_model_id);
    }

    if ($needs_template_fix) {
        $scope->data[$template_key] = $template_value;
        $scope_updates[] = sprintf('%s set to %s', $template_key, $template_value);
    }

    $scope->metadata['version'] = 15;
    $scope->setVariables();
    $logger->info(sprintf(
        'Fix %s applied to scope %s: %s',
        basename(__FILE__),
        $scope_id,
        implode('; ', $scope_updates)
    ));
}
