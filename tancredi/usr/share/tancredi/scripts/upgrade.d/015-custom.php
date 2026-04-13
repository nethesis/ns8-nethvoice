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
// Rewrite custom scopes still inheriting from the legacy NP-X5 v2 model.
// Tancredi 1.7.3 merged nethesis-NPX5v2 into nethesis-NPX5, but writable
// custom scopes can still keep the old parent reference.
//

$source_model_id = 'nethesis-NPX5v2';
$target_model_id = 'nethesis-NPX5';
$storage = $container->get('storage');
$logger = $container->get('logger');

foreach ($storage->listScopes() as $scope_id) {
    if ($scope_id === $source_model_id || $scope_id === $target_model_id) {
        continue;
    }

    $scope = new \Tancredi\Entity\Scope($scope_id, $storage, $logger);
    if (($scope->metadata['inheritFrom'] ?? null) !== $source_model_id) {
        continue;
    }

    if (isset($scope->metadata['version']) && $scope->metadata['version'] >= 15) {
        continue;
    }

    $scope->metadata['inheritFrom'] = $target_model_id;
    $scope->metadata['version'] = 15;
    $scope->setVariables();
    $logger->info(sprintf(
        'Fix %s applied to scope %s: inheritFrom changed from %s to %s',
        basename(__FILE__),
        $scope_id,
        $source_model_id,
        $target_model_id
    ));
}
