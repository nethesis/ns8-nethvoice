/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40103 SET TIME_ZONE='+00:00' */;
USE `asterisk`;
INSERT INTO `rest_cti_permissions` (`id`,`name`,`displayname`,`description`) VALUES
(2,"dnd","DND","Configure do Not Disturb"),
(3,"call_forward","Call Forward","Configure Call Forward"),
(4,"recording","Recording","Record own conversations. View/listen/delete own recording"),
(5,"conference","Conference","Make a conference call"),
(6,"parkings","Parkings","View parkings state and pickup parked calls"),
(8,"chat","Chat","Use chat service"),
(9,"privacy","Privacy","Obfuscate called and caller numbers for other users"),
(12,"ad_phonebook","Advanced Phonebook","Modify and delete all contacts"),
(13,"ad_cdr","PBX CDR","View all users call history"),
(15,"spy","Spy","Hear other extensions calls"),
(16,"intrude","Intrude","Intrude in calls"),
(17,"ad_recording","Advanced Recording","Record anyone call"),
(18,"pickup","Pickup","Pick-up any call"),
(19,"transfer","Transfer","Transfer everyone call"),
(20,"ad_parking","Advanced Parking","Allow to park any call and to pickup them using any extension"),
(21,"hangup","Hangup","Hangup everyone call"),
(22,"trunks","PBX lines","View PBX lines"),
(23,"ad_queue_agent","Advanced queue agent panel","View more queue information"),
(24,"lost_queue_call","Lost Queue Calls","Allow to view Queue Recall panel"),
(25,"advanced_off_hour","Advanced Off Hour","Allow to change user\'s incoming call path and generic inbound routes"),
(26,"ad_phone","Advanced Phone","Use phone features (hangup, call, answer) on conversations not owned by the user"),
(27,"ad_off_hour","Admin Off Hour","Allow to change all incoming call paths"),
(28,"grp_all_permissions","Activate all group","All group will be visible"),
(1000,"screen_sharing","Screen Sharing","Allow to share the desktop"),
(2000,"phone_buttons","Phone buttons","Allow the user to customize functions of physical phone buttons. These values correspond to the Line Keys settings shown in Devices -> Models and Configurations pages"),
(3000,"video_conference","Video Conference","Allow to start a video conference"),
(4000,"group_cdr","Group CDR","Allow to see call history of members of user groups");
