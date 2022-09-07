/*!40101 SET NAMES binary*/;
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40103 SET TIME_ZONE='+00:00' */;
INSERT INTO `rest_cti_macro_permissions` (`id`,`name`,`displayname`,`description`) VALUES
(1,"settings","Settings","General and notifications settings"),
(2,"phonebook","Phonebook","View Phonebook, add contacts, modify and delete own contacts"),
(3,"cdr","CDR","View own call history"),
(4,"customer_card","Customer Card","Allow to view Customer Cards"),
(5,"presence_panel","Presence Panel","Allow to view Presence Panel"),
(6,"queue_agent","Use queue agent panel","View Queues and queues info of the user, login/logout from queues, enable or disable pause state"),
(7,"streaming","Streaming","Allow to view Streaming Panel"),
(8,"off_hour","Off Hour","Allow to change of his incoming call paths"),
(9,"remote_sites","Remote Sites","Allow to view Remote Sites information"),
(10,"qmanager","Queue Manager","Allow to view and manage queues in real time"),
(11,"operator_panel","Operator Panel","Enables Operator Panel interface for operators");
