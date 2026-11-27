<?php

#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

require_once __DIR__ . '/libPhonebook.php';

const CTI_GROUP_NAME_MAX_LENGTH = 65;
const CTI_GROUP_SHARING_MAX_LENGTH = 255;
const CTI_GROUP_IMPORTS_SHARING_MAX_LENGTH = 1024;

function ctiGroupPermissionName($name): string
{
    return 'grp_' . strtolower(preg_replace('/[^a-zA-Z0-9]/', '', (string) $name));
}

function ctiGroupNameIssue(array $groups, $id, $name): ?array
{
    if (!is_string($name) || trim($name) === '') {
        return array(400, 'Enter the group name');
    }
    $name = trim($name);
    if (mb_strlen($name) > CTI_GROUP_NAME_MAX_LENGTH) {
        return array(400, 'The group name must be at most ' . CTI_GROUP_NAME_MAX_LENGTH . ' characters');
    }
    if (strpos($name, ',') !== false) {
        return array(400, 'The group name cannot contain commas');
    }
    if (ctiGroupPermissionName($name) === 'grp_') {
        return array(400, 'The group name must contain a letter or a digit');
    }
    foreach ($groups as $group) {
        if ((string) $group['id'] === (string) $id) {
            continue;
        }
        if (mb_strtolower(trim($group['name'])) === mb_strtolower($name)) {
            return array(409, 'A group with this name already exists');
        }
        if (ctiGroupPermissionName($group['name']) === ctiGroupPermissionName($name)) {
            return array(409, 'A group with a similar name already exists');
        }
    }
    return null;
}

function ctiRenameGroupPermission(PDO $db, array $groups, $id, string $oldName, string $newName): void
{
    $oldPermission = ctiGroupPermissionName($oldName);
    $newPermission = ctiGroupPermissionName($newName);
    $displayname = 'Group: ' . $newName;
    $description = 'Group: ' . $newName . ': of presence panel';
    $shared = false;
    foreach ($groups as $group) {
        if ((string) $group['id'] !== (string) $id && ctiGroupPermissionName($group['name']) === $oldPermission) {
            $shared = true;
        }
    }
    $find = $db->prepare('SELECT `id` FROM `rest_cti_permissions` WHERE `name` = ?');
    $find->execute(array($oldPermission));
    $permissionId = $find->fetchColumn();

    if ($oldPermission === $newPermission) {
        if ($permissionId !== false && !$shared) {
            $db->prepare('UPDATE `rest_cti_permissions` SET `displayname` = ?, `description` = ? WHERE `id` = ?')
                ->execute(array($displayname, $description, $permissionId));
        }
        return;
    }

    $find->execute(array($newPermission));
    $orphan = $find->fetchColumn();
    if ($orphan !== false) {
        $db->prepare('DELETE FROM `rest_cti_profiles_permissions` WHERE `permission_id` = ?')->execute(array($orphan));
        $db->prepare('DELETE FROM `rest_cti_macro_permissions_permissions` WHERE `permission_id` = ?')->execute(array($orphan));
        $db->prepare('DELETE FROM `rest_cti_permissions` WHERE `id` = ?')->execute(array($orphan));
    }

    if ($permissionId !== false && !$shared) {
        $db->prepare('UPDATE `rest_cti_permissions` SET `name` = ?, `displayname` = ?, `description` = ? WHERE `id` = ?')
            ->execute(array($newPermission, $displayname, $description, $permissionId));
        return;
    }

    $db->prepare('INSERT INTO `rest_cti_permissions` (`name`, `displayname`, `description`) VALUES (?, ?, ?)')
        ->execute(array($newPermission, $displayname, $description));
    $find->execute(array($newPermission));
    $newId = $find->fetchColumn();
    $macro = $db->prepare('SELECT `id` FROM `rest_cti_macro_permissions` WHERE `name` = ?');
    $macro->execute(array('presence_panel'));
    $macroId = $macro->fetchColumn();
    if ($macroId !== false) {
        $db->prepare('INSERT INTO `rest_cti_macro_permissions_permissions` (`macro_permission_id`, `permission_id`) VALUES (?, ?)')
            ->execute(array($macroId, $newId));
    }
    if ($permissionId !== false) {
        $db->prepare('INSERT INTO `rest_cti_profiles_permissions` (`profile_id`, `permission_id`) SELECT `profile_id`, ? FROM `rest_cti_profiles_permissions` WHERE `permission_id` = ?')
            ->execute(array($newId, $permissionId));
    }
}

function ctiGroupImportsSharingRename(PDO $db, string $oldName, string $newName): array
{
    try {
        return phonebookSharingRenameRows($db, 'rest_phonebook_imports', 'type', $oldName, $newName, CTI_GROUP_IMPORTS_SHARING_MAX_LENGTH);
    } catch (PDOException $e) {
        if (phonebookIsMissingTable($e)) {
            return array('changes' => array(), 'too_long' => 0);
        }
        throw $e;
    }
}

