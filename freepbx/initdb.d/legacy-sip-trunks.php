<?php
// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: GPL-3.0-or-later

function convertLegacySipTrunks(PDO $db, $core): void
{
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $ids = $db->query("SELECT trunkid FROM trunks WHERE tech = 'sip' ORDER BY trunkid")
        ->fetchAll(PDO::FETCH_COLUMN);
    if (!$ids) {
        return;
    }

    // The converter and its PJSIP driver must share this connection for rollback.
    $db->exec('CREATE TABLE IF NOT EXISTS nethvoice_legacy_sip_trunks (
        trunkid int NOT NULL PRIMARY KEY,
        configuration longtext NOT NULL
    ) ENGINE=InnoDB');
    $tables = ['trunks', 'sip', 'pjsip', 'kvstore_FreePBX_modules_Core',
        'kvblobstore', 'nethvoice_legacy_sip_trunks'];
    $engines = $db->query("SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN
        ('trunks', 'sip', 'pjsip', 'kvstore_FreePBX_modules_Core',
         'kvblobstore', 'nethvoice_legacy_sip_trunks')")
        ->fetchAll(PDO::FETCH_KEY_PAIR);
    foreach ($tables as $table) {
        if (strtoupper($engines[$table] ?? '') !== 'INNODB') {
            throw new RuntimeException("Legacy SIP conversion requires InnoDB table $table");
        }
    }
    foreach ($ids as $id) {
        // Upstream treats ID zero as "all", which would convert other trunks too.
        if ((int) $id < 1) {
            throw new RuntimeException('Legacy SIP conversion requires positive trunk IDs');
        }
        $db->beginTransaction();
        try {
            $trunk = $db->prepare('SELECT * FROM trunks WHERE trunkid = ? FOR UPDATE');
            $trunk->execute([$id]);
            $rows = $trunk->fetchAll(PDO::FETCH_ASSOC);
            if (count($rows) !== 1 || $rows[0]['tech'] !== 'sip') {
                throw new RuntimeException("Trunk $id changed during legacy SIP conversion");
            }
            $existing = $db->prepare('SELECT COUNT(*) FROM pjsip WHERE id = ?');
            $existing->execute([$id]);
            if ((int) $existing->fetchColumn() !== 0) {
                throw new RuntimeException("Trunk $id already has PJSIP settings; review before conversion");
            }
            $sip = $db->prepare('SELECT * FROM sip WHERE id IN (?, ?, ?) ORDER BY id, keyword');
            $sip->execute(["tr-peer-$id", "tr-reg-$id", "tr-user-$id"]);
            $original = ['trunk' => $rows[0], 'sip' => $sip->fetchAll(PDO::FETCH_ASSOC)];
            $backup = $db->prepare('INSERT INTO nethvoice_legacy_sip_trunks (trunkid, configuration) VALUES (?, ?)');
            $backup->execute([$id, json_encode($original, JSON_THROW_ON_ERROR)]);

            // Same supported converter as fwconsole trunks --convert2pjsip ID.
            // Keep the whole conversion on one connection instead of a subprocess.
            if (!$core->disableTrunk($id)) {
                throw new RuntimeException("Cannot disable legacy SIP trunk $id");
            }
            $core->chansipToPJSIP('', $id);
            if (!$core->disableTrunk($id)) {
                throw new RuntimeException("Cannot disable converted PJSIP trunk $id");
            }
            $trunk->execute([$id]);
            $converted = $trunk->fetchAll(PDO::FETCH_ASSOC);
            $expected = $original['trunk'];
            $expected['tech'] = 'pjsip';
            $expected['disabled'] = 'on';
            if ($converted !== [$expected]) {
                throw new RuntimeException("Trunk $id was not converted and disabled correctly");
            }
            $disabled = $db->prepare("SELECT data FROM pjsip WHERE id = ? AND keyword = 'disabletrunk'");
            $disabled->execute([$id]);
            if ($disabled->fetchColumn() !== 'on') {
                throw new RuntimeException("Converted trunk $id is not disabled in PJSIP");
            }
            $sip->execute(["tr-peer-$id", "tr-reg-$id", "tr-user-$id"]);
            if ($sip->fetch(PDO::FETCH_ASSOC) !== false) {
                throw new RuntimeException("Legacy SIP settings remain for trunk $id");
            }
            $db->commit();
            fwrite(STDERR, "Converted legacy SIP trunk $id to PJSIP and left it disabled; review settings before enabling.\n");
        } catch (Throwable $error) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            // Do not log converter/SQL errors that might contain credentials.
            throw new RuntimeException("Legacy SIP conversion failed for trunk $id; transaction rolled back. Review its configuration before retrying.");
        }
    }
}
