<?php
 require_once("config.inc.php");
 require_once("session.inc.php");
 require_once("utils.inc.php");
 require_once("functions.inc.php");
 require("translations.php");

 printHeader(_("Groups of Rooms"),("rates.js"));
?>
<style type="text/css">@import "css/jquery.timeentry.css";</style>
<script type="text/javascript" src="js/jquery.timeentry.js"></script>
<script type="text/javascript" src="js/jquery.timeentry-it.js"></script>
<script type="text/javascript" src="js/groups.js"></script>

<?php
  printTitle(_("Groups of Rooms"), _("Rates")); ?>

 <div id='contentPane'>

<?php
 require_once("functions.inc.php");
 printMenu($sections,GROUPS);
?>
  <div id='content'>

<?php echo loadGroups();