function ctiRenameGroup(PDO $db, PDO $phonebook, PDO $cti, string $sourcesDir, $id, $name): array
{
    $groups = $db->query('SELECT `id`, `name` FROM `rest_cti_groups`')->fetchAll(PDO::FETCH_ASSOC);
    $current = null;
    foreach ($groups as $group) {
        if ((string) $group['id'] === (string) $id) {
            $current = $group;
        }
    }
    if ($current === null) {
        return array(404, array('message' => 'Group not found'), false);
    }
    $issue = ctiGroupNameIssue($groups, $id, $name);
    if ($issue !== null) {
        return array($issue[0], array('message' => $issue[1]), false);
    }
    $oldName = (string) $current['name'];
    $newName = trim($name);
    $result = array('id' => (int) $id, 'name' => $newName, 'phonebook_sources' => 0, 'contacts' => 0);
    if ($oldName === $newName) {
        return array(200, $result, false);
    }

    $sources = phonebookSourcesSharingRename($sourcesDir, $oldName, $newName, CTI_GROUP_SHARING_MAX_LENGTH);
    $contacts = phonebookSharingRenameRows($phonebook, 'phonebook', 'access', $oldName, $newName, CTI_GROUP_SHARING_MAX_LENGTH);
    $ctiContacts = phonebookSharingRenameRows($cti, 'cti_phonebook', 'type', $oldName, $newName, CTI_GROUP_SHARING_MAX_LENGTH);
    $imports = ctiGroupImportsSharingRename($db, $oldName, $newName);
    $problems = $sources['problems'];
    if ($contacts['too_long'] > 0) {
        $problems[] = 'The sharing of ' . $contacts['too_long'] . ' phonebook contacts would be longer than ' . CTI_GROUP_SHARING_MAX_LENGTH . ' characters';
    }
    if ($ctiContacts['too_long'] > 0) {
        $problems[] = 'The sharing of ' . $ctiContacts['too_long'] . ' CTI phonebook contacts would be longer than ' . CTI_GROUP_SHARING_MAX_LENGTH . ' characters';
    }
    if ($imports['too_long'] > 0) {
        $problems[] = 'The sharing of ' . $imports['too_long'] . ' phonebook imports would be longer than ' . CTI_GROUP_IMPORTS_SHARING_MAX_LENGTH . ' characters';
    }
    if (!empty($problems)) {
        return array(409, array('message' => 'The group cannot be renamed: ' . implode('; ', $problems), 'errors' => $problems), false);
    }

    $applied = array();
    $filesWritten = false;
    $db->beginTransaction();
    try {
        $db->prepare('UPDATE `rest_cti_groups` SET `name` = ? WHERE `id` = ?')->execute(array($newName, $id));
        ctiRenameGroupPermission($db, $groups, $id, $oldName, $newName);
        phonebookApplySharingRows($db, 'rest_phonebook_imports', 'type', $imports['changes'], 'new');
        $applied[] = array($phonebook, 'phonebook', 'access', $contacts['changes']);
        phonebookApplySharingRows($phonebook, 'phonebook', 'access', $contacts['changes'], 'new');
        $applied[] = array($cti, 'cti_phonebook', 'type', $ctiContacts['changes']);
        phonebookApplySharingRows($cti, 'cti_phonebook', 'type', $ctiContacts['changes'], 'new');
        phonebookWriteFiles($sources['files'], 'new');
        $filesWritten = true;
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        foreach (array_reverse($applied) as list($pdo, $table, $column, $changes)) {
            try {
                phonebookApplySharingRows($pdo, $table, $column, $changes, 'old');
            } catch (Throwable $restoreError) {
                error_log('Cannot restore the sharing of ' . $table . ': ' . $restoreError->getMessage());
            }
        }
        if ($filesWritten) {
            phonebookRestoreFiles($sources['files']);
        }
        throw $e;
    }

    $result['phonebook_sources'] = count($sources['files']);
    $result['contacts'] = count($contacts['changes']) + count($ctiContacts['changes']);
    return array(200, $result, true);
}

function ctiDeleteGroupSharing(PDO $db, PDO $phonebook, PDO $cti, string $sourcesDir, string $name): array
{
    $sources = phonebookSourcesSharingRemove($sourcesDir, $name);
    if (!empty($sources['problems'])) {
        return array(409, array('message' => 'The group cannot be deleted: ' . implode('; ', $sources['problems']), 'errors' => $sources['problems']));
    }
    $contacts = phonebookSharingRemoveRows($phonebook, 'phonebook', 'access', $name, PHONEBOOK_SHARING_PREFIX);
    $ctiContacts = phonebookSharingRemoveRows($cti, 'cti_phonebook', 'type', $name, 'private');
    try {
        $imports = phonebookSharingRemoveRows($db, 'rest_phonebook_imports', 'type', $name, PHONEBOOK_SHARING_PREFIX);
    } catch (PDOException $e) {
        if (!phonebookIsMissingTable($e)) {
            throw $e;
        }
        $imports = array();
    }
    $applied = array();
    try {
        foreach (array(array($db, 'rest_phonebook_imports', 'type', $imports), array($phonebook, 'phonebook', 'access', $contacts), array($cti, 'cti_phonebook', 'type', $ctiContacts)) as $step) {
            phonebookApplySharingRows($step[0], $step[1], $step[2], $step[3], 'new');
            $applied[] = $step;
        }
        phonebookWriteFiles($sources['files'], 'new');
    } catch (Throwable $e) {
        foreach (array_reverse($applied) as list($pdo, $table, $column, $changes)) {
            try {
                phonebookApplySharingRows($pdo, $table, $column, $changes, 'old');
            } catch (Throwable $restoreError) {
                error_log('Cannot restore the sharing of ' . $table . ': ' . $restoreError->getMessage());
            }
        }
        throw $e;
    }
    return array(200, array('phonebook_sources' => count($sources['files']), 'contacts' => count($contacts) + count($ctiContacts), 'imports' => count($imports)));
}
