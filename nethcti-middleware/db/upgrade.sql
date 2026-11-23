-- nethcti-middleware: db/upgrade.sql
-- Idempotent upgrade scripts applied to pre-existing databases at startup.

-- Issue #7124: phonebook structure redesign. Add split name, role, social and
-- extra phone columns to cti_phonebook. MariaDB supports IF NOT EXISTS on
-- ADD COLUMN, keeping this script safe to re-run on every boot.
--
-- No indexes are added for these columns: the phone/social columns are only
-- searched via leading-wildcard LIKE '%term%' (unusable by a B-tree) and the
-- lastname ordering runs against the materialized UNION result, not a direct
-- scan of cti_phonebook. Indexes here would be pure write-path overhead.
USE nethcti3;

ALTER TABLE cti_phonebook
	ADD COLUMN IF NOT EXISTS firstname varchar(255) DEFAULT NULL,
	ADD COLUMN IF NOT EXISTS lastname varchar(255) DEFAULT NULL,
	ADD COLUMN IF NOT EXISTS job varchar(255) DEFAULT NULL,
	ADD COLUMN IF NOT EXISTS facebook varchar(255) DEFAULT NULL,
	ADD COLUMN IF NOT EXISTS instagram varchar(255) DEFAULT NULL,
	ADD COLUMN IF NOT EXISTS linkedin varchar(255) DEFAULT NULL,
	ADD COLUMN IF NOT EXISTS workphone2 varchar(25) DEFAULT NULL,
	ADD COLUMN IF NOT EXISTS cellphone2 varchar(25) DEFAULT NULL,
	ADD COLUMN IF NOT EXISTS otherphone varchar(25) DEFAULT NULL,
	ADD COLUMN IF NOT EXISTS otheremail varchar(255) DEFAULT NULL;

CREATE TABLE IF NOT EXISTS user_nethlink (
	user varchar(255) NOT NULL UNIQUE,
	extension varchar(255) NOT NULL,
	timestamp varchar(255) DEFAULT NULL,
	nethlink_version varchar(64) DEFAULT NULL,
	os_type varchar(32) DEFAULT NULL,
	os_release varchar(128) DEFAULT NULL,
	arch varchar(32) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;

ALTER TABLE user_nethlink
	ADD COLUMN IF NOT EXISTS nethlink_version varchar(64) DEFAULT NULL,
	ADD COLUMN IF NOT EXISTS os_type varchar(32) DEFAULT NULL,
	ADD COLUMN IF NOT EXISTS os_release varchar(128) DEFAULT NULL,
	ADD COLUMN IF NOT EXISTS arch varchar(32) DEFAULT NULL;
