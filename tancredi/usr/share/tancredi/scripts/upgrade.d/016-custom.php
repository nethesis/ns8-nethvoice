<?php namespace upgrade16;

// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: GPL-3.0-or-later

// Preserve the LLDP values previously hard-coded in the shipped templates.
// New installations copy defaults version 16, with LLDP enabled, at startup.
$storage = $container->get('storage');
$logger = $container->get('logger');
$defaults = new \Tancredi\Entity\Scope('defaults', $storage, $logger);
if (($defaults->metadata['version'] ?? 0) >= 16) {
    return;
}

$legacy_values = [
    'yealink.tmpl' => '0',
    'snom.tmpl' => '0',
    'snomD8XX.tmpl' => '0',
    'gigasetP.tmpl' => '0',
    'gigasetP8XX.tmpl' => '0',
    'akuvox.tmpl' => '0',
    'akuvox410w.tmpl' => '0',
    'akuvox480w.tmpl' => '0',
    'fanvil-X3.tmpl' => '1',
    'fanvil-X5.tmpl' => '1',
    'fanvil-V67.tmpl' => '1',
    'nethesis.tmpl' => '1',
    'sangoma.tmpl' => '1',
];

// Snapshot the original data before adding any compatibility overrides.
$scopes = [];
foreach ($storage->listScopes() as $scope_id) {
    if ($scope_id !== 'defaults') {
        $scopes[$scope_id] = new \Tancredi\Entity\Scope($scope_id, $storage, $logger);
    }
}
$resolved = [
    'defaults' => [
        'template' => $defaults->data['tmpl_phone'] ?? '',
        'configured' => array_key_exists('lldp_enable', $defaults->data),
        'value' => $defaults->data['lldp_enable'] ?? '0',
        'depth' => 0,
    ],
];
$visiting = [];
$updates = [];
$resolve = function ($id) use (&$resolve, &$resolved, &$visiting, &$updates, $scopes, $legacy_values) {
    if (isset($resolved[$id])) {
        return $resolved[$id];
    }
    if (isset($visiting[$id]) || !isset($scopes[$id])) {
        throw new \RuntimeException("Cannot migrate LLDP: invalid inheritance at scope $id");
    }
    $visiting[$id] = true;
    $scope = $scopes[$id];
    $parent = $resolve(($scope->metadata['inheritFrom'] ?? '') ?: 'defaults');
    $template = $scope->data['tmpl_phone'] ?? $parent['template'];
    $configured_here = array_key_exists('lldp_enable', $scope->data);
    // An explicit value anywhere in the original inheritance chain wins,
    // including "0" and a blank value that omits LLDP from provisioning.
    $value = $configured_here
        ? $scope->data['lldp_enable']
        : ($parent['configured'] ? $parent['value'] : ($legacy_values[$template] ?? $parent['value']));
    $depth = $parent['depth'] + 1;
    if (!$configured_here && $value !== $parent['value']) {
        $updates[$id] = ['value' => $value, 'depth' => $depth];
    }
    unset($visiting[$id]);
    return $resolved[$id] = [
        'template' => $template,
        'configured' => $configured_here || $parent['configured'],
        'value' => $value,
        'depth' => $depth,
    ];
};
foreach (array_keys($scopes) as $scope_id) {
    $resolve($scope_id);
}

// Write children first. On retry, a persisted parent override must never hide
// an unfinished child's original template-specific compatibility requirement.
uasort($updates, function ($left, $right) {
    return $right['depth'] <=> $left['depth'];
});
foreach ($updates as $scope_id => $update) {
    if (!$scopes[$scope_id]->setVariables(['lldp_enable' => $update['value']])) {
        throw new \RuntimeException("Cannot save LLDP compatibility setting for scope $scope_id");
    }
    $logger->info(sprintf('Preserved LLDP=%s for scope %s', $update['value'], $scope_id));
}

// Commit the installation default and completion marker only after all scopes
// have been saved. Do not overwrite an administrator's existing default.
$defaults->metadata['version'] = 16;
$default_updates = array_key_exists('lldp_enable', $defaults->data) ? [] : ['lldp_enable' => '0'];
if (!$defaults->setVariables($default_updates)) {
    throw new \RuntimeException('Cannot complete LLDP compatibility migration');
}
$logger->info('LLDP compatibility migration completed');
