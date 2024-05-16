USE asterisk;

/*Default profiles*/
INSERT IGNORE INTO `rest_cti_profiles` VALUES (1,'Base');
INSERT IGNORE INTO `rest_cti_profiles` VALUES (2,'Standard');
INSERT IGNORE INTO `rest_cti_profiles` VALUES (3,'Advanced');

/*Permissions enabled by default for each profile*/
/*Base*/
INSERT IGNORE INTO `rest_cti_profiles_permissions` VALUES (1,2);
INSERT IGNORE INTO `rest_cti_profiles_permissions` VALUES (1,9);
/*Standard*/
INSERT IGNORE INTO `rest_cti_profiles_permissions` VALUES (2,1);
INSERT IGNORE INTO `rest_cti_profiles_permissions` VALUES (2,2);
INSERT IGNORE INTO `rest_cti_profiles_permissions` VALUES (2,3);
INSERT IGNORE INTO `rest_cti_profiles_permissions` VALUES (2,4);
INSERT IGNORE INTO `rest_cti_profiles_permissions` VALUES (2,5);
INSERT IGNORE INTO `rest_cti_profiles_permissions` VALUES (2,8);
INSERT IGNORE INTO `rest_cti_profiles_permissions` VALUES (2,9);
INSERT IGNORE INTO `rest_cti_profiles_permissions` VALUES (2,23);
/*Advanced*/
INSERT IGNORE INTO `rest_cti_profiles_permissions` VALUES (3,1);
INSERT IGNORE INTO `rest_cti_profiles_permissions` VALUES (3,2);
INSERT IGNORE INTO `rest_cti_profiles_permissions` VALUES (3,3);
INSERT IGNORE INTO `rest_cti_profiles_permissions` VALUES (3,4);
INSERT IGNORE INTO `rest_cti_profiles_permissions` VALUES (3,5);
INSERT IGNORE INTO `rest_cti_profiles_permissions` VALUES (3,6);
INSERT IGNORE INTO `rest_cti_profiles_permissions` VALUES (3,8);
INSERT IGNORE INTO `rest_cti_profiles_permissions` VALUES (3,12);
INSERT IGNORE INTO `rest_cti_profiles_permissions` VALUES (3,13);
INSERT IGNORE INTO `rest_cti_profiles_permissions` VALUES (3,22);
INSERT IGNORE INTO `rest_cti_profiles_permissions` VALUES (3,23);
INSERT IGNORE INTO `rest_cti_profiles_permissions` VALUES (3,24);
INSERT IGNORE INTO `rest_cti_profiles_permissions` VALUES (3,25);

/*Macro permissions enabled by default for each profile*/
INSERT IGNORE INTO `rest_cti_profiles_macro_permissions` VALUES (1,1);
INSERT IGNORE INTO `rest_cti_profiles_macro_permissions` VALUES (1,2);
INSERT IGNORE INTO `rest_cti_profiles_macro_permissions` VALUES (1,3);
INSERT IGNORE INTO `rest_cti_profiles_macro_permissions` VALUES (1,4);
INSERT IGNORE INTO `rest_cti_profiles_macro_permissions` VALUES (1,5);
INSERT IGNORE INTO `rest_cti_profiles_macro_permissions` VALUES (1,6);
INSERT IGNORE INTO `rest_cti_profiles_macro_permissions` VALUES (2,1);
INSERT IGNORE INTO `rest_cti_profiles_macro_permissions` VALUES (2,2);
INSERT IGNORE INTO `rest_cti_profiles_macro_permissions` VALUES (2,3);
INSERT IGNORE INTO `rest_cti_profiles_macro_permissions` VALUES (2,4);
INSERT IGNORE INTO `rest_cti_profiles_macro_permissions` VALUES (2,5);
INSERT IGNORE INTO `rest_cti_profiles_macro_permissions` VALUES (2,6);
INSERT IGNORE INTO `rest_cti_profiles_macro_permissions` VALUES (2,8);
INSERT IGNORE INTO `rest_cti_profiles_macro_permissions` VALUES (3,1);
INSERT IGNORE INTO `rest_cti_profiles_macro_permissions` VALUES (3,2);
INSERT IGNORE INTO `rest_cti_profiles_macro_permissions` VALUES (3,3);
INSERT IGNORE INTO `rest_cti_profiles_macro_permissions` VALUES (3,4);
INSERT IGNORE INTO `rest_cti_profiles_macro_permissions` VALUES (3,5);
INSERT IGNORE INTO `rest_cti_profiles_macro_permissions` VALUES (3,6);
INSERT IGNORE INTO `rest_cti_profiles_macro_permissions` VALUES (3,7);
INSERT IGNORE INTO `rest_cti_profiles_macro_permissions` VALUES (3,8);
INSERT IGNORE INTO `rest_cti_profiles_macro_permissions` VALUES (3,9);

