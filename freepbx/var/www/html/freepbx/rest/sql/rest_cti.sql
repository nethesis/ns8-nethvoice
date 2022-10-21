USE asterisk;

CREATE TABLE IF NOT EXISTS `rest_cti_profiles_paramurl`(
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `profile_id` INT UNSIGNED NOT NULL,
  `url` varchar(255) NOT NULL DEFAULT '',
  `only_queues` TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE `profile_id_key` (`profile_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rest_cti_profiles`(
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` varchar(255) NOT NULL DEFAULT 'Custom'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rest_cti_macro_permissions`(
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` varchar(190) NOT NULL DEFAULT '',
  `displayname` varchar(255) NOT NULL DEFAULT '',
  `description` varchar(1024) NOT NULL DEFAULT '',
  UNIQUE `name_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rest_cti_permissions`(
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` varchar(190) NOT NULL DEFAULT '',
  `displayname` varchar(255) NOT NULL DEFAULT '',
  `description` varchar(1024) NOT NULL DEFAULT '',
  UNIQUE `name_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rest_cti_profiles_permissions`(
  `profile_id` INT UNSIGNED NOT NULL,
  `permission_id` INT UNSIGNED NOT NULL,
  FOREIGN KEY (`profile_id`) REFERENCES `rest_cti_profiles`(`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  FOREIGN KEY (`permission_id`) REFERENCES `rest_cti_permissions`(`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  UNIQUE KEY `line` (`profile_id`,`permission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rest_cti_profiles_macro_permissions`(
  `profile_id` INT UNSIGNED NOT NULL,
  `macro_permission_id` INT UNSIGNED NOT NULL,
  FOREIGN KEY (`profile_id`) REFERENCES `rest_cti_profiles`(`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  FOREIGN KEY (`macro_permission_id`) REFERENCES `rest_cti_macro_permissions`(`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  UNIQUE KEY `line` (`profile_id`,`macro_permission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*This table contains all available permissions inside macro permissions*/
CREATE TABLE IF NOT EXISTS `rest_cti_macro_permissions_permissions`(
  `macro_permission_id` INT UNSIGNED NOT NULL,
  `permission_id` INT UNSIGNED NOT NULL,
  FOREIGN KEY (`macro_permission_id`) REFERENCES `rest_cti_macro_permissions`(`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  FOREIGN KEY (`permission_id`) REFERENCES `rest_cti_permissions`(`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  UNIQUE KEY `line` (`macro_permission_id`,`permission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rest_cti_groups` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(65) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rest_cti_users_groups` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `group_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_group` (`user_id`,`group_id`),
  KEY `group_id` (`group_id`),
  FOREIGN KEY (`group_id`) REFERENCES `rest_cti_groups` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `userman_users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rest_cti_streaming` (
  `descr` varchar(50) NOT NULL,
  `url` varchar(8000) NOT NULL DEFAULT 'localhost',
  `user` varchar(30) DEFAULT '',
  `secret` varchar(90) DEFAULT '',
  `frame-rate` int(11) DEFAULT '1000',
  `exten` int(11) DEFAULT NULL,
  `open` varchar(10) DEFAULT '',
  PRIMARY KEY (`descr`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*Create Profiles-routes permissions table*/
CREATE TABLE IF NOT EXISTS `rest_cti_profiles_routes_permission`(
  `profile_id` INT UNSIGNED NOT NULL,
  `route_id` INT(11) NOT NULL,
  `permission` TINYINT(1),
  FOREIGN KEY (`profile_id`) REFERENCES `rest_cti_profiles`(`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  FOREIGN KEY (`route_id`) REFERENCES `outbound_routes`(`route_id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  UNIQUE KEY `line` (`profile_id`,`route_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*Macro permissions*/
INSERT IGNORE INTO `rest_cti_macro_permissions` VALUES (1,'settings','Settings','General and notifications settings');
INSERT IGNORE INTO `rest_cti_macro_permissions` VALUES (2,'phonebook','Phonebook','View Phonebook, add contacts, modify and delete own contacts');
INSERT IGNORE INTO `rest_cti_macro_permissions` VALUES (3,'cdr','CDR','View own call history');
INSERT IGNORE INTO `rest_cti_macro_permissions` VALUES (4,'customer_card','Customer Card','Allow to view Customer Cards');
INSERT IGNORE INTO `rest_cti_macro_permissions` VALUES (5,'presence_panel','Presence Panel','Allow to view Presence Panel');
INSERT IGNORE INTO `rest_cti_macro_permissions` VALUES (6,'queue_agent','Use queue agent panel','View Queues and queues info of the user, login/logout from queues, enable or disable pause state');
INSERT IGNORE INTO `rest_cti_macro_permissions` VALUES (7,'streaming','Streaming','Allow to view Streaming Panel');
INSERT IGNORE INTO `rest_cti_macro_permissions` VALUES (8,'off_hour','Off Hour','Allow to change of his incoming call paths');
INSERT IGNORE INTO `rest_cti_macro_permissions` VALUES (9,'remote_sites','Remote Sites','Allow to view Remote Sites information');
INSERT IGNORE INTO `rest_cti_macro_permissions` VALUES (10,'qmanager','Queue Manager','Allow to view and manage queues in real time');
INSERT IGNORE INTO `rest_cti_macro_permissions` VALUES (11,'operator_panel','Operator Panel','Enables Operator Panel interface for operators');

/*Permissions*/
INSERT IGNORE INTO `rest_cti_permissions` VALUES (2,'dnd','DND','Configure do Not Disturb');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (3,'call_forward','Call Forward','Configure Call Forward');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (4,'recording','Recording','Record own conversations. View/listen/delete own recording');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (5,'conference','Conference','Make a conference call');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (6,'parkings','Parkings','View parkings state and pickup parked calls');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (8,'chat','Chat','Use chat service');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (9,'privacy','Privacy','Obfuscate called and caller numbers for other users');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (12,'ad_phonebook','Advanced Phonebook','Modify and delete all contacts');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (13,'ad_cdr','PBX CDR','View all users call history');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (15,'spy','Spy','Hear other extensions calls');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (16,'intrude','Intrude','Intrude in calls');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (17,'ad_recording','Advanced Recording','Record anyone call');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (18,'pickup','Pickup','Pick-up any call');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (19,'transfer','Transfer','Transfer everyone call');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (20,'ad_parking','Advanced Parking','Allow to park any call and to pickup them using any extension');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (21,'hangup','Hangup','Hangup everyone call');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (22,'trunks','PBX lines','View PBX lines');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (23,'ad_queue_agent','Advanced queue agent panel','View more queue information');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (24,'lost_queue_call','Lost Queue Calls','Allow to view Queue Recall panel');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (25,'advanced_off_hour','Advanced Off Hour','Allow to change user\'s incoming call path and generic inbound routes');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (26,'ad_phone','Advanced Phone','Use phone features (hangup, call, answer) on conversations not owned by the user');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (27,'ad_off_hour','Admin Off Hour','Allow to change all incoming call paths');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (1000,'screen_sharing','Screen Sharing','Allow to share the desktop');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (2000,'phone_buttons','Phone buttons','Allow to customize physical phone buttons');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (3000,'video_conference','Video Conference','Allow to start a video conference');
INSERT IGNORE INTO `rest_cti_permissions` VALUES (4000,'group_cdr','Group CDR','Allow to see call history of members of user groups');

/*Permission inside macro permissions*/
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (1,2);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (1,3);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (1,4);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (1,5);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (1,6);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (1,8);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (1,9);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (1,1000);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (1,2000);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (1,3000);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (3,4000);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (2,12);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (3,13);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (5,15);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (5,16);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (5,17);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (5,18);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (5,19);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (5,20);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (5,21);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (5,22);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (5,26);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (6,23);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (6,24);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (8,25);
INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` VALUES (8,27);

/*Permissions updates*/
UPDATE IGNORE `rest_cti_permissions` SET `name`='advanced_off_hour_tmp',`displayname`='Advanced Off Hour',`description`='Allow to change user\'s incoming call path and generic inbound routes' WHERE id = 25;
UPDATE IGNORE `rest_cti_permissions` SET `name`='ad_off_hour',`displayname`='Admin Off Hour',`description`='Allow to change all incoming call paths' WHERE id = 27;
UPDATE IGNORE `rest_cti_permissions` SET `name`='advanced_off_hour',`displayname`='Advanced Off Hour',`description`='Allow to change user\'s incoming call path and generic inbound routes' WHERE id = 25;
UPDATE IGNORE `rest_cti_permissions` SET `description`='Allow the user to customize functions of physical phone buttons. These values correspond to the Line Keys settings shown in Devices -> Models and Configurations pages' WHERE id = 2000;
DELETE IGNORE FROM `rest_cti_permissions` WHERE `id`=11 AND `name` = 'QueueMan';
DELETE IGNORE FROM `rest_cti_permissions` WHERE `id`=14 AND `name` = 'ad_sms';
DELETE IGNORE FROM `rest_cti_permissions` WHERE `id`=7 AND `name` = 'sms';
DELETE IGNORE FROM `rest_cti_permissions` WHERE `id`=1 AND `name` = 'call_waiting';
DELETE IGNORE FROM `rest_cti_permissions` WHERE `id`=10 AND `name` = 'oppanel';
