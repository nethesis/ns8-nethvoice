<?php

require_once __DIR__ . '/AgentProfileRepository.php';

/** Additive Agent schema; safe to invoke on install and every upgrade. */
class AgentSchema
{
    public static function install($db)
    {
        $db->exec('CREATE TABLE IF NOT EXISTS `satellite_agent_trunks` (
            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `name` VARCHAR(100) NOT NULL,
            `provider` VARCHAR(16) NOT NULL,
            `runtime_owner` VARCHAR(16) NOT NULL DEFAULT \'cleverai\',
            `freepbx_trunk_id` INT NULL,
            `freepbx_trunk_name` VARCHAR(100) NOT NULL,
            `openai_project_id` VARCHAR(128) NULL,
            `grok_phone_number` VARCHAR(32) NULL,
            `api_key_encrypted` TEXT NULL,
            `sip_auth_mode` VARCHAR(16) NOT NULL DEFAULT \'none\',
            `sip_auth_username` VARCHAR(128) NULL,
            `sip_auth_password_encrypted` TEXT NULL,
            `webhook_signing_secret_encrypted` TEXT NULL,
            `remote_webhook_id` VARCHAR(128) NULL,
            `enabled` TINYINT(1) NOT NULL DEFAULT 1,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uniq_satellite_agent_trunk_name` (`name`),
            UNIQUE KEY `uniq_satellite_agent_freepbx_trunk` (`freepbx_trunk_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

        $db->exec('CREATE TABLE IF NOT EXISTS `satellite_agent_destinations` (
            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `system_key` VARCHAR(64) NULL,
            `freepbx_name` VARCHAR(100) NOT NULL,
            `agent_type` VARCHAR(32) NOT NULL DEFAULT \'cleverai\',
            `cleverai_trunk_id` INT UNSIGNED NULL,
            `cleverai_flow` VARCHAR(128) NULL,
            `fallback_destination` VARCHAR(255) NULL,
            `system_managed` TINYINT(1) NOT NULL DEFAULT 0,
            `enabled` TINYINT(1) NOT NULL DEFAULT 1,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uniq_satellite_agent_system_key` (`system_key`),
            UNIQUE KEY `uniq_satellite_agent_freepbx_name` (`freepbx_name`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

        $db->exec('CREATE TABLE IF NOT EXISTS `satellite_agent_profiles` (
            `profile_key` VARCHAR(32) NOT NULL,
            `display_name` VARCHAR(100) NOT NULL,
            `trunk_id` INT UNSIGNED NULL,
            `flow` VARCHAR(64) NOT NULL,
            `model` VARCHAR(128) NULL,
            `voice` VARCHAR(128) NULL,
            `language` VARCHAR(16) NOT NULL DEFAULT \'it\',
            `greeting` TEXT NULL,
            `prompt` LONGTEXT NULL,
            `permissions_json` LONGTEXT NOT NULL,
            `tools_json` LONGTEXT NOT NULL,
            `transfer_policy_json` LONGTEXT NOT NULL,
            `knowledge_json` LONGTEXT NOT NULL,
            `max_call_duration_seconds` INT UNSIGNED NOT NULL DEFAULT 600,
            `fallback_destination` VARCHAR(255) NULL,
            `company_json` LONGTEXT NOT NULL,
            `calendar_services_json` LONGTEXT NOT NULL,
            `config_revision` BIGINT UNSIGNED NOT NULL DEFAULT 1,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`profile_key`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

        foreach (array(
            'max_call_duration_seconds' => 'INT UNSIGNED NOT NULL DEFAULT 600',
            'fallback_destination' => 'VARCHAR(255) NULL',
            'company_json' => 'LONGTEXT NULL',
            'calendar_services_json' => 'LONGTEXT NULL',
        ) as $column => $definition) {
            self::addColumnIfMissing($db, 'satellite_agent_profiles', $column, $definition);
        }
        $db->exec("UPDATE `satellite_agent_profiles` SET `company_json` = '{}' WHERE `company_json` IS NULL");
        $db->exec("UPDATE `satellite_agent_profiles` SET `calendar_services_json` = '{}' WHERE `calendar_services_json` IS NULL");

        $db->exec('CREATE TABLE IF NOT EXISTS `satellite_agent_directory_rules` (
            `resource_key` VARCHAR(128) NOT NULL,
            `resource_type` VARCHAR(32) NOT NULL,
            `description` TEXT NULL,
            `synonyms` TEXT NULL,
            `internal_allowed` TINYINT(1) NOT NULL DEFAULT 0,
            `external_allowed` TINYINT(1) NOT NULL DEFAULT 0,
            PRIMARY KEY (`resource_key`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

        $db->exec('CREATE TABLE IF NOT EXISTS `satellite_agent_configuration_state` (
            `id` TINYINT UNSIGNED NOT NULL,
            `desired_revision` BIGINT UNSIGNED NOT NULL DEFAULT 1,
            `desired_hash` CHAR(64) NULL,
            `acknowledged_revision` BIGINT UNSIGNED NOT NULL DEFAULT 0,
            `acknowledged_hash` CHAR(64) NULL,
            `sync_error` VARCHAR(500) NULL,
            `snapshot_revision` BIGINT UNSIGNED NULL,
            `snapshot_hash` CHAR(64) NULL,
            `payload_encrypted` LONGTEXT NULL,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        $db->exec('INSERT IGNORE INTO `satellite_agent_configuration_state` (`id`) VALUES (1)');

        $db->exec('CREATE TABLE IF NOT EXISTS `satellite_agent_webhook_previous_keys` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `binding_id` INT UNSIGNED NOT NULL,
            `provider` VARCHAR(16) NOT NULL,
            `secret_encrypted` TEXT NOT NULL,
            `expires_at` DATETIME NOT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_satellite_agent_previous_key_expiry` (`expires_at`),
            KEY `idx_satellite_agent_previous_key_binding` (`binding_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

        $seed = $db->prepare('INSERT IGNORE INTO `satellite_agent_profiles`
            (`profile_key`, `display_name`, `flow`, `permissions_json`, `tools_json`,
             `transfer_policy_json`, `knowledge_json`, `company_json`, `calendar_services_json`)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        foreach (array('internal' => 'Internal', 'external' => 'External') as $key => $flow) {
            $seed->execute(array($key, 'Builtin ' . $flow, $flow,
                json_encode(AgentProfileRepository::defaultPermissions()),
                json_encode(AgentProfileRepository::defaultTools()), '{}', '{}', '{}', '{}'));
        }
        $seed = $db->prepare('INSERT IGNORE INTO `satellite_agent_destinations`
            (`system_key`, `freepbx_name`, `agent_type`, `system_managed`, `enabled`)
            VALUES (?, ?, ?, 1, 1)');
        $seed->execute(array('builtin_internal', 'Satellite Agent Internal', 'builtin_internal'));
        $seed->execute(array('builtin_external', 'Satellite Agent External', 'builtin_external'));

        // Disabling Agent trunks and destinations is no longer supported.
        $db->exec('UPDATE `satellite_agent_trunks` SET `enabled` = 1 WHERE `enabled` <> 1');
        $db->exec('UPDATE `satellite_agent_destinations` SET `enabled` = 1 WHERE `enabled` <> 1');
    }

    private static function addColumnIfMissing($db, $table, $column, $definition)
    {
        $statement = $db->prepare('SHOW COLUMNS FROM `' . $table . '` LIKE ?');
        $statement->execute(array($column));
        if (!$statement->fetch(\PDO::FETCH_ASSOC)) {
            $db->exec('ALTER TABLE `' . $table . '` ADD COLUMN `' . $column . '` ' . $definition);
        }
    }
}
