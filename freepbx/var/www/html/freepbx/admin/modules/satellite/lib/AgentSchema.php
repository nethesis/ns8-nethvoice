<?php

/** Installs Phase 1 tables; safe to invoke on install and every upgrade. */
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
    }
}
