USE asterisk;

CREATE TABLE IF NOT EXISTS `rest_migration_report`(
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `type` varchar(20) NOT NULL DEFAULT '',
  `object` varchar(100) NOT NULL DEFAULT '',
  `message` varchar(1000) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

